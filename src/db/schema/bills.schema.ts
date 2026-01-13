/**
 * Bills Schema Definition
 *
 * Defines the structure for bills (accounts payable) in Graceful Books.
 * Bills are vendor-facing documents that create accounts payable
 * and expense transactions when posted.
 *
 * Requirements:
 * - E6: Bill Entry & Management (Nice)
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { VersionVector } from '../../types/database.types';

/**
 * Bill status lifecycle
 */
export type BillStatus = 'DRAFT' | 'DUE' | 'OVERDUE' | 'PAID' | 'VOID';

/**
 * Bill line item structure
 * Stored as encrypted JSON array in the bill
 */
export interface BillLineItem {
  id: string; // Line item UUID
  description: string; // Item description
  quantity: number; // Quantity
  unitPrice: string; // Unit price as decimal string
  accountId: string; // Expense account ID
  total: string; // Line total (quantity * unitPrice)
}

/**
 * Bill entity
 */
export interface Bill {
  id: string; // UUID
  company_id: string; // Company UUID
  vendor_id: string; // Contact UUID (must be vendor type)
  bill_number: string; // Bill/reference number from vendor
  bill_date: number; // Unix timestamp
  due_date: number; // Unix timestamp
  status: BillStatus; // Current status
  subtotal: string; // Subtotal as decimal string
  tax: string; // Tax amount as decimal string
  total: string; // Total amount as decimal string
  notes: string | null; // ENCRYPTED - Notes about the bill
  internal_memo: string | null; // ENCRYPTED - Internal memo
  line_items: string; // ENCRYPTED - JSON array of BillLineItem[]
  transaction_id: string | null; // Link to accounting transaction (when posted)
  paid_at: number | null; // Unix timestamp when marked paid
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  deleted_at: number | null; // Tombstone marker for soft deletes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema definition for Bills table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying bills by company
 * - vendor_id: For querying bills by vendor
 * - status: For querying by status
 * - [company_id+status]: Compound index for filtered queries
 * - [company_id+vendor_id]: Compound index for vendor queries
 * - bill_number: For quick lookup
 * - bill_date: For date-range queries
 * - due_date: For overdue calculations
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const billsSchema =
  'id, company_id, vendor_id, status, [company_id+status], [company_id+vendor_id], bill_number, bill_date, due_date, updated_at, deleted_at';

/**
 * Table name constant
 */
export const BILLS_TABLE = 'bills';

/**
 * Default values for new Bill
 */
export const createDefaultBill = (
  companyId: string,
  vendorId: string,
  billNumber: string,
  deviceId: string
): Partial<Bill> => {
  const now = Date.now();
  const dueDate = now + 30 * 24 * 60 * 60 * 1000; // 30 days from now

  return {
    company_id: companyId,
    vendor_id: vendorId,
    bill_number: billNumber,
    bill_date: now,
    due_date: dueDate,
    status: 'DRAFT',
    subtotal: '0.00',
    tax: '0.00',
    total: '0.00',
    notes: null,
    internal_memo: null,
    line_items: JSON.stringify([]),
    transaction_id: null,
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
 * Validation: Ensure bill has valid fields
 */
export const validateBill = (bill: Partial<Bill>): string[] => {
  const errors: string[] = [];

  if (!bill.company_id) {
    errors.push('company_id is required');
  }

  if (!bill.vendor_id) {
    errors.push('vendor_id is required');
  }

  if (!bill.bill_number || bill.bill_number.trim() === '') {
    errors.push('bill_number is required');
  }

  if (!bill.bill_date) {
    errors.push('bill_date is required');
  }

  if (!bill.due_date) {
    errors.push('due_date is required');
  }

  if (bill.due_date && bill.bill_date && bill.due_date < bill.bill_date) {
    errors.push('due_date must be after bill_date');
  }

  if (!bill.status) {
    errors.push('status is required');
  }

  // Validate amounts
  if (bill.subtotal !== undefined) {
    const subtotal = parseFloat(bill.subtotal);
    if (isNaN(subtotal) || subtotal < 0) {
      errors.push('subtotal must be a non-negative number');
    }
  }

  if (bill.tax !== undefined) {
    const tax = parseFloat(bill.tax);
    if (isNaN(tax) || tax < 0) {
      errors.push('tax must be a non-negative number');
    }
  }

  if (bill.total !== undefined) {
    const total = parseFloat(bill.total);
    if (isNaN(total) || total < 0) {
      errors.push('total must be a non-negative number');
    }
  }

  return errors;
};

/**
 * Validation: Ensure line item has valid fields
 */
export const validateBillLineItem = (lineItem: Partial<BillLineItem>): string[] => {
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
 * Helper: Calculate bill totals from line items
 */
export const calculateBillTotals = (
  lineItems: BillLineItem[],
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
 * Helper: Generate next bill number
 * Format: BILL-YYYY-NNNN (e.g., "BILL-2026-0001")
 */
export const generateBillNumber = (year: number, sequence: number): string => {
  const paddedSequence = sequence.toString().padStart(4, '0');
  return `BILL-${year}-${paddedSequence}`;
};

/**
 * Helper: Check if bill is overdue
 */
export const isBillOverdue = (bill: Bill): boolean => {
  if (bill.status === 'PAID' || bill.status === 'VOID') {
    return false;
  }

  const now = Date.now();
  return bill.due_date < now;
};

/**
 * Helper: Get days until due (negative if overdue)
 */
export const getDaysUntilDue = (bill: Bill): number => {
  const now = Date.now();
  const diff = bill.due_date - now;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return days;
};

/**
 * Helper: Get upcoming bills summary
 * Returns bills due in the next N days
 */
export const getUpcomingBillsSummary = (bills: Bill[], daysAhead: number = 7): {
  count: number;
  totalAmount: string;
  bills: Bill[];
} => {
  const now = Date.now();
  const futureDate = now + (daysAhead * 24 * 60 * 60 * 1000);

  const upcomingBills = bills.filter(bill =>
    bill.status === 'DUE' &&
    bill.due_date >= now &&
    bill.due_date <= futureDate
  );

  const totalAmount = upcomingBills.reduce((sum, bill) => {
    return sum + parseFloat(bill.total);
  }, 0);

  return {
    count: upcomingBills.length,
    totalAmount: totalAmount.toFixed(2),
    bills: upcomingBills,
  };
};

/**
 * Query helper: Get all bills for a company
 */
export interface GetBillsQuery {
  company_id: string;
  vendor_id?: string;
  status?: BillStatus;
  date_from?: number;
  date_to?: number;
  include_deleted?: boolean;
}

/**
 * Bill summary for reporting
 */
export interface BillSummary {
  total_bills: number;
  total_amount: string;
  total_paid: string;
  total_outstanding: string;
  overdue_count: number;
  overdue_amount: string;
}
