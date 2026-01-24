/**
 * Product Linking Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductLinkingManager } from './ProductLinkingManager';
import { db } from '../../db';
import type { CPGCategory, Product, Account } from '../../types/database.types';

describe('ProductLinkingManager', () => {
  const testCompanyId = 'test-company-123';
  const testDeviceId = 'test-device-123';

  let testCategories: CPGCategory[];
  let testProducts: Product[];
  let testAccounts: Account[];

  beforeEach(async () => {
    // Clear database
    await db.cpgCategories.clear();
    await db.cpgProductLinks.clear();
    await db.products.clear();
    await db.accounts.clear();

    // Create test data
    testCategories = [
      {
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
      },
      {
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
      },
    ];

    testProducts = [
      {
        id: 'prod-oil',
        company_id: testCompanyId,
        type: 'PRODUCT',
        sku: 'OIL-001',
        name: 'Olive Oil',
        description: null,
        unit_price: '10.00',
        cost: null,
        income_account_id: 'acc-income',
        expense_account_id: 'acc-cogs',
        taxable: true,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      },
      {
        id: 'prod-bottle',
        company_id: testCompanyId,
        type: 'PRODUCT',
        sku: 'BOT-001',
        name: 'Glass Bottle',
        description: null,
        unit_price: '2.00',
        cost: null,
        income_account_id: 'acc-income',
        expense_account_id: 'acc-cogs',
        taxable: true,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      },
    ];

    testAccounts = [
      {
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
      },
      {
        id: 'acc-inventory',
        company_id: testCompanyId,
        type: 'ASSET',
        name: 'Inventory',
        account_number: '1300',
        balance: '0.00',
        parent_id: null,
        description: null,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      },
      {
        id: 'acc-income',
        company_id: testCompanyId,
        type: 'INCOME',
        name: 'Sales Revenue',
        account_number: '4000',
        balance: '0.00',
        parent_id: null,
        description: null,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      },
    ];

    // Add to database
    for (const cat of testCategories) {
      await db.cpgCategories.add(cat);
    }
    for (const prod of testProducts) {
      await db.products.add(prod);
    }
    for (const acc of testAccounts) {
      await db.accounts.add(acc);
    }
  });

  afterEach(async () => {
    // Clean up
    await db.cpgCategories.clear();
    await db.cpgProductLinks.clear();
    await db.products.clear();
    await db.accounts.clear();
  });

  it('should render empty state when no links exist', async () => {
    render(<ProductLinkingManager companyId={testCompanyId} categories={testCategories} />);

    await waitFor(() => {
      expect(screen.getByText(/No product links configured yet/i)).toBeInTheDocument();
    });
  });

  it('should show create link modal when button clicked', async () => {
    render(<ProductLinkingManager companyId={testCompanyId} categories={testCategories} />);

    await waitFor(() => {
      const createButton = screen.getByText('+ Create Link');
      expect(createButton).toBeInTheDocument();
    });

    const createButton = screen.getByText('+ Create Link');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Product Link')).toBeInTheDocument();
    });
  });

  it('should display category options in modal', async () => {
    render(<ProductLinkingManager companyId={testCompanyId} categories={testCategories} />);

    await waitFor(() => {
      const createButton = screen.getByText('+ Create Link');
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Oil')).toBeInTheDocument();
      expect(screen.getByText('Bottle')).toBeInTheDocument();
    });
  });

  it('should show variants when category selected', async () => {
    render(<ProductLinkingManager companyId={testCompanyId} categories={testCategories} />);

    await waitFor(() => {
      const createButton = screen.getByText('+ Create Link');
      fireEvent.click(createButton);
    });

    // Select Oil category
    const categorySelect = screen.getByLabelText(/CPG Category/i);
    fireEvent.change(categorySelect, { target: { value: 'cat-oil' } });

    await waitFor(() => {
      expect(screen.getByText('8oz')).toBeInTheDocument();
      expect(screen.getByText('16oz')).toBeInTheDocument();
    });
  });

  it('should create product link successfully', async () => {
    const { container } = render(
      <ProductLinkingManager companyId={testCompanyId} categories={testCategories} />
    );

    await waitFor(() => {
      const createButton = screen.getByText('+ Create Link');
      fireEvent.click(createButton);
    });

    // Fill form
    const categorySelect = screen.getByLabelText(/CPG Category/i);
    fireEvent.change(categorySelect, { target: { value: 'cat-oil' } });

    await waitFor(() => {
      const variantSelect = screen.getByLabelText(/Variant/i);
      fireEvent.change(variantSelect, { target: { value: '8oz' } });
    });

    const productSelect = screen.getByLabelText(/Product.*SKU/i);
    fireEvent.change(productSelect, { target: { value: 'prod-oil' } });

    const cogsSelect = screen.getByLabelText(/COGS Account/i);
    fireEvent.change(cogsSelect, { target: { value: 'acc-cogs' } });

    const inventorySelect = screen.getByLabelText(/Inventory Account/i);
    fireEvent.change(inventorySelect, { target: { value: 'acc-inventory' } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /Create Link/i });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByText(/Product link created successfully/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify link created in database
    const links = await db.cpgProductLinks.toArray();
    expect(links.length).toBe(1);
    expect(links[0].cpg_category_id).toBe('cat-oil');
    expect(links[0].cpg_variant).toBe('8oz');
  });

  it('should display existing links in table', async () => {
    // Create a link first
    await db.cpgProductLinks.add({
      id: 'link-1',
      company_id: testCompanyId,
      cpg_category_id: 'cat-oil',
      cpg_variant: '8oz',
      product_id: 'prod-oil',
      account_id_cogs: 'acc-cogs',
      account_id_inventory: 'acc-inventory',
      notes: null,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    });

    render(<ProductLinkingManager companyId={testCompanyId} categories={testCategories} />);

    await waitFor(() => {
      expect(screen.getByText('Oil')).toBeInTheDocument();
      expect(screen.getByText('8oz')).toBeInTheDocument();
      expect(screen.getByText('Olive Oil')).toBeInTheDocument();
      expect(screen.getByText(/OIL-001/i)).toBeInTheDocument();
      expect(screen.getByText('Cost of Goods Sold')).toBeInTheDocument();
      expect(screen.getByText('Inventory')).toBeInTheDocument();
    });
  });

  it('should delete link when delete button clicked', async () => {
    // Create a link first
    await db.cpgProductLinks.add({
      id: 'link-1',
      company_id: testCompanyId,
      cpg_category_id: 'cat-oil',
      cpg_variant: '8oz',
      product_id: 'prod-oil',
      account_id_cogs: 'acc-cogs',
      account_id_inventory: 'acc-inventory',
      notes: null,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    });

    // Mock confirm dialog
    global.confirm = vi.fn(() => true);

    render(<ProductLinkingManager companyId={testCompanyId} categories={testCategories} />);

    await waitFor(() => {
      const deleteButton = screen.getByText('Delete');
      expect(deleteButton).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/Product link deleted successfully/i)).toBeInTheDocument();
    });

    // Verify link soft-deleted in database
    const link = await db.cpgProductLinks.get('link-1');
    expect(link?.deleted_at).not.toBeNull();
    expect(link?.active).toBe(false);
  });

  it('should validate required fields', async () => {
    render(<ProductLinkingManager companyId={testCompanyId} categories={testCategories} />);

    await waitFor(() => {
      const createButton = screen.getByText('+ Create Link');
      fireEvent.click(createButton);
    });

    // Try to submit without filling fields
    const submitButton = screen.getByRole('button', { name: /Create Link/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Please select a category/i)).toBeInTheDocument();
    });
  });

  it('should prevent duplicate links', async () => {
    // Create existing link
    await db.cpgProductLinks.add({
      id: 'link-1',
      company_id: testCompanyId,
      cpg_category_id: 'cat-oil',
      cpg_variant: '8oz',
      product_id: 'prod-oil',
      account_id_cogs: 'acc-cogs',
      account_id_inventory: 'acc-inventory',
      notes: null,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { [testDeviceId]: 1 },
    });

    render(<ProductLinkingManager companyId={testCompanyId} categories={testCategories} />);

    await waitFor(() => {
      const createButton = screen.getByText('+ Create Link');
      fireEvent.click(createButton);
    });

    // Try to create duplicate
    const categorySelect = screen.getByLabelText(/CPG Category/i);
    fireEvent.change(categorySelect, { target: { value: 'cat-oil' } });

    await waitFor(() => {
      const variantSelect = screen.getByLabelText(/Variant/i);
      fireEvent.change(variantSelect, { target: { value: '8oz' } });
    });

    const productSelect = screen.getByLabelText(/Product.*SKU/i);
    fireEvent.change(productSelect, { target: { value: 'prod-oil' } });

    const cogsSelect = screen.getByLabelText(/COGS Account/i);
    fireEvent.change(cogsSelect, { target: { value: 'acc-cogs' } });

    const inventorySelect = screen.getByLabelText(/Inventory Account/i);
    fireEvent.change(inventorySelect, { target: { value: 'acc-inventory' } });

    const submitButton = screen.getByRole('button', { name: /Create Link/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });
});
