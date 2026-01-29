import clsx from 'clsx';
import styles from './PromoImpactSummary.module.css';

export interface PromoImpactSummaryProps {
  /**
   * Average margin difference across all variants
   */
  marginDifference: string;
  /**
   * Total promo cost (producer contribution)
   */
  totalPromoCost: string;
  /**
   * Total units across all variants
   */
  totalUnits: string;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * PromoImpactSummary Component
 *
 * Displays high-level impact summary of the sales promo.
 *
 * Features:
 * - Margin difference (visual indicator)
 * - Total promo cost (bold, prominent)
 * - Total units
 * - Clear visual hierarchy
 * - Color-coded impact
 *
 * Requirements:
 * - WCAG 2.1 AA compliant
 * - Steadiness communication style
 * - Easy-to-scan layout
 *
 * @example
 * ```tsx
 * <PromoImpactSummary
 *   marginDifference="-10.00"
 *   totalPromoCost="1250.00"
 *   totalUnits="500"
 * />
 * ```
 */
export function PromoImpactSummary({
  marginDifference,
  totalPromoCost,
  totalUnits,
  className,
}: PromoImpactSummaryProps) {
  const marginDiff = parseFloat(marginDifference);
  const isPositiveImpact = marginDiff >= 0;
  const isNegativeImpact = marginDiff < 0;

  return (
    <div className={clsx(styles.container, className)}>
      <h3 className={styles.title}>Impact Summary</h3>

      <div className={styles.metricsGrid}>
        {/* Margin Difference */}
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Margin Impact</div>
          <div
            className={clsx(
              styles.metricValue,
              styles.marginDifference,
              isPositiveImpact && styles.positive,
              isNegativeImpact && styles.negative
            )}
          >
            <span className={styles.icon} aria-hidden="true">
              {isPositiveImpact ? '↑' : '↓'}
            </span>
            <span className={styles.value}>
              {isPositiveImpact ? '+' : ''}
              {marginDifference}%
            </span>
          </div>
          <div className={styles.metricDescription}>
            {isPositiveImpact && 'Your margins improve with this promo'}
            {isNegativeImpact && 'Your margins decrease with this promo'}
            {marginDiff === 0 && 'Your margins stay the same'}
          </div>
        </div>

        {/* Total Promo Cost */}
        <div className={clsx(styles.metricCard, styles.prominentCard)}>
          <div className={styles.metricLabel}>Potential Payback</div>
          <div className={clsx(styles.metricValue, styles.totalCost)}>
            <span className={styles.currency}>$</span>
            <span className={styles.amount}>
              {parseFloat(totalPromoCost).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className={styles.metricDescription}>
            Maximum payback if all units sell at promo price
          </div>
        </div>

        {/* Total Units */}
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Units</div>
          <div className={clsx(styles.metricValue, styles.totalUnits)}>
            <span className={styles.value}>
              {parseFloat(totalUnits).toLocaleString('en-US', {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
          <div className={styles.metricDescription}>
            Units committed to this promotion
          </div>
        </div>
      </div>

      {/* Interpretation Message */}
      <div className={styles.interpretation}>
        <span className={styles.interpretationIcon} aria-hidden="true">
          💡
        </span>
        <p className={styles.interpretationText}>
          {isNegativeImpact && marginDiff < -10 && (
            <>
              This promo significantly impacts your margins. Consider whether the volume increase justifies the margin reduction.
            </>
          )}
          {isNegativeImpact && marginDiff >= -10 && (
            <>
              This promo has a moderate impact on your margins. Review carefully to ensure it aligns with your business goals.
            </>
          )}
          {isPositiveImpact && (
            <>
              This promo actually improves your margins! This is an excellent opportunity.
            </>
          )}
          {marginDiff === 0 && (
            <>
              This promo maintains your current margins while potentially increasing volume.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
