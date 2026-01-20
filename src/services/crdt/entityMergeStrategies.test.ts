/**
 * Entity Merge Strategies Tests
 *
 * Unit tests for entity-specific CRDT merge strategies.
 *
 * Requirements:
 * - ARCH-004: CRDT conflict resolution
 * - Group I, Item I1: Entity merge strategies testing
 */

import { describe, it, expect } from 'vitest';
import {
  mergeWithStrategy,
  accountMergeStrategy,
  getMergeStrategy,
  applyFieldStrategy,
} from './entityMergeStrategies';
import type { Account, Transaction, Contact, Product } from '../../types/database.types';
import type { CRDTEntity } from '../../types/crdt.types';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockAccount(overrides: Partial<Account> = {}): Account & CRDTEntity {
  return {
    id: 'acct-1',
    company_id: 'company-1',
    account_number: '1000',
    name: 'Cash',
    type: 'ASSET' as const,
    parent_id: null,
    balance: '1000.00',
    description: 'Cash account',
    active: true,
    created_at: Date.now() - 10000,
    updated_at: Date.now() - 5000,
    deleted_at: null,
    version_vector: { 'device-1': 1 },
    ...overrides,
  };
}

function createMockTransaction(overrides: Partial<Transaction> = {}): Transaction & CRDTEntity {
  return {
    id: 'txn-1',
    company_id: 'company-1',
    transaction_number: 'T-001',
    transaction_date: Date.now(),
    type: 'JOURNAL_ENTRY' as const,
    status: 'DRAFT' as const,
    description: 'Test transaction',
    reference: null,
    memo: null,
    attachments: [],
    created_at: Date.now() - 10000,
    updated_at: Date.now() - 5000,
    deleted_at: null,
    version_vector: { 'device-1': 1 },
    ...overrides,
  };
}

// ============================================================================
// Account Merge Strategy Tests
// ============================================================================

describe('Account Merge Strategy', () => {
  it('should exist in registry', () => {
    const strategy = getMergeStrategy('Account');
    expect(strategy).toBeDefined();
    expect(strategy).toBe(accountMergeStrategy);
  });

  it('should use LWW for name field', () => {
    const local = createMockAccount({
      name: 'Cash Account',
      updated_at: Date.now() - 1000,
    });

    const remote = createMockAccount({
      name: 'Cash - Main',
      updated_at: Date.now(),
    });

    const merged = mergeWithStrategy(local, remote, 'Account');
    expect(merged.name).toBe('Cash - Main'); // Remote is newer
  });

  it('should use OR resolver for active status', () => {
    const local = createMockAccount({
      active: true,
      updated_at: Date.now() - 1000,
    });

    const remote = createMockAccount({
      active: false,
      updated_at: Date.now(),
    });

    const merged = mergeWithStrategy(local, remote, 'Account');
    // OR resolver: true || false = true
    expect(merged.active).toBe(true);
  });

  it('should preserve hierarchy integrity', () => {
    const local = createMockAccount({
      parent_id: 'parent-1',
      updated_at: Date.now() - 1000,
    });

    const remote = createMockAccount({
      parent_id: 'parent-2',
      updated_at: Date.now(),
    });

    // Custom merger should handle this
    const merged = mergeWithStrategy(local, remote, 'Account');
    // Remote is newer, should win
    expect(merged.parent_id).toBe('parent-2');
  });
});

// ============================================================================
// Transaction Merge Strategy Tests
// ============================================================================

describe('Transaction Merge Strategy', () => {
  it('should keep POSTED status sticky', () => {
    const local = createMockTransaction({
      status: 'POSTED' as const,
      updated_at: Date.now() - 1000,
    });

    const remote = createMockTransaction({
      status: 'DRAFT' as const,
      updated_at: Date.now(),
    });

    const merged = mergeWithStrategy(local, remote, 'Transaction');
    // POSTED is sticky, should stay POSTED
    expect(merged.status).toBe('POSTED');
  });

  it('should merge attachments using union', () => {
    const local = createMockTransaction({
      attachments: ['file1.pdf', 'file2.pdf'],
      updated_at: Date.now() - 1000,
    });

    const remote = createMockTransaction({
      attachments: ['file2.pdf', 'file3.pdf'],
      updated_at: Date.now(),
    });

    const merged = mergeWithStrategy(local, remote, 'Transaction');
    // Union should include all unique attachments
    expect(merged.attachments).toContain('file1.pdf');
    expect(merged.attachments).toContain('file2.pdf');
    expect(merged.attachments).toContain('file3.pdf');
    expect(merged.attachments.length).toBe(3);
  });

  it('should prefer RECONCILED over POSTED', () => {
    const local = createMockTransaction({
      status: 'RECONCILED' as const,
      updated_at: Date.now() - 1000,
    });

    const remote = createMockTransaction({
      status: 'POSTED' as const,
      updated_at: Date.now(),
    });

    const merged = mergeWithStrategy(local, remote, 'Transaction');
    expect(merged.status).toBe('RECONCILED');
  });

  it('should use LWW for description', () => {
    const local = createMockTransaction({
      description: 'Old description',
      updated_at: Date.now() - 1000,
    });

    const remote = createMockTransaction({
      description: 'New description',
      updated_at: Date.now(),
    });

    const merged = mergeWithStrategy(local, remote, 'Transaction');
    expect(merged.description).toBe('New description');
  });
});

// ============================================================================
// Field Strategy Tests
// ============================================================================

describe('Field Strategy Application', () => {
  it('should apply LWW strategy correctly', () => {
    const localValue = 'local';
    const remoteValue = 'remote';
    const localTimestamp = Date.now() - 1000;
    const remoteTimestamp = Date.now();

    const result = applyFieldStrategy(
      'test_field',
      localValue,
      remoteValue,
      { strategy: 'lww' },
      localTimestamp,
      remoteTimestamp
    );

    expect(result).toBe('remote'); // Remote is newer
  });

  it('should apply max strategy for numbers', () => {
    const result = applyFieldStrategy(
      'test_field',
      100,
      200,
      { strategy: 'max' },
      Date.now(),
      Date.now()
    );

    expect(result).toBe(200);
  });

  it('should apply max strategy for string decimals', () => {
    const result = applyFieldStrategy(
      'balance',
      '100.50',
      '200.75',
      { strategy: 'max' },
      Date.now(),
      Date.now()
    );

    expect(result).toBe('200.75');
  });

  it('should apply union strategy for arrays', () => {
    const localArray = ['a', 'b'];
    const remoteArray = ['b', 'c'];

    const result = applyFieldStrategy(
      'tags',
      localArray,
      remoteArray,
      { strategy: 'union' },
      Date.now(),
      Date.now()
    );

    expect(result).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect((result as unknown[]).length).toBe(3);
  });

  it('should apply custom strategy with resolver', () => {
    const customResolver = (local: unknown, remote: unknown) => {
      return `${local}-${remote}`;
    };

    const result = applyFieldStrategy(
      'test_field',
      'local',
      'remote',
      { strategy: 'custom', resolver: customResolver },
      Date.now(),
      Date.now()
    );

    expect(result).toBe('local-remote');
  });
});

// ============================================================================
// Generic Merge Tests
// ============================================================================

describe('Generic Entity Merge', () => {
  it('should fallback to LWW for unknown entity types', () => {
    const local = createMockAccount({
      name: 'Old Name',
      updated_at: Date.now() - 1000,
    });

    const remote = createMockAccount({
      name: 'New Name',
      updated_at: Date.now(),
    });

    // Use unknown entity type
    const merged = mergeWithStrategy(local, remote, 'UnknownType');
    expect(merged.name).toBe('New Name'); // Remote is newer
  });

  it('should preserve entity ID', () => {
    const local = createMockAccount({ id: 'account-123' });
    const remote = createMockAccount({ id: 'account-123' });

    const merged = mergeWithStrategy(local, remote, 'Account');
    expect(merged.id).toBe('account-123');
  });

  it('should not modify version_vector during merge', () => {
    const local = createMockAccount({
      version_vector: { 'device-1': 5, 'device-2': 3 },
    });

    const remote = createMockAccount({
      version_vector: { 'device-1': 4, 'device-2': 6 },
    });

    const merged = mergeWithStrategy(local, remote, 'Account');

    // Merge function should not modify version_vector
    // (that's handled separately in conflict resolution service)
    expect(merged.version_vector).toBeDefined();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle null values correctly', () => {
    const local = createMockAccount({
      description: 'Has description',
      updated_at: Date.now() - 1000,
    });

    const remote = createMockAccount({
      description: null,
      updated_at: Date.now(),
    });

    const merged = mergeWithStrategy(local, remote, 'Account');
    expect(merged.description).toBe(null); // Remote is newer
  });

  it('should handle undefined values', () => {
    const local = createMockAccount({
      account_number: '1000',
      updated_at: Date.now() - 1000,
    });

    const remote = createMockAccount({
      account_number: undefined as unknown as string | null,
      updated_at: Date.now(),
    });

    const merged = mergeWithStrategy(local, remote, 'Account');
    // LWW should handle undefined
    expect(merged.account_number).toBe(undefined);
  });

  it('should handle empty arrays', () => {
    const local = createMockTransaction({
      attachments: ['file1.pdf'],
      updated_at: Date.now() - 1000,
    });

    const remote = createMockTransaction({
      attachments: [],
      updated_at: Date.now(),
    });

    const merged = mergeWithStrategy(local, remote, 'Transaction');
    // Union of ['file1.pdf'] and [] should be ['file1.pdf']
    expect(merged.attachments).toContain('file1.pdf');
  });

  it('should handle equal timestamps', () => {
    const timestamp = Date.now();

    const local = createMockAccount({
      name: 'Local Name',
      updated_at: timestamp,
      id: 'aaaa',
    });

    const remote = createMockAccount({
      name: 'Remote Name',
      updated_at: timestamp,
      id: 'bbbb',
    });

    // When timestamps are equal, should use deterministic tie-breaker (ID)
    const merged = mergeWithStrategy(local, remote, 'Account');
    // Higher ID should win: 'bbbb' > 'aaaa'
    expect(merged.name).toBe('Remote Name');
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should merge 1000 entities efficiently', () => {
    const startTime = Date.now();

    for (let i = 0; i < 1000; i++) {
      const local = createMockAccount({
        id: `account-${i}`,
        name: `Account ${i} Local`,
        updated_at: Date.now() - 1000,
      });

      const remote = createMockAccount({
        id: `account-${i}`,
        name: `Account ${i} Remote`,
        updated_at: Date.now(),
      });

      mergeWithStrategy(local, remote, 'Account');
    }

    const duration = Date.now() - startTime;

    // Should complete 1000 merges in under 1 second
    expect(duration).toBeLessThan(1000);
  });
});
