# Multi-Currency Full - Capability Specification

**Capability ID:** `multi-currency-full` (extends `multi-currency-basic`)
**Related Roadmap Items:** I4
**SPEC Reference:** CURR-001 (extends Group H basic multi-currency)
**Status:** Planned (Phase 4 - Group I)

## Overview

Multi-Currency Full extends basic multi-currency (H5) with automatic exchange rate updates, realized gain/loss tracking, unrealized gain/loss reporting, currency revaluation, and multi-currency aging reports. This provides complete international accounting capabilities for global businesses.

## ADDED Requirements


### Functional Requirements

#### FR-1: Automatic Exchange Rate Updates
**Priority:** High

**ADDED Requirements (extends H5):**

The system SHALL automatically update exchange rates:

**Rate API Integration:**
- Daily exchange rate updates
- Supported providers: Open Exchange Rates, Fixer.io, ExchangeRate-API
- Fallback providers (redundancy if primary fails)
- API key configuration
- Rate source selection (per currency or global)

**Update Schedule:**
- Configurable update time (e.g., 6:00 AM daily)
- Immediate update on demand
- Rate change notifications
- Update history log
- Manual rate override capability (preserved after auto-update)

**Rate Management:**
- Display current rate vs. previous
- Rate change percentage
- Rate effective date
- Source (API provider name)
- Manual override indicator

**Acceptance Criteria:**
- [ ] Daily rate updates execute correctly
- [ ] Fallback provider works on primary failure
- [ ] Manual overrides preserved
- [ ] Rate change notifications sent
- [ ] Update history logged

---

#### FR-2: Realized Gain/Loss on Payments
**Priority:** Critical

**ADDED Requirements (new in I4):**

The system SHALL calculate realized gain/loss:

**Realized G/L Calculation:**
- Occurs when paying foreign currency invoice or bill
- Gain/Loss = (Exchange rate at payment - Exchange rate at invoice) × Amount paid
- Positive = Gain (income), Negative = Loss (expense)
- Post to Other Income or Other Expense account
- Display on payment transaction

**Gain/Loss Posting:**
- Automatic journal entry on payment
- Debit/Credit: Gain/Loss account (Other Income/Expense)
- Debit/Credit: Offsetting account (balances payment entry)
- Memo: "Realized gain/loss on payment of Invoice #1025"
- Link to original invoice/bill

**Realized G/L Display:**
- Show gain/loss amount on payment
- Color coding (green = gain, red = loss)
- Tooltip explaining calculation
- Link to gain/loss journal entry
- Year-to-date realized G/L summary

**Acceptance Criteria:**
- [ ] Gain/loss calculated correctly
- [ ] Journal entry posts automatically
- [ ] Gain/loss displays on payment
- [ ] Calculation formula accurate
- [ ] Summary reports include G/L

---

#### FR-3: Unrealized Gain/Loss Reporting
**Priority:** High

**ADDED Requirements (new in I4):**

The system SHALL report unrealized gain/loss:

**Unrealized G/L Calculation:**
- Revalue open foreign currency invoices and bills
- Unrealized G/L = (Current rate - Original rate) × Outstanding amount
- Calculated but not posted (informational)
- Updated on each rate update
- Month-end snapshot

**Unrealized G/L Report:**
- List all open foreign currency items
- Original amount and rate
- Current rate
- Unrealized gain/loss per item
- Total unrealized G/L
- Group by currency

**Report Features:**
- Filter by currency
- Filter by customer/vendor
- Sort by G/L amount
- Export to PDF/CSV/Excel
- Month-end comparison

**Acceptance Criteria:**
- [ ] Unrealized G/L calculated correctly
- [ ] Report displays clearly
- [ ] Updates on rate changes
- [ ] Export functionality works
- [ ] Month-end snapshots saved

---

#### FR-4: Currency Revaluation
**Priority:** Medium

**ADDED Requirements (new in I4):**

The system SHALL support currency revaluation:

**Revaluation Process:**
- Month-end or on-demand revaluation
- Post unrealized G/L to balance sheet (typically)
- Revaluation journal entry generated
- Reversal entry at start of next period
- Audit trail of revaluations

**Revaluation Entry:**
- Debit/Credit: Foreign currency asset/liability account
- Credit/Debit: Unrealized G/L account (equity or income)
- Memo: "Currency revaluation as of [Date]"
- Reversal entry (first day of next period)

**Revaluation History:**
- Log all revaluations
- Revaluation date and amount
- Exchange rates used
- Reversal status
- Cannot delete (audit trail)

**Acceptance Criteria:**
- [ ] Revaluation executes correctly
- [ ] Journal entry posts
- [ ] Reversal entry creates
- [ ] History logged
- [ ] Audit trail complete

---

#### FR-5: Multi-Currency Aging Reports
**Priority:** High

**ADDED Requirements (new in I4):**

The system SHALL provide multi-currency aging:

**A/R Aging (Multi-Currency):**
- Display in home currency (converted)
- Show foreign currency detail
- Group by currency
- Conversion rates shown
- Total outstanding by currency

**A/P Aging (Multi-Currency):**
- Same features as A/R aging
- Vendor breakdown
- Currency breakdown
- Payment planning by currency

**Aging Report Features:**
- Aging buckets (Current, 1-30, 31-60, 61-90, 90+)
- Foreign and home amounts
- Conversion rates per item
- Total per currency
- Grand total in home currency

**Acceptance Criteria:**
- [ ] Aging displays both currencies
- [ ] Conversion accurate
- [ ] Currency grouping works
- [ ] Totals correct
- [ ] Export includes both currencies

---

### Non-Functional Requirements

#### NFR-1: Accuracy
**Priority:** Critical

**ADDED Requirements:**
- Gain/loss calculation accurate to currency precision
- Zero conversion errors
- Revaluation entries balance
- Rate updates from reliable sources
- Audit trail complete

#### NFR-2: Performance
**Priority:** High

**ADDED Requirements:**
- Rate update completes <30 seconds (all currencies)
- Gain/loss calculation <100ms
- Unrealized G/L report <5 seconds
- Revaluation process <10 seconds
- Aging reports <5 seconds (1000+ items)

#### NFR-3: Reliability
**Priority:** High

**ADDED Requirements:**
- Fallback rate provider on primary failure
- Rate update retry (3 attempts)
- Manual rate override option
- No G/L posting failures
- Revaluation rollback on error

---

## Migration from Basic Multi-Currency (H5)

**Data Migration:**
- Extend EXCHANGE_RATES table (add source, auto-update flag)
- Create GAIN_LOSS_TRANSACTIONS table
- Create REVALUATION_HISTORY table
- No historical G/L calculation (start fresh from migration date)

**Feature Upgrade:**
- H5 users can upgrade to I4 seamlessly
- Historical foreign transactions remain as-is
- New transactions benefit from auto-rates and G/L

---

## Success Metrics
- 50%+ of international businesses use full multi-currency
- 90%+ rate update success (daily)
- Zero gain/loss calculation errors
- >4.5 ease-of-use rating
- 60% reduction in manual rate entry
- 80% improvement in multi-currency reporting accuracy
