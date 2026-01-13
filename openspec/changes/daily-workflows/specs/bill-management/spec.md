# Bill Management - Capability Specification

**Capability ID:** `bill-management`
**Related Roadmap Items:** E6
**SPEC Reference:** ACCT-003
**Status:** Nice-to-Have

## Overview

Bill Management enables users to track bills owed to vendors, manage due dates, and prevent late payments. This capability complements vendor management and expense tracking.

## ADDED Requirements

### Functional Requirements

#### FR-1: Bill Entry
**Manual Entry:**
- Vendor selection (required)
- Amount (required)
- Due date (required)
- Bill number (optional)
- Category/account (optional)
- Attachments (PDF, images)
- Notes

**From Receipt:**
- Upload receipt/bill image
- OCR extraction (amount, date, vendor) - if E5 AI available
- Pre-fill bill entry form

#### FR-2: Bill Status Workflow
**Status States:**
- **Draft:** Bill entered but not confirmed
- **Due:** Bill confirmed and awaiting payment
- **Overdue:** Past due date
- **Paid:** Payment recorded and linked

**Status Transitions:**
- Draft → Due (confirm bill)
- Due → Paid (record payment)
- Any → Void (cancel bill)

#### FR-3: Due Date Tracking and Alerts
**Dashboard Widget:**
- "Upcoming Bills" (next 7 days)
- Total amount due
- Overdue bills highlighted (red)

**Notifications:**
- 7 days before due: "Reminder: Bill from [Vendor] due on [Date]"
- Day before due: "Urgent: Bill due tomorrow"
- Overdue: "Bill from [Vendor] is overdue"

**Calendar View:**
- Bills visualized on calendar
- Color-coded by status
- Click to view/pay

#### FR-4: Bill Payment Recording
**Payment Creation:**
- "Record Payment" from bill detail
- Pre-fills: vendor, amount, category
- Links to bill automatically
- Updates bill status to "Paid"

**Partial Payments:**
- Record partial amount
- Bill remains "Due" until fully paid
- Track payment history

#### FR-5: Bill List and Filtering
**List View:**
- All bills with status, vendor, amount, due date
- Sort by: due date, amount, vendor, status
- Filter by: status, vendor, date range, category

**Quick Actions:**
- Mark as paid
- Record payment
- Edit bill
- Delete bill

### Technical Details


**Data Model:**
```typescript
interface Bill {
  id: string;
  company_id: string;
  vendor_id: string;
  bill_number?: string;
  amount: number;
  due_date: Date;
  status: 'draft' | 'due' | 'overdue' | 'paid' | 'void';
  category_id?: string;
  notes?: string;
  attachments: string[]; // URLs
  payments: BillPayment[];
  created_at: Date;
  updated_at: Date;
}

interface BillPayment {
  id: string;
  bill_id: string;
  transaction_id: string; // Links to expense transaction
  amount: number;
  payment_date: Date;
}
```

**Components:**
```typescript
BillList.tsx              // Main list view
BillForm.tsx              // Create/edit bill
BillDetail.tsx            // Bill details
BillPaymentForm.tsx       // Record payment
UpcomingBillsWidget.tsx   // Dashboard widget
BillCalendar.tsx          // Calendar view
```

## Success Metrics
- 40%+ of active users track at least 1 bill per month
- 30% reduction in late payment fees (user survey)
- 90%+ bills paid on time (vs. baseline)
- Dashboard widget viewed 2x per week average
