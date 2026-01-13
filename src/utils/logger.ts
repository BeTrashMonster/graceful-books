/**
 * Logging Service
 *
 * Centralized logging that can be configured per environment.
 * Replaces direct console.log calls throughout the codebase.
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Log entry structure
 */
interface LogEntry {
  level: LogLevel
  message: string
  timestamp: number
  context?: string
  data?: unknown
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableBuffer: boolean
  bufferSize: number
  onLog?: (entry: LogEntry) => void
}

/**
 * Default configuration based on environment
 */
const defaultConfig: LoggerConfig = {
  level: import.meta.env?.DEV ? LogLevel.DEBUG : LogLevel.WARN,
  enableConsole: import.meta.env?.DEV ?? true,
  enableBuffer: true,
  bufferSize: 100,
}

/**
 * Logger class
 */
class Logger {
  private config: LoggerConfig
  private buffer: LogEntry[] = []

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.config.level
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level
  }

  /**
   * Get buffered logs
   */
  getBuffer(): LogEntry[] {
    return [...this.buffer]
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.buffer = []
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: string,
    data?: unknown
  ): void {
    if (level < this.config.level) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
      data,
    }

    // Add to buffer
    if (this.config.enableBuffer) {
      this.buffer.push(entry)
      if (this.buffer.length > this.config.bufferSize) {
        this.buffer.shift()
      }
    }

    // Call custom handler if provided
    if (this.config.onLog) {
      this.config.onLog(entry)
    }

    // Console output
    if (this.config.enableConsole) {
      const prefix = context ? `[${context}]` : ''
      const logMessage = prefix ? `${prefix} ${message}` : message

      switch (level) {
        case LogLevel.DEBUG:
          // eslint-disable-next-line no-console
          console.debug(logMessage, data !== undefined ? data : '')
          break
        case LogLevel.INFO:
          // eslint-disable-next-line no-console
          console.info(logMessage, data !== undefined ? data : '')
          break
        case LogLevel.WARN:
          // eslint-disable-next-line no-console
          console.warn(logMessage, data !== undefined ? data : '')
          break
        case LogLevel.ERROR:
          // eslint-disable-next-line no-console
          console.error(logMessage, data !== undefined ? data : '')
          break
      }
    }
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, data?: unknown): void
  debug(context: string, message: string, data?: unknown): void
  debug(
    contextOrMessage: string,
    messageOrData?: string | unknown,
    data?: unknown
  ): void {
    if (typeof messageOrData === 'string') {
      this.log(LogLevel.DEBUG, messageOrData, contextOrMessage, data)
    } else {
      this.log(LogLevel.DEBUG, contextOrMessage, undefined, messageOrData)
    }
  }

  /**
   * Log info message
   */
  info(message: string, data?: unknown): void
  info(context: string, message: string, data?: unknown): void
  info(
    contextOrMessage: string,
    messageOrData?: string | unknown,
    data?: unknown
  ): void {
    if (typeof messageOrData === 'string') {
      this.log(LogLevel.INFO, messageOrData, contextOrMessage, data)
    } else {
      this.log(LogLevel.INFO, contextOrMessage, undefined, messageOrData)
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: unknown): void
  warn(context: string, message: string, data?: unknown): void
  warn(
    contextOrMessage: string,
    messageOrData?: string | unknown,
    data?: unknown
  ): void {
    if (typeof messageOrData === 'string') {
      this.log(LogLevel.WARN, messageOrData, contextOrMessage, data)
    } else {
      this.log(LogLevel.WARN, contextOrMessage, undefined, messageOrData)
    }
  }

  /**
   * Log error message
   */
  error(message: string, data?: unknown): void
  error(context: string, message: string, data?: unknown): void
  error(
    contextOrMessage: string,
    messageOrData?: string | unknown,
    data?: unknown
  ): void {
    if (typeof messageOrData === 'string') {
      this.log(LogLevel.ERROR, messageOrData, contextOrMessage, data)
    } else {
      this.log(LogLevel.ERROR, contextOrMessage, undefined, messageOrData)
    }
  }

  /**
   * Create a child logger with a specific context
   */
  child(context: string): ContextLogger {
    return new ContextLogger(this, context)
  }
}

/**
 * Context-bound logger
 */
class ContextLogger {
  constructor(
    private parent: Logger,
    private context: string
  ) {}

  debug(message: string, data?: unknown): void {
    this.parent.debug(this.context, message, data)
  }

  info(message: string, data?: unknown): void {
    this.parent.info(this.context, message, data)
  }

  warn(message: string, data?: unknown): void {
    this.parent.warn(this.context, message, data)
  }

  error(message: string, data?: unknown): void {
    this.parent.error(this.context, message, data)
  }
}

/**
 * Singleton logger instance
 */
export const logger = new Logger()

/**
 * Create a context-specific logger
 *
 * @example
 * const dbLogger = logger.child('Database')
 * dbLogger.info('Connection established')
 * // Output: [Database] Connection established
 */
export function createLogger(context: string): ContextLogger {
  return logger.child(context)
}
