# Runbook: Security Incident

**Severity:** P0
**Estimated Time:** Immediate response, ongoing investigation
**Skills Required:** Security, DevOps, Legal

## ⚠️ CRITICAL: READ THIS FIRST

This runbook covers suspected security breaches, data exposure, or active attacks. Time is critical.

**DO NOT:**
- Share details publicly before assessment
- Delete evidence or logs
- Make changes without documenting
- Communicate to users until coordinated response ready

**DO:**
- Act immediately
- Document everything
- Preserve evidence
- Coordinate response
- Follow legal requirements

## Symptoms

- Unauthorized access detected
- Data breach alerts
- Unusual authentication patterns
- Suspicious database queries
- Security scanning tool alerts
- User reports of compromised accounts
- Encryption keys potentially exposed
- DDoS attack in progress
- Malware detected
- Security researcher disclosure

## Immediate Actions (< 5 minutes)

### 1. Alert Security Team

```bash
# Slack (URGENT)
# Post in #security-incidents (private channel)
```

**Message:**
```
🚨 SECURITY INCIDENT - P0
Type: [suspected breach/data exposure/attack/unknown]
Detected: [how/when]
Status: Responding
Reporter: @[YOUR_NAME]

DO NOT discuss outside #security-incidents until cleared.
```

### 2. Preserve Evidence

```bash
# Capture current state before making changes

# Export Worker logs
cd C:/Users/Admin/graceful_books/relay
wrangler tail --env production --format=json > security-incident-$(date +%Y%m%d-%H%M%S).log &
TAIL_PID=$!

# Save database state
turso db shell graceful-books-sync --execute ".dump" > db-snapshot-$(date +%Y%m%d-%H%M%S).sql

# Save GitHub Actions logs
gh run list --limit 20 > github-actions-$(date +%Y%m%d-%H%M%S).log

# Export Cloudflare logs (via Dashboard)
# Workers > Analytics > Export logs
```

### 3. Assess Scope (< 10 minutes)

Quick triage:

```bash
# Check for unusual access patterns
wrangler tail --env production | grep -E "(login|auth|token)"

# Check recent deployments
gh run list --limit 10

# Check for modified secrets
cd relay
wrangler secret list --env production

# Check database for suspicious activity
turso db shell graceful-books-sync --execute "
  SELECT * FROM audit_log
  WHERE timestamp > datetime('now', '-1 hour')
  ORDER BY timestamp DESC
  LIMIT 100;
"
```

## Security Incident Types

### Type A: Data Breach / Exposure

**Suspected user data exposed (CRITICAL):**

```bash
# IMMEDIATE containment:

# 1. Rotate all encryption keys
# (This will require all users to re-authenticate)
# DO NOT do this without security team approval

# 2. Check what data may be exposed
# Review recent database access logs
# Review S3/R2 bucket permissions
# Review Worker logs for unauthorized access

# 3. Determine scope
# How many users affected?
# What data types exposed?
# How long exposed?

# 4. Notify legal team immediately
# Data breach disclosure requirements vary by jurisdiction
# Slack: @legal-team or call: [number]
```

### Type B: Unauthorized Access

**Someone gained unauthorized access:**

```bash
# 1. Identify compromised accounts
turso db shell graceful-books-sync --execute "
  SELECT email, last_login, ip_address
  FROM users
  WHERE last_login > datetime('now', '-6 hours')
  ORDER BY last_login DESC;
"

# 2. Force logout all users (nuclear option)
# Rotate SESSION_SECRET
cd relay
SESSION_SECRET=$(openssl rand -base64 32)
echo "$SESSION_SECRET" | wrangler secret put SESSION_SECRET --env production

# 3. Reset passwords for affected accounts
# Via admin panel or database

# 4. Review audit logs for unauthorized actions
turso db shell graceful-books-sync --execute "
  SELECT * FROM audit_log
  WHERE user_id IN ([compromised_user_ids])
  ORDER BY timestamp DESC;
"
```

### Type C: Encryption Compromise

**Zero-knowledge encryption potentially broken:**

```bash
# THIS IS THE WORST CASE SCENARIO

# 1. STOP all sync immediately
# Disable Workers
cd relay
wrangler deploy --env production --dry-run  # DO NOT DEPLOY
# Contact Cloudflare to disable Worker manually

# 2. Notify all users immediately
# Use communication template for security breach

# 3. Initiate key rotation protocol
# See H2 Key Rotation documentation

# 4. Assess damage
# Which keys compromised?
# How many users affected?
# What data accessed?

# 5. Legal notification requirements
# Contact legal team IMMEDIATELY
# Data breach laws require notification within 72 hours (GDPR)
```

### Type D: DDoS Attack

**Service under active attack:**

```bash
# 1. Verify it's DDoS not legitimate traffic spike
curl -s https://sync.gracefulbooks.com/metrics/sla | jq

# 2. Enable Cloudflare DDoS protection
# Dashboard > Security > DDoS
# Set to "I'm Under Attack" mode (temporarily)

# 3. Review attack traffic patterns
# Dashboard > Analytics > Security

# 4. Block attacking IPs if identifiable
# Dashboard > Security > WAF > Create rule

# 5. Enable rate limiting
# Dashboard > Security > Rate Limiting

# 6. Monitor for application-level attacks
wrangler tail --env production | grep -i "attack\|inject\|xss\|sql"
```

### Type E: Vulnerability Disclosure

**Security researcher reported vulnerability:**

```bash
# 1. Acknowledge receipt (within 24 hours)
# Thank researcher
# Confirm you're investigating
# Ask for time to fix before public disclosure

# 2. Assess vulnerability
# Reproduce the issue
# Determine severity (CVSS score)
# Identify affected versions

# 3. Develop fix
# Test thoroughly
# Deploy to staging first

# 4. Coordinate disclosure
# Agree on disclosure timeline with researcher
# Prepare security advisory
# Deploy fix

# 5. Credit researcher
# Security page with hall of fame
# Bug bounty payment if program exists
```

## Containment Actions

### Stop the Bleeding

```bash
# Option 1: Disable affected feature
# Use feature flags if available

# Option 2: Rollback to last known secure version
./scripts/rollback.sh workers production
./scripts/rollback.sh pages production

# Option 3: Take service offline (LAST RESORT)
# Only if continuing operation causes more harm
# Requires CEO/CTO approval

# Option 4: Block specific traffic
# Via Cloudflare WAF rules
# Dashboard > Security > WAF
```

### Secure the Environment

```bash
# 1. Rotate all secrets
cd relay

# Rotate database tokens
NEW_DB_TOKEN=$(turso db tokens create graceful-books-sync)
echo "$NEW_DB_TOKEN" | wrangler secret put TURSO_AUTH_TOKEN --env production

# Rotate session secrets
NEW_SESSION=$(openssl rand -base64 32)
echo "$NEW_SESSION" | wrangler secret put SESSION_SECRET --env production

# Rotate API keys
# (Depends on what keys exist)

# 2. Review and remove any backdoors
# Check for unauthorized:
# - GitHub repository access
# - Cloudflare account access
# - Database access
# - Server access

# 3. Enable MFA if not already
# GitHub, Cloudflare, Turso accounts

# 4. Review audit logs
# GitHub: Settings > Security > Audit log
# Cloudflare: Account > Audit Log
# Turso: Check access patterns
```

## Investigation

### Forensics (Preserve Evidence)

```bash
# 1. Export all logs BEFORE making changes
# Worker logs (already exported earlier)

# 2. Export database audit trail
turso db shell graceful-books-sync --execute "
  SELECT * FROM audit_log
  WHERE timestamp > datetime('now', '-7 days')
" > audit-log-$(date +%Y%m%d).csv

# 3. Export access logs
# Cloudflare > Analytics > Logs

# 4. Screenshot everything relevant
# Take screenshots of:
# - Suspicious access patterns
# - Error messages
# - Attack traffic graphs
# - Configuration before changes

# 5. Document timeline
# Create incident-timeline.md with:
# - When first detected
# - What triggered detection
# - Actions taken and when
# - Who was involved
```

### Root Cause Analysis

```bash
# Questions to answer:
# - How did attacker gain access?
# - What vulnerability was exploited?
# - When did breach occur?
# - What data was accessed?
# - Is attacker still in system?
# - Are there other compromised systems?

# Review:
# - Recent code changes
# - Dependency updates
# - Configuration changes
# - Access control changes
# - Third-party integrations
```

## Communication

### Internal (Immediate)

```
#security-incidents (private):
🚨 SECURITY INCIDENT - UPDATE
Type: [specific type]
Scope: [affected systems/users]
Status: [contained/investigating/ongoing]
Actions taken: [list]
Next steps: [list]
ETA: [when more info available]
```

### External (Coordinated)

**DO NOT communicate externally until:**
- Security team assesses scope
- Legal team reviews message
- Coordinated response plan ready
- Required by law (72-hour GDPR deadline)

**Status Page (if service impacted):**
```
We're investigating a security issue and have taken the service offline as a precaution. Your data security is our top priority. Updates coming soon.
```

**User Email (if breach confirmed):**
```
Subject: Important Security Notice - Graceful Books

We're writing to inform you of a security incident that may have affected your account.

What happened:
[Clear, honest explanation without technical jargon]

What information was involved:
[Specific data types, be honest]

What we're doing:
[Steps taken to secure system]

What you should do:
1. Change your password immediately
2. Enable two-factor authentication
3. Review your account for suspicious activity
4. [Other specific actions]

Questions:
security@gracefulbooks.com

We sincerely apologize and are taking this very seriously.

Full details: [link to security advisory]
```

## Legal Requirements

### Data Breach Notification Laws

**GDPR (EU users):**
- Notify supervisory authority within 72 hours
- Notify users without undue delay if high risk

**CCPA (California users):**
- Notify users without unreasonable delay

**Other jurisdictions:**
- Check specific requirements
- Contact legal counsel

### Required Information

Document for legal notifications:
- [ ] Date/time of breach
- [ ] Date/time discovered
- [ ] Types of data involved
- [ ] Number of users affected
- [ ] Containment measures taken
- [ ] Remediation plan
- [ ] Contact information

## Post-Incident

### Immediate (< 24 hours)

- [ ] Threat fully contained
- [ ] All users notified if required
- [ ] Legal notifications filed
- [ ] Root cause identified
- [ ] Immediate fixes deployed
- [ ] Security team debriefed

### Short-term (< 1 week)

- [ ] Comprehensive post-mortem
- [ ] Security audit completed
- [ ] Additional fixes implemented
- [ ] Monitoring enhanced
- [ ] Documentation updated
- [ ] Team training on lessons learned

### Long-term (< 1 month)

- [ ] Security improvements deployed
- [ ] Pen testing to verify fixes
- [ ] Incident response plan updated
- [ ] Security review of entire codebase
- [ ] Third-party security audit
- [ ] Public security advisory if appropriate

## Escalation

**Immediate escalation:**
- CTO (Phone: [number])
- CEO (Phone: [number])
- Legal counsel (Phone: [number])
- Security consultant (if retained)
- Law enforcement (if criminal activity)

**External support:**
- Cloudflare security team
- Incident response firm
- Legal counsel specializing in data breaches
- PR firm for reputation management

## Resources

- [OWASP Incident Response Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Incident_Response_Cheat_Sheet.html)
- [NIST Incident Handling Guide](https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final)
- [GDPR Breach Notification](https://gdpr-info.eu/art-33-gdpr/)

---

**Last Updated:** 2026-01-18

**REMEMBER:**
- Act fast but thoughtfully
- Preserve evidence
- Coordinate communications
- Prioritize user security
- Document everything
- Learn and improve
