/**
 * Recurring Invoices Data Access Layer
 *
 * Provides CRUD operations for recurring invoices with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Recurring invoice lifecycle management
 * - Auto-generation and auto-send functionality
 */

import { nanoid } from 'nanoid';
import { db } from './database';
import type { DatabaseResult, EncryptionContext, VersionVector } from './types';
import type {
  RecurringInvoice,
  GeneratedInvoice,
  RecurringInvoiceStatus,
  RecurrenceRule,
  GetRecurringInvoicesQuery,
} from '../db/schema/recurringInvoices.schema';
import type { InvoiceLineItem } from '../db/schema/invoices.schema';
import {
  validateRecurringInvoice,
  validateRecurrenceRule,
  shouldGenerateInvoice,
  hasReachedEndCondition,
} from '../db/schema/recurringInvoices.schema';
import { calculateInvoiceTotals } from '../db/schema/invoices.schema';
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
 * Create a new recurring invoice
 */
export async function createRecurringInvoice(
  invoiceData: {
    companyId: string;
    customerId: string;
    templateName: string;
    description?: string;
    lineItems: InvoiceLineItem[];
    recurrenceRule: RecurrenceRule;
    startDate: number;
    autoSend?: boolean;
    sendReminderDaysBefore?: number;
    notes?: string;
    internalMemo?: string;
    templateId?: string;
    taxRate?: number;
    paymentTermsDays?: number;
  },
  context?: EncryptionContext
): Promise<DatabaseResult<RecurringInvoice>> {
  try {
    const {
      companyId,
      customerId,
      templateName,
      description,
      lineItems,
      recurrenceRule,
      startDate,
      autoSend = false,
      sendReminderDaysBefore,
      notes,
      internalMemo,
      templateId = 'classic',
      taxRate = 0,
      paymentTermsDays = 30,
    } = invoiceData;

    // Validate recurrence rule
    const ruleErrors = validateRecurrenceRule(recurrenceRule);
    if (ruleErrors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Recurrence rule validation failed: ${ruleErrors.join(', ')}`,
        },
      };
    }

    // Calculate totals
    const { subtotal, tax, total } = calculateInvoiceTotals(lineItems, taxRate);

    // Create recurring invoice entity
    const now = Date.now();

    const recurringInvoice: RecurringInvoice = {
      id: nanoid(),
      company_id: companyId,
      customer_id: customerId,
      template_name: templateName,
      description: description || null,
      subtotal,
      tax,
      total,
      notes: notes || null,
      internal_memo: internalMemo || null,
      template_id: templateId,
      line_items: JSON.stringify(lineItems),
      recurrence_rule: JSON.stringify(recurrenceRule),
      start_date: startDate,
      next_generation_date: startDate,
      last_generation_date: null,
      auto_send: autoSend,
      send_reminder_days_before: sendReminderDaysBefore || null,
      status: 'ACTIVE',
      occurrences_generated: 0,
      payment_terms_days: paymentTermsDays,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: initVersionVector(),
    };

    // Validate recurring invoice
    const errors = validateRecurringInvoice(recurringInvoice);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Recurring invoice validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Apply encryption if service provided
    let encryptedInvoice = recurringInvoice;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      encryptedInvoice = {
        ...recurringInvoice,
        notes: recurringInvoice.notes
          ? await encryptionService.encrypt(recurringInvoice.notes)
          : null,
        internal_memo: recurringInvoice.internal_memo
          ? await encryptionService.encrypt(recurringInvoice.internal_memo)
          : null,
        line_items: await encryptionService.encrypt(recurringInvoice.line_items),
        recurrence_rule: await encryptionService.encrypt(recurringInvoice.recurrence_rule),
      };
    }

    // Store in database
    await db.recurringInvoices.add(encryptedInvoice);

    return { success: true, data: recurringInvoice };
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
 * Get recurring invoice by ID
 */
export async function getRecurringInvoice(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<RecurringInvoice>> {
  try {
    const entity = await db.recurringInvoices.get(id);

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Recurring invoice not found: ${id}`,
        },
      };
    }

    // Check if soft deleted
    if (entity.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Recurring invoice has been deleted: ${id}`,
        },
      };
    }

    // Decrypt if service provided
    let result = entity;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...entity,
        notes: entity.notes ? await encryptionService.decrypt(entity.notes) : null,
        internal_memo: entity.internal_memo
          ? await encryptionService.decrypt(entity.internal_memo)
          : null,
        line_items: await encryptionService.decrypt(entity.line_items),
        recurrence_rule: await encryptionService.decrypt(entity.recurrence_rule),
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
 * Update a recurring invoice
 */
export async function updateRecurringInvoice(
  id: string,
  updates: {
    templateName?: string;
    description?: string;
    lineItems?: InvoiceLineItem[];
    recurrenceRule?: RecurrenceRule;
    autoSend?: boolean;
    sendReminderDaysBefore?: number;
    notes?: string;
    internalMemo?: string;
    templateId?: string;
    taxRate?: number;
    paymentTermsDays?: number;
  },
  context?: EncryptionContext
): Promise<DatabaseResult<RecurringInvoice>> {
  try {
    const existing = await db.recurringInvoices.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Recurring invoice not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Recurring invoice has been deleted: ${id}`,
        },
      };
    }

    // Decrypt existing data if needed
    let existingLineItems: InvoiceLineItem[] = [];
    let existingRecurrenceRule: RecurrenceRule;

    if (context?.encryptionService) {
      const decryptedLineItems = await context.encryptionService.decrypt(existing.line_items);
      existingLineItems = JSON.parse(decryptedLineItems);
      const decryptedRule = await context.encryptionService.decrypt(existing.recurrence_rule);
      existingRecurrenceRule = JSON.parse(decryptedRule);
    } else {
      existingLineItems = JSON.parse(existing.line_items);
      existingRecurrenceRule = JSON.parse(existing.recurrence_rule);
    }

    // Use updated values or keep existing
    const lineItems = updates.lineItems || existingLineItems;
    const recurrenceRule = updates.recurrenceRule || existingRecurrenceRule;

    // Validate updated recurrence rule if changed
    if (updates.recurrenceRule) {
      const ruleErrors = validateRecurrenceRule(recurrenceRule);
      if (ruleErrors.length > 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Recurrence rule validation failed: ${ruleErrors.join(', ')}`,
          },
        };
      }
    }

    // Recalculate totals
    const taxRate =
      updates.taxRate !== undefined
        ? updates.taxRate
        : parseFloat(existing.tax) / parseFloat(existing.subtotal);
    const { subtotal, tax, total } = calculateInvoiceTotals(lineItems, taxRate);

    // Prepare updated entity
    const now = Date.now();
    const deviceId = getDeviceId();

    const updated: RecurringInvoice = {
      ...existing,
      template_name: updates.templateName || existing.template_name,
      description:
        updates.description !== undefined ? updates.description : existing.description,
      subtotal,
      tax,
      total,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      internal_memo:
        updates.internalMemo !== undefined ? updates.internalMemo : existing.internal_memo,
      template_id: updates.templateId || existing.template_id,
      line_items: JSON.stringify(lineItems),
      recurrence_rule: JSON.stringify(recurrenceRule),
      auto_send: updates.autoSend !== undefined ? updates.autoSend : existing.auto_send,
      send_reminder_days_before:
        updates.sendReminderDaysBefore !== undefined
          ? updates.sendReminderDaysBefore
          : existing.send_reminder_days_before,
      payment_terms_days:
        updates.paymentTermsDays !== undefined
          ? updates.paymentTermsDays
          : existing.payment_terms_days,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    };

    // Validate updated invoice
    const errors = validateRecurringInvoice(updated);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Recurring invoice validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Apply encryption if service provided
    let encryptedInvoice = updated;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      encryptedInvoice = {
        ...updated,
        notes: updated.notes ? await encryptionService.encrypt(updated.notes) : null,
        internal_memo: updated.internal_memo
          ? await encryptionService.encrypt(updated.internal_memo)
          : null,
        line_items: await encryptionService.encrypt(updated.line_items),
        recurrence_rule: await encryptionService.encrypt(updated.recurrence_rule),
      };
    }

    // Update in database
    await db.recurringInvoices.put(encryptedInvoice);

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
 * Pause a recurring invoice
 */
export async function pauseRecurringInvoice(
  id: string
): Promise<DatabaseResult<RecurringInvoice>> {
  return updateRecurringInvoiceStatus(id, 'PAUSED');
}

/**
 * Resume a recurring invoice
 */
export async function resumeRecurringInvoice(
  id: string
): Promise<DatabaseResult<RecurringInvoice>> {
  return updateRecurringInvoiceStatus(id, 'ACTIVE');
}

/**
 * Cancel a recurring invoice
 */
export async function cancelRecurringInvoice(
  id: string
): Promise<DatabaseResult<RecurringInvoice>> {
  return updateRecurringInvoiceStatus(id, 'CANCELLED');
}

/**
 * Update recurring invoice status
 */
async function updateRecurringInvoiceStatus(
  id: string,
  status: RecurringInvoiceStatus
): Promise<DatabaseResult<RecurringInvoice>> {
  try {
    const existing = await db.recurringInvoices.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Recurring invoice not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Recurring invoice has been deleted: ${id}`,
        },
      };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    await db.recurringInvoices.update(id, {
      status,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    });

    const updated = await db.recurringInvoices.get(id);
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
 * Delete a recurring invoice (soft delete)
 */
export async function deleteRecurringInvoice(id: string): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.recurringInvoices.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Recurring invoice not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return { success: true, data: undefined };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    await db.recurringInvoices.update(id, {
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
 * Query recurring invoices with filters
 */
export async function getRecurringInvoices(
  query: GetRecurringInvoicesQuery,
  context?: EncryptionContext
): Promise<DatabaseResult<RecurringInvoice[]>> {
  try {
    let collection = db.recurringInvoices.toCollection();

    // Apply filters
    if (query.company_id) {
      collection = db.recurringInvoices.where('company_id').equals(query.company_id);
    }

    if (query.status && query.company_id) {
      collection = db.recurringInvoices
        .where('[company_id+status]')
        .equals([query.company_id, query.status]);
    }

    if (query.customer_id && query.company_id) {
      collection = db.recurringInvoices
        .where('[company_id+customer_id]')
        .equals([query.company_id, query.customer_id]);
    }

    // Filter out deleted unless explicitly requested
    if (!query.include_deleted) {
      collection = collection.and((inv) => !inv.deleted_at);
    }

    const entities = await collection.toArray();

    // Decrypt if service provided
    let results = entities;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      results = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          notes: entity.notes ? await encryptionService.decrypt(entity.notes) : null,
          internal_memo: entity.internal_memo
            ? await encryptionService.decrypt(entity.internal_memo)
            : null,
          line_items: await encryptionService.decrypt(entity.line_items),
          recurrence_rule: await encryptionService.decrypt(entity.recurrence_rule),
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
 * Get recurring invoices that need generation
 */
export async function getRecurringInvoicesDueForGeneration(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<RecurringInvoice[]>> {
  try {
    const now = Date.now();

    // Query active recurring invoices with next_generation_date <= now
    const entities = await db.recurringInvoices
      .where('[company_id+status]')
      .equals([companyId, 'ACTIVE'])
      .and((inv) => !inv.deleted_at && shouldGenerateInvoice(inv))
      .toArray();

    // Decrypt if service provided
    let results = entities;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      results = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          notes: entity.notes ? await encryptionService.decrypt(entity.notes) : null,
          internal_memo: entity.internal_memo
            ? await encryptionService.decrypt(entity.internal_memo)
            : null,
          line_items: await encryptionService.decrypt(entity.line_items),
          recurrence_rule: await encryptionService.decrypt(entity.recurrence_rule),
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
 * Record generated invoice
 */
export async function recordGeneratedInvoice(
  recurringInvoiceId: string,
  invoiceId: string,
  scheduledDate: number,
  invoiceDate: number,
  autoSent: boolean,
  sentAt: number | null
): Promise<DatabaseResult<GeneratedInvoice>> {
  try {
    const now = Date.now();

    const generatedInvoice: GeneratedInvoice = {
      id: nanoid(),
      recurring_invoice_id: recurringInvoiceId,
      invoice_id: invoiceId,
      generation_date: now,
      scheduled_date: scheduledDate,
      invoice_date: invoiceDate,
      auto_sent: autoSent,
      sent_at: sentAt,
      created_at: now,
      version_vector: initVersionVector(),
    };

    await db.generatedInvoices.add(generatedInvoice);

    return { success: true, data: generatedInvoice };
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
 * Get generated invoices for a recurring invoice
 */
export async function getGeneratedInvoices(
  recurringInvoiceId: string
): Promise<DatabaseResult<GeneratedInvoice[]>> {
  try {
    const entities = await db.generatedInvoices
      .where('recurring_invoice_id')
      .equals(recurringInvoiceId)
      .sortBy('generation_date');

    return { success: true, data: entities };
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
 * Get recurring invoice by generated invoice ID
 */
export async function getRecurringInvoiceByInvoiceId(
  invoiceId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<RecurringInvoice | null>> {
  try {
    const generatedInvoice = await db.generatedInvoices
      .where('invoice_id')
      .equals(invoiceId)
      .first();

    if (!generatedInvoice) {
      return { success: true, data: null };
    }

    return getRecurringInvoice(generatedInvoice.recurring_invoice_id, context);
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
