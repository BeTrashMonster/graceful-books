/**
 * Feature Activation Banner + Modal
 *
 * Shows a modal first when user navigates to an inactive feature page.
 * If they dismiss the modal, the banner remains visible at the top.
 * Allows users to explore the feature first, then decide to activate.
 *
 * UX: "Let them explore and see it first" approach
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import { UserFeaturePreferencesService, type FeatureName } from '../../services/userFeaturePreferences.service';
import styles from './FeatureActivationBanner.module.css';

interface FeatureActivationBannerProps {
  featureName: FeatureName;
  featureDisplayName: string;
}

export function FeatureActivationBanner({ featureName, featureDisplayName }: FeatureActivationBannerProps) {
  // Use userIdentifier (email) as userId - consistent with CPGDashboard and CPGLayout
  const { userIdentifier: userId } = useAuth();
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Check if feature is active on mount
  useEffect(() => {
    const checkFeatureStatus = async () => {
      if (!userId) {
        setIsActive(true); // Don't show anything if no user (dev mode)
        return;
      }

      const prefsService = new UserFeaturePreferencesService(db);
      const active = await prefsService.isFeatureActive(userId, featureName);
      console.log(`[FeatureActivationBanner] Feature "${featureName}" active for user "${userId}":`, active);
      setIsActive(active);

      // If not active, show the modal first
      if (!active) {
        setShowModal(true);
      }
    };

    checkFeatureStatus();

    // Listen for updates from other components (e.g., Settings page)
    const handleUpdate = (e: CustomEvent<{ featureName: string; newState: boolean }>) => {
      if (e.detail.featureName === featureName) {
        setIsActive(e.detail.newState);
        if (e.detail.newState) {
          // Feature was activated elsewhere, hide everything
          setShowModal(false);
          setShowBanner(false);
        }
      }
    };

    window.addEventListener('feature-preferences-updated', handleUpdate as EventListener);
    return () => {
      window.removeEventListener('feature-preferences-updated', handleUpdate as EventListener);
    };
  }, [userId, featureName]);

  const handleActivate = async () => {
    if (!userId) return;

    setIsActivating(true);
    try {
      const prefsService = new UserFeaturePreferencesService(db);
      await prefsService.activateFeature(userId, featureName);
      setIsActive(true);
      setShowModal(false);
      setShowBanner(false);

      // Notify sidebar and other components
      window.dispatchEvent(new CustomEvent('feature-preferences-updated', {
        detail: { featureName, newState: true }
      }));
    } catch (err) {
      console.error('Failed to activate feature:', err);
    } finally {
      setIsActivating(false);
    }
  };

  const handleModalDismiss = () => {
    // Close modal but show the banner
    setShowModal(false);
    setShowBanner(true);
  };

  const handleBannerDismiss = () => {
    setShowBanner(false);
  };

  // Don't render if: still loading or already active
  if (isActive === null || isActive) {
    return null;
  }

  return (
    <>
      {/* Modal - shows first */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <h2 className={styles.modalTitle}>You're exploring {featureDisplayName}</h2>
            <p className={styles.modalText}>
              This feature isn't active yet. Activate it to add it to your sidebar for quick access.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.dismissButton}
                onClick={handleModalDismiss}
              >
                Maybe Later
              </button>
              <button
                className={styles.activateButton}
                onClick={handleActivate}
                disabled={isActivating}
              >
                {isActivating ? 'Activating...' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner - shows after modal is dismissed */}
      {showBanner && (
        <div className={styles.banner}>
          <div className={styles.content}>
            <div className={styles.icon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <div className={styles.text}>
              <span className={styles.title}>You're exploring {featureDisplayName}</span>
              <span className={styles.subtitle}>
                This feature isn't active yet. Activate it to add it to your sidebar for quick access.
              </span>
            </div>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.dismissButton}
              onClick={handleBannerDismiss}
            >
              Maybe Later
            </button>
            <button
              className={styles.activateButton}
              onClick={handleActivate}
              disabled={isActivating}
            >
              {isActivating ? 'Activating...' : 'Activate'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
