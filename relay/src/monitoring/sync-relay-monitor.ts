/**
 * Sync Relay Monitoring
 *
 * Specialized monitoring for sync relay operations including
 * connection health, sync performance, and data integrity.
 *
 * @module relay/monitoring
 */

import { AnalyticsClient } from '../../../monitoring/config/analytics';
import { MetricsManager } from '../../../monitoring/config/metrics-collector';
import { AlertRouter, createAlert } from '../../../monitoring/alerts/alert-routing';

export interface SyncRelayMetrics {
  activeConnections: number;
  syncOperationsPerMinute: number;
  averageSyncDuration: number;
  dataSyncedMB: number;
  errorCount: number;
  queueDepth: number;
}

export interface SyncOperation {
  id: string;
  userId: string;
  startTime: number;
  endTime?: number;
  itemCount: number;
  dataSize: number;
  success: boolean;
  error?: string;
}

/**
 * Sync Relay Monitor - Monitors sync relay health and performance
 */
export class SyncRelayMonitor {
  private analytics: AnalyticsClient;
  private metrics: MetricsManager;
  private alertRouter: AlertRouter;
  private operations: Map<string, SyncOperation>;
  private region: string;

  constructor(
    analytics: AnalyticsClient,
    metrics: MetricsManager,
    alertRouter: AlertRouter,
    region: string = 'unknown'
  ) {
    this.analytics = analytics;
    this.metrics = metrics;
    this.alertRouter = alertRouter;
    this.operations = new Map();
    this.region = region;
  }

  /**
   * Start monitoring a sync operation
   */
  startSyncOperation(userId: string, itemCount: number = 0): string {
    const operationId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const operation: SyncOperation = {
      id: operationId,
      userId,
      startTime: Date.now(),
      itemCount,
      dataSize: 0,
      success: false,
    };

    this.operations.set(operationId, operation);

    // Record start metric
    this.analytics.recordMetric('sync_started', 1, {
      region: this.region,
      userId,
    });

    return operationId;
  }

  /**
   * Complete a sync operation
   */
  completeSyncOperation(
    operationId: string,
    success: boolean,
    dataSize: number = 0,
    error?: string
  ): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`Unknown sync operation: ${operationId}`);
      return;
    }

    operation.endTime = Date.now();
    operation.success = success;
    operation.dataSize = dataSize;
    operation.error = error;

    const duration = operation.endTime - operation.startTime;

    // Record metrics
    this.analytics.recordSyncMetric('sync', duration, {
      success,
      itemCount: operation.itemCount,
      dataSize,
      region: this.region,
    });

    this.metrics.business.recordSyncOperation(duration, operation.itemCount, success);

    // Check for performance issues
    if (duration > 5000) {
      // Slow sync (> 5 seconds)
      this.alertRouter.route(
        createAlert(
          'Slow Sync Operation',
          `Sync operation took ${duration}ms to complete`,
          'medium',
          `sync-relay-${this.region}`,
          { operationId, duration, itemCount: operation.itemCount }
        )
      );
    }

    // Check for errors
    if (!success) {
      this.analytics.recordError(`sync-relay-${this.region}`, error || 'Unknown error', {
        region: this.region,
        severity: 'high',
      });

      this.alertRouter.route(
        createAlert(
          'Sync Operation Failed',
          error || 'Sync operation failed',
          'high',
          `sync-relay-${this.region}`,
          { operationId, error }
        )
      );
    }

    // Clean up old operations
    this.operations.delete(operationId);
  }

  /**
   * Record connection event
   */
  recordConnection(connected: boolean, userId?: string): void {
    this.analytics.recordMetric('connection', connected ? 1 : 0, {
      region: this.region,
      userId: userId || 'anonymous',
    });

    if (!connected) {
      // Connection lost - might be an issue
      const activeConnections = this.getActiveConnections();
      if (activeConnections < 5) {
        this.alertRouter.route(
          createAlert(
            'Low Active Connections',
            `Only ${activeConnections} active connections`,
            'medium',
            `sync-relay-${this.region}`,
            { activeConnections }
          )
        );
      }
    }
  }

  /**
   * Record queue depth
   */
  recordQueueDepth(depth: number): void {
    this.analytics.recordMetric('queue_depth', depth, {
      region: this.region,
    });

    // Alert if queue is backing up
    if (depth > 100) {
      this.alertRouter.route(
        createAlert(
          'Sync Queue Backing Up',
          `Queue depth is ${depth} items`,
          depth > 500 ? 'high' : 'medium',
          `sync-relay-${this.region}`,
          { depth }
        )
      );
    }
  }

  /**
   * Record database operation
   */
  recordDatabaseOperation(
    operation: string,
    duration: number,
    success: boolean,
    rowCount: number = 0
  ): void {
    this.analytics.recordDatabaseMetric(operation, duration, {
      success,
      rowCount,
      region: this.region,
    });

    this.metrics.business.recordDatabaseQuery(operation, duration, rowCount);

    // Alert on slow database queries
    if (duration > 1000) {
      this.alertRouter.route(
        createAlert(
          'Slow Database Query',
          `${operation} took ${duration}ms`,
          'medium',
          `sync-relay-${this.region}`,
          { operation, duration }
        )
      );
    }

    // Alert on database errors
    if (!success) {
      this.alertRouter.route(
        createAlert(
          'Database Operation Failed',
          `${operation} failed`,
          'high',
          `sync-relay-${this.region}`,
          { operation }
        )
      );
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): SyncRelayMetrics {
    const summary = this.metrics.getSummary();

    return {
      activeConnections: this.getActiveConnections(),
      syncOperationsPerMinute: this.getSyncOperationsPerMinute(),
      averageSyncDuration: summary.responseTime?.avg || 0,
      dataSyncedMB: this.getDataSyncedMB(),
      errorCount: this.getErrorCount(),
      queueDepth: this.getCurrentQueueDepth(),
    };
  }

  /**
   * Get active connections count
   */
  private getActiveConnections(): number {
    // This would be tracked elsewhere, placeholder for now
    return 0;
  }

  /**
   * Get sync operations per minute
   */
  private getSyncOperationsPerMinute(): number {
    // Calculate from throughput tracker
    return this.metrics.throughput.getThroughput() * 60;
  }

  /**
   * Get total data synced in MB
   */
  private getDataSyncedMB(): number {
    // This would be tracked in a counter, placeholder for now
    return 0;
  }

  /**
   * Get error count
   */
  private getErrorCount(): number {
    // Calculate from error rate tracker
    const errorRate = this.metrics.errorRate.getOverallErrorRate();
    const throughput = this.metrics.throughput.getThroughput();
    return (errorRate / 100) * throughput * 60; // Errors per minute
  }

  /**
   * Get current queue depth
   */
  private getCurrentQueueDepth(): number {
    // This would be tracked elsewhere, placeholder for now
    return 0;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    metrics: SyncRelayMetrics;
  }> {
    const metrics = this.getMetrics();

    const checks = {
      database: await this.checkDatabase(),
      queue: metrics.queueDepth < 100,
      errorRate: metrics.errorCount < 10,
      performance: metrics.averageSyncDuration < 2000,
    };

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.values(checks).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks >= totalChecks / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    // Alert if unhealthy
    if (status === 'unhealthy') {
      this.alertRouter.route(
        createAlert(
          'Sync Relay Unhealthy',
          `Health check failed: ${JSON.stringify(checks)}`,
          'critical',
          `sync-relay-${this.region}`,
          { checks, metrics }
        )
      );
    } else if (status === 'degraded') {
      this.alertRouter.route(
        createAlert(
          'Sync Relay Degraded',
          `Some health checks failing: ${JSON.stringify(checks)}`,
          'high',
          `sync-relay-${this.region}`,
          { checks, metrics }
        )
      );
    }

    return { status, checks, metrics };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<boolean> {
    // This would actually test database connectivity
    // Placeholder for now
    return true;
  }
}

/**
 * Create monitoring middleware for Cloudflare Workers
 */
export function createMonitoringMiddleware(
  monitor: SyncRelayMonitor
): (
  handler: (request: Request, env: any, ctx: ExecutionContext) => Promise<Response>
) => (request: Request, env: any, ctx: ExecutionContext) => Promise<Response> {
  return (handler) => {
    return async (request, env, ctx) => {
      const url = new URL(request.url);
      const timer = monitor.metrics.responseTime.startRequest();

      try {
        // Execute handler
        const response = await handler(request, env, ctx);

        // Record metrics
        const duration = timer.end(url.pathname, {
          method: request.method,
          status: response.status,
          region: monitor['region'],
        });

        monitor.metrics.errorRate.recordRequest(url.pathname, response.status >= 400);
        monitor.metrics.throughput.recordRequest();

        return response;
      } catch (error) {
        // Record error
        timer.end(url.pathname, {
          method: request.method,
          status: 500,
          region: monitor['region'],
        });

        monitor.metrics.errorRate.recordRequest(url.pathname, true);

        throw error;
      }
    };
  };
}
