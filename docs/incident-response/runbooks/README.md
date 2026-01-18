# Incident Response Runbooks

**Build:** H12 - Incident Response Documentation [MVP]
**Last Updated:** 2026-01-18

## Overview

This directory contains step-by-step runbooks for responding to common incidents in Graceful Books. Each runbook provides clear, actionable procedures that can be followed under pressure.

## Available Runbooks

| Runbook | Scenario | Severity | Time to Resolve |
|---------|----------|----------|-----------------|
| [Complete Outage](./01-complete-outage.md) | Application completely unavailable | P0 | 15-60 min |
| [Sync Region Down](./02-sync-region-down.md) | One or more sync regions failing | P1 | 10-30 min |
| [Database Issues](./03-database-issues.md) | Database connection or performance | P0-P2 | 15-120 min |
| [High Error Rate](./04-high-error-rate.md) | Unusual spike in errors | P1-P2 | 20-60 min |
| [Authentication Failures](./05-authentication-failures.md) | Users cannot log in | P0-P1 | 10-45 min |
| [Slow Performance](./06-slow-performance.md) | Application running slowly | P2-P3 | 30-120 min |
| [Data Sync Issues](./07-data-sync-issues.md) | Sync not working for users | P1-P2 | 20-90 min |
| [Deployment Failed](./08-deployment-failed.md) | Deployment or rollback needed | P1-P2 | 5-30 min |
| [Security Incident](./09-security-incident.md) | Suspected security breach | P0 | Immediate |
| [Certificate Issues](./10-certificate-issues.md) | SSL/TLS certificate problems | P0-P1 | 10-60 min |
| [Third-Party Outage](./11-third-party-outage.md) | External dependency down | P1-P3 | Variable |
| [Data Corruption](./12-data-corruption.md) | Data integrity issues detected | P0-P1 | 30-240 min |

## How to Use These Runbooks

1. **Identify the issue** - Use symptoms to find the right runbook
2. **Check severity** - Refer to [Severity Levels](../SEVERITY_LEVELS.md)
3. **Follow steps in order** - Don't skip steps unless noted
4. **Copy-paste commands** - Commands are ready to use
5. **Update incident notes** - Document what you're doing
6. **Communicate progress** - Follow communication templates
7. **Escalate if needed** - Don't hesitate to ask for help

## Quick Reference

### Finding the Right Runbook

**Symptoms → Runbook:**

- "Site is down" → [Complete Outage](./01-complete-outage.md)
- "Can't log in" → [Authentication Failures](./05-authentication-failures.md)
- "Sync not working" → [Data Sync Issues](./07-data-sync-issues.md)
- "Everything is slow" → [Slow Performance](./06-slow-performance.md)
- "Error in Sentry" → [High Error Rate](./04-high-error-rate.md)
- "Database errors" → [Database Issues](./03-database-issues.md)
- "Regional issues" → [Sync Region Down](./02-sync-region-down.md)
- "Deployment broken" → [Deployment Failed](./08-deployment-failed.md)
- "Security alert" → [Security Incident](./09-security-incident.md)
- "SSL error" → [Certificate Issues](./10-certificate-issues.md)
- "Cloudflare down" → [Third-Party Outage](./11-third-party-outage.md)
- "Wrong data" → [Data Corruption](./12-data-corruption.md)

## Runbook Template

All runbooks follow this structure:

```markdown
# [Incident Type]

**Severity:** P0/P1/P2/P3
**Estimated Time:** X-Y minutes
**Skills Required:** [e.g., DevOps, Database, Security]

## Symptoms
- Observable signs of the issue

## Impact
- What users experience

## Prerequisites
- Required access/tools

## Investigation Steps
1. Quick diagnostics
2. Gather information

## Resolution Steps
1. Detailed fix procedures
2. Copy-paste commands

## Verification
- How to confirm fix worked

## Prevention
- How to avoid recurrence

## Escalation
- When and how to escalate
```

## Command Cheat Sheet

### Health Checks
```bash
# Check all sync regions
for region in us eu ap; do
  curl https://sync-$region.gracefulbooks.com/health | jq
done

# Check main app
curl https://gracefulbooks.com

# Check with detailed timing
curl -w "@curl-format.txt" -o /dev/null -s https://sync.gracefulbooks.com/health
```

### Logs
```bash
# Real-time Worker logs
cd C:/Users/Admin/graceful_books/relay
wrangler tail --env production

# Filter for errors only
wrangler tail --env production --format=json | jq 'select(.level == "error")'

# GitHub Actions logs
gh run list --limit 5
gh run view [run-id] --log
```

### Deployments
```bash
# List recent deployments
cd C:/Users/Admin/graceful_books/relay
wrangler deployments list --env production

# Quick rollback
cd C:/Users/Admin/graceful_books
./scripts/rollback.sh workers production
./scripts/rollback.sh pages production
```

### Database
```bash
# Database health
turso db show graceful-books-sync

# Test connection
turso db shell graceful-books-sync --execute "SELECT 1"

# Check replica status
turso db replicas list graceful-books-sync
```

### Monitoring
```bash
# Check error rate
curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.error_rate'

# Check response time
curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.response_time_p95'
```

## Common Tools Needed

### Local Development
- **Git:** Source control
- **Node.js:** Runtime
- **npm:** Package manager
- **Wrangler CLI:** Cloudflare Workers management
- **Turso CLI:** Database management
- **jq:** JSON parsing in terminal
- **curl:** API testing

### Access Required
- **GitHub:** Repository access, Actions, Secrets
- **Cloudflare Dashboard:** Workers, Pages, DNS, Analytics
- **Turso Dashboard:** Database management
- **Sentry:** Error tracking
- **Slack:** Team communication

### Credentials Location
- **GitHub Tokens:** GitHub Settings > Developer Settings
- **Cloudflare API Token:** Cloudflare Dashboard > My Profile > API Tokens
- **Turso Auth Token:** `turso db tokens create graceful-books-sync`
- **Wrangler Login:** `wrangler login`

## Best Practices

### During an Incident

1. **Stay calm** - Panic helps no one
2. **Communicate early** - Update team and users
3. **Follow the runbook** - Don't improvise under pressure
4. **Document actions** - Write what you're doing
5. **Ask for help** - Escalate when unsure
6. **Focus on resolution** - Root cause analysis comes later

### After an Incident

1. **Verify fix** - Test thoroughly
2. **Monitor closely** - Watch for recurrence
3. **Document** - Update incident log
4. **Post-mortem** - Schedule for P0/P1
5. **Update runbooks** - Add learnings
6. **Thank team** - Recognize contributors

## Escalation Paths

When to escalate:

- **Immediate (< 5 min):** P0 incidents, security breaches
- **Quick (< 15 min):** P1 incidents, unclear situation
- **Standard (< 1 hour):** P2 incidents, need expertise
- **Next business day:** P3 incidents, documentation needed

Who to contact: See [Escalation Paths](../ESCALATION_PATHS.md)

## Testing Runbooks

All runbooks should be tested regularly:

- **Monthly:** Test one random runbook
- **Quarterly:** Test all P0/P1 runbooks
- **Annually:** Full disaster recovery drill

See [Incident Response Drills](../INCIDENT_DRILLS.md) for testing procedures.

## Updating Runbooks

Runbooks are living documents. Update when:

- New tools or procedures introduced
- Steps found ineffective during incident
- Infrastructure changes
- Post-mortem identifies gaps
- Team feedback suggests improvements

**Process:**
1. Create PR with changes
2. Get review from team
3. Update "Last Updated" date
4. Merge to main
5. Announce in #incidents channel

## Feedback

Found an issue with a runbook? Suggestions for improvement?

- **During incident:** Focus on resolution first
- **After incident:** Create GitHub issue or PR
- **Slack:** #incidents channel
- **Email:** oncall@gracefulbooks.com

## Additional Resources

- [Incident Response Guide](../INCIDENT_RESPONSE_GUIDE.md)
- [Severity Levels](../SEVERITY_LEVELS.md)
- [Communication Templates](../COMMUNICATION_TEMPLATES.md)
- [Post-Mortem Process](../POST_MORTEM_PROCESS.md)
- [Deployment Runbook](../../DEPLOYMENT_RUNBOOK.md)
- [Infrastructure README](../../../infrastructure/README.md)

---

**Remember:** When in doubt, escalate. It's better to over-communicate than under-communicate during an incident.

**Questions?** Slack: #incidents
