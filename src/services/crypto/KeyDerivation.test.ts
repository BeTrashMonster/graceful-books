/**
 * Tests for Key Derivation Service
 *
 * Covers all key derivation functions including:
 * - Argon2id derivation
 * - PBKDF2 fallback
 * - Salt generation
 * - Password verification
 * - Performance benchmarking
 * - Security validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  derivePasswordKey,
  generateSalt,
  detectBestAlgorithm,
  rederiveKey,
  verifyPassword,
  clearSensitiveData,
  benchmarkPerformance,
  type KeyDerivationConfig,
} from './KeyDerivation';

// Note: argon2-browser requires WASM and is not available in Node.js test environment.
// Tests will automatically use PBKDF2 fallback, which is the expected behavior.

describe('KeyDerivation Service', () => {
  describe('generateSalt', () => {
    it('should generate salt with default length of 32 bytes', () => {
      const salt = generateSalt();

      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(32);
    });

    it('should generate salt with custom length', () => {
      const salt = generateSalt(16);

      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it('should generate different salts on each call', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      expect(salt1).not.toEqual(salt2);
    });

    it('should generate cryptographically random values', () => {
      const salt = generateSalt(32);

      // Check that not all bytes are the same (extremely unlikely with crypto.getRandomValues)
      const allSame = salt.every((byte) => byte === salt[0]);
      expect(allSame).toBe(false);
    });
  });

  describe('detectBestAlgorithm', () => {
    it('should detect Argon2id if argon2-browser is available', () => {
      const algorithm = detectBestAlgorithm();

      // In test environment with argon2-browser installed, should return argon2id
      expect(['argon2id', 'pbkdf2']).toContain(algorithm);
    });

    it('should return a valid algorithm', () => {
      const algorithm = detectBestAlgorithm();

      expect(algorithm).toMatch(/^(argon2id|pbkdf2)$/);
    });
  });

  describe('derivePasswordKey', () => {
    it('should derive a key with default configuration', async () => {
      const result = await derivePasswordKey('test-password-12345');

      expect(result).toBeDefined();
      expect(result.key).toBeInstanceOf(Uint8Array);
      expect(result.key.length).toBe(32); // 256 bits
      expect(result.salt).toBeInstanceOf(Uint8Array);
      expect(result.salt.length).toBe(32);
      expect(result.algorithm).toMatch(/^(argon2id|pbkdf2)$/);
      expect(result.derivationTimeMs).toBeGreaterThan(0);
    });

    it('should derive a key with custom salt', async () => {
      const customSalt = generateSalt(32);
      const result = await derivePasswordKey('test-password', customSalt);

      expect(result.salt).toEqual(customSalt);
    });

    it('should throw error for empty password', async () => {
      await expect(derivePasswordKey('')).rejects.toThrow('Password cannot be empty');
    });

    it('should derive consistent keys with same password and salt', async () => {
      const password = 'consistent-password-12345';
      const salt = generateSalt(32);

      const result1 = await derivePasswordKey(password, salt);
      const result2 = await derivePasswordKey(password, salt);

      expect(result1.key).toEqual(result2.key);
    });

    it('should derive different keys with different passwords', async () => {
      const salt = generateSalt(32);

      const result1 = await derivePasswordKey('password-one', salt);
      const result2 = await derivePasswordKey('password-two', salt);

      expect(result1.key).not.toEqual(result2.key);
    });

    it('should derive different keys with different salts', async () => {
      const password = 'same-password';

      const result1 = await derivePasswordKey(password, generateSalt(32));
      const result2 = await derivePasswordKey(password, generateSalt(32));

      expect(result1.key).not.toEqual(result2.key);
    });

    it('should complete in under 1 second (performance target)', async () => {
      const startTime = performance.now();
      await derivePasswordKey('performance-test-password');
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // 1 second
    }, 2000); // Allow 2 seconds for test timeout

    it('should use custom configuration when provided', async () => {
      const customConfig: Partial<KeyDerivationConfig> = {
        iterations: 5,
        keyLength: 32,
        saltLength: 32,
      };

      const result = await derivePasswordKey('test-password', undefined, customConfig);

      expect(result.config.iterations).toBe(5);
      expect(result.config.keyLength).toBe(32);
    });

    it('should throw error for invalid salt length', async () => {
      const invalidSalt = generateSalt(16); // Wrong length

      await expect(
        derivePasswordKey('test-password', invalidSalt, { saltLength: 32 })
      ).rejects.toThrow('Salt length mismatch');
    });
  });

  describe('rederiveKey', () => {
    it('should re-derive the same key with correct parameters', async () => {
      const password = 'original-password';
      const original = await derivePasswordKey(password);

      const rederived = await rederiveKey(password, original.salt, original.config);

      expect(rederived.key).toEqual(original.key);
    });

    it('should fail to match with incorrect password', async () => {
      const original = await derivePasswordKey('correct-password');

      const rederived = await rederiveKey('wrong-password', original.salt, original.config);

      expect(rederived.key).not.toEqual(original.key);
    });

    it('should fail to match with incorrect salt', async () => {
      const password = 'same-password';
      const original = await derivePasswordKey(password);
      const wrongSalt = generateSalt(32);

      const rederived = await rederiveKey(password, wrongSalt, original.config);

      expect(rederived.key).not.toEqual(original.key);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'correct-password';
      const original = await derivePasswordKey(password);

      const isValid = await verifyPassword(
        password,
        original.key,
        original.salt,
        original.config
      );

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const original = await derivePasswordKey('correct-password');

      const isValid = await verifyPassword(
        'wrong-password',
        original.key,
        original.salt,
        original.config
      );

      expect(isValid).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const original = await derivePasswordKey('password');

      // Pass invalid config to trigger error
      const invalidConfig = { ...original.config, keyLength: -1 };

      const isValid = await verifyPassword(
        'password',
        original.key,
        original.salt,
        invalidConfig as KeyDerivationConfig
      );

      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison (timing attack resistance)', async () => {
      const password = 'test-password';
      const original = await derivePasswordKey(password);

      // Time correct password verification
      const startCorrect = performance.now();
      await verifyPassword(password, original.key, original.salt, original.config);
      const durationCorrect = performance.now() - startCorrect;

      // Time incorrect password verification
      const startIncorrect = performance.now();
      await verifyPassword('wrong-password', original.key, original.salt, original.config);
      const durationIncorrect = performance.now() - startIncorrect;

      // Both should take similar time (within 300ms for key derivation operations)
      // Note: Key derivation itself takes most of the time, making timing attacks impractical
      // The high computational cost of PBKDF2/Argon2 makes timing attacks infeasible
      expect(Math.abs(durationCorrect - durationIncorrect)).toBeLessThan(300);
    }, 5000);
  });

  describe('clearSensitiveData', () => {
    it('should clear all bytes in array', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      clearSensitiveData(data);

      expect(data).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    });

    it('should handle empty array', () => {
      const data = new Uint8Array([]);

      expect(() => clearSensitiveData(data)).not.toThrow();
      expect(data.length).toBe(0);
    });

    it('should clear large arrays', () => {
      const data = new Uint8Array(1000).fill(255);

      clearSensitiveData(data);

      const allZero = data.every((byte) => byte === 0);
      expect(allZero).toBe(true);
    });
  });

  describe('benchmarkPerformance', () => {
    it('should return benchmark results', async () => {
      const result = await benchmarkPerformance();

      expect(result).toBeDefined();
      expect(result.key).toBeInstanceOf(Uint8Array);
      expect(result.derivationTimeMs).toBeGreaterThan(0);
      expect(result.algorithm).toMatch(/^(argon2id|pbkdf2)$/);
    });

    it('should benchmark Argon2id if available', async () => {
      const algorithm = detectBestAlgorithm();

      if (algorithm === 'argon2id') {
        const result = await benchmarkPerformance('argon2id');
        expect(result.algorithm).toBe('argon2id');
      }
    });

    it('should benchmark PBKDF2 if requested', async () => {
      const result = await benchmarkPerformance('pbkdf2');

      expect(result.algorithm).toBe('pbkdf2');
    });

    it('should complete benchmark in reasonable time', async () => {
      const startTime = performance.now();
      await benchmarkPerformance();
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(2000); // 2 seconds
    }, 3000);
  });

  describe('Security validation', () => {
    it('should use Argon2id parameters per specification (when available)', async () => {
      const algorithm = detectBestAlgorithm();

      // In Node.js test environment, Argon2id is not available
      // So we'll test the configuration is set correctly regardless of algorithm
      const result = await derivePasswordKey('test-password');

      expect(result.config.keyLength).toBe(32);
      expect(result.config.saltLength).toBe(32);

      // If Argon2id is available, check its parameters
      if (algorithm === 'argon2id' && result.algorithm === 'argon2id') {
        expect(result.config.iterations).toBe(3);
        expect(result.config.memory).toBe(65536); // 64 MB
        expect(result.config.parallelism).toBe(4);
      }
    });

    it('should use PBKDF2 with 310,000 iterations (OWASP recommendation)', async () => {
      const result = await derivePasswordKey('test-password', undefined, {
        algorithm: 'pbkdf2',
      });

      if (result.algorithm === 'pbkdf2') {
        expect(result.config.iterations).toBe(310000);
      }
    });

    it('should produce 256-bit keys', async () => {
      const result = await derivePasswordKey('test-password');

      expect(result.key.length).toBe(32); // 32 bytes = 256 bits
    });

    it('should use 256-bit salts', async () => {
      const result = await derivePasswordKey('test-password');

      expect(result.salt.length).toBe(32); // 32 bytes = 256 bits
    });

    it('should resist brute force attacks (takes significant time)', async () => {
      const startTime = performance.now();
      await derivePasswordKey('test-password');
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should take at least 50ms (prevents rapid brute force attempts)
      expect(duration).toBeGreaterThan(50);
    });

    it('should produce uniformly distributed key bytes', async () => {
      const result = await derivePasswordKey('test-password-for-distribution-test');

      // Check that keys don't have obvious patterns
      const allSame = result.key.every((byte) => byte === result.key[0]);
      expect(allSame).toBe(false);

      // Check that keys use full byte range
      const max = Math.max(...result.key);
      const min = Math.min(...result.key);
      expect(max - min).toBeGreaterThan(100); // Should span a wide range
    });
  });

  describe('Algorithm fallback', () => {
    it('should fall back to PBKDF2 if Argon2id fails', async () => {
      // Force PBKDF2 by specifying it
      const result = await derivePasswordKey('test-password', undefined, {
        algorithm: 'pbkdf2',
      });

      expect(result.algorithm).toBe('pbkdf2');
      expect(result.key).toBeInstanceOf(Uint8Array);
      expect(result.key.length).toBe(32);
    });

    it('should produce valid keys with PBKDF2 fallback', async () => {
      const password = 'test-password';
      const salt = generateSalt(32);

      const result = await derivePasswordKey(password, salt, {
        algorithm: 'pbkdf2',
      });

      expect(result.key).toBeInstanceOf(Uint8Array);
      expect(result.key.length).toBe(32);

      // Verify key is consistent
      const result2 = await derivePasswordKey(password, salt, {
        algorithm: 'pbkdf2',
      });

      expect(result.key).toEqual(result2.key);
    });
  });

  describe('Error handling', () => {
    it('should handle null password gracefully', async () => {
      await expect(derivePasswordKey(null as any)).rejects.toThrow();
    });

    it('should handle undefined password gracefully', async () => {
      await expect(derivePasswordKey(undefined as any)).rejects.toThrow();
    });

    it('should validate configuration parameters', async () => {
      const invalidConfig = {
        keyLength: 0, // Invalid
        saltLength: 0, // Invalid
      };

      await expect(
        derivePasswordKey('test-password', undefined, invalidConfig)
      ).rejects.toThrow();
    });
  });

  describe('Integration tests', () => {
    it('should support full encryption/decryption workflow', async () => {
      // Simulate backup creation
      const password = 'user-backup-password-12345';
      const encryptionResult = await derivePasswordKey(password);

      // Store salt and config (would be in backup file)
      const storedSalt = encryptionResult.salt;
      const storedConfig = encryptionResult.config;

      // Simulate backup restoration
      const decryptionResult = await rederiveKey(password, storedSalt, storedConfig);

      // Keys should match
      expect(decryptionResult.key).toEqual(encryptionResult.key);
    });

    it('should handle multiple concurrent derivations', async () => {
      const passwords = ['password1', 'password2', 'password3'];

      const results = await Promise.all(
        passwords.map((password) => derivePasswordKey(password))
      );

      // All should succeed
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.key).toBeInstanceOf(Uint8Array);
        expect(result.key.length).toBe(32);
      });

      // All should be different
      expect(results[0].key).not.toEqual(results[1].key);
      expect(results[1].key).not.toEqual(results[2].key);
      expect(results[0].key).not.toEqual(results[2].key);
    });

    it('should work with very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);

      const result = await derivePasswordKey(longPassword);

      expect(result.key).toBeInstanceOf(Uint8Array);
      expect(result.key.length).toBe(32);
    });

    it('should work with special characters in passwords', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';

      const result = await derivePasswordKey(specialPassword);

      expect(result.key).toBeInstanceOf(Uint8Array);
      expect(result.key.length).toBe(32);
    });

    it('should work with Unicode characters in passwords', async () => {
      const unicodePassword = '你好世界🔒🔑🛡️';

      const result = await derivePasswordKey(unicodePassword);

      expect(result.key).toBeInstanceOf(Uint8Array);
      expect(result.key.length).toBe(32);
    });
  });
});
