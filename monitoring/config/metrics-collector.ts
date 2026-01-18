/**
 * Metrics Collector
 *
 * Collects and aggregates key metrics including response time,
 * error rate, throughput, and custom business metrics.
 *
 * @module monitoring/metrics-collector
 */

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface MetricAggregation {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Time-series metrics collector with aggregation
 */
export class MetricsCollector {
  private metrics: Map<string, number[]>;
  private maxDataPoints: number;

  constructor(maxDataPoints: number = 1000) {
    this.metrics = new Map();
    this.maxDataPoints = maxDataPoints;
  }

  /**
   * Record a metric value
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    const values = this.metrics.get(key) || [];

    values.push(value);

    // Keep only the latest maxDataPoints
    if (values.length > this.maxDataPoints) {
      values.shift();
    }

    this.metrics.set(key, values);
  }

  /**
   * Get aggregated metrics
   */
  getAggregation(name: string, tags?: Record<string, string>): MetricAggregation | null {
    const key = this.getMetricKey(name, tags);
    const values = this.metrics.get(key);

    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);

    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };
  }

  /**
   * Get current metric value
   */
  getCurrent(name: string, tags?: Record<string, string>): number | null {
    const key = this.getMetricKey(name, tags);
    const values = this.metrics.get(key);

    if (!values || values.length === 0) {
      return null;
    }

    return values[values.length - 1];
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(new Set(
      Array.from(this.metrics.keys()).map(key => key.split(':')[0])
    ));
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Generate metric key
   */
  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }

    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    return `${name}:${tagStr}`;
  }
}

/**
 * Response time tracker
 */
export class ResponseTimeTracker {
  private collector: MetricsCollector;

  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }

  /**
   * Start tracking a request
   */
  startRequest(): RequestTimer {
    return new RequestTimer(this.collector);
  }

  /**
   * Get response time statistics
   */
  getStats(endpoint?: string): MetricAggregation | null {
    const tags = endpoint ? { endpoint } : undefined;
    return this.collector.getAggregation('response_time', tags);
  }
}

/**
 * Request timer for measuring response times
 */
export class RequestTimer {
  private startTime: number;
  private collector: MetricsCollector;

  constructor(collector: MetricsCollector) {
    this.startTime = Date.now();
    this.collector = collector;
  }

  /**
   * End timing and record metric
   */
  end(endpoint: string, options?: {
    method?: string;
    status?: number;
    region?: string;
  }): number {
    const duration = Date.now() - this.startTime;

    this.collector.record('response_time', duration, {
      endpoint,
      method: options?.method || 'GET',
      status: String(options?.status || 200),
      region: options?.region || 'unknown',
    });

    return duration;
  }
}

/**
 * Error rate tracker
 */
export class ErrorRateTracker {
  private collector: MetricsCollector;
  private requestCounts: Map<string, { total: number; errors: number }>;

  constructor(collector: MetricsCollector) {
    this.collector = collector;
    this.requestCounts = new Map();
  }

  /**
   * Record a request
   */
  recordRequest(endpoint: string, isError: boolean): void {
    const counts = this.requestCounts.get(endpoint) || { total: 0, errors: 0 };
    counts.total++;
    if (isError) {
      counts.errors++;
    }
    this.requestCounts.set(endpoint, counts);

    // Calculate error rate
    const errorRate = (counts.errors / counts.total) * 100;
    this.collector.record('error_rate', errorRate, { endpoint });
  }

  /**
   * Get error rate for endpoint
   */
  getErrorRate(endpoint: string): number {
    const counts = this.requestCounts.get(endpoint);
    if (!counts || counts.total === 0) {
      return 0;
    }
    return (counts.errors / counts.total) * 100;
  }

  /**
   * Get overall error rate
   */
  getOverallErrorRate(): number {
    let totalRequests = 0;
    let totalErrors = 0;

    for (const counts of this.requestCounts.values()) {
      totalRequests += counts.total;
      totalErrors += counts.errors;
    }

    if (totalRequests === 0) {
      return 0;
    }

    return (totalErrors / totalRequests) * 100;
  }
}

/**
 * Throughput tracker (requests per second)
 */
export class ThroughputTracker {
  private collector: MetricsCollector;
  private windowSize: number; // in milliseconds
  private requestTimestamps: number[];

  constructor(collector: MetricsCollector, windowSize: number = 60000) {
    this.collector = collector;
    this.windowSize = windowSize;
    this.requestTimestamps = [];
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    const now = Date.now();
    this.requestTimestamps.push(now);

    // Remove old timestamps outside the window
    const cutoff = now - this.windowSize;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts >= cutoff);

    // Calculate throughput (requests per second)
    const throughput = (this.requestTimestamps.length / this.windowSize) * 1000;
    this.collector.record('throughput', throughput);
  }

  /**
   * Get current throughput (requests per second)
   */
  getThroughput(): number {
    const now = Date.now();
    const cutoff = now - this.windowSize;
    const recentRequests = this.requestTimestamps.filter(ts => ts >= cutoff);
    return (recentRequests.length / this.windowSize) * 1000;
  }
}

/**
 * Business metrics tracker
 */
export class BusinessMetricsTracker {
  private collector: MetricsCollector;

  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }

  /**
   * Record sync operation metrics
   */
  recordSyncOperation(duration: number, itemCount: number, success: boolean): void {
    this.collector.record('sync_duration', duration, {
      status: success ? 'success' : 'failure',
    });
    this.collector.record('sync_items', itemCount, {
      status: success ? 'success' : 'failure',
    });
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(operation: string, duration: number, rowCount: number): void {
    this.collector.record('db_query_duration', duration, { operation });
    this.collector.record('db_query_rows', rowCount, { operation });
  }

  /**
   * Record cache metrics
   */
  recordCacheOperation(hit: boolean): void {
    this.collector.record('cache_operation', hit ? 1 : 0);
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(): number {
    const aggregation = this.collector.getAggregation('cache_operation');
    if (!aggregation) {
      return 0;
    }
    return (aggregation.avg * 100);
  }
}

/**
 * Combined metrics manager
 */
export class MetricsManager {
  public collector: MetricsCollector;
  public responseTime: ResponseTimeTracker;
  public errorRate: ErrorRateTracker;
  public throughput: ThroughputTracker;
  public business: BusinessMetricsTracker;

  constructor(maxDataPoints: number = 1000) {
    this.collector = new MetricsCollector(maxDataPoints);
    this.responseTime = new ResponseTimeTracker(this.collector);
    this.errorRate = new ErrorRateTracker(this.collector);
    this.throughput = new ThroughputTracker(this.collector);
    this.business = new BusinessMetricsTracker(this.collector);
  }

  /**
   * Get all metrics summary
   */
  getSummary(): {
    responseTime: MetricAggregation | null;
    errorRate: number;
    throughput: number;
    cacheHitRate: number;
  } {
    return {
      responseTime: this.responseTime.getStats(),
      errorRate: this.errorRate.getOverallErrorRate(),
      throughput: this.throughput.getThroughput(),
      cacheHitRate: this.business.getCacheHitRate(),
    };
  }

  /**
   * Export metrics for reporting
   */
  exportMetrics(): Record<string, any> {
    const summary = this.getSummary();
    const metricNames = this.collector.getMetricNames();

    const metrics: Record<string, any> = {
      summary,
      details: {},
    };

    for (const name of metricNames) {
      metrics.details[name] = this.collector.getAggregation(name);
    }

    return metrics;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.collector.clear();
  }
}
