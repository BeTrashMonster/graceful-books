/**
 * Enhanced Audit Entry Types
 *
 * Per MVS-R 12 requirements, this schema provides:
 * - Complete action tracing with principal chains
 * - Tamper-evident storage via hash chains
 * - Privacy-preserving argument hashing
 * - Policy decision tracking
 *
 * @gate 1.3
 */

/**
 * Audit action types (extended from database.types.ts)
 */
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'sync'
  | 'auth'
  | 'permission'
  | 'export'
  | 'import'
  | 'restore'
  | 'login'
  | 'logout';

/**
 * Resource types that can be audited
 */
export type AuditResourceType =
  | 'transaction'
  | 'account'
  | 'invoice'
  | 'contact'
  | 'product'
  | 'user'
  | 'setting'
  | 'sync_operation'
  | 'session'
  | 'company'
  | 'backup'
  | 'key';

/**
 * Policy decision made for the action
 */
export type PolicyDecision = 'allowed' | 'denied' | 'escalated';

/**
 * How approval was obtained for the action
 */
export type ApprovalMethod = 'auto' | 'user_confirmed' | 'admin_override' | 'system';

/**
 * Origin of the action
 */
export type AuditSource = 'manual' | 'import' | 'sync' | 'ai' | 'integration' | 'system';

/**
 * Enhanced audit entry schema per MVS-R 12 requirements.
 * All fields required for security evidence and compliance.
 */
export interface AuditEntry {
  /** Unique identifier for this audit entry */
  id: string;

  /** ISO 8601 timestamp with timezone */
  timestamp: string;

  /** Chain of principals involved: [user_id, session_id, device_id] */
  principal_chain: string[];

  /** Action performed */
  action: AuditAction;

  /** Type of resource affected */
  resource_type: AuditResourceType;

  /** ID of affected resource */
  resource_id: string;

  /** SHA-256 hash of action arguments (not raw args for privacy) */
  args_hash: string;

  /** Policy decision made */
  policy_decision: PolicyDecision;

  /** How approval was obtained */
  approval_method: ApprovalMethod;

  /** For distributed tracing */
  trace_parent?: string;

  /** Origin of the action */
  source: AuditSource;

  /** Hash of previous entry for tamper evidence */
  previous_hash: string;

  /** Signature if cryptographic verification enabled */
  signature?: string;

  /** Company ID for multi-tenant isolation */
  company_id: string;
}

/**
 * Input for creating a new audit entry (without computed fields)
 */
export type AuditEntryInput = Omit<AuditEntry, 'id' | 'previous_hash' | 'signature'>;

/**
 * Chain verification result
 */
export interface ChainVerification {
  /** Whether the chain is valid */
  valid: boolean;
  /** Index where chain breaks (if invalid) */
  broken_at?: number;
  /** Total entries verified */
  total_entries: number;
  /** Timestamp of verification */
  verified_at: string;
}

/**
 * Audit chain maintains tamper-evident history
 */
export interface AuditChainState {
  entries: AuditEntry[];
  chain_hash: string; // Hash of entire chain for quick verification
  last_verified: string;
}

/**
 * Audit trail query options
 */
export interface AuditQueryOptions {
  company_id: string;
  resource_type?: AuditResourceType;
  resource_id?: string;
  action?: AuditAction;
  source?: AuditSource;
  policy_decision?: PolicyDecision;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

/**
 * Audit statistics for monitoring
 */
export interface AuditStatistics {
  total_entries: number;
  by_action: Record<AuditAction, number>;
  by_resource_type: Record<AuditResourceType, number>;
  by_policy_decision: Record<PolicyDecision, number>;
  by_source: Record<AuditSource, number>;
  date_range: {
    earliest: string | null;
    latest: string | null;
  };
}
