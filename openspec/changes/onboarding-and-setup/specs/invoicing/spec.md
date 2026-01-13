# Capability Spec: Invoicing (Basic)

## Overview
The Invoicing capability provides basic invoice creation, PDF generation, email delivery, and status tracking. This foundational invoicing feature enables users to create professional invoices and track payments from customers.

## ADDED Requirements


### ACCT-002: Invoicing Features (Basic subset)
**Priority:** Critical
**Category:** Accounting

**INVOICING FEATURES (Group C - Basic):**
1. Invoice creation with line items
2. Basic templates (3-5 options)
3. Invoice preview
4. PDF generation
5. Send via email
6. Invoice status tracking (Draft, Sent, Viewed, Paid, Overdue)
7. Invoice list with filtering
8. Invoice number auto-generation

**FUTURE (Post-Group C):**
- Customizable templates with branding
- Recurring invoices
- Deposit/retainer invoices
- Late fee automation
- Batch invoicing
- Multiple payment methods
- Client portal

**ACCEPTANCE CRITERIA:**
- [ ] Invoice sends via email within 30 seconds
- [ ] PDF generation matches preview exactly
- [ ] Invoice numbers auto-increment and are customizable
- [ ] Status tracking is accurate and real-time
- [ ] Invoice creates proper accounting transaction when paid

## Data Models

### Invoice
```typescript
interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string; // Auto-generated or custom

  // Client information
  clientId: string;
  clientSnapshot: ClientSnapshot; // Frozen at invoice time

  // Dates
  invoiceDate: Date;
  dueDate: Date;
  paidDate?: Date;

  // Line items
  lineItems: InvoiceLineItem[];

  // Amounts
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;

  // Tax (optional, basic for Group C)
  taxRate?: number;
  taxLabel?: string; // e.g., "Sales Tax", "VAT"

  // Terms and notes
  paymentTerms: string; // e.g., "Net 30", "Due on receipt"
  paymentTermsDays?: number; // Calculated from paymentTerms
  notes?: string; // Internal notes
  customerMessage?: string; // Message on invoice

  // Status
  status: InvoiceStatus;
  sentAt?: Date;
  viewedAt?: Date;

  // Template
  templateId: string;

  // Attachments (future)
  attachments?: string[];

  // Accounting integration
  transactionId?: string; // Link to accounting transaction when paid

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
}

type InvoiceStatus =
  | 'draft' // Not sent
  | 'sent' // Emailed to client
  | 'viewed' // Client opened email/PDF
  | 'paid' // Payment received
  | 'overdue' // Past due date
  | 'cancelled'; // Cancelled before payment

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number; // Unit price
  amount: number; // quantity * rate
  taxable: boolean; // Subject to tax (if tax enabled)
}

interface ClientSnapshot {
  // Frozen copy of client info at invoice time
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  billingAddress?: Address;
}

interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  preview: string; // Image URL

  // Layout
  layout: 'standard' | 'modern' | 'classic' | 'minimal' | 'bold';

  // Default settings
  defaultPaymentTerms: string;
  defaultCustomerMessage: string;

  // For future (Group E - customizable templates)
  customizable: boolean;
}
```

### InvoiceNumbering
```typescript
interface InvoiceNumberingScheme {
  id: string;
  companyId: string;

  // Pattern
  prefix: string; // e.g., "INV-"
  nextNumber: number;
  suffix?: string;
  padding: number; // e.g., 5 for "00001"

  // Example: "INV-00042"
  // prefix: "INV-", nextNumber: 42, padding: 5

  // Reset options (future)
  resetAnnually?: boolean;
  resetMonthly?: boolean;
}
```

## API

### Invoicing API
```typescript
interface InvoicingEngine {
  // CRUD operations
  createInvoice(invoice: CreateInvoiceInput): Promise<Invoice>;
  getInvoice(invoiceId: string): Promise<Invoice>;
  updateInvoice(
    invoiceId: string,
    updates: UpdateInvoiceInput
  ): Promise<Invoice>;
  deleteInvoice(invoiceId: string): Promise<void>; // Soft delete

  // List and search
  listInvoices(options?: ListOptions): Promise<InvoiceList>;
  searchInvoices(query: string): Promise<Invoice[]>;

  // Status management
  sendInvoice(invoiceId: string, options?: SendOptions): Promise<Invoice>;
  markAsPaid(
    invoiceId: string,
    paymentDetails: PaymentDetails
  ): Promise<Invoice>;
  markAsViewed(invoiceId: string): Promise<Invoice>;
  cancelInvoice(invoiceId: string, reason: string): Promise<Invoice>;

  // PDF generation
  generatePDF(invoiceId: string): Promise<Blob>;
  previewPDF(invoiceId: string): Promise<Blob>;

  // Templates
  getTemplates(): Promise<InvoiceTemplate[]>;
  getTemplate(templateId: string): Promise<InvoiceTemplate>;

  // Invoice numbering
  getNextInvoiceNumber(): Promise<string>;
  updateNumberingScheme(scheme: InvoiceNumberingScheme): Promise<void>;

  // Validation
  validateInvoice(invoice: Partial<Invoice>): ValidationResult;

  // Statistics
  getInvoiceStats(filter?: InvoiceFilter): Promise<InvoiceStats>;
}

interface CreateInvoiceInput {
  clientId: string;
  invoiceDate: Date;
  dueDate: Date;
  lineItems: LineItemInput[];
  paymentTerms: string;
  taxRate?: number;
  taxLabel?: string;
  notes?: string;
  customerMessage?: string;
  templateId: string;
}

interface LineItemInput {
  description: string;
  quantity: number;
  rate: number;
  taxable: boolean;
}

interface UpdateInvoiceInput {
  invoiceDate?: Date;
  dueDate?: Date;
  lineItems?: LineItemInput[];
  paymentTerms?: string;
  taxRate?: number;
  notes?: string;
  customerMessage?: string;
  templateId?: string;
}

interface SendOptions {
  to?: string; // Override client email
  cc?: string[];
  subject?: string;
  body?: string; // Email body
  attachPDF?: boolean; // Default true
}

interface PaymentDetails {
  paymentDate: Date;
  amount: number;
  paymentMethod?: string; // e.g., "Check", "Wire", "Cash"
  reference?: string; // Check number, transaction ID, etc.
  notes?: string;
}

interface ListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'number' | 'date' | 'dueDate' | 'total' | 'status';
  sortOrder?: 'asc' | 'desc';
  filter?: InvoiceFilter;
}

interface InvoiceFilter {
  status?: InvoiceStatus | InvoiceStatus[];
  clientId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

interface InvoiceList {
  invoices: Invoice[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface InvoiceStats {
  total: number;
  draft: number;
  sent: number;
  overdue: number;
  paid: number;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  averageInvoiceAmount: number;
  averageDaysToPay: number;
}
```

## Business Logic

### Invoice Creation
```typescript
async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  // Validation
  const validation = validateInvoiceInput(input);
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }

  // Get client info (snapshot at invoice time)
  const client = await getClient(input.clientId);
  const clientSnapshot: ClientSnapshot = {
    id: client.id,
    displayName: client.displayName,
    email: client.email,
    phone: client.phone,
    billingAddress: client.billingAddress
  };

  // Calculate amounts
  const lineItems = input.lineItems.map(item => ({
    id: generateId(),
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    amount: roundCurrency(item.quantity * item.rate),
    taxable: item.taxable
  }));

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  let taxAmount = 0;
  if (input.taxRate && input.taxRate > 0) {
    const taxableAmount = lineItems
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + item.amount, 0);
    taxAmount = roundCurrency(taxableAmount * (input.taxRate / 100));
  }

  const total = roundCurrency(subtotal + taxAmount);

  // Generate invoice number
  const invoiceNumber = await getNextInvoiceNumber();

  // Calculate payment terms days
  const paymentTermsDays = parsePaymentTerms(input.paymentTerms);

  // Create invoice
  const invoice: Invoice = {
    id: generateId(),
    companyId: getCurrentCompanyId(),
    invoiceNumber,
    clientId: input.clientId,
    clientSnapshot,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate,
    lineItems,
    subtotal,
    taxAmount,
    total,
    amountPaid: 0,
    amountDue: total,
    taxRate: input.taxRate,
    taxLabel: input.taxLabel || 'Tax',
    paymentTerms: input.paymentTerms,
    paymentTermsDays,
    notes: input.notes,
    customerMessage: input.customerMessage,
    status: 'draft',
    templateId: input.templateId,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: getCurrentUserId(),
    lastModifiedBy: getCurrentUserId()
  };

  // Save
  await saveInvoice(invoice);

  // Audit log
  await logAuditEvent({
    type: 'invoice-created',
    entityId: invoice.id,
    userId: getCurrentUserId(),
    timestamp: new Date(),
    details: {
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      total: invoice.total
    }
  });

  return invoice;
}
```

### Invoice Sending
```typescript
async function sendInvoice(
  invoiceId: string,
  options?: SendOptions
): Promise<Invoice> {
  const invoice = await getInvoice(invoiceId);

  // Must have client email
  const recipientEmail = options?.to || invoice.clientSnapshot.email;
  if (!recipientEmail) {
    throw new Error('Client email is required to send invoice');
  }

  // Generate PDF
  const pdf = await generatePDF(invoiceId);

  // Email content
  const subject = options?.subject || `Invoice ${invoice.invoiceNumber} from ${getCompanyName()}`;

  const body = options?.body || generateInvoiceEmailBody(invoice);

  // Send email
  await sendEmail({
    to: recipientEmail,
    cc: options?.cc,
    subject,
    body,
    attachments: options?.attachPDF !== false ? [
      {
        filename: `Invoice-${invoice.invoiceNumber}.pdf`,
        content: pdf
      }
    ] : []
  });

  // Update status
  invoice.status = 'sent';
  invoice.sentAt = new Date();
  invoice.updatedAt = new Date();

  await saveInvoice(invoice);

  // Audit log
  await logAuditEvent({
    type: 'invoice-sent',
    entityId: invoice.id,
    userId: getCurrentUserId(),
    timestamp: new Date(),
    details: {
      to: recipientEmail,
      cc: options?.cc
    }
  });

  return invoice;
}
```

### Mark as Paid
```typescript
async function markAsPaid(
  invoiceId: string,
  payment: PaymentDetails
): Promise<Invoice> {
  const invoice = await getInvoice(invoiceId);

  // Validate payment amount
  if (payment.amount > invoice.amountDue) {
    throw new Error('Payment amount exceeds amount due');
  }

  // Update invoice
  invoice.amountPaid += payment.amount;
  invoice.amountDue = roundCurrency(invoice.total - invoice.amountPaid);

  if (invoice.amountDue === 0) {
    invoice.status = 'paid';
    invoice.paidDate = payment.paymentDate;
  }

  invoice.updatedAt = new Date();
  invoice.lastModifiedBy = getCurrentUserId();

  await saveInvoice(invoice);

  // Create accounting transaction
  const transaction = await createPaymentTransaction({
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    amount: payment.amount,
    date: payment.paymentDate,
    paymentMethod: payment.paymentMethod,
    reference: payment.reference,
    notes: payment.notes
  });

  invoice.transactionId = transaction.id;
  await saveInvoice(invoice);

  // Audit log
  await logAuditEvent({
    type: 'invoice-paid',
    entityId: invoice.id,
    userId: getCurrentUserId(),
    timestamp: new Date(),
    details: {
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      transactionId: transaction.id
    }
  });

  return invoice;
}
```

### PDF Generation
```typescript
async function generatePDF(invoiceId: string): Promise<Blob> {
  const invoice = await getInvoice(invoiceId);
  const template = await getTemplate(invoice.templateId);
  const company = await getCompanyInfo();

  // Render HTML from template
  const html = renderInvoiceHTML(invoice, template, company);

  // Convert to PDF (using library like puppeteer, jsPDF, or PDFKit)
  const pdf = await htmlToPDF(html, {
    format: 'Letter',
    margin: {
      top: '0.5in',
      right: '0.5in',
      bottom: '0.5in',
      left: '0.5in'
    }
  });

  return pdf;
}
```

### Status Updates
```typescript
async function updateInvoiceStatus(invoice: Invoice): Promise<void> {
  const now = new Date();

  // Check if overdue
  if (
    invoice.status === 'sent' &&
    invoice.amountDue > 0 &&
    invoice.dueDate < now
  ) {
    invoice.status = 'overdue';
    invoice.updatedAt = now;
    await saveInvoice(invoice);
  }
}

// Background job to update all invoice statuses
async function updateAllInvoiceStatuses(): Promise<void> {
  const activeInvoices = await listInvoices({
    filter: { status: ['sent', 'viewed'] }
  });

  for (const invoice of activeInvoices.invoices) {
    await updateInvoiceStatus(invoice);
  }
}
```

### Invoice Numbering
```typescript
async function getNextInvoiceNumber(): Promise<string> {
  const scheme = await getInvoiceNumberingScheme();

  const number = scheme.nextNumber.toString().padStart(scheme.padding, '0');
  const invoiceNumber = `${scheme.prefix}${number}${scheme.suffix || ''}`;

  // Increment for next invoice
  scheme.nextNumber++;
  await updateNumberingScheme(scheme);

  return invoiceNumber;
}

function parsePaymentTerms(terms: string): number {
  // Parse common payment terms
  const netMatch = terms.match(/Net (\d+)/i);
  if (netMatch) {
    return parseInt(netMatch[1]);
  }

  if (terms.match(/Due on receipt/i)) {
    return 0;
  }

  if (terms.match(/Due upon delivery/i)) {
    return 0;
  }

  // Default: 30 days
  return 30;
}
```

## UI Components

### InvoiceList
Main invoice list view.

**Props:**
- `filter?: InvoiceFilter`
- `onInvoiceSelect: (invoice: Invoice) => void`

**Features:**
- Table with columns: Number, Client, Date, Due Date, Amount, Status
- Filter tabs: All, Draft, Sent, Overdue, Paid
- Search by invoice number or client name
- Sort by any column
- Quick actions: View, Edit, Send, Mark Paid
- "New Invoice" button
- Export to CSV
- Statistics summary bar (total outstanding, overdue count, etc.)

### InvoiceForm
Create/edit invoice form.

**Props:**
- `invoice?: Invoice` (for editing)
- `clientId?: string` (pre-select client)
- `onSave: (invoice: Invoice) => void`
- `onCancel: () => void`

**Features:**
- Client selection (with search)
- Invoice date picker
- Due date picker (or payment terms selector that calculates due date)
- Line items table:
  - Description, Quantity, Rate, Amount
  - Add/remove rows
  - Auto-calculate amounts
- Tax section (optional, can be toggled on)
- Subtotal, Tax, Total (auto-calculated)
- Payment terms dropdown (Net 15, Net 30, Net 60, Due on receipt, Custom)
- Customer message textarea
- Internal notes textarea
- Template selector (preview thumbnails)
- Save as Draft / Save and Send buttons

### InvoicePreview
Preview invoice before saving/sending.

**Props:**
- `invoice: Invoice`
- `template: InvoiceTemplate`
- `onEdit: () => void`
- `onSend: () => void`

**Features:**
- Live preview of invoice as PDF will appear
- Company info header
- Client info section
- Line items table
- Totals section
- Payment terms and message
- "Edit" button to go back to form
- "Send" button to send via email
- "Download PDF" button

### InvoiceDetail
Detailed view of single invoice.

**Props:**
- `invoice: Invoice`
- `onEdit: () => void`
- `onSend: () => void`
- `onMarkPaid: () => void`

**Features:**
- Invoice header (number, date, status badge)
- Client information
- Line items display
- Totals section
- Payment history (if partially paid)
- Activity timeline (created, sent, viewed, paid)
- Actions: Edit, Send, Mark as Paid, Download PDF, Cancel
- Link to related transaction (if paid)

### InvoiceSendDialog
Email sending dialog.

**Props:**
- `invoice: Invoice`
- `onSend: (options: SendOptions) => void`
- `onCancel: () => void`

**Features:**
- To: field (pre-filled with client email, editable)
- CC: field (optional)
- Subject: field (pre-filled, editable)
- Body: textarea (default message, editable)
- Preview checkbox (opens preview of email)
- Send button with loading state

### PaymentRecordDialog
Record payment dialog.

**Props:**
- `invoice: Invoice`
- `onRecord: (payment: PaymentDetails) => void`
- `onCancel: () => void`

**Features:**
- Payment date picker
- Amount input (defaults to full amount due)
- Payment method dropdown (Check, Cash, Wire, Credit Card, Other)
- Reference field (check number, transaction ID)
- Notes textarea
- Record button

## Email Templates

### Invoice Email Body
```
Hi [Client Name],

Thank you for your business! Please find attached invoice [Invoice Number] for [Total Amount].

Invoice Details:
- Invoice Number: [Invoice Number]
- Invoice Date: [Date]
- Due Date: [Due Date]
- Amount Due: [Total]

[Customer Message if provided]

Payment Terms: [Payment Terms]

If you have any questions about this invoice, please don't hesitate to reach out.

Best regards,
[Company Name]
[Company Email]
[Company Phone]

---
Powered by Graceful Books
```

## User Experience

### First Invoice Celebration
When user sends first invoice:
- "Your first invoice is on its way! (How professional of you.)"
- Tooltip: "We'll track this invoice and notify you of any changes"
- Suggest setting up payment tracking

### Invoice Preview Confidence
- "This is what [Client Name] will see" message above preview
- Side-by-side: form on left, preview on right (desktop)
- Real-time updates as user types

### Status Visual Language
- **Draft:** Gray badge, "Not sent yet"
- **Sent:** Blue badge, "Sent on [date]"
- **Viewed:** Green badge, "Opened by client on [date]"
- **Paid:** Green checkmark badge, "Paid on [date]"
- **Overdue:** Red badge, "Overdue by [X] days"

### Tone & Messaging
- **Encouraging:** "Your invoice looks great! Ready to send?"
- **Helpful:** "We'll email this to [Client] and track when they open it"
- **Celebratory:** "Invoice sent! We'll let you know when [Client] views it"
- **Clear:** "This invoice is overdue by 5 days. Consider sending a reminder."

## Testing Requirements

### Unit Tests
- Invoice amount calculations (subtotal, tax, total)
- Invoice numbering generation
- Payment terms parsing
- Status update logic
- Partial payment handling

### Integration Tests
- Create invoice end-to-end
- Send invoice via email
- Mark invoice as paid creates transaction
- PDF generation matches preview
- Status automatically updates to overdue

### User Testing
- Invoice creation <5 minutes
- PDF generation <3 seconds
- Email delivery <30 seconds
- Preview matches PDF exactly
- Users find status tracking clear and helpful

## Performance Requirements
- Invoice list loads <1 second (up to 1000 invoices)
- Invoice creation <2 seconds
- PDF generation <3 seconds
- Email sending <30 seconds
- Preview rendering <1 second

## Accessibility
- Full keyboard navigation
- Screen reader support for form fields and invoice data
- ARIA labels for status badges
- High contrast mode for invoice preview
- WCAG 2.1 AA compliance

## Data Integrity
- Invoice numbers are unique and sequential
- Cannot delete paid invoices (only cancel)
- Client snapshot preserved even if client deleted
- Amounts always rounded to 2 decimal places
- Audit log of all invoice state changes

## Future Enhancements (Post-Group C)
- Recurring invoices (Group E)
- Customizable templates with logo and colors (Group E)
- Deposit/retainer invoices (Group E)
- Late fee automation (Group E)
- Batch invoicing (Group E)
- Multiple payment methods integrated (Stripe, PayPal)
- Client portal for online payment (Group H)
- Invoice reminders (automated)
- Partial payments tracking
- Credit memos
- Multi-currency invoices (Group H)
- Invoice comments/messages thread
