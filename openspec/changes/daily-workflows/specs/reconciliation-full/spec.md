# Full Bank Reconciliation - Capability Specification

**Capability ID:** `reconciliation-wizard` (Extended)
**Related Roadmap Items:** E1
**SPEC Reference:** ACCT-004
**Status:** In Development

## Overview

This specification extends the reconciliation-wizard from a guided first-time experience (D2) to a production-ready, full-featured reconciliation system. It adds enhanced auto-matching, historical tracking, and advanced features for users performing regular monthly reconciliations.

## MODIFIED Requirements

### FR-1: Enhanced Auto-Matching Algorithm
**Priority:** Critical
**Modification Type:** Enhancement

**Previous Capability (D2):**
- Basic auto-matching by exact date and amount
- Simple confidence levels: Exact, Likely, Possible

**New Enhanced Features:**

**Multi-Factor Matching:**
- **Exact Match:** Date exact + Amount exact + Description similar
- **High Confidence:** Date ±1 day + Amount exact + Vendor match
- **Medium Confidence:** Date ±3 days + Amount exact
- **Low Confidence:** Date ±7 days + Amount ±$1.00

**Description Matching:**
- Fuzzy string matching on transaction descriptions
- Vendor name extraction and matching
- Common abbreviation handling (e.g., "AMZN" → "Amazon")
- Remove noise words ("POS", "ACH", "CHECK", etc.)

**Pattern Learning:**
- Remember user corrections from previous reconciliations
- Build vendor-to-transaction associations
- Learn common description patterns per vendor
- Improve accuracy over time automatically

**Multi-Transaction Matching:**
- Split deposits (one bank deposit = multiple income transactions)
- Partial payments (invoice paid in installments)
- Combined transactions (multiple expenses on one credit card charge)

**Acceptance Criteria:**
- [ ] Auto-match accuracy >85% for users with 3+ reconciliations
- [ ] Fuzzy description matching identifies vendors correctly >90% of time
- [ ] Pattern learning improves accuracy by 5%+ after 3 reconciliations
- [ ] Multi-transaction matching handles splits correctly
- [ ] Algorithm completes in <5 seconds for 500 transactions

---

### FR-2: Reconciliation History
**Priority:** High
**Modification Type:** New Addition

The system SHALL maintain complete reconciliation history:

**Historical Data Stored:**
- Reconciliation date and user
- Account and statement period
- Beginning and ending balances
- Transactions matched
- Discrepancies found and resolved
- Notes and comments
- Time spent reconciling

**History View:**
- List all past reconciliations by account
- Filter by date range, account, user
- Sort by date (newest first default)
- Status indicator: Balanced, Discrepancy, Reopened

**Reconciliation Report:**
- Printable/exportable reconciliation summary
- All matched transactions listed
- Discrepancy details
- User who performed reconciliation
- Timestamp and signature line
- PDF export for accountant handoff

**Reopen Capability:**
- Accountants can reopen past reconciliations
- Add notes or corrections
- Audit trail of reopening event
- Warning: "This reconciliation was previously closed"

**Acceptance Criteria:**
- [ ] All reconciliations stored permanently
- [ ] History accessible within 3 clicks
- [ ] Reports generate in <2 seconds
- [ ] Reopen capability restricted to Admin/Accountant roles
- [ ] Audit log captures all reopen events

---

### FR-3: Unreconciled Transaction Flagging
**Priority:** High
**Modification Type:** New Addition

The system SHALL identify and flag unreconciled transactions:

**Flagging Logic:**
- Transactions older than last reconciliation date
- Not marked as reconciled
- Flag prominence based on age:
  - **Yellow (Warning):** 30-60 days old
  - **Orange (Attention):** 61-90 days old
  - **Red (Urgent):** >90 days old

**Dashboard Widget:**
- "Unreconciled Transactions" count
- Breakdown by account
- Quick action: "Reconcile Now"

**Transaction List View:**
- Filter: "Show unreconciled only"
- Visual indicator (flag icon) on each transaction
- Bulk reconciliation option
- "Mark as reconciled" action

**Notifications:**
- Weekly email includes unreconciled count
- Alert if unreconciled count >50
- Gentle reminder if no reconciliation in 60 days

**Acceptance Criteria:**
- [ ] Flagging logic accurate and performant
- [ ] Dashboard widget loads in <500ms
- [ ] Filter works in transaction list
- [ ] Bulk actions handle 100+ transactions
- [ ] Notifications don't annoy users (max weekly)

---

### FR-4: Reconciliation Streak Tracking
**Priority:** Medium (Joy Feature)
**Modification Type:** New Addition

The system SHALL track and celebrate reconciliation streaks:

**Streak Definition:**
- Consecutive months with successful reconciliation
- Reconciliation completed within 10 days of month end
- Account balanced (discrepancy resolved or <$5)

**Streak Display:**
- Dashboard badge: "3-Month Streak!"
- Reconciliation page header: "Keep your streak going"
- Progress toward next milestone (3, 6, 12, 24 months)

**Celebrations:**
- 3-month streak: Encouraging message + badge
- 6-month streak: Confetti + achievement notification
- 12-month streak: Special recognition + "Bookkeeping Champion" badge
- 24-month streak: Rare achievement + "Master Reconciler" badge

**Streak Recovery:**
- If streak breaks, show: "Start a new streak this month!"
- Best streak displayed: "Your best: 8 months"
- Encouragement, not punishment

**Acceptance Criteria:**
- [ ] Streak calculation accurate
- [ ] Badges displayed prominently
- [ ] Celebrations trigger at correct milestones
- [ ] Streak recovery messaging supportive
- [ ] DISC-adapted celebration messages

---

## ADDED Requirements

### FR-5: Advanced Discrepancy Resolution
**Priority:** High
**Modification Type:** New Addition

**Enhanced Troubleshooting:**
- **Automatic Suggestions:**
  - "Found $47.50 bank fee not recorded - Add it now?"
  - "Possible duplicate transaction detected - Review?"
  - "Outstanding check #1234 not yet cleared - Normal?"

**Inline Transaction Actions:**
- Add missing transaction without leaving reconciliation
- Mark transaction as voided
- Edit transaction amount (with audit trail)
- Flag for later review

**Discrepancy Patterns:**
- Common issue detection:
  - Bank fees/interest not recorded
  - Duplicate entries
  - Outstanding checks
  - Deposits in transit
  - Data entry errors (transposed digits)

**Acceptance Criteria:**
- [ ] Suggestions appear when discrepancy detected
- [ ] Inline actions work without leaving workflow
- [ ] Pattern detection identifies 80%+ of common issues
- [ ] All actions logged to audit trail

---

### FR-6: Multi-Account Reconciliation Dashboard
**Priority:** Medium
**Modification Type:** New Addition

For users with multiple bank accounts:

**Dashboard View:**
- All accounts listed
- Last reconciliation date per account
- Next recommended reconciliation date
- Unreconciled transaction count per account
- Quick actions per account

**Bulk Reconciliation:**
- Start reconciliation for multiple accounts
- Upload multiple bank statements
- Process in sequence or parallel
- Progress tracking across accounts

**Acceptance Criteria:**
- [ ] Dashboard shows all accounts clearly
- [ ] Bulk upload handles 5+ statements
- [ ] Processing doesn't block UI
- [ ] Progress indicator accurate

---

## Technical Architecture

### Enhanced Matching Algorithm

```typescript
interface MatchCandidate {
  statementLine: StatementTransaction;
  bookTransaction: Transaction;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  matchScore: number; // 0-100
  matchFactors: {
    dateMatch: number;
    amountMatch: number;
    descriptionMatch: number;
    vendorMatch: number;
    patternMatch: number;
  };
}

async function enhancedAutoMatch(
  statementTransactions: StatementTransaction[],
  bookTransactions: Transaction[],
  historicalPatterns: ReconciliationPattern[]
): Promise<MatchCandidate[]> {
  // 1. Exact matches (date + amount + description similar)
  // 2. High confidence (date ±1 + amount + vendor)
  // 3. Apply learned patterns
  // 4. Medium confidence (date ±3 + amount)
  // 5. Low confidence (date ±7 + amount ±$1)
  // 6. Multi-transaction matching

  return sortedCandidates;
}

interface ReconciliationPattern {
  vendorName: string;
  descriptionPatterns: string[];
  typicalAmountRange: { min: number; max: number };
  typicalDayOfMonth: number;
  confidence: number; // Improved with each reconciliation
}
```

### Historical Data Storage

```typescript
interface ReconciliationRecord {
  id: string;
  company_id: string;
  account_id: string;
  reconciliation_date: Date;
  statement_period: { start: Date; end: Date };
  beginning_balance: number;
  ending_balance: number;
  calculated_balance: number;
  discrepancy: number;
  status: 'balanced' | 'discrepancy_resolved' | 'discrepancy_noted';
  matched_transactions: string[]; // transaction IDs
  unmatched_statement_lines: StatementTransaction[];
  unmatched_book_transactions: Transaction[];
  notes: string;
  time_spent_seconds: number;
  user_id: string;
  reopened_at?: Date;
  reopened_by?: string;
  reopened_reason?: string;
}
```

## Testing Strategy

### Unit Tests
- Enhanced matching algorithm accuracy
- Pattern learning logic
- Streak calculation
- Discrepancy detection

### Integration Tests
- Complete reconciliation with enhanced matching
- Historical reconciliation storage and retrieval
- Reopen reconciliation workflow
- Multi-account reconciliation

### Performance Tests
- 1000 transactions auto-match in <5 seconds
- Historical reconciliation list loads in <1 second
- Pattern learning doesn't degrade performance

### User Acceptance Tests
- Monthly reconciliation workflow for power users
- Streak tracking and celebrations
- Historical report generation
- Multi-account reconciliation

## Success Metrics

- **Auto-Match Accuracy:** >85% (up from D2's >85% target, sustained)
- **Reconciliation Completion:** 70% of users reconcile monthly
- **Time Savings:** 40% faster reconciliation vs. manual matching
- **Streak Engagement:** 30% of users maintain 3+ month streak
- **Historical Usage:** 20% of users reference past reconciliations monthly
- **Accuracy Improvement:** Pattern learning improves matching 5%+ after 3 months

## Related Documentation

- SPEC.md § ACCT-004 (Bank Reconciliation)
- ROADMAP.md Group D (D2), Group E (E1)
- reconciliation-wizard.spec.md (D2 - base implementation)
- Enhanced matching algorithm documentation
- Reconciliation pattern storage schema
