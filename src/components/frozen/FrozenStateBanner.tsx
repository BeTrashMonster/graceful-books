/**
 * FrozenStateBanner Component
 *
 * PURPOSE:
 * Persistent banner displayed at top of app when account is frozen.
 * Provides clear, non-alarming messaging about account status and CTA to reactivate.
 *
 * DESIGN:
 * - Uses brand colors (burgundy/rust) for visibility without being alarming
 * - Fixed position at top of viewport
 * - Accessible (proper ARIA attributes)
 * - Responsive design
 *
 * @module components/frozen/FrozenStateBanner
 */

import { useFrozenState, type FrozenReason } from '../../contexts/FrozenStateContext';
import styles from './FrozenStateBanner.module.css';

// =============================================================================
// MESSAGE CONFIGURATION
// =============================================================================

interface MessageConfig {
  title: string;
  message: string;
  ctaText: string;
}

/**
 * User-friendly messages for each frozen reason
 * Tone: Supportive, not punitive. Focus on the path forward.
 */
const FROZEN_MESSAGES: Record<FrozenReason, MessageConfig> = {
  workshop_trial_expired: {
    title: 'Your Trial Has Ended',
    message: 'Your data is safe. Subscribe to continue building your financial foundation.',
    ctaText: 'Continue Your Journey',
  },
  subscription_trial_expired: {
    title: 'Your Trial Has Ended',
    message: 'Your data is safe. Subscribe to continue building your financial foundation.',
    ctaText: 'Continue Your Journey',
  },
  subscription_cancelled: {
    title: 'Your Subscription Has Ended',
    message: 'Your data is safe and waiting. Reactivate anytime to pick up where you left off.',
    ctaText: 'Reactivate',
  },
  subscription_expired: {
    title: 'Your Subscription Has Expired',
    message: 'Your data is safe. Renew to continue building your financial foundation.',
    ctaText: 'Renew',
  },
  payment_failed: {
    title: 'Payment Issue',
    message: 'We couldn\'t process your payment. Update your payment method to continue.',
    ctaText: 'Update Payment',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Main frozen state banner - shows at top of all pages when account is frozen
 */
export function FrozenStateBanner() {
  const { isFrozen, frozenReason, openReactivationFlow, isLoading } = useFrozenState();

  // Don't render while loading or if not frozen
  if (isLoading || !isFrozen || !frozenReason) {
    return null;
  }

  const config = FROZEN_MESSAGES[frozenReason];

  return (
    <div
      className={styles.banner}
      role="alert"
      aria-live="polite"
      data-testid="frozen-state-banner"
    >
      <div className={styles.container}>
        {/* Lock icon */}
        <div className={styles.iconWrapper} aria-hidden="true">
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Content */}
        <div className={styles.content}>
          <strong className={styles.title}>{config.title}</strong>
          <p className={styles.message}>{config.message}</p>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          className={styles.ctaButton}
          onClick={openReactivationFlow}
          aria-label={`${config.ctaText} - reactivate your account`}
        >
          {config.ctaText}
          <svg
            className={styles.ctaIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Compact inline banner for use in specific sections (e.g., form headers)
 * Use this when you want a smaller, less prominent notice
 */
export function FrozenStateInlineBanner() {
  const { isFrozen, frozenReason, openReactivationFlow, isLoading } = useFrozenState();

  if (isLoading || !isFrozen || !frozenReason) {
    return null;
  }

  const config = FROZEN_MESSAGES[frozenReason];

  return (
    <div
      className={styles.inlineBanner}
      role="alert"
      data-testid="frozen-state-inline-banner"
    >
      <span className={styles.inlineMessage}>
        {config.title} - {config.message.split('.')[0]}.
      </span>
      <button
        type="button"
        className={styles.inlineButton}
        onClick={openReactivationFlow}
      >
        {config.ctaText}
      </button>
    </div>
  );
}
