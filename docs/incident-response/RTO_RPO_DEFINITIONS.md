# RTO/RPO Definitions

**Build:** H12 - Incident Response Documentation [MVP]
**Last Updated:** 2026-01-18

## Overview

This document defines Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO) for all Graceful Books services. These metrics guide incident response priorities and infrastructure investment.

## Definitions

### Recovery Time Objective (RTO)

**Definition:** Maximum acceptable time to restore a service after an incident.

**Example:** RTO of 4 hours means service must be restored within 4 hours of outage.

### Recovery Point Objective (RPO)

**Definition:** Maximum acceptable data loss measured in time.

**Example:** RPO of 1 hour means we can lose at most 1 hour of data.

## RTO/RPO by Service

### Frontend (Cloudflare Pages)

**Service:** Web application (React SPA)

| Metric | Target | Rationale |
|--------|--------|-----------|
| **RTO** | 30 minutes | Users can't access application without frontend |
| **RPO** | 0 (no data loss) | Frontend is stateless; rebuild from git |

**Recovery Method:**
- Rollback to previous deployment via Cloudflare Dashboard
- Rebuild and deploy from last known good commit
- Time: 3-5 minutes (rollback) or 10-15 minutes (rebuild)

**Data Storage:**
- None (stateless application)
- All data in browser localStorage (client-side)

**Backup Strategy:**
- Git repository is source of truth
- All deployments tagged in git
- Cloudflare maintains deployment history

---

### Backend (Cloudflare Workers - Sync Relay)

**Service:** API and sync coordination

| Metric | Target | Rationale |
|--------|--------|-----------|
| **RTO** | 15 minutes | Critical for sync; users can work offline temporarily |
| **RPO** | 0 (no data loss) | Workers are stateless; rebuild from git |

**Recovery Method:**
- Rollback to previous deployment via wrangler
- Redeploy from last known good commit
- Time: 2-3 minutes (rollback) or 5-10 minutes (redeploy)

**Data Storage:**
- None (stateless, proxy to database)
- Session data in KV (can be regenerated)

**Backup Strategy:**
- Git repository is source of truth
- Wrangler maintains deployment history (10 versions)
- All secrets in Wrangler Secrets (persist across deployments)

---

### Database (Turso - Sync Database)

**Service:** Sync state and audit trail storage

| Metric | Target | Rationale |
|--------|--------|-----------|
| **RTO** | 2 hours | Most critical data is client-side; sync can wait |
| **RPO** | 24 hours | Daily backups; local-first architecture protects user data |

**Recovery Method:**
- Restore from R2 backup
- Time: 30-60 minutes (depends on database size)
- Verification required before going live

**Data Storage:**
- Sync changes queue
- User metadata
- Audit trail
- Multi-user access records

**Backup Strategy:**
- **Automatic backups:** Daily at 02:00 UTC
- **Backup retention:** 30 days
- **Backup location:** Cloudflare R2
- **Backup verification:** Weekly automated test restore
- **Point-in-time recovery:** Via Turso native features

**Critical Note:**
User financial data is encrypted and stored client-side. Database only stores:
- Encrypted sync deltas
- User accounts (email, hashed password)
- Audit logs

Therefore, 24-hour RPO is acceptable - users' actual financial data is safe locally.

---

### Key-Value Store (Cloudflare KV)

**Service:** Session storage and caching

| Metric | Target | Rationale |
|--------|--------|-----------|
| **RTO** | 1 hour | Non-critical; sessions can be regenerated |
| **RPO** | 24 hours | Daily backup; acceptable to lose session data |

**Recovery Method:**
- Recreate KV namespace
- Users re-authenticate
- Time: 15-30 minutes

**Data Storage:**
- User sessions (temporary)
- Rate limiting counters (can reset)
- Cache data (can rebuild)

**Backup Strategy:**
- **Automatic backups:** Daily export to R2
- **Backup retention:** 7 days
- **Recovery:** Restore from backup if needed (rare)

**Note:** KV data is non-critical and can be regenerated, so aggressive RTO/RPO acceptable.

---

### Object Storage (Cloudflare R2)

**Service:** Backups and file storage

| Metric | Target | Rationale |
|--------|--------|-----------|
| **RTO** | 4 hours | Contains backups; critical for disaster recovery |
| **RPO** | 0 (versioned) | Object versioning prevents data loss |

**Recovery Method:**
- Cloudflare's infrastructure handles availability
- Enable versioning for all buckets
- Time: N/A (managed service)

**Data Storage:**
- Database backups
- Application logs
- Audit trail exports
- User exports (if feature exists)

**Backup Strategy:**
- **Versioning:** Enabled on all buckets
- **Lifecycle:** 30-day retention for backups
- **Geo-replication:** Cloudflare handles automatically

---

### DNS (Cloudflare DNS)

**Service:** Domain name resolution

| Metric | Target | Rationale |
|--------|--------|-----------|
| **RTO** | 1 hour | Critical but Cloudflare highly available |
| **RPO** | 0 (configuration) | DNS config in Terraform; instant recovery |

**Recovery Method:**
- Reapply Terraform configuration
- Manual DNS configuration via Dashboard
- Time: 10-20 minutes + DNS propagation

**Data Storage:**
- DNS records (A, AAAA, CNAME, TXT, etc.)
- All configuration in Terraform

**Backup Strategy:**
- Terraform state in version control
- Manual backup of DNS records quarterly
- Cloudflare maintains change history

---

### Infrastructure as Code (Terraform State)

**Service:** Infrastructure configuration

| Metric | Target | Rationale |
|--------|--------|-----------|
| **RTO** | 2 hours | Needed for infrastructure changes |
| **RPO** | 0 (versioned) | Git provides point-in-time recovery |

**Recovery Method:**
- Restore from git history
- Rebuild state from actual infrastructure
- Time: 1-2 hours (depends on complexity)

**Data Storage:**
- Terraform state files
- Configuration (.tf files)

**Backup Strategy:**
- **Primary:** Git repository (version controlled)
- **Secondary:** Terraform Cloud backend (if used)
- **Verification:** State refresh weekly

---

## Service Dependencies

```
                   ┌─────────┐
                   │   DNS   │
                   └────┬────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
     ┌────┴────┐   ┌────┴────┐   ┌───┴────┐
     │ Pages   │   │ Workers │   │   R2   │
     │ (Frontend)   │  (API)  │   │(Backup)│
     └─────────┘   └────┬────┘   └────────┘
                        │
                   ┌────┴────┐
                   │Database │
                   │ (Turso) │
                   └─────────┘
```

**Impact of Dependencies:**

- **DNS down:** Everything unreachable → RTO: 1 hour
- **Pages down:** App unreachable but Workers still work → RTO: 30 min
- **Workers down:** No sync, but app still loads and works offline → RTO: 15 min
- **Database down:** No sync, Workers return errors → RTO: 2 hours
- **R2 down:** No backups, but services still work → RTO: 4 hours

## Disaster Recovery Scenarios

### Scenario 1: Complete Cloudflare Outage

**Probability:** Very Low
**Impact:** Total service outage

**RTO:** 8 hours (time to migrate to alternative)
**RPO:** 24 hours (last database backup)

**Recovery Plan:**
1. Confirm Cloudflare status (not just our issue)
2. Monitor Cloudflare status page
3. If extended outage (>4 hours):
   - Consider emergency migration to alternative CDN
   - Use backup DNS provider
   - Deploy to alternative hosting (AWS/Vercel)
4. Communicate extensively to users

**Prevention:**
- Multi-cloud strategy (future consideration)
- Backup DNS provider configured
- Regular disaster recovery drills

---

### Scenario 2: Database Corruption

**Probability:** Low
**Impact:** Data integrity issues, sync broken

**RTO:** 4 hours (restore from backup)
**RPO:** 24 hours (last backup)

**Recovery Plan:**
1. Stop all writes (disable Workers)
2. Assess corruption extent
3. Determine if recent backup is viable
4. Restore from last known good backup
5. Verify data integrity
6. Re-enable Workers
7. Notify users of potential data loss

**Prevention:**
- Daily automated backups
- Weekly backup verification
- Database health monitoring
- Audit trail for all changes

---

### Scenario 3: Accidental Data Deletion

**Probability:** Medium
**Impact:** User data loss

**RTO:** 2 hours (restore specific data)
**RPO:** 24 hours (last backup)

**Recovery Plan:**
1. Identify what was deleted and when
2. Check if audit trail shows deletion
3. Restore from backup to staging
4. Extract deleted data
5. Merge back into production
6. Verify with affected users

**Prevention:**
- Soft deletes (mark deleted, don't remove)
- Audit trail for all destructive operations
- Require confirmation for bulk deletes
- Periodic backup testing

---

### Scenario 4: Security Breach

**Probability:** Low-Medium
**Impact:** Potential data exposure

**RTO:** Immediate (containment) → 24 hours (full recovery)
**RPO:** 0 (no data loss acceptable)

**Recovery Plan:**
1. Immediately contain breach (disable affected systems)
2. Assess data exposure
3. Rotate all credentials and secrets
4. Deploy security fixes
5. Restore from clean backup if compromised
6. Notify users and authorities (if required)
7. Comprehensive security audit

**Prevention:**
- Security scanning in CI/CD
- Dependency audits
- Penetration testing
- Security incident response plan
- Zero-knowledge encryption (limits breach impact)

---

### Scenario 5: Regional Failure

**Probability:** Medium
**Impact:** Degraded performance for one geography

**RTO:** 30 minutes (failover to other regions)
**RPO:** 0 (multi-region sync)

**Recovery Plan:**
1. Automatic failover to healthy regions
2. Monitor for automatic recovery
3. If prolonged, investigate root cause
4. If needed, manually fail over traffic

**Prevention:**
- Multi-region deployment (US, EU, AP)
- Health checks and automatic failover
- Regional redundancy for database

---

## RTO/RPO Testing

### Monthly Tests

- Test rollback procedures (Workers, Pages)
- Verify backup integrity
- Test monitoring and alerting

### Quarterly Tests

- Full disaster recovery drill
- Database restore from backup
- Infrastructure recreation from Terraform
- Test failover scenarios

### Annual Tests

- Complete disaster recovery simulation
- Multi-component failure scenarios
- Team response coordination
- Update all documentation

### Test Documentation

After each test, document:
- Date and participants
- Scenario tested
- Actual time to recover (vs. RTO)
- Issues discovered
- Improvements needed

---

## RTO/RPO Monitoring

### Metrics to Track

- **Actual recovery time** per incident
- **Data loss** per incident (compare to RPO)
- **Backup success rate** (target: 100%)
- **Backup verification** (target: weekly)
- **Drill completion** (target: 100% per quarter)

### Monthly Review

Review:
- All incidents and actual RTO/RPO
- Backup health
- Test results
- Adjust targets if needed

### Annual Review

Comprehensive review:
- Are RTO/RPO targets still appropriate?
- Has architecture changed requiring new targets?
- What investments needed to improve RTO/RPO?
- Update this document

---

## Backup Schedule Summary

| Service | Frequency | Retention | Verification | Location |
|---------|-----------|-----------|--------------|----------|
| **Database** | Daily (02:00 UTC) | 30 days | Weekly restore test | R2 |
| **KV Store** | Daily (03:00 UTC) | 7 days | Monthly export check | R2 |
| **Infrastructure** | On every change | Infinite (git) | Weekly state refresh | Git |
| **Application Code** | On every commit | Infinite | CI tests | Git |
| **Terraform State** | On every apply | Infinite (git) | Weekly plan check | Git + Cloud |

---

## Cost of Downtime

Understanding the cost of downtime helps prioritize recovery efforts:

| Scenario | Cost Impact | Priority |
|----------|-------------|----------|
| **Complete outage (1 hour)** | High user frustration, potential churn | Critical |
| **Sync down (1 hour)** | Medium - users can work offline | High |
| **Slow performance (1 hour)** | Low - usable but frustrating | Medium |
| **One region down (1 hour)** | Low - automatic failover | Medium |
| **Non-critical feature down (1 hour)** | Very low - workarounds exist | Low |

**Priority drives RTO/RPO targets:**
- Critical → Aggressive RTO/RPO
- High → Moderate RTO/RPO
- Medium/Low → Relaxed RTO/RPO

---

## Improvement Roadmap

### Current State (H12)

✅ Documented RTO/RPO for all services
✅ Daily database backups
✅ Rollback procedures tested
✅ Multi-region deployment

### Short-term (Next Quarter)

- [ ] Implement automated backup verification
- [ ] Set up backup restore monitoring
- [ ] Create backup dashboard
- [ ] Quarterly disaster recovery drills

### Long-term (Next Year)

- [ ] Reduce database RPO to 1 hour (more frequent backups)
- [ ] Reduce database RTO to 30 minutes (faster restore)
- [ ] Multi-cloud backup strategy
- [ ] Real-time replication for zero RPO (if needed)

---

## Quick Reference

### Critical Services (Aggressive RTO/RPO)

| Service | RTO | RPO |
|---------|-----|-----|
| Workers | 15 min | 0 |
| Pages | 30 min | 0 |

### Important Services (Moderate RTO/RPO)

| Service | RTO | RPO |
|---------|-----|-----|
| Database | 2 hours | 24 hours |
| DNS | 1 hour | 0 |

### Supporting Services (Relaxed RTO/RPO)

| Service | RTO | RPO |
|---------|-----|-----|
| KV Store | 1 hour | 24 hours |
| R2 | 4 hours | 0 (versioned) |

---

**Last Updated:** 2026-01-18
**Version:** 1.0.0

**Remember:** RTO/RPO are targets, not guarantees. They guide priorities and investment, not create legal obligations. Real incidents may exceed targets - that's why we continuously improve.

**Questions?** Slack: #infrastructure
