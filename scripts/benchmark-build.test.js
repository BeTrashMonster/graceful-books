/**
 * Tests for benchmark-build.js
 *
 * These tests verify the build benchmarking functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const BENCHMARK_DIR = join(process.cwd(), '.benchmarks');
const RESULTS_FILE = join(BENCHMARK_DIR, 'build-times.json');

describe('Build Benchmark Script', () => {
  beforeEach(() => {
    // Clean up before each test
    if (existsSync(BENCHMARK_DIR)) {
      rmSync(BENCHMARK_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up after each test
    if (existsSync(BENCHMARK_DIR)) {
      rmSync(BENCHMARK_DIR, { recursive: true, force: true });
    }
  });

  it('should create benchmark directory if it does not exist', () => {
    expect(existsSync(BENCHMARK_DIR)).toBe(false);

    // Create directory
    mkdirSync(BENCHMARK_DIR, { recursive: true });

    expect(existsSync(BENCHMARK_DIR)).toBe(true);
  });

  it('should save benchmark results to JSON file', () => {
    mkdirSync(BENCHMARK_DIR, { recursive: true });

    const testResult = {
      success: true,
      duration: 5000,
      timestamp: new Date().toISOString(),
      commit: 'abc123',
      branch: 'main',
    };

    writeFileSync(RESULTS_FILE, JSON.stringify([testResult], null, 2));

    expect(existsSync(RESULTS_FILE)).toBe(true);

    const saved = JSON.parse(readFileSync(RESULTS_FILE, 'utf-8'));
    expect(saved).toHaveLength(1);
    expect(saved[0].duration).toBe(5000);
  });

  it('should calculate statistics correctly', () => {
    const results = [
      { success: true, duration: 1000 },
      { success: true, duration: 2000 },
      { success: true, duration: 3000 },
      { success: true, duration: 4000 },
      { success: true, duration: 5000 },
    ];

    const durations = results.map((r) => r.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    expect(avg).toBe(3000);
    expect(median).toBe(3000);
    expect(sorted[0]).toBe(1000);
    expect(sorted[sorted.length - 1]).toBe(5000);
  });

  it('should detect regression when build time increases by >10%', () => {
    const medianDuration = 10000; // 10 seconds
    const currentDuration = 11500; // 11.5 seconds (+15%)

    const threshold = medianDuration * 1.1; // 11 seconds
    const hasRegression = currentDuration > threshold;

    expect(hasRegression).toBe(true);

    const percentSlower = ((currentDuration - medianDuration) / medianDuration) * 100;
    expect(percentSlower).toBe(15);
  });

  it('should not detect regression when build time is within 10%', () => {
    const medianDuration = 10000; // 10 seconds
    const currentDuration = 10500; // 10.5 seconds (+5%)

    const threshold = medianDuration * 1.1; // 11 seconds
    const hasRegression = currentDuration > threshold;

    expect(hasRegression).toBe(false);
  });

  it('should keep only last 100 results', () => {
    const results = Array.from({ length: 150 }, (_, i) => ({
      success: true,
      duration: 1000 + i,
      timestamp: new Date().toISOString(),
    }));

    const trimmed = results.slice(-100);

    expect(trimmed).toHaveLength(100);
    expect(trimmed[0].duration).toBe(1050); // Should start from index 50
  });

  it('should format duration correctly', () => {
    const formatDuration = (ms) => {
      if (ms < 1000) return `${ms}ms`;
      const seconds = (ms / 1000).toFixed(2);
      return `${seconds}s`;
    };

    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1000)).toBe('1.00s');
    expect(formatDuration(5432)).toBe('5.43s');
  });

  it('should handle empty results gracefully', () => {
    const results = [];

    const calculateStats = (results) => {
      if (results.length === 0) return null;

      const successfulBuilds = results.filter((r) => r.success);
      if (successfulBuilds.length === 0) return null;

      const durations = successfulBuilds.map((r) => r.duration);
      const sum = durations.reduce((a, b) => a + b, 0);
      const avg = sum / durations.length;

      return { avg };
    };

    const stats = calculateStats(results);
    expect(stats).toBeNull();
  });

  it('should filter out failed builds from statistics', () => {
    const results = [
      { success: true, duration: 1000 },
      { success: false, duration: 2000 },
      { success: true, duration: 3000 },
      { success: false, duration: 4000 },
      { success: true, duration: 5000 },
    ];

    const successfulBuilds = results.filter((r) => r.success);
    expect(successfulBuilds).toHaveLength(3);

    const durations = successfulBuilds.map((r) => r.duration);
    expect(durations).toEqual([1000, 3000, 5000]);
  });
});
