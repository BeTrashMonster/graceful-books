/**
 * Cash Position Widget Tests
 *
 * Comprehensive tests for CashPositionWidget component
 * Requirements: F1 - Dashboard (Full Featured)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CashPositionWidget } from './CashPositionWidget';
import type { CashPositionData } from './CashPositionWidget';

describe('CashPositionWidget', () => {
  const mockData: CashPositionData = {
    currentBalance: 10000,
    monthlyExpenses: 3000,
    trend: [
      { date: '2026-01-01', balance: 8000 },
      { date: '2026-01-08', balance: 9000 },
      { date: '2026-01-15', balance: 10000 },
    ],
  };

  describe('rendering', () => {
    it('should render cash position data', () => {
      render(<CashPositionWidget data={mockData} />);

      expect(screen.getByText('Cash Position')).toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    });

    it('should display months covered calculation', () => {
      render(<CashPositionWidget data={mockData} />);

      // 10000 / 3000 = 3.33 months
      expect(screen.getByText(/3.3 months/i)).toBeInTheDocument();
    });

    it('should show encouraging message for good cash position', () => {
      render(<CashPositionWidget data={mockData} />);

      expect(screen.getByText(/solid/i)).toBeInTheDocument();
    });

    it('should render trend chart', () => {
      const { container } = render(<CashPositionWidget data={mockData} />);

      // Check for chart container
      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton when loading', () => {
      render(<CashPositionWidget data={mockData} isLoading />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading cash position...')).toBeInTheDocument();
    });

    it('should not show content when loading', () => {
      render(<CashPositionWidget data={mockData} isLoading />);

      expect(screen.queryByText('$10,000.00')).not.toBeInTheDocument();
    });

    it('should have aria-live region when loading', () => {
      render(<CashPositionWidget data={mockData} isLoading />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('months covered scenarios', () => {
    it('should show encouraging message for zero balance', () => {
      const zeroData: CashPositionData = {
        currentBalance: 0,
        monthlyExpenses: 3000,
        trend: [],
      };

      render(<CashPositionWidget data={zeroData} />);

      expect(screen.getByText(/building up your cash position/i)).toBeInTheDocument();
    });

    it('should show message for less than 1 month', () => {
      const lowData: CashPositionData = {
        currentBalance: 2000,
        monthlyExpenses: 3000,
        trend: [],
      };

      render(<CashPositionWidget data={lowData} />);

      expect(screen.getByText(/building momentum/i)).toBeInTheDocument();
    });

    it('should show message for 1-2 months', () => {
      const oneMonthData: CashPositionData = {
        currentBalance: 4500,
        monthlyExpenses: 3000,
        trend: [],
      };

      render(<CashPositionWidget data={oneMonthData} />);

      expect(screen.getByText(/good start/i)).toBeInTheDocument();
    });

    it('should show message for 2-3 months', () => {
      const twoMonthsData: CashPositionData = {
        currentBalance: 7500,
        monthlyExpenses: 3000,
        trend: [],
      };

      render(<CashPositionWidget data={twoMonthsData} />);

      expect(screen.getByText(/getting stronger/i)).toBeInTheDocument();
    });

    it('should show message for 3+ months', () => {
      const threeMonthsData: CashPositionData = {
        currentBalance: 10000,
        monthlyExpenses: 3000,
        trend: [],
      };

      render(<CashPositionWidget data={threeMonthsData} />);

      expect(screen.getByText(/solid/i)).toBeInTheDocument();
    });

    it('should handle zero monthly expenses', () => {
      const zeroExpensesData: CashPositionData = {
        currentBalance: 10000,
        monthlyExpenses: 0,
        trend: [],
      };

      render(<CashPositionWidget data={zeroExpensesData} />);

      expect(screen.getByText(/no monthly expenses/i)).toBeInTheDocument();
    });
  });

  describe('formatting', () => {
    it('should format large balances with commas', () => {
      const largeData: CashPositionData = {
        currentBalance: 1234567.89,
        monthlyExpenses: 10000,
        trend: [],
      };

      render(<CashPositionWidget data={largeData} />);

      expect(screen.getByText('$1,234,567.89')).toBeInTheDocument();
    });

    it('should format months covered to one decimal place', () => {
      const data: CashPositionData = {
        currentBalance: 10555,
        monthlyExpenses: 3000,
        trend: [],
      };

      render(<CashPositionWidget data={data} />);

      // 10555 / 3000 = 3.518... should show as 3.5
      expect(screen.getByText(/3.5 months/i)).toBeInTheDocument();
    });

    it('should handle negative balance', () => {
      const negativeData: CashPositionData = {
        currentBalance: -1000,
        monthlyExpenses: 3000,
        trend: [],
      };

      render(<CashPositionWidget data={negativeData} />);

      expect(screen.getByText('-$1,000.00')).toBeInTheDocument();
    });

    it('should format small amounts correctly', () => {
      const smallData: CashPositionData = {
        currentBalance: 0.99,
        monthlyExpenses: 100,
        trend: [],
      };

      render(<CashPositionWidget data={smallData} />);

      expect(screen.getByText('$0.99')).toBeInTheDocument();
    });
  });

  describe('trend visualization', () => {
    it('should display all trend data points', () => {
      const { container } = render(<CashPositionWidget data={mockData} />);

      // Check for line chart
      const lines = container.querySelectorAll('.recharts-line');
      expect(lines.length).toBeGreaterThan(0);
    });

    it('should handle empty trend data', () => {
      const emptyTrendData: CashPositionData = {
        currentBalance: 10000,
        monthlyExpenses: 3000,
        trend: [],
      };

      const { container } = render(<CashPositionWidget data={emptyTrendData} />);

      // Chart should still render but with no data
      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });

    it('should handle single data point in trend', () => {
      const singlePointData: CashPositionData = {
        currentBalance: 10000,
        monthlyExpenses: 3000,
        trend: [{ date: '2026-01-15', balance: 10000 }],
      };

      const { container } = render(<CashPositionWidget data={singlePointData} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels', () => {
      render(<CashPositionWidget data={mockData} />);

      expect(screen.getByLabelText(/current cash balance/i)).toBeInTheDocument();
    });

    it('should have semantic heading', () => {
      render(<CashPositionWidget data={mockData} />);

      const heading = screen.getByRole('heading', { name: /cash position/i });
      expect(heading).toBeInTheDocument();
    });

    it('should hide decorative icons from screen readers', () => {
      const { container } = render(<CashPositionWidget data={mockData} />);

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have status role for messages', () => {
      render(<CashPositionWidget data={mockData} />);

      const statusMessages = screen.getAllByRole('status');
      expect(statusMessages.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very large balances', () => {
      const largeData: CashPositionData = {
        currentBalance: 999999999.99,
        monthlyExpenses: 10000,
        trend: [],
      };

      render(<CashPositionWidget data={largeData} />);

      expect(screen.getByText('$999,999,999.99')).toBeInTheDocument();
    });

    it('should handle very small monthly expenses', () => {
      const data: CashPositionData = {
        currentBalance: 1000,
        monthlyExpenses: 0.01,
        trend: [],
      };

      render(<CashPositionWidget data={data} />);

      // Should show a very large number of months
      expect(screen.getByText(/months/i)).toBeInTheDocument();
    });

    it('should handle trend with varying balances', () => {
      const varyingData: CashPositionData = {
        currentBalance: 10000,
        monthlyExpenses: 3000,
        trend: [
          { date: '2026-01-01', balance: 5000 },
          { date: '2026-01-05', balance: 15000 },
          { date: '2026-01-10', balance: 8000 },
          { date: '2026-01-15', balance: 10000 },
        ],
      };

      const { container } = render(<CashPositionWidget data={varyingData} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });
  });

  describe('custom props', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <CashPositionWidget data={mockData} className="custom-widget" />
      );

      const widget = container.firstChild as HTMLElement;
      expect(widget.className).toContain('custom-widget');
    });
  });

  describe('integration', () => {
    it('should render complete widget with all features', () => {
      render(<CashPositionWidget data={mockData} />);

      expect(screen.getByText('Cash Position')).toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
      expect(screen.getByText(/3.3 months/i)).toBeInTheDocument();
      expect(screen.getByText(/solid/i)).toBeInTheDocument();
    });

    it('should handle transition from loading to loaded', () => {
      const { rerender } = render(
        <CashPositionWidget data={mockData} isLoading />
      );

      expect(screen.getByText('Loading cash position...')).toBeInTheDocument();

      rerender(<CashPositionWidget data={mockData} isLoading={false} />);

      expect(screen.queryByText('Loading cash position...')).not.toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    });
  });
});
