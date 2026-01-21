/**
 * Approval Delegation Service
 *
 * Manages temporary and permanent delegation of approval authority.
 * Supports scoped delegations with amount limits, date ranges, and rule-specific delegations.
 *
 * Requirements:
 * - H3: Approval Workflows
 * - Delegation system with scoping
 * - Temporary and permanent delegation support
 */

import { nanoid } from 'nanoid';
import type {
  ApprovalDelegation,
  ApprovalRule,
  DelegationScopeType,
} from '../db/schema/approvalWorkflows.schema';
import { DelegationStatus } from '../db/schema/approvalWorkflows.schema';
import {
  createDefaultApprovalDelegation,
  isDelegationActive,
} from '../db/schema/approvalWorkflows.schema';
import { getDeviceId } from '../utils/device';
import { logger } from '../utils/logger';

const delegationLogger = logger.child('ApprovalDelegationService');

// ============================================================================
// Types
// ============================================================================

/**
 * Delegation creation options
 */
export interface CreateDelegationOptions {
  scopeType: DelegationScopeType;
  approvalRuleIds?: string[]; // For RULE_SPECIFIC scope
  maxAmount?: string; // For AMOUNT_LIMIT scope
  startDate: number; // Unix timestamp
  endDate?: number; // Unix timestamp (optional for permanent)
  notes?: string;
  maxUses?: number; // Optional use limit
}

/**
 * Delegation query options
 */
export interface DelegationQueryOptions {
  includeInactive?: boolean;
  includeExpired?: boolean;
  scopeType?: DelegationScopeType;
}

/**
 * Delegation validation result
 */
export interface DelegationValidationResult {
  valid: boolean;
  canDelegate: boolean;
  activeDelegations: ApprovalDelegation[];
  errors: string[];
}

/**
 * Delegation service interface
 */
export interface IApprovalDelegationService {
  // Create delegation
  createDelegation(
    companyId: string,
    delegatorUserId: string,
    delegateUserId: string,
    options: CreateDelegationOptions
  ): Promise<ApprovalDelegation>;

  // Revoke delegation
  revokeDelegation(
    delegationId: string,
    revokerUserId: string
  ): Promise<ApprovalDelegation>;

  // Update delegation
  updateDelegation(
    delegationId: string,
    updates: Partial<ApprovalDelegation>
  ): Promise<ApprovalDelegation>;

  // Get delegations for user (as delegator)
  getDelegationsFromUser(
    companyId: string,
    delegatorUserId: string,
    options?: DelegationQueryOptions
  ): Promise<ApprovalDelegation[]>;

  // Get delegations for user (as delegate)
  getDelegationsToUser(
    companyId: string,
    delegateUserId: string,
    options?: DelegationQueryOptions
  ): Promise<ApprovalDelegation[]>;

  // Check if user can approve via delegation
  canApproveViaDelegation(
    companyId: string,
    delegateUserId: string,
    approvalRuleId: string,
    transactionAmount?: number
  ): Promise<DelegationValidationResult>;

  // Record delegation usage
  recordDelegationUse(delegationId: string): Promise<ApprovalDelegation>;

  // Process expired delegations
  processExpiredDelegations(companyId: string): Promise<ApprovalDelegation[]>;

  // Get effective approvers (including delegated)
  getEffectiveApprovers(
    companyId: string,
    approvalRuleId: string,
    level: number
  ): Promise<string[]>;
}

// ============================================================================
// Database Interface
// ============================================================================

export interface IApprovalDelegationDatabase {
  // Delegations
  getDelegation(delegationId: string): Promise<ApprovalDelegation | null>;
  createDelegation(delegation: ApprovalDelegation): Promise<ApprovalDelegation>;
  updateDelegation(
    delegationId: string,
    updates: Partial<ApprovalDelegation>
  ): Promise<ApprovalDelegation>;
  getDelegationsByDelegator(
    companyId: string,
    delegatorUserId: string
  ): Promise<ApprovalDelegation[]>;
  getDelegationsByDelegate(
    companyId: string,
    delegateUserId: string
  ): Promise<ApprovalDelegation[]>;
  getActiveDelegations(companyId: string): Promise<ApprovalDelegation[]>;
  getExpiredDelegations(companyId: string): Promise<ApprovalDelegation[]>;

  // Rules (for validation)
  getRule(ruleId: string): Promise<ApprovalRule | null>;
}

// ============================================================================
// Approval Delegation Service Implementation
// ============================================================================

export class ApprovalDelegationService implements IApprovalDelegationService {
  constructor(private db: IApprovalDelegationDatabase) {}

  /**
   * Create delegation
   */
  async createDelegation(
    companyId: string,
    delegatorUserId: string,
    delegateUserId: string,
    options: CreateDelegationOptions
  ): Promise<ApprovalDelegation> {
    try {
      // Validate delegation
      if (delegatorUserId === delegateUserId) {
        throw this.createError('VALIDATION_ERROR', 'Cannot delegate to yourself');
      }

      // Validate scope-specific fields
      if (options.scopeType === 'RULE_SPECIFIC') {
        if (!options.approvalRuleIds || options.approvalRuleIds.length === 0) {
          throw this.createError(
            'VALIDATION_ERROR',
            'approval_rule_ids required for RULE_SPECIFIC delegation'
          );
        }

        // Validate rules exist
        for (const ruleId of options.approvalRuleIds) {
          const rule = await this.db.getRule(ruleId);
          if (!rule) {
            throw this.createError('NOT_FOUND', `Approval rule not found: ${ruleId}`);
          }
        }
      }

      if (options.scopeType === 'AMOUNT_LIMIT') {
        if (!options.maxAmount) {
          throw this.createError(
            'VALIDATION_ERROR',
            'max_amount required for AMOUNT_LIMIT delegation'
          );
        }
      }

      // Validate dates
      if (options.endDate && options.endDate <= options.startDate) {
        throw this.createError('VALIDATION_ERROR', 'end_date must be after start_date');
      }

      // Create delegation
      const deviceId = getDeviceId();
      const delegationId = nanoid();
      const delegation = {
        ...createDefaultApprovalDelegation(
          companyId,
          delegatorUserId,
          delegateUserId,
          options.startDate,
          deviceId
        ),
        id: delegationId,
        scope_type: options.scopeType,
        approval_rule_ids: options.approvalRuleIds || null,
        max_amount: options.maxAmount || null,
        end_date: options.endDate || null,
        notes: options.notes || null,
        max_uses: options.maxUses || null,
      } as ApprovalDelegation;

      const created = await this.db.createDelegation(delegation);

      delegationLogger.info('Delegation created', {
        delegationId,
        delegatorUserId,
        delegateUserId,
        scopeType: options.scopeType,
      });

      return created;
    } catch (error) {
      delegationLogger.error('Error creating delegation', {
        companyId,
        delegatorUserId,
        delegateUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Revoke delegation
   */
  async revokeDelegation(
    delegationId: string,
    revokerUserId: string
  ): Promise<ApprovalDelegation> {
    try {
      const delegation = await this.db.getDelegation(delegationId);
      if (!delegation) {
        throw this.createError('NOT_FOUND', 'Delegation not found');
      }

      // Only delegator can revoke
      if (delegation.delegator_user_id !== revokerUserId) {
        throw this.createError(
          'PERMISSION_DENIED',
          'Only delegator can revoke delegation'
        );
      }

      // Update to revoked status
      const updated = await this.db.updateDelegation(delegationId, {
        status: DelegationStatus.REVOKED,
      });

      delegationLogger.info('Delegation revoked', {
        delegationId,
        revokerUserId,
      });

      return updated;
    } catch (error) {
      delegationLogger.error('Error revoking delegation', {
        delegationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update delegation
   */
  async updateDelegation(
    delegationId: string,
    updates: Partial<ApprovalDelegation>
  ): Promise<ApprovalDelegation> {
    try {
      const delegation = await this.db.getDelegation(delegationId);
      if (!delegation) {
        throw this.createError('NOT_FOUND', 'Delegation not found');
      }

      // Validate updates
      if (updates.end_date && updates.end_date <= delegation.start_date) {
        throw this.createError('VALIDATION_ERROR', 'end_date must be after start_date');
      }

      const updated = await this.db.updateDelegation(delegationId, updates);

      delegationLogger.info('Delegation updated', {
        delegationId,
        updates: Object.keys(updates),
      });

      return updated;
    } catch (error) {
      delegationLogger.error('Error updating delegation', {
        delegationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get delegations from user (as delegator)
   */
  async getDelegationsFromUser(
    companyId: string,
    delegatorUserId: string,
    options: DelegationQueryOptions = {}
  ): Promise<ApprovalDelegation[]> {
    try {
      const delegations = await this.db.getDelegationsByDelegator(companyId, delegatorUserId);

      return this.filterDelegations(delegations, options);
    } catch (error) {
      delegationLogger.error('Error getting delegations from user', {
        companyId,
        delegatorUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get delegations to user (as delegate)
   */
  async getDelegationsToUser(
    companyId: string,
    delegateUserId: string,
    options: DelegationQueryOptions = {}
  ): Promise<ApprovalDelegation[]> {
    try {
      const delegations = await this.db.getDelegationsByDelegate(companyId, delegateUserId);

      return this.filterDelegations(delegations, options);
    } catch (error) {
      delegationLogger.error('Error getting delegations to user', {
        companyId,
        delegateUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if user can approve via delegation
   */
  async canApproveViaDelegation(
    companyId: string,
    delegateUserId: string,
    approvalRuleId: string,
    transactionAmount?: number
  ): Promise<DelegationValidationResult> {
    try {
      // Get all active delegations to this user
      const delegations = await this.getDelegationsToUser(companyId, delegateUserId, {
        includeInactive: false,
        includeExpired: false,
      });

      const activeDelegations: ApprovalDelegation[] = [];
      const errors: string[] = [];

      // Check each delegation
      for (const delegation of delegations) {
        // Check if delegation is active
        if (!isDelegationActive(delegation)) {
          continue;
        }

        // Check scope type
        let matches = false;

        switch (delegation.scope_type) {
          case 'ALL':
            matches = true;
            break;

          case 'RULE_SPECIFIC':
            if (
              delegation.approval_rule_ids &&
              delegation.approval_rule_ids.includes(approvalRuleId)
            ) {
              matches = true;
            }
            break;

          case 'AMOUNT_LIMIT':
            if (transactionAmount !== undefined && delegation.max_amount) {
              const maxAmount = parseFloat(delegation.max_amount);
              if (transactionAmount <= maxAmount) {
                matches = true;
              } else {
                errors.push(
                  `Transaction amount ${transactionAmount} exceeds delegation limit ${maxAmount}`
                );
              }
            }
            break;

          case 'DATE_RANGE':
            // Date range already checked by isDelegationActive
            matches = true;
            break;
        }

        if (matches) {
          activeDelegations.push(delegation);
        }
      }

      return {
        valid: activeDelegations.length > 0,
        canDelegate: activeDelegations.length > 0,
        activeDelegations,
        errors,
      };
    } catch (error) {
      delegationLogger.error('Error checking delegation', {
        companyId,
        delegateUserId,
        approvalRuleId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Record delegation usage
   */
  async recordDelegationUse(delegationId: string): Promise<ApprovalDelegation> {
    try {
      const delegation = await this.db.getDelegation(delegationId);
      if (!delegation) {
        throw this.createError('NOT_FOUND', 'Delegation not found');
      }

      // Increment use count
      const newUseCount = delegation.use_count + 1;

      // Check if max uses reached
      let status = delegation.status;
      if (delegation.max_uses && newUseCount >= delegation.max_uses) {
        status = DelegationStatus.USED;
      }

      const updated = await this.db.updateDelegation(delegationId, {
        use_count: newUseCount,
        status,
      });

      delegationLogger.info('Delegation use recorded', {
        delegationId,
        useCount: newUseCount,
        status,
      });

      return updated;
    } catch (error) {
      delegationLogger.error('Error recording delegation use', {
        delegationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process expired delegations
   */
  async processExpiredDelegations(companyId: string): Promise<ApprovalDelegation[]> {
    try {
      const expiredDelegations = await this.db.getExpiredDelegations(companyId);
      const processed: ApprovalDelegation[] = [];

      for (const delegation of expiredDelegations) {
        if (delegation.status === 'ACTIVE') {
          const updated = await this.db.updateDelegation(delegation.id, {
            status: DelegationStatus.EXPIRED,
          });
          processed.push(updated);

          delegationLogger.info('Delegation marked as expired', {
            delegationId: delegation.id,
            endDate: delegation.end_date,
          });
        }
      }

      return processed;
    } catch (error) {
      delegationLogger.error('Error processing expired delegations', {
        companyId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get effective approvers (including delegated)
   */
  async getEffectiveApprovers(
    companyId: string,
    approvalRuleId: string,
    level: number
  ): Promise<string[]> {
    try {
      // Get the rule
      const rule = await this.db.getRule(approvalRuleId);
      if (!rule) {
        throw this.createError('NOT_FOUND', 'Approval rule not found');
      }

      // Get the level
      const approvalLevel = rule.approval_levels.find((l) => l.level_number === level);
      if (!approvalLevel) {
        throw this.createError('NOT_FOUND', `Approval level ${level} not found`);
      }

      // Start with original approvers
      const effectiveApprovers = new Set<string>(approvalLevel.approver_user_ids);

      // Get all active delegations
      const activeDelegations = await this.db.getActiveDelegations(companyId);

      // For each original approver, check if they have delegated
      for (const approverUserId of approvalLevel.approver_user_ids) {
        const userDelegations = activeDelegations.filter(
          (d) => d.delegator_user_id === approverUserId && isDelegationActive(d)
        );

        for (const delegation of userDelegations) {
          // Check if delegation applies to this rule
          let applies = false;

          switch (delegation.scope_type) {
            case 'ALL':
              applies = true;
              break;

            case 'RULE_SPECIFIC':
              if (
                delegation.approval_rule_ids &&
                delegation.approval_rule_ids.includes(approvalRuleId)
              ) {
                applies = true;
              }
              break;

            case 'DATE_RANGE':
              // Date range already checked by isDelegationActive
              applies = true;
              break;

            case 'AMOUNT_LIMIT':
              // Amount limit can't be checked without transaction context
              // So we include it as a potential approver
              applies = true;
              break;
          }

          if (applies) {
            effectiveApprovers.add(delegation.delegate_user_id);
          }
        }
      }

      return Array.from(effectiveApprovers);
    } catch (error) {
      delegationLogger.error('Error getting effective approvers', {
        companyId,
        approvalRuleId,
        level,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Filter delegations based on query options
   */
  private filterDelegations(
    delegations: ApprovalDelegation[],
    options: DelegationQueryOptions
  ): ApprovalDelegation[] {
    let filtered = delegations;

    // Filter by active status
    if (!options.includeInactive) {
      filtered = filtered.filter((d) => isDelegationActive(d));
    }

    // Filter by expired
    if (!options.includeExpired) {
      const now = Date.now();
      filtered = filtered.filter((d) => {
        if (!d.end_date) return true; // Permanent delegation
        return d.end_date > now;
      });
    }

    // Filter by scope type
    if (options.scopeType) {
      filtered = filtered.filter((d) => d.scope_type === options.scopeType);
    }

    return filtered;
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
