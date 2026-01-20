/**
 * Tests for Custom Metrics
 *
 * @module observability/__tests__/metrics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ObservabilityMetrics,
  ConflictRateTracker,
  SyncLatencyTracker,
  UserActivityTracker,
  FeatureAdoptionTracker,
  ApiErrorRateTracker,
  initializeMetrics,
  getMetrics,
} from '../metrics';
import { MetricsCollector } from '../../../monitoring/config/metrics-collector';

describe('ConflictRateTracker', () => {
  let collector: MetricsCollector;
  let tracker: ConflictRateTracker;

  beforeEach(() => {
    collector = new MetricsCollector();
    tracker = new ConflictRateTracker(collector);
  });

  it('should record conflict', () => {
    tracker.recordConflict('transaction', 'concurrent_update', true, 50);

    const conflictsPerHour = tracker.getConflictsPerHour();
    expect(conflictsPerHour).toBe(1);
  });

  it('should get conflicts by type', () => {
    tracker.recordConflict('transaction', 'concurrent_update', true);
    tracker.recordConflict('account', 'concurrent_update', true);
    tracker.recordConflict('transaction', 'concurrent_update', true);

    const byType = tracker.getConflictRateByType();
    expect(byType['transaction']).toBe(2);
    expect(byType['account']).toBe(1);
  });

  it('should calculate average resolution time', () => {
    tracker.recordConflict('transaction', 'concurrent_update', true, 50);
    tracker.recordConflict('transaction', 'concurrent_update', true, 100);

    const avgTime = tracker.getAverageResolutionTime();
    expect(avgTime).toBe(75);
  });

  it('should return 0 for no conflicts', () => {
    const avgTime = tracker.getAverageResolutionTime();
    expect(avgTime).toBe(0);
  });
});

describe('SyncLatencyTracker', () => {
  let collector: MetricsCollector;
  let tracker: SyncLatencyTracker;

  beforeEach(() => {
    collector = new MetricsCollector();
    tracker = new SyncLatencyTracker(collector);
  });

  it('should record sync latency', () => {
    tracker.recordSyncLatency('client-1', 'push', 150, 10, 1024, true);

    const avgLatency = tracker.getAverageLatencyPerClient();
    expect(avgLatency['client-1']).toBe(150);
  });

  it('should track multiple clients', () => {
    tracker.recordSyncLatency('client-1', 'push', 100, 10, 1024, true);
    tracker.recordSyncLatency('client-2', 'push', 200, 10, 1024, true);

    const avgLatency = tracker.getAverageLatencyPerClient();
    expect(avgLatency['client-1']).toBe(100);
    expect(avgLatency['client-2']).toBe(200);
  });

  it('should calculate percentile latency', () => {
    tracker.recordSyncLatency('client-1', 'push', 50, 10, 1024, true);
    tracker.recordSyncLatency('client-1', 'push', 100, 10, 1024, true);
    tracker.recordSyncLatency('client-1', 'push', 150, 10, 1024, true);
    tracker.recordSyncLatency('client-1', 'push', 200, 10, 1024, true);

    const p50 = tracker.getPercentileLatency(50);
    const p95 = tracker.getPercentileLatency(95);

    expect(p50).toBeGreaterThan(0);
    expect(p95).toBeGreaterThanOrEqual(p50);
  });

  it('should calculate sync success rate', () => {
    tracker.recordSyncLatency('client-1', 'push', 100, 10, 1024, true);
    tracker.recordSyncLatency('client-1', 'push', 100, 10, 1024, true);
    tracker.recordSyncLatency('client-1', 'push', 100, 10, 1024, false);

    const successRate = tracker.getSyncSuccessRate();
    expect(successRate).toBeCloseTo(66.67, 1);
  });

  it('should return 100% for no syncs', () => {
    const successRate = tracker.getSyncSuccessRate();
    expect(successRate).toBe(100);
  });
});

describe('UserActivityTracker', () => {
  let collector: MetricsCollector;
  let tracker: UserActivityTracker;

  beforeEach(() => {
    collector = new MetricsCollector();
    tracker = new UserActivityTracker(collector);
  });

  it('should record user activity', () => {
    tracker.recordActivity('user-1', 'view', 'dashboard', 1000);

    const activeUsers = tracker.getActiveUsers();
    expect(activeUsers).toBe(1);
  });

  it('should track multiple users', () => {
    tracker.recordActivity('user-1', 'view', 'dashboard');
    tracker.recordActivity('user-2', 'view', 'transactions');
    tracker.recordActivity('user-3', 'create', 'transaction');

    const activeUsers = tracker.getActiveUsers();
    expect(activeUsers).toBe(3);
  });

  it('should get activity by feature', () => {
    tracker.recordActivity('user-1', 'view', 'dashboard');
    tracker.recordActivity('user-2', 'view', 'dashboard');
    tracker.recordActivity('user-3', 'view', 'transactions');

    const byFeature = tracker.getActivityByFeature();
    expect(byFeature['dashboard']).toBe(2);
    expect(byFeature['transactions']).toBe(1);
  });

  it('should get most active users', () => {
    tracker.recordActivity('user-1', 'view', 'dashboard');
    tracker.recordActivity('user-1', 'view', 'transactions');
    tracker.recordActivity('user-2', 'view', 'dashboard');
    tracker.recordActivity('user-1', 'create', 'transaction');

    const mostActive = tracker.getMostActiveUsers(2);
    expect(mostActive[0]!.userId).toBe('user-1');
    expect(mostActive[0]!.count).toBe(3);
    expect(mostActive[1]!.userId).toBe('user-2');
    expect(mostActive[1]!.count).toBe(1);
  });
});

describe('FeatureAdoptionTracker', () => {
  let collector: MetricsCollector;
  let tracker: FeatureAdoptionTracker;

  beforeEach(() => {
    collector = new MetricsCollector();
    tracker = new FeatureAdoptionTracker(collector);
  });

  it('should record feature usage', () => {
    tracker.recordFeatureUsage('invoicing', 'user-1');

    const metrics = tracker.getFeatureMetrics('invoicing');
    expect(metrics).toBeDefined();
    expect(metrics!.usageCount).toBe(1);
    expect(metrics!.users.size).toBe(1);
  });

  it('should track multiple users per feature', () => {
    tracker.recordFeatureUsage('invoicing', 'user-1');
    tracker.recordFeatureUsage('invoicing', 'user-2');
    tracker.recordFeatureUsage('invoicing', 'user-1');

    const metrics = tracker.getFeatureMetrics('invoicing');
    expect(metrics).toBeDefined();
    expect(metrics!.usageCount).toBe(3);
    expect(metrics!.users.size).toBe(2);
  });

  it('should calculate adoption rate', () => {
    tracker.recordFeatureUsage('invoicing', 'user-1');
    tracker.recordFeatureUsage('invoicing', 'user-2');

    const adoptionRate = tracker.getAdoptionRate('invoicing', 10);
    expect(adoptionRate).toBe(20);
  });

  it('should return 0 for unknown feature', () => {
    const adoptionRate = tracker.getAdoptionRate('unknown', 10);
    expect(adoptionRate).toBe(0);
  });

  it('should get most used features', () => {
    tracker.recordFeatureUsage('invoicing', 'user-1');
    tracker.recordFeatureUsage('invoicing', 'user-1');
    tracker.recordFeatureUsage('transactions', 'user-1');

    const mostUsed = tracker.getMostUsedFeatures(5);
    expect(mostUsed[0]!.feature).toBe('invoicing');
    expect(mostUsed[0]!.usageCount).toBe(2);
  });
});

describe('ApiErrorRateTracker', () => {
  let collector: MetricsCollector;
  let tracker: ApiErrorRateTracker;

  beforeEach(() => {
    collector = new MetricsCollector();
    tracker = new ApiErrorRateTracker(collector);
  });

  it('should record API request', () => {
    tracker.recordRequest('/api/sync', false, 200);

    const errorRate = tracker.getErrorRate('/api/sync');
    expect(errorRate).toBe(0);
  });

  it('should track errors', () => {
    tracker.recordRequest('/api/sync', false, 200);
    tracker.recordRequest('/api/sync', false, 200);
    tracker.recordRequest('/api/sync', true, 500);

    const errorRate = tracker.getErrorRate('/api/sync');
    expect(errorRate).toBeCloseTo(33.33, 1);
  });

  it('should calculate overall error rate', () => {
    tracker.recordRequest('/api/sync', false, 200);
    tracker.recordRequest('/api/transactions', true, 500);

    const overallRate = tracker.getOverallErrorRate();
    expect(overallRate).toBe(50);
  });

  it('should get endpoints with highest error rate', () => {
    tracker.recordRequest('/api/sync', true, 500);
    tracker.recordRequest('/api/sync', true, 500);
    tracker.recordRequest('/api/transactions', false, 200);

    const highest = tracker.getHighestErrorRateEndpoints(5);
    expect(highest[0]!.endpoint).toBe('/api/sync');
    expect(highest[0]!.errorRate).toBe(100);
  });

  it('should return 0 for no requests', () => {
    const errorRate = tracker.getErrorRate('/api/unknown');
    expect(errorRate).toBe(0);
  });
});

describe('ObservabilityMetrics', () => {
  let metrics: ObservabilityMetrics;

  beforeEach(() => {
    metrics = new ObservabilityMetrics();
  });

  it('should create metrics instance', () => {
    expect(metrics).toBeDefined();
    expect(metrics.collector).toBeDefined();
    expect(metrics.conflicts).toBeDefined();
    expect(metrics.syncLatency).toBeDefined();
    expect(metrics.userActivity).toBeDefined();
    expect(metrics.featureAdoption).toBeDefined();
    expect(metrics.apiErrors).toBeDefined();
  });

  it('should get comprehensive summary', () => {
    metrics.conflicts.recordConflict('transaction', 'concurrent', true, 50);
    metrics.syncLatency.recordSyncLatency('client-1', 'push', 100, 10, 1024, true);
    metrics.userActivity.recordActivity('user-1', 'view', 'dashboard');
    metrics.featureAdoption.recordFeatureUsage('invoicing', 'user-1');
    metrics.apiErrors.recordRequest('/api/sync', false, 200);

    const summary = metrics.getSummary();

    expect(summary.conflicts.perHour).toBe(1);
    expect(summary.sync.p50).toBeGreaterThanOrEqual(0);
    expect(summary.users.activeLastHour).toBe(1);
    expect(summary.features.mostUsed.length).toBeGreaterThan(0);
    expect(summary.api.overallErrorRate).toBe(0);
  });

  it('should export metrics', () => {
    metrics.conflicts.recordConflict('transaction', 'concurrent', true);

    const exported = metrics.exportMetrics();

    expect(exported.timestamp).toBeDefined();
    expect(exported.summary).toBeDefined();
    expect(exported.raw).toBeDefined();
  });
});

describe('Global Metrics', () => {
  it('should initialize global metrics', () => {
    const metrics = initializeMetrics();

    expect(metrics).toBeDefined();
    expect(getMetrics()).toBe(metrics);
  });

  it('should return same instance on multiple calls', () => {
    const metrics1 = initializeMetrics();
    const metrics2 = initializeMetrics();

    expect(metrics1).toBe(metrics2);
  });
});
