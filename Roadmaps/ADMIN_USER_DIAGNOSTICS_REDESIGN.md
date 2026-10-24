# Admin User Diagnostics Redesign

> Comprehensive redesign of the admin user management interface for better diagnostics and support

## Overview

This roadmap covers the complete redesign of the admin user list and detail views to provide better diagnostic capabilities for customer support while keeping the interface clean and scannable.

### Goals
- Reduce visual clutter while increasing available information
- Enable support staff to quickly identify and diagnose user issues
- Provide complete email history with rendered previews
- Support filtering by product, workshop, status, and user type
- Match capabilities of enterprise platforms (ActiveCampaign, MailChimp, HubSpot)

### Design Philosophy
- **Tier 1 (Row):** Identity + Status badge - who is this, are they okay?
- **Tier 2 (Expanded Panel):** Grouped cards organized by concern
- **Tier 3 (Detail Page):** Complete history, email previews, activity timeline

---

## Phase 1: Email Storage Infrastructure

**Priority:** Critical (foundational - must be done first)

### Why First?
We need to start capturing rendered emails NOW so we have history to display later. Every day we wait is email history we lose.

### 1.1 Database Schema

Create new `sent_emails` table to store rendered email content:

```sql
-- Migration: XXX_create_sent_emails_table.sql

CREATE TABLE sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who received it
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,  -- Capture email at time of send

  -- Email details
  email_type VARCHAR(50) NOT NULL,  -- 'welcome', 'reminder', 'week1', etc.
  subject VARCHAR(500) NOT NULL,
  html_content TEXT NOT NULL,       -- Full rendered HTML
  text_content TEXT,                -- Plain text version (optional)

  -- Context
  workshop_id UUID REFERENCES workshops(id) ON DELETE SET NULL,
  workshop_enrollment_id UUID REFERENCES workshop_enrollments(id) ON DELETE SET NULL,

  -- Trigger source (what caused this email to be sent)
  triggered_by VARCHAR(50) NOT NULL DEFAULT 'system',  -- 'system', 'cron', 'webhook', 'manual', 'admin'
  triggered_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,

  -- Delivery tracking
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_status VARCHAR(30) DEFAULT 'sent',  -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'spam_complaint'
  delivery_status_updated_at TIMESTAMPTZ,

  -- Bounce details
  bounce_type VARCHAR(20),  -- 'soft', 'hard'
  bounce_reason TEXT,

  -- Engagement tracking
  opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  clicked_at TIMESTAMPTZ,
  click_count INTEGER DEFAULT 0,

  -- Provider details
  delivery_provider VARCHAR(50),    -- 'resend', 'sendgrid', etc.
  provider_message_id VARCHAR(255), -- External tracking ID

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sent_emails_user_id ON sent_emails(user_id);
CREATE INDEX idx_sent_emails_recipient ON sent_emails(recipient_email);
CREATE INDEX idx_sent_emails_sent_at ON sent_emails(sent_at DESC);
CREATE INDEX idx_sent_emails_workshop ON sent_emails(workshop_id) WHERE workshop_id IS NOT NULL;
CREATE INDEX idx_sent_emails_type ON sent_emails(email_type);
CREATE INDEX idx_sent_emails_status ON sent_emails(delivery_status);
CREATE INDEX idx_sent_emails_bounced ON sent_emails(delivery_status) WHERE delivery_status IN ('bounced', 'failed', 'spam_complaint');

COMMENT ON TABLE sent_emails IS 'Stores all rendered emails sent to users for support diagnostics';
COMMENT ON COLUMN sent_emails.html_content IS 'Complete rendered HTML as received by user';
COMMENT ON COLUMN sent_emails.triggered_by IS 'What initiated this email: system automation, cron job, webhook, manual action, or admin';
```

### 1.2 Email Suppression List

Track users who should not receive emails:

```sql
-- Migration: XXX_create_email_suppressions_table.sql

CREATE TABLE email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who is suppressed
  email VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Why suppressed
  suppression_type VARCHAR(30) NOT NULL,  -- 'unsubscribed', 'hard_bounce', 'spam_complaint', 'manual'
  suppression_reason TEXT,

  -- What emails are suppressed
  email_types TEXT[] DEFAULT '{}',  -- Empty = all emails, or specific types like ['marketing', 'reminder']

  -- Tracking
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suppressed_by_admin_id UUID REFERENCES admin_users(id),

  -- Reactivation
  reactivated_at TIMESTAMPTZ,
  reactivated_by_admin_id UUID REFERENCES admin_users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_email_suppressions_email ON email_suppressions(email) WHERE reactivated_at IS NULL;
CREATE INDEX idx_email_suppressions_user ON email_suppressions(user_id);
CREATE INDEX idx_email_suppressions_type ON email_suppressions(suppression_type);

COMMENT ON TABLE email_suppressions IS 'Email suppression list - users who should not receive emails';
```

### 1.3 Scheduled/Pending Emails

Track emails that are scheduled but not yet sent:

```sql
-- Migration: XXX_create_scheduled_emails_table.sql

CREATE TABLE scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who will receive it
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Email details (pre-rendered or template reference)
  email_type VARCHAR(50) NOT NULL,
  subject VARCHAR(500),
  html_content TEXT,  -- If pre-rendered
  template_data JSONB,  -- If using template, store variables

  -- Context
  workshop_id UUID REFERENCES workshops(id) ON DELETE CASCADE,
  workshop_enrollment_id UUID REFERENCES workshop_enrollments(id) ON DELETE CASCADE,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'processing', 'sent', 'cancelled', 'failed'

  -- If sent, link to sent_emails
  sent_email_id UUID REFERENCES sent_emails(id),

  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancelled_by_admin_id UUID REFERENCES admin_users(id),
  cancellation_reason TEXT,

  -- Error tracking
  last_error TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_emails_user ON scheduled_emails(user_id);
CREATE INDEX idx_scheduled_emails_scheduled ON scheduled_emails(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_scheduled_emails_status ON scheduled_emails(status);
CREATE INDEX idx_scheduled_emails_workshop ON scheduled_emails(workshop_id);

COMMENT ON TABLE scheduled_emails IS 'Emails scheduled for future delivery';
```

### 1.4 Email Service Updates

Modify email sending functions to capture rendered content:

**Files to modify:**
- `audacious_money_backend/src/services/email.service.ts`
- `audacious_money_backend/src/services/workshopEmail.service.ts` (if separate)

**Changes:**
```typescript
// Before sending email, store the rendered content
interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  userId: string;
  emailType: string;
  workshopId?: string;
  workshopEnrollmentId?: string;
  triggeredBy?: 'system' | 'cron' | 'webhook' | 'manual' | 'admin';
  triggeredByAdminId?: string;
}

async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  // 0. Check suppression list first
  const isSuppressed = await checkEmailSuppression(options.to, options.emailType);
  if (isSuppressed) {
    console.log(`[Email] Skipping ${options.emailType} to ${options.to} - suppressed`);
    return { success: false, reason: 'suppressed' };
  }

  // 1. Send email via provider (existing logic)
  const result = await resend.emails.send({
    from: 'Audacious Money <hello@audacious.money>',
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  // 2. Store sent email record (NEW)
  await db.query(`
    INSERT INTO sent_emails (
      user_id, recipient_email, email_type, subject, html_content, text_content,
      workshop_id, workshop_enrollment_id,
      triggered_by, triggered_by_admin_id,
      delivery_status, delivery_provider, provider_message_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `, [
    options.userId,
    options.to,
    options.emailType,
    options.subject,
    options.html,
    options.text || null,
    options.workshopId || null,
    options.workshopEnrollmentId || null,
    options.triggeredBy || 'system',
    options.triggeredByAdminId || null,
    result.success ? 'sent' : 'failed',
    'resend',
    result.messageId || null,
  ]);

  return result;
}
```

### 1.5 Webhook Handler for Delivery Status

Handle delivery status updates from email provider:

```typescript
// POST /webhooks/email-status (from Resend/SendGrid)
async function handleEmailStatusWebhook(event: EmailEvent) {
  const { messageId, status, bounceType, timestamp } = event;

  await db.query(`
    UPDATE sent_emails
    SET
      delivery_status = $1,
      delivery_status_updated_at = $2,
      bounce_type = $3,
      bounce_reason = $4,
      opened_at = CASE WHEN $1 = 'opened' AND opened_at IS NULL THEN $2 ELSE opened_at END,
      open_count = CASE WHEN $1 = 'opened' THEN open_count + 1 ELSE open_count END,
      clicked_at = CASE WHEN $1 = 'clicked' AND clicked_at IS NULL THEN $2 ELSE clicked_at END,
      click_count = CASE WHEN $1 = 'clicked' THEN click_count + 1 ELSE click_count END
    WHERE provider_message_id = $5
  `, [status, timestamp, bounceType, event.reason, messageId]);

  // Auto-suppress on hard bounce or spam complaint
  if (status === 'bounced' && bounceType === 'hard' || status === 'spam_complaint') {
    await addToSuppressionList(event.email, status);
  }
}
```

### 1.6 Update All Email Senders

Audit and update all places that send emails:

| Location | Email Type | Status |
|----------|------------|--------|
| Workshop welcome email | `welcome` | To update |
| Workshop reminder email | `reminder` | To update |
| Workshop week 1-4 emails | `week1`, `week2`, `week3`, `week4` | To update |
| Workshop wrap-up email | `wrapUp` | To update |
| Trial ending email | `trialEnding` | To update |
| Password reset email | `passwordReset` | To update |
| Email verification | `emailVerification` | To update |
| Payment receipt | `paymentReceipt` | To update |
| Payment failed | `paymentFailed` | To update |

### 1.7 Deliverables Checklist

- [ ] Create migration for `sent_emails` table
- [ ] Create migration for `email_suppressions` table
- [ ] Create migration for `scheduled_emails` table
- [ ] Run migrations on staging
- [ ] Update email service with storage logic
- [ ] Add suppression list checking
- [ ] Implement email status webhook handler
- [ ] Update workshop email service
- [ ] Update password reset email
- [ ] Update email verification
- [ ] Update payment emails
- [ ] Test email storage on staging
- [ ] Run migrations on production
- [ ] Deploy updated email services
- [ ] Verify emails are being stored
- [ ] Verify webhook is receiving status updates

---

## Phase 2: Enhanced Admin API

**Priority:** High

### 2.1 New Endpoint: User Details

`GET /admin/users/:userId/details`

Returns comprehensive user data organized for the tiered UI:

```typescript
interface UserDetailsResponse {
  // Tier 1 data (for row display)
  summary: {
    id: string;
    email: string;
    name: string;
    companyName: string | null;
    supportKey: string;
    statusBadge: StatusBadge;
    workshopBadge: WorkshopBadge | null;
    isBeta: boolean;
  };

  // Tier 2 data (for expanded cards)
  cards: {
    account: {
      userId: string;
      createdAt: string;
      lastLoginAt: string | null;
      emailVerified: boolean;
      accountStatus: string;
      isBeta: boolean;
    };

    subscription: {
      products: Array<{
        name: string;
        slug: string;
        status: string;
        activatedAt: string;
        trialEndsAt: string | null;
        trialConverted: boolean;
        currentPeriodEnd: string | null;
        gracePeriodEndsAt: string | null;
        pausedAt: string | null;
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
      }>;
    };

    workshop: {
      workshopId: string;
      cohortName: string;
      enrolledAt: string;
      status: string;
      trialExpiresAt: string | null;
      convertedToPaidAt: string | null;
      worksheetCompletedAt: string | null;
      firstLoginAt: string | null;
      lastActiveAt: string | null;
      emailsSentCount: number;
    } | null;  // null if not a workshop user

    health: {
      isFrozen: boolean;
      frozenReason: string | null;  // 'trial_expired', 'cancelled', 'payment_failed', etc.
      hasPaymentIssue: boolean;
      issuesSummary: string[];  // ["Payment failed", "Trial expires in 2 days"]
    };

    emailHealth: {
      isSuppressed: boolean;
      suppressionType: string | null;
      totalEmailsSent: number;
      totalOpened: number;
      totalClicked: number;
      lastEmailSentAt: string | null;
      lastOpenedAt: string | null;
      bounceCount: number;
    };
  };
}

interface StatusBadge {
  label: string;      // "ACTIVE", "TRIAL (3 days)", "FROZEN", "BETA"
  variant: 'success' | 'warning' | 'error' | 'info' | 'purple';
  details?: string;   // Additional hover text
}

interface WorkshopBadge {
  cohortName: string;
  shortName: string;  // "Oct 2026" for display
}
```

### 2.2 New Endpoint: User Email History

`GET /admin/users/:userId/emails`

Returns complete email history with rendered content:

```typescript
interface EmailHistoryResponse {
  emails: Array<{
    id: string;
    emailType: string;
    subject: string;
    sentAt: string;

    // Delivery tracking
    deliveryStatus: string;
    deliveryStatusUpdatedAt: string | null;
    bounceType: string | null;
    bounceReason: string | null;

    // Engagement
    openedAt: string | null;
    openCount: number;
    clickedAt: string | null;
    clickCount: number;

    // Trigger info
    triggeredBy: string;
    triggeredByAdminName: string | null;

    // For preview
    htmlContent: string;
    textContent: string | null;

    // Context
    workshopName: string | null;
  }>;

  // Scheduled emails (upcoming)
  scheduled: Array<{
    id: string;
    emailType: string;
    subject: string | null;
    scheduledFor: string;
    status: string;
    workshopName: string | null;
  }>;

  // Suppression status
  suppression: {
    isSuppressed: boolean;
    suppressionType: string | null;
    suppressedAt: string | null;
    reason: string | null;
  } | null;

  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
}
```

Query parameters:
- `page` (default: 1)
- `pageSize` (default: 50)
- `emailType` (optional filter)
- `status` (optional: 'delivered', 'opened', 'bounced', etc.)

### 2.3 New Endpoint: Resend Email

`POST /admin/users/:userId/emails/:emailId/resend`

Resend a previously sent email:

```typescript
interface ResendEmailRequest {
  // Optional: modify before resending
  newSubject?: string;
}

interface ResendEmailResponse {
  success: boolean;
  newEmailId: string;
  message: string;
}
```

### 2.4 New Endpoint: Cancel Scheduled Email

`DELETE /admin/users/:userId/scheduled-emails/:scheduledEmailId`

Cancel a scheduled email:

```typescript
interface CancelScheduledEmailRequest {
  reason?: string;
}
```

### 2.5 New Endpoint: Manage Suppression

`POST /admin/users/:userId/email-suppression`
`DELETE /admin/users/:userId/email-suppression`

Add or remove user from suppression list:

```typescript
interface AddSuppressionRequest {
  suppressionType: 'manual';
  reason: string;
  emailTypes?: string[];  // Empty = all emails
}
```

### 2.6 Update User List Endpoint

`GET /admin/users`

Add new query parameters for filtering:

```typescript
// Query parameters
interface UserListQuery {
  // Existing
  search?: string;       // Email, name, or support key

  // New filters
  product?: string;      // Product slug: 'cpu-cpg', 'bookkeeping-suite'
  workshop?: string;     // Workshop ID or 'any' for all workshop users
  status?: string;       // 'active', 'trialing', 'frozen', 'paused'
  isBeta?: boolean;      // true = beta users only
  needsAttention?: boolean;  // true = frozen, payment issues, trial expiring
  emailSuppressed?: boolean; // true = users on suppression list

  // Pagination
  page?: number;
  pageSize?: number;
}
```

Update response to include computed badges:

```typescript
interface UserListItem {
  // Existing fields
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  supportKey: string;

  // New computed fields
  statusBadge: StatusBadge;
  workshopBadge: WorkshopBadge | null;
  isBeta: boolean;
  needsAttention: boolean;
  isEmailSuppressed: boolean;

  // Remove from list view (move to details)
  // accountStatus, emailVerified, createdAt, lastLoginAt, subscriptionStatus
}
```

### 2.7 Status Badge Computation Logic

```typescript
function computeStatusBadge(user: UserWithProducts): StatusBadge {
  // Priority order (highest first)

  // 1. Beta users
  if (user.isBeta) {
    return { label: 'BETA', variant: 'purple' };
  }

  // 2. Frozen/Problem states
  if (isFrozen(user)) {
    const reason = getFrozenReason(user);
    return {
      label: 'FROZEN',
      variant: 'error',
      details: reason
    };
  }

  // 3. Payment issues (grace period)
  if (user.gracePeriodEndsAt) {
    const daysLeft = daysUntil(user.gracePeriodEndsAt);
    return {
      label: 'PAYMENT ISSUE',
      variant: 'error',
      details: `Grace period: ${daysLeft} days left`
    };
  }

  // 4. Paused
  if (user.status === 'paused') {
    return { label: 'PAUSED', variant: 'info' };
  }

  // 5. Trial with days remaining
  if (user.status === 'trialing' || user.status === 'trial') {
    const daysLeft = daysUntil(user.trialEndsAt);
    if (daysLeft <= 3) {
      return {
        label: `TRIAL (${daysLeft}d)`,
        variant: 'warning'
      };
    }
    return {
      label: `TRIAL (${daysLeft}d)`,
      variant: 'info'
    };
  }

  // 6. Active
  if (user.status === 'active') {
    return { label: 'ACTIVE', variant: 'success' };
  }

  // 7. Fallback
  return { label: user.status.toUpperCase(), variant: 'info' };
}
```

### 2.8 Deliverables Checklist

- [ ] Create `GET /admin/users/:userId/details` endpoint
- [ ] Create `GET /admin/users/:userId/emails` endpoint
- [ ] Create `POST /admin/users/:userId/emails/:emailId/resend` endpoint
- [ ] Create `DELETE /admin/users/:userId/scheduled-emails/:id` endpoint
- [ ] Create suppression management endpoints
- [ ] Add filter parameters to `GET /admin/users`
- [ ] Implement status badge computation
- [ ] Implement workshop badge computation
- [ ] Add `needsAttention` filter logic
- [ ] Add `emailSuppressed` filter logic
- [ ] Update API documentation
- [ ] Write unit tests for badge logic
- [ ] Test endpoints on staging

---

## Phase 3: User Deletion & GDPR Compliance

**Priority:** High

### 3.1 User Deletion Flow

Complete user deletion with proper cleanup:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Delete User: jane@example.com                                    [X]    │
│─────────────────────────────────────────────────────────────────────────│
│                                                                         │
│  ⚠️  This action is PERMANENT and cannot be undone.                     │
│                                                                         │
│  The following will be deleted:                                         │
│  • User account and profile                                             │
│  • All subscription data                                                │
│  • Workshop enrollment records                                          │
│  • Email history (3 emails)                                             │
│  • Activity logs                                                        │
│  • Any local data on user's devices will become orphaned               │
│                                                                         │
│  The following will be CANCELLED in Stripe:                             │
│  • Subscription: sub_xxxxx (Product Costing Tool)                       │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Type "DELETE jane@example.com" to confirm:                             │
│  [_________________________________________________]                   │
│                                                                         │
│  Reason for deletion (required):                                        │
│  [User requested account deletion___________________]                   │
│                                                                         │
│  [Cancel]                              [Delete User Permanently]        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Deletion API Endpoint

`DELETE /admin/users/:userId`

Already exists but needs enhancement:

```typescript
interface DeleteUserRequest {
  confirmEmail: string;  // Must match user's email
  reason: string;        // Required audit trail
}

interface DeleteUserResponse {
  success: boolean;
  deletedData: {
    userId: string;
    email: string;
    subscriptionsCancelled: number;
    emailsDeleted: number;
    enrollmentsDeleted: number;
  };
  warnings?: string[];  // Any issues during deletion
}
```

### 3.3 Pre-Deletion Checklist (Backend)

Before deleting, the system must:

1. **Cancel Stripe subscriptions** - Already implemented
2. **Cancel scheduled emails** - Mark all pending emails as cancelled
3. **Log deletion in audit trail** - With full user data snapshot
4. **Remove from suppression list** - Clean up email suppressions
5. **Cascade delete** - Database handles via ON DELETE CASCADE

### 3.4 GDPR Data Export

`GET /admin/users/:userId/export`

Export all user data (for GDPR "right to access"):

```typescript
interface UserDataExport {
  exportedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyName: string | null;
    createdAt: string;
    // ... all user fields
  };
  subscriptions: Array<{...}>;
  payments: Array<{...}>;
  workshopEnrollments: Array<{...}>;
  emailHistory: Array<{
    type: string;
    subject: string;
    sentAt: string;
    // Content NOT included for size
  }>;
  activityLog: Array<{...}>;
}
```

### 3.5 Deliverables Checklist

- [ ] Enhance DELETE /admin/users/:userId endpoint
- [ ] Add confirmation requirement (type email)
- [ ] Add reason requirement
- [ ] Cancel all scheduled emails on deletion
- [ ] Remove from suppression list on deletion
- [ ] Log complete user snapshot before deletion
- [ ] Create GET /admin/users/:userId/export endpoint
- [ ] Add "Delete User" button to Actions Tab
- [ ] Create DeleteUserModal component with confirmation
- [ ] Test deletion flow end-to-end
- [ ] Verify Stripe subscriptions cancelled
- [ ] Verify cascade delete works correctly

---

## Phase 4: Contact Notes & Internal Tags

**Priority:** Medium

Enterprise CRM platforms allow support staff to add internal notes and tags to contacts.

### 4.1 Database Schema

```sql
-- Migration: XXX_create_user_notes_table.sql

CREATE TABLE user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Note content
  note TEXT NOT NULL,
  note_type VARCHAR(30) DEFAULT 'general',  -- 'general', 'support', 'billing', 'technical'

  -- Who created it
  created_by_admin_id UUID NOT NULL REFERENCES admin_users(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_notes_user ON user_notes(user_id);
CREATE INDEX idx_user_notes_created ON user_notes(created_at DESC);

-- Internal tags for users
CREATE TABLE user_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  tag VARCHAR(50) NOT NULL,

  created_by_admin_id UUID NOT NULL REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, tag)
);

CREATE INDEX idx_user_tags_user ON user_tags(user_id);
CREATE INDEX idx_user_tags_tag ON user_tags(tag);

COMMENT ON TABLE user_notes IS 'Internal support notes on users - not visible to users';
COMMENT ON TABLE user_tags IS 'Internal tags for categorizing users - e.g., VIP, needs-followup, technical-issues';
```

### 4.2 Notes UI in Detail Page

Add to Overview or new Notes tab:

```
┌─ Internal Notes ────────────────────────────────────────────────────────┐
│                                                                         │
│  [+ Add Note]                                                           │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Oct 20, 2026 at 3:15 PM by Sarah (Support)                        │ │
│  │ Type: Support                                                      │ │
│  │ ────────────────────────────────────────────────────────────────── │ │
│  │ User called about invoice questions. Explained how the cost       │ │
│  │ breakdown works. Very friendly, seemed satisfied with explanation. │ │
│  │                                                                    │ │
│  │ [Edit] [Delete]                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Oct 15, 2026 at 10:30 AM by Tom (Admin)                           │ │
│  │ Type: General                                                      │ │
│  │ ────────────────────────────────────────────────────────────────── │ │
│  │ Workshop attendee - mentioned she runs a bakery with 3 locations.  │ │
│  │ Good candidate for case study if she converts.                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─ Tags ──────────────────────────────────────────────────────────────────┐
│                                                                         │
│  [VIP] [case-study-candidate] [bakery]              [+ Add Tag]        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Deliverables Checklist

- [ ] Create migration for `user_notes` table
- [ ] Create migration for `user_tags` table
- [ ] Create CRUD endpoints for notes
- [ ] Create CRUD endpoints for tags
- [ ] Add Notes section to user detail page
- [ ] Add Tags display and management
- [ ] Add filter by tag to user list

---

## Phase 5: Frontend - Redesigned User List

**Priority:** High

### 5.1 Filter Bar Component

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Search by name, email, support key...]                                 │
│                                                                         │
│ [All Users ▼] [Product ▼] [Workshop ▼] [Status ▼] [Beta] [Needs Attn]  │
│                  │           │            │                             │
│                  │           │            └─ Active, Trial, Frozen,     │
│                  │           │               Paused, Cancelled          │
│                  │           │                                          │
│                  │           └─ All Workshops, October 2026,            │
│                  │              September 2026, No Workshop             │
│                  │                                                      │
│                  └─ All Products, Product Costing Tool,                 │
│                     Bookkeeping Suite, No Product                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Files to create:**
- `src/components/admin/users/UserFilterBar.tsx`
- `src/components/admin/users/UserFilterBar.module.css`

### 5.2 User Row Component (Tier 1)

Simplified row showing only essential info + status badges:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Jane Smith                    jane@example.com         [TRIAL (3d)]    │
│ Acme Corp                     ABC1-DEF2-GHI3           [Workshop: Oct] │
│                                                              [Expand ▼]│
└─────────────────────────────────────────────────────────────────────────┘
```

**Badge colors:**
- `ACTIVE` - Green (#276749)
- `TRIAL (Xd)` - Blue (#2c5282) or Yellow (#92400e) if <=3 days
- `FROZEN` - Red (#9b2c2c)
- `PAYMENT ISSUE` - Red (#9b2c2c)
- `PAUSED` - Gray (#475569)
- `BETA` - Purple (#6b21a8)
- `Workshop: Name` - Teal (#0f766e)
- `EMAIL ISSUE` - Orange (#9a3412) - for bounced/suppressed

**Files to create:**
- `src/components/admin/users/UserRow.tsx`
- `src/components/admin/users/UserRow.module.css`
- `src/components/admin/users/StatusBadge.tsx`

### 5.3 Expanded Panel Component (Tier 2)

Cards layout when row is expanded:

```
┌─ Account ──────────────────┐  ┌─ Subscription ─────────────────┐
│ User ID: abc-123...        │  │ Product: Product Costing Tool  │
│ Created: Oct 15, 2026      │  │ Status: Trialing               │
│ Last Login: 2 hours ago    │  │ Trial Ends: Oct 27 (3 days)    │
│ Email Verified: Yes        │  │ Converted: No                  │
│ Beta User: No              │  │ Stripe: cus_xxx [View]         │
└────────────────────────────┘  └─────────────────────────────────┘

┌─ Workshop ─────────────────┐  ┌─ Health ───────────────────────┐
│ Cohort: October 2026       │  │ Account: Active (not frozen)   │
│ Enrolled: Oct 10, 2026     │  │ Worksheet: Completed           │
│ Trial Expires: Oct 27      │  │ Last Active: Today             │
│ Emails Sent: 3 of 8        │  │ Email: Delivering OK           │
│ [View Details]             │  │ Issues: None                   │
└────────────────────────────┘  └─────────────────────────────────┘
```

**Conditional rendering:**
- Workshop card only shown for workshop users
- Health card shows issues prominently if any exist
- Email health shown in Health card

**Files to create:**
- `src/components/admin/users/UserExpandedPanel.tsx`
- `src/components/admin/users/UserExpandedPanel.module.css`
- `src/components/admin/users/InfoCard.tsx`

### 5.4 Updated User List Page

Integrate all components:

**Files to modify:**
- `src/pages/admin/AdminDashboard.tsx` (or create new `UserListPage.tsx`)

**Files to create:**
- `src/hooks/useUserFilters.ts`
- `src/hooks/useUserDetails.ts`

### 5.5 Deliverables Checklist

- [ ] Create UserFilterBar component
- [ ] Create StatusBadge component
- [ ] Create UserRow component
- [ ] Create UserExpandedPanel component
- [ ] Create InfoCard component
- [ ] Create useUserFilters hook
- [ ] Create useUserDetails hook
- [ ] Update AdminDashboard/UserListPage
- [ ] Style with brand colors (autumn palette)
- [ ] Add loading states
- [ ] Add empty states
- [ ] Test filter combinations
- [ ] Test responsive layout
- [ ] Accessibility audit (WCAG 2.1 AA)

---

## Phase 6: Frontend - User Detail Page (Tier 3)

**Priority:** Medium

### 6.1 Page Layout

Full detail page accessible via "View Details" or clicking user row:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [← Back to Users]                                                       │
│                                                                         │
│ Jane Smith                                              [TRIAL (3d)]   │
│ jane@example.com | Acme Corp | ABC1-DEF2-GHI3          [Workshop: Oct] │
│                                                                         │
│ ═══════════════════════════════════════════════════════════════════════│
│                                                                         │
│ [Overview] [Subscription] [Workshop] [Emails] [Activity] [Actions]     │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│  (Tab content area)                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Route:** `/admin/users/:userId`

### 6.2 Overview Tab

Summary of all key information at a glance:

```
┌─ Quick Stats ───────────────────────────────────────────────────────────┐
│                                                                         │
│  Account Created     Last Login        Email Status    Account Status   │
│  Oct 10, 2026        2 hours ago       Verified        Active           │
│                                                                         │
│  Product             Status            Trial Ends      Lifetime Value   │
│  Product Costing     Trialing          Oct 27 (3d)     $0.00            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─ Health Check ──────────────────────────────────────────────────────────┐
│                                                                         │
│  [!] Trial expires in 3 days                                            │
│  [✓] Worksheet completed                                                │
│  [✓] Email verified                                                     │
│  [✓] Has logged in recently                                             │
│  [✓] Emails delivering (3 sent, 3 opened)                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─ Internal Notes ────────────────────────────────────────────────────────┐
│  Latest: "Workshop attendee - runs bakery with 3 locations" - Tom      │
│  [View All Notes (2)]                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Emails Tab (with Preview)

Complete email history with expandable previews:

```
┌─ Email History ─────────────────────────────────────────────────────────┐
│                                                                         │
│  Filter: [All Types ▼] [All Status ▼]                     3 emails sent │
│                                                                         │
│  Suppression Status: Not suppressed [Manage]                            │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  UPCOMING (Scheduled)                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Trial Ending Email                    Scheduled: Oct 24 · 9:00 AM  │ │
│  │ Status: Pending                                                    │ │
│  │                                               [Cancel] [Reschedule]│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  SENT                                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Week 1 Follow-up                           Oct 22, 2026 · 9:00 AM  │ │
│  │ Subject: Week 1: How's Your Progress?                             │ │
│  │ Status: Opened (2x)  •  Clicked (1x)       Triggered by: Cron     │ │
│  │                                                    [Preview ▼]     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│      ┌──────────────────────────────────────────────────────────────┐   │
│      │                                                              │   │
│      │  [Rendered email preview - exactly as user received it]      │   │
│      │                                                              │   │
│      │  [View Full Email] [View Raw HTML] [Resend]                  │   │
│      │                                                              │   │
│      └──────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Reminder Email                             Oct 14, 2026 · 9:00 AM  │ │
│  │ Subject: Your Workshop Starts Tomorrow!                           │ │
│  │ Status: Delivered  •  Opened (1x)          Triggered by: Cron     │ │
│  │                                                    [Preview ▶]     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Welcome Email                              Oct 10, 2026 · 2:15 PM  │ │
│  │ Subject: Welcome to Your Product Costing Journey!                 │ │
│  │ Status: Delivered  •  Opened (3x)          Triggered by: System   │ │
│  │                                                    [Preview ▶]     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Email row shows:**
- Email type and subject
- Sent date/time
- Delivery status with engagement (Delivered, Opened Xx, Clicked Xx)
- What triggered it (System, Cron, Manual, Admin name)
- Expandable preview
- Actions: Preview, View Full, View Raw HTML, Resend

### 6.4 Actions Tab

Admin actions available for this user:

```
┌─ User Actions ──────────────────────────────────────────────────────────┐
│                                                                         │
│  Subscription Actions                                                   │
│  ├─ [Extend Trial]        Add days to trial period                      │
│  ├─ [Convert to Paid]     Manually start paid subscription              │
│  └─ [Cancel Subscription] Cancel subscription                           │
│                                                                         │
│  Email Actions                                                          │
│  ├─ [Send Custom Email]   Send a one-off email to user                  │
│  ├─ [Suppress Emails]     Stop sending emails to this user              │
│  └─ [View Scheduled]      View/cancel upcoming scheduled emails         │
│                                                                         │
│  Account Actions                                                        │
│  ├─ [Suspend Account]     Temporarily suspend access                    │
│  ├─ [Resend Verification] Send email verification again                 │
│  └─ [Reset Password]      Send password reset email                     │
│                                                                         │
│  Support Actions                                                        │
│  ├─ [Add Note]            Add internal note about this user             │
│  ├─ [Login As User]       Impersonate for debugging (logged)            │
│  └─ [Export User Data]    Download all user data (GDPR)                 │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  Danger Zone                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  [Delete User]                                                     │ │
│  │  Permanently delete this user and all their data.                  │ │
│  │  This action cannot be undone.                                     │ │
│  │  All Stripe subscriptions will be cancelled.                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Files to Create

**Pages:**
- `src/pages/admin/UserDetailPage.tsx`
- `src/pages/admin/UserDetailPage.module.css`

**Components:**
- `src/components/admin/users/detail/UserDetailHeader.tsx`
- `src/components/admin/users/detail/UserDetailTabs.tsx`
- `src/components/admin/users/detail/OverviewTab.tsx`
- `src/components/admin/users/detail/SubscriptionTab.tsx`
- `src/components/admin/users/detail/WorkshopTab.tsx`
- `src/components/admin/users/detail/EmailsTab.tsx`
- `src/components/admin/users/detail/EmailPreviewModal.tsx`
- `src/components/admin/users/detail/ActivityTab.tsx`
- `src/components/admin/users/detail/ActionsTab.tsx`
- `src/components/admin/users/detail/DeleteUserModal.tsx`
- `src/components/admin/users/detail/NotesSection.tsx`

**Hooks:**
- `src/hooks/useUserEmails.ts`
- `src/hooks/useUserActivity.ts`
- `src/hooks/useUserNotes.ts`

### 6.6 Deliverables Checklist

- [ ] Create UserDetailPage
- [ ] Create UserDetailHeader
- [ ] Create UserDetailTabs
- [ ] Create OverviewTab with notes preview
- [ ] Create SubscriptionTab
- [ ] Create WorkshopTab
- [ ] Create EmailsTab with scheduled emails section
- [ ] Create EmailPreviewModal
- [ ] Create ActivityTab
- [ ] Create ActionsTab with all actions
- [ ] Create DeleteUserModal with confirmation
- [ ] Create NotesSection
- [ ] Add route `/admin/users/:userId`
- [ ] Implement useUserEmails hook
- [ ] Implement useUserNotes hook
- [ ] Style with brand colors
- [ ] Test email preview rendering (XSS safe!)
- [ ] Test resend email functionality
- [ ] Test cancel scheduled email
- [ ] Test user deletion flow
- [ ] Test all action buttons
- [ ] Accessibility audit

---

## Phase 7: Activity Tracking (Optional Enhancement)

**Priority:** Low

This phase adds activity tracking to enable the Activity Timeline in Tier 3.

### 7.1 Activity Log Table

```sql
CREATE TABLE user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  activity_type VARCHAR(50) NOT NULL,  -- 'login', 'page_view', 'action', 'system'
  activity_name VARCHAR(100) NOT NULL, -- 'Logged in', 'Viewed dashboard', etc.

  metadata JSONB DEFAULT '{}',  -- Additional context

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_activity_user_id ON user_activity_log(user_id);
CREATE INDEX idx_user_activity_created ON user_activity_log(created_at DESC);
```

### 7.2 Activity Tracking Points

| Activity | Type | Name |
|----------|------|------|
| User logs in | `login` | `Logged in` |
| User logs out | `login` | `Logged out` |
| Page view | `page_view` | `Viewed {page name}` |
| Export data | `action` | `Exported {report type}` |
| Email sent | `system` | `{Email type} email sent` |
| Trial started | `system` | `Trial started` |
| Payment successful | `system` | `Payment processed` |
| Worksheet completed | `action` | `Completed worksheet` |

### 7.3 Deliverables Checklist

- [ ] Create migration for `user_activity_log`
- [ ] Create activity logging service
- [ ] Add login/logout tracking
- [ ] Add key page view tracking
- [ ] Add action tracking
- [ ] Create API endpoint for activity history
- [ ] Integrate with Activity Tab

---

## Implementation Order

```
Phase 1 (Email Storage)
         │
         ▼
Phase 2 (Admin API)
         │
         ▼
Phase 3 (User Deletion & GDPR) ─────┐
         │                          │
         ▼                          │ Can be done in parallel
Phase 4 (Notes & Tags) ─────────────┘
         │
         ▼
Phase 5 (User List UI)
         │
         ▼
Phase 6 (Detail Page)
         │
         ▼
Phase 7 (Activity Tracking - Optional)
```

**Recommended Start:** Phase 1 immediately - every day we wait is email history we lose.

---

## Testing Checklist

### Unit Tests
- [ ] Status badge computation logic
- [ ] Filter query building
- [ ] Date/time formatting helpers
- [ ] Frozen state detection
- [ ] Email suppression checking

### Integration Tests
- [ ] Email storage on send
- [ ] Email status webhook handling
- [ ] User details endpoint
- [ ] Email history endpoint
- [ ] Email resend endpoint
- [ ] Scheduled email cancellation
- [ ] User deletion with Stripe cancellation
- [ ] Filter combinations

### E2E Tests
- [ ] Filter users by product
- [ ] Filter users by workshop
- [ ] Filter users by status
- [ ] Expand user row
- [ ] Navigate to detail page
- [ ] Preview email content
- [ ] Resend an email
- [ ] Cancel scheduled email
- [ ] Add/remove email suppression
- [ ] Add internal note
- [ ] Delete user with confirmation
- [ ] Export user data

### Security Tests
- [ ] Email preview XSS prevention (sanitize HTML!)
- [ ] Admin permission checks
- [ ] Audit logging for all actions
- [ ] User deletion audit trail
- [ ] GDPR export completeness

---

## Security Considerations

### Email Preview Security
- **CRITICAL:** Email HTML must be sanitized before display
- Use iframe with sandbox attribute OR DOMPurify for inline display
- Never execute scripts from stored emails
- Consider CSP headers for admin pages

### Admin Actions
- All actions must be logged to audit trail
- Destructive actions require confirmation (type email to confirm)
- "Login As User" must be heavily logged and time-limited
- User deletion requires reason and creates immutable audit record

### Data Retention
- Sent emails retained for support purposes
- Consider retention policy (e.g., 2 years)
- Deleted user audit logs retained permanently

---

## Success Metrics

After implementation, measure:
- Time to diagnose user issue (target: <2 minutes)
- Support ticket resolution rate
- Admin satisfaction with new interface
- Number of times email preview is used
- Number of times email resend is used
- Reduction in "what email did they receive?" questions

---

**Created:** October 24, 2026
**Last Updated:** October 24, 2026
**Status:** Planning
