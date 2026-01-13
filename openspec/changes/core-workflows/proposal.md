# Core Workflows (Phase 3 - Group F: The Daily Dance)

## Why This Change

This change completes the core daily and weekly accounting workflows, transforming Graceful Books from a capable tool into a complete daily accounting companion. After building confidence with daily workflows in Group E, users need advanced insights, multi-dimensional tracking, and comprehensive reporting to truly master their business finances.

**Dependencies:** Requires Group E completion
- Bank Reconciliation - Full Flow (E1)
- Recurring Transactions (E2)
- Invoice Templates - Customizable (E3)
- Recurring Invoices (E4)
- Expense Categorization with Suggestions (E5)
- Bill Entry & Management (E6)
- Audit Log - Extended (E7)

**Target Users:**
- Users in "Build" or "Grow" phases
- Business owners ready for deeper financial insights
- Users with multiple revenue streams or projects
- Teams needing departmental/project tracking
- Business owners preparing for tax season

**Success Metrics:**
- 50%+ of active users create at least 1 class or category
- 60%+ of users view cash flow report monthly
- 40%+ of users with A/R use aging report for follow-up
- 30%+ of users create journal entries
- 70%+ of users access full-featured dashboard daily

## Roadmap Reference

**Phase:** Phase 3: The Expansion
**Group:** Group F - The Daily Dance
**Roadmap Items:** F1-F8 (Dashboard - Full Featured, Classes & Categories System, Tags System, Cash Flow Report, A/R Aging Report, A/P Aging Report, Journal Entries - Full, Cash vs. Accrual Toggle)
**Roadmap Location:** [Roadmaps/ROADMAP.md - Phase 3, Group F](../../Roadmaps/ROADMAP.md#phase-3-the-expansion---group-f-the-daily-dance)
**Priority:** MVP (F1, F2, F4, F5, F6, F7, F8); Nice-to-have (F3)

## What Changes

This proposal introduces eight items focused on completing daily accounting workflows:

### Group F Items (F1-F8):

**F1. Dashboard - Full Featured** [MVP]
- Complete dashboard with insights and actionable items
- Cash position with trend visualization
- Revenue vs. expenses chart
- Checklist integration
- Overdue invoices highlight
- Reconciliation status tracking
- Quick actions
- Upcoming bills preview
- Business health indicators

**F2. Classes & Categories System** [MVP]
- Multi-dimensional tracking for deeper analysis
- Class creation and management (single assignment)
- Category creation (hierarchical structure)
- Assignment to transactions and invoice lines
- Reporting integration across all reports
- Department, location, project tracking

**F3. Tags System** (Nice)
- Flexible, multi-tag system for cross-cutting analysis
- Tag creation and management
- Multiple tags per transaction
- Tag-based filtering across all views
- Tag reporting and analytics
- Tag suggestions based on patterns

**F4. Cash Flow Report** [MVP]
- Cash flow statement showing where money came from and went
- Operating, investing, financing sections
- Plain English explanations
- Visual flow representation
- Period comparison
- GAAP-compliant formatting

**F5. A/R Aging Report** [MVP]
- Who owes you money and for how long
- Aging buckets (Current, 1-30, 31-60, 61-90, 90+)
- Customer breakdown
- Total outstanding calculation
- Direct link to send reminders
- Export capability

**F6. A/P Aging Report** [MVP]
- What you owe vendors and when it's due
- Aging buckets for payables
- Vendor breakdown
- Total outstanding tracking
- Payment scheduling integration
- Export capability

**F7. Journal Entries - Full** [MVP]
- Complete journal entry capability for adjustments
- Multi-line journal entries
- Debit/credit balancing (enforced)
- Entry templates for common adjustments
- Memo per line
- Attachment support
- Plain English explanations

**F8. Cash vs. Accrual Toggle** [MVP]
- Switch between accounting methods with education
- Method selection in settings
- Reports automatically adjust to selected method
- Clear warnings when switching
- Education about implications
- Historical data available in both methods

## Capabilities

### Modified Capabilities

#### `dashboard` → Full-Featured Dashboard
**What Changed:** Evolved from simplified dashboard to comprehensive business command center

**New Features Added:**
- **Cash Position with Trend:**
  - 30-day trend line visualization
  - Month-over-month comparison
  - Runway calculation (months of expenses covered)
  - Low balance alerts
- **Revenue vs. Expenses Chart:**
  - Interactive bar/line chart
  - Current month vs. prior periods
  - Drill-down to transaction details
  - Profit margin visualization
- **Checklist Integration:**
  - Embedded checklist widget
  - Progress tracking by category
  - Direct links to complete tasks
  - Streak display
- **Overdue Invoices Highlight:**
  - Count and total amount
  - Quick-send reminder action
  - Age of oldest invoice
  - Customer list
- **Reconciliation Status:**
  - Last reconciliation date
  - Unreconciled transaction count
  - Quick-start reconciliation link
  - Reconciliation streak display
- **Quick Actions:**
  - New transaction (income/expense)
  - New invoice
  - Record bill payment
  - Add receipt
  - Create journal entry
- **Upcoming Bills Preview:**
  - Next 7 days of bills due
  - Total amount due
  - Quick-pay links
  - Overdue bill alerts
- **Business Health Indicators:**
  - Key metrics at a glance
  - Trend indicators (up/down/stable)
  - Context-aware insights
  - Encouraging messaging

**Technical Changes:**
- Widget-based architecture for customization
- Real-time data updates
- Performance optimization for large datasets
- Responsive layout for all screen sizes
- Accessibility improvements

### New Capabilities

#### `classes-categories`
**Purpose:** Multi-dimensional tracking system for departments, locations, and projects

**Features:**
- **Class Management:**
  - Create unlimited classes
  - Hierarchical structure (parent/child classes)
  - One class per transaction (single assignment)
  - Common uses: departments, locations, business units, projects
  - Active/inactive status
  - Plain English descriptions
- **Category Management:**
  - Hierarchical categories within accounts
  - Unlimited depth
  - Sub-category relationships
  - One category per line item
  - Category templates by business type
- **Assignment:**
  - Apply to invoice headers and line items
  - Apply to bill headers and line items
  - Apply to expenses
  - Apply to journal entries
  - Apply to transfers
  - Bulk assignment tools
- **Reporting Integration:**
  - P&L by Class report
  - Class comparison report
  - Category drill-down in all reports
  - Filter any report by class/category
  - Budget vs. actual by class

**Technical Approach:**
- Single assignment constraint for classes (data integrity)
- Hierarchical storage for categories (nested sets or adjacency list)
- Index optimization for fast filtering
- Bulk operation support

#### `tags`
**Purpose:** Flexible tagging system for cross-cutting analysis

**Features:**
- **Tag Creation:**
  - User-defined tags
  - Tag colors for visual identification
  - Tag descriptions
  - Tag categories (optional grouping)
- **Multi-Tag Assignment:**
  - Multiple tags per transaction
  - Tag suggestions based on patterns
  - Quick-tag shortcuts
  - Bulk tagging tools
- **Tag-Based Filtering:**
  - Filter transactions by tags
  - Combine tag filters (AND/OR logic)
  - Tag-based reports
  - Tag analytics (usage, trends)
- **Common Use Cases:**
  - Campaign tracking ("Q4 Campaign", "Spring Sale")
  - Client-specific expenses ("Client: ABC Corp")
  - Grant or fund tracking ("Grant: XYZ Foundation")
  - Tax categories ("Tax Deductible", "Personal Use")
  - Project phases ("Phase 1", "Launch")

**Technical Approach:**
- Many-to-many relationship (transaction ↔ tags)
- Fast tag search with indexing
- Tag suggestion algorithm (pattern matching)
- Export includes all tags

#### `cash-flow-report`
**Purpose:** Cash flow statement showing sources and uses of cash

**Features:**
- **Standard Cash Flow Statement:**
  - Operating activities section
  - Investing activities section
  - Financing activities section
  - Net change in cash
  - Beginning and ending cash balances
- **Plain English Explanations:**
  - "This month, you brought in $15,000 and spent $12,000. $3,000 stayed with you!"
  - Section descriptions for each category
  - Educational tooltips
- **Visual Representation:**
  - Sankey diagram showing cash flow
  - Bar chart for period comparison
  - Trend lines over time
- **Period Comparison:**
  - Month-over-month
  - Quarter-over-quarter
  - Year-over-year
  - Custom date ranges
- **Export Options:**
  - PDF (formatted report)
  - CSV (data export)
  - Excel (with formatting)

**Technical Approach:**
- Cash basis vs. accrual basis calculations
- Indirect method calculation
- GAAP-compliant formatting
- Performance optimization for large datasets

#### `ar-aging`
**Purpose:** Accounts receivable aging report

**Features:**
- **Aging Buckets:**
  - Current (not yet due)
  - 1-30 days past due
  - 31-60 days past due
  - 61-90 days past due
  - 90+ days past due
  - Friendly bucket names option
- **Customer Breakdown:**
  - List of all customers with outstanding invoices
  - Total owed per customer
  - Age of oldest invoice
  - Payment history indicators
- **Actions:**
  - Direct link to send reminder email
  - One-click invoice view
  - Payment recording shortcut
  - Customer contact information
- **Analytics:**
  - Average days to payment
  - Collection rate trends
  - Customer payment reliability score
  - Total outstanding A/R
- **Export:**
  - PDF for printing/sharing
  - CSV for spreadsheet analysis
  - Email to accountant

**Technical Approach:**
- Real-time aging calculation
- Efficient query optimization
- Payment term awareness
- Grace period configuration

#### `ap-aging`
**Purpose:** Accounts payable aging report

**Features:**
- **Aging Buckets:**
  - Not yet due
  - 1-30 days past due
  - 31-60 days past due
  - 61-90 days past due
  - 90+ days past due
- **Vendor Breakdown:**
  - List of all vendors with outstanding bills
  - Total owed per vendor
  - Due date tracking
  - Payment terms by vendor
- **Actions:**
  - Payment scheduling link
  - Bill detail view
  - Vendor contact information
  - Bulk payment planning
- **Analytics:**
  - Total outstanding A/P
  - Upcoming payment obligations
  - Payment trend analysis
  - Early payment discount tracking
- **Export:**
  - PDF report
  - CSV export
  - Integration with bill payment workflow

**Technical Approach:**
- Aging calculation based on due dates
- Payment term configuration
- Vendor credit tracking
- Performance optimization

#### `journal-entries`
**Purpose:** Full journal entry capability for manual adjustments

**Features:**
- **Entry Types:**
  - Standard journal entries
  - Adjusting entries
  - Reversing entries (with auto-reverse option)
  - Recurring journal entries
- **Multi-Line Entries:**
  - Unlimited debit/credit lines
  - Must balance before saving (enforced)
  - Running balance display
  - Visual balance indicator
- **Entry Templates:**
  - Common adjustment templates:
    - Depreciation
    - Prepaid expenses amortization
    - Accrued expenses
    - Deferred revenue recognition
    - Bad debt write-off
    - Inventory adjustments
  - Save custom templates
  - Template library
- **Details Per Line:**
  - Account selection
  - Debit or credit amount
  - Memo/description
  - Class/category/tags
  - Attachments
- **Educational Elements:**
  - "Why would I need this?" context
  - Debit and credit explained simply
  - Balance verification guidance
  - Common entry examples
- **Safeguards:**
  - Must balance (debits = credits)
  - Warning for unusual amounts
  - Audit trail for all entries
  - "Are you sure?" for large adjustments
  - Approval workflow (optional)

**Technical Approach:**
- Transaction line validation
- Balance enforcement
- Template storage and retrieval
- Attachment handling
- Auto-reverse scheduling

#### `accounting-method`
**Purpose:** Cash vs. accrual accounting method toggle

**Features:**
- **Method Selection:**
  - Cash basis: Income when received, expenses when paid
  - Accrual basis: Income when earned, expenses when incurred
  - Clear explanation of each method
  - Visual comparison of methods
- **Switching Between Methods:**
  - Warning about implications
  - Educational content about when to use each
  - Confirm dialog with clear messaging
  - No data loss when switching
- **Report Behavior:**
  - All reports automatically adjust to selected method
  - Method clearly indicated on every report
  - Option to view reports in "other" method
  - Historical reports available in both methods
- **Guidance:**
  - Inventory-based businesses guided to accrual
  - Service businesses can choose either
  - Tax implications explained
  - CPA consultation recommended messaging
- **Technical Implementation:**
  - Report calculation engine supports both methods
  - Real-time method switching
  - No data duplication
  - Method stored in company settings

**Technical Approach:**
- Dual calculation engine (cash and accrual)
- Report filters based on method
- Invoice/bill recognition vs. payment tracking
- Performance optimization for both methods

## Impact

### User Experience
- **Complete Workflow:** Users now have all tools needed for daily/weekly accounting
- **Financial Insight:** Dashboard provides at-a-glance business health
- **Multi-Dimensional Analysis:** Classes, categories, and tags enable deep insights
- **Professional Reporting:** Cash flow and aging reports meet professional standards
- **Flexibility:** Cash vs. accrual toggle accommodates different business needs
- **Journal Entry Power:** Advanced users can make any adjustment needed

### Technical
- **Report Engine:** Comprehensive reporting infrastructure enables future reports
- **Multi-Dimensional Data:** Classification system supports advanced analytics
- **Calculation Flexibility:** Dual method support enables diverse user needs
- **Dashboard Framework:** Widget-based dashboard enables customization

### Business
- **Professional Tier:** Advanced features justify premium pricing
- **Accountant Appeal:** Professional reporting attracts accounting professionals
- **User Retention:** Complete workflows reduce churn
- **Expansion Ready:** Foundation for Phase 4 advanced features

## Migration Plan

### Data Migration

**Dashboard Enhancement:**
- No migration needed - existing dashboards automatically enhanced
- Widget preferences initialized with sensible defaults
- Users can customize layout immediately

**Classification System:**
- New tables for classes, categories, tags
- No migration of existing data required
- Backward compatible (transactions without classes/categories/tags still valid)

**Journal Entries:**
- Existing manual transactions remain valid
- Journal entry interface provides new way to create same data
- No data structure changes needed

### Feature Flags

**New Flags:**
- `dashboard-full`: Enable full-featured dashboard
- `classes-categories`: Enable classification system
- `tags`: Enable tagging system
- `cash-flow-report`: Enable cash flow statement
- `ar-aging-report`: Enable A/R aging report
- `ap-aging-report`: Enable A/P aging report
- `journal-entries`: Enable journal entry interface
- `accounting-method-toggle`: Enable cash vs. accrual switching

**Rollout Strategy:**
1. **Week 1:** Deploy dashboard enhancement (F1)
2. **Week 2:** Deploy classes and categories (F2)
3. **Week 3:** Deploy tags system (F3)
4. **Week 4:** Deploy cash flow and aging reports (F4, F5, F6)
5. **Week 5:** Deploy journal entries (F7)
6. **Week 6:** Deploy accounting method toggle (F8)

**User Communication:**
- In-app announcements for each capability
- Tutorial triggers for classification systems
- Weekly email highlighting insights from new reports
- Changelog updates
- Blog posts about advanced features

### Rollback Plan

All capabilities are additive with feature flags:
- Disable feature flag to hide capability
- No data loss on rollback
- Users notified if feature temporarily disabled
- Re-enable when issue resolved

### Testing Requirements

**Before Production:**
- [ ] All unit tests passing (>90% coverage)
- [ ] Integration tests for each report
- [ ] UAT with 10+ power users
- [ ] Performance testing: 50,000 transactions
- [ ] GAAP compliance verification for reports
- [ ] Accessibility testing (WCAG 2.1 AA)
- [ ] Cross-browser testing

## Success Criteria

### Adoption Metrics
- 70%+ of active users access full dashboard daily
- 50%+ of users create at least 1 class or category
- 60%+ of users view cash flow report monthly
- 40%+ of users with A/R use aging report
- 30%+ of users create journal entries
- 25%+ of users use tags for tracking

### Performance Metrics
- Dashboard loads in <1 second
- Reports generate in <3 seconds (10,000 transactions)
- Classification system handles 1,000+ classes/categories
- Tag filtering completes in <500ms

### Quality Metrics
- Zero data loss incidents
- 100% GAAP compliance for all reports
- Journal entries always balance (enforced)
- Cash flow statement reconciles to balance sheet

### Business Impact
- 25% increase in user engagement (daily active usage)
- 30% increase in professional tier upgrades
- 20% reduction in support requests about reporting
- 40% increase in accountant referrals
