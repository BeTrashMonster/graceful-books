import clsx from 'clsx';
import styles from './PromoComparison.module.css';
import { Tooltip } from '../core/Tooltip';

export interface VariantComparisonData {
  variant: string;
  retailPrice: string;
  wholesaleCost?: string; // Optional wholesale cost
  withoutPromo: {
    cpu: string;
    grossProfit: string;
    margin: string;
    marginQuality: 'gutCheck' | 'good' | 'better' | 'best';
  };
  withPromo: {
    cpu: string;
    salesPromoCost: string;
    demoHoursCost?: string; // Optional demo hours cost
    totalCost: string; // Total of all costs
    grossProfit: string;
    margin: string;
    marginQuality: 'gutCheck' | 'good' | 'better' | 'best';
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
  const getMarginColorClass = (quality: 'gutCheck' | 'good' | 'better' | 'best'): string => {
    const colorMap = {
      gutCheck: styles.marginGutCheck,
      good: styles.marginGood,
      better: styles.marginBetter,
      best: styles.marginBest,
    };
    return colorMap[quality]!;
  };

  const getMarginIcon = (quality: 'gutCheck' | 'good' | 'better' | 'best'): string => {
    const iconMap = {
      gutCheck: '⚠',
      good: '○',
      better: '◐',
      best: '●',
    };
    return iconMap[quality];
  };

  const getMarginLabel = (quality: 'gutCheck' | 'good' | 'better' | 'best'): string => {
    const labelMap = {
      gutCheck: 'Gut Check',
      good: 'Good',
      better: 'Better',
      best: 'Best',
    };
    return labelMap[quality];
  };

  const hasDemoCosts = variants.some(v => v.withPromo.demoHoursCost);

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
              <div className={styles.plStatement}>
                <div className={styles.plRow}>
                  <span className={styles.plLabel}>Retail Price</span>
                  <span className={styles.plValue}>${variantData.retailPrice}</span>
                </div>
                <div className={clsx(styles.plRow, styles.plCostRow)}>
                  <span className={styles.plLabel}>Less: CPU</span>
                  <span className={styles.plValue}>({variantData.withoutPromo.cpu})</span>
                </div>
                {variantData.wholesaleCost && (
                  <div className={clsx(styles.plRow, styles.plCostRow)}>
                    <span className={styles.plLabel}>Less: Wholesale Cost</span>
                    <span className={styles.plValue}>({variantData.wholesaleCost})</span>
                  </div>
                )}
                <div className={clsx(styles.plRow, styles.plDivider, styles.plDividerWithTopLine)}>
                  <Tooltip
                    content="Revenue minus direct costs. This is what's left before operating expenses."
                    position="right"
                  >
                    <span className={styles.plLabel}>Gross Profit</span>
                  </Tooltip>
                  <span className={styles.plValue}>${variantData.withoutPromo.grossProfit}</span>
                </div>
                <div className={clsx(styles.plRow, styles.plMarginRow)}>
                  <Tooltip
                    content="Percentage of each sale that becomes profit after all costs. Higher is better."
                    position="right"
                  >
                    <span className={styles.plLabel}>Margin %</span>
                  </Tooltip>
                  <span
                    className={clsx(
                      styles.plValue,
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
              <div className={styles.plStatement}>
                <div className={styles.plRow}>
                  <span className={styles.plLabel}>Retail Price</span>
                  <span className={styles.plValue}>${variantData.retailPrice}</span>
                </div>
                <div className={clsx(styles.plRow, styles.plCostRow)}>
                  <span className={styles.plLabel}>Less: CPU</span>
                  <span className={styles.plValue}>({variantData.withPromo.cpu})</span>
                </div>
                <div className={clsx(styles.plRow, styles.plCostRow)}>
                  <span className={styles.plLabel}>Less: Sales Promo Cost</span>
                  <span className={styles.plValue}>({variantData.withPromo.salesPromoCost})</span>
                </div>
                {variantData.withPromo.demoHoursCost && (
                  <div className={clsx(styles.plRow, styles.plCostRow)}>
                    <Tooltip
                      content="Demo labor costs assume all units sell. If fewer units sell, your per-unit labor cost will be higher."
                      position="right"
                    >
                      <span className={styles.plLabel}>
                        Less: Demo Labor Cost<span className={styles.asterisk}>*</span>
                      </span>
                    </Tooltip>
                    <span className={styles.plValue}>({variantData.withPromo.demoHoursCost})</span>
                  </div>
                )}
                {variantData.wholesaleCost && (
                  <div className={clsx(styles.plRow, styles.plCostRow)}>
                    <span className={styles.plLabel}>Less: Wholesale Cost</span>
                    <span className={styles.plValue}>({variantData.wholesaleCost})</span>
                  </div>
                )}
                <div className={clsx(styles.plRow, styles.plTotalCostRow)}>
                  <span className={styles.plLabel}>Total Costs</span>
                  <span className={styles.plValue}>${variantData.withPromo.totalCost}</span>
                </div>
                <div className={clsx(styles.plRow, styles.plDivider)}>
                  <Tooltip
                    content="Revenue minus direct costs. This is what's left before operating expenses."
                    position="right"
                  >
                    <span className={styles.plLabel}>Gross Profit</span>
                  </Tooltip>
                  <span className={styles.plValue}>${variantData.withPromo.grossProfit}</span>
                </div>
                <div className={clsx(styles.plRow, styles.plMarginRow)}>
                  <Tooltip
                    content="Percentage of each sale that becomes profit after all costs. Higher is better."
                    position="right"
                  >
                    <span className={styles.plLabel}>Margin %</span>
                  </Tooltip>
                  <span
                    className={clsx(
                      styles.plValue,
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
        </div>
      ))}
    </div>
  );
}
