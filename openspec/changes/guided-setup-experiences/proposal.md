# Guided Setup Experiences (Phase 2 - Group D: Welcome Home)

## Why This Change

This change implements guided first-time experiences to help users successfully complete their initial setup of Graceful Books. After completing the foundational features in Group C (Assessment, Checklists, and Phase-based Feature Visibility), users need structured guidance to set up their core accounting infrastructure and complete their first critical tasks.

**Dependencies:** Requires Group C completion
- Assessment Engine (C1)
- Checklist Generation & UI (C3, C4)
- Phase-based Feature Visibility (C5)
- Chart of Accounts CRUD (B1)
- Transaction Entry (B2)
- Message Variant System (B5)

**Target Users:**
- First-time Graceful Books users completing onboarding
- Entrepreneurs with limited accounting knowledge
- Business owners in "Stabilize" or "Organize" phases

**Success Metrics:**
- 80%+ of users complete guided chart of accounts setup
- 60%+ of users complete first reconciliation within 30 days
- 70%+ weekly email opt-in rate
- Average time to first P&L report < 7 days

## Roadmap Reference

**Phase:** Phase 2: The First Home
**Group:** Group D - Welcome Home
**Roadmap Items:** D1-D7 (Guided Chart of Accounts Setup, First Reconciliation Experience - Guided, Weekly Email Summary Setup, Tutorial System Framework, Vendor Management - Basic, Basic Reports - P&L, Basic Reports - Balance Sheet)
**Roadmap Location:** [Roadmaps/ROADMAP.md - Phase 2, Group D](../../Roadmaps/ROADMAP.md#phase-2-the-first-home---group-d-welcome-home)
**Priority:** MVP

## What Changes

This proposal introduces seven capabilities focused on guided experiences:

### Group D Items (D1-D7):

**D1. Guided Chart of Accounts Setup** [MVP] [DONE]
- Step-by-step wizard for chart of accounts creation
- Industry template selection with friendly descriptions
- Plain English explanations for each account type
- "Why do I need this?" educational tooltips

**D2. First Reconciliation Experience - Guided** [MVP]
- Hand-held first bank reconciliation with education
- Statement upload (PDF/CSV)
- Step-by-step matching guidance with explanations
- Common discrepancy troubleshooting

**D3. Weekly Email Summary Setup** [MVP]
- Configure weekly task reminder emails
- Day/time selection with preview functionality
- DISC-adapted email content
- Encouraging subject lines and tone

**D4. Tutorial System Framework** [MVP]
- Infrastructure for contextual tutorials
- Step highlighting and progress tracking
- Skip and resume capability
- Tutorial completion tracking

**D5. Vendor Management - Basic** [MVP]
- Create and manage vendor records
- Link vendors to expense transactions
- Contact information and notes
- Vendor list view with search

**D6. Basic Reports - P&L** [MVP]
- Profit and Loss statement generation
- Plain English annotations and explanations
- Date range selection
- Export to PDF

**D7. Basic Reports - Balance Sheet** [MVP]
- Balance sheet generation with educational context
- Assets, Liabilities, Equity sections explained
- Plain English "what this means" toggle
- Export to PDF

## Capabilities

### New Capabilities

#### `coa-wizard`
**Purpose:** Guided chart of accounts setup experience

**Features:**
- Section-by-section walkthrough (Assets → Liabilities → Equity → Income → Expenses)
- Industry template selection (Service, Product, Hybrid, Creative, etc.)
- Pre-suggested common accounts with explanations
- Plain English descriptions for all account types
- Progress indicator and ability to save/resume
- Educational tooltips explaining account purposes

**Technical Approach:**
- Multi-step wizard UI component
- Template definitions stored in configuration
- Account creation leverages existing ACCT-001 CRUD
- Progress saved to user preferences

#### `reconciliation-wizard`
**Purpose:** Guided first-time reconciliation experience

**Features:**
- Educational introduction ("What is reconciliation?")
- Statement upload (PDF/CSV parsing)
- Step-by-step guided matching process
- Visual indicators for matched/unmatched transactions
- Common discrepancy explanations
- Celebration animation on completion

**Technical Approach:**
- Wizard interface with clear step progression
- File parser for bank statement formats
- Matching algorithm (exact and fuzzy matching)
- Reconciliation state storage
- Integration with transactions table (ACCT-004)

#### `email-summaries`
**Purpose:** Weekly task email notification system

**Features:**
- Email content generation from checklist items
- Day/time preference selection
- DISC-adapted message variants
- Preview functionality before enabling
- One-click task links to app
- Unsubscribe mechanism

**Technical Approach:**
- Email template system with 4 DISC variants
- Scheduled email delivery service
- Checklist integration for content
- User preference storage
- Email delivery tracking

#### `tutorials`
**Purpose:** Contextual tutorial framework

**Features:**
- Tutorial trigger system (first-use detection)
- Step highlighting with overlay
- Progress tracking per tutorial
- Skip, resume, and restart options
- "Don't show again" preferences
- Tutorial completion badges (optional)

**Technical Approach:**
- Tutorial definition format (JSON/config)
- DOM element highlighting system
- Tutorial state storage per user
- Event-based triggering
- Accessibility-compliant overlay

#### `vendor-management`
**Purpose:** Basic vendor record management

**Features:**
- Vendor creation form with contact details
- Vendor list view with search/filter
- Link vendors to expense transactions
- Notes and payment terms fields
- Vendor spending summary

**Technical Approach:**
- Uses CONTACTS table (type: VENDOR)
- CRUD operations for vendor records
- Integration with transaction entry
- Reporting aggregation by vendor

#### `reports-basic`
**Purpose:** Essential financial reports (P&L and Balance Sheet)

**Features:**
- Profit & Loss statement generation
- Balance sheet generation
- Date range selection
- Plain English annotations ("What does this mean?")
- Comparison periods (basic)
- PDF export
- Visual profit/loss indicators

**Technical Approach:**
- Report calculation engine using transaction data
- Template-based report layouts
- Educational content overlays
- PDF generation library
- Caching for performance

## Impact

### User Experience
- **Reduced Setup Friction:** Wizards reduce complexity of initial setup tasks
- **Increased Confidence:** Educational content builds understanding
- **Better Engagement:** Weekly emails maintain momentum
- **Faster Time-to-Value:** Users generate first reports within days

### Technical
- **Tutorial Infrastructure:** Reusable framework for all future guided experiences
- **Email System Foundation:** Expandable for future notification types
- **Report Engine:** Core reporting capabilities for future report types
- **Vendor Data:** Foundation for bills, 1099 tracking, and AP aging

### Business
- **Higher Completion Rates:** Guided experiences reduce abandonment
- **User Success:** First reconciliation completion = key activation metric
- **Retention:** Weekly emails drive continued engagement
- **Expansion Ready:** Tutorial system supports feature education for upgrades

## Migration Plan

No data migration required. All capabilities are new additions.

**Feature Flags:**
- `guided-coa-setup`: Enable/disable guided chart of accounts wizard
- `reconciliation-wizard`: Enable/disable guided reconciliation
- `weekly-emails`: Enable/disable email notification system
- `contextual-tutorials`: Enable/disable tutorial framework

**Rollout Strategy:**
1. Deploy tutorial framework first (D4)
2. Deploy vendor management (D5) - standalone
3. Deploy reports (D6, D7) - depends on existing transaction data
4. Deploy email summaries (D3) - depends on checklist system
5. Deploy reconciliation wizard (D2) - depends on transactions
6. Deploy COA wizard (D1) - marked [DONE], verify completion

**User Communication:**
- In-app announcements for new guided experiences
- Email to existing users highlighting new reports
- Updated onboarding flow for new users
