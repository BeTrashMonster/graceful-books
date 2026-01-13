/**
 * Recurring Invoices Schema Definition
 *
 * Defines the structure for recurring invoices in Graceful Books.
 * Recurring invoices automatically generate regular invoices based on
 * a schedule (rrule) and can optionally auto-send to customers.
 *
 * Requirements:
 * - E4: Recurring Invoices (Nice)
 * - ARCH-004: CRDT-Compatible Schema Design
 * - Zero-knowledge encryption for recurrence rules
 */

import type { VersionVector } from '../../types/database.types';
import type { InvoiceLineItem } from './invoices.schema';

/**
 * Recurring invoice status lifecycle
 */
export type RecurringInvoiceStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

/**
 * Frequency types for recurring invoices
 */
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

/**
 * End condition types
 */
export type EndConditionType = 'NEVER' | 'AFTER_N_OCCURRENCES' | 'ON_DATE';

/**
 * End condition structure
 */
export interface EndCondition {
  type: EndConditionType;
  /** Number of occurrences if type is AFTER_N_OCCURRENCES */
  occurrences?: number;
  /** End date timestamp if type is ON_DATE */
  endDate?: number;
}

/**
 * Recurrence rule configuration
 * This is encrypted before storage
 */
export interface RecurrenceRule {
  /** Frequency of recurrence */
  frequency: RecurrenceFrequency;
  /** Day of month (1-31) for monthly recurrences */
  dayOfMonth?: number;
  /** Day of week (0-6, Sunday=0) for weekly recurrences */
  dayOfWeek?: number;
  /** Month of year (1-12) for annual recurrences */
  monthOfYear?: number;
  /** Interval between occurrences (e.g., every 2 weeks) */
  interval: number;
  /** End condition */
  endCondition: EndCondition;
  /** rrule string representation (generated) */
  rruleString: string;
}

/**
 * Recurring invoice entity
 * Template from which regular invoices are generated
 */
export interface RecurringInvoice {
  id: string; // UUID
  company_id: string; // Company UUID
  customer_id: string; // Contact UUID (must be customer type)
  template_name: string; // Name for this recurring invoice template
  description: string | null; // Description of what this recurring invoice is for

  // Invoice template fields
  subtotal: string; // Subtotal as decimal string
  tax: string; // Tax amount as decimal string
  total: string; // Total amount as decimal string
  notes: string | null; // ENCRYPTED - Customer-facing notes (will be on generated invoices)
  internal_memo: string | null; // ENCRYPTED - Internal memo (not on PDF)
  template_id: string; // PDF template used for invoice generation
  line_items: string; // ENCRYPTED - JSON array of InvoiceLineItem[]

  // Recurrence configuration
  recurrence_rule: string; // ENCRYPTED - JSON of RecurrenceRule
  start_date: number; // Unix timestamp - when to start generating invoices
  next_generation_date: number | null; // Unix timestamp - when to generate next invoice
  last_generation_date: number | null; // Unix timestamp - when last invoice was generated

  // Auto-send configuration
  auto_send: boolean; // If true, generated invoices are automatically sent
  send_reminder_days_before?: number | null; // Send reminder N days before due date

  // Status and tracking
  status: RecurringInvoiceStatus; // Current status
  occurrences_generated: number; // Count of invoices generated so far

  // Payment terms
  payment_terms_days: number; // Number of days until payment is due (e.g., 30 = Net 30)

  // Metadata
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  deleted_at: number | null; // Tombstone marker for soft deletes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Generated invoice tracking
 * Links recurring invoice to generated regular invoices
 */
export interface GeneratedInvoice {
  id: string; // UUID
  recurring_invoice_id: string; // RecurringInvoice UUID
  invoice_id: string; // Invoice UUID (the generated invoice)
  generation_date: number; // Unix timestamp - when this invoice was generated
  scheduled_date: number; // Unix timestamp - when it was scheduled to be generated
  invoice_date: number; // Unix timestamp - the date on the invoice itself
  auto_sent: boolean; // Whether this invoice was auto-sent
  sent_at: number | null; // Unix timestamp when sent (if auto_sent)
  created_at: number; // Unix timestamp
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema definition for RecurringInvoices table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying recurring invoices by company
 * - customer_id: For querying recurring invoices by customer
 * - status: For querying by status
 * - [company_id+status]: Compound index for filtered queries
 * - [company_id+customer_id]: Compound index for customer queries
 * - next_generation_date: For finding invoices that need to be generated
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const recurringInvoicesSchema =
  'id, company_id, customer_id, status, [company_id+status], [company_id+customer_id], next_generation_date, updated_at, deleted_at';

/**
 * Dexie.js schema definition for GeneratedInvoices table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - recurring_invoice_id: For querying generated invoices by recurring invoice
 * - invoice_id: For looking up recurring invoice from regular invoice
 * - [recurring_invoice_id+generation_date]: Compound index for time-based queries
 */
export const generatedInvoicesSchema =
  'id, recurring_invoice_id, invoice_id, [recurring_invoice_id+generation_date], generation_date';

/**
 * Table name constants
 */
export const RECURRING_INVOICES_TABLE = 'recurringInvoices';
export const GENERATED_INVOICES_TABLE = 'generatedInvoices';

/**
 * Default values for new RecurringInvoice
 */
export const createDefaultRecurringInvoice = (
  companyId: string,
  customerId: string,
  deviceId: string
): Partial<RecurringInvoice> => {
  const now = Date.now();

  return {
    company_id: companyId,
    customer_id: customerId,
    template_name: 'Untitled Recurring Invoice',
    description: null,
    subtotal: '0.00',
    tax: '0.00',
    total: '0.00',
    notes: null,
    internal_memo: null,
    template_id: 'classic',
    line_items: JSON.stringify([]),
    recurrence_rule: JSON.stringify({
      frequency: 'MONTHLY',
      dayOfMonth: 1,
      interval: 1,
      endCondition: {
        type: 'NEVER',
      },
      rruleString: '',
    }),
    start_date: now,
    next_generation_date: now,
    last_generation_date: null,
    auto_send: false,
    send_reminder_days_before: null,
    status: 'ACTIVE',
    occurrences_generated: 0,
    payment_terms_days: 30,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure recurring invoice has valid fields
 */
export const validateRecurringInvoice = (invoice: Partial<RecurringInvoice>): string[] => {
  const errors: string[] = [];

  if (!invoice.company_id) {
    errors.push('company_id is required');
  }

  if (!invoice.customer_id) {
    errors.push('customer_id is required');
  }

  if (!invoice.template_name || invoice.template_name.trim() === '') {
    errors.push('template_name is required');
  }

  if (!invoice.start_date) {
    errors.push('start_date is required');
  }

  if (!invoice.template_id) {
    errors.push('template_id is required');
  }

  if (!invoice.status) {
    errors.push('status is required');
  }

  if (invoice.payment_terms_days === undefined || invoice.payment_terms_days === null) {
    errors.push('payment_terms_days is required');
  } else if (invoice.payment_terms_days < 0) {
    errors.push('payment_terms_days must be non-negative');
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
 * Validation: Ensure recurrence rule has valid fields
 */
export const validateRecurrenceRule = (rule: Partial<RecurrenceRule>): string[] => {
  const errors: string[] = [];

  if (!rule.frequency) {
    errors.push('frequency is required');
  }

  if (rule.interval === undefined || rule.interval === null) {
    errors.push('interval is required');
  } else if (rule.interval < 1) {
    errors.push('interval must be at least 1');
  }

  if (!rule.endCondition) {
    errors.push('endCondition is required');
  } else {
    const { type, occurrences, endDate } = rule.endCondition;

    if (!type) {
      errors.push('endCondition.type is required');
    }

    if (type === 'AFTER_N_OCCURRENCES') {
      if (!occurrences || occurrences < 1) {
        errors.push('occurrences must be at least 1 when type is AFTER_N_OCCURRENCES');
      }
    }

    if (type === 'ON_DATE') {
      if (!endDate) {
        errors.push('endDate is required when type is ON_DATE');
      }
    }
  }

  // Validate frequency-specific fields
  if (rule.frequency === 'MONTHLY' && rule.dayOfMonth) {
    if (rule.dayOfMonth < 1 || rule.dayOfMonth > 31) {
      errors.push('dayOfMonth must be between 1 and 31');
    }
  }

  if (rule.frequency === 'WEEKLY' && rule.dayOfWeek !== undefined) {
    if (rule.dayOfWeek < 0 || rule.dayOfWeek > 6) {
      errors.push('dayOfWeek must be between 0 (Sunday) and 6 (Saturday)');
    }
  }

  if (rule.frequency === 'ANNUALLY' && rule.monthOfYear) {
    if (rule.monthOfYear < 1 || rule.monthOfYear > 12) {
      errors.push('monthOfYear must be between 1 and 12');
    }
  }

  return errors;
};

/**
 * Helper: Generate rrule string from RecurrenceRule
 * Uses rrule library to create RFC 5545 compliant recurrence rules
 */
export const generateRRuleString = (rule: RecurrenceRule, startDate: number): string => {
  // This will be implemented with rrule library
  // Placeholder for now
  return `FREQ=${rule.frequency};INTERVAL=${rule.interval}`;
};

/**
 * Helper: Check if recurring invoice should generate a new invoice
 */
export const shouldGenerateInvoice = (recurringInvoice: RecurringInvoice): boolean => {
  if (recurringInvoice.status !== 'ACTIVE') {
    return false;
  }

  if (!recurringInvoice.next_generation_date) {
    return false;
  }

  const now = Date.now();
  return recurringInvoice.next_generation_date <= now;
};

/**
 * Helper: Check if recurring invoice has reached its end condition
 */
export const hasReachedEndCondition = (
  recurringInvoice: RecurringInvoice,
  recurrenceRule: RecurrenceRule
): boolean => {
  const { endCondition } = recurrenceRule;

  if (endCondition.type === 'NEVER') {
    return false;
  }

  if (endCondition.type === 'AFTER_N_OCCURRENCES') {
    return recurringInvoice.occurrences_generated >= (endCondition.occurrences || 0);
  }

  if (endCondition.type === 'ON_DATE' && endCondition.endDate) {
    const now = Date.now();
    return now >= endCondition.endDate;
  }

  return false;
};

/**
 * Query helper: Get all recurring invoices for a company
 */
export interface GetRecurringInvoicesQuery {
  company_id: string;
  customer_id?: string;
  status?: RecurringInvoiceStatus;
  include_deleted?: boolean;
}

/**
 * Recurring invoice summary for reporting
 */
export interface RecurringInvoiceSummary {
  total_recurring_invoices: number;
  active_recurring_invoices: number;
  monthly_recurring_revenue: string;
  quarterly_recurring_revenue: string;
  annual_recurring_revenue: string;
  next_30_days_count: number;
  next_30_days_revenue: string;
}
