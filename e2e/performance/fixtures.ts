/**
 * Playwright Performance Test Fixtures
 *
 * Provides fixtures for performance measurement:
 * - CPU throttling via CDP (Emulation.setCPUThrottlingRate)
 * - Dataset seeding at parameterized sizes
 * - Performance metrics collection (wall time, long tasks, heap size, render counts)
 * - Results output to JSON
 */

import { test as base, expect, type Page, type BrowserContext, type CDPSession } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { generateTestData, SIZE_CONFIG, type DatasetSize, type SeedResult } from './seed';

// =============================================================================
// Types
// =============================================================================

export type ThrottleLevel = '1x' | '4x' | '6x';

export interface PerformanceMetrics {
  /** Total wall clock time in ms */
  wallTimeMs: number;
  /** Long tasks (>50ms) captured via PerformanceObserver */
  longTasks: LongTaskEntry[];
  /** Total main thread blocking time in ms */
  blockingTimeMs: number;
  /** JS heap size before operation (bytes) */
  heapSizeBefore: number;
  /** JS heap size after operation (bytes) */
  heapSizeAfter: number;
  /** Heap size delta (bytes) */
  heapDelta: number;
  /** Number of React renders for key component (if applicable) */
  reactRenderCount?: number;
  /** Additional timing marks */
  marks?: Record<string, number>;
}

export interface LongTaskEntry {
  name: string;
  startTime: number;
  duration: number;
  attribution?: string;
}

export interface ScenarioResult {
  scenario: string;
  datasetSize: DatasetSize;
  throttleLevel: ThrottleLevel;
  metrics: PerformanceMetrics;
  timestamp: string;
  success: boolean;
  /** True if the operation timed out - wallTimeMs is NOT a valid measurement */
  timedOut?: boolean;
  error?: string;
}

export interface TestRunResults {
  runId: string;
  timestamp: string;
  scenarios: ScenarioResult[];
  environment: {
    platform: string;
    cpuCount: number;
    memoryGB: number;
  };
}

// =============================================================================
// Fixture Configuration
// =============================================================================

const THROTTLE_RATES: Record<ThrottleLevel, number> = {
  '1x': 1,
  '4x': 4,
  '6x': 6,
};

// =============================================================================
// Performance Fixtures
// =============================================================================

type PerformanceFixtures = {
  /** Current CPU throttle level */
  throttleLevel: ThrottleLevel;
  /** Current dataset size */
  datasetSize: DatasetSize;
  /** Apply CPU throttling via CDP */
  setCPUThrottle: (level: ThrottleLevel) => Promise<void>;
  /** Seed database with test data */
  seedDatabase: (size: DatasetSize) => Promise<SeedResult>;
  /** Collect performance metrics for an operation */
  measureOperation: <T>(
    name: string,
    operation: () => Promise<T>,
    options?: { timeoutMs?: number }
  ) => Promise<{ result: T | null; metrics: PerformanceMetrics; timedOut: boolean }>;
  /** Save results to JSON file */
  saveResults: (results: ScenarioResult[]) => Promise<string>;
  /** Get current heap size */
  getHeapSize: () => Promise<number>;
  /** Clear database */
  clearDatabase: () => Promise<void>;
  /** Company ID for test data */
  testCompanyId: string;
  /** Device ID for test data */
  testDeviceId: string;
};

export const test = base.extend<PerformanceFixtures>({
  // Default throttle level (can be overridden per test)
  throttleLevel: ['1x', { option: true }],

  // Default dataset size (can be overridden per test)
  datasetSize: ['1k', { option: true }],

  // Test identifiers
  testCompanyId: 'perf-test-company-001',
  testDeviceId: 'perf-test-device-001',

  // CDP throttling - reuse session to ensure throttling persists
  setCPUThrottle: async ({ page }, use) => {
    // Create CDP session once and reuse it
    let cdpSession: CDPSession | null = null;

    const setCPUThrottle = async (level: ThrottleLevel) => {
      // Create session on first use
      if (!cdpSession) {
        cdpSession = await page.context().newCDPSession(page);
      }

      const rate = THROTTLE_RATES[level];
      await cdpSession.send('Emulation.setCPUThrottlingRate', { rate });
      console.log(`[Perf] CPU throttling set to ${level} (rate: ${rate})`);
    };

    await use(setCPUThrottle);

    // Cleanup: reset throttling when done
    if (cdpSession) {
      try {
        await cdpSession.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        await cdpSession.detach();
      } catch {
        // Session may already be closed
      }
    }
  },

  // Database seeding
  seedDatabase: async ({ page, testCompanyId, testDeviceId }, use) => {
    const seedDatabase = async (size: DatasetSize): Promise<SeedResult> => {
      console.log(`[Perf] Seeding database with ${size} dataset...`);

      // Generate test data
      const data = generateTestData({
        size,
        companyId: testCompanyId,
        deviceId: testDeviceId,
      });

      const startTime = Date.now();

      // Verify DB import resolves (no fallback - must succeed or fail loudly)
      const dbCheck = await page.evaluate(async () => {
        const mod = await import('/src/store/database');
        if (!mod.db || typeof mod.db.transaction !== 'function') {
          throw new Error('db is not a valid Dexie instance - module loaded incorrectly');
        }
        return true;
      });
      if (!dbCheck) {
        throw new Error('Database module verification failed');
      }

      // Insert data via page context (uses real Dexie instance)
      const result = await page.evaluate(async ({ accounts, contacts, products, transactions }) => {
        const { db } = await import('/src/store/database');

        const insertStart = performance.now();

        // Use transactions for atomic inserts
        await db.transaction('rw', [db.accounts, db.contacts, db.products, db.transactions], async () => {
          if (accounts.length > 0) await db.accounts.bulkPut(accounts);
          if (contacts.length > 0) await db.contacts.bulkPut(contacts);
          if (products.length > 0) await db.products.bulkPut(products);
          if (transactions.length > 0) await db.transactions.bulkPut(transactions);
        });

        const insertTime = performance.now() - insertStart;

        return {
          accounts: accounts.length,
          contacts: contacts.length,
          products: products.length,
          transactions: transactions.length,
          totalRecords: accounts.length + contacts.length + products.length + transactions.length,
          insertTimeMs: insertTime,
        };
      }, data);

      const totalTime = Date.now() - startTime;

      console.log(`[Perf] Seeding completed: ${result.totalRecords} records in ${totalTime}ms`);
      console.log(`[Perf]   - Accounts: ${result.accounts}`);
      console.log(`[Perf]   - Contacts: ${result.contacts}`);
      console.log(`[Perf]   - Products: ${result.products}`);
      console.log(`[Perf]   - Transactions: ${result.transactions}`);

      return {
        ...result,
        encryptionTimeMs: 0, // Encryption happens in real app flow
        totalTimeMs: totalTime,
      };
    };

    await use(seedDatabase);
  },

  // Clear database
  clearDatabase: async ({ page }, use) => {
    const clearDatabase = async () => {
      await page.evaluate(async () => {
        const { db } = await import('/src/store/database');
        await db.clearAllData();
      });
      console.log('[Perf] Database cleared');
    };

    await use(clearDatabase);
  },

  // Get heap size
  getHeapSize: async ({ page }, use) => {
    const getHeapSize = async (): Promise<number> => {
      const metrics = await page.evaluate(() => {
        // @ts-expect-error - performance.memory is Chrome-specific
        if (performance.memory) {
          // @ts-expect-error - performance.memory is Chrome-specific
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });
      return metrics;
    };

    await use(getHeapSize);
  },

  // Measure operation with timeout support
  measureOperation: async ({ page, getHeapSize }, use) => {
    // Default timeout: 2 minutes. Operations exceeding this are marked as timed out.
    const DEFAULT_TIMEOUT_MS = 120_000;

    const measureOperation = async <T>(
      name: string,
      operation: () => Promise<T>,
      options?: { timeoutMs?: number }
    ): Promise<{ result: T | null; metrics: PerformanceMetrics; timedOut: boolean }> => {
      const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      console.log(`[Perf] Starting measurement: ${name} (timeout: ${timeoutMs}ms)`);

      // Get heap size before
      const heapSizeBefore = await getHeapSize();

      // Set up long task observer
      await page.evaluate(() => {
        const longTasks: LongTaskEntry[] = [];

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              longTasks.push({
                name: entry.name,
                startTime: entry.startTime,
                duration: entry.duration,
                attribution: (entry as any).attribution?.[0]?.name,
              });
            }
          }
        });

        try {
          observer.observe({ entryTypes: ['longtask'] });
        } catch {
          console.warn('Long task observation not supported');
        }

        // @ts-expect-error - storing on window for retrieval
        window.__PERF_LONG_TASKS__ = longTasks;
        // @ts-expect-error - storing on window for retrieval
        window.__PERF_OBSERVER__ = observer;
      });

      // Mark start time
      const startTime = Date.now();

      // Create timeout promise
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
        timeoutId = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
      });

      // Race operation against timeout
      let result: T | null = null;
      let timedOut = false;

      try {
        const raceResult = await Promise.race([
          operation().then((r) => ({ timedOut: false as const, result: r })),
          timeoutPromise,
        ]);

        if (raceResult.timedOut) {
          timedOut = true;
          console.error(`[Perf] ⏱️ TIMEOUT: ${name} exceeded ${timeoutMs}ms`);
        } else {
          result = (raceResult as { timedOut: false; result: T }).result;
          clearTimeout(timeoutId!);
        }
      } catch (e) {
        console.error(`[Perf] ❌ ERROR in ${name}:`, e);
        throw e;
      }

      // Calculate wall time
      const wallTimeMs = Date.now() - startTime;

      // Collect long tasks and disconnect observer
      const longTasks = await page.evaluate(() => {
        // @ts-expect-error - retrieving from window
        const tasks = window.__PERF_LONG_TASKS__ || [];
        // @ts-expect-error - retrieving from window
        const observer = window.__PERF_OBSERVER__;
        if (observer) {
          observer.disconnect();
        }
        // @ts-expect-error - cleanup
        delete window.__PERF_LONG_TASKS__;
        // @ts-expect-error - cleanup
        delete window.__PERF_OBSERVER__;
        return tasks;
      });

      // Get heap size after
      const heapSizeAfter = await getHeapSize();

      // Calculate blocking time
      const blockingTimeMs = longTasks.reduce((sum: number, task: LongTaskEntry) => {
        return sum + Math.max(0, task.duration - 50);
      }, 0);

      const metrics: PerformanceMetrics = {
        // If timed out, set wallTimeMs to -1 to indicate invalid measurement
        wallTimeMs: timedOut ? -1 : wallTimeMs,
        longTasks,
        blockingTimeMs,
        heapSizeBefore,
        heapSizeAfter,
        heapDelta: heapSizeAfter - heapSizeBefore,
      };

      if (timedOut) {
        console.log(`[Perf] Measurement TIMED OUT: ${name}`);
        console.log(`[Perf]   - Elapsed before timeout: ${wallTimeMs}ms`);
        console.log(`[Perf]   - wallTimeMs set to -1 (INVALID)`);
      } else {
        console.log(`[Perf] Measurement complete: ${name}`);
        console.log(`[Perf]   - Wall time: ${wallTimeMs}ms`);
        console.log(`[Perf]   - Long tasks: ${longTasks.length}`);
        console.log(`[Perf]   - Blocking time: ${blockingTimeMs.toFixed(2)}ms`);
        console.log(`[Perf]   - Heap delta: ${(metrics.heapDelta / 1024 / 1024).toFixed(2)}MB`);
      }

      return { result, metrics, timedOut };
    };

    await use(measureOperation);
  },

  // Save results
  saveResults: async ({}, use) => {
    const saveResults = async (results: ScenarioResult[]): Promise<string> => {
      const outputDir = path.join(process.cwd(), 'e2e', 'performance', 'results');

      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `perf-results-${timestamp}.json`;
      const filepath = path.join(outputDir, filename);

      const os = await import('os');
      const runResults: TestRunResults = {
        runId: `run-${timestamp}`,
        timestamp: new Date().toISOString(),
        scenarios: results,
        environment: {
          platform: process.platform,
          cpuCount: os.cpus().length,
          memoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
        },
      };

      fs.writeFileSync(filepath, JSON.stringify(runResults, null, 2));
      console.log(`[Perf] Results saved to: ${filepath}`);

      return filepath;
    };

    await use(saveResults);
  },
});

export { expect };
export type { DatasetSize } from './seed';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Format milliseconds to human readable string
 */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Create a summary table from results
 */
export function createResultsTable(results: ScenarioResult[]): string {
  const headers = ['Scenario', 'Size', 'Throttle', 'Wall Time', 'Blocking', 'Long Tasks', 'Heap Delta', 'Status'];
  const rows = results.map(r => [
    r.scenario,
    r.datasetSize,
    r.throttleLevel,
    r.timedOut ? 'TIMEOUT' : formatMs(r.metrics.wallTimeMs),
    r.timedOut ? '-' : formatMs(r.metrics.blockingTimeMs),
    r.timedOut ? '-' : String(r.metrics.longTasks.length),
    r.timedOut ? '-' : formatBytes(r.metrics.heapDelta),
    r.timedOut ? 'INVALID' : (r.success ? 'OK' : 'FAIL'),
  ]);

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxDataWidth = Math.max(...rows.map(r => r[i].length));
    return Math.max(h.length, maxDataWidth);
  });

  // Build table
  const separator = widths.map(w => '-'.repeat(w + 2)).join('+');
  const formatRow = (cells: string[]) =>
    cells.map((c, i) => ` ${c.padEnd(widths[i])} `).join('|');

  return [
    separator,
    formatRow(headers),
    separator,
    ...rows.map(formatRow),
    separator,
  ].join('\n');
}
