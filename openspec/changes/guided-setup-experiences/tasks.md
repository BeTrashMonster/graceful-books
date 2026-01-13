# Guided Setup Experiences - Implementation Tasks

**Phase:** 2 - First Steps
**Group:** D - Welcome Home
**Dependencies:** Group C (Assessment, Checklists, Phase-based Feature Visibility)

## Task Breakdown

### D1. Guided Chart of Accounts Setup [MVP] [DONE]

**Status:** Marked as DONE in roadmap - verify completion

**Verification Tasks:**
- [ ] Verify COA wizard is deployed and functional
- [ ] Test industry template selection
- [ ] Validate plain English explanations present
- [ ] Confirm educational tooltips working
- [ ] Test save and resume functionality
- [ ] Verify celebration message on completion

**Documentation:**
- [ ] Update user documentation with wizard screenshots
- [ ] Verify tutorial content is current
- [ ] Add to feature flag documentation

---

### D2. First Reconciliation Experience - Guided [MVP]

**Backend Tasks:**
- [ ] Implement statement upload endpoint (PDF/CSV)
- [ ] Build PDF text extraction parser
- [ ] Build CSV field mapping engine
- [ ] Create auto-matching algorithm (target >85% accuracy)
- [ ] Implement reconciliation state storage
- [ ] Build discrepancy calculation logic
- [ ] Create reconciliation report generator
- [ ] Add audit logging for reconciliation events

**Frontend Tasks:**
- [ ] Build ReconciliationWizard container component
- [ ] Create educational introduction screen
- [ ] Implement statement upload UI with drag-and-drop
- [ ] Build statement details form (dates, balances)
- [ ] Create auto-matching progress visualization
- [ ] Implement match review interface
- [ ] Build manual matching drag-and-drop UI
- [ ] Create discrepancy helper with troubleshooting suggestions
- [ ] Implement celebration animation for successful reconciliation
- [ ] Build reconciliation summary report view
- [ ] Add save and resume functionality

**Testing:**
- [ ] Unit tests for matching algorithm
- [ ] Integration tests for complete reconciliation flow
- [ ] Test with various bank statement formats
- [ ] UAT: Complete first reconciliation with test data
- [ ] Test discrepancy resolution workflows
- [ ] Verify celebration triggers correctly

**Joy Opportunities:**
- [ ] Implement confetti animation on perfect reconciliation
- [ ] Add encouraging messages throughout wizard
- [ ] DISC-adapt completion messages
- [ ] Track and display reconciliation streaks

---

### D3. Weekly Email Summary Setup [MVP]

**Backend Tasks:**
- [ ] Set up email service provider integration (SendGrid/AWS SES)
- [ ] Implement email template engine
- [ ] Build DISC-adapted content generator
- [ ] Create weekly data aggregation service
- [ ] Implement email scheduling system (cron job)
- [ ] Build magic link token generation and validation
- [ ] Create unsubscribe handler
- [ ] Implement email delivery tracking and retry logic
- [ ] Add email preference storage

**Frontend Tasks:**
- [ ] Build email preferences UI in Settings
- [ ] Create day/time selection interface
- [ ] Implement email content preview component
- [ ] Build DISC variant preview switcher
- [ ] Add enable/disable toggle
- [ ] Create unsubscribe confirmation page
- [ ] Implement email frequency selector (weekly/bi-weekly)

**Email Content:**
- [ ] Write 4 DISC-adapted email templates
- [ ] Create educational tip library (50+ tips)
- [ ] Design HTML email layout (responsive)
- [ ] Write subject line variants per DISC profile
- [ ] Create "Quick Wins" content generator
- [ ] Build "This Week's Tasks" content from checklist
- [ ] Implement "Foundation Tasks" selector

**Testing:**
- [ ] Unit tests for email content generation
- [ ] Test all 4 DISC variants render correctly
- [ ] Test magic link authentication
- [ ] Verify timezone conversion accuracy
- [ ] Test unsubscribe flow
- [ ] Send test emails to various email clients
- [ ] Verify deliverability (SPF, DKIM, DMARC)

**Compliance:**
- [ ] Verify CAN-SPAM Act compliance
- [ ] Ensure GDPR compliance for EU users
- [ ] Add physical mailing address to footer
- [ ] Implement one-click unsubscribe

---

### D4. Tutorial System Framework [MVP]

**Backend Tasks:**
- [ ] Design tutorial definition schema (JSON format)
- [ ] Build tutorial state storage (per user)
- [ ] Implement trigger detection service
- [ ] Create tutorial progress tracking
- [ ] Build analytics tracking for tutorial effectiveness

**Frontend Tasks:**
- [ ] Build TutorialEngine orchestrator
- [ ] Create TutorialOverlay component
- [ ] Implement TutorialTooltip with positioning logic
- [ ] Build TutorialProgress indicator
- [ ] Create TutorialLibrary browser component
- [ ] Implement tutorial step navigation (Next/Back)
- [ ] Build skip confirmation dialog
- [ ] Create "Don't show again" preference UI
- [ ] Implement save and resume functionality
- [ ] Add keyboard navigation support (Tab, Enter, Esc)
- [ ] Build tutorial completion celebration

**Tutorial Content:**
- [ ] Define first 5 core tutorials (JSON):
  - First Invoice
  - First Expense
  - First Reconciliation
  - Chart of Accounts Setup
  - Basic Reports
- [ ] Write tutorial step content (plain English)
- [ ] Create tutorial illustrations/screenshots
- [ ] Test tutorial content on actual UI

**Testing:**
- [ ] Unit tests for tutorial engine logic
- [ ] Test trigger conditions
- [ ] Verify step highlighting works on all target elements
- [ ] Test keyboard navigation
- [ ] Screen reader compatibility testing
- [ ] UAT: Complete each tutorial end-to-end
- [ ] Mobile responsive testing

**Accessibility:**
- [ ] WCAG 2.1 AA compliance verification
- [ ] Screen reader testing (NVDA, JAWS, VoiceOver)
- [ ] Keyboard-only navigation testing
- [ ] High contrast mode testing
- [ ] Focus management validation

---

### D5. Vendor Management - Basic [MVP]

**Backend Tasks:**
- [ ] Verify CONTACTS table schema supports vendor fields
- [ ] Implement vendor CRUD API endpoints
- [ ] Build vendor search/autocomplete endpoint
- [ ] Create vendor spending calculation service
- [ ] Implement soft delete for vendors
- [ ] Add vendor-transaction linkage logic
- [ ] Build vendor export endpoint (for future reports)

**Frontend Tasks:**
- [ ] Build VendorList component with pagination
- [ ] Create VendorListItem row component
- [ ] Implement VendorDetail page
- [ ] Build VendorForm for create/edit
- [ ] Create VendorQuickCreate inline modal
- [ ] Implement VendorSearch with autocomplete
- [ ] Build VendorSpendingSummary widget
- [ ] Add vendor selection to expense entry
- [ ] Implement vendor filter/sort controls
- [ ] Create vendor deletion confirmation dialog

**Integration:**
- [ ] Integrate vendor dropdown in transaction entry
- [ ] Link vendors to expense transactions
- [ ] Auto-populate default category when vendor selected
- [ ] Add vendor field to bill entry (if bills implemented)

**Testing:**
- [ ] Unit tests for vendor validation logic
- [ ] Test vendor spending calculations
- [ ] Integration test: Create vendor → Link to expense
- [ ] Test autocomplete search (fuzzy matching)
- [ ] UAT: Vendor creation and management workflows
- [ ] Test soft delete preserves transaction history

**Joy Opportunities:**
- [ ] First vendor celebration message
- [ ] Vendor milestone celebrations (10, 50, 100 vendors)
- [ ] Spending insights: "Top vendor" badge

---

### D6. Basic Reports - P&L [MVP]

**Backend Tasks:**
- [ ] Build P&L report calculation engine
- [ ] Implement date range filtering
- [ ] Create comparison period logic
- [ ] Build cash vs. accrual basis calculation
- [ ] Implement report caching for performance
- [ ] Create PDF export service (P&L template)
- [ ] Build CSV export for P&L
- [ ] Add report generation audit logging

**Frontend Tasks:**
- [ ] Build ProfitAndLossReport display component
- [ ] Create ReportDateRangePicker component
- [ ] Implement report section collapsible/expandable UI
- [ ] Build ReportExplanations toggle/sidebar
- [ ] Create comparison column display
- [ ] Implement visual profit indicators (green glow)
- [ ] Add export buttons (PDF, CSV, Print)
- [ ] Build mobile-responsive report layout

**Content:**
- [ ] Write plain English explanations for each P&L section
- [ ] Create DISC-adapted profit/loss messages
- [ ] Design professional PDF template
- [ ] Add "What does this mean?" content

**Testing:**
- [ ] Unit tests for P&L calculation accuracy
- [ ] Test date range filtering
- [ ] Verify comparison calculations
- [ ] Test PDF export quality
- [ ] Validate CSV export data integrity
- [ ] UAT: Generate P&L for various periods
- [ ] Verify accuracy against known test data

**Joy Opportunities:**
- [ ] First report celebration
- [ ] Profitable indicator (subtle green glow + message)
- [ ] Revenue milestone recognition
- [ ] Encouraging message if profitable

---

### D7. Basic Reports - Balance Sheet [MVP]

**Backend Tasks:**
- [ ] Build Balance Sheet calculation engine
- [ ] Implement as-of-date balance calculation
- [ ] Create current vs. long-term classification logic
- [ ] Build balance equation validation (Assets = Liabilities + Equity)
- [ ] Implement report caching
- [ ] Create PDF export service (Balance Sheet template)
- [ ] Build CSV export for Balance Sheet
- [ ] Add audit logging

**Frontend Tasks:**
- [ ] Build BalanceSheetReport display component
- [ ] Create as-of-date picker
- [ ] Implement account classification display (current vs. long-term)
- [ ] Build balance verification indicator
- [ ] Add ReportExplanations for Balance Sheet
- [ ] Create export buttons (PDF, CSV, Print)
- [ ] Build mobile-responsive layout
- [ ] Add balance equation visual (Assets = Liabilities + Equity)

**Content:**
- [ ] Write plain English explanations for Balance Sheet sections
- [ ] Explain Assets, Liabilities, Equity concepts
- [ ] Create "financial snapshot" educational content
- [ ] Design professional PDF template

**Testing:**
- [ ] Unit tests for Balance Sheet calculation
- [ ] Verify balance equation always true
- [ ] Test as-of-date calculation accuracy
- [ ] Test current vs. long-term classification
- [ ] PDF export quality verification
- [ ] UAT: Generate Balance Sheet for various dates
- [ ] Mobile responsive testing

---

## Cross-Cutting Tasks

**Documentation:**
- [ ] Update SPEC.md with any new requirements discovered
- [ ] Create user documentation for all Group D features
- [ ] Update developer documentation
- [ ] Create video tutorials for guided experiences
- [ ] Document tutorial creation process for future tutorials

**Analytics & Tracking:**
- [ ] Implement event tracking for wizard completions
- [ ] Track reconciliation completion rates
- [ ] Monitor email open/click rates
- [ ] Track tutorial completion rates
- [ ] Monitor report generation frequency

**Feature Flags:**
- [ ] Create feature flags for all Group D capabilities
- [ ] Implement gradual rollout strategy
- [ ] Configure flag defaults for new vs. existing users

**Performance:**
- [ ] Load testing for report generation (1000+ transactions)
- [ ] Email sending performance testing
- [ ] Vendor autocomplete performance optimization
- [ ] Tutorial overlay rendering optimization

**Security:**
- [ ] Security review of magic link implementation
- [ ] Audit email content for sensitive data exposure
- [ ] Review vendor data encryption
- [ ] Penetration testing for new endpoints

---

## Rollout Strategy

**Phase 1: Foundation (Week 1-2)**
1. Tutorial framework (D4) - enables all other guided experiences
2. Vendor management (D5) - standalone feature

**Phase 2: Reporting (Week 3-4)**
3. Basic Reports - P&L (D6)
4. Basic Reports - Balance Sheet (D7)

**Phase 3: Engagement (Week 5-6)**
5. Weekly Email Summaries (D3) - depends on checklist system
6. Reconciliation Wizard (D2) - depends on transactions

**Phase 4: Verification**
7. Verify COA Wizard (D1) - marked as DONE

---

## Success Criteria

- [ ] 80%+ completion rate for guided COA setup
- [ ] 60%+ users complete first reconciliation within 30 days
- [ ] 70%+ opt-in rate for weekly emails
- [ ] 90%+ users generate first P&L within 7 days
- [ ] All tutorials have >60% completion rate
- [ ] Email open rate >40%
- [ ] Report export usage >50%
- [ ] Zero security vulnerabilities in security review
- [ ] WCAG 2.1 AA compliance for all new UI

---

## Dependencies

**Requires Completed:**
- Group C: Assessment Engine, Checklist System, Phase-based Feature Visibility
- Group B: Chart of Accounts CRUD, Transaction Entry, Message Variant System
- Group A: Database, Encryption, Authentication, UI Component Library

**Enables:**
- Group E: Daily workflows (reconciliation, recurring transactions, bill management)
