# IC4: Email Service Integration

## Overview

The IC4 Email Service Integration provides a complete email notification system for Graceful Books with 9 pre-built templates, queue-based delivery with retry logic, and support for Resend and SendGrid providers.

**Key Features:**
- ✅ 9 notification-only email templates (NO financial data)
- ✅ XSS-safe variable substitution
- ✅ Queue-based delivery with exponential backoff retry
- ✅ Resend and SendGrid provider support
- ✅ Mobile-responsive HTML templates with plain text fallback
- ✅ Email preference management
- ✅ Delivery tracking and analytics
- ✅ WCAG 2.1 AA compliant

## Security Requirements

**CRITICAL:** All emails are **notification-only** with NO financial data in email body (per security expert recommendation from ROADMAP.md).

Users must log in to view financial details. Examples:
- ✅ "You have a new scenario from [Advisor Name]. Log in to view details."
- ❌ "Your projected revenue is $50,000"

All user-provided variables are sanitized to prevent XSS attacks.

## Email Templates

### 1. Advisor Invitation (J7)
**Use:** When advisor invites client to connect

**Variables:**
- `clientFirstName`
- `advisorName`
- `advisorFirm`
- `invitationUrl`

**Example:**
```typescript
import { sendAdvisorInvitationEmail } from '@/services/email/emailNotificationIntegration';

await sendAdvisorInvitationEmail({
  companyId: 'company-123',
  userId: 'user-456',
  recipientEmail: 'client@example.com',
  recipientName: 'John Doe',
  clientFirstName: 'John',
  advisorName: 'Jane Smith',
  advisorFirm: 'Acme Advisors LLC',
  invitationUrl: 'https://app.gracefulbooks.com/invite/abc123',
});
```

### 2. Client Billing Transfer (J7)
**Use:** When client's billing is transferred to advisor

**Variables:**
- `clientFirstName`
- `advisorName`
- `accountUrl`
- `advisorEmail`

### 3. Advisor Removed Client (J7)
**Use:** When advisor removes client from their plan

**Variables:**
- `clientFirstName`
- `advisorName`
- `billingChoiceUrl`

### 4. Scenario Pushed (J3 + J7)
**Use:** When advisor shares scenario analysis

**Variables:**
- `clientFirstName`
- `advisorName`
- `scenarioName`
- `advisorNote`
- `scenarioUrl`

### 5. Tax Season Access (J8)
**Use:** When advisor grants tax prep mode access

**Variables:**
- `clientFirstName`
- `advisorName`
- `taxYear`
- `accessExpiresDate`
- `taxPrepUrl`
- `advisorEmail`

### 6. Tax Prep Completion (J8)
**Use:** When tax package is ready for download

**Variables:**
- `firstName`
- `taxYear`
- `downloadUrl`

### 7. Welcome Email
**Use:** After user signs up

**Variables:**
- `firstName`
- `dashboardUrl`
- `charityName`

### 8. Password Reset
**Use:** When user requests password reset (CRITICAL - cannot be unsubscribed)

**Variables:**
- `firstName`
- `resetUrl`

### 9. Email Verification
**Use:** After user signs up (CRITICAL - cannot be unsubscribed)

**Variables:**
- `firstName`
- `verificationUrl`

## Architecture

### File Structure

```
src/
├── services/
│   └── email/
│       ├── email.service.ts                    # Core email service
│       ├── email.service.test.ts               # Service tests
│       ├── emailNotificationIntegration.ts     # Integration helpers
│       ├── templateRenderer.ts                 # Template router
│       ├── templateUtils.ts                    # XSS prevention & utils
│       ├── templateUtils.test.ts               # Utils tests
│       └── templates/
│           ├── advisorInvitation.ts
│           ├── clientBillingTransfer.ts
│           ├── advisorRemovedClient.ts
│           ├── scenarioPushed.ts
│           ├── taxSeasonAccess.ts
│           ├── taxPrepCompletion.ts
│           ├── welcome.ts
│           ├── passwordReset.ts
│           └── emailVerification.ts
├── types/
│   └── ic4-email.types.ts                      # Type definitions
├── utils/
│   ├── emailQueue.ts                           # Queue processor
│   └── emailQueue.test.ts                      # Queue tests
└── db/
    └── schema/
        └── emailQueue.schema.ts                # Database schema
```

### Database Schema

Three tables added in database version 14:

1. **emailQueue** - Pending emails with retry tracking
2. **emailLogs** - Historical record of all emails
3. **emailNotificationPreferences** - Per-user email preferences

## Configuration

### Environment Variables

```bash
# Email provider (RESEND, SENDGRID, or TEST)
VITE_EMAIL_PROVIDER=RESEND

# API key for provider
VITE_EMAIL_API_KEY=re_xxxxxxxxxxxx

# Sender email and name
VITE_EMAIL_FROM=noreply@gracefulbooks.com
VITE_EMAIL_FROM_NAME=Graceful Books

# Reply-to email
VITE_EMAIL_REPLY_TO=support@gracefulbooks.com

# Test mode (true = log only, no actual sends)
VITE_EMAIL_TEST_MODE=false

# App URL for links in emails
VITE_APP_URL=https://app.gracefulbooks.com
```

### Provider Setup

#### Resend (Recommended)

1. Sign up at [resend.com](https://resend.com)
2. Create API key
3. Verify domain (add DNS records)
4. Set `VITE_EMAIL_PROVIDER=RESEND`

#### SendGrid

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create API key
3. Verify sender domain
4. Set `VITE_EMAIL_PROVIDER=SENDGRID`

## Usage

### Sending Emails Immediately

```typescript
import { emailService } from '@/services/email/email.service';
import { EmailTemplateType } from '@/types/ic4-email.types';

const result = await emailService.sendEmail({
  companyId: 'company-123',
  userId: 'user-456',
  recipientEmail: 'user@example.com',
  recipientName: 'John Doe',
  templateType: EmailTemplateType.WELCOME,
  variables: {
    firstName: 'John',
    dashboardUrl: 'https://app.gracefulbooks.com/dashboard',
    charityName: 'Red Cross',
  },
});

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Email failed:', result.error);
}
```

### Queuing Emails for Background Delivery

```typescript
const queueId = await emailService.queueEmail({
  companyId: 'company-123',
  userId: 'user-456',
  recipientEmail: 'user@example.com',
  recipientName: 'John Doe',
  templateType: EmailTemplateType.TAX_PREP_COMPLETION,
  variables: {
    firstName: 'John',
    taxYear: '2025',
    downloadUrl: 'https://app.gracefulbooks.com/download/tax-2025',
  },
  priority: 'HIGH',
  scheduledAt: new Date('2026-02-01T09:00:00Z'), // Optional
});
```

### Starting the Queue Processor

```typescript
import { startEmailQueue } from '@/utils/emailQueue';

// Call on app initialization
startEmailQueue();
```

## Retry Logic

Failed emails are automatically retried with exponential backoff:

1. **First retry:** 1 minute after failure
2. **Second retry:** 5 minutes after failure
3. **Third retry:** 15 minutes after failure

After 3 failed attempts, the email is marked as permanently failed.

**Retryable errors:**
- Network errors
- Provider rate limits
- Temporary provider outages

**Non-retryable errors:**
- Invalid email address
- User unsubscribed
- Missing template variables
- Bounced/blocked addresses

## Email Preferences

Users can manage email preferences for non-critical emails:

```typescript
import { db } from '@/store/database';

// Get user preferences
const prefs = await db.emailNotificationPreferences
  .where('userId')
  .equals(userId)
  .first();

// Update preferences
await db.emailNotificationPreferences.update(prefs.id, {
  scenarioPushed: false, // Disable scenario notifications
  taxPrepCompletion: true, // Enable tax notifications
});

// Global unsubscribe
await db.emailNotificationPreferences.update(prefs.id, {
  unsubscribedAt: Date.now(),
  unsubscribeReason: 'Too many emails',
});
```

**Note:** Critical emails (welcome, password reset, email verification) cannot be disabled.

## Monitoring

### Queue Status

```typescript
import { emailQueueProcessor } from '@/utils/emailQueue';

const status = await emailQueueProcessor.getQueueStatus();
console.log(status);
// {
//   queued: 5,
//   sending: 2,
//   failed: 1,
//   total: 8
// }
```

### Retry Failed Emails

```typescript
// Immediately retry all failed emails
const count = await emailQueueProcessor.retryFailedEmails();
console.log(`Queued ${count} emails for retry`);
```

### Clear Old Emails

```typescript
// Delete sent emails older than 30 days
const count = await emailQueueProcessor.clearOldEmails();
console.log(`Deleted ${count} old emails`);
```

## Testing

### Run Tests

```bash
npm test src/services/email/
npm test src/utils/emailQueue.test.ts
```

### Test Coverage

- ✅ Template rendering with variable substitution
- ✅ XSS prevention (script injection, event handlers, iframes, etc.)
- ✅ Email validation
- ✅ Provider integration (Resend, SendGrid)
- ✅ Queue processing
- ✅ Retry logic with exponential backoff
- ✅ Priority handling
- ✅ Unsubscribe checking

### Manual Testing

1. Set `VITE_EMAIL_TEST_MODE=true` in `.env`
2. Send test email:

```typescript
import { sendWelcomeEmail } from '@/services/email/emailNotificationIntegration';

await sendWelcomeEmail({
  companyId: 'test-company',
  userId: 'test-user',
  recipientEmail: 'your-email@example.com',
  recipientName: 'Test User',
  firstName: 'Test',
  dashboardUrl: 'https://app.gracefulbooks.com/dashboard',
  charityName: 'Test Charity',
});
```

3. Check console logs for rendered HTML/plain text

## Accessibility

All email templates meet WCAG 2.1 AA standards:

- ✅ Sufficient color contrast (4.5:1 minimum)
- ✅ Semantic HTML structure
- ✅ Alt text for images
- ✅ Touch-friendly buttons (44px min height)
- ✅ Plain text fallback for screen readers
- ✅ Responsive design (mobile-friendly)

## Performance

- **Queue processing:** Every 30 seconds
- **Rate limiting:** Configurable per-provider limits
- **Batch processing:** Priority-based sorting
- **Database cleanup:** Auto-delete emails older than 30 days

## Troubleshooting

### Emails not sending

1. Check queue status: `emailQueueProcessor.getQueueStatus()`
2. Verify environment variables are set
3. Check provider API key is valid
4. Review error logs in `emailLogs` table

### High bounce rate

1. Verify sender domain is authenticated (SPF, DKIM, DMARC)
2. Check email validation logic
3. Review provider deliverability reports

### Rate limit errors

1. Reduce `maxEmailsPerMinute` in config
2. Increase queue processing interval
3. Upgrade provider plan

## Future Enhancements

- Webhook handling for delivery events (opened, clicked, bounced)
- Email analytics dashboard
- A/B testing for subject lines
- Scheduled digest emails
- Rich text editor for custom templates

## Related Documentation

- [ROADMAP.md](../Roadmaps/ROADMAP.md) - Lines 1454-1956 (IC4 specification)
- [Security Expert Recommendations](../Roadmaps/ROADMAP.md) - Security requirements
- [J7: Advisor Portal](../Roadmaps/ROADMAP.md) - Advisor-related emails
- [J8: Tax Time Prep Mode](../Roadmaps/ROADMAP.md) - Tax-related emails
