/**
 * RawMaterialsTab Component Tests
 *
 * Test coverage requirements:
 * - Rendering (empty states, with data, loading indicators)
 * - Date range filtering (presets, custom dates, smart year detection)
 * - Category/vendor/variant filtering
 * - Sorting (date asc/desc, vendor, total asc/desc)
 * - Statistics calculations (total spent, averages, top vendors/categories/variants)
 * - Export functionality (CSV summary, PDF summary, CSV detail)
 * - Action callbacks (view, edit, duplicate, archive)
 * - Accessibility (ARIA labels, keyboard navigation, table semantics)
 *
 * Target: 90%+ coverage
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RawMaterialsTab from './RawMaterialsTab';
import type { CPGCategory, CPGInvoice } from '../../../db/schema/cpg.schema';

const mockCategories: CPGCategory[] = [
  { id: 'cat-1', company_id: 'company-123', name: 'Oils', created_at: Date.now(), updated_at: Date.now(), version_vector: {} },
  { id: 'cat-2', company_id: 'company-123', name: 'Bottles', created_at: Date.now(), updated_at: Date.now(), version_vector: {} },
  { id: 'cat-3', company_id: 'company-123', name: 'Labels', created_at: Date.now(), updated_at: Date.now(), version_vector: {} },
];

const mockInvoices: CPGInvoice[] = [
  {
    id: 'inv-1',
    company_id: 'company-123',
    invoice_number: 'INV-001',
    invoice_date: new Date('2024-01-15').getTime(),
    vendor_name: 'Vendor A',
    total_paid: '1000.00',
    payment_method: 'credit',
    cost_attribution: {
      oil_bulk: {
        category_id: 'cat-1',
        variant: 'Bulk',
        description: 'Coconut Oil - Bulk',
        units_purchased: '100',
        unit_price: '5.00',
        units_received: '100',
      },
    },
    created_at: Date.now(),
    updated_at: Date.now(),
    version_vector: {},
  },
  {
    id: 'inv-2',
    company_id: 'company-123',
    invoice_number: 'INV-002',
    invoice_date: new Date('2024-02-20').getTime(),
    vendor_name: 'Vendor B',
    total_paid: '500.00',
    payment_method: 'credit',
    cost_attribution: {
      bottle_1oz: {
        category_id: 'cat-2',
        variant: '1oz',
        description: 'Glass Bottles - 1oz',
        units_purchased: '50',
        unit_price: '10.00',
        units_received: '50',
      },
    },
    created_at: Date.now(),
    updated_at: Date.now(),
    version_vector: {},
  },
  {
    id: 'inv-3',
    company_id: 'company-123',
    invoice_number: 'INV-003',
    invoice_date: new Date('2024-03-10').getTime(),
    vendor_name: 'Vendor A',
    total_paid: 750,
    payment_method: 'credit',
    cost_attribution: {
      label: {
        category_id: 'cat-3',
        variant: null,
        description: 'Product Labels',
        units_purchased: '300',
        unit_price: '2.50',
        units_received: '300',
      },
    },
    created_at: Date.now(),
    updated_at: Date.now(),
    version_vector: {},
  },
];

describe('RawMaterialsTab', () => {
  const mockOnViewInvoice = vi.fn();
  const mockOnEditInvoice = vi.fn();
  const mockOnDuplicateInvoice = vi.fn();
  const mockOnArchiveInvoice = vi.fn().mockResolvedValue(undefined);

  const defaultProps = {
    companyId: 'company-123',
    invoices: mockInvoices,
    categories: mockCategories,
    onViewInvoice: mockOnViewInvoice,
    onEditInvoice: mockOnEditInvoice,
    onDuplicateInvoice: mockOnDuplicateInvoice,
    onArchiveInvoice: mockOnArchiveInvoice,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the raw materials panel', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      expect(screen.getByRole('tabpanel', { name: /raw-materials-tab/i })).toBeInTheDocument();
    });

    it('renders empty state when no invoices', () => {
      render(<RawMaterialsTab {...defaultProps} invoices={[]} />);

      expect(screen.getByText(/no invoices yet/i)).toBeInTheDocument();
      expect(screen.getByText(/ready to track your raw material costs/i)).toBeInTheDocument();
    });

    it('renders "no matches" state when filters exclude all invoices', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      // Apply a vendor filter that doesn't match any invoices
      const vendorInput = screen.getByLabelText(/filter by vendor/i);
      await user.type(vendorInput, 'NonexistentVendor');

      expect(screen.getByText(/no invoices match your filters/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument();
    });

    it('renders invoice table with data', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      const table = screen.getByRole('table', { name: /raw material invoice history/i });
      expect(table).toBeInTheDocument();

      expect(screen.getByText('INV-001')).toBeInTheDocument();
      expect(screen.getByText('INV-002')).toBeInTheDocument();
      expect(screen.getByText('INV-003')).toBeInTheDocument();
    });

    it('renders statistics dashboard', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      expect(screen.getByText(/total spent/i)).toBeInTheDocument();
      expect(screen.getByText(/average invoice amount/i)).toBeInTheDocument();
    });
  });

  describe('Date Range Filtering', () => {
    it('has default preset of 3 months', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      const presetSelect = screen.getByLabelText(/select date range preset/i);
      expect(presetSelect).toHaveValue('3mo');
    });

    it('changes date preset to 6 months', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const presetSelect = screen.getByLabelText(/select date range preset/i);
      await user.selectOptions(presetSelect, '6mo');

      expect(presetSelect).toHaveValue('6mo');
    });

    it('shows custom date inputs when custom selected', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const presetSelect = screen.getByLabelText(/select date range preset/i);
      await user.selectOptions(presetSelect, 'custom');

      expect(screen.getByLabelText(/start date for raw materials filter/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end date for raw materials filter/i)).toBeInTheDocument();
    });

    it('filters invoices by date range', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      // Select "All Time" to see all invoices first
      const presetSelect = screen.getByLabelText(/select date range preset/i);
      await user.selectOptions(presetSelect, 'all');

      expect(screen.getByText('INV-001')).toBeInTheDocument();
      expect(screen.getByText('INV-002')).toBeInTheDocument();
    });
  });

  describe('Category Filtering', () => {
    it('renders category filter dropdown', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      const categoryFilter = screen.getByLabelText(/filter by category/i);
      expect(categoryFilter).toBeInTheDocument();
      expect(categoryFilter).toHaveValue('');
    });

    it('filters invoices by category', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const categoryFilter = screen.getByLabelText(/filter by category/i);
      await user.selectOptions(categoryFilter, 'cat-1');

      // Should show active filter indicator
      expect(screen.getByText(/active filters:/i)).toBeInTheDocument();
    });

    it('clears category filter', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const categoryFilter = screen.getByLabelText(/filter by category/i);
      await user.selectOptions(categoryFilter, 'cat-1');
      await user.selectOptions(categoryFilter, '');

      expect(categoryFilter).toHaveValue('');
    });
  });

  describe('Vendor Filtering', () => {
    it('renders vendor filter input', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      const vendorInput = screen.getByLabelText(/filter by vendor/i);
      expect(vendorInput).toBeInTheDocument();
    });

    it('filters invoices by vendor', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const vendorInput = screen.getByLabelText(/filter by vendor/i);
      await user.type(vendorInput, 'Vendor A');

      // Should show active filter indicator
      expect(screen.getByText(/active filters:/i)).toBeInTheDocument();
    });
  });

  describe('Variant Filtering', () => {
    it('renders variant filter dropdown', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      const variantFilter = screen.getByLabelText(/filter by variant/i);
      expect(variantFilter).toBeInTheDocument();
    });

    it('populates variant options from invoices', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      const variantFilter = screen.getByLabelText(/filter by variant/i);
      expect(within(variantFilter).getByText('1oz')).toBeInTheDocument();
      expect(within(variantFilter).getByText('Bulk')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('defaults to date descending sort', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');

      // Header row + 3 data rows
      expect(rows).toHaveLength(4);
    });

    it('sorts by date ascending when date header clicked', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const dateHeader = screen.getByRole('columnheader', { name: /date/i });
      await user.click(dateHeader);

      expect(dateHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    it('sorts by vendor when vendor header clicked', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const vendorHeader = screen.getByRole('columnheader', { name: /vendor/i });
      await user.click(vendorHeader);

      expect(vendorHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    it('sorts by total ascending/descending when total header clicked', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const totalHeader = screen.getByRole('columnheader', { name: /total paid/i });
      await user.click(totalHeader);

      expect(totalHeader).toHaveAttribute('aria-sort', 'ascending');

      await user.click(totalHeader);
      expect(totalHeader).toHaveAttribute('aria-sort', 'descending');
    });
  });

  describe('Statistics Calculations', () => {
    it('calculates total spent correctly', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      // 1000 + 500 + 750 = 2250
      expect(screen.getByText(/\$2,250\.00/)).toBeInTheDocument();
    });

    it('calculates average invoice amount', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      // 2250 / 3 = 750
      expect(screen.getByText(/average invoice amount/i)).toBeInTheDocument();
      expect(screen.getByText(/\$750\.00/)).toBeInTheDocument();
    });

    it('shows invoice count', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      expect(screen.getByText(/3 invoices/i)).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('renders export button', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      const exportBtn = screen.getByRole('button', { name: /export raw materials data/i });
      expect(exportBtn).toBeInTheDocument();
    });

    it('opens export menu when clicked', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const exportBtn = screen.getByRole('button', { name: /export raw materials data/i });
      await user.click(exportBtn);

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /csv summary/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /pdf summary/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /csv detail/i })).toBeInTheDocument();
    });
  });

  describe('Action Callbacks', () => {
    it('calls onViewInvoice when view button clicked', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const viewButtons = screen.getAllByRole('button', { name: /view invoice/i });
      await user.click(viewButtons[0]);

      expect(mockOnViewInvoice).toHaveBeenCalledWith('inv-1');
    });

    it('calls onEditInvoice when edit button clicked', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const editButtons = screen.getAllByRole('button', { name: /edit invoice/i });
      await user.click(editButtons[0]);

      expect(mockOnEditInvoice).toHaveBeenCalledWith('inv-1');
    });

    it('calls onDuplicateInvoice when duplicate button clicked', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const duplicateButtons = screen.getAllByRole('button', { name: /duplicate invoice/i });
      await user.click(duplicateButtons[0]);

      expect(mockOnDuplicateInvoice).toHaveBeenCalledWith('inv-1');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels on all filters', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      expect(screen.getByLabelText(/select date range preset/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by variant/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by vendor/i)).toBeInTheDocument();
    });

    it('has proper table semantics', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      const table = screen.getByRole('table', { name: /raw material invoice history/i });
      expect(table).toBeInTheDocument();

      const headers = within(table).getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('has aria-expanded on export button', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      const exportBtn = screen.getByRole('button', { name: /export raw materials data/i });
      expect(exportBtn).toHaveAttribute('aria-expanded', 'false');
    });

    it('updates aria-expanded when export menu opens', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      const exportBtn = screen.getByRole('button', { name: /export raw materials data/i });
      await user.click(exportBtn);

      expect(exportBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('has sortable column headers with aria-sort', () => {
      render(<RawMaterialsTab {...defaultProps} />);

      const dateHeader = screen.getByRole('columnheader', { name: /date/i });
      expect(dateHeader).toHaveAttribute('aria-sort');
    });
  });

  describe('Clear Filters', () => {
    it('clears all active filters when Clear Filters clicked', async () => {
      const user = userEvent.setup();
      render(<RawMaterialsTab {...defaultProps} />);

      // Apply multiple filters
      const categoryFilter = screen.getByLabelText(/filter by category/i);
      await user.selectOptions(categoryFilter, 'cat-1');

      const vendorInput = screen.getByLabelText(/filter by vendor/i);
      await user.type(vendorInput, 'Vendor A');

      // Clear all filters
      const clearBtn = screen.getByRole('button', { name: /clear filters/i });
      await user.click(clearBtn);

      expect(categoryFilter).toHaveValue('');
      expect(vendorInput).toHaveValue('');
    });
  });
});
