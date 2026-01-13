/**
 * Tests for CRDT Module
 *
 * Tests CRDT operations for offline-first multi-device sync
 */

import { describe, it, expect } from 'vitest';
import {
  mergeVersionVectors,
  incrementVersionVector,
  compareVersionVectors,
  resolveConflict,
  mergeEntities,
  detectConflicts,
  resolveAllConflicts,
  isActive,
  createTombstone,
  restoreFromTombstone,
  updateEntity,
  generateDeviceId,
  getDeviceId,
  analyzeSyncOperation,
} from './crdt';
import type { CRDTEntity } from './crdt';
import type { VersionVector } from '../types/database.types';

describe('CRDT Module', () => {
  describe('mergeVersionVectors', () => {
    it('should merge two version vectors taking maximum values', () => {
      const v1: VersionVector = { device1: 5, device2: 3 };
      const v2: VersionVector = { device1: 3, device2: 7, device3: 2 };

      const merged = mergeVersionVectors(v1, v2);

      expect(merged).toEqual({
        device1: 5,
        device2: 7,
        device3: 2,
      });
    });

    it('should handle empty version vectors', () => {
      const v1: VersionVector = {};
      const v2: VersionVector = { device1: 1 };

      const merged = mergeVersionVectors(v1, v2);

      expect(merged).toEqual({ device1: 1 });
    });

    it('should handle non-overlapping devices', () => {
      const v1: VersionVector = { device1: 5 };
      const v2: VersionVector = { device2: 3 };

      const merged = mergeVersionVectors(v1, v2);

      expect(merged).toEqual({ device1: 5, device2: 3 });
    });

    it('should not mutate input vectors', () => {
      const v1: VersionVector = { device1: 5 };
      const v2: VersionVector = { device1: 3 };

      const v1Copy = { ...v1 };
      const v2Copy = { ...v2 };

      mergeVersionVectors(v1, v2);

      expect(v1).toEqual(v1Copy);
      expect(v2).toEqual(v2Copy);
    });
  });

  describe('incrementVersionVector', () => {
    it('should increment existing device clock', () => {
      const vector: VersionVector = { device1: 5, device2: 3 };

      const incremented = incrementVersionVector(vector, 'device1');

      expect(incremented.device1).toBe(6);
      expect(incremented.device2).toBe(3);
    });

    it('should add new device with clock 1', () => {
      const vector: VersionVector = { device1: 5 };

      const incremented = incrementVersionVector(vector, 'device2');

      expect(incremented.device1).toBe(5);
      expect(incremented.device2).toBe(1);
    });

    it('should not mutate input vector', () => {
      const vector: VersionVector = { device1: 5 };
      const vectorCopy = { ...vector };

      incrementVersionVector(vector, 'device1');

      expect(vector).toEqual(vectorCopy);
    });
  });

  describe('compareVersionVectors', () => {
    it('should detect equal vectors', () => {
      const v1: VersionVector = { device1: 5, device2: 3 };
      const v2: VersionVector = { device1: 5, device2: 3 };

      expect(compareVersionVectors(v1, v2)).toBe('equal');
    });

    it('should detect when v1 is after v2', () => {
      const v1: VersionVector = { device1: 6, device2: 3 };
      const v2: VersionVector = { device1: 5, device2: 3 };

      expect(compareVersionVectors(v1, v2)).toBe('after');
    });

    it('should detect when v1 is before v2', () => {
      const v1: VersionVector = { device1: 5, device2: 3 };
      const v2: VersionVector = { device1: 6, device2: 3 };

      expect(compareVersionVectors(v1, v2)).toBe('before');
    });

    it('should detect concurrent vectors', () => {
      const v1: VersionVector = { device1: 6, device2: 2 };
      const v2: VersionVector = { device1: 5, device2: 3 };

      expect(compareVersionVectors(v1, v2)).toBe('concurrent');
    });

    it('should handle vectors with different devices', () => {
      const v1: VersionVector = { device1: 5 };
      const v2: VersionVector = { device2: 3 };

      expect(compareVersionVectors(v1, v2)).toBe('concurrent');
    });

    it('should handle empty vectors as equal', () => {
      const v1: VersionVector = {};
      const v2: VersionVector = {};

      expect(compareVersionVectors(v1, v2)).toBe('equal');
    });
  });

  describe('resolveConflict', () => {
    let baseEntity: CRDTEntity;

    beforeEach(() => {
      baseEntity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 2000,
        deleted_at: null,
        version_vector: { device1: 1 },
      };
    });

    it('should prefer non-deleted over deleted when update is newer', () => {
      const local: CRDTEntity = {
        ...baseEntity,
        deleted_at: null,
        updated_at: 3000,
      };

      const remote: CRDTEntity = {
        ...baseEntity,
        deleted_at: 2500,
        updated_at: 2500,
      };

      const winner = resolveConflict(local, remote);
      expect(winner.deleted_at).toBeNull();
    });

    it('should prefer deletion when deletion is newer', () => {
      const local: CRDTEntity = {
        ...baseEntity,
        deleted_at: null,
        updated_at: 2000,
      };

      const remote: CRDTEntity = {
        ...baseEntity,
        deleted_at: 3000,
        updated_at: 3000,
      };

      const winner = resolveConflict(local, remote);
      expect(winner.deleted_at).toBe(3000);
    });

    it('should prefer later deletion when both deleted', () => {
      const local: CRDTEntity = {
        ...baseEntity,
        deleted_at: 2500,
      };

      const remote: CRDTEntity = {
        ...baseEntity,
        deleted_at: 3000,
      };

      const winner = resolveConflict(local, remote);
      expect(winner.deleted_at).toBe(3000);
    });

    it('should use Last-Write-Wins for non-deleted entities', () => {
      const local: CRDTEntity = {
        ...baseEntity,
        updated_at: 3000,
      };

      const remote: CRDTEntity = {
        ...baseEntity,
        updated_at: 2000,
      };

      const winner = resolveConflict(local, remote);
      expect(winner.updated_at).toBe(3000);
    });

    it('should use version vector when timestamps equal', () => {
      const local: CRDTEntity = {
        ...baseEntity,
        updated_at: 3000,
        version_vector: { device1: 5 },
      };

      const remote: CRDTEntity = {
        ...baseEntity,
        updated_at: 3000,
        version_vector: { device1: 3 },
      };

      const winner = resolveConflict(local, remote);
      expect(winner.version_vector).toEqual({ device1: 5 });
    });

    it('should use ID as tie-breaker when everything else equal', () => {
      const local: CRDTEntity = {
        ...baseEntity,
        id: 'entity-b',
        updated_at: 3000,
        version_vector: { device1: 5 },
      };

      const remote: CRDTEntity = {
        ...baseEntity,
        id: 'entity-a',
        updated_at: 3000,
        version_vector: { device1: 5 },
      };

      const winner = resolveConflict(local, remote);
      expect(winner.id).toBe('entity-b'); // Lexicographically larger
    });
  });

  describe('mergeEntities', () => {
    it('should merge version vectors while keeping winner data', () => {
      const winner: CRDTEntity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 3000,
        deleted_at: null,
        version_vector: { device1: 5 },
      };

      const loser: CRDTEntity = {
        ...winner,
        updated_at: 2000,
        version_vector: { device2: 3 },
      };

      const merged = mergeEntities(winner, loser);

      expect(merged.updated_at).toBe(3000);
      expect(merged.version_vector).toEqual({ device1: 5, device2: 3 });
    });
  });

  describe('detectConflicts', () => {
    it('should detect no conflicts when entities have different IDs', () => {
      const entities: CRDTEntity[] = [
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 2000,
          deleted_at: null,
          version_vector: { device1: 1 },
        },
        {
          id: 'entity-2',
          created_at: 1000,
          updated_at: 2000,
          deleted_at: null,
          version_vector: { device1: 1 },
        },
      ];

      const conflicts = detectConflicts(entities);
      expect(conflicts).toHaveLength(0);
    });

    it('should detect concurrent modifications', () => {
      const entities: CRDTEntity[] = [
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 2000,
          deleted_at: null,
          version_vector: { device1: 2, device2: 1 },
        },
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 2100,
          deleted_at: null,
          version_vector: { device1: 1, device2: 2 },
        },
      ];

      const conflicts = detectConflicts(entities);
      expect(conflicts).toHaveLength(1);
    });

    it('should not detect conflicts for causally ordered updates', () => {
      const entities: CRDTEntity[] = [
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 2000,
          deleted_at: null,
          version_vector: { device1: 1 },
        },
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 2100,
          deleted_at: null,
          version_vector: { device1: 2 },
        },
      ];

      const conflicts = detectConflicts(entities);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('resolveAllConflicts', () => {
    it('should resolve all conflicts and deduplicate', () => {
      const entities: CRDTEntity[] = [
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 3000,
          deleted_at: null,
          version_vector: { device1: 2 },
        },
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 2000,
          deleted_at: null,
          version_vector: { device2: 1 },
        },
        {
          id: 'entity-2',
          created_at: 1000,
          updated_at: 2000,
          deleted_at: null,
          version_vector: { device1: 1 },
        },
      ];

      const resolved = resolveAllConflicts(entities);

      expect(resolved).toHaveLength(2);
      const entity1 = resolved.find((e) => e.id === 'entity-1');
      expect(entity1?.updated_at).toBe(3000);
      expect(entity1?.version_vector).toEqual({ device1: 2, device2: 1 });
    });

    it('should handle empty list', () => {
      const resolved = resolveAllConflicts([]);
      expect(resolved).toHaveLength(0);
    });
  });

  describe('isActive', () => {
    it('should return true for non-deleted entities', () => {
      const entity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 2000,
        deleted_at: null,
      };

      expect(isActive(entity)).toBe(true);
    });

    it('should return false for deleted entities', () => {
      const entity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 2000,
        deleted_at: 3000,
      };

      expect(isActive(entity)).toBe(false);
    });

    it('should return true if entity was deleted after query time', () => {
      const entity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 2000,
        deleted_at: 4000,
      };

      expect(isActive(entity, 3000)).toBe(true);
    });

    it('should return false if entity was deleted before query time', () => {
      const entity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 2000,
        deleted_at: 2500,
      };

      expect(isActive(entity, 3000)).toBe(false);
    });
  });

  describe('createTombstone', () => {
    it('should create tombstone with deleted_at timestamp', () => {
      const entity: CRDTEntity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 2000,
        deleted_at: null,
        version_vector: { device1: 1 },
      };

      const tombstone = createTombstone(entity, 'device1');

      expect(tombstone.deleted_at).toBeGreaterThan(0);
      expect(tombstone.version_vector.device1).toBe(2);
    });

    it('should update version vector', () => {
      const entity: CRDTEntity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 2000,
        deleted_at: null,
        version_vector: { device1: 5 },
      };

      const tombstone = createTombstone(entity, 'device1');

      expect(tombstone.version_vector.device1).toBe(6);
    });
  });

  describe('restoreFromTombstone', () => {
    it('should restore deleted entity', () => {
      const entity: CRDTEntity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 2000,
        deleted_at: 3000,
        version_vector: { device1: 2 },
      };

      const restored = restoreFromTombstone(entity, 'device1');

      expect(restored.deleted_at).toBeNull();
      expect(restored.updated_at).toBeGreaterThan(3000);
      expect(restored.version_vector.device1).toBe(3);
    });
  });

  describe('updateEntity', () => {
    it('should update entity with new timestamp and version', () => {
      const entity: CRDTEntity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 2000,
        deleted_at: null,
        version_vector: { device1: 1 },
      };

      const updated = updateEntity(entity, {}, 'device1');

      expect(updated.updated_at).toBeGreaterThan(2000);
      expect(updated.version_vector.device1).toBe(2);
    });

    it('should apply updates to entity', () => {
      const entity: CRDTEntity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 2000,
        deleted_at: null,
        version_vector: { device1: 1 },
      };

      const updated = updateEntity(entity, { id: 'should-not-change' }, 'device1');

      expect(updated.id).toBe('entity-1'); // ID should not change from updates
    });
  });

  describe('generateDeviceId', () => {
    it('should generate a device ID', () => {
      const deviceId = generateDeviceId();

      expect(typeof deviceId).toBe('string');
      expect(deviceId.length).toBeGreaterThan(0);
    });

    it('should generate unique device IDs', () => {
      const id1 = generateDeviceId();
      const id2 = generateDeviceId();

      expect(id1).not.toBe(id2);
    });

    it('should generate alphanumeric IDs', () => {
      const deviceId = generateDeviceId();

      expect(/^[a-zA-Z0-9]+$/.test(deviceId)).toBe(true);
    });
  });

  describe('getDeviceId', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should get existing device ID from localStorage', () => {
      localStorage.setItem('graceful_books_device_id', 'test-device-123');

      const deviceId = getDeviceId();
      expect(deviceId).toBe('test-device-123');
    });

    it('should generate and store new device ID if not exists', () => {
      const deviceId = getDeviceId();

      expect(typeof deviceId).toBe('string');
      expect(deviceId.length).toBeGreaterThan(0);
      expect(localStorage.getItem('graceful_books_device_id')).toBe(deviceId);
    });

    it('should return same device ID on subsequent calls', () => {
      const id1 = getDeviceId();
      const id2 = getDeviceId();

      expect(id1).toBe(id2);
    });
  });

  describe('analyzeSyncOperation', () => {
    it('should analyze sync with no conflicts', () => {
      const local: CRDTEntity[] = [
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 2000,
          deleted_at: null,
          version_vector: { device1: 1 },
        },
      ];

      const remote: CRDTEntity[] = [
        {
          id: 'entity-2',
          created_at: 1000,
          updated_at: 2000,
          deleted_at: null,
          version_vector: { device2: 1 },
        },
      ];

      const stats = analyzeSyncOperation(local, remote);

      expect(stats.conflicts_detected).toBe(0);
      expect(stats.total_entities).toBe(2);
      expect(stats.entities_created).toBe(1);
    });

    it('should detect and count conflicts', () => {
      const local: CRDTEntity[] = [
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 2000,
          deleted_at: null,
          version_vector: { device1: 2, device2: 1 },
        },
      ];

      const remote: CRDTEntity[] = [
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 2100,
          deleted_at: null,
          version_vector: { device1: 1, device2: 2 },
        },
      ];

      const stats = analyzeSyncOperation(local, remote);

      expect(stats.conflicts_detected).toBe(1);
      expect(stats.conflicts_resolved).toBe(1);
    });

    it('should count deletions', () => {
      const local: CRDTEntity[] = [
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 2000,
          deleted_at: 2500,
          version_vector: { device1: 2 },
        },
      ];

      const remote: CRDTEntity[] = [];

      const stats = analyzeSyncOperation(local, remote);

      expect(stats.entities_deleted).toBe(1);
    });

    it('should handle empty sync', () => {
      const stats = analyzeSyncOperation([], []);

      expect(stats.total_entities).toBe(0);
      expect(stats.conflicts_detected).toBe(0);
    });
  });
});
