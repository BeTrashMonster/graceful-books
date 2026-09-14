/**
 * E2E Test: Verify deriveMasterKey uses Argon2id, NOT PBKDF2
 *
 * This test exercises the actual key derivation path used by backup/restore
 * and verifies via console logs that Argon2id is being used.
 */

import { test, expect } from '@playwright/test';

test.describe('Key Derivation uses Argon2id', () => {
  test('deriveMasterKey should use Argon2id not PBKDF2', async ({ page }) => {
    // Collect console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);
      console.log(`[BROWSER ${msg.type()}] ${text}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Call deriveMasterKey through the browser and check logs
    const result = await page.evaluate(async () => {
      try {
        // Import the real deriveMasterKey function
        const { deriveMasterKey } = await import('/src/crypto/keyDerivation');

        // Call it with a test passphrase (skipping rate limit for test)
        const startTime = performance.now();
        const kdfResult = await deriveMasterKey(
          'test-passphrase-for-argon2-verification',
          undefined, // let it generate salt
          undefined, // default params
          { skipRateLimit: true }
        );
        const duration = performance.now() - startTime;

        return {
          success: kdfResult.success,
          keyIdPrefix: kdfResult.data?.id?.substring(0, 16),
          duration: Math.round(duration),
          error: kdfResult.error,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    console.log('[TEST] Result:', JSON.stringify(result, null, 2));
    console.log('[TEST] Console messages captured:', consoleMessages.length);

    // Key derivation should succeed
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Duration should be >500ms for Argon2 with 64MB memory
    // PBKDF2 would be much faster
    expect(result.duration).toBeGreaterThan(500);
    console.log(`[TEST] Key derivation took ${result.duration}ms (Argon2 expected >500ms)`);

    // Check console messages for Argon2 success
    const argon2LoadedMsg = consoleMessages.find(m =>
      m.includes('[KDF] Argon2 module loaded successfully')
    );
    const argon2UsedMsg = consoleMessages.find(m =>
      m.includes('[KDF] Key derived using Argon2id')
    );
    const pbkdf2FallbackMsg = consoleMessages.find(m =>
      m.includes('falling back to PBKDF2')
    );

    console.log('[TEST] Argon2 loaded message:', argon2LoadedMsg || 'NOT FOUND');
    console.log('[TEST] Argon2 used message:', argon2UsedMsg || 'NOT FOUND');
    console.log('[TEST] PBKDF2 fallback message:', pbkdf2FallbackMsg || 'NOT FOUND (good!)');

    // CRITICAL ASSERTIONS
    // Argon2 should have been loaded
    expect(argon2LoadedMsg).toBeDefined();

    // Argon2id should have been used
    expect(argon2UsedMsg).toBeDefined();

    // PBKDF2 fallback should NOT have been triggered
    expect(pbkdf2FallbackMsg).toBeUndefined();
  });
});
