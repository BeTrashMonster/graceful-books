# Team Collaboration (Phase 4 - Group H: Taking Flight)

## Why This Change

This change introduces team collaboration and advanced features for growing businesses. After mastering advanced accounting capabilities in Group G, businesses need multi-user support, enhanced security, client portals, multi-currency basics, advanced inventory management, and managed sync infrastructure to support team growth and business scaling.

**Dependencies:** Requires Group G completion
- Custom Reports Builder (G1)
- Product/Service Catalog (G2)
- Basic Inventory Tracking (G3)
- Sales Tax - Basic (G4)
- Receipt OCR Processing (G5)
- Bill OCR Processing (G6)
- 1099 Tracking (G7)

**Target Users:**
- Growing businesses adding team members
- Businesses needing role-based access control
- Companies working with international clients/vendors
- Product businesses needing advanced inventory valuation
- Businesses offering client self-service portals
- Teams requiring approval workflows
- Businesses managing loan payments

**Success Metrics:**
- 40%+ of growing businesses add team members
- 60%+ of teams use role-based permissions
- 30%+ of businesses enable multi-currency
- 50%+ of product businesses use advanced inventory
- 25%+ of businesses enable client portal
- 35%+ of teams implement approval workflows

## Roadmap Reference

**Phase:** Phase 4: The Soaring Flight
**Group:** Group H - Taking Flight
**Roadmap Items:** H1-H9 (Multi-User Support, Key Rotation & Access Revocation, Approval Workflows, Client Portal, Multi-Currency - Basic, Advanced Inventory, Interest Split Prompt System, Sync Relay - Hosted, Sync Relay - Self-Hosted Documentation)
**Roadmap Location:** [Roadmaps/ROADMAP.md - Phase 4, Group H](../../Roadmaps/ROADMAP.md#phase-4-the-soaring-flight---group-h-taking-flight)
**Priority:** MVP (H1, H2, H8); Nice-to-have (H3, H4, H5, H6, H7, H9)

## What Changes

This proposal introduces nine items focused on team collaboration and advanced features:

### Group H Items (H1-H9):

**H1. Multi-User Support** [MVP for teams]
- Invite team members with role-based access
- User invitation system
- Role definitions (Admin, Manager, Bookkeeper, View-Only)
- Permission-based key derivation
- Activity visibility by role
- User management interface
- Team member slots (6 total: 1 Admin, 2 flexible Manager/User, 1 Consultant, 2 Accountants)

**H2. Key Rotation & Access Revocation** [MVP for teams]
- Rotate encryption keys instantly
- Instant access revocation
- Active session handling
- Audit logging of key changes
- User notification on access changes
- Cryptographically secure revocation

**H3. Approval Workflows** (Nice)
- Require approval for bills, expenses, or large transactions
- Configure approval rules (amount thresholds, categories)
- Approval notifications
- Approve/reject interface
- Approval history tracking
- Delegation options
- Multi-level approvals

**H4. Client Portal** (Nice)
- Customers view and pay invoices online
- Unique portal links per customer
- Invoice view (no account required)
- Payment integration readiness
- Invoice history
- Simple, professional design
- Mobile-responsive portal

**H5. Multi-Currency - Basic** (Nice)
- Handle transactions in foreign currencies
- Currency setup and management
- Exchange rates (manual entry)
- Transaction in foreign currency
- Conversion to home currency
- Currency display on transactions
- Multi-currency reporting (basic)

**H6. Advanced Inventory** (Nice)
- Full inventory with multiple valuation methods
- FIFO (First In, First Out)
- LIFO (Last In, First Out)
- Weighted Average
- Inventory valuation reports
- COGS calculation with chosen method
- Stock take functionality
- Inventory adjustments with audit trail

**H7. Interest Split Prompt System** (Nice)
- Prompt to split principal and interest on loan payments
- Liability payment detection
- Split workflow with guidance
- Journal entry generation
- Checklist integration for "later"
- Settings to disable prompts
- Educational content about tax deductibility

**H8. Sync Relay - Hosted** [MVP]
- Managed sync relay service for multi-device access
- Production relay deployment
- Geographic distribution (reduced latency)
- Health monitoring and SLA tracking
- User region selection
- 99.9% uptime target
- <200ms sync latency (same region)

**H9. Sync Relay - Self-Hosted Documentation** (Nice)
- Enable users to run their own sync relay
- Docker container for deployment
- Binary builds for multiple platforms
- Setup documentation
- Configuration guide
- Health check endpoints
- No feature limitations vs. hosted

## Capabilities

### New Capabilities

#### `multi-user`
**Purpose:** Team member invitation and role-based access control

**Features:**
- **User Invitation:**
  - Email-based invitation system
  - Invitation link generation
  - Invitation expiration
  - Pending invitation management
  - Resend invitations
  - Role assignment on invite
- **Role Definitions:**
  - Admin: Full access, user management, key rotation
  - Manager: Most operations, limited admin functions
  - Bookkeeper: Transaction entry, reconciliation, reporting
  - View-Only: Read-only access to reports and data
  - Consultant: Temporary view-only access
  - Accountant: Full read, limited write (2 slots)
- **Permission-Based Key Derivation:**
  - Each role receives appropriate encryption key
  - Keys derived from master key
  - Encrypted with user's password
  - No plain-text key transmission
  - Automatic key distribution on role change
- **Activity Visibility:**
  - Audit log filtered by role
  - See team member actions
  - Transaction history with user attribution
  - Dashboard activity feed
- **User Management:**
  - Add/remove team members
  - Change roles
  - Suspend/reactivate users
  - User activity dashboard
  - Slot management (6 total slots)

**Technical Approach:**
- Hierarchical key derivation (ARCH-002)
- Role-permission matrix
- User table with role and status
- Invitation token system
- Activity attribution on all entities

#### `key-rotation`
**Purpose:** Security key management and instant access revocation

**Features:**
- **Key Rotation Mechanism:**
  - Admin-initiated key rotation
  - Generate new master key
  - Derive new user keys
  - Distribute to active users
  - Complete within 60 seconds
  - Zero-downtime rotation
- **Instant Access Revocation:**
  - Remove user from key derivation
  - Invalidate user sessions
  - Render local data unreadable
  - Immediate effect (<10 seconds)
  - Audit trail of revocation
- **Active Session Handling:**
  - Detect active sessions
  - Force re-authentication
  - Clear local caches
  - Notification of key change
  - Automatic re-key on next sync
- **Audit Logging:**
  - Log all key rotations
  - Log all access revocations
  - Timestamp and initiator
  - Reason for change (optional)
  - Cannot be modified
- **User Notification:**
  - Email on key rotation
  - In-app notification
  - "You've been removed" message (revoked users)
  - "Security update" message (active users)

**Technical Approach:**
- Key rotation algorithm (Argon2id re-derivation)
- Session invalidation mechanism
- Distributed notification system
- Audit log integration

#### `approval-workflows`
**Purpose:** Bill and expense approval system for team oversight

**Features:**
- **Approval Rules Configuration:**
  - Amount thresholds (e.g., >$500 requires approval)
  - Category-based rules
  - Vendor-based rules
  - Approver assignment
  - Multi-level approval chains
  - Rule priority and order
- **Approval Notifications:**
  - Email notifications to approvers
  - Dashboard pending approval widget
  - Mobile notifications (future)
  - Reminder escalation
  - Overdue approval alerts
- **Approve/Reject Interface:**
  - Pending approval queue
  - Single-click approve/reject
  - Approval with comments
  - Batch approval
  - View full transaction details
  - Audit trail visibility
- **Approval History:**
  - All approvals tracked
  - Approver and timestamp
  - Approval comments
  - Status changes logged
  - Cannot be modified
- **Delegation Options:**
  - Temporary delegation to other approvers
  - Out-of-office delegation
  - Delegation time limits
  - Delegation notification
- **Multi-Level Approvals:**
  - Sequential approval chains
  - Parallel approval (all must approve)
  - Conditional routing
  - Escalation rules

**Technical Approach:**
- Approval rules engine
- Workflow state machine
- Notification queue system
- Delegation management
- Integration with transactions and bills

#### `client-portal`
**Purpose:** Customer invoice portal for self-service access

**Features:**
- **Unique Portal Links:**
  - Per-customer unique URLs
  - Secure token-based access
  - No account required
  - Token expiration options
  - Link regeneration capability
- **Invoice View:**
  - Clean, professional invoice display
  - PDF download
  - Print-friendly format
  - Mobile-responsive design
  - Branding from invoice template
- **Payment Integration Readiness:**
  - "Pay Now" button placeholder
  - Integration hooks for payment processors
  - Payment confirmation page
  - Receipt generation (future)
- **Invoice History:**
  - All invoices for customer
  - Filter by status (paid, unpaid, overdue)
  - Search by invoice number
  - Date sorting
  - Total outstanding balance
- **Simple, Professional Design:**
  - Clean, minimal interface
  - Customer-facing branding
  - WCAG 2.1 AA compliant
  - Fast loading
  - Secure (HTTPS only)

**Technical Approach:**
- Portal token generation and validation
- Customer-scoped data access
- Static portal pages (minimal JS)
- Payment processor webhook readiness
- Portal analytics (views, downloads)

#### `multi-currency-basic`
**Purpose:** Basic foreign currency support for international transactions

**Features:**
- **Currency Setup:**
  - Add currencies (USD, EUR, GBP, etc.)
  - Currency name and symbol
  - Set home currency
  - Active/inactive currencies
  - ISO 4217 currency codes
- **Exchange Rates (Manual Entry):**
  - Enter exchange rates manually
  - Effective date for rates
  - Rate history tracking
  - Rate change notifications
  - Apply correct rate based on transaction date
- **Transaction in Foreign Currency:**
  - Record transactions in foreign currency
  - Display both foreign and home amounts
  - Automatic conversion using rate
  - Override conversion if needed
  - Foreign currency on invoices and bills
- **Conversion to Home Currency:**
  - Automatic conversion for reporting
  - Home currency financial statements
  - Conversion displayed on transactions
  - Audit trail of conversions
- **Currency Display:**
  - Show both currencies on transaction
  - Currency symbol display
  - Formatted amounts per locale
  - Clear labeling (USD vs. EUR)
- **Multi-Currency Reporting (Basic):**
  - Reports in home currency (converted)
  - Foreign currency detail available
  - Conversion rates shown
  - No realized/unrealized gain/loss (basic mode)

**Technical Approach:**
- Currency table with rates
- Exchange rate history table
- Conversion calculation engine
- Transaction foreign currency fields
- Report aggregation in home currency

**Note:** Full multi-currency with automatic rates and gain/loss is Group I (I4).

#### `inventory-advanced`
**Purpose:** Full inventory management with FIFO/LIFO/weighted average costing

**Features:**
- **Valuation Method Selection:**
  - FIFO (First In, First Out)
  - LIFO (Last In, First Out)
  - Weighted Average
  - Method selection per product or globally
  - Warning on method changes
  - Historical method tracking
- **FIFO Calculation:**
  - Track individual purchase lots
  - Sell oldest inventory first
  - Lot-level COGS calculation
  - Remaining lot tracking
  - Accurate COGS per sale
- **LIFO Calculation:**
  - Track purchase layers
  - Sell newest inventory first
  - Layer-level COGS calculation
  - Layer depletion tracking
  - Accurate COGS per sale
- **Weighted Average Calculation:**
  - Calculate average cost on hand
  - Update average on each purchase
  - COGS at average cost
  - Simpler than FIFO/LIFO
  - Smooth cost fluctuations
- **Inventory Valuation Reports:**
  - Total inventory value by method
  - Method comparison report
  - Valuation by product
  - Valuation trend over time
  - Impact of method choice visualization
- **COGS Calculation:**
  - Automatic COGS posting on sale
  - Accurate COGS per method
  - COGS detail on transaction
  - COGS summary reports
  - Profitability analysis
- **Stock Take Functionality:**
  - Physical count entry
  - Compare physical to system
  - Adjustment generation
  - Variance reporting
  - Approval workflow for adjustments
- **Inventory Adjustments with Audit Trail:**
  - Adjustment reasons required
  - Before/after quantities
  - Adjustment value impact
  - User and timestamp
  - Cannot be deleted (immutable)

**Technical Approach:**
- Extends inventory-basic (G3)
- Lot/layer tracking tables
- Valuation calculation engines
- COGS posting automation
- Adjustment audit log
- Performance optimization for large inventories

#### `interest-split`
**Purpose:** Loan payment principal/interest split prompts

**Features:**
- **Liability Payment Detection:**
  - Detect payments to liability accounts
  - Identify loan accounts
  - Trigger split prompt
  - Frequency controls (don't ask every time)
- **Split Workflow:**
  - Guided split interface
  - Enter principal amount
  - Enter interest amount
  - Auto-calculate split if total known
  - Validation (principal + interest = total)
  - Educational tooltips
- **Journal Entry Generation:**
  - Create split journal entry automatically
  - Debit: Loan Principal (liability reduction)
  - Debit: Interest Expense
  - Credit: Cash (payment)
  - Preview before posting
  - Edit capability
- **Checklist Integration:**
  - "Not now" adds to checklist
  - Reminder to split later
  - Link to transaction
  - Clear from checklist on completion
- **Settings to Disable:**
  - Turn off prompts globally
  - Disable per loan account
  - "Don't ask again for this loan"
  - Re-enable in settings
- **Educational Content:**
  - Why split principal and interest
  - Tax deductibility explanation
  - Impact on financial statements
  - Links to IRS guidance (US)

**Technical Approach:**
- Transaction pattern detection
- Prompt trigger system
- Journal entry wizard
- Checklist integration
- User preference storage

#### `sync-relay-hosted`
**Purpose:** Managed sync infrastructure for multi-device access

**Features:**
- **Production Relay Deployment:**
  - Cloud-hosted relay servers
  - Redundant infrastructure
  - Automatic failover
  - Load balancing
  - DDoS protection
- **Geographic Distribution:**
  - Multiple regions (US, EU, Asia)
  - Region selection by user
  - Automatic region routing
  - Reduced latency via proximity
  - Data residency compliance
- **Health Monitoring:**
  - Real-time relay health checks
  - Uptime monitoring
  - Performance metrics
  - Error rate tracking
  - Automatic alerts
- **SLA Tracking:**
  - 99.9% uptime target
  - Latency targets (<200ms same region)
  - Public status page
  - Incident reporting
  - Downtime credits (if applicable)
- **User Region Selection:**
  - Choose preferred region
  - Display latency estimates
  - Manual override
  - Automatic best-region suggestion

**Technical Approach:**
- Multi-region relay deployment
- Health check endpoints
- Monitoring infrastructure (Prometheus, Grafana)
- Geographic routing (DNS-based)
- Zero-knowledge relay protocol (ARCH-003)

#### `sync-relay-self-hosted`
**Purpose:** Self-hosted sync relay deployment option

**Features:**
- **Docker Container:**
  - Official Docker image
  - Docker Compose configuration
  - Environment variable configuration
  - Volume mounting for data
  - Automatic updates
- **Binary Builds:**
  - Linux (x64, ARM)
  - Windows (x64)
  - macOS (Intel, ARM)
  - Minimal dependencies
  - Single binary deployment
- **Setup Documentation:**
  - Step-by-step installation guide
  - Hardware requirements
  - Network configuration
  - TLS certificate setup
  - Firewall rules
- **Configuration Guide:**
  - Environment variables reference
  - Port configuration
  - Storage configuration
  - Logging configuration
  - Performance tuning
- **Health Check Endpoints:**
  - `/health` endpoint
  - `/metrics` for monitoring
  - `/status` for diagnostics
  - Prometheus-compatible metrics
- **No Feature Limitations:**
  - Full parity with hosted relay
  - Same protocol support
  - All client features work
  - No vendor lock-in

**Technical Approach:**
- Relay server implementation (Go or Rust)
- Docker packaging
- Cross-platform builds
- Documentation generation
- Self-hosted relay registration

## Impact

### User Experience
- **Team Collaboration:** Multi-user support enables growing teams
- **Security:** Key rotation provides instant access revocation
- **Client Experience:** Professional portal improves customer satisfaction
- **Global Business:** Multi-currency basics enable international transactions
- **Approval Control:** Workflows provide oversight for spending
- **Inventory Accuracy:** Advanced methods ensure accurate COGS
- **Loan Management:** Interest split simplifies loan accounting
- **Reliable Sync:** Hosted relay ensures consistent multi-device experience
- **Data Control:** Self-hosted option for privacy-conscious users

### Technical
- **Team Infrastructure:** Foundation for real-time collaboration (Phase 5)
- **Security Foundation:** Key management for enterprise features
- **Payment Gateway Readiness:** Client portal hooks for payment integration
- **Multi-Currency Engine:** Enables full multi-currency (Group I)
- **Workflow Engine:** Approval system extensible to other workflows
- **Advanced Inventory:** Supports manufacturing and complex scenarios
- **Sync Reliability:** Production-grade sync infrastructure
- **Deployment Flexibility:** Self-hosted option reduces vendor lock-in

### Business
- **Team Market:** Team features address growing business segment
- **Enterprise Readiness:** Security features appeal to enterprise buyers
- **International Expansion:** Multi-currency enables global market
- **Premium Features:** Advanced capabilities justify higher pricing tiers
- **Self-Hosted Revenue:** Optional support plans for self-hosted users
- **Compliance:** Approval workflows reduce financial risk

## Migration Plan

### Data Migration

**Multi-User:**
- New USERS and USER_ROLES tables
- Existing single user becomes Admin
- No backward compatibility issues

**Key Rotation:**
- New KEY_ROTATION_LOG table
- Initial master key remains
- Rotation is optional feature

**Approval Workflows:**
- New APPROVAL_RULES and APPROVAL_HISTORY tables
- Existing transactions unaffected
- Rules apply to new transactions only

**Client Portal:**
- New PORTAL_TOKENS table
- Existing invoices immediately available in portal
- No data migration needed

**Multi-Currency:**
- New CURRENCIES and EXCHANGE_RATES tables
- Existing transactions remain in home currency
- New transactions can use foreign currency

**Advanced Inventory:**
- Extends existing inventory tables (G3)
- Add METHOD field to products
- Migrate G3 data to chosen method (weighted average default)
- Historical COGS remains unchanged

**Interest Split:**
- No new tables
- Uses existing journal entry system
- Prompt triggers added to liability payments

**Sync Relay:**
- No data migration
- Relay URL configuration change
- Client automatically connects to new relay

### Feature Flags

**New Flags:**
- `multi-user`: Enable team member invitation
- `key-rotation`: Enable key rotation and revocation
- `approval-workflows`: Enable approval workflows
- `client-portal`: Enable customer portal
- `multi-currency-basic`: Enable basic multi-currency
- `inventory-advanced`: Enable advanced inventory methods
- `interest-split`: Enable interest split prompts
- `sync-relay-hosted`: Enable managed relay (default)
- `sync-relay-self-hosted`: Enable self-hosted relay option

**Rollout Strategy:**
1. **Week 1:** Deploy sync relay infrastructure (H8, H9)
2. **Week 2:** Deploy multi-user support (H1, H2)
3. **Week 3:** Deploy client portal (H4) and multi-currency (H5)
4. **Week 4:** Deploy advanced inventory (H6)
5. **Week 5:** Deploy approval workflows (H3) and interest split (H7)

**User Communication:**
- Feature announcements via email
- In-app tours for multi-user and approvals
- Blog posts about team features
- Webinars for advanced inventory and multi-currency
- Video tutorials for client portal setup
- Documentation for self-hosted relay

### Rollback Plan

All capabilities are additive with feature flags:
- Disable feature flag to hide capability
- No data loss on rollback
- Multi-user: existing users remain, invitations disabled
- Sync: automatic fallback to previous relay
- Users notified if feature temporarily disabled
- Re-enable when issue resolved

### Testing Requirements

**Before Production:**
- [ ] All unit tests passing (>90% coverage)
- [ ] Integration tests for each capability
- [ ] UAT with team-based businesses (H1-H3)
- [ ] UAT with international businesses (H5)
- [ ] UAT with product businesses (H6)
- [ ] Security audit for multi-user and key rotation
- [ ] Load testing for sync relay (1000+ concurrent users)
- [ ] Self-hosted relay deployment testing
- [ ] Performance testing with 6 concurrent users
- [ ] Accessibility testing (WCAG 2.1 AA)

## Success Criteria

### Adoption Metrics
- 40%+ of growing businesses add team members
- 60%+ of teams use role-based permissions
- 30%+ of businesses enable multi-currency
- 50%+ of product businesses use advanced inventory
- 25%+ of businesses enable client portal
- 35%+ of teams implement approval workflows
- 80%+ use hosted relay (vs. self-hosted)

### Performance Metrics
- Sync relay: <200ms latency (same region)
- Sync relay: 99.9% uptime
- Key rotation: <60 seconds completion
- Access revocation: <10 seconds effect
- Client portal: <2 second load time
- Multi-user: supports 6 concurrent users smoothly
- Inventory calculation: <1 second for 10,000+ SKUs

### Quality Metrics
- Zero key rotation failures
- Zero access revocation failures
- 100% uptime for hosted relay (SLA)
- Zero multi-currency conversion errors
- Zero COGS calculation errors (FIFO/LIFO/Weighted Avg)
- >4.5 ease-of-use rating for team features

### Business Impact
- 50% increase in team plan subscriptions
- 30% increase in international user adoption
- 40% reduction in access revocation time
- 35% increase in customer payment speed (portal)
- 25% increase in advanced inventory tier upgrades
- 20% self-hosted relay adoption among enterprise users
