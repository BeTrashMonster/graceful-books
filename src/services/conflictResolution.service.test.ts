/**
 * Conflict Resolution Service Tests
 *
 * Unit tests for conflict detection and resolution.
 *
 * Requirements:
 * - ARCH-004: CRDT conflict resolution
 * - Group I, Item I1: Conflict resolution testing
 */

import { describe, it, expect } from 'vitest';
import {
  detectConflict,
  detectConflictsBatch,
  resolveConflictAuto,
  resolveConflictsBatch,
  applyManualResolution,
  getFieldConflicts,
  calculateMetrics,
  validateResolution,
} from './conflictResolution.service';
import { AccountType } from '../types/database.types';
import type { Account } from '../types/database.types';
import type {
  CRDTEntity,
  DetectedConflict,
  ManualResolutionDecision,
  ResolutionStrategy,
} from '../types/crdt.types';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockAccount(overrides: Partial<Account> = {}): Account & CRDTEntity {
  return {
    id: 'acct-1',
    company_id: 'company-1',
    account_number: '1000',
    name: 'Cash',
    type: AccountType.ASSET,
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

// ============================================================================
// Conflict Detection Tests
// ============================================================================

describe('Conflict Detection', () => {
  it('should detect concurrent modification', () => {
    const local = createMockAccount({
      name: 'Cash Account',
      version_vector: { 'device-1': 2, 'device-2': 1 },
      updated_at: Date.now() - 1000,
    });

    const remote = createMockAccount({
      name: 'Cash - Main',
      version_vector: { 'device-1': 1, 'device-2': 2 },
      updated_at: Date.now(),
    });

    const conflict = detectConflict(local, remote, 'Account');

    expect(conflict).toBeDefined();
    expect(conflict?.conflictType).toBe('concurrent_update');
    expect(conflict?.conflictingFields).toContain('name');
  });

  it('should not detect conflict for causally ordered versions', () => {
    const local = createMockAccount({
      version_vector: { 'device-1': 1, 'device-2': 1 },
    });

    const remote = createMockAccount({
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const conflict = detectConflict(local, remote, 'Account');

    expect(conflict).toBeNull();
  });

  it('should detect delete-update conflict', () => {
    const local = createMockAccount({
      deleted_at: Date.now() - 500,
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const remote = createMockAccount({
      deleted_at: null,
      name: 'Updated Account',
      version_vector: { 'device-1': 1, 'device-2': 2 },
    });

    const conflict = detectConflict(local, remote, 'Account');

    expect(conflict).toBeDefined();
    expect(conflict?.conflictType).toBe('delete_update');
    expect(conflict?.severity).toBe('high');
  });

  it('should identify conflicting fields', () => {
    const local = createMockAccount({
      name: 'Cash Account',
      description: 'Main cash account',
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const remote = createMockAccount({
      name: 'Cash - Main',
      description: 'Main cash account', // Same
      balance: '2000.00', // Different
      version_vector: { 'device-1': 1, 'device-2': 2 },
    });

    const conflict = detectConflict(local, remote, 'Account');

    expect(conflict?.conflictingFields).toContain('name');
    expect(conflict?.conflictingFields).toContain('balance');
    expect(conflict?.conflictingFields).not.toContain('description');
  });

  it('should classify conflict severity', () => {
    const local = createMockAccount({
      name: 'Cash',
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const remote = createMockAccount({
      name: 'Cash Account',
      version_vector: { 'device-1': 1, 'device-2': 2 },
    });

    const conflict = detectConflict(local, remote, 'Account');

    // Only name differs, should be low severity
    expect(conflict?.severity).toBe('low');
  });

  it('should detect batch conflicts', () => {
    const local = [
      createMockAccount({
        id: 'acct-1',
        name: 'Account 1 Local',
        version_vector: { 'device-1': 2, 'device-2': 1 },
      }),
      createMockAccount({
        id: 'acct-2',
        name: 'Account 2 Local',
        version_vector: { 'device-1': 2, 'device-2': 1 },
      }),
    ];

    const remote = [
      createMockAccount({
        id: 'acct-1',
        name: 'Account 1 Remote',
        version_vector: { 'device-1': 1, 'device-2': 2 },
      }),
      createMockAccount({
        id: 'acct-2',
        name: 'Account 2',
        version_vector: { 'device-1': 2, 'device-2': 1 },
      }),
    ];

    const conflicts = detectConflictsBatch(local, remote, 'Account');

    expect(conflicts.length).toBe(1); // Only acct-1 has conflict
    expect(conflicts[0]?.entityId).toBe('acct-1');
  });
});

// ============================================================================
// Automatic Resolution Tests
// ============================================================================

describe('Automatic Conflict Resolution', () => {
  it('should resolve with auto_merge strategy', () => {
    const local = createMockAccount({
      name: 'Cash Account',
      updated_at: Date.now() - 1000,
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const remote = createMockAccount({
      name: 'Cash - Main',
      updated_at: Date.now(),
      version_vector: { 'device-1': 1, 'device-2': 2 },
    });

    const conflict = detectConflict(local, remote, 'Account');
    expect(conflict).toBeDefined();

    const resolution = resolveConflictAuto(conflict!, 'auto_merge' as ResolutionStrategy);

    expect(resolution.strategy).toBe('auto_merge');
    expect(resolution.resolvedEntity.name).toBe('Cash - Main'); // Remote is newer
    expect(resolution.winner).toBe('merged');
  });

  it('should resolve with local_wins strategy', () => {
    const local = createMockAccount({
      name: 'Local Name',
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const remote = createMockAccount({
      name: 'Remote Name',
      version_vector: { 'device-1': 1, 'device-2': 2 },
    });

    const conflict = detectConflict(local, remote, 'Account');
    expect(conflict).toBeDefined();

    const resolution = resolveConflictAuto(conflict!, 'local_wins' as ResolutionStrategy);

    expect(resolution.strategy).toBe('local_wins');
    expect(resolution.resolvedEntity.name).toBe('Local Name');
    expect(resolution.winner).toBe('local');
  });

  it('should resolve with remote_wins strategy', () => {
    const local = createMockAccount({
      name: 'Local Name',
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const remote = createMockAccount({
      name: 'Remote Name',
      version_vector: { 'device-1': 1, 'device-2': 2 },
    });

    const conflict = detectConflict(local, remote, 'Account');
    expect(conflict).toBeDefined();

    const resolution = resolveConflictAuto(conflict!, 'remote_wins' as ResolutionStrategy);

    expect(resolution.strategy).toBe('remote_wins');
    expect(resolution.resolvedEntity.name).toBe('Remote Name');
    expect(resolution.winner).toBe('remote');
  });

  it('should resolve batch conflicts', () => {
    const conflicts: DetectedConflict<Account & CRDTEntity>[] = [];

    for (let i = 0; i < 5; i++) {
      const local = createMockAccount({
        id: `acct-${i}`,
        name: `Account ${i} Local`,
        version_vector: { 'device-1': 2, 'device-2': 1 },
      });

      const remote = createMockAccount({
        id: `acct-${i}`,
        name: `Account ${i} Remote`,
        version_vector: { 'device-1': 1, 'device-2': 2 },
      });

      const conflict = detectConflict(local, remote, 'Account');
      if (conflict) conflicts.push(conflict);
    }

    const result = resolveConflictsBatch(conflicts);

    expect(result.totalConflicts).toBe(5);
    expect(result.resolved.length).toBe(5);
    expect(result.unresolved.length).toBe(0);
    expect(result.stats.autoResolved).toBe(5);
  });
});

// ============================================================================
// Manual Resolution Tests
// ============================================================================

describe('Manual Conflict Resolution', () => {
  it('should apply keep_local decision', () => {
    const local = createMockAccount({
      name: 'Local Name',
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const remote = createMockAccount({
      name: 'Remote Name',
      version_vector: { 'device-1': 1, 'device-2': 2 },
    });

    const conflict = detectConflict(local, remote, 'Account');
    expect(conflict).toBeDefined();

    const decision: ManualResolutionDecision = {
      conflictId: conflict!.id,
      resolvedBy: 'user-123',
      strategy: 'keep_local',
      notes: 'Local version is correct',
    };

    const resolution = applyManualResolution(conflict!, decision);

    expect(resolution.resolvedEntity.name).toBe('Local Name');
    expect(resolution.winner).toBe('local');
    expect(resolution.resolvedBy).toBe('user-123');
    expect(resolution.resolutionNotes).toBe('Local version is correct');
  });

  it('should apply custom_merge decision', () => {
    const local = createMockAccount({
      name: 'Local Name',
      description: 'Local Description',
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const remote = createMockAccount({
      name: 'Remote Name',
      description: 'Remote Description',
      version_vector: { 'device-1': 1, 'device-2': 2 },
    });

    const conflict = detectConflict(local, remote, 'Account');
    expect(conflict).toBeDefined();

    const decision: ManualResolutionDecision = {
      conflictId: conflict!.id,
      resolvedBy: 'user-123',
      strategy: 'custom_merge',
      customMerge: {
        name: 'Custom Name',
        description: 'Local Description',
      },
    };

    const resolution = applyManualResolution(conflict!, decision);

    expect(resolution.resolvedEntity.name).toBe('Custom Name');
    expect(resolution.resolvedEntity.description).toBe('Local Description');
    expect(resolution.winner).toBe('manual');
  });

  it('should get field conflicts for manual resolution UI', () => {
    const local = createMockAccount({
      name: 'Local Name',
      description: 'Local Description',
      balance: '1000.00',
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const remote = createMockAccount({
      name: 'Remote Name',
      description: 'Local Description', // Same
      balance: '2000.00',
      version_vector: { 'device-1': 1, 'device-2': 2 },
    });

    const conflict = detectConflict(local, remote, 'Account');
    expect(conflict).toBeDefined();

    const fieldConflicts = getFieldConflicts(conflict!);

    expect(fieldConflicts.length).toBeGreaterThan(0);

    const nameConflict = fieldConflicts.find((fc: any) => fc.fieldName === 'name');
    expect(nameConflict).toBeDefined();
    expect(nameConflict?.localValue).toBe('Local Name');
    expect(nameConflict?.remoteValue).toBe('Remote Name');
  });
});

// ============================================================================
// Metrics Tests
// ============================================================================

describe('Conflict Metrics', () => {
  it('should calculate metrics correctly', () => {
    const conflicts: DetectedConflict[] = [];
    const resolutions = [];

    for (let i = 0; i < 10; i++) {
      const local = createMockAccount({
        id: `acct-${i}`,
        version_vector: { 'device-1': 2, 'device-2': 1 },
      });

      const remote = createMockAccount({
        id: `acct-${i}`,
        version_vector: { 'device-1': 1, 'device-2': 2 },
      });

      const conflict = detectConflict(local, remote, 'Account');
      if (conflict) {
        conflicts.push(conflict);
        const resolution = resolveConflictAuto(conflict);
        resolutions.push(resolution);
      }
    }

    const metrics = calculateMetrics(conflicts, resolutions);

    expect(metrics.totalConflictsDetected).toBe(conflicts.length);
    expect(metrics.totalConflictsResolved).toBe(resolutions.length);
    expect(metrics.autoResolveSuccessRate).toBeGreaterThan(0);
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('Resolution Validation', () => {
  it('should validate correct resolution', () => {
    const local = createMockAccount({
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const remote = createMockAccount({
      version_vector: { 'device-1': 1, 'device-2': 2 },
    });

    const conflict = detectConflict(local, remote, 'Account');
    expect(conflict).toBeDefined();

    const resolution = resolveConflictAuto(conflict!);

    const validation = validateResolution(resolution);

    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it('should detect invalid resolution', () => {
    const invalidResolution = {
      conflictId: 'test',
      resolvedEntity: {} as Account & CRDTEntity, // Missing required fields
      strategy: 'auto_merge' as ResolutionStrategy,
      winner: 'local' as const,
      mergedFields: [],
      resolvedAt: Date.now(),
    };

    const validation = validateResolution(invalidResolution);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle deleted entities', () => {
    const local = createMockAccount({
      deleted_at: Date.now() - 500,
      version_vector: { 'device-1': 2, 'device-2': 1 },
    });

    const remote = createMockAccount({
      deleted_at: Date.now(),
      version_vector: { 'device-1': 1, 'device-2': 2 },
    });

    const conflict = detectConflict(local, remote, 'Account');
    expect(conflict).toBeDefined();

    const resolution = resolveConflictAuto(conflict!);

    // Should handle tombstone merging
    expect(resolution.resolvedEntity.deleted_at).toBeDefined();
  });

  it('should throw on different entity IDs', () => {
    const local = createMockAccount({ id: 'acct-1' });
    const remote = createMockAccount({ id: 'acct-2' });

    expect(() => {
      detectConflict(local, remote, 'Account');
    }).toThrow('Cannot detect conflict between different entities');
  });

  it('should handle empty conflicting fields', () => {
    const timestamp = Date.now();

    const local = createMockAccount({
      version_vector: { 'device-1': 2, 'device-2': 1 },
      updated_at: timestamp,
      // All fields identical
    });

    const remote = createMockAccount({
      version_vector: { 'device-1': 1, 'device-2': 2 },
      updated_at: timestamp,
      // All fields identical
    });

    const conflict = detectConflict(local, remote, 'Account');

    if (conflict) {
      expect(conflict.conflictingFields.length).toBe(0);
      expect(conflict.severity).toBe('low');
    }
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should detect 1000 conflicts efficiently', () => {
    const localEntities = [];
    const remoteEntities = [];

    for (let i = 0; i < 1000; i++) {
      localEntities.push(
        createMockAccount({
          id: `acct-${i}`,
          version_vector: { 'device-1': 2, 'device-2': 1 },
        })
      );

      remoteEntities.push(
        createMockAccount({
          id: `acct-${i}`,
          version_vector: { 'device-1': 1, 'device-2': 2 },
        })
      );
    }

    const startTime = Date.now();
    const conflicts = detectConflictsBatch(localEntities, remoteEntities, 'Account');
    const duration = Date.now() - startTime;

    expect(conflicts.length).toBe(1000);
    expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
  });

  it('should resolve 1000 conflicts efficiently', () => {
    const conflicts: DetectedConflict<Account & CRDTEntity>[] = [];

    for (let i = 0; i < 1000; i++) {
      const local = createMockAccount({
        id: `acct-${i}`,
        version_vector: { 'device-1': 2, 'device-2': 1 },
      });

      const remote = createMockAccount({
        id: `acct-${i}`,
        version_vector: { 'device-1': 1, 'device-2': 2 },
      });

      const conflict = detectConflict(local, remote, 'Account');
      if (conflict) conflicts.push(conflict);
    }

    const startTime = Date.now();
    const result = resolveConflictsBatch(conflicts);
    const duration = Date.now() - startTime;

    expect(result.resolved.length).toBe(1000);
    expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds
  });
});
