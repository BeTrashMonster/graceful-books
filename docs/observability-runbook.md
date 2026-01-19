# Observability Operations Runbook

**Last Updated:** 2026-01-18
**Owner:** DevOps Team
**Review Frequency:** Monthly

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Distributed Tracing](#distributed-tracing)
5. [Log Aggregation](#log-aggregation)
6. [Metrics & Dashboards](#metrics--dashboards)
7. [Troubleshooting](#troubleshooting)
8. [Maintenance](#maintenance)
9. [Escalation](#escalation)

---

## Overview

The Graceful Books observability stack provides comprehensive visibility into:

- **Distributed Tracing:** End-to-end traces for sync operations, encryption, and CRDT conflict resolution
- **Structured Logging:** JSON-formatted logs with correlation IDs and context
- **Custom Metrics:** Business metrics for CRDT conflicts, sync latency, user activity, and feature adoption
- **Dashboards:** Real-time visualization in Grafana

**Philosophy:** "See everything, understand everything. Observability turns mystery into clarity."

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Tracing    │  │   Logging    │  │   Metrics    │      │
│  │ (OpenTelemetry)  (Structured)     (Custom)        │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────────┐
│   OTLP Exporter │  │    Loki     │  │   Prometheus    │
│   (Traces)      │  │    (Logs)   │  │   (Metrics)     │
└─────────┬───────┘  └──────┬──────┘  └────────┬────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ▼
                    ┌────────────────┐
                    │    Grafana     │
                    │  (Dashboards)  │
                    └────────────────┘
```

### Data Flow

1. **Application Code** instruments operations with tracing, logging, and metrics
2. **Correlation IDs** link related operations across services
3. **Traces** exported via OTLP to tracing backend
4. **Logs** aggregated via Promtail to Loki
5. **Metrics** scraped by Prometheus
6. **Grafana** visualizes all three data sources

---

## Quick Start

### Prerequisites

- Docker and Docker Compose (for Loki, Prometheus, Grafana)
- Node.js 18+ (for application)
- Access to production infrastructure

### Local Setup

```bash
# 1. Start observability stack
cd monitoring
docker-compose up -d

# 2. Verify services
curl http://localhost:3100/ready  # Loki
curl http://localhost:9090/-/ready  # Prometheus
curl http://localhost:3000/api/health  # Grafana

# 3. Import dashboards
./scripts/import-dashboards.sh

# 4. Configure application
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export LOKI_ENDPOINT=http://localhost:3100
export PROMETHEUS_ENDPOINT=http://localhost:9090
```

### Application Integration

```typescript
import {
  initializeTracing,
  initializeLogger,
  initializeMetrics,
} from '@/observability';

// Initialize observability
const tracing = initializeTracing({
  serviceName: 'graceful-books',
  serviceVersion: '1.0.0',
  environment: 'production',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});

const logger = initializeLogger({
  minLevel: 'info',
  pretty: false,
  enabled: true,
});

const metrics = initializeMetrics();
```

---

## Distributed Tracing

### Overview

OpenTelemetry provides distributed tracing across:
- Sync operations (full lifecycle)
- Encryption/decryption operations
- CRDT conflict resolution
- Database queries

### Viewing Traces

**Access:** Grafana → Explore → Data Source: Tempo/Jaeger

**Query Examples:**

```
# Find traces for a specific user
{ service.name="graceful-books" } | userId="user-123"

# Find sync operations
{ service.name="graceful-books" } | operation="sync.push"

# Find slow operations (>1s)
{ service.name="graceful-books" } | duration > 1s

# Find failed operations
{ service.name="graceful-books" } | status.code="ERROR"
```

### Trace Analysis

**Key Span Attributes:**

| Attribute | Description | Example |
|-----------|-------------|---------|
| `sync.operation` | Sync operation type | `push`, `pull`, `merge` |
| `sync.user_id` | User performing sync | `user-123` |
| `sync.device_id` | Device ID | `device-456` |
| `sync.item_count` | Items synced | `42` |
| `crypto.operation` | Crypto operation | `encrypt`, `decrypt` |
| `crdt.conflict_count` | Conflicts resolved | `3` |
| `db.operation` | Database operation | `select`, `insert` |

**Common Patterns:**

1. **Slow Sync:**
   - Check `sync.item_count` (large batch?)
   - Check `crypto.operation` spans (slow encryption?)
   - Check `db.operation` spans (slow queries?)

2. **Failed Sync:**
   - Look for ERROR status
   - Check exception details
   - Follow correlation ID to related logs

### Sampling

- **Production:** 10% sample rate, 100% for errors
- **Staging:** 50% sample rate
- **Development:** 100% sample rate

Update sampling rate:
```typescript
traceSampler.setSampleRate(0.1); // 10%
```

---

## Log Aggregation

### Overview

Structured JSON logging with:
- Correlation IDs linking related operations
- User/device context
- Automatic PII filtering
- 30-day hot retention, 90-day total

### Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| **DEBUG** | Detailed debugging info | "Version vector: {dev1: 5, dev2: 3}" |
| **INFO** | Normal operations | "Sync completed: 42 items" |
| **WARN** | Potential issues | "Sync queue backing up: 150 items" |
| **ERROR** | Errors requiring attention | "Decryption failed: wrong key" |
| **FATAL** | Critical system failures | "Database connection lost" |

### Querying Logs

**Access:** Grafana → Explore → Data Source: Loki

**Query Examples:**

```logql
# All errors in last hour
{level="error"} | json

# Logs for specific correlation ID
{correlationId="cor-1234-abcd"} | json

# Sync operation logs
{operation=~"sync.*"} | json

# Errors for specific user
{level="error", userId="user-123"} | json

# Search for text in message
{} | json | message =~ ".*conflict.*"
```

### Log Patterns

**Successful Sync:**
```json
{
  "timestamp": "2026-01-18T10:30:00.000Z",
  "level": "info",
  "message": "Sync operation completed successfully",
  "correlationId": "cor-1705572600000-abc123",
  "userId": "user-123",
  "deviceId": "device-456",
  "operation": "sync.push",
  "context": {
    "itemCount": 42,
    "duration": 1250
  }
}
```

**Error with Stack:**
```json
{
  "timestamp": "2026-01-18T10:30:00.000Z",
  "level": "error",
  "message": "Decryption failed",
  "correlationId": "cor-1705572600000-abc123",
  "userId": "user-123",
  "error": {
    "name": "DecryptionError",
    "message": "Authentication tag mismatch",
    "stack": "Error: Authentication tag mismatch\n    at decrypt (crypto.ts:45)"
  }
}
```

### Log Retention

- **Hot Storage (Loki):** 30 days (fast queries)
- **Cold Storage:** 90 days total (slower queries)
- **Cleanup:** Automatic via Loki compactor

---

## Metrics & Dashboards

### Overview

Custom business metrics tracked:
- CRDT conflict rate (conflicts/hour)
- Sync latency (p50, p95, p99 per client)
- Active users (last hour, last day)
- Feature adoption (usage by feature)
- API error rate (by endpoint)

### Accessing Dashboards

**URL:** http://localhost:3000/d/observability

**Dashboards Available:**
1. **Observability Dashboard** - Comprehensive overview
2. **Health Dashboard** - System health metrics
3. **Sync Performance** - Sync-specific metrics

### Key Metrics

#### CRDT Conflict Rate

**Panel:** "CRDT Conflict Rate"

**What It Shows:** Number of CRDT conflicts per hour

**When to Alert:**
- \> 10 conflicts/hour: Investigate sync patterns
- \> 50 conflicts/hour: Potential sync storm

**Query:**
```promql
rate(crdt_conflict_total[1h])
```

**Troubleshooting:**
1. Check conflict types: `sum(crdt_conflict_total) by (conflictType)`
2. Check resolution time: `avg(crdt_resolution_time)`
3. Review logs for conflict details

#### Sync Latency

**Panel:** "Sync Latency (Percentiles)"

**What It Shows:** Sync operation latency distribution

**Targets:**
- p50: < 500ms
- p95: < 1000ms
- p99: < 2000ms

**When to Alert:**
- p95 > 2000ms: Performance degradation
- p99 > 5000ms: Serious performance issue

**Query:**
```promql
histogram_quantile(0.95, rate(sync_latency_bucket[5m]))
```

**Troubleshooting:**
1. Check per-client latency: Group by `clientId`
2. Check database performance
3. Check encryption performance
4. Review traces for slow spans

#### Active Users

**Panel:** "Active Users"

**What It Shows:** Users with activity in last hour

**Normal Range:** Varies by time of day

**When to Alert:**
- Sudden drop to 0: Possible outage
- Unusual spike: Possible attack or bot activity

**Query:**
```promql
count(count_over_time(user_activity_total[1h]) > 0)
```

#### API Error Rate

**Panel:** "API Error Rate"

**What It Shows:** Percentage of API requests resulting in errors

**Targets:**
- < 0.1%: Healthy
- 1-5%: Warning
- \> 5%: Critical

**Query:**
```promql
rate(api_request_total{error="true"}[5m]) / rate(api_request_total[5m]) * 100
```

**Troubleshooting:**
1. Check highest error rate endpoints
2. Review error logs for patterns
3. Check database connectivity
4. Check external service dependencies

### Creating Alerts

**Grafana Alerts:**

1. Navigate to dashboard panel
2. Click "Edit"
3. Go to "Alert" tab
4. Configure:
   - Condition (e.g., `avg() OF query(A, 5m, now) IS ABOVE 10`)
   - Evaluation interval (e.g., 1m)
   - For duration (e.g., 5m)
   - Alert routing

**Example Alert:**
```yaml
name: High CRDT Conflict Rate
condition: avg(rate(crdt_conflict_total[1h])) > 10
for: 5m
severity: warning
```

---

## Troubleshooting

### Common Issues

#### 1. Missing Traces

**Symptoms:**
- Traces not appearing in Grafana
- Trace search returns no results

**Diagnosis:**
```bash
# Check OTLP exporter connection
curl http://localhost:4318/v1/traces

# Check application logs
{level="error"} | json | message =~ ".*trace.*"

# Verify tracing is enabled
# In code: tracing.enabled = true
```

**Solutions:**
1. Verify OTLP endpoint configuration
2. Check firewall rules
3. Verify OpenTelemetry collector is running
4. Check trace sampling rate (might be too low)

#### 2. Logs Not Appearing in Loki

**Symptoms:**
- Logs not showing in Grafana Explore
- Empty log queries

**Diagnosis:**
```bash
# Check Loki is running
curl http://localhost:3100/ready

# Check Promtail is running
curl http://localhost:9080/ready

# Check Promtail targets
curl http://localhost:9080/targets

# Test log ingestion
curl -X POST http://localhost:3100/loki/api/v1/push \
  -H "Content-Type: application/json" \
  -d '{"streams":[{"stream":{"test":"true"},"values":[["'$(date +%s)000000000'","test message"]]}]}'
```

**Solutions:**
1. Verify Promtail configuration (`promtail-config.yml`)
2. Check log file paths exist
3. Verify Promtail has read permissions
4. Check Loki ingestion limits

#### 3. High Latency in Dashboards

**Symptoms:**
- Dashboard queries timeout
- Slow panel loading

**Diagnosis:**
```bash
# Check Prometheus query performance
curl 'http://localhost:9090/api/v1/query?query=up'

# Check Loki query performance
curl 'http://localhost:3100/loki/api/v1/query?query={}'
```

**Solutions:**
1. Reduce query time range
2. Add more specific label filters
3. Increase query timeout in Grafana
4. Check resource usage (CPU, memory)
5. Review retention policies (too much data?)

#### 4. Correlation IDs Not Linking

**Symptoms:**
- Logs and traces not connected
- Can't find related operations

**Diagnosis:**
```typescript
// Check correlation ID is set
const correlationId = correlationManager.getCorrelationId();
console.log('Correlation ID:', correlationId);

// Check it's included in logs
logger.info('Test message');
// Should see: {"correlationId": "cor-..."}

// Check it's propagated in traces
const span = tracing.startSpan('test');
// Span should have correlationId attribute
```

**Solutions:**
1. Ensure correlation ID is set early in request
2. Verify correlation ID is added to all spans
3. Check logger includes correlation ID
4. Verify header propagation for cross-service calls

#### 5. Sensitive Data in Logs

**Symptoms:**
- PII or secrets appearing in logs
- Security audit findings

**Diagnosis:**
```logql
# Search for potential sensitive data
{} | json | line_format "{{.}}" | regexp "password|secret|key"
```

**Solutions:**
1. Review `LogFilter` sensitive keys list
2. Add custom sensitive keys: `filter.addSensitiveKey('customField')`
3. Update application code to avoid logging sensitive fields
4. Purge logs containing sensitive data (if necessary)

---

## Maintenance

### Daily Tasks

- [ ] Review overnight error logs
- [ ] Check dashboard alerts
- [ ] Verify all services healthy

### Weekly Tasks

- [ ] Review metric trends
- [ ] Check disk usage (logs, metrics)
- [ ] Review slow traces (p99 > 2s)
- [ ] Update alert thresholds if needed

### Monthly Tasks

- [ ] Review retention policies
- [ ] Audit log filters for new sensitive fields
- [ ] Review dashboard effectiveness
- [ ] Update documentation for new metrics
- [ ] Performance tune queries

### Quarterly Tasks

- [ ] Major retention policy review
- [ ] Observability infrastructure upgrade
- [ ] Team training on new features
- [ ] Cost optimization review

---

## Escalation

### Severity Levels

| Severity | Response Time | Examples |
|----------|---------------|----------|
| **Critical** | < 5 minutes | Complete observability outage |
| **High** | < 15 minutes | Traces/logs not being collected |
| **Medium** | < 4 hours | Dashboard query slow |
| **Low** | < 24 hours | Dashboard cosmetic issues |

### Escalation Path

1. **On-Call Engineer** (Primary)
   - Slack: `#devops-oncall`
   - PagerDuty: Automatic page for critical

2. **Senior DevOps** (Escalation)
   - After 30 minutes if unresolved
   - For complex infrastructure issues

3. **Engineering Manager** (Final Escalation)
   - After 1 hour if unresolved
   - For decision-making authority

### Emergency Contacts

**On-Call Schedule:** See `monitoring/ON_CALL_SCHEDULE.md`

**Escalation Checklist:**
- [ ] Assess severity
- [ ] Check if known issue (runbooks)
- [ ] Gather initial diagnostics
- [ ] Notify appropriate channel
- [ ] Create incident ticket
- [ ] Begin troubleshooting
- [ ] Escalate if needed
- [ ] Document resolution
- [ ] Conduct post-mortem (if critical)

---

## Resources

### Documentation

- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [Grafana Loki Docs](https://grafana.com/docs/loki/latest/)
- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)

### Internal Resources

- [Monitoring README](../monitoring/README.md)
- [Alert Routing](../monitoring/alerts/alert-routing.ts)
- [Health Dashboard](../monitoring/dashboards/health-dashboard.html)

### Training

- Observability 101 (internal wiki)
- Grafana Query Language (LogQL) Guide
- Distributed Tracing Best Practices

---

**Questions?** Ask in #devops Slack channel
**Issues?** Create ticket with `observability` label
**Emergencies?** Follow escalation path above

---

**Last Reviewed:** 2026-01-18
**Next Review:** 2026-02-18
