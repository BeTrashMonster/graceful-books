/**
 * AI Categorization Service
 *
 * Implements secure transaction categorization using the CaMeL architecture.
 * All OWASP Agentic Top 10 controls are applied.
 *
 * Security controls:
 * - ASI01 (Goal Hijacking): Sanitized inputs prevent instruction override
 * - ASI02 (Tool Misuse): Quarantine LLM has no tools
 * - ASI03 (Privilege Abuse): AI writes to staging only
 * - ASI04 (Supply Chain): Model version pinned
 * - ASI05 (Unexpected Execution): All actions logged
 * - ASI06 (Memory Poisoning): No persistent AI memory
 * - ASI07 (Inter-Agent Comms): Single agent, no multi-agent
 * - ASI08 (Cascading Failures): Kill switch stops all AI
 * - ASI09 (Trust Exploitation): User approval required
 * - ASI10 (Rogue Agents): No autonomous actions
 *
 * @security Phase 4.1 - AI Categorization Feature
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import {
  executeTask,
  AITaskType,
  SuggestionStatus,
  addSuggestion,
  getSuggestion,
  querySuggestions,
  approveSuggestion,
  rejectSuggestion,
  type TransactionForProcessing,
  type AISuggestion,
} from '../../architecture';

import {
  isAIEnabled,
  logRequest,
  logResponse,
  logError,
  analyzeOutput,
  recordOperation,
} from '../../monitoring';

import {
  isFeatureAllowed,
  AIFeature,
} from '../../consent';

/**
 * Transaction input for categorization
 */
export interface TransactionInput {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountType: string;
}

/**
 * Category suggestion from AI
 */
export interface CategorySuggestion {
  transactionId: string;
  suggestedCategory: string;
  confidence: number;
  reasoning?: string;
  alternativeCategories?: Array<{
    category: string;
    confidence: number;
  }>;
}

/**
 * Categorization request
 */
export interface CategorizationRequest {
  userId: string;
  companyId: string;
  transactions: TransactionInput[];
  existingCategories?: string[];
  preferredCategories?: string[];
}

/**
 * Categorization result
 */
export interface CategorizationResult {
  success: boolean;
  suggestionId?: string;
  suggestions?: CategorySuggestion[];
  pendingReview: boolean;
  error?: string;
}

/**
 * Learning entry for "never suggest" rules
 */
interface NeverSuggestRule {
  id: string;
  companyId: string;
  userId: string;
  pattern: string;
  patternType: 'vendor' | 'description' | 'amount_range';
  excludedCategory: string;
  createdAt: string;
  reason?: string;
}

// In-memory storage for "never suggest" rules
const neverSuggestRules: NeverSuggestRule[] = [];

/**
 * Error class for AI disabled state
 */
export class AIDisabledError extends Error {
  constructor(reason?: string) {
    super(`AI features are disabled${reason ? `: ${reason}` : ''}`);
    this.name = 'AIDisabledError';
  }
}

/**
 * Error class for consent not granted
 */
export class ConsentNotGrantedError extends Error {
  constructor(feature: string) {
    super(`User has not granted consent for ${feature}`);
    this.name = 'ConsentNotGrantedError';
  }
}

/**
 * Sanitize transaction description for AI processing
 */
function sanitizeDescription(description: string): string {
  // Remove potential injection patterns
  let sanitized = description
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    // Normalize unicode
    .normalize('NFKC')
    // Limit length
    .substring(0, 500)
    // Trim
    .trim();

  // Remove XML/HTML-like tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove instruction-like patterns
  const instructionPatterns = [
    /ignore\s+(previous|all|your)\s+instructions?/gi,
    /system\s*prompt/gi,
    /you\s+are\s+now/gi,
    /new\s+instructions?:/gi,
  ];

  for (const pattern of instructionPatterns) {
    sanitized = sanitized.replace(pattern, '[REMOVED]');
  }

  return sanitized;
}

/**
 * Check "never suggest" rules
 */
function checkNeverSuggestRules(
  companyId: string,
  transaction: TransactionInput,
  suggestedCategory: string
): boolean {
  const companyRules = neverSuggestRules.filter(
    (r) => r.companyId === companyId && r.excludedCategory === suggestedCategory
  );

  for (const rule of companyRules) {
    switch (rule.patternType) {
      case 'vendor':
        if (transaction.description.toLowerCase().includes(rule.pattern.toLowerCase())) {
          return true; // Should NOT suggest this category
        }
        break;
      case 'description':
        if (new RegExp(rule.pattern, 'i').test(transaction.description)) {
          return true;
        }
        break;
      case 'amount_range':
        const [min, max] = rule.pattern.split('-').map(Number);
        if (transaction.amount >= min && transaction.amount <= max) {
          return true;
        }
        break;
    }
  }

  return false;
}

/**
 * Categorize transactions with full security controls
 *
 * This is the main entry point for AI categorization.
 * Implements the full CaMeL flow with all OWASP controls.
 */
export async function categorizeTransactions(
  request: CategorizationRequest
): Promise<CategorizationResult> {
  const startTime = Date.now();

  try {
    // Step 1: Check kill switch (ASI08)
    if (!isAIEnabled()) {
      throw new AIDisabledError();
    }

    // Step 2: Check rate limits
    const rateCheck = recordOperation();
    if (!rateCheck.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetIn / 1000)} seconds.`);
    }

    // Step 3: Check consent (ASI09)
    if (!isFeatureAllowed(request.userId, request.companyId, AIFeature.AUTO_CATEGORIZE)) {
      throw new ConsentNotGrantedError('auto-categorization');
    }

    // Step 4: Log request (ASI05)
    logRequest(
      AITaskType.CATEGORIZE,
      request.companyId,
      request.userId,
      `cat_${Date.now()}`,
      request.transactions.length
    );

    // Step 5: Sanitize inputs (ASI01)
    const sanitizedTransactions: TransactionForProcessing[] = request.transactions.map(
      (tx) => ({
        id: tx.id,
        date: tx.date,
        sanitized_description: sanitizeDescription(tx.description),
        amount: tx.amount,
        account_type: tx.accountType,
      })
    );

    // Step 6: Execute CaMeL flow (ASI02, ASI03)
    const result = await executeTask(
      {
        task: AITaskType.CATEGORIZE,
        company_id: request.companyId,
        user_id: request.userId,
        preferences: {
          categories_used: request.existingCategories,
        },
      },
      sanitizedTransactions
    );

    if (!result.success) {
      throw new Error(result.error || 'Categorization failed');
    }

    // Step 7: Get suggestion and extract categorizations
    const suggestion = getSuggestion(result.suggestion_id!);
    if (!suggestion) {
      throw new Error('Suggestion not found after creation');
    }

    // Step 8: Analyze output for anomalies
    const anomalies = analyzeOutput(suggestion.suggested_data, {
      requestId: result.request_id,
      companyId: request.companyId,
      userId: request.userId,
    });

    if (anomalies.some((a) => a.severity === 'critical')) {
      throw new Error('Critical anomaly detected in AI output');
    }

    // Step 9: Apply "never suggest" rules
    const rawSuggestions = (suggestion.suggested_data as any).categorizations || [];
    const filteredSuggestions: CategorySuggestion[] = [];

    for (const raw of rawSuggestions) {
      const transaction = request.transactions.find((t) => t.id === raw.transaction_id);
      if (!transaction) continue;

      // Check never suggest rules
      if (checkNeverSuggestRules(request.companyId, transaction, raw.suggested_category)) {
        continue; // Skip this suggestion
      }

      filteredSuggestions.push({
        transactionId: raw.transaction_id,
        suggestedCategory: raw.suggested_category,
        confidence: raw.confidence || 0.5,
        reasoning: raw.reasoning,
      });
    }

    // Step 10: Log response (ASI05)
    const durationMs = Date.now() - startTime;
    logResponse(
      result.request_id,
      true,
      suggestion.confidence,
      durationMs,
      result.suggestion_id
    );

    // Step 11: Return result - requires user approval (ASI09, ASI10)
    return {
      success: true,
      suggestionId: result.suggestion_id,
      suggestions: filteredSuggestions,
      pendingReview: true, // Always requires review
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logError(
      undefined,
      error instanceof Error ? error : new Error(String(error)),
      request.companyId,
      request.userId
    );

    return {
      success: false,
      pendingReview: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Apply approved categorization
 *
 * Only called after user approves the suggestion.
 */
export async function applyCategorizationApproval(
  suggestionId: string,
  approvedBy: string,
  modifications?: Record<string, string> // transactionId -> newCategory
): Promise<{
  success: boolean;
  appliedCount: number;
  error?: string;
}> {
  try {
    // Get the suggestion
    const suggestion = getSuggestion(suggestionId);
    if (!suggestion) {
      return { success: false, appliedCount: 0, error: 'Suggestion not found' };
    }

    if (suggestion.status !== SuggestionStatus.PENDING) {
      return {
        success: false,
        appliedCount: 0,
        error: `Suggestion is ${suggestion.status}, not pending`,
      };
    }

    // Apply modifications if provided
    let finalData = suggestion.suggested_data;
    if (modifications && Object.keys(modifications).length > 0) {
      const categorizations = (finalData as any).categorizations || [];
      for (const cat of categorizations) {
        if (modifications[cat.transaction_id]) {
          cat.suggested_category = modifications[cat.transaction_id];
          cat.modified_by_user = true;
        }
      }
      finalData = { categorizations };
    }

    // Approve the suggestion
    const approvalResult = modifications
      ? approveSuggestion(suggestionId, approvedBy, 'Applied with modifications')
      : approveSuggestion(suggestionId, approvedBy);

    if (!approvalResult.success) {
      return { success: false, appliedCount: 0, error: approvalResult.error };
    }

    // Count applied categorizations
    const appliedCount = ((finalData as any).categorizations || []).length;

    // In a real implementation, this would update the actual transactions
    // For now, we just return success
    return {
      success: true,
      appliedCount,
    };
  } catch (error) {
    return {
      success: false,
      appliedCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Reject categorization suggestion
 */
export async function rejectCategorization(
  suggestionId: string,
  rejectedBy: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const result = rejectSuggestion(suggestionId, rejectedBy, reason);
  return result;
}

/**
 * Add a "never suggest" rule
 *
 * Allows users to prevent certain categorizations for specific patterns.
 */
export function addNeverSuggestRule(
  companyId: string,
  userId: string,
  pattern: string,
  patternType: 'vendor' | 'description' | 'amount_range',
  excludedCategory: string,
  reason?: string
): NeverSuggestRule {
  const rule: NeverSuggestRule = {
    id: `nsr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    companyId,
    userId,
    pattern,
    patternType,
    excludedCategory,
    createdAt: new Date().toISOString(),
    reason,
  };

  neverSuggestRules.push(rule);
  return rule;
}

/**
 * Get "never suggest" rules for a company
 */
export function getNeverSuggestRules(companyId: string): NeverSuggestRule[] {
  return neverSuggestRules.filter((r) => r.companyId === companyId);
}

/**
 * Remove a "never suggest" rule
 */
export function removeNeverSuggestRule(ruleId: string): boolean {
  const index = neverSuggestRules.findIndex((r) => r.id === ruleId);
  if (index === -1) return false;
  neverSuggestRules.splice(index, 1);
  return true;
}

/**
 * Get pending categorization suggestions for a company
 */
export function getPendingCategorizationSuggestions(
  companyId: string,
  userId?: string
): AISuggestion[] {
  const result = querySuggestions({
    company_id: companyId,
    user_id: userId,
    task_type: AITaskType.CATEGORIZE,
    status: SuggestionStatus.PENDING,
  });

  return result.suggestions;
}

/**
 * Clear "never suggest" rules (for testing)
 */
export function clearNeverSuggestRules(): void {
  neverSuggestRules.length = 0;
}

export default {
  categorizeTransactions,
  applyCategorizationApproval,
  rejectCategorization,
  addNeverSuggestRule,
  getNeverSuggestRules,
  removeNeverSuggestRule,
  getPendingCategorizationSuggestions,
  clearNeverSuggestRules,
};
