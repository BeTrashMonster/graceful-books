/**
 * Playwright Performance Testing Configuration
 *
 * Separate config for performance tests:
 * - Chromium only (for CDP access and performance.memory)
 * - No retries (we want accurate single measurements)
 * - Extended timeouts for large datasets
 * - JSON output for automated analysis
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/performance',

  // Extended timeout for performance tests (some scenarios take minutes)
  timeout: 30 * 60 * 1000, // 30 minutes max

  // Run tests serially to avoid interference
  fullyParallel: false,
  workers: 1,

  // No retries - we want accurate single measurements
  retries: 0,

  // Fail on test.only
  forbidOnly: !!process.env.CI,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-perf-report' }],
    ['json', { outputFile: 'e2e/performance/results/playwright-results.json' }],
    ['list'],
  ],

  // Shared settings
  use: {
    // Base URL
    baseURL: 'http://localhost:5173',

    // Collect trace on failure for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // No video (affects performance)
    video: 'off',

    // Extended action timeout
    actionTimeout: 60 * 1000, // 1 minute

    // Extended navigation timeout
    navigationTimeout: 120 * 1000, // 2 minutes
  },

  // Chromium only (required for CDP access and performance.memory)
  projects: [
    {
      name: 'chromium-perf',
      use: {
        ...devices['Desktop Chrome'],
        // Use headed mode for debugging (change to false for CI)
        headless: true,
        // Disable animations for consistent measurements
        launchOptions: {
          args: [
            '--disable-animations',
            '--disable-gpu-vsync',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            // Enable precise memory measurements
            '--enable-precise-memory-info',
            // Disable extensions
            '--disable-extensions',
          ],
        },
      },
    },
  ],

  // Run dev server
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Output folder
  outputDir: 'e2e/performance/results/artifacts',

  // Global setup/teardown could be added here for database preparation
  // globalSetup: './e2e/performance/global-setup.ts',
  // globalTeardown: './e2e/performance/global-teardown.ts',
});
