# Infrastructure Capstone - Foundation for Group J

## Why This Change

The Infrastructure Capstone completes the remaining Group I UI components and builds critical infrastructure required for Group J moonshot features. This change acts as a bridge between Group I's advanced collaboration backend and Group J's visionary features.

**Dependencies:** Requires Group I completion
- CRDT Conflict Resolution (I1) - Backend complete, UI needed
- Activity Feed (I2) - Backend complete, UI needed
- Comments on Transactions (I3) - Complete
- Multi-Currency - Full (I4) - Complete
- Barter/Trade Transactions (I5) - Complete
- Scheduled Report Delivery (I6) - Complete

**Target Users:**
- All users benefiting from complete Group I UI experience
- Advisors/accountants requiring billing infrastructure for J7 (Advisor Portal)
- Platform administrators managing charity partnerships
- Users receiving transactional emails for key actions

**Success Metrics:**
- IC1: 100% of CRDT and Activity Feed features have functional UI
- IC2: Billing system handles advisor subscriptions with accurate tiered pricing
- IC3: Admin panel allows charity management with proper role-based access control
- IC4: Email delivery system achieves >95% deliverability rate
- IC5: 100% of OpenSpec files match current ROADMAP vision (zero stale documentation)
- IC6: All validation gates pass before Group J begins

## Roadmap Reference

**Phase:** Infrastructure Capstone (Bridge between Phase 4 and Phase 5)
**Group:** Infrastructure Capstone - Foundation for Group J
**Roadmap Items:** IC0-IC6 (Group I Backend Validation, Complete Group I UI, Billing Infrastructure, Admin Panel, Email Service, OpenSpec Sync, Final Validation)
**Roadmap Location:** [Roadmaps/ROADMAP.md - Infrastructure Capstone](../../Roadmaps/ROADMAP.md#infrastructure-capstone---foundation-for-group-j)
**Priority:** MVP/Mandatory (All items IC0-IC6)

## What Changes

This proposal introduces six infrastructure components required before Group J development:

### IC0. Group I Backend Validation [GATE] [MANDATORY]
Verify that Group I backend implementations (I1 CRDT, I2 Activity Feed) are 100% complete and operational before beginning Infrastructure Capstone work. This validation gate ensures the foundation is solid before UI work begins.

**What Needs Validation:**
- I1 (CRDT Conflict Resolution) Backend: ConflictResolutionService, CRDT merge algorithms, conflict storage schema, all tests passing
- I2 (Activity Feed & Communication) Backend: CommentsService, mentions service, activity feed tracking, notification schema, all tests passing
- Integration validation: Comment on conflicted transaction, no console errors
- Documentation validation: JSDoc comments, implementation summaries exist

**Gate Pass Criteria:**
- ALL I1 backend tests passing (100%)
- ALL I2 backend tests passing (100%)
- Manual smoke tests successful
- No blocking bugs or missing schema tables

### IC1. Complete Group I UI Components [MVP] [MANDATORY]
Finish the user-facing interfaces for I1 (CRDT) and I2 (Activity Feed) so Group J features can build on top of them.

**What Needs Building:**

**I1 (CRDT) UI Components:**
- Conflict notification badge (shows unresolved conflicts count)
- Conflict resolution modal (side-by-side diff view, merge strategy selection)
- Conflict history drawer (90-day audit trail)
- Steadiness-style messaging ("We found 2 versions of this transaction. Which should we keep?")

**I2 (Activity Feed) UI Components:**
- Comment thread component (nested replies, threading support)
- Notification bell (unread count, priority indicators)
- Mention input (@username autocomplete with fuzzy search)
- Notification preferences panel (per-type opt-in/out, digest settings)
- Activity feed widget (recent comments, @mentions, updates)

**External Dependencies:**
- Libraries: @tiptap/react (rich text editor for comments), fuse.js (mention autocomplete)

### IC2. Billing Infrastructure [MVP] [MANDATORY]
Build subscription and billing management system to support J7 (Advisor Portal) business model with tiered pricing, charity contributions, and client billing lifecycle.

**What Needs Building:**
- Stripe integration (test and production modes)
- Subscription management (create, update, cancel, reactivate)
- Tiered pricing system (Starter/Professional/Enterprise)
- Automatic tier upgrades based on usage
- Proration handling for mid-cycle changes
- Client billing transfer (cancel client subscription when added to advisor)
- Charity contribution calculation (5% of subscription revenue)
- Webhook handling for Stripe events
- Billing history UI
- Subscription status dashboard

**Pricing Tiers (J7 Advisor Portal):**
- Starter: $15/month (up to 5 clients, up to 3 users per client)
- Professional: $100/month (up to 50 clients, up to 10 users per client)
- Enterprise: $300/month (unlimited clients, unlimited users per client)

### IC3. Admin Panel & Charity Management [MVP] [MANDATORY]
Build administrative interface for platform operators to manage verified charities that users can select for their monthly $5 contribution.

**What Needs Building:**
- Admin navigation section (role-based visibility)
- Charity management interface (CRUD operations)
- Charity verification workflow (Pending → Verified → Rejected states)
- User-facing charity dropdown (shows only Verified charities)
- Charity metadata (name, mission, EIN, website, logo URL, impact stats)
- Role-based access control (admin-only access)
- CSRF protection for admin forms
- Audit logging for admin actions

**External Dependencies:**
- None (pure UI and database operations)

### IC4. Email Service Infrastructure [MVP] [MANDATORY]
Build transactional email delivery system for advisor invitations, billing notifications, tax season alerts, and critical account communications.

**What Needs Building:**
- Email service provider setup (SendGrid/Postmark/AWS SES)
- DNS configuration (SPF, DKIM, DMARC for sender domain)
- Email delivery service wrapper (EmailService class)
- Async delivery queue with retry logic (3 attempts, exponential backoff)
- Delivery status tracking (queued, sent, delivered, bounced, failed)
- Webhook handling for delivery events
- HTML email template system (Handlebars or similar)
- Plain text fallback generation
- Responsive email template design (mobile-friendly)
- Branded header/footer with Graceful Books logo
- Template variable interpolation

**Email Templates (9 templates):**
1. Advisor invitation email (J7)
2. Client billing transfer notification (IC2)
3. Advisor removed client notification (J7)
4. Scenario pushed to client (J3)
5. Tax season access granted (J8)
6. Tax prep completion (J8)
7. Welcome email
8. Password reset email
9. Email verification

**External Dependencies:**
- Services: Email provider API (SendGrid/Postmark/AWS SES)
- Libraries: Provider SDK
- Infrastructure: DNS configuration, webhook endpoint

### IC5. OpenSpec Documentation Synchronization [MVP] [MANDATORY]
Update all OpenSpec specification files to match the evolved Group J roadmap vision, ensuring agents implement the CORRECT features.

**Design Philosophy:**
During the Group J reimagining process, fundamental changes were made to moonshot features:
- J1: 3D → 2D widget
- J2: AI insights → Smart automation assistant (research-driven pivot)
- J4: Health score → Key metrics reports (removed gamification)
- J6: Simple calculator → Comprehensive runway tool (75+ criteria)
- J7: Basic portal → Full billing model (pricing tiers, team management)
- J9: API integrations → CSV import/export (architecture shift)
- Removed: J10-J13 (mobile app, public API, related infrastructure)

The OpenSpec files still describe the OLD features. This task ensures documentation matches reality BEFORE agents start building.

**What Needs Updating:**

**Proposal File:**
- `openspec/changes/moonshot-features/proposal.md` - Rewrite to match current ROADMAP.md Group J (J1-J12)

**Spec Files (Rewrite Required):**
- VIZ-001 → Update for 2D Financial Flow Widget
- AI-001 → Update for Smart Automation Assistant
- HEALTH-001 → Rename to METRICS-001 (Key Metrics Reports)
- RUNWAY-001 → Update for expanded scope (75+ acceptance criteria)
- MENTOR-001 → Update for Advisor Portal with billing model
- TAX-001 → Update for Tax Time Preparation Mode
- INTEG-001 → Replace with CSV-001 (CSV Import/Export)

**Spec Files (Remove):**
- MOBILE-001 → DELETE (feature removed)
- FUTURE-001 → DELETE (public API removed)

**New Spec Files (Create):**
- CSV-001 → CSV Import/Export
- SCENARIO-001 → What-If Scenario Planner (if doesn't exist)
- GOALS-001 → Goal Setting & Tracking (if doesn't exist)

**Tasks File:**
- tasks.md → Update to match current J1-J12 task list

### IC6. Infrastructure Capstone - Final Validation [MVP] [MANDATORY]
Verify ALL Infrastructure Capstone tasks complete, Group I UI components functional, billing/admin/email systems operational, and OpenSpec files synchronized.

**CRITICAL GATE:** Group J CANNOT BEGIN until this validation passes.

**Validation Checklist:**
- IC1: CRDT and Activity Feed UI functional with E2E tests passing
- IC2: Billing system handles subscriptions with accurate tiered pricing
- IC3: Admin panel allows charity management with RBAC
- IC4: Email delivery achieves >95% deliverability rate
- IC5: OpenSpec files match current ROADMAP (zero stale docs)
- Performance validation: Page load <2s, operations <500ms
- Security validation: Webhook signature validation, admin endpoint protection, CSRF protection, input sanitization
- Accessibility validation: WCAG 2.1 AA compliance
- Integration validation: End-to-end workflows across IC1-IC4
- Cross-browser validation: Chrome, Firefox, Safari, Edge

**Success Criteria:**
✅ ALL CHECKS PASSING = Green light for Group J
❌ ANY CHECK FAILING = Block Group J until fixed

## Impact Analysis

**Positive Impacts:**
- Completes Group I user experience with full UI for CRDT and Activity Feed
- Enables J7 Advisor Portal with proper billing infrastructure
- Allows users to select charity partners for monthly contributions
- Provides transactional email communication for critical actions
- Ensures agents implement correct Group J features (no wasted effort)
- Creates quality gate before moonshot development begins

**Risks:**
- IC1: Complex state management for nested comment threads
- IC2: Stripe API failures or webhook delivery issues
- IC3: RBAC vulnerabilities if not properly implemented
- IC4: Email deliverability issues (spam filters, bounces)
- IC5: Specs may drift out of sync again during implementation
- IC6: Validation may reveal blocking issues requiring rework

**Technical Debt:**
- None - this is infrastructure cleanup/completion

**Migration Concerns:**
- IC2: Existing users need subscription records created (one-time migration)
- IC3: Admin role assignment requires database seeding
- IC4: DNS records must be configured before production deployment

## Files Changed

### New Files
- `src/components/conflicts/ConflictNotificationBadge.tsx`
- `src/components/conflicts/ConflictResolutionModal.tsx`
- `src/components/conflicts/ConflictHistoryDrawer.tsx`
- `src/components/comments/CommentThread.tsx`
- `src/components/comments/MentionInput.tsx`
- `src/components/notifications/NotificationBell.tsx`
- `src/components/notifications/NotificationPanel.tsx`
- `src/components/notifications/NotificationPreferences.tsx`
- `src/components/activity/ActivityFeedWidget.tsx`
- `src/services/billing.service.ts`
- `src/services/subscription.service.ts`
- `src/services/charity.service.ts`
- `src/services/email.service.ts`
- `src/components/admin/CharityManagement.tsx`
- `src/components/admin/CharityForm.tsx`
- `src/components/admin/AdminNav.tsx`
- `src/components/billing/SubscriptionDashboard.tsx`
- `src/components/billing/BillingHistory.tsx`
- `src/templates/emails/*.html` (9 email templates)
- `openspec/changes/infrastructure-capstone/` (this directory and all files)
- `openspec/changes/moonshot-features/specs/CSV-001/`
- `openspec/changes/moonshot-features/specs/SCENARIO-001/`
- `openspec/changes/moonshot-features/specs/METRICS-001/` (renamed from HEALTH-001)

### Modified Files
- `openspec/changes/moonshot-features/proposal.md`
- `openspec/changes/moonshot-features/tasks.md`
- `openspec/changes/moonshot-features/specs/VIZ-001/spec.md`
- `openspec/changes/moonshot-features/specs/AI-001/spec.md`
- `openspec/changes/moonshot-features/specs/RUNWAY-001/spec.md`
- `openspec/changes/moonshot-features/specs/MENTOR-001/spec.md`
- `openspec/changes/moonshot-features/specs/TAX-001/spec.md`
- `openspec/changes/moonshot-features/specs/GOAL-001/spec.md`

### Deleted Files
- `openspec/changes/moonshot-features/specs/MOBILE-001/` (feature removed)
- `openspec/changes/moonshot-features/specs/FUTURE-001/` (public API removed)
- `openspec/changes/moonshot-features/specs/INTEG-001/` (replaced by CSV-001)

## Testing Strategy

### IC1 (Group I UI Components)
- Unit tests for each component (rendering, interactions, edge cases)
- Integration tests with backend services (ConflictResolutionService, CommentsService)
- E2E tests for complete workflows (user resolves conflict, user comments with @mention)
- Accessibility testing (keyboard navigation, screen reader compatibility)

### IC2 (Billing Infrastructure)
- Unit tests for subscription calculations (tiered pricing, proration)
- Integration tests with Stripe test mode (webhook handling)
- Manual testing with Stripe checkout flow
- Edge case testing (tier upgrades, cancellations, reactivations)

### IC3 (Admin Panel)
- Unit tests for charity service (CRUD operations)
- Integration tests for RBAC (non-admin blocked from admin endpoints)
- Manual testing of charity verification workflow
- Security testing (CSRF protection, SQL injection prevention)

### IC4 (Email Service)
- Unit tests for email service wrapper (delivery, retry logic, status tracking)
- Integration tests with provider test/sandbox mode
- Template rendering tests (variable interpolation, HTML/plain text generation)
- Deliverability testing (spam score check, inbox placement)

### IC5 (OpenSpec Sync)
- Manual review of all updated spec files
- Cross-reference with ROADMAP.md Group J section
- Verify no references to removed features remain
- Verify all new features have corresponding specs

### IC6 (Final Validation)
- Execute all validation checklists
- Performance testing with Lighthouse
- Security penetration testing
- Accessibility audit with WAVE and screen readers
- Cross-browser testing (Chrome, Firefox, Safari, Edge)

## Rollout Plan

### Phase 1: IC0 Validation (1-2 hours)
- Run all I1 and I2 backend tests
- Execute manual smoke tests
- Document any issues found
- Fix blocking bugs before proceeding

### Phase 2: IC1 UI Components (1 week)
- Build CRDT UI components (ConflictNotificationBadge, ConflictResolutionModal, ConflictHistoryDrawer)
- Build Activity Feed UI components (CommentThread, NotificationBell, MentionInput, NotificationPreferences, ActivityFeedWidget)
- Write unit and integration tests
- Conduct accessibility testing
- Deploy to staging for QA

### Phase 3: IC2-IC4 Infrastructure (2 weeks)
- IC2: Integrate Stripe, build subscription management, implement tiered pricing
- IC3: Build admin panel, charity management interface, RBAC enforcement
- IC4: Set up email provider, build email service, create templates
- Write comprehensive tests for each component
- Deploy to staging for integrated testing

### Phase 4: IC5 OpenSpec Sync (2-3 days)
- Rewrite moonshot-features/proposal.md
- Update all existing spec files
- Create new spec files (CSV-001, SCENARIO-001, METRICS-001)
- Delete removed spec files (MOBILE-001, FUTURE-001, INTEG-001)
- Update tasks.md
- Git commit with clear message

### Phase 5: IC6 Final Validation (3-5 days)
- Execute all validation checklists
- Fix any issues found
- Re-validate until all checks pass
- Document validation results
- Green light Group J or create fix-it tickets

### Phase 6: Production Deployment (1 day)
- Deploy IC1-IC4 to production
- Configure DNS records for email service
- Seed admin role assignments
- Monitor for issues
- Announce Infrastructure Capstone completion

## Success Criteria

**IC0: Group I Backend Validation**
- [ ] ALL I1 backend tests passing (100%)
- [ ] ALL I2 backend tests passing (100%)
- [ ] Manual smoke tests successful
- [ ] No blocking bugs or missing schema tables

**IC1: Complete Group I UI Components**
- [ ] ConflictNotificationBadge visible and functional
- [ ] ConflictResolutionModal displays side-by-side diff
- [ ] CommentThread renders nested replies
- [ ] NotificationBell shows unread count
- [ ] MentionInput autocompletes @username
- [ ] E2E tests pass for conflict resolution and comment workflows
- [ ] WCAG 2.1 AA compliant

**IC2: Billing Infrastructure**
- [ ] Stripe integration configured (test and production)
- [ ] Tiered pricing calculations accurate
- [ ] Automatic tier upgrades working
- [ ] Client billing transfer functional
- [ ] Webhook handling verified
- [ ] Billing history UI displays correctly

**IC3: Admin Panel & Charity Management**
- [ ] Admin navigation visible to admins only
- [ ] Charity CRUD operations functional
- [ ] Verification workflow working (Pending → Verified)
- [ ] User charity dropdown shows only Verified charities
- [ ] RBAC enforcement verified (non-admins blocked)
- [ ] CSRF protection enabled

**IC4: Email Service Infrastructure**
- [ ] Email provider configured (SPF, DKIM, DMARC)
- [ ] 9 email templates created and tested
- [ ] Delivery queue with retry logic working
- [ ] Webhook handling for delivery status
- [ ] >95% deliverability rate achieved
- [ ] Spam score passing (<5.0)

**IC5: OpenSpec Documentation Synchronization**
- [ ] proposal.md rewritten to match current Group J
- [ ] VIZ-001, AI-001, METRICS-001, RUNWAY-001, MENTOR-001, TAX-001 updated
- [ ] CSV-001, SCENARIO-001 created
- [ ] MOBILE-001, FUTURE-001 deleted
- [ ] tasks.md updated
- [ ] All specs follow consistent format
- [ ] Git commit created with clear message

**IC6: Infrastructure Capstone - Final Validation**
- [ ] ALL IC1-IC5 validation checklists passing
- [ ] Performance targets met
- [ ] Security validation passing
- [ ] Accessibility validation passing
- [ ] Integration validation passing
- [ ] Cross-browser validation passing
- [ ] Green light granted for Group J

## Questions & Assumptions

**Questions:**
- Which email service provider should we use? (SendGrid, Postmark, or AWS SES)
- Should we implement webhook retry logic if Stripe webhooks fail?
- What is the admin user identification mechanism? (email domain, database flag, environment variable)
- Should charity contributions be calculated per subscription or aggregated monthly?

**Assumptions:**
- Stripe is the payment processor (not Square, PayPal, or other)
- Charity contributions calculated as 5% of subscription revenue
- Admin role assignment is manual (database seeding, not self-service)
- Email templates use Handlebars for variable interpolation
- DNS configuration is handled by DevOps (not automated)
- Group I backends (I1, I2) are 100% complete and tested

## Related Changes

**Depends On:**
- Group I completion (I1-I6 backends must be operational)

**Enables:**
- Group J - Moonshots (all J1-J12 features)
- J7 Advisor Portal specifically requires IC2 billing infrastructure
- J3 Scenario Planner requires IC4 email service (push to client)
- J8 Tax Prep Mode requires IC4 email service (tax season notifications)

**Blocks:**
- Group J cannot begin until IC6 validation passes (MANDATORY GATE)
