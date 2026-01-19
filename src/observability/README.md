# Observability Module

Comprehensive observability stack for Graceful Books with distributed tracing, structured logging, and custom business metrics.

## Overview

The observability module provides:

- **Distributed Tracing** (OpenTelemetry) - End-to-end traces across sync operations, encryption, and conflict resolution
- **Structured Logging** (JSON) - Correlation IDs, context, and PII filtering
- **Custom Metrics** - CRDT conflicts, sync latency, user activity, feature adoption

## Quick Start

### Initialize Observability

```typescript
import {
  initializeTracing,
  initializeLogger,
  initializeMetrics,
} from '@/observability';

// 1. Initialize tracing
const tracing = initializeTracing({
  serviceName: 'graceful-books',
  serviceVersion: '1.0.0',
  environment: 'production',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});

// 2. Initialize logger
const logger = initializeLogger({
  minLevel: 'info',
  pretty: false,
  enabled: true,
});

// 3. Initialize metrics
const metrics = initializeMetrics();
```

## Distributed Tracing

### Basic Usage

```typescript
import { getTracing } from '@/observability';

const tracing = getTracing();

// Trace sync operation
await tracing.traceAsync('sync-operation', async (span) => {
  tracing.addSpanAttributes(span, {
    userId: 'user-123',
    itemCount: 42,
  });

  // Your code here
  await performSync();
});
```

### Sync Tracer

```typescript
import { SyncTracer } from '@/observability';

const syncTracer = new SyncTracer(tracing);

// Trace complete sync operation
await syncTracer.traceSyncOperation(
  'push',
  async (span) => {
    return await syncData();
  },
  {
    userId: 'user-123',
    deviceId: 'device-456',
    itemCount: 42,
  }
);

// Trace encryption
await syncTracer.traceEncryption(
  'encrypt',
  async (span) => {
    return await encryptData(data);
  },
  dataSize
);

// Trace conflict resolution
await syncTracer.traceConflictResolution(
  async (span) => {
    return await resolveConflicts(conflicts);
  },
  conflictCount
);
```

### Correlation IDs

```typescript
import { CorrelationIdManager } from '@/observability';

const correlationManager = new CorrelationIdManager();

// Generate ID
const id = correlationManager.generateCorrelationId();

// Set for current context
correlationManager.setCorrelationId(id);

// Add to HTTP headers
const headers = new Headers();
correlationManager.addToHeaders(headers);

// Extract from headers
const receivedId = correlationManager.extractFromHeaders(headers);
```

## Structured Logging

### Basic Usage

```typescript
import { getLogger } from '@/observability';

const logger = getLogger();

// Log levels
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', error);
logger.fatal('Fatal message', error);
```

### Context

```typescript
// Add persistent context
logger.setContext('userId', 'user-123');
logger.setContext('deviceId', 'device-456');

logger.info('User action'); // Will include userId and deviceId

// Clear context
logger.clearContext('userId');
logger.clearContext(); // Clear all
```

### Child Loggers

```typescript
// Create child logger with additional context
const childLogger = logger.child({
  module: 'sync',
  operation: 'push',
});

childLogger.info('Sync started'); // Includes module and operation
```

### PII Filtering

```typescript
import { LogFilter } from '@/observability';

const filter = new LogFilter();

// Add sensitive keys
filter.addSensitiveKey('customSecret');

// Filter data
const filtered = filter.filter({
  username: 'user123',
  password: 'secret', // Will be [REDACTED]
  customSecret: 'value', // Will be [REDACTED]
});
```

## Custom Metrics

### CRDT Conflict Tracking

```typescript
import { getMetrics } from '@/observability';

const metrics = getMetrics();

// Record conflict
metrics.conflicts.recordConflict(
  'transaction', // entity type
  'concurrent_update', // conflict type
  true, // resolved
  50 // resolution time in ms
);

// Get metrics
const conflictsPerHour = metrics.conflicts.getConflictsPerHour();
const byType = metrics.conflicts.getConflictRateByType();
const avgResolutionTime = metrics.conflicts.getAverageResolutionTime();
```

### Sync Latency Tracking

```typescript
// Record sync latency
metrics.syncLatency.recordSyncLatency(
  'client-123', // client ID
  'push', // operation
  150, // latency in ms
  42, // item count
  1024, // data size in bytes
  true // success
);

// Get metrics
const avgLatency = metrics.syncLatency.getAverageLatencyPerClient();
const p95 = metrics.syncLatency.getPercentileLatency(95);
const successRate = metrics.syncLatency.getSyncSuccessRate();
```

### User Activity Tracking

```typescript
// Record activity
metrics.userActivity.recordActivity(
  'user-123',
  'view',
  'dashboard',
  1000 // duration in ms (optional)
);

// Get metrics
const activeUsers = metrics.userActivity.getActiveUsers(); // last hour
const activityByFeature = metrics.userActivity.getActivityByFeature();
const mostActive = metrics.userActivity.getMostActiveUsers(10);
```

### Feature Adoption Tracking

```typescript
// Record feature usage
metrics.featureAdoption.recordFeatureUsage('invoicing', 'user-123');

// Get metrics
const adoptionRate = metrics.featureAdoption.getAdoptionRate('invoicing', totalUsers);
const mostUsed = metrics.featureAdoption.getMostUsedFeatures(10);
```

### API Error Tracking

```typescript
// Record request
metrics.apiErrors.recordRequest('/api/sync', false, 200);
metrics.apiErrors.recordRequest('/api/sync', true, 500); // Error

// Get metrics
const errorRate = metrics.apiErrors.getErrorRate('/api/sync');
const overallRate = metrics.apiErrors.getOverallErrorRate();
const highest = metrics.apiErrors.getHighestErrorRateEndpoints(5);
```

### Comprehensive Summary

```typescript
// Get all metrics
const summary = metrics.getSummary();

console.log(summary);
// {
//   conflicts: { perHour, byType, avgResolutionTime },
//   sync: { avgLatencyPerClient, p50, p95, p99, successRate },
//   users: { activeLastHour, activeLastDay, activityByFeature },
//   features: { mostUsed },
//   api: { overallErrorRate, highestErrorRates }
// }
```

## Dashboards

### Accessing Grafana

**Local:** http://localhost:3000/d/observability

**Production:** https://grafana.gracefulbooks.com/d/observability

### Key Panels

- **CRDT Conflict Rate** - Conflicts per hour with alert at >10/hr
- **Sync Latency** - p50, p95, p99 latencies
- **Active Users** - Users active in last hour
- **API Error Rate** - Percentage of failed requests
- **Feature Adoption** - Most used features
- **Log Volume** - Logs by level

## Log Aggregation

### Loki Setup

Logs are aggregated in Grafana Loki with:
- **Retention:** 30 days hot, 90 days total
- **Format:** Structured JSON
- **Correlation:** IDs link logs across services

### Querying Logs

```logql
# All errors
{level="error"} | json

# Logs for correlation ID
{correlationId="cor-1234-abcd"} | json

# Sync operations
{operation=~"sync.*"} | json

# Search in message
{} | json | message =~ ".*conflict.*"
```

## Configuration

### Environment Variables

```bash
# Tracing
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Logging
LOG_LEVEL=info
LOG_PRETTY=false

# Metrics
METRICS_ENABLED=true
```

### Sampling

```typescript
import { TraceSampler } from '@/observability';

const sampler = new TraceSampler(
  0.1, // 10% sample rate
  true // Always sample errors
);

if (sampler.shouldSample(isError)) {
  // Create trace
}
```

## Testing

Run observability tests:

```bash
npm test src/observability
```

All tests include:
- Unit tests for tracing, logging, metrics
- Integration tests for correlation IDs
- Edge case handling

## Operations

See [Observability Runbook](../../docs/observability-runbook.md) for:
- Troubleshooting guides
- Maintenance procedures
- Alert configuration
- Escalation paths

## Architecture

```
Application
    ↓
┌───┴────┐
│ Tracing │ → OTLP → Tempo/Jaeger
│ Logging │ → Promtail → Loki
│ Metrics │ → Prometheus
└───┬────┘
    ↓
  Grafana
```

## Best Practices

1. **Always use correlation IDs** for related operations
2. **Add context** to spans and logs for debugging
3. **Filter PII** before logging sensitive data
4. **Track business metrics** alongside technical metrics
5. **Use child loggers** for module-specific context
6. **Sample traces** appropriately (100% errors, 10% success)
7. **Review dashboards** regularly for anomalies

## Troubleshooting

### Traces Not Appearing

- Check OTLP endpoint configuration
- Verify tracing is enabled
- Check sampling rate

### Logs Missing

- Verify Loki is running
- Check Promtail configuration
- Verify log file permissions

### High Dashboard Latency

- Reduce query time range
- Add more specific filters
- Check retention policies

## Resources

- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [Grafana Loki Docs](https://grafana.com/docs/loki/latest/)
- [Operations Runbook](../../docs/observability-runbook.md)

---

**Module:** `src/observability`
**Version:** 1.0.0
**Last Updated:** 2026-01-18
