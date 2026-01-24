import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarginQualityBadge } from './MarginQualityBadge';

describe('MarginQualityBadge', () => {
  describe('Rendering', () => {
    it('renders with poor quality (red)', () => {
      render(<MarginQualityBadge quality="poor" marginPercentage="45.00" />);

      expect(screen.getByText('45.00%')).toBeInTheDocument();
      expect(screen.getByText('Poor')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Profit margin: 45.00%, Below 50% - Use caution, margins are low'
      );
    });

    it('renders with good quality (yellow)', () => {
      render(<MarginQualityBadge quality="good" marginPercentage="55.00" />);

      expect(screen.getByText('55.00%')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Profit margin: 55.00%, 50-60% - Acceptable profit margin'
      );
    });

    it('renders with better quality (light green)', () => {
      render(<MarginQualityBadge quality="better" marginPercentage="65.00" />);

      expect(screen.getByText('65.00%')).toBeInTheDocument();
      expect(screen.getByText('Better')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Profit margin: 65.00%, 60-70% - Strong profit margin'
      );
    });

    it('renders with best quality (dark green)', () => {
      render(<MarginQualityBadge quality="best" marginPercentage="75.00" />);

      expect(screen.getByText('75.00%')).toBeInTheDocument();
      expect(screen.getByText('Best')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Profit margin: 75.00%, 70%+ - Excellent profit margin'
      );
    });
  });

  describe('Custom Label', () => {
    it('renders with custom label', () => {
      render(
        <MarginQualityBadge
          quality="best"
          marginPercentage="80.00"
          label="Excellent"
        />
      );

      expect(screen.getByText('80.00%')).toBeInTheDocument();
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders small size', () => {
      const { container } = render(
        <MarginQualityBadge quality="good" marginPercentage="55.00" size="sm" />
      );

      const badge = container.querySelector('[role="status"]');
      expect(badge).toHaveClass('sm');
    });

    it('renders medium size (default)', () => {
      const { container } = render(
        <MarginQualityBadge quality="good" marginPercentage="55.00" />
      );

      const badge = container.querySelector('[role="status"]');
      expect(badge).toHaveClass('md');
    });

    it('renders large size', () => {
      const { container } = render(
        <MarginQualityBadge quality="good" marginPercentage="55.00" size="lg" />
      );

      const badge = container.querySelector('[role="status"]');
      expect(badge).toHaveClass('lg');
    });
  });

  describe('Accessibility', () => {
    it('has proper role and aria-label', () => {
      render(<MarginQualityBadge quality="poor" marginPercentage="45.00" />);

      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label');
    });

    it('hides decorative elements from screen readers', () => {
      const { container } = render(
        <MarginQualityBadge quality="best" marginPercentage="75.00" />
      );

      const icon = container.querySelector('.icon');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Color Coding', () => {
    it('applies correct class for poor quality', () => {
      const { container } = render(
        <MarginQualityBadge quality="poor" marginPercentage="40.00" />
      );

      const badge = container.querySelector('[role="status"]');
      expect(badge).toHaveClass('poor');
    });

    it('applies correct class for good quality', () => {
      const { container } = render(
        <MarginQualityBadge quality="good" marginPercentage="55.00" />
      );

      const badge = container.querySelector('[role="status"]');
      expect(badge).toHaveClass('good');
    });

    it('applies correct class for better quality', () => {
      const { container } = render(
        <MarginQualityBadge quality="better" marginPercentage="65.00" />
      );

      const badge = container.querySelector('[role="status"]');
      expect(badge).toHaveClass('better');
    });

    it('applies correct class for best quality', () => {
      const { container } = render(
        <MarginQualityBadge quality="best" marginPercentage="75.00" />
      );

      const badge = container.querySelector('[role="status"]');
      expect(badge).toHaveClass('best');
    });
  });
});
