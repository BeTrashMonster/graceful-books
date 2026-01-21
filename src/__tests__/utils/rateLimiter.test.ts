/**
 * Rate Limiter Tests
 *
 * Tests for the sliding window rate limiter implementation.
 * Covers: basic rate limiting, sliding window behavior, quota status,
 * error handling, cleanup, and utility functions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RateLimiter,
  RateLimitError,
  CRYPTO_RATE_LIMITS,
  rateLimiter,
  withRateLimit,
  formatWaitTime,
  type RateLimitConfig,
} from '../../utils/rateLimiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    // Create a fresh limiter for each test with shorter cleanup interval
    limiter = new RateLimiter(1000); // 1 second cleanup for faster tests
  });

  afterEach(() => {
    // Clean up the limiter
    limiter.destroy();
  });

  describe('basic rate limiting', () => {
    const testConfig: RateLimitConfig = {
      maxOperations: 3,
      windowMs: 1000, // 1 second
    };

    it('should allow operations within the limit', async () => {
      const result1 = await limiter.check('test-op', testConfig);
      const result2 = await limiter.check('test-op', testConfig);
      const result3 = await limiter.check('test-op', testConfig);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);
    });

    it('should block operations exceeding the limit', async () => {
      // Use up the quota
      await limiter.check('test-op', testConfig);
      await limiter.check('test-op', testConfig);
      await limiter.check('test-op', testConfig);

      // This should be blocked
      const result = await limiter.check('test-op', testConfig);

      expect(result.allowed).toBe(false);
      expect(result.waitTimeMs).toBeDefined();
      expect(result.waitTimeMs).toBeGreaterThan(0);
      expect(result.remaining).toBe(0);
    });

    it('should track remaining operations correctly', async () => {
      const result1 = await limiter.check('test-op', testConfig);
      expect(result1.remaining).toBe(2);

      const result2 = await limiter.check('test-op', testConfig);
      expect(result2.remaining).toBe(1);

      const result3 = await limiter.check('test-op', testConfig);
      expect(result3.remaining).toBe(0);
    });

    it('should handle different operation keys independently', async () => {
      // Fill up one operation key
      await limiter.check('op-a', testConfig);
      await limiter.check('op-a', testConfig);
      await limiter.check('op-a', testConfig);

      // Another key should still be allowed
      const result = await limiter.check('op-b', testConfig);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe('sliding window behavior', () => {
    it('should allow operations after window expires', async () => {
      const shortConfig: RateLimitConfig = {
        maxOperations: 2,
        windowMs: 100, // 100ms window
      };

      // Use up quota
      await limiter.check('test-op', shortConfig);
      await limiter.check('test-op', shortConfig);

      // Should be blocked
      const blockedResult = await limiter.check('test-op', shortConfig);
      expect(blockedResult.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be allowed again
      const allowedResult = await limiter.check('test-op', shortConfig);
      expect(allowedResult.allowed).toBe(true);
    });

    it('should calculate correct wait time', async () => {
      vi.useFakeTimers();

      const config: RateLimitConfig = {
        maxOperations: 2,
        windowMs: 1000,
      };

      // Record operations at known times
      await limiter.check('test-op', config);
      vi.advanceTimersByTime(100);
      await limiter.check('test-op', config);
      vi.advanceTimersByTime(100);

      // Should be blocked
      const result = await limiter.check('test-op', config);
      expect(result.allowed).toBe(false);

      // Wait time should be approximately 800ms (1000 - 200ms elapsed)
      // The first operation was 200ms ago, so we need to wait ~800ms for it to expire
      expect(result.waitTimeMs).toBeGreaterThanOrEqual(700);
      expect(result.waitTimeMs).toBeLessThanOrEqual(900);

      vi.useRealTimers();
    });

    it('should provide reset time information', async () => {
      const config: RateLimitConfig = {
        maxOperations: 2,
        windowMs: 1000,
      };

      const now = Date.now();
      const result = await limiter.check('test-op', config);

      expect(result.resetsAt).toBeDefined();
      expect(result.resetsAt).toBeGreaterThan(now);
      expect(result.resetsAt).toBeLessThanOrEqual(now + config.windowMs + 100);
    });
  });

  describe('checkOrThrow', () => {
    const testConfig: RateLimitConfig = {
      maxOperations: 2,
      windowMs: 1000,
    };

    it('should not throw when within limit', async () => {
      await expect(limiter.checkOrThrow('test-op', testConfig)).resolves.not.toThrow();
      await expect(limiter.checkOrThrow('test-op', testConfig)).resolves.not.toThrow();
    });

    it('should throw RateLimitError when limit exceeded', async () => {
      await limiter.checkOrThrow('test-op', testConfig);
      await limiter.checkOrThrow('test-op', testConfig);

      await expect(limiter.checkOrThrow('test-op', testConfig)).rejects.toThrow(
        RateLimitError
      );
    });

    it('should include wait time in error', async () => {
      await limiter.checkOrThrow('test-op', testConfig);
      await limiter.checkOrThrow('test-op', testConfig);

      try {
        await limiter.checkOrThrow('test-op', testConfig);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        const rateLimitError = error as RateLimitError;
        expect(rateLimitError.waitTimeMs).toBeGreaterThan(0);
        expect(rateLimitError.operationKey).toBe('test-op');
      }
    });
  });

  describe('getQuotaStatus', () => {
    const testConfig: RateLimitConfig = {
      maxOperations: 5,
      windowMs: 1000,
    };

    it('should return full quota when no operations recorded', () => {
      const status = limiter.getQuotaStatus('test-op', testConfig);

      expect(status.remaining).toBe(5);
      expect(status.maxOperations).toBe(5);
      expect(status.resetsAt).toBeNull();
    });

    it('should return correct remaining quota after operations', async () => {
      await limiter.check('test-op', testConfig);
      await limiter.check('test-op', testConfig);

      const status = limiter.getQuotaStatus('test-op', testConfig);

      expect(status.remaining).toBe(3);
      expect(status.maxOperations).toBe(5);
      expect(status.resetsAt).toBeDefined();
    });

    it('should not consume quota when checking status', async () => {
      limiter.getQuotaStatus('test-op', testConfig);
      limiter.getQuotaStatus('test-op', testConfig);
      limiter.getQuotaStatus('test-op', testConfig);

      const status = limiter.getQuotaStatus('test-op', testConfig);
      expect(status.remaining).toBe(5);
    });
  });

  describe('enable/disable', () => {
    const testConfig: RateLimitConfig = {
      maxOperations: 1,
      windowMs: 1000,
    };

    it('should bypass rate limiting when disabled', async () => {
      limiter.setEnabled(false);

      // Even after exceeding limit, should still be allowed
      await limiter.check('test-op', testConfig);
      await limiter.check('test-op', testConfig);
      await limiter.check('test-op', testConfig);

      const result = await limiter.check('test-op', testConfig);
      expect(result.allowed).toBe(true);
    });

    it('should enforce rate limiting when re-enabled', async () => {
      limiter.setEnabled(false);
      await limiter.check('test-op', testConfig);

      limiter.setEnabled(true);
      await limiter.check('test-op', testConfig);

      const result = await limiter.check('test-op', testConfig);
      expect(result.allowed).toBe(false);
    });

    it('should report enabled status correctly', () => {
      expect(limiter.isEnabled()).toBe(true);

      limiter.setEnabled(false);
      expect(limiter.isEnabled()).toBe(false);

      limiter.setEnabled(true);
      expect(limiter.isEnabled()).toBe(true);
    });

    it('should return full quota in status when disabled', () => {
      limiter.setEnabled(false);

      const status = limiter.getQuotaStatus('test-op', testConfig);
      expect(status.remaining).toBe(testConfig.maxOperations);
    });
  });

  describe('clear operations', () => {
    const testConfig: RateLimitConfig = {
      maxOperations: 2,
      windowMs: 1000,
    };

    it('should clear all operations', async () => {
      await limiter.check('op-a', testConfig);
      await limiter.check('op-a', testConfig);
      await limiter.check('op-b', testConfig);

      limiter.clear();

      const resultA = await limiter.check('op-a', testConfig);
      const resultB = await limiter.check('op-b', testConfig);

      expect(resultA.allowed).toBe(true);
      expect(resultA.remaining).toBe(1);
      expect(resultB.allowed).toBe(true);
      expect(resultB.remaining).toBe(1);
    });

    it('should clear operations for a specific key', async () => {
      await limiter.check('op-a', testConfig);
      await limiter.check('op-a', testConfig);
      await limiter.check('op-b', testConfig);
      await limiter.check('op-b', testConfig);

      limiter.clearKey('op-a');

      const resultA = await limiter.check('op-a', testConfig);
      const resultB = await limiter.check('op-b', testConfig);

      expect(resultA.allowed).toBe(true);
      expect(resultA.remaining).toBe(1);
      expect(resultB.allowed).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should stop cleanup interval and clear data', async () => {
      const testConfig: RateLimitConfig = {
        maxOperations: 2,
        windowMs: 1000,
      };

      await limiter.check('test-op', testConfig);
      limiter.destroy();

      // After destroy, the limiter should have cleared data
      const status = limiter.getQuotaStatus('test-op', testConfig);
      expect(status.remaining).toBe(2);
    });
  });
});

describe('RateLimitError', () => {
  it('should create error with correct message', () => {
    const error = new RateLimitError('testOp', 5000);

    expect(error.name).toBe('RateLimitError');
    expect(error.message).toContain('Rate limit exceeded');
    expect(error.message).toContain('testOp');
    expect(error.message).toContain('5 seconds');
    expect(error.waitTimeMs).toBe(5000);
    expect(error.operationKey).toBe('testOp');
  });

  it('should handle singular second correctly', () => {
    const error = new RateLimitError('testOp', 1000);
    expect(error.message).toContain('1 second');
    expect(error.message).not.toContain('seconds');
  });

  it('should handle sub-second wait times', () => {
    const error = new RateLimitError('testOp', 500);
    expect(error.message).toContain('1 second');
  });
});

describe('CRYPTO_RATE_LIMITS', () => {
  it('should have correct key derivation limits', () => {
    expect(CRYPTO_RATE_LIMITS.keyDerivation.maxOperations).toBe(5);
    expect(CRYPTO_RATE_LIMITS.keyDerivation.windowMs).toBe(60000);
  });

  it('should have correct batch encrypt limits', () => {
    expect(CRYPTO_RATE_LIMITS.batchEncrypt.maxOperations).toBe(10);
    expect(CRYPTO_RATE_LIMITS.batchEncrypt.windowMs).toBe(60000);
  });

  it('should have correct file encrypt limits', () => {
    expect(CRYPTO_RATE_LIMITS.fileEncrypt.maxOperations).toBe(20);
    expect(CRYPTO_RATE_LIMITS.fileEncrypt.windowMs).toBe(60000);
  });

  it('should have correct reencrypt limits', () => {
    expect(CRYPTO_RATE_LIMITS.reencrypt.maxOperations).toBe(5);
    expect(CRYPTO_RATE_LIMITS.reencrypt.windowMs).toBe(60000);
  });
});

describe('withRateLimit', () => {
  let testLimiter: RateLimiter;

  beforeEach(() => {
    testLimiter = new RateLimiter(1000);
  });

  afterEach(() => {
    testLimiter.destroy();
  });

  it('should call wrapped function when within limit', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    const config: RateLimitConfig = { maxOperations: 5, windowMs: 1000 };

    const wrapped = withRateLimit(mockFn, 'test', config, testLimiter);
    const result = await wrapped('arg1', 'arg2');

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    expect(result).toBe('success');
  });

  it('should throw when rate limit exceeded', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    const config: RateLimitConfig = { maxOperations: 1, windowMs: 1000 };

    const wrapped = withRateLimit(mockFn, 'test', config, testLimiter);

    await wrapped();

    await expect(wrapped()).rejects.toThrow(RateLimitError);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should preserve function return type', async () => {
    interface TestResult {
      value: number;
    }

    const mockFn = vi.fn().mockResolvedValue({ value: 42 });
    const config: RateLimitConfig = { maxOperations: 5, windowMs: 1000 };

    const wrapped = withRateLimit<[string], TestResult>(mockFn, 'test', config, testLimiter);
    const result = await wrapped('test');

    expect(result.value).toBe(42);
  });
});

describe('formatWaitTime', () => {
  it('should format sub-second times', () => {
    expect(formatWaitTime(500)).toBe('less than a second');
    expect(formatWaitTime(999)).toBe('less than a second');
    expect(formatWaitTime(0)).toBe('less than a second');
  });

  it('should format seconds correctly', () => {
    expect(formatWaitTime(1000)).toBe('1 second');
    expect(formatWaitTime(2000)).toBe('2 seconds');
    expect(formatWaitTime(30000)).toBe('30 seconds');
    expect(formatWaitTime(59000)).toBe('59 seconds');
  });

  it('should format minutes correctly', () => {
    expect(formatWaitTime(60000)).toBe('1 minute');
    expect(formatWaitTime(120000)).toBe('2 minutes');
  });

  it('should format minutes and seconds correctly', () => {
    expect(formatWaitTime(90000)).toBe('1 minute and 30 seconds');
    expect(formatWaitTime(125000)).toBe('2 minutes and 5 seconds');
    expect(formatWaitTime(61000)).toBe('1 minute and 1 second');
  });

  it('should round up partial seconds', () => {
    expect(formatWaitTime(1500)).toBe('2 seconds');
    expect(formatWaitTime(61500)).toBe('1 minute and 2 seconds');
  });
});

describe('singleton rateLimiter', () => {
  beforeEach(() => {
    rateLimiter.clear();
    rateLimiter.setEnabled(true); // Re-enable rate limiting for singleton tests
  });

  it('should be a RateLimiter instance', () => {
    expect(rateLimiter).toBeInstanceOf(RateLimiter);
  });

  it('should work with crypto rate limits', async () => {
    const result = await rateLimiter.check('keyDerivation', CRYPTO_RATE_LIMITS.keyDerivation);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should persist state across calls', async () => {
    await rateLimiter.check('testSingleton', { maxOperations: 3, windowMs: 60000 });
    await rateLimiter.check('testSingleton', { maxOperations: 3, windowMs: 60000 });

    const status = rateLimiter.getQuotaStatus('testSingleton', {
      maxOperations: 3,
      windowMs: 60000,
    });

    expect(status.remaining).toBe(1);
  });
});
