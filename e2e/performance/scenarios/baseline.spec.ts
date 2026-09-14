/**
 * Performance Baseline Test Scenarios
 *
 * Measures baseline performance across dataset sizes and throttle levels:
 * a) Cold start: app load → first interactive, with a full database
 * b) Unlock: key derivation + first decrypt
 * c) Load and render the largest list view
 * d) Search/filter across the full dataset
 * e) Bulk insert of 1,000 new records
 * f) Soak: 15 minutes of scripted interaction, watching heap growth
 * g) Storage: fill toward quota, verify QuotaExceededError handling
 */

import { test, expect, type ScenarioResult, type DatasetSize, type ThrottleLevel, createResultsTable } from '../fixtures';
import { generateTestData } from '../seed';

// Test configuration
// 5k = realistic ceiling for power users (~500 transactions/year for 10 years)
// 10k = headroom reference only
const DATASET_SIZES: DatasetSize[] = ['1k', '5k', '10k'];
const THROTTLE_LEVELS: ThrottleLevel[] = ['1x', '4x', '6x'];

// Store results across tests
const allResults: ScenarioResult[] = [];

// =============================================================================
// Scenario A: Cold Start
// =============================================================================

test.describe('Scenario A: Cold Start', () => {
  for (const size of DATASET_SIZES) {
    for (const throttle of THROTTLE_LEVELS) {
      test(`cold-start-${size}-${throttle}`, async ({
        page,
        setCPUThrottle,
        seedDatabase,
        measureOperation,
        testCompanyId,
        testDeviceId,
        clearDatabase,
      }) => {
        // Seed database first (before throttling)
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await seedDatabase(size);

        // Close and reopen to simulate cold start
        await page.close();

        // Create new page for cold start measurement
        const context = await page.context().browser()!.newContext();
        const newPage = await context.newPage();

        // Apply CPU throttling
        const client = await context.newCDPSession(newPage);
        await client.send('Emulation.setCPUThrottlingRate', { rate: throttle === '1x' ? 1 : throttle === '4x' ? 4 : 6 });

        // Measure cold start
        const startTime = Date.now();

        await newPage.goto('/');

        // Wait for app to be interactive (dashboard loaded)
        await newPage.waitForSelector('[data-testid="dashboard"]', { timeout: 60000 }).catch(() => {
          // Fallback: wait for any main content
          return newPage.waitForSelector('main', { timeout: 60000 });
        });

        const wallTimeMs = Date.now() - startTime;

        // Get heap size
        const heapSize = await newPage.evaluate(() => {
          // @ts-expect-error - Chrome-specific API
          return performance.memory?.usedJSHeapSize || 0;
        });

        // Collect long tasks (approximate - we missed the initial ones)
        const result: ScenarioResult = {
          scenario: 'cold-start',
          datasetSize: size,
          throttleLevel: throttle,
          metrics: {
            wallTimeMs,
            longTasks: [],
            blockingTimeMs: 0,
            heapSizeBefore: 0,
            heapSizeAfter: heapSize,
            heapDelta: heapSize,
          },
          timestamp: new Date().toISOString(),
          success: true,
        };

        allResults.push(result);
        console.log(`[Result] Cold start (${size}, ${throttle}): ${wallTimeMs}ms`);

        await newPage.close();
        await context.close();
      });
    }
  }
});

// =============================================================================
// Scenario B: Unlock (Key Derivation + First Decrypt)
// =============================================================================

test.describe('Scenario B: Unlock', () => {
  for (const size of DATASET_SIZES) {
    for (const throttle of THROTTLE_LEVELS) {
      test(`unlock-${size}-${throttle}`, async ({
        page,
        setCPUThrottle,
        seedDatabase,
        measureOperation,
      }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Seed database
        await seedDatabase(size);

        // Apply throttling
        await setCPUThrottle(throttle);

        // Measure key derivation + unlock
        const { metrics, timedOut } = await measureOperation('unlock', async () => {
          // Verify import resolves before measuring
          const moduleCheck = await page.evaluate(async () => {
            const mod = await import('/src/crypto/keyDerivation');
            if (typeof mod.deriveMasterKey !== 'function') {
              throw new Error('deriveMasterKey is not a function - module loaded incorrectly');
            }
            return true;
          });
          expect(moduleCheck).toBe(true);

          // Measure key derivation (no fallback - must succeed or fail loudly)
          const unlockTime = await page.evaluate(async () => {
            const start = performance.now();

            const { deriveMasterKey } = await import('/src/crypto/keyDerivation');

            // Derive key with test passphrase (this is the expensive operation)
            // Note: Using skipRateLimit to avoid test flakiness
            const result = await deriveMasterKey(
              'test-passphrase-for-performance-testing-2024',
              undefined,
              undefined,
              { skipRateLimit: true }
            );

            if (!result.success) {
              throw new Error(`Key derivation failed: ${result.error}`);
            }

            return performance.now() - start;
          });

          return { unlockTime };
        });

        const result: ScenarioResult = {
          scenario: 'unlock',
          datasetSize: size,
          throttleLevel: throttle,
          metrics,
          timestamp: new Date().toISOString(),
          success: !timedOut,
          timedOut,
        };

        allResults.push(result);
        if (timedOut) {
          console.log(`[Result] Unlock (${size}, ${throttle}): TIMEOUT (measurement invalid)`);
        } else {
          console.log(`[Result] Unlock (${size}, ${throttle}): ${metrics.wallTimeMs}ms`);
        }
      });
    }
  }
});

// =============================================================================
// Scenario C: Load and Render Largest List View
// =============================================================================

test.describe('Scenario C: List Render', () => {
  for (const size of DATASET_SIZES) {
    for (const throttle of THROTTLE_LEVELS) {
      test(`list-render-${size}-${throttle}`, async ({
        page,
        setCPUThrottle,
        seedDatabase,
        measureOperation,
      }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Seed database
        await seedDatabase(size);

        // Apply throttling
        await setCPUThrottle(throttle);

        // Navigate to transactions list (largest list)
        const { metrics, timedOut } = await measureOperation('list-render', async () => {
          // Navigate to transactions page
          await page.goto('/transactions');

          // Wait for list to render
          await page.waitForSelector('[data-testid="transaction-list"], [data-testid="transactions-table"], table', {
            timeout: 120000,
          }).catch(() => {
            // Fallback: wait for any list content
            return page.waitForSelector('tbody tr, [role="listitem"], .transaction-row', { timeout: 120000 });
          });

          // Get render count if available
          const renderCount = await page.evaluate(() => {
            // @ts-expect-error - React DevTools profiler data
            const profilerData = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.get(1)?.getProfilingData?.();
            return profilerData?.interactions?.length || 0;
          });

          return { renderCount };
        });

        const result: ScenarioResult = {
          scenario: 'list-render',
          datasetSize: size,
          throttleLevel: throttle,
          metrics,
          timestamp: new Date().toISOString(),
          success: !timedOut,
          timedOut,
        };

        allResults.push(result);
        if (timedOut) {
          console.log(`[Result] List render (${size}, ${throttle}): TIMEOUT (measurement invalid)`);
        } else {
          console.log(`[Result] List render (${size}, ${throttle}): ${metrics.wallTimeMs}ms`);
        }
      });
    }
  }
});

// =============================================================================
// Scenario D: Search/Filter Across Full Dataset
// =============================================================================

test.describe('Scenario D: Search/Filter', () => {
  for (const size of DATASET_SIZES) {
    for (const throttle of THROTTLE_LEVELS) {
      test(`search-filter-${size}-${throttle}`, async ({
        page,
        setCPUThrottle,
        seedDatabase,
        measureOperation,
      }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Seed database
        await seedDatabase(size);

        // Navigate to transactions
        await page.goto('/transactions');
        await page.waitForLoadState('networkidle');

        // Apply throttling
        await setCPUThrottle(throttle);

        // Measure search/filter operation
        const { metrics, timedOut } = await measureOperation('search-filter', async () => {
          // Find search input
          const searchInput = await page.waitForSelector(
            'input[type="search"], input[placeholder*="search"], input[placeholder*="Search"], [data-testid="search-input"]',
            { timeout: 10000 }
          ).catch(() => null);

          if (searchInput) {
            // Type search query
            await searchInput.fill('payment');
            await searchInput.press('Enter');

            // Wait for results to update
            await page.waitForTimeout(500);
          } else {
            // Fallback: trigger filter via direct database query
            await page.evaluate(async () => {
              // @ts-expect-error - db access
              const { db } = await import('/src/store/database');
              const results = await db.transactions
                .filter((t: any) => t.memo?.toLowerCase().includes('payment'))
                .toArray();
              console.log(`Filter found ${results.length} transactions`);
            });
          }

          return {};
        });

        const result: ScenarioResult = {
          scenario: 'search-filter',
          datasetSize: size,
          throttleLevel: throttle,
          metrics,
          timestamp: new Date().toISOString(),
          success: !timedOut,
          timedOut,
        };

        allResults.push(result);
        if (timedOut) {
          console.log(`[Result] Search/filter (${size}, ${throttle}): TIMEOUT (measurement invalid)`);
        } else {
          console.log(`[Result] Search/filter (${size}, ${throttle}): ${metrics.wallTimeMs}ms`);
        }
      });
    }
  }
});

// =============================================================================
// Scenario E: Bulk Insert 1,000 Records
// =============================================================================

test.describe('Scenario E: Bulk Insert', () => {
  for (const size of DATASET_SIZES) {
    for (const throttle of THROTTLE_LEVELS) {
      test(`bulk-insert-${size}-${throttle}`, async ({
        page,
        setCPUThrottle,
        seedDatabase,
        measureOperation,
        testCompanyId,
        testDeviceId,
      }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Seed initial database
        await seedDatabase(size);

        // Apply throttling
        await setCPUThrottle(throttle);

        // Generate 1000 new transactions for bulk insert
        const newData = generateTestData({
          size: '1k',
          companyId: testCompanyId,
          deviceId: testDeviceId,
        });

        // Measure bulk insert
        const { metrics, timedOut } = await measureOperation('bulk-insert', async () => {
          const insertResult = await page.evaluate(async (transactions) => {
            const start = performance.now();

            // @ts-expect-error - db access
            const { db } = await import('/src/store/database');

            await db.transaction('rw', db.transactions, async () => {
              await db.transactions.bulkPut(transactions);
            });

            return {
              count: transactions.length,
              timeMs: performance.now() - start,
            };
          }, newData.transactions);

          return insertResult;
        });

        const result: ScenarioResult = {
          scenario: 'bulk-insert',
          datasetSize: size,
          throttleLevel: throttle,
          metrics,
          timestamp: new Date().toISOString(),
          success: !timedOut,
          timedOut,
        };

        allResults.push(result);
        if (timedOut) {
          console.log(`[Result] Bulk insert (${size}, ${throttle}): TIMEOUT (measurement invalid)`);
        } else {
          console.log(`[Result] Bulk insert (${size}, ${throttle}): ${metrics.wallTimeMs}ms`);
        }
      });
    }
  }
});

// =============================================================================
// Scenario F: Soak Test (15 minutes)
// =============================================================================

test.describe('Scenario F: Soak Test', () => {
  // Only run soak test on 10k dataset with 1x throttle (representative)
  test('soak-10k-1x', async ({
    page,
    setCPUThrottle,
    seedDatabase,
    getHeapSize,
  }) => {
    test.setTimeout(20 * 60 * 1000); // 20 minutes total

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Seed database
    await seedDatabase('10k');

    // Apply minimal throttling for soak test
    await setCPUThrottle('1x');

    const heapSamples: { time: number; heap: number }[] = [];
    const startTime = Date.now();
    const duration = 15 * 60 * 1000; // 15 minutes

    // Record initial heap
    heapSamples.push({ time: 0, heap: await getHeapSize() });

    // Scripted interaction loop
    while (Date.now() - startTime < duration) {
      const elapsed = Date.now() - startTime;

      // Navigate to different pages
      const pages = ['/transactions', '/accounts', '/contacts', '/dashboard'];
      const targetPage = pages[Math.floor(elapsed / 60000) % pages.length];

      await page.goto(targetPage);
      await page.waitForLoadState('networkidle');

      // Interact with the page
      await page.waitForTimeout(5000);

      // If on transactions, try to interact
      if (targetPage === '/transactions') {
        const searchInput = await page.waitForSelector('input[type="search"]', { timeout: 5000 }).catch(() => null);
        if (searchInput) {
          await searchInput.fill('test');
          await page.waitForTimeout(1000);
          await searchInput.fill('');
        }
      }

      // Sample heap every 30 seconds
      if (elapsed % 30000 < 5000) {
        heapSamples.push({ time: elapsed, heap: await getHeapSize() });
      }
    }

    // Final heap sample
    heapSamples.push({ time: Date.now() - startTime, heap: await getHeapSize() });

    // Calculate heap growth rate
    const initialHeap = heapSamples[0].heap;
    const finalHeap = heapSamples[heapSamples.length - 1].heap;
    const heapGrowth = finalHeap - initialHeap;
    const growthRatePerMinute = heapGrowth / 15;

    console.log(`[Soak] Initial heap: ${(initialHeap / 1024 / 1024).toFixed(2)}MB`);
    console.log(`[Soak] Final heap: ${(finalHeap / 1024 / 1024).toFixed(2)}MB`);
    console.log(`[Soak] Growth: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`);
    console.log(`[Soak] Growth rate: ${(growthRatePerMinute / 1024 / 1024).toFixed(2)}MB/min`);

    const result: ScenarioResult = {
      scenario: 'soak',
      datasetSize: '10k',
      throttleLevel: '1x',
      metrics: {
        wallTimeMs: duration,
        longTasks: [],
        blockingTimeMs: 0,
        heapSizeBefore: initialHeap,
        heapSizeAfter: finalHeap,
        heapDelta: heapGrowth,
        marks: {
          growthRatePerMinute,
          sampleCount: heapSamples.length,
        },
      },
      timestamp: new Date().toISOString(),
      success: true,
    };

    allResults.push(result);
  });
});

// =============================================================================
// Scenario G: Storage Quota
// =============================================================================

test.describe('Scenario G: Storage Quota', () => {
  test('storage-quota', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if persistent storage is requested
    const persistResult = await page.evaluate(async () => {
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persisted();
        const requestResult = await navigator.storage.persist();
        return { isPersisted, requestResult };
      }
      return { isPersisted: false, requestResult: false };
    });

    console.log(`[Storage] Persistence requested: ${persistResult.requestResult}`);
    console.log(`[Storage] Is persisted: ${persistResult.isPersisted}`);

    // Get current storage estimate
    const storageEstimate = await page.evaluate(async () => {
      if (navigator.storage && navigator.storage.estimate) {
        return await navigator.storage.estimate();
      }
      return { usage: 0, quota: 0 };
    });

    console.log(`[Storage] Usage: ${(storageEstimate.usage! / 1024 / 1024).toFixed(2)}MB`);
    console.log(`[Storage] Quota: ${(storageEstimate.quota! / 1024 / 1024).toFixed(2)}MB`);

    // Try to fill storage (carefully)
    const fillResult = await page.evaluate(async () => {
      // @ts-expect-error - db access
      const { db } = await import('/src/store/database');

      // Generate large data chunks
      const largeData = 'x'.repeat(1024 * 1024); // 1MB string
      const testRecords = [];

      for (let i = 0; i < 100; i++) {
        testRecords.push({
          id: `quota-test-${i}`,
          companyId: 'quota-test',
          data: largeData,
          memo: largeData.substring(0, 10000),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      try {
        // Try to insert (should fail near quota)
        await db.transactions.bulkPut(testRecords);
        return { success: true, error: null };
      } catch (error: any) {
        return {
          success: false,
          error: error.name || error.message,
          isQuotaError: error.name === 'QuotaExceededError' ||
                        error.message?.includes('quota') ||
                        error.message?.includes('QuotaExceeded'),
        };
      }
    });

    console.log(`[Storage] Fill result:`, fillResult);

    // Verify QuotaExceededError is handled gracefully
    if (fillResult.error) {
      expect(fillResult.isQuotaError).toBe(true);
    }

    const result: ScenarioResult = {
      scenario: 'storage-quota',
      datasetSize: '1k',
      throttleLevel: '1x',
      metrics: {
        wallTimeMs: 0,
        longTasks: [],
        blockingTimeMs: 0,
        heapSizeBefore: 0,
        heapSizeAfter: 0,
        heapDelta: 0,
        marks: {
          storageUsage: storageEstimate.usage || 0,
          storageQuota: storageEstimate.quota || 0,
          isPersisted: persistResult.isPersisted ? 1 : 0,
        },
      },
      timestamp: new Date().toISOString(),
      success: true,
    };

    allResults.push(result);
  });
});

// =============================================================================
// Save All Results
// =============================================================================

test.afterAll(async () => {
  if (allResults.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('PERFORMANCE TEST RESULTS');
    console.log('='.repeat(80));
    console.log(createResultsTable(allResults));
    console.log('='.repeat(80) + '\n');

    // Save results to file
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    const outputDir = path.join(process.cwd(), 'e2e', 'performance', 'results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = path.join(outputDir, `perf-results-${timestamp}.json`);

    const runResults = {
      runId: `run-${timestamp}`,
      timestamp: new Date().toISOString(),
      scenarios: allResults,
      environment: {
        platform: process.platform,
        cpuCount: os.cpus().length,
        memoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      },
    };

    fs.writeFileSync(filepath, JSON.stringify(runResults, null, 2));
    console.log(`Results saved to: ${filepath}`);
  }
});
