/**
 * Staging Area Service
 *
 * Manages AI suggestions in a separate staging area from live data.
 * All AI suggestions must be reviewed and approved before affecting live data.
 *
 * Key features:
 * - Suggestions stored separately from live data
 * - User review queue with batch actions
 * - Approval/rejection tracked in audit trail
 * - Automatic expiration of stale suggestions
 *
 * @security Phase 3.2 - CaMeL Architecture Scaffolding
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import {
  type AISuggestion,
  type StagingQueryOptions,
  type BatchApprovalRequest,
  type BatchApprovalResult,
  SuggestionStatus,
  AITaskType,
} from './types';

/**
 * Default suggestion TTL (7 days)
 */
const DEFAULT_SUGGESTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * In-memory staging store (in production, use persistent storage)
 */
const stagingStore = new Map<string, AISuggestion>();

/**
 * Approval history for audit
 */
interface ApprovalRecord {
  suggestion_id: string;
  action: 'approved' | 'rejected' | 'modified';
  actor: string;
  timestamp: string;
  notes?: string;
}

const approvalHistory: ApprovalRecord[] = [];
const MAX_HISTORY_SIZE = 10000;

/**
 * Generate unique suggestion ID
 */
function generateSuggestionId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add a suggestion to the staging area
 */
export function addSuggestion(
  suggestion: Omit<AISuggestion, 'id' | 'created_at' | 'expires_at' | 'status'>
): AISuggestion {
  const id = generateSuggestionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_SUGGESTION_TTL_MS);

  const fullSuggestion: AISuggestion = {
    ...suggestion,
    id,
    status: SuggestionStatus.PENDING,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  stagingStore.set(id, fullSuggestion);
  return fullSuggestion;
}

/**
 * Get a suggestion by ID
 */
export function getSuggestion(id: string): AISuggestion | undefined {
  const suggestion = stagingStore.get(id);

  // Check if expired
  if (suggestion && new Date(suggestion.expires_at) < new Date()) {
    suggestion.status = SuggestionStatus.EXPIRED;
    stagingStore.set(id, suggestion);
  }

  return suggestion;
}

/**
 * Query suggestions with filters
 */
export function querySuggestions(options: StagingQueryOptions): {
  suggestions: AISuggestion[];
  total: number;
} {
  let results: AISuggestion[] = [];

  // Clean up expired suggestions during query
  cleanupExpired();

  // Filter suggestions
  for (const suggestion of stagingStore.values()) {
    if (suggestion.company_id !== options.company_id) continue;
    if (options.user_id && suggestion.user_id !== options.user_id) continue;
    if (options.status && suggestion.status !== options.status) continue;
    if (options.task_type && suggestion.task_type !== options.task_type) continue;

    results.push(suggestion);
  }

  // Sort by created_at descending
  results.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const total = results.length;

  // Apply pagination
  const offset = options.offset || 0;
  const limit = options.limit || 50;
  results = results.slice(offset, offset + limit);

  return { suggestions: results, total };
}

/**
 * Get pending suggestions count for a company
 */
export function getPendingCount(companyId: string): number {
  let count = 0;
  for (const suggestion of stagingStore.values()) {
    if (
      suggestion.company_id === companyId &&
      suggestion.status === SuggestionStatus.PENDING
    ) {
      count++;
    }
  }
  return count;
}

/**
 * Approve a suggestion
 */
export function approveSuggestion(
  id: string,
  approvedBy: string,
  notes?: string
): { success: boolean; error?: string } {
  const suggestion = stagingStore.get(id);

  if (!suggestion) {
    return { success: false, error: 'Suggestion not found' };
  }

  if (suggestion.status !== SuggestionStatus.PENDING) {
    return { success: false, error: `Suggestion is ${suggestion.status}, not pending` };
  }

  if (new Date(suggestion.expires_at) < new Date()) {
    suggestion.status = SuggestionStatus.EXPIRED;
    stagingStore.set(id, suggestion);
    return { success: false, error: 'Suggestion has expired' };
  }

  // Update suggestion
  suggestion.status = SuggestionStatus.APPROVED;
  suggestion.reviewed_at = new Date().toISOString();
  suggestion.reviewed_by = approvedBy;
  suggestion.review_notes = notes;
  stagingStore.set(id, suggestion);

  // Record in history
  recordApproval({
    suggestion_id: id,
    action: 'approved',
    actor: approvedBy,
    timestamp: suggestion.reviewed_at,
    notes,
  });

  return { success: true };
}

/**
 * Reject a suggestion
 */
export function rejectSuggestion(
  id: string,
  rejectedBy: string,
  reason: string
): { success: boolean; error?: string } {
  const suggestion = stagingStore.get(id);

  if (!suggestion) {
    return { success: false, error: 'Suggestion not found' };
  }

  if (suggestion.status !== SuggestionStatus.PENDING) {
    return { success: false, error: `Suggestion is ${suggestion.status}, not pending` };
  }

  // Update suggestion
  suggestion.status = SuggestionStatus.REJECTED;
  suggestion.reviewed_at = new Date().toISOString();
  suggestion.reviewed_by = rejectedBy;
  suggestion.review_notes = reason;
  stagingStore.set(id, suggestion);

  // Record in history
  recordApproval({
    suggestion_id: id,
    action: 'rejected',
    actor: rejectedBy,
    timestamp: suggestion.reviewed_at,
    notes: reason,
  });

  return { success: true };
}

/**
 * Modify and approve a suggestion
 */
export function modifyAndApprove(
  id: string,
  modifiedBy: string,
  modifications: Record<string, unknown>,
  notes?: string
): { success: boolean; error?: string } {
  const suggestion = stagingStore.get(id);

  if (!suggestion) {
    return { success: false, error: 'Suggestion not found' };
  }

  if (suggestion.status !== SuggestionStatus.PENDING) {
    return { success: false, error: `Suggestion is ${suggestion.status}, not pending` };
  }

  // Update suggestion with modifications
  suggestion.status = SuggestionStatus.MODIFIED;
  suggestion.reviewed_at = new Date().toISOString();
  suggestion.reviewed_by = modifiedBy;
  suggestion.review_notes = notes;
  suggestion.suggested_data = {
    ...suggestion.suggested_data,
    ...modifications,
    _original_data: suggestion.suggested_data, // Preserve original for audit
  };
  stagingStore.set(id, suggestion);

  // Record in history
  recordApproval({
    suggestion_id: id,
    action: 'modified',
    actor: modifiedBy,
    timestamp: suggestion.reviewed_at,
    notes: notes || `Modified: ${Object.keys(modifications).join(', ')}`,
  });

  return { success: true };
}

/**
 * Batch approve suggestions
 */
export function batchApprove(request: BatchApprovalRequest): BatchApprovalResult {
  const failures: Array<{ id: string; reason: string }> = [];
  let approved = 0;

  for (const id of request.suggestion_ids) {
    const result = approveSuggestion(id, request.approved_by, request.notes);
    if (result.success) {
      approved++;
    } else {
      failures.push({ id, reason: result.error || 'Unknown error' });
    }
  }

  return {
    total: request.suggestion_ids.length,
    approved,
    failed: failures.length,
    failures,
  };
}

/**
 * Batch reject suggestions
 */
export function batchReject(
  suggestionIds: string[],
  rejectedBy: string,
  reason: string
): BatchApprovalResult {
  const failures: Array<{ id: string; reason: string }> = [];
  let rejected = 0;

  for (const id of suggestionIds) {
    const result = rejectSuggestion(id, rejectedBy, reason);
    if (result.success) {
      rejected++;
    } else {
      failures.push({ id, reason: result.error || 'Unknown error' });
    }
  }

  return {
    total: suggestionIds.length,
    approved: rejected, // Reusing field for rejected count
    failed: failures.length,
    failures,
  };
}

/**
 * Get approval history
 */
export function getApprovalHistory(
  limit: number = 100,
  companyId?: string
): ApprovalRecord[] {
  let records = [...approvalHistory];

  // Filter by company if requested
  if (companyId) {
    records = records.filter((r) => {
      const suggestion = stagingStore.get(r.suggestion_id);
      return suggestion?.company_id === companyId;
    });
  }

  return records.slice(-limit);
}

/**
 * Record approval action in history
 */
function recordApproval(record: ApprovalRecord): void {
  approvalHistory.push(record);

  // Keep history bounded
  if (approvalHistory.length > MAX_HISTORY_SIZE) {
    approvalHistory.shift();
  }
}

/**
 * Clean up expired suggestions
 */
export function cleanupExpired(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [id, suggestion] of stagingStore.entries()) {
    if (
      suggestion.status === SuggestionStatus.PENDING &&
      new Date(suggestion.expires_at) < now
    ) {
      suggestion.status = SuggestionStatus.EXPIRED;
      stagingStore.set(id, suggestion);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get staging area statistics
 */
export function getStats(companyId?: string): {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  modified: number;
  expired: number;
  by_task_type: Record<AITaskType, number>;
} {
  const stats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    modified: 0,
    expired: 0,
    by_task_type: {
      [AITaskType.CATEGORIZE]: 0,
      [AITaskType.ANOMALY_DETECT]: 0,
      [AITaskType.FORECAST]: 0,
      [AITaskType.RECONCILE]: 0,
      [AITaskType.SUMMARIZE]: 0,
    },
  };

  for (const suggestion of stagingStore.values()) {
    if (companyId && suggestion.company_id !== companyId) continue;

    stats.total++;
    stats.by_task_type[suggestion.task_type]++;

    switch (suggestion.status) {
      case SuggestionStatus.PENDING:
        stats.pending++;
        break;
      case SuggestionStatus.APPROVED:
        stats.approved++;
        break;
      case SuggestionStatus.REJECTED:
        stats.rejected++;
        break;
      case SuggestionStatus.MODIFIED:
        stats.modified++;
        break;
      case SuggestionStatus.EXPIRED:
        stats.expired++;
        break;
    }
  }

  return stats;
}

/**
 * Clear all suggestions (for testing)
 */
export function clearAll(): void {
  stagingStore.clear();
  approvalHistory.length = 0;
}

/**
 * Delete a specific suggestion (admin only)
 */
export function deleteSuggestion(id: string): boolean {
  return stagingStore.delete(id);
}

export default {
  addSuggestion,
  getSuggestion,
  querySuggestions,
  getPendingCount,
  approveSuggestion,
  rejectSuggestion,
  modifyAndApprove,
  batchApprove,
  batchReject,
  getApprovalHistory,
  cleanupExpired,
  getStats,
  clearAll,
  deleteSuggestion,
};
