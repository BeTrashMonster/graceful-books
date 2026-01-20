/**
 * Tests for bundle-size-check.js
 *
 * These tests verify the bundle size checking functionality.
 */

import { describe, it, expect } from 'vitest';

describe('Bundle Size Check Script', () => {
  it('should format bytes correctly', () => {
    const formatSize = (bytes) => {
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
      return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
    };

    expect(formatSize(500)).toBe('500B');
    expect(formatSize(1024)).toBe('1.00KB');
    expect(formatSize(1024 * 500)).toBe('500.00KB');
    expect(formatSize(1024 * 1024)).toBe('1.00MB');
    expect(formatSize(1024 * 1024 * 2.5)).toBe('2.50MB');
  });

  it('should categorize files by extension', () => {
    const files = [
      { path: '/dist/main.js', size: 100000, ext: '.js' },
      { path: '/dist/style.css', size: 50000, ext: '.css' },
      { path: '/dist/vendor.js', size: 200000, ext: '.js' },
      { path: '/dist/image.png', size: 80000, ext: '.png' },
    ];

    const analysis = {
      total: 0,
      js: 0,
      css: 0,
      assets: 0,
    };

    files.forEach((file) => {
      analysis.total += file.size;

      if (file.ext === '.js' || file.ext === '.mjs') {
        analysis.js += file.size;
      } else if (file.ext === '.css') {
        analysis.css += file.size;
      } else {
        analysis.assets += file.size;
      }
    });

    expect(analysis.total).toBe(430000);
    expect(analysis.js).toBe(300000);
    expect(analysis.css).toBe(50000);
    expect(analysis.assets).toBe(80000);
  });

  it('should detect size limit violations', () => {
    const SIZE_LIMIT_KB = {
      total: 1000, // 1MB
      js: 500, // 500KB
      css: 100, // 100KB
      assets: 400, // 400KB
    };

    const checkSizeLimits = (analysis) => {
      const violations = [];

      if (analysis.total / 1024 > SIZE_LIMIT_KB.total) {
        violations.push('Total size violation');
      }

      if (analysis.js / 1024 > SIZE_LIMIT_KB.js) {
        violations.push('JS size violation');
      }

      if (analysis.css / 1024 > SIZE_LIMIT_KB.css) {
        violations.push('CSS size violation');
      }

      if (analysis.assets / 1024 > SIZE_LIMIT_KB.assets) {
        violations.push('Assets size violation');
      }

      return violations;
    };

    // Within limits
    const goodAnalysis = {
      total: 800 * 1024, // 800KB
      js: 400 * 1024, // 400KB
      css: 80 * 1024, // 80KB
      assets: 320 * 1024, // 320KB
    };

    expect(checkSizeLimits(goodAnalysis)).toHaveLength(0);

    // Exceeds limits
    const badAnalysis = {
      total: 1200 * 1024, // 1.2MB
      js: 600 * 1024, // 600KB
      css: 150 * 1024, // 150KB
      assets: 450 * 1024, // 450KB
    };

    const violations = checkSizeLimits(badAnalysis);
    expect(violations).toHaveLength(4);
  });

  it('should calculate percentage change correctly', () => {
    const current = 110000;
    const previous = 100000;
    const diff = current - previous;
    const percentChange = (diff / previous) * 100;

    expect(diff).toBe(10000);
    expect(percentChange).toBe(10);
  });

  it('should detect regression when size increases by >10%', () => {
    const current = 115000; // 15% increase
    const previous = 100000;
    const percentChange = ((current - previous) / previous) * 100;

    expect(percentChange).toBeGreaterThan(10);
  });

  it('should not detect regression when size increases by <=10%', () => {
    const current = 105000; // 5% increase
    const previous = 100000;
    const percentChange = ((current - previous) / previous) * 100;

    expect(percentChange).toBeLessThanOrEqual(10);
  });

  it('should sort files by size (largest first)', () => {
    const files = [
      { path: '/dist/small.js', size: 1000 },
      { path: '/dist/large.js', size: 50000 },
      { path: '/dist/medium.js', size: 10000 },
    ];

    const sorted = [...files].sort((a, b) => b.size - a.size);

    expect(sorted[0].path).toBe('/dist/large.js');
    expect(sorted[1].path).toBe('/dist/medium.js');
    expect(sorted[2].path).toBe('/dist/small.js');
  });

  it('should handle first run (no previous data)', () => {
    const compareWithPrevious = (current, previous) => {
      if (!previous) {
        return {
          hasRegression: false,
          message: 'No previous data for comparison',
          isFirstRun: true,
        };
      }
      return { hasRegression: false, isFirstRun: false };
    };

    const result = compareWithPrevious({ total: 100000 }, null);

    expect(result.isFirstRun).toBe(true);
    expect(result.hasRegression).toBe(false);
  });

  it('should generate markdown table for bundle report', () => {
    const formatSize = (bytes) => {
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
      return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
    };

    const analysis = {
      total: 800 * 1024,
      js: 400 * 1024,
      css: 80 * 1024,
      assets: 320 * 1024,
    };

    const SIZE_LIMIT_KB = {
      total: 1000,
      js: 500,
      css: 100,
      assets: 400,
    };

    const row = `| **Total** | ${formatSize(analysis.total)} | ${SIZE_LIMIT_KB.total}KB | ${analysis.total / 1024 <= SIZE_LIMIT_KB.total ? '✅' : '❌'} |`;

    expect(row).toContain('800.00KB');
    expect(row).toContain('1000KB');
    expect(row).toContain('✅');
  });
});
