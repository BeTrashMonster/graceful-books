# Core Workflows - Implementation Tasks

**Phase:** 3 - Finding Your Rhythm
**Group:** F - The Daily Dance
**Dependencies:** Group E (Daily Workflows)

## Task Breakdown

### F1. Dashboard - Full Featured [MVP]

**Backend Tasks:**
- [ ] Build cash position trend calculation service (30-day history)
- [ ] Implement revenue vs. expenses chart data aggregation
- [ ] Create runway calculation (months of expenses covered)
- [ ] Build overdue invoices query optimization
- [ ] Implement reconciliation status tracking
- [ ] Create upcoming bills calculation (7-day window)
- [ ] Build business health indicators calculation
- [ ] Implement dashboard metrics caching for performance

**Frontend Tasks:**
- [ ] Build DashboardFull component with widget layout
- [ ] Create CashPositionWidget with trend visualization
- [ ] Implement RevenueExpensesChart component
- [ ] Build ChecklistWidget (embedded mini-checklist)
- [ ] Create OverdueInvoicesWidget with quick actions
- [ ] Implement ReconciliationStatusWidget
- [ ] Build QuickActionsPanel with common tasks
- [ ] Create UpcomingBillsWidget
- [ ] Implement HealthIndicators component
- [ ] Build dashboard customization settings
- [ ] Create widget drag-and-drop reordering

**Visualization:**
- [ ] Implement trend line charts (Chart.js or D3.js)
- [ ] Create responsive chart layouts
- [ ] Build interactive drill-down capability
- [ ] Implement tooltip enhancements

**Testing:**
- [ ] Test dashboard loads in <1 second
- [ ] Verify all widgets display correct data
- [ ] Test responsive layout on mobile/tablet/desktop
- [ ] UAT: Power user daily workflow
- [ ] Performance test with 50,000 transactions

**Joy Opportunities:**
- [ ] Time-based greetings (Good morning/afternoon/evening)
- [ ] Context-aware insights ("You're 2 weeks ahead on invoicing!")
- [ ] Celebration for fully caught-up status
- [ ] Runway milestone badges

---

### F2. Classes & Categories System [MVP]

**Backend Tasks:**
- [ ] Design classes and categories database schema
- [ ] Implement class CRUD API endpoints
- [ ] Build category CRUD API with hierarchy support
- [ ] Create class assignment validation (single assignment)
- [ ] Implement category hierarchy traversal
- [ ] Build bulk assignment service
- [ ] Create class/category reporting filters
- [ ] Implement active/inactive status management

**Frontend Tasks:**
- [ ] Build ClassManagement page
- [ ] Create ClassForm component
- [ ] Implement ClassList with hierarchy display
- [ ] Build CategoryManagement page
- [ ] Create CategoryForm with parent selection
- [ ] Implement CategoryTree component
- [ ] Build ClassCategoryAssignment selector
- [ ] Create ClassCategoryPicker (inline for transactions)
- [ ] Implement bulk assignment modal
- [ ] Build class/category import/export

**Reporting Integration:**
- [ ] Add class filter to all existing reports
- [ ] Add category filter to all existing reports
- [ ] Build P&L by Class report
- [ ] Create Class Comparison report
- [ ] Implement category drill-down in reports

**Testing:**
- [ ] Test single-assignment constraint for classes
- [ ] Verify hierarchy traversal accuracy
- [ ] Test bulk assignment with 1,000+ transactions
- [ ] UAT: Multi-project business tracking workflow
- [ ] Test reporting with class/category filters

**Joy Opportunities:**
- [ ] "Your first class!" celebration
- [ ] "X-ray vision for your finances" messaging
- [ ] Visual hierarchy display (tree view)

---

### F3. Tags System (Nice)

**Backend Tasks:**
- [ ] Design tags database schema (many-to-many)
- [ ] Implement tag CRUD API endpoints
- [ ] Build tag assignment API (multiple per transaction)
- [ ] Create tag suggestion algorithm (pattern-based)
- [ ] Implement tag-based filtering service
- [ ] Build tag analytics calculation
- [ ] Create tag usage tracking

**Frontend Tasks:**
- [ ] Build TagManagement page
- [ ] Create TagForm with color picker
- [ ] Implement TagList component
- [ ] Build TagPicker (multi-select for transactions)
- [ ] Create TagInput with autocomplete
- [ ] Implement TagCloud visualization
- [ ] Build tag-based filter UI (AND/OR logic)
- [ ] Create tag analytics dashboard

**Testing:**
- [ ] Test multiple tags per transaction
- [ ] Verify tag filtering with complex queries
- [ ] Test tag suggestion accuracy
- [ ] UAT: Campaign tracking workflow
- [ ] Performance test with 10,000 tags

**Joy Opportunities:**
- [ ] "Tags are like sticky notes" messaging
- [ ] Tag usage visualization
- [ ] Popular tags suggestion

---

### F4. Cash Flow Report [MVP]

**Backend Tasks:**
- [ ] Implement cash flow calculation engine
- [ ] Build operating activities section calculation
- [ ] Create investing activities section calculation
- [ ] Implement financing activities section calculation
- [ ] Build indirect method calculations
- [ ] Create period comparison logic
- [ ] Implement cash vs. accrual adjustments

**Frontend Tasks:**
- [ ] Build CashFlowReport component
- [ ] Create CashFlowStatement visual layout
- [ ] Implement Sankey diagram for flow visualization
- [ ] Build period comparison UI
- [ ] Create plain English explanations
- [ ] Implement report export (PDF, CSV, Excel)

**Testing:**
- [ ] Verify GAAP compliance
- [ ] Test cash flow reconciles to balance sheet
- [ ] Test period comparison accuracy
- [ ] UAT: Business owner cash flow analysis
- [ ] Performance test report generation

**Joy Opportunities:**
- [ ] "This month, you brought in X and spent Y" summary
- [ ] Visual cash flow animation
- [ ] Positive cash flow celebration

---

### F5. A/R Aging Report [MVP]

**Backend Tasks:**
- [ ] Implement A/R aging calculation engine
- [ ] Build aging bucket categorization
- [ ] Create customer breakdown aggregation
- [ ] Implement payment history tracking
- [ ] Build average days to payment calculation
- [ ] Create collection rate trends

**Frontend Tasks:**
- [ ] Build ARAgingReport component
- [ ] Create aging bucket visualization
- [ ] Implement customer drill-down
- [ ] Build send reminder action integration
- [ ] Create export functionality
- [ ] Implement payment reliability indicators

**Testing:**
- [ ] Test aging calculation accuracy
- [ ] Verify bucket categorization
- [ ] Test reminder integration
- [ ] UAT: Collections workflow
- [ ] Performance test with 1,000+ invoices

**Joy Opportunities:**
- [ ] "Great news - most receivables are current!"
- [ ] Friendly bucket names option
- [ ] Collection streak tracking

---

### F6. A/P Aging Report [MVP]

**Backend Tasks:**
- [ ] Implement A/P aging calculation engine
- [ ] Build aging bucket categorization for payables
- [ ] Create vendor breakdown aggregation
- [ ] Implement payment scheduling integration
- [ ] Build early payment discount tracking

**Frontend Tasks:**
- [ ] Build APAgingReport component
- [ ] Create aging bucket visualization
- [ ] Implement vendor drill-down
- [ ] Build payment scheduling link
- [ ] Create export functionality

**Testing:**
- [ ] Test aging calculation accuracy
- [ ] Verify due date tracking
- [ ] Test payment scheduling integration
- [ ] UAT: Bill payment planning workflow
- [ ] Performance test with 1,000+ bills

**Joy Opportunities:**
- [ ] "Staying on top of what you owe" messaging
- [ ] Early payment discount opportunities highlighted
- [ ] On-time payment streak tracking

---

### F7. Journal Entries - Full [MVP]

**Backend Tasks:**
- [ ] Implement journal entry validation (must balance)
- [ ] Build multi-line entry API
- [ ] Create entry template storage and retrieval
- [ ] Implement auto-reverse scheduling
- [ ] Build recurring journal entry support
- [ ] Create entry approval workflow (optional)

**Frontend Tasks:**
- [ ] Build JournalEntryForm component
- [ ] Create multi-line entry interface
- [ ] Implement running balance display
- [ ] Build entry template selector
- [ ] Create template save/manage UI
- [ ] Implement visual balance indicator
- [ ] Build "Why would I need this?" education
- [ ] Create common entry examples library

**Entry Templates:**
- [ ] Create depreciation template
- [ ] Build prepaid expenses template
- [ ] Implement accrued expenses template
- [ ] Create deferred revenue template
- [ ] Build bad debt write-off template
- [ ] Implement inventory adjustment template

**Testing:**
- [ ] Test balance enforcement (cannot save unbalanced)
- [ ] Verify auto-reverse scheduling
- [ ] Test template save/retrieve
- [ ] UAT: Accountant adjustment workflow
- [ ] Test approval workflow

**Joy Opportunities:**
- [ ] "Writing a note in the margins" metaphor
- [ ] Balance achievement celebration
- [ ] Template library categorization

---

### F8. Cash vs. Accrual Toggle [MVP]

**Backend Tasks:**
- [ ] Implement dual calculation engine (cash and accrual)
- [ ] Build report filters based on method
- [ ] Create method switching validation
- [ ] Implement historical data access in both methods

**Frontend Tasks:**
- [ ] Build AccountingMethodSettings component
- [ ] Create method selection UI with explanations
- [ ] Implement comparison visualization (cash vs. accrual)
- [ ] Build warning dialogs for method switching
- [ ] Create method indicator on all reports
- [ ] Implement "view in other method" option

**Educational Content:**
- [ ] Create "What is cash basis?" explainer
- [ ] Build "What is accrual basis?" explainer
- [ ] Implement method comparison examples
- [ ] Create guidance for inventory businesses
- [ ] Build tax implications content

**Testing:**
- [ ] Test both methods produce accurate reports
- [ ] Verify method switching warnings
- [ ] Test historical report access
- [ ] UAT: Method comparison workflow
- [ ] Verify GAAP compliance for both methods

**Joy Opportunities:**
- [ ] "Both are valid!" reassurance messaging
- [ ] Clear, judgment-free explanations
- [ ] Guidance without overwhelm

---

## Cross-Cutting Tasks

**Infrastructure:**
- [ ] Optimize database queries for reporting
- [ ] Implement report caching strategy
- [ ] Build widget framework for dashboard
- [ ] Create classification indexing

**Analytics & Tracking:**
- [ ] Track dashboard widget usage
- [ ] Monitor report generation frequency
- [ ] Track classification adoption rates
- [ ] Monitor journal entry usage

**Feature Flags:**
- [ ] `dashboard-full` flag
- [ ] `classes-categories` flag
- [ ] `tags` flag
- [ ] `cash-flow-report` flag
- [ ] `ar-aging-report` flag
- [ ] `ap-aging-report` flag
- [ ] `journal-entries` flag
- [ ] `accounting-method-toggle` flag

**Performance:**
- [ ] Load testing for dashboard with 50,000 transactions
- [ ] Report generation optimization
- [ ] Classification query optimization
- [ ] Caching strategy implementation

**Documentation:**
- [ ] Update user documentation for F1-F8
- [ ] Create tutorial content for classifications
- [ ] Document journal entry templates
- [ ] Create cash vs. accrual guide

---

## Rollout Strategy

**Week 1: Dashboard**
1. Dashboard - Full Featured (F1)

**Week 2: Classifications**
2. Classes & Categories System (F2)

**Week 3: Tags**
3. Tags System (F3)

**Week 4: Core Reports**
4. Cash Flow Report (F4)
5. A/R Aging Report (F5)
6. A/P Aging Report (F6)

**Week 5: Advanced Entries**
7. Journal Entries - Full (F7)

**Week 6: Accounting Method**
8. Cash vs. Accrual Toggle (F8)

---

## Success Criteria

- [ ] 70%+ users access full dashboard daily
- [ ] 50%+ users create at least 1 class/category
- [ ] 60%+ users view cash flow report monthly
- [ ] 40%+ users with A/R use aging report
- [ ] 30%+ users create journal entries
- [ ] Dashboard loads in <1 second
- [ ] Reports generate in <3 seconds
- [ ] 100% GAAP compliance for all reports
- [ ] Zero data loss incidents
- [ ] WCAG 2.1 AA compliance maintained

---

## Dependencies

**Requires Completed:**
- Group E: Daily Workflows (reconciliation, recurring transactions, bills, etc.)
- Group D: Guided Setup Experiences
- Group C: Assessment, Checklists
- Infrastructure: Report engine, dashboard framework

**Enables:**
- Group G: Advanced accounting features
- Professional accounting capabilities
- Accountant collaboration features
- Advanced analytics and forecasting
