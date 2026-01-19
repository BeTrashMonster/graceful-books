/**
 * Approval Workflows Schema Definition
 *
 * Defines the structure for multi-level approval workflows for transaction authorization.
 * Supports flexible rule-based approval chains with delegation and audit trails.
 *
 * Requirements:
 * - H3: Approval Workflows
 * - ARCH-002: Zero-knowledge encryption
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { BaseEntity, VersionVector, TransactionType, AccountType } from '../../types/database.types';

// ============================================================================
// Approval Rule Types
// ============================================================================

/**
 * Approval rule condition operator
 */
export enum ApprovalConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  LESS_THAN = 'LESS_THAN',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
}

/**
 * Approval rule condition field type
 */
export enum ApprovalConditionField {
  AMOUNT = 'AMOUNT',
  TRANSACTION_TYPE = 'TRANSACTION_TYPE',
  ACCOUNT_ID = 'ACCOUNT_ID',
  ACCOUNT_TYPE = 'ACCOUNT_TYPE',
  CONTACT_ID = 'CONTACT_ID',
  PRODUCT_ID = 'PRODUCT_ID',
  METADATA = 'METADATA',
}

/**
 * Approval requirement type
 */
export enum ApprovalRequirementType {
  ANY_ONE = 'ANY_ONE', // Any one approver from the list
  ALL = 'ALL', // All approvers required
  THRESHOLD = 'THRESHOLD', // Minimum number of approvers
}

/**
 * Approval rule status
 */
export enum ApprovalRuleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Condition for approval rule matching
 */
export interface ApprovalCondition {
  field: ApprovalConditionField; // Field to evaluate
  operator: ApprovalConditionOperator; // Comparison operator
  value: string | string[] | number; // Value to compare against (ENCRYPTED if sensitive)
}

/**
 * Approval level configuration
 */
export interface ApprovalLevel {
  level_number: number; // Sequential level (1, 2, 3...)
  approver_user_ids: string[]; // List of user IDs who can approve at this level
  requirement_type: ApprovalRequirementType; // How many approvers needed
  threshold_count: number | null; // Required count if type is THRESHOLD
  description: string | null; // ENCRYPTED - Description of this approval level
}

/**
 * Approval Rule
 * Defines when and who needs to approve transactions
 */
export interface ApprovalRule extends BaseEntity {
  company_id: string; // UUID - links to Company
  name: string; // ENCRYPTED - Rule name (e.g., "Large Expense Approval")
  description: string | null; // ENCRYPTED - Rule description
  status: ApprovalRuleStatus; // Rule status
  priority: number; // Priority order (lower number = higher priority)
  conditions: ApprovalCondition[]; // ENCRYPTED - Conditions that trigger this rule
  approval_levels: ApprovalLevel[]; // ENCRYPTED - Sequential approval levels
  auto_approve_on_timeout: boolean; // Auto-approve if timeout exceeded
  timeout_hours: number | null; // Timeout in hours (null = no timeout)
  notify_on_submit: boolean; // Send notification when submitted for approval
  notify_on_approve: boolean; // Send notification when approved
  notify_on_reject: boolean; // Send notification when rejected
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Approval Request Types
// ============================================================================

/**
 * Approval request status
 */
export enum ApprovalRequestStatus {
  PENDING = 'PENDING', // Waiting for approval
  APPROVED = 'APPROVED', // Fully approved
  REJECTED = 'REJECTED', // Rejected by an approver
  AUTO_APPROVED = 'AUTO_APPROVED', // Auto-approved due to timeout
  CANCELLED = 'CANCELLED', // Cancelled by requester
  EXPIRED = 'EXPIRED', // Expired without approval
}

/**
 * Approval Request
 * Tracks approval requests for transactions
 */
export interface ApprovalRequest extends BaseEntity {
  company_id: string; // UUID - links to Company
  transaction_id: string; // UUID - links to Transaction being approved
  approval_rule_id: string; // UUID - links to ApprovalRule that triggered
  requester_user_id: string; // UUID - User who submitted for approval
  status: ApprovalRequestStatus; // Current status
  current_level: number; // Current approval level (1-based)
  total_levels: number; // Total number of levels required
  submitted_at: number; // Unix timestamp when submitted
  completed_at: number | null; // Unix timestamp when approved/rejected
  expires_at: number | null; // Unix timestamp when request expires
  rejection_reason: string | null; // ENCRYPTED - Reason for rejection
  auto_approved_reason: string | null; // ENCRYPTED - Reason for auto-approval
  metadata: Record<string, unknown>; // ENCRYPTED - Additional metadata
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Approval Action Types
// ============================================================================

/**
 * Approval action type
 */
export enum ApprovalActionType {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  DELEGATE = 'DELEGATE',
  RECALL = 'RECALL', // Requester recalls request
  CANCEL = 'CANCEL', // System cancels request
}

/**
 * Approval Action
 * Individual approval/rejection actions on requests
 */
export interface ApprovalAction extends BaseEntity {
  company_id: string; // UUID - links to Company
  approval_request_id: string; // UUID - links to ApprovalRequest
  approver_user_id: string; // UUID - User who took the action
  action_type: ApprovalActionType; // Action taken
  level: number; // Approval level this action applies to
  comments: string | null; // ENCRYPTED - Approver comments
  ip_address: string | null; // IP address of approver
  user_agent: string | null; // Browser user agent
  delegated_to_user_id: string | null; // UUID - User delegated to (if delegated)
  action_timestamp: number; // Unix timestamp of action (separate from created_at for audit)
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Delegation Types
// ============================================================================

/**
 * Delegation status
 */
export enum DelegationStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  USED = 'USED', // Temporary delegation used once
}

/**
 * Delegation scope type
 */
export enum DelegationScopeType {
  ALL = 'ALL', // All approval requests
  RULE_SPECIFIC = 'RULE_SPECIFIC', // Specific approval rule
  AMOUNT_LIMIT = 'AMOUNT_LIMIT', // Limited by amount
  DATE_RANGE = 'DATE_RANGE', // Limited by date range
}

/**
 * Approval Delegation
 * Allows temporary or permanent delegation of approval authority
 */
export interface ApprovalDelegation extends BaseEntity {
  company_id: string; // UUID - links to Company
  delegator_user_id: string; // UUID - User delegating authority
  delegate_user_id: string; // UUID - User receiving authority
  status: DelegationStatus; // Delegation status
  scope_type: DelegationScopeType; // Scope of delegation
  approval_rule_ids: string[] | null; // ENCRYPTED - Specific rule IDs (if RULE_SPECIFIC)
  max_amount: string | null; // ENCRYPTED - Maximum amount (if AMOUNT_LIMIT)
  start_date: number; // Unix timestamp when delegation starts
  end_date: number | null; // Unix timestamp when delegation ends (null = permanent)
  notes: string | null; // ENCRYPTED - Delegation notes
  use_count: number; // Number of times used (for analytics)
  max_uses: number | null; // Maximum uses (null = unlimited)
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Approval History Types
// ============================================================================

/**
 * Approval History
 * Immutable audit trail of approval workflow history
 */
export interface ApprovalHistory extends BaseEntity {
  company_id: string; // UUID - links to Company
  approval_request_id: string; // UUID - links to ApprovalRequest
  transaction_id: string; // UUID - links to Transaction
  approval_rule_id: string; // UUID - links to ApprovalRule
  event_type: string; // Event type (SUBMITTED, APPROVED, REJECTED, etc.)
  event_description: string; // ENCRYPTED - Human-readable event description
  user_id: string | null; // UUID - User who triggered event (null for system events)
  level: number | null; // Approval level (null for non-level events)
  event_data: Record<string, unknown>; // ENCRYPTED - Event-specific data
  event_timestamp: number; // Unix timestamp of event
  // Note: History entries do NOT have updated_at or deleted_at as they are immutable
}

// ============================================================================
// Schema Definitions for Dexie.js
// ============================================================================

/**
 * Dexie.js schema definition for ApprovalRules table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying rules by company
 * - status: For querying active rules
 * - [company_id+status]: Compound index for filtered queries
 * - priority: For ordering rules
 * - updated_at: For CRDT conflict resolution
 */
export const approvalRulesSchema = 'id, company_id, status, [company_id+status], priority, updated_at, deleted_at';

/**
 * Dexie.js schema definition for ApprovalRequests table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying requests by company
 * - transaction_id: For finding approvals for a transaction
 * - approval_rule_id: For querying by rule
 * - requester_user_id: For querying user's requests
 * - status: For querying by status
 * - [company_id+status]: Compound index for filtered queries
 * - current_level: For querying by approval level
 * - expires_at: For finding expired requests
 * - updated_at: For CRDT conflict resolution
 */
export const approvalRequestsSchema = 'id, company_id, transaction_id, approval_rule_id, requester_user_id, status, [company_id+status], current_level, expires_at, updated_at, deleted_at';

/**
 * Dexie.js schema definition for ApprovalActions table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying actions by company
 * - approval_request_id: For querying actions on a request
 * - approver_user_id: For querying user's actions
 * - action_type: For querying by action type
 * - level: For querying by approval level
 * - action_timestamp: For sorting by time
 * - updated_at: For CRDT conflict resolution
 */
export const approvalActionsSchema = 'id, company_id, approval_request_id, approver_user_id, action_type, level, action_timestamp, updated_at, deleted_at';

/**
 * Dexie.js schema definition for ApprovalDelegations table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying delegations by company
 * - delegator_user_id: For querying delegations from a user
 * - delegate_user_id: For querying delegations to a user
 * - [delegator_user_id+delegate_user_id]: Compound index for finding specific delegation
 * - status: For querying active delegations
 * - [company_id+status]: Compound index for filtered queries
 * - start_date: For date-based queries
 * - end_date: For finding expiring delegations
 * - updated_at: For CRDT conflict resolution
 */
export const approvalDelegationsSchema = 'id, company_id, delegator_user_id, delegate_user_id, [delegator_user_id+delegate_user_id], status, [company_id+status], start_date, end_date, updated_at, deleted_at';

/**
 * Dexie.js schema definition for ApprovalHistory table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying history by company
 * - approval_request_id: For querying history of a request
 * - transaction_id: For querying approval history of a transaction
 * - approval_rule_id: For querying history by rule
 * - user_id: For querying user's actions
 * - event_type: For querying by event type
 * - event_timestamp: For sorting chronologically
 */
export const approvalHistorySchema = 'id, company_id, approval_request_id, transaction_id, approval_rule_id, user_id, event_type, event_timestamp, created_at';

// ============================================================================
// Table Name Constants
// ============================================================================

export const APPROVAL_RULES_TABLE = 'approval_rules';
export const APPROVAL_REQUESTS_TABLE = 'approval_requests';
export const APPROVAL_ACTIONS_TABLE = 'approval_actions';
export const APPROVAL_DELEGATIONS_TABLE = 'approval_delegations';
export const APPROVAL_HISTORY_TABLE = 'approval_history';

// ============================================================================
// Default Value Factories
// ============================================================================

/**
 * Default values for new ApprovalRule
 */
export const createDefaultApprovalRule = (
  companyId: string,
  name: string,
  deviceId: string
): Partial<ApprovalRule> => {
  const now = Date.now();

  return {
    company_id: companyId,
    name,
    description: null,
    status: ApprovalRuleStatus.ACTIVE,
    priority: 100,
    conditions: [],
    approval_levels: [],
    auto_approve_on_timeout: false,
    timeout_hours: null,
    notify_on_submit: true,
    notify_on_approve: true,
    notify_on_reject: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new ApprovalRequest
 */
export const createDefaultApprovalRequest = (
  companyId: string,
  transactionId: string,
  approvalRuleId: string,
  requesterUserId: string,
  totalLevels: number,
  deviceId: string
): Partial<ApprovalRequest> => {
  const now = Date.now();

  return {
    company_id: companyId,
    transaction_id: transactionId,
    approval_rule_id: approvalRuleId,
    requester_user_id: requesterUserId,
    status: ApprovalRequestStatus.PENDING,
    current_level: 1,
    total_levels: totalLevels,
    submitted_at: now,
    completed_at: null,
    expires_at: null,
    rejection_reason: null,
    auto_approved_reason: null,
    metadata: {},
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new ApprovalAction
 */
export const createDefaultApprovalAction = (
  companyId: string,
  approvalRequestId: string,
  approverUserId: string,
  actionType: ApprovalActionType,
  level: number,
  deviceId: string
): Partial<ApprovalAction> => {
  const now = Date.now();

  return {
    company_id: companyId,
    approval_request_id: approvalRequestId,
    approver_user_id: approverUserId,
    action_type: actionType,
    level,
    comments: null,
    ip_address: null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    delegated_to_user_id: null,
    action_timestamp: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new ApprovalDelegation
 */
export const createDefaultApprovalDelegation = (
  companyId: string,
  delegatorUserId: string,
  delegateUserId: string,
  startDate: number,
  deviceId: string
): Partial<ApprovalDelegation> => {
  const now = Date.now();

  return {
    company_id: companyId,
    delegator_user_id: delegatorUserId,
    delegate_user_id: delegateUserId,
    status: DelegationStatus.ACTIVE,
    scope_type: DelegationScopeType.ALL,
    approval_rule_ids: null,
    max_amount: null,
    start_date: startDate,
    end_date: null,
    notes: null,
    use_count: 0,
    max_uses: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Create approval history entry
 */
export const createApprovalHistoryEntry = (
  companyId: string,
  approvalRequestId: string,
  transactionId: string,
  approvalRuleId: string,
  eventType: string,
  eventDescription: string,
  userId: string | null,
  level: number | null,
  eventData: Record<string, unknown>
): Partial<ApprovalHistory> => {
  const now = Date.now();

  return {
    company_id: companyId,
    approval_request_id: approvalRequestId,
    transaction_id: transactionId,
    approval_rule_id: approvalRuleId,
    event_type: eventType,
    event_description: eventDescription,
    user_id: userId,
    level,
    event_data: eventData,
    event_timestamp: now,
    created_at: now,
    // Note: No updated_at or deleted_at - history is immutable
  };
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate ApprovalRule has required fields
 */
export const validateApprovalRule = (rule: Partial<ApprovalRule>): string[] => {
  const errors: string[] = [];

  if (!rule.company_id) {
    errors.push('company_id is required');
  }

  if (!rule.name || rule.name.trim() === '') {
    errors.push('name is required');
  }

  if (rule.priority !== undefined && rule.priority < 0) {
    errors.push('priority must be non-negative');
  }

  if (rule.approval_levels && rule.approval_levels.length === 0) {
    errors.push('at least one approval level is required');
  }

  if (rule.approval_levels) {
    // Validate each level
    rule.approval_levels.forEach((level, index) => {
      if (level.level_number !== index + 1) {
        errors.push(`approval level ${index + 1} has incorrect level_number`);
      }

      if (level.approver_user_ids.length === 0) {
        errors.push(`approval level ${index + 1} must have at least one approver`);
      }

      if (level.requirement_type === ApprovalRequirementType.THRESHOLD) {
        if (!level.threshold_count || level.threshold_count < 1) {
          errors.push(`approval level ${index + 1} threshold_count must be at least 1`);
        }

        if (level.threshold_count && level.threshold_count > level.approver_user_ids.length) {
          errors.push(
            `approval level ${index + 1} threshold_count cannot exceed number of approvers`
          );
        }
      }
    });
  }

  if (rule.timeout_hours !== null && rule.timeout_hours !== undefined && rule.timeout_hours < 0) {
    errors.push('timeout_hours must be non-negative');
  }

  return errors;
};

/**
 * Validate ApprovalRequest has required fields
 */
export const validateApprovalRequest = (request: Partial<ApprovalRequest>): string[] => {
  const errors: string[] = [];

  if (!request.company_id) {
    errors.push('company_id is required');
  }

  if (!request.transaction_id) {
    errors.push('transaction_id is required');
  }

  if (!request.approval_rule_id) {
    errors.push('approval_rule_id is required');
  }

  if (!request.requester_user_id) {
    errors.push('requester_user_id is required');
  }

  if (request.current_level !== undefined && request.current_level < 1) {
    errors.push('current_level must be at least 1');
  }

  if (request.total_levels !== undefined && request.total_levels < 1) {
    errors.push('total_levels must be at least 1');
  }

  if (
    request.current_level !== undefined &&
    request.total_levels !== undefined &&
    request.current_level > request.total_levels
  ) {
    errors.push('current_level cannot exceed total_levels');
  }

  return errors;
};

/**
 * Validate ApprovalDelegation has required fields
 */
export const validateApprovalDelegation = (delegation: Partial<ApprovalDelegation>): string[] => {
  const errors: string[] = [];

  if (!delegation.company_id) {
    errors.push('company_id is required');
  }

  if (!delegation.delegator_user_id) {
    errors.push('delegator_user_id is required');
  }

  if (!delegation.delegate_user_id) {
    errors.push('delegate_user_id is required');
  }

  if (delegation.delegator_user_id === delegation.delegate_user_id) {
    errors.push('cannot delegate to yourself');
  }

  if (!delegation.start_date) {
    errors.push('start_date is required');
  }

  if (
    delegation.start_date &&
    delegation.end_date &&
    delegation.end_date <= delegation.start_date
  ) {
    errors.push('end_date must be after start_date');
  }

  if (delegation.max_uses !== null && delegation.max_uses !== undefined && delegation.max_uses < 1) {
    errors.push('max_uses must be at least 1');
  }

  if (
    delegation.scope_type === DelegationScopeType.RULE_SPECIFIC &&
    (!delegation.approval_rule_ids || delegation.approval_rule_ids.length === 0)
  ) {
    errors.push('approval_rule_ids required for RULE_SPECIFIC delegation');
  }

  if (
    delegation.scope_type === DelegationScopeType.AMOUNT_LIMIT &&
    !delegation.max_amount
  ) {
    errors.push('max_amount required for AMOUNT_LIMIT delegation');
  }

  return errors;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if approval request is expired
 */
export const isApprovalRequestExpired = (request: ApprovalRequest): boolean => {
  if (!request.expires_at) {
    return false;
  }
  return Date.now() >= request.expires_at;
};

/**
 * Check if delegation is active
 */
export const isDelegationActive = (delegation: ApprovalDelegation): boolean => {
  const now = Date.now();

  if (delegation.status !== DelegationStatus.ACTIVE) {
    return false;
  }

  if (now < delegation.start_date) {
    return false;
  }

  if (delegation.end_date && now > delegation.end_date) {
    return false;
  }

  if (delegation.max_uses && delegation.use_count >= delegation.max_uses) {
    return false;
  }

  return true;
};

/**
 * Get approval request status display name
 */
export const getApprovalRequestStatusDisplay = (status: ApprovalRequestStatus): string => {
  const displays: Record<ApprovalRequestStatus, string> = {
    PENDING: 'Pending Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    AUTO_APPROVED: 'Auto-Approved',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  };
  return displays[status];
};

/**
 * Get approval action type display name
 */
export const getApprovalActionTypeDisplay = (actionType: ApprovalActionType): string => {
  const displays: Record<ApprovalActionType, string> = {
    APPROVE: 'Approved',
    REJECT: 'Rejected',
    DELEGATE: 'Delegated',
    RECALL: 'Recalled',
    CANCEL: 'Cancelled',
  };
  return displays[actionType];
};
