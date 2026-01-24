import { useId } from 'react';
import clsx from 'clsx';
import styles from './RecommendationBadge.module.css';

export interface RecommendationBadgeProps {
  /**
   * Recommendation type
   */
  recommendation: 'participate' | 'decline' | 'neutral';
  /**
   * Plain English explanation for the recommendation
   */
  reason: string;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * RecommendationBadge Component
 *
 * Displays a prominent, accessible recommendation badge for sales promo decisions.
 *
 * Features:
 * - Color-coded badges with icons (green/red/yellow)
 * - aria-live announcements for screen readers
 * - Accessible focus states
 * - Icons + text (color not sole indicator)
 * - Plain English explanations
 *
 * Requirements:
 * - WCAG 2.1 AA compliant
 * - Steadiness communication style
 * - Supports keyboard navigation
 *
 * @example
 * ```tsx
 * <RecommendationBadge
 *   recommendation="participate"
 *   reason="All margins are above 50%. This promo maintains healthy profitability."
 * />
 * ```
 */
export function RecommendationBadge({
  recommendation,
  reason,
  className,
}: RecommendationBadgeProps) {
  const liveRegionId = useId();

  const config = {
    participate: {
      label: 'PARTICIPATE',
      icon: '✓',
      ariaLabel: 'Recommendation: Participate in this promotion',
    },
    decline: {
      label: 'DECLINE',
      icon: '✗',
      ariaLabel: 'Recommendation: Decline this promotion',
    },
    neutral: {
      label: 'BORDERLINE',
      icon: '!',
      ariaLabel: 'Recommendation: Borderline - review carefully',
    },
  };

  const badgeConfig = config[recommendation];

  return (
    <div className={clsx(styles.container, className)} role="region" aria-labelledby={liveRegionId}>
      <div
        className={clsx(styles.badge, styles[recommendation])}
        role="status"
        aria-label={badgeConfig.ariaLabel}
        tabIndex={0}
      >
        <span className={styles.icon} aria-hidden="true">
          {badgeConfig.icon}
        </span>
        <span className={styles.label}>{badgeConfig.label}</span>
      </div>

      <p
        id={liveRegionId}
        className={styles.reason}
        aria-live="polite"
        aria-atomic="true"
      >
        {reason}
      </p>
    </div>
  );
}
