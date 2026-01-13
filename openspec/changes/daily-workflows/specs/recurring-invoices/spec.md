# Recurring Invoices - Capability Specification

**Capability ID:** `recurring-invoices`
**Related Roadmap Items:** E4
**SPEC Reference:** ACCT-002
**Status:** Nice-to-Have

## Overview

Recurring Invoices automatically generate and optionally send invoices on a schedule, perfect for subscription businesses, retainers, and monthly services.

## ADDED Requirements


### Functional Requirements

#### FR-1: Recurring Invoice Creation
- Create from existing invoice template
- Set frequency (monthly, quarterly, yearly, custom)
- Auto-send vs. draft for review
- Customer notification preferences
- Start date and end condition

#### FR-2: Automatic Invoice Generation
- Generates invoices on schedule
- Auto-increments invoice numbers
- Applies custom template/branding
- Creates transaction record
- Sends email if auto-send enabled

#### FR-3: Recurring Revenue Tracking
- Dashboard widget: "$2,400/month in recurring invoices"
- Forecast future recurring revenue
- Churn tracking (cancelled recurring invoices)
- ARR/MRR calculations

#### FR-4: Management Interface
- List all recurring invoice schedules
- Next invoice date preview
- Pause/resume schedules
- Edit schedule or single invoice
- History of generated invoices

### Technical Details

Extends `recurring-transactions` infrastructure:
```typescript
interface RecurringInvoice extends RecurringTransaction {
  customer_id: string;
  template_id: string;
  line_items: InvoiceLineItem[];
  auto_send: boolean;
  email_template_id: string;
}
```

## Success Metrics
- 40%+ of recurring revenue businesses use feature
- 25% increase in invoice send volume
- Recurring revenue tracking accuracy 99%+
