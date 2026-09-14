/**
 * E2E Test: Verify Argon2id works in PRODUCTION BUILD
 *
 * THIS TEST MUST RUN AGAINST THE PRODUCTION BUILD, NOT DEV SERVER.
 * It exists because Argon2 was incorrectly reported as "fixed" 4 times
 * while only working in dev mode.
 *
 * Run this test with:
 *   npm run build && npm run preview -- --port 3008 &
 *   BASE_URL=http://localhost:3008 npx playwright test kdf-argon2-production.spec.ts
 *
 * Or use the npm script:
 *   npm run test:argon2:prod
 */

import { test, expect } from '@playwright/test';

test.describe('Argon2id in Production Build', () => {
  test.beforeAll(async () => {
    // Verify we're running against preview server, not dev server
    const baseUrl = process.env.BASE_URL || 'http://localhost:4173';
    console.log(`[PROD-TEST] Running against: ${baseUrl}`);
    console.log('[PROD-TEST] This test MUST run against production build (npm run preview)');
  });

  test('deriveMasterKey uses Argon2id NOT PBKDF2 in production', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);
      // Log Argon2/KDF related messages
      if (text.includes('Argon2') || text.includes('KDF') || text.includes('PBKDF2')) {
        console.log(`[BROWSER ${msg.type()}] ${text}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Call deriveMasterKey and check results
    const result = await page.evaluate(async () => {
      try {
        const { deriveMasterKey } = await import('/src/crypto/keyDerivation');

        const startTime = performance.now();
        const kdfResult = await deriveMasterKey(
          'production-build-argon2-test-passphrase',
          undefined,
          undefined,
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

    console.log('[PROD-TEST] Result:', JSON.stringify(result, null, 2));

    // Key derivation must succeed
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Duration should be >500ms for Argon2 with 64MB memory
    // PBKDF2 would be much faster (~50-100ms)
    expect(result.duration).toBeGreaterThan(500);
    console.log(`[PROD-TEST] Duration: ${result.duration}ms (Argon2 expected >500ms, PBKDF2 would be <200ms)`);

    // Check console for Argon2 confirmation
    const argon2ScriptLoaded = consoleMessages.find(m =>
      m.includes('[Argon2] Module loaded successfully via script tag')
    );
    const argon2Used = consoleMessages.find(m =>
      m.includes('[KDF] Key derived using Argon2id')
    );
    const pbkdf2Fallback = consoleMessages.find(m =>
      m.includes('falling back to PBKDF2')
    );

    console.log('[PROD-TEST] Argon2 script loaded:', argon2ScriptLoaded ? 'YES' : 'NO');
    console.log('[PROD-TEST] Argon2id used:', argon2Used ? 'YES' : 'NO');
    console.log('[PROD-TEST] PBKDF2 fallback:', pbkdf2Fallback ? 'FAIL - USING PBKDF2!' : 'NO (correct)');

    // CRITICAL: These assertions prevent shipping PBKDF2 while claiming Argon2id
    expect(argon2ScriptLoaded).toBeDefined();
    expect(argon2Used).toBeDefined();
    expect(pbkdf2Fallback).toBeUndefined();
  });

  test('argon2-bundled.min.js is served from production build', async ({ page }) => {
    // Verify the bundled script is accessible
    const response = await page.goto('/argon2-bundled.min.js');
    expect(response?.status()).toBe(200);

    const contentType = response?.headers()['content-type'];
    expect(contentType).toContain('javascript');

    // Verify it contains the WASM (base64 encoded)
    const content = await response?.text();
    expect(content).toContain('argon2'); // UMD wrapper sets window.argon2
    expect(content).toContain('AGFzbQEAAAA'); // WASM magic bytes in base64
  });
});
