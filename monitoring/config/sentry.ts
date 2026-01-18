/**
 * Sentry Error Tracking Configuration
 *
 * Comprehensive error tracking and performance monitoring using Sentry.
 * Configured for Cloudflare Workers and browser environments.
 *
 * @module monitoring/sentry
 */

import * as Sentry from '@sentry/browser';
import type { BrowserOptions } from '@sentry/browser';

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  beforeSend?: (event: Sentry.Event) => Sentry.Event | null;
}

/**
 * Initialize Sentry for browser/frontend
 */
export function initializeSentry(config: SentryConfig): void {
  const options: BrowserOptions = {
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,

    // Performance Monitoring
    tracesSampleRate: config.tracesSampleRate || 0.1, // 10% of transactions

    // Integration configuration
    integrations: [
      new Sentry.BrowserTracing({
        // Set sampling rate for performance monitoring
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/.*\.gracefulbooks\.com/,
        ],
      }),
      new Sentry.Replay({
        // Session Replay (5% of sessions, 100% of error sessions)
        sessionSampleRate: 0.05,
        errorSampleRate: 1.0,
      }),
    ],

    // Error filtering
    beforeSend: config.beforeSend || defaultBeforeSend,

    // Ignore specific errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'canvas.contentDocument',
      // Random plugins/extensions
      'window.webkit',
      // Network errors that are expected
      'NetworkError',
      'AbortError',
      // User cancelled requests
      'Request aborted',
      'User denied',
    ],

    // Filter out sensitive data
    beforeBreadcrumb(breadcrumb) {
      // Don't capture console logs in production
      if (breadcrumb.category === 'console' && config.environment === 'production') {
        return null;
      }
      return breadcrumb;
    },
  };

  Sentry.init(options);
}

/**
 * Default beforeSend hook - filters PII and sensitive data
 */
function defaultBeforeSend(event: Sentry.Event): Sentry.Event | null {
  // Filter out events with financial data in the message
  if (event.message && containsSensitiveData(event.message)) {
    event.message = '[REDACTED - Contains sensitive financial data]';
  }

  // Scrub request data
  if (event.request) {
    event.request.cookies = undefined;
    event.request.headers = filterHeaders(event.request.headers);
    event.request.data = scrubSensitiveData(event.request.data);
  }

  // Scrub extra context
  if (event.extra) {
    event.extra = scrubSensitiveData(event.extra);
  }

  return event;
}

/**
 * Check if text contains sensitive data
 */
function containsSensitiveData(text: string): boolean {
  const sensitivePatterns = [
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\$\d+[,\d]*\.\d{2}/, // Currency amounts
  ];

  return sensitivePatterns.some(pattern => pattern.test(text));
}

/**
 * Filter sensitive headers
 */
function filterHeaders(headers: any): any {
  if (!headers) return headers;

  const filtered = { ...headers };
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
  ];

  sensitiveHeaders.forEach(header => {
    if (filtered[header]) {
      filtered[header] = '[REDACTED]';
    }
  });

  return filtered;
}

/**
 * Recursively scrub sensitive data from objects
 */
function scrubSensitiveData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const scrubbed: any = Array.isArray(data) ? [] : {};
  const sensitiveKeys = [
    'password',
    'token',
    'apiKey',
    'secret',
    'encryptionKey',
    'masterKey',
    'passphrase',
    'accountNumber',
    'routingNumber',
    'ssn',
    'taxId',
  ];

  for (const key in data) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof data[key] === 'object') {
      scrubbed[key] = scrubSensitiveData(data[key]);
    } else {
      scrubbed[key] = data[key];
    }
  }

  return scrubbed;
}

/**
 * Capture error with context
 */
export function captureError(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    level?: Sentry.SeverityLevel;
    extra?: Record<string, any>;
    user?: {
      id?: string;
      email?: string;
      username?: string;
    };
  }
): string {
  Sentry.withScope(scope => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context?.level) {
      scope.setLevel(context.level);
    }

    if (context?.extra) {
      scope.setContext('extra', scrubSensitiveData(context.extra));
    }

    if (context?.user) {
      // Only set user ID, never email or username for privacy
      scope.setUser({ id: context.user.id });
    }

    Sentry.captureException(error);
  });

  return error.message;
}

/**
 * Capture message with context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
): void {
  Sentry.withScope(scope => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context?.extra) {
      scope.setContext('extra', scrubSensitiveData(context.extra));
    }

    scope.setLevel(level);
    Sentry.captureMessage(message);
  });
}

/**
 * Set user context (privacy-safe)
 */
export function setUser(userId: string | null): void {
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data: data ? scrubSensitiveData(data) : undefined,
  });
}

/**
 * Sentry configuration for Cloudflare Workers
 *
 * Note: Cloudflare Workers require a different Sentry package
 * (@sentry/cloudflare) which is not included here. This is
 * placeholder documentation for when it's implemented.
 */
export const workerSentryConfig = {
  /**
   * Initialize Sentry in a Cloudflare Worker
   *
   * @example
   * import * as Sentry from '@sentry/cloudflare';
   *
   * export default {
   *   async fetch(request, env, ctx) {
   *     const sentry = Sentry.init({
   *       dsn: env.SENTRY_DSN,
   *       environment: env.ENVIRONMENT,
   *       tracesSampleRate: 0.1,
   *     });
   *
   *     try {
   *       return await handleRequest(request, env, ctx);
   *     } catch (error) {
   *       Sentry.captureException(error);
   *       return new Response('Internal Server Error', { status: 500 });
   *     }
   *   }
   * };
   */
  init: 'See documentation above',
};

/**
 * Performance monitoring helpers
 */
export class PerformanceMonitor {
  private startTime: number;
  private operationName: string;

  constructor(operationName: string) {
    this.operationName = operationName;
    this.startTime = Date.now();
  }

  finish(status: 'success' | 'failure' = 'success'): void {
    const duration = Date.now() - this.startTime;

    // Record as Sentry transaction
    const transaction = Sentry.startTransaction({
      name: this.operationName,
      op: 'operation',
    });

    transaction.setStatus(status === 'success' ? 'ok' : 'internal_error');
    transaction.setMeasurement('duration', duration, 'millisecond');
    transaction.finish();

    // Also add as breadcrumb
    addBreadcrumb(
      `${this.operationName} completed in ${duration}ms`,
      'performance',
      'info',
      { duration, status }
    );
  }
}

/**
 * Wrapper for monitoring async operations
 */
export async function monitorAsync<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const monitor = new PerformanceMonitor(operationName);

  try {
    const result = await operation();
    monitor.finish('success');
    return result;
  } catch (error) {
    monitor.finish('failure');
    throw error;
  }
}
