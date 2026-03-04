/**
 * ProductsTab Component Tests
 *
 * Test coverage requirements:
 * - Rendering (empty state, with data, loading state)
 * - Product selection (multi-select, select all, clear all)
 * - Filtering (status filter: all, complete, incomplete)
 * - Sorting (name, cpu-asc, cpu-desc, missing)
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Integration with CPUDisplay
 *
 * Target: 90%+ coverage
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductsTab from './ProductsTab';

// Mock CPUDisplay component
vi.mock('../../../components/cpg/CPUDisplay', () => ({
  CPUDisplay: ({ isLoading, selectedProducts, statusFilter, sortBy }: any) => (
    <div data-testid="cpu-display">
      <span data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</span>
      <span data-testid="selected-count">{selectedProducts.size}</span>
      <span data-testid="status-filter">{statusFilter}</span>
      <span data-testid="sort-by">{sortBy}</span>
    </div>
  ),
}));

const mockFinishedProducts = [
  { id: 'prod-1', name: 'Product A' },
  { id: 'prod-2', name: 'Product B' },
  { id: 'prod-3', name: 'Product C' },
];

describe('ProductsTab', () => {
  describe('Rendering', () => {
    it('renders the Products tab heading', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      expect(screen.getByRole('heading', { name: /product costs/i })).toBeInTheDocument();
    });

    it('renders with empty products list', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={[]}
          isLoading={false}
        />
      );

      const selector = screen.getByRole('button', { name: /select products/i });
      expect(selector).toHaveTextContent('All Products');
    });

    it('renders with products', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      expect(screen.getByRole('button', { name: /select products/i })).toBeInTheDocument();
    });

    it('passes loading state to CPUDisplay', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={true}
        />
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    });
  });

  describe('Product Selection', () => {
    it('shows "All Products" when no selection', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const selector = screen.getByRole('button', { name: /select products/i });
      expect(selector).toHaveTextContent('All Products');
    });

    it('opens dropdown when selector clicked', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const selector = screen.getByRole('button', { name: /select products/i });
      await user.click(selector);

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select all products/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear all product selections/i })).toBeInTheDocument();
    });

    it('displays all products in dropdown', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const selector = screen.getByRole('button', { name: /select products/i });
      await user.click(selector);

      expect(screen.getByLabelText(/select product a/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select product b/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select product c/i)).toBeInTheDocument();
    });

    it('selects individual product', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const selector = screen.getByRole('button', { name: /select products/i });
      await user.click(selector);

      const checkbox = screen.getByLabelText(/select product a/i);
      await user.click(checkbox);

      expect(selector).toHaveTextContent('1 Product Selected');
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
    });

    it('selects multiple products', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const selector = screen.getByRole('button', { name: /select products/i });
      await user.click(selector);

      await user.click(screen.getByLabelText(/select product a/i));
      await user.click(screen.getByLabelText(/select product b/i));

      expect(selector).toHaveTextContent('2 Products Selected');
      expect(screen.getByTestId('selected-count')).toHaveTextContent('2');
    });

    it('deselects product', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const selector = screen.getByRole('button', { name: /select products/i });
      await user.click(selector);

      const checkbox = screen.getByLabelText(/select product a/i);
      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
      expect(selector).toHaveTextContent('All Products');
    });

    it('selects all products', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const selector = screen.getByRole('button', { name: /select products/i });
      await user.click(selector);

      const selectAllBtn = screen.getByRole('button', { name: /select all products/i });
      await user.click(selectAllBtn);

      expect(selector).toHaveTextContent('All Products Selected');
      expect(screen.getByTestId('selected-count')).toHaveTextContent('3');
    });

    it('clears all selections', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const selector = screen.getByRole('button', { name: /select products/i });
      await user.click(selector);

      // Select all first
      await user.click(screen.getByRole('button', { name: /select all products/i }));
      expect(screen.getByTestId('selected-count')).toHaveTextContent('3');

      // Clear all
      await user.click(screen.getByRole('button', { name: /clear all product selections/i }));
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
      expect(selector).toHaveTextContent('All Products');
    });
  });

  describe('Status Filtering', () => {
    it('renders status filter dropdown', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const filter = screen.getByRole('combobox', { name: /filter by completion status/i });
      expect(filter).toBeInTheDocument();
      expect(filter).toHaveValue('all');
    });

    it('changes status filter to complete', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const filter = screen.getByRole('combobox', { name: /filter by completion status/i });
      await user.selectOptions(filter, 'complete');

      expect(filter).toHaveValue('complete');
      expect(screen.getByTestId('status-filter')).toHaveTextContent('complete');
    });

    it('changes status filter to incomplete', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const filter = screen.getByRole('combobox', { name: /filter by completion status/i });
      await user.selectOptions(filter, 'incomplete');

      expect(filter).toHaveValue('incomplete');
      expect(screen.getByTestId('status-filter')).toHaveTextContent('incomplete');
    });

    it('resets status filter to all', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const filter = screen.getByRole('combobox', { name: /filter by completion status/i });
      await user.selectOptions(filter, 'complete');
      await user.selectOptions(filter, 'all');

      expect(filter).toHaveValue('all');
      expect(screen.getByTestId('status-filter')).toHaveTextContent('all');
    });
  });

  describe('Sorting', () => {
    it('renders sort dropdown', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const sort = screen.getByRole('combobox', { name: /sort products/i });
      expect(sort).toBeInTheDocument();
      expect(sort).toHaveValue('name');
    });

    it('changes sort to CPU ascending', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const sort = screen.getByRole('combobox', { name: /sort products/i });
      await user.selectOptions(sort, 'cpu-asc');

      expect(sort).toHaveValue('cpu-asc');
      expect(screen.getByTestId('sort-by')).toHaveTextContent('cpu-asc');
    });

    it('changes sort to CPU descending', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const sort = screen.getByRole('combobox', { name: /sort products/i });
      await user.selectOptions(sort, 'cpu-desc');

      expect(sort).toHaveValue('cpu-desc');
      expect(screen.getByTestId('sort-by')).toHaveTextContent('cpu-desc');
    });

    it('changes sort to missing components', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const sort = screen.getByRole('combobox', { name: /sort products/i });
      await user.selectOptions(sort, 'missing');

      expect(sort).toHaveValue('missing');
      expect(screen.getByTestId('sort-by')).toHaveTextContent('missing');
    });
  });

  describe('CPUDisplay Integration', () => {
    it('renders CPUDisplay component', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      expect(screen.getByTestId('cpu-display')).toBeInTheDocument();
    });

    it('passes correct props to CPUDisplay', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={true}
        />
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
      expect(screen.getByTestId('status-filter')).toHaveTextContent('all');
      expect(screen.getByTestId('sort-by')).toHaveTextContent('name');
    });

    it('updates CPUDisplay when filters change', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const statusFilter = screen.getByRole('combobox', { name: /filter by completion status/i });
      const sortBy = screen.getByRole('combobox', { name: /sort products/i });

      await user.selectOptions(statusFilter, 'complete');
      await user.selectOptions(sortBy, 'cpu-desc');

      expect(screen.getByTestId('status-filter')).toHaveTextContent('complete');
      expect(screen.getByTestId('sort-by')).toHaveTextContent('cpu-desc');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels on product selector', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const selector = screen.getByRole('button', { name: /select products to display/i });
      expect(selector).toHaveAttribute('aria-expanded', 'false');
    });

    it('updates aria-expanded when dropdown opens', async () => {
      const user = userEvent.setup();
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const selector = screen.getByRole('button', { name: /select products to display/i });
      await user.click(selector);

      expect(selector).toHaveAttribute('aria-expanded', 'true');
    });

    it('has ARIA labels on all controls', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      expect(screen.getByRole('button', { name: /select products to display/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /filter by completion status/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /sort products/i })).toBeInTheDocument();
    });

    it('has proper heading hierarchy', () => {
      render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const heading = screen.getByRole('heading', { name: /product costs/i });
      expect(heading.tagName).toBe('H2');
      expect(heading).toHaveAttribute('id', 'current-cpu-heading');
    });

    it('has proper tab panel role', () => {
      const { container } = render(
        <ProductsTab
          companyId="company-123"
          finishedProducts={mockFinishedProducts}
          isLoading={false}
        />
      );

      const tabPanel = container.querySelector('[role="tabpanel"]');
      expect(tabPanel).toBeInTheDocument();
      expect(tabPanel).toHaveAttribute('id', 'products-panel');
      expect(tabPanel).toHaveAttribute('aria-labelledby', 'products-tab');
    });
  });
});
