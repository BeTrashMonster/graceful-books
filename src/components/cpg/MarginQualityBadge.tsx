import clsx from 'clsx';
import styles from './MarginQualityBadge.module.css';

export interface MarginQualityBadgeProps {
  /**
   * Margin quality (determines color)
   */
  quality: 'gutCheck' | 'good' | 'better' | 'best';
  /**
   * Margin percentage value
   */
  marginPercentage: string;
  /**
   * Optional label to display instead of quality
   */
  label?: string;
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * MarginQualityBadge Component
 *
 * Displays color-coded profit margin indicator with WCAG 2.1 AA compliance.
 *
 * Color coding (user-configurable defaults):
 * - Gut Check (Red): < 50% - Use with caution, margins too low
 * - Good (Blue): 50-60% - Acceptable margins
 * - Better (Green): 60-70% - Strong margins
 * - Best (Dark Green): >= 70% - Excellent margins
 *
 * Accessibility features:
 * - Color + text/icon (not color alone)
 * - 3:1 contrast ratio minimum
 * - Screen reader labels
 *
 * Requirements: Group C2 - Distribution Cost Analyzer
 *
 * @example
 * ```tsx
 * <MarginQualityBadge quality="best" marginPercentage="72.50" />
 * <MarginQualityBadge quality="gutCheck" marginPercentage="45.00" size="lg" />
 * ```
 */
export function MarginQualityBadge({
  quality,
  marginPercentage,
  label,
  size = 'md',
}: MarginQualityBadgeProps) {
  const qualityLabels = {
    gutCheck: 'Gut Check',
    good: 'Good',
    better: 'Better',
    best: 'Best',
  };

  const qualityIcons = {
    gutCheck: '⚠',
    good: '○',
    better: '◐',
    best: '●',
  };

  const qualityDescriptions = {
    gutCheck: 'Below 50% - Use caution, margins are low',
    good: '50-60% - Acceptable profit margin',
    better: '60-70% - Strong profit margin',
    best: '70%+ - Excellent profit margin',
  };

  const displayLabel = label || qualityLabels[quality];

  return (
    <div
      className={clsx(
        styles.badge,
        styles[quality],
        styles[size]
      )}
      role="status"
      aria-label={`Profit margin: ${marginPercentage}%, ${qualityDescriptions[quality]}`}
    >
      <span className={styles.icon} aria-hidden="true">
        {qualityIcons[quality]}
      </span>
      <span className={styles.content}>
        <span className={styles.percentage}>{marginPercentage}%</span>
        <span className={styles.label}>{displayLabel}</span>
      </span>
    </div>
  );
}
