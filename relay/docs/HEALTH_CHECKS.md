# Health Check Documentation

This guide covers all health check endpoints and monitoring capabilities for the Graceful Books self-hosted sync relay.

## Table of Contents

1. [Overview](#overview)
2. [Health Endpoint](#health-endpoint)
3. [Version Endpoint](#version-endpoint)
4. [SLA Metrics Endpoint](#sla-metrics-endpoint)
5. [Monitoring Setup](#monitoring-setup)
6. [Alerting](#alerting)
7. [Integration Examples](#integration-examples)

## Overview

The sync relay provides multiple endpoints for monitoring server health, performance, and reliability:

| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `/health` | Basic health check | Every 30s |
| `/version` | Version information | On deploy |
| `/metrics/sla` | SLA metrics | Every 5-15m |

All endpoints return JSON and use standard HTTP status codes.

## Health Endpoint

### `GET /health`

**Purpose:** Quick health check for load balancers, monitoring tools, and uptime services.

**Response Time:** <10ms (typically 2-5ms)

**Success Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": 1705507200,
  "version": "1.0.0",
  "region": "self-hosted",
  "database": {
    "status": "ok",
    "latency_ms": 3.2
  },
  "uptime_seconds": 86400
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `ok` or `degraded` or `error` |
| `timestamp` | number | Unix timestamp (seconds) |
| `version` | string | Server version |
| `region` | string | Region identifier (always "self-hosted") |
| `database.status` | string | Database health: `ok`, `slow`, `error` |
| `database.latency_ms` | number | Database query latency |
| `uptime_seconds` | number | Seconds since server start |

**Error Response (503 Service Unavailable):**

```json
{
  "status": "error",
  "timestamp": 1705507200,
  "version": "1.0.0",
  "region": "self-hosted",
  "database": {
    "status": "error",
    "error": "Connection failed"
  },
  "uptime_seconds": 86400
}
```

**Status Values:**

- **`ok`**: All systems operational
- **`degraded`**: Database latency >100ms but functional
- **`error`**: Critical failure (database unreachable, etc.)

**Usage Examples:**

```bash
# Basic check
curl http://localhost:8787/health

# Check with timeout
curl --max-time 5 http://localhost:8787/health

# Check and exit with status code
curl -f http://localhost:8787/health || echo "Health check failed!"

# Parse with jq
curl -s http://localhost:8787/health | jq '.status'
```

**Docker Healthcheck:**

Built into Dockerfile:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8787/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"
```

**Kubernetes Liveness Probe:**

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8787
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

---

## Version Endpoint

### `GET /version`

**Purpose:** Get server version and build information.

**Response (200 OK):**

```json
{
  "version": "1.0.0",
  "build_date": "2024-01-15T10:30:00Z",
  "git_commit": "a1b2c3d",
  "node_version": "20.10.0",
  "protocol_version": "1.0.0"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Server semantic version |
| `build_date` | string | ISO 8601 build timestamp |
| `git_commit` | string | Git commit hash (short) |
| `node_version` | string | Node.js runtime version |
| `protocol_version` | string | Sync protocol version |

**Usage Examples:**

```bash
# Check version
curl http://localhost:8787/version

# Get just version number
curl -s http://localhost:8787/version | jq -r '.version'

# Compare versions
EXPECTED="1.0.0"
ACTUAL=$(curl -s http://localhost:8787/version | jq -r '.version')
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "Version mismatch! Expected $EXPECTED, got $ACTUAL"
fi
```

---

## SLA Metrics Endpoint

### `GET /metrics/sla`

**Purpose:** Get detailed SLA and performance metrics.

**Response (200 OK):**

```json
{
  "uptime_percentage": 99.95,
  "total_requests": 125847,
  "successful_requests": 125780,
  "failed_requests": 67,
  "avg_response_time_ms": 45.2,
  "p50_response_time_ms": 38.5,
  "p95_response_time_ms": 89.3,
  "p99_response_time_ms": 142.7,
  "period_start": 1705420800,
  "period_end": 1705507200,
  "period_hours": 24,
  "database_metrics": {
    "avg_latency_ms": 3.2,
    "max_latency_ms": 48.5,
    "connection_errors": 0
  },
  "websocket_metrics": {
    "active_connections": 42,
    "total_messages": 3847,
    "connection_errors": 2
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `uptime_percentage` | number | Uptime % for period (0-100) |
| `total_requests` | number | Total HTTP requests |
| `successful_requests` | number | Requests with 2xx/3xx status |
| `failed_requests` | number | Requests with 4xx/5xx status |
| `avg_response_time_ms` | number | Average response time |
| `p50_response_time_ms` | number | 50th percentile (median) |
| `p95_response_time_ms` | number | 95th percentile |
| `p99_response_time_ms` | number | 99th percentile |
| `period_start` | number | Unix timestamp (period start) |
| `period_end` | number | Unix timestamp (period end) |
| `period_hours` | number | Measurement period in hours |

**Period:**

- Default: Last 24 hours
- Configurable via query parameter: `?period=1h`, `?period=7d`, `?period=30d`

**Usage Examples:**

```bash
# Get 24-hour metrics
curl http://localhost:8787/metrics/sla

# Get 7-day metrics
curl http://localhost:8787/metrics/sla?period=7d

# Check if meeting SLA
UPTIME=$(curl -s http://localhost:8787/metrics/sla | jq -r '.uptime_percentage')
if (( $(echo "$UPTIME < 99.9" | bc -l) )); then
  echo "SLA VIOLATION: Uptime is $UPTIME%"
fi

# Export to Prometheus format
curl -s http://localhost:8787/metrics/sla | jq -r '
  "# HELP sync_uptime_percentage Uptime percentage",
  "# TYPE sync_uptime_percentage gauge",
  "sync_uptime_percentage \(.uptime_percentage)",
  "# HELP sync_avg_response_time_ms Average response time",
  "# TYPE sync_avg_response_time_ms gauge",
  "sync_avg_response_time_ms \(.avg_response_time_ms)"
'
```

---

## Monitoring Setup

### Basic Uptime Monitoring

#### Cron Job (Linux/Mac)

```bash
# Check every 5 minutes
*/5 * * * * curl -f http://localhost:8787/health || echo "Sync relay down!" | mail -s "Alert" admin@example.com
```

#### PowerShell Task (Windows)

```powershell
# check-health.ps1
$response = Invoke-WebRequest -Uri "http://localhost:8787/health" -UseBasicParsing
if ($response.StatusCode -ne 200) {
    Send-MailMessage -To "admin@example.com" -Subject "Sync Relay Down" -Body "Health check failed" -SmtpServer "smtp.example.com"
}
```

```powershell
# Schedule task
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\scripts\check-health.ps1"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "GracefulBooksHealthCheck"
```

### External Monitoring Services

#### UptimeRobot

1. Sign up at https://uptimerobot.com
2. Add New Monitor
   - Type: HTTP(s)
   - URL: `https://sync.yourdomain.com/health`
   - Interval: 5 minutes
   - Keyword: `"status":"ok"`
3. Add Alert Contacts

#### Pingdom

1. Sign up at https://pingdom.com
2. Add New Check
   - Type: Uptime
   - URL: `https://sync.yourdomain.com/health`
   - Check frequency: 1 minute
   - String to expect: `"status":"ok"`

#### Healthchecks.io

```bash
# Install healthchecks agent
pip install healthchecks

# Create check script
#!/bin/bash
curl -fsS --retry 3 https://hc-ping.com/YOUR-UUID-HERE/start
curl -f http://localhost:8787/health && \
  curl -fsS --retry 3 https://hc-ping.com/YOUR-UUID-HERE
```

### Prometheus Integration

Create `/etc/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'graceful-books-sync'
    metrics_path: '/metrics/sla'
    scrape_interval: 60s
    static_configs:
      - targets: ['localhost:8787']
```

Create custom exporter script (`metrics-exporter.sh`):

```bash
#!/bin/bash
METRICS=$(curl -s http://localhost:8787/metrics/sla)
cat <<EOF
# HELP sync_uptime_percentage Sync relay uptime percentage
# TYPE sync_uptime_percentage gauge
sync_uptime_percentage $(echo $METRICS | jq -r '.uptime_percentage')

# HELP sync_requests_total Total number of requests
# TYPE sync_requests_total counter
sync_requests_total $(echo $METRICS | jq -r '.total_requests')

# HELP sync_failed_requests_total Failed requests
# TYPE sync_failed_requests_total counter
sync_failed_requests_total $(echo $METRICS | jq -r '.failed_requests')

# HELP sync_response_time_ms Average response time
# TYPE sync_response_time_ms gauge
sync_response_time_ms $(echo $METRICS | jq -r '.avg_response_time_ms')
EOF
```

### Grafana Dashboard

Import dashboard JSON (example):

```json
{
  "dashboard": {
    "title": "Graceful Books Sync Relay",
    "panels": [
      {
        "title": "Uptime %",
        "targets": [
          {
            "expr": "sync_uptime_percentage"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "sync_response_time_ms"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

---

## Alerting

### Slack Webhook

Configure `SLA_ALERT_WEBHOOK`:

```bash
SLA_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Alert is triggered when:
- Uptime falls below `SLA_TARGET_UPTIME`
- Database latency exceeds 1 second
- Server fails to start

Payload example:

```json
{
  "text": "🚨 SLA Alert: Sync relay uptime below target",
  "attachments": [
    {
      "color": "danger",
      "fields": [
        {
          "title": "Uptime",
          "value": "99.85%",
          "short": true
        },
        {
          "title": "Target",
          "value": "99.9%",
          "short": true
        }
      ]
    }
  ]
}
```

### Discord Webhook

Use Slack-compatible format:

```bash
SLA_ALERT_WEBHOOK=https://discord.com/api/webhooks/YOUR/WEBHOOK/slack
```

### Email Alerts (Custom Script)

```bash
#!/bin/bash
# sla-check.sh
UPTIME=$(curl -s http://localhost:8787/metrics/sla | jq -r '.uptime_percentage')
TARGET=99.9

if (( $(echo "$UPTIME < $TARGET" | bc -l) )); then
  echo "SLA Violation: Uptime is $UPTIME%" | mail -s "Sync Relay SLA Alert" admin@example.com
fi
```

Add to cron:

```bash
*/15 * * * * /path/to/sla-check.sh
```

---

## Integration Examples

### Nginx Health Check

```nginx
upstream sync_backend {
    server localhost:8787 max_fails=3 fail_timeout=30s;
    health_check interval=10s uri=/health;
}

server {
    location / {
        proxy_pass http://sync_backend;
    }
}
```

### HAProxy Health Check

```
backend sync_relay
    option httpchk GET /health
    http-check expect status 200
    server sync1 localhost:8787 check inter 10s
```

### AWS Application Load Balancer

```yaml
HealthCheck:
  Enabled: true
  HealthCheckIntervalSeconds: 30
  HealthCheckPath: /health
  HealthCheckProtocol: HTTP
  HealthCheckTimeoutSeconds: 5
  HealthyThresholdCount: 2
  UnhealthyThresholdCount: 3
  Matcher:
    HttpCode: "200"
```

### Kubernetes Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 8787
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  successThreshold: 1
  failureThreshold: 3
```

### Docker Swarm Healthcheck

```yaml
version: '3.8'
services:
  sync-relay:
    image: gracefulbooks/sync-relay:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8787/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## Best Practices

1. **Monitor from multiple locations** - External service + internal checks
2. **Set appropriate thresholds** - Balance false positives vs. detection speed
3. **Test your alerts** - Manually trigger to verify notifications work
4. **Track trends** - Monitor long-term patterns, not just instant status
5. **Document incidents** - Keep log of outages and resolutions
6. **Regular maintenance windows** - Schedule downtime during low usage
7. **Gradual rollouts** - Test updates in staging before production

## Troubleshooting

**Health check times out:**
- Server overloaded (check CPU/memory)
- Database connection slow (check DB latency)
- Network issues (check connectivity)

**Status shows "degraded":**
- Database latency >100ms (normal <10ms)
- Check database file size
- Check disk I/O performance

**SLA metrics show low uptime:**
- Review server logs for errors
- Check database connection errors
- Verify network stability
- Review resource utilization

## Support

- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [GitHub Issues](https://github.com/gracefulbooks/graceful-books/issues)
- [Documentation](https://docs.gracefulbooks.com/self-hosted)
