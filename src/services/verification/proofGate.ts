/**
 * Proof Gate Service
 *
 * Central validation service that enforces accounting invariants
 * before any transaction is saved. Acts as a "proof gate" that
 * blocks invalid transactions, especially AI-generated ones.
 *
 * Key features:
 * - Blocks all unbalanced entries
 * - Extra scrutiny for AI-generated transactions
 * - Audit logging of all validation attempts
 * - Performance tracking (<100ms target)
 *
 * @security Phase 3.1 - Formal Verification of Accounting Invariants
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import {
  validateEntry,
  isBalanced,
  type JournalEntry,
  type ProofGateResult,
  type BusinessRuleContext,
  type InvariantViolation,
} from './accountingInvariants';

/**
 * Proof gate validation request
 */
export interface ProofGateRequest {
  entry: JournalEntry;
  context?: BusinessRuleContext;
  options?: {
    includeWarnings?: boolean;
    strictMode?: boolean; // Fails on warnings too
    aiScrutiny?: boolean; // Extra checks for AI entries
    bypassForTesting?: boolean; // NEVER use in production
  };
}

/**
 * Extended proof gate result with audit info
 */
export interface ProofGateResponse extends ProofGateResult {
  request_id: string;
  timestamp: string;
  blocked: boolean;
  block_reason?: string;
  audit_logged: boolean;
}

/**
 * Proof gate statistics
 */
export interface ProofGateStats {
  total_validations: number;
  passed: number;
  blocked: number;
  warnings_issued: number;
  average_time_ms: number;
  ai_entries_validated: number;
  ai_entries_blocked: number;
}

// In-memory stats (in production, persist to database)
const stats: ProofGateStats = {
  total_validations: 0,
  passed: 0,
  blocked: 0,
  warnings_issued: 0,
  average_time_ms: 0,
  ai_entries_validated: 0,
  ai_entries_blocked: 0,
};

// Validation history for audit (in production, persist to database)
const validationHistory: ProofGateResponse[] = [];
const MAX_HISTORY_SIZE = 1000;

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `pg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log validation to audit trail
 */
function logToAudit(response: ProofGateResponse): void {
  validationHistory.push(response);

  // Keep history bounded
  if (validationHistory.length > MAX_HISTORY_SIZE) {
    validationHistory.shift();
  }

  // In production, also log to persistent audit trail
  if (response.blocked) {
    console.warn(
      `[ProofGate] BLOCKED: ${response.request_id} - ${response.block_reason}`
    );
  }
}

/**
 * Update statistics
 */
function updateStats(response: ProofGateResponse, isAI: boolean): void {
  stats.total_validations++;

  if (response.blocked) {
    stats.blocked++;
    if (isAI) stats.ai_entries_blocked++;
  } else {
    stats.passed++;
  }

  if (isAI) stats.ai_entries_validated++;

  const warningCount = response.violations.filter(
    (v) => v.severity === 'warning'
  ).length;
  stats.warnings_issued += warningCount;

  // Running average
  stats.average_time_ms =
    (stats.average_time_ms * (stats.total_validations - 1) +
      response.validation_time_ms) /
    stats.total_validations;
}

/**
 * Main proof gate validation function
 *
 * All transactions MUST pass through this gate before saving.
 */
export function validate(request: ProofGateRequest): ProofGateResponse {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  // Check for bypass (should NEVER be used in production)
  if (request.options?.bypassForTesting) {
    console.warn(`[ProofGate] WARNING: Bypass used for ${requestId}`);
    const response: ProofGateResponse = {
      request_id: requestId,
      timestamp,
      valid: true,
      blocked: false,
      violations: [],
      invariants_checked: ['BYPASSED'],
      validation_time_ms: 0,
      audit_logged: true,
      proof_trace: '; BYPASSED - Testing mode',
    };
    logToAudit(response);
    return response;
  }

  // Determine if AI scrutiny should be applied
  const applyAiScrutiny =
    request.options?.aiScrutiny !== false && request.entry.aiGenerated;

  // Run validation
  const result = validateEntry(request.entry, request.context, {
    includeWarnings: true, // Always collect warnings for audit
    skipAiChecks: !applyAiScrutiny,
    skipBusinessChecks: false,
  });

  // Determine if blocked
  const errors = result.violations.filter((v) => v.severity === 'error');
  const warnings = result.violations.filter((v) => v.severity === 'warning');

  let blocked = errors.length > 0;
  let blockReason: string | undefined;

  // In strict mode, warnings also block
  if (request.options?.strictMode && warnings.length > 0) {
    blocked = true;
    blockReason = `Strict mode: ${warnings.length} warning(s) treated as errors`;
  } else if (errors.length > 0) {
    blockReason = errors.map((e) => e.message).join('; ');
  }

  // Build response
  const response: ProofGateResponse = {
    request_id: requestId,
    timestamp,
    valid: result.valid,
    blocked,
    block_reason: blockReason,
    violations: request.options?.includeWarnings
      ? result.violations
      : errors,
    invariants_checked: result.invariants_checked,
    validation_time_ms: result.validation_time_ms,
    audit_logged: true,
    proof_trace: result.proof_trace,
  };

  // Log and update stats
  logToAudit(response);
  updateStats(response, request.entry.aiGenerated || false);

  return response;
}

/**
 * Quick validation for common case (balanced check only)
 * Use full validate() for complete verification
 */
export function quickValidate(entry: JournalEntry): {
  valid: boolean;
  reason?: string;
} {
  if (!isBalanced(entry)) {
    return {
      valid: false,
      reason: 'Entry is not balanced (debits != credits)',
    };
  }

  if (entry.lines.length < 2) {
    return {
      valid: false,
      reason: 'Entry must have at least 2 lines',
    };
  }

  return { valid: true };
}

/**
 * Validate a batch of entries
 */
export function validateBatch(
  entries: JournalEntry[],
  context?: BusinessRuleContext
): {
  results: ProofGateResponse[];
  allValid: boolean;
  blockedCount: number;
  totalTime: number;
} {
  const results: ProofGateResponse[] = [];
  let blockedCount = 0;
  const startTime = performance.now();

  for (const entry of entries) {
    const result = validate({ entry, context });
    results.push(result);
    if (result.blocked) blockedCount++;
  }

  return {
    results,
    allValid: blockedCount === 0,
    blockedCount,
    totalTime: performance.now() - startTime,
  };
}

/**
 * Get proof gate statistics
 */
export function getStats(): ProofGateStats {
  return { ...stats };
}

/**
 * Get recent validation history
 */
export function getHistory(limit: number = 100): ProofGateResponse[] {
  return validationHistory.slice(-limit);
}

/**
 * Get blocked entries from history
 */
export function getBlockedHistory(limit: number = 50): ProofGateResponse[] {
  return validationHistory.filter((r) => r.blocked).slice(-limit);
}

/**
 * Reset statistics (for testing)
 */
export function resetStats(): void {
  stats.total_validations = 0;
  stats.passed = 0;
  stats.blocked = 0;
  stats.warnings_issued = 0;
  stats.average_time_ms = 0;
  stats.ai_entries_validated = 0;
  stats.ai_entries_blocked = 0;
}

/**
 * Clear history (for testing)
 */
export function clearHistory(): void {
  validationHistory.length = 0;
}

/**
 * Check if proof gate is healthy (meeting performance targets)
 */
export function isHealthy(): {
  healthy: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Performance target: <100ms average
  if (stats.average_time_ms > 100) {
    issues.push(
      `Average validation time (${stats.average_time_ms.toFixed(1)}ms) exceeds 100ms target`
    );
  }

  // High block rate might indicate a problem
  const blockRate =
    stats.total_validations > 0 ? stats.blocked / stats.total_validations : 0;
  if (blockRate > 0.5 && stats.total_validations > 10) {
    issues.push(
      `High block rate (${(blockRate * 100).toFixed(1)}%) may indicate an issue`
    );
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

export default {
  validate,
  quickValidate,
  validateBatch,
  getStats,
  getHistory,
  getBlockedHistory,
  resetStats,
  clearHistory,
  isHealthy,
};
