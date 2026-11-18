# Data Handling Policy

**Document Version:** 1.3
**Last Updated:** 2026-11-17
**Owner:** Security Team
**Review Cadence:** Annual

This policy governs how Audacious Money (the application built on the Graceful Books codebase) handles user data. User data sovereignty is our foundational principle - users own their data, we are stewards at their discretion.

---

## Core Principles

### 1. Local-First Architecture

User financial data stays on the user's device.

- All financial data stored in local IndexedDB
- Full functionality works offline
- Our servers never receive transaction details
- Users can export all their data at any time

### 2. Changes Nothing Without a Yes

No data modification occurs without explicit user consent.

- Imports require review before committing
- AI suggestions wait in staging for approval
- Sync operations are user-initiated
- Destructive actions require confirmation

### 3. Data Integrity

User data must remain accurate and uncorrupted.

- All changes logged in tamper-resistant audit trail
- Backup files encrypted with user-controlled passphrase
- Regular integrity checks on local database
- Conflict resolution preserves all versions

### 4. Minimal Server Data

Our servers hold only what is necessary for account management.

**Server-Side Data (Minimal):**
- Email address (for authentication)
- Company name (for display)
- Support key (for customer service)
- Product tier (for feature access)
- Billing information (via Stripe)

**Never on Our Servers:**
- Transaction data
- Account balances
- Customer/vendor information
- Financial reports
- Backup passphrases

---

## Data Classification

### Critical (Local Only)

Data that never leaves the user's device:

| Data Type | Storage | Encryption |
|-----------|---------|------------|
| Transactions | IndexedDB | At-rest encryption |
| Journal entries | IndexedDB | At-rest encryption |
| Account balances | IndexedDB | At-rest encryption |
| Customer records | IndexedDB | At-rest encryption |
| Vendor records | IndexedDB | At-rest encryption |
| Financial reports | IndexedDB | At-rest encryption |
| Audit trail | IndexedDB | Integrity signatures |

### Sensitive (Encrypted Transit)

Data that may traverse networks with protection:

| Data Type | When Transmitted | Protection |
|-----------|------------------|------------|
| Sync payloads | Multi-device sync | E2E encryption (AES-256-GCM) |
| Backup files | Cloud backup | User passphrase encryption |
| Shared access | Multi-user | Role-based encryption keys |

### Operational (Server-Side)

Data required for service operation:

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Account email | Authentication | Account lifetime |
| Product tier | Feature access | Account lifetime |
| Billing records | Payment processing | Legal requirement |
| Support tickets | Customer service | 3 years |

---

## Data Lifecycle

### Collection

- Collect only what users explicitly provide
- No tracking pixels or analytics without consent
- No inference of data from behavior patterns
- Clear disclosure of what data goes where

### Processing

- Financial data processed locally only
- AI features operate on local data
- No server-side aggregation of user finances
- Calculations performed client-side

### Storage

- Financial data in encrypted local database
- 7-year retention for audit trail (accounting standard)
- User controls backup frequency and location
- Deleted data removed from active storage

### Deletion

Users can delete their account at any time via their profile settings or by contacting support.

**Our Approach: Soft Delete with Anonymization**

We use a "GracefulExit" anonymization pattern that balances privacy with accounting compliance:

- Your identity is replaced with an anonymous identifier (e.g., `GracefulExit-a1b2c3d4`)
- Personal information is permanently removed
- Anonymized records remain for accounting integrity (ledger lines must stay intact)

**What Gets Deleted (PII Removed Immediately):**
- Email address (nulled)
- First and last name (nulled)
- Company name (nulled)
- Password hash (replaced with unusable random hash)
- IP addresses from activity logs (nulled)
- Email recipient addresses from tracking records (nulled)
- Password reset tokens (hard deleted)

**What Gets Anonymized (Retained Without Identity):**
- User record with GracefulExit ID (identity removed, record remains)
- Product subscriptions (linked to anonymous ID for accounting)
- Payment history (linked to anonymous ID for accounting)
- Charity selections (linked to anonymous ID for donation tracking)
- Workshop enrollments (linked to anonymous ID for records)

**What We Must Retain (Legal Requirements):**
- Compliance audit log entry (original email address retained for 7 years) - Required for accounting compliance and fraud investigation
- Billing records via Stripe - Stripe retains transaction records per their policies and payment processor requirements
- One-way hash of email (SHA-256) - Used only for internal fraud detection, cannot be reversed

**What Happens to Active Subscriptions:**

Before account anonymization, all active Stripe subscriptions are automatically cancelled. You will:
- Receive confirmation that subscriptions are cancelled
- Not be charged again
- Lose access to subscription features immediately

**Re-signup After Deletion:**

You may create a new account using the same email address after deletion. The new account:
- Is completely separate from the deleted account
- Has no connection to previous subscription history
- Starts fresh with no access to previous data

**Deletion Confirmation:**

You will receive an email confirming your account deletion with:
- Confirmation that your account has been deleted
- Confirmation that billing has been stopped
- IP address of the deletion request (for security)
- Contact information if you did NOT request the deletion

**What Remains Under User Control:**
- Local data on user's device (user manages this themselves)
- Backup files (user controls these)
- Exported data (user's copies)

We are transparent about this: account deletion removes your identity and most personal information, but we retain anonymized records for accounting compliance. These retained records cannot be linked back to you without access to the compliance audit log, which is restricted to authorized personnel for legal purposes only.

---

## User Rights

### Right to Access

Users can access all their data:
- Export to standard formats (CSV, PDF, JSON)
- View complete audit trail
- Download full backup anytime

### Right to Correction

Users can correct any data:
- Edit transactions directly
- Adjust categorizations
- Modify account structures

### Right to Deletion

Users can delete their data:
- Delete individual records (local data)
- Clear account history (local data)
- Delete entire account (see "Deletion" section above for what this includes)

Note: Some billing and legal records must be retained per legal requirements. See the Deletion section in Data Lifecycle for full details.

### Right to Portability

Users can take their data elsewhere:
- Export in standard accounting formats
- No proprietary lock-in
- Full transaction history available

---

## Data Export and Import

### Export (Always Allowed)

Users own their data and can export it anytime. Export creates a copy - the data goes out, nothing comes back in.

**Supported Formats:**
- **CSV** - For spreadsheets and other accounting software
- **PDF** - For printed records and sharing with accountants
- **JSON** - For technical users and data portability

Export is a one-way operation. It poses no security risk to the user or the system.

### Import (Allowed with Safeguards)

Users may import data from external sources (bank statements, previous software, backup files). All imported data is treated as untrusted input.

**Security Controls on Import:**
- Schema validation - reject malformed or unexpected data structures
- Sanitization - strip any executable content or injection patterns
- Proof Gate validation - all imported transactions must balance
- Staging area - imported data goes to review before becoming live
- User approval required - nothing imports without explicit confirmation
- Audit trail - all imports logged with source file details

**Import Cannot:**
- Execute any code from imported files
- Bypass validation or sanitization
- Affect other users' data (in multi-user scenarios)
- Skip user review and approval

A user who imports problematic data may affect their own records, but can never affect other users.

---

## Third-Party Data Sharing

### We Do Not Sell Data

User data is never sold, rented, or traded. Ever.

### Limited Sharing

**1. User-Initiated Sharing**

The AI agent and Audacious Money do not share user data under any circumstance unless the user specifically instructs it. This is not a checkbox they click at sign-in. This means:

- The user explicitly tells us in their own words to share data, OR
- The user pushes the buttons themselves to initiate sharing

Connecting to external services (bank feeds, integrations) requires the user to actively initiate and authorize each connection.

**2. Legal Requirements to the Company**

If Audacious Money (the company) receives a court order or subpoena:

- We can only share data we actually have access to (see "Minimal Server Data" section above)
- We have: email, company name, support key, product tier, billing records
- We do NOT have: transactions, balances, financial reports, customer/vendor data
- We will comply only with proper legal process (valid court orders, subpoenas)
- We will notify the user if legally permitted to do so

**3. Legal Requirements to the User**

If a user receives a legal requirement to share their financial data:

- This is the user's responsibility to handle
- The user controls their local data and can export/share as they determine necessary
- We provide export tools but do not act on the user's behalf for legal matters
- Users should consult with legal counsel for their specific situation

**4. Service Operations**

Payment processing requires sharing billing information with Stripe. This is:
- Limited to billing data only (not financial records)
- Required for the service to function
- Disclosed at account creation

### Third-Party Awareness

When users connect to third-party services (bank feeds, integrations, export destinations):

- We display the third party's privacy policy or link to it before connection
- We inform users that the third party's handling of data is governed by their policies, not ours
- We recommend users review third-party privacy policies before connecting
- Audacious Money is not responsible for how third parties handle data once it leaves our system

We cannot control what other businesses do with data. We can only ensure users are informed before they choose to share.

---

## Breach Response

### Our Philosophy

We do not create unnecessary fear. A potential security event could be a real breach, or it could be a bug, a false alarm, or a misunderstanding. We get curious and find the root cause before alarming users.

AI agents and automated systems report potential issues to the company. **Only humans communicate breaches to users.** This ensures accurate, verified information reaches users - not speculation or false alarms.

### Response Timeline

**1. Detection (Immediate)**
- Automated systems or team members detect potential issue
- Internal notification to security team immediately
- AI agents report to company, never directly to users
- Begin containment if threat is confirmed

**2. Verification and Assessment (Priority - Reasonable Time)**
- Human review to determine: Is this a real breach or a bug/false alarm?
- Identify scope: What systems? What data? What time period?
- Identify impact: What could be affected?
- Identify affected users: Who specifically needs to know?
- This is treated as highest priority - we move quickly but accurately

**3. User Notification (After Verification, Within 72 Hours of Confirmation)**
- Only after scope, impact, and affected users are identified
- Only humans communicate with users - never AI agents
- Only affected users are notified (not everyone for every issue)
- Notification within 72 hours of confirmed breach (regulatory compliance)
- Clear, honest communication - not panic-inducing

**4. Investigation and Remediation**
- Complete root cause analysis
- Implement fixes
- Document lessons learned
- Update security measures

### What Users Receive (For Confirmed Breaches)

Communication comes from the company (humans), not AI:
- Clear description of what happened
- What data was actually affected
- What we are doing about it
- What they should do (if anything)
- Point of contact for questions
- Timeline for updates

### What This Means

- Bugs that look scary get investigated, not broadcast
- Users get accurate information, not speculation
- False alarms don't erode user trust
- Real breaches are communicated promptly and clearly
- The company takes responsibility for communication

---

## Compliance

This policy aligns with:
- Local-first architecture principles
- GAAP audit trail requirements
- User data sovereignty principles
- Transparency and consent frameworks

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-11 | Security Team | Initial release |
| 1.1 | 2026-11-12 | Security Team | Updated application name to Audacious Money |
| 1.2 | 2026-11-12 | Security Team | Added export/import security, clarified sharing policies, updated breach response, aligned deletion policy with actual codebase behavior |
| 1.3 | 2026-11-17 | Engineering | Major update to Deletion section reflecting GracefulExit anonymization implementation: soft delete with PII removal, anonymized record retention for accounting compliance, Stripe subscription cancellation, re-signup capability, deletion confirmation email |
