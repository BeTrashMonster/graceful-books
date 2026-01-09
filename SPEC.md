# Graceful Books - Product Requirements Specification

**Version:** 1.0.0
**Status:** Draft
**Last Updated:** 2026-01-09

---

## 1. Executive Summary

### 1.1 Vision Statement

Graceful Books is an immersive, educational accounting platform designed to empower entrepreneurs—especially those who are numbers-adverse—to build, understand, and maintain their financial foundation. The software prioritizes user data ownership through zero-knowledge encryption, progressive feature disclosure based on readiness, and personality-adapted communication.

### 1.2 Core Principles

| Principle | Description |
|-----------|-------------|
| **User Data Sovereignty** | Users own their data via encrypted local-first architecture; no server-side access to unencrypted information |
| **Progressive Empowerment** | Features reveal as users are ready, preventing overwhelm |
| **Judgment-Free Education** | All language and interactions are supportive, flexible, and shame-free |
| **GAAP Compliance** | Full professional accounting capabilities beneath the accessible interface |
| **Social Impact** | Built-in charitable giving with transparency and accountability |

---

## 2. System Architecture

### 2.1 Zero-Knowledge Local-First Sync

#### 2.1.1 Encryption Model

```
REQUIREMENT: ARCH-001
PRIORITY: Critical
CATEGORY: Security/Architecture

The system SHALL implement a zero-knowledge encryption architecture where:

1. All user financial data is encrypted on-device before transmission
2. Sync relay servers act as "dumb pipes" with no ability to decrypt data
3. Encryption keys never leave user devices in unencrypted form
4. The platform operator cannot access user financial data under any circumstances

ACCEPTANCE CRITERIA:
- [ ] Data at rest is encrypted with AES-256 or equivalent
- [ ] Data in transit uses TLS 1.3+ with additional payload encryption
- [ ] Security audit confirms zero-knowledge compliance
- [ ] Key recovery mechanism exists that doesn't compromise zero-knowledge
```

#### 2.1.2 Key Management

```
REQUIREMENT: ARCH-002
PRIORITY: Critical
CATEGORY: Security

The system SHALL implement hierarchical key management:

1. MASTER KEY GENERATION
   - Admin creates company and generates master encryption key
   - Master key derived from strong passphrase using Argon2id
   - Key never transmitted; only encrypted derivatives shared

2. USER KEY DERIVATION
   - Each invited user receives a derived key for their permission level
   - Derived key encrypted with user's password before transmission
   - Permission levels: Admin, Manager, Bookkeeper, View-Only

3. KEY ROTATION
   - Admin can rotate keys instantly to revoke access
   - Removed users' local copies become unreadable
   - Active users receive new derived keys automatically

ACCEPTANCE CRITERIA:
- [ ] Key derivation uses industry-standard KDF (Argon2id)
- [ ] Permission-based key derivation implemented
- [ ] Key rotation completes within 60 seconds for active sessions
- [ ] Revoked user data is cryptographically inaccessible
```

#### 2.1.3 Sync Infrastructure

```
REQUIREMENT: ARCH-003
PRIORITY: Critical
CATEGORY: Architecture

The system SHALL support multiple sync relay options:

1. HOSTED RELAY (Default)
   - Managed relay service provided by Graceful Books
   - Geographic distribution for performance
   - SLA: 99.9% uptime

2. SELF-HOSTED RELAY
   - Docker container / binary for user deployment
   - Full documentation for setup
   - No feature limitations vs. hosted option

3. PEER-TO-PEER (Future)
   - Direct device-to-device sync on same network
   - Reduced latency for co-located teams

ACCEPTANCE CRITERIA:
- [ ] Hosted relay achieves <200ms sync latency (same region)
- [ ] Self-hosted relay deployment documented and tested
- [ ] Relay passes no unencrypted data (verified by packet inspection)
```

#### 2.1.4 Conflict Resolution

```
REQUIREMENT: ARCH-004
PRIORITY: High
CATEGORY: Architecture

The system SHALL use CRDTs (Conflict-free Replicated Data Types) for:

1. Simultaneous edits merge automatically without data loss
2. Offline edits sync correctly when connectivity restored
3. Audit trail maintained for all merged changes
4. User notification when significant merges occur

CRDT STRATEGY BY DATA TYPE:
- Transactions: Last-write-wins with full history preservation
- Chart of Accounts: Structural CRDT (tree-based)
- Invoices: Field-level LWW with conflict flagging
- Settings: Last-write-wins

ACCEPTANCE CRITERIA:
- [ ] Two users editing same invoice simultaneously: no data loss
- [ ] 48-hour offline period syncs correctly
- [ ] Merge conflicts logged in audit trail
- [ ] User can view "conflict history" for any record
```

---

## 2.2 Data Architecture & Database Schema

### 2.2.1 Architecture Overview

```
REQUIREMENT: ARCH-005
PRIORITY: Critical
CATEGORY: Architecture

The system SHALL implement a dual-database architecture that maintains zero-knowledge encryption throughout:

1. **CLIENT-SIDE DATABASE** (IndexedDB via Dexie.js)
   - Stores encrypted financial data locally
   - Full offline capability (no network required for core operations)
   - CRDT metadata for conflict-free synchronization
   - Performance target: Support minimum 10,000 transactions without degradation

2. **SYNC RELAY DATABASE** (Server-side)
   - Stores encrypted payloads only (no plaintext business data)
   - Timestamp-based retrieval for synchronization
   - Automatic purging of acknowledged sync payloads
   - Zero business logic (relay only)

STORAGE ENCRYPTION:
- **Client**: All sensitive tables encrypted at field level before storage in IndexedDB
- **Server**: Encrypted blobs only (server has no schema knowledge)
- **Transport**: TLS 1.3 + payload encryption (defense in depth)

PERFORMANCE REQUIREMENTS:
- Transaction save: <500ms including encryption
- Full chart of accounts load: <200ms
- Sync push/pull: <2 seconds for 100 transactions
- Database query: <100ms for indexed lookups

ACCEPTANCE CRITERIA:
- [ ] Client database supports 10,000+ transactions with <1 second load time
- [ ] Encrypted data size <150% of plaintext size
- [ ] Server relay has no access to decrypted financial data (verified by code audit)
- [ ] Database migration from v1 to v2 completes without data loss
- [ ] Backup/restore maintains encryption throughout process
```

### 2.2.2 Client Database Schema (IndexedDB)

**ASCII ENTITY-RELATIONSHIP DIAGRAM:**

```
                                    ┌──────────────────┐
                                    │    COMPANY       │
                                    │──────────────────│
                                    │ id (PK)          │
                                    │ name (encrypted) │
                                    │ masterKeyHash    │
                                    │ settings (JSON)  │
                                    │ created_at       │
                                    │ updated_at       │
                                    └────────┬─────────┘
                                             │
                                             │ 1:N
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    v                        v                        v
          ┌─────────────────┐      ┌────────────────┐      ┌─────────────────┐
          │    ACCOUNTS     │      │     USERS      │      │  TRANSACTIONS   │
          │─────────────────│      │────────────────│      │─────────────────│
          │ id (PK)         │      │ id (PK)        │      │ id (PK)         │
          │ company_id (FK) │      │ company_id (FK)│      │ company_id (FK) │
          │ account_number  │      │ email (enc)    │      │ date (enc)      │
          │ name (enc)      │      │ role           │      │ description(enc)│
          │ type (enum)     │      │ derivedKey(enc)│      │ type (enum)     │
          │ parent_id (FK)  │      │ permissions    │      │ status (enum)   │
          │ balance (enc)   │      │ device_id      │      │ reference (enc) │
          │ active (bool)   │      │ last_login     │      │ version (CRDT)  │
          │ created_at      │      │ created_at     │      │ created_at      │
          │ updated_at      │      └────────────────┘      │ updated_at      │
          │ deleted_at      │                              │ voided_at       │
          └────────┬────────┘                              └───────┬─────────┘
                   │                                               │
                   │                                               │ 1:N
                   │                                               │
                   │                                      ┌────────v─────────┐
                   │                                      │ TRANSACTION_     │
                   │                                      │     LINES        │
                   │                                      │──────────────────│
                   │                                      │ id (PK)          │
                   │                                      │ transaction_id   │
                   │                                      │ account_id (FK)──┤
                   │                                      │ debit_amt (enc)  │
                   │                                      │ credit_amt (enc) │
                   │                                      │ memo (enc)       │
                   │                                      │ class_id (FK)    │
                   │                                      │ tags (JSON enc)  │
                   │                                      │ line_number      │
                   │                                      │ created_at       │
                   └──────────────────────────────────────┤ updated_at       │
                                                          └──────────────────┘
                                                                   │
                      ┌────────────────────────────────────────────┼──────┐
                      │                                            │      │
                      v                                            v      v
            ┌───────────────────┐                        ┌────────────────┐
            │    CONTACTS       │                        │   PRODUCTS     │
            │───────────────────│                        │────────────────│
            │ id (PK)           │                        │ id (PK)        │
            │ company_id (FK)   │                        │ company_id (FK)│
            │ type (enum)       │                        │ name (enc)     │
            │ name (enc)        │                        │ description(enc)│
            │ email (enc)       │                        │ type (enum)    │
            │ phone (enc)       │                        │ price (enc)    │
            │ address (JSON enc)│                        │ cost (enc)     │
            │ tax_id (enc)      │                        │ sku            │
            │ payment_terms     │                        │ inventory_qty  │
            │ created_at        │                        │ active (bool)  │
            │ updated_at        │                        │ created_at     │
            │ deleted_at        │                        │ updated_at     │
            └─────────┬─────────┘                        └────────┬───────┘
                      │                                           │
                      │ 1:N                                       │ 1:N
                      v                                           v
            ┌───────────────────┐                        ┌────────────────┐
            │    INVOICES       │                        │  INVENTORY_    │
            │───────────────────│                        │  ADJUSTMENTS   │
            │ id (PK)           │                        │────────────────│
            │ company_id (FK)   │                        │ id (PK)        │
            │ contact_id (FK)   │                        │ product_id (FK)│
            │ invoice_number    │                        │ type (enum)    │
            │ date (enc)        │                        │ qty_change     │
            │ due_date (enc)    │                        │ reason (enc)   │
            │ status (enum)     │                        │ date           │
            │ subtotal (enc)    │                        │ created_by     │
            │ tax_amount (enc)  │                        │ created_at     │
            │ total (enc)       │                        └────────────────┘
            │ terms (enc)       │
            │ created_at        │                        ┌────────────────┐
            │ sent_at           │                        │  AUDIT_LOG     │
            │ paid_at           │                        │────────────────│
            │ updated_at        │                        │ id (PK)        │
            └─────────┬─────────┘                        │ company_id (FK)│
                      │                                  │ user_id (FK)   │
                      │ 1:N                              │ entity_type    │
                      v                                  │ entity_id      │
            ┌───────────────────┐                        │ action (enum)  │
            │  INVOICE_LINES    │                        │ before_value   │
            │───────────────────│                        │ after_value    │
            │ id (PK)           │                        │ ip_hash        │
            │ invoice_id (FK)   │                        │ timestamp      │
            │ product_id (FK)   │                        │ device_id      │
            │ description (enc) │                        │ created_at     │
            │ quantity          │                        └────────────────┘
            │ unit_price (enc)  │
            │ tax_rate          │                        ┌────────────────┐
            │ line_total (enc)  │                        │ RECONCILIATION │
            │ line_number       │                        │────────────────│
            │ created_at        │                        │ id (PK)        │
            └───────────────────┘                        │ account_id (FK)│
                                                         │ stmt_date (enc)│
                                                         │ stmt_bal (enc) │
                  ┌──────────────┐                       │ status (enum)  │
                  │   CLASSES    │                       │ completed_at   │
                  │──────────────│                       │ created_by     │
                  │ id (PK)      │                       │ notes (enc)    │
                  │ company_id   │                       │ created_at     │
                  │ name (enc)   │                       │ updated_at     │
                  │ description  │                       └────────────────┘
                  │ active (bool)│
                  │ created_at   │                       ┌────────────────┐
                  │ updated_at   │                       │ SYNC_METADATA  │
                  └──────────────┘                       │────────────────│
                                                         │ id (PK)        │
                  ┌──────────────┐                       │ entity_type    │
                  │     TAGS     │                       │ entity_id      │
                  │──────────────│                       │ vector_clock   │
                  │ id (PK)      │                       │ last_modified  │
                  │ company_id   │                       │ last_sync_at   │
                  │ name (enc)   │                       │ sync_status    │
                  │ color (hex)  │                       │ conflict_flag  │
                  │ created_at   │                       │ created_at     │
                  │ updated_at   │                       │ updated_at     │
                  └──────────────┘                       └────────────────┘

KEY:
  (PK) = Primary Key
  (FK) = Foreign Key
  (enc) = Encrypted field
  (enum) = Enumerated type
  1:N = One-to-Many relationship
```

**FIELD ENCRYPTION STRATEGY:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ LEVEL 1: ENCRYPTED AT REST (Most Sensitive - AES-256-GCM)          │
├─────────────────────────────────────────────────────────────────────┤
│ Financial Amounts:                                                  │
│   - All debit_amount, credit_amount, balance fields                 │
│   - Invoice totals, subtotals, tax amounts                          │
│   - Product prices, costs                                           │
│   - Statement balances                                              │
│                                                                     │
│ Personal/Business Information:                                      │
│   - Company name, contact names, customer names                     │
│   - Email addresses, phone numbers                                  │
│   - Physical addresses (stored as encrypted JSON)                   │
│   - Tax ID numbers                                                  │
│                                                                     │
│ Transaction Details:                                                │
│   - Transaction descriptions, memos                                 │
│   - Invoice terms, notes                                            │
│   - Product descriptions                                            │
│   - Account names, reconciliation notes                             │
│                                                                     │
│ Dates (when combined with amounts):                                │
│   - Transaction dates, invoice dates, due dates                     │
│   - Statement dates                                                 │
├─────────────────────────────────────────────────────────────────────┤
│ LEVEL 2: HASHED (Integrity Check - BLAKE3)                         │
├─────────────────────────────────────────────────────────────────────┤
│   - masterKeyHash (for zero-knowledge authentication)               │
│   - IP addresses in audit log (privacy protection)                  │
│   - Device identifiers (anonymized)                                 │
├─────────────────────────────────────────────────────────────────────┤
│ LEVEL 3: PLAINTEXT (Non-Sensitive Metadata)                        │
├─────────────────────────────────────────────────────────────────────┤
│ Identifiers:                                                        │
│   - All UUIDs (randomly generated, not sequential)                  │
│   - Foreign key references                                          │
│                                                                     │
│ Timestamps:                                                         │
│   - created_at, updated_at, deleted_at                              │
│   - last_login, last_sync_at                                        │
│                                                                     │
│ Enumerated Values:                                                  │
│   - Account types (ASSET, LIABILITY, etc.)                          │
│   - Transaction types, statuses                                     │
│   - Contact types (CUSTOMER, VENDOR)                                │
│   - User roles, permissions                                         │
│                                                                     │
│ Boolean Flags:                                                      │
│   - active, deleted, archived flags                                 │
│                                                                     │
│ CRDT Metadata:                                                      │
│   - Version vectors, vector clocks                                  │
│   - Sync status flags                                               │
│   - Conflict flags                                                  │
└─────────────────────────────────────────────────────────────────────┘

ENCRYPTION IMPLEMENTATION:
- Algorithm: AES-256-GCM (Web Crypto API)
- Key: Derived from Company Key (HKDF with context)
- IV: Randomly generated per field (96-bit nonce)
- Tag: 128-bit authentication tag appended
- Encoding: Base64 for storage (encrypted_value = base64(iv + ciphertext + tag))
```

### 2.2.3 Detailed Table Specifications

#### COMPANY Table

```
REQUIREMENT: ARCH-005-TABLE-COMPANY
PURPOSE: Root entity for all business data (single company per database instance)

FIELDS:
- id: UUID (primary key, generated client-side via crypto.randomUUID())
- name: VARCHAR(255), encrypted (company/business name)
- masterKeyHash: CHAR(64), hashed with BLAKE3 (for zero-knowledge auth verification)
- settings: JSONB, encrypted (user preferences, phase, DISC profile, feature flags)
- created_at: TIMESTAMP (UTC, ISO 8601 format)
- updated_at: TIMESTAMP (auto-updated on modification)

INDEXES:
- PRIMARY KEY (id)
- No additional indexes needed (single record per database)

CONSTRAINTS:
- Only one COMPANY record permitted per database instance
- name must not be empty after encryption
- settings JSON must validate against schema

ENCRYPTION DETAILS:
- name: Encrypted with Company Key
- settings: Encrypted as whole JSON blob
- masterKeyHash: BLAKE3(HKDF(Master Key, "auth-token"))

EXAMPLE SETTINGS JSON:
{
  "phase": "STABILIZE",
  "discProfile": "DRIVER",
  "locale": "en-US",
  "currency": "USD",
  "fiscalYearEnd": "12-31",
  "assessmentDate": "2026-01-09T10:00:00Z",
  "featureFlags": {
    "multiCurrency": false,
    "3dVisualization": false
  }
}

ACCEPTANCE CRITERIA:
- [ ] Company record created during onboarding
- [ ] Settings updated without decrypting/re-encrypting entire record
- [ ] masterKeyHash never transmitted to server in plaintext
```

#### ACCOUNTS Table

```
REQUIREMENT: ACCT-001, ARCH-005-TABLE-ACCOUNTS
PURPOSE: Chart of Accounts - hierarchical account structure

FIELDS:
- id: UUID (primary key)
- company_id: UUID (foreign key to COMPANY)
- account_number: VARCHAR(20), nullable (e.g., "1000", "4500" - user-assigned)
- name: VARCHAR(255), encrypted (e.g., "Operating Checking Account")
- type: ENUM, plaintext
  - Values: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE, COGS, OTHER_INCOME, OTHER_EXPENSE
- parent_id: UUID, nullable (foreign key to ACCOUNTS for sub-accounts)
- balance: DECIMAL(15,2), encrypted (current balance, calculated field)
- description: TEXT, encrypted, nullable (plain English explanation)
- active: BOOLEAN, default TRUE (soft delete alternative)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- deleted_at: TIMESTAMP, nullable (soft delete marker)

INDEXES:
- PRIMARY KEY (id)
- INDEX idx_accounts_company ON (company_id)
- INDEX idx_accounts_type ON (company_id, type) -- for P&L and Balance Sheet queries
- INDEX idx_accounts_parent ON (company_id, parent_id) -- for hierarchy traversal
- INDEX idx_accounts_number ON (company_id, account_number) -- for user lookup
- INDEX idx_accounts_active ON (company_id, active, type) -- for active accounts list

CONSTRAINTS:
- Parent account must be same type OR null
- Account number unique within company (if provided)
- Type must match parent type (if parent exists)
- Cannot delete account with child accounts (must delete children first OR set parent_id to null)
- Cannot delete account with transaction history (use soft delete: deleted_at)

CRDT STRATEGY:
- **Field updates**: Last-write-wins based on updated_at timestamp
- **Deletion**: Tombstone marker (deleted_at timestamp)
- **Structural conflict** (parent_id change): Flag for manual resolution
- **Rename conflict**: Last-write-wins, audit log records both versions

BALANCE CALCULATION:
- Balance is calculated, not user-entered
- Recalculated from TRANSACTION_LINES on each query
- Cached for performance, invalidated on transaction change
- Formula: SUM(debits) - SUM(credits) for ASSET/EXPENSE
          SUM(credits) - SUM(debits) for LIABILITY/EQUITY/INCOME

ACCEPTANCE CRITERIA:
- [ ] Chart of accounts supports 500+ accounts without performance issues
- [ ] Hierarchy supports 5 levels deep
- [ ] Balance calculation matches audit to penny
- [ ] Soft delete preserves historical data
- [ ] Account search by number returns result in <100ms
```

#### TRANSACTIONS Table

```
REQUIREMENT: ACCT-004, ACCT-005, ARCH-005-TABLE-TRANSACTIONS
PURPOSE: All financial transactions (journal entries)

FIELDS:
- id: UUID (primary key)
- company_id: UUID (foreign key to COMPANY)
- date: DATE, encrypted (transaction date, can be backdated)
- description: VARCHAR(500), encrypted (what happened)
- type: ENUM, plaintext
  - Values: JOURNAL, INVOICE_PAYMENT, BILL_PAYMENT, TRANSFER, ADJUSTMENT, OPENING_BALANCE
- status: ENUM, plaintext
  - Values: DRAFT, POSTED, VOIDED, RECONCILED
  - Transitions: DRAFT → POSTED → [VOIDED or RECONCILED]
- reference_number: VARCHAR(50), encrypted, nullable (check number, invoice #, etc.)
- version: INTEGER (CRDT vector clock for conflict detection)
- created_at: TIMESTAMP
- created_by: UUID (user_id who created)
- updated_at: TIMESTAMP
- updated_by: UUID (user_id of last edit)
- voided_at: TIMESTAMP, nullable
- voided_by: UUID, nullable
- voided_reason: TEXT, encrypted, nullable

INDEXES:
- PRIMARY KEY (id)
- INDEX idx_transactions_company ON (company_id, date DESC) -- for journal view
- INDEX idx_transactions_status ON (company_id, status) -- for draft/posted lists
- INDEX idx_transactions_created ON (company_id, created_at DESC) -- for recent activity
- INDEX idx_transactions_reference ON (company_id, reference_number) -- for lookups

CONSTRAINTS:
- Date cannot be more than 1 year in future (warning only, not enforced)
- Status transitions enforced by application logic
- Voided transactions cannot be edited (status immutable)
- Transaction lines must balance: SUM(debits) = SUM(credits)
- At least 2 transaction lines required

VALIDATION RULES:
- Date in future: Show warning but allow (for scheduled transactions)
- Date > 1 year past: Show warning "Are you sure?" (prevent data entry errors)
- Description required, min 3 characters
- Reference number format validated based on type

CRDT STRATEGY:
- **Version field**: Increments on each edit (Lamport clock)
- **Concurrent edits**: Higher version wins, loser flagged for manual review
- **Voiding**: Special tombstone that preserves transaction for audit
- **Conflict resolution**: If both users void simultaneously, first void wins

STATE MACHINE (Status Transitions):
```
           ┌──────────┐
           │  DRAFT   │ (editable)
           └────┬─────┘
                │
                v
           ┌──────────┐
           │  POSTED  │ (locked for editing, can void or reconcile)
           └─────┬────┘
                 │
         ┌───────┴────────┐
         v                v
    ┌─────────┐      ┌────────────┐
    │  VOIDED │      │ RECONCILED │ (both are terminal states)
    └─────────┘      └────────────┘
```

ACCEPTANCE CRITERIA:
- [ ] Transaction save <500ms including encryption
- [ ] Voided transactions visible in audit trail
- [ ] Cannot edit posted transaction (must void and create new)
- [ ] Balance validation enforced before posting
- [ ] Search by reference number returns result instantly
```

#### TRANSACTION_LINES Table

```
REQUIREMENT: ACCT-005, ARCH-005-TABLE-TRANSACTION-LINES
PURPOSE: Individual debit/credit lines for each transaction (double-entry bookkeeping)

FIELDS:
- id: UUID (primary key)
- transaction_id: UUID (foreign key to TRANSACTIONS)
- account_id: UUID (foreign key to ACCOUNTS)
- debit_amount: DECIMAL(15,2), encrypted, nullable
- credit_amount: DECIMAL(15,2), encrypted, nullable
- memo: VARCHAR(255), encrypted, nullable (line-specific note)
- class_id: UUID, nullable (foreign key to CLASSES for dimensional tracking)
- tags: JSONB, encrypted (array of tag UUIDs for multi-dimensional classification)
- line_number: INTEGER (order within transaction, 1-indexed)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

INDEXES:
- PRIMARY KEY (id)
- INDEX idx_lines_transaction ON (transaction_id, line_number) -- for line ordering
- INDEX idx_lines_account ON (account_id, transaction_id) -- for account register
- INDEX idx_lines_class ON (class_id) -- for class-based reporting

CONSTRAINTS:
- Exactly ONE of debit_amount or credit_amount must be non-null (XOR constraint)
- Both debit and credit cannot be non-null simultaneously
- Amount must be > 0 if present
- line_number must be sequential within transaction (1, 2, 3...)
- SUM(debit_amount) MUST EQUAL SUM(credit_amount) for parent transaction

VALIDATION RULES:
- Account must be active (warning if inactive, not error)
- Amount precision: 2 decimal places
- Amount range: $0.01 to $999,999,999.99
- Memo length: 255 characters max
- Tags: Maximum 10 tags per line

BUSINESS RULES:
- ASSET/EXPENSE accounts: Increase with DEBIT, decrease with CREDIT
- LIABILITY/EQUITY/INCOME accounts: Increase with CREDIT, decrease with DEBIT
- Every transaction needs minimum 2 lines (double-entry)
- Split transactions can have 3+ lines (e.g., invoice with tax and tip)

ACCEPTANCE CRITERIA:
- [ ] Balance validation enforced before transaction posting
- [ ] Line reordering updates line_number atomically
- [ ] Deleting line recalculates parent transaction balance
- [ ] Class and tag filtering returns results in <200ms
```

#### CONTACTS Table

```
REQUIREMENT: ACCT-009, ARCH-005-TABLE-CONTACTS
PURPOSE: Customers, vendors, and other business contacts

FIELDS:
- id: UUID (primary key)
- company_id: UUID (foreign key to COMPANY)
- type: ENUM, plaintext
  - Values: CUSTOMER, VENDOR, BOTH, OTHER
- name: VARCHAR(255), encrypted (individual or business name)
- email: VARCHAR(255), encrypted, nullable
- phone: VARCHAR(50), encrypted, nullable
- address: JSONB, encrypted, nullable (structured: street, city, state, zip, country)
- tax_id: VARCHAR(50), encrypted, nullable (EIN, SSN last 4, VAT number)
- payment_terms: VARCHAR(50), plaintext, nullable (e.g., "Net 30", "Due on receipt")
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- deleted_at: TIMESTAMP, nullable (soft delete)

INDEXES:
- PRIMARY KEY (id)
- INDEX idx_contacts_company ON (company_id, type)
- INDEX idx_contacts_name ON (company_id, name) -- for autocomplete (encrypted search challenging)

CONSTRAINTS:
- Name required, min 2 characters
- Email format validated if provided
- Phone format flexible (allows international)
- Type cannot be null

ADDRESS JSON STRUCTURE:
{
  "street1": "123 Main St",
  "street2": "Suite 100",
  "city": "San Francisco",
  "state": "CA",
  "postal_code": "94102",
  "country": "US"
}

ACCEPTANCE CRITERIA:
- [ ] Contact search by name (encrypted) returns results in <500ms
- [ ] Email validation prevents invalid addresses
- [ ] Address autocomplete integrated (if API available)
- [ ] Soft delete prevents orphaned invoices
```

#### INVOICES Table

```
REQUIREMENT: ACCT-002, ARCH-005-TABLE-INVOICES
PURPOSE: Customer invoices (accounts receivable)

FIELDS:
- id: UUID (primary key)
- company_id: UUID (foreign key to COMPANY)
- contact_id: UUID (foreign key to CONTACTS - must be type CUSTOMER or BOTH)
- invoice_number: VARCHAR(50), plaintext (user-assigned or auto-generated: INV-0001)
- date: DATE, encrypted (invoice date)
- due_date: DATE, encrypted (payment due date)
- status: ENUM, plaintext
  - Values: DRAFT, SENT, VIEWED, PARTIAL_PAID, PAID, OVERDUE, VOID
- subtotal: DECIMAL(15,2), encrypted (sum of line items before tax)
- tax_amount: DECIMAL(15,2), encrypted (calculated tax)
- total: DECIMAL(15,2), encrypted (subtotal + tax)
- terms: TEXT, encrypted, nullable (payment terms, notes)
- created_at: TIMESTAMP
- sent_at: TIMESTAMP, nullable (when emailed/delivered to customer)
- paid_at: TIMESTAMP, nullable (when fully paid)
- updated_at: TIMESTAMP

INDEXES:
- PRIMARY KEY (id)
- INDEX idx_invoices_company ON (company_id, invoice_number) -- for lookup
- INDEX idx_invoices_contact ON (contact_id, status) -- for customer statement
- INDEX idx_invoices_status ON (company_id, status, due_date) -- for aging report
- INDEX idx_invoices_date ON (company_id, date DESC) -- for invoice list

CONSTRAINTS:
- invoice_number must be unique within company
- due_date must be >= date (cannot be due before invoice date)
- subtotal, tax_amount, total must be >= 0
- total must equal subtotal + tax_amount
- status transitions follow state machine

STATUS STATE MACHINE:
```
  ┌───────┐       ┌──────┐       ┌────────┐
  │ DRAFT │──────>│ SENT │──────>│ VIEWED │
  └───┬───┘       └──────┘       └───┬────┘
      │                               │
      │         ┌─────────────────────┘
      │         v
      │    ┌──────────────┐    ┌──────┐
      └───>│ PARTIAL_PAID │───>│ PAID │
           └──────────────┘    └──────┘
                  │
                  v (if past due_date)
             ┌──────────┐
             │ OVERDUE  │
             └──────────┘

  From any state (except PAID):
      │
      v
   ┌──────┐
   │ VOID │ (terminal state)
   └──────┘
```

ACCEPTANCE CRITERIA:
- [ ] Invoice PDF generation includes all encrypted data decrypted
- [ ] Aging report categorizes by days overdue (0-30, 31-60, 61-90, 90+)
- [ ] Payment recorded creates transaction automatically
- [ ] Void invoice creates reversing transaction
```

#### Additional Tables (Summary)

Due to length constraints, here are specifications for remaining tables:

**INVOICE_LINES**: Line items for invoices (product/service, quantity, price)
**PRODUCTS**: Product/service catalog (name, description, price, cost, SKU)
**INVENTORY_ADJUSTMENTS**: Quantity changes (purchase, sale, adjustment, recount)
**CLASSES**: Dimensional tracking (department, location, project)
**TAGS**: Flexible tagging system (color-coded, user-defined)
**RECONCILIATION**: Bank reconciliation tracking (statement date, balance, matched transactions)
**AUDIT_LOG**: Immutable change history (who, what, when for all modifications)
**SYNC_METADATA**: CRDT sync tracking (vector clocks, conflict flags, last sync timestamp)
**USERS**: Multi-user support (email, role, permissions, device IDs)

*Full specifications for these tables follow the same pattern established above.*

### 2.2.4 Sync Relay Database Schema (Server-Side)

```
REQUIREMENT: ARCH-003, ARCH-005-SYNC
PRIORITY: Critical
CATEGORY: Architecture

The sync relay server SHALL store ONLY encrypted payloads with no knowledge of business data:

SYNC_PAYLOADS Table:

FIELDS:
- id: UUID (primary key, generated server-side)
- company_id: UUID (indexed, NOT a foreign key - server has no COMPANY table)
- encrypted_payload: BYTEA (entire sync payload as opaque binary blob)
- timestamp: TIMESTAMP (server timestamp for ordering)
- checksum: CHAR(64) (SHA-256 of payload for integrity verification)
- acknowledged_by: JSONB (array of device IDs that have pulled this payload)
- expires_at: TIMESTAMP (auto-delete after all devices acknowledge + retention period)
- created_at: TIMESTAMP

INDEXES:
- PRIMARY KEY (id)
- INDEX idx_sync_company_time ON (company_id, timestamp DESC) -- for pull queries
- INDEX idx_sync_expires ON (expires_at) -- for cleanup job

RETENTION POLICY:
- Minimum retention: 7 days (allow for offline device sync)
- Maximum retention: 90 days (compliance and storage optimization)
- Cleanup: DELETE WHERE expires_at < NOW() AND acknowledged_by includes all registered devices
- Cron job: Runs daily at 2 AM UTC

SERVER OPERATIONS:
The relay server can ONLY perform these operations:
1. **Store** encrypted payload (POST /sync/push)
2. **Retrieve** encrypted payloads by timestamp (GET /sync/pull?since=<timestamp>)
3. **Mark acknowledged** (POST /sync/acknowledge)
4. **Delete expired** (automated cleanup)

SERVER LIMITATIONS (Zero-Knowledge Guarantees):
- ❌ Cannot decrypt payloads (no encryption keys)
- ❌ Cannot parse payload content (opaque binary)
- ❌ Cannot validate business logic (no schema knowledge)
- ❌ Cannot aggregate or analyze data
- ❌ Cannot search within payloads
- ✅ CAN verify checksum (integrity only, not content)
- ✅ CAN order by timestamp (sorting only)

ACCEPTANCE CRITERIA:
- [ ] Server code review confirms no business logic
- [ ] Packet capture shows only encrypted blobs on network
- [ ] Database admin cannot read financial data from SYNC_PAYLOADS table
- [ ] Cleanup job runs successfully without data loss
- [ ] Retention policy tested with 100-day offline scenario
```

### 2.2.5 Data Migration Strategy

```
REQUIREMENT: DATA-MIGRATION-001
PRIORITY: Medium
CATEGORY: Data Architecture

The system SHALL support importing existing financial data from competitor products:

SUPPORTED IMPORT FORMATS:

1. **QuickBooks Desktop** (.QBW export to .IIF format)
   - Chart of Accounts
   - Customers and Vendors
   - Transactions (journal entries, invoices, bills)
   - Products/Services list

2. **QuickBooks Online** (.QBO file export)
   - All data types above
   - Plus: Classes, Tags (via CSV)

3. **Xero** (CSV export)
   - Chart of Accounts (CSV)
   - Contacts (CSV)
   - Transactions (CSV)

4. **Wave** (CSV export)
   - Similar structure to Xero

5. **CSV Templates** (Generic)
   - Graceful Books-provided templates
   - User can map columns

MIGRATION WORKFLOW:

```
┌──────────────────────┐
│ User uploads file    │
│ (.IIF, .QBO, .CSV)   │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Format detection     │
│ (magic bytes, ext)   │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Parse file           │
│ Extract entities     │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Data validation      │
│ - Required fields    │
│ - Format checks      │
│ - Balance validation │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Preview mapping      │◄──┐
│ Show sample data     │   │
└──────────┬───────────┘   │
           │               │
           v               │
   ┌──────────────┐        │
   │ User reviews │        │
   │ Adjusts map? ├────────┘
   └──────┬───────┘ Yes
          │
          │ No
          v
┌──────────────────────┐
│ Dry-run import       │
│ (no database writes) │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Show summary:        │
│ - X accounts         │
│ - Y transactions     │
│ - Z contacts         │
│ - Warnings/errors    │
└──────────┬───────────┘
           │
           v
   ┌──────────────┐
   │ User confirms│
   │ or cancels   │
   └──────┬───────┘
          │
          │ Confirm
          v
┌──────────────────────┐
│ Encrypted import     │
│ Write to IndexedDB   │
│ with encryption      │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Validation report    │
│ - Import summary     │
│ - Balance check      │
│ - Warnings to review │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Prompt first         │
│ reconciliation       │
└──────────────────────┘
```

MAPPING RULES (Examples):

**QuickBooks Account Types → Graceful Books Account Types:**
- "Bank" → ASSET
- "Accounts Receivable" → ASSET
- "Other Current Asset" → ASSET
- "Fixed Asset" → ASSET
- "Accounts Payable" → LIABILITY
- "Credit Card" → LIABILITY
- "Other Current Liability" → LIABILITY
- "Equity" → EQUITY
- "Income" → INCOME
- "Other Income" → OTHER_INCOME
- "Cost of Goods Sold" → COGS
- "Expense" → EXPENSE
- "Other Expense" → OTHER_EXPENSE

**Transaction Type Mapping:**
- QuickBooks "Invoice" → Graceful Books INVOICE_PAYMENT transaction
- QuickBooks "Bill" → Graceful Books BILL_PAYMENT transaction
- QuickBooks "Journal Entry" → Graceful Books JOURNAL transaction
- QuickBooks "Transfer" → Graceful Books TRANSFER transaction

DATA CLEANING:

- **Remove duplicates**: Check by transaction date + amount + description
- **Fix unbalanced entries**: Flag for manual review (don't auto-fix)
- **Validate dates**: Reject dates > 1 year in future
- **Merge duplicate accounts**: Suggest merges for similar names
- **Preserve IDs**: Keep original IDs in metadata field for reference

ACCEPTANCE CRITERIA:
- [ ] QuickBooks import completes for company with 1000 transactions in <60 seconds
- [ ] Balance sheet matches pre-import balances (verified by test)
- [ ] All imported data encrypted before storage
- [ ] Import errors clearly explained with suggested fixes
- [ ] Can re-import without duplicates (idempotent)
- [ ] Mapping adjustments saved for future imports

DECISION REQUIRED:
- [ ] **Detailed mapping specification** for each source format
  - Owner: Product Manager + Accountant Advisor
  - Effort: Research each format's schema
- [ ] **Fallback handling** for unsupported transaction types
  - Owner: Product Manager
```

---

### 2.1.5 Authentication & Authorization Architecture

```
REQUIREMENT: ARCH-006
PRIORITY: Critical
CATEGORY: Security

The system SHALL implement authentication and authorization that maintains zero-knowledge architecture while supporting multi-user collaboration:

KEY PRINCIPLES:
1. **Zero-Knowledge Authentication**: Server never receives user passphrase or encryption keys
2. **Multi-Device Support**: Same user can access from multiple devices with seamless sync
3. **Role-Based Access Control**: Admin, Manager, Bookkeeper, View-Only permissions
4. **Optional Recovery**: User choice between absolute zero-knowledge or recoverable backup
5. **Device Management**: Users can view and revoke device access

AUTHENTICATION FLOW (NEW USER REGISTRATION):

```
┌──────────────────────────┐
│ User creates account     │
│ - Email                  │
│ - Passphrase (client)    │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Validate passphrase      │
│ strength (entropy ≥60b)  │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Generate Master Key      │
│ Argon2id(passphrase)     │
│ - Time cost: 3           │
│ - Memory: 64 MB          │
│ - Parallelism: 4         │
│ - Salt: email + UUID     │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Derive keys using HKDF:  │
│ K_enc = encryption key   │
│ K_auth = auth token key  │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Generate Company Key     │
│ (random 256-bit)         │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Encrypt Company Key      │
│ with K_enc               │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Hash K_auth → token      │
│ (BLAKE3 for server auth) │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Send to server:          │
│ - email                  │
│ - hashed_auth_token      │
│ - encrypted_company_key  │
│ - test_payload (verify)  │
│ ❌ NEVER send K_enc      │
│ ❌ NEVER send passphrase │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Server stores:           │
│ - hashed_auth_token      │
│ - encrypted_company_key  │
│ (opaque blob)            │
│ - CANNOT decrypt data    │
└──────────────────────────┘
```

AUTHENTICATION FLOW (EXISTING USER LOGIN):

```
┌──────────────────────────┐
│ User enters credentials  │
│ - Email                  │
│ - Passphrase             │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Derive Master Key        │
│ (same Argon2id process)  │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Derive K_enc + K_auth    │
│ (same HKDF derivation)   │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Hash K_auth → token      │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Send token to server     │
│ POST /auth/login         │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Server compares hashes   │
│ If match: success        │
└──────────┬───────────────┘
           │
           v (success)
┌──────────────────────────┐
│ Server returns:          │
│ - encrypted_company_key  │
│ - JWT access token       │
│ - refresh token (cookie) │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Client decrypts          │
│ Company Key with K_enc   │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Store in memory:         │
│ - K_enc (session only)   │
│ - Company Key (session)  │
│ JWT in httpOnly cookie   │
└──────────────────────────┘
           │
           v
┌──────────────────────────┐
│ Load encrypted financial │
│ data from IndexedDB      │
│ Decrypt with Company Key │
└──────────────────────────┘
```

KEY RECOVERY MECHANISM (OPTIONAL):

```
PROBLEM: User forgets passphrase → all data permanently unrecoverable
SOLUTION: Optional recovery key backup (user choice during setup)

RECOVERY KEY GENERATION (OPT-IN):

┌──────────────────────────┐
│ During account setup:    │
│ "Would you like a        │
│ recovery key?"           │
│ [Yes] [No, absolute ZK]  │
└──────────┬───────────────┘
           │
           │ Yes
           v
┌──────────────────────────┐
│ Generate random 256-bit  │
│ recovery key             │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Encrypt Master Key       │
│ with recovery key        │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Convert recovery key to  │
│ 24-word BIP39 mnemonic   │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Display to user:         │
│ "Write these 24 words    │
│ down. Keep them safe."   │
│                          │
│ 1. abandon  7. canal     │
│ 2. ability  8. carbon    │
│ ... (24 words total)     │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Confirmation: User must  │
│ enter 3 random words     │
│ from the list to prove   │
│ they wrote them down     │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Store on server:         │
│ - encrypted_master_key   │
│   (opaque, needs mnemonic│
│    to decrypt)           │
│ Server NEVER sees:       │
│ - mnemonic words         │
│ - recovery key           │
│ - decrypted master key   │
└──────────────────────────┘

RECOVERY FLOW (IF USER FORGETS PASSPHRASE):

┌──────────────────────────┐
│ User clicks              │
│ "I forgot my passphrase" │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Prompt: Enter 24-word    │
│ recovery mnemonic        │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Convert mnemonic to      │
│ recovery key (BIP39)     │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Fetch encrypted_master_  │
│ key from server          │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Decrypt master key       │
│ with recovery key        │
│ (client-side only)       │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Derive K_enc and K_auth  │
│ from restored master key │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ User sets NEW passphrase │
│ Master key re-encrypted  │
│ with new passphrase      │
└──────────────────────────┘

ZERO-KNOWLEDGE MAINTAINED:
- Server stores encrypted master key (opaque blob)
- Server never sees recovery mnemonic
- Decryption happens client-side only
- User can skip recovery (absolute zero-knowledge)
```

SESSION MANAGEMENT:

```
REQUIREMENT: ARCH-006-SESSION
PRIORITY: High

SESSION LIFECYCLE:

1. **Access Token (JWT)**:
   - Lifetime: 24 hours
   - Stored: httpOnly cookie (XSS protection)
   - Contains: user_id, company_id, role, device_id
   - Used for: API request authentication

2. **Refresh Token**:
   - Lifetime: 30 days
   - Stored: httpOnly, secure cookie
   - Rotated: On each use (for security)
   - Used for: Obtaining new access tokens

3. **Automatic Refresh**:
   - Trigger: 5 minutes before access token expires
   - Silent: No user interaction required
   - Fallback: If refresh fails, prompt re-login

4. **Logout**:
   - Clear K_enc from memory
   - Clear Company Key from memory
   - Invalidate refresh token server-side
   - Optional: Clear IndexedDB (user choice)

MULTI-DEVICE SUPPORT:

Each device gets own derived key:
┌──────────────────────────┐
│ Device 1: Desktop        │
│ - device_id: UUID-1      │
│ - Last seen: 2 min ago   │
│ - Status: Active         │
└──────────────────────────┘

┌──────────────────────────┐
│ Device 2: Laptop         │
│ - device_id: UUID-2      │
│ - Last seen: 1 day ago   │
│ - Status: Active         │
└──────────────────────────┘

┌──────────────────────────┐
│ Device 3: Phone          │
│ - device_id: UUID-3      │
│ - Last seen: Never       │
│ - Status: Pending setup  │
└──────────────────────────┘

USER CAN:
- View list of all devices
- See last activity per device
- Revoke access to any device
- Add new device (QR code or email link)

ADMIN ACTIONS:
- Revoke access (takes effect <60 seconds)
- Force logout all devices
- Device limit: 5 per user (configurable)

SECURITY MEASURES:
- Device fingerprinting (browser, OS, location)
- Suspicious activity alerts (new device, new location)
- Rate limiting: 5 login attempts per hour per email
- Account lockout: After 5 failed attempts (24-hour lockout)
- Brute force protection: Exponential backoff
```

AUTHORIZATION ROLES & PERMISSIONS:

```
REQUIREMENT: ARCH-006-AUTHZ
PRIORITY: High
CATEGORY: Access Control

ROLE HIERARCHY:

┌─────────────────────────────────────────────────────────────────┐
│                            ADMIN                                │
│ Full access to everything + user management + settings         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            v                               v
┌──────────────────────┐        ┌─────────────────────────┐
│      MANAGER         │        │      BOOKKEEPER         │
│ All accounting ops   │        │ Daily transactions only │
│ NO user management   │        │ NO account structure    │
└───────────────────┬──┘        └──┬──────────────────────┘
                    │              │
                    └──────┬───────┘
                           v
                ┌────────────────────────┐
                │      VIEW-ONLY         │
                │ Read access only       │
                │ NO modifications       │
                └────────────────────────┘

PERMISSION MATRIX:

┌─────────────────────┬────────┬─────────┬────────────┬───────────┐
│ Permission          │ Admin  │ Manager │ Bookkeeper │ View-Only │
├─────────────────────┼────────┼─────────┼────────────┼───────────┤
│ View all data       │   ✓    │    ✓    │     ✓      │     ✓     │
│ Export data         │   ✓    │    ✓    │     ✓      │     ✓     │
│ View audit log      │   ✓    │    ✓    │     ✓      │     ✓     │
├─────────────────────┼────────┼─────────┼────────────┼───────────┤
│ Create transactions │   ✓    │    ✓    │     ✓      │     ✗     │
│ Edit transactions   │   ✓    │    ✓    │     ✓      │     ✗     │
│ Post transactions   │   ✓    │    ✓    │     ✓      │     ✗     │
│ Delete trans (draft)│   ✓    │    ✓    │     ✗      │     ✗     │
│ Void trans (posted) │   ✓    │    ✓    │     ✗      │     ✗     │
├─────────────────────┼────────┼─────────┼────────────┼───────────┤
│ Reconcile accounts  │   ✓    │    ✓    │     ✓      │     ✗     │
│ Create invoices     │   ✓    │    ✓    │     ✓      │     ✗     │
│ Record payments     │   ✓    │    ✓    │     ✓      │     ✗     │
├─────────────────────┼────────┼─────────┼────────────┼───────────┤
│ Chart of Accounts   │   ✓    │    ✓    │     ✗      │     ✗     │
│ Add/edit accounts   │   ✓    │    ✓    │     ✗      │     ✗     │
│ Delete accounts     │   ✓    │    ✓    │     ✗      │     ✗     │
├─────────────────────┼────────┼─────────┼────────────┼───────────┤
│ Manage contacts     │   ✓    │    ✓    │     ✓      │     ✗     │
│ Manage products     │   ✓    │    ✓    │     ✓      │     ✗     │
│ Manage classes/tags │   ✓    │    ✓    │     ✓      │     ✗     │
├─────────────────────┼────────┼─────────┼────────────┼───────────┤
│ Company settings    │   ✓    │    ✗    │     ✗      │     ✗     │
│ User management     │   ✓    │    ✗    │     ✗      │     ✗     │
│ Add/remove users    │   ✓    │    ✗    │     ✗      │     ✗     │
│ Change user roles   │   ✓    │    ✗    │     ✗      │     ✗     │
│ Rotate company key  │   ✓    │    ✗    │     ✗      │     ✗     │
│ View recovery key   │   ✓    │    ✗    │     ✗      │     ✗     │
└─────────────────────┴────────┴─────────┴────────────┴───────────┘

IMPLEMENTATION:

1. **Role Storage**:
   - User.role field (enum: ADMIN, MANAGER, BOOKKEEPER, VIEW_ONLY)
   - Default: First user = ADMIN, subsequent = VIEW_ONLY
   - Admin can change roles

2. **Permission Checks**:
   - Frontend: Hide UI elements based on role
   - Backend: Enforce at API level (cannot be bypassed)
   - Middleware: Check JWT role claim on every request

3. **UI Adaptation**:
   - VIEW_ONLY: All forms disabled, "Contact admin to make changes"
   - BOOKKEEPER: Chart of Accounts shown but grayed out
   - MANAGER: User management hidden
   - ADMIN: All features visible

4. **Audit Trail**:
   - All permission-denied attempts logged
   - "User X (Bookkeeper) attempted to delete account Y"
   - Admin can review access attempts
```

KEY ROTATION:

```
REQUIREMENT: ARCH-006-KEY-ROTATION
PRIORITY: Medium
CATEGORY: Security

WHEN TO ROTATE:
- User requests (proactive security)
- After user removal (employee leaves)
- After suspected key compromise
- Scheduled rotation (optional: annually)

KEY ROTATION PROCESS:

┌──────────────────────────┐
│ Admin initiates rotation │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Confirm: "This will      │
│ temporarily pause sync   │
│ for all devices. OK?"    │
└──────────┬───────────────┘
           │
           │ Confirm
           v
┌──────────────────────────┐
│ Generate new Company Key │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Decrypt ALL data with    │
│ old Company Key          │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Re-encrypt ALL data with │
│ new Company Key          │
│ (batch process)          │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Encrypt new Company Key  │
│ with each user's K_enc   │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Update all users' stored │
│ encrypted_company_key    │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Force logout all devices │
│ (except current)         │
└──────────┬───────────────┘
           │
           v
┌──────────────────────────┐
│ Next login: Fetch new    │
│ encrypted_company_key    │
│ Seamless to user         │
└──────────────────────────┘

CHALLENGES:
- Large datasets take time to re-encrypt
- Progress indicator: "Rotating keys... 47% complete"
- Offline devices: Must re-authenticate on next sync
- Partial failure: Rollback mechanism required

ACCEPTANCE CRITERIA:
- [ ] Key rotation completes for 10,000 transactions in <5 minutes
- [ ] All devices force logout except admin device
- [ ] Old key immediately invalidated (cannot decrypt)
- [ ] Rollback available if process fails mid-rotation
```

ACCEPTANCE CRITERIA:

```
OVERALL AUTH/AUTHZ ACCEPTANCE CRITERIA:

AUTHENTICATION:
- [ ] Passphrase strength: minimum entropy 60 bits (enforced client-side)
- [ ] Server cannot decrypt any user data (verified by code audit + pentesting)
- [ ] Recovery key is optional (user choice)
- [ ] Account lockout after 5 failed login attempts (24-hour lockout)
- [ ] Session expires after 24 hours of inactivity
- [ ] Multi-device support: up to 5 devices per user

AUTHORIZATION:
- [ ] Role permissions enforced at API level (not just UI)
- [ ] Permission-denied attempts logged in audit trail
- [ ] Admin can view all user activities
- [ ] Bookkeeper cannot modify chart of accounts
- [ ] View-Only cannot modify any data

SECURITY:
- [ ] Device revocation takes effect within 60 seconds
- [ ] Password reset requires email verification + recovery key (if set)
- [ ] Brute force protection: exponential backoff (5, 15, 30, 60 min lockouts)
- [ ] Session tokens never transmitted in URL (only httpOnly cookies)
- [ ] CSRF protection enabled on all state-changing endpoints

ZERO-KNOWLEDGE VERIFICATION:
- [ ] Network packet capture shows no plaintext passphrase or keys
- [ ] Database dump shows only encrypted/hashed values
- [ ] Server code audit confirms no decryption capability
- [ ] Third-party security audit verifies zero-knowledge claims
```

---

## 3. User Onboarding & Assessment

### 3.1 Assessment Framework

```
REQUIREMENT: ONB-001
PRIORITY: Critical
CATEGORY: Onboarding

The system SHALL implement a comprehensive onboarding assessment that:

1. Determines user's current phase: Stabilize, Organize, Build, or Grow
2. Assesses Financial Literacy level (Beginner, Developing, Proficient, Advanced)
3. Categorizes business type: Service-based, Product-based, or Hybrid

CONSTRAINTS:
- Maximum 40 questions total
- Branching logic based on business type selection
- Progress indicator throughout
- Ability to save and resume

ACCEPTANCE CRITERIA:
- [ ] Assessment feels quick and focused for users
- [ ] All four business phases correctly identified in testing
- [ ] Business type branching functions correctly
```

### 3.2 Assessment Structure

```
REQUIREMENT: ONB-002
PRIORITY: Critical
CATEGORY: Onboarding

Assessment SHALL be structured in sections:

SECTION 1: BUSINESS FUNDAMENTALS (5-8 questions)
- Business type (Service/Product/Hybrid)
- Time in business
- Revenue range
- Team size
- Legal structure

SECTION 2: CURRENT FINANCIAL STATE (8-12 questions)
- Existing bookkeeping practices
- Bank account separation (business/personal)
- Current tools/systems
- Outstanding reconciliation status
- Tax compliance status

SECTION 3: FINANCIAL LITERACY (10-15 questions)
- Understanding of basic accounting concepts
- Comfort with financial statements
- Knowledge of tax obligations
- Familiarity with accounting terminology

SECTION 4: BUSINESS-TYPE SPECIFIC (5-10 questions)
- [Service] Client billing practices, retainers, time tracking
- [Product] Inventory methods, COGS understanding, shipping
- [Hybrid] Revenue split, complexity factors

ACCEPTANCE CRITERIA:
- [ ] Each section validates before proceeding
- [ ] Skip logic reduces questions for clear-path users
- [ ] Results page summarizes findings clearly
```

### 3.3 Phase Determination

```
REQUIREMENT: ONB-003
PRIORITY: High
CATEGORY: Onboarding

The system SHALL categorize users into phases:

STABILIZE PHASE
- Characteristics: Mixed personal/business finances, no formal bookkeeping,
  behind on reconciliation, unclear on tax obligations
- Focus: Separate accounts, catch up on records, establish basic tracking
- Immediate Actions: Bank account setup guidance, transaction categorization

ORGANIZE PHASE
- Characteristics: Basic separation exists, sporadic record-keeping,
  some understanding of obligations, reactive financial management
- Focus: Consistent processes, proper categorization, regular reconciliation
- Immediate Actions: Chart of accounts setup, reconciliation training

BUILD PHASE
- Characteristics: Regular bookkeeping, proper categorization,
  understanding of reports, proactive but not strategic
- Focus: Advanced features, reporting depth, forecasting introduction
- Immediate Actions: Custom reports, class/category optimization

GROW PHASE
- Characteristics: Solid financial foundation, strategic use of data,
  scaling operations, ready for advanced features
- Focus: Multi-entity, advanced analytics, team collaboration
- Immediate Actions: Advanced reporting, integrations, team setup

ACCEPTANCE CRITERIA:
- [ ] Phase assignment algorithm documented and tested
- [ ] Users can request manual phase adjustment (with confirmation)
- [ ] Phase determines initial checklist and feature visibility
```

### 3.4 Communication Tone

```
REQUIREMENT: COMM-001
PRIORITY: High
CATEGORY: User Experience

The system SHALL use a consistent, supportive communication tone throughout:

STEADINESS-STYLE TONE (Default for all communications)
- Patient, step-by-step guidance
- Reassurance and stability emphasis
- Clear expectations and next steps
- Judgment-free, shame-free language
- Warm but professional

TONE EXAMPLES:
- "Take your time with this. Here's exactly what happens next..."
- "Don't worry - your data is safe. Let's try that again."
- "No rush. We'll walk through this together."
- "You're making progress! Here's what we'll tackle next..."

APPLICATION:
- All error messages
- Empty states and onboarding
- Tutorial and help content
- Email communications
- Confirmation dialogs
- Success celebrations

ACCEPTANCE CRITERIA:
- [ ] All system messages use consistent supportive tone
- [ ] Error messages never blame the user
- [ ] Help content provides clear, patient explanations
- [ ] Email communications maintain warm, encouraging style
```

---

## 4. Progressive Feature Disclosure

### 4.1 Feature Revelation System

```
REQUIREMENT: PFD-001
PRIORITY: High
CATEGORY: User Experience

The system SHALL implement progressive feature disclosure where:

1. All features are technically available from day one
2. Interface shows only features relevant to current phase
3. Users can access hidden features through intentional exploration
4. Features unlock naturally as checklist items complete

HIDDEN FEATURE ACCESS METHODS (to be workshopped):

OPTION A: ROADMAP VIEW
- Visual journey map showing all features
- Current location highlighted
- Can "peek ahead" at future features
- Click to access any feature with "early access" confirmation

OPTION B: CALCULATOR METAPHOR
- Interface resembles calculator
- Basic functions visible by default
- Advanced functions revealed by "mode" buttons
- Playful discovery mechanic

OPTION C: BUILDING/ROOMS METAPHOR
- Visualize business as a building
- Rooms unlock as foundation builds
- Can peek through "windows" at locked rooms
- Satisfying unlock animations

ACCEPTANCE CRITERIA:
- [ ] Core accounting features accessible regardless of phase
- [ ] Progressive disclosure doesn't block critical functions
- [ ] User testing validates chosen metaphor effectiveness
- [ ] "Show all features" override available in settings
```

### 4.2 Phase-Based Interface

```
REQUIREMENT: PFD-002
PRIORITY: High
CATEGORY: User Experience

Default visible features by phase:

STABILIZE PHASE
- Dashboard (simplified)
- Bank accounts setup
- Transaction entry (basic)
- Receipt capture
- Basic categorization
- Getting started checklist

ORGANIZE PHASE
- All Stabilize features +
- Chart of accounts (full)
- Bank reconciliation
- Invoice creation (basic)
- Expense tracking
- Basic reports (P&L, Balance Sheet)
- Vendor management

BUILD PHASE
- All Organize features +
- Advanced invoicing (recurring, deposits)
- Bill management
- Class/category tracking
- Custom reports
- Journal entries
- Inventory (basic)

GROW PHASE
- All Build features +
- Multi-currency
- Advanced inventory
- Sales tax automation
- Forecasting
- Team collaboration (full)
- API access
- 3D financial visualization

ACCEPTANCE CRITERIA:
- [ ] Each phase has defined feature set
- [ ] Transitions between phases are smooth
- [ ] Users understand how to access hidden features
```

---

## 5. Core Accounting Features

### 5.1 Chart of Accounts

```
REQUIREMENT: ACCT-001
PRIORITY: Critical
CATEGORY: Accounting

The system SHALL provide:

1. GUIDED SETUP
   - Section-by-section walkthrough
   - Plain English explanation of each account type
   - Industry-specific templates (Service, Product, Hybrid)
   - Common accounts pre-suggested with explanations

2. ACCOUNT TYPES
   - Assets (Current, Fixed, Other)
   - Liabilities (Current, Long-term)
   - Equity
   - Income/Revenue
   - Cost of Goods Sold
   - Expenses
   - Other Income/Expense

3. CUSTOMIZATION
   - Add custom accounts with guidance
   - Account numbering (customizable scheme)
   - Sub-accounts unlimited depth
   - Account descriptions and notes
   - Active/inactive status

PLAIN ENGLISH EXAMPLES:
- "Accounts Receivable" → "Money customers owe you"
- "Accounts Payable" → "Money you owe others"
- "Retained Earnings" → "Profits kept in the business over time"

ACCEPTANCE CRITERIA:
- [ ] Setup wizard is streamlined and user-friendly
- [ ] All account types have plain English descriptions
- [ ] Industry templates cover 80% of common businesses
- [ ] GAAP-compliant account structure enforced
```

### 5.2 Invoicing & Client Management

```
REQUIREMENT: ACCT-002
PRIORITY: Critical
CATEGORY: Accounting

INVOICING FEATURES:
1. Invoice creation with line items
2. Customizable templates (colors, logo, layout)
3. Recurring invoices
4. Deposit/retainer invoices
5. Payment terms (Net 15, 30, 60, custom)
6. Late fee automation (optional)
7. Multiple payment acceptance methods
8. Invoice status tracking (Draft, Sent, Viewed, Paid, Overdue)
9. Batch invoicing
10. Invoice duplication

CLIENT MANAGEMENT:
1. Client profiles with contact info
2. Communication history
3. Payment history and patterns
4. Outstanding balance dashboard
5. Client-specific pricing/terms
6. Notes and attachments
7. Client portal (view/pay invoices)

CUSTOMIZATION:
- Brand colors (hex input or picker)
- Logo upload (auto-resize)
- Custom fields
- Footer messages
- Payment instructions

ACCEPTANCE CRITERIA:
- [ ] Invoice sends via email within 30 seconds
- [ ] PDF generation matches preview exactly
- [ ] Client portal accessible without account creation
- [ ] Payment integration with major processors
```

### 5.3 Bills & Expense Management

```
REQUIREMENT: ACCT-003
PRIORITY: Critical
CATEGORY: Accounting

BILL MANAGEMENT:
1. Bill entry (manual and OCR from image)
2. Recurring bills
3. Payment scheduling
4. Bill approval workflow (multi-user)
5. Vendor credits
6. Partial payments
7. Bill status tracking

EXPENSE TRACKING:
1. Receipt capture (camera/upload)
2. OCR extraction of amount, date, vendor
3. Expense categorization (manual + suggested)
4. Mileage tracking
5. Per diem support
6. Expense reports
7. Reimbursement tracking

VENDOR MANAGEMENT:
1. Vendor profiles
2. 1099 tracking and generation
3. Payment terms by vendor
4. Vendor spending analysis
5. Contact information
6. Notes and documents

ACCEPTANCE CRITERIA:
- [ ] OCR accuracy >90% for clear receipts
- [ ] Bill reminder notifications functional
- [ ] 1099 generation meets IRS requirements
- [ ] Expense categorization suggestions >80% accurate
```

### 5.4 Bank Reconciliation

```
REQUIREMENT: ACCT-004
PRIORITY: Critical
CATEGORY: Accounting

RECONCILIATION FEATURES:
1. Statement upload (PDF/CSV)
2. Manual entry option
3. Transaction matching (auto + manual)
4. Reconciliation wizard
5. Discrepancy identification
6. Historical reconciliation reports
7. Unreconciled transaction flagging

BANK FEED (Phase 2):
1. Direct bank connection (Plaid/similar)
2. Automatic transaction import
3. Rule-based categorization
4. Duplicate detection
5. Multi-account support

EDUCATIONAL ELEMENTS:
- "What is reconciliation?" explainer
- Step-by-step guided first reconciliation
- Common discrepancy causes explained
- Video tutorials embedded

ACCEPTANCE CRITERIA:
- [ ] Manual reconciliation flow completes in <5 minutes (typical month)
- [ ] Auto-matching accuracy >85%
- [ ] Clear explanation when accounts don't balance
- [ ] Reconciliation status visible on dashboard
```

### 5.5 Journal Entries

```
REQUIREMENT: ACCT-005
PRIORITY: High
CATEGORY: Accounting

JOURNAL ENTRY FEATURES:
1. Standard journal entries
2. Adjusting entries
3. Reversing entries (auto-reverse option)
4. Recurring journal entries
5. Entry templates
6. Multi-line entries
7. Memo/description per line
8. Attachment support
9. Entry approval workflow

EDUCATIONAL ELEMENTS:
- Debits and credits explained simply
- "Why would I need this?" context
- Common journal entry examples
- Balance verification before save

SAFEGUARDS:
- Must balance before saving
- Warning for unusual amounts
- Audit trail for all entries
- "Are you sure?" for large adjustments

ACCEPTANCE CRITERIA:
- [ ] Entry must balance (enforced)
- [ ] Common entry templates provided
- [ ] Plain English descriptions available
- [ ] Entries searchable and filterable
```

### 5.6 Income & Product/Service Management

```
REQUIREMENT: ACCT-006
PRIORITY: High
CATEGORY: Accounting

INCOME TRACKING:
1. Multiple income streams
2. Service vs. product income separation
3. Income categorization
4. Payment method tracking
5. Income source analysis
6. Recurring income setup

PRODUCT MANAGEMENT:
1. Product catalog
2. SKU support
3. Pricing tiers
4. Product categories
5. Product images
6. Cost tracking (for COGS)

SERVICE MANAGEMENT:
1. Service catalog
2. Hourly vs. fixed pricing
3. Service packages
4. Time tracking integration
5. Service categories

ACCEPTANCE CRITERIA:
- [ ] Unlimited products/services
- [ ] Income reports by stream/category
- [ ] Product profitability visible
```

### 5.7 Inventory Tracking

```
REQUIREMENT: ACCT-007
PRIORITY: High
CATEGORY: Accounting

INVENTORY FEATURES:
1. Inventory items with quantities
2. Stock tracking
3. Reorder point alerts
4. Inventory valuation methods:
   - FIFO (First In, First Out)
   - LIFO (Last In, First Out)
   - Weighted Average
5. Purchase order creation
6. Inventory adjustments
7. Stock take/physical count
8. Multi-location support (future)

COSTING:
1. Cost per unit tracking
2. COGS automatic calculation
3. Inventory asset valuation
4. Write-offs and adjustments

ACCEPTANCE CRITERIA:
- [ ] Valuation method changeable (with warnings)
- [ ] Inventory value on balance sheet accurate
- [ ] Low stock alerts functional
- [ ] COGS calculates correctly per method
```

### 5.8 Sales Tax Management

```
REQUIREMENT: ACCT-008
PRIORITY: High
CATEGORY: Accounting

SALES TAX FEATURES:
1. Tax rate setup (single and combined)
2. Tax jurisdictions
3. Product/service taxability settings
4. Customer exemptions
5. Tax collected tracking
6. Tax liability reports
7. Filing period reminders
8. Tax payment recording

AUTOMATION:
1. Auto-calculate on invoices
2. Tax rate updates (future: automatic)
3. Nexus tracking (multi-state)
4. Filing report generation

ACCEPTANCE CRITERIA:
- [ ] Tax calculations accurate to jurisdiction
- [ ] Exemption certificates storable
- [ ] Tax liability report matches collected
- [ ] Reminder system for filing deadlines
```

### 5.9 Reporting

```
REQUIREMENT: ACCT-009
PRIORITY: Critical
CATEGORY: Accounting

STANDARD REPORTS:
1. Profit & Loss (Income Statement)
2. Balance Sheet
3. Cash Flow Statement
4. Accounts Receivable Aging
5. Accounts Payable Aging
6. Trial Balance
7. General Ledger
8. Transaction Detail by Account
9. Sales by Customer
10. Expenses by Vendor
11. Sales Tax Liability
12. 1099 Summary

CUSTOMIZATION:
1. Date range selection
2. Comparison periods
3. Filter by class/category/tag
4. Column customization
5. Export formats (PDF, CSV, Excel)
6. Saved report configurations
7. Scheduled report delivery

VISUALIZATION:
1. Charts embedded in reports
2. Trend lines
3. Variance highlighting
4. Drill-down capability

ACCEPTANCE CRITERIA:
- [ ] All standard reports GAAP-compliant
- [ ] Reports generate in <5 seconds
- [ ] Custom reports saveable
- [ ] Export formatting professional-quality
```

### 5.10 Cash vs. Accrual Accounting

```
REQUIREMENT: ACCT-010
PRIORITY: High
CATEGORY: Accounting

The system SHALL support both methods:

CASH BASIS:
- Income recorded when received
- Expenses recorded when paid
- Simpler for small businesses
- Reports reflect cash method

ACCRUAL BASIS:
- Income recorded when earned
- Expenses recorded when incurred
- Required for larger businesses/inventory
- Reports reflect accrual method

SWITCHING:
- User can switch methods (with educational explanation)
- Warning about implications
- Historical reports available in either method
- Conversion assistance provided

ACCEPTANCE CRITERIA:
- [ ] Both methods produce accurate reports
- [ ] Switching includes clear guidance
- [ ] Method clearly indicated on all reports
- [ ] Inventory-based businesses guided to accrual
```

### 5.11 Audit Log

```
REQUIREMENT: ACCT-011
PRIORITY: High
CATEGORY: Accounting/Security

The system SHALL maintain comprehensive audit trails:

LOGGED EVENTS:
1. All transaction creates/edits/deletes
2. User logins and logouts
3. Permission changes
4. Settings changes
5. Report generations
6. Export activities
7. Reconciliation activities
8. Key rotations

LOG DETAILS:
- Timestamp (UTC)
- User ID
- Action type
- Before/after values
- IP address (hashed for privacy)
- Device identifier

RETENTION:
- Minimum 7 years (configurable)
- Encrypted with company key
- Exportable for compliance

ACCEPTANCE CRITERIA:
- [ ] All financial changes logged
- [ ] Audit log cannot be modified
- [ ] Search/filter capabilities
- [ ] Export meets compliance requirements
```

---

## 6. Classification & Tagging

### 6.1 Classes, Categories, and Tags

```
REQUIREMENT: CLASS-001
PRIORITY: High
CATEGORY: Accounting

The system SHALL support multi-dimensional tracking:

CLASSES (Single Assignment)
- Purpose: Track departments, locations, business units
- Assignment: One class per transaction
- Example: "Retail Store", "Online Sales", "Consulting"
- Reports: P&L by Class, Class Comparison

CATEGORIES (Hierarchical)
- Purpose: Sub-categorization within accounts
- Assignment: One category per line item
- Example: Within "Marketing Expense": "Digital Ads", "Print", "Events"
- Reports: Drill-down within account categories

TAGS (Multiple Assignment)
- Purpose: Flexible cross-cutting analysis
- Assignment: Multiple tags per transaction
- Example: "Q4 Campaign", "Client: ABC Corp", "Grant Funded"
- Reports: Tag-based filtering across all reports

APPLICATION TO:
- Invoices (header and line level)
- Bills (header and line level)
- Expenses
- Journal entries
- Transfers

ACCEPTANCE CRITERIA:
- [ ] Classes, categories, tags all independently functional
- [ ] Reporting supports all three dimensions
- [ ] Bulk assignment tools available
- [ ] Import/export includes all classifications
```

---

## 7. Checklist & Task Management

### 7.1 Customized Checklist Generation

```
REQUIREMENT: CHECK-001
PRIORITY: Critical
CATEGORY: User Experience

The system SHALL generate personalized checklists based on assessment:

CHECKLIST CATEGORIES:
1. Foundation Building (one-time setup tasks)
2. Weekly Maintenance
3. Monthly Maintenance
4. Quarterly Tasks
5. Annual Tasks

GENERATION LOGIC:
- Assessment determines starting checklist
- Phase determines complexity level
- Business type customizes specific items
- Financial literacy adjusts explanation depth

EXAMPLE STABILIZE CHECKLIST:
□ Open dedicated business bank account
□ Gather last 3 months of bank statements
□ Set up chart of accounts (guided)
□ Enter opening balances
□ Categorize 50 transactions (to learn)
□ Complete first reconciliation (guided)
□ Set up first invoice template

EXAMPLE WEEKLY MAINTENANCE:
□ Categorize new transactions
□ Send pending invoices
□ Follow up on overdue invoices
□ File receipts
□ Review cash position

ACCEPTANCE CRITERIA:
- [ ] Checklist generates within 30 seconds of assessment
- [ ] All items have clear, actionable descriptions
- [ ] Progress persists across sessions
- [ ] Completion triggers celebration/encouragement
```

### 7.2 Checklist Interface

```
REQUIREMENT: CHECK-002
PRIORITY: High
CATEGORY: User Experience

VISUAL ELEMENTS:
1. Progress bars by category
2. Completion percentages
3. Streak tracking (consecutive weeks completed)
4. Visual graphs of progress over time
5. Milestone celebrations

INTERACTIVITY:
1. Check off items
2. Snooze items (with return date)
3. Add custom items
4. Reorder within categories
5. Mark as "not applicable" (with confirmation)
6. Link items to relevant features

GAMIFICATION (Professional Tone):
1. Completion animations (subtle, satisfying)
2. Progress milestones ("First month complete!")
3. Encouraging messages (warm, supportive tone)
4. Badges for consistency (optional visibility)

ACCEPTANCE CRITERIA:
- [ ] Checklist visually appealing
- [ ] All interactions feel responsive
- [ ] Gamification is encouraging not condescending
- [ ] Users can customize their view
```

---

## 8. Notification System

### 8.1 Weekly Email Summary

```
REQUIREMENT: NOTIF-001
PRIORITY: High
CATEGORY: Notifications

The system SHALL send weekly task emails:

DEFAULT: Monday morning (local time)
CUSTOMIZABLE: Any day, any time

EMAIL CONTENT:
1. Greeting (warm, supportive tone)
2. Quick wins from last week
3. This week's maintenance tasks
4. Foundation building tasks (1-3 items)
5. Overdue items (gentle reminder)
6. One educational tip
7. Encouragement close

SETTINGS:
- Enable/disable
- Frequency (weekly, bi-weekly)
- Day and time selection
- Content preferences (more/less detail)
- Unsubscribe option

ACCEPTANCE CRITERIA:
- [ ] Emails deliver at user's local time
- [ ] Tone is warm, supportive, and encouraging
- [ ] One-click links to tasks in app
- [ ] Unsubscribe honored immediately
```

---

## 9. Multi-Currency Support

### 9.1 Currency Management

```
REQUIREMENT: CURR-001
PRIORITY: High
CATEGORY: Accounting

The system SHALL support multi-currency operations:

FEATURES:
1. Home currency setting
2. Foreign currency transactions
3. Exchange rate management:
   - Manual entry
   - Automatic fetch (daily rates)
   - Historical rates preserved
4. Realized gain/loss tracking
5. Unrealized gain/loss reporting
6. Currency revaluation

TRANSACTION HANDLING:
1. Invoice in customer's currency
2. Bill in vendor's currency
3. Bank accounts in any currency
4. Automatic conversion to home currency
5. Original and converted amounts preserved

REPORTING:
1. Reports in home currency
2. Option to view in original currencies
3. Currency gain/loss report
4. Multi-currency aging reports

ACCEPTANCE CRITERIA:
- [ ] Major world currencies supported (50+)
- [ ] Exchange rates update automatically
- [ ] Gain/loss calculates correctly
- [ ] Historical transactions show historical rates
```

---

## 10. Barter/Trade Accounting

### 10.1 Barter Transaction Support

```
REQUIREMENT: BARTER-001
PRIORITY: Medium
CATEGORY: Accounting

The system SHALL support barter/trade transactions:

FEATURES:
1. Barter transaction type
2. Fair market value assignment
3. Barter income recording
4. Barter expense recording
5. Barter partner tracking
6. Offsetting entry automation

WORKFLOW:
1. Create barter transaction
2. Enter services/goods exchanged
3. Assign fair market value (required)
4. System creates:
   - Income entry (value received)
   - Expense entry (value given)
   - Offsetting entries

EDUCATIONAL ELEMENTS:
- Explanation of barter tax implications
- IRS requirements for barter reporting
- Fair market value guidance
- Links to authoritative resources

ACCEPTANCE CRITERIA:
- [ ] Barter transactions balance automatically
- [ ] Both sides of exchange recorded
- [ ] Barter income appears on reports
- [ ] 1099-B guidance provided where applicable
```

---

## 11. Financial Visualization

### 11.1 3D Financial Flow Visualization

```
REQUIREMENT: VIZ-001
PRIORITY: Medium
CATEGORY: User Experience

The system SHALL provide 3D visualization of finances:

CORE VISUALIZATION:
1. Money flow representation (income → accounts → expenses)
2. Interactive 3D model
3. Time-based animation (watch money flow over period)
4. Drill-down on any element
5. Size represents magnitude
6. Color represents category

VIEWS:
1. Cash Flow View (waterfall style in 3D)
2. Balance Sheet View (stacked/structural)
3. P&L View (flow diagram)
4. Comparison View (period over period)

INTERACTIVITY:
1. Rotate/zoom/pan
2. Click for details
3. Filter by class/category/tag
4. Time slider
5. Export as image/video

ACCESSIBILITY:
1. 2D fallback option
2. Color-blind friendly palettes
3. Screen reader descriptions
4. Static summary available

ACCEPTANCE CRITERIA:
- [ ] Visualization renders in <3 seconds
- [ ] Intuitive controls
- [ ] Data accurately represented
- [ ] Works on desktop and tablet
```

---

## 12. Liability Payment Handling

### 12.1 Interest Prompt System

```
REQUIREMENT: LIAB-001
PRIORITY: Medium
CATEGORY: Accounting/UX

The system SHALL prompt for interest on liability payments:

TRIGGER:
- User enters payment on a liability account
- Interest not already split out
- User clicks "Save"

PROMPT:
"This payment is to a liability account. Does this payment include interest?
- Yes, help me split it out
- Not now (adds to monthly checklist)
- This payment has no interest"

SPLIT WORKFLOW:
1. Enter total payment amount
2. Enter principal portion
3. Interest calculated (or manually entered)
4. Entries created:
   - Debit: Liability (principal)
   - Debit: Interest Expense
   - Credit: Bank Account (total)

CHECKLIST ADDITION:
If "Not now" selected:
- Item added: "Split interest from [Liability Name] payment on [Date]"
- Category: Monthly Maintenance
- Link to original transaction

ACCEPTANCE CRITERIA:
- [ ] Prompt appears reliably on liability payments
- [ ] Split workflow is simple and clear
- [ ] "Not now" adds to checklist
- [ ] User can disable prompt in settings
```

---

## 13. Pricing & Charitable Component

### 13.1 Pricing Structure

```
REQUIREMENT: PRICE-001
PRIORITY: High
CATEGORY: Business

PRICING:
- Monthly: $40/month
- Annual: $400/year (2 months free)

ALLOCATION:
- $35 operational revenue
- $5 charitable donation (user-selected charity)

TRIAL:
- 14-day free trial
- Full feature access during trial
- No credit card required to start
- Reminder before trial ends
```

### 13.2 Charitable Giving

```
REQUIREMENT: CHARITY-001
PRIORITY: High
CATEGORY: Business/Impact

USER EXPERIENCE:
1. During signup, user selects charity from list
2. Can change charity selection monthly
3. Receives annual summary of their contribution
4. Optional: display badge/status as supporter

ADMIN FEATURES:
1. Add/remove charity options
2. View total per charity
3. Payment processing to charities
4. Quarterly/monthly disbursement options
5. Generate tax documentation
6. Export charity reports

PUBLIC TRANSPARENCY:
1. Public page showing:
   - Total donated to date
   - Breakdown by charity
   - Number of supporters
   - Recent milestones
2. Updated monthly minimum
3. No individual user amounts shown

ACCEPTANCE CRITERIA:
- [ ] Charity selection required at signup
- [ ] Admin can manage charity list
- [ ] Public page accurate and current
- [ ] Donations traceable and auditable
```

---

## 14. Future Considerations

### 14.1 CPU/CPG Calculator App Integration

```
REQUIREMENT: FUTURE-001
PRIORITY: Low (Future Phase)
CATEGORY: Roadmap

The architecture SHALL accommodate future integration with:
- Cost Per Unit (CPU) calculator
- Cost Per Good (CPG) analysis tool
- Pricing optimization suggestions
- Inventory costing integration
- Seamless data sharing between apps

Design current system with:
- API-ready architecture
- Shared authentication capability
- Data export formats compatible with future app
- Extension points for product costing
```

### 14.2 Team Collaboration

```
REQUIREMENT: FUTURE-002
PRIORITY: Medium
CATEGORY: Roadmap

PLANNED FEATURES:
1. Multiple user support (with zero-knowledge maintained)
2. Role-based permissions
3. Activity feeds
4. Comments on transactions
5. Task assignment
6. Approval workflows
7. Audit trail by user
```

---

## 15. Additional Feature Ideas

Based on the vision and requirements, here are additional features to consider:

### 15.1 AI-Powered Assistance

```
IDEA: AI-001

FEATURES:
1. Intelligent categorization suggestions that learn from corrections
2. Anomaly detection ("This expense seems unusually high")
3. Cash flow forecasting
4. Natural language queries ("How much did I spend on marketing last quarter?")
5. Automated insights ("Your revenue grew 15% but expenses grew 22%")
6. Tax optimization suggestions
7. Receipt data extraction using AI

WHY: Reduces cognitive load for numbers-adverse users while providing
professional-level insights
```

### 15.2 "What-If" Scenario Planner

```
IDEA: AI-002

FEATURES:
1. Model scenarios: "What if I hire an employee?"
2. Show impact on cash flow, taxes, profitability
3. Compare multiple scenarios side-by-side
4. Save scenarios for future reference
5. Connect to actual data as starting point

WHY: Empowers entrepreneurs to make confident decisions with
financial understanding
```

### 15.3 Mentor/Advisor Portal

```
IDEA: MENTOR-001

FEATURES:
1. Invite accountant/bookkeeper/mentor
2. View-only or collaborative access
3. Commenting and feedback system
4. Secure document sharing
5. Video call integration for reviews

WHY: Many entrepreneurs have advisors; seamless collaboration
builds confidence and accuracy
```

### 15.4 Goal Setting & Tracking

```
IDEA: GOAL-001

FEATURES:
1. Set financial goals (revenue, profit margin, expense reduction)
2. Visual progress tracking
3. Milestone celebrations
4. Automated check-ins
5. Goal achievement history
6. Connect goals to checklist items

WHY: Transforms bookkeeping from obligation to empowerment tool
```

### 15.5 Integration Hub

```
IDEA: INTEG-001

FUTURE INTEGRATIONS:
1. Payment processors (Stripe, Square, PayPal)
2. E-commerce platforms (Shopify, WooCommerce)
3. Time tracking tools
4. Project management systems
5. CRM systems
6. Tax filing services
7. Banking (direct feeds)

APPROACH:
- Open API for third-party integrations
- Official integrations for popular tools
- Zapier/Make.com connectivity
```

### 15.6 Financial Health Score

```
IDEA: HEALTH-001

FEATURES:
1. Overall financial health score (0-100)
2. Component scores:
   - Liquidity
   - Profitability
   - Efficiency
   - Compliance
3. Trend tracking over time
4. Specific recommendations to improve
5. Industry benchmarking (anonymized, aggregated)

WHY: Provides simple, understandable measure of business health
with actionable improvements
```

### 15.7 Emergency Fund & Runway Calculator

```
IDEA: RUNWAY-001

FEATURES:
1. Calculate current runway (months of expenses covered)
2. Emergency fund recommendations
3. Alert when runway drops below threshold
4. Scenario modeling for runway extension
5. Visual runway representation

WHY: Critical for entrepreneur peace of mind and business sustainability
```

### 15.8 Tax Time Preparation Mode

```
IDEA: TAX-001

FEATURES:
1. "Prepare for Tax Season" workflow
2. Checklist of documents needed
3. Missing information identification
4. Generate tax-ready reports
5. Accountant package export
6. Prior year comparison
7. Deduction suggestions (educational, not advice)

WHY: Reduces tax season stress and ensures users are prepared
```

### 15.9 Learning Library

```
IDEA: LEARN-001

FEATURES:
1. Short video tutorials (2-5 minutes)
2. Articles on accounting concepts
3. Glossary of terms (linked throughout app)
4. Interactive tutorials
5. "Learn more" links contextually placed
6. Progress tracking on learning

WHY: Builds long-term financial literacy, core to mission
```

### 15.10 Mobile Receipt Capture App

```
IDEA: MOBILE-001

FEATURES:
1. Quick receipt photo capture
2. OCR processing
3. Basic categorization
4. Mileage tracking with GPS
5. Quick expense entry
6. Offline capability with sync
7. Widget for fast capture

WHY: Capture happens in the moment; desktop later for review
```

### 15.11 Accountability Partner Feature

```
IDEA: ACCOUNT-001

FEATURES:
1. Invite trusted person as accountability partner
2. Share completion status (not financial details)
3. Partner receives notifications of achievements
4. Optional: partner can send encouragement
5. Completely optional feature
6. Privacy controls granular

WHY: External accountability significantly improves follow-through
for many entrepreneurs
```

### 15.12 Seasonal Business Support

```
IDEA: SEASON-001

FEATURES:
1. Mark business as seasonal
2. Adjust cash flow expectations
3. Seasonal comparison reports
4. Pre-season preparation checklists
5. Off-season maintenance guidance
6. Visual calendar of business cycle

WHY: Many small businesses are seasonal; standard tools don't accommodate this
```

---

## 16. Technical Requirements

### 16.1 Performance

```
REQUIREMENT: TECH-001
PRIORITY: High
CATEGORY: Technical

PERFORMANCE TARGETS:
- Page load: <2 seconds
- Transaction save: <500ms
- Report generation: <5 seconds (standard), <30 seconds (complex)
- Search results: <1 second
- Sync completion: <5 seconds (typical changes)
- Encryption/decryption: imperceptible to user

SCALABILITY:
- Support 10,000+ transactions per company
- Support 1,000+ customers/vendors per company
- Support 100,000+ concurrent users (platform)
```

### 16.2 Platform Support

```
REQUIREMENT: TECH-002
PRIORITY: High
CATEGORY: Technical

SUPPORTED PLATFORMS:
1. Web application (primary)
   - Chrome, Firefox, Safari, Edge (latest 2 versions)
2. Desktop apps (Electron or similar)
   - Windows 10+
   - macOS 11+
   - Linux (Ubuntu 20+, Fedora 34+)
3. Mobile apps (future phase)
   - iOS 14+
   - Android 10+

OFFLINE CAPABILITY:
- Full functionality offline
- Sync when connectivity restored
- Clear offline indicator
```

### 16.3 Accessibility

```
REQUIREMENT: TECH-003
PRIORITY: High
CATEGORY: Technical

ACCESSIBILITY STANDARDS:
- WCAG 2.1 AA compliance minimum
- Screen reader support
- Keyboard navigation complete
- High contrast mode
- Font size adjustment
- Reduced motion option
- Color-blind friendly defaults

ACCEPTANCE CRITERIA:
- [ ] Automated accessibility testing passes
- [ ] Manual testing with screen readers
- [ ] Keyboard-only navigation complete
- [ ] Color contrast ratios meet standards
```

### 16.4 Technology Stack Decision Framework

```
REQUIREMENT: TECH-004
PRIORITY: Critical
CATEGORY: Technical Architecture

The system SHALL be built on a technology stack that supports zero-knowledge
architecture, offline-first functionality, and long-term maintainability while
enabling rapid development and deployment.
```

#### 16.4.1 Frontend Stack (DECIDED)

```
STACK DECISIONS - IMPLEMENTED:

The following frontend technologies have been selected and are documented in package.json:

CORE FRAMEWORK:
- React 18.3+ - Component-based UI framework
  * Rationale: Mature ecosystem, excellent TypeScript support, strong community
  * Supports: Virtual DOM for performance, hooks for state management
  * Trade-offs: Bundle size larger than alternatives, but offset by code splitting

LANGUAGE:
- TypeScript 5.3+ - Typed JavaScript superset
  * Rationale: Type safety critical for encryption/key management code
  * Supports: Early error detection, better IDE support, self-documenting code
  * Trade-offs: Compilation step, learning curve

BUILD TOOL:
- Vite 5.1+ - Fast build tool and dev server
  * Rationale: Near-instant HMR, optimized production builds, native ESM
  * Supports: Fast development iteration, excellent TypeScript integration
  * Trade-offs: Newer than Webpack, but well-supported ecosystem

CLIENT DATABASE:
- Dexie.js 4.0+ - IndexedDB wrapper
  * Rationale: Promise-based API, CRUD operations, full-text search, encryption hooks
  * Supports: Offline-first architecture, large dataset storage
  * Trade-offs: IndexedDB browser limits (~50% available storage), but acceptable

ENCRYPTION:
- argon2-browser - Client-side Argon2id implementation
  * Rationale: Memory-hard password hashing, WASM performance, no server dependency
  * Supports: Key derivation from passphrase, brute-force resistance
  * Trade-offs: Initial WASM load time (~200ms), acceptable for security benefit

- Web Crypto API - Browser-native AES-256-GCM
  * Rationale: Native performance, no dependencies, standardized
  * Supports: Field-level encryption, authenticated encryption (AEAD)
  * Trade-offs: Browser compatibility (requires HTTPS in production)

TESTING:
- Vitest - Unit testing framework
  * Rationale: Vite-native, fast execution, Jest-compatible API
  * Supports: Component testing, coverage reports, snapshot testing

- @testing-library/react - Component testing utilities
  * Rationale: User-centric testing, accessibility-focused
  * Supports: Integration testing, behavior-driven tests

- Playwright - End-to-end testing
  * Rationale: Multi-browser support, reliable selectors, video recording
  * Supports: Critical user journey testing, visual regression testing

ACCEPTANCE CRITERIA:
- [x] Frontend stack documented in package.json
- [x] TypeScript strict mode enabled
- [x] Vite configuration optimized for production
- [x] Dexie.js schema designed (see Section 2.2)
- [x] Encryption libraries integrated
- [ ] Test coverage >80% for business logic
- [ ] Test coverage 100% for cryptographic code
```

#### 16.4.2 Backend / Sync Service Stack [DECISION POINT]

```
DECISION REQUIRED: Backend runtime and framework selection

CONTEXT:
The sync relay service needs to:
1. Store encrypted payloads (server cannot decrypt)
2. Route sync messages between devices
3. Handle authentication (hash verification only)
4. Scale to 100,000+ concurrent users
5. Minimize operational costs

EVALUATION CRITERIA:
- Performance: Throughput, latency, resource efficiency
- Deployment Simplicity: Container support, managed service availability
- Team Velocity: Learning curve, hiring pool, debugging tools
- Cost: Infrastructure costs at scale
- Long-term Viability: Community support, security updates

OPTION A: Node.js + Fastify [RECOMMENDED]
Strengths:
+ Same language as frontend (JavaScript/TypeScript)
+ Mature ecosystem for auth, WebSocket, database clients
+ Excellent async I/O performance
+ Low learning curve for frontend developers
+ Strong managed service support (AWS Lambda, Vercel, Fly.io)

Trade-offs:
- Higher memory usage than Go/Rust
- Single-threaded (mitigated by clustering)
- GC pauses (typically <10ms, acceptable for use case)

Estimated Performance:
- 10,000 req/s per instance (with WebSocket keep-alive)
- ~100MB RAM per instance baseline
- Cold start: ~200ms (serverless)

OPTION B: Go + Fiber
Strengths:
+ Lower memory footprint (~30MB baseline)
+ Native concurrency (goroutines)
+ Fast compilation, single binary deployment
+ No garbage collection pauses in critical path

Trade-offs:
- Different language from frontend (team split)
- Less mature crypto ecosystem (WASM integration more complex)
- Smaller managed service support

Estimated Performance:
- 20,000 req/s per instance
- ~30MB RAM per instance baseline
- Cold start: ~50ms (serverless)

OPTION C: Deno + Fresh
Strengths:
+ TypeScript-native (same as frontend)
+ Modern security model (permissions-based)
+ Built-in WebSocket, HTTP/2
+ Single executable deployment

Trade-offs:
- Newest ecosystem (fewer libraries, less community support)
- Less proven at scale (fewer case studies)
- Managed service support still emerging

Estimated Performance:
- 8,000 req/s per instance
- ~50MB RAM per instance baseline
- Cold start: ~100ms (serverless)

DECISION MATRIX:

┌─────────────────────┬──────────┬──────┬───────┐
│ Criterion           │ Node.js  │  Go  │ Deno  │
├─────────────────────┼──────────┼──────┼───────┤
│ Performance         │    B+    │  A   │   B   │
│ Deployment Ease     │    A     │  B+  │   B   │
│ Team Velocity       │    A     │  B   │   A-  │
│ Operational Cost    │    B     │  A   │   B+  │
│ Ecosystem Maturity  │    A     │  B+  │   C+  │
│ Learning Curve      │    A     │  B   │   A   │
└─────────────────────┴──────────┴──────┴───────┘

RECOMMENDATION: Node.js + Fastify
Rationale: Team velocity and deployment ecosystem outweigh raw performance
advantages of Go. The sync relay is I/O-bound (database, network), not CPU-bound,
so Node.js async I/O is well-suited. Shared language reduces cognitive load.

[TBD: Final backend stack selection]
- Decision Required By: Tech Lead + DevOps Lead
- Deadline: Before backend development begins
- Testing Requirement: Load test prototype with realistic dataset (10K users, 100K transactions)
```

#### 16.4.3 Encryption Libraries (DECIDED)

```
CRYPTOGRAPHIC STACK - IMPLEMENTED:

The following encryption approach has been selected:

KEY DERIVATION:
- Argon2id (via argon2-browser)
  * Parameters: m=65536 (64MB), t=3 iterations, p=4 parallelism
  * Output: 256-bit master key
  * Rationale: OWASP-recommended, memory-hard, GPU-resistant

- HKDF-SHA256 (via Web Crypto API)
  * Derives Company Key from Master Key
  * Derives Encryption Key (K_enc) and Auth Key (K_auth) from Master Key
  * Rationale: Standardized key derivation (RFC 5869)

SYMMETRIC ENCRYPTION:
- AES-256-GCM (via Web Crypto API)
  * Field-level encryption for sensitive data
  * Authenticated encryption (integrity + confidentiality)
  * 96-bit random IV per encryption operation
  * Rationale: NIST-approved, hardware acceleration, authenticated

HASHING:
- BLAKE3 (via @noble/hashes)
  * For authentication token generation (hash of K_auth)
  * For integrity verification
  * Rationale: Faster than SHA-256, cryptographically secure

RANDOM NUMBER GENERATION:
- Web Crypto API crypto.getRandomValues()
  * For IV generation, salt generation
  * Rationale: Cryptographically secure PRNG (CSPRNG)

RECOVERY KEY (OPTIONAL):
- BIP39 (24-word mnemonic)
  * Encodes master key as human-readable words
  * Standardized word list (2048 words)
  * Rationale: User-friendly backup, proven in cryptocurrency space

ACCEPTANCE CRITERIA:
- [x] Argon2id parameters set to OWASP recommendations
- [x] All encryption uses CSPRNG for IVs/salts
- [x] AES-GCM used for all symmetric encryption
- [x] BLAKE3 used for non-password hashing
- [ ] Security audit of cryptographic implementation (before beta)
- [ ] Penetration test of authentication system (before beta)
```

#### 16.4.4 CRDT Library Selection [DECISION POINT]

```
DECISION REQUIRED: Conflict-free Replicated Data Type library for sync

CONTEXT:
The offline-first sync system requires a CRDT implementation to handle:
1. Concurrent edits from multiple devices
2. Offline operation with eventual consistency
3. Automatic conflict resolution (no user intervention)
4. Integration with encrypted data (CRDT operations on ciphertext metadata)

EVALUATION CRITERIA:
- Correctness: Proven conflict resolution, no data loss
- Performance: Overhead on operation, storage size
- Integration: Compatibility with IndexedDB, encryption
- Flexibility: Support for accounting data structures (ledger, immutability)
- Maturity: Production usage, active development

OPTION A: Automerge 2.0+ [RECOMMENDED]
Strengths:
+ JSON-like API (easy to integrate with existing data structures)
+ Immutable history (excellent for audit trail requirement)
+ Mature (used in production by Ink & Switch, others)
+ TypeScript support
+ Compression (reduces sync payload size)

Trade-offs:
- Larger bundle size (~200KB gzipped)
- Learning curve for advanced features
- Performance overhead on large documents (>10K operations)

Estimated Performance:
- 1,000 operations/sec (apply changes)
- ~2x storage overhead for CRDT metadata
- Sync payload: ~50KB for 100 transaction changes (compressed)

OPTION B: Yjs
Strengths:
+ Excellent performance (benchmarked faster than Automerge)
+ Smaller bundle size (~50KB gzipped)
+ Rich text support (if needed for notes/memos)
+ WebRTC peer-to-peer option (could reduce server load)

Trade-offs:
- Less intuitive API for structured data
- Mutation-based (requires careful integration with immutable patterns)
- History truncation (may conflict with audit trail requirement)

Estimated Performance:
- 5,000 operations/sec (apply changes)
- ~1.5x storage overhead for CRDT metadata
- Sync payload: ~30KB for 100 transaction changes

OPTION C: Custom Implementation (Operational Transformation)
Strengths:
+ Tailored exactly to accounting semantics
+ Minimal overhead (no library bloat)
+ Full control over conflict resolution rules

Trade-offs:
- High development cost (3-6 months to build and test)
- Risk of subtle bugs (CRDT correctness is difficult)
- Ongoing maintenance burden
- No community support

DECISION MATRIX:

┌──────────────────────┬────────────┬──────┬────────┐
│ Criterion            │ Automerge  │ Yjs  │ Custom │
├──────────────────────┼────────────┼──────┼────────┤
│ Correctness          │     A      │  A-  │   ?    │
│ Performance          │     B+     │  A   │   A    │
│ Integration Ease     │     A      │  B+  │   B    │
│ Audit Trail Support  │     A      │  C   │   A    │
│ Development Cost     │     A      │  A   │   D    │
│ Long-term Risk       │     B+     │  B+  │   C    │
└──────────────────────┴────────────┴──────┴────────┘

RECOMMENDATION: Automerge 2.0+
Rationale: Immutable history aligns perfectly with audit trail requirement.
Proven correctness reduces risk. JSON-like API minimizes integration complexity.
Performance is acceptable for accounting workload (not collaborative text editing).

TESTING REQUIREMENT BEFORE FINAL DECISION:
- [ ] Build prototype sync system with Automerge
- [ ] Test with realistic dataset (100 transactions, 5 devices, 10 concurrent edits)
- [ ] Measure sync payload size, conflict resolution correctness
- [ ] Validate integration with encryption (encrypt CRDT patches)
- [ ] Performance benchmark: <5 second sync for typical changes

[TBD: Final CRDT library selection]
- Decision Required By: Architect (after prototype testing)
- Deadline: Before sync implementation begins
- Fallback: If Automerge performance unacceptable, evaluate Yjs with custom history layer
```

#### 16.4.5 Testing Frameworks (DECIDED)

```
TESTING STACK - IMPLEMENTED:

The following testing approach has been selected:

UNIT TESTING:
- Vitest - Fast unit test runner
  * Vite-native (same config as build tool)
  * Jest-compatible API (easy migration, familiar syntax)
  * Coverage reporting via c8
  * Watch mode for rapid iteration

COMPONENT TESTING:
- @testing-library/react - React component testing
  * User-centric queries (byRole, byLabelText)
  * Accessibility-focused (encourages ARIA attributes)
  * Avoids implementation details (tests behavior, not internals)

- @testing-library/jest-dom - Custom matchers
  * Readable assertions (toBeVisible, toHaveTextContent)

INTEGRATION TESTING:
- Vitest with Dexie.js in-memory mode
  * Test database operations without real IndexedDB
  * Test encryption/decryption workflows
  * Test sync conflict resolution

END-TO-END TESTING:
- Playwright - Browser automation
  * Multi-browser support (Chromium, Firefox, WebKit)
  * Reliable selectors (auto-wait, retry logic)
  * Screenshot/video capture for debugging
  * Network mocking for offline testing
  * Parallel test execution

VISUAL REGRESSION TESTING:
- Playwright screenshot comparison
  * Capture screenshots of key screens
  * Detect unintended UI changes
  * Integration with CI/CD pipeline

COVERAGE TARGETS:
- Business Logic: >80% line coverage
- Cryptographic Code: 100% line coverage (REQUIRED)
- Database Operations: >90% line coverage
- UI Components: >70% line coverage
- Overall: >85% line coverage

ACCEPTANCE CRITERIA:
- [x] Testing frameworks documented in package.json
- [x] Test structure matches src/ directory structure
- [ ] All cryptographic functions have 100% coverage
- [ ] All database operations have integration tests
- [ ] Critical user journeys have E2E tests
- [ ] CI/CD runs full test suite on every PR
- [ ] Test execution time <5 minutes (unit + integration)
- [ ] E2E test execution time <15 minutes
```

#### 16.4.6 API Design [DECISION POINT]

```
DECISION REQUIRED: API protocol for client-server communication

CONTEXT:
The sync relay needs an API protocol that supports:
1. Encrypted payload upload/download (opaque to server)
2. Real-time notifications (when other device syncs)
3. Authentication (token-based, stateless)
4. Efficient bandwidth usage (mobile users, offline sync)
5. Simple client implementation

EVALUATION CRITERIA:
- Real-time Support: Low-latency notifications
- Bandwidth Efficiency: Payload size, compression
- Simplicity: Client library maturity, debugging tools
- Scalability: Connection overhead, server resource usage
- Compatibility: Browser support, firewall/proxy friendliness

OPTION A: REST + WebSocket [RECOMMENDED]
Architecture:
- REST API (HTTPS) for CRUD operations
  * POST /v1/auth/login
  * POST /v1/sync/push (upload encrypted changes)
  * GET /v1/sync/pull (download changes since last sync)
  * POST /v1/sync/acknowledge (mark changes as received)

- WebSocket for real-time notifications
  * WS /v1/sync/live (bidirectional, notify on changes)
  * Fallback to polling if WebSocket unavailable

Strengths:
+ Simple mental model (REST for data, WebSocket for notifications)
+ Excellent browser support (native Fetch API, WebSocket API)
+ Easy debugging (curl for REST, browser DevTools for WebSocket)
+ Mature ecosystem (nginx, load balancers, CDNs all support WebSocket)
+ Bandwidth efficient (WebSocket keeps connection alive, no HTTP overhead per message)

Trade-offs:
- Two protocols to implement (REST + WebSocket)
- WebSocket connection management (reconnection logic)
- Stateful WebSocket connections (load balancer considerations)

Estimated Bandwidth (per sync):
- Initial sync: ~50KB (100 transactions, gzipped)
- Incremental sync: ~5KB (10 transaction changes)
- WebSocket notification: ~200 bytes
- Overhead: ~1KB per REST request (HTTP headers)

OPTION B: GraphQL Subscriptions
Architecture:
- GraphQL API for queries and mutations
  * mutation pushSync(encryptedPayload)
  * query pullSync(since: timestamp)

- GraphQL subscriptions for real-time (over WebSocket)
  * subscription onSyncAvailable

Strengths:
+ Single protocol, consistent API
+ Strongly typed schema (self-documenting)
+ Flexible queries (client specifies exactly what data it needs)
+ Built-in batching, caching

Trade-offs:
- Overkill for simple encrypted blob storage (no complex queries needed)
- Larger client bundle (~40KB for Apollo Client)
- Steeper learning curve
- More complex server implementation

Estimated Bandwidth (per sync):
- Initial sync: ~55KB (GraphQL query overhead + payload)
- Incremental sync: ~6KB
- Subscription notification: ~300 bytes
- Overhead: ~2KB per request (GraphQL query parsing)

OPTION C: gRPC + Server Streaming
Architecture:
- gRPC for bidirectional streaming
  * rpc PushSync(EncryptedPayload) returns (Ack)
  * rpc SyncStream(stream EncryptedPayload) returns (stream EncryptedPayload)

Strengths:
+ Excellent performance (binary protocol, HTTP/2)
+ Built-in streaming (server push)
+ Strong typing (protobuf schema)
+ Efficient bandwidth (binary serialization)

Trade-offs:
- Limited browser support (requires grpc-web proxy)
- More complex deployment (need proxy layer)
- Harder debugging (binary protocol, specialized tools)
- Less familiar to web developers

Estimated Bandwidth (per sync):
- Initial sync: ~45KB (protobuf + gzip)
- Incremental sync: ~4KB
- Stream message: ~150 bytes
- Overhead: ~500 bytes per request (HTTP/2 headers)

DECISION MATRIX:

┌──────────────────────┬──────────────┬──────────┬────────┐
│ Criterion            │ REST + WS    │ GraphQL  │ gRPC   │
├──────────────────────┼──────────────┼──────────┼────────┤
│ Real-time Support    │      A       │    A     │   A    │
│ Bandwidth Efficiency │      A-      │    B+    │   A+   │
│ Simplicity           │      A       │    B     │   C    │
│ Browser Support      │      A+      │    A     │   B    │
│ Debugging Tools      │      A+      │    A-    │   C+   │
│ Scalability          │      A       │    B+    │   A    │
│ Team Familiarity     │      A+      │    B     │   C    │
└──────────────────────┴──────────────┴──────────┴────────┘

RECOMMENDATION: REST + WebSocket
Rationale: Simplicity and debugging ease outweigh bandwidth efficiency gains.
The sync payloads are already compressed and encrypted (not human-readable),
so GraphQL's flexible querying provides no benefit. gRPC's performance advantage
is minimal for this use case (not streaming video, just occasional sync).

API DESIGN PRINCIPLES:
1. Stateless REST endpoints (except WebSocket for notifications)
2. Token-based authentication (JWT in Authorization header)
3. Versioned API URLs (/v1/, /v2/ - allow breaking changes)
4. Standard HTTP status codes (200, 401, 429, 500)
5. Rate limiting (per-user, per-endpoint)
6. CORS support (for web clients)
7. Compression (gzip response encoding)

[TBD: Final API protocol selection]
- Decision Required By: Tech Lead
- Deadline: Before backend development begins
- Recommendation Strength: STRONG (REST + WebSocket is the pragmatic choice)
```

#### 16.4.7 API Specification (REST + WebSocket)

```
REQUIREMENT: TECH-005
PRIORITY: Critical
CATEGORY: Technical Architecture

Assuming REST + WebSocket is selected (per recommendation above), the API
SHALL implement the following endpoints and behaviors.
```

**16.4.7.1 Authentication Endpoints**

```
ENDPOINT: POST /v1/auth/register
PURPOSE: Create new user account (zero-knowledge)

REQUEST:
{
  "email": "user@example.com",
  "authToken": "blake3_hash_of_K_auth_base64",
  "encryptedMasterKey": "optional_encrypted_copy_for_recovery",
  "deviceName": "User's Laptop",
  "deviceId": "uuid_v4"
}

RESPONSE (200 OK):
{
  "userId": "uuid_v4",
  "accessToken": "jwt_token",
  "refreshToken": "jwt_refresh_token",
  "expiresIn": 86400
}

ERROR RESPONSES:
- 400 Bad Request: Missing required fields, invalid email format
- 409 Conflict: Email already registered
- 429 Too Many Requests: Rate limit exceeded (5 registrations per IP per hour)
- 500 Internal Server Error: Server error

NOTES:
- Server never receives passphrase or K_enc
- authToken is BLAKE3(K_auth), used for subsequent authentication
- encryptedMasterKey is optional (for recovery feature, encrypted with recovery key)
```

```
ENDPOINT: POST /v1/auth/login
PURPOSE: Authenticate existing user

REQUEST:
{
  "email": "user@example.com",
  "authToken": "blake3_hash_of_K_auth_base64",
  "deviceName": "User's Laptop",
  "deviceId": "uuid_v4"
}

RESPONSE (200 OK):
{
  "userId": "uuid_v4",
  "accessToken": "jwt_token",
  "refreshToken": "jwt_refresh_token",
  "expiresIn": 86400,
  "devices": [
    {"deviceId": "uuid1", "deviceName": "Laptop", "lastSeen": "2024-01-15T10:30:00Z"},
    {"deviceId": "uuid2", "deviceName": "Desktop", "lastSeen": "2024-01-14T18:00:00Z"}
  ]
}

ERROR RESPONSES:
- 400 Bad Request: Missing required fields
- 401 Unauthorized: Invalid credentials (incorrect authToken)
- 403 Forbidden: Account locked (too many failed attempts)
- 429 Too Many Requests: Rate limit exceeded (10 login attempts per email per hour)
- 500 Internal Server Error: Server error

NOTES:
- After 5 failed attempts, account locked for 15 minutes
- Returns list of registered devices for user awareness
```

```
ENDPOINT: POST /v1/auth/refresh
PURPOSE: Refresh expired access token

REQUEST:
{
  "refreshToken": "jwt_refresh_token"
}

RESPONSE (200 OK):
{
  "accessToken": "new_jwt_token",
  "expiresIn": 86400
}

ERROR RESPONSES:
- 400 Bad Request: Missing refresh token
- 401 Unauthorized: Invalid or expired refresh token
- 500 Internal Server Error: Server error

NOTES:
- Access tokens expire in 24 hours
- Refresh tokens expire in 30 days
- Refresh token rotation (new refresh token issued on each refresh)
```

```
ENDPOINT: DELETE /v1/auth/device/{deviceId}
PURPOSE: Revoke device access

REQUEST:
Authorization: Bearer {accessToken}

RESPONSE (204 No Content):
(empty body)

ERROR RESPONSES:
- 401 Unauthorized: Invalid or expired token
- 404 Not Found: Device not found or doesn't belong to user
- 500 Internal Server Error: Server error

NOTES:
- If revoking current device, user is logged out immediately
- All sync data for device remains on server (can re-authenticate)
```

**16.4.7.2 Sync Endpoints**

```
ENDPOINT: POST /v1/sync/push
PURPOSE: Upload encrypted changes from client

REQUEST:
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "companyId": "uuid_v4",
  "deviceId": "uuid_v4",
  "changes": [
    {
      "changeId": "uuid_v4",
      "timestamp": "2024-01-15T10:30:00Z",
      "encryptedPayload": "base64_encoded_encrypted_crdt_patch",
      "payloadHash": "blake3_hash_for_integrity"
    }
  ]
}

RESPONSE (200 OK):
{
  "acknowledged": ["changeId1", "changeId2"],
  "conflicts": [],
  "serverTimestamp": "2024-01-15T10:30:01Z"
}

ERROR RESPONSES:
- 400 Bad Request: Invalid payload format, missing required fields
- 401 Unauthorized: Invalid or expired token
- 413 Payload Too Large: Payload exceeds 10MB limit
- 429 Too Many Requests: Rate limit exceeded (100 pushes per user per minute)
- 500 Internal Server Error: Server error

NOTES:
- Server stores encrypted payload without decrypting
- payloadHash verified for transmission integrity (not cryptographic security)
- Changes are opaque to server (CRDT patches)
```

```
ENDPOINT: GET /v1/sync/pull?companyId={uuid}&since={timestamp}
PURPOSE: Download changes from other devices

REQUEST:
Authorization: Bearer {accessToken}
Query Parameters:
  - companyId: UUID of company
  - since: ISO 8601 timestamp (optional, defaults to beginning of time)

RESPONSE (200 OK):
{
  "changes": [
    {
      "changeId": "uuid_v4",
      "timestamp": "2024-01-15T09:00:00Z",
      "sourceDeviceId": "uuid_v4",
      "encryptedPayload": "base64_encoded_encrypted_crdt_patch",
      "payloadHash": "blake3_hash_for_integrity"
    }
  ],
  "serverTimestamp": "2024-01-15T10:30:01Z",
  "hasMore": false
}

ERROR RESPONSES:
- 400 Bad Request: Invalid companyId or timestamp format
- 401 Unauthorized: Invalid or expired token
- 403 Forbidden: User not authorized for this company
- 429 Too Many Requests: Rate limit exceeded (200 pulls per user per minute)
- 500 Internal Server Error: Server error

NOTES:
- Returns changes from all devices except requesting device
- Pagination via hasMore flag and cursor (not shown for simplicity)
- Client decrypts payloads locally
```

```
ENDPOINT: POST /v1/sync/acknowledge
PURPOSE: Mark changes as received (allows server to clean up)

REQUEST:
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "companyId": "uuid_v4",
  "deviceId": "uuid_v4",
  "changeIds": ["uuid1", "uuid2", "uuid3"]
}

RESPONSE (204 No Content):
(empty body)

ERROR RESPONSES:
- 400 Bad Request: Invalid payload format
- 401 Unauthorized: Invalid or expired token
- 500 Internal Server Error: Server error

NOTES:
- Server can delete acknowledged changes after retention period (90 days)
- Acknowledgment is per-device (other devices may still need the change)
```

**16.4.7.3 WebSocket Real-Time Sync**

```
ENDPOINT: WS /v1/sync/live
PURPOSE: Real-time notification of new changes

CONNECTION:
Authorization: Bearer {accessToken}

MESSAGES (Server → Client):
{
  "type": "sync_available",
  "companyId": "uuid_v4",
  "changeCount": 5,
  "latestTimestamp": "2024-01-15T10:30:00Z"
}

MESSAGES (Client → Server):
{
  "type": "ping"
}

RESPONSE (Server → Client):
{
  "type": "pong",
  "serverTimestamp": "2024-01-15T10:30:01Z"
}

ERROR MESSAGES:
{
  "type": "error",
  "code": "unauthorized",
  "message": "Token expired, please reconnect"
}

NOTES:
- WebSocket connection authenticated via JWT in initial handshake
- Server sends sync_available notification when changes pushed by other devices
- Client should then call GET /v1/sync/pull to retrieve changes
- Heartbeat ping/pong every 30 seconds to keep connection alive
- Automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Fallback to polling if WebSocket unavailable (poll every 30 seconds)
```

**16.4.7.4 Rate Limiting**

```
RATE LIMITS (per user, per endpoint):

┌───────────────────────┬─────────────┬──────────────┐
│ Endpoint              │ Limit       │ Window       │
├───────────────────────┼─────────────┼──────────────┤
│ POST /v1/auth/register│ 5 requests  │ per hour     │
│ POST /v1/auth/login   │ 10 requests │ per hour     │
│ POST /v1/auth/refresh │ 100 requests│ per hour     │
│ POST /v1/sync/push    │ 100 requests│ per minute   │
│ GET /v1/sync/pull     │ 200 requests│ per minute   │
│ POST /v1/sync/ack     │ 100 requests│ per minute   │
│ WS /v1/sync/live      │ 10 conn/s   │ per minute   │
└───────────────────────┴─────────────┴──────────────┘

RATE LIMIT RESPONSE (429 Too Many Requests):
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 60,
  "limit": 100,
  "remaining": 0,
  "resetAt": "2024-01-15T10:31:00Z"
}

HEADERS:
- X-RateLimit-Limit: 100
- X-RateLimit-Remaining: 42
- X-RateLimit-Reset: 1642243860 (Unix timestamp)
- Retry-After: 60 (seconds)

[TBD: Final rate limit values]
- Decision Required By: DevOps Lead + Product Manager
- Testing Requirement: Load test to determine realistic limits
```

**16.4.7.5 Error Response Format**

```
STANDARD ERROR RESPONSE:

{
  "error": "error_code_snake_case",
  "message": "Human-readable error message",
  "details": {
    "field": "email",
    "reason": "Invalid email format"
  },
  "requestId": "uuid_v4_for_support_debugging"
}

COMMON ERROR CODES:
- invalid_request: Malformed request (400)
- unauthorized: Invalid or missing authentication (401)
- forbidden: Valid auth but insufficient permissions (403)
- not_found: Resource doesn't exist (404)
- conflict: Resource already exists (409)
- payload_too_large: Request exceeds size limit (413)
- rate_limit_exceeded: Too many requests (429)
- internal_error: Server error (500)
- service_unavailable: Temporary outage (503)

VALIDATION ERROR RESPONSE:
{
  "error": "validation_error",
  "message": "Request validation failed",
  "validationErrors": [
    {"field": "email", "message": "Invalid email format"},
    {"field": "authToken", "message": "Must be base64 encoded"}
  ],
  "requestId": "uuid_v4"
}
```

**16.4.7.6 API Versioning**

```
VERSIONING STRATEGY:
- URL-based versioning: /v1/, /v2/, etc.
- Breaking changes require new version
- Non-breaking changes (new fields, new endpoints) added to existing version

VERSION LIFECYCLE:
1. New version released: /v2/ introduced
2. Deprecation notice: /v1/ marked deprecated (6-month notice minimum)
3. Support period: Both versions supported concurrently
4. Sunset: /v1/ returns 410 Gone with migration instructions

DEPRECATION HEADERS:
- Deprecation: true
- Sunset: 2024-07-15T00:00:00Z (RFC 7234)
- Link: </docs/migration/v1-to-v2>; rel="deprecation"

RESPONSE (410 Gone - after sunset):
{
  "error": "version_sunset",
  "message": "API version v1 is no longer supported. Please upgrade to v2.",
  "migrationGuide": "https://docs.example.com/migration/v1-to-v2",
  "sunsetDate": "2024-07-15T00:00:00Z"
}

[TBD: API versioning policy details]
- Decision Required By: Tech Lead + Product Manager
- Minimum support period: 6 months (recommended), 3 months (minimum)
```

**16.4.7.7 CORS Configuration**

```
CORS HEADERS:
- Access-Control-Allow-Origin: https://app.gracefulbooks.com (production)
- Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
- Access-Control-Allow-Headers: Authorization, Content-Type
- Access-Control-Max-Age: 86400 (24 hours)
- Access-Control-Allow-Credentials: true (for cookies if used)

PREFLIGHT REQUEST (OPTIONS):
Request:
  Origin: https://app.gracefulbooks.com
  Access-Control-Request-Method: POST
  Access-Control-Request-Headers: Authorization, Content-Type

Response:
  Access-Control-Allow-Origin: https://app.gracefulbooks.com
  Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
  Access-Control-Allow-Headers: Authorization, Content-Type
  Access-Control-Max-Age: 86400
```

**ACCEPTANCE CRITERIA:**
- [ ] All endpoints documented with request/response examples
- [ ] Rate limiting implemented per specification
- [ ] Error responses follow standard format
- [ ] API versioning strategy implemented
- [ ] CORS configured for web client access
- [ ] WebSocket reconnection logic tested
- [ ] All endpoints have integration tests
- [ ] API documentation published (OpenAPI 3.0 spec)
- [ ] Monitoring and alerting for rate limit violations
- [ ] Request ID tracking for debugging

---

## 17. Success Metrics

### 17.1 User Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Assessment completion rate | >80% | Completed assessments / Started assessments |
| 30-day retention | >60% | Users active day 30 / Users signed up |
| Checklist engagement | >50% weekly | Users completing 1+ item / Active users |
| Phase progression | >30% within 90 days | Users advancing phase / Users in lower phases |
| Reconciliation rate | >70% monthly | Users reconciling / Active users |
| Support sentiment | >4.5/5 | Average support interaction rating |

### 17.2 Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Monthly recurring revenue | Growth >10% MoM (early stage) | Total subscription revenue |
| Churn rate | <5% monthly | Cancellations / Active subscriptions |
| Charitable impact | Tracked monthly | Total donations by charity |
| NPS score | >50 | Quarterly NPS survey |

---

## Appendix A: Glossary

| Term | Plain English | Technical Definition |
|------|--------------|----------------------|
| CRDT | A way for multiple people to edit the same thing without conflicts | Conflict-free Replicated Data Type - a data structure that automatically merges changes from multiple sources without conflicts |
| Argon2id | The secure algorithm that protects your passphrase | Argon2id is a password hashing algorithm that transforms your passphrase into encryption keys while defending against brute-force attacks |
| KDF | The process that turns your passphrase into encryption keys | Key Derivation Function - a cryptographic algorithm that generates multiple secure keys from a single passphrase using HKDF (HMAC-based Key Derivation Function) |
| GAAP | The rules for how business finances should be tracked | Generally Accepted Accounting Principles |
| Zero-knowledge | We can't see your data even if we wanted to | Encryption where service provider has no decryption capability |
| COA | Your list of categories for tracking money | Chart of Accounts |
| Reconciliation | Making sure your records match your bank | Bank Reconciliation |
| Accrual | Recording money when you earn it, not when you get it | Accrual basis accounting |
| Cash basis | Recording money when it hits your account | Cash basis accounting |

---

## Appendix B: User Stories

### Stabilize Phase User: Sarah

> "I started my freelance design business 6 months ago. I've been using my personal bank account and have receipts in a shoebox. I know I need to get organized but accounting software always makes me feel stupid. I just want something that tells me what to do, step by step, without judgment."

**Sarah's Journey:**
1. Takes assessment, identified as Stabilize phase
2. Receives warm, encouraging onboarding
3. Guided to open business bank account (checklist item with resources)
4. Walks through simplified chart of accounts setup
5. Learns to categorize transactions with encouraging feedback
6. Completes first reconciliation with guided walkthrough
7. Creates first invoice with customized template
8. Receives weekly email celebrating small wins

### Organize Phase User: Marcus

> "I've been running my consulting firm for 3 years. I have a bookkeeper who comes quarterly, but I need to track things better between visits. I understand the basics but want to be more proactive."

**Marcus's Journey:**
1. Assessment identifies Organize phase
2. Receives warm, supportive onboarding
3. Imports existing chart of accounts
4. Sets up classes for different practice areas
5. Creates invoice templates with professional customization
6. Learns to run and analyze P&L reports
7. Uses cash flow visualization to understand patterns
8. Shares access with bookkeeper through secure collaboration

### Build Phase User: Aisha

> "My e-commerce business is growing fast. I've got good books but I need better insights. I want to understand which products are actually profitable and forecast my cash needs."

**Aisha's Journey:**
1. Assessment identifies Build phase
2. Receives warm, supportive onboarding
3. Sets up inventory tracking with FIFO costing
4. Creates tags for product categories and marketing channels
5. Uses 3D visualization to understand money flow
6. Runs custom reports by product profitability
7. Uses scenario planner for hiring decision
8. Reviews financial health score weekly

---

*End of Specification Document*

**Document Status:** Ready for Review
**Next Steps:** Stakeholder review, Technical architecture planning, UI/UX design phase
