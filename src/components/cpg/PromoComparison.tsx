import clsx from 'clsx';
import styles from './PromoComparison.module.css';

export interface VariantComparisonData {
  variant: string;
  withoutPromo: {
    cpu: string;
    margin: string;
    marginQuality: 'poor' | 'good' | 'better' | 'best';
  };
  withPromo: {
    cpu: string;
    salesPromoCost: string;
    margin: string;
    marginQuality: 'poor' | 'good' | 'better' | 'best';
  };
  marginDifference: string;
}

export interface PromoComparisonProps {
  /**
   * Comparison data per variant
   */
  variants: VariantComparisonData[];
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * PromoComparison Component
 *
 * Displays side-by-side comparison of WITHOUT Promo vs. WITH Promo scenarios.
 *
 * Features:
 * - Two-column layout (WITHOUT | WITH)
 * - Color-coded margins
 * - Clear visual indicators
 * - Mobile responsive (stacks vertically)
 * - Accessible table structure
 *
 * Requirements:
 * - WCAG 2.1 AA compliant
 * - Steadiness communication style
 * - Easy-to-scan layout
 *
 * @example
 * ```tsx
 * <PromoComparison
 *   variants={[
 *     {
 *       variant: "8oz",
 *       withoutPromo: { cpu: "2.15", margin: "78.50", marginQuality: "best" },
 *       withPromo: { cpu: "3.15", salesPromoCost: "1.00", margin: "68.50", marginQuality: "better" },
 *       marginDifference: "-10.00"
 *     }
 *   ]}
 * />
 * ```
 */
export function PromoComparison({ variants, className }: PromoComparisonProps) {
  const getMarginColorClass = (quality: 'poor' | 'good' | 'better' | 'best'): string => {
    const colorMap = {
      poor: styles.marginPoor,
      good: styles.marginGood,
      better: styles.marginBetter,
      best: styles.marginBest,
    };
    return colorMap[quality]!;
  };

  const getMarginIcon = (quality: 'poor' | 'good' | 'better' | 'best'): string => {
    const iconMap = {
      poor: '⚠',
      good: '○',
      better: '◐',
      best: '●',
    };
    return iconMap[quality];
  };

  const getMarginLabel = (quality: 'poor' | 'good' | 'better' | 'best'): string => {
    const labelMap = {
      poor: 'Poor',
      good: 'Good',
      better: 'Better',
      best: 'Best',
    };
    return labelMap[quality];
  };

  return (
    <div className={clsx(styles.container, className)}>
      <h3 className={styles.title}>Side-by-Side Comparison</h3>

      {variants.map((variantData) => (
        <div key={variantData.variant} className={styles.variantSection}>
          <h4 className={styles.variantTitle}>{variantData.variant}</h4>

          <div className={styles.comparisonGrid}>
            {/* WITHOUT Promo Column */}
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <span className={styles.columnIcon}>✗</span>
                <span className={styles.columnTitle}>WITHOUT Promo</span>
              </div>
              <div className={styles.columnContent}>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>CPU:</span>
                  <span className={styles.metricValue}>${variantData.withoutPromo.cpu}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Margin:</span>
                  <span
                    className={clsx(
                      styles.metricValue,
                      styles.marginValue,
                      getMarginColorClass(variantData.withoutPromo.marginQuality)
                    )}
                  >
                    <span className={styles.marginIcon} aria-hidden="true">
                      {getMarginIcon(variantData.withoutPromo.marginQuality)}
                    </span>
                    {variantData.withoutPromo.margin}%
                    <span className={styles.marginQualityLabel}>
                      ({getMarginLabel(variantData.withoutPromo.marginQuality)})
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* WITH Promo Column */}
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <span className={styles.columnIcon}>✓</span>
                <span className={styles.columnTitle}>WITH Promo</span>
              </div>
              <div className={styles.columnContent}>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>CPU w/ Promo:</span>
                  <span className={styles.metricValue}>${variantData.withPromo.cpu}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Sales Promo Cost/Unit:</span>
                  <span className={styles.metricValue}>${variantData.withPromo.salesPromoCost}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Margin w/ Promo:</span>
                  <span
                    className={clsx(
                      styles.metricValue,
                      styles.marginValue,
                      getMarginColorClass(variantData.withPromo.marginQuality)
                    )}
                  >
                    <span className={styles.marginIcon} aria-hidden="true">
                      {getMarginIcon(variantData.withPromo.marginQuality)}
                    </span>
                    {variantData.withPromo.margin}%
                    <span className={styles.marginQualityLabel}>
                      ({getMarginLabel(variantData.withPromo.marginQuality)})
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Margin Difference Indicator */}
          <div className={styles.differenceIndicator}>
            <span className={styles.differenceLabel}>Margin Impact:</span>
            <span
              className={clsx(
                styles.differenceValue,
                parseFloat(variantData.marginDifference) >= 0
                  ? styles.differencePositive
                  : styles.differenceNegative
              )}
            >
              {parseFloat(variantData.marginDifference) >= 0 ? '+' : ''}
              {variantData.marginDifference}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
