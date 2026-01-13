/**
 * Tests for Conflict Resolution
 */

import { describe, it, expect } from 'vitest';
import {
  resolveEntityConflict,
  mergeEntities_Batch,
  applyRemoteChanges,
  ConflictStrategy,
  needsSync,
  getEntitiesToSync,
} from './conflictResolution';
import type { CRDTEntity } from '../db/crdt';

describe('Conflict Resolution', () => {
  describe('resolveEntityConflict', () => {
    const createEntity = (
      id: string,
      updatedAt: number,
      versionVector: Record<string, number>
    ): CRDTEntity => ({
      id,
      created_at: 1000,
      updated_at: updatedAt,
      deleted_at: null,
      version_vector: versionVector,
    });

    it('should prefer remote when local is before', () => {
      const local = createEntity('entity-1', 2000, { device1: 1 });
      const remote = createEntity('entity-1', 3000, { device1: 2 });

      const result = resolveEntityConflict(local, remote, ConflictStrategy.AUTO);

      expect(result.winner).toBe('remote');
      expect(result.conflict_detected).toBe(false);
    });

    it('should prefer local when local is after', () => {
      const local = createEntity('entity-1', 3000, { device1: 2 });
      const remote = createEntity('entity-1', 2000, { device1: 1 });

      const result = resolveEntityConflict(local, remote, ConflictStrategy.AUTO);

      expect(result.winner).toBe('local');
      expect(result.conflict_detected).toBe(false);
    });

    it('should detect concurrent modification', () => {
      const local = createEntity('entity-1', 2000, { device1: 2, device2: 1 });
      const remote = createEntity('entity-1', 2100, { device1: 1, device2: 2 });

      const result = resolveEntityConflict(local, remote, ConflictStrategy.AUTO);

      expect(result.conflict_detected).toBe(true);
      expect(result.strategy_used).toBe(ConflictStrategy.AUTO);
    });

    it('should use Last-Write-Wins for AUTO strategy', () => {
      const local = createEntity('entity-1', 2000, { device1: 2, device2: 1 });
      const remote = createEntity('entity-1', 2100, { device1: 1, device2: 2 });

      const result = resolveEntityConflict(local, remote, ConflictStrategy.AUTO);

      // Remote has later timestamp
      expect(result.winner).toBe('remote');
      expect(result.resolved.updated_at).toBe(2100);
    });

    it('should prefer local for LOCAL_WINS strategy', () => {
      const local = createEntity('entity-1', 2000, { device1: 2, device2: 1 });
      const remote = createEntity('entity-1', 2100, { device1: 1, device2: 2 });

      const result = resolveEntityConflict(local, remote, ConflictStrategy.LOCAL_WINS);

      expect(result.winner).toBe('local');
    });

    it('should prefer remote for REMOTE_WINS strategy', () => {
      const local = createEntity('entity-1', 2000, { device1: 2, device2: 1 });
      const remote = createEntity('entity-1', 2100, { device1: 1, device2: 2 });

      const result = resolveEntityConflict(local, remote, ConflictStrategy.REMOTE_WINS);

      expect(result.winner).toBe('remote');
    });

    it('should merge version vectors', () => {
      const local = createEntity('entity-1', 2000, { device1: 2, device2: 1 });
      const remote = createEntity('entity-1', 2100, { device1: 1, device2: 2 });

      const result = resolveEntityConflict(local, remote, ConflictStrategy.AUTO);

      // Version vectors should be merged
      expect(result.resolved.version_vector.device1).toBe(2);
      expect(result.resolved.version_vector.device2).toBe(2);
    });
  });

  describe('mergeEntities_Batch', () => {
    const createEntity = (
      id: string,
      updatedAt: number,
      versionVector: Record<string, number>
    ): CRDTEntity => ({
      id,
      created_at: 1000,
      updated_at: updatedAt,
      deleted_at: null,
      version_vector: versionVector,
    });

    it('should merge entities from both sources', () => {
      const local = [
        createEntity('entity-1', 2000, { device1: 1 }),
        createEntity('entity-2', 2000, { device1: 1 }),
      ];

      const remote = [
        createEntity('entity-2', 3000, { device2: 1 }),
        createEntity('entity-3', 2000, { device2: 1 }),
      ];

      const result = mergeEntities_Batch(local, remote, ConflictStrategy.AUTO);

      expect(result.merged).toHaveLength(3);
      expect(result.merged.find(e => e.id === 'entity-1')).toBeDefined();
      expect(result.merged.find(e => e.id === 'entity-2')).toBeDefined();
      expect(result.merged.find(e => e.id === 'entity-3')).toBeDefined();
    });

    it('should track statistics', () => {
      const local = [
        createEntity('entity-1', 2000, { device1: 2, device2: 1 }),
      ];

      const remote = [
        createEntity('entity-1', 2100, { device1: 1, device2: 2 }),
        createEntity('entity-2', 2000, { device2: 1 }),
      ];

      const result = mergeEntities_Batch(local, remote, ConflictStrategy.AUTO);

      expect(result.conflicts_detected).toBeGreaterThan(0);
      expect(result.conflicts_resolved).toBeGreaterThan(0);
    });
  });

  describe('applyRemoteChanges', () => {
    const createEntity = (
      id: string,
      updatedAt: number,
      versionVector: Record<string, number>
    ): CRDTEntity => ({
      id,
      created_at: 1000,
      updated_at: updatedAt,
      deleted_at: null,
      version_vector: versionVector,
    });

    it('should create new entities from remote', () => {
      const local = new Map<string, CRDTEntity>();
      const remote = [
        createEntity('entity-1', 2000, { device2: 1 }),
      ];

      const result = applyRemoteChanges(local, remote, ConflictStrategy.AUTO);

      expect(result.created).toHaveLength(1);
      expect(result.created[0]?.id).toBe('entity-1');
      expect(result.updated).toHaveLength(0);
    });

    it('should update existing entities', () => {
      const local = new Map<string, CRDTEntity>([
        ['entity-1', createEntity('entity-1', 2000, { device1: 1 })],
      ]);

      const remote = [
        createEntity('entity-1', 3000, { device2: 1 }),
      ];

      const result = applyRemoteChanges(local, remote, ConflictStrategy.AUTO);

      expect(result.updated).toHaveLength(1);
      expect(result.created).toHaveLength(0);
    });

    it('should detect conflicts', () => {
      const local = new Map<string, CRDTEntity>([
        ['entity-1', createEntity('entity-1', 2000, { device1: 2, device2: 1 })],
      ]);

      const remote = [
        createEntity('entity-1', 2100, { device1: 1, device2: 2 }),
      ];

      const result = applyRemoteChanges(local, remote, ConflictStrategy.AUTO);

      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe('needsSync', () => {
    it('should return true if entity updated after last sync', () => {
      const entity: CRDTEntity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 3000,
        deleted_at: null,
        version_vector: {},
      };

      expect(needsSync(entity, 2000)).toBe(true);
    });

    it('should return false if entity updated before last sync', () => {
      const entity: CRDTEntity = {
        id: 'entity-1',
        created_at: 1000,
        updated_at: 1500,
        deleted_at: null,
        version_vector: {},
      };

      expect(needsSync(entity, 2000)).toBe(false);
    });
  });

  describe('getEntitiesToSync', () => {
    it('should filter entities that need sync', () => {
      const entities: CRDTEntity[] = [
        {
          id: 'entity-1',
          created_at: 1000,
          updated_at: 3000,
          deleted_at: null,
          version_vector: {},
        },
        {
          id: 'entity-2',
          created_at: 1000,
          updated_at: 1500,
          deleted_at: null,
          version_vector: {},
        },
        {
          id: 'entity-3',
          created_at: 1000,
          updated_at: 2500,
          deleted_at: null,
          version_vector: {},
        },
      ];

      const toSync = getEntitiesToSync(entities, 2000);

      expect(toSync).toHaveLength(2);
      expect(toSync.find(e => e.id === 'entity-1')).toBeDefined();
      expect(toSync.find(e => e.id === 'entity-3')).toBeDefined();
    });
  });
});
