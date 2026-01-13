/**
 * Tests for Encryption Module
 *
 * Tests AES-256-GCM encryption/decryption functionality
 */

import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  decryptToBytes,
  encryptObject,
  decryptObject,
  reencrypt,
  batchEncrypt,
  batchDecrypt,
  verifyIntegrity,
  serializeEncryptedData,
  deserializeEncryptedData,
} from './encryption';
import type { MasterKey } from './types';

describe('Encryption Module', () => {
  let testKey: MasterKey;

  beforeEach(() => {
    // Create a test master key
    const keyMaterial = new Uint8Array(32);
    crypto.getRandomValues(keyMaterial);

    testKey = {
      id: 'test-key-id',
      keyMaterial,
      derivationParams: {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        salt: new Uint8Array(16),
        keyLength: 32,
      },
      createdAt: Date.now(),
    };
  });

  describe('encrypt', () => {
    it('should encrypt a string successfully', async () => {
      const plaintext = 'Hello, World!';
      const result = await encrypt(plaintext, testKey);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.ciphertext).toBeInstanceOf(Uint8Array);
      expect(result.data?.iv).toBeInstanceOf(Uint8Array);
      expect(result.data?.authTag).toBeInstanceOf(Uint8Array);
      expect(result.data?.keyId).toBe('test-key-id');
      expect(result.data?.algorithm).toBe('AES-256-GCM');
    });

    it('should encrypt Uint8Array successfully', async () => {
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await encrypt(plaintext, testKey);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should generate unique IV for each encryption', async () => {
      const plaintext = 'Same plaintext';
      const result1 = await encrypt(plaintext, testKey);
      const result2 = await encrypt(plaintext, testKey);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      const iv1 = result1.data?.iv;
      const iv2 = result2.data?.iv;

      expect(iv1).toBeDefined();
      expect(iv2).toBeDefined();
      expect(iv1).not.toEqual(iv2);
    });

    it('should include timestamp in encrypted data', async () => {
      const beforeTime = Date.now();
      const result = await encrypt('test', testKey);
      const afterTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.data?.encryptedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(result.data?.encryptedAt).toBeLessThanOrEqual(afterTime);
    });

    it('should handle empty string', async () => {
      const result = await encrypt('', testKey);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle large data', async () => {
      const largeText = 'A'.repeat(10000);
      const result = await encrypt(largeText, testKey);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted data successfully', async () => {
      const plaintext = 'Secret message';
      const encryptResult = await encrypt(plaintext, testKey);

      expect(encryptResult.success).toBe(true);
      expect(encryptResult.data).toBeDefined();

      const decryptResult = await decrypt(encryptResult.data!, testKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toBe(plaintext);
    });

    it('should fail with wrong key ID', async () => {
      const plaintext = 'Secret message';
      const encryptResult = await encrypt(plaintext, testKey);

      expect(encryptResult.success).toBe(true);
      expect(encryptResult.data).toBeDefined();

      const wrongKey = { ...testKey, id: 'wrong-key-id' };
      const decryptResult = await decrypt(encryptResult.data!, wrongKey);

      expect(decryptResult.success).toBe(false);
      expect(decryptResult.errorCode).toBe('INVALID_KEY');
      expect(decryptResult.error).toContain('Key ID mismatch');
    });

    it('should fail with wrong algorithm', async () => {
      const plaintext = 'Secret message';
      const encryptResult = await encrypt(plaintext, testKey);

      expect(encryptResult.success).toBe(true);
      expect(encryptResult.data).toBeDefined();

      const tamperedData = {
        ...encryptResult.data!,
        algorithm: 'WRONG-ALG' as any,
      };

      const decryptResult = await decrypt(tamperedData, testKey);

      expect(decryptResult.success).toBe(false);
      expect(decryptResult.error).toContain('Unsupported algorithm');
    });

    it('should fail with expired key', async () => {
      const plaintext = 'Secret message';
      const encryptResult = await encrypt(plaintext, testKey);

      expect(encryptResult.success).toBe(true);
      expect(encryptResult.data).toBeDefined();

      const expiredKey = {
        ...testKey,
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      };

      const decryptResult = await decrypt(encryptResult.data!, expiredKey);

      expect(decryptResult.success).toBe(false);
      expect(decryptResult.errorCode).toBe('KEY_EXPIRED');
    });

    it('should fail with tampered ciphertext', async () => {
      const plaintext = 'Secret message';
      const encryptResult = await encrypt(plaintext, testKey);

      expect(encryptResult.success).toBe(true);
      expect(encryptResult.data).toBeDefined();

      // Tamper with ciphertext
      const tamperedData = { ...encryptResult.data! };
      tamperedData.ciphertext = new Uint8Array(tamperedData.ciphertext);
      tamperedData.ciphertext[0] = tamperedData.ciphertext[0]! ^ 0xff;

      const decryptResult = await decrypt(tamperedData, testKey);

      expect(decryptResult.success).toBe(false);
      expect(decryptResult.errorCode).toBe('DECRYPTION_FAILED');
    });

    it('should fail with tampered auth tag', async () => {
      const plaintext = 'Secret message';
      const encryptResult = await encrypt(plaintext, testKey);

      expect(encryptResult.success).toBe(true);
      expect(encryptResult.data).toBeDefined();

      // Tamper with auth tag
      const tamperedData = { ...encryptResult.data! };
      tamperedData.authTag = new Uint8Array(tamperedData.authTag);
      tamperedData.authTag[0] = tamperedData.authTag[0]! ^ 0xff;

      const decryptResult = await decrypt(tamperedData, testKey);

      expect(decryptResult.success).toBe(false);
      expect(decryptResult.errorCode).toBe('DECRYPTION_FAILED');
    });

    it('should handle Unicode characters', async () => {
      const plaintext = '👋 Hello 世界 🌍';
      const encryptResult = await encrypt(plaintext, testKey);
      const decryptResult = await decrypt(encryptResult.data!, testKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toBe(plaintext);
    });
  });

  describe('decryptToBytes', () => {
    it('should decrypt to Uint8Array', async () => {
      const originalBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const encryptResult = await encrypt(originalBytes, testKey);
      const decryptResult = await decryptToBytes(encryptResult.data!, testKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(originalBytes);
    });

    it('should fail with wrong key ID', async () => {
      const plaintext = new Uint8Array([1, 2, 3]);
      const encryptResult = await encrypt(plaintext, testKey);

      const wrongKey = { ...testKey, id: 'wrong-key-id' };
      const decryptResult = await decryptToBytes(encryptResult.data!, wrongKey);

      expect(decryptResult.success).toBe(false);
      expect(decryptResult.errorCode).toBe('INVALID_KEY');
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize encrypted data', async () => {
      const plaintext = 'Test message';
      const encryptResult = await encrypt(plaintext, testKey);

      expect(encryptResult.success).toBe(true);
      expect(encryptResult.data).toBeDefined();

      const serialized = serializeEncryptedData(encryptResult.data!);

      expect(typeof serialized.ciphertext).toBe('string');
      expect(typeof serialized.iv).toBe('string');
      expect(typeof serialized.authTag).toBe('string');

      const deserialized = deserializeEncryptedData(serialized);

      expect(deserialized.ciphertext).toBeInstanceOf(Uint8Array);
      expect(deserialized.iv).toBeInstanceOf(Uint8Array);
      expect(deserialized.authTag).toBeInstanceOf(Uint8Array);
      expect(deserialized).toEqual(encryptResult.data);
    });

    it('should allow decryption after serialization roundtrip', async () => {
      const plaintext = 'Test message';
      const encryptResult = await encrypt(plaintext, testKey);

      const serialized = serializeEncryptedData(encryptResult.data!);
      const deserialized = deserializeEncryptedData(serialized);
      const decryptResult = await decrypt(deserialized, testKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toBe(plaintext);
    });
  });

  describe('encryptObject / decryptObject', () => {
    it('should encrypt and decrypt objects', async () => {
      const obj = { name: 'John', age: 30, active: true };
      const encryptResult = await encryptObject(obj, testKey);

      expect(encryptResult.success).toBe(true);
      expect(encryptResult.data).toBeDefined();

      const decryptResult = await decryptObject(encryptResult.data!, testKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(obj);
    });

    it('should handle nested objects', async () => {
      const obj = {
        user: { name: 'John', email: 'john@example.com' },
        settings: { theme: 'dark', notifications: true },
      };

      const encryptResult = await encryptObject(obj, testKey);
      const decryptResult = await decryptObject(encryptResult.data!, testKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(obj);
    });

    it('should handle arrays', async () => {
      const arr = [1, 2, 3, 'four', { five: 5 }];
      const encryptResult = await encryptObject(arr, testKey);
      const decryptResult = await decryptObject(encryptResult.data!, testKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(arr);
    });
  });

  describe('reencrypt', () => {
    it('should re-encrypt data with new key', async () => {
      const plaintext = 'Secret data';

      // Create old key
      const oldKey = testKey;

      // Create new key
      const newKeyMaterial = new Uint8Array(32);
      crypto.getRandomValues(newKeyMaterial);
      const newKey: MasterKey = {
        ...testKey,
        id: 'new-key-id',
        keyMaterial: newKeyMaterial,
      };

      // Encrypt with old key
      const encryptResult = await encrypt(plaintext, oldKey);
      expect(encryptResult.success).toBe(true);

      // Re-encrypt with new key
      const reencryptResult = await reencrypt(
        encryptResult.data!,
        oldKey,
        newKey
      );

      expect(reencryptResult.success).toBe(true);
      expect(reencryptResult.data?.keyId).toBe('new-key-id');

      // Verify new encryption can be decrypted with new key
      const decryptResult = await decrypt(reencryptResult.data!, newKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toBe(plaintext);

      // Verify old key can no longer decrypt
      const oldDecryptResult = await decrypt(reencryptResult.data!, oldKey);
      expect(oldDecryptResult.success).toBe(false);
    });

    it('should fail re-encryption with wrong old key', async () => {
      const plaintext = 'Secret data';
      const encryptResult = await encrypt(plaintext, testKey);

      const wrongKey = { ...testKey, id: 'wrong-id' };
      const newKey = { ...testKey, id: 'new-id' };

      const reencryptResult = await reencrypt(
        encryptResult.data!,
        wrongKey,
        newKey
      );

      expect(reencryptResult.success).toBe(false);
    });
  });

  describe('batch operations', () => {
    it('should batch encrypt multiple values', async () => {
      const values = ['value1', 'value2', 'value3'];
      const results = await batchEncrypt(values, testKey);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.data !== undefined)).toBe(true);
    });

    it('should batch decrypt multiple values', async () => {
      const values = ['value1', 'value2', 'value3'];
      const encryptResults = await batchEncrypt(values, testKey);
      const encryptedData = encryptResults
        .filter((r) => r.success && r.data)
        .map((r) => r.data!);

      const decryptResults = await batchDecrypt(encryptedData, testKey);

      expect(decryptResults).toHaveLength(3);
      expect(decryptResults.every((r) => r.success)).toBe(true);
      expect(decryptResults.map((r) => r.data)).toEqual(values);
    });

    it('should handle empty batch', async () => {
      const results = await batchEncrypt([], testKey);
      expect(results).toHaveLength(0);
    });

    it('should handle mixed success/failure in batch decrypt', async () => {
      const values = ['value1', 'value2'];
      const encryptResults = await batchEncrypt(values, testKey);
      const encryptedData = encryptResults
        .filter((r) => r.success && r.data)
        .map((r) => r.data!);

      // Tamper with second item
      encryptedData[1] = { ...encryptedData[1]!, keyId: 'wrong-id' };

      const decryptResults = await batchDecrypt(encryptedData, testKey);

      expect(decryptResults[0]?.success).toBe(true);
      expect(decryptResults[1]?.success).toBe(false);
    });
  });

  describe('verifyIntegrity', () => {
    it('should verify valid encrypted data', async () => {
      const plaintext = 'Test data';
      const encryptResult = await encrypt(plaintext, testKey);

      const isValid = await verifyIntegrity(encryptResult.data!, testKey);
      expect(isValid).toBe(true);
    });

    it('should detect tampered data', async () => {
      const plaintext = 'Test data';
      const encryptResult = await encrypt(plaintext, testKey);

      // Tamper with ciphertext
      const tamperedData = { ...encryptResult.data! };
      tamperedData.ciphertext = new Uint8Array(tamperedData.ciphertext);
      tamperedData.ciphertext[0] = tamperedData.ciphertext[0]! ^ 0xff;

      const isValid = await verifyIntegrity(tamperedData, testKey);
      expect(isValid).toBe(false);
    });

    it('should detect wrong key', async () => {
      const plaintext = 'Test data';
      const encryptResult = await encrypt(plaintext, testKey);

      const wrongKey = { ...testKey, id: 'wrong-id' };
      const isValid = await verifyIntegrity(encryptResult.data!, wrongKey);
      expect(isValid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very long strings', async () => {
      const longString = 'A'.repeat(100000);
      const encryptResult = await encrypt(longString, testKey);
      const decryptResult = await decrypt(encryptResult.data!, testKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toBe(longString);
    });

    it('should handle binary data with all byte values', async () => {
      const allBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        allBytes[i] = i;
      }

      const encryptResult = await encrypt(allBytes, testKey);
      const decryptResult = await decryptToBytes(encryptResult.data!, testKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(allBytes);
    });

    it('should handle special characters', async () => {
      const special = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~';
      const encryptResult = await encrypt(special, testKey);
      const decryptResult = await decrypt(encryptResult.data!, testKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toBe(special);
    });
  });
});
