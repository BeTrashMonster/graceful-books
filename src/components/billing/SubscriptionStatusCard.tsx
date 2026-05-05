/**
 * SubscriptionStatusCard Component
 *
 * Displays subscription status and allows pause/resume actions.
 */

import { useState } from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../core/Button';
import { Modal } from '../modals/Modal';
import { Alert } from '../feedback/ErrorMessage';
import { pauseSubscription, resumeSubscription } from '../../services/billing.api';
import type { Subscription } from '../../services/billing.api';
import styles from './SubscriptionStatusCard.module.css';

interface SubscriptionStatusCardProps {
  subscription: Subscription | null;
  onSubscriptionChange: () => void;
}

export function SubscriptionStatusCard({
  subscription,
  onSubscriptionChange,
}: SubscriptionStatusCardProps) {
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle pause subscription
   */
  const handlePause = async () => {
    setProcessing(true);
    setError(null);

    try {
      await pauseSubscription();
      setShowPauseModal(false);
      onSubscriptionChange();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pause subscription';
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Handle resume subscription
   */
  const handleResume = async () => {
    setProcessing(true);
    setError(null);

    try {
      await resumeSubscription();
      setShowResumeModal(false);
      onSubscriptionChange();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume subscription';
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <h2>Subscription Status</h2>
        </CardHeader>
        <CardBody>
          <p>No active subscription. Visit our pricing page to get started!</p>
        </CardBody>
      </Card>
    );
  }

  const isActive = subscription.status === 'active' || subscription.status === 'trial';
  const isPaused = subscription.status === 'paused';
  const isInGracePeriod = subscription.gracePeriodEndsAt !== null;
  const isBeta = subscription.isBeta;

  // Beta users get special treatment!
  if (isBeta) {
    return (
      <Card>
        <CardHeader>
          <h2>Subscription Status</h2>
        </CardHeader>
        <CardBody>
          <div className={styles.betaCard}>
            <div className={styles.betaHeader}>
              <h3 className={styles.productName}>{subscription.productName}</h3>
              <span className={`${styles.badge} ${styles.beta}`}>
                Beta - Free Forever
              </span>
            </div>
            <div className={styles.betaMessage}>
              <p>
                Thank you for being one of the first to believe in my big audacious goal!
                Your support and feedback mean the world to me. This tool is free for you, always.
              </p>
              <p className={styles.betaSignature}>
                With gratitude,<br />
                <strong>~ Audrey</strong>
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <h2>Subscription Status</h2>
        </CardHeader>
        <CardBody>
          <div className={styles.statusRow}>
            <div className={styles.statusInfo}>
              <h3 className={styles.productName}>{subscription.productName}</h3>
              <div className={styles.statusBadge}>
                <span className={`${styles.badge} ${styles[subscription.status]}`}>
                  {subscription.status === 'trial' && 'Trial'}
                  {subscription.status === 'active' && 'Active'}
                  {subscription.status === 'paused' && 'Paused'}
                </span>
              </div>
            </div>
            <div className={styles.priceInfo}>
              <span className={styles.price}>${subscription.priceMonthly}/month</span>
            </div>
          </div>

          {/* Trial Info */}
          {subscription.status === 'trial' && subscription.trialEndsAt && (
            <div className={styles.trialInfo}>
              <p>
                <strong>Free trial ends:</strong>{' '}
                {new Date(subscription.trialEndsAt).toLocaleDateString()}
              </p>
              <p className={styles.trialNote}>
                You won't be charged until your trial ends. Cancel anytime.
              </p>
            </div>
          )}

          {/* Next Billing Date for Active Subscriptions */}
          {subscription.status === 'active' && subscription.currentPeriodEnd && (
            <div className={styles.billingInfo}>
              <p>
                <strong>Next billing date:</strong>{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Grace Period Warning */}
          {isInGracePeriod && subscription.gracePeriodEndsAt && (
            <Alert variant="warning" className={styles.gracePeriodAlert}>
              <strong>Payment Issue - 3-Day Grace Period</strong>
              <p>
                We couldn't process your payment. You have full access until{' '}
                {new Date(subscription.gracePeriodEndsAt).toLocaleDateString()}. Please update your
                payment method to continue without interruption.
              </p>
            </Alert>
          )}

          {/* Paused Status Info */}
          {isPaused && (
            <div className={styles.pausedInfo}>
              <p>
                <strong>Subscription Paused</strong>
              </p>
              <p>
                You have view-only access to your data. Resume your subscription to unlock
                editing features.
              </p>
              {subscription.pausedAt && (
                <p className={styles.pausedDate}>
                  Paused on {new Date(subscription.pausedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            {/* TODO: Re-enable pause functionality post-launch after implementing full enforcement */}
            {/* {isActive && (
              <Button variant="secondary" onClick={() => setShowPauseModal(true)}>
                Pause Subscription
              </Button>
            )} */}
            {isPaused && (
              <Button variant="primary" onClick={() => setShowResumeModal(true)}>
                Resume Subscription
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Pause Confirmation Modal */}
      <Modal
        isOpen={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        title="Pause Subscription"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPauseModal(false)} disabled={processing}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handlePause} disabled={processing}>
              {processing ? 'Pausing...' : 'Pause Subscription'}
            </Button>
          </>
        }
      >
        <div className={styles.modalContent}>
          <p>
            When you pause your subscription, you'll keep full access to view all your data, but
            editing features will be temporarily unavailable.
          </p>

          <div className={styles.modalInfo}>
            <h4>What happens when you pause:</h4>
            <ul>
              <li>No more charges while paused</li>
              <li>View all your financial data anytime</li>
              <li>Export and download your records</li>
              <li>Editing features unavailable</li>
              <li>Resume anytime to unlock editing</li>
            </ul>
          </div>

          {error && <Alert variant="error">{error}</Alert>}
        </div>
      </Modal>

      {/* Resume Confirmation Modal */}
      <Modal
        isOpen={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        title="Resume Subscription"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowResumeModal(false)} disabled={processing}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleResume} disabled={processing}>
              {processing ? 'Resuming...' : 'Resume & Charge Card'}
            </Button>
          </>
        }
      >
        <div className={styles.modalContent}>
          <p>
            Welcome back! When you resume your subscription, we'll charge your card on file for the
            current billing period.
          </p>

          <div className={styles.modalInfo}>
            <h4>What happens when you resume:</h4>
            <ul>
              <li>Your card will be charged ${subscription.priceMonthly} immediately</li>
              <li>Monthly billing resumes</li>
              <li>Full editing access restored</li>
              <li>All features unlocked</li>
            </ul>
          </div>

          {error && <Alert variant="error">{error}</Alert>}
        </div>
      </Modal>
    </>
  );
}
