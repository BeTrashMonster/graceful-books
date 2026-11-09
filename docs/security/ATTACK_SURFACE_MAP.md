# Graceful Books Attack Surface Map

**Version:** 1.0.0
**Created:** 2026-11-09
**Methodology:** LASM (Layered Attack Surface Model)
**Status:** Phase 1.1 - Foundation Security

---

## Executive Summary

This document maps all entry points, storage locations, network communications, and trust boundaries in the Graceful Books application. This map serves as the foundation for threat modeling and security controls.

**Architecture:** Local-first, zero-knowledge with encrypted sync relay.

---

## 1. Data Entry Points

### 1.1 Authentication Forms

| Entry Point | Location | Data Type | Current Validation | Trust Level |
|-------------|----------|-----------|-------------------|-------------|
| Login Form | `src/pages/auth/Login.tsx` | Passphrase | Length check, local KDF | User Input |
| Signup Form | `src/pages/auth/Signup.tsx` | Email, passphrase | Email format, passphrase strength | User Input |
| Forgot Password | `src/pages/auth/ForgotPassword.tsx` | Email | Email format validation | User Input |
| Reset Password | `src/pages/auth/ResetPassword.tsx` | Token, new passphrase | Token validation, strength check | User Input |
| Admin Login | `src/pages/admin/AdminLogin.tsx` | Admin credentials | Rate limiting | Elevated User Input |

**Data Flow:**
```
User Input (Passphrase)
  → Local Key Derivation (Argon2id/PBKDF2)
  → Test Data Decryption
  → Session Token Generation
  → Master Key Kept in Memory Only
```

### 1.2 File Upload Entry Points

| Entry Point | Location | File Types | Current Validation | Risk Level |
|-------------|----------|------------|-------------------|------------|
| Receipt Upload | `src/components/receipts/ReceiptUpload.tsx` | Images, PDF | File type check | HIGH |
| CSV Import | `src/components/csv/CSVImporter.tsx` | CSV | Column mapping | HIGH |
| Bank Statement | `src/components/reconciliation/StatementUpload.tsx` | CSV, OFX | Format parsing | HIGH |
| Encrypted Backup | `src/components/backup/EncryptedBackup.tsx` | Encrypted JSON | Decryption validation | CRITICAL |
| File Restore | `src/components/restore/FileUploadRestore.tsx` | Encrypted backup | Passphrase + decryption | CRITICAL |
| Tax Documents | `src/components/tax/TaxDocumentUpload.tsx` | PDF, images | File type check | HIGH |

**Data Flow:**
```
File Upload
  → Type Validation
  → Content Parsing
  → Sanitization (where applicable)
  → Database Storage
  → Sync Queue
```

### 1.3 Form-Based Data Entry

| Entry Point | Location | Data Type | Current Validation | Trust Level |
|-------------|----------|-----------|-------------------|-------------|
| Transaction Entry | `src/components/transactions/TransactionDetailEdit.tsx` | Financial data | Amount validation | User Input |
| Vendor Form | `src/components/vendors/VendorForm.tsx` | Contact info | Required fields | User Input |
| Customer Form | `src/components/customers/CustomerForm.tsx` | Contact info | Required fields | User Input |
| Invoice Template | `src/components/invoices/TemplateCustomization.tsx` | HTML/text | CSP, sanitization | User Input |
| CPG Distributor | `src/components/cpg/DistributorProfileForm.tsx` | Business data | Field validation | User Input |
| Onboarding Worksheet | `src/components/onboarding/ComprehensiveWorksheet.tsx` | Business assessment | Required fields | User Input |

### 1.4 Admin Entry Points

| Entry Point | Location | Data Type | Current Validation | Risk Level |
|-------------|----------|-----------|-------------------|------------|
| Workshop Form | `src/components/admin/workshops/WorkshopForm.tsx` | Workshop data | Admin auth | ELEVATED |
| Charity Verification | `src/components/admin/CharityVerificationForm.tsx` | Charity data | Admin auth | ELEVATED |
| Lifetime Codes | `src/components/admin/lifetimeCodes/CreateCodeModal.tsx` | Access codes | Admin auth | CRITICAL |

---

## 2. Data Storage Locations

### 2.1 IndexedDB (Primary Local Storage)

**Database:** TreasureChest (Dexie.js wrapper)
**Location:** `src/db/database.ts`

| Table | Schema Location | Sensitive Fields | Encryption | Retention |
|-------|-----------------|------------------|------------|-----------|
| `users` | `src/db/schema/users.schema.ts` | email_hash, master_key | At-rest | Account lifetime |
| `sessions` | `src/db/schema/users.schema.ts` | token, device_id | At-rest | Until expiration |
| `transactions` | `src/db/schema/transactions.schema.ts` | amount, memo, account_id | At-rest | 7 years |
| `accounts` | `src/db/schema/accounts.schema.ts` | balance, name | At-rest | 7 years |
| `invoices` | `src/db/schema/invoices.schema.ts` | amounts, customer_data | At-rest | 7 years |
| `auditLogs` | `src/db/schema/audit.schema.ts` | All changes | At-rest | 7 years |
| `receipts` | `src/db/schema/receipts.schema.ts` | image_data | At-rest | 7 years |
| `contacts` | `src/db/schema/contacts.schema.ts` | PII | At-rest | Account lifetime |
| `portalTokens` | `src/db/schema/portalTokens.schema.ts` | access_token | At-rest | 90 days |
| `restorationTokens` | `src/db/schema/restorationTokens.schema.ts` | restore_token | At-rest | 90 days |
| `charities` | `src/db/schema/charities.schema.ts` | charity_selection | At-rest | Account lifetime |
| `products` | `src/db/schema/cpg.schema.ts` | product_data | At-rest | Account lifetime |
| `categories` | `src/db/schema/categories.schema.ts` | category_names | At-rest | Account lifetime |
| `payments` | `src/db/schema/payments.schema.ts` | payment_data | At-rest | 7 years |
| `billing` | `src/db/schema/billing.schema.ts` | subscription_data | At-rest | Account lifetime |

**Total Tables:** 60+ (see `src/db/schema/` for complete list)

### 2.2 LocalStorage (Unencrypted)

| Key | Purpose | Sensitive | Risk |
|-----|---------|-----------|------|
| `graceful_books_sync_vector` | CRDT version vector | No | LOW |
| `graceful_books_last_sync` | Last sync timestamp | No | LOW |
| `graceful_books_mock_sync_server` | Development mock data | No | LOW |
| `graceful_books_failed_attempts` | Login attempt tracking | Metadata | MEDIUM |

### 2.3 Secure Storage (Encrypted)

**Location:** `src/utils/secureStorage.ts`
**Encryption:** AES-256-GCM with device-specific key

| Key Prefix | Purpose | Encryption |
|------------|---------|------------|
| `passphrase-test-` | Passphrase validation | AES-256-GCM |
| `device-token-` | Device authentication | AES-256-GCM |

### 2.4 SessionStorage

**Location:** `src/auth/sessionStorage.ts`

| Data | Purpose | Lifetime |
|------|---------|----------|
| Session token | Active authentication | Tab close |
| Device fingerprint | Session binding | Tab close |
| Temporary auth data | Login flow | Tab close |

### 2.5 Backend Database (PostgreSQL)

**Location:** `audacious_money_backend/src/db/`

| Table | Purpose | Sensitive |
|-------|---------|-----------|
| `users` | Account data (hashed passwords) | YES |
| `companies` | Company information | YES |
| `subscriptions` | Billing subscriptions | YES |
| `audit_logs` | Server-side audit | YES |
| `workshops` | Workshop management | NO |

---

## 3. Network Communication

### 3.1 API Endpoints (Frontend → Backend)

**Base:** Environment-configured API URL

#### Authentication APIs
| Endpoint | Method | Data | Auth Required |
|----------|--------|------|---------------|
| `/auth/signup` | POST | email, password | No |
| `/auth/login` | POST | email, password | No |
| `/auth/forgot-password` | POST | email | No |
| `/auth/reset-password` | POST | token, password | No |
| `/auth/verify-email` | POST | verification_token | No |

#### User APIs
| Endpoint | Method | Data | Auth Required |
|----------|--------|------|---------------|
| `/users/profile` | GET | - | Yes |
| `/users/profile` | PUT | profile_data | Yes |
| `/users/account` | DELETE | - | Yes |

#### Admin APIs
| Endpoint | Method | Data | Auth Required |
|----------|--------|------|---------------|
| `/admin/users` | GET | - | Admin |
| `/admin/users/:id` | GET | - | Admin |
| `/admin/users/:id/status` | PUT | status | Admin |
| `/admin/charities` | GET | - | Admin |

#### Sync APIs
| Endpoint | Method | Data | Auth Required |
|----------|--------|------|---------------|
| `/api/sync/push` | POST | encrypted_changes | Yes |
| `/api/sync/pull` | POST | version_vector | Yes |
| `/api/sync/health` | GET | - | No |

#### Billing APIs
| Endpoint | Method | Data | Auth Required |
|----------|--------|------|---------------|
| Stripe endpoints | Various | payment_data | Yes |
| Webhook endpoints | POST | stripe_events | Signature |

### 3.2 Third-Party APIs

| Service | Purpose | Data Sent | Data Received |
|---------|---------|-----------|---------------|
| Stripe | Payment processing | Payment tokens | Subscription status |
| Exchange Rate API | Currency conversion | None | Exchange rates |
| Charity API | Charity data | None | Charity information |

### 3.3 WebSocket Connections

Currently none implemented. Future consideration for real-time sync.

---

## 4. Trust Boundaries

### Trust Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER DEVICE                                  │
│                                                                     │
│  ┌─────────────────┐         ┌─────────────────────────────────┐   │
│  │    Browser      │         │         IndexedDB               │   │
│  │    (React)      │◄───────►│     (TreasureChest DB)          │   │
│  │                 │   TB1   │                                 │   │
│  │  ┌───────────┐  │         │   - Encrypted at rest           │   │
│  │  │ In-Memory │  │         │   - CRDT version vectors        │   │
│  │  │Master Key │  │         │   - 60+ tables                  │   │
│  │  └───────────┘  │         └─────────────────────────────────┘   │
│  └────────┬────────┘                                               │
│           │                                                         │
│           │ TB2: Device ↔ Network                                   │
└───────────┼─────────────────────────────────────────────────────────┘
            │
            │ TLS 1.3 + Encrypted Payloads
            │
┌───────────▼─────────────────────────────────────────────────────────┐
│                      SYNC RELAY SERVER                               │
│                                                                     │
│  - Zero-knowledge: cannot decrypt user data                         │
│  - Stores encrypted blobs only                                      │
│  - Auth: JWT tokens                                                 │
│  - Rate limiting enabled                                            │
│                                                                     │
│           │ TB3: Relay ↔ Other Devices                              │
└───────────┼─────────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────────┐
│                    OTHER USER DEVICES                                │
│                                                                     │
│  - Multi-user scenarios                                             │
│  - Role-based access (Admin, Manager, User, Consultant, Accountant) │
│  - CRDT conflict resolution                                         │
│  - Permission enforcement per device                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
            │
            │ TB4: App ↔ Third-Party Services
            │
┌───────────▼─────────────────────────────────────────────────────────┐
│                    THIRD-PARTY SERVICES                              │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Stripe    │  │ Exchange    │  │  Charity    │                 │
│  │  (Payments) │  │    Rates    │  │    APIs     │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Trust Boundary Details

#### TB1: Browser ↔ IndexedDB Storage
- **Description:** Data flows between React application and local database
- **Controls:**
  - Origin isolation (same-origin policy)
  - Encryption at rest
  - Audit trail on all operations
- **Risks:**
  - Browser extension access
  - DevTools manipulation
  - XSS leading to data access

#### TB2: Device ↔ Network (Sync Relay)
- **Description:** Data synchronization between device and relay server
- **Controls:**
  - TLS 1.3 transport encryption
  - Payload encryption (AES-256-GCM)
  - JWT authentication
  - Rate limiting
- **Risks:**
  - MITM attacks (mitigated by TLS)
  - Token theft
  - Replay attacks

#### TB3: Relay ↔ Other Devices (Multi-User)
- **Description:** Data sharing between authorized users via relay
- **Controls:**
  - CRDT conflict resolution
  - Role-based permissions
  - Per-user encryption keys
  - Audit trail per user
- **Risks:**
  - Privilege escalation
  - Unauthorized data access
  - Sync conflicts with data loss

#### TB4: App ↔ Third-Party Services
- **Description:** Integration with external services
- **Controls:**
  - API key management
  - Webhook signature validation
  - Minimal data exposure
- **Risks:**
  - API key leakage
  - Webhook spoofing
  - Third-party compromise

---

## 5. Sensitive Data Inventory

### 5.1 Data Classification

| Classification | Description | Examples |
|----------------|-------------|----------|
| **CRITICAL** | Encryption keys, passwords | Master key, passphrase hash |
| **HIGH** | Financial data, PII | Transactions, customer data |
| **MEDIUM** | Business data | Categories, products |
| **LOW** | Non-sensitive metadata | Timestamps, sync vectors |

### 5.2 Critical Data Locations

| Data | Location | Protection |
|------|----------|------------|
| Master encryption key | Browser memory only | Zeroed on logout |
| Passphrase | Never stored | Used for KDF only |
| Session tokens | SessionStorage | Cleared on tab close |
| API keys | Environment variables | Not committed |
| Stripe secrets | Backend only | Not in frontend |

---

## 6. Security Controls Summary

### 6.1 Implemented Controls

| Control | Location | Status |
|---------|----------|--------|
| Input sanitization | `src/utils/sanitize.ts` | Active |
| XSS prevention | DOMPurify | Active |
| CSRF protection | Token-based | Active |
| Rate limiting | `src/utils/rateLimiter.ts` | Active |
| CSP headers | Backend middleware | Active |
| Encryption at rest | IndexedDB + SecureStorage | Active |
| Audit logging | `src/db/schema/audit.schema.ts` | Active |
| Session security | `src/auth/sessionSecurity.ts` | Active |

### 6.2 Gap Analysis

| Gap | Risk Level | Recommendation |
|-----|------------|----------------|
| No formal attack surface verification tests | HIGH | Create automated discovery tests |
| Backup restoration needs additional validation | MEDIUM | Add integrity checks |
| CSV import lacks injection pattern detection | HIGH | Implement sanitization pipeline |
| No automated supply chain scanning | MEDIUM | Add dependency audit |

---

## 7. Verification Criteria

This document is verified by the following tests:

- [ ] `src/__tests__/security/attackSurfaceVerification.test.ts`
- [ ] All documented entry points exist in codebase
- [ ] No undocumented entry points discovered
- [ ] All storage locations documented
- [ ] All network endpoints documented
- [ ] All trust boundaries mapped

---

## Appendix A: File Discovery Commands

```bash
# Find all form submissions
grep -r "onSubmit\|handleSubmit" src/ --include="*.tsx"

# Find all fetch/axios calls
grep -r "fetch\|axios\|http" src/ --include="*.ts" --include="*.tsx"

# Find all file input handlers
grep -r "type=\"file\"\|<input.*file" src/ --include="*.tsx"

# Find all localStorage usage
grep -r "localStorage\|sessionStorage" src/ --include="*.ts"

# Find Dexie table definitions
grep -r "stores\({" src/db/ --include="*.ts"
```

---

## Appendix B: Schema Discovery

All IndexedDB schemas are located in `src/db/schema/`:
- `accounts.schema.ts`
- `audit.schema.ts`
- `billing.schema.ts`
- `categories.schema.ts`
- `charities.schema.ts`
- `contacts.schema.ts`
- `cpg.schema.ts`
- `emailPreferences.schema.ts`
- `invoices.schema.ts`
- `payments.schema.ts`
- `portalTokens.schema.ts`
- `receipts.schema.ts`
- `restorationTokens.schema.ts`
- `transactions.schema.ts`
- `users.schema.ts`
- ... and more (60+ total)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-11-09 | Security Implementation | Initial attack surface map |

---

*This document is part of the Agentic AI Security Implementation Roadmap, Phase 1: Foundation Security.*
