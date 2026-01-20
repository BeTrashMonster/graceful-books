#!/usr/bin/env node

/**
 * Bundle Size Check Script
 *
 * Analyzes bundle sizes and compares against previous builds to detect
 * size regressions. Generates a detailed report for PR comments.
 *
 * Usage: node scripts/bundle-size-check.js
 */

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Configuration
const DIST_DIR = join(rootDir, 'dist');
const BENCHMARK_DIR = join(rootDir, '.benchmarks');
const RESULTS_FILE = join(BENCHMARK_DIR, 'bundle-sizes.json');
const SIZE_LIMIT_KB = {
  // Size limits in KB
  total: 1000, // 1MB total
  js: 500, // 500KB for all JS
  css: 100, // 100KB for all CSS
  assets: 400, // 400KB for other assets
};

/**
 * Ensure benchmark directory exists
 */
function ensureBenchmarkDir() {
  if (!existsSync(BENCHMARK_DIR)) {
    mkdirSync(BENCHMARK_DIR, { recursive: true });
  }
}

/**
 * Get all files in directory recursively
 */
function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Format bytes to human readable size
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

/**
 * Analyze bundle sizes
 */
function analyzeBundleSizes() {
  if (!existsSync(DIST_DIR)) {
    throw new Error('Build directory not found. Run npm run build first.');
  }

  const files = getAllFiles(DIST_DIR);
  const analysis = {
    total: 0,
    js: 0,
    css: 0,
    assets: 0,
    files: [],
  };

  files.forEach((file) => {
    const stat = statSync(file);
    const size = stat.size;
    const ext = extname(file).toLowerCase();
    const relativePath = file.replace(DIST_DIR, '').replace(/\\/g, '/');

    analysis.total += size;
    analysis.files.push({
      path: relativePath,
      size,
      ext,
    });

    // Categorize by type
    if (ext === '.js' || ext === '.mjs') {
      analysis.js += size;
    } else if (ext === '.css') {
      analysis.css += size;
    } else {
      analysis.assets += size;
    }
  });

  // Sort files by size (largest first)
  analysis.files.sort((a, b) => b.size - a.size);

  return analysis;
}

/**
 * Load previous bundle analysis
 */
function loadPreviousAnalysis() {
  if (!existsSync(RESULTS_FILE)) {
    return null;
  }
  try {
    const data = readFileSync(RESULTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('⚠️  Could not load previous bundle analysis:', error.message);
    return null;
  }
}

/**
 * Save bundle analysis
 */
function saveAnalysis(analysis) {
  const result = {
    timestamp: new Date().toISOString(),
    commit: getGitCommit(),
    branch: getGitBranch(),
    analysis,
  };

  writeFileSync(RESULTS_FILE, JSON.stringify(result, null, 2));
  return result;
}

/**
 * Get current git commit hash
 */
function getGitCommit() {
  try {
    const { execSync } = await import('child_process');
    return execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Get current git branch
 */
function getGitBranch() {
  try {
    const { execSync } = await import('child_process');
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Compare with previous analysis
 */
function compareWithPrevious(current, previous) {
  if (!previous) {
    return {
      hasRegression: false,
      message: 'No previous data for comparison',
      isFirstRun: true,
    };
  }

  const currentTotal = current.analysis.total;
  const previousTotal = previous.analysis.total;
  const diff = currentTotal - previousTotal;
  const percentChange = (diff / previousTotal) * 100;

  // Check for 10% regression
  const hasRegression = percentChange > 10;

  const comparison = {
    total: {
      current: currentTotal,
      previous: previousTotal,
      diff,
      percentChange,
    },
    js: {
      current: current.analysis.js,
      previous: previous.analysis.js,
      diff: current.analysis.js - previous.analysis.js,
    },
    css: {
      current: current.analysis.css,
      previous: previous.analysis.css,
      diff: current.analysis.css - previous.analysis.css,
    },
    assets: {
      current: current.analysis.assets,
      previous: previous.analysis.assets,
      diff: current.analysis.assets - previous.analysis.assets,
    },
  };

  return {
    hasRegression,
    comparison,
    message: hasRegression
      ? `⚠️  Bundle size increased by ${percentChange.toFixed(1)}% (${formatSize(diff)})`
      : `✅ Bundle size ${diff >= 0 ? 'increased' : 'decreased'} by ${Math.abs(percentChange).toFixed(1)}% (${formatSize(Math.abs(diff))})`,
  };
}

/**
 * Check size limits
 */
function checkSizeLimits(analysis) {
  const violations = [];

  if (analysis.total / 1024 > SIZE_LIMIT_KB.total) {
    violations.push(`Total bundle size (${formatSize(analysis.total)}) exceeds limit (${SIZE_LIMIT_KB.total}KB)`);
  }

  if (analysis.js / 1024 > SIZE_LIMIT_KB.js) {
    violations.push(`JavaScript size (${formatSize(analysis.js)}) exceeds limit (${SIZE_LIMIT_KB.js}KB)`);
  }

  if (analysis.css / 1024 > SIZE_LIMIT_KB.css) {
    violations.push(`CSS size (${formatSize(analysis.css)}) exceeds limit (${SIZE_LIMIT_KB.css}KB)`);
  }

  if (analysis.assets / 1024 > SIZE_LIMIT_KB.assets) {
    violations.push(`Assets size (${formatSize(analysis.assets)}) exceeds limit (${SIZE_LIMIT_KB.assets}KB)`);
  }

  return violations;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(current, comparison) {
  const { analysis } = current;
  const violations = checkSizeLimits(analysis);

  let report = '# 📦 Bundle Size Report\n\n';

  // Summary
  report += '## Summary\n\n';
  report += '| Category | Size | Limit | Status |\n';
  report += '|----------|------|-------|--------|\n';
  report += `| **Total** | ${formatSize(analysis.total)} | ${SIZE_LIMIT_KB.total}KB | ${analysis.total / 1024 <= SIZE_LIMIT_KB.total ? '✅' : '❌'} |\n`;
  report += `| JavaScript | ${formatSize(analysis.js)} | ${SIZE_LIMIT_KB.js}KB | ${analysis.js / 1024 <= SIZE_LIMIT_KB.js ? '✅' : '❌'} |\n`;
  report += `| CSS | ${formatSize(analysis.css)} | ${SIZE_LIMIT_KB.css}KB | ${analysis.css / 1024 <= SIZE_LIMIT_KB.css ? '✅' : '❌'} |\n`;
  report += `| Assets | ${formatSize(analysis.assets)} | ${SIZE_LIMIT_KB.assets}KB | ${analysis.assets / 1024 <= SIZE_LIMIT_KB.assets ? '✅' : '❌'} |\n\n`;

  // Comparison with previous
  if (!comparison.isFirstRun) {
    report += '## Comparison with Previous Build\n\n';
    report += comparison.message + '\n\n';
    report += '| Category | Current | Previous | Change |\n';
    report += '|----------|---------|----------|--------|\n';
    report += `| Total | ${formatSize(comparison.comparison.total.current)} | ${formatSize(comparison.comparison.total.previous)} | ${comparison.comparison.total.diff >= 0 ? '+' : ''}${formatSize(comparison.comparison.total.diff)} (${comparison.comparison.total.percentChange >= 0 ? '+' : ''}${comparison.comparison.total.percentChange.toFixed(1)}%) |\n`;
    report += `| JavaScript | ${formatSize(comparison.comparison.js.current)} | ${formatSize(comparison.comparison.js.previous)} | ${comparison.comparison.js.diff >= 0 ? '+' : ''}${formatSize(comparison.comparison.js.diff)} |\n`;
    report += `| CSS | ${formatSize(comparison.comparison.css.current)} | ${formatSize(comparison.comparison.css.previous)} | ${comparison.comparison.css.diff >= 0 ? '+' : ''}${formatSize(comparison.comparison.css.diff)} |\n`;
    report += `| Assets | ${formatSize(comparison.comparison.assets.current)} | ${formatSize(comparison.comparison.assets.previous)} | ${comparison.comparison.assets.diff >= 0 ? '+' : ''}${formatSize(comparison.comparison.assets.diff)} |\n\n`;
  }

  // Violations
  if (violations.length > 0) {
    report += '## ⚠️ Size Limit Violations\n\n';
    violations.forEach((violation) => {
      report += `- ${violation}\n`;
    });
    report += '\n';
  }

  // Largest files
  report += '## Largest Files\n\n';
  report += '| File | Size |\n';
  report += '|------|------|\n';
  const topFiles = analysis.files.slice(0, 10);
  topFiles.forEach((file) => {
    report += `| ${file.path} | ${formatSize(file.size)} |\n`;
  });

  return report;
}

/**
 * Main function
 */
async function main() {
  ensureBenchmarkDir();

  console.log('📦 Analyzing bundle sizes...\n');

  // Analyze current build
  const currentAnalysis = analyzeBundleSizes();

  // Load previous analysis
  const previousAnalysis = loadPreviousAnalysis();

  // Save current analysis
  const savedAnalysis = saveAnalysis(currentAnalysis);

  // Compare with previous
  const comparison = compareWithPrevious(savedAnalysis, previousAnalysis);

  // Check size limits
  const violations = checkSizeLimits(currentAnalysis);

  // Generate report
  const report = generateMarkdownReport(savedAnalysis, comparison);

  // Save report
  const reportFile = join(BENCHMARK_DIR, 'bundle-size-report.md');
  writeFileSync(reportFile, report);

  // Output to console
  console.log(report);

  // Set GitHub Actions output if running in CI
  if (process.env.GITHUB_ACTIONS === 'true') {
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      const output = `bundle-report<<EOF\n${report}\nEOF\n`;
      writeFileSync(outputFile, output, { flag: 'a' });
    }
  }

  // Exit with error if violations or regression
  if (violations.length > 0 || comparison.hasRegression) {
    console.error('\n❌ Bundle size check failed!');
    if (violations.length > 0) {
      console.error('Size limit violations detected.');
    }
    if (comparison.hasRegression) {
      console.error('Bundle size regression detected (>10% increase).');
    }
    process.exit(1);
  }

  console.log('\n✅ Bundle size check passed!\n');
}

main();
