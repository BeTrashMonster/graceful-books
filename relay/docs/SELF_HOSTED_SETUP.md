# Self-Hosted Sync Relay Setup Guide

**Full control. Your data on your servers. We'll show you how.**

This guide will help you set up your own Graceful Books sync relay server, giving you complete control over your data synchronization infrastructure.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start with Docker](#quick-start-with-docker)
4. [Installation Methods](#installation-methods)
5. [Configuration](#configuration)
6. [First Run](#first-run)
7. [Connecting Clients](#connecting-clients)
8. [Monitoring](#monitoring)
9. [Maintenance](#maintenance)
10. [Next Steps](#next-steps)

## Overview

The Graceful Books sync relay enables multi-device synchronization of your encrypted financial data. When self-hosted, you have:

- **Complete control** over your data infrastructure
- **Zero dependence** on Graceful Books cloud services
- **Customizable** rate limits and storage
- **Private network** deployment options
- **Full compliance** with your security policies

### What Gets Self-Hosted

- Sync relay server (handles encrypted data synchronization)
- SQLite database (stores encrypted payloads)
- Health monitoring endpoints
- WebSocket server (for real-time notifications)

### What Doesn't Change

- **Zero-knowledge architecture** - Server never sees plaintext data
- **Client-side encryption** - All encryption happens on your devices
- **Compatibility** - Works with official Graceful Books clients

## Prerequisites

Choose one installation method:

### Option 1: Docker (Recommended)

- Docker Engine 20.10+
- Docker Compose 2.0+ (optional but recommended)
- 512MB RAM minimum, 1GB recommended
- 1GB disk space for container + data

### Option 2: Standalone Binary

- Linux (x64/ARM64), Windows (x64), or macOS (x64/ARM64)
- 256MB RAM minimum, 512MB recommended
- 100MB disk space + database growth

### Option 3: From Source

- Node.js 18+
- npm or yarn
- Git

### Network Requirements

- **Port 8787** (default, configurable)
- **HTTPS recommended** for production (via reverse proxy)
- **Firewall rules** to allow client connections

## Quick Start with Docker

The fastest way to get started is using Docker Compose:

### Step 1: Create Directory

```bash
mkdir graceful-books-sync
cd graceful-books-sync
```

### Step 2: Download Docker Compose File

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/gracefulbooks/graceful-books/main/relay/docker-compose.yml
```

Or create `docker-compose.yml` manually (see [docker-compose.yml](../docker-compose.yml)).

### Step 3: Configure Environment

Create `.env` file:

```bash
# Server Configuration
NODE_ENV=production
PORT=8787
LOG_LEVEL=info

# Database
DB_PATH=/app/data/sync.db

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=60
MAX_PAYLOAD_SIZE_MB=10

# WebSocket
WS_PING_INTERVAL_MS=30000
WS_TIMEOUT_MS=60000
```

### Step 4: Start the Server

```bash
docker-compose up -d
```

### Step 5: Verify Installation

```bash
curl http://localhost:8787/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "version": "1.0.0",
  "database": {
    "status": "ok",
    "latency_ms": 5.2
  }
}
```

**That's it!** Your self-hosted sync relay is running.

## Installation Methods

### Method 1: Docker Compose (Recommended)

See [Quick Start](#quick-start-with-docker) above.

**Pros:**
- Easiest setup
- Automatic restarts
- Easy updates
- Built-in health checks

**Cons:**
- Requires Docker

### Method 2: Docker (Manual)

```bash
# Pull image
docker pull gracefulbooks/sync-relay:latest

# Run container
docker run -d \
  --name graceful-books-sync \
  -p 8787:8787 \
  -v $(pwd)/data:/app/data \
  -e NODE_ENV=production \
  -e DB_PATH=/app/data/sync.db \
  --restart unless-stopped \
  gracefulbooks/sync-relay:latest
```

### Method 3: Standalone Binary

#### Linux

```bash
# Download binary
wget https://github.com/gracefulbooks/graceful-books/releases/download/v1.0.0/graceful-books-sync-v1.0.0-linux-x64.tar.gz

# Extract
tar -xzf graceful-books-sync-v1.0.0-linux-x64.tar.gz

# Make executable
chmod +x graceful-books-sync-linux-x64

# Run
./graceful-books-sync-linux-x64
```

#### Windows

1. Download `graceful-books-sync-v1.0.0-win-x64.zip`
2. Extract to desired location
3. Double-click `graceful-books-sync-win-x64.exe` or run from PowerShell:

```powershell
.\graceful-books-sync-win-x64.exe
```

#### macOS

```bash
# Download binary (Intel)
curl -LO https://github.com/gracefulbooks/graceful-books/releases/download/v1.0.0/graceful-books-sync-v1.0.0-macos-x64.tar.gz

# Or for Apple Silicon
curl -LO https://github.com/gracefulbooks/graceful-books/releases/download/v1.0.0/graceful-books-sync-v1.0.0-macos-arm64.tar.gz

# Extract
tar -xzf graceful-books-sync-v1.0.0-macos-*.tar.gz

# Remove quarantine attribute
xattr -d com.apple.quarantine graceful-books-sync-macos-*

# Make executable
chmod +x graceful-books-sync-macos-*

# Run
./graceful-books-sync-macos-x64
```

### Method 4: From Source

```bash
# Clone repository
git clone https://github.com/gracefulbooks/graceful-books.git
cd graceful-books/relay

# Install dependencies
npm ci

# Build
npm run build

# Run
npm start
```

## Configuration

### Environment Variables

Create a `.env` file or set environment variables:

```bash
# Required
NODE_ENV=production
PORT=8787
DB_PATH=/path/to/sync.db

# Optional (defaults shown)
LOG_LEVEL=info                    # debug, info, warn, error
MAX_REQUESTS_PER_MINUTE=60        # Rate limit per IP
MAX_PAYLOAD_SIZE_MB=10            # Maximum request size
WS_PING_INTERVAL_MS=30000         # WebSocket keepalive
WS_TIMEOUT_MS=60000               # WebSocket timeout
SLA_TARGET_UPTIME=0.999           # Target uptime (99.9%)
```

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for complete reference.

### Database Configuration

By default, the relay uses SQLite stored at `DB_PATH`:

```bash
# Docker
DB_PATH=/app/data/sync.db

# Standalone
DB_PATH=./data/sync.db
```

The database is created automatically on first run.

### HTTPS / SSL Setup

For production, use a reverse proxy (Nginx, Caddy, Traefik) with SSL:

#### Nginx Example

```nginx
server {
    listen 443 ssl http2;
    server_name sync.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Caddy Example (Automatic HTTPS)

```
sync.yourdomain.com {
    reverse_proxy localhost:8787
}
```

## First Run

### Verify Installation

```bash
# Check health
curl http://localhost:8787/health

# Check version
curl http://localhost:8787/version

# View metrics
curl http://localhost:8787/metrics/sla
```

### Check Logs

#### Docker
```bash
docker logs graceful-books-sync
```

#### Systemd (Linux)
```bash
journalctl -u graceful-books-sync -f
```

#### Standalone
Logs are written to stdout by default. Redirect to file:
```bash
./graceful-books-sync > sync.log 2>&1
```

## Connecting Clients

### Configure Graceful Books App

1. Open Graceful Books settings
2. Navigate to **Sync Settings**
3. Select **Custom Sync Server**
4. Enter your server URL: `https://sync.yourdomain.com`
5. Click **Test Connection**
6. If successful, click **Save**

### Test Synchronization

1. Make a change on one device (e.g., create a transaction)
2. Open Graceful Books on another device
3. Changes should sync within seconds

### Troubleshooting Connection

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed help.

## Monitoring

### Health Checks

Set up automated health monitoring:

```bash
# Cron job (every 5 minutes)
*/5 * * * * curl -f http://localhost:8787/health || echo "Sync relay down!" | mail -s "Alert" admin@yourdomain.com
```

### SLA Metrics

View uptime and performance metrics:

```bash
curl http://localhost:8787/metrics/sla
```

Response includes:
- Uptime percentage
- Request counts
- Average response time
- Error rates

### Resource Usage

#### Docker
```bash
docker stats graceful-books-sync
```

#### Linux (systemd)
```bash
systemctl status graceful-books-sync
```

## Maintenance

### Backup Database

#### Docker

```bash
# Stop container
docker-compose stop

# Backup data volume
docker run --rm -v graceful-books-sync_sync-data:/data -v $(pwd):/backup alpine tar czf /backup/sync-backup-$(date +%Y%m%d).tar.gz /data

# Start container
docker-compose up -d
```

#### Standalone

```bash
# Simply copy the database file
cp /path/to/sync.db /path/to/backups/sync-$(date +%Y%m%d).db
```

### Update Relay

#### Docker

```bash
# Pull latest image
docker-compose pull

# Restart with new image
docker-compose up -d
```

#### Standalone Binary

1. Download new binary
2. Stop old process
3. Replace binary
4. Start new process

#### From Source

```bash
git pull
npm ci
npm run build
npm restart  # or restart your process manager
```

### Database Maintenance

The relay automatically cleans old sync records (>30 days) daily at 2 AM.

Manual cleanup:

```bash
# Connect to database
sqlite3 /path/to/sync.db

# Delete old records
DELETE FROM sync_changes WHERE created_at < strftime('%s', 'now') - 2592000;

# Vacuum to reclaim space
VACUUM;
```

## Next Steps

- [Environment Variables Reference](./ENVIRONMENT_VARIABLES.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Security Checklist](./SECURITY_CHECKLIST.md)
- [Migration from Hosted](./MIGRATION_GUIDE.md)
- [Health Check Documentation](./HEALTH_CHECKS.md)
- [Version Compatibility](./VERSION_COMPATIBILITY.md)

## Support

- **Documentation**: https://docs.gracefulbooks.com/self-hosted
- **GitHub Issues**: https://github.com/gracefulbooks/graceful-books/issues
- **Community Forum**: https://community.gracefulbooks.com

## License

Proprietary - Graceful Books, Inc.

While the sync relay can be self-hosted, it remains proprietary software. See LICENSE for details.
