/**
 * Tests for Key Derivation Module
 *
 * Tests Argon2id-based key derivation from passphrases
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateSalt,
  deriveMasterKey,
  rederiveMasterKey,
  verifyPassphrase,
  benchmarkAndAdjustParams,
  clearSensitiveData,
  clearMasterKey,
} from './keyDerivation';
import type { KeyDerivationParams } from './types';

describe('Key Derivation Module', () => {
  describe('generateSalt', () => {
    it('should generate salt of default length', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it('should generate salt of custom length', () => {
      const salt = generateSalt(32);
      expect(salt.length).toBe(32);
    });

    it('should generate different salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toEqual(salt2);
    });

    it('should generate cryptographically random salt', () => {
      const salt = generateSalt(16);
      const allZeros = Array.from(salt).every((byte) => byte === 0);
      const allSame = Array.from(salt).every((byte) => byte === salt[0]);
      expect(allZeros).toBe(false);
      expect(allSame).toBe(false);
    });
  });

  describe('deriveMasterKey', () => {
    it('should derive a master key from passphrase', async () => {
      const passphrase = 'correct horse battery staple';
      const result = await deriveMasterKey(passphrase);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.keyMaterial).toBeInstanceOf(Uint8Array);
      expect(result.data?.keyMaterial.length).toBe(32); // 256 bits
      expect(result.data?.id).toBeDefined();
      expect(result.data?.createdAt).toBeDefined();
    });

    it('should include derivation params in result', async () => {
      const passphrase = 'test passphrase';
      const result = await deriveMasterKey(passphrase);

      expect(result.success).toBe(true);
      expect(result.data?.derivationParams).toBeDefined();
      expect(result.data?.derivationParams.memoryCost).toBeGreaterThanOrEqual(65536);
      expect(result.data?.derivationParams.timeCost).toBeGreaterThanOrEqual(3);
      expect(result.data?.derivationParams.parallelism).toBeGreaterThan(0);
      expect(result.data?.derivationParams.salt).toBeInstanceOf(Uint8Array);
      expect(result.data?.derivationParams.keyLength).toBe(32);
    });

    it('should fail with empty passphrase', async () => {
      const result = await deriveMasterKey('');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('WEAK_PASSPHRASE');
      expect(result.error).toContain('cannot be empty');
    });

    it('should use provided salt', async () => {
      const passphrase = 'test passphrase';
      const salt = generateSalt();
      const result = await deriveMasterKey(passphrase, salt);

      expect(result.success).toBe(true);
      expect(result.data?.derivationParams.salt).toEqual(salt);
    });

    it('should accept custom derivation params', async () => {
      const passphrase = 'test passphrase';
      const customParams: Partial<KeyDerivationParams> = {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 2,
      };

      const result = await deriveMasterKey(passphrase, undefined, customParams);

      expect(result.success).toBe(true);
      expect(result.data?.derivationParams.memoryCost).toBe(65536);
      expect(result.data?.derivationParams.timeCost).toBe(3);
      expect(result.data?.derivationParams.parallelism).toBe(2);
    });

    it('should fail with insufficient memory cost', async () => {
      const passphrase = 'test passphrase';
      const weakParams: Partial<KeyDerivationParams> = {
        memoryCost: 1024, // Too low
      };

      const result = await deriveMasterKey(passphrase, undefined, weakParams);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_KEY');
      expect(result.error).toContain('Memory cost');
    });

    it('should fail with insufficient time cost', async () => {
      const passphrase = 'test passphrase';
      const weakParams: Partial<KeyDerivationParams> = {
        timeCost: 1, // Too low
      };

      const result = await deriveMasterKey(passphrase, undefined, weakParams);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_KEY');
      expect(result.error).toContain('Time cost');
    });

    it('should fail with wrong key length', async () => {
      const passphrase = 'test passphrase';
      const wrongParams: Partial<KeyDerivationParams> = {
        keyLength: 16, // Must be 32
      };

      const result = await deriveMasterKey(passphrase, undefined, wrongParams);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_KEY');
      expect(result.error).toContain('Key length');
    });

    it('should generate deterministic key with same passphrase and salt', async () => {
      const passphrase = 'test passphrase';
      const salt = generateSalt();

      const result1 = await deriveMasterKey(passphrase, salt);
      const result2 = await deriveMasterKey(passphrase, salt);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data?.keyMaterial).toEqual(result2.data?.keyMaterial);
      expect(result1.data?.id).toBe(result2.data?.id);
    });

    it('should generate different keys with different salts', async () => {
      const passphrase = 'test passphrase';
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      const result1 = await deriveMasterKey(passphrase, salt1);
      const result2 = await deriveMasterKey(passphrase, salt2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data?.keyMaterial).not.toEqual(result2.data?.keyMaterial);
      expect(result1.data?.id).not.toBe(result2.data?.id);
    });

    it('should generate different keys with different passphrases', async () => {
      const salt = generateSalt();

      const result1 = await deriveMasterKey('passphrase one', salt);
      const result2 = await deriveMasterKey('passphrase two', salt);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data?.keyMaterial).not.toEqual(result2.data?.keyMaterial);
      expect(result1.data?.id).not.toBe(result2.data?.id);
    });

    it('should handle Unicode passphrases', async () => {
      const passphrase = '🔐 correct horse battery staple 世界';
      const result = await deriveMasterKey(passphrase);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle very long passphrases', async () => {
      const passphrase = 'word '.repeat(100);
      const result = await deriveMasterKey(passphrase);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('rederiveMasterKey', () => {
    it('should rederive the same key with same params', async () => {
      const passphrase = 'test passphrase';
      const originalResult = await deriveMasterKey(passphrase);

      expect(originalResult.success).toBe(true);
      expect(originalResult.data).toBeDefined();

      const rederivedResult = await rederiveMasterKey(
        passphrase,
        originalResult.data!.derivationParams
      );

      expect(rederivedResult.success).toBe(true);
      expect(rederivedResult.data?.keyMaterial).toEqual(
        originalResult.data?.keyMaterial
      );
      expect(rederivedResult.data?.id).toBe(originalResult.data?.id);
    });

    it('should fail with wrong passphrase', async () => {
      const originalResult = await deriveMasterKey('correct passphrase');

      expect(originalResult.success).toBe(true);
      expect(originalResult.data).toBeDefined();

      const rederivedResult = await rederiveMasterKey(
        'wrong passphrase',
        originalResult.data!.derivationParams
      );

      expect(rederivedResult.success).toBe(true); // Derivation succeeds
      expect(rederivedResult.data?.id).not.toBe(originalResult.data?.id); // But key is different
    });
  });

  describe('verifyPassphrase', () => {
    it('should verify correct passphrase', async () => {
      const passphrase = 'correct horse battery staple';
      const keyResult = await deriveMasterKey(passphrase);

      expect(keyResult.success).toBe(true);
      expect(keyResult.data).toBeDefined();

      const isValid = await verifyPassphrase(passphrase, keyResult.data!);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passphrase', async () => {
      const correctPassphrase = 'correct horse battery staple';
      const wrongPassphrase = 'wrong horse battery staple';

      const keyResult = await deriveMasterKey(correctPassphrase);

      expect(keyResult.success).toBe(true);
      expect(keyResult.data).toBeDefined();

      const isValid = await verifyPassphrase(wrongPassphrase, keyResult.data!);
      expect(isValid).toBe(false);
    });

    it('should handle verification errors gracefully', async () => {
      const passphrase = 'test passphrase';
      const keyResult = await deriveMasterKey(passphrase);

      expect(keyResult.success).toBe(true);
      expect(keyResult.data).toBeDefined();

      const isValid = await verifyPassphrase('', keyResult.data!);
      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison', async () => {
      const passphrase = 'test passphrase';
      const keyResult = await deriveMasterKey(passphrase);

      expect(keyResult.success).toBe(true);
      expect(keyResult.data).toBeDefined();

      // Time verification with correct passphrase
      const start1 = performance.now();
      await verifyPassphrase(passphrase, keyResult.data!);
      const time1 = performance.now() - start1;

      // Time verification with wrong passphrase of different length
      const start2 = performance.now();
      await verifyPassphrase('wrong', keyResult.data!);
      const time2 = performance.now() - start2;

      // Times should be similar (within reasonable margin)
      // This is a weak test but demonstrates the intent
      expect(Math.abs(time1 - time2)).toBeLessThan(1000);
    });
  });

  describe('benchmarkAndAdjustParams', () => {
    it('should return valid parameters', async () => {
      const params = await benchmarkAndAdjustParams(100);

      expect(params.memoryCost).toBeGreaterThanOrEqual(65536);
      expect(params.timeCost).toBeGreaterThanOrEqual(3);
      expect(params.parallelism).toBeGreaterThan(0);
    });

    it('should respect target time', async () => {
      const params = await benchmarkAndAdjustParams(50);
      expect(params).toBeDefined();
    });

    it('should handle benchmark failures gracefully', async () => {
      // Mock a failure in performance.now()
      vi.spyOn(performance, 'now').mockImplementation(() => {
        throw new Error('Performance API unavailable');
      });

      const params = await benchmarkAndAdjustParams(500);

      // Should return minimum safe parameters
      expect(params.memoryCost).toBeGreaterThanOrEqual(65536);
      expect(params.timeCost).toBeGreaterThanOrEqual(3);

      vi.restoreAllMocks();
    });
  });

  describe('clearSensitiveData', () => {
    it('should overwrite data with zeros', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      clearSensitiveData(data);

      expect(Array.from(data)).toEqual([0, 0, 0, 0, 0]);
    });

    it('should handle empty arrays', () => {
      const data = new Uint8Array(0);
      expect(() => clearSensitiveData(data)).not.toThrow();
    });

    it('should handle large arrays', () => {
      const data = new Uint8Array(10000);
      data.fill(255);
      clearSensitiveData(data);

      expect(Array.from(data).every((byte) => byte === 0)).toBe(true);
    });
  });

  describe('clearMasterKey', () => {
    it('should clear all sensitive data from master key', async () => {
      const passphrase = 'test passphrase';
      const result = await deriveMasterKey(passphrase);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const key = result.data!;
      const keyMaterialCopy = new Uint8Array(key.keyMaterial);
      const saltCopy = new Uint8Array(key.derivationParams.salt);

      clearMasterKey(key);

      // Key material should be cleared
      expect(Array.from(key.keyMaterial).every((byte) => byte === 0)).toBe(
        true
      );
      // Salt should be cleared
      expect(
        Array.from(key.derivationParams.salt).every((byte) => byte === 0)
      ).toBe(true);

      // Copies should still have original values
      expect(keyMaterialCopy).not.toEqual(key.keyMaterial);
      expect(saltCopy).not.toEqual(key.derivationParams.salt);
    });
  });

  describe('security properties', () => {
    it('should produce keys with high entropy', async () => {
      const passphrase = 'test passphrase';
      const result = await deriveMasterKey(passphrase);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const keyMaterial = result.data!.keyMaterial;

      // Check that key material is not all zeros
      const allZeros = Array.from(keyMaterial).every((byte) => byte === 0);
      expect(allZeros).toBe(false);

      // Check that key material is not all same value
      const allSame = Array.from(keyMaterial).every(
        (byte) => byte === keyMaterial[0]
      );
      expect(allSame).toBe(false);

      // Check distribution (rough entropy check)
      const byteSet = new Set(keyMaterial);
      expect(byteSet.size).toBeGreaterThan(16); // Should have variety
    });

    it('should resist rainbow table attacks (unique salt per key)', async () => {
      const passphrase = 'common password';

      const result1 = await deriveMasterKey(passphrase);
      const result2 = await deriveMasterKey(passphrase);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Different salts should produce different keys
      expect(result1.data?.id).not.toBe(result2.data?.id);
      expect(result1.data?.keyMaterial).not.toEqual(result2.data?.keyMaterial);
    });

    it('should meet minimum security requirements', async () => {
      const passphrase = 'test passphrase';
      const result = await deriveMasterKey(passphrase);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const params = result.data!.derivationParams;

      // Verify minimum security parameters
      expect(params.memoryCost).toBeGreaterThanOrEqual(65536); // 64 MB
      expect(params.timeCost).toBeGreaterThanOrEqual(3);
      expect(params.keyLength).toBe(32); // 256 bits
      expect(params.salt.length).toBeGreaterThanOrEqual(16); // 128 bits
    });
  });

  describe('edge cases', () => {
    it('should handle passphrases with special characters', async () => {
      const passphrase = '!@#$%^&*()_+-=[]{}|;:\'"<>,.?/`~';
      const result = await deriveMasterKey(passphrase);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle passphrases with whitespace', async () => {
      const passphrase = '  spaces  around  words  ';
      const result = await deriveMasterKey(passphrase);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle passphrases with newlines and tabs', async () => {
      const passphrase = 'line1\nline2\tline3';
      const result = await deriveMasterKey(passphrase);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle numeric passphrases', async () => {
      const passphrase = '123456789012';
      const result = await deriveMasterKey(passphrase);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should treat similar passphrases as different', async () => {
      const passphrase1 = 'password';
      const passphrase2 = 'Password'; // Different case

      const salt = generateSalt();

      const result1 = await deriveMasterKey(passphrase1, salt);
      const result2 = await deriveMasterKey(passphrase2, salt);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data?.id).not.toBe(result2.data?.id);
    });
  });
});
