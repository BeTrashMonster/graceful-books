/**
 * Approval Workflow Service
 *
 * Orchestrates the approval workflow lifecycle including:
 * - Submitting transactions for approval
 * - Processing approval/rejection actions
 * - Managing multi-level approval chains
 * - Handling auto-approval and timeouts
 * - Recording approval history
 *
 * Requirements:
 * - H3: Approval Workflows
 * - Multi-level approval chains
 * - Zero-knowledge encrypted approvals
 */

import { nanoid } from 'nanoid';
import type {
  Transaction,
  TransactionLineItem,
  AccountType,
} from '../types/database.types';
import type {
  ApprovalRule,
  ApprovalRequest,
  ApprovalAction,
  ApprovalHistory,
  ApprovalRequestStatus,
  ApprovalActionType,
  ApprovalLevel,
  ApprovalRequirementType,
} from '../db/schema/approvalWorkflows.schema';
import {
  ApprovalRuleStatus,
  createDefaultApprovalRequest,
  createDefaultApprovalAction,
  createApprovalHistoryEntry,
  isApprovalRequestExpired,
} from '../db/schema/approvalWorkflows.schema';
import {
  findMatchingRules,
  buildTransactionContext,
  type TransactionContext,
  type RuleMatchResult,
} from './approvalRuleEngine';
import { getDeviceId } from '../utils/device';
import { logger } from '../utils/logger';
import type { AppError } from '../utils/errors';
import { ErrorCode } from '../utils/errors';

const workflowLogger = logger.child('ApprovalWorkflowService');

// ============================================================================
// Types
// ============================================================================

/**
 * Approval submission options
 */
export interface ApprovalSubmissionOptions {
  skipValidation?: boolean; // Skip transaction validation
  comments?: string; // Requester comments
  metadata?: Record<string, unknown>; // Additional metadata
}

/**
 * Approval action options
 */
export interface ApprovalActionOptions {
  comments?: string; // Approver comments
  delegateTo?: string; // User ID to delegate to
  ipAddress?: string; // IP address of approver
}

/**
 * Approval check result
 */
export interface ApprovalCheckResult {
  requiresApproval: boolean;
  matchingRules: ApprovalRule[];
  highestPriorityRule: ApprovalRule | null;
  existingRequest: ApprovalRequest | null;
}

/**
 * Approval workflow service interface
 */
export interface IApprovalWorkflowService {
  // Check if transaction requires approval
  checkApprovalRequired(
    companyId: string,
    transaction: Transaction,
    lineItems: TransactionLineItem[],
    accountTypesMap: Map<string, AccountType>
  ): Promise<ApprovalCheckResult>;

  // Submit transaction for approval
  submitForApproval(
    companyId: string,
    transaction: Transaction,
    lineItems: TransactionLineItem[],
    accountTypesMap: Map<string, AccountType>,
    requesterUserId: string,
    options?: ApprovalSubmissionOptions
  ): Promise<ApprovalRequest>;

  // Approve transaction at current level
  approve(
    approvalRequestId: string,
    approverUserId: string,
    options?: ApprovalActionOptions
  ): Promise<ApprovalRequest>;

  // Reject transaction
  reject(
    approvalRequestId: string,
    approverUserId: string,
    rejectionReason: string,
    options?: ApprovalActionOptions
  ): Promise<ApprovalRequest>;

  // Recall approval request (by requester)
  recall(
    approvalRequestId: string,
    requesterUserId: string,
    reason: string
  ): Promise<ApprovalRequest>;

  // Check for expired requests and auto-approve if configured
  processExpiredRequests(companyId: string): Promise<ApprovalRequest[]>;

  // Get approval history for transaction
  getApprovalHistory(transactionId: string): Promise<ApprovalHistory[]>;

  // Get pending approvals for user
  getPendingApprovalsForUser(
    companyId: string,
    userId: string,
    delegatedUserIds?: string[]
  ): Promise<ApprovalRequest[]>;
}

// ============================================================================
// Database Interfaces (to be implemented by store)
// ============================================================================

export interface IApprovalDatabase {
  // Rules
  getActiveRules(companyId: string): Promise<ApprovalRule[]>;
  getRule(ruleId: string): Promise<ApprovalRule | null>;

  // Requests
  getRequest(requestId: string): Promise<ApprovalRequest | null>;
  getRequestByTransaction(transactionId: string): Promise<ApprovalRequest | null>;
  createRequest(request: ApprovalRequest): Promise<ApprovalRequest>;
  updateRequest(requestId: string, updates: Partial<ApprovalRequest>): Promise<ApprovalRequest>;
  getPendingRequests(companyId: string): Promise<ApprovalRequest[]>;
  getExpiredRequests(companyId: string): Promise<ApprovalRequest[]>;

  // Actions
  createAction(action: ApprovalAction): Promise<ApprovalAction>;
  getActionsForRequest(requestId: string): Promise<ApprovalAction[]>;

  // History
  createHistory(history: ApprovalHistory): Promise<ApprovalHistory>;
  getHistoryForTransaction(transactionId: string): Promise<ApprovalHistory[]>;
  getHistoryForRequest(requestId: string): Promise<ApprovalHistory[]>;
}

// ============================================================================
// Approval Workflow Service Implementation
// ============================================================================

export class ApprovalWorkflowService implements IApprovalWorkflowService {
  constructor(private db: IApprovalDatabase) {}

  /**
   * Check if transaction requires approval
   */
  async checkApprovalRequired(
    companyId: string,
    transaction: Transaction,
    lineItems: TransactionLineItem[],
    accountTypesMap: Map<string, AccountType>
  ): Promise<ApprovalCheckResult> {
    try {
      // Get all active rules for company
      const activeRules = await this.db.getActiveRules(companyId);

      // Build transaction context
      const context = buildTransactionContext(transaction, lineItems, accountTypesMap);

      // Find matching rules
      const matchResult = findMatchingRules(activeRules, context);

      // Check if there's already an approval request
      const existingRequest = transaction.id
        ? await this.db.getRequestByTransaction(transaction.id)
        : null;

      return {
        requiresApproval: matchResult.requiresApproval,
        matchingRules: matchResult.matchedRules,
        highestPriorityRule: matchResult.highestPriorityRule,
        existingRequest,
      };
    } catch (error) {
      workflowLogger.error('Error checking approval required', {
        companyId,
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Submit transaction for approval
   */
  async submitForApproval(
    companyId: string,
    transaction: Transaction,
    lineItems: TransactionLineItem[],
    accountTypesMap: Map<string, AccountType>,
    requesterUserId: string,
    options: ApprovalSubmissionOptions = {}
  ): Promise<ApprovalRequest> {
    try {
      // Check what approval is required
      const checkResult = await this.checkApprovalRequired(
        companyId,
        transaction,
        lineItems,
        accountTypesMap
      );

      if (!checkResult.requiresApproval) {
        throw this.createError(
          'VALIDATION_ERROR',
          'Transaction does not require approval'
        );
      }

      if (!checkResult.highestPriorityRule) {
        throw this.createError(
          'VALIDATION_ERROR',
          'No matching approval rule found'
        );
      }

      // Check if already has pending approval
      if (checkResult.existingRequest) {
        if (checkResult.existingRequest.status === 'PENDING') {
          throw this.createError(
            'CONSTRAINT_VIOLATION',
            'Transaction already has a pending approval request'
          );
        }
      }

      const rule = checkResult.highestPriorityRule;

      // Calculate expiration if timeout configured
      let expiresAt: number | null = null;
      if (rule.timeout_hours) {
        expiresAt = Date.now() + rule.timeout_hours * 60 * 60 * 1000;
      }

      // Create approval request
      const deviceId = getDeviceId();
      const requestId = nanoid();
      const now = Date.now();

      const request: ApprovalRequest = {
        ...createDefaultApprovalRequest(
          companyId,
          transaction.id,
          rule.id,
          requesterUserId,
          rule.approval_levels.length,
          deviceId
        ),
        id: requestId,
        expires_at: expiresAt,
        metadata: options.metadata || {},
      };

      const createdRequest = await this.db.createRequest(request);

      // Record history
      await this.recordHistory(
        companyId,
        requestId,
        transaction.id,
        rule.id,
        'SUBMITTED',
        `Submitted for approval by ${requesterUserId}`,
        requesterUserId,
        null,
        {
          comments: options.comments,
          ruleId: rule.id,
          ruleName: rule.name,
        }
      );

      workflowLogger.info('Transaction submitted for approval', {
        companyId,
        transactionId: transaction.id,
        requestId,
        ruleId: rule.id,
      });

      return createdRequest;
    } catch (error) {
      workflowLogger.error('Error submitting for approval', {
        companyId,
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Approve transaction at current level
   */
  async approve(
    approvalRequestId: string,
    approverUserId: string,
    options: ApprovalActionOptions = {}
  ): Promise<ApprovalRequest> {
    try {
      // Get approval request
      const request = await this.db.getRequest(approvalRequestId);
      if (!request) {
        throw this.createError('NOT_FOUND', 'Approval request not found');
      }

      // Validate request status
      if (request.status !== 'PENDING') {
        throw this.createError(
          'CONSTRAINT_VIOLATION',
          `Cannot approve request with status ${request.status}`
        );
      }

      // Check if expired
      if (isApprovalRequestExpired(request)) {
        throw this.createError('CONSTRAINT_VIOLATION', 'Approval request has expired');
      }

      // Get rule
      const rule = await this.db.getRule(request.approval_rule_id);
      if (!rule) {
        throw this.createError('NOT_FOUND', 'Approval rule not found');
      }

      // Get current level
      const currentLevel = rule.approval_levels.find(
        (level) => level.level_number === request.current_level
      );
      if (!currentLevel) {
        throw this.createError('VALIDATION_ERROR', 'Invalid approval level');
      }

      // Check if user is authorized to approve at this level
      if (!currentLevel.approver_user_ids.includes(approverUserId)) {
        throw this.createError(
          'PERMISSION_DENIED',
          'User not authorized to approve at this level'
        );
      }

      // Get existing actions for this level
      const existingActions = await this.db.getActionsForRequest(approvalRequestId);
      const levelActions = existingActions.filter(
        (action) => action.level === request.current_level && action.action_type === 'APPROVE'
      );

      // Check if user has already approved at this level
      if (levelActions.some((action) => action.approver_user_id === approverUserId)) {
        throw this.createError(
          'CONSTRAINT_VIOLATION',
          'User has already approved at this level'
        );
      }

      // Create approval action
      const deviceId = getDeviceId();
      const actionId = nanoid();
      const action: ApprovalAction = {
        ...createDefaultApprovalAction(
          request.company_id,
          approvalRequestId,
          approverUserId,
          'APPROVE',
          request.current_level,
          deviceId
        ),
        id: actionId,
        comments: options.comments || null,
        ip_address: options.ipAddress || null,
      };

      await this.db.createAction(action);

      // Check if level requirements are met
      const levelComplete = this.isLevelComplete(
        currentLevel,
        [...levelActions, action],
        approverUserId
      );

      let updatedRequest: ApprovalRequest;

      if (levelComplete) {
        // Move to next level or complete approval
        if (request.current_level >= request.total_levels) {
          // All levels complete - approve request
          updatedRequest = await this.db.updateRequest(approvalRequestId, {
            status: 'APPROVED',
            completed_at: Date.now(),
          });

          await this.recordHistory(
            request.company_id,
            approvalRequestId,
            request.transaction_id,
            request.approval_rule_id,
            'APPROVED',
            `Fully approved - all ${request.total_levels} levels complete`,
            approverUserId,
            request.current_level,
            { comments: options.comments }
          );

          workflowLogger.info('Approval request fully approved', {
            requestId: approvalRequestId,
            transactionId: request.transaction_id,
          });
        } else {
          // Move to next level
          updatedRequest = await this.db.updateRequest(approvalRequestId, {
            current_level: request.current_level + 1,
          });

          await this.recordHistory(
            request.company_id,
            approvalRequestId,
            request.transaction_id,
            request.approval_rule_id,
            'LEVEL_COMPLETE',
            `Level ${request.current_level} approved, moved to level ${request.current_level + 1}`,
            approverUserId,
            request.current_level,
            { comments: options.comments }
          );

          workflowLogger.info('Approval level complete, moved to next level', {
            requestId: approvalRequestId,
            currentLevel: request.current_level + 1,
          });
        }
      } else {
        // Level not yet complete
        updatedRequest = request;

        await this.recordHistory(
          request.company_id,
          approvalRequestId,
          request.transaction_id,
          request.approval_rule_id,
          'APPROVED_PARTIAL',
          `Approved by ${approverUserId} at level ${request.current_level}`,
          approverUserId,
          request.current_level,
          { comments: options.comments }
        );

        workflowLogger.info('Partial approval recorded', {
          requestId: approvalRequestId,
          level: request.current_level,
        });
      }

      return updatedRequest;
    } catch (error) {
      workflowLogger.error('Error approving request', {
        requestId: approvalRequestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Reject transaction
   */
  async reject(
    approvalRequestId: string,
    approverUserId: string,
    rejectionReason: string,
    options: ApprovalActionOptions = {}
  ): Promise<ApprovalRequest> {
    try {
      // Get approval request
      const request = await this.db.getRequest(approvalRequestId);
      if (!request) {
        throw this.createError('NOT_FOUND', 'Approval request not found');
      }

      // Validate request status
      if (request.status !== 'PENDING') {
        throw this.createError(
          'CONSTRAINT_VIOLATION',
          `Cannot reject request with status ${request.status}`
        );
      }

      // Get rule
      const rule = await this.db.getRule(request.approval_rule_id);
      if (!rule) {
        throw this.createError('NOT_FOUND', 'Approval rule not found');
      }

      // Get current level
      const currentLevel = rule.approval_levels.find(
        (level) => level.level_number === request.current_level
      );
      if (!currentLevel) {
        throw this.createError('VALIDATION_ERROR', 'Invalid approval level');
      }

      // Check if user is authorized to reject at this level
      if (!currentLevel.approver_user_ids.includes(approverUserId)) {
        throw this.createError(
          'PERMISSION_DENIED',
          'User not authorized to reject at this level'
        );
      }

      // Create rejection action
      const deviceId = getDeviceId();
      const actionId = nanoid();
      const action: ApprovalAction = {
        ...createDefaultApprovalAction(
          request.company_id,
          approvalRequestId,
          approverUserId,
          'REJECT',
          request.current_level,
          deviceId
        ),
        id: actionId,
        comments: options.comments || null,
        ip_address: options.ipAddress || null,
      };

      await this.db.createAction(action);

      // Update request to rejected
      const updatedRequest = await this.db.updateRequest(approvalRequestId, {
        status: 'REJECTED',
        rejection_reason: rejectionReason,
        completed_at: Date.now(),
      });

      // Record history
      await this.recordHistory(
        request.company_id,
        approvalRequestId,
        request.transaction_id,
        request.approval_rule_id,
        'REJECTED',
        `Rejected by ${approverUserId} at level ${request.current_level}: ${rejectionReason}`,
        approverUserId,
        request.current_level,
        {
          comments: options.comments,
          rejectionReason,
        }
      );

      workflowLogger.info('Approval request rejected', {
        requestId: approvalRequestId,
        transactionId: request.transaction_id,
        level: request.current_level,
      });

      return updatedRequest;
    } catch (error) {
      workflowLogger.error('Error rejecting request', {
        requestId: approvalRequestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Recall approval request (by requester)
   */
  async recall(
    approvalRequestId: string,
    requesterUserId: string,
    reason: string
  ): Promise<ApprovalRequest> {
    try {
      // Get approval request
      const request = await this.db.getRequest(approvalRequestId);
      if (!request) {
        throw this.createError('NOT_FOUND', 'Approval request not found');
      }

      // Verify requester
      if (request.requester_user_id !== requesterUserId) {
        throw this.createError(
          'PERMISSION_DENIED',
          'Only requester can recall approval request'
        );
      }

      // Validate request status
      if (request.status !== 'PENDING') {
        throw this.createError(
          'CONSTRAINT_VIOLATION',
          `Cannot recall request with status ${request.status}`
        );
      }

      // Create recall action
      const deviceId = getDeviceId();
      const actionId = nanoid();
      const action: ApprovalAction = {
        ...createDefaultApprovalAction(
          request.company_id,
          approvalRequestId,
          requesterUserId,
          'RECALL',
          request.current_level,
          deviceId
        ),
        id: actionId,
        comments: reason,
      };

      await this.db.createAction(action);

      // Update request to cancelled
      const updatedRequest = await this.db.updateRequest(approvalRequestId, {
        status: 'CANCELLED',
        completed_at: Date.now(),
      });

      // Record history
      await this.recordHistory(
        request.company_id,
        approvalRequestId,
        request.transaction_id,
        request.approval_rule_id,
        'RECALLED',
        `Recalled by requester: ${reason}`,
        requesterUserId,
        request.current_level,
        { reason }
      );

      workflowLogger.info('Approval request recalled', {
        requestId: approvalRequestId,
        transactionId: request.transaction_id,
      });

      return updatedRequest;
    } catch (error) {
      workflowLogger.error('Error recalling request', {
        requestId: approvalRequestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process expired requests and auto-approve if configured
   */
  async processExpiredRequests(companyId: string): Promise<ApprovalRequest[]> {
    try {
      const expiredRequests = await this.db.getExpiredRequests(companyId);
      const processed: ApprovalRequest[] = [];

      for (const request of expiredRequests) {
        const rule = await this.db.getRule(request.approval_rule_id);
        if (!rule) {
          continue;
        }

        if (rule.auto_approve_on_timeout) {
          // Auto-approve
          const updatedRequest = await this.db.updateRequest(request.id, {
            status: 'AUTO_APPROVED',
            auto_approved_reason: 'Auto-approved due to timeout',
            completed_at: Date.now(),
          });

          await this.recordHistory(
            request.company_id,
            request.id,
            request.transaction_id,
            request.approval_rule_id,
            'AUTO_APPROVED',
            `Auto-approved after ${rule.timeout_hours} hours timeout`,
            null,
            request.current_level,
            { timeoutHours: rule.timeout_hours }
          );

          processed.push(updatedRequest);

          workflowLogger.info('Auto-approved expired request', {
            requestId: request.id,
            transactionId: request.transaction_id,
          });
        } else {
          // Mark as expired
          const updatedRequest = await this.db.updateRequest(request.id, {
            status: 'EXPIRED',
            completed_at: Date.now(),
          });

          await this.recordHistory(
            request.company_id,
            request.id,
            request.transaction_id,
            request.approval_rule_id,
            'EXPIRED',
            `Expired after ${rule.timeout_hours} hours without approval`,
            null,
            request.current_level,
            { timeoutHours: rule.timeout_hours }
          );

          processed.push(updatedRequest);

          workflowLogger.info('Marked request as expired', {
            requestId: request.id,
            transactionId: request.transaction_id,
          });
        }
      }

      return processed;
    } catch (error) {
      workflowLogger.error('Error processing expired requests', {
        companyId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get approval history for transaction
   */
  async getApprovalHistory(transactionId: string): Promise<ApprovalHistory[]> {
    try {
      return await this.db.getHistoryForTransaction(transactionId);
    } catch (error) {
      workflowLogger.error('Error getting approval history', {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get pending approvals for user (including delegated)
   */
  async getPendingApprovalsForUser(
    companyId: string,
    userId: string,
    delegatedUserIds: string[] = []
  ): Promise<ApprovalRequest[]> {
    try {
      const allRequests = await this.db.getPendingRequests(companyId);
      const userRequests: ApprovalRequest[] = [];

      for (const request of allRequests) {
        const rule = await this.db.getRule(request.approval_rule_id);
        if (!rule) {
          continue;
        }

        const currentLevel = rule.approval_levels.find(
          (level) => level.level_number === request.current_level
        );
        if (!currentLevel) {
          continue;
        }

        // Check if user or delegated users are approvers at current level
        const canApprove =
          currentLevel.approver_user_ids.includes(userId) ||
          delegatedUserIds.some((delegatedId) =>
            currentLevel.approver_user_ids.includes(delegatedId)
          );

        if (canApprove) {
          userRequests.push(request);
        }
      }

      return userRequests;
    } catch (error) {
      workflowLogger.error('Error getting pending approvals for user', {
        companyId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Check if approval level requirements are met
   */
  private isLevelComplete(
    level: ApprovalLevel,
    actions: ApprovalAction[],
    currentApproverId: string
  ): boolean {
    // Get all approvals for this level
    const approvals = actions.filter((action) => action.action_type === 'APPROVE');

    // Get unique approver IDs
    const approverIds = [...new Set(approvals.map((a) => a.approver_user_id))];

    switch (level.requirement_type) {
      case 'ANY_ONE':
        // Any one approver is sufficient
        return approverIds.length >= 1;

      case 'ALL':
        // All approvers required
        return (
          approverIds.length === level.approver_user_ids.length &&
          level.approver_user_ids.every((id) => approverIds.includes(id))
        );

      case 'THRESHOLD':
        // Minimum number of approvers required
        return level.threshold_count !== null && approverIds.length >= level.threshold_count;

      default:
        return false;
    }
  }

  /**
   * Record approval history entry
   */
  private async recordHistory(
    companyId: string,
    approvalRequestId: string,
    transactionId: string,
    approvalRuleId: string,
    eventType: string,
    eventDescription: string,
    userId: string | null,
    level: number | null,
    eventData: Record<string, unknown>
  ): Promise<void> {
    const historyId = nanoid();
    const history: ApprovalHistory = {
      ...createApprovalHistoryEntry(
        companyId,
        approvalRequestId,
        transactionId,
        approvalRuleId,
        eventType,
        eventDescription,
        userId,
        level,
        eventData
      ),
      id: historyId,
    };

    await this.db.createHistory(history);
  }

  /**
   * Create error with code
   */
  private createError(code: string, message: string): Error {
    const error = new Error(message) as Error & { code: string };
    error.code = code;
    return error;
  }
}
