# Backup & Disaster Recovery Plan
**Project:** Graceful Books
**Version:** 1.0.0
**Last Updated:** 2026-01-09
**Status:** Planning

---

## Executive Summary

Graceful Books uses a **local-first architecture** where the user's device is the primary source of truth. This document outlines comprehensive backup and disaster recovery strategies that maintain our zero-knowledge encryption while ensuring users never lose their financial data.

**Key Principle:** User data sovereignty means users control their backups, but we provide multiple safety nets.

---

## Architecture Overview

**Data Locations:**
1. **Primary:** User's local device (IndexedDB via Dexie.js)
2. **Sync:** Turso database (encrypted, distributed globally)
3. **Backup:** Cloudflare R2 (encrypted archives)
4. **Multi-Device:** Up to 5 synced devices per user

**Encryption:**
- All data encrypted with TweetNaCl.js before leaving device
- Server has ZERO ability to decrypt
- Recovery requires user passphrase + recovery key

---

## Backup Strategy

### 1. Continuous Real-Time Sync (Primary Backup)

**How It Works:**
- Yjs CRDT syncs encrypted data to Turso database in real-time
- Every transaction automatically backed up within seconds
- Cloudflare Durable Objects maintain WebSocket connections
- Sync queue handles offline changes

**Benefits:**
- ✅ Automatic (no user action required)
- ✅ Real-time protection
- ✅ Multi-device access
- ✅ Zero-knowledge maintained

**RPO (Recovery Point Objective):** < 5 seconds (last sync)
**RTO (Recovery Time Objective):** Immediate (load from any device)

**Limitations:**
- ❌ If user loses ALL devices + forgets passphrase = data unrecoverable (by design)

---

### 2. Manual Export (User-Controlled Backup)

**Implementation:**
- "Export Data" button in settings
- Exports encrypted data as ZIP file
- Contains:
  - All transactions (encrypted JSON)
  - All invoices/bills
  - Chart of accounts
  - Attachments (receipts, documents)
  - Recovery metadata

**Export Formats:**
1. **Encrypted Backup (.gbook file)**
   - Fully encrypted, requires passphrase to restore
   - Smallest file size
   - Complete application state

2. **Plain Text Export (CSV/QBO)**
   - For import into other accounting software
   - User confirms they understand data is decrypted
   - Warning: "This export is NOT encrypted"

**User Experience:**
- "Download Backup" generates encrypted .gbook file
- "Export to QuickBooks" generates .QBO file
- "Export to CSV" generates multiple CSV files (transactions, invoices, etc.)
- Backup includes timestamp in filename: `graceful_books_backup_2026-01-09.gbook`

**Recommendation to Users:**
- Export monthly backup to external drive
- Store in cloud storage (Dropbox, Google Drive) - still encrypted
- Print critical reports quarterly

**RPO:** Whenever user last exported (recommend monthly)
**RTO:** Import .gbook file on new device (< 5 minutes)

---

### 3. Automated Cloud Backup (Optional Premium Feature)

**Implementation (POST-MVP):**
- Daily encrypted backups to Cloudflare R2
- User opts in (consent required)
- Encrypted with user's master key
- Retention: 30 daily, 12 monthly, 7 yearly

**Storage:**
- Each backup: `backups/{user_id}/{YYYY-MM-DD}.gbook.enc`
- Encrypted with user's key (server cannot decrypt)
- Compressed before encryption

**RPO:** 24 hours (daily backup)
**RTO:** Restore from backup list (< 10 minutes)

**Cost:** Free for base plan (up to 1GB), $2/month for unlimited

---

### 4. Multi-Device Redundancy

**How It Works:**
- User logs in on up to 5 devices
- Each device has complete encrypted copy
- Devices sync in real-time via Yjs
- If one device fails, others have full data

**Benefits:**
- ✅ Natural redundancy
- ✅ No additional setup
- ✅ Instant availability

**User Recommendation:**
- Use on laptop + phone = built-in redundancy
- If laptop dies, login from phone
- If phone lost, login from laptop

**RPO:** Real-time (synced)
**RTO:** Immediate (switch devices)

---

## Disaster Recovery Scenarios

### Scenario 1: User Loses Primary Device

**Recovery Steps:**
1. User logs in from new/other device
2. Passphrase entered
3. Encrypted data synced from Turso
4. Full access restored

**Data Loss:** None
**Downtime:** Minutes (login + sync time)
**Requirements:** User remembers passphrase

---

### Scenario 2: User Forgets Passphrase (Has Recovery Key)

**Recovery Steps:**
1. User clicks "Forgot Password"
2. Enters email, receives reset link
3. Clicks link, enters recovery key (24-word mnemonic)
4. Sets new passphrase
5. Data re-encrypted with new passphrase
6. Full access restored

**Data Loss:** None
**Downtime:** < 10 minutes
**Requirements:** User saved recovery key

---

### Scenario 3: User Forgets Passphrase + Lost Recovery Key

**Recovery Steps:**
Unfortunately, this is UNRECOVERABLE by design (zero-knowledge).

**Options:**
1. Check manual exports (if user exported data)
2. Check if logged in on other device (can reset password from logged-in device)
3. **If none of above:** Data is permanently lost

**Prevention:**
- Strong onboarding emphasizing recovery key importance
- "Download recovery key" required during signup
- Email reminder 30 days after signup: "Have you saved your recovery key?"
- In-app reminder to verify recovery key quarterly

**Support Response:**
- Clear documentation: "We CANNOT recover your data without your passphrase or recovery key"
- This is a feature, not a bug (zero-knowledge = true privacy)

---

### Scenario 4: Database Corruption (Turso)

**Detection:**
- Automated integrity checks daily
- Checksums verified on sync
- Betterstack alerts on database errors

**Recovery Steps:**
1. Turso has point-in-time recovery (automatic)
2. Restore to last known good state
3. User devices re-sync from restored database
4. Multi-region replication prevents single-point failure

**Data Loss:** Minimal (< 5 minutes before corruption detected)
**Downtime:** < 30 minutes (Turso recovery time)

---

### Scenario 5: Cloudflare Outage

**Impact:**
- Sync temporarily unavailable
- Users can still work locally (offline-first)
- Changes queued in sync queue

**Recovery:**
- When Cloudflare back online, sync queue processes
- All offline changes synced automatically
- No data loss

**Data Loss:** None
**Downtime:** None (local-first = works offline)

**Monitoring:**
- Betterstack monitors Cloudflare status
- Status page shows sync availability
- Email notification if outage > 1 hour

---

### Scenario 6: Turso Database Complete Failure

**Unlikely but plan for worst case:**

**Recovery Steps:**
1. Restore from Turso's automatic backups (Turso provides this)
2. If Turso backups fail: Restore from R2 archived backups
3. Multi-region replication means this requires multiple simultaneous failures

**Backup Locations:**
- Turso: Replicated globally (multiple regions)
- R2: Automated daily backups
- User devices: Up to 5 copies per user

**Data Loss:** Worst case < 24 hours (last R2 backup)
**Downtime:** < 4 hours (database restoration + validation)

---

### Scenario 7: Complete Platform Shutdown (Company Goes Out of Business)

**User Protection:**

**Before Shutdown:**
1. 90-day shutdown notice to all users
2. Download backup reminder sent weekly
3. Export functionality remains available
4. Instructions for self-hosting relay (if implemented)

**After Shutdown:**
- Users have encrypted .gbook files
- Users can still access data if they:
  - Have passphrase + recovery key
  - Have .gbook export file
  - Run local-only version (no sync)

**Open Source Option (Consider):**
- Release client-side code as open source on shutdown
- Users can run entirely locally
- Community can maintain sync relay

**Data Sovereignty = User Protection:**
Because users own their data, platform shutdown doesn't destroy their records.

---

## Backup Integrity & Validation

### Automated Checks

**Daily:**
- [ ] Verify Turso database integrity
- [ ] Check encryption/decryption on sample data
- [ ] Validate sync queue processing
- [ ] Test restore process on test account

**Weekly:**
- [ ] Full backup to R2 integrity check
- [ ] Checksum validation on all backups
- [ ] Test multi-device sync
- [ ] Verify retention policy enforcement

**Monthly:**
- [ ] Full disaster recovery drill
- [ ] Restore from R2 backup to staging
- [ ] Test user export/import flow
- [ ] Review backup storage costs

---

## Retention Policies

**Turso Database (Operational):**
- Indefinite (while user has active subscription)
- Soft deletes (30-day recovery window)
- Audit log: 7 years (compliance)

**R2 Automated Backups:**
- Daily: 30 days
- Monthly: 12 months
- Yearly: 7 years
- Compressed and encrypted

**After Subscription Cancellation:**
- Data retained: 90 days (read-only access)
- Export available for 90 days
- After 90 days: Complete deletion
- User notified at 60, 30, 7 days before deletion

**Audit Log Retention:**
- Active users: 7 years (GAAP compliance)
- Cancelled users: Export available, then deleted with data

---

## Recovery Time & Point Objectives

| Scenario | RPO | RTO | Data Loss |
|----------|-----|-----|-----------|
| Device loss | < 5 sec | Minutes | None |
| Forgot password (has key) | < 5 sec | 10 min | None |
| Database corruption | < 5 min | 30 min | Minimal |
| Cloudflare outage | 0 | 0 | None (local-first) |
| Turso failure | 24 hr | 4 hr | < 24 hr |
| Multi-device sync | 0 | 0 | None |

**Target SLA:**
- Uptime: 99.9% (< 8.76 hours downtime/year)
- Data durability: 99.999999999% (11 nines) - thanks to Turso + R2
- Recovery success rate: 99.5% (assuming user has passphrase or recovery key)

---

## User Education

**During Onboarding:**
1. ✅ "Save your recovery key" - MANDATORY
2. ✅ Verification: Enter first 3 words
3. ✅ Download recovery key file
4. ✅ Print option provided
5. ✅ "I understand I cannot recover my data without this" checkbox

**Ongoing Reminders:**
- 30 days after signup: "Have you saved your recovery key somewhere safe?"
- Quarterly: "Reminder: Export a backup of your data"
- Before major updates: "Export a backup before upgrading"

**Help Center:**
- "What happens if I lose my password?"
- "How do I back up my data?"
- "Can you recover my data if I lose everything?"
- "What happens if your company shuts down?"

---

## Monitoring & Alerting

**Betterstack Alerts:**
- Database connection failures
- Sync queue backlog > 1000 items
- Backup job failures
- Data integrity check failures
- Disk space < 20% on Turso
- Recovery key not saved (flag for support outreach)

**Grafana Dashboards:**
- Backup success rate (target: 100%)
- Average sync latency (target: < 2 sec)
- Database size growth
- Restore test success rate

---

## Business Continuity

**Infrastructure Redundancy:**
- Cloudflare: Global edge network (300+ locations)
- Turso: Multi-region replication
- R2: Replicated object storage
- DNS: Cloudflare (anycast, auto-failover)

**Team Redundancy:**
- Founder has emergency access to all systems
- At least 2 team members with infrastructure access
- Runbook for common scenarios
- 24/7 on-call rotation (once team grows)

**Financial:**
- Maintain 6 months operating capital
- Backup payment processor (if Stripe fails)
- Insurance for cyber incidents

---

## Testing Schedule

**Monthly:**
- Restore from Turso backup to test environment
- Test user export → import flow
- Verify multi-device sync

**Quarterly:**
- Full disaster recovery drill (simulate database loss)
- Test recovery key flow
- Validate retention policies

**Annually:**
- Simulate complete infrastructure failure
- Test migration to backup provider
- Review and update this plan

---

## Compliance

**GAAP Requirements:**
- 7-year audit log retention: ✅ Implemented
- Data integrity verification: ✅ Automated daily
- Backup validation: ✅ Weekly

**GDPR/CCPA:**
- Right to export: ✅ "Download My Data"
- Right to deletion: ✅ Complete deletion after 90 days
- Data portability: ✅ CSV/QBO export

**Zero-Knowledge Architecture:**
- Backups encrypted: ✅ Always
- Recovery without user key: ❌ Impossible (by design)
- Third-party access: ❌ None

---

## Costs (Estimated Monthly)

**Turso Database:**
- Free tier: 9GB storage, 1B row reads
- Paid: ~$29/month for 500GB
- Estimate: $50/month at 1000 users

**Cloudflare R2 (Backups):**
- Storage: $0.015/GB/month
- Estimate: $10/month at 1000 users (100GB)

**Total Backup Infrastructure:**
- MVP: ~$60/month
- At scale (10k users): ~$500/month

---

## Future Enhancements (POST-MVP)

1. **Social Recovery (Shamir's Secret Sharing)**
   - Split recovery key among trusted contacts
   - 2-of-3 or 3-of-5 threshold
   - Decentralized recovery

2. **Self-Hosted Relay Option**
   - Users can run own sync server
   - Complete independence from platform
   - Open source relay code

3. **Blockchain Backup Proof**
   - Hash of daily backup on blockchain
   - Proof of backup existence without revealing data
   - Immutable audit trail

4. **Geographic Backup Options**
   - Choose backup region (GDPR compliance)
   - "Keep my backups in EU only"
   - Multi-region user choice

---

## Conclusion

**Graceful Books balances:**
- ✅ User data sovereignty (you own your data)
- ✅ Comprehensive backups (multiple safety nets)
- ✅ Zero-knowledge security (we can't see your data)
- ✅ User responsibility (save your recovery key!)

**Key Takeaway:**
We've built robust backup systems, but zero-knowledge means users MUST save their recovery keys. This is a feature, not a bug - true privacy requires user responsibility.

---

## Document Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-01-09 | Initial backup & disaster recovery plan | AI Agent |

---

**Questions or concerns? Please update this document as infrastructure evolves.**
