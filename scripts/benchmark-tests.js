#!/usr/bin/env node

/**
 * Test Execution Benchmark Script
 *
 * Measures the time it takes to run the test suite and saves the results
 * for tracking performance trends over time.
 *
 * Usage: node scripts/benchmark-tests.js
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Configuration
const BENCHMARK_DIR = join(rootDir, '.benchmarks');
const RESULTS_FILE = join(BENCHMARK_DIR, 'test-times.json');
const MAX_HISTORY = 100; // Keep last 100 test runs

/**
 * Ensure benchmark directory exists
 */
function ensureBenchmarkDir() {
  if (!existsSync(BENCHMARK_DIR)) {
    mkdirSync(BENCHMARK_DIR, { recursive: true });
  }
}

/**
 * Load previous benchmark results
 */
function loadPreviousResults() {
  if (!existsSync(RESULTS_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(RESULTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('⚠️  Could not load previous results:', error.message);
    return [];
  }
}

/**
 * Save benchmark results
 */
function saveResults(results) {
  // Keep only last MAX_HISTORY results
  const trimmedResults = results.slice(-MAX_HISTORY);
  writeFileSync(RESULTS_FILE, JSON.stringify(trimmedResults, null, 2));
}

/**
 * Run tests and measure time
 */
function runBenchmark() {
  console.log('🧪 Starting test benchmark...\n');

  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  try {
    // Run the test suite
    const output = execSync('npm run test -- --run --reporter=json', {
      cwd: rootDir,
      encoding: 'utf-8',
      env: { ...process.env, NODE_ENV: 'test' },
    });

    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - startTime;

    // Parse test results
    let testStats = null;
    try {
      const testResults = JSON.parse(output);
      testStats = {
        numTotalTests: testResults.numTotalTests || 0,
        numPassedTests: testResults.numPassedTests || 0,
        numFailedTests: testResults.numFailedTests || 0,
        numPendingTests: testResults.numPendingTests || 0,
      };
    } catch {
      // If we can't parse, just continue
    }

    return {
      success: true,
      duration,
      timestamp: new Date().toISOString(),
      commit: getGitCommit(),
      branch: getGitBranch(),
      testStats,
      memory: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
      },
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      success: false,
      duration,
      timestamp: new Date().toISOString(),
      commit: getGitCommit(),
      branch: getGitBranch(),
      error: error.message,
    };
  }
}

/**
 * Get current git commit hash
 */
function getGitCommit() {
  try {
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
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Calculate statistics
 */
function calculateStats(results) {
  if (results.length === 0) return null;

  const successfulRuns = results.filter((r) => r.success);
  if (successfulRuns.length === 0) return null;

  const durations = successfulRuns.map((r) => r.duration);
  const sum = durations.reduce((a, b) => a + b, 0);
  const avg = sum / durations.length;
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  return { avg, median, min, max, count: successfulRuns.length };
}

/**
 * Format duration in a human-readable way
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

/**
 * Check for regression
 */
function checkRegression(currentDuration, previousResults) {
  const stats = calculateStats(previousResults);
  if (!stats || stats.count < 3) {
    return { hasRegression: false, message: 'Not enough data for regression detection' };
  }

  // Check if current test run is 10% slower than median
  const threshold = stats.median * 1.1; // 10% threshold
  const hasRegression = currentDuration > threshold;

  if (hasRegression) {
    const percentSlower = ((currentDuration - stats.median) / stats.median) * 100;
    return {
      hasRegression: true,
      message: `⚠️  Test execution regression detected! Current: ${formatDuration(currentDuration)}, Median: ${formatDuration(stats.median)} (+${percentSlower.toFixed(1)}%)`,
      percentSlower,
      current: currentDuration,
      median: stats.median,
    };
  }

  return {
    hasRegression: false,
    message: `✅ Test execution time within expected range (${formatDuration(currentDuration)} vs median ${formatDuration(stats.median)})`,
  };
}

/**
 * Main function
 */
function main() {
  ensureBenchmarkDir();

  // Load previous results
  const previousResults = loadPreviousResults();

  // Run benchmark
  const result = runBenchmark();

  // Add to results
  const allResults = [...previousResults, result];
  saveResults(allResults);

  // Display results
  console.log('\n📊 Test Benchmark Results:');
  console.log('━'.repeat(50));
  console.log(`Duration: ${formatDuration(result.duration)}`);
  console.log(`Success: ${result.success ? '✅' : '❌'}`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Branch: ${result.branch}`);
  console.log(`Commit: ${result.commit.substring(0, 7)}`);

  if (result.testStats) {
    console.log(`\nTest Statistics:`);
    console.log(`  Total: ${result.testStats.numTotalTests}`);
    console.log(`  Passed: ${result.testStats.numPassedTests}`);
    console.log(`  Failed: ${result.testStats.numFailedTests}`);
    console.log(`  Pending: ${result.testStats.numPendingTests}`);
  }

  if (result.memory) {
    console.log(`\nHeap Used: ${(result.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  }

  // Show statistics
  const stats = calculateStats(allResults);
  if (stats) {
    console.log('\n📈 Historical Statistics:');
    console.log('━'.repeat(50));
    console.log(`Average: ${formatDuration(stats.avg)}`);
    console.log(`Median: ${formatDuration(stats.median)}`);
    console.log(`Min: ${formatDuration(stats.min)}`);
    console.log(`Max: ${formatDuration(stats.max)}`);
    console.log(`Count: ${stats.count} test runs`);
  }

  // Check for regression
  if (result.success) {
    const regression = checkRegression(result.duration, previousResults);
    console.log('\n🔍 Regression Check:');
    console.log('━'.repeat(50));
    console.log(regression.message);

    if (regression.hasRegression) {
      process.exit(1); // Fail CI if regression detected
    }
  } else {
    console.error('\n❌ Tests failed!');
    process.exit(1);
  }

  console.log('\n✅ Test benchmark complete!\n');
}

main();
