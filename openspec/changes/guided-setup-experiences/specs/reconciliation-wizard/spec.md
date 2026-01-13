# Reconciliation Wizard - Capability Specification

**Capability ID:** `reconciliation-wizard`
**Related Roadmap Items:** D2
**SPEC Reference:** ACCT-004
**Status:** In Development

## Overview

The Reconciliation Wizard provides a hand-held, educational first-time bank reconciliation experience. It transforms an intimidating accounting task into an approachable, guided process with clear explanations and support for common issues.

## ADDED Requirements

### Functional Requirements

#### FR-1: Educational Introduction
**Priority:** Critical

The wizard SHALL begin with an educational introduction:
- "What is reconciliation?" plain English explanation
- Why it matters for business accuracy
- What to have ready (bank statement)
- Expected time to complete (5-10 minutes)
- Option to skip intro on subsequent reconciliations

**Content Example:**
> "Reconciliation is just a fancy word for 'making sure your records match the bank.'
> Think of it like balancing your checkbook - you're confirming that what the bank says
> matches what you recorded. Let's do this together."

**Acceptance Criteria:**
- [ ] Introduction screen shown on first reconciliation
- [ ] Plain English content (6th-8th grade reading level)
- [ ] "Skip intro" preference saved for future
- [ ] Educational content DISC-adapted

#### FR-2: Statement Upload
**Priority:** Critical

The wizard SHALL accept bank statements in multiple formats:
- PDF upload with text extraction
- CSV upload with field mapping
- Manual entry option

For CSV uploads:
- Auto-detect common bank formats
- Field mapping interface (Date, Description, Amount)
- Preview first 5 rows before import
- Validation of required fields

**Acceptance Criteria:**
- [ ] Supports PDF and CSV upload
- [ ] File size limit: 10MB
- [ ] Parses common bank statement formats automatically
- [ ] Clear error messages for unsupported formats
- [ ] Manual entry option always available

#### FR-3: Guided Matching Process
**Priority:** Critical

The wizard SHALL provide step-by-step matching:

**Step 1: Statement Details**
- Account selection
- Statement period (start/end dates)
- Beginning balance
- Ending balance

**Step 2: Auto-Matching**
- Automatically match transactions by date and amount
- Show match confidence (Exact, Likely, Possible)
- Display count: "Matched 47 of 52 transactions automatically"

**Step 3: Manual Review**
- Review auto-matched transactions
- Manually match remaining transactions
- Mark transactions as cleared
- Identify missing transactions

**Step 4: Reconciliation**
- Calculate difference
- Show discrepancy amount if not balanced
- Provide troubleshooting suggestions
- Celebrate if balanced perfectly

**Acceptance Criteria:**
- [ ] Auto-matching accuracy target: >85%
- [ ] Visual indicators for match confidence
- [ ] Unmatched transactions clearly highlighted
- [ ] Running balance displayed throughout
- [ ] Discrepancy amount calculated in real-time

#### FR-4: Discrepancy Troubleshooting
**Priority:** High

When accounts don't balance, the wizard SHALL provide:

**Common Causes Checklist:**
- [ ] "Did you miss recording a transaction?"
- [ ] "Is there a duplicate entry?"
- [ ] "Are there outstanding checks not yet cleared?"
- [ ] "Are there pending deposits?"
- [ ] "Is there a bank fee you haven't recorded?"

**Troubleshooting Actions:**
- Add missing transaction (inline)
- Delete duplicate transaction
- Mark transaction as "not cleared yet"
- Record bank fee or interest

**Acceptance Criteria:**
- [ ] Discrepancy helper appears when difference > $0.01
- [ ] Suggestions based on common patterns
- [ ] Inline transaction creation without leaving wizard
- [ ] Real-time balance recalculation after each action

#### FR-5: Completion and Celebration
**Priority:** Medium

On successful reconciliation:
- Celebration animation (confetti or checkmark)
- Encouraging message adapted to user DISC profile
- Summary of what was reconciled
- Next steps suggestion
- "Download reconciliation report" option

**DISC-Adapted Messages:**
- **D:** "Reconciled! Your accounts are accurate and ready for business."
- **I:** "You reconciled! This is a bigger deal than it sounds. Seriously, many business owners never do this."
- **S:** "Reconciliation complete. Your records are now safely matched with the bank."
- **C:** "Perfect reconciliation. All transactions matched with 100% accuracy."

**Acceptance Criteria:**
- [ ] Celebration shown on successful reconciliation
- [ ] Summary report generated
- [ ] Reconciliation date and user recorded
- [ ] DISC-adapted completion message
- [ ] Optional PDF reconciliation report

### Non-Functional Requirements

#### NFR-1: Performance
- Statement upload processes in < 10 seconds for 500 transactions
- Auto-matching completes in < 5 seconds for 200 transactions
- Real-time balance calculation < 100ms

#### NFR-2: Accuracy
- Auto-matching precision target: >85% for first-time reconciliation
- Learning from corrections improves accuracy over time
- Zero false negatives (must not miss valid matches)

#### NFR-3: Usability
- Average completion time: < 10 minutes for 50 transactions
- Maximum 5 steps in wizard
- Clear progress indication at each step
- Ability to save and resume

## Design Considerations

### User Experience

**Reconciliation Flow:**
```
[First Reconciliation Trigger]
    → [Educational Intro]
    → [Select Account]
    → [Upload Statement / Manual Entry]
    → [Statement Details Entry]
    → [Auto-Matching Progress]
    → [Review Matches]
    → [Manual Matching Interface]
    → [Resolve Discrepancies (if any)]
    → [Celebration!]
    → [Summary Report]
```

**Joy Opportunities:**
- Statement upload: "Got it! Processing your statement..."
- Auto-match success: "Found 47 matches automatically! You just need to review 3."
- Perfect balance: "PERFECT MATCH! The accounting gods smile upon you today."
- Reconciliation streak: "3 months in a row! Your books are consistently accurate."

### Technical Architecture


**Components:**
```typescript
// New components for reconciliation wizard
ReconciliationWizard.tsx      // Main wizard container
ReconciliationIntro.tsx        // Educational introduction
StatementUpload.tsx            // File upload and parsing
StatementDetailsForm.tsx       // Statement period and balances
AutoMatchingProgress.tsx       // Auto-match visualization
MatchReviewList.tsx            // Review auto-matched transactions
ManualMatchingInterface.tsx    // Drag-and-drop manual matching
DiscrepancyHelper.tsx          // Troubleshooting assistant
ReconciliationSummary.tsx      // Completion summary
```

**Matching Algorithm:**
```typescript
interface MatchCandidate {
  statementLine: StatementTransaction;
  bookTransaction: Transaction;
  confidence: 'exact' | 'likely' | 'possible';
  matchScore: number;
}

function autoMatch(
  statementTransactions: StatementTransaction[],
  bookTransactions: Transaction[]
): MatchCandidate[] {
  // 1. Exact match: Date + Amount exact
  // 2. Likely match: Date ±2 days + Amount exact
  // 3. Possible match: Date ±7 days + Amount ±$0.50
  // Return sorted by confidence and score
}
```

**State Management:**
```typescript
interface ReconciliationState {
  accountId: string;
  statementPeriod: { start: Date; end: Date };
  beginningBalance: number;
  endingBalance: number;
  statementTransactions: StatementTransaction[];
  matches: ReconciliationMatch[];
  unmatchedStatement: StatementTransaction[];
  unmatchedBook: Transaction[];
  calculatedBalance: number;
  discrepancy: number;
  status: 'in_progress' | 'balanced' | 'needs_review';
}
```

## Testing Strategy

### Unit Tests
- Statement parsing (PDF and CSV)
- Auto-matching algorithm accuracy
- Balance calculation
- Discrepancy detection

### Integration Tests
- Complete reconciliation flow
- Save and resume functionality
- Transaction creation during reconciliation
- Report generation

### User Acceptance Tests
- First-time reconciliation with guided experience
- Various bank statement formats
- Handling discrepancies
- Perfect match celebration
- Save and resume mid-reconciliation

## Open Questions

1. **Multi-Account Reconciliation:** Should advanced users be able to reconcile multiple accounts simultaneously?
   - **Decision Needed By:** Product Manager
   - **Impact:** Medium - affects power users

2. **Historical Reconciliation:** How far back should users be able to reconcile?
   - **Decision Needed By:** Product Manager + Accountant Consultant
   - **Impact:** High - affects data integrity

3. **Partial Reconciliation:** Should users be able to save a reconciliation as "in progress"?
   - **Decision Needed By:** UX Designer
   - **Impact:** High - affects user workflow flexibility

## Success Metrics

- **Completion Rate:** 60%+ of users complete first reconciliation within 30 days
- **Time to Complete:** Average < 10 minutes for typical monthly statement
- **Auto-Match Accuracy:** >85% for first reconciliation
- **Perfect Balance Rate:** 70%+ of reconciliations balance on first try
- **User Satisfaction:** Post-reconciliation survey > 4.0/5
- **Retention Impact:** Users who reconcile monthly have 2x higher retention

## Related Documentation

- SPEC.md § ACCT-004 (Bank Reconciliation)
- ROADMAP.md Group D (D2), Group E (E1)
- Database schema: TRANSACTIONS table
- File parsing utilities: PDF and CSV parsers
