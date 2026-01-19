/**
 * Tests for Structured Logger
 *
 * @module observability/__tests__/logger
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StructuredLogger,
  LogBuffer,
  LogFilter,
  initializeLogger,
  getLogger,
  setLogger,
} from '../logger';
import { CorrelationIdManager } from '../tracing';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let correlationManager: CorrelationIdManager;

  beforeEach(() => {
    correlationManager = new CorrelationIdManager();
    logger = new StructuredLogger(
      {
        minLevel: 'debug',
        pretty: false,
        enabled: true,
      },
      correlationManager
    );
  });

  it('should create logger instance', () => {
    expect(logger).toBeDefined();
  });

  it('should log debug message', () => {
    const consoleSpy = vi.spyOn(console, 'debug');

    logger.debug('Debug message');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log info message', () => {
    const consoleSpy = vi.spyOn(console, 'info');

    logger.info('Info message');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log warning message', () => {
    const consoleSpy = vi.spyOn(console, 'warn');

    logger.warn('Warning message');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log error message', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    const error = new Error('Test error');

    logger.error('Error message', error);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log fatal message', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    const error = new Error('Fatal error');

    logger.fatal('Fatal message', error);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should include correlation ID in logs', () => {
    const consoleSpy = vi.spyOn(console, 'info');
    correlationManager.setCorrelationId('test-correlation-id');

    logger.info('Test message');

    const logCall = consoleSpy.mock.calls[0]?.[0];
    const logEntry = logCall ? JSON.parse(logCall) : null;

    expect(logEntry?.correlationId).toBe('test-correlation-id');
    consoleSpy.mockRestore();
  });

  it('should include context in logs', () => {
    const consoleSpy = vi.spyOn(console, 'info');

    logger.info('Test message', {
      userId: 'user-123',
      operation: 'sync',
    });

    const logCall = consoleSpy.mock.calls[0]?.[0];
    const logEntry = logCall ? JSON.parse(logCall) : null;

    expect(logEntry?.userId).toBe('user-123');
    expect(logEntry?.operation).toBe('sync');
    consoleSpy.mockRestore();
  });

  it('should set persistent context', () => {
    const consoleSpy = vi.spyOn(console, 'info');

    logger.setContext('userId', 'user-123');
    logger.info('Test message');

    const logCall = consoleSpy.mock.calls[0]?.[0];
    const logEntry = logCall ? JSON.parse(logCall) : null;

    expect(logEntry?.userId).toBe('user-123');
    consoleSpy.mockRestore();
  });

  it('should clear persistent context', () => {
    const consoleSpy = vi.spyOn(console, 'info');

    logger.setContext('userId', 'user-123');
    logger.clearContext('userId');
    logger.info('Test message');

    const logCall = consoleSpy.mock.calls[0]?.[0];
    const logEntry = logCall ? JSON.parse(logCall) : null;

    expect(logEntry?.userId).toBeUndefined();
    consoleSpy.mockRestore();
  });

  it('should filter logs by level', () => {
    const filteredLogger = new StructuredLogger(
      {
        minLevel: 'warn',
        enabled: true,
      },
      correlationManager
    );

    const consoleSpy = vi.spyOn(console, 'debug');

    filteredLogger.debug('Debug message');

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should create child logger with context', () => {
    const childLogger = logger.child({ userId: 'user-123' });
    const consoleSpy = vi.spyOn(console, 'info');

    childLogger.info('Child message');

    const logCall = consoleSpy.mock.calls[0]?.[0];
    const logEntry = logCall ? JSON.parse(logCall) : null;

    expect(logEntry?.userId).toBe('user-123');
    consoleSpy.mockRestore();
  });

  it('should handle disabled logging', () => {
    const disabledLogger = new StructuredLogger(
      {
        minLevel: 'info',
        enabled: false,
      },
      correlationManager
    );

    const consoleSpy = vi.spyOn(console, 'info');

    disabledLogger.info('Test message');

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('LogBuffer', () => {
  it('should buffer log entries', () => {
    const flushedLogs: any[] = [];
    const buffer = new LogBuffer(5, 10000, (logs) => {
      flushedLogs.push(...logs);
    });

    buffer.add({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Test 1',
    });

    buffer.add({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Test 2',
    });

    expect(flushedLogs.length).toBe(0);
  });

  it('should flush when buffer is full', () => {
    const flushedLogs: any[] = [];
    const buffer = new LogBuffer(2, 10000, (logs) => {
      flushedLogs.push(...logs);
    });

    buffer.add({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Test 1',
    });

    buffer.add({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Test 2',
    });

    expect(flushedLogs.length).toBe(2);
  });

  it('should flush manually', () => {
    const flushedLogs: any[] = [];
    const buffer = new LogBuffer(10, 10000, (logs) => {
      flushedLogs.push(...logs);
    });

    buffer.add({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Test 1',
    });

    buffer.flush();

    expect(flushedLogs.length).toBe(1);
  });

  it('should cleanup on destroy', () => {
    const flushedLogs: any[] = [];
    const buffer = new LogBuffer(10, 10000, (logs) => {
      flushedLogs.push(...logs);
    });

    buffer.add({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Test 1',
    });

    buffer.destroy();

    expect(flushedLogs.length).toBe(1);
  });
});

describe('LogFilter', () => {
  let filter: LogFilter;

  beforeEach(() => {
    filter = new LogFilter();
  });

  it('should filter sensitive keys', () => {
    const data = {
      username: 'user123',
      password: 'secret123',
      email: 'user@example.com',
    };

    const filtered = filter.filter(data);

    expect(filtered.username).toBe('user123');
    expect(filtered.password).toBe('[REDACTED]');
    expect(filtered.email).toBe('user@example.com');
  });

  it('should filter nested sensitive data', () => {
    const data = {
      user: {
        username: 'user123',
        password: 'secret123',
      },
    };

    const filtered = filter.filter(data);

    expect(filtered.user.username).toBe('user123');
    expect(filtered.user.password).toBe('[REDACTED]');
  });

  it('should filter arrays', () => {
    const data = [
      { username: 'user1', password: 'secret1' },
      { username: 'user2', password: 'secret2' },
    ];

    const filtered = filter.filter(data);

    expect(filtered[0].password).toBe('[REDACTED]');
    expect(filtered[1].password).toBe('[REDACTED]');
  });

  it('should add custom sensitive key', () => {
    filter.addSensitiveKey('customSecret');

    const data = {
      customSecret: 'my-secret',
      public: 'public-data',
    };

    const filtered = filter.filter(data);

    expect(filtered.customSecret).toBe('[REDACTED]');
    expect(filtered.public).toBe('public-data');
  });

  it('should remove sensitive key', () => {
    filter.removeSensitiveKey('password');

    const data = {
      password: 'secret123',
    };

    const filtered = filter.filter(data);

    expect(filtered.password).toBe('secret123');
  });

  it('should handle non-object data', () => {
    expect(filter.filter('string')).toBe('string');
    expect(filter.filter(123)).toBe(123);
    expect(filter.filter(null)).toBe(null);
  });
});

describe('Global Logger', () => {
  it('should initialize global logger', () => {
    const logger = initializeLogger({
      minLevel: 'info',
      enabled: true,
    });

    expect(logger).toBeDefined();
    expect(getLogger()).toBe(logger);
  });

  it('should set global logger', () => {
    const customLogger = new StructuredLogger({
      minLevel: 'debug',
      enabled: true,
    });

    setLogger(customLogger);

    expect(getLogger()).toBe(customLogger);
  });
});
