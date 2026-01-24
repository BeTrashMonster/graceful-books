/**
 * CPG Integration Service Tests
 *
 * Tests the integration between CPG cost tracking and accounting system.
 * Validates that invoices create both CPG records and accounting transactions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { db } from '../../db';
import { cpgIntegrationService } from './cpgIntegration.service';
import type {
  Company,
  CPGCategory,
  CPGProductLink,
  Product,
  Account,
  Contact,
} from '../../types/database.types';

describe('CPGIntegrationService', () => {
  const testCompanyId = 'test-company-123';
  const testDeviceId = 'test-device-123';

  // Test data
  let oilCategory: CPGCategory;
  let bottleCategory: CPGCategory;
  let oilProduct: Product;
  let bottleProduct8oz: Product;
  let bottleProduct16oz: Product;
  let cogsAccount: Account;
  let inventoryAccount: Account;
  let apAccount: Account;
  let incomeAccount: Account;
  let vendor: Contact;

  beforeEach(async () => {
    // Clear database
    await db.companies.clear();
    await db.cpgCategories.clear();
    await db.cpgInvoices.clear();
    await db.cpgProductLinks.clear();
    await db.products.clear();
    await db.accounts.clear();
    await db.contacts.clear();
    await db.transactions.clear();
    await db.transactionLineItems.clear();

    // Create test company
    const company: Company = {
      id: testCompanyId,
      name: 'Test CPG Company',
      tax_id: null,
      address: null,
      phone: null,
      email: null,
      fiscal_year_start_month: 1,
      default_currency: 'USD',
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.companies.add(company);

    // Create CPG categories
    oilCategory = {
      id: 'cat-oil',
      company_id: testCompanyId,
      name: 'Oil',
      description: 'Olive oil',
      variants: ['8oz', '16oz'],
      sort_order: 1,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.cpgCategories.add(oilCategory);

    bottleCategory = {
      id: 'cat-bottle',
      company_id: testCompanyId,
      name: 'Bottle',
      description: 'Glass bottles',
      variants: ['8oz', '16oz'],
      sort_order: 2,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.cpgCategories.add(bottleCategory);

    // Create accounts
    cogsAccount = {
      id: 'acc-cogs',
      company_id: testCompanyId,
      type: 'COGS',
      name: 'Cost of Goods Sold',
      account_number: '5000',
      balance: '0.00',
      parent_id: null,
      description: null,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.accounts.add(cogsAccount);

    inventoryAccount = {
      id: 'acc-inventory',
      company_id: testCompanyId,
      type: 'ASSET',
      name: 'Inventory - Raw Materials',
      account_number: '1300',
      balance: '0.00',
      parent_id: null,
      description: null,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.accounts.add(inventoryAccount);

    apAccount = {
      id: 'acc-ap',
      company_id: testCompanyId,
      type: 'LIABILITY',
      name: 'Accounts Payable',
      account_number: '2000',
      balance: '0.00',
      parent_id: null,
      description: null,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.accounts.add(apAccount);

    incomeAccount = {
      id: 'acc-income',
      company_id: testCompanyId,
      type: 'INCOME',
      name: 'Sales Revenue',
      account_number: '4000',
      balance: '10000.00',
      parent_id: null,
      description: null,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.accounts.add(incomeAccount);

    // Create products
    oilProduct = {
      id: 'prod-oil',
      company_id: testCompanyId,
      type: 'PRODUCT',
      sku: 'OIL-001',
      name: 'Olive Oil',
      description: null,
      unit_price: '10.00',
      cost: null,
      income_account_id: incomeAccount.id,
      expense_account_id: cogsAccount.id,
      taxable: true,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.products.add(oilProduct);

    bottleProduct8oz = {
      id: 'prod-bottle-8oz',
      company_id: testCompanyId,
      type: 'PRODUCT',
      sku: 'BOT-8OZ',
      name: '8oz Glass Bottle',
      description: null,
      unit_price: '2.00',
      cost: null,
      income_account_id: incomeAccount.id,
      expense_account_id: cogsAccount.id,
      taxable: true,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.products.add(bottleProduct8oz);

    bottleProduct16oz = {
      id: 'prod-bottle-16oz',
      company_id: testCompanyId,
      type: 'PRODUCT',
      sku: 'BOT-16OZ',
      name: '16oz Glass Bottle',
      description: null,
      unit_price: '3.00',
      cost: null,
      income_account_id: incomeAccount.id,
      expense_account_id: cogsAccount.id,
      taxable: true,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.products.add(bottleProduct16oz);

    // Create product links
    const oilLink8oz: CPGProductLink = {
      id: 'link-oil-8oz',
      company_id: testCompanyId,
      cpg_category_id: oilCategory.id,
      cpg_variant: '8oz',
      product_id: oilProduct.id,
      account_id_cogs: cogsAccount.id,
      account_id_inventory: inventoryAccount.id,
      notes: null,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.cpgProductLinks.add(oilLink8oz);

    const oilLink16oz: CPGProductLink = {
      id: 'link-oil-16oz',
      company_id: testCompanyId,
      cpg_category_id: oilCategory.id,
      cpg_variant: '16oz',
      product_id: oilProduct.id,
      account_id_cogs: cogsAccount.id,
      account_id_inventory: inventoryAccount.id,
      notes: null,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.cpgProductLinks.add(oilLink16oz);

    const bottleLink8oz: CPGProductLink = {
      id: 'link-bottle-8oz',
      company_id: testCompanyId,
      cpg_category_id: bottleCategory.id,
      cpg_variant: '8oz',
      product_id: bottleProduct8oz.id,
      account_id_cogs: cogsAccount.id,
      account_id_inventory: inventoryAccount.id,
      notes: null,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.cpgProductLinks.add(bottleLink8oz);

    const bottleLink16oz: CPGProductLink = {
      id: 'link-bottle-16oz',
      company_id: testCompanyId,
      cpg_category_id: bottleCategory.id,
      cpg_variant: '16oz',
      product_id: bottleProduct16oz.id,
      account_id_cogs: cogsAccount.id,
      account_id_inventory: inventoryAccount.id,
      notes: null,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.cpgProductLinks.add(bottleLink16oz);

    // Create vendor
    vendor = {
      id: 'vendor-123',
      company_id: testCompanyId,
      type: 'VENDOR',
      name: 'Oil Supplier Inc.',
      email: 'supplier@example.com',
      phone: null,
      address: null,
      tax_id: null,
      notes: null,
      balance: '0.00',
      parent_id: null,
      account_type: 'STANDALONE',
      hierarchy_level: 0,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    };
    await db.contacts.add(vendor);
  });

  afterEach(async () => {
    // Clean up
    await db.companies.clear();
    await db.cpgCategories.clear();
    await db.cpgInvoices.clear();
    await db.cpgProductLinks.clear();
    await db.products.clear();
    await db.accounts.clear();
    await db.contacts.clear();
    await db.transactions.clear();
    await db.transactionLineItems.clear();
  });

  describe('createIntegratedInvoice', () => {
    it('should create both CPG invoice and accounting transaction', async () => {
      const result = await cpgIntegrationService.createIntegratedInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier Inc.',
        invoice_number: 'INV-001',
        notes: 'Test invoice',
        cost_attribution: {
          Oil_8oz: {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '5.00',
            units_received: '100',
          },
          Bottle_8oz: {
            category_id: bottleCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '1.50',
            units_received: '100',
          },
        },
        additional_costs: {
          Shipping: '50.00',
        },
        device_id: testDeviceId,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Verify CPG invoice created
      const cpgInvoice = result.data!.cpgInvoice;
      expect(cpgInvoice).toBeDefined();
      expect(cpgInvoice.company_id).toBe(testCompanyId);
      expect(cpgInvoice.vendor_name).toBe('Oil Supplier Inc.');
      expect(cpgInvoice.total_paid).toBe('700.00'); // (100*5) + (100*1.5) + 50

      // Verify CPUs calculated
      expect(cpgInvoice.calculated_cpus).toBeDefined();
      expect(cpgInvoice.calculated_cpus!['8oz']).toBeDefined();

      // Verify accounting transaction created
      const transaction = result.data!.transaction;
      expect(transaction).toBeDefined();
      expect(transaction.company_id).toBe(testCompanyId);
      expect(transaction.type).toBe('BILL');
      expect(transaction.status).toBe('POSTED');

      // Verify transaction line items
      const lineItems = result.data!.transactionLineItems;
      expect(lineItems.length).toBeGreaterThan(0);

      // Verify journal entries balanced
      const journalEntries = result.data!.journalEntries;
      expect(journalEntries.length).toBeGreaterThan(0);

      // Verify records in database
      const savedCPGInvoice = await db.cpgInvoices.get(cpgInvoice.id);
      expect(savedCPGInvoice).toBeDefined();

      const savedTransaction = await db.transactions.get(transaction.id);
      expect(savedTransaction).toBeDefined();

      const savedLineItems = await db.transactionLineItems
        .where('transaction_id')
        .equals(transaction.id)
        .toArray();
      expect(savedLineItems.length).toBe(lineItems.length);
    });

    it('should calculate CPUs with additional costs allocated proportionally', async () => {
      const result = await cpgIntegrationService.createIntegratedInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier Inc.',
        cost_attribution: {
          Oil_8oz: {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '5.00',
            units_received: '100',
          },
          Oil_16oz: {
            category_id: oilCategory.id,
            variant: '16oz',
            units_purchased: '50',
            unit_price: '8.00',
            units_received: '50',
          },
        },
        additional_costs: {
          Shipping: '90.00', // Will be allocated proportionally
        },
        device_id: testDeviceId,
      });

      expect(result.success).toBe(true);

      const cpgInvoice = result.data!.cpgInvoice;
      expect(cpgInvoice.total_paid).toBe('990.00'); // (100*5) + (50*8) + 90

      // Verify proportional allocation
      // Oil 8oz: 500 / 900 * 90 = 50 additional
      // Oil 16oz: 400 / 900 * 90 = 40 additional
      // CPU 8oz: (500 + 50) / 100 = 5.50
      // CPU 16oz: (400 + 40) / 50 = 8.80

      expect(parseFloat(cpgInvoice.calculated_cpus!['8oz'])).toBeCloseTo(5.5, 2);
      expect(parseFloat(cpgInvoice.calculated_cpus!['16oz'])).toBeCloseTo(8.8, 2);
    });

    it('should handle units purchased vs received discrepancy', async () => {
      const result = await cpgIntegrationService.createIntegratedInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier Inc.',
        cost_attribution: {
          Oil_8oz: {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '5.00',
            units_received: '98', // 2 units lost/damaged
          },
        },
        device_id: testDeviceId,
      });

      expect(result.success).toBe(true);

      const cpgInvoice = result.data!.cpgInvoice;
      // CPU should be based on units received, not purchased
      // CPU = 500 / 98 = 5.10
      expect(parseFloat(cpgInvoice.calculated_cpus!['8oz'])).toBeCloseTo(5.1, 2);
    });

    it('should fail if product links are missing', async () => {
      // Clear all product links
      await db.cpgProductLinks.clear();

      const result = await cpgIntegrationService.createIntegratedInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier Inc.',
        cost_attribution: {
          Oil_8oz: {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '5.00',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing product links');
    });

    it('should create vendor if not exists', async () => {
      const result = await cpgIntegrationService.createIntegratedInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'New Vendor LLC',
        cost_attribution: {
          Oil_8oz: {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '5.00',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      expect(result.success).toBe(true);

      // Verify vendor created
      const vendors = await db.contacts
        .where('[company_id+type]')
        .equals([testCompanyId, 'VENDOR'])
        .and((c) => c.name === 'New Vendor LLC')
        .toArray();

      expect(vendors.length).toBe(1);
    });

    it('should create balanced journal entries', async () => {
      const result = await cpgIntegrationService.createIntegratedInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier Inc.',
        cost_attribution: {
          Oil_8oz: {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '5.00',
            units_received: '100',
          },
        },
        additional_costs: {
          Shipping: '50.00',
        },
        device_id: testDeviceId,
      });

      expect(result.success).toBe(true);

      // Calculate total debits and credits
      const lineItems = result.data!.transactionLineItems;
      let totalDebits = new Decimal(0);
      let totalCredits = new Decimal(0);

      for (const item of lineItems) {
        totalDebits = totalDebits.plus(new Decimal(item.debit || '0'));
        totalCredits = totalCredits.plus(new Decimal(item.credit || '0'));
      }

      // Should be balanced
      expect(totalDebits.toFixed(2)).toBe(totalCredits.toFixed(2));
      expect(totalDebits.toFixed(2)).toBe('550.00'); // 500 + 50
    });
  });

  describe('linkCPGCategoryToProduct', () => {
    it('should create product link', async () => {
      // Create new category without links
      const newCategory: CPGCategory = {
        id: 'cat-box',
        company_id: testCompanyId,
        name: 'Box',
        description: 'Shipping boxes',
        variants: ['Small', 'Large'],
        sort_order: 3,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      };
      await db.cpgCategories.add(newCategory);

      const result = await cpgIntegrationService.linkCPGCategoryToProduct(
        testCompanyId,
        newCategory.id,
        'Small',
        oilProduct.id,
        cogsAccount.id,
        inventoryAccount.id,
        testDeviceId
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.cpg_category_id).toBe(newCategory.id);
      expect(result.data!.cpg_variant).toBe('Small');
      expect(result.data!.product_id).toBe(oilProduct.id);

      // Verify saved to database
      const saved = await db.cpgProductLinks.get(result.data!.id);
      expect(saved).toBeDefined();
    });

    it('should fail if link already exists', async () => {
      const result = await cpgIntegrationService.linkCPGCategoryToProduct(
        testCompanyId,
        oilCategory.id,
        '8oz', // Already linked
        oilProduct.id,
        cogsAccount.id,
        inventoryAccount.id,
        testDeviceId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('getFinancialDataForCPG', () => {
    it('should return financial data', async () => {
      // Update account balances
      await db.accounts.update(cogsAccount.id, { balance: '3000.00' });
      await db.accounts.update(inventoryAccount.id, { balance: '5000.00' });

      const result = await cpgIntegrationService.getFinancialDataForCPG(testCompanyId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.revenue).toBe('10000.00');
      expect(result.data!.cogs).toBe('3000.00');
      expect(result.data!.grossProfit).toBe('7000.00');
      expect(result.data!.inventory).toBe('5000.00');

      // Gross margin = (7000 / 10000) * 100 = 70%
      expect(parseFloat(result.data!.grossMargin)).toBeCloseTo(70, 2);
    });

    it('should handle zero revenue', async () => {
      // Set revenue to 0
      await db.accounts.update(incomeAccount.id, { balance: '0.00' });

      const result = await cpgIntegrationService.getFinancialDataForCPG(testCompanyId);

      expect(result.success).toBe(true);
      expect(result.data!.revenue).toBe('0.00');
      expect(result.data!.grossMargin).toBe('0.00'); // Avoid division by zero
    });
  });

  describe('syncCOGS', () => {
    it('should calculate COGS for units sold', async () => {
      // First create an invoice
      const invoiceResult = await cpgIntegrationService.createIntegratedInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier Inc.',
        cost_attribution: {
          Oil_8oz: {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '5.00',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      expect(invoiceResult.success).toBe(true);

      // Now sync COGS for 10 units sold
      const syncResult = await cpgIntegrationService.syncCOGS(
        invoiceResult.data!.cpgInvoice.id,
        {
          '8oz': '10', // 10 units sold
        }
      );

      expect(syncResult.success).toBe(true);
      expect(syncResult.data).toBeDefined();

      // COGS should be CPU * quantity = 5.00 * 10 = 50.00
      expect(syncResult.data!.totalCOGS).toBe('50.00');
      expect(syncResult.data!.inventoryAdjustment).toBe('50.00');
    });

    it('should handle multiple variants sold', async () => {
      // Create invoice with multiple variants
      const invoiceResult = await cpgIntegrationService.createIntegratedInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier Inc.',
        cost_attribution: {
          Oil_8oz: {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '5.00',
            units_received: '100',
          },
          Oil_16oz: {
            category_id: oilCategory.id,
            variant: '16oz',
            units_purchased: '50',
            unit_price: '8.00',
            units_received: '50',
          },
        },
        device_id: testDeviceId,
      });

      expect(invoiceResult.success).toBe(true);

      // Sync COGS for both variants
      const syncResult = await cpgIntegrationService.syncCOGS(
        invoiceResult.data!.cpgInvoice.id,
        {
          '8oz': '10',
          '16oz': '5',
        }
      );

      expect(syncResult.success).toBe(true);

      // Total COGS = (CPU_8oz * 10) + (CPU_16oz * 5)
      const totalCOGS = parseFloat(syncResult.data!.totalCOGS);
      expect(totalCOGS).toBeGreaterThan(0);
    });
  });
});
