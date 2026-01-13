# Data Storage Specification

**Capability:** data-storage

## Overview

This capability provides the core database schema and models for all accounting entities. It implements the foundational data structures needed for double-entry accounting, including accounts, transactions, contacts, products/services, user profiles, and audit logs.

## ADDED Requirements

### Requirement: Chart of Accounts Schema
The system SHALL implement a hierarchical chart of accounts structure with the following fields:
- id: UUID (primary key)
- company_id: UUID (foreign key)
- account_number: VARCHAR(20), nullable
- name: VARCHAR(255), encrypted
- type: ENUM (ASSET, LIABILITY, EQUITY, INCOME, EXPENSE, COGS, OTHER_INCOME, OTHER_EXPENSE)
- parent_id: UUID, nullable (for sub-accounts)
- balance: DECIMAL(15,2), encrypted (calculated field)
- description: TEXT, encrypted, nullable
- active: BOOLEAN, default TRUE
- created_at, updated_at, deleted_at: TIMESTAMP

**ID:** ACCT-001
**Priority:** Critical

#### Scenario: Create Account with Valid Type

**GIVEN** a user has a company
**WHEN** they create an account with a valid type (e.g., "ASSET")
**THEN** the account is stored in the database
**AND** the account has a unique UUID
**AND** the name and balance are encrypted
**AND** the type is stored in plaintext for querying

#### Scenario: Create Sub-Account with Matching Parent Type

**GIVEN** an existing parent account of type "EXPENSE"
**WHEN** a user creates a sub-account with parent_id set to the parent
**THEN** the sub-account type MUST match the parent type
**AND** the sub-account is linked to the parent via parent_id

#### Scenario: Query Active Accounts by Type

**GIVEN** multiple accounts exist in the database
**WHEN** querying for active accounts of type "INCOME"
**THEN** only accounts where active=TRUE and type="INCOME" are returned
**AND** results use the idx_accounts_active index for performance

---

### Requirement: Transaction Schema
The system SHALL implement a transaction structure supporting double-entry accounting with journal entries containing multiple line items that must balance (debits = credits).

**ID:** ACCT-005
**Priority:** Critical

#### Scenario: Create Balanced Transaction

**GIVEN** a user creates a transaction with multiple line items
**WHEN** the sum of debits equals the sum of credits
**THEN** the transaction is successfully stored
**AND** all line items are encrypted
**AND** the transaction is linked to the company

#### Scenario: Reject Unbalanced Transaction

**GIVEN** a user creates a transaction with multiple line items
**WHEN** the sum of debits does NOT equal the sum of credits
**THEN** the transaction is rejected
**AND** an error message is returned
**AND** no data is persisted to the database

---

### Requirement: Audit Log Schema
The system SHALL maintain an immutable audit log structure for all financial changes with timestamp, user ID, action type, before/after values, and device identifier.

**ID:** ACCT-011
**Priority:** High

#### Scenario: Log Transaction Creation

**GIVEN** a user creates a new transaction
**WHEN** the transaction is successfully saved
**THEN** an audit log entry is created
**AND** the log entry contains timestamp (UTC), user ID, and action type "CREATE"
**AND** the log entry is encrypted with the company key
**AND** the log entry cannot be modified or deleted

#### Scenario: Log Transaction Modification with Before/After Values

**GIVEN** a user edits an existing transaction
**WHEN** the transaction is successfully updated
**THEN** an audit log entry is created
**AND** the log entry contains both before and after values
**AND** the log entry shows which fields were changed

---

### Requirement: CRDT-Compatible Schema Design
The system SHALL design database schemas to support CRDT (Conflict-free Replicated Data Types) for offline-first multi-device sync with automatic conflict resolution.

**ID:** ARCH-004
**Priority:** High

#### Scenario: Last-Write-Wins for Field Updates

**GIVEN** two devices edit the same account simultaneously
**WHEN** both changes sync to the server
**THEN** the change with the later updated_at timestamp wins
**AND** both changes are logged in the audit trail
**AND** no data is lost

#### Scenario: Tombstone Marker for Deletions

**GIVEN** a user deletes an account on one device
**WHEN** the deletion syncs across devices
**THEN** the account is marked with a deleted_at timestamp
**AND** the account data is preserved for audit purposes
**AND** the account is excluded from active queries

## Technical Details

### Database Technology
- **Primary:** IndexedDB (browser-based storage)
- **Future:** SQLite for desktop/mobile apps

### Encryption
- All sensitive fields (name, balance, description, etc.) are encrypted before storage
- Type fields and foreign keys remain plaintext for querying
- Encryption details defined in the `encryption` capability

### Indexes
Critical indexes for performance:
- `idx_accounts_company`: Query accounts by company
- `idx_accounts_type`: Query accounts by type for reports
- `idx_accounts_active`: Query active accounts
- `idx_transactions_company`: Query transactions by company
- `idx_audit_log_company_time`: Query audit logs by time range

### Constraints
- Foreign key integrity enforced
- Account type matching for parent/child relationships
- Transaction balancing enforced at application layer
- Soft deletes using deleted_at timestamp

## Dependencies

- Requires `encryption` capability for field-level encryption
- Supports `authentication` capability for user context

## Testing

- Unit tests for schema validation
- Integration tests for CRUD operations
- Performance tests for indexed queries
- CRDT conflict resolution tests
- Encryption/decryption round-trip tests
