/**
 * Recurring Invoice Generation Service
 *
 * Handles automatic generation of invoices from recurring invoice templates.
 * Uses rrule library for RFC 5545 compliant recurrence rule parsing.
 *
 * Requirements:
 * - E4: Recurring Invoices (Nice)
 * - Auto-generation based on recurrence rules
 * - Auto-send with customer notifications
 * - End condition handling
 * - Revenue metric calculations
 */

import { RRule, rrulestr, type Options as RRuleOptions } from 'rrule';
import type {
  RecurringInvoice,
  RecurrenceRule,
  RecurrenceFrequency,
  RecurringInvoiceSummary,
} from '../db/schema/recurringInvoices.schema';
import type { InvoiceLineItem } from '../db/schema/invoices.schema';
import { generateInvoiceNumber } from '../db/schema/invoices.schema';
import {
  getRecurringInvoice,
  getRecurringInvoicesDueForGeneration,
  recordGeneratedInvoice,
} from '../store/recurringInvoices';
import { createInvoice, sendInvoice, getInvoices } from '../store/invoices';
import type { EncryptionContext } from '../store/types';
import { db } from '../store/database';
import { getDeviceId } from '../utils/device';
import { incrementVersionVector } from '../db/crdt';
import { logger } from '../utils/logger';

const serviceLogger = logger.child('RecurringInvoiceService');

/**
 * Generate rrule string from RecurrenceRule
 */
export function generateRRuleString(rule: RecurrenceRule, startDate: Date): string {
  const options: Partial<RRuleOptions> = {
    dtstart: startDate,
  };

  // Set frequency
  switch (rule.frequency) {
    case 'DAILY':
      options.freq = RRule.DAILY;
      break;
    case 'WEEKLY':
      options.freq = RRule.WEEKLY;
      if (rule.dayOfWeek !== undefined) {
        // Convert ISO weekday (1=Monday, 7=Sunday) to RRule weekday (0=Monday, 6=Sunday)
        const rruleDay = rule.dayOfWeek === 7 ? 6 : rule.dayOfWeek - 1;
        options.byweekday = [rruleDay];
      }
      break;
    case 'BIWEEKLY':
      options.freq = RRule.WEEKLY;
      options.interval = 2;
      if (rule.dayOfWeek !== undefined) {
        // Convert ISO weekday (1=Monday, 7=Sunday) to RRule weekday (0=Monday, 6=Sunday)
        const rruleDay = rule.dayOfWeek === 7 ? 6 : rule.dayOfWeek - 1;
        options.byweekday = [rruleDay];
      }
      break;
    case 'MONTHLY':
      options.freq = RRule.MONTHLY;
      if (rule.dayOfMonth !== undefined) {
        options.bymonthday = [rule.dayOfMonth];
      }
      break;
    case 'QUARTERLY':
      options.freq = RRule.MONTHLY;
      options.interval = 3;
      if (rule.dayOfMonth !== undefined) {
        options.bymonthday = [rule.dayOfMonth];
      }
      break;
    case 'ANNUALLY':
      options.freq = RRule.YEARLY;
      if (rule.monthOfYear !== undefined) {
        options.bymonth = [rule.monthOfYear];
      }
      if (rule.dayOfMonth !== undefined) {
        options.bymonthday = [rule.dayOfMonth];
      }
      break;
  }

  // Set interval (overridden for BIWEEKLY and QUARTERLY above)
  if (rule.frequency !== 'BIWEEKLY' && rule.frequency !== 'QUARTERLY') {
    options.interval = rule.interval;
  }

  // Set end condition
  const { endCondition } = rule;
  if (endCondition.type === 'AFTER_N_OCCURRENCES' && endCondition.occurrences) {
    options.count = endCondition.occurrences;
  } else if (endCondition.type === 'ON_DATE' && endCondition.endDate) {
    options.until = new Date(endCondition.endDate);
  }

  const rrule = new RRule(options);
  return rrule.toString();
}

/**
 * Calculate next generation date from recurrence rule
 */
export function calculateNextGenerationDate(
  rule: RecurrenceRule,
  currentDate: Date,
  _occurrencesGenerated: number
): Date | null {
  try {
    // Normalize to UTC midnight to avoid timezone issues
    const normalizedDate = new Date(Date.UTC(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate()
    ));

    const rruleString = generateRRuleString(rule, normalizedDate);
    const rrule = rrulestr(rruleString);

    // Get next occurrence after current date
    const after = new Date(normalizedDate.getTime() + 1000); // 1 second after current
    const nextOccurrence = rrule.after(after);

    if (!nextOccurrence) {
      return null;
    }

    return nextOccurrence;
  } catch (error) {
    serviceLogger.error('Failed to calculate next generation date', { error, rule });
    return null;
  }
}

/**
 * Calculate end-of-month adjusted date
 * Handles cases where dayOfMonth might not exist in target month (e.g., Feb 31 -> Feb 28/29)
 */
export function adjustForEndOfMonth(targetDate: Date, dayOfMonth: number): Date {
  // Use UTC methods to avoid timezone issues
  const year = targetDate.getUTCFullYear();
  const month = targetDate.getUTCMonth();

  // Get the last day of the target month using UTC
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  // Use the smaller of dayOfMonth or lastDayOfMonth
  const actualDay = Math.min(dayOfMonth, lastDayOfMonth);

  // Create and return the adjusted date in UTC
  return new Date(Date.UTC(year, month, actualDay));
}

/**
 * Generate invoice from recurring invoice template
 */
export async function generateInvoiceFromRecurring(
  recurringInvoiceId: string,
  invoiceDate: number,
  context: EncryptionContext
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    // Get recurring invoice
    const recurringResult = await getRecurringInvoice(recurringInvoiceId, context);
    if (!recurringResult.success) {
      return { success: false, error: recurringResult.error.message };
    }

    const recurringInvoice = recurringResult.data;

    // Parse line items and recurrence rule
    const lineItems: InvoiceLineItem[] = JSON.parse(recurringInvoice.line_items);
    const recurrenceRule: RecurrenceRule = JSON.parse(recurringInvoice.recurrence_rule);

    // Generate invoice number
    const year = new Date(invoiceDate).getFullYear();
    const invoicesResult = await getInvoices({ company_id: recurringInvoice.company_id });
    const sequence = invoicesResult.success ? invoicesResult.data.length + 1 : 1;
    const invoiceNumber = generateInvoiceNumber(year, sequence);

    // Calculate due date
    const dueDate = invoiceDate + recurringInvoice.payment_terms_days * 24 * 60 * 60 * 1000;

    // Create the invoice
    const invoiceResult = await createInvoice(
      {
        companyId: recurringInvoice.company_id,
        customerId: recurringInvoice.customer_id,
        invoiceNumber,
        invoiceDate,
        dueDate,
        lineItems,
        notes: recurringInvoice.notes || undefined,
        internalMemo: recurringInvoice.internal_memo || undefined,
        templateId: recurringInvoice.template_id,
        taxRate: parseFloat(recurringInvoice.tax) / parseFloat(recurringInvoice.subtotal) || 0,
      },
      context
    );

    if (!invoiceResult.success) {
      return { success: false, error: invoiceResult.error.message };
    }

    const invoice = invoiceResult.data;

    // Auto-send if configured
    let sentAt: number | null = null;
    if (recurringInvoice.auto_send) {
      // Get customer email (this would need to be implemented based on contacts)
      const sendResult = await sendInvoice(invoice.id, 'customer@example.com');
      if (sendResult.success) {
        sentAt = Date.now();
      } else {
        serviceLogger.warn('Failed to auto-send invoice', {
          invoiceId: invoice.id,
          error: sendResult.error,
        });
      }
    }

    // Record the generated invoice
    await recordGeneratedInvoice(
      recurringInvoiceId,
      invoice.id,
      recurringInvoice.next_generation_date!,
      invoiceDate,
      recurringInvoice.auto_send,
      sentAt
    );

    // Update recurring invoice: increment occurrences and calculate next date
    const now = Date.now();
    const deviceId = getDeviceId();
    const nextDate = calculateNextGenerationDate(
      recurrenceRule,
      new Date(invoiceDate),
      recurringInvoice.occurrences_generated + 1
    );

    // Check if we've reached the end condition
    const isComplete = nextDate === null;

    await db.recurringInvoices.update(recurringInvoiceId, {
      occurrences_generated: recurringInvoice.occurrences_generated + 1,
      last_generation_date: invoiceDate,
      next_generation_date: nextDate ? nextDate.getTime() : null,
      status: isComplete ? 'COMPLETED' : recurringInvoice.status,
      updated_at: now,
      version_vector: incrementVersionVector(recurringInvoice.version_vector, deviceId),
    });

    serviceLogger.info('Generated invoice from recurring template', {
      recurringInvoiceId,
      invoiceId: invoice.id,
      nextDate,
      isComplete,
    });

    return { success: true, invoiceId: invoice.id };
  } catch (error) {
    serviceLogger.error('Failed to generate invoice from recurring template', {
      error,
      recurringInvoiceId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process all recurring invoices due for generation
 */
export async function processRecurringInvoices(
  companyId: string,
  context: EncryptionContext
): Promise<{
  processed: number;
  generated: number;
  failed: number;
  errors: Array<{ recurringInvoiceId: string; error: string }>;
}> {
  const result = {
    processed: 0,
    generated: 0,
    failed: 0,
    errors: [] as Array<{ recurringInvoiceId: string; error: string }>,
  };

  try {
    // Get all recurring invoices due for generation
    const dueResult = await getRecurringInvoicesDueForGeneration(companyId, context);
    if (!dueResult.success) {
      serviceLogger.error('Failed to get recurring invoices due for generation', {
        error: dueResult.error,
      });
      return result;
    }

    const recurringInvoices = dueResult.data;
    result.processed = recurringInvoices.length;

    // Generate invoices for each recurring invoice
    for (const recurringInvoice of recurringInvoices) {
      const invoiceDate = recurringInvoice.next_generation_date || Date.now();

      const generateResult = await generateInvoiceFromRecurring(
        recurringInvoice.id,
        invoiceDate,
        context
      );

      if (generateResult.success) {
        result.generated++;
      } else {
        result.failed++;
        result.errors.push({
          recurringInvoiceId: recurringInvoice.id,
          error: generateResult.error || 'Unknown error',
        });
      }
    }

    serviceLogger.info('Processed recurring invoices', {
      companyId,
      ...result,
    });

    return result;
  } catch (error) {
    serviceLogger.error('Failed to process recurring invoices', { error, companyId });
    return result;
  }
}

/**
 * Get upcoming recurring invoices (next 30 days)
 */
export async function getUpcomingRecurringInvoices(
  companyId: string,
  daysAhead: number = 30,
  context?: EncryptionContext
): Promise<
  Array<{
    recurringInvoice: RecurringInvoice;
    nextInvoiceDate: Date;
    daysUntilGeneration: number;
  }>
> {
  try {
    // Get all active recurring invoices
    const recurringInvoicesResult = await db.recurringInvoices
      .where('[company_id+status]')
      .equals([companyId, 'ACTIVE'])
      .and((inv) => !inv.deleted_at)
      .toArray();

    const now = Date.now();
    const futureLimit = now + daysAhead * 24 * 60 * 60 * 1000;

    const upcoming: Array<{
      recurringInvoice: RecurringInvoice;
      nextInvoiceDate: Date;
      daysUntilGeneration: number;
    }> = [];

    for (const recurringInvoice of recurringInvoicesResult) {
      if (
        recurringInvoice.next_generation_date &&
        recurringInvoice.next_generation_date <= futureLimit
      ) {
        const nextDate = new Date(recurringInvoice.next_generation_date);
        const daysUntil = Math.ceil(
          (recurringInvoice.next_generation_date - now) / (24 * 60 * 60 * 1000)
        );

        // Decrypt if needed
        let decryptedInvoice = recurringInvoice;
        if (context?.encryptionService) {
          const { encryptionService } = context;
          decryptedInvoice = {
            ...recurringInvoice,
            notes: recurringInvoice.notes
              ? await encryptionService.decrypt(recurringInvoice.notes)
              : null,
            internal_memo: recurringInvoice.internal_memo
              ? await encryptionService.decrypt(recurringInvoice.internal_memo)
              : null,
            line_items: await encryptionService.decrypt(recurringInvoice.line_items),
            recurrence_rule: await encryptionService.decrypt(recurringInvoice.recurrence_rule),
          };
        }

        upcoming.push({
          recurringInvoice: decryptedInvoice,
          nextInvoiceDate: nextDate,
          daysUntilGeneration: daysUntil,
        });
      }
    }

    // Sort by next generation date
    upcoming.sort((a, b) => a.nextInvoiceDate.getTime() - b.nextInvoiceDate.getTime());

    return upcoming;
  } catch (error) {
    serviceLogger.error('Failed to get upcoming recurring invoices', { error, companyId });
    return [];
  }
}

/**
 * Calculate recurring revenue metrics
 */
export async function calculateRecurringRevenue(
  companyId: string,
  context?: EncryptionContext
): Promise<RecurringInvoiceSummary> {
  try {
    // Get all active recurring invoices
    const recurringInvoicesResult = await db.recurringInvoices
      .where('[company_id+status]')
      .equals([companyId, 'ACTIVE'])
      .and((inv) => !inv.deleted_at)
      .toArray();

    let monthlyRevenue = 0;
    let quarterlyRevenue = 0;
    let annualRevenue = 0;
    let next30DaysCount = 0;
    let next30DaysRevenue = 0;

    const now = Date.now();
    const futureLimit = now + 30 * 24 * 60 * 60 * 1000;

    for (const recurringInvoice of recurringInvoicesResult) {
      const total = parseFloat(recurringInvoice.total);

      // Parse recurrence rule
      let recurrenceRule: RecurrenceRule;
      if (context?.encryptionService) {
        const decrypted = await context.encryptionService.decrypt(
          recurringInvoice.recurrence_rule
        );
        recurrenceRule = JSON.parse(decrypted);
      } else {
        recurrenceRule = JSON.parse(recurringInvoice.recurrence_rule);
      }

      // Calculate normalized monthly revenue
      const monthlyAmount = normalizeToMonthly(total, recurrenceRule.frequency);
      monthlyRevenue += monthlyAmount;

      // Calculate quarterly and annual
      quarterlyRevenue += monthlyAmount * 3;
      annualRevenue += monthlyAmount * 12;

      // Check if invoice is due in next 30 days
      if (
        recurringInvoice.next_generation_date &&
        recurringInvoice.next_generation_date <= futureLimit
      ) {
        next30DaysCount++;
        next30DaysRevenue += total;
      }
    }

    return {
      total_recurring_invoices: recurringInvoicesResult.length,
      active_recurring_invoices: recurringInvoicesResult.length,
      monthly_recurring_revenue: monthlyRevenue.toFixed(2),
      quarterly_recurring_revenue: quarterlyRevenue.toFixed(2),
      annual_recurring_revenue: annualRevenue.toFixed(2),
      next_30_days_count: next30DaysCount,
      next_30_days_revenue: next30DaysRevenue.toFixed(2),
    };
  } catch (error) {
    serviceLogger.error('Failed to calculate recurring revenue', { error, companyId });
    return {
      total_recurring_invoices: 0,
      active_recurring_invoices: 0,
      monthly_recurring_revenue: '0.00',
      quarterly_recurring_revenue: '0.00',
      annual_recurring_revenue: '0.00',
      next_30_days_count: 0,
      next_30_days_revenue: '0.00',
    };
  }
}

/**
 * Normalize revenue to monthly amount based on frequency
 */
function normalizeToMonthly(amount: number, frequency: RecurrenceFrequency): number {
  switch (frequency) {
    case 'DAILY':
      return amount * 30; // Approximate
    case 'WEEKLY':
      return amount * 4.33; // Average weeks per month
    case 'BIWEEKLY':
      return amount * 2.17; // Average bi-weeks per month
    case 'MONTHLY':
      return amount;
    case 'QUARTERLY':
      return amount / 3;
    case 'ANNUALLY':
      return amount / 12;
    default:
      return amount;
  }
}

/**
 * Preview next N occurrences for a recurring invoice
 */
export async function previewRecurringInvoiceDates(
  recurringInvoiceId: string,
  count: number = 12,
  context?: EncryptionContext
): Promise<Date[]> {
  try {
    const recurringResult = await getRecurringInvoice(recurringInvoiceId, context);
    if (!recurringResult.success) {
      return [];
    }

    const recurringInvoice = recurringResult.data;
    const recurrenceRule: RecurrenceRule = JSON.parse(recurringInvoice.recurrence_rule);

    const startDate = new Date(recurringInvoice.start_date);
    const rruleString = generateRRuleString(recurrenceRule, startDate);
    const rrule = rrulestr(rruleString);

    // Get next N occurrences
    const allOccurrences = rrule.all((date) => {
      return date >= startDate;
    });
    const occurrences = allOccurrences.slice(0, count);

    return occurrences.slice(0, count);
  } catch (error) {
    serviceLogger.error('Failed to preview recurring invoice dates', {
      error,
      recurringInvoiceId,
    });
    return [];
  }
}
