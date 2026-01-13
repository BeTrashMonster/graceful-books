# Recurring Transactions - Capability Specification

**Capability ID:** `recurring-transactions`
**Related Roadmap Items:** E2
**SPEC Reference:** ACCT-002, ACCT-003
**Status:** In Development

## Overview

Recurring Transactions automates repetitive income and expense entries, saving users hours of manual data entry each month. This capability handles subscription income, monthly bills, rent, loan payments, and other predictable transactions.

## ADDED Requirements

### Functional Requirements

#### FR-1: Recurring Transaction Creation
**Priority:** Critical

Users SHALL be able to create recurring transaction templates:

**From Existing Transaction:**
- "Make Recurring" button on any transaction
- Pre-populates all fields from existing transaction
- Adjust frequency and duration
- Save as recurring template

**From Scratch:**
- Create new recurring template directly
- Same fields as regular transaction entry
- Add recurrence rules

**Template Fields:**
- **Transaction Details:**
  - Description (required)
  - Amount (required, can be variable)
  - Account (required)
  - Category/Tags (optional)
  - Memo (optional)
- **Recurrence Rules:**
  - Frequency (required)
  - Start date (required)
  - End condition (required)
  - Auto-create vs. draft mode (required)

**Acceptance Criteria:**
- [ ] "Make Recurring" works from any transaction
- [ ] Template creation form validates required fields
- [ ] Pre-population accurate from existing transaction
- [ ] Templates saved successfully

---

#### FR-2: Frequency Options
**Priority:** Critical

The system SHALL support multiple recurrence patterns:

**Standard Frequencies:**
- Daily
- Weekly (specify day of week)
- Bi-weekly (every 2 weeks)
- Monthly (specify day of month or last day)
- Quarterly (every 3 months)
- Yearly (specify month and day)

**Custom Frequencies:**
- Every N days/weeks/months
- Specific days of week (e.g., every Monday and Thursday)
- Specific day of month (e.g., 15th of each month)
- Last day of month (for month-end transactions)

**Smart Date Handling:**
- If date falls on weekend, create on: Friday before / Monday after / Exact date
- If day doesn't exist (e.g., Feb 31), use: Last day of month / Skip occurrence
- Handle DST transitions gracefully

**Acceptance Criteria:**
- [ ] All standard frequencies work correctly
- [ ] Custom frequencies validated
- [ ] Weekend handling configurable
- [ ] Invalid date handling prevents errors
- [ ] Next occurrence calculated correctly

---

#### FR-3: End Conditions
**Priority:** Critical

Users SHALL be able to specify when recurring transactions stop:

**End Options:**
- **Never:** Continue indefinitely
- **On Date:** Stop after specific date
- **After N Occurrences:** Stop after N transactions created
- **Manual Stop:** User pauses or cancels

**End Behavior:**
- Templates remain after end date (for reactivation)
- Past occurrences preserved in history
- Clear indication of ended templates in list
- Reactivation option available

**Acceptance Criteria:**
- [ ] All end conditions work correctly
- [ ] Templates don't create beyond end date
- [ ] Ended templates marked clearly
- [ ] Reactivation updates start date appropriately

---

#### FR-4: Auto-Create vs. Draft Mode
**Priority:** High

Users SHALL choose creation behavior:

**Auto-Create Mode:**
- Transactions created automatically (no user action)
- Posted directly to ledger
- Notification of creation (optional)
- Review after creation still possible

**Draft Mode:**
- Transactions created as drafts
- Require user approval before posting
- Dashboard widget shows pending drafts
- Bulk approve or individual review

**User Preferences:**
- Default mode setting (auto-create vs. draft)
- Per-template override
- Change mode for existing template

**Notification Options:**
- Email notification of auto-created transactions
- In-app notification
- Weekly summary (batch notification)
- No notification (silent creation)

**Acceptance Criteria:**
- [ ] Both modes work correctly
- [ ] Draft queue accessible and clear
- [ ] Bulk approval handles 50+ drafts
- [ ] Notifications sent as configured
- [ ] Mode changes apply to future occurrences only

---

#### FR-5: Edit Series vs. Single Instance
**Priority:** High

Users SHALL be able to edit:

**Edit Template (Series):**
- Changes affect all future occurrences
- Past occurrences unchanged
- Clear warning: "This will change all future transactions"
- Fields editable: amount, category, description, frequency

**Edit Single Instance:**
- Change only one occurrence
- Breaks linkage to template
- Warning: "This won't affect other occurrences"
- Can still mark as "exception" vs. "unlink"

**Delete Options:**
- Delete template (stops future, keeps past)
- Delete single occurrence
- Delete all (template + past + future) - requires confirmation

**Acceptance Criteria:**
- [ ] Series edit updates template correctly
- [ ] Future occurrences reflect changes
- [ ] Single instance edit creates exception
- [ ] Delete confirmations prevent accidents
- [ ] Audit log captures all edit types

---

#### FR-6: Recurring Transaction Management
**Priority:** High

Users SHALL have a dedicated recurring transactions view:

**List View:**
- All active recurring templates
- Inactive/ended templates (separate section)
- Sortable by: name, next occurrence, frequency
- Filterable by: type (income/expense), category, status

**Template Details:**
- Full recurrence rules displayed
- Next 5 occurrences preview
- History of past occurrences
- Edit and delete actions
- Pause/resume toggle

**Dashboard Widget:**
- "Upcoming Recurring Transactions" (next 7 days)
- Count of active templates
- Draft approvals pending
- Quick actions

**Acceptance Criteria:**
- [ ] List displays all templates accurately
- [ ] Next occurrences calculated correctly
- [ ] History links to actual transactions
- [ ] Dashboard widget loads in <500ms
- [ ] Pause/resume works immediately

---

### Non-Functional Requirements

#### NFR-1: Performance
- Transaction creation < 1 second per template
- Bulk creation (monthly run) completes in <5 minutes for 1000 templates
- List view loads in <1 second for 500 templates
- Next occurrence calculation < 100ms

#### NFR-2: Reliability
- Scheduled job runs daily (configurable)
- Retry failed creations automatically
- Alert admin if job fails
- No duplicate transactions created
- Transaction creation idempotent (safe to re-run)

#### NFR-3: Data Integrity
- All recurring transactions link to template
- Deleting template doesn't delete past transactions
- Audit trail for all template changes
- Variable amount transactions handled correctly

## Design Considerations

### User Experience

**Creation Flow:**
```
[Transaction List]
    → [Select Transaction]
    → [Click "Make Recurring"]
    → [Confirm Details]
    → [Set Frequency: "Monthly on the 15th"]
    → [Set End Condition: "Never" or "After 12 months"]
    → [Choose: Auto-create or Draft]
    → [Save Template]
    → [Celebration: "Set it and forget it! This transaction will record itself."]
```

**Joy Opportunities:**
- First recurring transaction: "Set it and forget it! This transaction will record itself."
- Time savings: "Recurring transactions have saved you from entering 47 transactions manually."
- Automation badge: "Automation Expert" after 5 recurring templates
- Upcoming preview: "Next transaction auto-creates in 3 days"

**DISC Adaptations:**
- **D:** "Automate it. Move on."
- **I:** "Let the robots handle the boring stuff! You've got more important things to do."
- **S:** "Your transactions will be created consistently, just like clockwork."
- **C:** "Precisely scheduled. Every occurrence will be recorded accurately."

### Technical Architecture


**Components:**
```typescript
RecurringTransactionList.tsx        // List view
RecurringTransactionForm.tsx        // Create/edit template
RecurringTransactionDetail.tsx      // Template details
RecurrenceRulePicker.tsx            // Frequency configuration
NextOccurrencesPreview.tsx          // Upcoming occurrences
RecurringDraftQueue.tsx             // Pending drafts widget
```

**Data Model:**
```typescript
interface RecurringTransaction {
  id: string;
  company_id: string;
  template_name: string;
  description: string;
  amount: number | 'variable'; // Variable for amounts that change
  account_id: string;
  category_id?: string;
  tags?: string[];
  memo?: string;

  recurrence_rule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
    interval: number; // Every N days/weeks/months
    day_of_week?: number; // 0-6 for weekly
    day_of_month?: number | 'last'; // 1-31 or 'last'
    month_of_year?: number; // 1-12 for yearly
    weekend_handling?: 'before' | 'after' | 'exact';
  };

  start_date: Date;
  end_condition: {
    type: 'never' | 'on_date' | 'after_occurrences';
    end_date?: Date;
    max_occurrences?: number;
  };

  creation_mode: 'auto' | 'draft';
  notification_enabled: boolean;

  status: 'active' | 'paused' | 'ended';
  last_created_date?: Date;
  occurrence_count: number;

  created_at: Date;
  updated_at: Date;
  created_by: string;
}

interface RecurringTransactionOccurrence {
  id: string;
  template_id: string;
  transaction_id: string; // Links to created transaction
  scheduled_date: Date;
  created_date: Date;
  status: 'created' | 'draft' | 'skipped' | 'failed';
}
```

**Scheduled Job:**
```typescript
// Runs daily at 2:00 AM local time
async function createRecurringTransactions() {
  const templates = await getActiveTemplates();
  const today = new Date();

  for (const template of templates) {
    const nextDate = calculateNextOccurrence(template);

    if (isSameDay(nextDate, today)) {
      if (template.creation_mode === 'auto') {
        await createTransaction(template);
      } else {
        await createDraftTransaction(template);
      }

      await recordOccurrence(template.id, nextDate);
      await updateTemplateOccurrenceCount(template.id);

      if (template.notification_enabled) {
        await sendNotification(template);
      }
    }
  }
}

function calculateNextOccurrence(template: RecurringTransaction): Date {
  // Complex date math based on recurrence rules
  // Handles weekend adjustments, invalid dates, DST
  // Returns next occurrence date
}
```

## Testing Strategy

### Unit Tests
- Next occurrence calculation for all frequencies
- Weekend handling logic
- Invalid date handling (Feb 30, etc.)
- End condition validation
- Template-to-transaction conversion

### Integration Tests
- Create recurring template end-to-end
- Scheduled job creates transactions correctly
- Edit series updates future occurrences
- Delete template preserves past transactions
- Pause/resume workflow

### User Acceptance Tests
- Create monthly bill recurring transaction
- Create bi-weekly income recurring transaction
- Approve draft transactions in bulk
- Edit single occurrence vs. series
- Review upcoming occurrences

## Open Questions

1. **Variable Amounts:** Should we support amount ranges or calculation rules?
   - **Decision Needed By:** Product Manager
   - **Impact:** Medium - affects utility for variable bills

2. **Bulk Import:** Should users be able to import recurring templates (CSV)?
   - **Decision Needed By:** Product Manager
   - **Impact:** Low - migration feature

3. **Smart Categorization:** Should recurring transactions learn from pattern changes?
   - **Decision Needed By:** Product Manager + Engineer
   - **Impact:** Medium - ties into expense categorization (E5)

4. **Multi-Currency:** How do recurring transactions work with foreign currency?
   - **Decision Needed By:** Product Manager (future Phase 3 consideration)
   - **Impact:** Low - not in scope for Phase 2

## Success Metrics

- **Adoption:** 70%+ of active users create at least 1 recurring transaction
- **Usage:** Average 5 recurring templates per user
- **Time Savings:** 30+ minutes saved per user per month
- **Accuracy:** <1% error rate in transaction creation
- **Reliability:** 99.9% scheduled job success rate
- **User Satisfaction:** >4.5/5 rating for recurring transactions feature
- **Retention Impact:** Users with 3+ recurring transactions have 2x higher retention

## Related Documentation

- SPEC.md § ACCT-002 (Invoicing - recurring invoices)
- SPEC.md § ACCT-003 (Bills & Expenses - recurring bills)
- ROADMAP.md Group E (E2)
- Scheduled job infrastructure documentation
- Date/time utility functions
- Transaction creation APIs
