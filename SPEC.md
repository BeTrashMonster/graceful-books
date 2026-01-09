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

## 3. User Onboarding & Assessment

### 3.1 Assessment Framework

```
REQUIREMENT: ONB-001
PRIORITY: Critical
CATEGORY: Onboarding

The system SHALL implement a comprehensive onboarding assessment that:

1. Determines user's current phase: Stabilize, Organize, Build, or Grow
2. Assesses Financial Literacy level (Beginner, Developing, Proficient, Advanced)
3. Identifies DISC personality profile for communication adaptation
4. Categorizes business type: Service-based, Product-based, or Hybrid

CONSTRAINTS:
- Maximum 50 questions total
- Branching logic based on business type selection
- Progress indicator throughout
- Ability to save and resume

ACCEPTANCE CRITERIA:
- [ ] Assessment feels quick and focused for users
- [ ] All four business phases correctly identified in testing
- [ ] DISC profile accurately determined
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

SECTION 4: BEHAVIORAL ANCHORS - DISC (8-12 questions)
- Communication preferences
- Decision-making style
- Stress response patterns
- Learning preferences
- Motivation drivers

SECTION 5: BUSINESS-TYPE SPECIFIC (5-10 questions)
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

### 3.4 DISC-Adapted Communication

```
REQUIREMENT: ONB-004
PRIORITY: High
CATEGORY: User Experience

The system SHALL adapt all user-facing language based on DISC profile:

DOMINANCE (D) - Direct and Results-Oriented
- Concise, bullet-pointed communication
- Focus on efficiency and outcomes
- Minimal hand-holding, maximum control
- Example: "Your P&L is ready. Key metric: 23% margin improvement."

INFLUENCE (I) - Enthusiastic and Collaborative
- Warm, encouraging tone
- Celebration of milestones
- Social proof and community elements
- Example: "Great news! You've joined 2,000+ entrepreneurs who reconciled this week!"

STEADINESS (S) - Patient and Supportive
- Step-by-step guidance
- Reassurance and stability emphasis
- Clear expectations and timelines
- Example: "Take your time with this. Here's exactly what happens next..."

CONSCIENTIOUSNESS (C) - Analytical and Detail-Oriented
- Comprehensive explanations available
- Data and logic emphasis
- Precision and accuracy focus
- Example: "This calculation uses the weighted average method (FIFO available in settings)..."

ACCEPTANCE CRITERIA:
- [ ] All system messages have 4 DISC variants
- [ ] User can manually adjust communication style
- [ ] Tooltip/help content adapts to DISC profile
- [ ] Email communications use DISC-appropriate tone
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
3. Encouraging messages (DISC-adapted)
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
1. Greeting (DISC-adapted tone)
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
- [ ] Tone matches DISC profile
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
7. DISC-adapted content delivery

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
for some DISC profiles
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
| CRDT | A way for multiple people to edit the same thing without conflicts | Conflict-free Replicated Data Type |
| GAAP | The rules for how business finances should be tracked | Generally Accepted Accounting Principles |
| Zero-knowledge | We can't see your data even if we wanted to | Encryption where service provider has no decryption capability |
| DISC | A way to understand how you prefer to communicate | Personality assessment framework (Dominance, Influence, Steadiness, Conscientiousness) |
| COA | Your list of categories for tracking money | Chart of Accounts |
| Reconciliation | Making sure your records match your bank | Bank Reconciliation |
| Accrual | Recording money when you earn it, not when you get it | Accrual basis accounting |
| Cash basis | Recording money when it hits your account | Cash basis accounting |

---

## Appendix B: User Stories

### Stabilize Phase User: Sarah

> "I started my freelance design business 6 months ago. I've been using my personal bank account and have receipts in a shoebox. I know I need to get organized but accounting software always makes me feel stupid. I just want something that tells me what to do, step by step, without judgment."

**Sarah's Journey:**
1. Takes assessment, identified as Stabilize phase, High I (Influence) personality
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
1. Assessment identifies Organize phase, High C (Conscientiousness) personality
2. Receives detailed, data-focused onboarding
3. Imports existing chart of accounts
4. Sets up classes for different practice areas
5. Creates invoice templates with professional customization
6. Learns to run and analyze P&L reports
7. Uses cash flow visualization to understand patterns
8. Shares access with bookkeeper through secure collaboration

### Build Phase User: Aisha

> "My e-commerce business is growing fast. I've got good books but I need better insights. I want to understand which products are actually profitable and forecast my cash needs."

**Aisha's Journey:**
1. Assessment identifies Build phase, High D (Dominance) personality
2. Receives concise, results-focused onboarding
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
