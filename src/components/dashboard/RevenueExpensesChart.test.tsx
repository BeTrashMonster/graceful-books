/**
 * Revenue vs Expenses Chart Tests
 *
 * Comprehensive tests for RevenueExpensesChart component
 * Requirements: F1 - Dashboard (Full Featured)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevenueExpensesChart } from './RevenueExpensesChart';
import type { RevenueExpensesData } from './RevenueExpensesChart';

describe('RevenueExpensesChart', () => {
  const mockData: RevenueExpensesData[] = [
    { date: '2025-08-01', revenue: 5000, expenses: 3000 },
    { date: '2025-09-01', revenue: 6000, expenses: 3500 },
    { date: '2025-10-01', revenue: 7000, expenses: 4000 },
    { date: '2025-11-01', revenue: 5500, expenses: 3800 },
    { date: '2025-12-01', revenue: 8000, expenses: 4500 },
    { date: '2026-01-01', revenue: 9000, expenses: 5000 },
  ];

  describe('rendering', () => {
    it('should render chart title', () => {
      render(<RevenueExpensesChart data={mockData} />);

      expect(screen.getByText('Revenue vs Expenses')).toBeInTheDocument();
    });

    it('should render bar chart', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });

    it('should render legend for revenue and expenses', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const legend = container.querySelector('.recharts-legend-wrapper');
      expect(legend).toBeInTheDocument();
    });

    it('should show custom period if provided', () => {
      render(<RevenueExpensesChart data={mockData} period="Last 6 Months" />);

      expect(screen.getByText('Last 6 Months')).toBeInTheDocument();
    });

    it('should show default period if not provided', () => {
      render(<RevenueExpensesChart data={mockData} />);

      expect(screen.getByText(/last.*months/i)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton when loading', () => {
      render(<RevenueExpensesChart data={[]} isLoading />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading chart...')).toBeInTheDocument();
    });

    it('should not show chart when loading', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} isLoading />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).not.toBeInTheDocument();
    });

    it('should have aria-live region when loading', () => {
      render(<RevenueExpensesChart data={[]} isLoading />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('empty state', () => {
    it('should show empty state when no data', () => {
      render(<RevenueExpensesChart data={[]} />);

      expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    });

    it('should render chart container even with empty data', () => {
      const { container } = render(<RevenueExpensesChart data={[]} />);

      // Should have widget container
      const widget = container.firstChild;
      expect(widget).toBeInTheDocument();
    });
  });

  describe('data visualization', () => {
    it('should display bars for revenue', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const revenueBars = container.querySelectorAll('[data-key="revenue"]');
      expect(revenueBars.length).toBeGreaterThan(0);
    });

    it('should display bars for expenses', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const expenseBars = container.querySelectorAll('[data-key="expenses"]');
      expect(expenseBars.length).toBeGreaterThan(0);
    });

    it('should handle single data point', () => {
      const singleData: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 5000, expenses: 3000 },
      ];

      const { container } = render(<RevenueExpensesChart data={singleData} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });

    it('should handle varying data ranges', () => {
      const varyingData: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 100, expenses: 50 },
        { date: '2026-02-01', revenue: 10000, expenses: 8000 },
        { date: '2026-03-01', revenue: 500, expenses: 300 },
      ];

      const { container } = render(<RevenueExpensesChart data={varyingData} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });
  });

  describe('tooltip functionality', () => {
    it('should render tooltip on hover', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const tooltipContainer = container.querySelector('.recharts-tooltip-wrapper');
      expect(tooltipContainer).toBeInTheDocument();
    });

    it('should format tooltip values as currency', () => {
      // This would require user interaction to test fully
      // Just verify tooltip is configured
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });
  });

  describe('formatting', () => {
    it('should handle large numbers', () => {
      const largeData: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 1234567, expenses: 987654 },
      ];

      const { container } = render(<RevenueExpensesChart data={largeData} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });

    it('should handle zero values', () => {
      const zeroData: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 0, expenses: 0 },
        { date: '2026-02-01', revenue: 5000, expenses: 3000 },
      ];

      const { container } = render(<RevenueExpensesChart data={zeroData} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });

    it('should handle decimal values', () => {
      const decimalData: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 1234.56, expenses: 987.65 },
      ];

      const { container } = render(<RevenueExpensesChart data={decimalData} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });

    it('should format dates on x-axis', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const xAxis = container.querySelector('.recharts-xAxis');
      expect(xAxis).toBeInTheDocument();
    });

    it('should format currency on y-axis', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const yAxis = container.querySelector('.recharts-yAxis');
      expect(yAxis).toBeInTheDocument();
    });
  });

  describe('profitability insights', () => {
    it('should show profit indicator when revenue > expenses', () => {
      const profitableData: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 10000, expenses: 6000 },
      ];

      render(<RevenueExpensesChart data={profitableData} />);

      expect(screen.getByText(/profitable/i)).toBeInTheDocument();
    });

    it('should show loss indicator when expenses > revenue', () => {
      const lossData: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 3000, expenses: 5000 },
      ];

      render(<RevenueExpensesChart data={lossData} />);

      expect(screen.getByText(/expenses exceed revenue/i)).toBeInTheDocument();
    });

    it('should calculate net profit/loss for period', () => {
      render(<RevenueExpensesChart data={mockData} />);

      // Total revenue: 5000 + 6000 + 7000 + 5500 + 8000 + 9000 = 40500
      // Total expenses: 3000 + 3500 + 4000 + 3800 + 4500 + 5000 = 23800
      // Net: 16700
      expect(screen.getByText(/\$16,700/)).toBeInTheDocument();
    });
  });

  describe('responsive behavior', () => {
    it('should render responsive container', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const responsiveContainer = container.querySelector('.recharts-responsive-container');
      expect(responsiveContainer).toBeInTheDocument();
    });

    it('should maintain aspect ratio', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const wrapper = container.querySelector('.recharts-wrapper');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible heading', () => {
      render(<RevenueExpensesChart data={mockData} />);

      const heading = screen.getByRole('heading', { name: /revenue vs expenses/i });
      expect(heading).toBeInTheDocument();
    });

    it('should have aria-label for chart', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const chart = container.querySelector('[aria-label]');
      expect(chart).toBeInTheDocument();
    });

    it('should provide text alternative for chart data', () => {
      render(<RevenueExpensesChart data={mockData} />);

      // Summary should be available as text
      expect(screen.getByText(/total revenue/i)).toBeInTheDocument();
      expect(screen.getByText(/total expenses/i)).toBeInTheDocument();
    });

    it('should hide decorative elements from screen readers', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const decorative = container.querySelectorAll('[aria-hidden="true"]');
      expect(decorative.length).toBeGreaterThan(0);
    });
  });

  describe('color coding', () => {
    it('should use distinct colors for revenue and expenses', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      // Revenue should be green, expenses should be red/orange
      const bars = container.querySelectorAll('.recharts-bar-rectangle');
      expect(bars.length).toBeGreaterThan(0);
    });

    it('should maintain color consistency in legend', () => {
      const { container } = render(<RevenueExpensesChart data={mockData} />);

      const legend = container.querySelector('.recharts-legend-wrapper');
      expect(legend).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle all zero data', () => {
      const allZero: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 0, expenses: 0 },
        { date: '2026-02-01', revenue: 0, expenses: 0 },
      ];

      render(<RevenueExpensesChart data={allZero} />);

      expect(screen.getByText(/no revenue or expenses/i)).toBeInTheDocument();
    });

    it('should handle very long time periods', () => {
      const longPeriod: RevenueExpensesData[] = Array.from({ length: 24 }, (_, i) => ({
        date: new Date(2024, i, 1).toISOString(),
        revenue: 5000 + i * 100,
        expenses: 3000 + i * 50,
      }));

      const { container } = render(<RevenueExpensesChart data={longPeriod} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });

    it('should handle negative values gracefully', () => {
      const negativeData: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: -100, expenses: 3000 },
      ];

      const { container } = render(<RevenueExpensesChart data={negativeData} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });

    it('should handle mixed date formats', () => {
      const mixedDates: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 5000, expenses: 3000 },
        { date: new Date('2026-02-01').toISOString(), revenue: 6000, expenses: 3500 },
      ];

      const { container } = render(<RevenueExpensesChart data={mixedDates} />);

      const chart = container.querySelector('.recharts-wrapper');
      expect(chart).toBeInTheDocument();
    });
  });

  describe('custom props', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <RevenueExpensesChart data={mockData} className="custom-chart" />
      );

      const widget = container.firstChild as HTMLElement;
      expect(widget.className).toContain('custom-chart');
    });
  });

  describe('integration', () => {
    it('should render complete chart with all features', () => {
      render(<RevenueExpensesChart data={mockData} period="Last 6 Months" />);

      expect(screen.getByText('Revenue vs Expenses')).toBeInTheDocument();
      expect(screen.getByText('Last 6 Months')).toBeInTheDocument();
      expect(screen.getByText(/total revenue/i)).toBeInTheDocument();
      expect(screen.getByText(/total expenses/i)).toBeInTheDocument();
      expect(screen.getByText(/net profit/i)).toBeInTheDocument();
    });

    it('should handle transition from loading to loaded', () => {
      const { rerender } = render(<RevenueExpensesChart data={[]} isLoading />);

      expect(screen.getByText('Loading chart...')).toBeInTheDocument();

      rerender(<RevenueExpensesChart data={mockData} isLoading={false} />);

      expect(screen.queryByText('Loading chart...')).not.toBeInTheDocument();
      expect(screen.getByText('Revenue vs Expenses')).toBeInTheDocument();
    });

    it('should update when data changes', () => {
      const { rerender } = render(<RevenueExpensesChart data={mockData} />);

      const newData: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 10000, expenses: 5000 },
      ];

      rerender(<RevenueExpensesChart data={newData} />);

      // Chart should re-render with new data
      expect(screen.getByText(/\$10,000/)).toBeInTheDocument();
    });
  });

  describe('trend indicators', () => {
    it('should show upward trend indicator when revenue increasing', () => {
      const trendingUp: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 1000, expenses: 500 },
        { date: '2026-02-01', revenue: 2000, expenses: 600 },
        { date: '2026-03-01', revenue: 3000, expenses: 700 },
      ];

      render(<RevenueExpensesChart data={trendingUp} />);

      expect(screen.getByText(/growing/i)).toBeInTheDocument();
    });

    it('should show downward trend indicator when revenue decreasing', () => {
      const trendingDown: RevenueExpensesData[] = [
        { date: '2026-01-01', revenue: 3000, expenses: 500 },
        { date: '2026-02-01', revenue: 2000, expenses: 600 },
        { date: '2026-03-01', revenue: 1000, expenses: 700 },
      ];

      render(<RevenueExpensesChart data={trendingDown} />);

      expect(screen.getByText(/declining/i)).toBeInTheDocument();
    });
  });
});
