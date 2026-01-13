/**
 * Recurring Invoices Data Access Layer Tests
 *
 * Tests CRUD operations, validation, encryption, and CRDT support
 * for recurring invoices.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from './database';
import type { EncryptionService } from './types';
import {
  createRecurringInvoice,
  getRecurringInvoice,
  updateRecurringInvoice,
  pauseRecurringInvoice,
  resumeRecurringInvoice,
  cancelRecurringInvoice,
  deleteRecurringInvoice,
  getRecurringInvoices,
  getRecurringInvoicesDueForGeneration,
  recordGeneratedInvoice,
  getGeneratedInvoices,
} from './recurringInvoices';
import type { RecurrenceRule, InvoiceLineItem } from '../db/schema';

// Mock encryption service
const mockEncryptionService: EncryptionService = {
  encrypt: vi.fn(async (data: string) => `encrypted:${data}`),
  decrypt: vi.fn(async (data: string) => data.replace('encrypted:', '')),
  encryptField: vi.fn(async (field) => `encrypted:${JSON.stringify(field)}`),
  decryptField: vi.fn(async (encrypted: string) =>
    JSON.parse(encrypted.replace('encrypted:', ''))
  ),
};

describe('Recurring Invoices Data Access Layer', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.recurringInvoices.clear();
    await db.generatedInvoices.clear();
    vi.clearAllMocks();
  });

  describe('createRecurringInvoice', () => {
    it('should create a recurring invoice with valid data', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: 'line-1',
          description: 'Monthly Service',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const recurrenceRule: RecurrenceRule = {
        frequency: 'MONTHLY',
        dayOfMonth: 1,
        interval: 1,
        endCondition: {
          type: 'NEVER',
        },
        rruleString: '',
      };

      const result = await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Monthly Service Invoice',
        description: 'Recurring monthly service billing',
        lineItems,
        recurrenceRule,
        startDate: Date.now(),
        autoSend: true,
        paymentTermsDays: 30,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBeDefined();
        expect(result.data.company_id).toBe('company-1');
        expect(result.data.customer_id).toBe('customer-1');
        expect(result.data.template_name).toBe('Monthly Service Invoice');
        expect(result.data.status).toBe('ACTIVE');
        expect(result.data.auto_send).toBe(true);
        expect(result.data.occurrences_generated).toBe(0);
        expect(result.data.total).toBe('100.00');
      }
    });

    it('should encrypt sensitive fields when encryption service provided', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: 'line-1',
          description: 'Service',
          quantity: 1,
          unitPrice: '50.00',
          accountId: 'account-1',
          total: '50.00',
        },
      ];

      const recurrenceRule: RecurrenceRule = {
        frequency: 'WEEKLY',
        dayOfWeek: 1,
        interval: 1,
        endCondition: { type: 'AFTER_N_OCCURRENCES', occurrences: 10 },
        rruleString: '',
      };

      const result = await createRecurringInvoice(
        {
          companyId: 'company-1',
          customerId: 'customer-1',
          templateName: 'Weekly Service',
          lineItems,
          recurrenceRule,
          startDate: Date.now(),
          notes: 'Thank you for your business',
          internalMemo: 'Customer prefers email invoices',
        },
        {
          companyId: 'company-1',
          userId: 'user-1',
          encryptionService: mockEncryptionService,
        }
      );

      expect(result.success).toBe(true);
      expect(mockEncryptionService.encrypt).toHaveBeenCalled();

      // Verify encrypted data in database
      if (result.success) {
        const stored = await db.recurringInvoices.get(result.data.id);
        expect(stored?.notes).toContain('encrypted:');
        expect(stored?.internal_memo).toContain('encrypted:');
        expect(stored?.line_items).toContain('encrypted:');
        expect(stored?.recurrence_rule).toContain('encrypted:');
      }
    });

    it('should fail validation with invalid recurrence rule', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: 'line-1',
          description: 'Service',
          quantity: 1,
          unitPrice: '50.00',
          accountId: 'account-1',
          total: '50.00',
        },
      ];

      const invalidRule: RecurrenceRule = {
        frequency: 'MONTHLY',
        dayOfMonth: 35, // Invalid day
        interval: 0, // Invalid interval
        endCondition: { type: 'NEVER' },
        rruleString: '',
      };

      const result = await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Test',
        lineItems,
        recurrenceRule: invalidRule,
        startDate: Date.now(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('validation failed');
      }
    });

    it('should calculate totals correctly with tax rate', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: 'line-1',
          description: 'Item 1',
          quantity: 2,
          unitPrice: '50.00',
          accountId: 'account-1',
          total: '100.00',
        },
        {
          id: 'line-2',
          description: 'Item 2',
          quantity: 1,
          unitPrice: '25.00',
          accountId: 'account-1',
          total: '25.00',
        },
      ];

      const recurrenceRule: RecurrenceRule = {
        frequency: 'MONTHLY',
        interval: 1,
        endCondition: { type: 'NEVER' },
        rruleString: '',
      };

      const result = await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Test',
        lineItems,
        recurrenceRule,
        startDate: Date.now(),
        taxRate: 0.1, // 10% tax
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subtotal).toBe('125.00');
        expect(result.data.tax).toBe('12.50');
        expect(result.data.total).toBe('137.50');
      }
    });
  });

  describe('getRecurringInvoice', () => {
    it('should retrieve and decrypt a recurring invoice', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: 'line-1',
          description: 'Service',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const recurrenceRule: RecurrenceRule = {
        frequency: 'MONTHLY',
        interval: 1,
        endCondition: { type: 'NEVER' },
        rruleString: '',
      };

      const created = await createRecurringInvoice(
        {
          companyId: 'company-1',
          customerId: 'customer-1',
          templateName: 'Test Invoice',
          lineItems,
          recurrenceRule,
          startDate: Date.now(),
          notes: 'Test notes',
        },
        {
          companyId: 'company-1',
          userId: 'user-1',
          encryptionService: mockEncryptionService,
        }
      );

      expect(created.success).toBe(true);
      if (!created.success) return;

      const retrieved = await getRecurringInvoice(
        created.data.id,
        {
          companyId: 'company-1',
          userId: 'user-1',
          encryptionService: mockEncryptionService,
        }
      );

      expect(retrieved.success).toBe(true);
      if (retrieved.success) {
        expect(retrieved.data.id).toBe(created.data.id);
        expect(retrieved.data.notes).toBe('Test notes');
        expect(retrieved.data.notes).not.toContain('encrypted:');
      }
    });

    it('should return NOT_FOUND for non-existent invoice', async () => {
      const result = await getRecurringInvoice('non-existent-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should return NOT_FOUND for soft-deleted invoice', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: 'line-1',
          description: 'Service',
          quantity: 1,
          unitPrice: '50.00',
          accountId: 'account-1',
          total: '50.00',
        },
      ];

      const recurrenceRule: RecurrenceRule = {
        frequency: 'MONTHLY',
        interval: 1,
        endCondition: { type: 'NEVER' },
        rruleString: '',
      };

      const created = await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Test',
        lineItems,
        recurrenceRule,
        startDate: Date.now(),
      });

      expect(created.success).toBe(true);
      if (!created.success) return;

      await deleteRecurringInvoice(created.data.id);

      const result = await getRecurringInvoice(created.data.id);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('updateRecurringInvoice', () => {
    it('should update recurring invoice fields', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: 'line-1',
          description: 'Service',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const recurrenceRule: RecurrenceRule = {
        frequency: 'MONTHLY',
        interval: 1,
        endCondition: { type: 'NEVER' },
        rruleString: '',
      };

      const created = await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Original Name',
        lineItems,
        recurrenceRule,
        startDate: Date.now(),
        autoSend: false,
      });

      expect(created.success).toBe(true);
      if (!created.success) return;

      const updated = await updateRecurringInvoice(created.data.id, {
        templateName: 'Updated Name',
        autoSend: true,
        paymentTermsDays: 60,
      });

      expect(updated.success).toBe(true);
      if (updated.success) {
        expect(updated.data.template_name).toBe('Updated Name');
        expect(updated.data.auto_send).toBe(true);
        expect(updated.data.payment_terms_days).toBe(60);
      }
    });

    it('should recalculate totals when line items change', async () => {
      const initialLineItems: InvoiceLineItem[] = [
        {
          id: 'line-1',
          description: 'Service',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const recurrenceRule: RecurrenceRule = {
        frequency: 'MONTHLY',
        interval: 1,
        endCondition: { type: 'NEVER' },
        rruleString: '',
      };

      const created = await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Test',
        lineItems: initialLineItems,
        recurrenceRule,
        startDate: Date.now(),
      });

      expect(created.success).toBe(true);
      if (!created.success) return;

      const newLineItems: InvoiceLineItem[] = [
        {
          id: 'line-1',
          description: 'Service',
          quantity: 1,
          unitPrice: '150.00',
          accountId: 'account-1',
          total: '150.00',
        },
        {
          id: 'line-2',
          description: 'Extra Service',
          quantity: 1,
          unitPrice: '50.00',
          accountId: 'account-1',
          total: '50.00',
        },
      ];

      const updated = await updateRecurringInvoice(created.data.id, {
        lineItems: newLineItems,
      });

      expect(updated.success).toBe(true);
      if (updated.success) {
        expect(updated.data.subtotal).toBe('200.00');
        expect(updated.data.total).toBe('200.00');
      }
    });
  });

  describe('Status Management', () => {
    it('should pause a recurring invoice', async () => {
      const created = await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Test',
        lineItems: [
          {
            id: 'line-1',
            description: 'Service',
            quantity: 1,
            unitPrice: '100.00',
            accountId: 'account-1',
            total: '100.00',
          },
        ],
        recurrenceRule: {
          frequency: 'MONTHLY',
          interval: 1,
          endCondition: { type: 'NEVER' },
          rruleString: '',
        },
        startDate: Date.now(),
      });

      expect(created.success).toBe(true);
      if (!created.success) return;

      const paused = await pauseRecurringInvoice(created.data.id);
      expect(paused.success).toBe(true);
      if (paused.success) {
        expect(paused.data.status).toBe('PAUSED');
      }
    });

    it('should resume a paused recurring invoice', async () => {
      const created = await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Test',
        lineItems: [
          {
            id: 'line-1',
            description: 'Service',
            quantity: 1,
            unitPrice: '100.00',
            accountId: 'account-1',
            total: '100.00',
          },
        ],
        recurrenceRule: {
          frequency: 'MONTHLY',
          interval: 1,
          endCondition: { type: 'NEVER' },
          rruleString: '',
        },
        startDate: Date.now(),
      });

      expect(created.success).toBe(true);
      if (!created.success) return;

      await pauseRecurringInvoice(created.data.id);
      const resumed = await resumeRecurringInvoice(created.data.id);

      expect(resumed.success).toBe(true);
      if (resumed.success) {
        expect(resumed.data.status).toBe('ACTIVE');
      }
    });

    it('should cancel a recurring invoice', async () => {
      const created = await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Test',
        lineItems: [
          {
            id: 'line-1',
            description: 'Service',
            quantity: 1,
            unitPrice: '100.00',
            accountId: 'account-1',
            total: '100.00',
          },
        ],
        recurrenceRule: {
          frequency: 'MONTHLY',
          interval: 1,
          endCondition: { type: 'NEVER' },
          rruleString: '',
        },
        startDate: Date.now(),
      });

      expect(created.success).toBe(true);
      if (!created.success) return;

      const cancelled = await cancelRecurringInvoice(created.data.id);
      expect(cancelled.success).toBe(true);
      if (cancelled.success) {
        expect(cancelled.data.status).toBe('CANCELLED');
      }
    });
  });

  describe('getRecurringInvoices', () => {
    it('should filter by company and status', async () => {
      await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Active 1',
        lineItems: [
          {
            id: 'line-1',
            description: 'Service',
            quantity: 1,
            unitPrice: '100.00',
            accountId: 'account-1',
            total: '100.00',
          },
        ],
        recurrenceRule: {
          frequency: 'MONTHLY',
          interval: 1,
          endCondition: { type: 'NEVER' },
          rruleString: '',
        },
        startDate: Date.now(),
      });

      const created2 = await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-2',
        templateName: 'Active 2',
        lineItems: [
          {
            id: 'line-1',
            description: 'Service',
            quantity: 1,
            unitPrice: '100.00',
            accountId: 'account-1',
            total: '100.00',
          },
        ],
        recurrenceRule: {
          frequency: 'MONTHLY',
          interval: 1,
          endCondition: { type: 'NEVER' },
          rruleString: '',
        },
        startDate: Date.now(),
      });

      if (created2.success) {
        await pauseRecurringInvoice(created2.data.id);
      }

      const activeResult = await getRecurringInvoices({
        company_id: 'company-1',
        status: 'ACTIVE',
      });

      expect(activeResult.success).toBe(true);
      if (activeResult.success) {
        expect(activeResult.data.length).toBe(1);
        expect(activeResult.data[0].status).toBe('ACTIVE');
      }
    });
  });

  describe('getRecurringInvoicesDueForGeneration', () => {
    it('should return invoices due for generation', async () => {
      const pastDate = Date.now() - 24 * 60 * 60 * 1000; // Yesterday

      await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Due Now',
        lineItems: [
          {
            id: 'line-1',
            description: 'Service',
            quantity: 1,
            unitPrice: '100.00',
            accountId: 'account-1',
            total: '100.00',
          },
        ],
        recurrenceRule: {
          frequency: 'MONTHLY',
          interval: 1,
          endCondition: { type: 'NEVER' },
          rruleString: '',
        },
        startDate: pastDate,
      });

      const result = await getRecurringInvoicesDueForGeneration('company-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1);
      }
    });

    it('should not return paused invoices', async () => {
      const pastDate = Date.now() - 24 * 60 * 60 * 1000;

      const created = await createRecurringInvoice({
        companyId: 'company-1',
        customerId: 'customer-1',
        templateName: 'Paused',
        lineItems: [
          {
            id: 'line-1',
            description: 'Service',
            quantity: 1,
            unitPrice: '100.00',
            accountId: 'account-1',
            total: '100.00',
          },
        ],
        recurrenceRule: {
          frequency: 'MONTHLY',
          interval: 1,
          endCondition: { type: 'NEVER' },
          rruleString: '',
        },
        startDate: pastDate,
      });

      if (created.success) {
        await pauseRecurringInvoice(created.data.id);
      }

      const result = await getRecurringInvoicesDueForGeneration('company-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(0);
      }
    });
  });

  describe('Generated Invoice Tracking', () => {
    it('should record generated invoice', async () => {
      const result = await recordGeneratedInvoice(
        'recurring-1',
        'invoice-1',
        Date.now(),
        Date.now(),
        true,
        Date.now()
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recurring_invoice_id).toBe('recurring-1');
        expect(result.data.invoice_id).toBe('invoice-1');
        expect(result.data.auto_sent).toBe(true);
      }
    });

    it('should retrieve generated invoices for recurring invoice', async () => {
      await recordGeneratedInvoice('recurring-1', 'invoice-1', Date.now(), Date.now(), false, null);
      await recordGeneratedInvoice('recurring-1', 'invoice-2', Date.now(), Date.now(), false, null);
      await recordGeneratedInvoice('recurring-2', 'invoice-3', Date.now(), Date.now(), false, null);

      const result = await getGeneratedInvoices('recurring-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
        expect(result.data[0].invoice_id).toBe('invoice-1');
        expect(result.data[1].invoice_id).toBe('invoice-2');
      }
    });
  });
});
