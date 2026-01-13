# Graceful Books - OpenSpec Project Definition

**Version:** 1.0.0
**Last Updated:** 2026-01-10
**Status:** Active

---

## Project Overview

**Project Name:** Graceful Books

**Description:** Graceful Books is an immersive, educational accounting platform designed to empower entrepreneurs—especially those who are numbers-averse—to build, understand, and maintain their financial foundation. The software prioritizes user data ownership through zero-knowledge encryption, progressive feature disclosure based on readiness, and personality-adapted communication.

---

## Core Principles

These principles guide all development decisions and feature implementations:

| Principle | Description |
|-----------|-------------|
| **User Data Sovereignty** | Users own their data via encrypted local-first architecture; no server-side access to unencrypted information |
| **Progressive Empowerment** | Features reveal as users are ready, preventing overwhelm |
| **Judgment-Free Education** | All language and interactions are supportive, flexible, and shame-free |
| **GAAP Compliance** | Full professional accounting capabilities beneath the accessible interface |
| **Social Impact** | Built-in charitable giving with transparency and accountability |

---

## Technical Architecture

### Core Technology Stack

**Encryption & Security:**
- Zero-knowledge encryption architecture
- AES-256 encryption for data at rest
- TLS 1.3+ for data in transit with additional payload encryption
- Argon2id for passphrase-based key derivation

**Data Architecture:**
- Local-first data storage using IndexedDB (via Dexie.js)
- Full offline capability - no network required for core operations
- Encrypted sync relay for multi-device support
- CRDTs (Conflict-free Replicated Data Types) for conflict resolution

**Key Architectural Constraints:**
- All user financial data encrypted on-device before transmission
- Sync relay servers act as "dumb pipes" with no decryption capability
- Encryption keys never leave user devices in unencrypted form
- Platform operator cannot access user financial data under any circumstances

---

## Development Conventions

### User-Facing Language

**Communication Tone (DISC-Adapted):**
All system communications use a Steadiness-style tone by default:
- Patient, step-by-step guidance
- Reassurance and stability emphasis
- Clear expectations and next steps
- Judgment-free, shame-free language
- Warm but professional

**Tone Examples:**
- "Take your time with this. Here's exactly what happens next..."
- "Don't worry - your data is safe. Let's try that again."
- "No rush. We'll walk through this together."
- "You're making progress! Here's what we'll tackle next..."

**Application Areas:**
- All error messages (never blame the user)
- Empty states and onboarding
- Tutorial and help content
- Email communications
- Confirmation dialogs
- Success celebrations

### Feature Disclosure

**Progressive Feature Disclosure:**
- All features technically available from day one
- Interface shows only features relevant to current business phase
- Users can access hidden features through intentional exploration
- Features unlock naturally as checklist items complete
- "Show all features" override available in settings

**Business Phases:**
1. **Stabilize** - Basic separation, catch up on records, establish tracking
2. **Organize** - Consistent processes, categorization, regular reconciliation
3. **Build** - Advanced features, reporting depth, forecasting introduction
4. **Grow** - Multi-entity, advanced analytics, team collaboration

### Plain English Explanations

**Accounting Concepts Must Be Explained:**
- Assets: "Things your business owns"
- Liabilities: "What your business owes to others"
- Revenue/Income: "Money coming in from sales or services"
- Expenses: "Money going out to run your business"
- P&L (Profit & Loss): "Revenue minus Expenses equals Profit"

All accounting terminology must have plain English explanations available via tooltips, help text, or "What is this?" links.

### GAAP Compliance

**Required Standards:**
- Full double-entry bookkeeping system
- Chart of accounts following standard classifications
- Financial statements formatted per GAAP standards
- Audit trail maintained for all financial changes
- Support for both cash and accrual accounting methods
- Proper revenue recognition principles

---

## Architectural Constraints

### Zero-Knowledge Encryption

**Requirements:**
- Data at rest encrypted with AES-256 or equivalent
- Master key generated from strong passphrase using Argon2id
- Hierarchical key management for multi-user access
- Permission-based key derivation for different user roles
- Key rotation capability for instant access revocation
- No plaintext passphrase or keys transmitted over network
- Server code must have no decryption capability

**User Roles:**
- Admin (full access, key management)
- Manager (financial operations)
- User/Bookkeeper (transaction entry)
- Consultant (view-only, 1 slot)
- Accountant (specialized access, 2 slots)

### Local-First Data Storage

**Requirements:**
- Primary data store is client-side (IndexedDB)
- Full offline capability for all core operations
- Sync is enhancement, not requirement
- Performance target: Support minimum 10,000 transactions without degradation
- Transaction save: <500ms including encryption
- Database query: <100ms for indexed lookups

### Encrypted Sync Relay

**Requirements:**
- Sync relay stores encrypted payloads only
- No server-side access to plaintext business data
- No business logic on relay server
- Timestamp-based retrieval for synchronization
- Automatic purging of acknowledged sync payloads
- <200ms sync latency for same region
- Self-hosted relay option must be available

**Sync Options:**
1. Hosted relay (managed by Graceful Books)
2. Self-hosted relay (Docker container/binary)
3. Peer-to-peer (future consideration)

### No Server-Side Data Access

**Critical Constraint:**
- Platform operator cannot decrypt user data
- Database dumps show only encrypted/hashed values
- Network packet capture shows no plaintext keys or passphrases
- All business logic executes client-side
- Server only provides encrypted relay and user management

---

## Quality Standards

### Accessibility
- WCAG 2.1 AA compliance required
- Screen reader compatibility via ARIA
- Keyboard navigation for all features
- High contrast mode support

### Security
- Third-party security audit required
- OWASP Top 10 vulnerability mitigation
- Brute force protection with exponential backoff
- CSRF protection on all state-changing endpoints
- Session tokens in httpOnly cookies only

### Privacy & Compliance
- GDPR compliance for EU users
- CCPA compliance for California residents
- No sale of personal information
- Right to data export and deletion
- Transparent privacy policy

---

## Related Documents

- **SPEC.md** - Full Product Requirements Specification
- **ROADMAP.md** - Implementation roadmap with phased feature releases
- **SPEC-EVALUATION-REPORT.md** - Quality assessment of specifications
- **SPEC-GAPS-SUMMARY.md** - Known gaps and improvement priorities

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-10 | 1.0.0 | Initial OpenSpec project definition |

---

*"Build gracefully. Code with empathy. Empower with clarity."*
