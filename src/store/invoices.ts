/**
 * Invoices Data Access Layer
 *
 * Provides CRUD operations for invoices with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Invoice status lifecycle management
 * - Automatic transaction creation when paid
 */

import { nanoid } from 'nanoid';
import { db } from './database';
import type { DatabaseResult, EncryptionContext, VersionVector } from './types';
import type {
  Invoice,
  InvoiceStatus,
  InvoiceLineItem,
  GetInvoicesQuery,
} from '../db/schema/invoices.schema';
import {
  validateInvoice,
  validateInvoiceLineItem,
  calculateInvoiceTotals,
  isInvoiceOverdue,
} from '../db/schema/invoices.schema';
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
 * Create a new invoice
 */
export async function createInvoice(
  invoiceData: {
    companyId: string;
    customerId: string;
    invoiceNumber: string;
    invoiceDate: number;
    dueDate: number;
    lineItems: InvoiceLineItem[];
    notes?: string;
    internalMemo?: string;
    templateId?: string;
    taxRate?: number;
  },
  context?: EncryptionContext
): Promise<DatabaseResult<Invoice>> {
  try {
    const {
      companyId,
      customerId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      lineItems,
      notes,
      internalMemo,
      templateId = 'classic',
      taxRate = 0,
    } = invoiceData;

    // Validate line items
    for (const lineItem of lineItems) {
      const errors = validateInvoiceLineItem(lineItem);
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
    const { subtotal, tax, total } = calculateInvoiceTotals(lineItems, taxRate);

    // Create invoice entity
    const now = Date.now();

    const invoice: Invoice = {
      id: nanoid(),
      company_id: companyId,
      customer_id: customerId,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      status: 'DRAFT',
      subtotal,
      tax,
      total,
      notes: notes || null,
      internal_memo: internalMemo || null,
      template_id: templateId,
      line_items: JSON.stringify(lineItems),
      transaction_id: null,
      sent_at: null,
      paid_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: initVersionVector(),
    };

    // Validate invoice
    const errors = validateInvoice(invoice);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invoice validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Apply encryption if service provided
    let encryptedInvoice = invoice;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      encryptedInvoice = {
        ...invoice,
        notes: invoice.notes
          ? await encryptionService.encrypt(invoice.notes)
          : null,
        internal_memo: invoice.internal_memo
          ? await encryptionService.encrypt(invoice.internal_memo)
          : null,
        line_items: await encryptionService.encrypt(invoice.line_items),
      };
    }

    // Store in database
    await db.invoices.add(encryptedInvoice);

    return { success: true, data: invoice };
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
 * Get invoice by ID
 */
export async function getInvoice(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Invoice>> {
  try {
    const entity = await db.invoices.get(id);

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Invoice not found: ${id}`,
        },
      };
    }

    // Check if soft deleted
    if (entity.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Invoice has been deleted: ${id}`,
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
 * Update an invoice (only allowed if status is DRAFT)
 */
export async function updateInvoice(
  id: string,
  updates: {
    lineItems?: InvoiceLineItem[];
    notes?: string;
    internalMemo?: string;
    dueDate?: number;
    templateId?: string;
    taxRate?: number;
  },
  context?: EncryptionContext
): Promise<DatabaseResult<Invoice>> {
  try {
    const existing = await db.invoices.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Invoice not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Invoice has been deleted: ${id}`,
        },
      };
    }

    // Only allow updates to draft invoices
    if (existing.status !== 'DRAFT') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot update a sent or paid invoice. Create a credit note instead.',
        },
      };
    }

    // Decrypt existing line items if needed
    let existingLineItems: InvoiceLineItem[] = [];
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
      const errors = validateInvoiceLineItem(lineItem);
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
    const { subtotal, tax, total } = calculateInvoiceTotals(lineItems, taxRate);

    // Prepare updated entity
    const now = Date.now();
    const deviceId = getDeviceId();

    const updated: Invoice = {
      ...existing,
      due_date: updates.dueDate !== undefined ? updates.dueDate : existing.due_date,
      template_id: updates.templateId || existing.template_id,
      subtotal,
      tax,
      total,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      internal_memo: updates.internalMemo !== undefined ? updates.internalMemo : existing.internal_memo,
      line_items: JSON.stringify(lineItems),
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    };

    // Validate updated invoice
    const errors = validateInvoice(updated);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invoice validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Apply encryption if service provided
    let encryptedInvoice = updated;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      encryptedInvoice = {
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
    await db.invoices.put(encryptedInvoice);

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
 * Send an invoice (change status from DRAFT to SENT)
 */
export async function sendInvoice(
  id: string,
  _email: string
): Promise<DatabaseResult<Invoice>> {
  try {
    const existing = await db.invoices.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Invoice not found: ${id}`,
        },
      };
    }

    if (existing.status !== 'DRAFT') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Invoice has already been sent',
        },
      };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    // TODO: Implement email sending logic here
    // For now, we'll just update the status

    await db.invoices.update(id, {
      status: 'SENT' as InvoiceStatus,
      sent_at: now,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    });

    const updated = await db.invoices.get(id);
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
 * Mark invoice as paid and create accounting transaction
 */
export async function markInvoicePaid(
  id: string,
  paymentDate: number,
  transactionId?: string
): Promise<DatabaseResult<Invoice>> {
  try {
    const existing = await db.invoices.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Invoice not found: ${id}`,
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
          message: 'Cannot mark a voided invoice as paid',
        },
      };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    // TODO: Create accounting transaction here if transactionId not provided
    // This should create:
    // Debit: Cash/Bank Account (or Accounts Receivable)
    // Credit: Revenue Account (based on line items)

    await db.invoices.update(id, {
      status: 'PAID' as InvoiceStatus,
      paid_at: paymentDate,
      transaction_id: transactionId || null,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    });

    const updated = await db.invoices.get(id);
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
 * Void an invoice
 */
export async function voidInvoice(id: string): Promise<DatabaseResult<Invoice>> {
  try {
    const existing = await db.invoices.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Invoice not found: ${id}`,
        },
      };
    }

    if (existing.status === 'VOID') {
      return { success: true, data: existing };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    // TODO: If invoice was paid and has a transaction_id, void the transaction too

    await db.invoices.update(id, {
      status: 'VOID' as InvoiceStatus,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    });

    const updated = await db.invoices.get(id);
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
 * Delete an invoice (soft delete, only for drafts)
 */
export async function deleteInvoice(id: string): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.invoices.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Invoice not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return { success: true, data: undefined };
    }

    // Only allow deleting draft invoices
    if (existing.status !== 'DRAFT') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot delete a sent or paid invoice. Use void instead.',
        },
      };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    await db.invoices.update(id, {
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
 * Query invoices with filters
 */
export async function getInvoices(
  query: GetInvoicesQuery,
  context?: EncryptionContext
): Promise<DatabaseResult<Invoice[]>> {
  try {
    let collection = db.invoices.toCollection();

    // Apply filters
    if (query.company_id) {
      collection = db.invoices.where('company_id').equals(query.company_id);
    }

    if (query.status && query.company_id) {
      collection = db.invoices
        .where('[company_id+status]')
        .equals([query.company_id, query.status]);
    }

    if (query.customer_id && query.company_id) {
      collection = db.invoices
        .where('[company_id+customer_id]')
        .equals([query.company_id, query.customer_id]);
    }

    if (query.date_from && query.date_to) {
      collection = collection.and(
        (inv) =>
          inv.invoice_date >= query.date_from! && inv.invoice_date <= query.date_to!
      );
    }

    // Filter out deleted unless explicitly requested
    if (!query.include_deleted) {
      collection = collection.and((inv) => !inv.deleted_at);
    }

    const entities = await collection.toArray();

    // Update OVERDUE status for sent invoices
    const now = Date.now();
    for (const entity of entities) {
      if (entity.status === 'SENT' && isInvoiceOverdue(entity)) {
        await db.invoices.update(entity.id, {
          status: 'OVERDUE' as InvoiceStatus,
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
 * Get invoices for a specific customer
 */
export async function getCustomerInvoices(
  companyId: string,
  customerId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Invoice[]>> {
  return getInvoices({ company_id: companyId, customer_id: customerId }, context);
}

/**
 * Get invoice line items (parsed)
 */
export async function getInvoiceLineItems(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<InvoiceLineItem[]>> {
  try {
    const invoiceResult = await getInvoice(id, context);

    if (!invoiceResult.success) {
      return {
        success: false,
        error: invoiceResult.error,
      };
    }

    const lineItems: InvoiceLineItem[] = JSON.parse(invoiceResult.data.line_items);
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
