/**
 * FrozenStateModal Component
 *
 * PURPOSE:
 * Modal shown when user attempts a write action while account is frozen.
 * Provides friendly explanation and options (export data, reactivate).
 *
 * TRIGGERS:
 * - useFrozenGuard().checkCanWrite() returns false
 * - Backend returns ACCOUNT_FROZEN error
 * - Direct call to openReactivationFlow()
 *
 * @module components/frozen/FrozenStateModal
 */

import { useFrozenState, type FrozenReason } from '../../contexts/FrozenStateContext';
import { Modal } from '../modals/Modal';
import styles from './FrozenStateModal.module.css';

// =============================================================================
// MESSAGE CONFIGURATION
// =============================================================================

interface ModalConfig {
  title: string;
  explanation: string;
  encouragement: string;
}

/**
 * User-friendly modal content for each frozen reason
 */
const MODAL_CONTENT: Record<FrozenReason, ModalConfig> = {
  workshop_trial_expired: {
    title: 'Your Trial Period Has Ended',
    explanation: 'You\'ve been exploring what organized finances can look like. To continue adding transactions and building your financial picture, let\'s set up your subscription.',
    encouragement: 'Your data is completely safe and will be here when you\'re ready.',
  },
  subscription_trial_expired: {
    title: 'Your Trial Period Has Ended',
    explanation: 'You\'ve been exploring what organized finances can look like. To continue adding transactions and building your financial picture, let\'s set up your subscription.',
    encouragement: 'Your data is completely safe and will be here when you\'re ready.',
  },
  subscription_cancelled: {
    title: 'Your Subscription Has Ended',
    explanation: 'Your subscription is no longer active. To continue managing your finances and adding new records, you\'ll need to reactivate.',
    encouragement: 'All your data is preserved and waiting for you.',
  },
  subscription_expired: {
    title: 'Your Subscription Has Expired',
    explanation: 'Your subscription period has ended. Renew to continue building your financial foundation.',
    encouragement: 'Everything you\'ve entered is safe and sound.',
  },
  payment_failed: {
    title: 'We Couldn\'t Process Your Payment',
    explanation: 'There was an issue with your payment method. Please update your payment information to continue.',
    encouragement: 'Your data is safe - just a quick update and you\'ll be back on track.',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function FrozenStateModal() {
  const {
    frozenReason,
    isFrozenModalVisible,
    dismissFrozenModal,
    openReactivationFlow,
  } = useFrozenState();

  // Don't render if modal should not be visible
  if (!isFrozenModalVisible || !frozenReason) {
    return null;
  }

  const config = MODAL_CONTENT[frozenReason];

  const handleExportData = () => {
    dismissFrozenModal(); // Close modal first

    // Detect if user is in CPG context (workshop users are CPG users)
    const isCPGContext = window.location.pathname.startsWith('/cpg');

    // Navigate to the appropriate settings page
    // CPG settings already includes DataSafetyPanel
    const settingsPath = isCPGContext ? '/cpg/settings' : '/account/settings';

    // Navigate and then scroll to Data Safety after page loads
    window.location.href = settingsPath;

    // Store scroll target in sessionStorage for the settings page to handle
    sessionStorage.setItem('scrollToSection', 'data-safety');
  };

  const handleReactivate = () => {
    // Open the reactivation flow (charity confirmation → payment)
    // This will also dismiss this modal via openReactivationFlow
    openReactivationFlow();
  };

  return (
    <Modal
      isOpen={true}
      onClose={dismissFrozenModal}
      size="md"
      showCloseButton={true}
      closeOnBackdropClick={true}
      closeOnEscape={true}
    >
      <div className={styles.container} data-testid="frozen-state-modal">
        {/* Icon */}
        <div className={styles.iconWrapper}>
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Title */}
        <h2 className={styles.title}>{config.title}</h2>

        {/* Explanation */}
        <p className={styles.explanation}>{config.explanation}</p>

        {/* Encouragement */}
        <p className={styles.encouragement}>{config.encouragement}</p>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleReactivate}
          >
            Continue to Reactivate
          </button>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleExportData}
          >
            Export My Data
          </button>
        </div>

        {/* Dismissive action */}
        <button
          type="button"
          className={styles.dismissButton}
          onClick={dismissFrozenModal}
        >
          I'll do this later
        </button>
      </div>
    </Modal>
  );
}
