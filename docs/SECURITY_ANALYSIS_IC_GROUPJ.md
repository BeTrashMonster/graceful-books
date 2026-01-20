# Security Analysis: Infrastructure Capstone (IC1-IC6) & Group J (J1-J12)

**Analysis Date:** 2026-01-19
**Scope:** Infrastructure Capstone (IC1-IC6) and Group J Features (J1-J12)
**Focus:** Zero-knowledge encryption compatibility, data sovereignty, authentication/authorization, and security vulnerabilities

---

## Executive Summary

This analysis identifies **CRITICAL SECURITY RISKS** in the Infrastructure Capstone and Group J features that could compromise Graceful Books' zero-knowledge architecture. While most features maintain zero-knowledge principles, several components introduce significant risks:

### Critical Findings
- **IC2 (Billing):** Payment data handling may leak sensitive business metrics
- **IC3 (Admin Panel):** Platform admin has excessive visibility into user behavior
- **IC4 (Email Service):** Email content may expose encrypted financial data
- **J7 (Advisor Portal):** View-key architecture is incompletely specified, team member access creates new attack surface
- **J9 (CSV Import/Export):** Client-side processing is secure, but unclear boundary documentation

### Overall Risk Assessment
- **High Risk:** IC2 (Billing Infrastructure), IC4 (Email Service), J7 (Advisor Portal)
- **Medium Risk:** IC3 (Admin Panel), J8 (Tax Prep Mode)
- **Low Risk:** IC1, IC5, IC6, J1, J2, J3, J4, J5, J6, J9

---

## 1. Zero-Knowledge Encryption Compatibility Analysis

### 1.1 Infrastructure Capstone (IC1-IC6)

#### IC1: Complete Group I UI Components ✅ LOW RISK
**Zero-Knowledge Status:** COMPATIBLE

**Analysis:**
- UI components display decrypted data client-side
- Comment threads, conflict resolution, and notifications all operate on client-side decrypted data
- No server-side processing of sensitive content
- CRDT conflict resolution happens locally before encryption

**Recommendation:** No changes needed. Continue with client-side architecture.

---

#### IC2: Billing Infrastructure - Stripe Integration ⚠️ HIGH RISK
**Zero-Knowledge Status:** PARTIAL COMPROMISE

**Critical Issues Identified:**

1. **Business Metrics Leakage via Client Count**
   - Advisor's client count is tracked server-side for billing
   - Platform operator (Graceful Books) can see: advisor has 75 clients
   - This reveals business size/success without seeing client financial data
   - **Severity:** Medium - metadata leakage, not content

2. **User Count Tracking**
   - Team member count is visible server-side for billing
   - Platform can see how many team members an advisor has
   - Combined with client count, reveals business structure

3. **Billing History Metadata**
   - Invoice timing and amounts reveal advisor growth patterns
   - Plan upgrades/downgrades reveal business trajectory
   - **Example:** Advisor pays $50/month, then $100/month → grew from 4-50 to 51-100 clients

4. **Client-Advisor Relationship Mapping**
   - When client billing shifts to advisor's plan, platform sees the relationship
   - Platform knows: "Client X is under Advisor Y's plan"
   - Creates relationship graph visible to platform operator
   - **Severity:** HIGH - violates "platform cannot see relationships"

5. **Charity Selection Tracking**
   - Platform sees which charity each user/advisor selected
   - Reveals personal values/affiliations
   - **Severity:** Low - not financial, but personal preference data

6. **Payment Method Storage**
   - Stripe stores payment methods (last 4 digits, card brand, expiration)
   - Platform has access to this via Stripe API
   - **Severity:** Low - standard payment processing, PCI-compliant

**What IS Zero-Knowledge Compatible:**
- Transaction amounts in user books (encrypted, platform can't see)
- Client names (encrypted, platform can't see)
- Financial details of any user (encrypted, platform can't see)
- Stripe handles card data (PCI-compliant, platform never touches full card numbers)

**What VIOLATES Zero-Knowledge:**
- Advisor-client relationship mapping (platform can see connections)
- Client count and user count (business size metadata visible)
- Billing tier progression (business growth trajectory visible)

**Recommendations:**

1. **Document Metadata Leakage Clearly**
   - Add to privacy policy: "Platform operator can see: number of clients, number of users, billing tier"
   - Add to privacy policy: "Platform can see advisor-client relationships for billing purposes"
   - Be transparent with users about what metadata is visible

2. **Minimize Relationship Visibility**
   - Consider: "Anonymous client IDs" for billing (platform sees Advisor has 50 clients, but doesn't know which 50)
   - Implementation: Client ID hashed with advisor-specific salt before sending to server
   - Server sees: `advisor_id: 123, client_anonymous_ids: [hash1, hash2, ...]` for billing purposes
   - Prevents platform from correlating Client A with Advisor B

3. **Charity Selection Anonymization**
   - Store charity selection encrypted client-side
   - Server only needs to know total $ going to each charity (for disbursement)
   - Implementation: Client stores `charity_id` encrypted, platform receives aggregated totals monthly

4. **Webhook Data Minimization**
   - Stripe webhooks contain subscription metadata
   - Verify: Only necessary fields are logged/stored server-side
   - Purge webhook logs after processing (retain only audit trail of events, not full payloads)

5. **Billing Audit Trail Encryption**
   - Billing history (invoice PDFs, payment receipts) contain user email, name
   - Store these encrypted with user's key, not plaintext server-side
   - Platform only needs to track: subscription status, amount owed, payment success/failure

**Mitigation Priority:** HIGH - Implement advisor-client relationship anonymization before J7 launch

---

#### IC3: Admin Panel - Charity Management ⚠️ MEDIUM RISK
**Zero-Knowledge Status:** COMPATIBLE (with minor concerns)

**Analysis:**

**What Admin CAN See:**
- List of approved charities (names, EINs, descriptions)
- User charity selections (which charity each user chose)
- Aggregated donation totals per charity

**What Admin CANNOT See:**
- User financial data (encrypted)
- Transaction details (encrypted)
- Client names, vendor names (encrypted)

**Security Concerns:**

1. **Charity Selection as Proxy Data**
   - Charity choice reveals personal values/affiliations
   - Example: User selects "National Rifle Association Foundation" or "Planned Parenthood" → reveals political leanings
   - Platform admin can see these selections
   - **Severity:** Medium - not financial, but personal preference data

2. **Audit Logging of Admin Actions**
   - Admin actions (add charity, verify charity, remove charity) are logged
   - Logs should be immutable and timestamped
   - Currently: "Audit logging for admin actions" is listed, but implementation unclear

**Recommendations:**

1. **Anonymize Charity Selection Tracking**
   - Platform admin should only see: "Charity X has 142 users donating $5/month = $710/month"
   - Platform admin should NOT see: "User jane@example.com selected Charity X"
   - Implementation: Store charity selection encrypted client-side, aggregate counts server-side without user attribution

2. **Implement Immutable Audit Trail**
   - All admin actions logged with timestamp, admin ID, action type
   - Use append-only log (cannot be edited or deleted)
   - Consider: Blockchain-style hash chain for tamper-evidence
   - Regular audit log exports for transparency

3. **Role Segregation**
   - Platform owner (you) is the only admin
   - No delegation of admin role (stated in roadmap)
   - Enforce: Multi-factor authentication for admin account
   - Enforce: Admin session timeout (15 minutes of inactivity)

4. **Charity Verification Process**
   - Document: How is EIN verified? (Manual lookup on IRS database?)
   - Document: What if charity is later discovered to be fraudulent?
   - Process: Annual re-verification of charities

**Mitigation Priority:** MEDIUM - Anonymize charity selection before public launch

---

#### IC4: Email Service Integration ⚠️ HIGH RISK
**Zero-Knowledge Status:** MAJOR CONCERN

**Critical Issues Identified:**

1. **Email Content Contains Sensitive Data**
   - Advisor invitation email: Contains client business name, client email
   - Client billing transfer notification: Contains advisor name, advisor firm name
   - Scenario pushed to client: May contain financial projections, numbers
   - Tax season access granted: Contains tax year, possibly financial summary
   - **Severity:** HIGH - financial context visible in plaintext email

2. **Email Sent in Plaintext**
   - Emails are sent via SendGrid/Postmark/AWS SES
   - Email bodies are NOT encrypted (standard SMTP)
   - Email provider (SendGrid/Postmark/AWS) can read all email content
   - Email in transit is protected by TLS, but stored plaintext at provider
   - **Severity:** CRITICAL - violates "platform operator cannot access data"

3. **Email Metadata Leakage**
   - Email provider sees: sender, recipient, subject line, timestamp
   - Subject lines may contain sensitive info: "Your 2025 Tax Package is Ready"
   - Creates user activity timeline visible to email provider
   - Email provider can correlate: User A invited Advisor B on Date X

4. **Template Variables Expose Financial Data**
   - Templates include dynamic content: `{{firstName}}`, `{{actionUrl}}`, `{{charityName}}`
   - More concerning variables in J7/J8 emails: `{{clientBusinessName}}`, `{{taxYear}}`, `{{scenarioSummary}}`
   - If scenario summary includes numbers, those are plaintext in email

5. **Email Provider as Third-Party**
   - SendGrid/Postmark/AWS are third-party services (not Graceful Books)
   - Subject to their own privacy policies, data retention, legal requests
   - **Example:** Government subpoena to SendGrid → all emails accessible

6. **Email Logging and Delivery Tracking**
   - Delivery status tracked: queued, sent, delivered, bounced, opened, clicked
   - "Opened" tracking uses pixel (email provider knows user opened email)
   - "Clicked" tracking uses link wrapping (email provider knows user clicked)
   - This creates user activity profile at third-party

**What IS Acceptable for Email:**
- Invitation links (unique tokens, no financial data)
- Password reset links (standard practice)
- Email verification links (standard practice)
- Generic notifications: "You have a new comment" (without content)

**What VIOLATES Zero-Knowledge:**
- Financial numbers in email body or subject
- Business names, client names in email body
- Transaction details, report summaries in email
- Detailed scenario projections in "scenario pushed to client" email

**Recommendations:**

1. **Minimize Email Content - "Notification Only" Approach**
   - Emails should only say: "You have a new notification in Graceful Books"
   - NO financial data, NO business names, NO numbers in email body
   - User must log in to see actual content (decrypted client-side)
   - **Example:** Instead of "Your accountant Jessica Martinez invited you" → "You have a new invitation. Log in to view details."

2. **Subject Line Sanitization**
   - Current subject: "✓ Your 2025 Tax Package is Ready!" → reveals tax year
   - Better: "You have a new document ready in Graceful Books"
   - Remove ALL dynamic content from subject lines

3. **Template Variable Restrictions**
   - Allowed: `{{firstName}}` (necessary for personalization)
   - Allowed: `{{actionUrl}}` (invitation/verification links)
   - FORBIDDEN: `{{clientBusinessName}}`, `{{taxYear}}`, `{{scenarioSummary}}`, `{{charityName}}`
   - Code review: Audit all email templates before deployment

4. **Email Provider Selection Criteria**
   - Choose provider with strong privacy policy (GDPR-compliant)
   - Prefer: Postmark (privacy-focused) over SendGrid (marketing-focused)
   - Verify: Email provider cannot use data for advertising/marketing
   - Verify: Email provider deletes email content after delivery (retention policy)

5. **Disable Email Tracking**
   - NO open tracking (no pixel insertion)
   - NO click tracking (no link wrapping)
   - Plain, simple email delivery only
   - Configuration: Postmark has "Track Opens: false" setting

6. **In-App Notifications Primary, Email Secondary**
   - All important notifications visible in-app first
   - Email is just a "you have new activity" alert
   - User must log in to decrypt and view actual content
   - Email becomes a doorbell, not a delivery method

7. **Consider: PGP Encrypted Email (Future)**
   - Users can optionally upload PGP public key
   - Emails sent encrypted to their public key
   - Only user can decrypt with their private key
   - Complexity: High, adoption: Low, but ultimate privacy

8. **Logging and Retention**
   - Server logs: Only log email sent/failed status, no content
   - Email provider logs: Configure shortest retention possible
   - Audit: Regularly review what email provider has access to

**Scenario-Specific Guidance:**

**J7 Advisor Invitation:**
- ❌ BAD: "Jessica Martinez from Martinez Accounting invited you to collaborate on Acme Consulting LLC's books."
- ✅ GOOD: "You have a new invitation. Log in to Graceful Books to view details and accept."

**J7 Client Billing Transfer:**
- ❌ BAD: "Your accountant has transferred billing back to you. You can pay $40/month to continue using Graceful Books."
- ✅ GOOD: "There's an update to your account billing. Log in to review your options."

**J3 Scenario Push to Client:**
- ❌ BAD: "Your advisor created a scenario: 'Hire 2 employees' with projected revenue of $450,000 and expenses of $380,000."
- ✅ GOOD: "Your advisor shared a new scenario with you. Log in to explore the projections."

**J8 Tax Prep Completion:**
- ❌ BAD: "Your 2025 Tax Package is Ready! Total revenue: $68,200. Download now."
- ✅ GOOD: "Your tax documents are ready. Log in to download your package."

**Mitigation Priority:** CRITICAL - Redesign all email templates before IC4 implementation

---

#### IC5: OpenSpec Documentation Synchronization ✅ LOW RISK
**Zero-Knowledge Status:** NOT APPLICABLE (documentation task)

**Analysis:** This is a documentation task. No security implications.

**Recommendation:** Ensure all spec files include "Zero-Knowledge Compatibility" sections for features that handle user data.

---

#### IC6: Infrastructure Capstone - Final Validation ✅ LOW RISK
**Zero-Knowledge Status:** NOT APPLICABLE (validation task)

**Analysis:** This is a validation gate. Security review should be part of this checklist.

**Recommendation:** Add security validation criteria to IC6 checklist:
- [ ] All email templates reviewed for data minimization
- [ ] Billing metadata leakage documented in privacy policy
- [ ] Charity selection anonymization implemented
- [ ] Admin panel audit logging tested
- [ ] Third-party security audit scheduled for IC1-IC4

---

### 1.2 Group J Features (J1-J12)

#### J1: Financial Flow Widget ✅ LOW RISK
**Zero-Knowledge Status:** COMPATIBLE

**Analysis:**
- Visualization happens client-side with decrypted data
- No server-side processing of financial data
- All rendering in browser using d3.js

**Recommendation:** No changes needed.

---

#### J2: Smart Automation Assistant ✅ LOW RISK
**Zero-Knowledge Status:** HIGHLY COMPATIBLE

**Analysis:**
- 100% local processing (tensorflow.js)
- No data transmitted externally for AI processing
- Learning happens client-side
- Explicitly states: "Zero data transmitted externally for AI processing"

**Recommendation:** No changes needed. This is a model for zero-knowledge AI.

---

#### J3: Building the Dream Scenarios ✅ LOW RISK
**Zero-Knowledge Status:** COMPATIBLE (with email concerns inherited from IC4)

**Analysis:**
- Scenario modeling happens client-side
- Scenarios stored encrypted
- "Push to client" via J7 uses view-key sharing

**Concerns:**
- "Scenario pushed to client" email (covered in IC4 analysis)
- Ensure scenario data is NOT included in email body

**Recommendation:** Apply IC4 email content minimization to scenario push emails.

---

#### J4: Key Financial Metrics Reports ✅ LOW RISK
**Zero-Knowledge Status:** COMPATIBLE

**Analysis:**
- Reports generated client-side from decrypted data
- "Accountant-controlled sharing" uses J7 view-key architecture
- No server-side report generation

**Recommendation:** No changes needed.

---

#### J5: Financial Goals ✅ LOW RISK
**Zero-Knowledge Status:** COMPATIBLE

**Analysis:**
- Goals stored encrypted client-side
- Progress tracking happens locally
- No external sharing mentioned

**Recommendation:** No changes needed.

---

#### J6: Emergency Fund & Runway Calculator ✅ LOW RISK
**Zero-Knowledge Status:** COMPATIBLE

**Analysis:**
- Calculations happen client-side
- Uses local transaction data (decrypted)
- No external data transmission

**Recommendation:** No changes needed.

---

#### J7: Mentor/Advisor Portal ⚠️ HIGH RISK
**Zero-Knowledge Status:** CRITICAL ARCHITECTURE COMPONENT

**Deep Dive Analysis:**

**View-Key Architecture (Incompletely Specified):**

The roadmap states:
> "Client grants access by generating a **view-key** for the advisor"
> "View-key is scoped to the permissions selected"
> "Advisor receives view-key, stored encrypted with their password"
> "Client revokes access by invalidating the view-key"

**Critical Questions Unanswered:**

1. **View-Key Generation:**
   - How is a view-key cryptographically derived from the master key?
   - Is it a derived key (HKDF) with a scope parameter?
   - Example: `viewKey = HKDF(masterKey, context="advisor_access", info=scope_permissions)`

2. **Granular Permission Enforcement:**
   - View-key grants "View-Only Observer" (reports only) vs. "Full View" (all transactions)
   - How does encryption system enforce this granularity?
   - Are different data types encrypted with different sub-keys?
   - Example: `transactionKey = deriveKey(masterKey, "transactions")`, `reportKey = deriveKey(masterKey, "reports")`
   - View-key might only include `reportKey`, not `transactionKey`

3. **View-Key Storage and Transmission:**
   - How is view-key transmitted to advisor securely?
   - Option A: Encrypted with advisor's public key (requires advisor to have key pair)
   - Option B: Shared via secure channel (QR code, Signal, encrypted email)
   - Roadmap doesn't specify

4. **View-Key Revocation:**
   - "Client revokes access by invalidating the view-key"
   - How is this enforced?
   - Option A: Server maintains revocation list (client tells server "view-key X is revoked")
   - Option B: View-keys have expiration timestamps (client sets expiration when generating)
   - Option C: Data re-encryption (client rotates keys, old view-keys become useless)

5. **Collaborative Partner Permissions:**
   - "Can do: Create/edit transactions, categorize, reconcile"
   - Editing requires ENCRYPTION, not just decryption
   - Does advisor get a key that can encrypt? Or only decrypt?
   - If advisor can encrypt, they can create new encrypted records
   - This is more than "view-only" - it's "write" access

6. **Tax Season Auto-Expiration:**
   - "Tax Season access auto-expires after specified date"
   - Implementation: View-key includes expiration timestamp?
   - What happens at expiration? Server blocks requests? Advisor's app can't decrypt?

**Team Member Access (New Attack Surface):**

The roadmap adds:
> "Advisor can invite team members to their account and assign them to specific clients"
> "Team members see only clients they're assigned to"

**Security Concerns:**

1. **Team Member View-Keys:**
   - Does each team member get their own view-key?
   - Or do they share the advisor's view-key?
   - Sharing: If multiple team members share one view-key, revoking one member = revoke all
   - Individual: Each team member has separate view-key → more complex key management

2. **Team Member Offboarding:**
   - Advisor removes team member → team member's access should be revoked
   - But: Team member may have cached decrypted data locally
   - Risk: Fired employee still has copies of client data on their laptop
   - Mitigation: Clear local cache on revocation? (user can bypass if malicious)

3. **Team Member Assignment Changes:**
   - Advisor reassigns team member from Client A to Client B
   - Team member should lose access to Client A's view-key
   - Requires: Individual view-keys per team member per client
   - Complexity: Advisor with 50 clients and 8 team members = 400 potential view-keys to manage

4. **Advisor Account Compromise:**
   - If advisor's account is compromised, attacker has view-keys to ALL clients
   - This is worse than individual user compromise (affects multiple clients)
   - Mitigation: Require 2FA for advisor accounts? (not mentioned in roadmap)

**Client-Advisor Relationship Visibility (Covered in IC2):**

Reiteration: Platform can see which client is under which advisor's plan for billing purposes. This is metadata leakage.

**Private Advisor Notes:**

Roadmap states:
> "Advisor can keep private notes about each client (client can't see)"

**Storage Question:**
- Where are these notes stored?
- Option A: Encrypted with advisor's key (client can't decrypt) ✅ Zero-knowledge maintained
- Option B: Stored server-side plaintext (platform admin can read) ❌ Zero-knowledge violated

**Must implement: Option A**

**Document Exchange:**

Roadmap states:
> "Client can share specific documents with advisor (receipts, contracts, tax forms)"

**Security:**
- Documents are encrypted client-side before upload (normal flow)
- Client shares decryption key for document with advisor (like a view-key for that document)
- Advisor can decrypt and view document
- ✅ Compatible with zero-knowledge

**Advisor Billing Dashboard:**

Roadmap shows:
> "Plan: Professional (72 clients) • $100/month"

**What Advisor Sees (Client-Side):**
- List of their clients
- Client names, last viewed times, unread comment counts

**What Platform Sees (Server-Side):**
- Advisor has 72 clients (for billing)
- Client IDs under that advisor's plan
- Does NOT see: Client business names, financial data

**Covered in IC2 analysis.**

**Recommendations:**

1. **Specify View-Key Cryptography**
   - Document: Exactly how view-keys are derived (HKDF with context)
   - Document: How granular permissions map to sub-keys
   - Document: View-key transmission method (encrypted with advisor's public key)
   - Create: Detailed cryptographic specification (separate doc)

2. **Implement Hierarchical Key Derivation**
   - Master Key → Sub-keys per data type (transactions, reports, documents, etc.)
   - View-key bundles only the sub-keys needed for granted permissions
   - Example: "View-Only Observer" gets `reportKey` only, not `transactionKey`

3. **View-Key Revocation Strategy**
   - Server maintains revocation list (client submits signed revocation request)
   - Advisor's app checks revocation list on each sync
   - If view-key is revoked, advisor's app deletes local view-key and cached data
   - Cannot prevent malicious advisor from keeping cached data, but limits ongoing access

4. **Auto-Expiration via Timestamps**
   - View-keys include expiration timestamp (signed by client)
   - Advisor's app checks timestamp before using view-key
   - Server also checks timestamp on sync requests (defense in depth)
   - "Tax Season access" = view-key with expiration date April 30

5. **Individual View-Keys per Team Member**
   - Each team member gets their own view-key for each assigned client
   - Advisor (account owner) can revoke team member's view-key independently
   - Complexity: High, but necessary for proper access control
   - Alternative: Simplified model where team members share advisor's view-key (less secure)

6. **Require 2FA for Advisor Accounts**
   - Advisors have access to multiple clients' data
   - Higher security requirement than individual users
   - Enforce: 2FA mandatory for advisor accounts (email/SMS code, authenticator app)

7. **Advisor Account Security Audit**
   - Log all advisor access to client books (timestamp, which client, what action)
   - Client can view audit log (when did advisor view my books?)
   - Alerts: Notify client if advisor accesses books at unusual time (optional setting)

8. **Private Notes Encryption**
   - Advisor's private notes MUST be encrypted with advisor's key
   - Server cannot decrypt advisor's private notes
   - Client cannot decrypt advisor's private notes
   - If advisor invites team member, team member cannot see notes (unless explicitly shared)

9. **Team Member Offboarding Procedure**
   - When team member is removed:
     - Revoke all their view-keys immediately
     - Instruct team member to clear local cache (app can attempt this, user can bypass)
     - Log revocation event for audit trail
   - Advisor is responsible for: Collecting devices, enforcing return of cached data (outside software's control)

10. **Client Revocation Immediate Effect**
    - When client revokes advisor access:
      - View-key added to revocation list immediately
      - Next time advisor syncs, view-key is invalid
      - Advisor sees: "Access to [Client] has been revoked"
      - Advisor's cached data should be cleared (app enforces, user can bypass)

**Mitigation Priority:** CRITICAL - Design and document view-key cryptographic architecture before J7 implementation

---

#### J8: Tax Time Preparation Mode ⚠️ MEDIUM RISK
**Zero-Knowledge Status:** COMPATIBLE (with email concerns inherited from IC4)

**Analysis:**

**Client-Side Processing:**
- Tax prep workflow happens client-side
- Reports generated client-side
- Export package created client-side
- ✅ Zero-knowledge maintained

**Email Concerns:**
- "Tax season access granted" email (covered in IC4)
- "Tax prep completion summary" email (covered in IC4)
- Ensure NO financial numbers in these emails

**Export Package:**
- User downloads ZIP with PDFs and CSVs
- File is created client-side, contains decrypted data
- User manually sends to tax preparer (via email, file sharing, etc.)
- ⚠️ Once file leaves Graceful Books, encryption is user's responsibility

**Integration with J7:**
- "User can grant Tax Season access" to advisor via J7
- Uses J7's view-key architecture (covered above)

**Recommendations:**

1. **Export Package Security Warning**
   - Display warning before exporting: "This file contains your unencrypted financial data. Store it securely and use encrypted email if sending to your tax preparer."
   - Consider: Password-protect ZIP file (user sets password, shares separately with tax preparer)

2. **Email Content Minimization (Inherited from IC4)**
   - "Tax season access granted" email: "You've been granted access to documents. Log in to view."
   - "Tax prep completion" email: "Your tax documents are ready. Log in to download."
   - NO financial numbers, NO tax year details in email

**Mitigation Priority:** MEDIUM - Implement export security warning and IC4 email minimization

---

#### J9: CSV Import/Export ✅ LOW RISK
**Zero-Knowledge Status:** HIGHLY COMPATIBLE

**Analysis:**

**CSV Import:**
- ✅ "All CSV processing happens client-side"
- ✅ "Browser parses CSV (JavaScript)"
- ✅ "Transactions created and encrypted (in browser)"
- ✅ "Server never sees CSV contents"
- ✅ "Server never sees unencrypted transactions"

This is the GOLD STANDARD for zero-knowledge import.

**CSV Export:**
- ✅ "Export generates CSV client-side, downloads to user's device"
- ✅ "CSV contains decrypted data, but happens in browser"
- ✅ "Server is never involved in export process"

**Security Considerations:**

1. **Export File Security**
   - CSV file contains unencrypted financial data
   - Once downloaded, user is responsible for securing it
   - Risk: User emails CSV to someone, CSV is intercepted
   - Mitigation: Display warning before export (similar to J8)

2. **Import Source Verification**
   - User uploads CSV from Stripe, Square, etc.
   - Graceful Books doesn't verify: Is this actually from Stripe?
   - User could upload fake data or someone else's CSV
   - This is acceptable: User controls their data, can import whatever they want

3. **Malicious CSV Attack**
   - User uploads CSV with malicious content (e.g., CSV injection)
   - Parser vulnerabilities could lead to code execution
   - Mitigation: Use well-tested CSV parser (papaparse), input sanitization

**Recommendations:**

1. **Export Security Warning**
   - Before exporting: "This CSV contains your unencrypted financial data. Store it securely."
   - Option: "Password-protect this CSV?" (use AES encryption with user-provided password)
   - Implementation: Encrypt CSV before download, user needs password to open

2. **CSV Injection Prevention**
   - Sanitize CSV on import: Strip formulas (`=`, `+`, `-`, `@` at start of cells)
   - Papaparse has option: `skipFirstNLines` and validation
   - Test: Upload CSV with `=1+1` in cell, verify it's treated as text not formula

3. **Import Audit Trail**
   - Log: User imported 46 transactions from CSV on Date X
   - Mark imported transactions with source: "Imported from CSV (Stripe)" or "Imported from CSV (Unknown)"
   - Allows forensic analysis if something goes wrong

**Mitigation Priority:** LOW - Add export warnings and CSV injection prevention before J9 launch

---

#### J10: CSV Import/Export Testing Environment ✅ LOW RISK
**Zero-Knowledge Status:** NOT APPLICABLE (testing infrastructure)

**Analysis:** This is a testing task. No security implications beyond normal test data handling.

**Recommendation:** Use synthetic test data (not real financial data) for CSV import/export tests.

---

#### J11: Write Comprehensive Tests for Group J ✅ LOW RISK
**Zero-Knowledge Status:** NOT APPLICABLE (testing task)

**Recommendation:** Add security tests to test suite:
- Verify view-key permissions are enforced (J7)
- Verify email content minimization (IC4)
- Verify CSV import is client-side only (J9)
- Verify advisor cannot access ungranted data (J7)

---

#### J12: Run All Tests and Verify 100% Pass Rate ✅ LOW RISK
**Zero-Knowledge Status:** NOT APPLICABLE (testing gate)

**Recommendation:** Include security test results in pass/fail criteria.

---

## 2. Data Sovereignty Analysis

### Platform Admin (Graceful Books Operator) Access

**What Platform Admin CAN See (Server-Side Data):**

1. **User Account Metadata:**
   - Email addresses (for login, password reset)
   - Account creation date
   - Last login timestamp
   - Subscription status (active, canceled, expired)

2. **Billing Information (IC2):**
   - Client count per advisor (for billing tier calculation)
   - User count per advisor (for overage charges)
   - Payment history (amount, date, success/failure)
   - Stripe Customer ID (links to Stripe dashboard)

3. **Advisor-Client Relationships (IC2):**
   - Which clients are under which advisor's plan
   - When relationships started/ended
   - Billing transfer events

4. **Charity Selections (IC3):**
   - Which charity each user selected
   - Aggregated donation totals per charity

5. **Email Delivery Logs (IC4):**
   - Who received which email, when
   - Email delivery status (sent, delivered, bounced, failed)
   - Subject lines (if not sanitized per recommendations)

6. **Sync Relay Metadata:**
   - Client IP addresses (when syncing)
   - Sync timestamps
   - Data volume synced (in bytes, encrypted payload size)

7. **Audit Logs:**
   - Admin actions (charity management)
   - System events (errors, warnings)

**What Platform Admin CANNOT See (Encrypted Client-Side):**

1. **Financial Data:**
   - Transaction amounts, dates, descriptions
   - Account balances
   - Profit & Loss, Balance Sheet numbers
   - Client/vendor names and contact information

2. **Business Structure:**
   - Chart of accounts
   - Categories, tags, classes
   - Budget/forecast numbers

3. **Documents:**
   - Receipts, invoices, bills (uploaded files encrypted)
   - Notes, memos on transactions

4. **Advisor-Client Communications:**
   - Comments, questions, advisory notes
   - Scenario projections (J3)
   - Tax prep data (J8)

**Data Sovereignty Assessment:**

- ✅ **Financial sovereignty maintained:** Platform cannot see transaction details or amounts
- ✅ **Business structure private:** Chart of accounts, categorization not visible
- ⚠️ **Relationship metadata visible:** Advisor-client relationships exposed for billing
- ⚠️ **Personal preferences visible:** Charity selections visible
- ✅ **Communication content private:** Comment threads encrypted
- ⚠️ **Behavioral metadata visible:** Sync frequency, login times, email delivery

**Recommendation:**
- Document what metadata is visible in Privacy Policy
- Minimize metadata collection where possible (see IC2 recommendations)
- Annual transparency report: "We can see X, we cannot see Y"

---

### Advisor Access to Client Data

**What Advisor CAN See (via View-Key):**

Depends on client's permission grant. Options:

1. **View-Only Observer:**
   - Financial reports only (P&L, Balance Sheet)
   - NO transaction details

2. **Full View Access:**
   - All transactions, reports, contacts, documents
   - CANNOT edit

3. **Collaborative Partner:**
   - All transactions, can create/edit
   - CANNOT delete, modify chart of accounts structure

4. **Tax Season Package:**
   - All transaction detail, reports, tax-relevant documents
   - Time-limited (expires after specified date)

5. **Custom Access:**
   - Client picks exactly what advisor can see/do

**What Advisor CANNOT See (Even with Full Access):**

1. **Client's Master Key:**
   - Advisor only gets view-key (derived key with limited scope)
   - Cannot decrypt data outside granted scope

2. **Other Advisors' Private Notes:**
   - If client has multiple advisors, each advisor's private notes are encrypted separately

3. **Client's Password/Passphrase:**
   - Advisor never knows how to log in as the client

**Revocation:**
- Client can revoke advisor access at any time
- View-key is invalidated
- Advisor loses ability to decrypt (new data)
- ⚠️ Advisor may have cached old data locally (cannot be remotely wiped)

**Data Sovereignty Assessment:**

- ✅ **Client controls access:** Permission model allows granular control
- ✅ **Revocable access:** Client can revoke at any time
- ⚠️ **Cached data risk:** Advisor may retain cached decrypted data after revocation
- ✅ **View-key limits scope:** Advisor cannot exceed granted permissions (if implemented correctly)

**Recommendation:**
- Clearly communicate to clients: "Advisors may cache data locally. Revocation prevents new access, but cannot erase cached data."
- Implement: Cache expiration policies in advisor app (auto-clear old data)
- Trust model: Advisors are professionals bound by confidentiality (legal, not technical control)

---

## 3. Authentication & Authorization

### 3.1 Role-Based Access Control (RBAC)

**Roles Identified:**

1. **Platform Admin** (IC3)
   - Can manage charity list
   - Can view aggregated metrics
   - Cannot access user financial data

2. **Advisor** (J7)
   - Can manage their advisor account
   - Can invite team members
   - Can access clients' books (with view-key)
   - Can manage client assignments for team members

3. **Team Member** (J7 - new role)
   - Works under an advisor's account
   - Can access only assigned clients' books
   - Cannot manage advisor billing or team roster

4. **Individual User** (default)
   - Manages their own books
   - Can invite advisors
   - Can grant/revoke access

5. **Multi-User Team Member** (H1 - existing)
   - Works for ONE business (not same as advisor's team member)
   - Roles: Admin, Manager, Bookkeeper, View-Only
   - This is DIFFERENT from advisor's team member

**RBAC Concerns:**

1. **Role Confusion:**
   - "Team member" could mean: Internal employee (H1) or Advisor's employee (J7)
   - Need clear naming:
     - H1: "Business Team Member" (works for one business)
     - J7: "Advisor Team Member" (works for advisor, sees multiple clients)

2. **Permission Hierarchy:**
   - Platform Admin > Advisor > Advisor Team Member > Individual User
   - BUT: Platform Admin cannot see financial data (lower privilege in that dimension)
   - Need: Multi-dimensional permission model (admin rights vs. data access rights)

3. **Advisor Team Member Permissions:**
   - Roadmap says: "Team members see only clients they're assigned to"
   - Enforcement: Server-side permission checks on sync API
   - View-key per team member per client (as discussed in J7 analysis)

**Recommendations:**

1. **Clarify Role Naming:**
   - Rename H1 roles: "Internal Team Member" (Admin/Manager/Bookkeeper/View-Only)
   - Rename J7 roles: "Advisor Team Member" (assigned to specific clients)
   - UI: Make it clear which context user is in

2. **Implement Multi-Dimensional RBAC:**
   - Dimension 1: Administrative privileges (manage users, billing, charities)
   - Dimension 2: Data access (which datasets user can decrypt)
   - Platform Admin: High administrative privileges, ZERO data access
   - Advisor: Medium administrative privileges (manage team, billing), High data access (all assigned clients)
   - Individual User: High administrative privileges (their own account), High data access (their own books)

3. **Enforce Permissions Server-Side:**
   - Even though encryption is client-side, server should enforce role-based sync access
   - Example: Advisor Team Member requests sync for Client X
     - Server checks: Is this team member assigned to Client X?
     - If yes: Return encrypted payload (team member has view-key to decrypt)
     - If no: Return 403 Forbidden (team member doesn't have view-key anyway, but defense in depth)

4. **Audit Role Changes:**
   - Log: Advisor added Team Member Y
   - Log: Advisor assigned Team Member Y to Client X
   - Log: Advisor removed Team Member Y's access to Client X
   - Immutable audit trail (cannot be edited)

---

### 3.2 Advisor-Client Relationship Authorization

**Authorization Flow:**

1. **Client Initiates Invitation:**
   - Client generates invitation token
   - Token includes: client ID, permission scope, expiration
   - Token signed with client's key (proves it's legitimate)

2. **Advisor Accepts Invitation:**
   - Advisor clicks invitation link
   - Server verifies token signature and expiration
   - Server creates advisor-client relationship in database
   - Client generates view-key for advisor
   - View-key transmitted securely to advisor

3. **Advisor Accesses Client Books:**
   - Advisor requests sync for client
   - Server checks: Is advisor authorized for this client?
   - If yes: Return encrypted payload
   - Advisor decrypts using view-key

4. **Client Revokes Access:**
   - Client submits revocation request
   - Server adds view-key to revocation list
   - Next advisor sync: View-key invalid, access denied

**Security Concerns:**

1. **Invitation Token Leakage:**
   - If invitation email is intercepted, attacker could accept invitation
   - Mitigation: Invitation links single-use (first click consumes token)
   - Mitigation: Invitation links expire after 7 days
   - Mitigation: Client must approve advisor after they click link (two-step: click link, client approves)

2. **View-Key Transmission Security:**
   - How is view-key sent to advisor?
   - Option A: Encrypted with advisor's public key (requires PKI)
   - Option B: Encrypted with shared secret derived from invitation token
   - Must be specified in implementation

3. **Revocation Delay:**
   - Client revokes access → Server updates revocation list → Advisor next sync = access blocked
   - Delay: Up to sync interval (could be hours if advisor doesn't sync)
   - Mitigation: Push notification to advisor's devices "Access revoked, please sync"
   - Mitigation: View-keys have short TTL (time-to-live), require periodic renewal

**Recommendations:**

1. **Two-Step Invitation:**
   - Step 1: Advisor clicks link, expresses intent to accept
   - Step 2: Client approves advisor (confirms it's the right person)
   - Prevents: Attacker who intercepts email can't complete acceptance

2. **Invitation Link Expiration:**
   - Default: 7 days
   - Client can customize: 1 day, 3 days, 7 days, 30 days
   - After expiration, client must send new invitation

3. **Single-Use Invitation Tokens:**
   - Once advisor accepts, token is consumed
   - Second click on same link: "Invitation already used"
   - Prevents: Replay attacks

4. **View-Key Transmission via PKI:**
   - Advisor has public/private key pair (generated at account creation)
   - Client encrypts view-key with advisor's public key
   - Only advisor can decrypt with their private key
   - Protects view-key in transit (even if server is compromised)

5. **View-Key Periodic Renewal:**
   - View-keys expire every 90 days (configurable)
   - Advisor must request renewal from client
   - Client can approve or deny renewal (re-review access)
   - Automatic renewal (if client doesn't respond): Expire and block access
   - This ensures: Stale relationships don't persist indefinitely

6. **Immediate Revocation Notification:**
   - When client revokes access:
     - Server adds to revocation list immediately
     - Server sends push notification to advisor's devices "Access revoked to [Client]"
     - Advisor's app clears local cache for that client
   - Minimizes: Window where revoked advisor still has access

---

## 4. Payment Security (IC2 - Stripe Integration)

### 4.1 PCI Compliance

**Current Architecture:**
- Uses Stripe Elements for card entry
- Card data never touches Graceful Books servers
- Stripe handles PCI compliance
- ✅ This is the correct approach

**Analysis:**
- Stripe Elements: Hosted iframe, card data goes directly to Stripe
- Graceful Books receives: Stripe Payment Method ID (e.g., `pm_1234...`)
- No card numbers, CVV, or expiration dates stored on Graceful Books servers
- ✅ PCI-compliant by design (Stripe SAQ A)

**Recommendation:** No changes needed. Continue using Stripe Elements.

---

### 4.2 Webhook Verification

**Current Architecture (from IC2):**
- Webhook endpoint created and secured
- Signature verification implemented

**Security Concerns:**

1. **Webhook Signature Verification:**
   - Stripe signs webhook payloads with secret key
   - Server must verify signature before processing
   - Prevents: Attacker forging webhook requests

2. **Webhook Replay Attacks:**
   - Attacker captures legitimate webhook payload
   - Replays it multiple times
   - Result: Duplicate processing (e.g., "payment succeeded" processed twice)
   - Mitigation: Idempotency keys, event ID tracking

3. **Webhook Endpoint Discovery:**
   - Webhook URL must be publicly accessible
   - Attacker can find endpoint and send garbage requests
   - Mitigation: Signature verification (unsigned requests rejected)
   - Mitigation: Rate limiting (max 100 requests/minute from Stripe IPs)

**Recommendations:**

1. **Strict Signature Verification:**
   - Use Stripe SDK's built-in verification: `stripe.webhooks.constructEvent(payload, signature, secret)`
   - Reject requests with invalid signatures (return 400 Bad Request)
   - Log rejected requests for monitoring

2. **Idempotency via Event ID:**
   - Stripe includes `event.id` in payload
   - Store processed event IDs in database
   - Before processing webhook: Check if `event.id` already processed
   - If yes: Return 200 OK (already handled)
   - If no: Process event, then store `event.id`
   - Prevents: Duplicate processing

3. **Webhook Endpoint Rate Limiting:**
   - Limit: 100 requests/minute from Stripe IP ranges
   - Stripe publishes their IP ranges: https://stripe.com/docs/ips
   - Reject requests from non-Stripe IPs (defense in depth, signature verification is primary defense)

4. **Webhook Timeout Handling:**
   - Stripe expects response within 5 seconds
   - If processing takes longer, return 200 OK immediately, process async
   - Implementation: Queue webhook event, return 200, process from queue
   - Prevents: Stripe retrying due to timeout

5. **Webhook Failure Monitoring:**
   - Log all webhook failures (invalid signature, processing error)
   - Alert: If >5 webhook failures in 10 minutes
   - Dashboard: Show webhook delivery status (Stripe dashboard also has this)

---

### 4.3 Billing Data Handling

**What Billing Data is Stored:**

1. **Server-Side (Graceful Books Database):**
   - Stripe Customer ID (e.g., `cus_1234...`)
   - Stripe Subscription ID (e.g., `sub_5678...`)
   - Client count (for billing tier calculation)
   - User count (for overage charges)
   - Current subscription tier (Starter, Professional, Enterprise)
   - Subscription status (active, canceled, past_due)
   - Billing history: Invoice IDs, amounts, dates (reference to Stripe)

2. **Stripe-Side (Stripe's Servers):**
   - Full payment method details (card last 4, brand, expiration)
   - Full billing address
   - Full invoice details (line items, taxes, discounts)
   - Payment history (all charges, refunds)

**Security Concerns:**

1. **Graceful Books Database Compromise:**
   - If database is compromised, attacker sees:
     - Stripe Customer IDs (can lookup in Stripe dashboard if attacker has Stripe keys)
     - Client count, user count (business metadata)
     - Subscription status
   - Attacker does NOT see:
     - Card numbers (not stored)
     - Billing addresses (not stored, Stripe has them)
     - Financial transaction data (encrypted)

2. **Stripe Account Compromise:**
   - If Graceful Books' Stripe account is compromised, attacker has:
     - Full billing information for all advisors
     - Payment method details
     - Ability to issue refunds, cancel subscriptions
   - Mitigation: Stripe dashboard 2FA, API key rotation, least-privilege API keys

3. **API Key Leakage:**
   - Stripe Secret Key leaked (e.g., committed to GitHub)
   - Attacker can create subscriptions, charges, view customer data
   - Mitigation: Stripe keys stored in environment variables (not in code)
   - Mitigation: GitHub secret scanning (Stripe partners with GitHub, auto-revokes leaked keys)
   - Mitigation: Restricted API keys (Stripe allows limiting key permissions)

**Recommendations:**

1. **Encrypt Stripe Customer IDs:**
   - Store Stripe Customer IDs encrypted in database
   - Prevents: Database dump from revealing Stripe customer mapping
   - Decrypt only when needed (during billing operations)

2. **Use Restricted Stripe API Keys:**
   - Create separate API keys with minimum permissions:
     - Subscription management key: Can create/update subscriptions, no refunds
     - Webhook key: Read-only for webhook processing
     - Admin key: Full access, used only for manual operations
   - Rotate keys every 90 days

3. **Enable Stripe Radar:**
   - Stripe Radar: Fraud detection for payments
   - Blocks suspicious cards, high-risk transactions
   - Already included in Stripe pricing

4. **2FA for Stripe Dashboard:**
   - Enforce 2FA for all Stripe dashboard logins
   - Use authenticator app (not SMS)

5. **Billing Data Retention Policy:**
   - Retain billing history for: 7 years (tax/audit requirements)
   - After 7 years: Purge old billing records (GDPR right to erasure)
   - Exception: Active disputes or legal holds

6. **Customer Data Export for Advisors:**
   - Advisors can view their billing history via Stripe-hosted invoice pages
   - Graceful Books doesn't store full invoice PDFs
   - Stripe Customer Portal: Self-service billing management
   - Implementation: Generate Stripe Customer Portal link, advisor clicks to manage billing

---

## 5. Email Security (IC4 - Email Service Integration)

**Covered extensively in Section 1.1 (IC4 Analysis).**

**Summary of Recommendations:**

1. **Minimize Email Content:** Emails are notifications only, no financial data
2. **Sanitize Subject Lines:** Remove dynamic content
3. **Restrict Template Variables:** Only allow non-sensitive variables
4. **Disable Email Tracking:** No open/click tracking
5. **Choose Privacy-Focused Provider:** Postmark over SendGrid
6. **In-App Notifications Primary:** Email is secondary alert
7. **Consider PGP Encryption (Future):** Ultimate privacy for email

---

## 6. CSV Security (J9 - CSV Import/Export)

**Covered in Section 1.2 (J9 Analysis).**

**Summary:**

**Import Security:**
- ✅ Client-side processing only
- ✅ Server never sees CSV contents
- ⚠️ CSV injection risk (mitigation: sanitize formulas)

**Export Security:**
- ✅ Client-side generation only
- ✅ Server never involved in export
- ⚠️ Exported CSV is unencrypted (mitigation: user warning, optional password-protection)

**Recommendations:**
1. CSV injection prevention (sanitize formulas)
2. Export security warning (file contains unencrypted data)
3. Optional CSV password-protection (encrypt before download)

---

## 7. API Keys & Secrets Management

### 7.1 Stripe API Keys (IC2)

**Storage:**
- Environment variables (not in code)
- Server-side only (never exposed to client)

**Rotation:**
- Recommended: Every 90 days
- Use Stripe's "roll API keys" feature (creates new key, old key remains valid for 24 hours during transition)

**Permissions:**
- Use restricted keys (covered in Section 4.3)

---

### 7.2 Email Service Keys (IC4)

**Storage:**
- Environment variables (not in code)
- Server-side only

**Providers:**
- SendGrid: API key with restricted permissions (send only, no marketing features)
- Postmark: Server token (per-server, can revoke)
- AWS SES: IAM role with least privilege (SendEmail only)

**Rotation:**
- Recommended: Every 90 days
- Coordinate with deployment (avoid downtime)

---

### 7.3 Encryption Keys (User Data)

**Master Key:**
- Derived from user passphrase (Argon2id)
- Never stored server-side
- Never leaves user device unencrypted

**Encryption Sub-Keys:**
- Derived from Master Key (HKDF)
- Each data type has sub-key (transactions, reports, documents)
- Stored encrypted in IndexedDB (encrypted with Master Key)

**View-Keys (J7):**
- Derived from Master Key with permission scope
- Transmitted to advisor encrypted with advisor's public key
- Stored encrypted in advisor's local storage (encrypted with advisor's password)

**Key Rotation:**
- Master Key rotation: Not feasible (would require re-encrypting all data)
- View-Key rotation: Periodic renewal (every 90 days) for advisor access
- Sub-Key rotation: Possible but complex (re-encrypt data type)

**Recommendation:**
- Master Key: No rotation (user is responsible for strong passphrase)
- View-Key: Automatic expiration and renewal (every 90 days)
- Sub-Key: No rotation unless compromise suspected

---

### 7.4 Secrets Management Strategy

**Current Approach:**
- Environment variables on server
- `.env` file for local development (not committed to git)

**Production Hardening:**

1. **Use Secrets Manager:**
   - AWS Secrets Manager or HashiCorp Vault
   - Secrets stored encrypted, access logged
   - Automatic rotation support

2. **Principle of Least Privilege:**
   - Each service has its own secrets
   - API keys restricted to minimum permissions

3. **Secrets Rotation Schedule:**
   - Stripe keys: Every 90 days
   - Email service keys: Every 90 days
   - Database passwords: Every 180 days (coordinated maintenance window)

4. **Secrets Auditing:**
   - Log all secrets access (who, when, which secret)
   - Alert: Unusual access patterns (e.g., secrets accessed from unexpected IP)

---

## 8. Advisor Billing Model Security

### 8.1 Can Advisors See Client Payment Info?

**Question:** When a client is under an advisor's plan, can the advisor see the client's payment method or billing details?

**Answer:** NO (by design)

**Architecture:**
- Advisor pays for all clients under their plan (consolidated billing)
- Client does NOT provide payment method to Graceful Books (while under advisor's plan)
- Advisor's Stripe subscription includes client count
- Advisor sees: "I have 72 clients, my bill is $100/month"
- Advisor does NOT see: Individual client payment methods, client billing addresses

**What Advisor CAN See:**
- Number of clients under their plan
- Client business names (visible in multi-client dashboard)
- Total monthly cost for their plan

**What Advisor CANNOT See:**
- Client payment methods (not applicable, client doesn't pay)
- Client billing addresses (not applicable)
- Individual client subscription fees (not applicable, advisor pays for all)

**Exception:**
- If client opts out of advisor's plan and pays individually ($40/month):
  - Client provides their own payment method to Stripe
  - Advisor does NOT see client's payment method
  - Advisor sees: "Client removed from my plan" (client count decreases)

---

### 8.2 Can Clients See Advisor Payment Info?

**Question:** Can a client see the advisor's payment method or billing details?

**Answer:** NO (by design)

**Architecture:**
- Advisor pays Graceful Books for their plan
- Client benefits from advisor's plan (no charge to client)
- Client sees: "Under advisor's plan (no charge to you)"
- Client does NOT see: Advisor's payment method, advisor's total bill, advisor's other clients

**What Client CAN See:**
- "I'm under [Advisor Name]'s plan"
- "No charge to me"
- Advisor's professional profile (name, firm, credentials)

**What Client CANNOT See:**
- Advisor's payment method
- Advisor's total monthly cost
- How many other clients advisor has
- Other clients' names under same advisor

**Privacy Maintained:**
- Client A and Client B both under Advisor X
- Client A cannot see Client B (not in their dashboard)
- Only Advisor X sees both clients in multi-client dashboard

---

## 9. Summary of Security Risks & Recommendations

### Critical Risks (Must Address Before Launch)

| Risk ID | Component | Issue | Severity | Mitigation | Priority |
|---------|-----------|-------|----------|------------|----------|
| CR-1 | IC4 Email | Financial data in email bodies | CRITICAL | Minimize content, notification-only emails | P0 |
| CR-2 | IC2 Billing | Advisor-client relationship visible to platform | HIGH | Anonymize client IDs, document metadata leakage | P0 |
| CR-3 | J7 Advisor Portal | View-key architecture incompletely specified | CRITICAL | Design crypto spec, document key derivation | P0 |
| CR-4 | IC2 Billing | Charity selection reveals user preferences | MEDIUM | Anonymize selection tracking, aggregate only | P1 |
| CR-5 | J7 Advisor Portal | Team member access creates new attack surface | HIGH | Individual view-keys per team member | P0 |

---

### High Risks (Address Before Feature Launch)

| Risk ID | Component | Issue | Severity | Mitigation | Priority |
|---------|-----------|-------|----------|------------|----------|
| HR-1 | IC3 Admin | Admin can see charity selections | MEDIUM | Anonymize tracking, aggregate counts | P1 |
| HR-2 | J7 Advisor Portal | Advisor account compromise affects multiple clients | HIGH | Require 2FA for advisors | P1 |
| HR-3 | J8 Tax Prep | Email contains tax year details | MEDIUM | Sanitize subject lines, notification-only | P1 |
| HR-4 | IC4 Email | Email provider can read all emails | HIGH | Choose privacy-focused provider, disable tracking | P0 |

---

### Medium Risks (Address During Implementation)

| Risk ID | Component | Issue | Severity | Mitigation | Priority |
|---------|-----------|-------|----------|------------|----------|
| MR-1 | J9 CSV Import | CSV injection vulnerability | MEDIUM | Sanitize formulas, use safe parser | P2 |
| MR-2 | J9 CSV Export | Exported file is unencrypted | MEDIUM | User warning, optional password-protection | P2 |
| MR-3 | J7 Advisor Portal | Cached data retained after revocation | MEDIUM | Cache expiration, clear on revoke | P2 |
| MR-4 | IC2 Billing | Webhook replay attacks | MEDIUM | Idempotency via event ID tracking | P2 |

---

### Low Risks (Monitor and Document)

| Risk ID | Component | Issue | Severity | Mitigation | Priority |
|---------|-----------|-------|----------|------------|----------|
| LR-1 | IC2 Billing | Platform sees client count metadata | LOW | Document in privacy policy | P3 |
| LR-2 | J7 Advisor Portal | Invitation link interception | LOW | Single-use tokens, 7-day expiration | P3 |
| LR-3 | IC4 Email | Email metadata visible to provider | LOW | Standard practice, document in privacy policy | P3 |

---

## 10. Architectural Recommendations

### 10.1 Zero-Knowledge Email Alternative

**Problem:** Email is inherently insecure (plaintext, third-party provider).

**Solution:** In-app notification system as primary, email as optional fallback.

**Implementation:**
1. All notifications stored encrypted in user's local database
2. Push notifications (via WebPush API) alert user of new activity
3. User must log in to see notification content (decrypted client-side)
4. Email is opt-in: "Send me email notifications" (default: off)
5. Email content is minimal: "You have 3 new notifications in Graceful Books. Log in to view."

**Benefits:**
- Zero-knowledge maintained (notification content encrypted)
- No third-party email provider sees data
- User controls communication channel

**Tradeoffs:**
- Requires user to have app open or push notifications enabled
- Email is more universal (works even if user forgets to check app)

**Recommendation:** Implement in-app notifications as primary, email as optional (opt-in).

---

### 10.2 Advisor-Client Anonymization

**Problem:** Platform sees advisor-client relationships (for billing).

**Solution:** Anonymous client IDs for billing purposes.

**Implementation:**
1. When client joins advisor's plan:
   - Generate `anonymousClientID = HMAC(advisorSecret, clientID)`
   - Send to server: `advisor_id`, `anonymousClientID` (not actual `clientID`)
2. Server tracks: Advisor X has clients [hash1, hash2, hash3...] (50 total)
3. Server cannot correlate: `hash1` belongs to Client A
4. Billing works: Server counts 50 hashes → charges advisor for 50 clients

**Benefits:**
- Platform cannot build advisor-client relationship graph
- Billing still functions (client count is accurate)
- Client privacy improved

**Tradeoffs:**
- More complex implementation (need advisor-specific secret)
- Server cannot help debug "which client is causing billing issue" (advisor must check locally)

**Recommendation:** Implement for public launch (privacy improvement).

---

### 10.3 View-Key Cryptographic Specification

**Problem:** View-key architecture is conceptually described but not cryptographically specified.

**Solution:** Detailed cryptographic design document.

**Proposed Architecture:**

```
Master Key (K_master)
    ↓ HKDF-Expand(context="transactions")
    K_transactions ← Encrypts transaction data
    ↓ HKDF-Expand(context="reports")
    K_reports ← Encrypts report data
    ↓ HKDF-Expand(context="documents")
    K_documents ← Encrypts uploaded documents
    ↓ HKDF-Expand(context="contacts")
    K_contacts ← Encrypts client/vendor info

View-Key for "View-Only Observer" permission:
    viewKey = {K_reports} (only reports sub-key)

View-Key for "Full View" permission:
    viewKey = {K_reports, K_transactions, K_contacts, K_documents} (all sub-keys except write keys)

View-Key for "Collaborative Partner" permission:
    viewKey = {K_reports, K_transactions, K_contacts, K_documents, K_write} (includes write key)
```

**View-Key Transmission:**
1. Advisor generates public/private key pair at account creation
2. Advisor's public key stored on server
3. Client retrieves advisor's public key
4. Client encrypts view-key bundle with advisor's public key
5. Encrypted view-key transmitted to server
6. Server stores encrypted view-key (cannot decrypt)
7. Advisor retrieves encrypted view-key, decrypts with private key

**View-Key Revocation:**
1. Client marks view-key as revoked (signed revocation request)
2. Server adds view-key ID to revocation list
3. Next advisor sync: Server checks revocation list, denies if revoked
4. Advisor's app receives revocation notification, clears local cache

**Recommendation:** Create detailed spec document before J7 implementation. Consult cryptography expert.

---

## 11. Compliance Considerations

### 11.1 GDPR (General Data Protection Regulation)

**Scope:** If any users are in EU, GDPR applies.

**Key Requirements:**

1. **Right to Access:**
   - Users can request all data Graceful Books has about them
   - Implementation: Export feature (user can download all their encrypted data)

2. **Right to Erasure:**
   - Users can request account deletion
   - Implementation: Delete user account, encrypted data, billing records (after retention period)

3. **Right to Portability:**
   - Users can export their data in machine-readable format
   - Implementation: CSV export (J9), JSON export

4. **Privacy by Design:**
   - Zero-knowledge architecture IS privacy by design
   - Data minimization: Only collect what's necessary
   - Encryption by default: All user data encrypted

5. **Data Processing Agreement (DPA):**
   - Third-party processors (Stripe, email provider) need DPAs
   - Stripe has standard DPA (available on request)
   - Email provider (Postmark/SendGrid) has standard DPA

**Recommendation:**
- Privacy policy clearly states: Zero-knowledge architecture, what metadata is visible
- Implement: Account deletion feature (full erasure)
- Sign DPAs with all third-party processors

---

### 11.2 SOC 2 Type II (Future)

**Scope:** For enterprise advisor customers (500+ clients), SOC 2 may be required.

**Key Requirements:**

1. **Security:** Encryption, access controls, vulnerability management
2. **Availability:** Uptime SLAs, disaster recovery
3. **Processing Integrity:** Data validation, error handling
4. **Confidentiality:** Zero-knowledge encryption supports this
5. **Privacy:** GDPR compliance, privacy policy

**Recommendation:**
- Begin SOC 2 preparation after product launch
- Engage auditor for gap analysis
- Typical timeline: 6-12 months to achieve SOC 2 Type II

---

## 12. Security Testing Recommendations

### 12.1 Penetration Testing

**Scope:** IC2, IC4, J7

**Tests:**
1. **Advisor-Client Relationship Mapping:**
   - Attempt to correlate client IDs to advisors via billing API
   - Verify anonymization is effective

2. **View-Key Permission Bypass:**
   - Advisor with "View-Only Observer" tries to access transactions
   - Verify permission enforcement (cannot decrypt transactions)

3. **Email Content Scraping:**
   - Intercept emails, extract financial data
   - Verify content minimization (no financial data in emails)

4. **Webhook Signature Bypass:**
   - Send unsigned webhook requests
   - Verify signature verification rejects them

5. **Team Member Privilege Escalation:**
   - Advisor team member tries to access unassigned client
   - Verify server blocks access

**Recommendation:** Engage third-party penetration testing firm after IC/J7 implementation.

---

### 12.2 Cryptography Audit

**Scope:** View-key architecture (J7), encryption implementation (A1, B2)

**Tests:**
1. **Key Derivation Review:**
   - Verify HKDF is used correctly
   - Verify context strings prevent key reuse

2. **View-Key Scoping:**
   - Verify sub-key derivation isolates data types
   - Verify advisor cannot decrypt data outside granted scope

3. **View-Key Transmission Security:**
   - Verify view-key encrypted with advisor's public key
   - Verify server cannot decrypt view-key

4. **Revocation Enforcement:**
   - Verify revoked view-keys are rejected
   - Verify no caching bypasses revocation

**Recommendation:** Engage cryptography expert (e.g., NCC Group, Trail of Bits) before J7 launch.

---

### 12.3 Privacy Audit

**Scope:** IC2, IC3, IC4, J7

**Tests:**
1. **Metadata Leakage:**
   - Document all metadata visible to platform
   - Verify privacy policy accurately describes this

2. **Third-Party Data Exposure:**
   - Verify Stripe only receives necessary billing data
   - Verify email provider only receives minimal notification data

3. **User Data Export:**
   - Test GDPR export feature
   - Verify all user data is included

4. **Account Deletion:**
   - Test GDPR erasure feature
   - Verify all data is deleted (except audit logs)

**Recommendation:** Internal privacy audit before public launch, external audit for SOC 2.

---

## 13. Incident Response Plan

### 13.1 Data Breach Scenarios

**Scenario 1: Database Compromise**

**What Attacker Gets:**
- Encrypted user data (cannot decrypt without user passphrases)
- Advisor-client relationship mapping (metadata)
- Stripe Customer IDs (can lookup in Stripe if attacker has keys)

**What Attacker CANNOT Get:**
- Transaction details (encrypted)
- Financial numbers (encrypted)
- User passphrases (hashed with Argon2id, not reversible)

**Response:**
1. Rotate all server-side secrets (database passwords, API keys)
2. Notify all users: "Database accessed, but your financial data is encrypted and safe"
3. Force password reset for all users (as precaution)
4. Review access logs: How did attacker get in?
5. Patch vulnerability, improve security controls

---

**Scenario 2: Stripe Account Compromise**

**What Attacker Gets:**
- Full billing information (payment methods, addresses)
- Ability to issue refunds, cancel subscriptions

**What Attacker CANNOT Get:**
- User financial data (not stored in Stripe)

**Response:**
1. Contact Stripe immediately: Freeze account, revoke compromised keys
2. Generate new Stripe API keys
3. Review all Stripe transactions in past 24 hours: Any fraudulent activity?
4. Notify affected users: "Billing system accessed, we've secured it"
5. Offer: Credit monitoring if payment methods compromised
6. Investigate: How were Stripe keys compromised? (GitHub leak, phishing, insider?)

---

**Scenario 3: Email Provider Compromise**

**What Attacker Gets:**
- All emails sent via Graceful Books (if content not minimized)
- User activity metadata (who received emails, when)

**What Attacker CANNOT Get:**
- User financial data (if email content minimization implemented)

**Response:**
1. If content minimization implemented: Minimal exposure (just "you have a notification" emails)
2. If financial data in emails: CRITICAL breach, notify all users immediately
3. Switch to new email provider, rotate API keys
4. Review: Which emails were accessed? What data was exposed?
5. Notify users: Specific data exposed (if any)

---

**Scenario 4: Advisor Account Compromise**

**What Attacker Gets:**
- View-keys for all clients under that advisor
- Ability to decrypt client financial data (within granted scope)

**What Attacker CANNOT Get:**
- Master keys (advisor doesn't have them)
- Data outside granted permissions (e.g., if "View-Only", no transaction detail)

**Response:**
1. Advisor notifies Graceful Books: "My account was compromised"
2. Immediately revoke all view-keys for that advisor
3. Notify all clients: "Your advisor's account was accessed, we've revoked access"
4. Clients review advisor's activity log: What data did attacker view?
5. Clients decide: Re-grant access to advisor (after advisor secures account) or not
6. Advisor: Reset password, enable 2FA, audit all team members

---

### 13.2 Incident Response Checklist

1. **Detect:** Monitoring alerts, user reports, security scan findings
2. **Assess:** What data was accessed? How did breach occur?
3. **Contain:** Revoke compromised credentials, patch vulnerability
4. **Eradicate:** Remove attacker's access, clean up any backdoors
5. **Recover:** Restore systems to secure state, verify integrity
6. **Notify:** Inform affected users, regulators (if required), public (if appropriate)
7. **Review:** Post-mortem, what went wrong, how to prevent recurrence

**Notification Requirements:**
- GDPR: Notify authorities within 72 hours of breach (if EU users affected)
- Users: Notify immediately if personal data compromised
- Public: Optional, but recommended for transparency

---

## 14. Conclusion

### Key Findings

1. **Zero-Knowledge Architecture Generally Sound:**
   - Most features maintain zero-knowledge encryption
   - Financial data remains encrypted, platform cannot access
   - ✅ Core promise of data sovereignty is upheld

2. **Critical Gaps Identified:**
   - Email content may expose financial data (IC4)
   - Advisor-client relationships visible to platform (IC2)
   - View-key architecture incompletely specified (J7)
   - Team member access creates new attack surface (J7)

3. **Metadata Leakage is Unavoidable:**
   - Billing requires some metadata (client count, user count)
   - Email delivery requires recipient addresses
   - This is acceptable IF transparently documented

4. **Third-Party Dependencies Introduce Risk:**
   - Stripe, email provider have access to some data
   - Choose privacy-focused providers
   - Minimize data sent to third parties

---

### Prioritized Action Items

**Before Infrastructure Capstone (IC) Launch:**
1. ✅ Redesign all email templates (notification-only, no financial data)
2. ✅ Implement advisor-client anonymization (billing metadata protection)
3. ✅ Design view-key cryptographic specification (J7 foundation)
4. ✅ Anonymize charity selection tracking (privacy improvement)
5. ✅ Choose privacy-focused email provider (Postmark over SendGrid)

**Before Group J Launch:**
1. ✅ Implement view-key architecture (cryptographically sound)
2. ✅ Require 2FA for advisor accounts (security hardening)
3. ✅ Individual view-keys per team member (access control)
4. ✅ CSV injection prevention (sanitize formulas)
5. ✅ Export security warnings (user education)

**Before Public Launch:**
1. ✅ Third-party penetration test (validate security)
2. ✅ Cryptography expert review (view-key architecture)
3. ✅ Privacy policy update (metadata leakage disclosure)
4. ✅ Incident response plan finalization (preparedness)
5. ✅ Security documentation for users (transparency)

---

### Final Assessment

**Overall Risk Level:** MEDIUM (with mitigation)

Graceful Books' zero-knowledge architecture is fundamentally sound. The identified risks are manageable with proper implementation. The most critical risks (email content exposure, incomplete view-key specification) can be mitigated before launch.

**With recommended mitigations implemented:**
- Financial data sovereignty: ✅ MAINTAINED
- User privacy: ✅ STRONG (with documented metadata leakage)
- Advisor-client security: ✅ SOUND (with proper view-key implementation)
- Payment security: ✅ PCI-COMPLIANT (Stripe handles card data)

**Recommendation:** PROCEED with Infrastructure Capstone and Group J, contingent on implementing the critical mitigations outlined in this analysis.

---

## Appendix A: Security Checklist for IC1-IC6

- [ ] IC1: UI components handle decrypted data client-side only
- [ ] IC2: Stripe Elements implemented (card data never touches servers)
- [ ] IC2: Webhook signature verification implemented
- [ ] IC2: Idempotency via event ID tracking
- [ ] IC2: Advisor-client anonymization implemented (optional but recommended)
- [ ] IC2: Billing metadata leakage documented in privacy policy
- [ ] IC3: Admin panel audit logging implemented (immutable trail)
- [ ] IC3: Charity selection anonymization implemented
- [ ] IC3: 2FA enforced for admin account
- [ ] IC4: All email templates use notification-only content (no financial data)
- [ ] IC4: Subject lines sanitized (no dynamic financial content)
- [ ] IC4: Template variable restrictions enforced (code review)
- [ ] IC4: Email open/click tracking disabled
- [ ] IC4: Privacy-focused email provider selected (Postmark recommended)
- [ ] IC5: All spec files include zero-knowledge compatibility sections
- [ ] IC6: Security validation criteria added to final validation checklist

---

## Appendix B: Security Checklist for J1-J12

- [ ] J1: Financial Flow Widget renders client-side only
- [ ] J2: AI processing is 100% local (tensorflow.js)
- [ ] J3: Scenario data stored encrypted
- [ ] J3: Scenario push emails use notification-only content
- [ ] J4: Reports generated client-side only
- [ ] J5: Goals stored encrypted client-side
- [ ] J6: Runway calculations happen client-side only
- [ ] J7: View-key cryptographic specification documented
- [ ] J7: View-key derivation implemented (HKDF with context)
- [ ] J7: View-key transmission secured (encrypted with advisor's public key)
- [ ] J7: View-key revocation implemented (revocation list + immediate effect)
- [ ] J7: Individual view-keys per team member implemented
- [ ] J7: 2FA required for advisor accounts
- [ ] J7: Advisor private notes encrypted with advisor's key
- [ ] J7: Team member offboarding procedure implemented
- [ ] J7: Client revocation clears advisor's local cache
- [ ] J8: Tax prep workflow happens client-side
- [ ] J8: Export package security warning displayed
- [ ] J8: Tax season emails use notification-only content
- [ ] J9: CSV import is client-side only (server never sees CSV)
- [ ] J9: CSV export is client-side only
- [ ] J9: CSV injection prevention implemented (sanitize formulas)
- [ ] J9: Export security warning displayed
- [ ] J10: Test data is synthetic (not real financial data)
- [ ] J11: Security tests included in test suite
- [ ] J12: Security test results in pass/fail criteria

---

## Appendix C: References

1. **NIST SP 800-207:** Zero Trust Architecture
2. **OWASP API Security Top 10:** API security best practices
3. **Stripe Security:** https://stripe.com/docs/security
4. **GDPR Compliance Guide:** https://gdpr.eu/
5. **PCI DSS:** Payment Card Industry Data Security Standard
6. **NIST Cryptographic Standards:** FIPS 140-2, SP 800-38D (AES-GCM)
7. **IETF RFC 5869:** HMAC-based Extract-and-Expand Key Derivation Function (HKDF)

---

**End of Security Analysis**

**Document Version:** 1.0
**Date:** 2026-01-19
**Prepared by:** Claude Sonnet 4.5 (Security Analysis Agent)
**Status:** Draft for Review
