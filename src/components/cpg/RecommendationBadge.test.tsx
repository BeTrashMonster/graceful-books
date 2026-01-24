import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecommendationBadge } from './RecommendationBadge';

describe('RecommendationBadge', () => {
  describe('Rendering', () => {
    it('renders participate badge with correct styling', () => {
      render(
        <RecommendationBadge
          recommendation="participate"
          reason="All margins are above 50%. This promo maintains healthy profitability."
        />
      );

      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('PARTICIPATE');
      expect(badge).toHaveAttribute('aria-label', 'Recommendation: Participate in this promotion');
    });

    it('renders decline badge with correct styling', () => {
      render(
        <RecommendationBadge
          recommendation="decline"
          reason="Lowest margin is 35%, which is below the 40% threshold."
        />
      );

      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('DECLINE');
      expect(badge).toHaveAttribute('aria-label', 'Recommendation: Decline this promotion');
    });

    it('renders neutral/borderline badge with correct styling', () => {
      render(
        <RecommendationBadge
          recommendation="neutral"
          reason="Margins are borderline (42% to 48%). Review carefully."
        />
      );

      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('BORDERLINE');
      expect(badge).toHaveAttribute('aria-label', 'Recommendation: Borderline - review carefully');
    });

    it('displays reason text', () => {
      const reason = 'All margins are above 50%. This promo maintains healthy profitability.';
      render(<RecommendationBadge recommendation="participate" reason={reason} />);

      expect(screen.getByText(reason)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes for screen readers', () => {
      render(
        <RecommendationBadge
          recommendation="participate"
          reason="All margins are above 50%."
        />
      );

      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label');
      expect(badge).toHaveAttribute('tabIndex', '0');
    });

    it('has aria-live region for reason text', () => {
      render(
        <RecommendationBadge
          recommendation="participate"
          reason="All margins are above 50%."
        />
      );

      const reasonElement = screen.getByText(/All margins are above 50%/);
      expect(reasonElement).toHaveAttribute('aria-live', 'polite');
      expect(reasonElement).toHaveAttribute('aria-atomic', 'true');
    });

    it('has region role for container', () => {
      render(
        <RecommendationBadge
          recommendation="participate"
          reason="All margins are above 50%."
        />
      );

      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
    });

    it('badge is keyboard focusable', () => {
      render(
        <RecommendationBadge
          recommendation="participate"
          reason="All margins are above 50%."
        />
      );

      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('tabIndex', '0');
    });

    it('includes icon with aria-hidden', () => {
      const { container } = render(
        <RecommendationBadge
          recommendation="participate"
          reason="All margins are above 50%."
        />
      );

      const icon = container.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Icons and Labels', () => {
    it('displays checkmark icon for participate', () => {
      render(
        <RecommendationBadge
          recommendation="participate"
          reason="All margins are above 50%."
        />
      );

      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('displays X icon for decline', () => {
      render(
        <RecommendationBadge
          recommendation="decline"
          reason="Margins too low."
        />
      );

      expect(screen.getByText('✗')).toBeInTheDocument();
    });

    it('displays exclamation icon for neutral', () => {
      render(
        <RecommendationBadge
          recommendation="neutral"
          reason="Borderline margins."
        />
      );

      expect(screen.getByText('!')).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className to container', () => {
      const { container } = render(
        <RecommendationBadge
          recommendation="participate"
          reason="All margins are above 50%."
          className="custom-class"
        />
      );

      const region = container.querySelector('.custom-class');
      expect(region).toBeInTheDocument();
    });
  });

  describe('Color Coding', () => {
    it('uses color not as sole indicator (includes text and icon)', () => {
      render(
        <RecommendationBadge
          recommendation="participate"
          reason="All margins are above 50%."
        />
      );

      // Should have icon (✓)
      expect(screen.getByText('✓')).toBeInTheDocument();
      // Should have text label
      expect(screen.getByText('PARTICIPATE')).toBeInTheDocument();
      // Should have aria-label for screen readers
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label', 'Recommendation: Participate in this promotion');
    });
  });
});
