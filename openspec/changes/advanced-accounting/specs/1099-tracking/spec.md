# 1099 Tracking - Capability Specification

**Capability ID:** `1099-tracking`
**Related Roadmap Items:** G7
**SPEC Reference:** ACCT-003
**Status:** In Development

## Overview

1099 Tracking enables businesses to track contractor payments for year-end 1099 reporting. This includes vendor flagging, payment aggregation, W-9 management, threshold monitoring, and summary report generation for tax filing.

## ADDED Requirements


### Functional Requirements

#### FR-1: 1099-Eligible Vendor Marking
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support 1099-eligible vendor tracking:

**Vendor Configuration:**
- Flag vendor as 1099-eligible
- Vendor type (individual, LLC, corporation)
- TIN/SSN (encrypted storage)
- Business name
- Address
- Exemption status

**Vendor Types:**
- Individual (most common)
- Single-member LLC (1099 required)
- Partnership (1099 required)
- Corporation (usually exempt)
- Tax-exempt organizations

**Acceptance Criteria:**
- [ ] Vendors flag correctly
- [ ] TIN/SSN encrypted at rest
- [ ] Type selection works
- [ ] Exemptions handled

---

#### FR-2: Payment Tracking and Aggregation
**Priority:** Critical

**ADDED Requirements:**

The system SHALL track payments to 1099 vendors:

**Tracking Features:**
- Automatic payment aggregation by vendor and year
- Year-to-date total per vendor
- Threshold monitoring ($600 minimum for most boxes)
- Payment category tracking (which 1099 box)
- Transaction history per vendor

**1099 Box Assignment:**
- Box 1: Rents
- Box 7: Nonemployee compensation (most common)
- Box 14: Gross proceeds paid to an attorney
- Other boxes as applicable
- Multiple boxes per vendor (if needed)

**Threshold Monitoring:**
- Alert when vendor approaches $600
- Highlight vendors over threshold
- Year-end summary of all over-threshold vendors
- Missing information alerts

**Acceptance Criteria:**
- [ ] Payment aggregation accurate
- [ ] Threshold monitoring works
- [ ] Box assignment correct
- [ ] Alerts trigger appropriately

---

#### FR-3: W-9 Management
**Priority:** High

**ADDED Requirements:**

The system SHALL manage W-9 forms:

**W-9 Storage:**
- Upload W-9 PDF or image
- Store encrypted
- Link to vendor
- Expiration tracking (if applicable)
- Request W-9 workflow

**W-9 Request:**
- Email template to request W-9
- Track request status (sent, received, pending)
- Reminder emails
- Missing W-9 alerts

**Compliance:**
- Verify TIN matches W-9
- Check name matches
- Validate address
- Alert discrepancies

**Acceptance Criteria:**
- [ ] W-9 upload works
- [ ] Storage encrypted
- [ ] Request workflow functional
- [ ] Missing W-9 alerts trigger

---

#### FR-4: 1099 Summary Report
**Priority:** Critical

**ADDED Requirements:**

The system SHALL generate 1099 summary reports:

**Report Features:**
- List all 1099-eligible vendors
- Total payments per vendor (by year)
- Threshold status (over/under $600)
- Box assignment per vendor
- Missing information identification
- Export for 1099 preparation

**Report Formats:**
- PDF (formatted report)
- CSV (for import to tax software)
- Excel (with formulas)
- Accountant-ready export package

**Year-End Checklist:**
- Vendors over threshold
- Missing W-9s
- Missing TINs
- Address verification
- Ready-to-file status

**Acceptance Criteria:**
- [ ] Report accurate
- [ ] All formats export correctly
- [ ] Missing info identified
- [ ] Checklist comprehensive

---

#### FR-5: Tax Season Preparation
**Priority:** Medium

**ADDED Requirements:**

The system SHALL assist with tax season prep:

**Tax Season Features:**
- 1099 preparation workflow
- Filing deadline reminders
- Missing information identification
- Step-by-step guidance
- Accountant export package
- Filing history tracking

**Guidance:**
- "You have 5 vendors who need 1099s"
- "Missing: W-9 for [Vendor]"
- "All set! Ready to generate 1099s."
- Link to IRS instructions
- CPA consultation reminder

**Acceptance Criteria:**
- [ ] Workflow comprehensive
- [ ] Reminders timely
- [ ] Guidance helpful
- [ ] Export ready for filing

---

### Non-Functional Requirements

#### NFR-1: Security and Compliance
**Priority:** Critical

**ADDED Requirements:**
- TIN/SSN encrypted at rest
- TIN/SSN encrypted in transit
- Audit trail for all 1099 data access
- Data retention compliance (IRS: 4 years minimum)
- Access controls for sensitive data

#### NFR-2: Performance
**Priority:** High

**ADDED Requirements:**
- Payment aggregation real-time
- Summary report generation <2 seconds
- Export completes in <5 seconds
- Support 1,000+ 1099 vendors

---

## User Experience

### Educational Content
- "Tax time is easier when 1099 tracking is automatic all year"
- "The IRS requires 1099s for contractors paid $600+ per year"
- Clear explanations of requirements
- Links to IRS guidance

### Joy Opportunities
- Year-end readiness celebration
- "You're 100% ready for 1099s!"
- Progress tracking throughout year
- "5 vendors need 1099s - all info complete!"

---

## Success Metrics
- 80%+ of 1099-eligible vendors tracked
- 95%+ have W-9s on file
- 100% payment aggregation accuracy
- >4.5 tax season readiness rating
- Zero TIN/SSN security incidents
