/**
 * Group E Integration Tests
 *
 * Tests interactions between all Group E features:
 * - E1: Bank Reconciliation
 * - E2: Recurring Transactions
 * - E3: Invoice Templates
 * - E4: Recurring Invoices
 * - E5: Expense Categorization
 * - E6: Bill Management
 * - E7: Extended Audit Log
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../store/database';
import { nanoid } from 'nanoid';

// Import services
import { learnFromMatch, getReconciliationStreak } from '../../services/reconciliationHistory.service';
import { createRecurringSchedule, getUpcomingRecurrences } from '../../services/recurrence.service';
import { createRecurringInvoice, generateInvoiceFromTemplate } from '../../services/recurringInvoiceService';
import { categorizeTransaction, getCategorySuggestions } from '../../services/categorization.service';
import { queryAuditLogs } from '../../store/auditLogs';

// Test data factories
function createTestCompany() {
  return {
    id: nanoid(),
    name: 'Test Company',
    created: new Date(),
  };
}

function createTestUser() {
  return {
    id: nanoid(),
    email: 'test@example.com',
    name: 'Test User',
  };
}

function createTestAccount(companyId: string) {
  return {
    id: nanoid(),
    companyId,
    name: 'Test Checking',
    type: 'bank' as const,
    balance: 10000,
    created: new Date(),
  };
}

function createTestTransaction(companyId: string, accountId: string) {
  return {
    id: nanoid(),
    companyId,
    accountId,
    date: new Date(),
    description: 'Test Transaction',
    amount: 100,
    type: 'debit' as const,
    created: new Date(),
  };
}

describe('Group E Integration Tests', () => {
  let testCompanyId: string;
  let testUserId: string;
  let testAccountId: string;

  beforeEach(async () => {
    // Clear database
    await db.delete();
    await db.open();

    // Create test data
    const company = createTestCompany();
    const user = createTestUser();
    const account = createTestAccount(company.id);

    testCompanyId = company.id;
    testUserId = user.id;
    testAccountId = account.id;
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('E1 + E7: Reconciliation with Audit Logging', () => {
    it('should log audit entries when learning from reconciliation matches', async () => {
      // Create a transaction
      const transaction = createTestTransaction(testCompanyId, testAccountId);

      // Create a bank statement entry
      const statementEntry: any = {
        id: nanoid(),
        date: Date.now(),
        description: 'Coffee Shop',
        amount: -50,
        matched: false,
      };

      // Learn pattern from match (E1)
      const patternResult = await learnFromMatch(
        testCompanyId,
        statementEntry as any,
        transaction as any,
        true,
        testUserId
      );

      expect(patternResult.success).toBe(true);

      // Verify audit log was created (E7)
      const auditResult = await queryAuditLogs({
        companyId: testCompanyId,
        entityType: 'reconciliation_pattern',
      });

      expect(auditResult.success).toBe(true);
      expect((auditResult as any).data).toHaveLength(1);
      expect((auditResult as any).data[0].action).toBe('create');
      expect((auditResult as any).data[0].userId).toBe(testUserId);
    });

    it('should track reconciliation streaks and log milestones', async () => {
      // Get initial streak (E1)
      const streakResult = await getReconciliationStreak(
        testCompanyId,
        testAccountId
      );

      expect(streakResult.success).toBe(true);
      expect((streakResult as any).data.currentStreak).toBe(0);

      // Perform several reconciliations
      for (let i = 0; i < 5; i++) {
        const statementTx: any = {
          id: nanoid(),
          date: Date.now() - i * 86400000,
          description: `Statement ${i}`,
          amount: 100,
          matched: false,
        };
        const systemTx: any = {
          id: nanoid(),
          companyId: testCompanyId,
          accountId: testAccountId,
          date: new Date(Date.now() - i * 86400000),
          description: `Transaction ${i}`,
          amount: 100,
          type: 'debit',
          created: new Date(),
        };
        await learnFromMatch(
          testCompanyId,
          statementTx as any,
          systemTx as any,
          true,
          testUserId
        );
      }

      // Check streak increased
      const updatedStreakResult = await getReconciliationStreak(
        testCompanyId,
        testAccountId
      );

      expect(updatedStreakResult.success).toBe(true);
      expect((updatedStreakResult as any).data.currentStreak).toBeGreaterThan(0);

      // Verify audit logs for each reconciliation (E7)
      const auditResult = await queryAuditLogs({
        companyId: testCompanyId,
        entityType: 'reconciliation_pattern',
      });

      expect(auditResult.success).toBe(true);
      expect((auditResult as any).data).toHaveLength(5);
    });
  });

  describe('E2 + E5: Recurring Transactions with Categorization', () => {
    it('should create recurring transactions and auto-categorize them', async () => {
      // Create a category
      const category = {
        id: nanoid(),
        company_id: testCompanyId,
        name: 'Office Supplies',
        type: 'expense' as const,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 0,
        version_vector: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
      };

      await db.categories.add(category as any);

      // Create recurring transaction schedule (E2)
      const scheduleResult = await createRecurringSchedule({
        companyId: testCompanyId,
        name: 'Monthly Office Supplies',
        frequency: 'monthly',
        interval: 1,
        startDate: new Date(),
        transactionTemplate: {
          description: 'Office supplies order',
          amount: 150,
          accountId: testAccountId,
          categoryId: category.id,
        },
      });

      expect(scheduleResult.success).toBe(true);

      // Get upcoming recurrences
      const upcomingResult = await getUpcomingRecurrences(
        testCompanyId,
        new Date(),
        new Date(Date.now() + 90 * 86400000) // Next 90 days
      );

      expect(upcomingResult.success).toBe(true);
      expect((upcomingResult as any).data).toHaveLength(3); // 3 monthly recurrences in 90 days

      // Create actual transaction from recurrence
      const transaction = createTestTransaction(testCompanyId, testAccountId);
      transaction.description = 'Office supplies order';
      transaction.amount = 150;

      await db.transactions.add(transaction as any);

      // Test categorization service (E5)
      const categorizeResult = await categorizeTransaction(
        transaction.id,
        category.id,
        testCompanyId,
        testUserId
      );

      expect(categorizeResult.success).toBe(true);

      // Verify category suggestions work
      const suggestionsResult = await getCategorySuggestions(
        transaction.description,
        transaction.amount,
        testCompanyId
      );

      expect(suggestionsResult.success).toBe(true);
      expect((suggestionsResult as any).data).toBeDefined();
      expect((suggestionsResult as any).data.some((s: any) => s.categoryId === category.id)).toBe(true);
    });
  });

  describe('E3 + E4 + E7: Invoice Templates, Recurring Invoices, and Audit Logging', () => {
    it('should create invoice templates, generate recurring invoices, and log all actions', async () => {
      // Create a customer
      const customer = {
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Test Customer',
        email: 'customer@example.com',
        type: 'customer' as const,
        created: new Date(),
      };

      await db.contacts.add(customer as any);

      // Create invoice template (E3)
      const template = {
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Monthly Service Invoice',
        lineItems: [
          {
            description: 'Monthly Service Fee',
            quantity: 1,
            rate: 500,
            amount: 500,
          },
        ],
        subtotal: 500,
        total: 500,
        created: new Date(),
      };

      await db.invoiceTemplates.add(template);

      // Create recurring invoice schedule (E4)
      const recurringInvoiceResult = await createRecurringInvoice({
        companyId: testCompanyId,
        templateId: template.id,
        customerId: customer.id,
        templateName: 'Monthly Service Invoice',
        lineItems: template.line_items,
        recurrenceRule: {
          frequency: 'monthly',
          interval: 1,
        },
        startDate: new Date().getTime(),
        autoSend: false,
      });

      expect(recurringInvoiceResult.success).toBe(true);

      // Generate invoice from template
      const invoiceResult = await generateInvoiceFromTemplate(
        template.id,
        customer.id,
        testCompanyId,
        testUserId
      );

      expect(invoiceResult.success).toBe(true);
      expect((invoiceResult as any).data).toBeDefined();
      expect((invoiceResult as any).data.total).toBe(500);

      // Verify audit logs captured template creation and invoice generation (E7)
      const templateAuditResult = await queryAuditLogs({
        companyId: testCompanyId,
        entityType: 'invoice_template',
      });

      expect(templateAuditResult.success).toBe(true);
      expect((templateAuditResult as any).data.length).toBeGreaterThan(0);

      const invoiceAuditResult = await queryAuditLogs({
        companyId: testCompanyId,
        entityType: 'invoice',
      });

      expect(invoiceAuditResult.success).toBe(true);
      expect((invoiceAuditResult as any).data.length).toBeGreaterThan(0);
      expect((invoiceAuditResult as any).data[0].action).toBe('create');
    });
  });

  describe('E6 + E5 + E7: Bill Management with Categorization and Audit Logging', () => {
    it('should create bills, categorize them, and audit all changes', async () => {
      // Create a vendor
      const vendor = {
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Test Vendor',
        email: 'vendor@example.com',
        type: 'vendor' as const,
        created: new Date(),
      };

      await db.contacts.add(vendor as any);

      // Create a category for bills
      const category = {
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Utilities',
        type: 'expense' as const,
        created: new Date(),
      };

      await db.categories.add(category as any);

      // Create a bill (E6)
      const bill = {
        id: nanoid(),
        companyId: testCompanyId,
        vendorId: vendor.id,
        billNumber: 'BILL-001',
        date: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        lineItems: [
          {
            description: 'Electricity',
            quantity: 1,
            rate: 200,
            amount: 200,
            categoryId: category.id,
          },
        ],
        subtotal: 200,
        total: 200,
        status: 'unpaid' as const,
        created: new Date(),
      };

      await db.bills.add(bill as any);

      // Categorize bill line item (E5)
      const categorizeResult = await categorizeTransaction(
        bill.id,
        category.id,
        testCompanyId,
        testUserId
      );

      expect(categorizeResult.success).toBe(true);

      // Verify audit log captured bill creation (E7)
      const billAuditResult = await queryAuditLogs({
        companyId: testCompanyId,
        entityType: 'bill',
      });

      expect(billAuditResult.success).toBe(true);
      expect((billAuditResult as any).data.length).toBeGreaterThan(0);
      expect((billAuditResult as any).data[0].action).toBe('create');
      expect((billAuditResult as any).data[0].entityId).toBe(bill.id);

      // Update bill status
      await db.bills.update(bill.id, { status: 'PAID' });

      // Verify audit log captured update (E7)
      const updatedAuditResult = await queryAuditLogs({
        companyId: testCompanyId,
        entityType: 'bill',
        action: 'update',
      });

      expect(updatedAuditResult.success).toBe(true);
      expect((updatedAuditResult as any).data.some((log: any) => log.entityId === bill.id)).toBe(true);
    });
  });

  describe('Full Group E Workflow Integration', () => {
    it('should handle a complete accounting workflow using all Group E features', async () => {
      // 1. Set up recurring invoice for customer (E3 + E4)
      const customer = {
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Monthly Client',
        email: 'client@example.com',
        type: 'customer' as const,
        created: new Date(),
      };
      await db.contacts.add(customer as any);

      const template = {
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Consulting Services',
        lineItems: [{ description: 'Consulting', quantity: 10, rate: 150, amount: 1500 }],
        subtotal: 1500,
        total: 1500,
        created: new Date(),
      };
      await db.invoiceTemplates.add(template);

      const recurringInvoice = await createRecurringInvoice({
        companyId: testCompanyId,
        templateId: template.id,
        customerId: customer.id,
        templateName: 'Consulting Services',
        lineItems: template.lineItems,
        recurrenceRule: {
          frequency: 'monthly',
          interval: 1,
        },
        startDate: new Date().getTime(),
        autoSend: false,
      });
      expect(recurringInvoice.success).toBe(true);

      // 2. Set up recurring bill from vendor (E2 + E6)
      const vendor = {
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Office Landlord',
        email: 'landlord@example.com',
        type: 'vendor' as const,
        created: new Date(),
      };
      await db.contacts.add(vendor as any);

      const rentCategory = {
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Rent',
        type: 'expense' as const,
        created: new Date(),
      };
      await db.categories.add(rentCategory as any);

      const rentSchedule = await createRecurringSchedule({
        companyId: testCompanyId,
        name: 'Monthly Rent',
        frequency: 'monthly',
        interval: 1,
        startDate: new Date(),
        transactionTemplate: {
          description: 'Office rent',
          amount: -2000,
          accountId: testAccountId,
          categoryId: rentCategory.id,
        },
      });
      expect(rentSchedule.success).toBe(true);

      // 3. Reconcile bank transactions (E1 + E5)
      const transaction = createTestTransaction(testCompanyId, testAccountId);
      transaction.description = 'Office rent payment';
      transaction.amount = -2000;
      await db.transactions.add(transaction as any);

      const categorized = await categorizeTransaction(
        transaction.id,
        rentCategory.id,
        testCompanyId,
        testUserId
      );
      expect(categorized.success).toBe(true);

      const statementTx: any = {
        id: nanoid(),
        date: transaction.date.getTime(),
        description: 'RENT PAYMENT',
        amount: 2000,
        matched: false,
      };
      const pattern = await learnFromMatch(
        testCompanyId,
        statementTx as any,
        transaction as any,
        true,
        testUserId
      );
      expect(pattern.success).toBe(true);

      // 4. Verify all actions logged in audit trail (E7)
      const allAuditLogs = await queryAuditLogs({
        companyId: testCompanyId,
      });

      expect(allAuditLogs.success).toBe(true);
      expect((allAuditLogs as any).data.length).toBeGreaterThan(0);

      // Verify we have logs for:
      // - Invoice template creation
      // - Recurring invoice setup
      // - Transaction categorization
      // - Reconciliation pattern learning
      const entityTypes = new Set((allAuditLogs as any).data.map((log: any) => log.entityType));
      expect(entityTypes.has('invoice_template')).toBe(true);
      expect(entityTypes.has('recurring_invoice')).toBe(true);
      expect(entityTypes.has('transaction')).toBe(true);
      expect(entityTypes.has('reconciliation_pattern')).toBe(true);

      // 5. Verify recurring schedules are working
      const upcomingRecurrences = await getUpcomingRecurrences(
        testCompanyId,
        new Date(),
        new Date(Date.now() + 90 * 86400000)
      );
      expect(upcomingRecurrences.success).toBe(true);
      expect((upcomingRecurrences as any).data.length).toBeGreaterThan(0);
    });
  });
});
