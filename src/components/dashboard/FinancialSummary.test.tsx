/**
 * Tests for FinancialSummary Component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinancialSummary } from './FinancialSummary';

describe('FinancialSummary Component', () => {
  describe('rendering', () => {
    it('should render with profitable metrics', () => {
      render(
        <FinancialSummary
          revenue="10000.00"
          expenses="6000.00"
          netProfit="4000.00"
          isProfitable={true}
        />
      );

      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('Expenses')).toBeInTheDocument();
      expect(screen.getByText('Net Profit')).toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
      expect(screen.getByText('$6,000.00')).toBeInTheDocument();
      expect(screen.getByText('$4,000.00')).toBeInTheDocument();
    });

    it('should render with loss metrics', () => {
      render(
        <FinancialSummary
          revenue="5000.00"
          expenses="8000.00"
          netProfit="-3000.00"
          isProfitable={false}
        />
      );

      expect(screen.getByText('Net Loss')).toBeInTheDocument();
      expect(screen.getByText('-$3,000.00')).toBeInTheDocument();
    });

    it('should render with custom period', () => {
      render(
        <FinancialSummary
          revenue="0.00"
          expenses="0.00"
          netProfit="0.00"
          isProfitable={false}
          period="Last Month"
        />
      );

      expect(screen.getByText('Last Month')).toBeInTheDocument();
    });

    it('should show profitability message when profitable', () => {
      render(
        <FinancialSummary
          revenue="10000.00"
          expenses="6000.00"
          netProfit="4000.00"
          isProfitable={true}
        />
      );

      expect(screen.getByText(/Great work! You're profitable/)).toBeInTheDocument();
    });

    it('should show loss warning when not profitable', () => {
      render(
        <FinancialSummary
          revenue="5000.00"
          expenses="8000.00"
          netProfit="-3000.00"
          isProfitable={false}
        />
      );

      expect(screen.getByText(/Expenses exceed revenue/)).toBeInTheDocument();
    });

    it('should not show warning when net profit is zero', () => {
      render(
        <FinancialSummary
          revenue="5000.00"
          expenses="5000.00"
          netProfit="0.00"
          isProfitable={false}
        />
      );

      expect(screen.queryByText(/Expenses exceed revenue/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Great work!/)).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton when loading', () => {
      render(
        <FinancialSummary
          revenue="0.00"
          expenses="0.00"
          netProfit="0.00"
          isProfitable={false}
          isLoading
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading financial summary...')).toBeInTheDocument();
    });

    it('should not show content when loading', () => {
      render(
        <FinancialSummary
          revenue="10000.00"
          expenses="6000.00"
          netProfit="4000.00"
          isProfitable={true}
          isLoading
        />
      );

      expect(screen.queryByText('$10,000.00')).not.toBeInTheDocument();
      expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
    });

    it('should have aria-live region when loading', () => {
      render(
        <FinancialSummary
          revenue="0.00"
          expenses="0.00"
          netProfit="0.00"
          isProfitable={false}
          isLoading
        />
      );

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels for values', () => {
      render(
        <FinancialSummary
          revenue="10000.00"
          expenses="6000.00"
          netProfit="4000.00"
          isProfitable={true}
        />
      );

      expect(screen.getByLabelText('Revenue: $10,000.00')).toBeInTheDocument();
      expect(screen.getByLabelText('Expenses: $6,000.00')).toBeInTheDocument();
      expect(screen.getByLabelText('Net Profit: $4,000.00')).toBeInTheDocument();
    });

    it('should have role separator for divider', () => {
      render(
        <FinancialSummary
          revenue="10000.00"
          expenses="6000.00"
          netProfit="4000.00"
          isProfitable={true}
        />
      );

      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('should have status role for messages', () => {
      render(
        <FinancialSummary
          revenue="10000.00"
          expenses="6000.00"
          netProfit="4000.00"
          isProfitable={true}
        />
      );

      const statusMessages = screen.getAllByRole('status');
      expect(statusMessages.length).toBeGreaterThan(0);
    });

    it('should hide icons from screen readers', () => {
      const { container } = render(
        <FinancialSummary
          revenue="10000.00"
          expenses="6000.00"
          netProfit="4000.00"
          isProfitable={true}
        />
      );

      const icon = container.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('formatting', () => {
    it('should format large numbers with commas', () => {
      render(
        <FinancialSummary
          revenue="1234567.89"
          expenses="987654.32"
          netProfit="246913.57"
          isProfitable={true}
        />
      );

      expect(screen.getByText('$1,234,567.89')).toBeInTheDocument();
      expect(screen.getByText('$987,654.32')).toBeInTheDocument();
      expect(screen.getByText('$246,913.57')).toBeInTheDocument();
    });

    it('should format zero correctly', () => {
      render(
        <FinancialSummary
          revenue="0.00"
          expenses="0.00"
          netProfit="0.00"
          isProfitable={false}
        />
      );

      const zeroValues = screen.getAllByText('$0.00');
      expect(zeroValues).toHaveLength(3);
    });

    it('should format negative numbers correctly', () => {
      render(
        <FinancialSummary
          revenue="1000.00"
          expenses="2000.00"
          netProfit="-1000.00"
          isProfitable={false}
        />
      );

      expect(screen.getByText('-$1,000.00')).toBeInTheDocument();
    });
  });

  describe('custom props', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <FinancialSummary
          revenue="10000.00"
          expenses="6000.00"
          netProfit="4000.00"
          isProfitable={true}
          className="custom-class"
        />
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv.className).toContain('custom-class');
    });
  });

  describe('edge cases', () => {
    it('should handle very small amounts', () => {
      render(
        <FinancialSummary
          revenue="0.01"
          expenses="0.01"
          netProfit="0.00"
          isProfitable={false}
        />
      );

      const amounts = screen.getAllByText('$0.01');
      expect(amounts).toHaveLength(2); // Revenue and Expenses
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle decimal precision', () => {
      render(
        <FinancialSummary
          revenue="100.99"
          expenses="50.49"
          netProfit="50.50"
          isProfitable={true}
        />
      );

      expect(screen.getByText('$100.99')).toBeInTheDocument();
      expect(screen.getByText('$50.49')).toBeInTheDocument();
      expect(screen.getByText('$50.50')).toBeInTheDocument();
    });

    it('should handle equal revenue and expenses', () => {
      render(
        <FinancialSummary
          revenue="5000.00"
          expenses="5000.00"
          netProfit="0.00"
          isProfitable={false}
        />
      );

      expect(screen.getByText('Net Loss')).toBeInTheDocument();
      const amounts = screen.getAllByText('$5,000.00');
      expect(amounts).toHaveLength(2); // Revenue and Expenses both $5,000
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });
  });

  describe('integration', () => {
    it('should render complete summary with all features', () => {
      render(
        <FinancialSummary
          revenue="15432.50"
          expenses="9876.25"
          netProfit="5556.25"
          isProfitable={true}
          period="January 2024"
          className="custom-summary"
        />
      );

      expect(screen.getByText('January 2024')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('Expenses')).toBeInTheDocument();
      expect(screen.getByText('Net Profit')).toBeInTheDocument();
      expect(screen.getByText('$15,432.50')).toBeInTheDocument();
      expect(screen.getByText('$9,876.25')).toBeInTheDocument();
      expect(screen.getByText('$5,556.25')).toBeInTheDocument();
      expect(screen.getByText(/Great work!/)).toBeInTheDocument();
    });

    it('should handle transition from loading to loaded', () => {
      const { rerender } = render(
        <FinancialSummary
          revenue="0.00"
          expenses="0.00"
          netProfit="0.00"
          isProfitable={false}
          isLoading
        />
      );

      expect(screen.getByText('Loading financial summary...')).toBeInTheDocument();

      rerender(
        <FinancialSummary
          revenue="10000.00"
          expenses="6000.00"
          netProfit="4000.00"
          isProfitable={true}
          isLoading={false}
        />
      );

      expect(screen.queryByText('Loading financial summary...')).not.toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    });
  });
});
