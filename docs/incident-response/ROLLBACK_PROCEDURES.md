# Rollback Procedures

**Build:** H12 - Incident Response Documentation [MVP]
**Last Updated:** 2026-01-18
**Depends on:** H10 - Production Infrastructure

## Overview

This document provides detailed step-by-step procedures for rolling back deployments when incidents occur. Rollback is often the fastest path to service restoration.

## Golden Rule

**When in doubt, rollback.** It's better to rollback and investigate than to debug in production while users are affected.

## Rollback Decision Matrix

| Situation | Action | Time |
|-----------|--------|------|
| Deployment in last 2 hours + errors spiking | **Rollback immediately** | < 5 min |
| Unknown cause + service degraded | **Rollback while investigating** | < 10 min |
| Known issue + fix will take >30 min | **Rollback, fix in staging** | < 5 min |
| Minor issue + fix ready | Test fix in staging first | N/A |
| Issue unrelated to deployment | Don't rollback, debug | N/A |

## Quick Rollback Commands

```bash
# Location: C:/Users/Admin/graceful_books

# Rollback Workers (2 minutes)
./scripts/rollback.sh workers production

# Rollback Pages (3 minutes)
./scripts/rollback.sh pages production

# Rollback Database (DANGEROUS - use with extreme caution)
./scripts/rollback.sh database production

# Rollback Everything
./scripts/rollback.sh all production
```

## Component-Specific Rollback

### 1. Cloudflare Workers (Sync Relay)

**When to rollback:**
- API errors spiking
- Health checks failing
- Sync not working
- Database connection errors
- Recent Worker deployment

**Automated Rollback (Recommended):**

```bash
cd C:/Users/Admin/graceful_books
./scripts/rollback.sh workers production
```

**What this does:**
1. Lists recent Worker deployments
2. Prompts for version to rollback to
3. Uses `wrangler rollback` command
4. Verifies health checks
5. Reports success/failure

**Manual Rollback:**

```bash
cd C:/Users/Admin/graceful_books/relay

# Step 1: List recent deployments
wrangler deployments list --env production

# Output example:
# Created      Version ID           Message
# 2 hours ago  abc123def456        Deploy from main
# 1 day ago    xyz789uvw012        Previous deploy  ← Rollback to this

# Step 2: Identify last known good version
# Look for version before problems started

# Step 3: Rollback
wrangler rollback --env production --version-id xyz789uvw012

# Step 4: Verify rollback
for region in us eu ap; do
  echo "=== Checking sync-$region ==="
  curl -s https://sync-$region.gracefulbooks.com/health | jq
done

# Step 5: Check error rate
curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.error_rate'

# Should be < 1% after rollback
```

**Verification:**

```bash
# All regions should return healthy
./scripts/health-check-all.sh

# Monitor for 5 minutes
watch -n 30 'curl -s https://sync.gracefulbooks.com/health | jq'

# Check Worker logs for errors
wrangler tail --env production | grep -i error
```

**Rollback Time:** ~2 minutes (automated), ~5 minutes (manual)

**Gotchas:**
- Rollback only works if previous version was healthy
- Max rollback history: 10 recent deployments
- Rollback is instantaneous across all regions
- Secrets are NOT rolled back (persist across versions)

---

### 2. Cloudflare Pages (Frontend)

**When to rollback:**
- UI completely broken
- JavaScript errors preventing app load
- 404 errors on all routes
- Build broke production
- Recent Pages deployment

**Automated Rollback (Recommended):**

```bash
cd C:/Users/Admin/graceful_books
./scripts/rollback.sh pages production
```

**What this does:**
1. Finds last good commit from git log
2. Checks out that commit
3. Builds fresh production bundle
4. Deploys to Pages
5. Returns to main branch
6. Verifies deployment

**Manual Rollback:**

```bash
cd C:/Users/Admin/graceful_books

# Step 1: Find last known good commit
git log --oneline --all | head -20

# Look for commit before issue started
# Example: abc1234 was last good version

# Step 2: Checkout that commit
git checkout abc1234

# Step 3: Install dependencies (match that version)
npm ci

# Step 4: Build
npm run build

# Verify build succeeded
ls -lh dist/

# Step 5: Deploy to Pages
npx wrangler pages deploy dist \
  --project-name=graceful-books \
  --branch=main \
  --commit-hash=abc1234

# Step 6: Return to main
git checkout main

# Step 7: Verify deployment
curl -I https://gracefulbooks.com | head -1
# Should see: HTTP/2 200

# Open in browser
# https://gracefulbooks.com
```

**Via Cloudflare Dashboard:**

```
1. Go to: Cloudflare Dashboard > Pages > graceful-books > Deployments
2. Find last successful deployment (green checkmark)
3. Click "..." menu on that deployment
4. Click "Rollback to this deployment"
5. Confirm rollback
6. Wait for deployment to complete (~2 minutes)
7. Verify at https://gracefulbooks.com
```

**Verification:**

```bash
# Check main site loads
curl -I https://gracefulbooks.com

# Test key routes
curl -I https://gracefulbooks.com/dashboard
curl -I https://gracefulbooks.com/transactions

# Check for JavaScript errors in browser console
# Open https://gracefulbooks.com in Chrome DevTools

# Verify build assets loading
curl -I https://gracefulbooks.com/assets/index.js
```

**Rollback Time:** ~3 minutes (automated), ~5-7 minutes (manual)

**Gotchas:**
- Full rebuild required (can't just redeploy old artifacts)
- npm dependencies must match that version
- Environment variables persist (not rolled back)
- May need to clear browser cache
- CDN cache takes ~60 seconds to propagate

---

### 3. Database (Turso)

**⚠️ WARNING:** Database rollback is DANGEROUS and should be LAST RESORT.

**When to rollback:**
- Database corruption detected
- Failed migration caused data issues
- Catastrophic data loss
- All other options exhausted

**DO NOT rollback database if:**
- Schema migration succeeded (even if app broken)
- Only some records affected (fix data instead)
- Uncertain about consequences
- Haven't consulted database admin

**Prerequisites:**

```bash
# Verify backup exists and is recent
wrangler r2 object list graceful-books-db-backups

# Download and inspect backup BEFORE restoring
wrangler r2 object get \
  graceful-books-db-backups/backup-$(date +%Y-%m-%d).sql \
  --file=/tmp/backup-preview.sql

# Verify backup integrity
head -100 /tmp/backup-preview.sql
tail -100 /tmp/backup-preview.sql

# Check backup size (should be reasonable)
ls -lh /tmp/backup-preview.sql
```

**Automated Rollback (Use with Extreme Caution):**

```bash
cd C:/Users/Admin/graceful_books

# This will prompt multiple confirmations
./scripts/rollback.sh database production
```

**Manual Database Restore:**

```bash
# Step 1: STOP all writes to database
# Disable Workers to prevent concurrent writes
cd relay
# Contact Cloudflare support to disable Worker
# OR set rate limit to 0 in dashboard

# Step 2: Create current database snapshot (before restore)
turso db shell graceful-books-sync --execute ".dump" > \
  db-before-restore-$(date +%Y%m%d-%H%M%S).sql

# Step 3: Identify backup to restore
wrangler r2 object list graceful-books-db-backups

# Step 4: Download backup
BACKUP_DATE="2026-01-18"  # CHANGE THIS
wrangler r2 object get \
  graceful-books-db-backups/backup-$BACKUP_DATE.sql \
  --file=/tmp/restore-backup.sql

# Step 5: Verify backup one more time
echo "First 50 lines:"
head -50 /tmp/restore-backup.sql
echo ""
echo "Last 50 lines:"
tail -50 /tmp/restore-backup.sql
echo ""
echo "Backup size:"
ls -lh /tmp/restore-backup.sql

# Step 6: CRITICAL DECISION POINT
read -p "Are you ABSOLUTELY SURE you want to restore? (type 'YES' to confirm): " confirm
if [ "$confirm" != "YES" ]; then
  echo "Restore cancelled"
  exit 1
fi

# Step 7: Restore database
turso db shell graceful-books-sync < /tmp/restore-backup.sql

# Step 8: Verify restore
turso db shell graceful-books-sync --execute "
  SELECT COUNT(*) as total_changes FROM sync_changes;
  SELECT COUNT(*) as total_users FROM users;
"

# Step 9: Re-enable Workers
# Redeploy Workers (will reconnect to database)
cd relay
wrangler deploy --env production

# Step 10: Verify health
curl https://sync.gracefulbooks.com/health | jq
```

**Verification After Database Restore:**

```bash
# Check critical tables
turso db shell graceful-books-sync --execute "
  SELECT
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM sync_changes) as sync_changes,
    (SELECT COUNT(*) FROM audit_log) as audit_log;
"

# Verify recent data (check how much was lost)
turso db shell graceful-books-sync --execute "
  SELECT MAX(timestamp) as latest_change
  FROM sync_changes;
"

# Should match backup date

# Test sync functionality
curl -X POST https://sync.gracefulbooks.com/sync \
  -H "Content-Type: application/json" \
  -d '{"test": true}' | jq
```

**Rollback Time:** ~30-60 minutes (includes safety checks)

**Gotchas:**
- **Data loss:** Everything after backup timestamp is lost
- **User impact:** Users may lose recent work
- **Sync conflicts:** Local data may conflict with restored database
- **Irreversible:** Cannot undo database restore
- **Requires downtime:** Workers must be offline during restore

**Communication:**

Database rollback REQUIRES user communication:

```
🚨 We had to restore our database from a backup due to [reason].
Data from [TIME] to [TIME] has been lost.
We sincerely apologize. Your local data is safe and will re-sync.
```

---

### 4. Infrastructure (Terraform)

**When to rollback:**
- Terraform apply broke infrastructure
- DNS changes caused outage
- Misconfigured resources

**Rollback Procedure:**

```bash
cd C:/Users/Admin/graceful_books/infrastructure

# Step 1: Identify what changed
terraform show

# Step 2: Revert Terraform state to previous version
# Option A: Git revert
git log --oneline terraform.tfvars
git checkout [previous-commit] -- *.tf *.tfvars

# Option B: Terraform state rollback (advanced)
terraform state pull > terraform.tfstate.backup
# Manually edit state file (DANGEROUS)

# Step 3: Review plan
terraform plan -var-file=production.tfvars

# Step 4: Apply rollback
terraform apply -var-file=production.tfvars

# Step 5: Verify
# Check Cloudflare Dashboard
# Test all services
```

**Rollback Time:** ~10-20 minutes

**Gotchas:**
- Some changes irreversible (e.g., deleted resources)
- DNS changes take time to propagate
- State conflicts possible

---

## Rollback Scenarios

### Scenario 1: Deployment 1 Hour Ago, Errors Spiking

```bash
# FAST ROLLBACK
./scripts/rollback.sh workers production
./scripts/rollback.sh pages production

# Verify
./scripts/health-check-all.sh

# Communicate
# Slack: "Rolled back deployment due to errors. Investigating."
```

**Time:** 5 minutes

### Scenario 2: Gradual Degradation, Unsure if Deployment Related

```bash
# Rollback while investigating
./scripts/rollback.sh all production

# Monitor improvement
watch -n 30 'curl -s https://sync.gracefulbooks.com/metrics/sla | jq'

# If improvement: Deployment was cause
# If no improvement: Issue elsewhere, can re-deploy
```

**Time:** 10 minutes

### Scenario 3: Database Migration Failed

```bash
# DO NOT automatic rollback

# Step 1: Check migration status
turso db shell graceful-books-sync --execute "
  SELECT * FROM migrations
  ORDER BY id DESC LIMIT 5;
"

# Step 2: If migration partially applied, STOP
# Contact database admin
# Assess data corruption risk

# Step 3: If safe, restore from backup
# (Follow database rollback procedure above)

# Step 4: Fix migration script
# Step 5: Re-apply corrected migration
```

**Time:** 30-120 minutes

### Scenario 4: Multiple Components Deployed

```bash
# Rollback in reverse order of deployment

# Typical deployment order:
# 1. Database migration
# 2. Workers
# 3. Pages

# Rollback order (reverse):
# 1. Pages (safest to rollback first)
./scripts/rollback.sh pages production

# 2. Workers
./scripts/rollback.sh workers production

# 3. Database (only if necessary)
# (Usually don't rollback DB if migration succeeded)

# Verify after each rollback
./scripts/health-check-all.sh
```

**Time:** 10-15 minutes

## Post-Rollback Actions

### 1. Verify Service Healthy

```bash
# All health checks green
./scripts/health-check-all.sh

# Error rate < 1%
curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.error_rate'

# Response time normal
curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.response_time_p95'

# Monitor for 15 minutes
watch -n 60 './scripts/health-check-all.sh'
```

### 2. Communicate Rollback

```
Status Page: Issue resolved by rolling back to previous version. Service stable. Investigating root cause.

Slack #incidents:
✅ Rolled back to previous version
⏱️ Rollback completed in [X] minutes
📊 All metrics normal
🔍 Investigating root cause
📝 Post-mortem scheduled
```

### 3. Document Incident

Create incident log entry:

```markdown
## Incident: [Date] - [Brief Description]

**Severity:** P0/P1/P2
**Duration:** [Start] to [End] ([total minutes])
**Resolution:** Rollback

### Timeline
- [TIME]: Issue detected
- [TIME]: Rollback initiated
- [TIME]: Rollback completed
- [TIME]: Service verified healthy

### Root Cause
[Brief description or "Under investigation"]

### Rollback Details
- Components: Workers, Pages, Database (circle which)
- Version rolled back from: [commit/version]
- Version rolled back to: [commit/version]
- Data loss: Yes/No (explain if yes)

### Lessons Learned
[To be completed in post-mortem]
```

### 4. Investigate Root Cause

```bash
# Don't stop at rollback - understand why it broke

# Compare versions
git diff [old-version] [new-version]

# Review failing tests in new version
npm test

# Check logs for errors in new version
# (Before rollback, hopefully captured)

# Reproduce in staging
git checkout [failed-version]
# Deploy to staging
# Try to reproduce issue
```

### 5. Fix and Redeploy (Properly)

```bash
# Never deploy same broken version again

# 1. Fix the issue
# 2. Add test to prevent regression
# 3. Test fix locally
npm test
npm run build

# 4. Deploy to staging
git push origin main

# 5. Test in staging thoroughly
npm run test:smoke:staging

# 6. Monitor staging for 30+ minutes

# 7. Deploy to production (carefully)
# Create release
# Monitor closely
```

## Prevention

To reduce need for rollbacks:

### Before Deployment

- [ ] All tests pass locally
- [ ] Staging deployment successful
- [ ] Staging monitored for 30+ minutes
- [ ] No errors in staging logs
- [ ] Performance acceptable in staging
- [ ] Rollback plan documented
- [ ] Team aware of deployment

### During Deployment

- [ ] Monitor health checks continuously
- [ ] Watch error rates
- [ ] Check logs in real-time
- [ ] Be ready to rollback quickly
- [ ] Keep communication channel open

### After Deployment

- [ ] Monitor for 30 minutes minimum
- [ ] Check error rates hourly for 24 hours
- [ ] Review user feedback
- [ ] Document any issues
- [ ] Update runbooks with learnings

## Rollback Testing

Test rollback procedures regularly:

**Monthly:**
- Test automated rollback scripts in staging
- Verify all tools and access working

**Quarterly:**
- Full rollback drill in staging
- Test Workers, Pages, and Database rollback
- Time the procedures
- Update documentation

**Annually:**
- Disaster recovery full simulation
- Include all team members
- Test escalation paths
- Review and update all procedures

## Rollback Metrics

Track rollback effectiveness:

- **Time to rollback:** Target < 5 minutes
- **Rollback success rate:** Target 100%
- **Service restoration:** Target 100% after rollback
- **Frequency:** Track how often rollback needed

Review quarterly and improve procedures.

---

## Quick Reference Card

```
ROLLBACK QUICK REFERENCE
========================

Workers:  ./scripts/rollback.sh workers production  (2 min)
Pages:    ./scripts/rollback.sh pages production    (3 min)
Database: ./scripts/rollback.sh database production (30-60 min)
All:      ./scripts/rollback.sh all production      (5 min)

Verify:   ./scripts/health-check-all.sh
Monitor:  watch -n 30 './scripts/health-check-all.sh'
Logs:     cd relay && wrangler tail --env production

When to rollback:
✅ Deployment in last 2 hours + errors
✅ Unknown cause + service degraded
✅ Known issue + fix takes > 30 min
❌ Minor issue + fix ready
❌ Issue unrelated to deployment

After rollback:
1. Verify healthy (15 min monitoring)
2. Communicate to team and users
3. Document incident
4. Investigate root cause
5. Fix and redeploy properly
```

---

**Last Updated:** 2026-01-18
**Version:** 1.0.0

**Questions?** Slack: #incidents

**Remember:** Rollback is not failure. It's responsible incident response. Rollback fast, debug later.
