/**
 * Lighthouse CI Configuration
 *
 * This configuration defines performance budgets and quality thresholds
 * for Core Web Vitals monitoring in the CI pipeline.
 *
 * Performance Targets (from CLAUDE.md):
 * - Page load: <2 seconds
 * - Transaction save: <500ms
 * - Report generation: <5 seconds (standard), <30 seconds (complex)
 * - Encryption/decryption: imperceptible to user
 */

module.exports = {
  ci: {
    collect: {
      // URLs to test - adjust based on your build output
      staticDistDir: './dist',
      url: [
        'http://localhost/index.html',
        'http://localhost/index.html#/dashboard',
        'http://localhost/index.html#/transactions',
        'http://localhost/index.html#/reports',
      ],
      numberOfRuns: 3, // Run lighthouse 3 times and take median
      settings: {
        // Chrome flags for headless mode
        chromeFlags: '--no-sandbox --disable-gpu',
        // Preset for performance auditing
        preset: 'desktop',
        // Throttling settings (simulated slow 4G)
        throttling: {
          rttMs: 40,
          throughputKbps: 10 * 1024,
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      assertions: {
        // Core Web Vitals thresholds
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }], // 2s
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // 2.5s
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }], // 300ms
        'speed-index': ['error', { maxNumericValue: 3000 }], // 3s
        'interactive': ['error', { maxNumericValue: 3500 }], // 3.5s

        // Performance score thresholds
        'categories:performance': ['error', { minScore: 0.9 }], // 90+
        'categories:accessibility': ['error', { minScore: 0.9 }], // WCAG 2.1 AA
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Resource size budgets
        'resource-summary:script:size': ['error', { maxNumericValue: 500000 }], // 500KB JS
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 100000 }], // 100KB CSS
        'resource-summary:document:size': ['warn', { maxNumericValue: 50000 }], // 50KB HTML
        'resource-summary:font:size': ['warn', { maxNumericValue: 200000 }], // 200KB fonts
        'resource-summary:total:size': ['error', { maxNumericValue: 1000000 }], // 1MB total

        // Additional performance metrics
        'uses-responsive-images': 'warn',
        'offscreen-images': 'warn',
        'unminified-css': 'error',
        'unminified-javascript': 'error',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',
        'modern-image-formats': 'warn',
        'uses-optimized-images': 'warn',
        'uses-text-compression': 'error',
        'uses-rel-preconnect': 'warn',
        'efficient-animated-content': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage', // Store results for 7 days
      // If you want to use Lighthouse CI server, configure:
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.com',
      // token: process.env.LHCI_TOKEN,
    },
  },
};
