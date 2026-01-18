# Troubleshooting Guide

Common issues and solutions for self-hosted Graceful Books sync relay.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Connection Issues](#connection-issues)
4. [Sync Issues](#sync-issues)
5. [Performance Issues](#performance-issues)
6. [Database Issues](#database-issues)
7. [Docker Issues](#docker-issues)
8. [HTTPS/SSL Issues](#httpsssl-issues)
9. [Logs and Debugging](#logs-and-debugging)

## Quick Diagnostics

Run these checks first:

```bash
# 1. Is relay running?
curl http://localhost:8787/health
# Expected: {"status":"ok",...}

# 2. Check relay version
curl http://localhost:8787/version
# Expected: {"version":"1.0.0",...}

# 3. Check Docker status (if using Docker)
docker ps | grep graceful-books-sync
# Expected: Container should be "Up"

# 4. Check logs for errors
docker logs graceful-books-sync --tail 50
# Look for ERROR or WARNING lines
```

If all pass: relay is healthy. Problem is likely client-side or network.

## Installation Issues

### "Permission denied" when running binary

**Symptom:**
```
bash: ./graceful-books-sync-linux-x64: Permission denied
```

**Cause:** Binary is not executable

**Fix:**
```bash
chmod +x graceful-books-sync-linux-x64
./graceful-books-sync-linux-x64
```

---

### "Port 8787 already in use"

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::8787
```

**Cause:** Another process is using port 8787

**Fix:**

Find what's using the port:
```bash
# Linux/Mac
lsof -i :8787

# Windows
netstat -ano | findstr :8787
```

Then either:
- Stop the other process, or
- Change relay port: `PORT=8788` in `.env`

---

### "Cannot find module" errors

**Symptom:**
```
Error: Cannot find module 'hono'
```

**Cause:** Dependencies not installed

**Fix:**
```bash
cd relay
npm ci
npm run build
npm start
```

---

### "EACCES: permission denied" on database

**Symptom:**
```
Error: EACCES: permission denied, open '/app/data/sync.db'
```

**Cause:** Database path is not writable

**Fix (Docker):**
```bash
# Ensure volume has correct permissions
docker exec graceful-books-sync chown -R gracefulbooks:gracefulbooks /app/data
```

**Fix (Standalone):**
```bash
# Create data directory with correct permissions
mkdir -p ./data
chmod 755 ./data
```

---

## Connection Issues

### Clients can't connect to relay

**Symptom:** Client shows "Connection failed" or "Cannot reach sync server"

**Diagnosis:**

1. **From client machine**, test connection:
   ```bash
   curl https://your-relay.example.com/health
   ```

2. If fails, check:
   - DNS resolution: `nslookup your-relay.example.com`
   - Network connectivity: `ping your-relay.example.com`
   - Firewall rules: Port 8787 open?
   - Server is running: `docker ps` or `systemctl status graceful-books-sync`

**Common causes:**

**Firewall blocking:**
```bash
# Linux (ufw)
sudo ufw allow 8787/tcp

# Linux (firewalld)
sudo firewall-cmd --permanent --add-port=8787/tcp
sudo firewall-cmd --reload

# Windows
netsh advfirewall firewall add rule name="Graceful Books Sync" dir=in action=allow protocol=TCP localport=8787
```

**Wrong URL:**
- Ensure using `https://` (not `http://`) if SSL configured
- Check for typos in domain name
- Verify port if non-standard

**DNS not propagated:**
- Wait 24-48 hours for DNS changes
- Use IP address temporarily: `https://203.0.113.1:8787`

---

### "SSL certificate error"

**Symptom:**
```
Error: unable to verify the first certificate
Error: certificate has expired
```

**Cause:** Invalid SSL certificate

**Diagnosis:**
```bash
curl -v https://your-relay.example.com/health
# Look for "SSL certificate verify" messages
```

**Fix:**

For Let's Encrypt certificates:
```bash
# Renew certificate
certbot renew

# Restart reverse proxy
systemctl restart nginx
```

For self-signed certificates (development only):
```bash
# Generate new certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

---

### WebSocket connection fails

**Symptom:** Client connects but real-time sync doesn't work

**Diagnosis:**
```bash
# Test WebSocket from command line
wscat -c wss://your-relay.example.com/ws?device_id=test

# Should see connection message
```

**Common causes:**

**Reverse proxy not configured for WebSockets:**

Nginx - add to config:
```nginx
location /ws {
    proxy_pass http://localhost:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

Apache - enable required modules:
```bash
a2enmod proxy_wstunnel
a2enmod proxy_http
```

---

## Sync Issues

### Changes not syncing between devices

**Diagnosis:**

1. Check sync status on each device: Settings > Sync
   - "Last synced" should be recent
   - Server URL should match your relay

2. Check relay logs for sync activity:
   ```bash
   docker logs graceful-books-sync --tail 100 | grep "Sync"
   ```

3. Manually trigger sync: Settings > Sync > Sync Now

**Common causes:**

**Devices on different relays:**
- Verify all devices use same relay URL
- If migrating, ensure all devices switched

**Network issues:**
- Check internet connectivity
- Verify firewall not blocking

**Rate limiting:**
- Check logs for "Rate limit exceeded"
- Increase: `MAX_REQUESTS_PER_MINUTE=120`

---

### "Sync conflict detected"

**Symptom:** Client shows conflict message

**Cause:** Same data modified on multiple devices while offline

**Fix:**
1. Client shows conflict resolution UI
2. Choose which version to keep
3. Sync again

**Prevention:**
- Sync frequently
- Avoid editing same transaction on multiple devices simultaneously

---

### "Protocol version mismatch"

**Symptom:**
```
Error: Protocol version mismatch. Client: 1.0.0, Server: 1.1.0
```

**Cause:** Client and relay have incompatible versions

**Fix:**
- Update client to latest version, or
- Update relay to match client version
- See [Version Compatibility Matrix](./VERSION_COMPATIBILITY.md)

---

## Performance Issues

### Slow sync times

**Symptom:** Sync takes >30 seconds

**Diagnosis:**

1. Check database latency:
   ```bash
   curl http://localhost:8787/health | jq '.database.latency_ms'
   # Should be <10ms
   ```

2. Check database size:
   ```bash
   du -h /path/to/sync.db
   # Typical: 10-100MB
   ```

3. Check disk I/O:
   ```bash
   iostat -x 1
   # %util should be <80%
   ```

**Common causes:**

**Database too large:**
- Reduce retention: `DB_CLEANUP_DAYS=14`
- Manually vacuum:
  ```bash
  sqlite3 /path/to/sync.db "VACUUM;"
  ```

**Slow disk:**
- Move database to SSD
- Use local volume instead of network mount

**Resource constraints:**
- Increase RAM: Edit docker-compose.yml limits
- Add CPU cores

---

### High memory usage

**Symptom:** Relay using >1GB RAM

**Diagnosis:**
```bash
# Docker
docker stats graceful-books-sync

# Linux
ps aux | grep graceful-books-sync
```

**Common causes:**

**Too many active WebSocket connections:**
- Reduce: `WS_MAX_CONNECTIONS=500`
- Check active connections:
  ```bash
  curl http://localhost:8787/metrics/sla | jq '.websocket_metrics.active_connections'
  ```

**Large payloads:**
- Reduce: `MAX_PAYLOAD_SIZE_MB=5`

**Memory leak (rare):**
- Restart relay
- Update to latest version

---

### Rate limit errors

**Symptom:**
```
Error: Rate limit exceeded. Try again in 37 seconds.
```

**Diagnosis:**
```bash
curl http://localhost:8787/metrics/sla | jq '.failed_requests'
# High number indicates rate limiting
```

**Fix:**

Increase rate limit:
```bash
# .env
MAX_REQUESTS_PER_MINUTE=120
```

Or disable (not recommended):
```bash
RATE_LIMIT_ENABLED=false
```

---

## Database Issues

### "Database is locked"

**Symptom:**
```
Error: SQLITE_BUSY: database is locked
```

**Cause:** Multiple processes trying to write simultaneously

**Fix:**

Ensure only one relay process is running:
```bash
# Stop all instances
docker stop graceful-books-sync
killall graceful-books-sync

# Start one instance
docker-compose up -d
```

---

### Database corruption

**Symptom:**
```
Error: database disk image is malformed
```

**Diagnosis:**
```bash
sqlite3 /path/to/sync.db "PRAGMA integrity_check;"
# Should return "ok"
```

**Fix:**

1. **Stop relay**
   ```bash
   docker-compose stop
   ```

2. **Backup corrupted database**
   ```bash
   cp sync.db sync.db.corrupted
   ```

3. **Try recovery**
   ```bash
   sqlite3 sync.db ".recover" | sqlite3 sync.db.recovered
   mv sync.db.recovered sync.db
   ```

4. **If recovery fails, restore from backup**
   ```bash
   cp /path/to/backups/sync-20240115.db sync.db
   ```

5. **Start relay**
   ```bash
   docker-compose up -d
   ```

---

### Database won't cleanup old records

**Symptom:** Database size keeps growing

**Diagnosis:**
```bash
# Check old record count
sqlite3 /path/to/sync.db "SELECT COUNT(*) FROM sync_changes WHERE created_at < strftime('%s', 'now') - 2592000;"
# Should be near 0
```

**Fix:**

Manually trigger cleanup:
```bash
docker exec graceful-books-sync node /app/scripts/cleanup.js
```

Or restart to trigger scheduled cleanup.

---

## Docker Issues

### Container won't start

**Symptom:**
```
docker-compose up -d
# Container immediately exits
```

**Diagnosis:**
```bash
docker-compose logs graceful-books-sync
# Check for error messages
```

**Common causes:**

**Port conflict:**
```bash
# Change port in docker-compose.yml
ports:
  - "8788:8787"  # Host:Container
```

**Volume permissions:**
```bash
# Fix permissions
sudo chown -R 1001:1001 ./data
```

**Invalid configuration:**
- Check `.env` file for syntax errors
- Verify all required variables set

---

### "Image not found"

**Symptom:**
```
Error response from daemon: pull access denied for gracefulbooks/sync-relay
```

**Cause:** Image not published yet or wrong name

**Fix:**

Build locally:
```bash
cd relay
docker build -t gracefulbooks/sync-relay:latest .
```

Or use different image name in docker-compose.yml.

---

### Cannot access volumes

**Symptom:** Data lost after restart

**Cause:** Anonymous volumes instead of named volumes

**Fix:**

Use named volumes in docker-compose.yml:
```yaml
volumes:
  sync-data:
    driver: local

services:
  sync-relay:
    volumes:
      - sync-data:/app/data
```

---

## HTTPS/SSL Issues

### Certificate errors with Let's Encrypt

**Symptom:** Certificate validation fails

**Diagnosis:**
```bash
certbot certificates
# Check expiry dates
```

**Fix:**

Renew certificate:
```bash
certbot renew
systemctl restart nginx
```

Auto-renewal (recommended):
```bash
# Add to crontab
0 0 1 * * certbot renew --quiet && systemctl reload nginx
```

---

### Mixed content warnings

**Symptom:** Browser shows "Mixed content" error

**Cause:** Trying to load HTTPS page with HTTP resources

**Fix:**

Ensure reverse proxy forces HTTPS:
```nginx
server {
    listen 80;
    server_name your-relay.example.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Logs and Debugging

### Enable debug logging

Set log level to debug:

```bash
# .env
LOG_LEVEL=debug
```

Restart relay:
```bash
docker-compose restart
```

View logs:
```bash
docker logs graceful-books-sync -f
```

---

### Common log messages

**INFO messages (normal):**
```
[INFO] Server started on port 8787
[INFO] Sync push received from device-abc (5 changes)
[INFO] Sync pull request from device-xyz (since 1705507200)
[INFO] WebSocket connection established for device-abc
```

**WARNING messages (investigate):**
```
[WARN] Database latency high: 150ms
[WARN] Rate limit exceeded for IP 203.0.113.1
[WARN] WebSocket ping timeout for device-xyz
```

**ERROR messages (action required):**
```
[ERROR] Database connection failed: ENOENT
[ERROR] Invalid sync protocol version: 0.9.0
[ERROR] Payload too large: 15.2MB (limit: 10MB)
```

---

### Export logs for support

```bash
# Export last 1000 lines
docker logs graceful-books-sync --tail 1000 > relay-logs.txt

# Include health status
curl http://localhost:8787/health > health-status.json

# Include metrics
curl http://localhost:8787/metrics/sla > sla-metrics.json

# Create archive
tar -czf graceful-books-debug-$(date +%Y%m%d).tar.gz relay-logs.txt health-status.json sla-metrics.json
```

---

## Getting Help

If you can't resolve the issue:

1. **Search existing issues:** https://github.com/gracefulbooks/graceful-books/issues

2. **Create new issue with:**
   - Relay version (`curl http://localhost:8787/version`)
   - Installation method (Docker, binary, source)
   - Operating system
   - Error messages (from logs)
   - Steps to reproduce

3. **Community forum:** https://community.gracefulbooks.com

4. **Documentation:** https://docs.gracefulbooks.com/self-hosted

## Preventive Maintenance

Avoid issues with regular maintenance:

**Daily:**
- Monitor health endpoint
- Check disk space

**Weekly:**
- Review logs for warnings
- Verify backups

**Monthly:**
- Update relay to latest version
- Review SLA metrics
- Rotate logs

**Quarterly:**
- Security audit
- Performance review
- Capacity planning
