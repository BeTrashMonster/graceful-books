/**
 * Unit Tests for Backup Bundle Encryption System
 *
 * Tests for Task 1.1 of the Backup & Sync Architecture Roadmap.
 * Comprehensive test coverage for encryption, decryption, and integrity verification.
 *
 * Test Categories:
 * 1. Bundle Generation (happy path)
 * 2. Bundle Restoration (happy path)
 * 3. HMAC Integrity Verification
 * 4. Error Handling (wrong password, tampered data, invalid structure)
 * 5. Security Properties (unique salts, proper key derivation)
 * 6. Edge Cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateBackupBundle,
  restoreBackupBundle,
  validateBackupBundleStructure,
  type SecureBackupBundle,
  type BackupData,
  type GenerateBackupBundleOptions,
} from './BackupEncryption';

describe('BackupEncryption', () => {
  // Test fixtures
  const validPassword = 'test-strong-password-123!@#';
  const wrongPassword = 'wrong-password-456';

  const sampleBackupData: BackupData = {
    transactions: [
      { id: 'txn-1', amount: 100, description: 'Test transaction 1' },
      { id: 'txn-2', amount: 200, description: 'Test transaction 2' },
    ],
    accounts: [
      { id: 'acc-1', name: 'Checking', balance: 1000 },
      { id: 'acc-2', name: 'Savings', balance: 5000 },
    ],
    reports: [
      { id: 'rpt-1', name: 'Monthly Report', data: { revenue: 10000 } },
    ],
    preferences: {
      theme: 'dark',
      language: 'en',
      notifications: true,
    },
  };

  const validOptions: GenerateBackupBundleOptions = {
    companyId: 'company-123',
    userId: 'user-456',
    userRole: 'Admin',
    keyRotationEpoch: 1,
    password: validPassword,
    data: sampleBackupData,
  };

  describe('generateBackupBundle', () => {
    it('should successfully generate a backup bundle with valid options', async () => {
      const result = await generateBackupBundle(validOptions);

      expect(result.success).toBe(true);
      expect(result.bundle).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('should include correct version in bundle', async () => {
      const result = await generateBackupBundle(validOptions);

      expect(result.bundle?.version).toBe('1.0');
    });

    it('should include correct metadata in bundle', async () => {
      const result = await generateBackupBundle(validOptions);

      expect(result.bundle?.metadata).toMatchObject({
        companyId: 'company-123',
        userId: 'user-456',
        userRole: 'Admin',
        keyRotationEpoch: 1,
      });
      expect(result.bundle?.metadata.timestamp).toBeGreaterThan(0);
      expect(typeof result.bundle?.metadata.timestamp).toBe('number');
    });

    it('should include all encrypted data sections', async () => {
      const result = await generateBackupBundle(validOptions);

      expect(result.bundle?.encryptedData).toBeDefined();
      expect(result.bundle?.encryptedData.transactions).toBeDefined();
      expect(result.bundle?.encryptedData.accounts).toBeDefined();
      expect(result.bundle?.encryptedData.reports).toBeDefined();
      expect(result.bundle?.encryptedData.preferences).toBeDefined();

      // Verify they are strings (encrypted)
      expect(typeof result.bundle?.encryptedData.transactions).toBe('string');
      expect(typeof result.bundle?.encryptedData.accounts).toBe('string');
      expect(typeof result.bundle?.encryptedData.reports).toBe('string');
      expect(typeof result.bundle?.encryptedData.preferences).toBe('string');
    });

    it('should include encrypted keys with proper parameters', async () => {
      const result = await generateBackupBundle(validOptions);

      expect(result.bundle?.encryptedKeys).toBeDefined();
      expect(result.bundle?.encryptedKeys.derivedKey).toBeDefined();
      expect(result.bundle?.encryptedKeys.salt).toBeDefined();
      expect(result.bundle?.encryptedKeys.iterations).toBe(3);
      expect(result.bundle?.encryptedKeys.memoryCost).toBe(65536); // 64MB
      expect(result.bundle?.encryptedKeys.parallelism).toBe(4);
    });

    it('should include integrity verification fields', async () => {
      const result = await generateBackupBundle(validOptions);

      expect(result.bundle?.integrity).toBeDefined();
      expect(result.bundle?.integrity.hmac).toBeDefined();
      expect(result.bundle?.integrity.hmacSalt).toBeDefined();
      expect(typeof result.bundle?.integrity.hmac).toBe('string');
      expect(typeof result.bundle?.integrity.hmacSalt).toBe('string');
    });

    it('should generate unique salts for each backup', async () => {
      const result1 = await generateBackupBundle(validOptions);
      const result2 = await generateBackupBundle(validOptions);

      expect(result1.bundle?.encryptedKeys.salt).not.toBe(
        result2.bundle?.encryptedKeys.salt
      );
      expect(result1.bundle?.integrity.hmacSalt).not.toBe(
        result2.bundle?.integrity.hmacSalt
      );
    });

    it('should generate different encrypted data for same input with different salts', async () => {
      const result1 = await generateBackupBundle(validOptions);
      const result2 = await generateBackupBundle(validOptions);

      expect(result1.bundle?.encryptedData.transactions).not.toBe(
        result2.bundle?.encryptedData.transactions
      );
    });

    it('should handle different user roles', async () => {
      const roles: Array<'Admin' | 'Manager' | 'Bookkeeper' | 'View-Only'> = [
        'Admin',
        'Manager',
        'Bookkeeper',
        'View-Only',
      ];

      for (const role of roles) {
        const result = await generateBackupBundle({
          ...validOptions,
          userRole: role,
        });

        expect(result.success).toBe(true);
        expect(result.bundle?.metadata.userRole).toBe(role);
      }
    });

    it('should handle empty data arrays', async () => {
      const emptyData: BackupData = {
        transactions: [],
        accounts: [],
        reports: [],
        preferences: {},
      };

      const result = await generateBackupBundle({
        ...validOptions,
        data: emptyData,
      });

      expect(result.success).toBe(true);
      expect(result.bundle).toBeDefined();
    });

    it('should handle large data sets', async () => {
      const largeData: BackupData = {
        transactions: Array.from({ length: 1000 }, (_, i) => ({
          id: `txn-${i}`,
          amount: i * 100,
          description: `Transaction ${i}`,
        })),
        accounts: Array.from({ length: 100 }, (_, i) => ({
          id: `acc-${i}`,
          name: `Account ${i}`,
          balance: i * 1000,
        })),
        reports: Array.from({ length: 50 }, (_, i) => ({
          id: `rpt-${i}`,
          name: `Report ${i}`,
          data: { value: i },
        })),
        preferences: {
          setting1: 'value1',
          setting2: 'value2',
          setting3: { nested: 'value' },
        },
      };

      const result = await generateBackupBundle({
        ...validOptions,
        data: largeData,
      });

      expect(result.success).toBe(true);
      expect(result.bundle).toBeDefined();
    });
  });

  describe('restoreBackupBundle', () => {
    let validBundle: SecureBackupBundle;

    beforeEach(async () => {
      const result = await generateBackupBundle(validOptions);
      if (!result.bundle) {
        throw new Error('Failed to generate test bundle');
      }
      validBundle = result.bundle;
    });

    it('should successfully restore a valid bundle with correct password', async () => {
      const result = await restoreBackupBundle(validBundle, validPassword);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should restore correct metadata', async () => {
      const result = await restoreBackupBundle(validBundle, validPassword);

      expect(result.metadata).toMatchObject({
        companyId: 'company-123',
        userId: 'user-456',
        userRole: 'Admin',
        keyRotationEpoch: 1,
      });
    });

    it('should restore correct transaction data', async () => {
      const result = await restoreBackupBundle(validBundle, validPassword);

      expect(result.data?.transactions).toEqual(sampleBackupData.transactions);
    });

    it('should restore correct account data', async () => {
      const result = await restoreBackupBundle(validBundle, validPassword);

      expect(result.data?.accounts).toEqual(sampleBackupData.accounts);
    });

    it('should restore correct report data', async () => {
      const result = await restoreBackupBundle(validBundle, validPassword);

      expect(result.data?.reports).toEqual(sampleBackupData.reports);
    });

    it('should restore correct preferences data', async () => {
      const result = await restoreBackupBundle(validBundle, validPassword);

      expect(result.data?.preferences).toEqual(sampleBackupData.preferences);
    });

    it('should fail with wrong password', async () => {
      const result = await restoreBackupBundle(validBundle, wrongPassword);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('password');
    });

    it('should fail with tampered HMAC', async () => {
      const tamperedBundle = {
        ...validBundle,
        integrity: {
          ...validBundle.integrity,
          hmac: 'tampered-hmac-value-that-is-invalid',
        },
      };

      const result = await restoreBackupBundle(tamperedBundle, validPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Password-based HMAC shows combined password/tampered message
      expect(result.error?.toLowerCase()).toMatch(/password|tampered/);
    });

    it('should fail with tampered encrypted data', async () => {
      const tamperedBundle = {
        ...validBundle,
        encryptedData: {
          ...validBundle.encryptedData,
          transactions: 'tampered-encrypted-data',
        },
      };

      const result = await restoreBackupBundle(tamperedBundle, validPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail with tampered metadata', async () => {
      const tamperedBundle = {
        ...validBundle,
        metadata: {
          ...validBundle.metadata,
          companyId: 'tampered-company-id',
        },
      };

      const result = await restoreBackupBundle(tamperedBundle, validPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Password-based HMAC detects tampering but shows combined message
      expect(result.error?.toLowerCase()).toMatch(/password|tampered/);
    });

    it('should handle empty password', async () => {
      const result = await restoreBackupBundle(validBundle, '');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateBackupBundleStructure', () => {
    let validBundle: SecureBackupBundle;

    beforeEach(async () => {
      const result = await generateBackupBundle(validOptions);
      if (!result.bundle) {
        throw new Error('Failed to generate test bundle');
      }
      validBundle = result.bundle;
    });

    it('should validate a correct bundle structure', () => {
      const result = validateBackupBundleStructure(validBundle);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject null input', () => {
      const result = validateBackupBundleStructure(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject undefined input', () => {
      const result = validateBackupBundleStructure(undefined);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject non-object input', () => {
      const result = validateBackupBundleStructure('not an object');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject bundle without version', () => {
      const { version, ...bundleWithoutVersion } = validBundle;
      const result = validateBackupBundleStructure(bundleWithoutVersion);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('version');
    });

    it('should reject bundle without metadata', () => {
      const { metadata, ...bundleWithoutMetadata } = validBundle;
      const result = validateBackupBundleStructure(bundleWithoutMetadata);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('metadata');
    });

    it('should reject bundle with incomplete metadata', () => {
      const { companyId, ...incompleteMetadata } = validBundle.metadata;
      const bundleWithIncompleteMetadata = {
        ...validBundle,
        metadata: incompleteMetadata,
      };
      const result = validateBackupBundleStructure(bundleWithIncompleteMetadata);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('metadata.companyId');
    });

    it('should reject bundle without encryptedData', () => {
      const { encryptedData, ...bundleWithoutData } = validBundle;
      const result = validateBackupBundleStructure(bundleWithoutData);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('encryptedData');
    });

    it('should reject bundle with incomplete encryptedData', () => {
      const { transactions, ...incompleteData } = validBundle.encryptedData;
      const bundleWithIncompleteData = {
        ...validBundle,
        encryptedData: incompleteData,
      };
      const result = validateBackupBundleStructure(bundleWithIncompleteData);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('encryptedData.transactions');
    });

    it('should reject bundle without encryptedKeys', () => {
      const { encryptedKeys, ...bundleWithoutKeys } = validBundle;
      const result = validateBackupBundleStructure(bundleWithoutKeys);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('encryptedKeys');
    });

    it('should reject bundle with incomplete encryptedKeys', () => {
      const { salt, ...incompleteKeys } = validBundle.encryptedKeys;
      const bundleWithIncompleteKeys = {
        ...validBundle,
        encryptedKeys: incompleteKeys,
      };
      const result = validateBackupBundleStructure(bundleWithIncompleteKeys);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('encryptedKeys.salt');
    });

    it('should reject bundle without integrity', () => {
      const { integrity, ...bundleWithoutIntegrity } = validBundle;
      const result = validateBackupBundleStructure(bundleWithoutIntegrity);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('integrity');
    });

    it('should reject bundle with incomplete integrity', () => {
      const { hmac, ...incompleteIntegrity } = validBundle.integrity;
      const bundleWithIncompleteIntegrity = {
        ...validBundle,
        integrity: incompleteIntegrity,
      };
      const result = validateBackupBundleStructure(bundleWithIncompleteIntegrity);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('integrity');
    });
  });

  describe('Security Properties', () => {
    it('should use unique salt for each backup (prevents rainbow table attacks)', async () => {
      const result1 = await generateBackupBundle(validOptions);
      const result2 = await generateBackupBundle(validOptions);

      expect(result1.bundle?.encryptedKeys.salt).toBeDefined();
      expect(result2.bundle?.encryptedKeys.salt).toBeDefined();
      expect(result1.bundle?.encryptedKeys.salt).not.toBe(
        result2.bundle?.encryptedKeys.salt
      );
    });

    it('should use 32-byte salts (256 bits)', async () => {
      const result = await generateBackupBundle(validOptions);

      // Base64 encoding of 32 bytes is ~44 characters
      expect(result.bundle?.encryptedKeys.salt.length).toBeGreaterThanOrEqual(43);
      expect(result.bundle?.integrity.hmacSalt.length).toBeGreaterThanOrEqual(43);
    });

    it('should use correct Argon2id parameters', async () => {
      const result = await generateBackupBundle(validOptions);

      expect(result.bundle?.encryptedKeys.iterations).toBe(3);
      expect(result.bundle?.encryptedKeys.memoryCost).toBe(65536); // 64MB
      expect(result.bundle?.encryptedKeys.parallelism).toBe(4);
    });

    it('should detect tampering in any field', async () => {
      const result = await generateBackupBundle(validOptions);
      if (!result.bundle) throw new Error('Failed to generate bundle');

      // Tamper with version
      const tamperedVersion = {
        ...result.bundle,
        version: '2.0',
      };
      expect(
        (await restoreBackupBundle(tamperedVersion, validPassword)).success
      ).toBe(false);

      // Tamper with timestamp
      const tamperedTimestamp = {
        ...result.bundle,
        metadata: {
          ...result.bundle.metadata,
          timestamp: result.bundle.metadata.timestamp + 1000,
        },
      };
      expect(
        (await restoreBackupBundle(tamperedTimestamp, validPassword)).success
      ).toBe(false);
    });

    it('should not leak information about data structure in encrypted form', async () => {
      const result = await generateBackupBundle(validOptions);

      // Encrypted data should not contain obvious patterns
      const encryptedTxns = result.bundle?.encryptedData.transactions;
      expect(encryptedTxns).not.toContain('txn-1');
      expect(encryptedTxns).not.toContain('Test transaction');
      expect(encryptedTxns).not.toContain('100');
    });
  });

  describe('Round-trip Encryption/Decryption', () => {
    it('should preserve data integrity through encryption and decryption', async () => {
      const genResult = await generateBackupBundle(validOptions);
      if (!genResult.bundle) throw new Error('Failed to generate bundle');

      const restoreResult = await restoreBackupBundle(
        genResult.bundle,
        validPassword
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.data).toEqual(sampleBackupData);
    });

    it('should handle special characters in data', async () => {
      const specialData: BackupData = {
        transactions: [
          {
            id: 'txn-1',
            description: '测试 🎉 <script>alert("xss")</script>',
          },
        ],
        accounts: [{ id: 'acc-1', name: 'Ñoño\'s Account' }],
        reports: [],
        preferences: { emoji: '😀🎉✨' },
      };

      const genResult = await generateBackupBundle({
        ...validOptions,
        data: specialData,
      });

      const restoreResult = await restoreBackupBundle(
        genResult.bundle!,
        validPassword
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.data).toEqual(specialData);
    });

    it('should handle nested objects in preferences', async () => {
      const nestedData: BackupData = {
        transactions: [],
        accounts: [],
        reports: [],
        preferences: {
          level1: {
            level2: {
              level3: {
                deepValue: 'found me!',
              },
            },
          },
          arrays: [1, 2, 3, { nested: 'value' }],
        },
      };

      const genResult = await generateBackupBundle({
        ...validOptions,
        data: nestedData,
      });

      const restoreResult = await restoreBackupBundle(
        genResult.bundle!,
        validPassword
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.data).toEqual(nestedData);
    });
  });

  describe('Error Messages', () => {
    it('should provide user-friendly error message for wrong password', async () => {
      const genResult = await generateBackupBundle(validOptions);
      const restoreResult = await restoreBackupBundle(
        genResult.bundle!,
        wrongPassword
      );

      expect(restoreResult.error).toBeDefined();
      expect(restoreResult.error).not.toContain('Invalid');
      expect(restoreResult.error).not.toContain('Wrong');
      // Password-based HMAC means wrong password fails at HMAC stage
      expect(restoreResult.error?.toLowerCase()).toContain('password');
      expect(restoreResult.error?.toLowerCase()).toContain('try');
    });

    it('should provide clear error for tampered data', async () => {
      const genResult = await generateBackupBundle(validOptions);
      const tamperedBundle = {
        ...genResult.bundle!,
        integrity: {
          ...genResult.bundle!.integrity,
          hmac: 'tampered',
        },
      };

      const restoreResult = await restoreBackupBundle(
        tamperedBundle,
        validPassword
      );

      expect(restoreResult.error).toBeDefined();
      // With password-based HMAC, tampering appears as wrong password/tampered message
      expect(restoreResult.error?.toLowerCase()).toMatch(/tampered|password/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const result = await generateBackupBundle({
        ...validOptions,
        password: longPassword,
      });

      expect(result.success).toBe(true);

      const restoreResult = await restoreBackupBundle(
        result.bundle!,
        longPassword
      );
      expect(restoreResult.success).toBe(true);
    });

    it('should handle unicode passwords', async () => {
      const unicodePassword = '密码🔑パスワード';
      const result = await generateBackupBundle({
        ...validOptions,
        password: unicodePassword,
      });

      expect(result.success).toBe(true);

      const restoreResult = await restoreBackupBundle(
        result.bundle!,
        unicodePassword
      );
      expect(restoreResult.success).toBe(true);
    });

    it('should handle data with null values', async () => {
      const dataWithNull: BackupData = {
        transactions: [{ id: 'txn-1', amount: null as any }],
        accounts: [],
        reports: [],
        preferences: { setting: null as any },
      };

      const result = await generateBackupBundle({
        ...validOptions,
        data: dataWithNull,
      });

      expect(result.success).toBe(true);

      const restoreResult = await restoreBackupBundle(
        result.bundle!,
        validPassword
      );
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.data).toEqual(dataWithNull);
    });

    it('should handle maximum keyRotationEpoch value', async () => {
      const result = await generateBackupBundle({
        ...validOptions,
        keyRotationEpoch: Number.MAX_SAFE_INTEGER,
      });

      expect(result.success).toBe(true);
      expect(result.bundle?.metadata.keyRotationEpoch).toBe(
        Number.MAX_SAFE_INTEGER
      );
    });
  });

  describe('Performance', () => {
    it('should generate bundle in reasonable time', async () => {
      const startTime = Date.now();
      await generateBackupBundle(validOptions);
      const endTime = Date.now();

      // Should complete in less than 5 seconds
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should restore bundle in reasonable time', async () => {
      const genResult = await generateBackupBundle(validOptions);

      const startTime = Date.now();
      await restoreBackupBundle(genResult.bundle!, validPassword);
      const endTime = Date.now();

      // Should complete in less than 5 seconds
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});
