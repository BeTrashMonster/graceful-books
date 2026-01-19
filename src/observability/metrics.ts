/**
 * Custom Metrics Collection
 *
 * Collects and tracks custom business metrics including CRDT conflict rate,
 * sync latency, user activity, and other application-specific metrics.
 *
 * @module observability/metrics
 */

import { MetricsCollector } from '../../monitoring/config/metrics-collector';

export interface ConflictMetric {
  timestamp: number;
  entityType: string;
  conflictType: string;
  resolved: boolean;
  resolutionTime?: number;
}

export interface SyncLatencyMetric {
  timestamp: number;
  clientId: string;
  operation: string;
  latency: number;
  itemCount: number;
  dataSize: number;
  success: boolean;
}

export interface UserActivityMetric {
  timestamp: number;
  userId: string;
  action: string;
  feature: string;
  duration?: number;
}

export interface FeatureAdoptionMetric {
  feature: string;
  firstUsed: number;
  usageCount: number;
  lastUsed: number;
  users: Set<string>;
}

/**
 * CRDT Conflict Rate Tracker
 */
export class ConflictRateTracker {
  private collector: MetricsCollector;
  private conflicts: ConflictMetric[] = [];
  private windowSize: number = 3600000; // 1 hour

  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }

  /**
   * Record a CRDT conflict
   */
  recordConflict(
    entityType: string,
    conflictType: string,
    resolved: boolean,
    resolutionTime?: number
  ): void {
    const conflict: ConflictMetric = {
      timestamp: Date.now(),
      entityType,
      conflictType,
      resolved,
      resolutionTime,
    };

    this.conflicts.push(conflict);

    // Clean old conflicts
    this.cleanOldConflicts();

    // Record metrics
    this.collector.record('crdt_conflict', 1, {
      entityType,
      conflictType,
      resolved: String(resolved),
    });

    if (resolutionTime !== undefined) {
      this.collector.record('crdt_resolution_time', resolutionTime, {
        entityType,
        conflictType,
      });
    }
  }

  /**
   * Get conflicts per hour
   */
  getConflictsPerHour(): number {
    const now = Date.now();
    const recentConflicts = this.conflicts.filter(
      (c) => now - c.timestamp < this.windowSize
    );
    return recentConflicts.length;
  }

  /**
   * Get conflict rate by entity type
   */
  getConflictRateByType(): Record<string, number> {
    const now = Date.now();
    const recentConflicts = this.conflicts.filter(
      (c) => now - c.timestamp < this.windowSize
    );

    const rates: Record<string, number> = {};

    for (const conflict of recentConflicts) {
      rates[conflict.entityType] = (rates[conflict.entityType] || 0) + 1;
    }

    return rates;
  }

  /**
   * Get average resolution time
   */
  getAverageResolutionTime(): number {
    const now = Date.now();
    const recentConflicts = this.conflicts.filter(
      (c) => now - c.timestamp < this.windowSize && c.resolutionTime !== undefined
    );

    if (recentConflicts.length === 0) {
      return 0;
    }

    const totalTime = recentConflicts.reduce(
      (sum, c) => sum + (c.resolutionTime || 0),
      0
    );

    return totalTime / recentConflicts.length;
  }

  /**
   * Clean old conflicts
   */
  private cleanOldConflicts(): void {
    const now = Date.now();
    this.conflicts = this.conflicts.filter(
      (c) => now - c.timestamp < this.windowSize * 2
    );
  }
}

/**
 * Sync Latency Tracker (per client)
 */
export class SyncLatencyTracker {
  private collector: MetricsCollector;
  private latencies: SyncLatencyMetric[] = [];
  private windowSize: number = 3600000; // 1 hour

  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }

  /**
   * Record sync latency
   */
  recordSyncLatency(
    clientId: string,
    operation: string,
    latency: number,
    itemCount: number,
    dataSize: number,
    success: boolean
  ): void {
    const metric: SyncLatencyMetric = {
      timestamp: Date.now(),
      clientId,
      operation,
      latency,
      itemCount,
      dataSize,
      success,
    };

    this.latencies.push(metric);

    // Clean old metrics
    this.cleanOldLatencies();

    // Record to collector
    this.collector.record('sync_latency', latency, {
      clientId,
      operation,
      success: String(success),
    });

    this.collector.record('sync_item_count', itemCount, {
      clientId,
      operation,
    });

    this.collector.record('sync_data_size', dataSize, {
      clientId,
      operation,
    });
  }

  /**
   * Get average latency per client
   */
  getAverageLatencyPerClient(): Record<string, number> {
    const now = Date.now();
    const recentLatencies = this.latencies.filter(
      (l) => now - l.timestamp < this.windowSize
    );

    const clientLatencies: Record<string, number[]> = {};

    for (const latency of recentLatencies) {
      if (!clientLatencies[latency.clientId]) {
        clientLatencies[latency.clientId] = [];
      }
      clientLatencies[latency.clientId]!.push(latency.latency);
    }

    const averages: Record<string, number> = {};

    for (const [clientId, latencies] of Object.entries(clientLatencies)) {
      const sum = latencies.reduce((a, b) => a + b, 0);
      averages[clientId] = sum / latencies.length;
    }

    return averages;
  }

  /**
   * Get percentile latency
   */
  getPercentileLatency(percentile: number): number {
    const now = Date.now();
    const recentLatencies = this.latencies
      .filter((l) => now - l.timestamp < this.windowSize)
      .map((l) => l.latency)
      .sort((a, b) => a - b);

    if (recentLatencies.length === 0) {
      return 0;
    }

    const index = Math.ceil((percentile / 100) * recentLatencies.length) - 1;
    return recentLatencies[Math.max(0, index)];
  }

  /**
   * Get sync success rate
   */
  getSyncSuccessRate(): number {
    const now = Date.now();
    const recentLatencies = this.latencies.filter(
      (l) => now - l.timestamp < this.windowSize
    );

    if (recentLatencies.length === 0) {
      return 100;
    }

    const successful = recentLatencies.filter((l) => l.success).length;
    return (successful / recentLatencies.length) * 100;
  }

  /**
   * Clean old latencies
   */
  private cleanOldLatencies(): void {
    const now = Date.now();
    this.latencies = this.latencies.filter(
      (l) => now - l.timestamp < this.windowSize * 2
    );
  }
}

/**
 * User Activity Tracker
 */
export class UserActivityTracker {
  private collector: MetricsCollector;
  private activities: UserActivityMetric[] = [];
  private windowSize: number = 86400000; // 24 hours

  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }

  /**
   * Record user activity
   */
  recordActivity(
    userId: string,
    action: string,
    feature: string,
    duration?: number
  ): void {
    const activity: UserActivityMetric = {
      timestamp: Date.now(),
      userId,
      action,
      feature,
      duration,
    };

    this.activities.push(activity);

    // Clean old activities
    this.cleanOldActivities();

    // Record to collector
    this.collector.record('user_activity', 1, {
      userId,
      action,
      feature,
    });

    if (duration !== undefined) {
      this.collector.record('user_activity_duration', duration, {
        userId,
        action,
        feature,
      });
    }
  }

  /**
   * Get active users (last hour)
   */
  getActiveUsers(windowMs: number = 3600000): number {
    const now = Date.now();
    const recentActivities = this.activities.filter(
      (a) => now - a.timestamp < windowMs
    );

    const uniqueUsers = new Set(recentActivities.map((a) => a.userId));
    return uniqueUsers.size;
  }

  /**
   * Get activity by feature
   */
  getActivityByFeature(): Record<string, number> {
    const now = Date.now();
    const recentActivities = this.activities.filter(
      (a) => now - a.timestamp < this.windowSize
    );

    const featureCounts: Record<string, number> = {};

    for (const activity of recentActivities) {
      featureCounts[activity.feature] =
        (featureCounts[activity.feature] || 0) + 1;
    }

    return featureCounts;
  }

  /**
   * Get most active users
   */
  getMostActiveUsers(limit: number = 10): Array<{ userId: string; count: number }> {
    const now = Date.now();
    const recentActivities = this.activities.filter(
      (a) => now - a.timestamp < this.windowSize
    );

    const userCounts: Record<string, number> = {};

    for (const activity of recentActivities) {
      userCounts[activity.userId] = (userCounts[activity.userId] || 0) + 1;
    }

    return Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Clean old activities
   */
  private cleanOldActivities(): void {
    const now = Date.now();
    this.activities = this.activities.filter(
      (a) => now - a.timestamp < this.windowSize * 2
    );
  }
}

/**
 * Feature Adoption Tracker
 */
export class FeatureAdoptionTracker {
  private collector: MetricsCollector;
  private features: Map<string, FeatureAdoptionMetric> = new Map();

  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }

  /**
   * Record feature usage
   */
  recordFeatureUsage(feature: string, userId: string): void {
    const existing = this.features.get(feature);
    const now = Date.now();

    if (existing) {
      existing.usageCount++;
      existing.lastUsed = now;
      existing.users.add(userId);
    } else {
      this.features.set(feature, {
        feature,
        firstUsed: now,
        usageCount: 1,
        lastUsed: now,
        users: new Set([userId]),
      });
    }

    // Record to collector
    this.collector.record('feature_usage', 1, { feature });
  }

  /**
   * Get adoption rate
   */
  getAdoptionRate(feature: string, totalUsers: number): number {
    const metric = this.features.get(feature);
    if (!metric || totalUsers === 0) {
      return 0;
    }

    return (metric.users.size / totalUsers) * 100;
  }

  /**
   * Get most used features
   */
  getMostUsedFeatures(limit: number = 10): Array<{
    feature: string;
    usageCount: number;
    userCount: number;
  }> {
    return Array.from(this.features.values())
      .map((metric) => ({
        feature: metric.feature,
        usageCount: metric.usageCount,
        userCount: metric.users.size,
      }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Get feature metrics
   */
  getFeatureMetrics(feature: string): FeatureAdoptionMetric | null {
    const metric = this.features.get(feature);
    if (!metric) {
      return null;
    }

    return {
      ...metric,
      users: new Set(metric.users),
    };
  }
}

/**
 * API Error Rate Tracker
 */
export class ApiErrorRateTracker {
  private collector: MetricsCollector;
  private requests: Map<string, { total: number; errors: number }> = new Map();

  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }

  /**
   * Record API request
   */
  recordRequest(endpoint: string, isError: boolean, statusCode?: number): void {
    const stats = this.requests.get(endpoint) || { total: 0, errors: 0 };
    stats.total++;
    if (isError) {
      stats.errors++;
    }
    this.requests.set(endpoint, stats);

    // Record to collector
    this.collector.record('api_request', 1, {
      endpoint,
      error: String(isError),
      statusCode: String(statusCode || 0),
    });
  }

  /**
   * Get error rate for endpoint
   */
  getErrorRate(endpoint: string): number {
    const stats = this.requests.get(endpoint);
    if (!stats || stats.total === 0) {
      return 0;
    }
    return (stats.errors / stats.total) * 100;
  }

  /**
   * Get overall error rate
   */
  getOverallErrorRate(): number {
    let totalRequests = 0;
    let totalErrors = 0;

    for (const stats of this.requests.values()) {
      totalRequests += stats.total;
      totalErrors += stats.errors;
    }

    if (totalRequests === 0) {
      return 0;
    }

    return (totalErrors / totalRequests) * 100;
  }

  /**
   * Get endpoints with highest error rate
   */
  getHighestErrorRateEndpoints(limit: number = 10): Array<{
    endpoint: string;
    errorRate: number;
    total: number;
    errors: number;
  }> {
    return Array.from(this.requests.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        errorRate: (stats.errors / stats.total) * 100,
        total: stats.total,
        errors: stats.errors,
      }))
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit);
  }
}

/**
 * Combined observability metrics manager
 */
export class ObservabilityMetrics {
  public collector: MetricsCollector;
  public conflicts: ConflictRateTracker;
  public syncLatency: SyncLatencyTracker;
  public userActivity: UserActivityTracker;
  public featureAdoption: FeatureAdoptionTracker;
  public apiErrors: ApiErrorRateTracker;

  constructor() {
    this.collector = new MetricsCollector(10000);
    this.conflicts = new ConflictRateTracker(this.collector);
    this.syncLatency = new SyncLatencyTracker(this.collector);
    this.userActivity = new UserActivityTracker(this.collector);
    this.featureAdoption = new FeatureAdoptionTracker(this.collector);
    this.apiErrors = new ApiErrorRateTracker(this.collector);
  }

  /**
   * Get comprehensive metrics summary
   */
  getSummary(): {
    conflicts: {
      perHour: number;
      byType: Record<string, number>;
      avgResolutionTime: number;
    };
    sync: {
      avgLatencyPerClient: Record<string, number>;
      p50: number;
      p95: number;
      p99: number;
      successRate: number;
    };
    users: {
      activeLastHour: number;
      activeLastDay: number;
      activityByFeature: Record<string, number>;
    };
    features: {
      mostUsed: Array<{ feature: string; usageCount: number; userCount: number }>;
    };
    api: {
      overallErrorRate: number;
      highestErrorRates: Array<{
        endpoint: string;
        errorRate: number;
        total: number;
        errors: number;
      }>;
    };
  } {
    return {
      conflicts: {
        perHour: this.conflicts.getConflictsPerHour(),
        byType: this.conflicts.getConflictRateByType(),
        avgResolutionTime: this.conflicts.getAverageResolutionTime(),
      },
      sync: {
        avgLatencyPerClient: this.syncLatency.getAverageLatencyPerClient(),
        p50: this.syncLatency.getPercentileLatency(50),
        p95: this.syncLatency.getPercentileLatency(95),
        p99: this.syncLatency.getPercentileLatency(99),
        successRate: this.syncLatency.getSyncSuccessRate(),
      },
      users: {
        activeLastHour: this.userActivity.getActiveUsers(3600000),
        activeLastDay: this.userActivity.getActiveUsers(86400000),
        activityByFeature: this.userActivity.getActivityByFeature(),
      },
      features: {
        mostUsed: this.featureAdoption.getMostUsedFeatures(10),
      },
      api: {
        overallErrorRate: this.apiErrors.getOverallErrorRate(),
        highestErrorRates: this.apiErrors.getHighestErrorRateEndpoints(5),
      },
    };
  }

  /**
   * Export metrics for external systems
   */
  exportMetrics(): Record<string, any> {
    const metricNames = this.collector.getMetricNames();
    const details: Record<string, any> = {};

    for (const name of metricNames) {
      details[name] = this.collector.getAggregation(name);
    }

    return {
      timestamp: new Date().toISOString(),
      summary: this.getSummary(),
      raw: {
        summary: {
          responseTime: null,
          errorRate: 0,
          throughput: 0,
          cacheHitRate: 0,
        },
        details,
      },
    };
  }
}

// Singleton instance
let metricsInstance: ObservabilityMetrics | null = null;

/**
 * Initialize global observability metrics
 */
export function initializeMetrics(): ObservabilityMetrics {
  if (!metricsInstance) {
    metricsInstance = new ObservabilityMetrics();
  }
  return metricsInstance;
}

/**
 * Get global metrics instance
 */
export function getMetrics(): ObservabilityMetrics | null {
  return metricsInstance;
}
