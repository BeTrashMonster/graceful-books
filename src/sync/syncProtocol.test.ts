/**
 * Tests for Sync Protocol
 */

import { describe, it, expect } from 'vitest';
import {
  createPushRequest,
  createPullRequest,
  createAckMessage,
  createErrorMessage,
  validatePushRequest,
  validatePullRequest,
  validatePushResponse,
  validatePullResponse,
  batchChanges,
  detectConflicts,
  SYNC_PROTOCOL_VERSION,
} from './syncProtocol';
import type { SyncChange } from './syncProtocol';
import { SyncEntityType, SyncOperationType } from './syncQueue';

describe('Sync Protocol', () => {
  describe('createPushRequest', () => {
    it('should create valid push request', () => {
      const changes: SyncChange[] = [
        {
          id: 'change-1',
          entity_type: SyncEntityType.ACCOUNT,
          entity_id: 'account-1',
          operation: SyncOperationType.CREATE,
          encrypted_payload: 'encrypted-data',
          version_vector: { device1: 1 },
          timestamp: Date.now(),
        },
      ];

      const request = createPushRequest('device-1', changes);

      expect(request.protocol_version).toBe(SYNC_PROTOCOL_VERSION);
      expect(request.device_id).toBe('device-1');
      expect(request.changes).toEqual(changes);
      expect(request.timestamp).toBeGreaterThan(0);
    });
  });

  describe('createPullRequest', () => {
    it('should create valid pull request', () => {
      const request = createPullRequest('device-1', 1000, { device1: 5 });

      expect(request.protocol_version).toBe(SYNC_PROTOCOL_VERSION);
      expect(request.device_id).toBe('device-1');
      expect(request.since_timestamp).toBe(1000);
      expect(request.sync_vector).toEqual({ device1: 5 });
    });
  });

  describe('createAckMessage', () => {
    it('should create acknowledgment message', () => {
      const ack = createAckMessage('device-1', ['change-1', 'change-2']);

      expect(ack.protocol_version).toBe(SYNC_PROTOCOL_VERSION);
      expect(ack.device_id).toBe('device-1');
      expect(ack.acknowledged_ids).toEqual(['change-1', 'change-2']);
      expect(ack.timestamp).toBeGreaterThan(0);
    });
  });

  describe('createErrorMessage', () => {
    it('should create error message', () => {
      const error = createErrorMessage('SYNC_ERROR', 'Test error message');

      expect(error.protocol_version).toBe(SYNC_PROTOCOL_VERSION);
      expect(error.error_code).toBe('SYNC_ERROR');
      expect(error.error_message).toBe('Test error message');
      expect(error.timestamp).toBeGreaterThan(0);
    });
  });

  describe('validatePushRequest', () => {
    it('should validate valid push request', () => {
      const request = createPushRequest('device-1', [
        {
          id: 'change-1',
          entity_type: SyncEntityType.ACCOUNT,
          entity_id: 'account-1',
          operation: SyncOperationType.CREATE,
          encrypted_payload: 'encrypted',
          version_vector: {},
          timestamp: Date.now(),
        },
      ]);

      expect(validatePushRequest(request)).toBe(true);
    });

    it('should reject invalid push request', () => {
      expect(validatePushRequest(null)).toBe(false);
      expect(validatePushRequest({})).toBe(false);
      expect(validatePushRequest({ protocol_version: '0.0.1' })).toBe(false);
    });

    it('should reject request with invalid changes', () => {
      const request = {
        protocol_version: SYNC_PROTOCOL_VERSION,
        device_id: 'device-1',
        timestamp: Date.now(),
        changes: [
          {
            id: 'change-1',
            // Missing required fields
          },
        ],
      };

      expect(validatePushRequest(request)).toBe(false);
    });
  });

  describe('validatePullRequest', () => {
    it('should validate valid pull request', () => {
      const request = createPullRequest('device-1', 1000, {});

      expect(validatePullRequest(request)).toBe(true);
    });

    it('should reject invalid pull request', () => {
      expect(validatePullRequest(null)).toBe(false);
      expect(validatePullRequest({})).toBe(false);
    });
  });

  describe('validatePushResponse', () => {
    it('should validate valid push response', () => {
      const response = {
        protocol_version: SYNC_PROTOCOL_VERSION,
        success: true,
        accepted: ['change-1'],
        rejected: [],
        timestamp: Date.now(),
      };

      expect(validatePushResponse(response)).toBe(true);
    });

    it('should reject invalid push response', () => {
      expect(validatePushResponse(null)).toBe(false);
      expect(validatePushResponse({})).toBe(false);
    });
  });

  describe('validatePullResponse', () => {
    it('should validate valid pull response', () => {
      const response = {
        protocol_version: SYNC_PROTOCOL_VERSION,
        changes: [],
        has_more: false,
        timestamp: Date.now(),
      };

      expect(validatePullResponse(response)).toBe(true);
    });

    it('should reject invalid pull response', () => {
      expect(validatePullResponse(null)).toBe(false);
      expect(validatePullResponse({})).toBe(false);
    });
  });

  describe('batchChanges', () => {
    it('should create single batch for small changes', () => {
      const changes: SyncChange[] = [
        {
          id: 'change-1',
          entity_type: SyncEntityType.ACCOUNT,
          entity_id: 'account-1',
          operation: SyncOperationType.CREATE,
          encrypted_payload: 'small',
          version_vector: {},
          timestamp: Date.now(),
        },
      ];

      const batches = batchChanges(changes, 10);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(1);
    });

    it('should split into multiple batches when exceeding size', () => {
      const changes: SyncChange[] = Array.from({ length: 25 }, (_, i) => ({
        id: `change-${i}`,
        entity_type: SyncEntityType.ACCOUNT,
        entity_id: `account-${i}`,
        operation: SyncOperationType.CREATE,
        encrypted_payload: 'data',
        version_vector: {},
        timestamp: Date.now(),
      }));

      const batches = batchChanges(changes, 10);

      expect(batches.length).toBeGreaterThan(1);
      expect(batches[0]).toHaveLength(10);
    });

    it('should skip changes that are too large', () => {
      const largePayload = 'x'.repeat(2 * 1024 * 1024); // 2MB

      const changes: SyncChange[] = [
        {
          id: 'change-1',
          entity_type: SyncEntityType.ACCOUNT,
          entity_id: 'account-1',
          operation: SyncOperationType.CREATE,
          encrypted_payload: largePayload,
          version_vector: {},
          timestamp: Date.now(),
        },
        {
          id: 'change-2',
          entity_type: SyncEntityType.ACCOUNT,
          entity_id: 'account-2',
          operation: SyncOperationType.CREATE,
          encrypted_payload: 'small',
          version_vector: {},
          timestamp: Date.now(),
        },
      ];

      const batches = batchChanges(changes, 10, 1024 * 1024);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(1);
      expect(batches[0]?.[0]?.id).toBe('change-2');
    });
  });

  describe('detectConflicts', () => {
    it('should detect no conflicts when entities are different', () => {
      const local: SyncChange[] = [
        {
          id: 'change-1',
          entity_type: SyncEntityType.ACCOUNT,
          entity_id: 'account-1',
          operation: SyncOperationType.CREATE,
          encrypted_payload: 'data',
          version_vector: { device1: 1 },
          timestamp: Date.now(),
        },
      ];

      const remote: SyncChange[] = [
        {
          id: 'change-2',
          entity_type: SyncEntityType.ACCOUNT,
          entity_id: 'account-2',
          operation: SyncOperationType.CREATE,
          encrypted_payload: 'data',
          version_vector: { device2: 1 },
          timestamp: Date.now(),
        },
      ];

      const conflicts = detectConflicts(local, remote);
      expect(conflicts).toHaveLength(0);
    });

    it('should detect concurrent modifications', () => {
      const local: SyncChange[] = [
        {
          id: 'change-1',
          entity_type: SyncEntityType.ACCOUNT,
          entity_id: 'account-1',
          operation: SyncOperationType.UPDATE,
          encrypted_payload: 'data1',
          version_vector: { device1: 2, device2: 1 },
          timestamp: Date.now(),
        },
      ];

      const remote: SyncChange[] = [
        {
          id: 'change-2',
          entity_type: SyncEntityType.ACCOUNT,
          entity_id: 'account-1',
          operation: SyncOperationType.UPDATE,
          encrypted_payload: 'data2',
          version_vector: { device1: 1, device2: 2 },
          timestamp: Date.now(),
        },
      ];

      const conflicts = detectConflicts(local, remote);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.conflict_type).toBe('concurrent');
    });

    it('should not detect conflict for causally ordered changes', () => {
      const local: SyncChange[] = [
        {
          id: 'change-1',
          entity_type: SyncEntityType.ACCOUNT,
          entity_id: 'account-1',
          operation: SyncOperationType.UPDATE,
          encrypted_payload: 'data1',
          version_vector: { device1: 2 },
          timestamp: Date.now(),
        },
      ];

      const remote: SyncChange[] = [
        {
          id: 'change-2',
          entity_type: SyncEntityType.ACCOUNT,
          entity_id: 'account-1',
          operation: SyncOperationType.UPDATE,
          encrypted_payload: 'data2',
          version_vector: { device1: 1 },
          timestamp: Date.now(),
        },
      ];

      const conflicts = detectConflicts(local, remote);
      expect(conflicts).toHaveLength(0);
    });
  });
});
