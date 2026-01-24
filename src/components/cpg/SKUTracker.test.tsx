/**
 * SKU Tracker Component Tests
 *
 * Tests for SKU count display and pricing calculation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SKUTracker } from './SKUTracker';

describe('SKUTracker', () => {
  const mockCompanyId = 'test-company-123';

  describe('SKU Count Display', () => {
    it('renders with zero SKUs', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={0} />);

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText("You haven't added any products yet.")).toBeInTheDocument();
    });

    it('renders with one SKU (singular)', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={1} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('SKU')).toBeInTheDocument();
      expect(screen.getByText('You have 1 product SKU.')).toBeInTheDocument();
    });

    it('renders with multiple SKUs (plural)', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={5} />);

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('SKUs')).toBeInTheDocument();
      expect(screen.getByText('You have 5 product SKUs.')).toBeInTheDocument();
    });
  });

  describe('Pricing Calculation', () => {
    it('calculates correct cost for 1 SKU', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={1} />);

      expect(screen.getByText('$5.00')).toBeInTheDocument(); // Base cost
    });

    it('calculates correct cost for 5 SKUs', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={5} />);

      expect(screen.getByText('$25.00')).toBeInTheDocument(); // Base cost
    });

    it('calculates correct cost for 10 SKUs (at cap)', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={10} />);

      expect(screen.getByText('$50.00')).toBeInTheDocument(); // Monthly cost (capped)
    });

    it('caps cost at $50 for 15 SKUs', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={15} />);

      // Base cost would be $75, but should be capped at $50
      expect(screen.getByText('$75.00')).toBeInTheDocument(); // Base cost shown in breakdown
      expect(screen.getByText('-$25.00')).toBeInTheDocument(); // Savings
      expect(screen.getByText('$50.00')).toBeInTheDocument(); // Monthly cost (capped)
    });

    it('caps cost at $50 for 20 SKUs', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={20} />);

      // Base cost would be $100, but should be capped at $50
      expect(screen.getByText('$100.00')).toBeInTheDocument(); // Base cost shown in breakdown
      expect(screen.getByText('-$50.00')).toBeInTheDocument(); // Savings
      expect(screen.getByText('$50.00')).toBeInTheDocument(); // Monthly cost (capped)
    });
  });

  describe('Messaging', () => {
    it('shows "get started" message for zero SKUs', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={0} />);

      expect(
        screen.getByText(/Get started by adding your first product/i)
      ).toBeInTheDocument();
    });

    it('shows pricing info for SKUs below cap', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={5} />);

      expect(
        screen.getByText(/Your cost is \$25.00\/month for 5 SKUs/i)
      ).toBeInTheDocument();
    });

    it('shows cap reached message for 10+ SKUs', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={15} />);

      expect(
        screen.getByText(/Great news! You've reached the monthly cap/i)
      ).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('renders "Add Your First Product" button for zero SKUs', () => {
      const mockOnManage = vi.fn();
      render(
        <SKUTracker
          companyId={mockCompanyId}
          skuCount={0}
          onManageProducts={mockOnManage}
        />
      );

      expect(screen.getByText('Add Your First Product')).toBeInTheDocument();
    });

    it('renders "Manage Products" button for existing SKUs', () => {
      const mockOnManage = vi.fn();
      render(
        <SKUTracker
          companyId={mockCompanyId}
          skuCount={5}
          onManageProducts={mockOnManage}
        />
      );

      expect(screen.getByText('Manage Products')).toBeInTheDocument();
    });

    it('calls onManageProducts when button clicked', async () => {
      const mockOnManage = vi.fn();
      const { getByText } = render(
        <SKUTracker
          companyId={mockCompanyId}
          skuCount={5}
          onManageProducts={mockOnManage}
        />
      );

      const button = getByText('Manage Products');
      button.click();

      expect(mockOnManage).toHaveBeenCalledTimes(1);
    });

    it('does not render button when onManageProducts not provided', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={5} />);

      expect(screen.queryByText('Manage Products')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={5} />);

      expect(screen.getByRole('heading', { level: 3, name: /Your CPG Pricing/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: /How Pricing Works/i })).toBeInTheDocument();
    });

    it('has readable contrast for SKU count', () => {
      const { container } = render(<SKUTracker companyId={mockCompanyId} skuCount={5} />);

      const countCircle = container.querySelector('.countCircle');
      expect(countCircle).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles exactly 10 SKUs (boundary case)', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={10} />);

      expect(screen.getByText('$50.00')).toBeInTheDocument();
      expect(screen.getByText(/Great news! You've reached the monthly cap/i)).toBeInTheDocument();
    });

    it('handles 9 SKUs (just below cap)', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={9} />);

      expect(screen.getByText('$45.00')).toBeInTheDocument();
      expect(screen.queryByText(/Great news! You've reached the monthly cap/i)).not.toBeInTheDocument();
    });

    it('handles very large SKU count', () => {
      render(<SKUTracker companyId={mockCompanyId} skuCount={1000} />);

      // Should still be capped at $50
      expect(screen.getByText('$50.00')).toBeInTheDocument();
    });
  });
});
