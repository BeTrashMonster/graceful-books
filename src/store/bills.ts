/**
 * Bills Data Access Layer
 *
 * Provides CRUD operations for bills with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Bill status lifecycle management
 * - Automatic transaction creation when paid
 */

import { nanoid } from 'nanoid';
import { db } from './database';
import type { DatabaseResult, EncryptionContext, VersionVector } from './types';
import type {
  Bill,
  BillStatus,
  BillLineItem,
  GetBillsQuery,
} from '../db/schema/bills.schema';
import {
  validateBill,
  validateBillLineItem,
  calculateBillTotals,
  isBillOverdue,
} from '../db/schema/bills.schema';
import { getDeviceId } from '../utils/device';
import { incrementVersionVector } from '../db/crdt';

/**
 * Initialize version vector for a new entity
 */
function initVersionVector(): VersionVector {
  const deviceId = getDeviceId();
  return { [deviceId]: 1 };
}

/**
 * Create a new bill
 */
export async function createBill(
  billData: {
    companyId: string;
    vendorId: string;
    billNumber: string;
    billDate: number;
    dueDate: number;
    lineItems: BillLineItem[];
    notes?: string;
    internalMemo?: string;
    taxRate?: number;
  },
  context?: EncryptionContext
): Promise<DatabaseResult<Bill>> {
  try {
    const {
      companyId,
      vendorId,
      billNumber,
      billDate,
      dueDate,
      lineItems,
      notes,
      internalMemo,
      taxRate = 0,
    } = billData;

    // Validate line items
    for (const lineItem of lineItems) {
      const errors = validateBillLineItem(lineItem);
      if (errors.length > 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Line item validation failed: ${errors.join(', ')}`,
          },
        };
      }
    }

    // Calculate totals
    const { subtotal, tax, total } = calculateBillTotals(lineItems, taxRate);

    // Create bill entity
    const now = Date.now();

    const bill: Bill = {
      id: nanoid(),
      company_id: companyId,
      vendor_id: vendorId,
      bill_number: billNumber,
      bill_date: billDate,
      due_date: dueDate,
      status: 'DRAFT',
      subtotal,
      tax,
      total,
      notes: notes || null,
      internal_memo: internalMemo || null,
      line_items: JSON.stringify(lineItems),
      transaction_id: null,
      paid_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: initVersionVector(),
    };

    // Validate bill
    const errors = validateBill(bill);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Bill validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Apply encryption if service provided
    let encryptedBill = bill;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      encryptedBill = {
        ...bill,
        notes: bill.notes
          ? await encryptionService.encrypt(bill.notes)
          : null,
        internal_memo: bill.internal_memo
          ? await encryptionService.encrypt(bill.internal_memo)
          : null,
        line_items: await encryptionService.encrypt(bill.line_items),
      };
    }

    // Store in database
    await db.bills.add(encryptedBill);

    return { success: true, data: bill };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get bill by ID
 */
export async function getBill(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Bill>> {
  try {
    const entity = await db.bills.get(id);

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Bill not found: ${id}`,
        },
      };
    }

    // Check if soft deleted
    if (entity.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Bill has been deleted: ${id}`,
        },
      };
    }

    // Decrypt if service provided
    let result = entity;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...entity,
        notes: entity.notes
          ? await encryptionService.decrypt(entity.notes)
          : null,
        internal_memo: entity.internal_memo
          ? await encryptionService.decrypt(entity.internal_memo)
          : null,
        line_items: await encryptionService.decrypt(entity.line_items),
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Update a bill (only allowed if status is DRAFT)
 */
export async function updateBill(
  id: string,
  updates: {
    lineItems?: BillLineItem[];
    notes?: string;
    internalMemo?: string;
    dueDate?: number;
    taxRate?: number;
  },
  context?: EncryptionContext
): Promise<DatabaseResult<Bill>> {
  try {
    const existing = await db.bills.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Bill not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Bill has been deleted: ${id}`,
        },
      };
    }

    // Only allow updates to draft bills
    if (existing.status !== 'DRAFT') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot update a posted or paid bill.',
        },
      };
    }

    // Decrypt existing line items if needed
    let existingLineItems: BillLineItem[] = [];
    if (context?.encryptionService) {
      const decrypted = await context.encryptionService.decrypt(existing.line_items);
      existingLineItems = JSON.parse(decrypted);
    } else {
      existingLineItems = JSON.parse(existing.line_items);
    }

    // Use updated line items or keep existing
    const lineItems = updates.lineItems || existingLineItems;

    // Validate updated line items
    for (const lineItem of lineItems) {
      const errors = validateBillLineItem(lineItem);
      if (errors.length > 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Line item validation failed: ${errors.join(', ')}`,
          },
        };
      }
    }

    // Recalculate totals
    const taxRate = updates.taxRate !== undefined ? updates.taxRate : parseFloat(existing.tax) / parseFloat(existing.subtotal);
    const { subtotal, tax, total } = calculateBillTotals(lineItems, taxRate);

    // Prepare updated entity
    const now = Date.now();
    const deviceId = getDeviceId();

    const updated: Bill = {
      ...existing,
      due_date: updates.dueDate !== undefined ? updates.dueDate : existing.due_date,
      subtotal,
      tax,
      total,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      internal_memo: updates.internalMemo !== undefined ? updates.internalMemo : existing.internal_memo,
      line_items: JSON.stringify(lineItems),
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    };

    // Validate updated bill
    const errors = validateBill(updated);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Bill validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Apply encryption if service provided
    let encryptedBill = updated;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      encryptedBill = {
        ...updated,
        notes: updated.notes
          ? await encryptionService.encrypt(updated.notes)
          : null,
        internal_memo: updated.internal_memo
          ? await encryptionService.encrypt(updated.internal_memo)
          : null,
        line_items: await encryptionService.encrypt(updated.line_items),
      };
    }

    // Update in database
    await db.bills.put(encryptedBill);

    return { success: true, data: updated };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Post a bill (change status from DRAFT to DUE)
 */
export async function postBill(
  id: string
): Promise<DatabaseResult<Bill>> {
  try {
    const existing = await db.bills.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Bill not found: ${id}`,
        },
      };
    }

    if (existing.status !== 'DRAFT') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Bill has already been posted',
        },
      };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    await db.bills.update(id, {
      status: 'DUE' as BillStatus,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    });

    const updated = await db.bills.get(id);
    return { success: true, data: updated! };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Mark bill as paid and create accounting transaction
 */
export async function markBillPaid(
  id: string,
  paymentDate: number,
  transactionId?: string
): Promise<DatabaseResult<Bill>> {
  try {
    const existing = await db.bills.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Bill not found: ${id}`,
        },
      };
    }

    if (existing.status === 'PAID') {
      return { success: true, data: existing };
    }

    if (existing.status === 'VOID') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot mark a voided bill as paid',
        },
      };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    // TODO: Create accounting transaction here if transactionId not provided
    // This should create:
    // Debit: Expense Account (based on line items)
    // Credit: Cash/Bank Account (or Accounts Payable)

    await db.bills.update(id, {
      status: 'PAID' as BillStatus,
      paid_at: paymentDate,
      transaction_id: transactionId || null,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    });

    const updated = await db.bills.get(id);
    return { success: true, data: updated! };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Void a bill
 */
export async function voidBill(id: string): Promise<DatabaseResult<Bill>> {
  try {
    const existing = await db.bills.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Bill not found: ${id}`,
        },
      };
    }

    if (existing.status === 'VOID') {
      return { success: true, data: existing };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    // TODO: If bill was paid and has a transaction_id, void the transaction too

    await db.bills.update(id, {
      status: 'VOID' as BillStatus,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    });

    const updated = await db.bills.get(id);
    return { success: true, data: updated! };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Delete a bill (soft delete, only for drafts)
 */
export async function deleteBill(id: string): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.bills.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Bill not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return { success: true, data: undefined };
    }

    // Only allow deleting draft bills
    if (existing.status !== 'DRAFT') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot delete a posted or paid bill. Use void instead.',
        },
      };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    await db.bills.update(id, {
      deleted_at: now,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Query bills with filters
 */
export async function getBills(
  query: GetBillsQuery,
  context?: EncryptionContext
): Promise<DatabaseResult<Bill[]>> {
  try {
    let collection = db.bills.toCollection();

    // Apply filters
    if (query.company_id) {
      collection = db.bills.where('company_id').equals(query.company_id);
    }

    if (query.status && query.company_id) {
      collection = db.bills
        .where('[company_id+status]')
        .equals([query.company_id, query.status]);
    }

    if (query.vendor_id && query.company_id) {
      collection = db.bills
        .where('[company_id+vendor_id]')
        .equals([query.company_id, query.vendor_id]);
    }

    if (query.date_from && query.date_to) {
      collection = collection.and(
        (bill) =>
          bill.bill_date >= query.date_from! && bill.bill_date <= query.date_to!
      );
    }

    // Filter out deleted unless explicitly requested
    if (!query.include_deleted) {
      collection = collection.and((bill) => !bill.deleted_at);
    }

    const entities = await collection.toArray();

    // Update OVERDUE status for due bills
    const now = Date.now();
    for (const entity of entities) {
      if (entity.status === 'DUE' && isBillOverdue(entity)) {
        await db.bills.update(entity.id, {
          status: 'OVERDUE' as BillStatus,
          updated_at: now,
        });
        entity.status = 'OVERDUE';
      }
    }

    // Decrypt if service provided
    let results = entities;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      results = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          notes: entity.notes
            ? await encryptionService.decrypt(entity.notes)
            : null,
          internal_memo: entity.internal_memo
            ? await encryptionService.decrypt(entity.internal_memo)
            : null,
          line_items: await encryptionService.decrypt(entity.line_items),
        }))
      );
    }

    return { success: true, data: results };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get bills for a specific vendor
 */
export async function getVendorBills(
  companyId: string,
  vendorId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Bill[]>> {
  return getBills({ company_id: companyId, vendor_id: vendorId }, context);
}

/**
 * Get bill line items (parsed)
 */
export async function getBillLineItems(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<BillLineItem[]>> {
  try {
    const billResult = await getBill(id, context);

    if (!billResult.success) {
      return billResult as DatabaseResult<BillLineItem[]>;
    }

    const lineItems: BillLineItem[] = JSON.parse(billResult.data.line_items);
    return { success: true, data: lineItems };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get upcoming bills (due in the next N days)
 */
export async function getUpcomingBills(
  companyId: string,
  daysAhead: number = 7,
  context?: EncryptionContext
): Promise<DatabaseResult<Bill[]>> {
  try {
    const now = Date.now();
    const futureDate = now + (daysAhead * 24 * 60 * 60 * 1000);

    const allBillsResult = await getBills({ company_id: companyId }, context);

    if (!allBillsResult.success) {
      return allBillsResult;
    }

    const upcomingBills = allBillsResult.data.filter(bill =>
      bill.status === 'DUE' &&
      bill.due_date >= now &&
      bill.due_date <= futureDate
    );

    return { success: true, data: upcomingBills };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get overdue bills
 */
export async function getOverdueBills(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Bill[]>> {
  try {
    const overdueResult = await getBills(
      { company_id: companyId, status: 'OVERDUE' },
      context
    );

    return overdueResult;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}
