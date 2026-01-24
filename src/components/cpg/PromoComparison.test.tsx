import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromoComparison, type VariantComparisonData } from './PromoComparison';

describe('PromoComparison', () => {
  const mockVariants: VariantComparisonData[] = [
    {
      variant: '8oz',
      withoutPromo: {
        cpu: '2.15',
        margin: '78.50',
        marginQuality: 'best',
      },
      withPromo: {
        cpu: '3.15',
        salesPromoCost: '1.00',
        margin: '68.50',
        marginQuality: 'better',
      },
      marginDifference: '-10.00',
    },
    {
      variant: '16oz',
      withoutPromo: {
        cpu: '3.20',
        margin: '42.00',
        marginQuality: 'poor',
      },
      withPromo: {
        cpu: '4.20',
        salesPromoCost: '1.00',
        margin: '32.00',
        marginQuality: 'poor',
      },
      marginDifference: '-10.00',
    },
  ];

  describe('Rendering', () => {
    it('renders title', () => {
      render(<PromoComparison variants={mockVariants} />);
      expect(screen.getByText('Side-by-Side Comparison')).toBeInTheDocument();
    });

    it('renders all variant sections', () => {
      render(<PromoComparison variants={mockVariants} />);
      expect(screen.getByText('8oz')).toBeInTheDocument();
      expect(screen.getByText('16oz')).toBeInTheDocument();
    });

    it('renders WITHOUT Promo column header', () => {
      render(<PromoComparison variants={mockVariants} />);
      expect(screen.getAllByText('WITHOUT Promo')[0]).toBeInTheDocument();
    });

    it('renders WITH Promo column header', () => {
      render(<PromoComparison variants={mockVariants} />);
      expect(screen.getAllByText('WITH Promo')[0]).toBeInTheDocument();
    });
  });

  describe('WITHOUT Promo Column', () => {
    it('displays CPU value', () => {
      render(<PromoComparison variants={[mockVariants[0]]} />);
      expect(screen.getByText('$2.15')).toBeInTheDocument();
    });

    it('displays margin percentage', () => {
      render(<PromoComparison variants={[mockVariants[0]]} />);
      expect(screen.getByText('78.50%')).toBeInTheDocument();
    });

    it('displays margin quality label', () => {
      render(<PromoComparison variants={[mockVariants[0]]} />);
      expect(screen.getByText('(Best)')).toBeInTheDocument();
    });
  });

  describe('WITH Promo Column', () => {
    it('displays CPU w/ Promo value', () => {
      render(<PromoComparison variants={[mockVariants[0]]} />);
      expect(screen.getByText('$3.15')).toBeInTheDocument();
    });

    it('displays Sales Promo Cost/Unit', () => {
      render(<PromoComparison variants={[mockVariants[0]]} />);
      expect(screen.getByText('$1.00')).toBeInTheDocument();
    });

    it('displays margin w/ promo percentage', () => {
      render(<PromoComparison variants={[mockVariants[0]]} />);
      expect(screen.getByText('68.50%')).toBeInTheDocument();
    });

    it('displays margin quality label for promo', () => {
      render(<PromoComparison variants={[mockVariants[0]]} />);
      expect(screen.getByText('(Better)')).toBeInTheDocument();
    });
  });

  describe('Margin Difference Indicator', () => {
    it('displays margin impact label', () => {
      render(<PromoComparison variants={[mockVariants[0]]} />);
      expect(screen.getAllByText(/Margin Impact/i)[0]).toBeInTheDocument();
    });

    it('displays negative margin difference with minus sign', () => {
      render(<PromoComparison variants={[mockVariants[0]]} />);
      expect(screen.getAllByText('-10.00%')[0]).toBeInTheDocument();
    });

    it('displays positive margin difference with plus sign', () => {
      const positiveVariant: VariantComparisonData[] = [
        {
          variant: '8oz',
          withoutPromo: {
            cpu: '2.15',
            margin: '68.50',
            marginQuality: 'better',
          },
          withPromo: {
            cpu: '2.00',
            salesPromoCost: '0.50',
            margin: '78.50',
            marginQuality: 'best',
          },
          marginDifference: '10.00',
        },
      ];

      render(<PromoComparison variants={positiveVariant} />);
      expect(screen.getByText('+10.00%')).toBeInTheDocument();
    });
  });

  describe('Color Coding', () => {
    it('applies correct color class for poor margin', () => {
      const { container } = render(<PromoComparison variants={[mockVariants[1]]} />);
      const poorMarginElements = container.querySelectorAll('.marginPoor');
      expect(poorMarginElements.length).toBeGreaterThan(0);
    });

    it('applies correct color class for best margin', () => {
      const { container } = render(<PromoComparison variants={[mockVariants[0]]} />);
      const bestMarginElements = container.querySelectorAll('.marginBest');
      expect(bestMarginElements.length).toBeGreaterThan(0);
    });

    it('uses icons as visual indicators (not just color)', () => {
      render(<PromoComparison variants={[mockVariants[0]]} />);
      // Icons should be present (aria-hidden)
      const { container } = render(<PromoComparison variants={[mockVariants[0]]} />);
      const icons = container.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Variants', () => {
    it('renders comparison for multiple variants', () => {
      render(<PromoComparison variants={mockVariants} />);
      expect(screen.getByText('8oz')).toBeInTheDocument();
      expect(screen.getByText('16oz')).toBeInTheDocument();
    });

    it('displays separate margin differences for each variant', () => {
      render(<PromoComparison variants={mockVariants} />);
      const marginDifferences = screen.getAllByText('-10.00%');
      expect(marginDifferences.length).toBe(2); // One for each variant
    });
  });

  describe('Margin Quality Icons', () => {
    it('displays correct icon for poor margin', () => {
      render(<PromoComparison variants={[mockVariants[1]]} />);
      expect(screen.getAllByText('⚠')[0]).toBeInTheDocument();
    });

    it('displays correct icon for best margin', () => {
      render(<PromoComparison variants={[mockVariants[0]]} />);
      expect(screen.getAllByText('●')[0]).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className to container', () => {
      const { container } = render(
        <PromoComparison variants={mockVariants} className="custom-class" />
      );
      const customElement = container.querySelector('.custom-class');
      expect(customElement).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses semantic HTML structure', () => {
      render(<PromoComparison variants={mockVariants} />);
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('includes descriptive labels for metrics', () => {
      render(<PromoComparison variants={mockVariants} />);
      expect(screen.getAllByText(/CPU:/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Margin:/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/CPU w\/ Promo:/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Sales Promo Cost\/Unit:/i)[0]).toBeInTheDocument();
    });
  });
});
