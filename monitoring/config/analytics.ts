/**
 * Cloudflare Workers Analytics Integration
 *
 * Provides comprehensive application performance monitoring using
 * Cloudflare Analytics Engine for real-time metrics collection.
 *
 * @module monitoring/analytics
 */

export interface MetricData {
  timestamp: number;
  metric: string;
  value: number;
  labels?: Record<string, string>;
}

export interface AnalyticsEvent {
  // Required fields
  blobs: string[];
  doubles: number[];
  indexes: string[];
}

/**
 * Analytics client for recording metrics to Cloudflare Analytics Engine
 */
export class AnalyticsClient {
  private dataset: AnalyticsEngineDataset | null;
  private env: string;

  constructor(dataset: AnalyticsEngineDataset | null, env: string = 'production') {
    this.dataset = dataset;
    this.env = env;
  }

  /**
   * Record a metric to Analytics Engine
   */
  recordMetric(metric: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.dataset) {
      console.warn('Analytics dataset not available');
      return;
    }

    try {
      const dataPoint: AnalyticsEvent = {
        blobs: [
          metric,
          this.env,
          labels.endpoint || '',
          labels.region || '',
          labels.status || '',
          labels.method || '',
        ],
        doubles: [value, Date.now()],
        indexes: [metric],
      };

      this.dataset.writeDataPoint(dataPoint);
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }

  /**
   * Record response time metric
   */
  recordResponseTime(endpoint: string, durationMs: number, options: {
    method?: string;
    status?: number;
    region?: string;
  } = {}): void {
    this.recordMetric('response_time', durationMs, {
      endpoint,
      method: options.method || 'GET',
      status: String(options.status || 200),
      region: options.region || 'unknown',
    });
  }

  /**
   * Record error rate metric
   */
  recordError(endpoint: string, errorType: string, options: {
    method?: string;
    region?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  } = {}): void {
    this.recordMetric('error_rate', 1, {
      endpoint,
      errorType,
      method: options.method || 'GET',
      region: options.region || 'unknown',
      severity: options.severity || 'medium',
    });
  }

  /**
   * Record throughput metric (requests per second)
   */
  recordThroughput(endpoint: string, count: number = 1): void {
    this.recordMetric('throughput', count, {
      endpoint,
    });
  }

  /**
   * Record sync operation metrics
   */
  recordSyncMetric(operation: string, durationMs: number, options: {
    success: boolean;
    itemCount?: number;
    dataSize?: number;
    region?: string;
  }): void {
    this.recordMetric('sync_operation', durationMs, {
      operation,
      status: options.success ? 'success' : 'failure',
      region: options.region || 'unknown',
      itemCount: String(options.itemCount || 0),
      dataSize: String(options.dataSize || 0),
    });
  }

  /**
   * Record database query metrics
   */
  recordDatabaseMetric(operation: string, durationMs: number, options: {
    success: boolean;
    rowCount?: number;
    region?: string;
  }): void {
    this.recordMetric('database_query', durationMs, {
      operation,
      status: options.success ? 'success' : 'failure',
      region: options.region || 'unknown',
      rowCount: String(options.rowCount || 0),
    });
  }

  /**
   * Record cache hit/miss metrics
   */
  recordCacheMetric(cacheKey: string, hit: boolean): void {
    this.recordMetric('cache_hit_rate', hit ? 1 : 0, {
      cacheKey,
      status: hit ? 'hit' : 'miss',
    });
  }

  /**
   * Record rate limit metrics
   */
  recordRateLimitMetric(endpoint: string, limited: boolean, options: {
    limit?: number;
    remaining?: number;
  } = {}): void {
    this.recordMetric('rate_limit', limited ? 1 : 0, {
      endpoint,
      status: limited ? 'limited' : 'allowed',
      limit: String(options.limit || 0),
      remaining: String(options.remaining || 0),
    });
  }
}

/**
 * Middleware to automatically track request metrics
 */
export function withAnalytics(
  handler: (request: Request, env: Record<string, unknown>, ctx: ExecutionContext) => Promise<Response>,
  analyticsDataset: AnalyticsEngineDataset | null
) {
  return async (request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> => {
    const startTime = Date.now();
    const url = new URL(request.url);
    const analytics = new AnalyticsClient(analyticsDataset, env.ENVIRONMENT || 'production');

    try {
      // Execute handler
      const response = await handler(request, env, ctx);
      const duration = Date.now() - startTime;

      // Record metrics
      analytics.recordResponseTime(url.pathname, duration, {
        method: request.method,
        status: response.status,
        region: request.cf?.colo as string || 'unknown',
      });

      analytics.recordThroughput(url.pathname);

      // Record errors (4xx, 5xx)
      if (response.status >= 400) {
        analytics.recordError(url.pathname, `http_${response.status}`, {
          method: request.method,
          region: request.cf?.colo as string || 'unknown',
          severity: response.status >= 500 ? 'high' : 'medium',
        });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record error
      analytics.recordError(url.pathname, error instanceof Error ? error.name : 'unknown', {
        method: request.method,
        region: request.cf?.colo as string || 'unknown',
        severity: 'critical',
      });

      analytics.recordResponseTime(url.pathname, duration, {
        method: request.method,
        status: 500,
        region: request.cf?.colo as string || 'unknown',
      });

      throw error;
    }
  };
}

/**
 * SLA metrics calculator
 */
export class SLAMetrics {
  private metrics: {
    totalRequests: number;
    successfulRequests: number;
    totalResponseTime: number;
    errors: number;
  };

  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      totalResponseTime: 0,
      errors: 0,
    };
  }

  recordRequest(success: boolean, responseTimeMs: number): void {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.errors++;
    }
    this.metrics.totalResponseTime += responseTimeMs;
  }

  getUptime(): number {
    if (this.metrics.totalRequests === 0) return 100;
    return (this.metrics.successfulRequests / this.metrics.totalRequests) * 100;
  }

  getErrorRate(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return (this.metrics.errors / this.metrics.totalRequests) * 100;
  }

  getAverageResponseTime(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return this.metrics.totalResponseTime / this.metrics.totalRequests;
  }

  getMetrics() {
    return {
      totalRequests: this.metrics.totalRequests,
      uptime: this.getUptime(),
      errorRate: this.getErrorRate(),
      averageResponseTime: this.getAverageResponseTime(),
    };
  }

  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      totalResponseTime: 0,
      errors: 0,
    };
  }
}
