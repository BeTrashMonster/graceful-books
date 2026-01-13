# Team Collaboration - Implementation Tasks

**Phase:** 4 - Spreading Your Wings
**Group:** H - Taking Flight
**Dependencies:** Group G (Advanced Accounting)

## Task Breakdown

### H1. Multi-User Support [MVP for teams]

**Backend Tasks:**
- [ ] Design USERS and USER_ROLES tables
- [ ] Implement user invitation API endpoints
- [ ] Build role permission matrix
- [ ] Create permission-based key derivation (ARCH-002)
- [ ] Implement invitation token generation and validation
- [ ] Build user management API (CRUD)
- [ ] Create activity attribution system
- [ ] Implement user slot management (6 total)
- [ ] Build role change workflow
- [ ] Create user suspension/reactivation

**Frontend Tasks:**
- [ ] Build UserManagement page
- [ ] Create InviteUserModal component
- [ ] Implement UserList with role display
- [ ] Build RoleSelector component
- [ ] Create UserActivityFeed widget
- [ ] Implement PendingInvitations management
- [ ] Build UserSlotDisplay (show available slots)
- [ ] Create ChangeRoleModal with warnings
- [ ] Implement RemoveUserModal with confirmation

**Security:**
- [ ] Implement hierarchical key derivation per role
- [ ] Encrypt derived keys with user password
- [ ] Zero plain-text key transmission
- [ ] Automatic key distribution on role change
- [ ] Secure invitation token (time-limited)

**Testing:**
- [ ] Test user invitation flow
- [ ] Verify role permissions enforcement
- [ ] Test key derivation per role
- [ ] UAT: Team onboarding workflow
- [ ] Security audit of multi-user implementation
- [ ] Performance test with 6 concurrent users

**Joy Opportunities:**
- [ ] "Your first teammate! Business is better together."
- [ ] Clear role explanations (no jargon)
- [ ] Celebratory message on team growth

---

### H2. Key Rotation & Access Revocation [MVP for teams]

**Backend Tasks:**
- [ ] Design KEY_ROTATION_LOG table
- [ ] Implement key rotation algorithm (Argon2id)
- [ ] Build user key re-derivation
- [ ] Create session invalidation mechanism
- [ ] Implement access revocation workflow
- [ ] Build active session detection
- [ ] Create distributed notification system
- [ ] Implement rotation audit logging

**Frontend Tasks:**
- [ ] Build KeyRotation admin interface
- [ ] Create RotateKeysModal with confirmation
- [ ] Implement RevokeAccessModal
- [ ] Build ActiveSessionsDisplay
- [ ] Create KeyRotationHistory view
- [ ] Implement rotation progress indicator
- [ ] Build user notification display

**Security:**
- [ ] Zero-downtime key rotation
- [ ] Rotation completes within 60 seconds
- [ ] Access revocation effect <10 seconds
- [ ] Render revoked user data unreadable
- [ ] Immutable rotation audit log

**Testing:**
- [ ] Test key rotation with active users
- [ ] Verify access revocation immediately effective
- [ ] Test session invalidation
- [ ] UAT: Employee offboarding scenario
- [ ] Security audit of rotation mechanism
- [ ] Performance test rotation time

**Joy Opportunities:**
- [ ] "Access updated. Your data remains secure and private."
- [ ] Clear, non-scary security messaging
- [ ] Simple one-click rotation

---

### H3. Approval Workflows (Nice)

**Backend Tasks:**
- [ ] Design APPROVAL_RULES and APPROVAL_HISTORY tables
- [ ] Implement approval rules engine
- [ ] Build workflow state machine
- [ ] Create notification queue for approvals
- [ ] Implement delegation management
- [ ] Build approval/rejection API endpoints
- [ ] Create rule evaluation logic (thresholds, categories)
- [ ] Implement multi-level approval chains
- [ ] Build approval history tracking

**Frontend Tasks:**
- [ ] Build ApprovalWorkflows settings page
- [ ] Create ApprovalRulesBuilder component
- [ ] Implement PendingApprovals dashboard widget
- [ ] Build ApprovalQueue page
- [ ] Create ApproveRejectModal with comments
- [ ] Implement DelegationSettings
- [ ] Build ApprovalHistory view
- [ ] Create RuleTemplate library

**Workflow:**
- [ ] Amount threshold rules
- [ ] Category-based rules
- [ ] Vendor-based rules
- [ ] Sequential approval chains
- [ ] Parallel approval (all must approve)
- [ ] Escalation on overdue

**Testing:**
- [ ] Test approval rule evaluation
- [ ] Verify notification delivery
- [ ] Test delegation workflow
- [ ] UAT: Expense approval workflow
- [ ] Performance test with 100+ pending approvals

**Joy Opportunities:**
- [ ] "Marcus approved your expense report!"
- [ ] "Trust, but verify" messaging
- [ ] Batch approval for efficiency

---

### H4. Client Portal (Nice)

**Backend Tasks:**
- [ ] Design PORTAL_TOKENS table
- [ ] Implement portal token generation
- [ ] Build token validation and expiration
- [ ] Create customer-scoped data access
- [ ] Implement portal invoice API
- [ ] Build payment integration hooks
- [ ] Create portal analytics tracking

**Frontend Tasks:**
- [ ] Build ClientPortal static pages
- [ ] Create PortalInvoiceView component
- [ ] Implement PortalInvoiceList
- [ ] Build PortalLinkGenerator (admin)
- [ ] Create PaymentButton placeholder
- [ ] Implement mobile-responsive portal design
- [ ] Build PortalSettings (enable/disable)
- [ ] Create portal branding customization

**Portal Features:**
- [ ] Unique secure URL per customer
- [ ] Invoice PDF download
- [ ] Print-friendly invoice view
- [ ] Invoice history for customer
- [ ] Total outstanding balance

**Testing:**
- [ ] Test portal token security
- [ ] Verify customer data isolation
- [ ] Test mobile responsiveness
- [ ] UAT: Customer portal experience
- [ ] Load test portal with 1000+ customers
- [ ] Accessibility test (WCAG 2.1 AA)

**Joy Opportunities:**
- [ ] "Give your customers a professional portal"
- [ ] Clean, branded customer experience
- [ ] Simple "share link" action

---

### H5. Multi-Currency - Basic (Nice)

**Backend Tasks:**
- [ ] Design CURRENCIES and EXCHANGE_RATES tables
- [ ] Implement currency CRUD API
- [ ] Build exchange rate management
- [ ] Create conversion calculation engine
- [ ] Implement transaction foreign currency fields
- [ ] Build home currency conversion
- [ ] Create multi-currency reports (basic)
- [ ] Implement rate history tracking

**Frontend Tasks:**
- [ ] Build CurrencySetup page
- [ ] Create CurrencyForm component
- [ ] Implement ExchangeRateEntry interface
- [ ] Build ForeignCurrencySelector (transaction form)
- [ ] Create CurrencyDisplay component (dual amounts)
- [ ] Implement RateHistory view
- [ ] Build multi-currency report filters

**Conversion:**
- [ ] Manual exchange rate entry
- [ ] Effective date for rates
- [ ] Apply correct rate based on transaction date
- [ ] Display both foreign and home amounts
- [ ] Audit trail of conversions

**Testing:**
- [ ] Test conversion accuracy
- [ ] Verify rate history application
- [ ] Test reporting in home currency
- [ ] UAT: International transaction workflow
- [ ] Performance test with multiple currencies

**Joy Opportunities:**
- [ ] "Going global! Multi-currency lets you work anywhere."
- [ ] Currency flags/symbols for visual recognition
- [ ] Clear dual-amount display

---

### H6. Advanced Inventory (Nice)

**Backend Tasks:**
- [ ] Extend INVENTORY_TRANSACTIONS with lot/layer tracking
- [ ] Implement FIFO calculation engine
- [ ] Build LIFO calculation engine
- [ ] Create weighted average calculation engine
- [ ] Implement method selection per product
- [ ] Build COGS posting automation
- [ ] Create inventory valuation report
- [ ] Implement stock take variance calculation
- [ ] Build adjustment audit trail

**Frontend Tasks:**
- [ ] Build InventoryMethodSelector (product settings)
- [ ] Create ValuationMethodComparison report
- [ ] Implement StockTake interface
- [ ] Build VarianceReport component
- [ ] Create InventoryAdjustmentForm with reason
- [ ] Implement COGSDetail view
- [ ] Build MethodChangeWarning modal

**Valuation Methods:**
- [ ] FIFO: Track lots, sell oldest first
- [ ] LIFO: Track layers, sell newest first
- [ ] Weighted Average: Calculate average cost
- [ ] Method comparison visualization
- [ ] Warning on method changes

**Testing:**
- [ ] Test FIFO calculation accuracy
- [ ] Test LIFO calculation accuracy
- [ ] Test weighted average calculation
- [ ] Verify COGS posting correctness
- [ ] UAT: Inventory valuation workflow
- [ ] Performance test with 10,000+ SKUs

**Joy Opportunities:**
- [ ] "Level up your inventory! FIFO, LIFO, weighted average"
- [ ] Visual method comparison
- [ ] Profitability insights by method

---

### H7. Interest Split Prompt System (Nice)

**Backend Tasks:**
- [ ] Implement liability payment detection
- [ ] Build split prompt trigger logic
- [ ] Create journal entry generation for split
- [ ] Implement user preference storage (disable prompts)
- [ ] Build checklist integration for "later"
- [ ] Create educational content storage

**Frontend Tasks:**
- [ ] Build InterestSplitPrompt modal
- [ ] Create SplitWorkflow guided interface
- [ ] Implement AmountSplitCalculator
- [ ] Build JournalEntryPreview for split
- [ ] Create PromptSettings (disable per loan)
- [ ] Implement EducationalTooltips
- [ ] Build ChecklistIntegration reminder

**Workflow:**
- [ ] Detect loan payment
- [ ] Trigger prompt (if enabled)
- [ ] Guide user to split principal and interest
- [ ] Auto-generate journal entry
- [ ] Preview before posting
- [ ] Add to checklist if "Not now"

**Testing:**
- [ ] Test payment detection accuracy
- [ ] Verify split calculation
- [ ] Test journal entry generation
- [ ] UAT: Loan payment workflow
- [ ] Test checklist integration

**Joy Opportunities:**
- [ ] "This looks like a loan payment. Should we split out the interest?"
- [ ] Educational content about tax deductibility
- [ ] "Not now" option with checklist reminder

---

### H8. Sync Relay - Hosted [MVP]

**Backend Tasks:**
- [ ] Implement relay server (Go/Rust)
- [ ] Build zero-knowledge relay protocol (ARCH-003)
- [ ] Create health check endpoints
- [ ] Implement geographic routing
- [ ] Build load balancing
- [ ] Create monitoring integration (Prometheus)
- [ ] Implement SLA tracking
- [ ] Build automatic failover

**Infrastructure:**
- [ ] Deploy relay to multiple regions (US, EU, Asia)
- [ ] Configure DNS-based routing
- [ ] Set up load balancers
- [ ] Implement DDoS protection
- [ ] Create public status page
- [ ] Configure alerts and monitoring

**Client Integration:**
- [ ] Implement region selection in client
- [ ] Build automatic best-region detection
- [ ] Create latency estimation
- [ ] Implement relay failover in client
- [ ] Build connection status display

**Testing:**
- [ ] Load test with 1000+ concurrent users
- [ ] Verify zero-knowledge compliance
- [ ] Test geographic routing
- [ ] Verify <200ms latency (same region)
- [ ] Test failover mechanism
- [ ] SLA compliance testing (99.9% uptime)

**Joy Opportunities:**
- [ ] "Your data travels with you"
- [ ] Calm sync indicator (no spinners)
- [ ] Region selection with latency estimates

---

### H9. Sync Relay - Self-Hosted Documentation (Nice)

**Backend Tasks:**
- [ ] Package relay server as Docker image
- [ ] Create binary builds (Linux, Windows, macOS)
- [ ] Implement configuration via environment variables
- [ ] Build health check endpoints
- [ ] Create Prometheus metrics endpoint

**Documentation:**
- [ ] Write installation guide
- [ ] Document hardware requirements
- [ ] Create network configuration guide
- [ ] Document TLS certificate setup
- [ ] Write firewall rules guide
- [ ] Create Docker Compose example
- [ ] Document performance tuning
- [ ] Write troubleshooting guide

**Deployment:**
- [ ] Create Docker Compose file
- [ ] Build binaries for all platforms
- [ ] Create installation scripts
- [ ] Build configuration examples
- [ ] Create health check monitoring examples

**Testing:**
- [ ] Test Docker deployment
- [ ] Test binary deployment on all platforms
- [ ] Verify configuration options
- [ ] UAT: Self-hosted relay setup
- [ ] Verify feature parity with hosted relay

**Joy Opportunities:**
- [ ] "Full control. Your data on your servers."
- [ ] Simple one-command Docker deployment
- [ ] Clear documentation with examples

---

## Cross-Cutting Tasks

**Infrastructure:**
- [ ] Set up multi-region relay infrastructure
- [ ] Implement approval notification system
- [ ] Create portal subdomain routing
- [ ] Build multi-currency conversion engine
- [ ] Optimize inventory calculation performance

**Analytics & Tracking:**
- [ ] Track multi-user adoption
- [ ] Monitor key rotation usage
- [ ] Track approval workflow adoption
- [ ] Monitor client portal usage
- [ ] Track multi-currency adoption
- [ ] Monitor relay performance and latency

**Feature Flags:**
- [ ] `multi-user` flag
- [ ] `key-rotation` flag
- [ ] `approval-workflows` flag
- [ ] `client-portal` flag
- [ ] `multi-currency-basic` flag
- [ ] `inventory-advanced` flag
- [ ] `interest-split` flag
- [ ] `sync-relay-hosted` flag (default)
- [ ] `sync-relay-self-hosted` flag

**Performance:**
- [ ] Load testing for multi-user (6 concurrent)
- [ ] Sync relay latency optimization
- [ ] Client portal load testing
- [ ] Inventory calculation optimization (10,000+ SKUs)
- [ ] Key rotation performance testing

**Documentation:**
- [ ] Update user documentation for H1-H9
- [ ] Create multi-user setup guide
- [ ] Document approval workflows
- [ ] Create client portal setup guide
- [ ] Document multi-currency setup
- [ ] Create advanced inventory guide
- [ ] Document self-hosted relay deployment

---

## Rollout Strategy

**Week 1: Sync Infrastructure**
1. Sync Relay - Hosted (H8)
2. Sync Relay - Self-Hosted Documentation (H9)

**Week 2: Team Features**
3. Multi-User Support (H1)
4. Key Rotation & Access Revocation (H2)

**Week 3: Client and Currency**
5. Client Portal (H4)
6. Multi-Currency - Basic (H5)

**Week 4: Inventory**
7. Advanced Inventory (H6)

**Week 5: Workflows and Prompts**
8. Approval Workflows (H3)
9. Interest Split Prompt System (H7)

---

## Success Criteria

- [ ] 40%+ of growing businesses add team members
- [ ] 60%+ of teams use role-based permissions
- [ ] 30%+ of businesses enable multi-currency
- [ ] 50%+ of product businesses use advanced inventory
- [ ] 25%+ of businesses enable client portal
- [ ] 35%+ of teams implement approval workflows
- [ ] Sync relay: <200ms latency (same region)
- [ ] Sync relay: 99.9% uptime
- [ ] Key rotation: <60 seconds completion
- [ ] Access revocation: <10 seconds effect
- [ ] Zero COGS calculation errors
- [ ] WCAG 2.1 AA compliance maintained

---

## Dependencies

**Requires Completed:**
- Group G: Advanced Accounting (reports, inventory, tax, OCR)
- Group F: Core Workflows
- Infrastructure: Relay servers, notification system

**Enables:**
- Phase 5: Advanced collaboration features (CRDT, activity feeds, comments)
- Full multi-currency with gain/loss (I4)
- Real-time collaboration (I1-I3)
- Visionary features (Phase 5)
