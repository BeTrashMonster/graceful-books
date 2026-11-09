/**
 * Enhanced Audit Chain Service
 *
 * Implements tamper-evident audit logging per MVS-R 12 requirements.
 * Uses SHA-256 hash chains to detect any tampering with the audit trail.
 *
 * @gate 1.3
 */

import type {
  AuditEntry,
  AuditEntryInput,
  ChainVerification,
  AuditQueryOptions,
  AuditStatistics,
} from '../../types/audit';

// Genesis hash for the first entry in the chain
const GENESIS_HASH = 'GENESIS';

/**
 * Compute SHA-256 hash of content
 * Uses Web Crypto API for browser compatibility
 */
async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash the content of an audit entry for chain linking
 */
async function hashEntry(entry: AuditEntry): Promise<string> {
  const content = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    principal_chain: entry.principal_chain,
    action: entry.action,
    resource_type: entry.resource_type,
    resource_id: entry.resource_id,
    args_hash: entry.args_hash,
    policy_decision: entry.policy_decision,
    source: entry.source,
  });
  return sha256(content);
}

/**
 * Hash action arguments for privacy-preserving logging
 */
export async function hashArgs(args: unknown): Promise<string> {
  const content = JSON.stringify(args);
  return sha256(content);
}

/**
 * Enhanced Audit Chain class
 * Maintains a tamper-evident chain of audit entries
 */
export class EnhancedAuditChain {
  private entries: AuditEntry[] = [];
  private storageKey: string;
  private companyId: string;

  constructor(companyId: string, storageKey = 'audit_chain') {
    this.companyId = companyId;
    this.storageKey = `${storageKey}_${companyId}`;
  }

  /**
   * Initialize the chain from storage
   */
  async initialize(): Promise<void> {
    // In browser context, load from IndexedDB
    // For testing, we may use an in-memory store
    this.entries = await this.loadFromStorage();
  }

  /**
   * Add a new entry to the audit chain
   */
  async addEntry(input: AuditEntryInput): Promise<AuditEntry> {
    const previousEntry = this.entries[this.entries.length - 1];
    const previous_hash = previousEntry
      ? await hashEntry(previousEntry)
      : GENESIS_HASH;

    const entry: AuditEntry = {
      ...input,
      id: crypto.randomUUID(),
      previous_hash,
      company_id: this.companyId,
    };

    this.entries.push(entry);
    await this.persist(entry);

    return entry;
  }

  /**
   * Verify the integrity of the entire chain
   * Returns where the chain breaks if tampered
   */
  async verifyChain(): Promise<ChainVerification> {
    const verified_at = new Date().toISOString();

    if (this.entries.length === 0) {
      return {
        valid: true,
        total_entries: 0,
        verified_at,
      };
    }

    // Check first entry has GENESIS hash
    if (this.entries[0].previous_hash !== GENESIS_HASH) {
      return {
        valid: false,
        broken_at: 0,
        total_entries: this.entries.length,
        verified_at,
      };
    }

    // Verify each subsequent entry's previous_hash matches
    for (let i = 1; i < this.entries.length; i++) {
      const expectedHash = await hashEntry(this.entries[i - 1]);
      if (this.entries[i].previous_hash !== expectedHash) {
        return {
          valid: false,
          broken_at: i,
          total_entries: this.entries.length,
          verified_at,
        };
      }
    }

    return {
      valid: true,
      total_entries: this.entries.length,
      verified_at,
    };
  }

  /**
   * Get all entries in the chain
   */
  getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries matching query options
   */
  queryEntries(options: AuditQueryOptions): AuditEntry[] {
    let filtered = this.entries.filter(e => e.company_id === options.company_id);

    if (options.resource_type) {
      filtered = filtered.filter(e => e.resource_type === options.resource_type);
    }

    if (options.resource_id) {
      filtered = filtered.filter(e => e.resource_id === options.resource_id);
    }

    if (options.action) {
      filtered = filtered.filter(e => e.action === options.action);
    }

    if (options.source) {
      filtered = filtered.filter(e => e.source === options.source);
    }

    if (options.policy_decision) {
      filtered = filtered.filter(e => e.policy_decision === options.policy_decision);
    }

    if (options.date_from) {
      filtered = filtered.filter(e => e.timestamp >= options.date_from!);
    }

    if (options.date_to) {
      filtered = filtered.filter(e => e.timestamp <= options.date_to!);
    }

    if (options.offset) {
      filtered = filtered.slice(options.offset);
    }

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get statistics about the audit chain
   */
  getStatistics(): AuditStatistics {
    const stats: AuditStatistics = {
      total_entries: this.entries.length,
      by_action: {} as Record<string, number>,
      by_resource_type: {} as Record<string, number>,
      by_policy_decision: {} as Record<string, number>,
      by_source: {} as Record<string, number>,
      date_range: {
        earliest: null,
        latest: null,
      },
    };

    for (const entry of this.entries) {
      // Count by action
      stats.by_action[entry.action] = (stats.by_action[entry.action] || 0) + 1;

      // Count by resource type
      stats.by_resource_type[entry.resource_type] =
        (stats.by_resource_type[entry.resource_type] || 0) + 1;

      // Count by policy decision
      stats.by_policy_decision[entry.policy_decision] =
        (stats.by_policy_decision[entry.policy_decision] || 0) + 1;

      // Count by source
      stats.by_source[entry.source] = (stats.by_source[entry.source] || 0) + 1;

      // Track date range
      if (!stats.date_range.earliest || entry.timestamp < stats.date_range.earliest) {
        stats.date_range.earliest = entry.timestamp;
      }
      if (!stats.date_range.latest || entry.timestamp > stats.date_range.latest) {
        stats.date_range.latest = entry.timestamp;
      }
    }

    return stats;
  }

  /**
   * Clear all entries (for testing only)
   * @internal
   */
  _clearForTesting(): void {
    this.entries = [];
  }

  /**
   * Get direct access to entries array (for testing tampering scenarios)
   * @internal
   */
  _getEntriesRef(): AuditEntry[] {
    return this.entries;
  }

  /**
   * Set entries directly (for testing tampering scenarios)
   * @internal
   */
  _setEntries(entries: AuditEntry[]): void {
    this.entries = entries;
  }

  /**
   * Load entries from storage
   */
  private async loadFromStorage(): Promise<AuditEntry[]> {
    // In test environment or when IndexedDB is not available
    if (typeof indexedDB === 'undefined') {
      return [];
    }

    // For now, return empty array
    // Real implementation would load from IndexedDB
    return [];
  }

  /**
   * Persist an entry to storage
   */
  private async persist(_entry: AuditEntry): Promise<void> {
    // In test environment or when IndexedDB is not available
    if (typeof indexedDB === 'undefined') {
      return;
    }

    // Real implementation would save to IndexedDB
  }
}

/**
 * Create an audit entry for a transaction operation
 */
export function createTransactionAuditEntry(
  action: 'create' | 'update' | 'delete',
  transactionId: string,
  args: unknown,
  context: {
    userId: string;
    sessionId: string;
    deviceId?: string;
    companyId: string;
    policyDecision?: 'allowed' | 'denied';
    source?: 'manual' | 'import' | 'sync';
  }
): Omit<AuditEntryInput, 'args_hash'> & { _args: unknown } {
  return {
    timestamp: new Date().toISOString(),
    principal_chain: [context.userId, context.sessionId, context.deviceId].filter(Boolean) as string[],
    action,
    resource_type: 'transaction',
    resource_id: transactionId,
    policy_decision: context.policyDecision || 'allowed',
    approval_method: 'user_confirmed',
    source: context.source || 'manual',
    company_id: context.companyId,
    _args: args,
  };
}

/**
 * Create an audit entry for an account operation
 */
export function createAccountAuditEntry(
  action: 'create' | 'update' | 'delete',
  accountId: string,
  args: unknown,
  context: {
    userId: string;
    sessionId: string;
    deviceId?: string;
    companyId: string;
    policyDecision?: 'allowed' | 'denied';
  }
): Omit<AuditEntryInput, 'args_hash'> & { _args: unknown } {
  return {
    timestamp: new Date().toISOString(),
    principal_chain: [context.userId, context.sessionId, context.deviceId].filter(Boolean) as string[],
    action,
    resource_type: 'account',
    resource_id: accountId,
    policy_decision: context.policyDecision || 'allowed',
    approval_method: 'user_confirmed',
    source: 'manual',
    company_id: context.companyId,
    _args: args,
  };
}

/**
 * Create an audit entry for a permission change
 */
export function createPermissionAuditEntry(
  userId: string,
  targetUserId: string,
  newRole: string,
  context: {
    userId: string;
    sessionId: string;
    companyId: string;
    policyDecision?: 'allowed' | 'denied';
  }
): Omit<AuditEntryInput, 'args_hash'> & { _args: unknown } {
  return {
    timestamp: new Date().toISOString(),
    principal_chain: [context.userId, context.sessionId],
    action: 'permission',
    resource_type: 'user',
    resource_id: targetUserId,
    policy_decision: context.policyDecision || 'allowed',
    approval_method: 'admin_override',
    source: 'manual',
    company_id: context.companyId,
    _args: { targetUserId, newRole },
  };
}

/**
 * Create an audit entry for a sync operation
 */
export function createSyncAuditEntry(
  operationId: string,
  args: unknown,
  context: {
    userId: string;
    sessionId: string;
    deviceId?: string;
    companyId: string;
    policyDecision?: 'allowed' | 'denied';
  }
): Omit<AuditEntryInput, 'args_hash'> & { _args: unknown } {
  return {
    timestamp: new Date().toISOString(),
    principal_chain: [context.userId, context.sessionId, context.deviceId].filter(Boolean) as string[],
    action: 'sync',
    resource_type: 'sync_operation',
    resource_id: operationId,
    policy_decision: context.policyDecision || 'allowed',
    approval_method: 'auto',
    source: 'sync',
    company_id: context.companyId,
    _args: args,
  };
}

export default EnhancedAuditChain;
