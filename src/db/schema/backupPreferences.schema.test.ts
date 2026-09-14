/**
 * Backup Preferences Schema Tests
 *
 * Tests for passphrase sentinel verification and auto-key generation.
 * Covers the security-critical paths for encrypted backup passphrase handling.
 */

import { describe, it, expect } from 'vitest';
import {
  generateAutoBackupKey,
  createPassphraseSentinel,
  verifyPassphraseSentinel,
  SENTINEL_PLAINTEXT,
} from './backupPreferences.schema';

describe('backupPreferences.schema', () => {
  describe('generateAutoBackupKey', () => {
    it('should generate a base64-encoded key from 32 random bytes', () => {
      const key = generateAutoBackupKey();

      // Base64 encoding of 32 bytes = 44 characters (with padding)
      // 32 bytes * 8 bits / 6 bits per base64 char = 42.67, rounded up with padding = 44
      expect(key.length).toBe(44);

      // Should be valid base64
      expect(() => atob(key)).not.toThrow();

      // Decoded should be exactly 32 bytes
      const decoded = atob(key);
      expect(decoded.length).toBe(32);
    });

    it('should generate different keys each time (256-bit entropy)', () => {
      const keys = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        keys.add(generateAutoBackupKey());
      }

      // All keys should be unique (entropy test)
      expect(keys.size).toBe(iterations);
    });

    it('should use crypto.getRandomValues for true randomness', () => {
      // Verify the key has high entropy by checking byte distribution
      const samples = 1000;
      const byteCounts = new Array(256).fill(0);

      for (let i = 0; i < samples; i++) {
        const key = generateAutoBackupKey();
        const decoded = atob(key);
        for (let j = 0; j < decoded.length; j++) {
          byteCounts[decoded.charCodeAt(j)]++;
        }
      }

      // With 32 bytes * 1000 samples = 32000 bytes total
      // Expected count per byte value: 32000 / 256 = 125
      // Check that distribution is reasonably uniform (not all zeros or sequential)
      const nonZeroCounts = byteCounts.filter((c) => c > 0);
      // Should have coverage across most byte values (at least 200 out of 256)
      expect(nonZeroCounts.length).toBeGreaterThan(200);
    });
  });

  describe('createPassphraseSentinel', () => {
    it('should create sentinel with ciphertext, iv, and salt', async () => {
      const passphrase = 'test-passphrase-12345';
      const sentinel = await createPassphraseSentinel(passphrase);

      expect(sentinel.ciphertext).toBeDefined();
      expect(sentinel.iv).toBeDefined();
      expect(sentinel.salt).toBeDefined();

      // All should be valid base64
      expect(() => atob(sentinel.ciphertext)).not.toThrow();
      expect(() => atob(sentinel.iv)).not.toThrow();
      expect(() => atob(sentinel.salt)).not.toThrow();
    });

    it('should produce different sentinels for same passphrase (different salt/iv)', async () => {
      const passphrase = 'test-passphrase-12345';

      const sentinel1 = await createPassphraseSentinel(passphrase);
      const sentinel2 = await createPassphraseSentinel(passphrase);

      // Salt should be different
      expect(sentinel1.salt).not.toBe(sentinel2.salt);

      // IV should be different
      expect(sentinel1.iv).not.toBe(sentinel2.iv);

      // Ciphertext should be different (due to different salt/iv)
      expect(sentinel1.ciphertext).not.toBe(sentinel2.ciphertext);
    });

    it('should use 16-byte salt and 12-byte IV', async () => {
      const passphrase = 'test-passphrase-12345';
      const sentinel = await createPassphraseSentinel(passphrase);

      const saltBytes = atob(sentinel.salt);
      const ivBytes = atob(sentinel.iv);

      expect(saltBytes.length).toBe(16); // 16 bytes for PBKDF2 salt
      expect(ivBytes.length).toBe(12); // 12 bytes for AES-GCM IV
    });
  });

  describe('verifyPassphraseSentinel', () => {
    it('should return true for correct passphrase', async () => {
      const passphrase = 'correct-passphrase-12345';

      // Create sentinel
      const sentinel = await createPassphraseSentinel(passphrase);

      // Verify with same passphrase
      const isValid = await verifyPassphraseSentinel(
        passphrase,
        sentinel.ciphertext,
        sentinel.iv,
        sentinel.salt
      );

      expect(isValid).toBe(true);
    });

    it('should return false for incorrect passphrase', async () => {
      const correctPassphrase = 'correct-passphrase-12345';
      const wrongPassphrase = 'wrong-passphrase-67890';

      // Create sentinel with correct passphrase
      const sentinel = await createPassphraseSentinel(correctPassphrase);

      // Verify with wrong passphrase
      const isValid = await verifyPassphraseSentinel(
        wrongPassphrase,
        sentinel.ciphertext,
        sentinel.iv,
        sentinel.salt
      );

      expect(isValid).toBe(false);
    });

    it('should return false for similar but different passphrase', async () => {
      const passphrase = 'MySecurePassphrase123';
      const similarPassphrase = 'MySecurePassphrase124'; // One character different

      const sentinel = await createPassphraseSentinel(passphrase);

      const isValid = await verifyPassphraseSentinel(
        similarPassphrase,
        sentinel.ciphertext,
        sentinel.iv,
        sentinel.salt
      );

      expect(isValid).toBe(false);
    });

    it('should return false for corrupted ciphertext', async () => {
      const passphrase = 'test-passphrase-12345';
      const sentinel = await createPassphraseSentinel(passphrase);

      // Corrupt the ciphertext
      const corruptedCiphertext = 'YWJjZGVmZ2hpamtsbW5vcA=='; // Random valid base64

      const isValid = await verifyPassphraseSentinel(
        passphrase,
        corruptedCiphertext,
        sentinel.iv,
        sentinel.salt
      );

      expect(isValid).toBe(false);
    });

    it('should return false for corrupted IV', async () => {
      const passphrase = 'test-passphrase-12345';
      const sentinel = await createPassphraseSentinel(passphrase);

      // Use a different IV
      const differentIv = btoa('differentiv!'); // 12 bytes

      const isValid = await verifyPassphraseSentinel(
        passphrase,
        sentinel.ciphertext,
        differentIv,
        sentinel.salt
      );

      expect(isValid).toBe(false);
    });

    it('should return false for corrupted salt', async () => {
      const passphrase = 'test-passphrase-12345';
      const sentinel = await createPassphraseSentinel(passphrase);

      // Use a different salt
      const differentSalt = btoa('differentsalt!!'); // 16 bytes

      const isValid = await verifyPassphraseSentinel(
        passphrase,
        sentinel.ciphertext,
        sentinel.iv,
        differentSalt
      );

      expect(isValid).toBe(false);
    });

    it('should handle empty passphrase gracefully', async () => {
      const passphrase = 'test-passphrase-12345';
      const sentinel = await createPassphraseSentinel(passphrase);

      const isValid = await verifyPassphraseSentinel(
        '',
        sentinel.ciphertext,
        sentinel.iv,
        sentinel.salt
      );

      expect(isValid).toBe(false);
    });

    it('should verify that sentinel decrypts to known plaintext', async () => {
      // This test verifies the sentinel pattern works correctly
      // by checking that the correct passphrase produces the expected plaintext
      const passphrase = 'verification-test-passphrase';
      const sentinel = await createPassphraseSentinel(passphrase);

      // The sentinel should verify because it decrypts to SENTINEL_PLAINTEXT
      const isValid = await verifyPassphraseSentinel(
        passphrase,
        sentinel.ciphertext,
        sentinel.iv,
        sentinel.salt
      );

      expect(isValid).toBe(true);
      // SENTINEL_PLAINTEXT is the known string we encrypt
      expect(SENTINEL_PLAINTEXT).toBe('GRACEFUL_BOOKS_BACKUP_SENTINEL_V1');
    });
  });

  describe('backup workflow integration', () => {
    it('manual mode: correct passphrase allows backup to proceed', async () => {
      const userPassphrase = 'user-chosen-passphrase-123';

      // First backup: create sentinel
      const sentinel = await createPassphraseSentinel(userPassphrase);

      // Subsequent backup: verify passphrase
      const canProceed = await verifyPassphraseSentinel(
        userPassphrase,
        sentinel.ciphertext,
        sentinel.iv,
        sentinel.salt
      );

      expect(canProceed).toBe(true);
    });

    it('manual mode: wrong passphrase blocks backup', async () => {
      const originalPassphrase = 'original-passphrase-123';
      const attemptedPassphrase = 'forgot-my-passphrase';

      // First backup: create sentinel with original
      const sentinel = await createPassphraseSentinel(originalPassphrase);

      // Subsequent backup: try with wrong passphrase
      const canProceed = await verifyPassphraseSentinel(
        attemptedPassphrase,
        sentinel.ciphertext,
        sentinel.iv,
        sentinel.salt
      );

      expect(canProceed).toBe(false);
    });

    it('auto mode: generated key has sufficient entropy for encryption', () => {
      const key = generateAutoBackupKey();

      // Key should be usable as a passphrase for backup encryption
      // Verify it's long enough and has good character distribution
      expect(key.length).toBeGreaterThanOrEqual(32);

      // The key is 256 bits = 32 bytes, which when base64 encoded is 44 chars
      // This provides far more entropy than any user-chosen passphrase
    });
  });
});
