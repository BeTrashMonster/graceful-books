# Weekly Email Summary - Developer Guide

## Overview

The Weekly Email Summary system sends DISC-adapted email summaries of checklist tasks to users on their preferred schedule. This guide explains how to integrate and use the feature.

## Quick Start

### 1. Basic Usage

```typescript
import { getOrCreateEmailPreferences } from '../store/emailPreferences';
import { generateEmailPreview } from '../services/email/emailPreviewService';
import { EmailPreferencesSetup } from '../components/emails/EmailPreferencesSetup';

// Get or create preferences for a user
const preferences = await getOrCreateEmailPreferences(userId, companyId);

// Generate a preview
const context: EmailGenerationContext = {
  user: { id, name, email, timezone },
  company: { id, name },
  preferences,
  checklistItems,
  discType: 'S', // Get from user's DISC profile
  generatedAt: new Date(),
};

const preview = await generateEmailPreview(context);
```

### 2. React Component Integration

```tsx
import { EmailPreferencesSetup } from '../components/emails/EmailPreferencesSetup';

function SettingsPage() {
  return (
    <EmailPreferencesSetup
      userId={currentUser.id}
      companyId={currentUser.companyId}
      onSave={() => {
        // Handle save success
        console.log('Preferences saved!');
      }}
      onCancel={() => {
        // Handle cancel
        navigate('/settings');
      }}
    />
  );
}
```

## Core Services

### Email Templates (`emailTemplates.ts`)

Provides DISC-adapted templates for all personality types.

```typescript
import { getSubjectLine, getGreeting, getClosing } from '../services/email/emailTemplates';

// Get subject line for Steadiness type
const subject = getSubjectLine('S', 0); // "Your Week Ahead: Small Steps, Big Progress"

// Get greeting
const greeting = getGreeting('S', 'John'); // "Hi there. Here's a gentle overview..."

// Get closing
const closing = getClosing('S'); // "Take it one step at a time. We're here if you need us."
```

### Email Content Generator (`emailContentGenerator.ts`)

Generates complete email content from checklist data.

```typescript
import { generateEmailContent } from '../services/email/emailContentGenerator';

const content = generateEmailContent(context);

// Returns:
// {
//   subject: { primary: "...", fallback: "..." },
//   preheader: "...",
//   greeting: "...",
//   sections: [...],
//   footer: { unsubscribeLink, preferencesLink, ... },
//   discType: 'S'
// }
```

### Email Preview Service (`emailPreviewService.ts`)

Generates previews for UI display.

```typescript
import {
  generateEmailPreview,
  generatePreviewsForAllDISCTypes,
  validateEmailContent
} from '../services/email/emailPreviewService';

// Generate single preview
const preview = await generateEmailPreview(context);

// Generate previews for all DISC types (for comparison)
const allPreviews = await generatePreviewsForAllDISCTypes(context);

// Validate before sending
const validation = validateEmailContent(context);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

### Email Store (`emailPreferences.ts`)

Database operations for email preferences.

```typescript
import {
  getOrCreateEmailPreferences,
  updateEmailPreferences,
  enableEmailNotifications,
  disableEmailNotifications,
  unsubscribeFromEmails,
  isUserUnsubscribed,
} from '../store/emailPreferences';

// Enable emails
await enableEmailNotifications(userId, companyId);

// Update preferences
await updateEmailPreferences(userId, {
  dayOfWeek: 'monday',
  timeOfDay: '09:00',
  maxTasksToShow: 5,
});

// Unsubscribe
await unsubscribeFromEmails(userId, 'Too many emails');

// Check subscription status
const unsubscribed = await isUserUnsubscribed(userId);
```

## DISC Type Adaptation

The system adapts email content based on the user's DISC personality type:

### Dominance (D) - Direct & Action-Oriented
- **Subject**: "Your Week Ahead: Action Items Ready"
- **Tone**: Professional, direct, results-focused
- **Content**: Brief, prioritized list of actionable items
- **Action Text**: "Do it now"

### Influence (I) - Enthusiastic & People-Oriented
- **Subject**: "Your Week Ahead: Let's Make Magic Happen!"
- **Tone**: Casual, enthusiastic, encouraging
- **Content**: Celebratory language, social framing
- **Action Text**: "Let's go!"

### Steadiness (S) - Patient & Supportive
- **Subject**: "Your Week Ahead: Small Steps, Big Progress"
- **Tone**: Supportive, patient, reassuring
- **Content**: Step-by-step guidance, emphasizes consistency
- **Action Text**: "Take a look"
- **DEFAULT** for new users

### Conscientiousness (C) - Detail-Oriented & Analytical
- **Subject**: "Weekly Report: Tasks and Status Overview"
- **Tone**: Formal, detailed, precise
- **Content**: Comprehensive data, metrics, status reports
- **Action Text**: "Review details"

## Email Sections

Users can customize which sections appear in their emails:

1. **Checklist Summary** - Active tasks and top priorities
2. **Foundation Tasks** - Core setup items for the business
3. **Upcoming Deadlines** - Items due in the next 7 days
4. **Quick Tips** - Helpful insights (DISC-adapted)
5. **Progress Update** - Completion metrics and encouragement
6. **Financial Snapshot** - Financial report summary (placeholder)

## Database Schema

### EmailPreferencesEntity

```typescript
{
  id: string;
  user_id: string;
  company_id: string;

  // Scheduling
  enabled: boolean;
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'disabled';
  day_of_week: 'monday' | 'tuesday' | ... | 'sunday';
  time_of_day: string; // HH:MM format
  timezone: string; // IANA timezone

  // Content
  include_sections: EmailContentSection[];
  max_tasks_to_show: number;

  // DISC
  disc_profile_id: string | null;
  use_disc_adaptation: boolean;

  // Tracking
  last_sent_at: Date | null;
  next_scheduled_at: Date | null;

  // Unsubscribe
  unsubscribed_at: Date | null;
  unsubscribe_reason: string | null;

  // CRDT fields
  version_vector: VersionVector;
  last_modified_by: string;
  last_modified_at: Date;
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}
```

### EmailDeliveryEntity

```typescript
{
  id: string;
  user_id: string;
  company_id: string;

  email_type: 'weekly-summary' | 'reminder' | 'notification';
  recipient_email: string;
  subject: string;

  status: 'pending' | 'sending' | 'sent' | 'failed' | 'bounced';
  scheduled_at: Date;
  sent_at: Date | null;
  delivered_at: Date | null;
  opened_at: Date | null;
  clicked_at: Date | null;
  failed_at: Date | null;
  failure_reason: string | null;

  retry_count: number;
  max_retries: number;
  last_retry_at: Date | null;

  content_hash: string;

  // CRDT fields
  version_vector: VersionVector;
  last_modified_by: string;
  last_modified_at: Date;
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}
```

## Configuration

### Default Values

```typescript
{
  enabled: false, // Opt-in by default
  frequency: 'weekly',
  day_of_week: 'monday',
  time_of_day: '08:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  include_sections: [
    'checklist-summary',
    'foundation-tasks',
    'upcoming-deadlines',
    'quick-tips',
    'progress-update',
  ],
  max_tasks_to_show: 5,
  use_disc_adaptation: true,
}
```

## Testing

### Run All Email Tests

```bash
npm test -- src/services/email
```

### Run Specific Test File

```bash
npm test -- src/services/email/emailTemplates.test.ts
```

### Test Coverage

- 50 total tests across 3 files
- All DISC types tested
- Content generation verified
- Preview functionality validated

## Production Setup

For production deployment, complete these steps:

1. **Email Service Configuration**
   ```typescript
   // Configure in environment variables
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASSWORD=your-api-key
   SMTP_FROM=noreply@gracefulbooks.com
   ```

2. **DNS Records**
   - SPF: `v=spf1 include:sendgrid.net ~all`
   - DKIM: Configure with email provider
   - DMARC: `v=DMARC1; p=none; rua=mailto:dmarc@gracefulbooks.com`

3. **Cron Job**
   ```typescript
   // Run every hour to process pending emails
   import { processPendingEmails } from '../services/email/emailSchedulingService';

   cron.schedule('0 * * * *', async () => {
     await processPendingEmails();
   });
   ```

4. **Monitoring**
   - Track delivery rates
   - Monitor bounce rates
   - Alert on high failure rates
   - Track unsubscribe rates

## Troubleshooting

### Email Not Generating

Check:
1. User has valid email preferences
2. Checklist items exist
3. DISC profile is available
4. All required context fields are populated

### Preview Not Showing

Check:
1. `generateEmailPreview()` is called with valid context
2. Browser console for errors
3. Email content validation passes

### Tests Failing

Check:
1. All dependencies installed: `npm install`
2. Date-fns version compatibility
3. Mock data in tests matches current schema

## Best Practices

1. **Always validate before sending**
   ```typescript
   const validation = validateEmailContent(context);
   if (!validation.valid) {
     throw new Error(validation.errors.join(', '));
   }
   ```

2. **Respect user preferences**
   ```typescript
   const unsubscribed = await isUserUnsubscribed(userId);
   if (unsubscribed) {
     return; // Don't send
   }
   ```

3. **Use DISC adaptation**
   ```typescript
   // Get user's DISC type from profile
   const discProfile = await getDISCProfile(userId);
   const discType = discProfile?.primaryStyle || 'S'; // Default to Steadiness
   ```

4. **Handle errors gracefully**
   ```typescript
   try {
     await sendEmail(context);
   } catch (error) {
     logger.error('Email send failed', { userId, error });
     // Don't throw - log and continue
   }
   ```

## Support

For questions or issues:
- Review test files for usage examples
- Check IMPLEMENTATION_D3_EMAIL_SUMMARY.md for detailed implementation notes
- Refer to AGENT_REVIEW_CHECKLIST.md for code standards
