/**
 * Invoice Store Tests
 *
 * Tests for invoice CRUD operations and business logic
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInvoice,
  getInvoice,
  updateInvoice,
  sendInvoice,
  markInvoicePaid,
  voidInvoice,
  deleteInvoice,
  getInvoices,
} from './invoices';
import { db } from './database';
import type { InvoiceLineItem } from '../db/schema/invoices.schema';
import { nanoid } from 'nanoid';

describe('Invoice Store', () => {
  const testCompanyId = 'test-company';
  const testCustomerId = 'test-customer';

  beforeEach(async () => {
    // Clear all data before each test
    await db.clearAllData();
  });

  afterEach(async () => {
    // Clean up after each test
    await db.clearAllData();
  });

  describe('createInvoice', () => {
    it('should create a new invoice', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Web Development Services',
          quantity: 10,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '1000.00',
        },
      ];

      const result = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0001',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
        notes: 'Thank you for your business',
        templateId: 'classic',
        taxRate: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.invoice_number).toBe('INV-2026-0001');
        expect(result.data.status).toBe('DRAFT');
        expect(result.data.subtotal).toBe('1000.00');
        expect(result.data.tax).toBe('0.00');
        expect(result.data.total).toBe('1000.00');
      }
    });

    it('should calculate totals correctly with tax', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Product A',
          quantity: 2,
          unitPrice: '50.00',
          accountId: 'account-1',
          total: '100.00',
        },
        {
          id: nanoid(),
          description: 'Product B',
          quantity: 1,
          unitPrice: '75.00',
          accountId: 'account-1',
          total: '75.00',
        },
      ];

      const result = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0002',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
        taxRate: 0.1, // 10% tax
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subtotal).toBe('175.00');
        expect(result.data.tax).toBe('17.50');
        expect(result.data.total).toBe('192.50');
      }
    });

    it('should validate line items', async () => {
      const invalidLineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: '',
          quantity: 0,
          unitPrice: '100.00',
          accountId: '',
          total: '0.00',
        },
      ];

      const result = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0003',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems: invalidLineItems,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('getInvoice', () => {
    it('should retrieve an invoice by ID', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Test Item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const createResult = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0004',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const getResult = await getInvoice(createResult.data.id);

        expect(getResult.success).toBe(true);
        if (getResult.success) {
          expect(getResult.data.id).toBe(createResult.data.id);
          expect(getResult.data.invoice_number).toBe('INV-2026-0004');
        }
      }
    });

    it('should return error for non-existent invoice', async () => {
      const result = await getInvoice('non-existent-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('updateInvoice', () => {
    it('should update draft invoice', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Original Item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const createResult = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0005',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const updatedLineItems: InvoiceLineItem[] = [
          {
            id: nanoid(),
            description: 'Updated Item',
            quantity: 2,
            unitPrice: '150.00',
            accountId: 'account-1',
            total: '300.00',
          },
        ];

        const updateResult = await updateInvoice(createResult.data.id, {
          lineItems: updatedLineItems,
          notes: 'Updated notes',
        });

        expect(updateResult.success).toBe(true);
        if (updateResult.success) {
          expect(updateResult.data.subtotal).toBe('300.00');
          expect(updateResult.data.notes).toBe('Updated notes');
        }
      }
    });

    it('should not allow updating sent invoice', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Test Item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const createResult = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0006',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      expect(createResult.success).toBe(true);

      if (createResult.success) {
        // Send the invoice first
        await sendInvoice(createResult.data.id, 'test@example.com');

        // Try to update sent invoice
        const updateResult = await updateInvoice(createResult.data.id, {
          notes: 'Should not work',
        });

        expect(updateResult.success).toBe(false);
        if (!updateResult.success) {
          expect(updateResult.error.code).toBe('CONSTRAINT_VIOLATION');
        }
      }
    });
  });

  describe('sendInvoice', () => {
    it('should send a draft invoice', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Test Item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const createResult = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0007',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const sendResult = await sendInvoice(
          createResult.data.id,
          'customer@example.com'
        );

        expect(sendResult.success).toBe(true);
        if (sendResult.success) {
          expect(sendResult.data.status).toBe('SENT');
          expect(sendResult.data.sent_at).toBeTruthy();
        }
      }
    });
  });

  describe('markInvoicePaid', () => {
    it('should mark invoice as paid', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Test Item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const createResult = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0008',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const paidResult = await markInvoicePaid(createResult.data.id, Date.now());

        expect(paidResult.success).toBe(true);
        if (paidResult.success) {
          expect(paidResult.data.status).toBe('PAID');
          expect(paidResult.data.paid_at).toBeTruthy();
        }
      }
    });
  });

  describe('voidInvoice', () => {
    it('should void an invoice', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Test Item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const createResult = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0009',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const voidResult = await voidInvoice(createResult.data.id);

        expect(voidResult.success).toBe(true);
        if (voidResult.success) {
          expect(voidResult.data.status).toBe('VOID');
        }
      }
    });
  });

  describe('deleteInvoice', () => {
    it('should soft delete draft invoice', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Test Item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const createResult = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0010',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const deleteResult = await deleteInvoice(createResult.data.id);

        expect(deleteResult.success).toBe(true);

        // Verify invoice is soft deleted
        const getResult = await getInvoice(createResult.data.id);
        expect(getResult.success).toBe(false);
      }
    });

    it('should not delete sent invoice', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Test Item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const createResult = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0011',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      expect(createResult.success).toBe(true);

      if (createResult.success) {
        // Send invoice first
        await sendInvoice(createResult.data.id, 'test@example.com');

        // Try to delete
        const deleteResult = await deleteInvoice(createResult.data.id);

        expect(deleteResult.success).toBe(false);
        if (!deleteResult.success) {
          expect(deleteResult.error.code).toBe('CONSTRAINT_VIOLATION');
        }
      }
    });
  });

  describe('getInvoices', () => {
    it('should get all invoices for a company', async () => {
      // Create multiple invoices
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Test Item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0012',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0013',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const result = await getInvoices({ company_id: testCompanyId });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
      }
    });

    it('should filter invoices by status', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: nanoid(),
          description: 'Test Item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'account-1',
          total: '100.00',
        },
      ];

      const invoice1 = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0014',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const invoice2 = await createInvoice({
        companyId: testCompanyId,
        customerId: testCustomerId,
        invoiceNumber: 'INV-2026-0015',
        invoiceDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      if (invoice1.success && invoice2.success) {
        // Send one invoice
        await sendInvoice(invoice1.data.id, 'test@example.com');

        // Get only draft invoices
        const draftResult = await getInvoices({
          company_id: testCompanyId,
          status: 'DRAFT',
        });

        expect(draftResult.success).toBe(true);
        if (draftResult.success) {
          expect(draftResult.data.length).toBe(1);
          expect(draftResult.data[0]!.status).toBe('DRAFT');
        }

        // Get only sent invoices
        const sentResult = await getInvoices({
          company_id: testCompanyId,
          status: 'SENT',
        });

        expect(sentResult.success).toBe(true);
        if (sentResult.success) {
          expect(sentResult.data.length).toBe(1);
          expect(sentResult.data[0]!.status).toBe('SENT');
        }
      }
    });
  });
});
