/**
 * Bills Store Tests
 *
 * Tests for bill CRUD operations, encryption, and status transitions
 *
 * Test coverage:
 * - Bill creation with validation
 * - Bill retrieval and querying
 * - Bill updates (draft only)
 * - Bill status transitions (draft -> due -> paid/overdue)
 * - Bill deletion (soft delete)
 * - Bill payment recording
 * - Encryption/decryption of sensitive fields
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nanoid } from 'nanoid';
import { db } from './database';
import {
  createBill,
  getBill,
  updateBill,
  postBill,
  markBillPaid,
  voidBill,
  deleteBill,
  getBills,
  getVendorBills,
  getBillLineItems,
  getUpcomingBills,
  getOverdueBills,
} from './bills';
import type { Bill, BillLineItem } from '../db/schema/bills.schema';
import type { EncryptionContext } from './types';

// Mock the device ID utility
vi.mock('../utils/device', () => ({
  getDeviceId: () => 'test-device-123',
}));

// Mock encryption service
const mockEncryptionService = {
  encrypt: vi.fn(async (data: string) => `encrypted_${data}`),
  decrypt: vi.fn(async (data: string) => data.replace('encrypted_', '')),
};

const mockContext: EncryptionContext = {
  encryptionService: mockEncryptionService,
};

describe('Bills Store', () => {
  beforeEach(async () => {
    // Clear the database before each test
    await db.bills.clear();
    vi.clearAllMocks();
  });

  describe('createBill', () => {
    it('should create a new bill with valid data', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Office supplies',
          quantity: 10,
          unitPrice: '5.00',
          accountId: 'expense-account-id',
          total: '50.00',
        },
      ];

      const result = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-001',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
        notes: 'Test bill',
        internalMemo: 'Internal note',
        taxRate: 0.08,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.company_id).toBe('company-123');
      expect(result.data?.vendor_id).toBe('vendor-456');
      expect(result.data?.status).toBe('DRAFT');
      expect(result.data?.subtotal).toBe('50.00');
      expect(result.data?.tax).toBe('4.00');
      expect(result.data?.total).toBe('54.00');
    });

    it('should encrypt sensitive fields when encryption service provided', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Consulting services',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'expense-account-id',
          total: '100.00',
        },
      ];

      const result = await createBill(
        {
          companyId: 'company-123',
          vendorId: 'vendor-456',
          billNumber: 'BILL-002',
          billDate: Date.now(),
          dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          lineItems,
          notes: 'Sensitive note',
          internalMemo: 'Sensitive memo',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('Sensitive note');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('Sensitive memo');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
        expect.stringContaining('Consulting services')
      );

      // Verify encrypted data is stored in database
      const stored = await db.bills.get(result.data!.id);
      expect(stored?.notes).toBe('encrypted_Sensitive note');
      expect(stored?.internal_memo).toBe('encrypted_Sensitive memo');
    });

    it('should reject invalid line items', async () => {
      const invalidLineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: '', // Invalid: empty description
          quantity: -1, // Invalid: negative quantity
          unitPrice: 'invalid', // Invalid: not a number
          accountId: '',
          total: '0',
        },
      ];

      const result = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-003',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems: invalidLineItems,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject due date before bill date', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '10.00',
          accountId: 'expense-account-id',
          total: '10.00',
        },
      ];

      const billDate = Date.now();
      const dueDate = billDate - 24 * 60 * 60 * 1000; // 1 day before

      const result = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-004',
        billDate,
        dueDate,
        lineItems,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('due_date must be after bill_date');
    });
  });

  describe('getBill', () => {
    it('should retrieve a bill by ID', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '25.00',
          accountId: 'expense-account-id',
          total: '25.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-005',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      const result = await getBill(billId);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(billId);
      expect(result.data?.bill_number).toBe('BILL-005');
    });

    it('should decrypt sensitive fields when encryption service provided', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '30.00',
          accountId: 'expense-account-id',
          total: '30.00',
        },
      ];

      const createResult = await createBill(
        {
          companyId: 'company-123',
          vendorId: 'vendor-456',
          billNumber: 'BILL-006',
          billDate: Date.now(),
          dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          lineItems,
          notes: 'Test note',
        },
        mockContext
      );

      const billId = createResult.data!.id;
      const result = await getBill(billId, mockContext);

      expect(result.success).toBe(true);
      expect(mockEncryptionService.decrypt).toHaveBeenCalled();
      expect(result.data?.notes).toBe('Test note'); // Decrypted
    });

    it('should return error for non-existent bill', async () => {
      const result = await getBill('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should return error for soft-deleted bill', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '15.00',
          accountId: 'expense-account-id',
          total: '15.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-007',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      await deleteBill(billId);

      const result = await getBill(billId);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('updateBill', () => {
    it('should update a draft bill', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Original item',
          quantity: 1,
          unitPrice: '20.00',
          accountId: 'expense-account-id',
          total: '20.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-008',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;

      const newLineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Updated item',
          quantity: 2,
          unitPrice: '15.00',
          accountId: 'expense-account-id',
          total: '30.00',
        },
      ];

      const result = await updateBill(billId, {
        lineItems: newLineItems,
        notes: 'Updated note',
      });

      expect(result.success).toBe(true);
      expect(result.data?.subtotal).toBe('30.00');
      expect(result.data?.notes).toBe('Updated note');
    });

    it('should not allow updating a posted bill', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '10.00',
          accountId: 'expense-account-id',
          total: '10.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-009',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      await postBill(billId); // Change status to DUE

      const result = await updateBill(billId, {
        notes: 'Try to update',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONSTRAINT_VIOLATION');
    });
  });

  describe('postBill', () => {
    it('should change bill status from DRAFT to DUE', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '50.00',
          accountId: 'expense-account-id',
          total: '50.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-010',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      const result = await postBill(billId);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('DUE');
    });

    it('should not allow posting an already posted bill', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '40.00',
          accountId: 'expense-account-id',
          total: '40.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-011',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      await postBill(billId);

      const result = await postBill(billId);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONSTRAINT_VIOLATION');
    });
  });

  describe('markBillPaid', () => {
    it('should mark a due bill as paid', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '75.00',
          accountId: 'expense-account-id',
          total: '75.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-012',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      await postBill(billId);

      const paymentDate = Date.now();
      const result = await markBillPaid(billId, paymentDate, 'transaction-123');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('PAID');
      expect(result.data?.paid_at).toBe(paymentDate);
      expect(result.data?.transaction_id).toBe('transaction-123');
    });

    it('should not allow marking a voided bill as paid', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '60.00',
          accountId: 'expense-account-id',
          total: '60.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-013',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      await postBill(billId);
      await voidBill(billId);

      const result = await markBillPaid(billId, Date.now());
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONSTRAINT_VIOLATION');
    });

    it('should be idempotent for already paid bills', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '80.00',
          accountId: 'expense-account-id',
          total: '80.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-014',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      await postBill(billId);
      await markBillPaid(billId, Date.now());

      const result = await markBillPaid(billId, Date.now());
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('PAID');
    });
  });

  describe('voidBill', () => {
    it('should void a bill', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '35.00',
          accountId: 'expense-account-id',
          total: '35.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-015',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      const result = await voidBill(billId);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('VOID');
    });

    it('should be idempotent for already voided bills', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '45.00',
          accountId: 'expense-account-id',
          total: '45.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-016',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      await voidBill(billId);

      const result = await voidBill(billId);
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('VOID');
    });
  });

  describe('deleteBill', () => {
    it('should soft delete a draft bill', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '55.00',
          accountId: 'expense-account-id',
          total: '55.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-017',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      const result = await deleteBill(billId);

      expect(result.success).toBe(true);

      const stored = await db.bills.get(billId);
      expect(stored?.deleted_at).not.toBeNull();
    });

    it('should not allow deleting a posted bill', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '65.00',
          accountId: 'expense-account-id',
          total: '65.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-018',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      await postBill(billId);

      const result = await deleteBill(billId);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONSTRAINT_VIOLATION');
    });
  });

  describe('getBills', () => {
    it('should retrieve bills with filters', async () => {
      const lineItems1: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Item 1',
          quantity: 1,
          unitPrice: '10.00',
          accountId: 'expense-account-id',
          total: '10.00',
        },
      ];

      const lineItems2: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Item 2',
          quantity: 2,
          unitPrice: '20.00',
          accountId: 'expense-account-id',
          total: '40.00',
        },
      ];

      await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-019',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems: lineItems1,
      });

      await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-789',
        billNumber: 'BILL-020',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems: lineItems2,
      });

      const result = await getBills({ company_id: 'company-123' });

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });

    it('should filter bills by vendor', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '30.00',
          accountId: 'expense-account-id',
          total: '30.00',
        },
      ];

      await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-021',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-789',
        billNumber: 'BILL-022',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const result = await getVendorBills('company-123', 'vendor-456');

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].vendor_id).toBe('vendor-456');
    });

    it('should automatically update overdue bills', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'expense-account-id',
          total: '100.00',
        },
      ];

      const pastDueDate = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-023',
        billDate: Date.now() - 37 * 24 * 60 * 60 * 1000,
        dueDate: pastDueDate,
        lineItems,
      });

      const billId = createResult.data!.id;
      await postBill(billId); // Status: DUE

      const result = await getBills({ company_id: 'company-123' });

      expect(result.success).toBe(true);
      const bill = result.data?.find(b => b.id === billId);
      expect(bill?.status).toBe('OVERDUE');
    });

    it('should exclude soft-deleted bills by default', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '25.00',
          accountId: 'expense-account-id',
          total: '25.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-024',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const billId = createResult.data!.id;
      await deleteBill(billId);

      const result = await getBills({ company_id: 'company-123' });

      expect(result.success).toBe(true);
      expect(result.data?.find(b => b.id === billId)).toBeUndefined();
    });
  });

  describe('getUpcomingBills', () => {
    it('should return bills due in the next N days', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '50.00',
          accountId: 'expense-account-id',
          total: '50.00',
        },
      ];

      const now = Date.now();
      const in5Days = now + 5 * 24 * 60 * 60 * 1000;
      const in15Days = now + 15 * 24 * 60 * 60 * 1000;

      const createResult1 = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-025',
        billDate: now,
        dueDate: in5Days,
        lineItems,
      });

      const createResult2 = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-026',
        billDate: now,
        dueDate: in15Days,
        lineItems,
      });

      await postBill(createResult1.data!.id);
      await postBill(createResult2.data!.id);

      const result = await getUpcomingBills('company-123', 7);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].id).toBe(createResult1.data!.id);
    });
  });

  describe('getOverdueBills', () => {
    it('should return only overdue bills', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '75.00',
          accountId: 'expense-account-id',
          total: '75.00',
        },
      ];

      const pastDueDate = Date.now() - 10 * 24 * 60 * 60 * 1000;

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-027',
        billDate: Date.now() - 40 * 24 * 60 * 60 * 1000,
        dueDate: pastDueDate,
        lineItems,
      });

      await postBill(createResult.data!.id);

      // Trigger overdue status update
      await getBills({ company_id: 'company-123' });

      const result = await getOverdueBills('company-123');

      expect(result.success).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
      expect(result.data?.[0].status).toBe('OVERDUE');
    });
  });

  describe('getBillLineItems', () => {
    it('should parse and return line items', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Item 1',
          quantity: 2,
          unitPrice: '15.00',
          accountId: 'expense-account-id',
          total: '30.00',
        },
        {
          id: nanoid(),
          description: 'Item 2',
          quantity: 1,
          unitPrice: '20.00',
          accountId: 'expense-account-id',
          total: '20.00',
        },
      ];

      const createResult = await createBill({
        companyId: 'company-123',
        vendorId: 'vendor-456',
        billNumber: 'BILL-028',
        billDate: Date.now(),
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lineItems,
      });

      const result = await getBillLineItems(createResult.data!.id);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
      expect(result.data?.[0].description).toBe('Item 1');
      expect(result.data?.[1].description).toBe('Item 2');
    });
  });

  describe('Encryption', () => {
    it('should encrypt notes field', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '100.00',
          accountId: 'expense-account-id',
          total: '100.00',
        },
      ];

      const result = await createBill(
        {
          companyId: 'company-123',
          vendorId: 'vendor-456',
          billNumber: 'BILL-ENC-001',
          billDate: Date.now(),
          dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          lineItems,
          notes: 'Confidential payment terms',
        },
        mockContext
      );

      expect(result.success).toBe(true);

      const stored = await db.bills.get(result.data!.id);
      expect(stored?.notes).toBe('encrypted_Confidential payment terms');
    });

    it('should encrypt internal_memo field', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Test item',
          quantity: 1,
          unitPrice: '200.00',
          accountId: 'expense-account-id',
          total: '200.00',
        },
      ];

      const result = await createBill(
        {
          companyId: 'company-123',
          vendorId: 'vendor-456',
          billNumber: 'BILL-ENC-002',
          billDate: Date.now(),
          dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          lineItems,
          internalMemo: 'Sensitive internal note',
        },
        mockContext
      );

      expect(result.success).toBe(true);

      const stored = await db.bills.get(result.data!.id);
      expect(stored?.internal_memo).toBe('encrypted_Sensitive internal note');
    });

    it('should encrypt line_items field', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Confidential consulting',
          quantity: 1,
          unitPrice: '500.00',
          accountId: 'expense-account-id',
          total: '500.00',
        },
      ];

      const result = await createBill(
        {
          companyId: 'company-123',
          vendorId: 'vendor-456',
          billNumber: 'BILL-ENC-003',
          billDate: Date.now(),
          dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          lineItems,
        },
        mockContext
      );

      expect(result.success).toBe(true);

      const stored = await db.bills.get(result.data!.id);
      expect(stored?.line_items).toContain('encrypted_');
    });

    it('should decrypt all fields on retrieval', async () => {
      const lineItems: BillLineItem[] = [
        {
          id: nanoid(),
          description: 'Secret project',
          quantity: 1,
          unitPrice: '1000.00',
          accountId: 'expense-account-id',
          total: '1000.00',
        },
      ];

      const createResult = await createBill(
        {
          companyId: 'company-123',
          vendorId: 'vendor-456',
          billNumber: 'BILL-ENC-004',
          billDate: Date.now(),
          dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          lineItems,
          notes: 'Top secret',
          internalMemo: 'Classified',
        },
        mockContext
      );

      const result = await getBill(createResult.data!.id, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.notes).toBe('Top secret');
      expect(result.data?.internal_memo).toBe('Classified');

      const parsedLineItems = JSON.parse(result.data!.line_items);
      expect(parsedLineItems[0].description).toBe('Secret project');
    });
  });
});
