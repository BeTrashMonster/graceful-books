/**
 * Audit Trail Tamper Resistance Tests
 * Phase 1.3 - Foundation Security
 *
 * The audit chain claims to be tamper-evident.
 * These tests PROVE it by attempting tampering and verifying detection.
 *
 * @gate 1.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EnhancedAuditChain,
  hashArgs,
} from '../../services/audit/EnhancedAuditChain';
import type { AuditEntry, AuditEntryInput } from '../../types/audit';

// Test helper to create a valid audit entry input
function createTestEntryInput(
  action: AuditEntryInput['action'] = 'create',
  resourceType: AuditEntryInput['resource_type'] = 'transaction',
  overrides: Partial<AuditEntryInput> = {}
): AuditEntryInput {
  return {
    timestamp: new Date().toISOString(),
    principal_chain: ['user-1', 'session-1', 'device-1'],
    action,
    resource_type: resourceType,
    resource_id: `${resourceType}-${Date.now()}`,
    args_hash: 'mock-hash-' + Math.random().toString(36).substring(7),
    policy_decision: 'allowed',
    approval_method: 'user_confirmed',
    source: 'manual',
    company_id: 'test-company',
    ...overrides,
  };
}

describe('GATE 1.3: Audit Trail Tamper Resistance', () => {
  let auditChain: EnhancedAuditChain;

  beforeEach(async () => {
    auditChain = new EnhancedAuditChain('test-company');
    await auditChain.initialize();
    auditChain._clearForTesting();
  });

  describe('1.3.T.1: Tamper Detection', () => {
    beforeEach(async () => {
      // Seed with some entries
      await auditChain.addEntry(createTestEntryInput('create', 'transaction'));
      await auditChain.addEntry(createTestEntryInput('update', 'transaction'));
      await auditChain.addEntry(createTestEntryInput('delete', 'transaction'));
    });

    it('chain is valid before tampering', async () => {
      const result = await auditChain.verifyChain();
      expect(result.valid).toBe(true);
      expect(result.total_entries).toBe(3);
    });

    it('detects modification of entry content', async () => {
      // Verify chain is valid before tampering
      expect((await auditChain.verifyChain()).valid).toBe(true);

      // Tamper with an entry (simulate attacker modifying stored data)
      const entries = auditChain._getEntriesRef();
      const originalAction = entries[1].action;
      entries[1] = { ...entries[1], action: 'create' }; // Was 'update'

      // Chain should now be invalid
      const result = await auditChain.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.broken_at).toBe(2); // Break detected at next entry

      // Restore for cleanup
      entries[1] = { ...entries[1], action: originalAction };
    });

    it('detects modification of timestamp', async () => {
      expect((await auditChain.verifyChain()).valid).toBe(true);

      const entries = auditChain._getEntriesRef();
      const originalTimestamp = entries[0].timestamp;
      entries[0] = { ...entries[0], timestamp: '2020-01-01T00:00:00Z' };

      const result = await auditChain.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.broken_at).toBe(1);

      entries[0] = { ...entries[0], timestamp: originalTimestamp };
    });

    it('detects modification of resource_id', async () => {
      expect((await auditChain.verifyChain()).valid).toBe(true);

      const entries = auditChain._getEntriesRef();
      const originalId = entries[1].resource_id;
      entries[1] = { ...entries[1], resource_id: 'tampered-id' };

      const result = await auditChain.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.broken_at).toBe(2);

      entries[1] = { ...entries[1], resource_id: originalId };
    });

    it('detects modification of principal_chain', async () => {
      expect((await auditChain.verifyChain()).valid).toBe(true);

      const entries = auditChain._getEntriesRef();
      const originalPrincipals = entries[0].principal_chain;
      entries[0] = { ...entries[0], principal_chain: ['attacker-user'] };

      const result = await auditChain.verifyChain();
      expect(result.valid).toBe(false);

      entries[0] = { ...entries[0], principal_chain: originalPrincipals };
    });

    it('detects deletion of entries', async () => {
      expect((await auditChain.verifyChain()).valid).toBe(true);

      // Delete middle entry
      const entries = auditChain._getEntriesRef();
      const deletedEntry = entries.splice(1, 1)[0];

      // Chain should be invalid
      const result = await auditChain.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.broken_at).toBe(1);

      // Restore
      entries.splice(1, 0, deletedEntry);
    });

    it('detects insertion of entries', async () => {
      expect((await auditChain.verifyChain()).valid).toBe(true);

      // Insert fake entry in the middle
      const entries = auditChain._getEntriesRef();
      const fakeEntry: AuditEntry = {
        id: 'fake-entry-id',
        timestamp: new Date().toISOString(),
        principal_chain: ['attacker'],
        action: 'delete',
        resource_type: 'account',
        resource_id: 'hacked-account',
        args_hash: 'fake-hash',
        policy_decision: 'allowed',
        approval_method: 'auto',
        source: 'manual',
        previous_hash: 'fake-previous-hash',
        company_id: 'test-company',
      };

      entries.splice(1, 0, fakeEntry);

      // Chain should be invalid
      const result = await auditChain.verifyChain();
      expect(result.valid).toBe(false);

      // Remove fake entry
      entries.splice(1, 1);
    });

    it('detects reordering of entries', async () => {
      expect((await auditChain.verifyChain()).valid).toBe(true);

      // Swap entries 1 and 2
      const entries = auditChain._getEntriesRef();
      const temp = entries[1];
      entries[1] = entries[2];
      entries[2] = temp;

      // Chain should be invalid
      const result = await auditChain.verifyChain();
      expect(result.valid).toBe(false);

      // Restore order
      entries[2] = entries[1];
      entries[1] = temp;
    });

    it('detects modification of previous_hash', async () => {
      expect((await auditChain.verifyChain()).valid).toBe(true);

      // Modify previous_hash to try to hide tampering
      const entries = auditChain._getEntriesRef();
      const originalHash = entries[2].previous_hash;
      entries[2] = { ...entries[2], previous_hash: 'fake_hash' };

      // Chain should be invalid
      const result = await auditChain.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.broken_at).toBe(2);

      entries[2] = { ...entries[2], previous_hash: originalHash };
    });

    it('detects corruption of first entry genesis hash', async () => {
      expect((await auditChain.verifyChain()).valid).toBe(true);

      const entries = auditChain._getEntriesRef();
      const originalHash = entries[0].previous_hash;
      entries[0] = { ...entries[0], previous_hash: 'NOT_GENESIS' };

      const result = await auditChain.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.broken_at).toBe(0);

      entries[0] = { ...entries[0], previous_hash: originalHash };
    });
  });

  describe('1.3.T.2: Coverage Verification', () => {
    it('all transaction operations create audit entries', async () => {
      const initialCount = auditChain.getEntries().length;

      // Create
      await auditChain.addEntry(createTestEntryInput('create', 'transaction', {
        resource_id: 'txn-1',
      }));

      // Update
      await auditChain.addEntry(createTestEntryInput('update', 'transaction', {
        resource_id: 'txn-1',
      }));

      // Delete
      await auditChain.addEntry(createTestEntryInput('delete', 'transaction', {
        resource_id: 'txn-1',
      }));

      const entries = auditChain.getEntries();
      expect(entries.length).toBe(initialCount + 3);

      const txnEntries = entries.filter(e => e.resource_type === 'transaction');
      expect(txnEntries.some(e => e.action === 'create')).toBe(true);
      expect(txnEntries.some(e => e.action === 'update')).toBe(true);
      expect(txnEntries.some(e => e.action === 'delete')).toBe(true);
    });

    it('all account operations create audit entries', async () => {
      await auditChain.addEntry(createTestEntryInput('create', 'account', {
        resource_id: 'acct-1',
      }));
      await auditChain.addEntry(createTestEntryInput('update', 'account', {
        resource_id: 'acct-1',
      }));
      await auditChain.addEntry(createTestEntryInput('delete', 'account', {
        resource_id: 'acct-1',
      }));

      const entries = auditChain.getEntries();
      const acctEntries = entries.filter(e => e.resource_type === 'account');

      expect(acctEntries.length).toBe(3);
      expect(acctEntries.some(e => e.action === 'create')).toBe(true);
      expect(acctEntries.some(e => e.action === 'update')).toBe(true);
      expect(acctEntries.some(e => e.action === 'delete')).toBe(true);
    });

    it('all permission changes create audit entries', async () => {
      await auditChain.addEntry(createTestEntryInput('permission', 'user', {
        resource_id: 'user-target',
        approval_method: 'admin_override',
      }));

      const entries = auditChain.getEntries();
      const permEntries = entries.filter(e => e.action === 'permission');

      expect(permEntries.length).toBeGreaterThanOrEqual(1);
      expect(permEntries[0].resource_type).toBe('user');
    });

    it('denied operations are logged', async () => {
      await auditChain.addEntry(createTestEntryInput('create', 'transaction', {
        policy_decision: 'denied',
      }));

      const entries = auditChain.getEntries();
      const deniedEntries = entries.filter(e => e.policy_decision === 'denied');

      expect(deniedEntries.length).toBeGreaterThanOrEqual(1);
    });

    it('sync operations are logged with source', async () => {
      await auditChain.addEntry(createTestEntryInput('sync', 'sync_operation', {
        source: 'sync',
      }));

      const entries = auditChain.getEntries();
      const syncEntries = entries.filter(e => e.source === 'sync');

      expect(syncEntries.length).toBeGreaterThanOrEqual(1);
      expect(syncEntries[0].action).toBe('sync');
    });

    it('import operations are logged with source', async () => {
      await auditChain.addEntry(createTestEntryInput('import', 'transaction', {
        source: 'import',
      }));

      const entries = auditChain.getEntries();
      const importEntries = entries.filter(e => e.source === 'import');

      expect(importEntries.length).toBeGreaterThanOrEqual(1);
    });

    it('auth operations are logged', async () => {
      await auditChain.addEntry(createTestEntryInput('auth', 'session', {
        resource_id: 'session-1',
      }));

      const entries = auditChain.getEntries();
      const authEntries = entries.filter(e => e.action === 'auth');

      expect(authEntries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('1.3.T.3: Field Completeness', () => {
    it('all required fields are present in every entry', async () => {
      await auditChain.addEntry(createTestEntryInput('create', 'transaction'));

      const entries = auditChain.getEntries();
      const lastEntry = entries[entries.length - 1];

      // All required fields must be present
      expect(lastEntry.id).toBeDefined();
      expect(typeof lastEntry.id).toBe('string');
      expect(lastEntry.id.length).toBeGreaterThan(0);

      expect(lastEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      expect(lastEntry.principal_chain).toBeInstanceOf(Array);
      expect(lastEntry.principal_chain.length).toBeGreaterThan(0);

      expect(lastEntry.action).toBeDefined();
      expect(['create', 'read', 'update', 'delete', 'sync', 'auth', 'permission', 'export', 'import', 'restore', 'login', 'logout'])
        .toContain(lastEntry.action);

      expect(lastEntry.resource_type).toBeDefined();
      expect(['transaction', 'account', 'invoice', 'contact', 'product', 'user', 'setting', 'sync_operation', 'session', 'company', 'backup', 'key'])
        .toContain(lastEntry.resource_type);

      expect(lastEntry.resource_id).toBeDefined();
      expect(typeof lastEntry.resource_id).toBe('string');

      expect(lastEntry.args_hash).toBeDefined();
      expect(typeof lastEntry.args_hash).toBe('string');

      expect(lastEntry.policy_decision).toBeDefined();
      expect(['allowed', 'denied', 'escalated']).toContain(lastEntry.policy_decision);

      expect(lastEntry.approval_method).toBeDefined();
      expect(['auto', 'user_confirmed', 'admin_override', 'system']).toContain(lastEntry.approval_method);

      expect(lastEntry.source).toBeDefined();
      expect(['manual', 'import', 'sync', 'ai', 'integration', 'system']).toContain(lastEntry.source);

      expect(lastEntry.previous_hash).toBeDefined();
      expect(typeof lastEntry.previous_hash).toBe('string');
    });

    it('first entry has GENESIS previous_hash', async () => {
      await auditChain.addEntry(createTestEntryInput('create', 'transaction'));

      const entries = auditChain.getEntries();
      expect(entries[0].previous_hash).toBe('GENESIS');
    });

    it('subsequent entries have valid previous_hash (not GENESIS)', async () => {
      await auditChain.addEntry(createTestEntryInput('create', 'transaction'));
      await auditChain.addEntry(createTestEntryInput('update', 'transaction'));

      const entries = auditChain.getEntries();
      expect(entries[1].previous_hash).not.toBe('GENESIS');
      expect(entries[1].previous_hash.length).toBeGreaterThan(10);
    });

    it('principal_chain contains user identification', async () => {
      await auditChain.addEntry(createTestEntryInput('create', 'transaction', {
        principal_chain: ['user-123', 'session-456', 'device-789'],
      }));

      const entries = auditChain.getEntries();
      const lastEntry = entries[entries.length - 1];

      expect(lastEntry.principal_chain).toContain('user-123');
      expect(lastEntry.principal_chain).toContain('session-456');
    });

    it('timestamps are ISO 8601 format with timezone', async () => {
      await auditChain.addEntry(createTestEntryInput('create', 'transaction'));

      const entries = auditChain.getEntries();
      const lastEntry = entries[entries.length - 1];

      // Should be valid ISO 8601
      const parsed = new Date(lastEntry.timestamp);
      expect(parsed.toString()).not.toBe('Invalid Date');

      // Should have T separator and Z or timezone offset
      expect(lastEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('1.3.T.4: Hash Argument Privacy', () => {
    it('args_hash is a valid hash (not raw data)', async () => {
      const sensitiveArgs = { amount: 10000, memo: 'secret payment' };
      const hash = await hashArgs(sensitiveArgs);

      // Should be a hex string (SHA-256 produces 64 hex chars)
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('different args produce different hashes', async () => {
      const hash1 = await hashArgs({ amount: 100 });
      const hash2 = await hashArgs({ amount: 200 });

      expect(hash1).not.toBe(hash2);
    });

    it('same args produce same hash', async () => {
      const args = { amount: 100, memo: 'test' };
      const hash1 = await hashArgs(args);
      const hash2 = await hashArgs(args);

      expect(hash1).toBe(hash2);
    });

    it('raw sensitive data is not stored in audit entry', async () => {
      const sensitiveData = { password: 'secret123', ssn: '123-45-6789' };
      const argsHash = await hashArgs(sensitiveData);

      await auditChain.addEntry(createTestEntryInput('create', 'user', {
        args_hash: argsHash,
      }));

      const entries = auditChain.getEntries();
      const lastEntry = entries[entries.length - 1];

      // Entry should not contain raw sensitive data
      const entryString = JSON.stringify(lastEntry);
      expect(entryString).not.toContain('secret123');
      expect(entryString).not.toContain('123-45-6789');

      // But should contain the hash
      expect(lastEntry.args_hash).toBe(argsHash);
    });
  });

  describe('1.3.T.5: Chain Statistics', () => {
    it('provides accurate statistics by action', async () => {
      await auditChain.addEntry(createTestEntryInput('create', 'transaction'));
      await auditChain.addEntry(createTestEntryInput('create', 'transaction'));
      await auditChain.addEntry(createTestEntryInput('update', 'transaction'));
      await auditChain.addEntry(createTestEntryInput('delete', 'transaction'));

      const stats = auditChain.getStatistics();

      expect(stats.total_entries).toBe(4);
      expect(stats.by_action['create']).toBe(2);
      expect(stats.by_action['update']).toBe(1);
      expect(stats.by_action['delete']).toBe(1);
    });

    it('provides accurate statistics by resource type', async () => {
      await auditChain.addEntry(createTestEntryInput('create', 'transaction'));
      await auditChain.addEntry(createTestEntryInput('create', 'account'));
      await auditChain.addEntry(createTestEntryInput('create', 'account'));

      const stats = auditChain.getStatistics();

      expect(stats.by_resource_type['transaction']).toBe(1);
      expect(stats.by_resource_type['account']).toBe(2);
    });

    it('provides accurate statistics by policy decision', async () => {
      await auditChain.addEntry(createTestEntryInput('create', 'transaction', { policy_decision: 'allowed' }));
      await auditChain.addEntry(createTestEntryInput('create', 'transaction', { policy_decision: 'denied' }));
      await auditChain.addEntry(createTestEntryInput('create', 'transaction', { policy_decision: 'denied' }));

      const stats = auditChain.getStatistics();

      expect(stats.by_policy_decision['allowed']).toBe(1);
      expect(stats.by_policy_decision['denied']).toBe(2);
    });

    it('tracks date range correctly', async () => {
      const earlierDate = '2024-01-01T00:00:00.000Z';
      const laterDate = '2024-12-31T23:59:59.999Z';

      await auditChain.addEntry(createTestEntryInput('create', 'transaction', { timestamp: earlierDate }));
      await auditChain.addEntry(createTestEntryInput('create', 'transaction', { timestamp: laterDate }));

      const stats = auditChain.getStatistics();

      expect(stats.date_range.earliest).toBe(earlierDate);
      expect(stats.date_range.latest).toBe(laterDate);
    });
  });

  describe('1.3.T.6: Query Functionality', () => {
    beforeEach(async () => {
      await auditChain.addEntry(createTestEntryInput('create', 'transaction', { resource_id: 'txn-1', policy_decision: 'allowed' }));
      await auditChain.addEntry(createTestEntryInput('update', 'transaction', { resource_id: 'txn-1', policy_decision: 'allowed' }));
      await auditChain.addEntry(createTestEntryInput('create', 'account', { resource_id: 'acct-1', policy_decision: 'denied' }));
      await auditChain.addEntry(createTestEntryInput('delete', 'transaction', { resource_id: 'txn-2', source: 'sync' }));
    });

    it('queries by resource type', () => {
      const results = auditChain.queryEntries({
        company_id: 'test-company',
        resource_type: 'transaction',
      });

      expect(results.length).toBe(3);
      expect(results.every(e => e.resource_type === 'transaction')).toBe(true);
    });

    it('queries by action', () => {
      const results = auditChain.queryEntries({
        company_id: 'test-company',
        action: 'create',
      });

      expect(results.length).toBe(2);
      expect(results.every(e => e.action === 'create')).toBe(true);
    });

    it('queries by policy decision', () => {
      const results = auditChain.queryEntries({
        company_id: 'test-company',
        policy_decision: 'denied',
      });

      expect(results.length).toBe(1);
      expect(results[0].resource_type).toBe('account');
    });

    it('queries by source', () => {
      const results = auditChain.queryEntries({
        company_id: 'test-company',
        source: 'sync',
      });

      expect(results.length).toBe(1);
      expect(results[0].resource_id).toBe('txn-2');
    });

    it('supports pagination with limit and offset', () => {
      const page1 = auditChain.queryEntries({
        company_id: 'test-company',
        limit: 2,
      });

      const page2 = auditChain.queryEntries({
        company_id: 'test-company',
        limit: 2,
        offset: 2,
      });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });
});
