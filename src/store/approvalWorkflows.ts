/**
 * Approval Workflows Store
 *
 * Data access layer for approval workflows, rules, requests, actions, delegations, and history.
 * Implements database interfaces for approval workflow and delegation services.
 *
 * Requirements:
 * - H3: Approval Workflows
 * - CRDT-compatible with version vectors
 * - Zero-knowledge encryption integration
 */

import { nanoid } from 'nanoid';
import { db } from '../db/database';
import { getDeviceId } from '../utils/device';
import { incrementVersionVector } from '../db/crdt';
import { logger } from '../utils/logger';
import type {
  ApprovalRule,
  ApprovalRequest,
  ApprovalAction,
  ApprovalDelegation,
  ApprovalHistory,
  ApprovalRuleStatus,
  ApprovalRequestStatus,
  DelegationStatus,
} from '../db/schema/approvalWorkflows.schema';
import {
  createDefaultApprovalRule,
  createDefaultApprovalRequest,
  createDefaultApprovalAction,
  createDefaultApprovalDelegation,
  createApprovalHistoryEntry,
  validateApprovalRule,
  validateApprovalRequest,
  validateApprovalDelegation,
} from '../db/schema/approvalWorkflows.schema';
import type {
  IApprovalDatabase,
} from '../services/approvalWorkflowService';
import type {
  IApprovalDelegationDatabase,
} from '../services/approvalDelegationService';

const storeLogger = logger.child('ApprovalWorkflowsStore');

// ============================================================================
// Approval Rules
// ============================================================================

/**
 * Create a new approval rule
 */
export async function createApprovalRule(
  companyId: string,
  name: string,
  ruleData: Partial<ApprovalRule>
): Promise<ApprovalRule> {
  try {
    const deviceId = getDeviceId();
    const ruleId = nanoid();

    const rule: ApprovalRule = {
      ...createDefaultApprovalRule(companyId, name, deviceId),
      ...ruleData,
      id: ruleId,
      company_id: companyId,
      name,
    };

    // Validate rule
    const errors = validateApprovalRule(rule);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    await db.approvalRules.add(rule);

    storeLogger.info('Approval rule created', { ruleId, companyId });
    return rule;
  } catch (error) {
    storeLogger.error('Error creating approval rule', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get approval rule by ID
 */
export async function getApprovalRule(ruleId: string): Promise<ApprovalRule | null> {
  try {
    const rule = await db.approvalRules.get(ruleId);
    if (!rule || rule.deleted_at) {
      return null;
    }
    return rule;
  } catch (error) {
    storeLogger.error('Error getting approval rule', {
      ruleId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get all active approval rules for a company
 */
export async function getActiveApprovalRules(companyId: string): Promise<ApprovalRule[]> {
  try {
    return await db.approvalRules
      .where('[company_id+status]')
      .equals([companyId, ApprovalRuleStatus.ACTIVE])
      .and((rule) => !rule.deleted_at)
      .sortBy('priority');
  } catch (error) {
    storeLogger.error('Error getting active approval rules', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get all approval rules for a company
 */
export async function getCompanyApprovalRules(
  companyId: string,
  includeDeleted = false
): Promise<ApprovalRule[]> {
  try {
    let query = db.approvalRules.where('company_id').equals(companyId);

    if (!includeDeleted) {
      query = query.and((rule) => !rule.deleted_at);
    }

    return await query.sortBy('priority');
  } catch (error) {
    storeLogger.error('Error getting company approval rules', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Update approval rule
 */
export async function updateApprovalRule(
  ruleId: string,
  updates: Partial<ApprovalRule>
): Promise<ApprovalRule> {
  try {
    const existing = await db.approvalRules.get(ruleId);
    if (!existing) {
      throw new Error(`Approval rule not found: ${ruleId}`);
    }

    if (existing.deleted_at) {
      throw new Error(`Approval rule has been deleted: ${ruleId}`);
    }

    const deviceId = getDeviceId();
    const now = Date.now();

    const updated: ApprovalRule = {
      ...existing,
      ...updates,
      id: ruleId,
      company_id: existing.company_id,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    };

    // Validate updated rule
    const errors = validateApprovalRule(updated);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    await db.approvalRules.put(updated);

    storeLogger.info('Approval rule updated', { ruleId });
    return updated;
  } catch (error) {
    storeLogger.error('Error updating approval rule', {
      ruleId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Delete approval rule (soft delete)
 */
export async function deleteApprovalRule(ruleId: string): Promise<void> {
  try {
    const existing = await db.approvalRules.get(ruleId);
    if (!existing) {
      throw new Error(`Approval rule not found: ${ruleId}`);
    }

    const deviceId = getDeviceId();
    const now = Date.now();

    await db.approvalRules.update(ruleId, {
      deleted_at: now,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    });

    storeLogger.info('Approval rule deleted', { ruleId });
  } catch (error) {
    storeLogger.error('Error deleting approval rule', {
      ruleId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// Approval Requests
// ============================================================================

/**
 * Create a new approval request
 */
export async function createApprovalRequest(
  request: ApprovalRequest
): Promise<ApprovalRequest> {
  try {
    // Validate request
    const errors = validateApprovalRequest(request);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    await db.approvalRequests.add(request);

    storeLogger.info('Approval request created', {
      requestId: request.id,
      transactionId: request.transaction_id,
    });
    return request;
  } catch (error) {
    storeLogger.error('Error creating approval request', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get approval request by ID
 */
export async function getApprovalRequest(requestId: string): Promise<ApprovalRequest | null> {
  try {
    const request = await db.approvalRequests.get(requestId);
    if (!request || request.deleted_at) {
      return null;
    }
    return request;
  } catch (error) {
    storeLogger.error('Error getting approval request', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get approval request by transaction ID
 */
export async function getApprovalRequestByTransaction(
  transactionId: string
): Promise<ApprovalRequest | null> {
  try {
    const requests = await db.approvalRequests
      .where('transaction_id')
      .equals(transactionId)
      .and((r) => !r.deleted_at)
      .toArray();

    // Return most recent request
    if (requests.length === 0) {
      return null;
    }

    return requests.sort((a, b) => b.created_at - a.created_at)[0];
  } catch (error) {
    storeLogger.error('Error getting approval request by transaction', {
      transactionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get pending approval requests for a company
 */
export async function getPendingApprovalRequests(companyId: string): Promise<ApprovalRequest[]> {
  try {
    return await db.approvalRequests
      .where('[company_id+status]')
      .equals([companyId, ApprovalRequestStatus.PENDING])
      .and((r) => !r.deleted_at)
      .sortBy('submitted_at');
  } catch (error) {
    storeLogger.error('Error getting pending approval requests', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get expired approval requests
 */
export async function getExpiredApprovalRequests(companyId: string): Promise<ApprovalRequest[]> {
  try {
    const now = Date.now();
    return await db.approvalRequests
      .where('[company_id+status]')
      .equals([companyId, ApprovalRequestStatus.PENDING])
      .and((r) => !r.deleted_at && r.expires_at !== null && r.expires_at <= now)
      .toArray();
  } catch (error) {
    storeLogger.error('Error getting expired approval requests', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Update approval request
 */
export async function updateApprovalRequest(
  requestId: string,
  updates: Partial<ApprovalRequest>
): Promise<ApprovalRequest> {
  try {
    const existing = await db.approvalRequests.get(requestId);
    if (!existing) {
      throw new Error(`Approval request not found: ${requestId}`);
    }

    if (existing.deleted_at) {
      throw new Error(`Approval request has been deleted: ${requestId}`);
    }

    const deviceId = getDeviceId();
    const now = Date.now();

    const updated: ApprovalRequest = {
      ...existing,
      ...updates,
      id: requestId,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    };

    await db.approvalRequests.put(updated);

    storeLogger.info('Approval request updated', { requestId });
    return updated;
  } catch (error) {
    storeLogger.error('Error updating approval request', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// Approval Actions
// ============================================================================

/**
 * Create a new approval action
 */
export async function createApprovalAction(action: ApprovalAction): Promise<ApprovalAction> {
  try {
    await db.approvalActions.add(action);

    storeLogger.info('Approval action created', {
      actionId: action.id,
      requestId: action.approval_request_id,
      actionType: action.action_type,
    });
    return action;
  } catch (error) {
    storeLogger.error('Error creating approval action', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get approval actions for a request
 */
export async function getApprovalActionsForRequest(
  requestId: string
): Promise<ApprovalAction[]> {
  try {
    return await db.approvalActions
      .where('approval_request_id')
      .equals(requestId)
      .and((a) => !a.deleted_at)
      .sortBy('action_timestamp');
  } catch (error) {
    storeLogger.error('Error getting approval actions', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get approval actions for a user
 */
export async function getApprovalActionsByUser(
  companyId: string,
  userId: string
): Promise<ApprovalAction[]> {
  try {
    return await db.approvalActions
      .where('approver_user_id')
      .equals(userId)
      .and((a) => a.company_id === companyId && !a.deleted_at)
      .sortBy('action_timestamp');
  } catch (error) {
    storeLogger.error('Error getting approval actions by user', {
      companyId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// Approval Delegations
// ============================================================================

/**
 * Create a new approval delegation
 */
export async function createApprovalDelegation(
  delegation: ApprovalDelegation
): Promise<ApprovalDelegation> {
  try {
    // Validate delegation
    const errors = validateApprovalDelegation(delegation);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    await db.approvalDelegations.add(delegation);

    storeLogger.info('Approval delegation created', {
      delegationId: delegation.id,
      delegatorId: delegation.delegator_user_id,
      delegateId: delegation.delegate_user_id,
    });
    return delegation;
  } catch (error) {
    storeLogger.error('Error creating approval delegation', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get approval delegation by ID
 */
export async function getApprovalDelegation(delegationId: string): Promise<ApprovalDelegation | null> {
  try {
    const delegation = await db.approvalDelegations.get(delegationId);
    if (!delegation || delegation.deleted_at) {
      return null;
    }
    return delegation;
  } catch (error) {
    storeLogger.error('Error getting approval delegation', {
      delegationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get delegations by delegator
 */
export async function getApprovalDelegationsByDelegator(
  companyId: string,
  delegatorUserId: string
): Promise<ApprovalDelegation[]> {
  try {
    return await db.approvalDelegations
      .where('delegator_user_id')
      .equals(delegatorUserId)
      .and((d) => d.company_id === companyId && !d.deleted_at)
      .sortBy('created_at');
  } catch (error) {
    storeLogger.error('Error getting delegations by delegator', {
      companyId,
      delegatorUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get delegations by delegate
 */
export async function getApprovalDelegationsByDelegate(
  companyId: string,
  delegateUserId: string
): Promise<ApprovalDelegation[]> {
  try {
    return await db.approvalDelegations
      .where('delegate_user_id')
      .equals(delegateUserId)
      .and((d) => d.company_id === companyId && !d.deleted_at)
      .sortBy('created_at');
  } catch (error) {
    storeLogger.error('Error getting delegations by delegate', {
      companyId,
      delegateUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get active delegations for a company
 */
export async function getActiveApprovalDelegations(companyId: string): Promise<ApprovalDelegation[]> {
  try {
    return await db.approvalDelegations
      .where('[company_id+status]')
      .equals([companyId, DelegationStatus.ACTIVE])
      .and((d) => !d.deleted_at)
      .toArray();
  } catch (error) {
    storeLogger.error('Error getting active delegations', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get expired delegations
 */
export async function getExpiredApprovalDelegations(companyId: string): Promise<ApprovalDelegation[]> {
  try {
    const now = Date.now();
    return await db.approvalDelegations
      .where('[company_id+status]')
      .equals([companyId, DelegationStatus.ACTIVE])
      .and((d) => !d.deleted_at && d.end_date !== null && d.end_date <= now)
      .toArray();
  } catch (error) {
    storeLogger.error('Error getting expired delegations', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Update approval delegation
 */
export async function updateApprovalDelegation(
  delegationId: string,
  updates: Partial<ApprovalDelegation>
): Promise<ApprovalDelegation> {
  try {
    const existing = await db.approvalDelegations.get(delegationId);
    if (!existing) {
      throw new Error(`Approval delegation not found: ${delegationId}`);
    }

    if (existing.deleted_at) {
      throw new Error(`Approval delegation has been deleted: ${delegationId}`);
    }

    const deviceId = getDeviceId();
    const now = Date.now();

    const updated: ApprovalDelegation = {
      ...existing,
      ...updates,
      id: delegationId,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    };

    // Validate updated delegation
    const errors = validateApprovalDelegation(updated);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    await db.approvalDelegations.put(updated);

    storeLogger.info('Approval delegation updated', { delegationId });
    return updated;
  } catch (error) {
    storeLogger.error('Error updating approval delegation', {
      delegationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// Approval History
// ============================================================================

/**
 * Create approval history entry
 */
export async function createApprovalHistory(history: ApprovalHistory): Promise<ApprovalHistory> {
  try {
    await db.approvalHistory.add(history);

    storeLogger.info('Approval history entry created', {
      historyId: history.id,
      requestId: history.approval_request_id,
      eventType: history.event_type,
    });
    return history;
  } catch (error) {
    storeLogger.error('Error creating approval history', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get approval history for a transaction
 */
export async function getApprovalHistoryForTransaction(
  transactionId: string
): Promise<ApprovalHistory[]> {
  try {
    return await db.approvalHistory
      .where('transaction_id')
      .equals(transactionId)
      .sortBy('event_timestamp');
  } catch (error) {
    storeLogger.error('Error getting approval history for transaction', {
      transactionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get approval history for a request
 */
export async function getApprovalHistoryForRequest(
  requestId: string
): Promise<ApprovalHistory[]> {
  try {
    return await db.approvalHistory
      .where('approval_request_id')
      .equals(requestId)
      .sortBy('event_timestamp');
  } catch (error) {
    storeLogger.error('Error getting approval history for request', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// Database Implementation Classes
// ============================================================================

/**
 * Approval database implementation for workflow service
 */
export class ApprovalDatabaseImpl implements IApprovalDatabase {
  async getActiveRules(companyId: string): Promise<ApprovalRule[]> {
    return getActiveApprovalRules(companyId);
  }

  async getRule(ruleId: string): Promise<ApprovalRule | null> {
    return getApprovalRule(ruleId);
  }

  async getRequest(requestId: string): Promise<ApprovalRequest | null> {
    return getApprovalRequest(requestId);
  }

  async getRequestByTransaction(transactionId: string): Promise<ApprovalRequest | null> {
    return getApprovalRequestByTransaction(transactionId);
  }

  async createRequest(request: ApprovalRequest): Promise<ApprovalRequest> {
    return createApprovalRequest(request);
  }

  async updateRequest(requestId: string, updates: Partial<ApprovalRequest>): Promise<ApprovalRequest> {
    return updateApprovalRequest(requestId, updates);
  }

  async getPendingRequests(companyId: string): Promise<ApprovalRequest[]> {
    return getPendingApprovalRequests(companyId);
  }

  async getExpiredRequests(companyId: string): Promise<ApprovalRequest[]> {
    return getExpiredApprovalRequests(companyId);
  }

  async createAction(action: ApprovalAction): Promise<ApprovalAction> {
    return createApprovalAction(action);
  }

  async getActionsForRequest(requestId: string): Promise<ApprovalAction[]> {
    return getApprovalActionsForRequest(requestId);
  }

  async createHistory(history: ApprovalHistory): Promise<ApprovalHistory> {
    return createApprovalHistory(history);
  }

  async getHistoryForTransaction(transactionId: string): Promise<ApprovalHistory[]> {
    return getApprovalHistoryForTransaction(transactionId);
  }

  async getHistoryForRequest(requestId: string): Promise<ApprovalHistory[]> {
    return getApprovalHistoryForRequest(requestId);
  }
}

/**
 * Delegation database implementation for delegation service
 */
export class ApprovalDelegationDatabaseImpl implements IApprovalDelegationDatabase {
  async getDelegation(delegationId: string): Promise<ApprovalDelegation | null> {
    return getApprovalDelegation(delegationId);
  }

  async createDelegation(delegation: ApprovalDelegation): Promise<ApprovalDelegation> {
    return createApprovalDelegation(delegation);
  }

  async updateDelegation(
    delegationId: string,
    updates: Partial<ApprovalDelegation>
  ): Promise<ApprovalDelegation> {
    return updateApprovalDelegation(delegationId, updates);
  }

  async getDelegationsByDelegator(
    companyId: string,
    delegatorUserId: string
  ): Promise<ApprovalDelegation[]> {
    return getApprovalDelegationsByDelegator(companyId, delegatorUserId);
  }

  async getDelegationsByDelegate(
    companyId: string,
    delegateUserId: string
  ): Promise<ApprovalDelegation[]> {
    return getApprovalDelegationsByDelegate(companyId, delegateUserId);
  }

  async getActiveDelegations(companyId: string): Promise<ApprovalDelegation[]> {
    return getActiveApprovalDelegations(companyId);
  }

  async getExpiredDelegations(companyId: string): Promise<ApprovalDelegation[]> {
    return getExpiredApprovalDelegations(companyId);
  }

  async getRule(ruleId: string): Promise<ApprovalRule | null> {
    return getApprovalRule(ruleId);
  }
}
