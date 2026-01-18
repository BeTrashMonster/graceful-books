# Runbook: Sync Region Down

**Severity:** P1 (High)
**Estimated Time:** 10-30 minutes
**Skills Required:** DevOps, Infrastructure

## Symptoms

- One or more sync regions returning errors
- Health checks failing for specific region(s)
- Users in specific geography reporting issues
- Automatic failover may be working (users not noticing)
- Monitoring alerts for regional failures

## Impact

- **Users:** May experience degraded performance or automatic rerouting
- **Business:** Reduced redundancy, increased latency for some users
- **Data:** No data loss (other regions still serving)

## Prerequisites

- Cloudflare Dashboard access
- Wrangler CLI installed
- Turso CLI access

## Investigation Steps

### 1. Identify Affected Regions

```bash
# Test all regions
for region in us eu ap; do
  echo "=== Testing sync-$region ==="
  curl -s -o /dev/null -w "HTTP %{http_code} - Time: %{time_total}s\n" \
    https://sync-$region.gracefulbooks.com/health
done

# Expected output:
# us: HTTP 200 - Time: 0.234s
# eu: HTTP 500 - Time: 0.000s  ← Failed region
# ap: HTTP 200 - Time: 0.456s
```

### 2. Check Worker Deployment Status

```bash
cd C:/Users/Admin/graceful_books/relay

# List deployments per region
wrangler deployments list --env production

# Check if all regions on same version
```

### 3. Check Database Replicas

```bash
# List all database replicas
turso db replicas list graceful-books-sync

# Output shows health of each replica:
# Location | Primary | URL
# iad      | true    | libsql://...  ← US region
# lhr      | false   | libsql://...  ← EU region
# sin      | false   | libsql://...  ← AP region
```

### 4. Check Worker Logs for Region

```bash
# Get logs (they're aggregated, but errors will show)
cd C:/Users/Admin/graceful_books/relay
wrangler tail --env production --format=json | jq 'select(.level == "error")'

# Look for patterns indicating region
```

## Resolution Steps

### Scenario A: Worker Deployment Failed in Region

```bash
# Redeploy Workers
cd C:/Users/Admin/graceful_books/relay
wrangler deploy --env production

# This pushes to all regions globally
# Wait 60 seconds for propagation
sleep 60

# Verify all regions
for region in us eu ap; do
  curl https://sync-$region.gracefulbooks.com/health | jq
done
```

### Scenario B: Database Replica Down

```bash
# Check replica status
turso db replicas list graceful-books-sync

# If replica is down, check Turso status
# Browser: https://status.turso.tech

# If Turso issue: See Third-Party Outage runbook
# If replica needs replacement:
turso db replicate graceful-books-sync --location [region-code]

# Region codes:
# us = iad (US East)
# eu = lhr (London)
# ap = sin (Singapore)
```

### Scenario C: Cloudflare Routing Issue

```bash
# Check Cloudflare Workers routes
# Dashboard > Workers > graceful-books-sync-relay > Triggers

# Verify routes are configured:
# sync-us.gracefulbooks.com/* → graceful-books-sync-relay
# sync-eu.gracefulbooks.com/* → graceful-books-sync-relay
# sync-ap.gracefulbooks.com/* → graceful-books-sync-relay

# If routes missing, recreate via Dashboard or Terraform
cd C:/Users/Admin/graceful_books/infrastructure
terraform apply -var-file=production.tfvars
```

### Scenario D: DNS Resolution Issue

```bash
# Check DNS for each region subdomain
nslookup sync-us.gracefulbooks.com
nslookup sync-eu.gracefulbooks.com
nslookup sync-ap.gracefulbooks.com

# Should all resolve to Cloudflare IPs
# If not, check Cloudflare DNS settings
```

### Scenario E: Worker Script Error in Specific Region

```bash
# Rollback to last known good version
cd C:/Users/Admin/graceful_books
./scripts/rollback.sh workers production

# Wait for propagation
sleep 60

# Verify
for region in us eu ap; do
  curl https://sync-$region.gracefulbooks.com/health | jq
done
```

## Verification

```bash
# All regions should return 200 OK
for region in us eu ap; do
  echo "=== $region ==="
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://sync-$region.gracefulbooks.com/health)
  if [ "$STATUS" -eq 200 ]; then
    echo "✅ Healthy"
  else
    echo "❌ Failing (HTTP $STATUS)"
  fi
done

# Check response times (should be < 1s)
for region in us eu ap; do
  echo "=== $region ==="
  curl -w "Time: %{time_total}s\n" -o /dev/null -s https://sync-$region.gracefulbooks.com/health
done

# Monitor for 10 minutes
watch -n 30 './scripts/health-check-all.sh'
```

## Communication

**Status Page:**
```
We're experiencing issues with our [region] sync servers. Users may experience slower syncing or automatic rerouting to other regions. Investigating now.
```

**Slack (#incidents):**
```
⚠️ P1 INCIDENT: [Region] Sync Region Down
Affected: sync-[region].gracefulbooks.com
Impact: Users may see degraded performance
Automatic failover: Active
Status: [Investigating/Fixing/Monitoring]
```

**Resolution Message:**
```
✅ Resolved: [Region] sync servers are back online. All regions healthy.
```

## Prevention

- [ ] Set up per-region health check monitoring
- [ ] Configure automatic alerting for regional failures
- [ ] Review deployment process for region-specific issues
- [ ] Test failover scenarios in drill
- [ ] Document regional architecture
- [ ] Consider additional regions for redundancy

## Escalation

**Escalate if:**
- All regions failing (switch to Complete Outage runbook)
- Database replicas unresponsive
- Can't resolve within 30 minutes
- Cloudflare or Turso platform issue

**Contact:**
- DevOps Lead (Slack: @devops-lead)
- Database Admin (Slack: @db-admin)
- Cloudflare Support (if Cloudflare issue)
- Turso Support (if database issue)

## Related Runbooks

- [Complete Outage](./01-complete-outage.md)
- [Database Issues](./03-database-issues.md)
- [Third-Party Outage](./11-third-party-outage.md)

---

**Last Updated:** 2026-01-18
