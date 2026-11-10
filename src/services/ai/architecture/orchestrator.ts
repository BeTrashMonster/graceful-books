/**
 * CaMeL Orchestrator
 *
 * Coordinates the dual-LLM architecture flow:
 * 1. User request comes in
 * 2. Planner generates extraction schema (no raw data access)
 * 3. Quarantine processes data with schema (no tool access)
 * 4. Results go to staging area for human review
 * 5. Human approves/rejects/modifies
 * 6. Approved changes apply to live data
 *
 * This separation ensures:
 * - Prompt injection in data cannot trigger tools
 * - Trusted planning never sees untrusted data
 * - All AI actions require human approval
 *
 * @security Phase 3.2 - CaMeL Architecture Scaffolding
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import { type PlannerContext, type AISuggestion, AITaskType } from './types';
import { generatePlan, getPlannerStats } from './planner';
import {
  processQuarantineRequest,
  getQuarantineStats,
} from './quarantine';
import {
  addSuggestion,
  getStats as getStagingStats,
  getPendingCount,
} from './stagingArea';

/**
 * Orchestration request
 */
export interface OrchestrationRequest {
  task: AITaskType;
  company_id: string;
  user_id: string;
  instruction?: string;

  // Context (aggregates only, no raw data)
  date_range?: {
    start: string;
    end: string;
  };
  transaction_count?: number;
  account_types?: string[];

  // User preferences
  preferences?: {
    categories_used?: string[];
    common_vendors?: string[];
  };
}

/**
 * Sanitized transaction for processing
 */
export interface TransactionForProcessing {
  id: string;
  date: string;
  sanitized_description: string;
  amount: number;
  account_type: string;
}

/**
 * Orchestration result
 */
export interface OrchestrationResult {
  success: boolean;
  request_id: string;
  suggestion_id?: string;
  pending_review: boolean;
  error?: string;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `orch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Execute the full CaMeL pipeline
 *
 * This is the main entry point for AI operations.
 * It coordinates between Planner, Quarantine, and Staging Area.
 */
export async function executeTask(
  request: OrchestrationRequest,
  sanitizedTransactions: TransactionForProcessing[]
): Promise<OrchestrationResult> {
  const requestId = generateRequestId();

  try {
    // Step 1: Build planner context (NO RAW DATA)
    const plannerContext: PlannerContext = {
      task: request.task,
      company_id: request.company_id,
      user_id: request.user_id,
      request_id: requestId,
      date_range: request.date_range,
      transaction_count: sanitizedTransactions.length,
      account_types: request.account_types,
      preferences: request.preferences,
    };

    // Step 2: Get plan from Planner LLM
    const planResponse = await generatePlan({
      context: plannerContext,
      instruction: request.instruction,
    });

    if (!planResponse.success) {
      return {
        success: false,
        request_id: requestId,
        pending_review: false,
        error: `Planning failed: ${planResponse.error}`,
      };
    }

    // Step 3: Process data in Quarantine LLM
    const quarantineResponse = await processQuarantineRequest({
      request_id: requestId,
      transactions: sanitizedTransactions,
      extraction_schema: planResponse.extraction_schema,
      processing_instructions: planResponse.processing_instructions,
    });

    if (!quarantineResponse.success) {
      return {
        success: false,
        request_id: requestId,
        pending_review: false,
        error: `Quarantine processing failed: ${quarantineResponse.error}`,
      };
    }

    // Step 4: Create suggestion in staging area
    const suggestionType = mapTaskToSuggestionType(request.task);

    const suggestion = addSuggestion({
      request_id: requestId,
      task_type: request.task,
      company_id: request.company_id,
      user_id: request.user_id,
      suggestion_type: suggestionType,
      suggested_data: quarantineResponse.extracted_data,
      confidence: quarantineResponse.confidence,
      explanation: `AI ${request.task} suggestion generated from ${sanitizedTransactions.length} transactions`,
      affected_transactions: sanitizedTransactions.map((t) => t.id),
    });

    // Step 5: Return result - suggestion is now pending human review
    return {
      success: true,
      request_id: requestId,
      suggestion_id: suggestion.id,
      pending_review: true,
    };
  } catch (error) {
    return {
      success: false,
      request_id: requestId,
      pending_review: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Map task type to suggestion type
 */
function mapTaskToSuggestionType(
  task: AITaskType
): 'categorization' | 'anomaly' | 'forecast' | 'journal_entry' {
  switch (task) {
    case AITaskType.CATEGORIZE:
      return 'categorization';
    case AITaskType.ANOMALY_DETECT:
      return 'anomaly';
    case AITaskType.FORECAST:
      return 'forecast';
    case AITaskType.RECONCILE:
    case AITaskType.SUMMARIZE:
      return 'journal_entry'; // Generic for now
  }
}

/**
 * Get overall system health
 */
export function getSystemHealth(): {
  operational: boolean;
  planner_stats: ReturnType<typeof getPlannerStats>;
  quarantine_stats: ReturnType<typeof getQuarantineStats>;
  staging_stats: ReturnType<typeof getStagingStats>;
  issues: string[];
} {
  const plannerStats = getPlannerStats();
  const quarantineStats = getQuarantineStats();
  const stagingStats = getStagingStats();

  const issues: string[] = [];

  // Check for high failure rates
  const plannerFailRate =
    plannerStats.total_sessions > 0
      ? plannerStats.failed / plannerStats.total_sessions
      : 0;
  if (plannerFailRate > 0.1) {
    issues.push(`High planner failure rate: ${(plannerFailRate * 100).toFixed(1)}%`);
  }

  const quarantineFailRate =
    quarantineStats.total_sessions > 0
      ? quarantineStats.failed / quarantineStats.total_sessions
      : 0;
  if (quarantineFailRate > 0.1) {
    issues.push(
      `High quarantine failure rate: ${(quarantineFailRate * 100).toFixed(1)}%`
    );
  }

  // Check for suggestion backlog
  if (stagingStats.pending > 100) {
    issues.push(`Large suggestion backlog: ${stagingStats.pending} pending`);
  }

  return {
    operational: issues.length === 0,
    planner_stats: plannerStats,
    quarantine_stats: quarantineStats,
    staging_stats: stagingStats,
    issues,
  };
}

/**
 * Get pending review count for a company
 */
export function getPendingReviewCount(companyId: string): number {
  return getPendingCount(companyId);
}

/**
 * Check if AI features are enabled
 * (Placeholder for kill switch integration in Phase 3.3)
 */
export function isAIEnabled(): boolean {
  // Will integrate with kill switch in Phase 3.3
  return true;
}

export default {
  executeTask,
  getSystemHealth,
  getPendingReviewCount,
  isAIEnabled,
};
