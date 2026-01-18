# Deployment Runbook - Graceful Books

**Build:** H10 - Production Infrastructure
**Last Updated:** 2026-01-18

## Quick Reference

| Task | Command | Time |
|------|---------|------|
| Deploy to staging | `git push origin main` | ~5 min |
| Deploy to production | Create GitHub Release | ~10 min |
| Rollback Workers | `./scripts/rollback.sh workers production` | ~2 min |
| Rollback Pages | `./scripts/rollback.sh pages production` | ~3 min |
| View logs | `cd relay && wrangler tail --env production` | N/A |

## Pre-Deployment Checklist

### Before Every Deployment

- [ ] All tests passing (`npm test`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code review approved (PR merged)
- [ ] Staging deployment tested
- [ ] No breaking changes without migration plan
- [ ] Security scan passed
- [ ] Performance regression check passed

### Before Production Deployment

- [ ] Staging has been stable for 24+ hours
- [ ] No critical bugs in staging
- [ ] All acceptance criteria met
- [ ] Rollback plan documented
- [ ] Team notified of deployment window
- [ ] Monitoring dashboards open
- [ ] On-call engineer available

## Staging Deployment

### Automatic Staging Deployment

Triggered automatically on push to `main` branch.

1. **Push to main:**
   ```bash
   git checkout main
   git pull origin main
   git merge feature-branch
   git push origin main
   ```

2. **Monitor deployment:**
   - GitHub Actions: https://github.com/gracefulbooks/graceful-books/actions
   - Watch for `Deploy to Staging` workflow
   - Expected completion: ~5 minutes

3. **Verify deployment:**
   ```bash
   # Check Pages
   curl https://graceful-books.pages.dev

   # Check Workers
   curl https://sync-staging.gracefulbooks.com/health

   # Run smoke tests
   npm run test:smoke:staging
   ```

4. **Test in staging:**
   - Manual testing checklist
   - Verify new features work
   - Check for console errors
   - Test on multiple devices/browsers

### Manual Staging Deployment

If automatic deployment fails:

```bash
# Deploy Pages manually
npm ci && npm run build
npx wrangler pages deploy dist --project-name=graceful-books --branch=staging

# Deploy Workers manually
cd relay
npm ci
wrangler deploy --env staging
```

## Production Deployment

### Method 1: GitHub Release (Recommended)

1. **Create release:**
   ```bash
   # Tag version
   git tag -a v1.2.3 -m "Release v1.2.3: Feature description"
   git push origin v1.2.3

   # Or via GitHub UI:
   # Releases > Draft a new release > Create release
   ```

2. **Monitor deployment:**
   - GitHub Actions runs `Deploy to Production` workflow
   - Requires manual approval in GitHub UI
   - Expected completion: ~10 minutes

3. **Approve deployment:**
   - Go to Actions tab
   - Click on running workflow
   - Click "Review deployments"
   - Check "production" environment
   - Click "Approve and deploy"

4. **Verify deployment:**
   ```bash
   # Check all regions
   curl https://sync-us.gracefulbooks.com/health
   curl https://sync-eu.gracefulbooks.com/health
   curl https://sync-ap.gracefulbooks.com/health

   # Check main app
   curl https://gracefulbooks.com

   # Run production smoke tests
   npm run test:smoke:production
   ```

### Method 2: Manual Deployment (Emergency Only)

```bash
# Deploy Workers
cd relay
npm ci
npm test
wrangler deploy --env production

# Verify Workers
for region in us eu ap; do
  curl https://sync-$region.gracefulbooks.com/health
done

# Deploy Pages
cd ..
npm ci
npm run build
npx wrangler pages deploy dist --project-name=graceful-books --branch=main

# Verify Pages
curl https://gracefulbooks.com
```

## Blue-Green Deployment

For zero-downtime deployments with instant rollback capability:

```bash
# Full blue-green deployment
./scripts/blue-green-deploy.sh production all

# Workers only
./scripts/blue-green-deploy.sh production workers

# Pages only
./scripts/blue-green-deploy.sh production pages
```

The script will:
1. Deploy new version (green)
2. Run health checks
3. Switch traffic if healthy
4. Keep old version (blue) for rollback

## Rollback Procedures

### Quick Rollback (Use This First)

```bash
# Rollback Workers (fastest)
./scripts/rollback.sh workers production

# Rollback Pages
./scripts/rollback.sh pages production

# Rollback database (use with extreme caution)
./scripts/rollback.sh database production
```

### Manual Rollback

#### Workers Rollback:

```bash
cd relay

# List recent deployments
wrangler deployments list --env production

# Output example:
# Created     Version ID                           Message
# 2 hours ago abc123def456                         Deploy from main
# 1 day ago   xyz789uvw012                         Previous deploy

# Rollback to previous version
wrangler rollback --env production --version-id xyz789uvw012

# Verify
for region in us eu ap; do
  echo "Checking sync-$region..."
  curl https://sync-$region.gracefulbooks.com/health | jq
done
```

#### Pages Rollback:

```bash
# Find commit to rollback to
git log --oneline | head -10

# Checkout that commit
git checkout abc123

# Build and deploy
npm ci
npm run build
npx wrangler pages deploy dist --project-name=graceful-books --branch=main

# Return to main
git checkout main
```

#### Database Restore:

```bash
# List backups
wrangler r2 object list graceful-books-db-backups | head -20

# Download backup
wrangler r2 object get graceful-books-db-backups/backup-2026-01-17.sql --file=/tmp/backup.sql

# CRITICAL: Verify backup before restore
head -100 /tmp/backup.sql

# Restore (DANGER: This replaces current data!)
turso db shell graceful-books-sync < /tmp/backup.sql

# Verify restore
turso db shell graceful-books-sync --execute "SELECT COUNT(*) FROM sync_changes"
```

## Infrastructure Updates

### Terraform Infrastructure Changes

1. **Make changes:**
   ```bash
   cd infrastructure
   # Edit .tf files
   ```

2. **Validate:**
   ```bash
   terraform fmt
   terraform validate
   ```

3. **Plan changes:**
   ```bash
   terraform plan -var-file=production.tfvars
   ```

4. **Create PR:**
   - Terraform plan is automatically posted to PR
   - Review changes carefully
   - Get approval from team

5. **Apply changes:**
   ```bash
   # Via GitHub Actions (recommended)
   # Go to Actions > Infrastructure Deployment > Run workflow
   # Select: apply, production

   # Or manually
   terraform apply -var-file=production.tfvars
   ```

### Database Migrations

```bash
cd relay

# Create migration
npm run db:create-migration "add_new_column"

# Test migration locally
npm run db:migrate:dev

# Apply to staging
npm run db:migrate:staging

# Test in staging
# ... verify everything works ...

# Apply to production
npm run db:migrate:production

# Verify
turso db shell graceful-books-sync --execute "SELECT * FROM migrations"
```

## Monitoring During Deployment

### What to Watch

1. **GitHub Actions:**
   - All jobs green
   - No errors in logs

2. **Cloudflare Dashboard:**
   - Workers > graceful-books-sync-relay > Metrics
   - Look for error rate spikes
   - CPU time should be < 50ms

3. **Health Checks:**
   ```bash
   # Every 30 seconds during deployment
   watch -n 30 'curl -s https://sync-us.gracefulbooks.com/health | jq'
   ```

4. **Application Logs:**
   ```bash
   # Real-time logs
   cd relay
   wrangler tail --env production
   ```

5. **Error Tracking:**
   - Sentry dashboard
   - Check for new errors
   - Monitor error rate

### Alert Thresholds

Rollback immediately if:
- Error rate > 5%
- Health check fails for > 2 minutes
- Response time > 5 seconds (p95)
- CPU time > 45ms average

## Common Issues & Solutions

### Issue: Deployment Stuck

**Symptoms:** GitHub Actions workflow stuck on "Waiting"

**Solution:**
```bash
# Cancel workflow
gh run cancel <run-id>

# Retry
gh workflow run deploy-pages.yml
```

### Issue: Health Check Failing

**Symptoms:** `/health` endpoint returns 500 or times out

**Solution:**
```bash
# Check logs
cd relay
wrangler tail --env production

# Common causes:
# 1. Database connection issue
# 2. Missing secret
# 3. Code error

# Rollback
./scripts/rollback.sh workers production
```

### Issue: High Error Rate

**Symptoms:** Sentry showing increased errors

**Solution:**
1. Check Sentry for error details
2. Determine if it's deployment-related
3. If yes: Rollback immediately
4. If no: Monitor and investigate

```bash
# Check error rate
curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.error_rate'

# If > 1%, consider rollback
```

### Issue: Database Migration Failed

**Symptoms:** Migration error during deployment

**Solution:**
```bash
# Check migration status
turso db shell graceful-books-sync --execute "SELECT * FROM migrations ORDER BY id DESC LIMIT 5"

# If migration partially applied:
# 1. Don't retry - this could corrupt data
# 2. Restore from backup
# 3. Fix migration script
# 4. Apply corrected migration

# Restore from backup
./scripts/rollback.sh database production
```

### Issue: Secrets Not Working

**Symptoms:** Worker can't connect to database

**Solution:**
```bash
# Verify secrets are set
cd relay
wrangler secret list --env production

# If missing, set them
wrangler secret put TURSO_DATABASE_URL --env production
wrangler secret put TURSO_AUTH_TOKEN --env production

# Redeploy
wrangler deploy --env production
```

## Post-Deployment

### Immediate (Within 5 minutes)

- [ ] All health checks passing
- [ ] No error spikes in Sentry
- [ ] Smoke tests passed
- [ ] Key features working
- [ ] No alerts triggered

### Short-term (Within 1 hour)

- [ ] Monitor error rate (should be < 0.1%)
- [ ] Check performance metrics (no regression)
- [ ] Review user feedback (if any)
- [ ] Test new features end-to-end
- [ ] Update status page (if used)

### Long-term (Within 24 hours)

- [ ] No user-reported issues
- [ ] Performance metrics stable
- [ ] SLA targets met (99.9% uptime)
- [ ] Database performance normal
- [ ] Document any issues encountered
- [ ] Update deployment notes

## Emergency Contacts

| Role | Contact | When to Reach Out |
|------|---------|-------------------|
| On-Call Engineer | Slack: @oncall | Production issues, rollback needed |
| DevOps Lead | Slack: @devops-lead | Infrastructure failures |
| Database Admin | Slack: @db-admin | Database corruption, migration issues |
| Product Owner | Slack: @product | User-impacting bugs |

## Deployment Windows

### Recommended Times (UTC)

| Day | Time | Notes |
|-----|------|-------|
| Tuesday | 10:00 AM | Lowest traffic, team available |
| Wednesday | 10:00 AM | Backup day if Tuesday blocked |
| Thursday | 10:00 AM | Last safe day before weekend |

### Avoid

- Fridays (no coverage over weekend)
- Weekends (limited team availability)
- Holidays (reduced monitoring)
- High-traffic periods (end of month, tax deadlines)

## Versioning Strategy

```
v<major>.<minor>.<patch>

Examples:
- v1.0.0 - Initial production release
- v1.1.0 - New feature (backward compatible)
- v1.1.1 - Bug fix
- v2.0.0 - Breaking change
```

## Changelog

Maintain changelog for each release:

```markdown
## v1.2.0 - 2026-01-18

### Added
- Blue-green deployment strategy
- Automated rollback procedures

### Changed
- Improved health check response time

### Fixed
- Database connection timeout issue
```

## Useful Commands

```bash
# View deployment status
gh run list --workflow=deploy-pages.yml --limit 5

# Watch logs in real-time
cd relay && wrangler tail --env production

# Check version deployed
curl https://sync.gracefulbooks.com/health | jq '.version'

# Test endpoint from different regions
for region in us eu ap; do
  echo "=== $region ==="
  curl https://sync-$region.gracefulbooks.com/health | jq
done

# Download database backup
wrangler r2 object get graceful-books-db-backups/$(date +%Y-%m-%d).sql

# Check infrastructure state
cd infrastructure && terraform show

# Validate all health checks
./scripts/health-check-all.sh
```

---

**Remember:**
- Test in staging first, always
- Monitor during and after deployment
- When in doubt, rollback
- Document everything
- Communicate with team

**Questions?** Slack: #deployments
