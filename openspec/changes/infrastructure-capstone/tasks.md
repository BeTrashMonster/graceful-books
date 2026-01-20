# Infrastructure Capstone - Implementation Tasks

## Task Overview

This document outlines the implementation tasks for the Infrastructure Capstone, organized by component (IC0-IC6).

## IC0: Group I Backend Validation

### Task IC0.1: Run I1 (CRDT) Backend Tests
**Description:** Execute all I1 CRDT backend tests and verify 100% pass rate
**Dependencies:** None
**Estimated Effort:** 30 minutes
**Acceptance Criteria:**
- [ ] Run `npm test -- src/services/conflictResolution.service.test.ts`
- [ ] Verify 100% pass rate (0 failures)
- [ ] Document any failures found
- [ ] Fix all failing tests before proceeding

**Testing Requirements:**
- Automated: Vitest test suite execution
- Manual: Review test output for warnings or skipped tests

---

### Task IC0.2: Run I2 (Activity Feed) Backend Tests
**Description:** Execute all I2 Activity Feed and Comments backend tests and verify 100% pass rate
**Dependencies:** None
**Estimated Effort:** 30 minutes
**Acceptance Criteria:**
- [ ] Run `npm test -- src/services/comments.service.test.ts src/services/mentions.service.test.ts`
- [ ] Verify 100% pass rate (0 failures)
- [ ] Document any failures found
- [ ] Fix all failing tests before proceeding

**Testing Requirements:**
- Automated: Vitest test suite execution
- Manual: Review test output for warnings or skipped tests

---

### Task IC0.3: Manual Smoke Testing - CRDT Conflict Creation
**Description:** Manually test conflict creation and resolution flow
**Dependencies:** IC0.1
**Estimated Effort:** 1 hour
**Acceptance Criteria:**
- [ ] Create conflict by editing same transaction on 2 devices
- [ ] Verify conflict appears in conflicts table
- [ ] Verify ConflictResolutionService detects conflict
- [ ] Test LWW merge strategy (Last Write Wins)
- [ ] Test manual merge strategy
- [ ] Verify conflict resolution updates entity
- [ ] Check conflicts table schema matches I1 spec

**Testing Requirements:**
- Manual: Multi-device testing (2 browser windows with different IndexedDB instances)

---

### Task IC0.4: Manual Smoke Testing - Comments and Mentions
**Description:** Manually test comment and mention functionality
**Dependencies:** IC0.2
**Estimated Effort:** 1 hour
**Acceptance Criteria:**
- [ ] Create comment on transaction
- [ ] Verify comment appears in comments table
- [ ] Create comment with @username mention
- [ ] Verify notification created for mentioned user
- [ ] Check comments/notifications schema matches I2 spec
- [ ] Verify no console errors when using features

**Testing Requirements:**
- Manual: Browser-based testing with multi-user simulation

---

### Task IC0.5: Validate Integration - Comment on Conflicted Transaction
**Description:** Test cross-feature integration between I1 and I2
**Dependencies:** IC0.3, IC0.4
**Estimated Effort:** 30 minutes
**Acceptance Criteria:**
- [ ] Create conflict on transaction
- [ ] Add comment to conflicted transaction
- [ ] Verify both features work together
- [ ] Verify no errors or UI glitches
- [ ] Verify services can be imported correctly

**Testing Requirements:**
- Manual: Integration testing across I1 and I2 features

---

### Task IC0.6: Documentation Validation
**Description:** Verify I1 and I2 backend code includes proper documentation
**Dependencies:** None
**Estimated Effort:** 30 minutes
**Acceptance Criteria:**
- [ ] I1 backend code includes JSDoc comments for all public methods
- [ ] I2 backend code includes JSDoc comments for all public methods
- [ ] README or implementation summary exists for I1
- [ ] README or implementation summary exists for I2

**Testing Requirements:**
- Manual: Code review for documentation completeness

---

## IC1: Complete Group I UI Components

### Task IC1.1: Build ConflictNotificationBadge Component
**Description:** Create notification badge component showing unresolved conflict count
**Dependencies:** IC0.6 (Gate Pass)
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Component renders in header
- [ ] Displays unresolved conflict count
- [ ] Updates in real-time when conflicts change
- [ ] Click opens ConflictResolutionModal
- [ ] Accessible with keyboard navigation
- [ ] Screen reader announces count

**Testing Requirements:**
- Unit: Component rendering, prop updates, click handling
- Integration: ConflictResolutionService connection
- Accessibility: Keyboard navigation, screen reader testing

---

### Task IC1.2: Build ConflictResolutionModal Component
**Description:** Create modal for viewing and resolving conflicts
**Dependencies:** IC1.1
**Estimated Effort:** 12 hours
**Acceptance Criteria:**
- [ ] Modal displays side-by-side diff view
- [ ] Shows both versions of conflicted entity
- [ ] Merge strategy selection UI (LWW, Manual, Auto)
- [ ] Apply/Discard buttons functional
- [ ] Steadiness messaging ("Which version should we keep?")
- [ ] Modal closes on Escape key
- [ ] WCAG 2.1 AA compliant

**Testing Requirements:**
- Unit: Component rendering, merge strategy selection, button actions
- Integration: ConflictResolutionService.resolve()
- E2E: User resolves conflict workflow

---

### Task IC1.3: Build ConflictHistoryDrawer Component
**Description:** Create drawer showing 90-day conflict resolution history
**Dependencies:** IC1.2
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Drawer accessible from conflict modal
- [ ] Displays conflict history (last 90 days)
- [ ] Shows resolution strategy used
- [ ] Shows timestamp and user who resolved
- [ ] Supports pagination/scrolling
- [ ] Accessible with keyboard navigation

**Testing Requirements:**
- Unit: Component rendering, history display, pagination
- Integration: ConflictResolutionService.getHistory()

---

### Task IC1.4: Build CommentThread Component
**Description:** Create comment thread component with nested reply support
**Dependencies:** IC0.6 (Gate Pass)
**Estimated Effort:** 10 hours
**Acceptance Criteria:**
- [ ] Renders nested replies with indentation
- [ ] Supports 3 levels of nesting
- [ ] Reply button on each comment
- [ ] Edit/delete actions for comment author
- [ ] Timestamps display relative time ("2 hours ago")
- [ ] Loads comments from CommentsService
- [ ] Real-time updates with Dexie liveQuery

**Testing Requirements:**
- Unit: Component rendering, nested structure, CRUD actions
- Integration: CommentsService connection
- E2E: User creates comment thread workflow

---

### Task IC1.5: Build MentionInput Component
**Description:** Create input field with @username autocomplete
**Dependencies:** IC1.4
**Estimated Effort:** 8 hours
**Acceptance Criteria:**
- [ ] Detects @ symbol in input
- [ ] Shows dropdown with user list
- [ ] Fuzzy search filters user list
- [ ] Click or Enter selects user
- [ ] Inserts @username into text
- [ ] Triggers notification creation
- [ ] Works with keyboard only

**Testing Requirements:**
- Unit: Autocomplete logic, user filtering, selection
- Integration: MentionsService connection, notification trigger
- Accessibility: Keyboard navigation, ARIA labels

**External Dependencies:**
- fuse.js (fuzzy search library)

---

### Task IC1.6: Build NotificationBell Component
**Description:** Create notification bell with unread count badge
**Dependencies:** IC0.6 (Gate Pass)
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Component renders in header
- [ ] Displays unread notification count
- [ ] Updates in real-time
- [ ] Click opens NotificationPanel
- [ ] Bell icon animates on new notification
- [ ] Accessible with keyboard navigation

**Testing Requirements:**
- Unit: Component rendering, count display, animations
- Integration: NotificationsService connection
- Accessibility: Keyboard navigation, screen reader testing

---

### Task IC1.7: Build NotificationPanel Component
**Description:** Create panel displaying recent notifications
**Dependencies:** IC1.6
**Estimated Effort:** 8 hours
**Acceptance Criteria:**
- [ ] Panel displays grouped notifications by priority
- [ ] Shows recent activity (last 20 items)
- [ ] Click notification navigates to related entity
- [ ] Mark as read functionality
- [ ] Clear all button
- [ ] Supports infinite scroll for older notifications

**Testing Requirements:**
- Unit: Component rendering, grouping logic, navigation
- Integration: NotificationsService.markAsRead()
- E2E: User interacts with notification panel

---

### Task IC1.8: Build NotificationPreferences Component
**Description:** Create panel for notification opt-in/opt-out settings
**Dependencies:** IC1.7
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Displays all notification types
- [ ] Per-type opt-in/opt-out toggles
- [ ] Digest settings (real-time, hourly, daily)
- [ ] Preferences save to user settings
- [ ] Defaults to all enabled
- [ ] Accessible with keyboard navigation

**Testing Requirements:**
- Unit: Component rendering, toggle interactions, save logic
- Integration: UserPreferencesService.update()

---

### Task IC1.9: Build ActivityFeedWidget Component
**Description:** Create widget showing recent activity feed
**Dependencies:** IC1.4, IC1.6
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Widget displays recent activity (last 20 items)
- [ ] Shows comments, mentions, updates
- [ ] Click item navigates to related entity
- [ ] Supports refresh
- [ ] Real-time updates with liveQuery
- [ ] Accessible with keyboard navigation

**Testing Requirements:**
- Unit: Component rendering, activity display, navigation
- Integration: ActivityFeedService connection

---

### Task IC1.10: Write E2E Tests for CRDT Workflow
**Description:** Write end-to-end tests for conflict resolution workflow
**Dependencies:** IC1.1, IC1.2, IC1.3
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Test: User creates conflict on 2 devices
- [ ] Test: ConflictNotificationBadge shows count
- [ ] Test: User clicks badge, modal opens
- [ ] Test: User selects merge strategy, applies
- [ ] Test: Conflict resolved, badge clears
- [ ] Test: Conflict history shows resolved conflict

**Testing Requirements:**
- E2E: Playwright tests for complete workflow

---

### Task IC1.11: Write E2E Tests for Comment Workflow
**Description:** Write end-to-end tests for comment and mention workflow
**Dependencies:** IC1.4, IC1.5, IC1.6, IC1.7
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Test: User creates comment on transaction
- [ ] Test: Comment appears in thread
- [ ] Test: User creates comment with @mention
- [ ] Test: NotificationBell shows unread count
- [ ] Test: Mentioned user sees notification
- [ ] Test: User navigates to transaction from notification

**Testing Requirements:**
- E2E: Playwright tests for complete workflow

---

## IC2: Billing Infrastructure

### Task IC2.1: Set Up Stripe Integration
**Description:** Configure Stripe account and integrate Stripe SDK
**Dependencies:** None
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Stripe account created (test and production modes)
- [ ] API keys configured in environment variables
- [ ] Stripe SDK installed (@stripe/stripe-js)
- [ ] Test connection to Stripe API
- [ ] Webhook endpoint URL configured in Stripe dashboard

**Testing Requirements:**
- Manual: Verify API connection
- Integration: Test webhook delivery

**External Dependencies:**
- Stripe account (payment processor)
- @stripe/stripe-js library

---

### Task IC2.2: Build BillingService
**Description:** Create service for billing calculations and management
**Dependencies:** IC2.1
**Estimated Effort:** 8 hours
**Acceptance Criteria:**
- [ ] Service calculates subscription cost based on tier
- [ ] Automatic tier selection based on usage (clients, users)
- [ ] Proration calculation for mid-cycle changes
- [ ] Client count tracking
- [ ] User count per client tracking
- [ ] Charity contribution calculation (5% of subscription)

**Testing Requirements:**
- Unit: Pricing calculations, tier logic, proration
- Integration: Database queries for counts

---

### Task IC2.3: Build SubscriptionService
**Description:** Create service for subscription lifecycle management
**Dependencies:** IC2.2
**Estimated Effort:** 10 hours
**Acceptance Criteria:**
- [ ] Create subscription (Stripe + local DB)
- [ ] Update subscription (tier changes, quantity changes)
- [ ] Cancel subscription (Stripe + local DB)
- [ ] Reactivate subscription
- [ ] Handle Stripe webhook events (subscription.created, subscription.updated, subscription.deleted)
- [ ] Subscription status tracking (active, canceled, past_due)

**Testing Requirements:**
- Unit: Service methods, status transitions
- Integration: Stripe API calls, webhook handling
- Manual: Stripe dashboard verification

---

### Task IC2.4: Implement Tiered Pricing Logic
**Description:** Implement automatic tier upgrades based on usage
**Dependencies:** IC2.2
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Starter tier: $15/month (up to 5 clients, up to 3 users per client)
- [ ] Professional tier: $100/month (up to 50 clients, up to 10 users per client)
- [ ] Enterprise tier: $300/month (unlimited clients, unlimited users)
- [ ] Automatic tier upgrade when limits exceeded
- [ ] Proration applied for mid-cycle upgrades
- [ ] Notification sent when tier changes

**Testing Requirements:**
- Unit: Tier selection logic, upgrade triggers
- Integration: Subscription update with Stripe
- E2E: Add 6th client → automatic upgrade to Professional

---

### Task IC2.5: Implement Client Billing Transfer
**Description:** Implement billing transfer when client added to advisor
**Dependencies:** IC2.3
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] When client added to advisor, cancel client subscription
- [ ] Add client to advisor's client count
- [ ] Trigger tier recalculation for advisor
- [ ] Prorate advisor subscription if tier changes
- [ ] Send notification email to client (billing transfer)
- [ ] Send notification email to advisor (new client added)

**Testing Requirements:**
- Unit: Billing transfer logic
- Integration: Subscription cancellation, advisor subscription update
- E2E: Add client to advisor → verify billing transfer

---

### Task IC2.6: Implement Charity Contribution Calculation
**Description:** Calculate 5% charity contribution from subscription revenue
**Dependencies:** IC2.3
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Calculate 5% of subscription amount
- [ ] Store contribution amount in database
- [ ] Associate contribution with user-selected charity
- [ ] Track monthly contributions per charity
- [ ] Generate charity contribution reports for platform admin

**Testing Requirements:**
- Unit: Calculation logic
- Integration: Database storage
- Manual: Verify contribution amounts in admin dashboard

---

### Task IC2.7: Build SubscriptionDashboard Component
**Description:** Create UI for viewing subscription status and details
**Dependencies:** IC2.3
**Estimated Effort:** 8 hours
**Acceptance Criteria:**
- [ ] Displays current subscription tier
- [ ] Shows client count and user count
- [ ] Displays next billing date
- [ ] Shows current period cost
- [ ] Upgrade/downgrade tier buttons
- [ ] Cancel subscription button (with confirmation)
- [ ] Charity contribution amount displayed

**Testing Requirements:**
- Unit: Component rendering, subscription data display
- Integration: SubscriptionService connection
- E2E: User views subscription dashboard

---

### Task IC2.8: Build BillingHistory Component
**Description:** Create UI for viewing past invoices and payments
**Dependencies:** IC2.3
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Displays list of past invoices
- [ ] Shows invoice date, amount, status (paid, pending, failed)
- [ ] Download invoice PDF button
- [ ] Filter by date range
- [ ] Pagination for large histories
- [ ] Stripe hosted invoice page link

**Testing Requirements:**
- Unit: Component rendering, invoice list display
- Integration: Stripe API for invoice retrieval
- E2E: User views billing history

---

### Task IC2.9: Write E2E Tests for Billing Workflows
**Description:** Write end-to-end tests for subscription and billing workflows
**Dependencies:** IC2.7, IC2.8
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Test: Create subscription → Verify tier selection
- [ ] Test: Add 6th client → Automatic tier upgrade to Professional
- [ ] Test: Remove client → Automatic proration
- [ ] Test: Add client to advisor → Client billing transfer
- [ ] Test: View billing history → Invoices displayed

**Testing Requirements:**
- E2E: Playwright tests with Stripe test mode

---

## IC3: Admin Panel & Charity Management

### Task IC3.1: Build CharityService
**Description:** Create service for charity CRUD operations
**Dependencies:** None
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Create charity (name, mission, EIN, website, logo URL, impact stats)
- [ ] Update charity (all fields editable)
- [ ] Delete charity (soft delete, preserve references)
- [ ] Get charity by ID
- [ ] List all charities (with status filter: All, Pending, Verified, Rejected)
- [ ] Verify charity (Pending → Verified)
- [ ] Reject charity (Pending → Rejected)

**Testing Requirements:**
- Unit: Service methods, CRUD operations
- Integration: Database queries
- Security: Admin-only access enforcement

---

### Task IC3.2: Build AdminNav Component
**Description:** Create admin navigation section with role-based visibility
**Dependencies:** None
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Admin navigation section visible to admins only
- [ ] Navigation items: Charity Management, User Management, System Settings
- [ ] Highlights current admin section
- [ ] Hidden for non-admin users
- [ ] Accessible with keyboard navigation

**Testing Requirements:**
- Unit: Component rendering, role-based visibility
- Integration: Auth service for admin role check
- Security: Non-admin cannot see navigation

---

### Task IC3.3: Build CharityForm Component
**Description:** Create form for adding/editing charities
**Dependencies:** IC3.1
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Form fields: Name, Mission, EIN, Website, Logo URL, Impact Stats
- [ ] Form validation (required fields, EIN format, URL format)
- [ ] Submit creates/updates charity
- [ ] Cancel button clears form
- [ ] CSRF protection enabled
- [ ] Accessible with keyboard navigation

**Testing Requirements:**
- Unit: Component rendering, form validation, submission
- Integration: CharityService.create()/update()
- Security: CSRF token validation

---

### Task IC3.4: Build CharityManagement Component
**Description:** Create admin interface for managing charities
**Dependencies:** IC3.1, IC3.3
**Estimated Effort:** 10 hours
**Acceptance Criteria:**
- [ ] List view displays all charities
- [ ] Status filter (All, Pending, Verified, Rejected)
- [ ] Verify button (Pending → Verified)
- [ ] Reject button (Pending → Rejected)
- [ ] Edit button opens CharityForm
- [ ] Delete button (soft delete with confirmation)
- [ ] Add New Charity button
- [ ] Search/filter by name
- [ ] Pagination for large lists

**Testing Requirements:**
- Unit: Component rendering, list display, actions
- Integration: CharityService connection
- E2E: Admin verifies charity workflow

---

### Task IC3.5: Build User-Facing Charity Selector
**Description:** Create dropdown for users to select charity for contributions
**Dependencies:** IC3.1
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Dropdown shows only Verified charities
- [ ] Displays charity name, mission, logo
- [ ] User selection saved to preferences
- [ ] Default: No charity selected (opt-in)
- [ ] Change charity option
- [ ] Accessible with keyboard navigation

**Testing Requirements:**
- Unit: Component rendering, charity list, selection
- Integration: CharityService.listVerified()
- E2E: User selects charity → Saved to preferences

---

### Task IC3.6: Implement Role-Based Access Control (RBAC)
**Description:** Enforce admin-only access to admin endpoints
**Dependencies:** None
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Admin role stored in database (users.role)
- [ ] Middleware checks admin role on admin endpoints
- [ ] Non-admin requests return 403 Forbidden
- [ ] Admin role assignment via database seeding
- [ ] Audit logging for admin actions

**Testing Requirements:**
- Unit: Middleware logic, role checks
- Integration: Endpoint protection
- Security: Penetration test with non-admin user

---

### Task IC3.7: Write E2E Tests for Admin Panel Workflows
**Description:** Write end-to-end tests for charity management workflows
**Dependencies:** IC3.4, IC3.5
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Test: Admin adds new charity → Status Pending
- [ ] Test: Admin verifies charity → Status Verified
- [ ] Test: User charity dropdown shows only Verified
- [ ] Test: User selects charity → Saved to preferences
- [ ] Test: Non-admin cannot access admin panel

**Testing Requirements:**
- E2E: Playwright tests for admin and user workflows
- Security: RBAC enforcement testing

---

## IC4: Email Service Infrastructure

### Task IC4.1: Select and Configure Email Service Provider
**Description:** Choose email provider and configure account
**Dependencies:** None
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Email provider selected (SendGrid, Postmark, or AWS SES)
- [ ] Account created and API keys obtained
- [ ] API keys configured in environment variables
- [ ] Test email sent successfully
- [ ] Sender domain configured (noreply@gracefulbooks.com)

**Testing Requirements:**
- Manual: Test email send via provider dashboard

**External Dependencies:**
- Email service provider account

---

### Task IC4.2: Configure DNS Records for Email Deliverability
**Description:** Set up SPF, DKIM, and DMARC records for sender domain
**Dependencies:** IC4.1
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] SPF record added to DNS
- [ ] DKIM record added to DNS
- [ ] DMARC record added to DNS
- [ ] DNS records verified in provider dashboard
- [ ] Test email passes authentication checks

**Testing Requirements:**
- Manual: DNS record verification
- Deliverability: Mail-tester.com spam score check

**External Dependencies:**
- DNS management access

---

### Task IC4.3: Build EmailService Class
**Description:** Create service wrapper for email provider SDK
**Dependencies:** IC4.1
**Estimated Effort:** 8 hours
**Acceptance Criteria:**
- [ ] Service wraps provider SDK
- [ ] Send email method (to, subject, htmlBody, plainTextBody)
- [ ] Template rendering with variable interpolation
- [ ] Async delivery queue (non-blocking)
- [ ] Retry logic (3 attempts with exponential backoff: 1min, 5min, 15min)
- [ ] Delivery status tracking (queued, sent, delivered, bounced, failed)
- [ ] Error handling (network failures, API errors, invalid recipients)
- [ ] Logging (all email sends logged with recipient, template, status)

**Testing Requirements:**
- Unit: Service methods, retry logic, status tracking
- Integration: Provider API calls
- Manual: Send test email via service

---

### Task IC4.4: Implement Webhook Handling for Delivery Events
**Description:** Create webhook endpoint for email delivery status updates
**Dependencies:** IC4.3
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Webhook endpoint created (/api/webhooks/email)
- [ ] Webhook signature validation
- [ ] Handle delivery events (sent, delivered, bounced, failed, opened, clicked)
- [ ] Update email status in database
- [ ] Log all webhook events
- [ ] Retry failed webhook deliveries

**Testing Requirements:**
- Unit: Webhook handler logic, signature validation
- Integration: Provider webhook delivery
- Manual: Test webhook with provider test events

---

### Task IC4.5: Create HTML Email Template System
**Description:** Build template system with Handlebars or similar
**Dependencies:** IC4.3
**Estimated Effort:** 6 hours
**Acceptance Criteria:**
- [ ] Template engine integrated (Handlebars)
- [ ] Base template with header/footer
- [ ] Variable interpolation ({{firstName}}, {{actionUrl}}, etc.)
- [ ] Responsive design (mobile-friendly)
- [ ] Branded header with Graceful Books logo
- [ ] Footer with links (Help Center, Contact, Privacy, Terms)
- [ ] Plain text fallback generation (strip HTML, preserve links)

**Testing Requirements:**
- Unit: Template rendering, variable interpolation
- Manual: Test render templates with sample data
- Cross-client: Test in Gmail, Outlook, Apple Mail

**External Dependencies:**
- Handlebars library

---

### Task IC4.6: Create Email Template 1 - Advisor Invitation
**Description:** Create advisor invitation email template
**Dependencies:** IC4.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Subject: "You're invited to be an advisor for {{clientName}} on Graceful Books"
- [ ] Body includes client name, invitation message, CTA button
- [ ] Variables: {{advisorName}}, {{clientName}}, {{invitationUrl}}
- [ ] Unsubscribe link (transactional email preference)
- [ ] Responsive design

**Testing Requirements:**
- Manual: Render template with test data
- Cross-client: Test display in major email clients

---

### Task IC4.7: Create Email Template 2 - Client Billing Transfer
**Description:** Create billing transfer notification email template
**Dependencies:** IC4.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Subject: "Your billing is now managed by {{advisorName}}"
- [ ] Body explains billing transfer, no action required
- [ ] Variables: {{firstName}}, {{advisorName}}, {{advisorEmail}}
- [ ] No unsubscribe link (critical billing notification)
- [ ] Responsive design

**Testing Requirements:**
- Manual: Render template with test data
- Cross-client: Test display in major email clients

---

### Task IC4.8: Create Email Template 3 - Advisor Removed Client
**Description:** Create notification when advisor removes client
**Dependencies:** IC4.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Subject: "{{advisorName}} is no longer your advisor"
- [ ] Body explains advisor removal, billing resumes
- [ ] Variables: {{firstName}}, {{advisorName}}
- [ ] No unsubscribe link (critical billing notification)
- [ ] Responsive design

**Testing Requirements:**
- Manual: Render template with test data
- Cross-client: Test display in major email clients

---

### Task IC4.9: Create Email Template 4 - Scenario Pushed to Client
**Description:** Create notification when accountant pushes scenario to client
**Dependencies:** IC4.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Subject: "{{advisorName}} shared a scenario with you"
- [ ] Body includes scenario name, CTA to view
- [ ] Variables: {{firstName}}, {{advisorName}}, {{scenarioName}}, {{scenarioUrl}}
- [ ] Unsubscribe link
- [ ] Responsive design

**Testing Requirements:**
- Manual: Render template with test data
- Cross-client: Test display in major email clients

---

### Task IC4.10: Create Email Template 5 - Tax Season Access Granted
**Description:** Create notification when tax prep mode enabled
**Dependencies:** IC4.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Subject: "Tax prep access granted for {{clientName}}"
- [ ] Body explains access granted, CTA to view tax dashboard
- [ ] Variables: {{firstName}}, {{clientName}}, {{taxYear}}, {{dashboardUrl}}
- [ ] Unsubscribe link
- [ ] Responsive design

**Testing Requirements:**
- Manual: Render template with test data
- Cross-client: Test display in major email clients

---

### Task IC4.11: Create Email Template 6 - Tax Prep Completion
**Description:** Create notification when tax package ready
**Dependencies:** IC4.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Subject: "Your {{taxYear}} Tax Package is Ready!"
- [ ] Body congratulates completion, CTA to download
- [ ] Variables: {{firstName}}, {{taxYear}}, {{downloadUrl}}
- [ ] Unsubscribe link
- [ ] Responsive design

**Testing Requirements:**
- Manual: Render template with test data
- Cross-client: Test display in major email clients

---

### Task IC4.12: Create Email Template 7 - Welcome Email
**Description:** Create welcome email for new users
**Dependencies:** IC4.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Subject: "Welcome to Graceful Books!"
- [ ] Body includes getting started tips, CTA to dashboard
- [ ] Variables: {{firstName}}, {{dashboardUrl}}
- [ ] Unsubscribe link
- [ ] Responsive design

**Testing Requirements:**
- Manual: Render template with test data
- Cross-client: Test display in major email clients

---

### Task IC4.13: Create Email Template 8 - Password Reset
**Description:** Create password reset email template
**Dependencies:** IC4.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Subject: "Reset your Graceful Books password"
- [ ] Body includes reset link, expiration notice
- [ ] Variables: {{firstName}}, {{resetUrl}}
- [ ] No unsubscribe link (critical security email)
- [ ] Responsive design

**Testing Requirements:**
- Manual: Render template with test data
- Cross-client: Test display in major email clients

---

### Task IC4.14: Create Email Template 9 - Email Verification
**Description:** Create email verification template
**Dependencies:** IC4.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Subject: "Verify your email address for Graceful Books"
- [ ] Body includes verification link, expiration notice
- [ ] Variables: {{firstName}}, {{verificationUrl}}
- [ ] No unsubscribe link (critical security email)
- [ ] Responsive design

**Testing Requirements:**
- Manual: Render template with test data
- Cross-client: Test display in major email clients

---

### Task IC4.15: Implement Unsubscribe Handling
**Description:** Build unsubscribe system for email preferences
**Dependencies:** IC4.3
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Unsubscribe link in all transactional emails (except critical: password reset, billing)
- [ ] Unsubscribe page allows per-email-type opt-out
- [ ] Email preferences stored in user preferences
- [ ] EmailService respects unsubscribe preferences
- [ ] Confirmation message after unsubscribe

**Testing Requirements:**
- Unit: Preference storage, opt-out logic
- Integration: EmailService.send() checks preferences
- E2E: User unsubscribes from email type → No longer receives

---

### Task IC4.16: Implement Rate Limiting
**Description:** Add rate limiting to respect provider limits
**Dependencies:** IC4.3
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Rate limit based on provider tier (e.g., 100 emails/hour)
- [ ] Queue emails if rate limit exceeded
- [ ] Throttle email sends to stay within limits
- [ ] Log rate limit events
- [ ] Alert admin if rate limit reached frequently

**Testing Requirements:**
- Unit: Rate limit logic
- Integration: Provider API rate limit handling
- Load: Test with high email volume

---

### Task IC4.17: Implement Test Mode and Production Mode
**Description:** Add configuration for test vs. production email sending
**Dependencies:** IC4.3
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Test mode: Capture emails in log instead of sending
- [ ] Production mode: Actual delivery via provider
- [ ] Environment variable controls mode (EMAIL_MODE=test|production)
- [ ] Test mode logs full email content
- [ ] Clear indication in logs which mode is active

**Testing Requirements:**
- Manual: Test both modes
- Integration: Verify emails captured in test mode

---

### Task IC4.18: Write E2E Tests for Email Workflows
**Description:** Write end-to-end tests for email delivery workflows
**Dependencies:** IC4.6-IC4.14
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Test: User action triggers email → Email queued
- [ ] Test: Email delivery status tracked → Status updated
- [ ] Test: User unsubscribes → No longer receives email type
- [ ] Test: Rate limit reached → Emails queued
- [ ] Test: Webhook received → Status updated

**Testing Requirements:**
- E2E: Playwright tests with test mode
- Integration: Provider sandbox mode testing

---

## IC5: OpenSpec Documentation Synchronization

### Task IC5.1: Rewrite moonshot-features/proposal.md
**Description:** Rewrite proposal to match current Group J (J1-J12)
**Dependencies:** None
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Proposal describes evolved feature vision (2D widget, smart automation, etc.)
- [ ] Removes all references to removed features (J10-J13: mobile app, public API)
- [ ] Adds new features (J10 CSV Testing, J11/J12 testing gates)
- [ ] Updates success metrics
- [ ] Updates dependencies
- [ ] Matches ROADMAP.md tone and structure

**Testing Requirements:**
- Manual: Cross-reference with ROADMAP.md Group J section

---

### Task IC5.2: Update VIZ-001 Spec for 2D Financial Flow Widget
**Description:** Update spec for 2D widget (not 3D visualization)
**Dependencies:** None
**Estimated Effort:** 3 hours
**Acceptance Criteria:**
- [ ] Spec describes 2D Financial Flow Widget (not 3D)
- [ ] Includes: 2D canvas, animation queue, node-based visualization
- [ ] Includes: Ecosystem toggle (Active Only / Full Ecosystem)
- [ ] Includes: Date range selector, color customization
- [ ] Includes: Barter transaction support (I5 integration)
- [ ] Removes all references to 3D, WebGL, Three.js
- [ ] Acceptance criteria match ROADMAP.md J1

**Testing Requirements:**
- Manual: Cross-reference with ROADMAP.md J1

---

### Task IC5.3: Update AI-001 Spec for Smart Automation Assistant
**Description:** Update spec for Smart Automation Assistant (not generic insights)
**Dependencies:** None
**Estimated Effort:** 3 hours
**Acceptance Criteria:**
- [ ] Spec describes Smart Automation Assistant
- [ ] Includes: Smart categorization, reconciliation matching, anomaly flagging
- [ ] Includes: Cash flow projection (user-initiated), vendor/customer pattern memory
- [ ] Includes: 100% local processing (zero external data transmission)
- [ ] Removes: Chatbot interface, proactive insights, unsolicited recommendations
- [ ] Acceptance criteria match ROADMAP.md J2

**Testing Requirements:**
- Manual: Cross-reference with ROADMAP.md J2

---

### Task IC5.4: Rename HEALTH-001 to METRICS-001 and Update
**Description:** Rename spec and rewrite for Key Metrics Reports (not health score)
**Dependencies:** None
**Estimated Effort:** 3 hours
**Acceptance Criteria:**
- [ ] Directory renamed: HEALTH-001 → METRICS-001
- [ ] Spec describes Key Financial Metrics Reports
- [ ] Removes: 0-100 score, gamification, unsolicited recommendations
- [ ] Includes: Liquidity/profitability/efficiency/leverage reports
- [ ] Includes: Accountant-controlled sharing (user cannot self-interpret incorrectly)
- [ ] Acceptance criteria match ROADMAP.md J4

**Testing Requirements:**
- Manual: Cross-reference with ROADMAP.md J4

---

### Task IC5.5: Update RUNWAY-001 Spec for Expanded Scope
**Description:** Update spec for comprehensive Emergency Fund & Runway Calculator (75+ criteria)
**Dependencies:** None
**Estimated Effort:** 3 hours
**Acceptance Criteria:**
- [ ] Spec describes expanded scope (not simple calculator)
- [ ] Includes: Revenue flexibility slider, expense flexibility slider
- [ ] Includes: Dual-slider interface, net burn calculation
- [ ] Includes: Date range selector, scenario comparison
- [ ] Includes: 75+ acceptance criteria from ROADMAP
- [ ] Acceptance criteria match ROADMAP.md J6

**Testing Requirements:**
- Manual: Cross-reference with ROADMAP.md J6

---

### Task IC5.6: Update MENTOR-001 Spec for Advisor Portal with Billing
**Description:** Update spec for Advisor Portal with full billing model
**Dependencies:** None
**Estimated Effort:** 3 hours
**Acceptance Criteria:**
- [ ] Spec describes Advisor Portal with billing model
- [ ] Includes: Pricing tiers (Starter/Professional/Enterprise)
- [ ] Includes: Team management, client lifecycle, charity selection
- [ ] Includes: Client portal access, permission levels
- [ ] Acceptance criteria match ROADMAP.md J7

**Testing Requirements:**
- Manual: Cross-reference with ROADMAP.md J7

---

### Task IC5.7: Update TAX-001 Spec for Tax Time Preparation Mode
**Description:** Update spec for Tax Time Preparation Mode
**Dependencies:** None
**Estimated Effort:** 3 hours
**Acceptance Criteria:**
- [ ] Spec describes Tax Time Preparation Mode
- [ ] Includes: 6-step workflow, business structure selection
- [ ] Includes: Calm tone, no jargon, stress reduction
- [ ] Includes: J7 integration (advisor access)
- [ ] Acceptance criteria match ROADMAP.md J8

**Testing Requirements:**
- Manual: Cross-reference with ROADMAP.md J8

---

### Task IC5.8: Create CSV-001 Spec to Replace INTEG-001
**Description:** Create new spec for CSV Import/Export (replaces API integrations)
**Dependencies:** None
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Spec describes CSV Import/Export
- [ ] Includes: Client-side processing, smart detection, templates
- [ ] Includes: Duplicate detection, zero-knowledge compatibility
- [ ] Includes: Import wizard, export customization
- [ ] Acceptance criteria match ROADMAP.md J9
- [ ] INTEG-001 directory deleted

**Testing Requirements:**
- Manual: Cross-reference with ROADMAP.md J9

---

### Task IC5.9: Create SCENARIO-001 Spec for What-If Scenario Planner
**Description:** Create spec for What-If Scenario Planner if doesn't exist
**Dependencies:** None
**Estimated Effort:** 4 hours
**Acceptance Criteria:**
- [ ] Spec describes What-If Scenario Planner
- [ ] Includes: Live book data pull, complex what-if modeling
- [ ] Includes: Accountant-level tool, client delivery
- [ ] Includes: Interactive results, scenario comparison
- [ ] Acceptance criteria match ROADMAP.md J3

**Testing Requirements:**
- Manual: Cross-reference with ROADMAP.md J3

---

### Task IC5.10: Verify/Update GOAL-001 Spec for Goal Setting & Tracking
**Description:** Verify GOAL-001 exists and update if needed
**Dependencies:** None
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Spec describes Goal Setting & Tracking
- [ ] Includes: Goal types (revenue, profit, cash, savings, debt reduction)
- [ ] Includes: Progress tracking, milestone celebrations
- [ ] Acceptance criteria match ROADMAP.md J5

**Testing Requirements:**
- Manual: Cross-reference with ROADMAP.md J5

---

### Task IC5.11: Delete MOBILE-001 and FUTURE-001 Spec Directories
**Description:** Remove specs for removed features (mobile app, public API)
**Dependencies:** None
**Estimated Effort:** 30 minutes
**Acceptance Criteria:**
- [ ] MOBILE-001 directory deleted (feature removed from roadmap)
- [ ] FUTURE-001 directory deleted (public API removed from roadmap)
- [ ] No references to these specs in other files

**Testing Requirements:**
- Manual: Search for references to deleted specs

---

### Task IC5.12: Update moonshot-features/tasks.md
**Description:** Update tasks file to match current J1-J12 structure
**Dependencies:** IC5.1-IC5.11
**Estimated Effort:** 3 hours
**Acceptance Criteria:**
- [ ] Tasks list matches current Group J (J1-J12)
- [ ] Removed tasks for deleted features (J10-J13 old)
- [ ] Added tasks for new features (J10 CSV Testing, J11/J12 testing gates)
- [ ] Task dependencies updated
- [ ] Task estimates updated

**Testing Requirements:**
- Manual: Cross-reference with ROADMAP.md Group J

---

### Task IC5.13: Create Git Commit for OpenSpec Sync
**Description:** Commit all OpenSpec documentation updates
**Dependencies:** IC5.1-IC5.12
**Estimated Effort:** 30 minutes
**Acceptance Criteria:**
- [ ] All updated spec files staged
- [ ] Commit message: "docs: Synchronize OpenSpec files with evolved Group J roadmap vision"
- [ ] Commit includes all changes (proposal, specs, tasks)
- [ ] No untracked files remaining

**Testing Requirements:**
- Manual: Git status shows clean working tree

---

## IC6: Infrastructure Capstone - Final Validation

### Task IC6.1: Validate IC1 (Group I UI Components)
**Description:** Execute IC1 validation checklist
**Dependencies:** IC1.11
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] ConflictNotificationBadge visible in header, shows unresolved count
- [ ] Click badge → ConflictResolutionModal opens with side-by-side diff
- [ ] Conflict resolution works (user selects merge strategy, applies)
- [ ] CommentThread renders on transaction detail page
- [ ] User can create comment, comment saves and displays
- [ ] @mention autocomplete works (type @ → dropdown with users)
- [ ] NotificationBell shows unread count
- [ ] Click bell → notification panel opens with recent activity
- [ ] E2E test passes: "User resolves CRDT conflict"
- [ ] E2E test passes: "User comments on transaction with @mention"

**Testing Requirements:**
- Manual: Execute validation checklist
- E2E: Run Playwright tests

---

### Task IC6.2: Validate IC2 (Billing Infrastructure)
**Description:** Execute IC2 validation checklist
**Dependencies:** IC2.9
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Stripe integration configured (test mode)
- [ ] Create test advisor subscription: 4 clients, 8 users → Total $57.50
- [ ] Add 47th client → Automatic tier upgrade to $100
- [ ] Remove client → Automatic proration and tier downgrade
- [ ] Client billing transfer works (client subscription canceled when added to advisor)
- [ ] Webhook handling verified (test webhook delivery)
- [ ] Billing history UI displays past invoices

**Testing Requirements:**
- Manual: Execute validation checklist
- Integration: Stripe test mode

---

### Task IC6.3: Validate IC3 (Admin Panel)
**Description:** Execute IC3 validation checklist
**Dependencies:** IC3.7
**Estimated Effort:** 1 hour
**Acceptance Criteria:**
- [ ] Login as admin → Admin navigation section visible
- [ ] Navigate to Charity Management → List view displays
- [ ] Add new charity → Form validates, charity added with "Pending" status
- [ ] Verify charity → Status changes to "Verified"
- [ ] Login as regular user → Charity dropdown shows only "Verified" charities
- [ ] Select charity → Charity saved to user preferences

**Testing Requirements:**
- Manual: Execute validation checklist
- Security: RBAC enforcement

---

### Task IC6.4: Validate IC4 (Email Service)
**Description:** Execute IC4 validation checklist
**Dependencies:** IC4.18
**Estimated Effort:** 1 hour
**Acceptance Criteria:**
- [ ] Send test email: Advisor invitation → Email delivers successfully
- [ ] Send test email: Client billing transfer → Email delivers with correct variables
- [ ] Send test email: Tax season access granted → Email delivers
- [ ] Check spam score → Passing (< 5.0)
- [ ] Verify delivery status tracking → Status updates in database

**Testing Requirements:**
- Manual: Execute validation checklist
- Deliverability: Mail-tester.com

---

### Task IC6.5: Validate IC5 (OpenSpec Sync)
**Description:** Execute IC5 validation checklist
**Dependencies:** IC5.13
**Estimated Effort:** 30 minutes
**Acceptance Criteria:**
- [ ] Read `openspec/changes/moonshot-features/proposal.md` → Matches current Group J
- [ ] Read `VIZ-001/spec.md` → Describes 2D widget (not 3D)
- [ ] Read `AI-001/spec.md` → Describes Smart Automation Assistant
- [ ] Read `CSV-001/spec.md` → Describes CSV Import/Export (not API integrations)
- [ ] Search for `MOBILE-001` → Not found (removed)
- [ ] Search for `FUTURE-001` → Not found (removed)

**Testing Requirements:**
- Manual: Execute validation checklist

---

### Task IC6.6: Performance Validation
**Description:** Execute performance validation checklist
**Dependencies:** IC6.1-IC6.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] Page load time < 2 seconds (Lighthouse, average of 3 runs)
- [ ] IC1 conflict resolution modal opens < 500ms
- [ ] IC2 billing calculation completes < 1 second (100 clients, 10 users)
- [ ] IC4 email queuing completes < 100ms
- [ ] Dashboard with all IC features renders < 3 seconds (cold load)
- [ ] No memory leaks detected (Chrome DevTools, 10-minute session)
- [ ] All API endpoints respond < 1 second (95th percentile)

**Testing Requirements:**
- Performance: Lighthouse, Chrome DevTools

---

### Task IC6.7: Security Validation
**Description:** Execute security validation checklist
**Dependencies:** IC6.1-IC6.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] IC2 Stripe webhook signature validation working
- [ ] IC3 admin endpoints return 403 for non-admin users
- [ ] IC3 CSRF protection enabled on all admin forms
- [ ] IC4 email templates sanitize user input (XSS test)
- [ ] IC2 billing data NOT logged in plaintext
- [ ] Session timeout works (idle 30 minutes → auto-logout)
- [ ] Rate limiting active on auth endpoints (10 failed logins → block)
- [ ] Penetration test: Non-admin cannot access charity management

**Testing Requirements:**
- Security: Manual penetration testing, XSS/CSRF checks

---

### Task IC6.8: Accessibility Validation
**Description:** Execute accessibility validation checklist
**Dependencies:** IC6.1-IC6.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] IC1 conflict resolution modal keyboard navigable (Tab, Esc)
- [ ] IC1 screen reader announces conflict notifications (NVDA test)
- [ ] IC3 admin panel passes WAVE accessibility checker (0 errors)
- [ ] IC4 email templates have sufficient color contrast (4.5:1 ratio)
- [ ] All form inputs have visible labels (not just placeholders)
- [ ] Focus indicators visible on all interactive elements
- [ ] Error messages associated with form fields via aria-describedby

**Testing Requirements:**
- Accessibility: WAVE checker, NVDA screen reader, keyboard navigation

---

### Task IC6.9: Integration Validation
**Description:** Execute integration validation checklist
**Dependencies:** IC6.1-IC6.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] End-to-end: Create subscription (IC2) → Charity calculated (IC2.5) → Email sent (IC4)
- [ ] End-to-end: Admin verifies charity (IC3) → User sees in dropdown → Contribution tracked (IC2.5)
- [ ] End-to-end: User comments with @mention (IC1) → Notification created (I2) → Email sent (IC4)
- [ ] IC1 + I1: Conflict resolution UI integrates with ConflictResolutionService
- [ ] IC2 + H1: Advisor subscription includes team member billing
- [ ] IC4 + IC2: Billing emails send when subscription created

**Testing Requirements:**
- Integration: End-to-end workflow testing

---

### Task IC6.10: Cross-Browser Validation
**Description:** Execute cross-browser validation checklist
**Dependencies:** IC6.1-IC6.5
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] IC1 UI components render correctly in Chrome (latest)
- [ ] IC1 UI components render correctly in Firefox (latest)
- [ ] IC1 UI components render correctly in Safari (latest)
- [ ] IC1 UI components render correctly in Edge (latest)
- [ ] IC2 Stripe checkout flow works in all major browsers
- [ ] IC3 admin panel functional on tablet devices (iPad, 1024x768)
- [ ] IC4 email templates render correctly in Gmail, Outlook, Apple Mail
- [ ] Mobile responsive: Dashboard usable on iPhone SE (375px width)

**Testing Requirements:**
- Cross-browser: Manual testing on Chrome, Firefox, Safari, Edge
- Cross-device: Tablet and mobile testing

---

### Task IC6.11: Document Validation Results
**Description:** Document all validation results and create final report
**Dependencies:** IC6.1-IC6.10
**Estimated Effort:** 2 hours
**Acceptance Criteria:**
- [ ] All validation checklists completed
- [ ] Pass/fail status documented for each check
- [ ] Issues found documented with severity
- [ ] Recommendations for fixes (if any failures)
- [ ] Final gate decision: Green light for Group J or block until fixes

**Testing Requirements:**
- Documentation: Create validation report

---

### Task IC6.12: Green Light or Fix-It Decision
**Description:** Make final gate decision based on validation results
**Dependencies:** IC6.11
**Estimated Effort:** 1 hour
**Acceptance Criteria:**
- [ ] If ALL checks pass → Green light for Group J
- [ ] If ANY check fails → Block Group J, create fix-it tickets
- [ ] Communicate decision to team
- [ ] If green light: Update ROADMAP.md status
- [ ] If blocked: Prioritize fix-it tickets

**Testing Requirements:**
- Manual: Decision-making based on validation results

---

## Summary

**Total Tasks:** 100+ implementation tasks across IC0-IC6
**Estimated Total Effort:** 8-10 weeks for complete Infrastructure Capstone
**Critical Path:** IC0 (validation gate) → IC1 (UI) → IC2-IC4 (infrastructure) → IC5 (docs) → IC6 (final validation)
**Success Criteria:** ALL IC6 validation checklists passing = Green light for Group J

**Parallel Work Opportunities:**
- IC2, IC3, IC4 can be built in parallel after IC0/IC1
- Email templates (IC4.6-IC4.14) can be created in parallel
- OpenSpec updates (IC5.2-IC5.11) can be done in parallel

**Blocking Dependencies:**
- IC0 MUST pass before IC1 begins
- IC6 MUST pass before Group J begins
- All other tasks can proceed in parallel or sequential order as needed
