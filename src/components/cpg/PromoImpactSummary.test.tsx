import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromoImpactSummary } from './PromoImpactSummary';

describe('PromoImpactSummary', () => {
  describe('Rendering', () => {
    it('renders title', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );
      expect(screen.getByText('Impact Summary')).toBeInTheDocument();
    });

    it('renders all metric cards', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('Margin Impact')).toBeInTheDocument();
      expect(screen.getByText('Total Promo Cost')).toBeInTheDocument();
      expect(screen.getByText('Total Units')).toBeInTheDocument();
    });
  });

  describe('Margin Difference Display', () => {
    it('displays negative margin difference with down arrow', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('↓')).toBeInTheDocument();
      expect(screen.getByText('-10.00%')).toBeInTheDocument();
    });

    it('displays positive margin difference with up arrow', () => {
      render(
        <PromoImpactSummary
          marginDifference="5.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('↑')).toBeInTheDocument();
      expect(screen.getByText('+5.00%')).toBeInTheDocument();
    });

    it('shows appropriate description for negative impact', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('Your margins decrease with this promo')).toBeInTheDocument();
    });

    it('shows appropriate description for positive impact', () => {
      render(
        <PromoImpactSummary
          marginDifference="5.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('Your margins improve with this promo')).toBeInTheDocument();
    });

    it('shows appropriate description for zero impact', () => {
      render(
        <PromoImpactSummary
          marginDifference="0.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('Your margins stay the same')).toBeInTheDocument();
    });
  });

  describe('Total Promo Cost Display', () => {
    it('displays total promo cost with currency formatting', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.50"
          totalUnits="500"
        />
      );

      expect(screen.getByText('$')).toBeInTheDocument();
      expect(screen.getByText('1,250.50')).toBeInTheDocument();
    });

    it('displays total promo cost description', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('Your total contribution to the promotion')).toBeInTheDocument();
    });

    it('formats large numbers with commas', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="125000.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('125,000.00')).toBeInTheDocument();
    });
  });

  describe('Total Units Display', () => {
    it('displays total units', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('displays total units description', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('Units committed to this promotion')).toBeInTheDocument();
    });

    it('formats large unit numbers with commas', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="5000"
        />
      );

      expect(screen.getByText('5,000')).toBeInTheDocument();
    });
  });

  describe('Interpretation Message', () => {
    it('displays interpretation icon', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('💡')).toBeInTheDocument();
    });

    it('shows significant impact message for large negative difference', () => {
      render(
        <PromoImpactSummary
          marginDifference="-15.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(
        screen.getByText(/This promo significantly impacts your margins/i)
      ).toBeInTheDocument();
    });

    it('shows moderate impact message for small negative difference', () => {
      render(
        <PromoImpactSummary
          marginDifference="-5.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText(/This promo has a moderate impact on your margins/i)).toBeInTheDocument();
    });

    it('shows excellent opportunity message for positive difference', () => {
      render(
        <PromoImpactSummary
          marginDifference="5.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(
        screen.getByText(/This promo actually improves your margins! This is an excellent opportunity/i)
      ).toBeInTheDocument();
    });

    it('shows maintained margins message for zero difference', () => {
      render(
        <PromoImpactSummary
          marginDifference="0.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(
        screen.getByText(/This promo maintains your current margins while potentially increasing volume/i)
      ).toBeInTheDocument();
    });
  });

  describe('Styling and Visual Indicators', () => {
    it('applies prominent styling to total cost card', () => {
      const { container } = render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      const prominentCard = container.querySelector('.prominentCard');
      expect(prominentCard).toBeInTheDocument();
    });

    it('applies positive styling to positive margin difference', () => {
      const { container } = render(
        <PromoImpactSummary
          marginDifference="5.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      const positiveElement = container.querySelector('.positive');
      expect(positiveElement).toBeInTheDocument();
    });

    it('applies negative styling to negative margin difference', () => {
      const { container } = render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      const negativeElement = container.querySelector('.negative');
      expect(negativeElement).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className to container', () => {
      const { container } = render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
          className="custom-class"
        />
      );

      const customElement = container.querySelector('.custom-class');
      expect(customElement).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses semantic HTML structure', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('includes descriptive metric labels', () => {
      render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      expect(screen.getByText('Margin Impact')).toBeInTheDocument();
      expect(screen.getByText('Total Promo Cost')).toBeInTheDocument();
      expect(screen.getByText('Total Units')).toBeInTheDocument();
    });

    it('hides decorative icons from screen readers', () => {
      const { container } = render(
        <PromoImpactSummary
          marginDifference="-10.00"
          totalPromoCost="1250.00"
          totalUnits="500"
        />
      );

      const hiddenIcons = container.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenIcons.length).toBeGreaterThan(0);
    });
  });
});
