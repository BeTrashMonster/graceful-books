# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary

Graceful Books is a local-first, zero-knowledge accounting platform targeting entrepreneurs who find traditional accounting software intimidating. The project prioritizes:

1. **User data sovereignty** via zero-knowledge encryption
2. **Progressive empowerment** through phase-based feature disclosure
3. **Judgment-free education** with patient, supportive communication
4. **GAAP compliance** beneath an accessible interface
5. **Social impact** through built-in charitable giving ($5/month to user-selected charity)

## Project Status

**Current Phase:** Pre-implementation / Planning
- No source code exists yet
- Complete specifications in `SPEC.md`
- Detailed implementation roadmap in `ROADMAP.md`
- Business overview in `README.md`

## Key Technical Concepts

### Zero-Knowledge Encryption Architecture
- All user financial data encrypted client-side before transmission
- Sync relay servers act as "dumb pipes" with no ability to decrypt
- Master key derived from passphrase using Argon2id
- Hierarchical key derivation for multi-user access (Admin/Manager/Bookkeeper/View-Only)
- Key rotation enables instant access revocation
- **Critical:** Platform operator cannot access user data under any circumstances

### Local-First Data Architecture
- Primary data store is client-side (IndexedDB/SQLite)
- Full functionality works offline
- Sync queue for changes made while offline
- CRDTs (Conflict-free Replicated Data Types) for automatic conflict resolution
- Supports both hosted relay and self-hosted relay options

### Progressive Feature Disclosure
- All features technically available from day one
- UI shows only features relevant to user's current phase (Stabilize/Organize/Build/Grow)
- Hidden features accessible through intentional exploration
- Phase determined by onboarding assessment
- Users can access any feature with "early access" confirmation

### Communication Style
- **Steadiness (S) approach throughout:** Patient, step-by-step, supportive
- Clear expectations and timelines provided
- Reassuring tone that emphasizes stability
- "Take your time with this. Here's exactly what happens next..."
- No assessment needed - consistent experience for all users
- Focus on building confidence through clear guidance

## Architecture Principles

### Security
- Zero-knowledge encryption is non-negotiable
- AES-256 for data at rest
- TLS 1.3+ with additional payload encryption for transit
- Argon2id for key derivation
- Audit trail for all financial changes (immutable, 7-year retention)

### User Experience
- **Delight over duty:** Make bookkeeping feel satisfying, not punishing
- **Plain English:** "Money customers owe you" not "Accounts Receivable"
- **Micro-celebrations:** Confetti for milestones, satisfying animations for completions
- **Never blame users:** Errors are "Oops! Something unexpected happened" not "Invalid input"
- **WCAG 2.1 AA compliance** minimum for all UI

### Performance Targets
- Page load: <2 seconds
- Transaction save: <500ms
- Report generation: <5 seconds (standard), <30 seconds (complex)
- Sync completion: <5 seconds (typical changes)
- Encryption/decryption: imperceptible to user

## Development Phases

The `ROADMAP.md` uses a group-based structure optimized for parallel development:

### Phase 1: The Foundation (Groups A-C)
- Database schema, encryption layer, local-first data store
- Authentication, UI component library, application shell
- Chart of accounts, basic transactions, dashboard
- Business phase assessment and checklist generation
- User preferences and settings storage

### Phase 2: First Steps (Groups D-E)
- Guided onboarding experiences
- Bank reconciliation
- Basic reporting (P&L, Balance Sheet)
- Invoicing and client management
- Vendor management

### Phase 3: Finding Your Rhythm (Groups F-G)
- Full-featured dashboard
- Classes, categories, tags
- Cash flow reporting, A/R aging, A/P aging
- Journal entries, cash vs. accrual toggle
- Product/service catalog, inventory tracking
- Sales tax management, OCR processing

### Phase 4: Spreading Your Wings (Groups H-I)
- Multi-user support with role-based access
- Key rotation and access revocation
- Client portal, multi-currency
- CRDT conflict resolution
- Activity feeds, comments on transactions

### Phase 5: Reaching for the Stars (Group J)
- 3D financial visualization
- AI-powered insights and forecasting
- Scenario planning
- Financial health score
- Goal tracking, tax prep mode
- Integration hub, mobile app, public API

## Business Phases (User Journey)

Users progress through phases based on assessment:

1. **Stabilize:** Separate accounts, catch up on records (basic features)
2. **Organize:** Consistent processes, proper categorization (core features)
3. **Build:** Advanced features, reporting, forecasting (power features)
4. **Grow:** Multi-entity, analytics, team collaboration (full suite)

## Critical Requirements

### Accounting Compliance
- Full double-entry accounting (complexity hidden from beginners)
- Support both cash and accrual methods
- GAAP-compliant chart of accounts and reporting
- Audit trail for all financial transactions
- Cannot allow unbalanced entries

### Data Integrity
- Journal entries must balance before saving
- Reconciliation must account for all discrepancies
- Deleted records preserved in audit log
- Multi-user conflicts resolved without data loss

### Educational Approach
- Every accounting term has plain English explanation
- "Why do I need this?" tooltips throughout
- Guided walkthroughs for first-time tasks
- Video tutorials embedded contextually
- No judgment for lack of financial literacy

## Delight Opportunities (Joy Engineering)

The roadmap includes "Joy Opportunities" throughout. When implementing features:

- **Celebrate milestones:** First transaction, first invoice, reconciliation streaks
- **Satisfying interactions:** Checkbox bounce, progress bar animations, subtle confetti
- **Encouraging messaging:** "You're building real momentum" not "Task completed"
- **Personality touches:** Database internally called "TreasureChest"
- **Smart defaults:** Pre-fill what you can infer, never make users feel stupid

## Future Integrations

Architecture should support (but not block on):

- Payment processors (Stripe, Square, PayPal)
- E-commerce platforms (Shopify, WooCommerce)
- Direct bank feeds (Plaid or similar)
- CPU/CPG calculator app (separate product, shared auth)
- Open API for third-party integrations

## References

- **Full specification:** See `SPEC.md` (42KB, comprehensive requirements)
- **Implementation roadmap:** See `ROADMAP.md` (45KB, group-based development plan)
- **Business overview:** See `README.md` (pricing, phases, license)

## Technology Stack

- **Frontend:** React 18+ with TypeScript
- **Build Tool:** Vite
- **UI Components:** Custom component library (built from scratch)
- **Local Database:** Dexie.js (IndexedDB wrapper)
- **Encryption:** Web Crypto API with crypto-js for legacy support
- **State Management:** React Context + hooks (expand to Zustand if needed)
- **Styling:** CSS Modules with CSS custom properties
- **Testing:** Vitest + React Testing Library
- **E2E Testing:** Playwright

## Important Notes for Agents

1. **Tech stack chosen** - React + TypeScript + Vite with custom components
2. **Follow the roadmap groups** - Group A items can be done in parallel, Group B requires Group A, etc.
3. **Zero-knowledge is sacred** - Never compromise on encryption architecture
4. **Delight is a feature** - User experience joy is as important as functionality
5. **Steadiness communication only** - Patient, supportive, step-by-step tone throughout
6. **Plain English** - Avoid accounting jargon without explanation
7. **GAAP compliance** - Beneath the friendly UI, accounting must be professional-grade
8. **Accessibility first** - WCAG 2.1 AA compliance is not optional
