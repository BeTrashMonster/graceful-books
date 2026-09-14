/**
 * SPIKE: Verify argon2-browser loads and derives a key in real browser
 *
 * This runs in Playwright (real Chromium), not jsdom.
 * Must pass before any Argon2id migration work proceeds.
 */

import { test, expect } from '@playwright/test';

test.describe('Argon2-browser WASM Spike', () => {
  test('should load argon2-browser via Vite', async ({ page }) => {
    // Navigate to app (Vite dev server)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Capture console messages for debugging
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
    });

    // Test what Vite actually exports for argon2-browser
    const result = await page.evaluate(async () => {
      try {
        // Use the Vite-transformed import via our loader
        const { loadArgon2 } = await import('/src/crypto/argon2Loader');
        const argon2 = await loadArgon2();

        console.log('[SPIKE] argon2 loaded:', typeof argon2);
        console.log('[SPIKE] argon2 keys:', Object.keys(argon2));
        console.log('[SPIKE] hash type:', typeof argon2.hash);

        // Check module loaded
        if (!argon2 || typeof argon2.hash !== 'function') {
          return {
            success: false,
            error: `hash is ${typeof argon2.hash}, not a function`,
            keys: Object.keys(argon2),
          };
        }

        // Generate a random salt
        const salt = new Uint8Array(16);
        crypto.getRandomValues(salt);

        const startTime = performance.now();

        // Derive a key using Argon2id
        const hashResult = await argon2.hash({
          pass: 'test-passphrase-for-spike',
          salt: salt,
          time: 3,        // iterations
          mem: 65536,     // 64MB in KB
          parallelism: 4,
          hashLen: 32,    // 256 bits
          type: argon2.ArgonType.Argon2id,
        });

        const duration = performance.now() - startTime;

        return {
          success: true,
          hashLength: hashResult.hash.length,
          hashHex: hashResult.hashHex?.substring(0, 16) || 'N/A',
          duration: Math.round(duration),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        };
      }
    });

    console.log('[SPIKE] Result:', JSON.stringify(result, null, 2));

    // Assertions
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.hashLength).toBe(32);
      expect(result.duration).toBeGreaterThan(0);
      console.log(`[SPIKE] Argon2id derivation successful in ${result.duration}ms`);
    } else {
      console.error(`[SPIKE] FAILED: ${result.error}`);
      if (result.stack) console.error(result.stack);
    }
  });

  test('should produce consistent results for same input', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      try {
        const { loadArgon2 } = await import('/src/crypto/argon2Loader');
        const argon2 = await loadArgon2();

        // Fixed salt for consistency test
        const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

        const params = {
          pass: 'consistent-test-password',
          salt: salt,
          time: 3,
          mem: 65536,
          parallelism: 4,
          hashLen: 32,
          type: 2, // Argon2id
        };

        const result1 = await argon2.hash(params);
        const result2 = await argon2.hash(params);

        // Compare hashes
        const hash1 = Array.from(result1.hash);
        const hash2 = Array.from(result2.hash);
        const consistent = JSON.stringify(hash1) === JSON.stringify(hash2);

        return {
          success: consistent,
          hash1Hex: result1.hashHex?.substring(0, 16),
          hash2Hex: result2.hashHex?.substring(0, 16),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    console.log('[SPIKE] Consistency result:', JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
  });
});
