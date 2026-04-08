/**
 * ReadOnlyBanner Component
 *
 * Displays a prominent banner when user's subscription is paused
 * or in grace period, explaining their access level.
 */

import { Link } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';
import styles from './ReadOnlyBanner.module.css';

export function ReadOnlyBanner() {
  const { subscription, isReadOnly, isInGracePeriod } = useSubscription();

  // Don't show banner if subscription is active
  if (!subscription || (!isReadOnly && !isInGracePeriod)) {
    return null;
  }

  // Grace period warning (payment failed, but still have full access)
  if (isInGracePeriod && subscription.gracePeriodEndsAt) {
    const gracePeriodEnd = new Date(subscription.gracePeriodEndsAt);
    const daysRemaining = Math.ceil(
      (gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return (
      <div className={`${styles.banner} ${styles.warning}`} role="alert">
        <div className={styles.icon}>⚠️</div>
        <div className={styles.content}>
          <strong>Payment Issue - {daysRemaining} Day Grace Period</strong>
          <p>
            We couldn't process your payment. You have full access until{' '}
            {gracePeriodEnd.toLocaleDateString()}.{' '}
            <Link to="/billing" className={styles.link}>
              Update your payment method
            </Link>{' '}
            to continue without interruption.
          </p>
        </div>
      </div>
    );
  }

  // Read-only mode (subscription paused or expired)
  if (isReadOnly) {
    return (
      <div className={`${styles.banner} ${styles.paused}`} role="alert">
        <div className={styles.icon}>🔒</div>
        <div className={styles.content}>
          <strong>Read-Only Mode</strong>
          <p>
            Your subscription is paused. You can view all your data, but editing features are
            temporarily unavailable.{' '}
            <Link to="/billing" className={styles.link}>
              Activate your subscription
            </Link>{' '}
            to unlock editing.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
