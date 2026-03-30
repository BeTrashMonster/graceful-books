/**
 * HMAC Integrity Verification Tests
 *
 * Comprehensive test suite for backup integrity verification system.
 * Tests all security requirements from ROADMAP_BACKUP_AND_SYNC.md Task 1.6.
 *
 * Test Coverage:
 * - HMAC generation and verification
 * - Tamper detection (metadata, data, keys)
 * - Constant-time comparison
 * - Password-based key derivation
 * - Privilege escalation prevention
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveHmacKey,
  generateBackupHMAC,
  verifyBackupIntegrity,
  constantTimeCompare,
  generateHmacSalt,
  createSecureBackupBundle,
  type SecureBackupBundle,
} from './IntegrityVerification';

describe('IntegrityVerification', () => {
  // Sample test data
  const testPassword = 'test-password-strong-123';
  const testMetadata: SecureBackupBundle['metadata'] = {
    companyId: 'company-123',
    userId: 'user-456',
    permissions: 'Admin',
    timestamp: Date.now(),
    keyRotationEpoch: 1,
  };

  const testEncryptedData: SecureBackupBundle['encryptedData'] = {
    transactions: 'encrypted-transactions-data',
    accounts: 'encrypted-accounts-data',
    reports: 'encrypted-reports-data',
    preferences: 'encrypted-preferences-data',
  };

  const testEncryptedKeys: SecureBackupBundle['encryptedKeys'] = {
    derivedKey: 'encrypted-derived-key',
    salt: 'base64-salt-value',
    iterations: 3,
  };

  describe('generateHmacSalt', () => {
    it('should generate a 32-byte base64-encoded salt', () => {
      const salt = generateHmacSalt();

      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBeGreaterThan(0);

      // Decode and verify length
      const decoded = atob(salt);
      expect(decoded.length).toBe(32);
    });

    it('should generate unique salts', () => {
      const salt1 = generateHmacSalt();
      const salt2 = generateHmacSalt();
      const salt3 = generateHmacSalt();

      expect(salt1).not.toBe(salt2);
      expect(salt2).not.toBe(salt3);
      expect(salt1).not.toBe(salt3);
    });
  });

  describe('deriveHmacKey', () => {
    it('should derive HMAC key from password and salt', async () => {
      const hmacSalt = generateHmacSalt();
      const hmacKey = await deriveHmacKey(testPassword, hmacSalt);

      expect(hmacKey).toBeDefined();
      expect(hmacKey.type).toBe('secret');
      expect(hmacKey.algorithm.name).toBe('HMAC');
    });

    it('should derive same key from same password and salt', async () => {
      const hmacSalt = generateHmacSalt();

      const hmacKey1 = await deriveHmacKey(testPassword, hmacSalt);
      const hmacKey2 = await deriveHmacKey(testPassword, hmacSalt);

      // Generate test HMACs to verify keys are identical
      const testData = new TextEncoder().encode('test data');
      const hmac1 = await crypto.subtle.sign('HMAC', hmacKey1, testData);
      const hmac2 = await crypto.subtle.sign('HMAC', hmacKey2, testData);

      expect(new Uint8Array(hmac1)).toEqual(new Uint8Array(hmac2));
    });

    it('should derive different keys from different salts', async () => {
      const hmacSalt1 = generateHmacSalt();
      const hmacSalt2 = generateHmacSalt();

      const hmacKey1 = await deriveHmacKey(testPassword, hmacSalt1);
      const hmacKey2 = await deriveHmacKey(testPassword, hmacSalt2);

      // Generate test HMACs to verify keys are different
      const testData = new TextEncoder().encode('test data');
      const hmac1 = await crypto.subtle.sign('HMAC', hmacKey1, testData);
      const hmac2 = await crypto.subtle.sign('HMAC', hmacKey2, testData);

      expect(new Uint8Array(hmac1)).not.toEqual(new Uint8Array(hmac2));
    });

    it('should throw error for empty password', async () => {
      const hmacSalt = generateHmacSalt();

      await expect(deriveHmacKey('', hmacSalt)).rejects.toThrow();
    });

    it('should throw error for empty salt', async () => {
      await expect(deriveHmacKey(testPassword, '')).rejects.toThrow();
    });
  });

  describe('generateBackupHMAC', () => {
    it('should generate HMAC for backup bundle', async () => {
      const hmacSalt = generateHmacSalt();
      const hmacKey = await deriveHmacKey(testPassword, hmacSalt);

      const hmac = await generateBackupHMAC(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        hmacKey
      );

      expect(hmac).toBeDefined();
      expect(typeof hmac).toBe('string');
      expect(hmac.length).toBeGreaterThan(0);
    });

    it('should generate same HMAC for identical data', async () => {
      const hmacSalt = generateHmacSalt();
      const hmacKey = await deriveHmacKey(testPassword, hmacSalt);

      const hmac1 = await generateBackupHMAC(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        hmacKey
      );

      const hmac2 = await generateBackupHMAC(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        hmacKey
      );

      expect(hmac1).toBe(hmac2);
    });

    it('should generate different HMAC if metadata changes', async () => {
      const hmacSalt = generateHmacSalt();
      const hmacKey = await deriveHmacKey(testPassword, hmacSalt);

      const hmac1 = await generateBackupHMAC(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        hmacKey
      );

      const modifiedMetadata = {
        ...testMetadata,
        companyId: 'different-company',
      };

      const hmac2 = await generateBackupHMAC(
        modifiedMetadata,
        testEncryptedData,
        testEncryptedKeys,
        hmacKey
      );

      expect(hmac1).not.toBe(hmac2);
    });

    it('should generate different HMAC if permissions change', async () => {
      const hmacSalt = generateHmacSalt();
      const hmacKey = await deriveHmacKey(testPassword, hmacSalt);

      const hmac1 = await generateBackupHMAC(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        hmacKey
      );

      const modifiedMetadata = {
        ...testMetadata,
        permissions: 'View-Only' as const,
      };

      const hmac2 = await generateBackupHMAC(
        modifiedMetadata,
        testEncryptedData,
        testEncryptedKeys,
        hmacKey
      );

      expect(hmac1).not.toBe(hmac2);
    });

    it('should generate different HMAC if encrypted data changes', async () => {
      const hmacSalt = generateHmacSalt();
      const hmacKey = await deriveHmacKey(testPassword, hmacSalt);

      const hmac1 = await generateBackupHMAC(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        hmacKey
      );

      const modifiedData = {
        ...testEncryptedData,
        transactions: 'tampered-transactions-data',
      };

      const hmac2 = await generateBackupHMAC(
        testMetadata,
        modifiedData,
        testEncryptedKeys,
        hmacKey
      );

      expect(hmac1).not.toBe(hmac2);
    });

    it('should generate different HMAC if encrypted keys change', async () => {
      const hmacSalt = generateHmacSalt();
      const hmacKey = await deriveHmacKey(testPassword, hmacSalt);

      const hmac1 = await generateBackupHMAC(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        hmacKey
      );

      const modifiedKeys = {
        ...testEncryptedKeys,
        derivedKey: 'tampered-derived-key',
      };

      const hmac2 = await generateBackupHMAC(
        testMetadata,
        testEncryptedData,
        modifiedKeys,
        hmacKey
      );

      expect(hmac1).not.toBe(hmac2);
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for identical strings', () => {
      const str1 = 'test-string-123';
      const str2 = 'test-string-123';

      expect(constantTimeCompare(str1, str2)).toBe(true);
    });

    it('should return false for different strings', () => {
      const str1 = 'test-string-123';
      const str2 = 'test-string-456';

      expect(constantTimeCompare(str1, str2)).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      const str1 = 'short';
      const str2 = 'much-longer-string';

      expect(constantTimeCompare(str1, str2)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(constantTimeCompare('', '')).toBe(true);
      expect(constantTimeCompare('', 'non-empty')).toBe(false);
      expect(constantTimeCompare('non-empty', '')).toBe(false);
    });

    it('should be timing-safe (basic check)', () => {
      // This is a basic sanity check - true constant-time testing requires
      // statistical analysis of many operations
      const correctHmac = 'a'.repeat(64);
      const wrongFirst = 'b' + 'a'.repeat(63);
      const wrongLast = 'a'.repeat(63) + 'b';

      const result1 = constantTimeCompare(correctHmac, wrongFirst);
      const result2 = constantTimeCompare(correctHmac, wrongLast);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });

  describe('createSecureBackupBundle', () => {
    it('should create complete backup bundle with HMAC', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      expect(bundle).toBeDefined();
      expect(bundle.version).toBe('1.0');
      expect(bundle.metadata).toEqual(testMetadata);
      expect(bundle.encryptedData).toEqual(testEncryptedData);
      expect(bundle.encryptedKeys).toEqual(testEncryptedKeys);
      expect(bundle.integrity.hmac).toBeDefined();
      expect(bundle.integrity.hmacSalt).toBeDefined();
    });

    it('should create bundles with unique HMAC salts', async () => {
      const bundle1 = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      const bundle2 = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      expect(bundle1.integrity.hmacSalt).not.toBe(bundle2.integrity.hmacSalt);
      expect(bundle1.integrity.hmac).not.toBe(bundle2.integrity.hmac);
    });
  });

  describe('verifyBackupIntegrity', () => {
    it('should verify integrity of valid backup bundle', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.details?.hmacMatch).toBe(true);
    });

    it('should detect tampering with metadata.companyId', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Tamper with companyId
      bundle.metadata.companyId = 'tampered-company-id';

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.details?.hmacMatch).toBe(false);
    });

    it('should detect tampering with metadata.userId', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Tamper with userId
      bundle.metadata.userId = 'tampered-user-id';

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.details?.hmacMatch).toBe(false);
    });

    it('should detect privilege escalation attempts (permissions tampering)', async () => {
      // Create bundle with View-Only permissions
      const viewOnlyMetadata = {
        ...testMetadata,
        permissions: 'View-Only' as const,
      };

      const bundle = await createSecureBackupBundle(
        viewOnlyMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Attempt privilege escalation: View-Only -> Admin
      bundle.metadata.permissions = 'Admin';

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.details?.hmacMatch).toBe(false);
    });

    it('should detect tampering with metadata.timestamp', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Tamper with timestamp
      bundle.metadata.timestamp = Date.now() + 100000;

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.details?.hmacMatch).toBe(false);
    });

    it('should detect tampering with metadata.keyRotationEpoch', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Tamper with key rotation epoch
      bundle.metadata.keyRotationEpoch = 999;

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.details?.hmacMatch).toBe(false);
    });

    it('should detect tampering with encryptedData.transactions', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Tamper with encrypted transactions
      bundle.encryptedData.transactions = 'tampered-transactions';

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.details?.hmacMatch).toBe(false);
    });

    it('should detect tampering with encryptedData.accounts', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Tamper with encrypted accounts
      bundle.encryptedData.accounts = 'tampered-accounts';

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.details?.hmacMatch).toBe(false);
    });

    it('should detect tampering with encryptedKeys.derivedKey', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Tamper with encrypted derived key
      bundle.encryptedKeys.derivedKey = 'tampered-key';

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.details?.hmacMatch).toBe(false);
    });

    it('should detect tampering with HMAC itself', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Tamper with HMAC
      bundle.integrity.hmac = 'tampered-hmac-value';

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.details?.hmacMatch).toBe(false);
    });

    it('should fail verification with wrong password', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      const wrongPassword = 'wrong-password-123';
      const result = await verifyBackupIntegrity(bundle, wrongPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.details?.hmacMatch).toBe(false);
    });

    it('should return error for missing HMAC', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Remove HMAC
      delete (bundle.integrity as any).hmac;

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for empty password', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      const result = await verifyBackupIntegrity(bundle, '');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should verify multiple backups independently', async () => {
      const bundle1 = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      const metadata2 = { ...testMetadata, companyId: 'company-789' };
      const bundle2 = await createSecureBackupBundle(
        metadata2,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      const result1 = await verifyBackupIntegrity(bundle1, testPassword);
      const result2 = await verifyBackupIntegrity(bundle2, testPassword);

      expect(result1.success).toBe(true);
      expect(result1.valid).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.valid).toBe(true);
    });
  });

  describe('Security Properties', () => {
    it('should include permission level in HMAC to prevent privilege escalation', async () => {
      // Create backup with View-Only permissions
      const viewOnlyMetadata = {
        ...testMetadata,
        permissions: 'View-Only' as const,
      };

      const bundle = await createSecureBackupBundle(
        viewOnlyMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Verify original bundle is valid
      const result1 = await verifyBackupIntegrity(bundle, testPassword);
      expect(result1.valid).toBe(true);

      // Attempt to escalate to Admin
      bundle.metadata.permissions = 'Admin';

      // Verification should fail
      const result2 = await verifyBackupIntegrity(bundle, testPassword);
      expect(result2.valid).toBe(false);
    });

    it('should use constant-time comparison to prevent timing attacks', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Create multiple tampered versions with differences at different positions
      const tamperedBundles = [
        { ...bundle, metadata: { ...bundle.metadata, companyId: 'a' + bundle.metadata.companyId.slice(1) } },
        { ...bundle, metadata: { ...bundle.metadata, companyId: bundle.metadata.companyId.slice(0, -1) + 'z' } },
        { ...bundle, encryptedData: { ...bundle.encryptedData, transactions: 'x' + bundle.encryptedData.transactions.slice(1) } },
      ];

      // All should fail verification (we can't test timing directly in unit tests)
      for (const tamperedBundle of tamperedBundles) {
        const result = await verifyBackupIntegrity(tamperedBundle, testPassword);
        expect(result.valid).toBe(false);
      }
    });

    it('should use separate HMAC salt from encryption salt', async () => {
      const bundle = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // HMAC salt and encryption salt should be different
      expect(bundle.integrity.hmacSalt).not.toBe(bundle.encryptedKeys.salt);
    });

    it('should generate unique HMACs even for identical data with different salts', async () => {
      const bundle1 = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      const bundle2 = await createSecureBackupBundle(
        testMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      // Salts should be different
      expect(bundle1.integrity.hmacSalt).not.toBe(bundle2.integrity.hmacSalt);

      // HMACs should be different (because different salts)
      expect(bundle1.integrity.hmac).not.toBe(bundle2.integrity.hmac);

      // Both should verify successfully
      const result1 = await verifyBackupIntegrity(bundle1, testPassword);
      const result2 = await verifyBackupIntegrity(bundle2, testPassword);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long metadata values', async () => {
      const longMetadata = {
        ...testMetadata,
        companyId: 'c'.repeat(1000),
        userId: 'u'.repeat(1000),
      };

      const bundle = await createSecureBackupBundle(
        longMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should handle special characters in metadata', async () => {
      const specialMetadata = {
        ...testMetadata,
        companyId: 'company-🎉-测试-™',
        userId: 'user-<script>alert(1)</script>',
      };

      const bundle = await createSecureBackupBundle(
        specialMetadata,
        testEncryptedData,
        testEncryptedKeys,
        testPassword
      );

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should handle very large encrypted data', async () => {
      const largeData = {
        ...testEncryptedData,
        transactions: 'x'.repeat(1000000), // 1MB of data
      };

      const bundle = await createSecureBackupBundle(
        testMetadata,
        largeData,
        testEncryptedKeys,
        testPassword
      );

      const result = await verifyBackupIntegrity(bundle, testPassword);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should handle all permission levels', async () => {
      const permissionLevels: Array<'Admin' | 'Manager' | 'Bookkeeper' | 'View-Only'> = [
        'Admin',
        'Manager',
        'Bookkeeper',
        'View-Only',
      ];

      for (const permission of permissionLevels) {
        const metadata = { ...testMetadata, permissions: permission };
        const bundle = await createSecureBackupBundle(
          metadata,
          testEncryptedData,
          testEncryptedKeys,
          testPassword
        );

        const result = await verifyBackupIntegrity(bundle, testPassword);

        expect(result.success).toBe(true);
        expect(result.valid).toBe(true);
      }
    });
  });
});
