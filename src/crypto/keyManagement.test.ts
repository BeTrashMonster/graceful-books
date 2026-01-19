/**
 * Tests for Key Management Module
 *
 * Tests key derivation, permission hierarchy, key rotation, and related
 * cryptographic operations for the H1 Multi-User implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  deriveKey,
  deriveAllKeys,
  createEncryptionContext,
  clearEncryptionContext,
  getKeyForPermission,
  hasPermission,
  rotateKeys,
  reencryptData,
  createKeyStorageMetadata,
  checkKeyRotationNeeded,
  exportKeysForBackup,
  getPermissionHierarchy,
} from './keyManagement';
import type {
  MasterKey,
  DerivedKey,
  PermissionLevel,
  EncryptionContext,
  KeyRotationRequest,
} from './types';

// Mock the encryption module
vi.mock('./encryption', () => ({
  encrypt: vi.fn((data, key) =>
    Promise.resolve({
      success: true,
      data: {
        ciphertext: new Uint8Array([1, 2, 3]),
        iv: new Uint8Array([4, 5, 6]),
        authTag: new Uint8Array([7, 8, 9]),
        keyId: typeof key === 'object' && 'id' in key ? key.id : 'key-id',
        algorithm: 'AES-256-GCM' as const,
        encryptedAt: Date.now(),
      },
    })
  ),
  reencrypt: vi.fn((data, oldKey, newKey) =>
    Promise.resolve({
      success: true,
      data: {
        ciphertext: new Uint8Array([10, 11, 12]),
        iv: new Uint8Array([13, 14, 15]),
        authTag: new Uint8Array([16, 17, 18]),
        keyId: typeof newKey === 'object' && 'id' in newKey ? newKey.id : 'new-key-id',
        algorithm: 'AES-256-GCM' as const,
        encryptedAt: Date.now(),
      },
    })
  ),
}));

vi.mock('./keyDerivation', () => ({
  clearMasterKey: vi.fn(),
  clearSensitiveData: vi.fn(),
}));

describe('Key Management', () => {
  let mockMasterKey: MasterKey;

  beforeEach(() => {
    // Create a mock master key for testing
    mockMasterKey = {
      id: 'master-key-123',
      keyMaterial: new Uint8Array(32).fill(1),
      derivationParams: {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        salt: new Uint8Array(16).fill(2),
        keyLength: 32,
      },
      createdAt: Date.now(),
    };
  });

  describe('deriveKey', () => {
    it('should derive key for admin permission level', async () => {
      const result = await deriveKey(mockMasterKey, 'admin');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.permissionLevel).toBe('admin');
      expect(result.data?.masterKeyId).toBe(mockMasterKey.id);
      expect(result.data?.keyMaterial).toBeInstanceOf(Uint8Array);
      expect(result.data?.keyMaterial.length).toBe(32);
    });

    it('should derive unique keys for different permission levels', async () => {
      const adminResult = await deriveKey(mockMasterKey, 'admin');
      const userResult = await deriveKey(mockMasterKey, 'user');

      expect(adminResult.success).toBe(true);
      expect(userResult.success).toBe(true);
      expect(adminResult.data?.id).not.toBe(userResult.data?.id);
    });

    it('should set creation timestamp', async () => {
      const before = Date.now();
      const result = await deriveKey(mockMasterKey, 'manager');
      const after = Date.now();

      expect(result.success).toBe(true);
      expect(result.data?.createdAt).toBeGreaterThanOrEqual(before);
      expect(result.data?.createdAt).toBeLessThanOrEqual(after);
    });

    it('should support optional expiration', async () => {
      const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000; // 90 days
      const result = await deriveKey(mockMasterKey, 'consultant', expiresAt);

      expect(result.success).toBe(true);
      expect(result.data?.expiresAt).toBe(expiresAt);
    });

    it('should derive keys for all permission levels', async () => {
      const levels: PermissionLevel[] = ['admin', 'manager', 'accountant', 'user', 'consultant'];

      for (const level of levels) {
        const result = await deriveKey(mockMasterKey, level);
        expect(result.success).toBe(true);
        expect(result.data?.permissionLevel).toBe(level);
      }
    });

    it('should generate unique key IDs', async () => {
      const result1 = await deriveKey(mockMasterKey, 'admin');
      const result2 = await deriveKey(mockMasterKey, 'admin');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Keys should have different IDs due to random salt
      expect(result1.data?.id).not.toBe(result2.data?.id);
    });
  });

  describe('deriveAllKeys', () => {
    it('should derive keys for all permission levels', async () => {
      const result = await deriveAllKeys(mockMasterKey);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Map);
      expect(result.data?.size).toBe(5);
      expect(result.data?.has('admin')).toBe(true);
      expect(result.data?.has('manager')).toBe(true);
      expect(result.data?.has('accountant')).toBe(true);
      expect(result.data?.has('user')).toBe(true);
      expect(result.data?.has('consultant')).toBe(true);
    });

    it('should set expiration for all keys', async () => {
      const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
      const result = await deriveAllKeys(mockMasterKey, expiresAt);

      expect(result.success).toBe(true);
      if (result.data) {
        for (const [_, key] of result.data) {
          expect(key.expiresAt).toBe(expiresAt);
        }
      }
    });

    it('should link all derived keys to master key', async () => {
      const result = await deriveAllKeys(mockMasterKey);

      expect(result.success).toBe(true);
      if (result.data) {
        for (const [_, key] of result.data) {
          expect(key.masterKeyId).toBe(mockMasterKey.id);
        }
      }
    });
  });

  describe('createEncryptionContext', () => {
    it('should create encryption context with all keys', async () => {
      const sessionId = 'session-123';
      const result = await createEncryptionContext(mockMasterKey, sessionId);

      expect(result.success).toBe(true);
      expect(result.data?.masterKey).toBe(mockMasterKey);
      expect(result.data?.derivedKeys).toBeInstanceOf(Map);
      expect(result.data?.derivedKeys.size).toBe(5);
      expect(result.data?.sessionId).toBe(sessionId);
      expect(result.data?.sessionStartedAt).toBeTypeOf('number');
    });

    it('should set session start timestamp', async () => {
      const before = Date.now();
      const result = await createEncryptionContext(mockMasterKey, 'session-1');
      const after = Date.now();

      expect(result.success).toBe(true);
      expect(result.data?.sessionStartedAt).toBeGreaterThanOrEqual(before);
      expect(result.data?.sessionStartedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('clearEncryptionContext', () => {
    it('should clear all keys from context', async () => {
      const contextResult = await createEncryptionContext(mockMasterKey, 'session-1');
      expect(contextResult.success).toBe(true);

      if (contextResult.data) {
        const initialSize = contextResult.data.derivedKeys.size;
        expect(initialSize).toBe(5);

        clearEncryptionContext(contextResult.data);

        expect(contextResult.data.derivedKeys.size).toBe(0);
      }
    });
  });

  describe('getKeyForPermission', () => {
    let context: EncryptionContext;

    beforeEach(async () => {
      const result = await createEncryptionContext(mockMasterKey, 'session-1');
      if (!result.success || !result.data) {
        throw new Error('Failed to create encryption context for test');
      }
      context = result.data;
    });

    it('should return key for valid permission level', () => {
      const result = getKeyForPermission(context, 'admin');

      expect(result.success).toBe(true);
      expect(result.data?.permissionLevel).toBe('admin');
    });

    it('should return error for invalid permission level', () => {
      // Remove a key to test error case
      context.derivedKeys.delete('consultant');

      const result = getKeyForPermission(context, 'consultant');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No key found');
    });

    it('should check key expiration', () => {
      const expiredKey: DerivedKey = {
        id: 'expired-key',
        masterKeyId: mockMasterKey.id,
        permissionLevel: 'user',
        keyMaterial: new Uint8Array(32),
        createdAt: Date.now() - 1000000,
        expiresAt: Date.now() - 1000, // Expired
      };

      context.derivedKeys.set('user', expiredKey);

      const result = getKeyForPermission(context, 'user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
      expect(result.errorCode).toBe('KEY_EXPIRED');
    });

    it('should return all permission levels', () => {
      const levels: PermissionLevel[] = ['admin', 'manager', 'accountant', 'user', 'consultant'];

      levels.forEach(level => {
        const result = getKeyForPermission(context, level);
        expect(result.success).toBe(true);
        expect(result.data?.permissionLevel).toBe(level);
      });
    });
  });

  describe('hasPermission', () => {
    it('should return true for same permission level', () => {
      expect(hasPermission('admin', 'admin')).toBe(true);
      expect(hasPermission('user', 'user')).toBe(true);
      expect(hasPermission('consultant', 'consultant')).toBe(true);
    });

    it('should return true for higher permission accessing lower', () => {
      expect(hasPermission('admin', 'manager')).toBe(true);
      expect(hasPermission('admin', 'user')).toBe(true);
      expect(hasPermission('manager', 'accountant')).toBe(true);
      expect(hasPermission('accountant', 'consultant')).toBe(true);
    });

    it('should return false for lower permission accessing higher', () => {
      expect(hasPermission('manager', 'admin')).toBe(false);
      expect(hasPermission('user', 'admin')).toBe(false);
      expect(hasPermission('consultant', 'accountant')).toBe(false);
      expect(hasPermission('accountant', 'manager')).toBe(false);
    });

    it('should enforce complete permission hierarchy', () => {
      const hierarchy: PermissionLevel[] = ['admin', 'manager', 'accountant', 'user', 'consultant'];

      for (let i = 0; i < hierarchy.length; i++) {
        for (let j = 0; j < hierarchy.length; j++) {
          const result = hasPermission(hierarchy[i], hierarchy[j]);
          expect(result).toBe(i <= j);
        }
      }
    });
  });

  describe('rotateKeys', () => {
    let oldContext: EncryptionContext;
    let newMasterKey: MasterKey;

    beforeEach(async () => {
      const result = await createEncryptionContext(mockMasterKey, 'session-1');
      if (!result.success || !result.data) {
        throw new Error('Failed to create encryption context for test');
      }
      oldContext = result.data;

      newMasterKey = {
        id: 'new-master-key-456',
        keyMaterial: new Uint8Array(32).fill(3),
        derivationParams: {
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
          salt: new Uint8Array(16).fill(4),
          keyLength: 32,
        },
        createdAt: Date.now(),
      };
    });

    it('should rotate keys successfully', async () => {
      const request: KeyRotationRequest = {
        oldMasterKeyId: mockMasterKey.id,
        reason: 'scheduled',
        initiatedAt: Date.now(),
      };

      const result = await rotateKeys(oldContext, newMasterKey, request);

      expect(result.success).toBe(true);
      expect(result.data?.newMasterKeyId).toBe(newMasterKey.id);
      expect(result.data?.newDerivedKeyIds).toHaveLength(5);
      expect(result.data?.durationMs).toBeTypeOf('number');
    });

    it('should complete rotation within reasonable time', async () => {
      const request: KeyRotationRequest = {
        oldMasterKeyId: mockMasterKey.id,
        reason: 'scheduled',
        initiatedAt: Date.now(),
      };

      const result = await rotateKeys(oldContext, newMasterKey, request);

      expect(result.success).toBe(true);
      expect(result.data?.durationMs).toBeLessThan(5000); // Should be fast in tests
    });

    it('should reject rotation with mismatched old key ID', async () => {
      const request: KeyRotationRequest = {
        oldMasterKeyId: 'wrong-key-id',
        reason: 'scheduled',
        initiatedAt: Date.now(),
      };

      const result = await rotateKeys(oldContext, newMasterKey, request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('mismatch');
      expect(result.errorCode).toBe('INVALID_KEY');
    });

    it('should support all rotation reasons', async () => {
      const reasons: Array<'scheduled' | 'security_incident' | 'user_revocation'> = [
        'scheduled',
        'security_incident',
        'user_revocation',
      ];

      for (const reason of reasons) {
        const request: KeyRotationRequest = {
          oldMasterKeyId: mockMasterKey.id,
          reason,
          initiatedAt: Date.now(),
        };

        const result = await rotateKeys(oldContext, newMasterKey, request);
        expect(result.success).toBe(true);
      }
    });

    it('should include revoked user ID when provided', async () => {
      const request: KeyRotationRequest = {
        oldMasterKeyId: mockMasterKey.id,
        reason: 'user_revocation',
        revokedUserId: 'user-to-revoke',
        initiatedAt: Date.now(),
      };

      const result = await rotateKeys(oldContext, newMasterKey, request);

      expect(result.success).toBe(true);
    });
  });

  describe('reencryptData', () => {
    let oldContext: EncryptionContext;
    let newContext: EncryptionContext;

    beforeEach(async () => {
      const oldResult = await createEncryptionContext(mockMasterKey, 'session-1');
      if (!oldResult.success || !oldResult.data) {
        throw new Error('Failed to create old encryption context for test');
      }
      oldContext = oldResult.data;

      const newMasterKey: MasterKey = {
        id: 'new-master-key-789',
        keyMaterial: new Uint8Array(32).fill(5),
        derivationParams: {
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
          salt: new Uint8Array(16).fill(6),
          keyLength: 32,
        },
        createdAt: Date.now(),
      };

      const newResult = await createEncryptionContext(newMasterKey, 'session-2');
      if (!newResult.success || !newResult.data) {
        throw new Error('Failed to create new encryption context for test');
      }
      newContext = newResult.data;
    });

    it('should reencrypt data with new keys', async () => {
      const encryptedData = [{ data: 'encrypted1' }, { data: 'encrypted2' }];

      const result = await reencryptData(oldContext, newContext, encryptedData, 'manager');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should handle empty data array', async () => {
      const result = await reencryptData(oldContext, newContext, [], 'admin');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should work with different permission levels', async () => {
      const levels: PermissionLevel[] = ['admin', 'manager', 'accountant', 'user', 'consultant'];
      const encryptedData = [{ data: 'test' }];

      for (const level of levels) {
        const result = await reencryptData(oldContext, newContext, encryptedData, level);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('createKeyStorageMetadata', () => {
    it('should create metadata for master key', () => {
      const encryptedMaterial = 'encrypted-key-material';
      const metadata = createKeyStorageMetadata(mockMasterKey, encryptedMaterial);

      expect(metadata.keyId).toBe(mockMasterKey.id);
      expect(metadata.keyType).toBe('master');
      expect(metadata.encryptedKeyMaterial).toBe(encryptedMaterial);
      expect(metadata.createdAt).toBe(mockMasterKey.createdAt);
      expect(metadata.isActive).toBe(true);
      expect(metadata.permissionLevel).toBeUndefined();
    });

    it('should create metadata for derived key', async () => {
      const derivedKeyResult = await deriveKey(mockMasterKey, 'manager');
      expect(derivedKeyResult.success).toBe(true);

      if (derivedKeyResult.data) {
        const encryptedMaterial = 'encrypted-derived-key';
        const metadata = createKeyStorageMetadata(derivedKeyResult.data, encryptedMaterial);

        expect(metadata.keyId).toBe(derivedKeyResult.data.id);
        expect(metadata.keyType).toBe('derived');
        expect(metadata.permissionLevel).toBe('manager');
        expect(metadata.encryptedKeyMaterial).toBe(encryptedMaterial);
        expect(metadata.isActive).toBe(true);
      }
    });

    it('should include expiration when provided', () => {
      const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
      const keyWithExpiration: MasterKey = {
        ...mockMasterKey,
        expiresAt,
      };

      const metadata = createKeyStorageMetadata(keyWithExpiration, 'encrypted');

      expect(metadata.expiresAt).toBe(expiresAt);
    });
  });

  describe('checkKeyRotationNeeded', () => {
    let context: EncryptionContext;

    beforeEach(async () => {
      const result = await createEncryptionContext(mockMasterKey, 'session-1');
      if (!result.success || !result.data) {
        throw new Error('Failed to create encryption context for test');
      }
      context = result.data;
    });

    it('should return none urgency for keys without expiration', () => {
      const check = checkKeyRotationNeeded(context);

      expect(check.needsRotation).toBe(false);
      expect(check.urgency).toBe('none');
    });

    it('should return critical for expired master key', () => {
      context.masterKey.expiresAt = Date.now() - 1000;

      const check = checkKeyRotationNeeded(context);

      expect(check.needsRotation).toBe(true);
      expect(check.urgency).toBe('critical');
      expect(check.reason).toContain('expired');
    });

    it('should return warning for master key expiring within threshold', () => {
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      context.masterKey.expiresAt = Date.now() + threeDays;

      const check = checkKeyRotationNeeded(context, 7 * 24 * 60 * 60 * 1000);

      expect(check.needsRotation).toBe(true);
      expect(check.urgency).toBe('warning');
      expect(check.reason).toContain('expires soon');
    });

    it('should return urgent for master key expiring within 1 day', () => {
      const halfDay = 12 * 60 * 60 * 1000;
      context.masterKey.expiresAt = Date.now() + halfDay;

      const check = checkKeyRotationNeeded(context, 7 * 24 * 60 * 60 * 1000);

      expect(check.needsRotation).toBe(true);
      expect(check.urgency).toBe('urgent');
    });

    it('should check derived keys for expiration', () => {
      const expiredKey: DerivedKey = {
        id: 'expired-key',
        masterKeyId: mockMasterKey.id,
        permissionLevel: 'consultant',
        keyMaterial: new Uint8Array(32),
        createdAt: Date.now() - 1000000,
        expiresAt: Date.now() - 1000,
      };

      context.derivedKeys.set('consultant', expiredKey);

      const check = checkKeyRotationNeeded(context);

      expect(check.needsRotation).toBe(true);
      expect(check.urgency).toBe('critical');
      expect(check.reason).toContain('consultant');
    });

    it('should allow custom warning threshold', () => {
      const twoDays = 2 * 24 * 60 * 60 * 1000;
      context.masterKey.expiresAt = Date.now() + twoDays;

      const check1 = checkKeyRotationNeeded(context, 1 * 24 * 60 * 60 * 1000);
      const check2 = checkKeyRotationNeeded(context, 3 * 24 * 60 * 60 * 1000);

      expect(check1.needsRotation).toBe(false);
      expect(check2.needsRotation).toBe(true);
    });
  });

  describe('exportKeysForBackup', () => {
    let context: EncryptionContext;
    let backupKey: MasterKey;

    beforeEach(async () => {
      const result = await createEncryptionContext(mockMasterKey, 'session-1');
      if (!result.success || !result.data) {
        throw new Error('Failed to create encryption context for test');
      }
      context = result.data;

      backupKey = {
        id: 'backup-key-123',
        keyMaterial: new Uint8Array(32).fill(7),
        derivationParams: {
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
          salt: new Uint8Array(16).fill(8),
          keyLength: 32,
        },
        createdAt: Date.now(),
      };
    });

    it('should export keys as encrypted backup', async () => {
      const result = await exportKeysForBackup(context, backupKey);

      expect(result.success).toBe(true);
      expect(result.data).toBeTypeOf('string');
    });

    it('should create valid JSON backup', async () => {
      const result = await exportKeysForBackup(context, backupKey);

      expect(result.success).toBe(true);
      if (result.data) {
        expect(() => JSON.parse(result.data)).not.toThrow();
      }
    });
  });

  describe('getPermissionHierarchy', () => {
    it('should return permission hierarchy in correct order', () => {
      const hierarchy = getPermissionHierarchy();

      expect(hierarchy).toEqual(['admin', 'manager', 'accountant', 'user', 'consultant']);
    });

    it('should return a copy of the hierarchy', () => {
      const hierarchy1 = getPermissionHierarchy();
      const hierarchy2 = getPermissionHierarchy();

      expect(hierarchy1).toEqual(hierarchy2);
      expect(hierarchy1).not.toBe(hierarchy2); // Different array instances
    });

    it('should maintain hierarchy order', () => {
      const hierarchy = getPermissionHierarchy();

      expect(hierarchy[0]).toBe('admin');
      expect(hierarchy[hierarchy.length - 1]).toBe('consultant');
    });
  });
});
