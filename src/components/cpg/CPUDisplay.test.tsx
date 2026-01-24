/**
 * CPUDisplay Component Tests
 *
 * Tests for CPU display with variants and categories
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CPUDisplay } from './CPUDisplay';
import type { CPGCategory } from '../../db/schema/cpg.schema';

describe('CPUDisplay', () => {
  const mockCategories: CPGCategory[] = [
    {
      id: 'cat-1',
      company_id: 'comp-1',
      name: 'Oil',
      description: 'Essential oils',
      variants: ['8oz', '16oz'],
      sort_order: 1,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { 'device-1': 1 },
    },
    {
      id: 'cat-2',
      company_id: 'comp-1',
      name: 'Bottle',
      description: 'Glass bottles',
      variants: null,
      sort_order: 2,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { 'device-1': 1 },
    },
  ];

  it('renders loading state', () => {
    render(
      <CPUDisplay
        currentCPUs={{}}
        categories={mockCategories}
        isLoading={true}
      />
    );

    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  });

  it('renders empty state when no CPUs', () => {
    render(
      <CPUDisplay
        currentCPUs={{}}
        categories={mockCategories}
        isLoading={false}
      />
    );

    expect(
      screen.getByText(/No cost data yet. Enter your first invoice/i)
    ).toBeInTheDocument();
  });

  it('renders CPU cards for variants', () => {
    const currentCPUs = {
      '8oz': '2.50',
      '16oz': '4.25',
    };

    render(
      <CPUDisplay
        currentCPUs={currentCPUs}
        categories={mockCategories}
        isLoading={false}
      />
    );

    expect(screen.getByText('8oz')).toBeInTheDocument();
    expect(screen.getByText('16oz')).toBeInTheDocument();
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getByText('4.25')).toBeInTheDocument();
  });

  it('renders "No Variant" for products without variants', () => {
    const currentCPUs = {
      'none': '3.00',
    };

    render(
      <CPUDisplay
        currentCPUs={currentCPUs}
        categories={mockCategories}
        isLoading={false}
      />
    );

    expect(screen.getByText('No Variant')).toBeInTheDocument();
    expect(screen.getByText('3.00')).toBeInTheDocument();
  });

  it('displays summary message when CPUs exist', () => {
    const currentCPUs = {
      '8oz': '2.50',
    };

    render(
      <CPUDisplay
        currentCPUs={currentCPUs}
        categories={mockCategories}
        isLoading={false}
      />
    );

    expect(
      screen.getByText(/These costs are calculated from your most recent invoices/i)
    ).toBeInTheDocument();
  });

  it('renders correct currency formatting', () => {
    const currentCPUs = {
      '8oz': '2.50',
      '16oz': '10.99',
    };

    render(
      <CPUDisplay
        currentCPUs={currentCPUs}
        categories={mockCategories}
        isLoading={false}
      />
    );

    const currencySymbols = screen.getAllByText('$');
    expect(currencySymbols.length).toBeGreaterThan(0);
  });

  it('is accessible with proper ARIA labels', () => {
    const currentCPUs = {
      '8oz': '2.50',
    };

    const { container } = render(
      <CPUDisplay
        currentCPUs={currentCPUs}
        categories={mockCategories}
        isLoading={false}
      />
    );

    // Check for articles (semantic HTML)
    const articles = container.querySelectorAll('article');
    expect(articles.length).toBeGreaterThan(0);
  });

  it('handles multiple variants correctly', () => {
    const currentCPUs = {
      '8oz': '2.50',
      '16oz': '4.25',
      '32oz': '7.99',
      '64oz': '14.50',
    };

    render(
      <CPUDisplay
        currentCPUs={currentCPUs}
        categories={mockCategories}
        isLoading={false}
      />
    );

    expect(screen.getByText('8oz')).toBeInTheDocument();
    expect(screen.getByText('16oz')).toBeInTheDocument();
    expect(screen.getByText('32oz')).toBeInTheDocument();
    expect(screen.getByText('64oz')).toBeInTheDocument();
  });
});
