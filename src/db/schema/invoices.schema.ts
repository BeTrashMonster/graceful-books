/**
 * Invoices Schema Definition
 *
 * Defines the structure for invoices in Graceful Books.
 * Invoices are customer-facing documents that create accounts receivable
 * and revenue transactions when posted.
 *
 * Requirements:
 * - C7: Invoice Creation - Basic
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { VersionVector } from '../../types/database.types';

/**
 * Invoice status lifecycle
 */
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';

/**
 * Invoice line item structure
 * Stored as encrypted JSON array in the invoice
 */
export interface InvoiceLineItem {
  id: string; // Line item UUID
  description: string; // Item description
  quantity: number; // Quantity
  unitPrice: string; // Unit price as decimal string
  accountId: string; // Income account ID
  total: string; // Line total (quantity * unitPrice)
}

/**
 * Invoice entity
 */
export interface Invoice {
  id: string; // UUID
  company_id: string; // Company UUID
  customer_id: string; // Contact UUID (must be customer type)
  invoice_number: string; // Invoice number (e.g., "INV-2026-0001")
  invoice_date: number; // Unix timestamp
  due_date: number; // Unix timestamp
  status: InvoiceStatus; // Current status
  subtotal: string; // Subtotal as decimal string
  tax: string; // Tax amount as decimal string
  total: string; // Total amount as decimal string
  notes: string | null; // ENCRYPTED - Customer-facing notes
  internal_memo: string | null; // ENCRYPTED - Internal memo (not on PDF)
  template_id: string; // Template used for PDF generation
  line_items: string; // ENCRYPTED - JSON array of InvoiceLineItem[]
  transaction_id: string | null; // Link to accounting transaction (when posted)
  sent_at: number | null; // Unix timestamp when sent
  paid_at: number | null; // Unix timestamp when marked paid
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  deleted_at: number | null; // Tombstone marker for soft deletes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema definition for Invoices table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying invoices by company
 * - customer_id: For querying invoices by customer
 * - status: For querying by status
 * - [company_id+status]: Compound index for filtered queries
 * - [company_id+customer_id]: Compound index for customer queries
 * - invoice_number: For quick lookup
 * - invoice_date: For date-range queries
 * - due_date: For overdue calculations
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const invoicesSchema =
  'id, company_id, customer_id, status, [company_id+status], [company_id+customer_id], invoice_number, invoice_date, due_date, updated_at, deleted_at';

/**
 * Table name constant
 */
export const INVOICES_TABLE = 'invoices';

/**
 * Default values for new Invoice
 */
export const createDefaultInvoice = (
  companyId: string,
  customerId: string,
  invoiceNumber: string,
  deviceId: string
): Partial<Invoice> => {
  const now = Date.now();
  const dueDate = now + 30 * 24 * 60 * 60 * 1000; // 30 days from now

  return {
    company_id: companyId,
    customer_id: customerId,
    invoice_number: invoiceNumber,
    invoice_date: now,
    due_date: dueDate,
    status: 'DRAFT',
    subtotal: '0.00',
    tax: '0.00',
    total: '0.00',
    notes: null,
    internal_memo: null,
    template_id: 'classic',
    line_items: JSON.stringify([]),
    transaction_id: null,
    sent_at: null,
    paid_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure invoice has valid fields
 */
export const validateInvoice = (invoice: Partial<Invoice>): string[] => {
  const errors: string[] = [];

  if (!invoice.company_id) {
    errors.push('company_id is required');
  }

  if (!invoice.customer_id) {
    errors.push('customer_id is required');
  }

  if (!invoice.invoice_number || invoice.invoice_number.trim() === '') {
    errors.push('invoice_number is required');
  }

  if (!invoice.invoice_date) {
    errors.push('invoice_date is required');
  }

  if (!invoice.due_date) {
    errors.push('due_date is required');
  }

  if (invoice.due_date && invoice.invoice_date && invoice.due_date < invoice.invoice_date) {
    errors.push('due_date must be after invoice_date');
  }

  if (!invoice.status) {
    errors.push('status is required');
  }

  if (!invoice.template_id) {
    errors.push('template_id is required');
  }

  // Validate amounts
  if (invoice.subtotal !== undefined) {
    const subtotal = parseFloat(invoice.subtotal);
    if (isNaN(subtotal) || subtotal < 0) {
      errors.push('subtotal must be a non-negative number');
    }
  }

  if (invoice.tax !== undefined) {
    const tax = parseFloat(invoice.tax);
    if (isNaN(tax) || tax < 0) {
      errors.push('tax must be a non-negative number');
    }
  }

  if (invoice.total !== undefined) {
    const total = parseFloat(invoice.total);
    if (isNaN(total) || total < 0) {
      errors.push('total must be a non-negative number');
    }
  }

  return errors;
};

/**
 * Validation: Ensure line item has valid fields
 */
export const validateInvoiceLineItem = (lineItem: Partial<InvoiceLineItem>): string[] => {
  const errors: string[] = [];

  if (!lineItem.description || lineItem.description.trim() === '') {
    errors.push('description is required');
  }

  if (lineItem.quantity === undefined || lineItem.quantity === null) {
    errors.push('quantity is required');
  } else if (lineItem.quantity <= 0) {
    errors.push('quantity must be greater than 0');
  }

  if (!lineItem.unitPrice) {
    errors.push('unitPrice is required');
  } else {
    const price = parseFloat(lineItem.unitPrice);
    if (isNaN(price) || price < 0) {
      errors.push('unitPrice must be a non-negative number');
    }
  }

  if (!lineItem.accountId) {
    errors.push('accountId is required');
  }

  return errors;
};

/**
 * Helper: Calculate line item total
 */
export const calculateLineItemTotal = (quantity: number, unitPrice: string): string => {
  const price = parseFloat(unitPrice);
  const total = quantity * price;
  return total.toFixed(2);
};

/**
 * Helper: Calculate invoice totals from line items
 */
export const calculateInvoiceTotals = (
  lineItems: InvoiceLineItem[],
  taxRate: number = 0
): { subtotal: string; tax: string; total: string } => {
  let subtotal = 0;

  for (const item of lineItems) {
    subtotal += parseFloat(item.total);
  }

  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return {
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
  };
};

/**
 * Helper: Generate next invoice number
 * Format: INV-YYYY-NNNN (e.g., "INV-2026-0001")
 */
export const generateInvoiceNumber = (year: number, sequence: number): string => {
  const paddedSequence = sequence.toString().padStart(4, '0');
  return `INV-${year}-${paddedSequence}`;
};

/**
 * Helper: Check if invoice is overdue
 */
export const isInvoiceOverdue = (invoice: Invoice): boolean => {
  if (invoice.status === 'PAID' || invoice.status === 'VOID') {
    return false;
  }

  const now = Date.now();
  return invoice.due_date < now;
};

/**
 * Helper: Get days until due (negative if overdue)
 */
export const getDaysUntilDue = (invoice: Invoice): number => {
  const now = Date.now();
  const diff = invoice.due_date - now;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return days;
};

/**
 * Query helper: Get all invoices for a company
 */
export interface GetInvoicesQuery {
  company_id: string;
  customer_id?: string;
  status?: InvoiceStatus;
  date_from?: number;
  date_to?: number;
  include_deleted?: boolean;
}

/**
 * Invoice summary for reporting
 */
export interface InvoiceSummary {
  total_invoices: number;
  total_amount: string;
  total_paid: string;
  total_outstanding: string;
  overdue_count: number;
  overdue_amount: string;
}
