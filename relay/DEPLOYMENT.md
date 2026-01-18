# Deployment Guide - Graceful Books Sync Relay

## Prerequisites

1. **Cloudflare Account**
   - Free tier is sufficient for development
   - Pro/Business tier recommended for production
   - Workers Paid plan required for Durable Objects

2. **Required Tools**
   - Node.js 18+ installed
   - npm or yarn
   - Wrangler CLI: `npm install -g wrangler@latest`
   - Git (for version control)

3. **Domain Setup**
   - Custom domain configured in Cloudflare
   - DNS pointing to Cloudflare nameservers
   - SSL/TLS certificates (automatic with Cloudflare)

## Initial Setup

### 1. Install Wrangler

```bash
npm install -g wrangler@latest
wrangler --version
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate.

### 3. Clone and Install

```bash
cd relay
npm install
```

## Database Setup

### Option A: Cloudflare D1 (Recommended)

```bash
# Create database
wrangler d1 create graceful-books-sync

# Output will include database ID - copy it!
# Update wrangler.toml with the database_id

# Initialize schema
wrangler d1 execute graceful-books-sync --local --file=./src/database.ts
```

### Option B: Turso (Alternative)

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create graceful-books-sync

# Get connection details
turso db show graceful-books-sync

# Add to .dev.vars
echo "TURSO_DATABASE_URL=libsql://..." >> .dev.vars
echo "TURSO_AUTH_TOKEN=..." >> .dev.vars
```

## KV Namespace Setup

```bash
# Create production KV namespace
wrangler kv:namespace create "RATE_LIMIT"
# Copy the ID output

# Create preview KV namespace
wrangler kv:namespace create "RATE_LIMIT" --preview
# Copy the preview_id output

# Update wrangler.toml with both IDs
```

## Environment Configuration

### Development (.dev.vars)

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```env
# Database (if using Turso)
TURSO_DATABASE_URL=libsql://graceful-books-sync-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGc...

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=60
MAX_PAYLOAD_SIZE_MB=10

# WebSocket Settings
WS_PING_INTERVAL_MS=30000
WS_TIMEOUT_MS=60000

# SLA Tracking
SLA_TARGET_UPTIME=0.999
SLA_ALERT_WEBHOOK=https://your-webhook-url.com/alerts
```

### Production Secrets

Set production secrets via Wrangler:

```bash
# Turso credentials (if using)
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN

# Alert webhook
wrangler secret put SLA_ALERT_WEBHOOK
```

## DNS Configuration

### Configure Routes in Cloudflare

1. Go to Cloudflare Dashboard
2. Select your domain (gracefulbooks.com)
3. Navigate to Workers & Pages > Overview
4. Add routes for each region:

```
sync.gracefulbooks.com/*           → graceful-books-sync-relay
sync-us.gracefulbooks.com/*        → graceful-books-sync-relay
sync-eu.gracefulbooks.com/*        → graceful-books-sync-relay
sync-ap.gracefulbooks.com/*        → graceful-books-sync-relay
```

### Alternative: Update wrangler.toml

Routes are already configured in `wrangler.toml`:

```toml
[env.production]
routes = [
  { pattern = "sync.gracefulbooks.com/*", zone_name = "gracefulbooks.com" },
  { pattern = "sync-us.gracefulbooks.com/*", zone_name = "gracefulbooks.com" },
  { pattern = "sync-eu.gracefulbooks.com/*", zone_name = "gracefulbooks.com" },
  { pattern = "sync-ap.gracefulbooks.com/*", zone_name = "gracefulbooks.com" }
]
```

## Deployment Process

### Development Deployment

```bash
# Test locally first
npm run dev

# Visit http://localhost:8787/health to verify

# Deploy to development environment
wrangler deploy --env dev
```

### Staging Deployment

```bash
# Build and test
npm run build
npm test

# Deploy to staging
npm run deploy:staging

# Verify staging
curl https://sync-staging.gracefulbooks.com/health
```

### Production Deployment

```bash
# Final tests
npm test
npm run lint
npm run type-check

# Deploy to production
npm run deploy:production

# Verify all regions
curl https://sync-us.gracefulbooks.com/health
curl https://sync-eu.gracefulbooks.com/health
curl https://sync-ap.gracefulbooks.com/health
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check all regions
for region in us eu ap; do
  echo "Checking sync-$region..."
  curl https://sync-$region.gracefulbooks.com/health | jq
done
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "region": "us",
  "version": "1.0.0",
  "database": {
    "status": "ok",
    "latency_ms": 10.5
  },
  "uptime_seconds": 3600
}
```

### 2. Test Push Operation

```bash
curl -X POST https://sync-us.gracefulbooks.com/sync/push \
  -H "Content-Type: application/json" \
  -d '{
    "protocol_version": "1.0.0",
    "device_id": "test-device",
    "timestamp": 1234567890,
    "changes": []
  }'
```

### 3. Test Pull Operation

```bash
curl -X POST https://sync-us.gracefulbooks.com/sync/pull \
  -H "Content-Type: application/json" \
  -d '{
    "protocol_version": "1.0.0",
    "device_id": "test-device",
    "since_timestamp": 0,
    "sync_vector": {}
  }'
```

### 4. Check SLA Metrics

```bash
curl https://sync-us.gracefulbooks.com/metrics/sla | jq
```

## Monitoring Setup

### 1. Cloudflare Analytics

1. Go to Workers & Pages > graceful-books-sync-relay
2. Click "Metrics" tab
3. Enable Analytics Engine
4. Configure alerts for:
   - Error rate > 1%
   - Response time > 1000ms
   - Request volume spikes

### 2. External Monitoring

Set up external health checks with tools like:

- **UptimeRobot**: Free, simple uptime monitoring
- **Pingdom**: Comprehensive monitoring
- **Datadog**: Advanced APM
- **Better Uptime**: Developer-friendly

Example UptimeRobot configuration:
- Monitor Type: HTTPS
- URL: https://sync-us.gracefulbooks.com/health
- Interval: 5 minutes
- Alert Contacts: your-email@example.com

### 3. Custom Alerts

Configure SLA alert webhook in production:

```bash
wrangler secret put SLA_ALERT_WEBHOOK
# Enter: https://your-slack-webhook-url.com/alerts
```

## Scaling Considerations

### Geographic Distribution

Cloudflare Workers automatically run on all edge locations. To optimize:

1. **Smart Routing**: Enable Cloudflare Argo for intelligent routing
2. **Load Balancing**: Use Cloudflare Load Balancer for region failover
3. **Geo-Steering**: Route users to nearest region based on IP

### Database Scaling

#### D1 Limits (per database):
- Storage: 5 GB (free), 10 GB (Workers Paid)
- Read queries: 25 million/day (free), unlimited (paid)
- Write queries: 100,000/day (free), unlimited (paid)

#### Turso Scaling:
- Replicas: Add read replicas in different regions
- Automatic scaling based on load
- No row or size limits on paid plans

### Rate Limiting

Adjust based on usage patterns:

```toml
# wrangler.toml
[env.production]
vars = {
  MAX_REQUESTS_PER_MINUTE = "120",  # Increased for production
  MAX_PAYLOAD_SIZE_MB = "20"        # Increased for production
}
```

## Troubleshooting

### Deployment Fails

```bash
# Check authentication
wrangler whoami

# Verify wrangler.toml syntax
wrangler deploy --dry-run

# Check logs
wrangler tail --env production
```

### Database Connection Issues

```bash
# Test D1 connection
wrangler d1 execute graceful-books-sync --command "SELECT 1"

# Check database bindings in wrangler.toml
# Verify database_id matches created database
```

### WebSocket Not Connecting

1. Verify Durable Objects are enabled:
   ```bash
   wrangler deployments list
   ```

2. Check migration status in wrangler.toml:
   ```toml
   [[migrations]]
   tag = "v1"
   new_classes = ["SyncSession"]
   ```

3. Test WebSocket endpoint:
   ```bash
   wscat -c "wss://sync-us.gracefulbooks.com/ws?device_id=test"
   ```

### Performance Issues

1. **Check Analytics**:
   - Cloudflare Dashboard > Workers > Metrics
   - Look for CPU time usage (max 50ms)
   - Check subrequest counts

2. **Optimize Database Queries**:
   ```bash
   # Enable query logging
   wrangler d1 execute graceful-books-sync --command "PRAGMA query_only = ON"
   ```

3. **Review Cache Headers**:
   - Ensure proper cache control
   - Use Cloudflare Cache API for static responses

## Rollback Procedure

### Quick Rollback

```bash
# List recent deployments
wrangler deployments list --env production

# Rollback to previous version
wrangler rollback --env production --version-id <previous-version-id>
```

### Manual Rollback

```bash
# Checkout previous version
git log --oneline
git checkout <previous-commit>

# Deploy
npm run deploy:production

# Return to latest
git checkout main
```

## Security Checklist

- [ ] All secrets stored in Wrangler secrets (not in code)
- [ ] Rate limiting enabled and tested
- [ ] HTTPS enforced (no HTTP endpoints)
- [ ] CORS properly configured
- [ ] Database encryption verified
- [ ] Audit logging enabled
- [ ] Error messages don't leak sensitive info
- [ ] Dependencies up to date (npm audit)

## Maintenance

### Regular Tasks

**Weekly:**
- Review error logs
- Check SLA metrics
- Verify all regions healthy

**Monthly:**
- Update dependencies: `npm update`
- Review rate limit settings
- Clean up old test data

**Quarterly:**
- Security audit
- Performance review
- Capacity planning

### Database Maintenance

```bash
# Cleanup old changes (automatic via scheduled cron)
# Manually trigger if needed:
wrangler publish --env production --cron "0 2 * * *"

# Verify cleanup
wrangler d1 execute graceful-books-sync --command \
  "SELECT COUNT(*) FROM sync_changes WHERE created_at < strftime('%s', 'now') - 2592000"
```

## Support

- **Documentation**: https://docs.gracefulbooks.com/sync-relay
- **Status Page**: https://status.gracefulbooks.com
- **GitHub Issues**: https://github.com/gracefulbooks/graceful-books/issues
- **Cloudflare Docs**: https://developers.cloudflare.com/workers/

## Changelog

### v1.0.0 (2024-01-15)
- Initial production release
- Support for US, EU, AP regions
- Zero-knowledge encryption
- WebSocket notifications
- SLA monitoring
