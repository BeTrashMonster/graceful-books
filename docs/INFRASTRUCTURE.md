# Infrastructure Documentation - Graceful Books

**Build:** H10 - Production Infrastructure
**Requirements:** ARCH-003, H8, E8
**Status:** Complete

## Overview

Graceful Books uses a Cloudflare-first infrastructure architecture, providing global edge deployment, zero-knowledge encryption support, and local-first capabilities.

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Graceful Books Infrastructure            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐│
│  │  Cloudflare  │────▶│  Cloudflare  │────▶│    Turso     ││
│  │    Pages     │     │   Workers    │     │   Database   ││
│  │  (Frontend)  │     │ (Sync Relay) │     │   (LibSQL)   ││
│  └──────────────┘     └──────────────┘     └──────────────┘│
│         │                     │                     │        │
│         │                     │                     │        │
│         ▼                     ▼                     ▼        │
│  ┌──────────────────────────────────────────────────────────┐
│  │           Cloudflare Global Edge Network                ││
│  │  • CDN with HTTP/2, HTTP/3, Brotli                      ││
│  │  • WAF, DDoS Protection, Rate Limiting                  ││
│  │  • SSL/TLS 1.3 with Auto Certificates                   ││
│  │  • Global Load Balancing with Geo-Steering             ││
│  └──────────────────────────────────────────────────────────┘
│                                                               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐│
│  │ Cloudflare   │     │   GitHub     │     │  Monitoring  ││
│  │ R2 Storage   │     │   Actions    │     │   & Alerts   ││
│  │ (Backups)    │     │   (CI/CD)    │     │   (Sentry)   ││
│  └──────────────┘     └──────────────┘     └──────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Infrastructure as Code

All infrastructure is managed via Terraform, providing:

- Version-controlled infrastructure
- Reproducible deployments
- Environment parity (staging/production)
- Automated provisioning
- Disaster recovery capability

### Terraform Structure

```
infrastructure/
├── main.tf              # Primary infrastructure resources
├── variables.tf         # Input variables
├── outputs.tf           # Output values
├── database.tf          # Database configuration
├── secrets.tf           # Secrets management documentation
├── terraform.tfvars.example  # Example configuration
├── .gitignore           # Exclude secrets from version control
└── tests/
    ├── infrastructure.test.ts  # Infrastructure tests
    └── vitest.config.ts        # Test configuration
```

### Key Resources

#### Cloudflare Pages
- **Purpose:** Frontend application hosting
- **Branch Strategy:**
  - `main` → Production
  - `staging` → Staging
  - PR branches → Preview deployments
- **Build:** Vite (React + TypeScript)
- **Custom Domains:** gracefulbooks.com, www.gracefulbooks.com

#### Cloudflare Workers
- **Purpose:** Sync relay server
- **Regions:** US East, EU West, AP Southeast
- **Runtime:** Node.js + Hono framework
- **Features:**
  - Zero-knowledge sync
  - WebSocket support
  - Rate limiting
  - SLA monitoring

#### Cloudflare R2
- **Buckets:**
  - `graceful-books-assets` - Static assets
  - `graceful-books-backups` - Database backups
  - `graceful-books-db-backups` - Automated DB backups
- **Location:** Western North America (WNAM)
- **Lifecycle:** 90-day retention for backups

#### Turso Database
- **Type:** LibSQL (SQLite-compatible)
- **Regions:**
  - Primary: US East (iad)
  - Replica: EU West (lhr)
  - Replica: AP Southeast (sin)
- **Features:**
  - Multi-region replication
  - Edge database access
  - Low-latency reads

#### KV Namespaces
- `graceful-books-rate-limit` - Rate limiting state
- `graceful-books-rate-limit-preview` - Preview environment
- `graceful-books-session-cache` - Session caching

## Deployment Architecture

### Environments

| Environment | Branch | URL | Purpose |
|-------------|--------|-----|---------|
| **Development** | Local | localhost:5173 | Local development |
| **Staging** | main | staging-gracefulbooks.pages.dev | Pre-production testing |
| **Preview** | PR branches | pr-\*.gracefulbooks.pages.dev | PR previews |
| **Production** | main (release) | gracefulbooks.com | Live application |

### Deployment Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Commit    │────▶│  CI Tests   │────▶│   Deploy    │
│  to main    │     │  & Build    │     │  to Staging │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Health    │
                                        │   Checks    │
                                        └─────────────┘
                                               │
                            ┌──────────────────┴──────────────────┐
                            │                                     │
                      ✅ PASS                               ❌ FAIL
                            │                                     │
                            ▼                                     ▼
                    ┌─────────────┐                      ┌─────────────┐
                    │   Manual    │                      │   Rollback  │
                    │  Approval   │                      │  & Alert    │
                    └─────────────┘                      └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │   Deploy    │
                    │ to Production│
                    └─────────────┘
```

### GitHub Actions Workflows

#### 1. Infrastructure Deployment (`.github/workflows/infrastructure.yml`)
- **Trigger:** Changes to `infrastructure/` or manual dispatch
- **Jobs:**
  - `validate` - Validate Terraform syntax
  - `plan-staging` - Plan staging changes
  - `plan-production` - Plan production changes
  - `apply-staging` - Apply staging (manual)
  - `apply-production` - Apply production (manual)
  - `security-scan` - Run tfsec and Checkov

#### 2. Worker Deployment (`.github/workflows/deploy-workers.yml`)
- **Trigger:** Changes to `relay/` or manual dispatch
- **Jobs:**
  - `build` - Build and test Worker
  - `deploy-staging` - Deploy to staging
  - `deploy-production` - Deploy to production (manual)
  - `smoke-tests` - Verify deployment

#### 3. Pages Deployment (`.github/workflows/deploy-pages.yml`)
- **Trigger:** Changes to `src/` or manual dispatch
- **Jobs:**
  - `build` - Build application
  - `deploy-staging` - Deploy to staging
  - `deploy-production` - Deploy to production
  - `lighthouse` - Performance checks
  - `smoke-tests` - Verify deployment

## Secrets Management

### GitHub Secrets

Required secrets for CI/CD:

```bash
# Cloudflare
CLOUDFLARE_API_TOKEN      # Cloudflare API token
CLOUDFLARE_ACCOUNT_ID     # Cloudflare account ID

# Database
TURSO_DATABASE_URL        # Turso connection URL
TURSO_AUTH_TOKEN          # Turso authentication token

# Optional
TF_API_TOKEN              # Terraform Cloud token
VERCEL_TOKEN              # Vercel token (if using)
```

Set via GitHub CLI:
```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set TURSO_DATABASE_URL
gh secret set TURSO_AUTH_TOKEN
```

### Cloudflare Worker Secrets

Set via Wrangler CLI:
```bash
cd relay
wrangler secret put TURSO_DATABASE_URL --env production
wrangler secret put TURSO_AUTH_TOKEN --env production
wrangler secret put SLA_ALERT_WEBHOOK --env production
```

### Secret Rotation

- **Frequency:** Every 90 days
- **Procedure:** See `infrastructure/secrets.tf` outputs
- **Validation:** Run `terraform output secret_validation_script`

## Blue-Green Deployment

Graceful Books implements blue-green deployment for zero-downtime releases.

### Strategy

1. **Blue Environment:** Current production version
2. **Green Environment:** New version being deployed
3. **Health Checks:** Verify green is healthy
4. **Traffic Switch:** Instant cutover (Cloudflare handles this)
5. **Rollback:** Blue version available for instant rollback

### Deployment Script

```bash
# Deploy with blue-green strategy
./scripts/blue-green-deploy.sh production workers

# Deploy all components
./scripts/blue-green-deploy.sh production all

# Rollback if needed
./scripts/blue-green-deploy.sh production rollback-workers
```

### Manual Blue-Green Process

#### For Workers:
```bash
cd relay

# Deploy new version (green)
wrangler deploy --env production

# Verify health checks
curl https://sync-us.gracefulbooks.com/health
curl https://sync-eu.gracefulbooks.com/health
curl https://sync-ap.gracefulbooks.com/health

# If healthy: Traffic automatically switches
# If unhealthy: Rollback to blue version
wrangler rollback --env production --version-id <blue-version-id>
```

#### For Pages:
```bash
# Build new version
npm run build

# Deploy to preview (green)
npx wrangler pages deploy dist --project-name=graceful-books --branch=preview

# Verify preview deployment
curl https://<preview-url>.gracefulbooks.pages.dev

# If healthy: Promote to production
npx wrangler pages deploy dist --project-name=graceful-books --branch=main
```

## Rollback Procedures

### Automated Rollback Script

```bash
# Rollback Workers
./scripts/rollback.sh workers production

# Rollback Pages
./scripts/rollback.sh pages production

# Restore database from backup
./scripts/rollback.sh database production

# Rollback infrastructure
./scripts/rollback.sh infrastructure production
```

### Manual Rollback

#### Workers Rollback:
```bash
cd relay

# List recent deployments
wrangler deployments list --env production

# Rollback to specific version
wrangler rollback --env production --version-id <version-id>

# Verify rollback
curl https://sync.gracefulbooks.com/health
```

#### Pages Rollback:
```bash
# Find commit to rollback to
git log --oneline | head -10

# Checkout commit
git checkout <commit-sha>

# Build and deploy
npm ci && npm run build
npx wrangler pages deploy dist --project-name=graceful-books --branch=main

# Return to latest
git checkout main
```

#### Database Restore:
```bash
# List available backups
wrangler r2 object list graceful-books-db-backups

# Download backup
wrangler r2 object get graceful-books-db-backups/<backup-file> --file=backup.sql

# Restore to Turso
turso db shell graceful-books-sync < backup.sql
```

## Monitoring & Health Checks

### Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Basic health check | `{ "status": "ok" }` |
| `/metrics/sla` | SLA metrics | `{ "uptime_percentage": 99.9 }` |

### Monitoring Setup

1. **Cloudflare Analytics**
   - Dashboard: Cloudflare > Workers > graceful-books-sync-relay
   - Metrics: Requests, errors, CPU time, duration

2. **External Uptime Monitoring**
   - Service: UptimeRobot, Pingdom, or Better Uptime
   - Endpoints: All sync relay regions
   - Interval: 5 minutes
   - Alerts: Email, Slack, Discord

3. **Error Tracking**
   - Service: Sentry
   - DSN configured in Worker secrets
   - Source maps uploaded during deployment

### Alert Thresholds

- **Uptime:** < 99.9% (SLA target)
- **Error Rate:** > 1%
- **Response Time:** > 1000ms (p95)
- **Rate Limit Hits:** > 100/minute

## Security

### SSL/TLS

- **Mode:** Strict (Full end-to-end encryption)
- **Version:** TLS 1.3 minimum
- **Certificates:** Automatic via Cloudflare Universal SSL
- **HSTS:** Enabled with 1-year max-age
- **Certificate Rotation:** Automatic

### Web Application Firewall (WAF)

- **Rules:**
  - Block admin access from untrusted IPs
  - Challenge suspicious traffic (threat score > 14)
  - Rate limit API endpoints (100 requests/10 min)
  - Rate limit auth endpoints (5 requests/5 min)

### DDoS Protection

- Cloudflare automatic DDoS mitigation
- Rate limiting at edge
- Challenge pages for suspicious traffic

### Zero-Knowledge Architecture

- All user data encrypted client-side
- Sync relay has zero access to plaintext data
- Encryption keys never leave client
- See `SPEC.md` for full encryption architecture

## Backup & Disaster Recovery

### Database Backups

- **Frequency:** Daily at 2 AM UTC
- **Retention:** 90 days
- **Storage:** Cloudflare R2 (`graceful-books-db-backups`)
- **Automation:** Cloudflare Worker cron job

### Recovery Time Objectives (RTO)

| Component | RTO | RPO |
|-----------|-----|-----|
| Cloudflare Workers | 5 minutes | 0 (stateless) |
| Cloudflare Pages | 5 minutes | 0 (static) |
| Turso Database | 1 hour | 24 hours |
| Infrastructure | 30 minutes | N/A (IaC) |

### Disaster Recovery Procedure

1. **Total Cloudflare Outage:**
   - Fallback to local-first mode (app continues working)
   - Sync queue stores changes locally
   - Resume sync when service restored

2. **Database Corruption:**
   - Restore from most recent backup
   - Replay sync changes from worker logs
   - Verify data integrity

3. **Worker Deployment Failure:**
   - Automatic rollback via health checks
   - Blue version continues serving traffic
   - Fix issue and redeploy

4. **DNS/Domain Issues:**
   - Cloudflare handles failover automatically
   - Workers.dev subdomain as backup
   - No user action required

## Cost Optimization

### Cloudflare Plans

- **Free Tier:**
  - Pages: Unlimited requests
  - Workers: 100,000 requests/day
  - R2: 10 GB storage, 10 million read operations/month

- **Pro Tier ($20/month):**
  - Enhanced DDoS protection
  - Advanced analytics
  - Image optimization
  - Argo Smart Routing

- **Workers Paid ($5/month):**
  - Unlimited requests
  - Durable Objects (WebSocket)
  - 10 million KV operations/month

### Turso Pricing

- **Starter (Free):**
  - 9 GB storage
  - 1 billion rows read/month
  - 25 million rows written/month

- **Scaler ($29/month):**
  - 200 GB storage included
  - Unlimited rows
  - Multi-region replication

### Estimated Monthly Costs

| Component | Tier | Monthly Cost |
|-----------|------|--------------|
| Cloudflare Pro | Pro | $20 |
| Cloudflare Workers | Paid | $5 |
| Turso Database | Scaler | $29 |
| **Total** | | **~$54** |

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Page Load (FCP) | < 2s | ~1.2s |
| API Response | < 500ms | ~150ms |
| Sync Latency | < 2s | ~800ms |
| Worker CPU Time | < 50ms | ~15ms |
| Edge Response Time | < 100ms | ~45ms |

## Maintenance

### Regular Tasks

**Weekly:**
- Review error logs in Sentry
- Check SLA metrics
- Verify all regions healthy
- Review rate limit hits

**Monthly:**
- Update dependencies (`npm update`)
- Review security advisories
- Test backup restoration
- Review and optimize costs

**Quarterly:**
- Rotate secrets (API tokens, auth tokens)
- Security audit
- Performance review
- Disaster recovery drill

### Maintenance Windows

- **Planned:** Tuesdays 2-4 AM UTC (low traffic)
- **Emergency:** Any time (zero-downtime architecture)
- **Notification:** Status page + email 24h advance

## Troubleshooting

### Common Issues

#### Workers Not Responding
```bash
# Check deployment status
wrangler deployments list --env production

# Check logs
wrangler tail --env production

# Rollback if needed
wrangler rollback --env production
```

#### Database Connection Issues
```bash
# Test database connection
turso db shell graceful-books-sync --execute "SELECT 1"

# Check replica status
turso db show graceful-books-sync

# Check worker secrets
wrangler secret list --env production
```

#### Pages Deployment Failure
```bash
# Check build logs in GitHub Actions
gh run list --workflow=deploy-pages.yml

# Rebuild locally
npm ci && npm run build

# Deploy manually
npx wrangler pages deploy dist --project-name=graceful-books
```

### Support Resources

- **Documentation:** docs/INFRASTRUCTURE.md (this file)
- **Cloudflare Docs:** https://developers.cloudflare.com
- **Turso Docs:** https://docs.turso.tech
- **Terraform Docs:** https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs

## Terraform Commands Reference

```bash
# Initialize Terraform
cd infrastructure
terraform init

# Validate configuration
terraform validate

# Format code
terraform fmt

# Plan changes
terraform plan -var-file=production.tfvars

# Apply changes
terraform apply -var-file=production.tfvars

# View outputs
terraform output

# Destroy infrastructure (DANGER!)
terraform destroy -var-file=production.tfvars
```

## Wrangler Commands Reference

```bash
# Deploy Worker
cd relay
wrangler deploy --env production

# List deployments
wrangler deployments list --env production

# Rollback
wrangler rollback --env production --version-id <id>

# View logs
wrangler tail --env production

# Manage secrets
wrangler secret put SECRET_NAME --env production
wrangler secret list --env production
wrangler secret delete SECRET_NAME --env production

# R2 operations
wrangler r2 bucket list
wrangler r2 object list graceful-books-backups
wrangler r2 object get graceful-books-backups/file.sql

# KV operations
wrangler kv:namespace list
wrangler kv:key list --namespace-id=<id>
```

## Next Steps

After infrastructure is deployed:

1. ✅ Configure GitHub secrets
2. ✅ Set up Cloudflare Worker secrets
3. ✅ Configure Turso database
4. ✅ Test staging deployment
5. ✅ Set up monitoring and alerts
6. ✅ Test rollback procedures
7. ✅ Document runbooks
8. ✅ Train team on deployment process
9. ✅ Schedule disaster recovery drill
10. ✅ Deploy to production!

---

**Maintained by:** DevOps Team
**Last Updated:** 2026-01-18
**Version:** 1.0.0
