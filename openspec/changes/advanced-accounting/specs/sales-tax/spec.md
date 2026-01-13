# Sales Tax - Basic - Capability Specification

**Capability ID:** `sales-tax`
**Related Roadmap Items:** G4
**SPEC Reference:** ACCT-008
**Status:** In Development

## Overview

Sales Tax management enables businesses to calculate, collect, and track sales tax on invoices. This includes tax rate setup, automatic calculation, exemption handling, tax liability reporting, and filing reminders.

## ADDED Requirements


### Functional Requirements

#### FR-1: Tax Rate Setup
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support tax rate configuration:

**Tax Rate Fields:**
- Tax name (e.g., "CA State Sales Tax")
- Tax rate (percentage)
- Tax jurisdiction
- Effective date range
- Combined rates (state + local)
- Active/inactive status

**Combined Rates:**
- Multiple tax components
- Automatic combination
- Display as single rate
- Track components separately

**Rate History:**
- Track rate changes over time
- Apply correct rate based on invoice date
- Historical reporting accuracy

**Acceptance Criteria:**
- [ ] Tax rates save correctly
- [ ] Combined rates calculate
- [ ] Rate changes tracked
- [ ] Historical rates accessible

---

#### FR-2: Automatic Tax Calculation
**Priority:** Critical

**ADDED Requirements:**

The system SHALL automatically calculate tax on invoices:

**Calculation Features:**
- Apply tax to taxable line items
- Display tax amount separately
- Include tax in invoice total
- Itemized tax display
- Multiple tax rates per invoice (multi-jurisdiction)

**Taxability:**
- Mark products/services as taxable or non-taxable
- Default taxability per product
- Override on invoice line
- Non-taxable reasons (resale, exempt, etc.)

**Acceptance Criteria:**
- [ ] Tax calculates correctly
- [ ] Non-taxable items excluded
- [ ] Display clear and accurate
- [ ] Invoice totals correct

---

#### FR-3: Customer Exemptions
**Priority:** High

**ADDED Requirements:**

The system SHALL handle tax-exempt customers:

**Exemption Features:**
- Mark customer as tax-exempt
- Store exemption certificate
- Exemption reason codes
- Expiration date tracking
- Alert on expired certificates

**Certificate Management:**
- Upload exemption certificates
- Certificate storage
- Expiration reminders
- Certificate retrieval for audit

**Acceptance Criteria:**
- [ ] Exempt customers not taxed
- [ ] Certificates stored securely
- [ ] Expiration tracking works
- [ ] Alerts trigger correctly

---

#### FR-4: Tax Liability Reporting
**Priority:** Critical

**ADDED Requirements:**

The system SHALL provide tax liability reports:

**Tax Liability Report:**
- Total tax collected
- By jurisdiction breakdown
- By period (monthly, quarterly)
- Less tax paid
- Net liability

**Report Features:**
- Date range selection
- Export to PDF/CSV
- Filing period support
- Jurisdiction filtering

**Acceptance Criteria:**
- [ ] Report accurate
- [ ] Jurisdiction breakdown correct
- [ ] Export works
- [ ] Performance acceptable

---

#### FR-5: Filing Reminders
**Priority:** Medium

**ADDED Requirements:**

The system SHALL provide filing reminders:

**Reminder Features:**
- Configurable filing periods
- Email/dashboard reminders
- Filing deadline tracking
- Filing history
- Mark as filed

**Filing Periods:**
- Monthly, Quarterly, Annually
- Custom periods
- Multiple jurisdictions
- Reminder lead time (7 days before, etc.)

**Acceptance Criteria:**
- [ ] Reminders trigger on time
- [ ] Filing history tracked
- [ ] Multiple periods supported
- [ ] Email notifications work

---

### Non-Functional Requirements

#### NFR-1: Accuracy
**Priority:** Critical

**ADDED Requirements:**
- Tax calculations MUST be accurate to $0.01
- Rounding rules configurable
- Audit trail for all tax transactions
- Zero calculation errors

#### NFR-2: Compliance
**Priority:** Critical

**ADDED Requirements:**
- Support major US jurisdictions
- Multi-rate support (state + local)
- Exemption certificate storage compliant
- Reporting meets filing requirements

---

## Success Metrics
- 50%+ of applicable businesses set up tax
- 90%+ tax calculation accuracy
- Zero rounding errors
- >4.0 ease-of-use rating
