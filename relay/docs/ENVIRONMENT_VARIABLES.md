# Environment Variables Reference

Complete reference for all environment variables supported by the Graceful Books self-hosted sync relay.

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Core Configuration](#core-configuration)
3. [Database Configuration](#database-configuration)
4. [Rate Limiting](#rate-limiting)
5. [WebSocket Configuration](#websocket-configuration)
6. [Monitoring & SLA](#monitoring--sla)
7. [Logging](#logging)
8. [Security](#security)
9. [Examples](#examples)

## Quick Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment mode |
| `PORT` | No | `8787` | Server port |
| `DB_PATH` | Yes | `./sync.db` | SQLite database path |
| `LOG_LEVEL` | No | `info` | Logging verbosity |
| `MAX_REQUESTS_PER_MINUTE` | No | `60` | Rate limit per IP |
| `MAX_PAYLOAD_SIZE_MB` | No | `10` | Max request size |
| `WS_PING_INTERVAL_MS` | No | `30000` | WebSocket ping interval |
| `WS_TIMEOUT_MS` | No | `60000` | WebSocket timeout |
| `SLA_TARGET_UPTIME` | No | `0.999` | Target uptime (99.9%) |
| `SLA_ALERT_WEBHOOK` | No | - | Webhook for SLA alerts |

## Core Configuration

### `NODE_ENV`

**Description:** Application environment mode.

**Required:** Yes

**Default:** `development`

**Valid Values:**
- `development` - Development mode with verbose logging
- `production` - Production mode with optimizations
- `test` - Testing mode

**Example:**
```bash
NODE_ENV=production
```

**Notes:**
- In production, error messages are sanitized
- Development mode includes additional debug information
- Always use `production` for deployed instances

---

### `PORT`

**Description:** Port number for the HTTP/WebSocket server.

**Required:** No

**Default:** `8787`

**Valid Values:** `1024-65535` (privileged ports require root)

**Example:**
```bash
PORT=8787
```

**Notes:**
- If port is in use, server will fail to start
- Use port 80/443 with reverse proxy for production
- Docker containers should map to this port

---

### `HOST`

**Description:** Interface to bind the server to.

**Required:** No

**Default:** `0.0.0.0` (all interfaces)

**Valid Values:**
- `0.0.0.0` - All network interfaces
- `127.0.0.1` - Localhost only
- Specific IP address

**Example:**
```bash
HOST=0.0.0.0
```

**Notes:**
- Use `127.0.0.1` if behind reverse proxy on same machine
- Use `0.0.0.0` for Docker containers

---

## Database Configuration

### `DB_PATH`

**Description:** Path to SQLite database file.

**Required:** Yes

**Default:** `./sync.db`

**Valid Values:** Any valid filesystem path

**Examples:**
```bash
# Relative path
DB_PATH=./data/sync.db

# Absolute path (Linux/Mac)
DB_PATH=/var/lib/graceful-books/sync.db

# Absolute path (Windows)
DB_PATH=C:\data\graceful-books\sync.db

# Docker volume
DB_PATH=/app/data/sync.db
```

**Notes:**
- Directory must exist and be writable
- Database is created automatically if it doesn't exist
- Recommend placing on persistent volume for Docker
- Back up this file regularly

---

### `DB_CLEANUP_DAYS`

**Description:** Number of days to retain old sync records.

**Required:** No

**Default:** `30`

**Valid Values:** `1-365`

**Example:**
```bash
DB_CLEANUP_DAYS=30
```

**Notes:**
- Records older than this are deleted daily at 2 AM
- Reduces database size over time
- Clients should sync within this window
- Increase for slower sync schedules

---

## Rate Limiting

### `MAX_REQUESTS_PER_MINUTE`

**Description:** Maximum API requests allowed per IP per minute.

**Required:** No

**Default:** `60`

**Valid Values:** `1-10000`

**Example:**
```bash
MAX_REQUESTS_PER_MINUTE=60
```

**Notes:**
- Protects against abuse and DoS
- Clients include backoff for rate limits
- Increase for high-frequency sync scenarios
- Monitor for legitimate users hitting limit

---

### `MAX_PAYLOAD_SIZE_MB`

**Description:** Maximum size of request payload in megabytes.

**Required:** No

**Default:** `10`

**Valid Values:** `1-100`

**Example:**
```bash
MAX_PAYLOAD_SIZE_MB=10
```

**Notes:**
- Prevents memory exhaustion attacks
- Large payloads indicate client issues
- 10MB accommodates ~1000 transactions
- Increase only if needed for batch operations

---

### `RATE_LIMIT_ENABLED`

**Description:** Enable/disable rate limiting.

**Required:** No

**Default:** `true`

**Valid Values:** `true`, `false`

**Example:**
```bash
RATE_LIMIT_ENABLED=true
```

**Notes:**
- Disable only for testing
- Always enable in production
- Rate limit state stored in memory (resets on restart)

---

## WebSocket Configuration

### `WS_PING_INTERVAL_MS`

**Description:** Interval for WebSocket ping messages (milliseconds).

**Required:** No

**Default:** `30000` (30 seconds)

**Valid Values:** `5000-300000` (5 seconds - 5 minutes)

**Example:**
```bash
WS_PING_INTERVAL_MS=30000
```

**Notes:**
- Keeps connections alive through NAT/firewalls
- Too frequent increases bandwidth
- Too infrequent risks connection drops
- Balance based on network environment

---

### `WS_TIMEOUT_MS`

**Description:** WebSocket connection timeout (milliseconds).

**Required:** No

**Default:** `60000` (60 seconds)

**Valid Values:** `10000-600000` (10 seconds - 10 minutes)

**Example:**
```bash
WS_TIMEOUT_MS=60000
```

**Notes:**
- Closes stale connections
- Should be > 2x ping interval
- Clients auto-reconnect on timeout
- Increase for unreliable networks

---

### `WS_MAX_CONNECTIONS`

**Description:** Maximum concurrent WebSocket connections.

**Required:** No

**Default:** `1000`

**Valid Values:** `1-100000`

**Example:**
```bash
WS_MAX_CONNECTIONS=1000
```

**Notes:**
- Prevents resource exhaustion
- Each connection uses ~50KB memory
- Increase based on available RAM
- Monitor actual connection count

---

## Monitoring & SLA

### `SLA_TARGET_UPTIME`

**Description:** Target uptime percentage for monitoring.

**Required:** No

**Default:** `0.999` (99.9%)

**Valid Values:** `0.9-1.0` (90%-100%)

**Example:**
```bash
SLA_TARGET_UPTIME=0.999
```

**Notes:**
- Used for alerting when uptime falls below target
- 99.9% = 43 minutes downtime per month
- 99.99% = 4.3 minutes downtime per month
- Track via `/metrics/sla` endpoint

---

### `SLA_ALERT_WEBHOOK`

**Description:** Webhook URL for SLA alerts.

**Required:** No

**Default:** None

**Valid Values:** HTTPS URL

**Example:**
```bash
SLA_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Notes:**
- Sends POST request when SLA violated
- Supports Slack, Discord, Microsoft Teams webhooks
- Payload: `{"text": "SLA Alert: Uptime below target"}`
- Test webhook before production use

---

### `METRICS_ENABLED`

**Description:** Enable/disable metrics collection.

**Required:** No

**Default:** `true`

**Valid Values:** `true`, `false`

**Example:**
```bash
METRICS_ENABLED=true
```

**Notes:**
- Minimal performance impact
- Disable only if privacy critical
- Metrics are not shared externally
- Required for `/metrics/sla` endpoint

---

## Logging

### `LOG_LEVEL`

**Description:** Logging verbosity level.

**Required:** No

**Default:** `info`

**Valid Values:**
- `debug` - Very verbose, includes all details
- `info` - Normal operation logs
- `warn` - Warnings and errors only
- `error` - Errors only

**Example:**
```bash
LOG_LEVEL=info
```

**Notes:**
- Use `debug` for troubleshooting
- Use `info` for production
- Use `warn` or `error` to reduce log volume
- Logs to stdout (redirect to file if needed)

---

### `LOG_FORMAT`

**Description:** Log output format.

**Required:** No

**Default:** `json`

**Valid Values:**
- `json` - Structured JSON logs
- `pretty` - Human-readable colored logs

**Example:**
```bash
LOG_FORMAT=json
```

**Notes:**
- Use `json` for production (easier parsing)
- Use `pretty` for development
- JSON logs work with log aggregators (ELK, Splunk)

---

## Security

### `CORS_ORIGIN`

**Description:** Allowed CORS origins.

**Required:** No

**Default:** `*` (all origins)

**Valid Values:**
- `*` - All origins (development only)
- Specific origin(s) comma-separated

**Examples:**
```bash
# Single origin
CORS_ORIGIN=https://app.gracefulbooks.com

# Multiple origins
CORS_ORIGIN=https://app.gracefulbooks.com,https://staging.gracefulbooks.com

# Development (all origins)
CORS_ORIGIN=*
```

**Notes:**
- Always restrict in production
- Include all client domains
- Protocol (https://) must match

---

### `REQUIRE_HTTPS`

**Description:** Reject non-HTTPS requests.

**Required:** No

**Default:** `false`

**Valid Values:** `true`, `false`

**Example:**
```bash
REQUIRE_HTTPS=true
```

**Notes:**
- Use with reverse proxy terminating SSL
- Checks `X-Forwarded-Proto` header
- Disable for local development
- Enable for production with HTTPS

---

### `SECRET_KEY`

**Description:** Secret key for signing tokens (future use).

**Required:** No

**Default:** Auto-generated

**Valid Values:** Any string (32+ characters recommended)

**Example:**
```bash
SECRET_KEY=your-very-long-random-secret-key-here
```

**Notes:**
- Currently unused (reserved for future features)
- Generate with: `openssl rand -hex 32`
- Keep secret and secure
- Rotate periodically

---

## Examples

### Minimal Configuration (Development)

```bash
NODE_ENV=development
PORT=8787
DB_PATH=./sync.db
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### Production Configuration (Docker)

```bash
NODE_ENV=production
PORT=8787
DB_PATH=/app/data/sync.db
LOG_LEVEL=info
LOG_FORMAT=json
MAX_REQUESTS_PER_MINUTE=120
MAX_PAYLOAD_SIZE_MB=20
WS_PING_INTERVAL_MS=30000
WS_TIMEOUT_MS=60000
SLA_TARGET_UPTIME=0.999
SLA_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK
CORS_ORIGIN=https://app.gracefulbooks.com
REQUIRE_HTTPS=true
```

### High-Volume Configuration

```bash
NODE_ENV=production
PORT=8787
DB_PATH=/var/lib/graceful-books/sync.db
LOG_LEVEL=warn
MAX_REQUESTS_PER_MINUTE=300
MAX_PAYLOAD_SIZE_MB=50
WS_MAX_CONNECTIONS=5000
DB_CLEANUP_DAYS=90
METRICS_ENABLED=true
```

### Private Network Configuration

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=8787
DB_PATH=/data/sync.db
LOG_LEVEL=info
RATE_LIMIT_ENABLED=false
CORS_ORIGIN=*
REQUIRE_HTTPS=false
```

## Setting Environment Variables

### Docker Compose

Edit `docker-compose.yml`:

```yaml
services:
  sync-relay:
    environment:
      - NODE_ENV=production
      - PORT=8787
      - DB_PATH=/app/data/sync.db
```

Or use `.env` file:

```bash
# .env
NODE_ENV=production
PORT=8787
DB_PATH=/app/data/sync.db
```

### Standalone Binary (Linux/Mac)

```bash
export NODE_ENV=production
export PORT=8787
export DB_PATH=/var/lib/graceful-books/sync.db
./graceful-books-sync-linux-x64
```

Or create `.env` file in same directory as binary.

### Standalone Binary (Windows)

```powershell
$env:NODE_ENV="production"
$env:PORT="8787"
$env:DB_PATH="C:\data\sync.db"
.\graceful-books-sync-win-x64.exe
```

### Systemd Service (Linux)

Edit `/etc/systemd/system/graceful-books-sync.service`:

```ini
[Service]
Environment="NODE_ENV=production"
Environment="PORT=8787"
Environment="DB_PATH=/var/lib/graceful-books/sync.db"
```

## Validation

The relay validates environment variables on startup:

- Required variables must be set
- Numeric values must be in valid ranges
- Paths must be accessible
- URLs must be valid

Validation errors are logged and prevent startup.

## Support

For questions about environment variables:

- Documentation: https://docs.gracefulbooks.com/self-hosted
- GitHub Issues: https://github.com/gracefulbooks/graceful-books/issues
- Community Forum: https://community.gracefulbooks.com
