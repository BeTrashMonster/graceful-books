# Email Scheduling System Roadmap

## Overview

Replace the fragile Postmark `SendAt` approach with a robust, database-backed email scheduling system that provides full visibility, control, and reliability for workshop email sequences.

## Current State (Problems)

- Emails scheduled via Postmark's `SendAt` at signup time
- No database record of what's scheduled
- No visibility into pending emails
- No ability to cancel or modify scheduled emails
- Dates calculated at signup; if wrong, emails send immediately
- No retry logic for failed emails
- Email logic scattered across signup endpoint, webhooks, and admin features

## Target State (Goals)

- All scheduled emails stored in database with status tracking
- Background worker (cron endpoint) sends emails at the right time
- Full admin visibility and control
- Proper error handling and retry logic
- Audit trail for compliance
- Ability to pause, cancel, or reschedule emails

## Key Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN CREATES WORKSHOP                            │
│  - Sets email schedule config (custom_email_schedule JSONB)                 │
│  - Sets custom templates (custom_email_templates JSONB)                     │
│  - Sets workshop timing (start, end, access grant datetime)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER SIGNS UP                                    │
│  - Enrollment created in workshop_enrollments                               │
│  - Email schedule calculated from workshop config                           │
│  - Rows inserted into scheduled_emails table                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CRON WORKER (every 5 minutes)                           │
│  - Queries scheduled_emails WHERE scheduled_for <= NOW() AND status=pending │
│  - Fetches current template from workshop config (allows updates)           │
│  - Sends via Postmark (immediate, no SendAt)                                │
│  - Updates status to 'sent' with postmark_message_id                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN DASHBOARD                                     │
│  - View all scheduled/sent/failed emails                                    │
│  - Cancel pending emails                                                    │
│  - Retry failed emails                                                      │
│  - Manually trigger emails for existing enrollments                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema

**Dependencies:** None

### 1.1 Create `scheduled_emails` table

```sql
CREATE TABLE scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  enrollment_id UUID NOT NULL REFERENCES workshop_enrollments(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Email details
  email_type VARCHAR(30) NOT NULL CHECK (email_type IN (
    'welcome', 'reminder', 'week1', 'week2', 'week3', 'week4', 'wrapUp', 'custom'
  )),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'sent', 'failed', 'cancelled'
  )),

  -- Execution tracking
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Error handling
  last_error TEXT,

  -- Postmark tracking
  postmark_message_id VARCHAR(255),

  -- Custom content (for custom emails or template overrides)
  custom_subject TEXT,
  custom_html_body TEXT,
  custom_text_body TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES admin_users(id)
);

-- Indexes for worker queries
CREATE INDEX idx_scheduled_emails_pending
  ON scheduled_emails(scheduled_for)
  WHERE status = 'pending';

CREATE INDEX idx_scheduled_emails_enrollment
  ON scheduled_emails(enrollment_id);

CREATE INDEX idx_scheduled_emails_workshop
  ON scheduled_emails(workshop_id);

CREATE INDEX idx_scheduled_emails_user
  ON scheduled_emails(user_id);

-- Prevent duplicate emails of same type for same enrollment
CREATE UNIQUE INDEX idx_scheduled_emails_unique_type
  ON scheduled_emails(enrollment_id, email_type)
  WHERE status NOT IN ('cancelled', 'failed');
```

### 1.2 Add trigger for updated_at

```sql
CREATE TRIGGER update_scheduled_emails_updated_at
  BEFORE UPDATE ON scheduled_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Security Considerations
- `recipient_email` contains PII - ensure proper access controls
- `custom_html_body` could contain sensitive content - sanitize on input
- Cascade delete ensures no orphaned records when enrollment deleted

---

## Phase 2: Email Scheduling Service

**Dependencies:** Phase 1

### 2.1 Create `src/services/emailScheduler.service.ts`

Core functions:
- `scheduleWorkshopEmails(enrollment, workshop, user)` - Creates all scheduled email records for a new enrollment
- `scheduleEmail(params)` - Schedules a single email
- `cancelScheduledEmails(enrollmentId)` - Cancels all pending emails for an enrollment
- `cancelScheduledEmail(emailId)` - Cancels a specific email
- `rescheduleEmail(emailId, newTime)` - Updates scheduled time
- `getScheduledEmails(filters)` - Query scheduled emails with filters

### 2.2 Calculate send times based on workshop config

```typescript
function calculateEmailSchedule(workshop: Workshop, enrolledAt: Date): ScheduledEmail[] {
  const schedule = workshop.customEmailSchedule || DEFAULT_SCHEDULE;
  const emails: ScheduledEmail[] = [];

  // Welcome - immediate
  if (schedule.welcome?.enabled !== false) {
    emails.push({
      emailType: 'welcome',
      scheduledFor: new Date(), // Now
    });
  }

  // Reminder - X hours before workshop start
  if (schedule.reminder?.enabled !== false) {
    const hoursBefore = schedule.reminder?.when?.hours_before || 24;
    const reminderTime = new Date(workshop.workshopStartDatetime);
    reminderTime.setHours(reminderTime.getHours() - hoursBefore);

    if (reminderTime > new Date()) {
      emails.push({
        emailType: 'reminder',
        scheduledFor: reminderTime,
      });
    }
  }

  // Week 1-4 and WrapUp - X days after workshop end
  // ... similar pattern

  return emails;
}
```

### Security Considerations
- Validate all inputs before inserting into database
- Log all scheduling actions for audit trail
- Ensure user has permission to cancel/reschedule

---

## Phase 3: Background Worker

**Dependencies:** Phase 1, Phase 2

### 3.1 Create `src/workers/emailWorker.ts`

```typescript
async function processScheduledEmails() {
  // 1. Find emails ready to send
  const pendingEmails = await db.query(`
    SELECT * FROM scheduled_emails
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
      AND attempts < max_attempts
    ORDER BY scheduled_for ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  `);

  // 2. Process each email
  for (const email of pendingEmails) {
    await processEmail(email);
  }
}

async function processEmail(email: ScheduledEmail) {
  // Mark as processing
  await db.query(`
    UPDATE scheduled_emails
    SET status = 'processing',
        attempts = attempts + 1,
        last_attempt_at = NOW()
    WHERE id = $1
  `, [email.id]);

  try {
    // Get enrollment/workshop/user data
    // Build email content (use custom template if configured)
    // Send via Postmark (NO SendAt - immediate send)
    // Mark as sent
    await db.query(`
      UPDATE scheduled_emails
      SET status = 'sent',
          sent_at = NOW(),
          postmark_message_id = $2
      WHERE id = $1
    `, [email.id, result.MessageID]);

  } catch (error) {
    // Mark as failed (will retry if attempts < max_attempts)
    await db.query(`
      UPDATE scheduled_emails
      SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
          last_error = $2
      WHERE id = $1
    `, [email.id, error.message]);
  }
}
```

### 3.2 Worker execution options

**Option A: Cron job (simpler)**
- Set up cron to hit an endpoint every 5 minutes
- Endpoint protected by secret key

**Option B: Separate worker process (more robust)**
- Run as separate Node process
- Uses setInterval or node-cron
- Better for high volume

**Option C: Use existing job queue (if available)**
- BullMQ, Agenda, etc.

### 3.3 Concurrency handling

- Use `FOR UPDATE SKIP LOCKED` to prevent multiple workers processing same email
- Idempotency: Check if already sent before sending

### Security Considerations
- Worker endpoint must be protected (secret key or internal-only)
- Log all send attempts for debugging
- Rate limit to avoid Postmark throttling
- Don't expose error details to end users

---

## Phase 4: Update Signup Flow

**Dependencies:** Phase 2

### 4.1 Modify workshop signup endpoint

Replace current email sending logic:

```typescript
// OLD: Send emails directly via Postmark with SendAt
(async () => {
  await sendWorkshopWelcomeEmail(..., sendAt);
  await sendWorkshopReminderEmail(..., sendAt);
  // ...
})();

// NEW: Schedule emails in database
await scheduleWorkshopEmails({
  enrollment,
  workshop,
  user: { id: user.id, email: user.email, firstName: data.firstName },
});
```

### 4.2 Remove async IIFE

The current fire-and-forget pattern silently fails. The new approach:
- Is synchronous (awaited)
- Errors are caught and logged
- Signup still succeeds even if scheduling fails (emails can be manually triggered)

---

## Phase 5: Admin Interface

**Dependencies:** Phase 2

### 5.1 API Endpoints

```typescript
// GET /api/workshops/:id/scheduled-emails
// List all scheduled emails for a workshop

// GET /api/enrollments/:id/scheduled-emails
// List scheduled emails for an enrollment

// PUT /api/scheduled-emails/:id/cancel
// Cancel a scheduled email

// PUT /api/scheduled-emails/:id/reschedule
// Change scheduled time

// POST /api/scheduled-emails/:id/retry
// Retry a failed email

// POST /api/enrollments/:id/schedule-emails
// Manually trigger email scheduling (for existing enrollments)
```

### 5.2 Admin UI Components

- Table showing scheduled emails with status
- Filters: status, email type, date range
- Actions: cancel, reschedule, retry
- Bulk actions: cancel all pending for enrollment

### Security Considerations
- All endpoints require admin authentication
- Log all admin actions with admin_user_id
- Confirm before bulk cancel operations

---

## Phase 6: Migration & Cleanup

**Dependencies:** Phases 1-5 complete and tested

### 6.1 Handle existing enrollments

For enrollments that signed up before this system:
- Emails are already in Postmark's queue (can't cancel easily)
- Option: Let them complete, or manually cancel in Postmark dashboard
- Future enrollments use new system

### 6.2 Remove old code

- Remove `SendAt` parameter from all email functions
- Remove async IIFE from signup endpoint
- Remove duplicate email logic from webhooks (already done)
- Clean up unused imports

### 6.3 Update email service functions

Simplify to only handle immediate sending:

```typescript
// Remove sendAt parameter entirely
export async function sendWorkshopWelcomeEmail(
  to: string,
  firstName: string,
  workshopName: string,
  // ... other params
  // NO sendAt - worker handles timing
) {
  // Send immediately
}
```

---

## Phase 7: Monitoring & Observability

**Dependencies:** Phase 3

### 7.1 Add logging

- Log every email scheduled
- Log every send attempt (success/failure)
- Log all admin actions

### 7.2 Add metrics (optional)

- Emails scheduled per day
- Emails sent per day
- Failure rate
- Average time in queue

### 7.3 Alerting (optional)

- Alert if emails failing repeatedly
- Alert if queue backing up

---

## Implementation Order

```
Phase 1: Database Schema
    ↓
Phase 2: Email Scheduling Service
    ↓
Phase 3: Background Worker  ←──┐
    ↓                          │
Phase 4: Update Signup Flow    │ (can be developed in parallel)
    ↓                          │
Phase 5: Admin Interface ──────┘
    ↓
Phase 6: Migration & Cleanup
    ↓
Phase 7: Monitoring (optional)
```

---

## Questions Before Starting

1. **Worker execution**: Which option (cron endpoint, separate process, job queue)?
   - Recommendation: Start with cron endpoint for simplicity

2. **Existing scheduled emails**: How to handle emails already in Postmark's queue?
   - Option A: Let them send (may have duplicates for recent signups)
   - Option B: Cancel in Postmark dashboard

3. **Retry policy**: How many retry attempts? How long between retries?
   - Recommendation: 3 attempts, exponential backoff (5min, 30min, 2hr)

4. **Email templates**: Should custom templates be stored in `scheduled_emails` at creation time, or fetched at send time?
   - Recommendation: Fetch at send time (allows template updates to affect pending emails)

---

## Security Checklist

- [ ] `scheduled_emails` table has proper foreign key constraints
- [ ] Cascade delete removes scheduled emails when enrollment deleted
- [ ] Admin endpoints require authentication
- [ ] Worker endpoint protected by secret key
- [ ] All admin actions logged with user ID
- [ ] PII (email addresses) protected with proper access controls
- [ ] Custom email content sanitized before storage
- [ ] Rate limiting on admin endpoints
- [ ] No sensitive data in error messages exposed to clients

---

## Success Criteria

- [ ] New signups have emails scheduled in database
- [ ] Worker sends emails at correct times
- [ ] Admin can view all scheduled emails
- [ ] Admin can cancel/reschedule emails
- [ ] Failed emails retry automatically
- [ ] No duplicate emails sent
- [ ] Audit trail for all actions
