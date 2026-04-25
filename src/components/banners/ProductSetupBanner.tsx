/**
 * Product Setup Banner
 *
 * Prominent call-to-action for users who skipped product setup during signup
 * Displayed at top of CPG dashboard until dismissed or completed
 */

import { useState, useEffect } from 'react';
import styles from './ProductSetupBanner.module.css';

interface ProductSetupBannerProps {
  onStartSetup: () => void;
}

export function ProductSetupBanner({ onStartSetup }: ProductSetupBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has completed or permanently dismissed setup
    const status = localStorage.getItem('cpg_worksheet_status');
    const dismissed = localStorage.getItem('cpg_setup_banner_dismissed');

    // Show banner if setup was skipped and banner hasn't been permanently dismissed
    if (status === 'skipped' && dismissed !== 'true') {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handlePermanentDismiss = () => {
    localStorage.setItem('cpg_setup_banner_dismissed', 'true');
    setIsVisible(false);
  };

  const handleStart = () => {
    onStartSetup();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <div className={styles.icon}>📝</div>
        <div className={styles.message}>
          <h3 className={styles.title}>Complete Your Product Setup</h3>
          <p className={styles.description}>
            Get the most out of your CPG toolkit by adding your products, recipes, and costs.
            It only takes 5-10 minutes!
          </p>
        </div>
        <div className={styles.actions}>
          <button onClick={handleStart} className={styles.primaryButton}>
            Set Up Now
          </button>
          <div className={styles.dismissButtons}>
            <button onClick={handleDismiss} className={styles.dismissButton}>
              Remind Me Later
            </button>
            <button onClick={handlePermanentDismiss} className={styles.dismissButton}>
              Don't Show Again
            </button>
          </div>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className={styles.closeButton}
        aria-label="Close banner"
      >
        ✕
      </button>
    </div>
  );
}
