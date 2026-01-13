/**
 * UnlockNotification Component
 *
 * Celebrates when a user unlocks new features by transitioning to a new phase.
 * Uses Steadiness communication style - encouraging without being condescending.
 *
 * Requirements:
 * - PFD-001: Feature visibility rules by phase
 * - PFD-002: UI adaptation based on phase
 * - WCAG 2.1 AA: Accessible notifications
 */

import { useEffect, useState } from 'react';
import type { FeatureId } from '../../features/phaseVisibility/types';
import { getFeatureMetadata } from '../../features/phaseVisibility/visibilityRules';
import './UnlockNotification.css';

export interface UnlockNotificationProps {
  /** Feature that was unlocked */
  featureId: FeatureId;

  /** Whether notification is visible */
  show: boolean;

  /** Callback when dismissed */
  onDismiss: () => void;

  /** Callback when user clicks to explore feature */
  onExplore?: () => void;

  /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
  duration?: number;
}

/**
 * UnlockNotification - Celebrates feature unlocks
 *
 * @example
 * ```tsx
 * <UnlockNotification
 *   featureId="invoicing"
 *   show={showUnlock}
 *   onDismiss={() => setShowUnlock(false)}
 *   onExplore={() => navigate('/invoices')}
 *   duration={5000}
 * />
 * ```
 */
export function UnlockNotification({
  featureId,
  show,
  onDismiss,
  onExplore,
  duration = 5000,
}: UnlockNotificationProps) {
  const [isVisible, setIsVisible] = useState(show);
  const [isExiting, setIsExiting] = useState(false);

  const metadata = getFeatureMetadata(featureId);

  // Auto-dismiss after duration
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  // Sync with show prop
  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsExiting(false);
    }
  }, [show]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 300); // Match CSS animation duration
  };

  const handleExplore = () => {
    if (onExplore) {
      onExplore();
    }
    handleDismiss();
  };

  if (!isVisible || !metadata) {
    return null;
  }

  return (
    <div
      className={`unlock-notification ${isExiting ? 'unlock-notification--exiting' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="unlock-notification__content">
        <div className="unlock-notification__icon" aria-hidden="true">
          ✨
        </div>

        <div className="unlock-notification__text">
          <h3 className="unlock-notification__title">
            New feature unlocked!
          </h3>
          <p className="unlock-notification__message">
            You're ready for <strong>{metadata.name}</strong>. {metadata.description}
          </p>
        </div>

        <div className="unlock-notification__actions">
          {onExplore && metadata.route && (
            <button
              type="button"
              className="unlock-notification__button unlock-notification__button--primary"
              onClick={handleExplore}
              aria-label={`Explore ${metadata.name}`}
            >
              Explore now
            </button>
          )}
          <button
            type="button"
            className="unlock-notification__button unlock-notification__button--secondary"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            Got it!
          </button>
        </div>
      </div>

      <button
        type="button"
        className="unlock-notification__close"
        onClick={handleDismiss}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

/**
 * UnlockNotificationBatch - Shows multiple feature unlocks at once
 */
export interface UnlockNotificationBatchProps {
  /** Features that were unlocked */
  featureIds: FeatureId[];

  /** Whether notification is visible */
  show: boolean;

  /** Callback when dismissed */
  onDismiss: () => void;

  /** Callback when user clicks to explore a feature */
  onExplore?: (featureId: FeatureId) => void;

  /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
  duration?: number;
}

/**
 * UnlockNotificationBatch - Shows multiple unlocked features
 *
 * @example
 * ```tsx
 * <UnlockNotificationBatch
 *   featureIds={['categories', 'tags', 'reconciliation']}
 *   show={showUnlocks}
 *   onDismiss={() => setShowUnlocks(false)}
 *   duration={7000}
 * />
 * ```
 */
export function UnlockNotificationBatch({
  featureIds,
  show,
  onDismiss,
  onExplore,
  duration = 7000,
}: UnlockNotificationBatchProps) {
  const [isVisible, setIsVisible] = useState(show);
  const [isExiting, setIsExiting] = useState(false);

  // Auto-dismiss after duration
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  // Sync with show prop
  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsExiting(false);
    }
  }, [show]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 300);
  };

  if (!isVisible || featureIds.length === 0) {
    return null;
  }

  const features = featureIds
    .map((id) => getFeatureMetadata(id))
    .filter((f): f is NonNullable<typeof f> => f !== undefined);

  const count = features.length;

  return (
    <div
      className={`unlock-notification unlock-notification--batch ${isExiting ? 'unlock-notification--exiting' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="unlock-notification__content">
        <div className="unlock-notification__icon" aria-hidden="true">
          🎉
        </div>

        <div className="unlock-notification__text">
          <h3 className="unlock-notification__title">
            {count} {count === 1 ? 'feature' : 'features'} unlocked!
          </h3>
          <p className="unlock-notification__message">
            You've leveled up! Here's what's now available:
          </p>

          <ul className="unlock-notification__list">
            {features.map((feature) => (
              <li key={feature.id} className="unlock-notification__list-item">
                <strong>{feature.name}</strong>
                {onExplore && feature.route && (
                  <button
                    type="button"
                    className="unlock-notification__explore-link"
                    onClick={() => {
                      onExplore(feature.id);
                      handleDismiss();
                    }}
                    aria-label={`Explore ${feature.name}`}
                  >
                    Explore →
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="unlock-notification__actions">
          <button
            type="button"
            className="unlock-notification__button unlock-notification__button--primary"
            onClick={handleDismiss}
          >
            Got it!
          </button>
        </div>
      </div>

      <button
        type="button"
        className="unlock-notification__close"
        onClick={handleDismiss}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}
