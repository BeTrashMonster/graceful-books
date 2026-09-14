/**
 * Argon2id Performance Tuning Tests
 *
 * Tests different parameter combinations to find optimal settings:
 * - Target: ~1 second derivation time
 * - Current: ~3.4s with mem=65536, time=3, parallelism=4
 *
 * Also tests iOS Safari memory limits:
 * - iOS Safari has tighter WASM memory limits
 * - 64MB may fail on older devices
 *
 * Tradeoffs:
 * - Lower memory = faster but less resistant to GPU attacks
 * - Higher time cost = slower but more resistant to ASIC attacks
 * - Memory-hardness is Argon2id's primary advantage over PBKDF2
 */

import { test, expect } from '@playwright/test';

test.describe('Argon2id Performance Tuning', () => {
  test('benchmark different param combinations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await page.evaluate(async () => {
      const { loadArgon2 } = await import('/src/crypto/argon2Loader');
      const argon2 = await loadArgon2();

      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);

      const password = 'test-password-for-benchmark';

      // Test configurations - trading memory for time
      const configs = [
        // Current: 64MB, 3 iterations (~3.4s)
        { mem: 65536, time: 3, parallelism: 4, name: 'current-64MB-3iter' },

        // Reduced memory options
        { mem: 32768, time: 4, parallelism: 4, name: 'reduced-32MB-4iter' },
        { mem: 32768, time: 6, parallelism: 4, name: 'reduced-32MB-6iter' },
        { mem: 16384, time: 8, parallelism: 4, name: 'reduced-16MB-8iter' },
        { mem: 16384, time: 12, parallelism: 4, name: 'reduced-16MB-12iter' },

        // iOS-safe options (conservative memory)
        { mem: 8192, time: 16, parallelism: 4, name: 'ios-safe-8MB-16iter' },
        { mem: 4096, time: 32, parallelism: 4, name: 'ios-safe-4MB-32iter' },
      ];

      const results: Array<{
        name: string;
        mem: number;
        time: number;
        durationMs: number;
        success: boolean;
        error?: string;
      }> = [];

      for (const config of configs) {
        try {
          const startTime = performance.now();

          await argon2.hash({
            pass: password,
            salt: salt,
            time: config.time,
            mem: config.mem,
            parallelism: config.parallelism,
            hashLen: 32,
            type: argon2.ArgonType.Argon2id,
          });

          const duration = performance.now() - startTime;

          results.push({
            name: config.name,
            mem: config.mem,
            time: config.time,
            durationMs: Math.round(duration),
            success: true,
          });
        } catch (error) {
          results.push({
            name: config.name,
            mem: config.mem,
            time: config.time,
            durationMs: -1,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return results;
    });

    console.log('\n=== Argon2id Performance Benchmark ===\n');
    console.log('| Configuration | Memory | Time | Duration | Status |');
    console.log('|---------------|--------|------|----------|--------|');

    for (const r of results) {
      const memMB = (r.mem / 1024).toFixed(0);
      const status = r.success ? `${r.durationMs}ms` : `FAILED: ${r.error}`;
      console.log(`| ${r.name.padEnd(25)} | ${memMB.padStart(4)}MB | ${String(r.time).padStart(4)} | ${status.padStart(8)} |`);
    }

    // Find configurations that hit ~1s target
    const targetConfigs = results.filter(r => r.success && r.durationMs >= 800 && r.durationMs <= 1500);
    if (targetConfigs.length > 0) {
      console.log('\n=== Configurations near 1s target ===');
      for (const c of targetConfigs) {
        console.log(`${c.name}: ${c.durationMs}ms (mem=${c.mem}KB, time=${c.time})`);
      }
    }

    // At least one config should succeed
    expect(results.some(r => r.success)).toBe(true);
  });

  test('test iOS Safari memory limits', async ({ page, browserName }) => {
    // This test is most relevant on WebKit (Safari)
    test.skip(browserName !== 'webkit', 'iOS memory test only relevant for WebKit');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await page.evaluate(async () => {
      const { loadArgon2 } = await import('/src/crypto/argon2Loader');
      const argon2 = await loadArgon2();

      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);

      // Test increasing memory allocations to find Safari's limit
      const memoryLevels = [
        4096,   // 4MB
        8192,   // 8MB
        16384,  // 16MB
        32768,  // 32MB
        49152,  // 48MB
        65536,  // 64MB
        98304,  // 96MB
      ];

      const results: Array<{
        memKB: number;
        memMB: number;
        success: boolean;
        error?: string;
      }> = [];

      for (const mem of memoryLevels) {
        try {
          await argon2.hash({
            pass: 'test',
            salt: salt,
            time: 1, // Minimal iterations for speed
            mem: mem,
            parallelism: 1,
            hashLen: 32,
            type: 2, // Argon2id
          });

          results.push({
            memKB: mem,
            memMB: mem / 1024,
            success: true,
          });
        } catch (error) {
          results.push({
            memKB: mem,
            memMB: mem / 1024,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
          // Once we hit a failure, higher memory will also fail
          break;
        }
      }

      return results;
    });

    console.log('\n=== iOS Safari Memory Limit Test ===\n');
    for (const r of results) {
      console.log(`${r.memMB}MB: ${r.success ? 'OK' : `FAILED - ${r.error}`}`);
    }

    // Find max successful memory
    const maxSuccess = results.filter(r => r.success).pop();
    if (maxSuccess) {
      console.log(`\nMax successful memory: ${maxSuccess.memMB}MB`);
    }
  });

  test('time combined PBKDF2 + Argon2id migration path', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const { loadArgon2 } = await import('/src/crypto/argon2Loader');
      const argon2 = await loadArgon2();

      const password = 'test-password-for-migration';
      const oldSalt = new Uint8Array(16);
      const newSalt = new Uint8Array(16);
      crypto.getRandomValues(oldSalt);
      crypto.getRandomValues(newSalt);

      const totalStart = performance.now();

      // Step 1: PBKDF2 derivation (simulating login.ts formula)
      const pbkdf2Start = performance.now();
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );

      // Using login.ts formula: Math.max(timeCost * 10000, 100000)
      const iterations = Math.max(3 * 10000, 100000); // 100000

      await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: oldSalt,
          iterations: iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );
      const pbkdf2Duration = performance.now() - pbkdf2Start;

      // Step 2: Argon2id derivation (for new key)
      const argon2Start = performance.now();
      await argon2.hash({
        pass: password,
        salt: newSalt,
        time: 3,
        mem: 65536, // 64MB
        parallelism: 4,
        hashLen: 32,
        type: argon2.ArgonType.Argon2id,
      });
      const argon2Duration = performance.now() - argon2Start;

      const totalDuration = performance.now() - totalStart;

      return {
        pbkdf2Ms: Math.round(pbkdf2Duration),
        argon2Ms: Math.round(argon2Duration),
        totalMs: Math.round(totalDuration),
        iterations: iterations,
      };
    });

    console.log('\n=== Combined Migration Path Timing ===\n');
    console.log(`PBKDF2 (${result.iterations} iterations): ${result.pbkdf2Ms}ms`);
    console.log(`Argon2id (64MB, 3 iter): ${result.argon2Ms}ms`);
    console.log(`Total migration time: ${result.totalMs}ms`);
    console.log(`\nUser will see "upgrading security" for ~${(result.totalMs / 1000).toFixed(1)}s`);

    expect(result.totalMs).toBeGreaterThan(0);
  });

  test('verify UI renders before blocking operation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // This test verifies that we CAN show UI before blocking
    // The actual implementation would:
    // 1. Show "upgrading security" message
    // 2. Use setTimeout(0) or requestAnimationFrame to yield to renderer
    // 3. Then start the blocking KDF operation

    const result = await page.evaluate(async () => {
      const events: string[] = [];

      // Simulate the pattern we'd use in production
      events.push('1-show-ui');

      // Yield to renderer
      await new Promise(resolve => requestAnimationFrame(resolve));
      events.push('2-after-raf');

      // Now do blocking work
      const { loadArgon2 } = await import('/src/crypto/argon2Loader');
      const argon2 = await loadArgon2();

      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);

      const startTime = performance.now();
      await argon2.hash({
        pass: 'test',
        salt: salt,
        time: 1, // Quick test
        mem: 16384,
        parallelism: 4,
        hashLen: 32,
        type: 2,
      });
      const duration = performance.now() - startTime;

      events.push(`3-after-kdf-${Math.round(duration)}ms`);

      return { events, kdfDuration: Math.round(duration) };
    });

    console.log('\n=== UI Render Order ===');
    console.log('Events:', result.events);
    console.log(`KDF took: ${result.kdfDuration}ms`);

    // Verify events happened in order
    expect(result.events[0]).toBe('1-show-ui');
    expect(result.events[1]).toBe('2-after-raf');
    expect(result.events[2]).toMatch(/^3-after-kdf/);
  });
});
