# Weekly Email Summaries - Capability Specification

**Capability ID:** `email-summaries`
**Related Roadmap Items:** D3
**SPEC Reference:** NOTIF-001
**Status:** In Development

## Overview

The Weekly Email Summaries system sends encouraging, DISC-adapted task reminder emails to help users maintain momentum with their financial management. This system transforms email notifications from annoying reminders into supportive nudges that users look forward to receiving.

## ADDED Requirements

### Functional Requirements

#### FR-1: Email Configuration
**Priority:** Critical

Users SHALL be able to configure:
- **Enable/Disable:** Toggle email summaries on/off
- **Frequency:** Weekly or bi-weekly
- **Day Selection:** Any day of the week (default: Monday)
- **Time Selection:** Any hour (default: 9:00 AM local time)
- **Content Preferences:** More detail vs. less detail
- **Preview:** See sample email before enabling

**Acceptance Criteria:**
- [ ] Configuration UI accessible from Settings
- [ ] Preview generates actual content from user's data
- [ ] Time delivered in user's local timezone
- [ ] Changes take effect for next scheduled send
- [ ] Preference changes saved immediately

#### FR-2: Email Content Structure
**Priority:** Critical

Each email SHALL include:

**1. Greeting (Warm, supportive tone)**
- Time-appropriate greeting (Good Monday morning!)
- Personalized with user name
- DISC-adapted opening

**2. Quick Wins from Last Week**
- Checklist items completed
- Invoices sent
- Transactions recorded
- Reconciliation status
- Celebrations for milestones

**3. This Week's Maintenance Tasks**
- Overdue checklist items (if any)
- Regular maintenance tasks due
- Upcoming invoice deadlines
- Bills due in next 7 days

**4. Foundation Building Tasks (1-3 items)**
- Next recommended checklist items
- Feature unlocks available
- Educational opportunities

**5. Overdue Items (Gentle reminder)**
- Only if applicable
- Non-judgmental language
- Suggestions for getting back on track

**6. Educational Tip**
- One accounting concept
- Plain English explanation
- Link to learn more

**7. Encouragement Close**
- DISC-adapted closing
- Reminder that progress matters
- One-click link to app

**Acceptance Criteria:**
- [ ] All sections populated from user data
- [ ] Empty sections omitted gracefully
- [ ] Content length: 200-400 words
- [ ] Reading time: < 2 minutes
- [ ] Mobile-responsive HTML email

#### FR-3: DISC Adaptation
**Priority:** High

Email content SHALL adapt based on user's DISC profile:

**D (Direct) - "Get It Done"**
- Subject: "This Week's Financial Priorities"
- Tone: Brief, action-oriented, results-focused
- Structure: Bullets, minimal prose
- Close: "Let's make this week count."

**I (Influencing) - "We're In This Together"**
- Subject: "Your Week Ahead: Small Steps, Big Progress"
- Tone: Warm, enthusiastic, collaborative
- Structure: Friendly paragraphs with personality
- Close: "You're doing great! Keep up the momentum."

**S (Steady) - "Consistent Progress"**
- Subject: "Your Weekly Financial Check-In"
- Tone: Calm, reassuring, supportive
- Structure: Clear sections with gentle guidance
- Close: "Take it one step at a time. You've got this."

**C (Conscientious) - "Detailed Overview"**
- Subject: "Weekly Financial Summary & Recommendations"
- Tone: Precise, thorough, data-driven
- Structure: Organized sections with metrics
- Close: "Everything is tracked and organized. Well done."

**Acceptance Criteria:**
- [ ] Four distinct email templates created
- [ ] DISC profile retrieved from user preferences
- [ ] Fallback to neutral tone if profile unknown
- [ ] Tone consistent throughout email

#### FR-4: One-Click Actions
**Priority:** High

Emails SHALL include direct action links:
- "Check off tasks" → Opens checklist
- "Record a transaction" → Opens transaction entry
- "View your dashboard" → Opens dashboard
- "Send an invoice" → Opens invoice creation
- Task-specific links (e.g., "Complete reconciliation")

Links SHALL:
- Authenticate user automatically (magic link token)
- Deep link to specific feature/item
- Expire after 7 days for security
- Work on mobile and desktop

**Acceptance Criteria:**
- [ ] All action links functional
- [ ] Magic link tokens secure and time-limited
- [ ] Deep linking works correctly
- [ ] Expired links show helpful error message

#### FR-5: Unsubscribe & Preferences
**Priority:** Critical (Legal requirement)

Every email SHALL include:
- One-click unsubscribe link
- Link to email preferences
- Clear unsubscribe confirmation
- Re-subscribe option in settings

**Acceptance Criteria:**
- [ ] Unsubscribe link in footer
- [ ] Unsubscribe honored immediately
- [ ] Confirmation message shown
- [ ] CAN-SPAM Act compliant
- [ ] GDPR compliant

### Non-Functional Requirements

#### NFR-1: Deliverability
- Email sender reputation maintained (SPF, DKIM, DMARC)
- Bounce rate < 5%
- Spam complaint rate < 0.1%
- Delivery rate > 95%

#### NFR-2: Performance
- Email generation < 2 seconds per user
- Batch processing: 10,000 emails/hour
- Queue processing with retry logic
- Failed sends retry 3 times with exponential backoff

#### NFR-3: Privacy & Security
- Email content encrypted in transit (TLS)
- No sensitive financial details in email body
- Magic links use cryptographically secure tokens
- Email tracking pixels optional (opt-in)

## Design Considerations

### User Experience

**Onboarding Flow:**
```
[Complete Assessment]
    → [Optional: "Would you like weekly email reminders?"]
    → [Day/Time Selection]
    → [Preview Sample Email]
    → [Confirm or Skip]
```

**Email Preview Example:**
```
Subject: Your Week Ahead: Small Steps, Big Progress

Good Monday morning, Sarah!

🎉 Last Week's Wins:
• Completed 5 checklist items
• Sent 3 invoices ($4,500 total)
• Recorded 12 transactions

This Week's Focus:
☐ Reconcile checking account (takes ~10 min)
☐ Follow up on 2 overdue invoices
☐ Review and categorize 4 uncategorized expenses

💡 Quick Tip: Did you know? Reconciling your accounts monthly
helps catch errors early. Let's do your first reconciliation together!

→ Check Off Tasks | View Dashboard | Record Transaction

You're building real momentum. Keep it up!

---
Unsubscribe | Update Preferences
```

**Joy Opportunities:**
- Subject lines encouraging, never demanding
- Celebrate streaks: "5 weeks in a row!"
- Milestone recognition in email
- Personalized content based on actual progress

### Technical Architecture


**Email Service Architecture:**
```typescript
// New email service components
EmailScheduler.ts        // Cron job for scheduling sends
EmailContentGenerator.ts // Generate personalized content
EmailTemplateEngine.ts   // DISC-adapted templates
EmailDeliveryService.ts  // Send via email provider API
EmailPreferences.ts      // User preference management
MagicLinkService.ts      // Secure token generation
```

**Email Template Structure:**
```typescript
interface EmailTemplate {
  discProfile: 'D' | 'I' | 'S' | 'C';
  subject: (userName: string) => string;
  greeting: (userName: string, time: string) => string;
  sections: {
    lastWeekWins: (data: WeeklyData) => string;
    thisWeekTasks: (data: WeeklyData) => string;
    foundationTasks: (data: WeeklyData) => string;
    overdueItems: (data: WeeklyData) => string | null;
    educationalTip: () => string;
    closing: () => string;
  };
}
```

**Data Collection:**
```typescript
interface WeeklyData {
  completedChecklistItems: number;
  invoicesSent: { count: number; total: number };
  transactionsRecorded: number;
  reconciliationStatus: 'done' | 'due' | 'overdue';
  overdueInvoices: Invoice[];
  upcomingBills: Bill[];
  nextChecklistItems: ChecklistItem[];
  streakDays: number;
}
```

**Scheduling Logic:**
```typescript
// Runs daily at midnight UTC
function scheduleWeeklyEmails() {
  const users = getActiveEmailSubscribers();

  for (const user of users) {
    const localTime = user.emailPreferences.time;
    const day = user.emailPreferences.day;
    const frequency = user.emailPreferences.frequency;

    if (shouldSendToday(user, day, frequency)) {
      const sendTime = convertToUTC(localTime, user.timezone);
      queueEmail(user, sendTime);
    }
  }
}
```

## Testing Strategy

### Unit Tests
- Email content generation for each DISC type
- Magic link token creation and validation
- Schedule calculation (timezones, frequencies)
- Template rendering with various data

### Integration Tests
- End-to-end email delivery
- Unsubscribe flow
- Magic link authentication
- Preference updates

### User Acceptance Tests
- Receive email at configured time
- Click action links
- Unsubscribe and re-subscribe
- Preview email accuracy
- DISC adaptation verification

## Open Questions

1. **Email Provider:** Which email service provider (SendGrid, AWS SES, Mailgun)?
   - **Decision Needed By:** DevOps Engineer
   - **Impact:** High - affects deliverability and cost

2. **Email Analytics:** Should we track opens and clicks?
   - **Decision Needed By:** Product Manager + Privacy/Legal
   - **Impact:** Medium - privacy implications

3. **Content Refresh:** How often should we update educational tips?
   - **Decision Needed By:** Product Manager + Content Writer
   - **Impact:** Low - affects content maintenance

4. **Batch Sending:** Should we stagger sends or batch by timezone?
   - **Decision Needed By:** DevOps Engineer
   - **Impact:** Medium - affects email reputation

## Success Metrics

- **Opt-In Rate:** 70%+ of users enable weekly emails
- **Open Rate:** >40% (industry average: 20-25%)
- **Click-Through Rate:** >15% (industry average: 2-5%)
- **Unsubscribe Rate:** <2% per month
- **Re-Engagement:** Users who receive emails 2x more likely to log in weekly
- **Completion Rate:** 30%+ complete at least one task from email
- **Deliverability:** >95% delivery rate

## Related Documentation

- SPEC.md § NOTIF-001 (Weekly Email Summary)
- SPEC.md § ONB-004 (DISC Profiles)
- ROADMAP.md Group D (D3)
- Email service provider documentation
- CAN-SPAM Act compliance requirements
- GDPR email marketing requirements
