# Audacious Money - Backup & Sync Architecture Roadmap

**Zero-Knowledge Data Sovereignty with Multi-Tier Backup Safety Net**

---

## Executive Summary

This roadmap implements a comprehensive backup and synchronization system for Audacious Money that preserves zero-knowledge encryption while providing multiple safety nets against data loss. The architecture supports:

- **Local filesystem backups** (automatic, user-controlled location)
- **Email-to-self backups** (emergency recovery mechanism)
- **Encrypted sync relay** (cross-device real-time sync)
- **Multi-user access control** (role-based backup permissions)
- **Admin-controlled key rotation** (instant access revocation)

**Critical Mission Alignment:**
✅ User data sovereignty (visible, tangible ownership)
✅ Zero-knowledge encryption (platform cannot decrypt)
✅ Automatic safety (works invisibly after setup)
✅ Multiple recovery paths (belt + suspenders approach)

---

## Architecture Overview

### Three-Tier Backup System

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER'S DATA (ENCRYPTED)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Tier 1: LOCAL FILESYSTEM BACKUP                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • File System Access API                                 │   │
│  │ • User chooses folder location                           │   │
│  │ • Automatic daily backups + on-demand                    │   │
│  │ • Visible files: audacious-backup-YYYY-MM-DD.encrypted   │   │
│  │ • Survives browser cache clearing                        │   │
│  │ • Source of truth: HISTORICAL SNAPSHOTS                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Tier 2: EMAIL BACKUP (EMERGENCY RECOVERY)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Weekly automated emails to admin                       │   │
│  │ • One-time restoration link (7-day expiration)           │   │
│  │ • Token-based authentication                             │   │
│  │ • Works when devices are lost                            │   │
│  │ • Source of truth: LAST RESORT FALLBACK                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Tier 3: SYNC RELAY (CROSS-DEVICE SYNC)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Real-time encrypted sync                               │   │
│  │ • "Dumb pipe" relay server                               │   │
│  │ • Self-hosted or Audacious-hosted option                 │   │
│  │ • CRDT conflict resolution                               │   │
│  │ • Source of truth: LATEST DATA                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Backup File Structure (Enhanced Option C+)

```typescript
interface SecureBackupBundle {
  version: string; // "1.0"
  metadata: {
    companyId: string;
    userId: string;
    userRole: 'Admin' | 'Manager' | 'Bookkeeper' | 'View-Only';
    timestamp: number;
    keyRotationEpoch: number; // Tracks revocations
  };
  encryptedData: {
    transactions: string; // AES-256-GCM encrypted
    accounts: string;
    reports: string;
    preferences: string;
    // Role-filtered data only
  };
  encryptedKeys: {
    derivedKey: string; // Encrypted with password-derived key (Argon2id)
    salt: string; // Unique per backup (32 bytes)
    iterations: number; // Argon2id params
  };
  integrity: {
    hmac: string; // HMAC-SHA256 of all fields
    hmacSalt: string; // For password-based HMAC verification
  };
}
```

---

## Security Principles (Non-Negotiable)

1. **Zero-Knowledge Encryption**: Platform operator cannot decrypt user data under any circumstances
2. **IDOR Protection**: Users cannot access backups they're not authorized for (HMAC + role validation)
3. **OWASP Top 10 Compliance**: All vulnerabilities mitigated (see security-expert review)
4. **Key Rotation Enforcement**: Revoked users cannot sync new data (epoch tracking)
5. **Audit Trail**: All backup/restore operations logged (7-year retention for GAAP)
6. **Rate Limiting**: Brute force protection on restoration attempts
7. **Integrity Verification**: HMAC prevents backup tampering

---

## Roadmap Phases

### Phase 1: Foundation (Security & Key Management)

**Purpose:** Establish cryptographic foundation for zero-knowledge backups

**Dependencies:** Existing encryption layer, user authentication

**Completion Criteria:** All security infrastructure in place, audit trail operational

#### Tasks

**1.1 Backup Bundle Encryption System**
- Implement `SecureBackupBundle` TypeScript interface
- Create `generateBackupBundle()` function with Argon2id key derivation
- Implement HMAC-SHA256 integrity verification
- Add unique salt generation per backup
- Write unit tests for encryption/decryption flows
- **Security validation:** OWASP A02 (Cryptographic Failures) compliance
- **Joy opportunity:** "Your data is locked with bank-level encryption 🔒"
- **Files:** `src/services/backup/BackupEncryption.ts`

**1.2 Key Rotation Epoch System**
- Add `keyRotationEpoch` field to companies table
- Implement epoch increment on user revocation
- Create `verifyKeyRotationEpoch()` validation function
- Add epoch tracking to IndexedDB schema
- Write tests for epoch verification
- **Security validation:** Prevents revoked users from syncing
- **Files:** `src/services/backup/KeyRotationService.ts`, `src/db/schema.ts`

**1.3 Role-Based Backup Filtering**
- Implement data filtering by user permission level
- Create `filterDataByRole()` function
- Admin sees full company data, others see role-filtered data
- Write tests for each permission level (Admin/Manager/Bookkeeper/View-Only)
- **Security validation:** IDOR protection (A01: Broken Access Control)
- **Files:** `src/services/backup/RoleFilterService.ts`

**1.4 Immutable Audit Trail**
- Create `audit_log` table (blockchain-style chaining)
- Implement `logAuditEvent()` with previous event hash
- Add events: BACKUP_CREATED, BACKUP_RESTORED, BACKUP_DELETED, KEY_ROTATED
- Implement `verifyAuditChain()` integrity checker
- 7-year retention policy (GAAP compliance)
- Write tests for audit chain verification
- **Security validation:** OWASP A08 (Data Integrity Failures) compliance
- **Joy opportunity:** "Complete transparency - every action logged ✓"
- **Files:** `src/services/audit/AuditLogger.ts`, `src/db/schema.ts`

**1.5 Password-Based Key Derivation (Argon2id)**
- Integrate Argon2id library (memory-hard KDF)
- Configure parameters: iterations=3, memory=64MB, parallelism=4
- Implement `derivePasswordKey()` function
- Add fallback to PBKDF2 for older browsers
- Write performance tests (should be <1 second)
- **Security validation:** Resistance to brute force attacks
- **Files:** `src/services/crypto/KeyDerivation.ts`

**1.6 HMAC Integrity Verification**
- Implement `generateBackupHMAC()` function
- Include all fields in HMAC calculation (metadata + data + keys)
- Add `verifyBackupIntegrity()` with constant-time comparison
- Write tamper detection tests
- **Security validation:** Detects any modification to backup file
- **Files:** `src/services/backup/IntegrityVerification.ts`

**1.7 Testing & Security Review**
- Run full test suite (unit + integration)
- Conduct penetration testing on encryption layer
- Verify OWASP Top 10 compliance
- Document security architecture
- **Deliverable:** Security audit report
- **Files:** `tests/security/BackupSecurity.test.ts`

---

### Phase 2: Local Filesystem Backup (Primary Safety Net)

**Purpose:** Implement automatic local backups using File System Access API

**Dependencies:** Phase 1 complete

**Completion Criteria:** Users can choose backup location, automatic backups work, restoration tested

#### Tasks

**2.1 File System Access API Integration**
- Detect browser support (Chrome 86+, Edge 86+)
- Implement `requestFolderPermission()` with folder picker
- Store persistent file handle in IndexedDB
- Add permission verification on app startup
- Handle permission revocation gracefully
- Write tests for permission flows
- **Joy opportunity:** "Choose where your backups live - you're in control! 📁"
- **Files:** `src/services/backup/FileSystemBackup.ts`

**2.2 Backup Folder Selection UI (Onboarding)**
- Create onboarding step: "Choose Backup Location"
- Show folder picker on first launch
- Display chosen path in UI (e.g., "Documents/AudaciousBackups")
- "I'll do this later" option (shows warning banner)
- Visual confirmation: "Backups saving to: [path] ✓"
- Follow Audacious Design System styling
- **UX principle:** Steadiness approach - clear, patient guidance
- **Joy opportunity:** "Your data, your location, your control 🎯"
- **Files:** `src/components/onboarding/BackupLocationSetup.tsx`

**2.3 Automatic Backup Triggers**
- Implement debounced backup on data changes (max 1 per 10 seconds)
- Backup on app close (beforeunload event)
- Backup on idle (user inactive for 2 minutes)
- Daily scheduled backup (midnight local time)
- Add manual "Backup Now" button in Settings
- Write tests for each trigger
- **Files:** `src/services/backup/BackupScheduler.ts`

**2.4 Backup File Naming & Versioning**
- Filename format: `audacious-backup-YYYY-MM-DD-HHmmss.encrypted`
- Keep last 10 backups (rolling window)
- Keep 1 daily snapshot (midnight, retain 30 days)
- Auto-delete old backups to prevent clutter
- Add file metadata (size, creation date)
- Write tests for retention policy
- **Joy opportunity:** "Smart cleanup - we keep what matters, not clutter ✨"
- **Files:** `src/services/backup/BackupVersioning.ts`

**2.5 Backup Writing & Storage**
- Implement `writeBackupToFile()` function
- Use FileSystemFileHandle.createWritable()
- Write JSON backup bundle to file
- Add progress indicator for large backups
- Handle disk space errors gracefully
- Write tests for file operations
- **Files:** `src/services/backup/FileSystemBackup.ts`

**2.6 Restoration from Local Backup**
- Implement `restoreFromLocalBackup()` function
- Auto-detect backups on app startup (if database empty)
- Show restoration modal: "We found a backup. Restore it?"
- Password prompt for decryption
- Progress indicator during restoration
- Success confirmation with celebration animation
- Write tests for restoration flow
- **Joy opportunity:** "Welcome back! Your data is safe and sound 🎉"
- **Files:** `src/services/backup/BackupRestoration.ts`

**2.7 Settings Panel - Backup Status UI**
- Create Settings → Data Safety panel
- Show backup status:
  - ✅ Automatic local backups: ON
  - 📁 Saving to: [path]
  - 📅 Last backup: [timestamp]
  - [Change Location] button
  - [Backup Now] button
- Show backup history (last 10 backups)
- Add "Download Backup" option (manual export)
- Follow Audacious Design System styling
- **Joy opportunity:** "Peace of mind in one glance 😌"
- **Files:** `src/components/settings/DataSafetyPanel.tsx`

**2.8 Fallback for Unsupported Browsers**
- Detect if File System Access API not available
- Show notification: "Browser doesn't support automatic backups"
- Offer manual download/upload alternative
- Guide users to supported browsers (Chrome, Edge)
- Test on Safari, Firefox (unsupported)
- **Files:** `src/services/backup/BackupFallback.ts`

**2.9 Testing & UX Validation**
- Test backup creation, versioning, restoration
- Test permission handling (granted, denied, revoked)
- Test disk space errors
- User testing: Can non-technical users set it up?
- Verify celebration animations work
- **Deliverable:** User testing report
- **Files:** `tests/e2e/LocalBackup.test.ts`

---

### Phase 3: Email Backup (Emergency Recovery)

**Purpose:** Implement automated email backups with secure restoration links

**Dependencies:** Phase 2 complete, email service configured

**Completion Criteria:** Admin receives weekly emails, restoration via email link works

#### Tasks

**3.1 Restoration Token System**
- Create `restoration_tokens` database table
- Generate cryptographically secure tokens (UUIDs)
- Store token hash (SHA-256), not plaintext
- Add fields: userId, companyId, backupId, expiresAt (7 days), used (boolean)
- Implement token validation with rate limiting
- Write tests for token generation/verification
- **Security validation:** IDOR protection, one-time use
- **Files:** `src/services/backup/RestorationTokenService.ts`

**3.2 Encrypted Backup Storage (Server-Side)**
- Set up S3 bucket for temporary backup storage
- Server-side encryption: AES-256 + KMS
- Bucket configuration:
  - Versioning enabled
  - 7-day auto-deletion lifecycle
  - Public access blocked
  - Access logging enabled
- Implement `uploadBackupToS3()` function
- Write tests for S3 operations
- **Security validation:** Defense in depth (client + server encryption)
- **Files:** `audacious_money_backend/services/BackupStorage.ts`

**3.3 Email Template Design**
- Create HTML email template (responsive)
- Subject: "Your Audacious Money Backup is Ready"
- Content:
  - Backup creation date
  - Restoration link (one-time use, 7-day expiration)
  - Step-by-step restoration instructions
  - Security notice (password required)
  - "If you didn't request this" warning
- Follow Audacious Money branding
- Test email rendering across clients
- **Joy opportunity:** "Your safety net, delivered to your inbox 📧"
- **Files:** `audacious_money_backend/templates/BackupEmail.html`

**3.4 Automated Email Scheduling**
- Implement configurable email scheduling system
- Default: Weekly backups (Sundays at 1 AM)
- Smart scheduling logic:
  - Daily backups on high-transaction days (user-defined threshold)
  - Immediate backup after major milestones (first invoice, month-end close, etc.)
  - User-configurable frequency in Settings (daily/weekly/monthly)
- Admin-only by default (configurable to grant permission to other users)
- Check if user enabled email backups (opt-in)
- Generate backup, upload to S3, send email
- Log all email backup events to audit trail
- Write tests for scheduling logic and smart triggers
- **Files:** `audacious_money_backend/jobs/EmailBackupScheduler.ts`

**3.5 Admin Permission Grants**
- Add "Email Backup Permissions" to Admin settings
- Admin can grant email backup permission to other users
- Role-filtered backups sent to non-admin users
- UI: Checkbox list of users with "Grant Email Backup" toggle
- Write tests for permission management
- **Files:** `src/components/admin/EmailBackupPermissions.tsx`

**3.6 Restoration Link Handler**
- Create `/restore?token=UUID&backup=UUID` route
- Validate token format (prevent injection)
- Rate limiting: 10 attempts per hour per IP, 5 per token
- Check token expiration and usage status
- Show password prompt page (NOT backup data yet)
- CSRF protection with session token
- Write tests for all validation checks
- **Security validation:** OWASP A07 (Authentication Failures) compliance
- **Files:** `src/pages/RestorePage.tsx`, `audacious_money_backend/routes/restore.ts`

**3.7 Password Entry & Decryption Flow**
- Password input form with MFA option (if enabled)
- Submit password → fetch encrypted backup from S3
- Mark token as used (prevent replay attacks)
- Delete backup from S3 (one-time use)
- Client-side decryption with password
- Progress indicator during restoration
- Success celebration animation
- Write tests for full flow
- **Joy opportunity:** "One password, all your data restored 🔑"
- **Files:** `src/components/restore/PasswordPrompt.tsx`

**3.8 Email Notification on Restoration**
- Send email to user when restoration link is accessed
- Content: timestamp, IP address, device info
- "If this wasn't you, secure your account" warning
- Link to security settings
- Write tests for notification sending
- **Security validation:** User awareness of access attempts
- **Files:** `audacious_money_backend/services/NotificationService.ts`

**3.9 Testing & Security Review**
- Test full email backup → restoration flow
- Test token expiration, reuse prevention
- Test rate limiting effectiveness
- Penetration testing on restoration endpoint
- Verify email deliverability (spam filters)
- **Deliverable:** Email backup security audit
- **Files:** `tests/e2e/EmailBackup.test.ts`

---

### Phase 4: Sync Relay Integration (Cross-Device Sync)

**Purpose:** Implement encrypted sync relay for real-time multi-device synchronization

**Dependencies:** Phase 3 complete, CRDT system ready

**Completion Criteria:** Multiple devices sync automatically, conflicts resolved, revocation works

#### Tasks

**4.1 Sync Relay Server Setup**
- Set up Node.js WebSocket server
- PostgreSQL database for sync data storage
- Table: `sync_data` (companyId, userId, encryptedPayload, timestamp, epoch)
- Redis for real-time pub/sub
- Implement authorization middleware
- Write tests for server setup
- **Files:** `audacious_money_sync/server.ts`

**4.2 Client-Side Sync Service**
- Implement WebSocket client connection
- Auto-reconnect on disconnect (exponential backoff)
- Connection status UI indicator
- Queue changes when offline
- Batch changes for efficient sync
- Write tests for connection handling
- **Files:** `src/services/sync/SyncClient.ts`

**4.3 Payload Signature Verification**
- Implement HMAC signature generation (client-side)
- Use user's derived key to sign payload
- Server validates signature before accepting data
- Prevents unauthorized sync requests
- Write tests for signature verification
- **Security validation:** IDOR protection, prevents relay injection
- **Files:** `src/services/sync/SignatureService.ts`, `audacious_money_sync/middleware/auth.ts`

**4.4 Epoch-Based Authorization**
- Server checks keyRotationEpoch on every sync request
- Compare client epoch vs. current epoch in database
- Reject sync if epoch mismatch (user revoked)
- Return clear error: "Your access has been revoked"
- Write tests for epoch enforcement
- **Security validation:** Instant access revocation
- **Files:** `audacious_money_sync/middleware/epochVerification.ts`

**4.5 CRDT Conflict Resolution**
- Implement CRDT merge algorithm for transactions
- Last-Write-Wins (LWW) for simple fields
- Operational transformation for text fields
- Detect conflicts and merge automatically
- Show conflict resolution UI (rare edge cases)
- Write tests for concurrent edits
- **Files:** `src/services/sync/CRDTMerge.ts`

**4.6 Sync vs. Local Backup Priority**
- Implement timestamp-based conflict resolution
- On restoration: compare backup timestamp vs. relay timestamp
- Use newest data as source of truth
- If equal timestamps, perform CRDT merge
- Show user which source was used
- Write tests for priority logic
- **Files:** `src/services/backup/ConflictResolution.ts`

**4.7 Sync Settings UI**
- Add "Cloud Sync" section to Settings → Data Safety
- Toggle: "Enable cloud sync (encrypted)"
- Options: Self-hosted relay URL or Audacious-hosted
- Connection status indicator
- "Test Connection" button
- Last sync timestamp display
- Follow Audacious Design System styling
- **Joy opportunity:** "All your devices, always in sync ⚡"
- **Files:** `src/components/settings/SyncSettingsPanel.tsx`

**4.8 Rate Limiting & DoS Protection**
- Server-side rate limiting: 100 requests per minute per user
- Payload size limit: 50MB per request
- Total storage limit per company: 5GB
- Connection limit: 5 concurrent connections per user
- Write tests for rate limiting
- **Security validation:** Prevents abuse and DoS attacks
- **Files:** `audacious_money_sync/middleware/rateLimiting.ts`

**4.9 Self-Hosted Relay Documentation**
- Write deployment guide for self-hosted relay
- Docker Compose configuration
- Environment variables documentation
- SSL/TLS setup instructions
- Monitoring and logging setup
- **Deliverable:** `docs/SELF_HOSTED_RELAY.md`

**4.10 Testing & Performance Validation**
- Test multi-device sync (2-5 devices simultaneously)
- Test offline sync queue
- Test conflict resolution accuracy
- Performance: sync latency <500ms
- Load testing: 1000 concurrent users
- **Deliverable:** Sync performance report
- **Files:** `tests/e2e/SyncRelay.test.ts`

---

### Phase 5: Cross-Device Restoration (New Device Setup)

**Purpose:** Enable seamless data restoration when user gets a new device

**Dependencies:** Phases 2-4 complete

**Completion Criteria:** New device restoration works via all three methods (email, file, sync)

#### Tasks

**5.1 New Device Detection**
- Detect if IndexedDB is empty on app startup
- Show welcome screen: "Welcome back!" or "New here?"
- Branch to restoration flow if existing user
- Branch to onboarding if truly new user
- Write tests for detection logic
- **Files:** `src/services/startup/DeviceDetection.ts`

**5.2 Restoration Options UI**
- Create restoration selection screen
- Three options displayed:
  1. 📧 "Paste email backup link"
  2. 📁 "Upload backup file from your computer"
  3. 🔄 "Connect to sync relay"
- Clear descriptions for each option
- "Which works best for you?" messaging
- Follow Audacious Design System styling
- **Joy opportunity:** "Choose your path - we've got you covered! 🎯"
- **Files:** `src/components/restore/RestorationOptionsScreen.tsx`

**5.3 Email Link Restoration Flow**
- Input field: "Paste your restoration link"
- Validate URL format
- Redirect to password prompt
- Follow Phase 3 restoration flow
- Show progress indicator
- Success celebration
- Write tests for flow
- **Files:** `src/components/restore/EmailLinkRestore.tsx`

**5.4 File Upload Restoration Flow**
- File picker: "Choose your backup file (.encrypted)"
- Validate file format and integrity
- Password prompt
- Decrypt and restore data
- Show progress indicator
- Success celebration
- Write tests for flow
- **Joy opportunity:** "Drop your backup, enter your password, done! ✨"
- **Files:** `src/components/restore/FileUploadRestore.tsx`

**5.5 Sync Relay Restoration Flow**
- Input field: "Sync relay URL" (optional, default to Audacious-hosted)
- Login with credentials
- Fetch encrypted data from relay
- Decrypt with password
- Sync to local IndexedDB
- Show progress indicator
- Success celebration
- Write tests for flow
- **Files:** `src/components/restore/SyncRelayRestore.tsx`

**5.6 Multi-Step Progress Indicator**
- Visual stepper: "Connecting → Downloading → Decrypting → Restoring → Done"
- Percentage progress for each step
- Estimated time remaining
- Cancel button (with confirmation)
- Error handling with retry option
- **Joy opportunity:** "Watch your data come home 🏠"
- **Files:** `src/components/restore/RestorationProgress.tsx`

**5.7 Post-Restoration Verification**
- Verify data integrity after restoration
- Check all tables populated
- Validate derived key works
- Test transactions load correctly
- Show summary: "Restored X transactions, Y accounts, etc."
- Write tests for verification
- **Files:** `src/services/restore/VerificationService.ts`

**5.8 Restoration Error Handling**
- Handle corrupt backup files
- Handle wrong password
- Handle network failures
- Handle epoch mismatch (revoked user)
- Clear error messages with recovery steps
- "Contact support" option for each error type
- Write tests for all error scenarios
- **UX principle:** Never blame user, always offer help
- **Files:** `src/services/restore/ErrorHandler.ts`

**5.9 Testing & UX Validation**
- Test all three restoration paths
- Test on multiple devices simultaneously
- User testing: Can non-technical users restore?
- Test error recovery flows
- Verify celebration animations
- **Deliverable:** Cross-device restoration UX report
- **Files:** `tests/e2e/CrossDeviceRestore.test.ts`

---

### Phase 6: Admin Controls (Revocation & Audit)

**Purpose:** Provide admins with tools to manage access, revoke users, and audit activity

**Dependencies:** All previous phases complete

**Completion Criteria:** Admins can revoke access, generate exports, view audit logs

#### Tasks

**6.1 Admin Dashboard - User Access Management**
- Create Admin → Team Access page
- List all users with their roles
- Show last sync timestamp per user
- "Revoke Access" button per user
- Confirmation modal: "This will rotate encryption keys"
- Follow Audacious Design System styling
- **Files:** `src/components/admin/TeamAccessManagement.tsx`

**6.2 Key Rotation on Revocation**
- Implement `revokeUserAccess(userId)` function
- Generate new master encryption key
- Re-encrypt all company data with new key
- Generate new derived keys for remaining users
- Increment keyRotationEpoch
- Notify remaining users of key update
- Write tests for full rotation flow
- **Security validation:** Revoked user cannot decrypt new data
- **Files:** `src/services/admin/KeyRotationService.ts`

**6.3 Historical Snapshot Export**
- Implement "Export Before Revocation" option
- Admin generates backup of current data
- Offer download to revoked user (optional)
- Include metadata: "Data as of [date]"
- User receives read-only historical copy
- Write tests for export generation
- **Ethical consideration:** User keeps what they contributed to
- **Files:** `src/services/admin/HistoricalExport.ts`

**6.4 Revoked User Experience**
- Detect revocation on next sync attempt (epoch mismatch)
- Show notification: "Your access has been revoked"
- Allow read-only access to local/old backup data
- Disable sync functionality
- "Contact admin to restore access" message
- Write tests for revoked user flow
- **UX principle:** Respectful communication, clear next steps
- **Files:** `src/services/sync/RevocationHandler.ts`

**6.5 Audit Log Viewer (Admin)**
- Create Admin → Audit Log page
- Filterable table: timestamp, user, event type, details
- Events: BACKUP_CREATED, RESTORED, DELETED, KEY_ROTATED, USER_REVOKED
- Search functionality
- Export audit log (CSV)
- Verify audit chain integrity button
- Follow Audacious Design System styling
- **Joy opportunity:** "Complete transparency - every action tracked 🔍"
- **Files:** `src/components/admin/AuditLogViewer.tsx`

**6.6 Audit Chain Integrity Verification**
- Implement `verifyAuditChain()` function
- Check HMAC of each event
- Verify previous event hash matches
- Alert if tampering detected
- Display verification status in UI
- Write tests for integrity checks
- **Security validation:** Immutable audit trail
- **Files:** `src/services/audit/IntegrityVerifier.ts`

**6.7 Backup Permissions Management**
- Admin → Settings → Backup Permissions page
- List all users with email backup toggle
- Grant/revoke email backup permission per user
- Role-filtered backups for non-admins
- Save preferences to database
- Write tests for permission changes
- **Files:** `src/components/admin/BackupPermissions.tsx`

**6.8 Admin Notifications**
- Email admin on key rotation
- Email admin on failed restoration attempts (security alert)
- Email admin on audit chain tampering detection
- Configurable notification preferences
- Write tests for notification sending
- **Files:** `audacious_money_backend/services/AdminNotifications.ts`

**6.9 Testing & Security Review**
- Test full revocation → key rotation flow
- Test historical export generation
- Test audit log integrity
- Penetration testing on admin controls
- Verify IDOR protection on admin endpoints
- **Deliverable:** Admin controls security audit
- **Files:** `tests/e2e/AdminControls.test.ts`

---

## User Experience Flows

### Flow 1: First-Time User Setup

```
1. User signs up → Onboarding starts
2. Step: "Choose where to save your backups"
   - Folder picker appears
   - User selects: Documents/AudaciousBackups
   - Confirmation: "Backups saving to: Documents/AudaciousBackups ✓"
3. Background: First backup created automatically
4. User continues with normal onboarding
5. Settings shows: "Last backup: 2 minutes ago"
```

**Messaging:** "Let's keep your data safe! Choose where you'd like Audacious Money to save automatic backups on your computer. This happens behind the scenes - you won't have to think about it again."

---

### Flow 2: Browser Cache Cleared (Data Loss Scenario)

```
1. User opens app → IndexedDB empty (cache cleared)
2. App detects local backup files in chosen folder
3. Modal appears: "We found your backup! Restore your data?"
   - Shows: Last backup date, file size
   - [Restore My Data] [Start Fresh]
4. User clicks "Restore My Data"
5. Password prompt: "Enter your password to decrypt"
6. Progress indicator: Decrypting → Restoring → Done
7. Success animation: Confetti + "Welcome back! Your data is safe and sound 🎉"
8. User continues working normally
```

**Messaging:** "Oops! It looks like your browser data was cleared. No worries - we found your backup from [date]. Let's get you back up and running!"

---

### Flow 3: New Device Setup (Email Restoration)

```
1. User gets new laptop
2. Opens Audacious Money for first time
3. Screen: "Welcome back! Restore your data:"
   - Option 1: 📧 Paste email backup link
   - Option 2: 📁 Upload backup file
   - Option 3: 🔄 Connect to sync relay
4. User checks email → finds weekly backup email
5. Clicks "Restore My Data" link in email
6. Password prompt: "Enter your password to decrypt"
7. Progress: Downloading → Decrypting → Restoring → Done
8. Success celebration: "You're all set on your new device! 🎉"
9. Background: Sync relay connects, syncs latest changes
```

**Messaging (Email):** "Your weekly backup is ready! If you ever need to restore your data (new device, browser issue, etc.), just click this link. It works once and expires in 7 days."

---

### Flow 4: Multi-Device Sync (Power User)

```
1. User enables sync in Settings
2. Toggle: "Enable cloud sync (encrypted)" → ON
3. Chooses: Audacious-hosted relay (default)
4. Connection indicator: "Connected ✓"
5. User edits transaction on laptop
6. Change syncs to relay within 500ms
7. User opens app on phone
8. Change appears automatically
9. Settings shows: "Last sync: Just now"
```

**Messaging:** "All your devices, always in sync. Changes appear everywhere instantly - like magic, but encrypted! ⚡"

---

### Flow 5: User Revocation (Admin Action)

```
1. Admin → Team Access → Clicks "Revoke" for user Bob
2. Modal: "This will rotate encryption keys for security. Bob's access will end immediately."
3. Optional: "Generate historical export for Bob?" [Yes] [No]
4. Admin clicks "Confirm Revocation"
5. Background: Key rotation happens (re-encrypt all data)
6. Bob's next sync attempt fails (epoch mismatch)
7. Bob sees: "Your access has been revoked. Contact [admin email] to restore access."
8. Bob can still view his old local backups (historical data)
9. Bob cannot sync new data
10. Audit log records: "USER_REVOKED: Bob, by Admin, at [timestamp]"
```

**Messaging (Admin):** "Revoking access is instant and secure. Bob won't be able to access new data, but he'll keep historical records he helped create."

---

## Testing Requirements

### Unit Tests (Per Phase)

- **Phase 1:** Encryption, HMAC, key derivation, epoch tracking (100+ tests)
- **Phase 2:** File operations, versioning, restoration (80+ tests)
- **Phase 3:** Token generation, email sending, S3 operations (60+ tests)
- **Phase 4:** Sync logic, CRDT merge, signature verification (90+ tests)
- **Phase 5:** Restoration flows, error handling (50+ tests)
- **Phase 6:** Admin controls, revocation, audit logs (70+ tests)

**Total:** 450+ unit tests

---

### Integration Tests

- Backup creation → restoration (all three tiers)
- Multi-device sync with conflicts
- Key rotation → revoked user blocked
- Audit log integrity verification
- Cross-tier restoration (email → local → sync)

**Total:** 30+ integration tests

---

### End-to-End Tests (Critical Flows)

1. First-time user setup → backup created → browser cleared → restoration
2. Email backup → new device → restoration via link
3. Multi-device sync → conflict → automatic merge
4. Admin revokes user → user blocked → historical access retained
5. Backup tampering → HMAC failure → restoration blocked

**Total:** 15+ E2E tests

---

### Security Testing

- OWASP Top 10 validation
- IDOR penetration testing
- Brute force testing (rate limiting)
- Token enumeration testing
- Epoch bypass attempts
- Sync relay injection attempts
- Audit log tampering attempts

**Deliverable:** Full security audit report

---

## Performance Targets

| Operation | Target | Acceptable | Unacceptable |
|-----------|--------|------------|--------------|
| Backup creation | <2 seconds | <5 seconds | >5 seconds |
| Restoration (local) | <5 seconds | <10 seconds | >10 seconds |
| Restoration (email) | <15 seconds | <30 seconds | >30 seconds |
| Sync latency | <500ms | <1 second | >1 second |
| Key rotation | <10 seconds | <20 seconds | >20 seconds |
| Password derivation (Argon2id) | <1 second | <2 seconds | >2 seconds |

---

## Browser Support

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| File System Access API | ✅ 86+ | ✅ 86+ | ❌ | ❌ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| Web Crypto API | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ✅ | ✅ | ✅ |

**Fallback Strategy:**
- Firefox/Safari users get manual download/upload only (no automatic File System Access)
- Show banner: "For automatic backups, use Chrome or Edge"
- All other features work universally

---

## Success Metrics

### User Adoption
- 90%+ of users complete backup setup during onboarding
- 80%+ of users have at least 1 successful local backup within first week
- 60%+ of users enable sync relay within first month
- 40%+ of admins enable email backups

### Reliability
- 99.9% backup success rate
- 99.5% restoration success rate
- <0.1% data loss incidents
- <1% sync conflicts requiring manual intervention

### Security
- Zero security breaches related to backup system
- 100% OWASP Top 10 compliance
- Zero successful IDOR attacks
- 100% audit trail integrity

### Performance
- 95% of operations within target performance
- <1% user complaints about backup speed
- <5% sync latency exceedances

---

## Communication Guidelines (Steadiness Approach)

### General Tone
- **Patient:** "Take your time with this. Here's exactly what happens next..."
- **Clear:** Step-by-step instructions, no jargon
- **Reassuring:** "Your data is safe" messaging throughout
- **Empowering:** "You're in control" emphasis

### Error Messages (Never Blame User)
- ❌ "Invalid password"
- ✅ "That password didn't work. Want to try again?"

- ❌ "Backup failed"
- ✅ "Oops! Something unexpected happened. Let's try that backup again."

- ❌ "Permission denied"
- ✅ "We need your permission to save backups. Would you like to choose a location now?"

### Success Messages (Micro-Celebrations)
- "Backup complete! Your data is safe and sound 🎉"
- "Restoration successful! Welcome back 😊"
- "All synced up! Your devices are in perfect harmony ✨"

### Security Messaging (Transparency)
- "Your backup is encrypted with bank-level security 🔒"
- "We can't see your data - only you have the key 🔑"
- "Every action is logged for your peace of mind 📋"

---

## Implementation Order (Critical Path)

**Sequential Dependencies:**

```
Phase 1 (Foundation)
    ↓ Must complete before Phase 2
Phase 2 (Local Filesystem Backup)
    ↓ Must complete before Phase 3
Phase 3 (Email Backup)
    ↓ Must complete before Phase 4
Phase 4 (Sync Relay Integration)
    ↓ Must complete before Phase 5
Phase 5 (Cross-Device Restoration)
    ↓ Must complete before Phase 6
Phase 6 (Admin Controls)
    ↓
COMPLETE - All Tests Pass
```

**Parallel Work Opportunities:**
- Phase 1 + Phase 3 token system can be built simultaneously
- Phase 2 + Phase 4 can have UI work done in parallel with backend
- Phase 6 can start audit log viewer while Phase 5 is being tested

**MVP Priority (Launch-Ready):**
- Phase 1 (Foundation) - **MUST HAVE** - Cannot launch without cryptographic foundation
- Phase 2 (Local Backup) - **MUST HAVE** - Core value proposition for data sovereignty
- Phase 3 (Email Backup) - **NICE TO HAVE** - Enhances recovery options but not required for MVP
- Phase 4 (Sync Relay) - **NICE TO HAVE** - Power user feature, can come post-launch
- Phase 5 (Cross-Device) - **NICE TO HAVE** - Builds on Phase 3-4, post-launch enhancement
- Phase 6 (Admin Controls) - **MUST HAVE** (if multi-user enabled) - Required for team security

**Minimum Viable Launch:** Phase 1 + Phase 2 + Phase 6 (basic version)

**Progression Rule:**
- Each phase must have 100% test pass rate before proceeding to next phase
- No exceptions - testing gates are mandatory
- Security audit required at end of Phase 1, 3, and 6

---

## Dependencies on Existing Systems

### Required Before Starting
- ✅ Encryption layer (AES-256, Argon2id library)
- ✅ User authentication system
- ✅ IndexedDB schema with companies/users tables
- ✅ Admin role permissions
- ✅ Basic settings UI

### Required During Implementation
- 📧 Email service (SendGrid, AWS SES, etc.) - Phase 3
- ☁️ S3 bucket or equivalent storage - Phase 3
- 🔄 WebSocket server hosting - Phase 4
- 🗄️ PostgreSQL database for sync relay - Phase 4

### Optional Enhancements
- 📱 Mobile app (future) - will use same sync relay
- 🔗 Public API (future) - backup export via API
- 🤖 AI insights (future) - analyze backup patterns

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| File System Access API browser support limited | High | Medium | Manual fallback for unsupported browsers |
| Email deliverability issues (spam filters) | Medium | High | SPF/DKIM/DMARC setup, test with major providers |
| S3 costs for backup storage | Low | Medium | 7-day auto-deletion, 5GB per company limit |
| Sync relay downtime | Medium | High | Graceful degradation, offline queue, status page |
| Key rotation performance (large datasets) | Medium | Medium | Background job, progress indicator, batch processing |
| User forgets password (cannot decrypt) | Low | Critical | Clear messaging, recovery options, admin support |
| Backup file tampering | Low | High | HMAC verification, restore blocked if tampered |

---

## Future Enhancements (Post-Launch)

### Phase 7: Advanced Security Features
**Dependencies:** Phases 1-6 complete, production-tested

- **MFA for restoration:** Two-factor authentication for extra security
- **Backup versioning:** Restore to any point in time (snapshots)
- **Key escrow:** Shamir's Secret Sharing for admin disaster recovery
- **Disaster recovery drills:** Automated quarterly testing
- **Security dashboard:** User-facing transparency and insights
- **Backup encryption key rotation:** Rotate encryption keys periodically
- **Blockchain audit trail:** Immutable, publicly verifiable audit logs
- **Peer-to-peer sync:** Direct device-to-device sync (no relay)

### Phase 8: Enterprise Features
**Dependencies:** Phase 7 complete, enterprise customer demand validated

- **SSO integration:** SAML/OAuth for enterprise auth
- **Custom retention policies:** Configurable backup retention
- **Compliance reporting:** SOC 2, GDPR, HIPAA compliance reports
- **Multi-region sync relays:** Global distribution for performance
- **Audit log export:** Scheduled exports to SIEM systems
- **Advanced admin controls:** Granular permission management

---

## Appendix: File Structure

```
src/
├── services/
│   ├── backup/
│   │   ├── BackupEncryption.ts
│   │   ├── BackupScheduler.ts
│   │   ├── BackupVersioning.ts
│   │   ├── FileSystemBackup.ts
│   │   ├── BackupRestoration.ts
│   │   ├── BackupFallback.ts
│   │   ├── IntegrityVerification.ts
│   │   ├── ConflictResolution.ts
│   │   └── RoleFilterService.ts
│   ├── sync/
│   │   ├── SyncClient.ts
│   │   ├── SignatureService.ts
│   │   ├── CRDTMerge.ts
│   │   └── RevocationHandler.ts
│   ├── admin/
│   │   ├── KeyRotationService.ts
│   │   └── HistoricalExport.ts
│   ├── audit/
│   │   ├── AuditLogger.ts
│   │   └── IntegrityVerifier.ts
│   ├── crypto/
│   │   └── KeyDerivation.ts
│   ├── restore/
│   │   ├── VerificationService.ts
│   │   └── ErrorHandler.ts
│   └── startup/
│       └── DeviceDetection.ts
├── components/
│   ├── onboarding/
│   │   └── BackupLocationSetup.tsx
│   ├── settings/
│   │   ├── DataSafetyPanel.tsx
│   │   └── SyncSettingsPanel.tsx
│   ├── restore/
│   │   ├── RestorationOptionsScreen.tsx
│   │   ├── EmailLinkRestore.tsx
│   │   ├── FileUploadRestore.tsx
│   │   ├── SyncRelayRestore.tsx
│   │   ├── RestorationProgress.tsx
│   │   └── PasswordPrompt.tsx
│   └── admin/
│       ├── TeamAccessManagement.tsx
│       ├── EmailBackupPermissions.tsx
│       ├── BackupPermissions.tsx
│       └── AuditLogViewer.tsx
├── pages/
│   └── RestorePage.tsx
└── db/
    └── schema.ts (updated with audit_log, restoration_tokens tables)

audacious_money_backend/
├── services/
│   ├── BackupStorage.ts
│   ├── NotificationService.ts
│   └── AdminNotifications.ts
├── routes/
│   └── restore.ts
├── templates/
│   └── BackupEmail.html
└── jobs/
    └── WeeklyBackupEmail.ts

audacious_money_sync/
├── server.ts
└── middleware/
    ├── auth.ts
    ├── epochVerification.ts
    └── rateLimiting.ts

tests/
├── unit/
│   ├── backup/
│   ├── sync/
│   ├── admin/
│   └── crypto/
├── integration/
│   └── backup-restore-flows/
├── e2e/
│   ├── LocalBackup.test.ts
│   ├── EmailBackup.test.ts
│   ├── SyncRelay.test.ts
│   ├── CrossDeviceRestore.test.ts
│   └── AdminControls.test.ts
└── security/
    └── BackupSecurity.test.ts
```

---

## Conclusion

This roadmap provides a systematic, security-first approach to implementing a comprehensive backup and synchronization system for Audacious Money. By following these phases in order, we ensure:

✅ **Zero-knowledge encryption** is never compromised
✅ **User data sovereignty** is tangible and visible
✅ **Multiple safety nets** protect against data loss
✅ **Seamless UX** makes security invisible to users
✅ **OWASP compliance** protects against vulnerabilities
✅ **Audit trail** provides transparency and accountability

**Next Steps:**
1. Review and approve this roadmap
2. Begin Phase 1 (Foundation) implementation
3. Set up CI/CD pipeline for automated testing
4. Establish security review process for each phase
5. Create user testing protocol for UX validation

---

**Roadmap Version:** 1.0
**Created:** 2026-03-29
**Status:** Ready for Implementation
**Completion Criteria:** All 6 phases complete with 100% test pass rate

---

*This roadmap aligns with the Audacious Money mission of empowering entrepreneurs through zero-knowledge, local-first accounting with true data sovereignty.* 🚀
