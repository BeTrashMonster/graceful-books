# Runbook: Deployment Failed

**Severity:** P1-P2
**Estimated Time:** 5-30 minutes
**Skills Required:** DevOps

## Symptoms

- GitHub Actions deployment workflow failed
- Wrangler deployment errors
- Build failures
- Health checks failing after deployment
- Users reporting issues immediately after deployment

## Quick Assessment

```bash
# Check recent GitHub Actions runs
gh run list --limit 5

# Check Worker deployments
cd C:/Users/Admin/graceful_books/relay
wrangler deployments list --env production

# Check git log
git log --oneline -5
```

## Resolution: Rollback First, Debug Later

### Immediate Rollback

```bash
cd C:/Users/Admin/graceful_books

# Rollback Workers (2 minutes)
./scripts/rollback.sh workers production

# Verify Workers healthy
curl https://sync.gracefulbooks.com/health | jq

# Rollback Pages (3 minutes)
./scripts/rollback.sh pages production

# Verify Pages healthy
curl https://gracefulbooks.com
```

### Verification After Rollback

```bash
# All health checks should pass
for region in us eu ap; do
  curl https://sync-$region.gracefulbooks.com/health | jq
done

# Monitor for 5 minutes
watch -n 30 'curl -s https://sync.gracefulbooks.com/health | jq'

# Check error rate (should be < 1%)
curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.error_rate'
```

## Common Failure Scenarios

### 1. Build Failed

```bash
# Check build logs
gh run view [run-id] --log

# Common causes:
# - TypeScript errors
# - Test failures
# - Linting errors
# - Missing dependencies

# Fix locally:
npm ci
npm run type-check
npm run lint
npm test
npm run build

# If all pass locally, push fix
git add .
git commit -m "fix: [description]"
git push origin main
```

### 2. Worker Deployment Failed

```bash
# Check wrangler logs in GitHub Actions
gh run view [run-id] --log | grep -A 20 "wrangler deploy"

# Common causes:
# - Syntax errors
# - Missing secrets
# - Invalid wrangler.toml
# - Bundle size too large

# Test deployment locally:
cd relay
npm ci
npm test
wrangler deploy --env staging  # Test in staging first

# If staging works:
wrangler deploy --env production
```

### 3. Pages Deployment Failed

```bash
# Check Pages deployment status
# Dashboard > Pages > graceful-books > Deployments

# Common causes:
# - Build output path wrong
# - Build command failed
# - Asset size too large

# Test build locally:
npm ci
npm run build
ls -lh dist/  # Verify build output

# Manual deployment if needed:
npx wrangler pages deploy dist --project-name=graceful-books --branch=main
```

### 4. Health Checks Failing After Deployment

```bash
# This means deployment succeeded but introduced bug
# ROLLBACK IMMEDIATELY
./scripts/rollback.sh workers production
./scripts/rollback.sh pages production

# Then debug in staging:
# 1. Deploy to staging
# 2. Reproduce issue
# 3. Fix and test
# 4. Deploy to production
```

### 5. Database Migration Failed

```bash
# Check migration status
turso db shell graceful-books-sync --execute "SELECT * FROM migrations ORDER BY id DESC LIMIT 5"

# CRITICAL: Do not retry failed migration without analysis
# Failed migrations can corrupt data

# See Database Issues runbook for recovery
```

## Post-Rollback Actions

### 1. Communicate Status

```
Slack #deployments:
Deployment failed and has been rolled back.
Service is stable on previous version.
Investigating cause: [brief description]
```

### 2. Identify Root Cause

```bash
# Review failed deployment logs
gh run view [run-id] --log > failed-deployment.log

# Look for:
# - Error messages
# - Stack traces
# - Failed commands
# - Missing variables
```

### 3. Fix in Staging First

```bash
# Never deploy fix directly to production

# 1. Create fix
# 2. Test locally
npm test
npm run build

# 3. Deploy to staging
git push origin main  # Triggers staging deployment

# 4. Test in staging
npm run test:smoke:staging

# 5. Monitor staging for 30 minutes
# 6. If stable, deploy to production
```

## Prevention Checklist

Before deployment:

- [ ] All tests passing locally
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Build succeeds locally
- [ ] Tested in staging
- [ ] Database migrations tested
- [ ] Secrets verified
- [ ] Rollback plan ready

## Blue-Green Deployment

For safer deployments with instant rollback:

```bash
# Use blue-green deployment script
./scripts/blue-green-deploy.sh production all

# Benefits:
# - Zero downtime
# - Instant rollback capability
# - Health checks before traffic switch
# - Old version kept for 24 hours
```

## Escalation

**Escalate if:**
- Rollback doesn't restore service
- Database corruption suspected
- Security vulnerability introduced
- Can't identify root cause

**Contact:** DevOps Lead (Slack: @devops-lead)

## Post-Incident Actions

- [ ] Document what went wrong
- [ ] Update deployment checklist
- [ ] Add pre-deployment checks to prevent recurrence
- [ ] Consider adding automated safeguards
- [ ] Update runbook with learnings

---

**Last Updated:** 2026-01-18

**Remember:** Rollback first, debug later. Stable service is priority #1.
