/**
 * Tests for MetricCard Component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from './MetricCard';

describe('MetricCard Component', () => {
  describe('rendering', () => {
    it('should render with basic props', () => {
      render(<MetricCard title="Total Revenue" value="$10,000.00" />);

      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    });

    it('should render with icon', () => {
      render(
        <MetricCard
          title="Total Revenue"
          value="$10,000.00"
          icon={<span data-testid="icon">$</span>}
        />
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('should render with positive trend', () => {
      render(
        <MetricCard
          title="Total Revenue"
          value="$10,000.00"
          trend={{ value: '12.5%', isPositive: true, label: 'vs last month' }}
        />
      );

      expect(screen.getByText('12.5%')).toBeInTheDocument();
      expect(screen.getByText('vs last month')).toBeInTheDocument();
      expect(screen.getByText('↑')).toBeInTheDocument();
    });

    it('should render with negative trend', () => {
      render(
        <MetricCard
          title="Total Revenue"
          value="$8,000.00"
          trend={{ value: '12.5%', isPositive: false, label: 'vs last month' }}
        />
      );

      expect(screen.getByText('12.5%')).toBeInTheDocument();
      expect(screen.getByText('↓')).toBeInTheDocument();
    });

    it('should render all variants', () => {
      const variants = ['default', 'success', 'warning', 'danger'] as const;

      variants.forEach((variant) => {
        const { unmount } = render(
          <MetricCard title="Test" value="$100.00" variant={variant} />
        );
        expect(screen.getByText('Test')).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton when loading', () => {
      render(<MetricCard title="Revenue" value="$0.00" isLoading />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading metric...')).toBeInTheDocument();
    });

    it('should not show content when loading', () => {
      render(<MetricCard title="Revenue" value="$10,000.00" isLoading />);

      expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
      expect(screen.queryByText('$10,000.00')).not.toBeInTheDocument();
    });

    it('should have aria-live region when loading', () => {
      render(<MetricCard title="Revenue" value="$0.00" isLoading />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('accessibility', () => {
    it('should have accessible region role', () => {
      render(<MetricCard title="Total Revenue" value="$10,000.00" />);

      expect(screen.getByRole('region', { name: 'Total Revenue' })).toBeInTheDocument();
    });

    it('should have aria-label on value', () => {
      render(<MetricCard title="Total Revenue" value="$10,000.00" />);

      expect(screen.getByLabelText('Total Revenue value')).toBeInTheDocument();
    });

    it('should hide icon from screen readers', () => {
      const { container } = render(
        <MetricCard
          title="Revenue"
          value="$10,000.00"
          icon={<span>$</span>}
        />
      );

      const icon = container.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });

    it('should have accessible trend label', () => {
      render(
        <MetricCard
          title="Revenue"
          value="$10,000.00"
          trend={{ value: '12.5%', isPositive: true, label: 'vs last month' }}
        />
      );

      expect(screen.getByLabelText('vs last month: 12.5%')).toBeInTheDocument();
    });

    it('should hide trend icon from screen readers', () => {
      const { container } = render(
        <MetricCard
          title="Revenue"
          value="$10,000.00"
          trend={{ value: '12.5%', isPositive: true, label: 'vs last month' }}
        />
      );

      // Find the trend icon by looking for elements with aria-hidden="true"
      const trendIcons = container.querySelectorAll('[aria-hidden="true"]');
      // The trend icon should be present (there should be at least one aria-hidden element)
      expect(trendIcons.length).toBeGreaterThan(0);
    });
  });

  describe('custom props', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <MetricCard title="Revenue" value="$10,000.00" className="custom-class" />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('custom-class');
    });

    it('should combine variant and custom className', () => {
      const { container } = render(
        <MetricCard
          title="Revenue"
          value="$10,000.00"
          variant="success"
          className="custom-class"
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('success');
      expect(card.className).toContain('custom-class');
    });
  });

  describe('edge cases', () => {
    it('should handle zero value', () => {
      render(<MetricCard title="Revenue" value="$0.00" />);

      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle negative value', () => {
      render(<MetricCard title="Net Loss" value="-$5,000.00" />);

      expect(screen.getByText('-$5,000.00')).toBeInTheDocument();
    });

    it('should handle large numbers', () => {
      render(<MetricCard title="Revenue" value="$1,234,567.89" />);

      expect(screen.getByText('$1,234,567.89')).toBeInTheDocument();
    });

    it('should handle trend without label', () => {
      render(
        <MetricCard
          title="Revenue"
          value="$10,000.00"
          trend={{ value: '10%', isPositive: true, label: '' }}
        />
      );

      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('should handle empty title', () => {
      render(<MetricCard title="" value="$10,000.00" />);

      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    });
  });

  describe('integration', () => {
    it('should render complete card with all features', () => {
      render(
        <MetricCard
          title="Monthly Revenue"
          value="$15,432.50"
          icon={<span data-testid="icon">💰</span>}
          trend={{ value: '23.5%', isPositive: true, label: 'vs last month' }}
          variant="success"
          className="custom-metric"
        />
      );

      expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
      expect(screen.getByText('$15,432.50')).toBeInTheDocument();
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('23.5%')).toBeInTheDocument();
      expect(screen.getByText('vs last month')).toBeInTheDocument();
      expect(screen.getByText('↑')).toBeInTheDocument();
    });

    it('should handle transition from loading to loaded', () => {
      const { rerender } = render(
        <MetricCard title="Revenue" value="$0.00" isLoading />
      );

      expect(screen.getByText('Loading metric...')).toBeInTheDocument();

      rerender(<MetricCard title="Revenue" value="$10,000.00" isLoading={false} />);

      expect(screen.queryByText('Loading metric...')).not.toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    });
  });
});
