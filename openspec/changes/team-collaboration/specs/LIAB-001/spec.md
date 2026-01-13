# Interest Split Prompt - Capability Specification

**Capability ID:** `interest-split`
**Related Roadmap Items:** H7
**SPEC Reference:** LIAB-001
**Status:** Planned (Phase 4)

## Overview

Interest Split Prompt System detects loan payments and prompts users to split principal and interest components, generating proper accounting entries and providing education about tax deductibility. This ensures accurate liability reduction and expense tracking for loan payments.

## ADDED Requirements


### Functional Requirements

#### FR-1: Liability Payment Detection
**Priority:** High

**ADDED Requirements:**

The system SHALL detect liability payments:

**Detection Logic:**
- Monitor transactions to liability accounts (account type = Liability)
- Identify loan accounts (liability subtype = Loan, Line of Credit, etc.)
- Detect payment transactions (credits to liability, debits from cash)
- Trigger split prompt on detection
- Frequency control (don't prompt every time)

**Detection Rules:**
- Transaction to liability account = potential loan payment
- Amount >$0 (positive payment)
- Not already split (no linked split entry)
- User has not disabled prompts for this loan

**Prompt Triggering:**
- Immediate prompt (modal on transaction save)
- Deferred prompt (checklist item)
- Batch prompt (multiple payments detected)
- Frequency: Every payment, Weekly, Monthly, Never

**Acceptance Criteria:**
- [ ] Loan payments detected correctly
- [ ] Prompt triggers appropriately
- [ ] Frequency control works
- [ ] User preferences respected
- [ ] No false positives

---

#### FR-2: Split Workflow
**Priority:** High

**ADDED Requirements:**

The system SHALL provide guided split workflow:

**Split Prompt Modal:**
- Transaction details (amount, loan account, date)
- "Split principal and interest?" question
- Educational content (Why split? Tax deductibility)
- Input fields for principal and interest amounts
- Auto-calculation (if total known)
- Preview split entry before posting

**Split Entry Interface:**
- Enter principal amount (reduces liability)
- Enter interest amount (expense)
- Total validation (principal + interest = payment amount)
- Swap/reverse if user enters backwards
- Clear labeling (Principal = loan reduction, Interest = tax-deductible expense)

**Educational Tooltips:**
- Why split principal and interest
- Tax deductibility of interest (US focus)
- Impact on financial statements (reduces liability, increases expense)
- Link to IRS guidance (US) or equivalent

**Actions:**
- Split Now (proceed with split)
- Not Now (add to checklist for later)
- Never for this loan (disable prompts)
- Always split automatically (auto-split future payments)

**Acceptance Criteria:**
- [ ] Prompt modal displays correctly
- [ ] Educational content clear
- [ ] Amount entry validation works
- [ ] Auto-calculation accurate
- [ ] Preview shows split entry
- [ ] Actions function correctly

---

#### FR-3: Journal Entry Generation
**Priority:** High

**ADDED Requirements:**

The system SHALL generate split journal entries:

**Journal Entry Structure:**
- Debit: Loan Principal (liability reduction) - principal amount
- Debit: Interest Expense - interest amount
- Credit: Cash (payment) - total amount
- Memo: "Split principal and interest for [Loan Name]"
- Date: Same as original payment date

**Entry Generation:**
- Auto-create journal entry from split amounts
- Link to original payment transaction
- Display split reference on both entries
- Audit trail of split generation
- Edit capability before posting

**Preview Before Posting:**
- Show journal entry debits/credits
- Explain each line (Principal reduces loan, Interest is expense)
- Confirm or edit before posting
- Cancel and return to split workflow

**Acceptance Criteria:**
- [ ] Journal entry generates correctly
- [ ] Debits and credits balance
- [ ] Link to original transaction maintained
- [ ] Preview displays clearly
- [ ] Edit capability works
- [ ] Audit trail complete

---

#### FR-4: Checklist Integration
**Priority:** Medium

**ADDED Requirements:**

The system SHALL integrate with checklist:

**"Not Now" Action:**
- Add checklist item: "Split interest from [Loan] payment"
- Link to original transaction
- Due date: 7 days from payment date
- Priority: Medium
- Clear from checklist on completion

**Checklist Item Features:**
- Click to open split workflow for that payment
- Dismiss if not applicable
- Snooze for 7 days
- Mark complete (if split manually)

**Bulk Split from Checklist:**
- If multiple payments pending split
- Show all pending splits
- Bulk split workflow (enter amounts for multiple payments)
- Batch journal entry generation

**Acceptance Criteria:**
- [ ] Checklist item creates correctly
- [ ] Link to transaction works
- [ ] Click opens split workflow
- [ ] Complete removes from checklist
- [ ] Bulk split functions

---

#### FR-5: Settings and Preferences
**Priority:** Medium

**ADDED Requirements:**

The system SHALL support prompt settings:

**Global Settings:**
- Enable/disable interest split prompts globally
- Default prompt frequency (Every payment, Weekly, Monthly)
- Auto-split if interest amount known (future)

**Per-Loan Settings:**
- Enable/disable prompts for specific loan
- "Don't ask again for this loan"
- Re-enable in loan account settings
- Override global setting

**Educational Content:**
- "Why split principal and interest?"
- "Is interest tax-deductible?" (by loan type)
- Links to IRS Publication 535 (US)
- Video tutorial (future)

**Acceptance Criteria:**
- [ ] Global settings save and apply
- [ ] Per-loan settings override global
- [ ] Re-enable capability works
- [ ] Educational content accessible
- [ ] Settings UI clear

---

### Non-Functional Requirements

#### NFR-1: Accuracy
**Priority:** Critical

**ADDED Requirements:**
- Principal + Interest must equal payment amount (validation)
- Journal entry must balance (debits = credits)
- Loan liability reduced correctly
- Interest expense recorded correctly
- Audit trail complete

#### NFR-2: Usability
**Priority:** High

**ADDED Requirements:**
- Prompt clear and non-intrusive
- Educational content helpful, not overwhelming
- "Not Now" option prominent (no forced action)
- Settings easy to find and change
- Preview makes impact clear

#### NFR-3: Education
**Priority:** High

**ADDED Requirements:**
- Plain English explanations
- Visual diagram of split (principal vs. interest)
- Tax deductibility explained simply
- Examples provided
- Links to authoritative sources (IRS, etc.)

---

## Use Cases

**Use Case 1: First Loan Payment**
- User records loan payment
- System detects liability account
- Prompt displays with educational content
- User reads about tax deductibility
- User enters principal and interest amounts
- System generates and posts split entry
- User sees loan balance reduced and interest expense recorded

**Use Case 2: Recurring Payments (Same Split)**
- User records second loan payment (same split as first)
- System detects payment
- Prompt offers to "Use same split as last time?"
- User accepts
- System auto-generates split entry
- User confirms and posts

**Use Case 3: Not Now (Checklist)**
- User records loan payment in rush
- Prompt displays
- User clicks "Not Now"
- System adds checklist item
- Later, user reviews checklist
- Clicks on split item
- Completes split workflow

**Use Case 4: Disable for Loan**
- User has simple loan (no tax benefit)
- User clicks "Never for this loan"
- System disables prompts for that loan
- Future payments don't trigger prompt
- User can re-enable in loan settings if needed

---

## Success Metrics
- 60%+ of loan payments split correctly
- 40%+ of users enable interest split prompts
- >4.0 ease-of-use rating
- 70%+ of splits completed within 7 days (via checklist)
- 80% reduction in improper loan payment recording
- 50% increase in interest expense tracking accuracy
