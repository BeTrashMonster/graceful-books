# Multi-Currency Basic - Capability Specification

**Capability ID:** `multi-currency-basic`
**Related Roadmap Items:** H5
**SPEC Reference:** CURR-001
**Status:** Planned (Phase 4)

## Overview

Multi-Currency Basic enables businesses to record transactions in foreign currencies with manual exchange rate entry and conversion to home currency for reporting. This foundational multi-currency support serves international businesses without the complexity of automatic rates and realized/unrealized gain/loss tracking (which comes in Group I).

## ADDED Requirements


### Functional Requirements

#### FR-1: Currency Setup
**Priority:** High

**ADDED Requirements:**

The system SHALL support currency management:

**Currency Configuration:**
- Add currencies (ISO 4217 codes: USD, EUR, GBP, CAD, AUD, etc.)
- Currency name and symbol
- Currency code (3-letter ISO)
- Set home currency (required)
- Active/inactive status
- Currency precision (decimal places)

**Home Currency:**
- One home currency per company
- All reporting in home currency
- Home currency cannot be disabled
- Warning on home currency change
- Historical transactions remain in original home currency

**Supported Currencies:**
- 150+ ISO 4217 currencies
- Common currencies pre-populated
- Custom currency support (future)
- Cryptocurrency support (future)

**Acceptance Criteria:**
- [ ] Currencies add correctly
- [ ] Home currency set and enforced
- [ ] ISO 4217 codes validated
- [ ] Active/inactive toggle works
- [ ] Currency list displays

---

#### FR-2: Exchange Rate Management
**Priority:** High

**ADDED Requirements:**

The system SHALL support manual exchange rate entry:

**Exchange Rate Entry:**
- Enter exchange rates manually per currency
- Rate effective date
- Rate type (buy, sell, average) - basic uses average
- Rate history tracking
- Current rate vs. historical rates

**Rate Application:**
- Apply correct rate based on transaction date
- If no rate for transaction date, use nearest prior rate
- Warning if rate is old (>30 days)
- Rate override capability per transaction
- Audit trail of rates used

**Rate Display:**
- Current rate for each currency
- Last updated date
- Rate source (manual entry)
- Rate change history
- Rate comparison (vs. previous)

**Acceptance Criteria:**
- [ ] Rates save correctly
- [ ] Effective date enforced
- [ ] Rate history tracked
- [ ] Correct rate applied to transactions
- [ ] Rate warnings display

---

#### FR-3: Foreign Currency Transactions
**Priority:** High

**ADDED Requirements:**

The system SHALL support foreign currency transactions:

**Transaction Entry:**
- Select currency for transaction
- Enter amount in foreign currency
- Automatic conversion to home currency using rate
- Display both foreign and home amounts
- Override conversion if needed (manual adjustment)

**Supported Transaction Types:**
- Expenses in foreign currency
- Income in foreign currency
- Invoices in foreign currency
- Bills in foreign currency
- Journal entries in foreign currency

**Dual Amount Display:**
- Foreign currency amount (as entered)
- Home currency amount (converted)
- Exchange rate used
- Conversion date
- Clear labeling (e.g., "€100.00 EUR (≈$110.00 USD @ 1.10)")

**Acceptance Criteria:**
- [ ] Foreign currency selection works
- [ ] Conversion automatic and accurate
- [ ] Both amounts display correctly
- [ ] Override capability works
- [ ] All transaction types support foreign currency

---

#### FR-4: Currency Conversion
**Priority:** High

**ADDED Requirements:**

The system SHALL convert foreign currency to home currency:

**Conversion Features:**
- Automatic conversion using effective rate
- Conversion at transaction date rate
- Display conversion rate on transaction
- Audit trail of conversion
- Recalculation if rate changes (historical)

**Conversion Rules:**
- Use rate effective on transaction date
- If no exact date rate, use nearest prior
- Warn if rate >30 days old
- Round to home currency precision
- Store both original and converted amounts

**Conversion Display:**
- Foreign amount (original)
- Conversion rate
- Home amount (converted)
- Conversion date
- Tooltip explaining conversion

**Acceptance Criteria:**
- [ ] Conversion accurate to currency precision
- [ ] Correct rate used for date
- [ ] Conversion audit trail maintained
- [ ] Display clear and informative
- [ ] Rounding consistent

---

#### FR-5: Multi-Currency Reporting
**Priority:** High

**ADDED Requirements:**

The system SHALL provide multi-currency reporting:

**Report Features:**
- All reports in home currency (converted)
- Foreign currency detail available
- Conversion rates shown on detail
- Currency breakdown (how much in each currency)
- Conversion rate summary

**Supported Reports:**
- Profit & Loss (home currency)
- Balance Sheet (home currency)
- Cash Flow (home currency)
- Transaction List (with foreign currency detail)
- Foreign Currency Activity Report (new)

**Foreign Currency Activity Report:**
- Transactions by currency
- Total in each foreign currency
- Total converted to home currency
- Conversion rates used
- Period comparison

**Report Options:**
- Show foreign amounts toggle
- Hide/show conversion rates
- Currency filter (e.g., only EUR transactions)
- Export with currency columns

**Acceptance Criteria:**
- [ ] Reports display in home currency
- [ ] Foreign detail accessible
- [ ] Conversion rates visible
- [ ] Currency breakdown accurate
- [ ] Export includes currency columns

---

### Non-Functional Requirements

#### NFR-1: Accuracy
**Priority:** Critical

**ADDED Requirements:**
- Conversion accuracy to currency precision (typically 2 decimals)
- Rounding rules consistent (half-up)
- Zero conversion errors
- Audit trail for all conversions
- Rate history immutable

#### NFR-2: Usability
**Priority:** High

**ADDED Requirements:**
- Dual currency display clear and unambiguous
- Currency selection easy (dropdown with symbols)
- Exchange rate entry simple (one field per currency)
- Warnings for missing or old rates
- Educational content about multi-currency accounting

#### NFR-3: Performance
**Priority:** Medium

**ADDED Requirements:**
- Currency conversion calculation <100ms
- Reports with foreign currency <5 seconds
- Supports 10+ active currencies
- Supports 1000+ foreign currency transactions

---

## Limitations (Basic Mode)

**Not Included in Basic Multi-Currency (H5):**
- Automatic exchange rate updates (requires Group I - I4)
- Realized gain/loss on payments (requires Group I - I4)
- Unrealized gain/loss on open items (requires Group I - I4)
- Currency revaluation (requires Group I - I4)
- Multi-currency aging reports (requires Group I - I4)

**Rationale:** Basic mode provides foundational multi-currency support with manual rates for businesses with occasional foreign transactions. Full multi-currency with automatic rates and gain/loss tracking adds significant complexity and is deferred to Group I.

---

## Success Metrics
- 30%+ of businesses enable multi-currency
- 50%+ of international businesses use multi-currency
- Zero conversion errors
- >4.0 ease-of-use rating
- 90%+ of foreign currency transactions entered correctly
- 40% reduction in manual currency conversion errors
