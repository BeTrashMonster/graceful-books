/**
 * Section Transition Component
 *
 * Displays smooth transitions between assessment sections.
 * Provides visual feedback and context as users progress through sections.
 *
 * Per ONB-002: Smooth section transitions with progress feedback
 */

import styles from './SectionTransition.module.css';

export interface SectionTransitionProps {
  /**
   * Name of the section being transitioned to
   */
  sectionName: string;
  /**
   * Current progress percentage
   */
  progress: number;
}

/**
 * SectionTransition component
 *
 * Features:
 * - Fade in/out animations
 * - Progress indicator
 * - Encouraging messaging
 * - WCAG 2.1 AA compliance
 * - Reduced motion support
 */
export function SectionTransition({
  sectionName,
  progress,
}: SectionTransitionProps) {
  return (
    <div
      className={styles.transitionContainer}
      role="status"
      aria-live="polite"
      aria-label={`Moving to ${sectionName} section`}
      data-testid="section-transition"
    >
      <div className={styles.transitionContent}>
        {/* Animated Icon */}
        <div className={styles.iconContainer} aria-hidden="true">
          <div className={styles.iconCircle}>
            <svg
              className={styles.checkIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className={styles.ripple} />
          <div className={styles.ripple} style={{ animationDelay: '0.3s' }} />
        </div>

        {/* Section Message */}
        <h2 className={styles.sectionTitle}>Moving to {sectionName}</h2>
        <p className={styles.progressMessage}>
          You're {progress}% through - keep up the great work!
        </p>

        {/* Loading Dots */}
        <div className={styles.loadingDots} aria-hidden="true">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      </div>
    </div>
  );
}

SectionTransition.displayName = 'SectionTransition';
