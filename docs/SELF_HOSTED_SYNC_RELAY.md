# Self-Hosted Sync Relay Guide

**Version:** 1.0.0
**Last Updated:** 2026-03-30
**Status:** Phase 4 - Real-Time Sync Foundation

---

## Table of Contents

1. [Introduction](#introduction)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Security Best Practices](#security-best-practices)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Performance Tuning](#performance-tuning)
10. [Backup & Recovery](#backup--recovery)
11. [Upgrade Procedures](#upgrade-procedures)
12. [FAQ](#faq)

---

## Introduction

Graceful Books supports self-hosted sync relay servers for users who want complete control over their data synchronization infrastructure. The sync relay acts as a **zero-knowledge "dumb pipe"** - it cannot decrypt your data and has no access to your encryption keys.

### What is a Sync Relay?

The sync relay is a WebSocket server that:
- Forwards encrypted sync messages between your devices
- Has **zero knowledge** of your encryption keys or data contents
- Provides conflict resolution coordination (but never sees plaintext)
- Enforces rate limits to prevent abuse
- Maintains connection state and message queues

### Why Self-Host?

- **Maximum Privacy:** Your sync traffic never leaves your infrastructure
- **Data Sovereignty:** Complete control over where sync data flows
- **Performance:** Lower latency by hosting close to your devices
- **Compliance:** Meet regulatory requirements for data residency
- **Cost Control:** No subscription fees for sync services

### Architecture Overview

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Device 1  │         │   Device 2  │         │   Device 3  │
│  (Desktop)  │         │   (Phone)   │         │   (Tablet)  │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  Encrypted Messages   │   Encrypted Messages  │
       │  (WebSocket/TLS)      │   (WebSocket/TLS)     │
       │                       │                       │
       └───────────────────────┼───────────────────────┘
                               │
                        ┌──────▼──────┐
                        │  Sync Relay │
                        │   (Node.js) │
                        │             │
                        │ • WebSocket │
                        │ • Message   │
                        │   Forwarding│
                        │ • Rate      │
                        │   Limiting  │
                        └─────────────┘
```

**Key Security Properties:**
- All messages are **end-to-end encrypted** before reaching the relay
- Relay only sees encrypted payloads and HMAC signatures
- Relay cannot decrypt, modify, or inspect message contents
- Relay operator has zero access to user data

---

## System Requirements

### Minimum Requirements

- **OS:** Ubuntu 22.04 LTS, Debian 12, or compatible Linux distribution
- **CPU:** 2 cores (4 cores recommended for production)
- **RAM:** 2 GB (4 GB recommended for production)
- **Storage:** 20 GB SSD (for logs and temporary message queues)
- **Network:** Static IP address or dynamic DNS
- **Bandwidth:** 10 Mbps upload/download minimum

### Recommended Production Specs

- **OS:** Ubuntu 22.04 LTS (latest patches)
- **CPU:** 4+ cores
- **RAM:** 8 GB
- **Storage:** 50 GB NVMe SSD
- **Network:** 100 Mbps+ symmetric connection
- **Uptime:** 99.9%+ availability target

### Software Dependencies

- **Node.js:** v20.x LTS or later
- **npm:** v10.x or later
- **SSL Certificate:** Valid TLS certificate (Let's Encrypt recommended)
- **Reverse Proxy:** nginx or Caddy (optional but recommended)
- **Process Manager:** PM2 or systemd
- **Firewall:** ufw or iptables

### Network Requirements

- **Inbound Ports:**
  - `443/tcp` - HTTPS/WSS (WebSocket Secure)
  - `80/tcp` - HTTP (for SSL certificate renewal only)
- **Outbound:** Internet access for npm packages and SSL renewal
- **DNS:** Fully qualified domain name (FQDN) pointing to your server

---

## Installation

### Step 1: Prepare the Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl git build-essential ufw

# Configure firewall
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP (SSL renewal)
sudo ufw allow 443/tcp # HTTPS/WSS
sudo ufw enable
```

### Step 2: Install Node.js

```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show v10.x.x
```

### Step 3: Create Sync Relay User

```bash
# Create dedicated user (security best practice)
sudo useradd -r -m -s /bin/bash syncrelay

# Create application directory
sudo mkdir -p /opt/syncrelay
sudo chown syncrelay:syncrelay /opt/syncrelay
```

### Step 4: Install Sync Relay Server

```bash
# Switch to syncrelay user
sudo su - syncrelay

# Clone sync relay repository
cd /opt/syncrelay
git clone https://github.com/graceful-books/sync-relay.git .

# Install dependencies
npm install --production

# Build the server
npm run build

# Exit back to admin user
exit
```

### Step 5: Configure SSL Certificate

#### Option A: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot

# Obtain certificate (replace with your domain)
sudo certbot certonly --standalone \
  -d sync.yourdomain.com \
  --agree-tos \
  --email admin@yourdomain.com

# Certificate will be at:
# /etc/letsencrypt/live/sync.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/sync.yourdomain.com/privkey.pem

# Set up auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

#### Option B: Custom Certificate

Place your SSL certificate and private key at:
- Certificate: `/opt/syncrelay/ssl/cert.pem`
- Private Key: `/opt/syncrelay/ssl/key.pem`

```bash
sudo mkdir -p /opt/syncrelay/ssl
sudo chown syncrelay:syncrelay /opt/syncrelay/ssl
sudo chmod 700 /opt/syncrelay/ssl

# Copy your certificate files
sudo cp your-cert.pem /opt/syncrelay/ssl/cert.pem
sudo cp your-key.pem /opt/syncrelay/ssl/key.pem
sudo chown syncrelay:syncrelay /opt/syncrelay/ssl/*
sudo chmod 600 /opt/syncrelay/ssl/*
```

### Step 6: Configure the Relay

Create configuration file `/opt/syncrelay/config/production.json`:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8443,
    "ssl": {
      "enabled": true,
      "cert": "/etc/letsencrypt/live/sync.yourdomain.com/fullchain.pem",
      "key": "/etc/letsencrypt/live/sync.yourdomain.com/privkey.pem"
    }
  },
  "relay": {
    "maxConnectionsPerUser": 5,
    "maxConnectionsPerDevice": 1,
    "messageQueueSize": 1000,
    "messageRetentionMs": 300000,
    "heartbeatIntervalMs": 30000,
    "connectionTimeoutMs": 60000
  },
  "rateLimiting": {
    "enabled": true,
    "sync": {
      "maxRequests": 60,
      "windowMs": 60000,
      "maxBurst": 10,
      "refillRate": 1
    },
    "auth": {
      "maxRequests": 5,
      "windowMs": 60000,
      "maxBurst": 2,
      "refillRate": 0.083
    },
    "connection": {
      "maxRequests": 10,
      "windowMs": 60000,
      "maxBurst": 3,
      "refillRate": 0.167
    },
    "violationsBeforeBan": 5,
    "banDuration": 3600000
  },
  "logging": {
    "level": "info",
    "file": "/var/log/syncrelay/relay.log",
    "maxSize": "50m",
    "maxFiles": 10,
    "compress": true
  },
  "monitoring": {
    "enabled": true,
    "metricsPort": 9090,
    "healthCheckPath": "/health"
  }
}
```

### Step 7: Create Log Directory

```bash
sudo mkdir -p /var/log/syncrelay
sudo chown syncrelay:syncrelay /var/log/syncrelay
sudo chmod 755 /var/log/syncrelay
```

### Step 8: Set Up Process Manager

#### Option A: systemd (Recommended)

Create `/etc/systemd/system/syncrelay.service`:

```ini
[Unit]
Description=Graceful Books Sync Relay
After=network.target

[Service]
Type=simple
User=syncrelay
WorkingDirectory=/opt/syncrelay
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=syncrelay

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/syncrelay

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable syncrelay
sudo systemctl start syncrelay
sudo systemctl status syncrelay
```

#### Option B: PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start relay as syncrelay user
sudo su - syncrelay
cd /opt/syncrelay
pm2 start dist/server.js --name syncrelay
pm2 save
exit

# Set up PM2 to start on boot
sudo pm2 startup systemd -u syncrelay --hp /home/syncrelay
```

---

## Configuration

### Environment Variables

You can override configuration with environment variables:

```bash
# Server configuration
SYNC_HOST=0.0.0.0
SYNC_PORT=8443
SYNC_SSL_CERT=/path/to/cert.pem
SYNC_SSL_KEY=/path/to/key.pem

# Rate limiting
SYNC_RATE_LIMIT_ENABLED=true
SYNC_MAX_CONNECTIONS_PER_USER=5
SYNC_MAX_CONNECTIONS_PER_DEVICE=1

# Logging
SYNC_LOG_LEVEL=info
SYNC_LOG_FILE=/var/log/syncrelay/relay.log
```

### Configuration Options Reference

#### Server Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `server.host` | string | `0.0.0.0` | Listen address |
| `server.port` | number | `8443` | Listen port |
| `server.ssl.enabled` | boolean | `true` | Enable SSL/TLS |
| `server.ssl.cert` | string | - | Path to SSL certificate |
| `server.ssl.key` | string | - | Path to SSL private key |

#### Relay Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `relay.maxConnectionsPerUser` | number | `5` | Max devices per user |
| `relay.maxConnectionsPerDevice` | number | `1` | Max connections per device |
| `relay.messageQueueSize` | number | `1000` | Max queued messages |
| `relay.messageRetentionMs` | number | `300000` | Message retention (5 min) |
| `relay.heartbeatIntervalMs` | number | `30000` | Heartbeat interval (30 sec) |
| `relay.connectionTimeoutMs` | number | `60000` | Connection timeout (1 min) |

#### Rate Limiting Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rateLimiting.enabled` | boolean | `true` | Enable rate limiting |
| `rateLimiting.sync.maxRequests` | number | `60` | Max sync messages/window |
| `rateLimiting.sync.windowMs` | number | `60000` | Rate limit window (1 min) |
| `rateLimiting.sync.maxBurst` | number | `10` | Burst token capacity |
| `rateLimiting.sync.refillRate` | number | `1` | Tokens per second |
| `rateLimiting.violationsBeforeBan` | number | `5` | Violations before ban |
| `rateLimiting.banDuration` | number | `3600000` | Ban duration (1 hour) |

---

## Security Best Practices

### 1. Keep Software Updated

```bash
# Update system packages monthly
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
cd /opt/syncrelay
sudo su - syncrelay
npm audit
npm update
exit
```

### 2. Use Strong Firewall Rules

```bash
# Deny all incoming by default
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH (consider changing port)
sudo ufw allow 80/tcp   # HTTP (SSL renewal only)
sudo ufw allow 443/tcp  # HTTPS/WSS
sudo ufw enable
```

### 3. Implement Fail2Ban

```bash
# Install fail2ban
sudo apt install -y fail2ban

# Create jail for sync relay
sudo nano /etc/fail2ban/jail.d/syncrelay.conf
```

Add:

```ini
[syncrelay]
enabled = true
port = 443
filter = syncrelay
logpath = /var/log/syncrelay/relay.log
maxretry = 5
findtime = 600
bantime = 3600
```

### 4. Regular Security Audits

```bash
# Check for unauthorized users
sudo lastlog

# Review active connections
sudo ss -tunap | grep :8443

# Check for suspicious processes
sudo ps aux | grep node

# Review system logs
sudo journalctl -u syncrelay -n 100
```

### 5. Enable Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 6. Restrict File Permissions

```bash
# Lock down configuration files
sudo chmod 600 /opt/syncrelay/config/*.json
sudo chown syncrelay:syncrelay /opt/syncrelay/config/*.json

# Lock down SSL keys
sudo chmod 600 /opt/syncrelay/ssl/*.pem
sudo chown syncrelay:syncrelay /opt/syncrelay/ssl/*.pem
```

### 7. Monitor for Intrusions

```bash
# Install AIDE (Advanced Intrusion Detection Environment)
sudo apt install -y aide
sudo aideinit
sudo mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Run daily checks
sudo aide --check
```

---

## SSL/TLS Setup

### Let's Encrypt Certificate Renewal

Certificates auto-renew via systemd timer. Verify:

```bash
# Check renewal timer status
sudo systemctl status certbot.timer

# Test renewal (dry run)
sudo certbot renew --dry-run

# Manually renew if needed
sudo certbot renew

# Restart relay after renewal
sudo systemctl restart syncrelay
```

### Certificate Renewal Hook

Create `/etc/letsencrypt/renewal-hooks/post/reload-syncrelay.sh`:

```bash
#!/bin/bash
systemctl restart syncrelay
```

Make executable:

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/post/reload-syncrelay.sh
```

### Custom Certificate Rotation

If using custom certificates:

```bash
# Backup old certificate
sudo cp /opt/syncrelay/ssl/cert.pem /opt/syncrelay/ssl/cert.pem.bak

# Install new certificate
sudo cp new-cert.pem /opt/syncrelay/ssl/cert.pem
sudo cp new-key.pem /opt/syncrelay/ssl/key.pem

# Set permissions
sudo chown syncrelay:syncrelay /opt/syncrelay/ssl/*
sudo chmod 600 /opt/syncrelay/ssl/*

# Restart relay
sudo systemctl restart syncrelay
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Check relay status
sudo systemctl status syncrelay

# Check logs
sudo journalctl -u syncrelay -f

# Check metrics endpoint
curl http://localhost:9090/metrics

# Check health endpoint
curl https://sync.yourdomain.com/health
```

### Metrics

The relay exposes Prometheus-compatible metrics at `http://localhost:9090/metrics`:

- `syncrelay_active_connections` - Current active WebSocket connections
- `syncrelay_messages_forwarded_total` - Total messages forwarded
- `syncrelay_messages_queued` - Messages in queue
- `syncrelay_rate_limit_violations_total` - Rate limit violations
- `syncrelay_banned_users_total` - Currently banned users
- `syncrelay_uptime_seconds` - Server uptime

### Log Rotation

Logs are rotated automatically by the relay. Manual rotation:

```bash
# Rotate logs
sudo logrotate -f /etc/logrotate.d/syncrelay

# Check log sizes
sudo du -sh /var/log/syncrelay/*
```

### Backup Procedures

```bash
# Backup configuration
sudo tar czf /backup/syncrelay-config-$(date +%Y%m%d).tar.gz \
  /opt/syncrelay/config/

# Backup SSL certificates
sudo tar czf /backup/syncrelay-ssl-$(date +%Y%m%d).tar.gz \
  /opt/syncrelay/ssl/

# Backup logs (optional)
sudo tar czf /backup/syncrelay-logs-$(date +%Y%m%d).tar.gz \
  /var/log/syncrelay/
```

---

## Troubleshooting

### Issue: Relay Won't Start

**Symptoms:** Service fails to start or crashes immediately.

**Solutions:**

```bash
# Check logs for errors
sudo journalctl -u syncrelay -n 50 --no-pager

# Verify configuration
cd /opt/syncrelay
node -e "console.log(require('./config/production.json'))"

# Check port availability
sudo ss -tunlp | grep :8443

# Verify SSL certificates
sudo openssl x509 -in /etc/letsencrypt/live/sync.yourdomain.com/fullchain.pem -text -noout

# Test with verbose logging
sudo su - syncrelay
cd /opt/syncrelay
NODE_ENV=production node dist/server.js
```

### Issue: Cannot Connect to Relay

**Symptoms:** Clients cannot establish WebSocket connection.

**Solutions:**

```bash
# Check firewall
sudo ufw status verbose

# Test WebSocket connection
wscat -c wss://sync.yourdomain.com

# Check DNS resolution
nslookup sync.yourdomain.com

# Verify SSL certificate is valid
openssl s_client -connect sync.yourdomain.com:443 -servername sync.yourdomain.com

# Check reverse proxy (if using nginx)
sudo nginx -t
sudo systemctl status nginx
```

### Issue: High Memory Usage

**Symptoms:** Relay consuming excessive RAM.

**Solutions:**

```bash
# Check memory usage
free -h
ps aux | grep node

# Reduce message queue size in config
# Edit /opt/syncrelay/config/production.json
# Set relay.messageQueueSize to lower value (e.g., 500)

# Restart relay
sudo systemctl restart syncrelay

# Monitor memory over time
watch -n 5 'ps -p $(pgrep -f "node dist/server.js") -o pid,vsz,rss,%mem,cmd'
```

### Issue: Messages Not Syncing

**Symptoms:** Devices connected but messages not forwarded.

**Solutions:**

```bash
# Check relay logs
sudo journalctl -u syncrelay -f | grep -i error

# Verify device authentication
# Check for auth errors in logs

# Test message flow
# Enable debug logging temporarily
# Edit config: logging.level = "debug"
sudo systemctl restart syncrelay

# Check rate limiting
# Look for rate limit violations in logs

# Verify HMAC signatures
# Ensure devices have correct signing keys
```

### Issue: SSL Certificate Errors

**Symptoms:** SSL/TLS handshake failures.

**Solutions:**

```bash
# Verify certificate chain
openssl s_client -connect sync.yourdomain.com:443 -showcerts

# Check certificate expiry
sudo certbot certificates

# Renew certificate
sudo certbot renew
sudo systemctl restart syncrelay

# Test with different SSL/TLS versions
openssl s_client -connect sync.yourdomain.com:443 -tls1_2
openssl s_client -connect sync.yourdomain.com:443 -tls1_3
```

---

## Performance Tuning

### OS-Level Optimizations

```bash
# Increase file descriptor limits
sudo nano /etc/security/limits.conf
```

Add:

```
syncrelay soft nofile 65536
syncrelay hard nofile 65536
```

```bash
# Increase kernel network buffers
sudo nano /etc/sysctl.conf
```

Add:

```
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000
```

Apply:

```bash
sudo sysctl -p
```

### Node.js Optimizations

```bash
# Increase heap size for high-traffic relays
# Edit systemd service file
sudo nano /etc/systemd/system/syncrelay.service
```

Update `ExecStart`:

```ini
ExecStart=/usr/bin/node --max-old-space-size=4096 dist/server.js
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart syncrelay
```

### WebSocket Tuning

Edit `/opt/syncrelay/config/production.json`:

```json
{
  "relay": {
    "heartbeatIntervalMs": 30000,
    "connectionTimeoutMs": 60000,
    "messageQueueSize": 2000,
    "messageRetentionMs": 600000
  }
}
```

### Load Balancing (High Traffic)

For high-traffic deployments, use multiple relay instances:

```
     ┌──────────────┐
     │ Load Balancer│
     │   (nginx)    │
     └───────┬──────┘
             │
      ┌──────┴──────┬──────────┐
      │             │          │
┌─────▼─────┐ ┌─────▼────┐ ┌──▼──────┐
│ Relay 1   │ │ Relay 2  │ │ Relay 3 │
│ :8443     │ │ :8444    │ │ :8445   │
└───────────┘ └──────────┘ └─────────┘
```

nginx configuration:

```nginx
upstream syncrelay {
    ip_hash;  # Sticky sessions
    server 127.0.0.1:8443;
    server 127.0.0.1:8444;
    server 127.0.0.1:8445;
}

server {
    listen 443 ssl http2;
    server_name sync.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/sync.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sync.yourdomain.com/privkey.pem;

    location / {
        proxy_pass https://syncrelay;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

---

## Backup & Recovery

### Backup Strategy

**What to Backup:**
- Configuration files (`/opt/syncrelay/config/`)
- SSL certificates (`/opt/syncrelay/ssl/` or `/etc/letsencrypt/`)
- Logs (optional, for forensics)

**What NOT to Backup:**
- Message queues (ephemeral, rebuilt on restart)
- Runtime data (temporary)

### Automated Backup Script

Create `/opt/syncrelay/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backup/syncrelay"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup configuration
tar czf "$BACKUP_DIR/config-$DATE.tar.gz" /opt/syncrelay/config/

# Backup SSL (if custom)
if [ -d "/opt/syncrelay/ssl" ]; then
    tar czf "$BACKUP_DIR/ssl-$DATE.tar.gz" /opt/syncrelay/ssl/
fi

# Keep only last 30 days
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Make executable and schedule:

```bash
sudo chmod +x /opt/syncrelay/backup.sh

# Add to cron (daily at 2 AM)
sudo crontab -e
```

Add:

```
0 2 * * * /opt/syncrelay/backup.sh >> /var/log/syncrelay/backup.log 2>&1
```

### Disaster Recovery

```bash
# Stop relay
sudo systemctl stop syncrelay

# Restore configuration
sudo tar xzf /backup/syncrelay/config-YYYYMMDD.tar.gz -C /

# Restore SSL (if needed)
sudo tar xzf /backup/syncrelay/ssl-YYYYMMDD.tar.gz -C /

# Fix permissions
sudo chown -R syncrelay:syncrelay /opt/syncrelay
sudo chmod 600 /opt/syncrelay/config/*.json
sudo chmod 600 /opt/syncrelay/ssl/*.pem

# Start relay
sudo systemctl start syncrelay
sudo systemctl status syncrelay
```

---

## Upgrade Procedures

### Minor Version Upgrades

```bash
# Stop relay
sudo systemctl stop syncrelay

# Backup current version
sudo su - syncrelay
cd /opt/syncrelay
cp -r /opt/syncrelay /opt/syncrelay.backup

# Pull latest code
git fetch origin
git checkout v1.x.x  # Replace with target version

# Update dependencies
npm install --production

# Rebuild
npm run build

# Start relay
exit
sudo systemctl start syncrelay

# Verify
sudo systemctl status syncrelay
sudo journalctl -u syncrelay -n 50
```

### Major Version Upgrades

1. Read release notes carefully
2. Test upgrade on staging server first
3. Backup all data
4. Schedule maintenance window
5. Follow minor version upgrade steps
6. Verify configuration compatibility
7. Test all functionality before announcing completion

### Rollback Procedure

```bash
# Stop relay
sudo systemctl stop syncrelay

# Restore backup
sudo rm -rf /opt/syncrelay
sudo mv /opt/syncrelay.backup /opt/syncrelay

# Start relay
sudo systemctl start syncrelay
sudo systemctl status syncrelay
```

---

## FAQ

### Q: Can the relay server read my data?

**A:** No. All data is end-to-end encrypted on your devices **before** it reaches the relay. The relay only sees encrypted payloads and has no access to your encryption keys.

### Q: How many devices can connect simultaneously?

**A:** Default limit is 5 devices per user and 1 connection per device. This can be configured in `relay.maxConnectionsPerUser` and `relay.maxConnectionsPerDevice`.

### Q: What happens if the relay goes down?

**A:** Your devices will automatically attempt to reconnect. Messages sent while offline are queued locally and will sync when the relay comes back online. No data is lost.

### Q: Can I run multiple relay servers for redundancy?

**A:** Yes, but devices must be configured to fail over to a secondary relay. High-availability setups are recommended for production use.

### Q: How much bandwidth does the relay use?

**A:** Minimal - the relay only forwards encrypted messages. Typical usage is <1 MB/day per active user.

### Q: Can I host this on shared hosting?

**A:** No. The relay requires WebSocket support, long-lived connections, and root access for SSL. Use a VPS, dedicated server, or cloud instance.

### Q: Is IPv6 supported?

**A:** Yes. The relay binds to `0.0.0.0` by default, which accepts both IPv4 and IPv6 connections.

### Q: Can I use a reverse proxy?

**A:** Yes. nginx and Caddy are both supported. Ensure WebSocket upgrade headers are properly forwarded.

### Q: How do I ban a user?

**A:** Currently manual via database. Future versions will include admin API for user management.

### Q: What ports need to be open?

**A:** Only port 443 (HTTPS/WSS) needs to be publicly accessible. Port 80 is optional for SSL certificate renewal.

---

## Support

### Community Support

- **GitHub Issues:** https://github.com/graceful-books/sync-relay/issues
- **Documentation:** https://docs.gracefulbooks.com
- **Discord:** https://discord.gg/gracefulbooks

### Commercial Support

For enterprise deployments and SLA-backed support:
- Email: enterprise@gracefulbooks.com
- Pricing: https://gracefulbooks.com/enterprise

---

## License

The Graceful Books Sync Relay is licensed under the **MIT License**.

Zero-knowledge encryption architecture is a core feature - you are free to audit the code to verify that the relay has no capability to decrypt your data.

---

## Changelog

### v1.0.0 (2026-03-30)
- Initial release
- WebSocket-based relay server
- Zero-knowledge message forwarding
- Rate limiting and DoS protection
- CRDT conflict resolution coordination
- Comprehensive monitoring and logging

---

**Questions?** File an issue at https://github.com/graceful-books/sync-relay/issues
