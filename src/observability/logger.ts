/**
 * Structured JSON Logger
 *
 * Provides structured, JSON-formatted logging with correlation IDs,
 * log levels, and rich context for log aggregation systems.
 *
 * @module observability/logger
 */

import { CorrelationIdManager } from './tracing';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  userId?: string;
  deviceId?: string;
  operation?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, any>;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  pretty?: boolean;
  enabled?: boolean;
  destination?: 'console' | 'custom';
  customHandler?: (entry: LogEntry) => void;
}

/**
 * Log level priorities for filtering
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/**
 * Structured logger with JSON output
 */
export class StructuredLogger {
  private config: LoggerConfig;
  private correlationManager: CorrelationIdManager;
  private contextData: Record<string, any> = {};

  constructor(
    config: LoggerConfig,
    correlationManager?: CorrelationIdManager
  ) {
    this.config = {
      pretty: false,
      enabled: true,
      destination: 'console',
      ...config,
      minLevel: config.minLevel || 'info',
    };
    this.correlationManager = correlationManager || new CorrelationIdManager();
  }

  /**
   * Set persistent context data
   */
  setContext(key: string, value: any): void {
    this.contextData[key] = value;
  }

  /**
   * Clear persistent context data
   */
  clearContext(key?: string): void {
    if (key) {
      delete this.contextData[key];
    } else {
      this.contextData = {};
    }
  }

  /**
   * Get current context
   */
  getContext(): Record<string, any> {
    return { ...this.contextData };
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    const errorContext = error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : {};

    this.log('error', message, {
      ...errorContext,
      ...context,
    });
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, context?: Record<string, any>): void {
    const errorContext = error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : {};

    this.log('fatal', message, {
      ...errorContext,
      ...context,
    });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // Check if logging is enabled
    if (!this.config.enabled) {
      return;
    }

    // Check log level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.minLevel]) {
      return;
    }

    // Build log entry
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationManager.getCorrelationId(),
      ...this.contextData,
      ...context,
    };

    // Output log
    this.output(entry);
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (this.config.destination === 'custom' && this.config.customHandler) {
      this.config.customHandler(entry);
      return;
    }

    // Console output
    const output = this.config.pretty ? this.formatPretty(entry) : JSON.stringify(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'fatal':
        console.error(output);
        break;
    }
  }

  /**
   * Format log entry for pretty printing
   */
  private formatPretty(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const correlationId = entry.correlationId ? `[${entry.correlationId}]` : '';
    const message = entry.message;

    let output = `${timestamp} ${level} ${correlationId} ${message}`;

    // Add context (create new object to avoid modifying original)
    const context: Partial<LogEntry> = { ...entry };
    if ('timestamp' in context) delete (context as any).timestamp;
    if ('level' in context) delete (context as any).level;
    if ('message' in context) delete (context as any).message;
    if ('correlationId' in context) delete (context as any).correlationId;

    if (Object.keys(context).length > 0) {
      output += `\n  ${JSON.stringify(context, null, 2)}`;
    }

    return output;
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): StructuredLogger {
    const childLogger = new StructuredLogger(this.config, this.correlationManager);
    childLogger.contextData = {
      ...this.contextData,
      ...context,
    };
    return childLogger;
  }
}

/**
 * Log aggregation buffer for batching
 */
export class LogBuffer {
  private buffer: LogEntry[] = [];
  private maxSize: number;
  private flushInterval: number;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private onFlush: (logs: LogEntry[]) => void;

  constructor(
    maxSize: number = 100,
    flushInterval: number = 5000,
    onFlush: (logs: LogEntry[]) => void
  ) {
    this.maxSize = maxSize;
    this.flushInterval = flushInterval;
    this.onFlush = onFlush;

    this.startFlushTimer();
  }

  /**
   * Add log entry to buffer
   */
  add(entry: LogEntry): void {
    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= this.maxSize) {
      this.flush();
    }
  }

  /**
   * Flush buffer
   */
  flush(): void {
    if (this.buffer.length === 0) {
      return;
    }

    const logs = [...this.buffer];
    this.buffer = [];

    try {
      this.onFlush(logs);
    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop automatic flush timer
   */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopFlushTimer();
    this.flush();
  }
}

/**
 * Log filter for PII and sensitive data
 */
export class LogFilter {
  private sensitiveKeys: Set<string> = new Set([
    'password',
    'passphrase',
    'secret',
    'token',
    'apiKey',
    'encryptionKey',
    'privateKey',
    'creditCard',
    'ssn',
    'taxId',
  ]);

  /**
   * Add sensitive key
   */
  addSensitiveKey(key: string): void {
    this.sensitiveKeys.add(key.toLowerCase());
  }

  /**
   * Remove sensitive key
   */
  removeSensitiveKey(key: string): void {
    this.sensitiveKeys.delete(key.toLowerCase());
  }

  /**
   * Filter sensitive data from object
   */
  filter(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.filter(item));
    }

    const filtered: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitive(key)) {
        filtered[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        filtered[key] = this.filter(value);
      } else {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Check if key is sensitive
   */
  private isSensitive(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return Array.from(this.sensitiveKeys).some((sensitiveKey) =>
      lowerKey.includes(sensitiveKey)
    );
  }
}

/**
 * Create logger with log aggregation
 */
export function createAggregatedLogger(
  config: LoggerConfig,
  sendToAggregator: (logs: LogEntry[]) => void,
  bufferSize: number = 100,
  flushInterval: number = 5000
): StructuredLogger {
  const buffer = new LogBuffer(bufferSize, flushInterval, sendToAggregator);
  const filter = new LogFilter();

  return new StructuredLogger({
    ...config,
    destination: 'custom',
    customHandler: (entry) => {
      // Filter sensitive data
      const filtered = filter.filter(entry);

      // Add to buffer
      buffer.add(filtered);

      // Also log to console in dev mode
      if (config.pretty) {
        console.log(JSON.stringify(filtered, null, 2));
      }
    },
  });
}

// Singleton instance
let loggerInstance: StructuredLogger | null = null;

/**
 * Initialize global logger
 */
export function initializeLogger(config: LoggerConfig): StructuredLogger {
  if (!loggerInstance) {
    loggerInstance = new StructuredLogger(config);
  }
  return loggerInstance;
}

/**
 * Get global logger instance
 */
export function getLogger(): StructuredLogger | null {
  return loggerInstance;
}

/**
 * Set global logger instance
 */
export function setLogger(logger: StructuredLogger): void {
  loggerInstance = logger;
}
