/**
 * AccountManagementPanel Component
 *
 * Settings panel for managing account status (deactivation/deletion).
 * Provides controls for temporarily deactivating or permanently deleting account.
 *
 * Requirements:
 * - Password verification for security
 * - Clear warnings about consequences
 * - Steadiness communication style (patient, supportive)
 * - WCAG 2.1 AA compliance
 */

import { useState } from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../core/Button';
import { Modal } from '../modals/Modal';
import { Alert } from '../feedback/ErrorMessage';
import { deleteAccount, deactivateAccount } from '../../services/users.api';
import styles from './AccountManagementPanel.module.css';

interface AccountManagementPanelProps {
  onAccountDeleted?: () => void;
  onAccountDeactivated?: () => void;
}

export function AccountManagementPanel({
  onAccountDeleted,
  onAccountDeactivated,
}: AccountManagementPanelProps) {
  // Deactivation modal state
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * Handle account deactivation
   */
  const handleDeactivate = async () => {
    if (!deactivatePassword) {
      setDeactivateError('Please enter your password');
      return;
    }

    setDeactivating(true);
    setDeactivateError(null);

    try {
      await deactivateAccount({ password: deactivatePassword });

      // Close modal and notify parent
      setShowDeactivateModal(false);
      onAccountDeactivated?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to deactivate account. Please try again.';
      setDeactivateError(message);
    } finally {
      setDeactivating(false);
    }
  };

  /**
   * Handle account deletion
   */
  const handleDelete = async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your password');
      return;
    }

    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteAccount({
        password: deletePassword,
        confirmText: deleteConfirmText,
      });

      // Close modal and notify parent
      setShowDeleteModal(false);
      onAccountDeleted?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete account. Please try again.';
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Reset deactivation modal
   */
  const resetDeactivateModal = () => {
    setDeactivatePassword('');
    setDeactivateError(null);
    setShowDeactivateModal(false);
  };

  /**
   * Reset deletion modal
   */
  const resetDeleteModal = () => {
    setDeletePassword('');
    setDeleteConfirmText('');
    setDeleteError(null);
    setShowDeleteModal(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <h2>Account Management</h2>
          <p className={styles.description}>
            Manage your account status and data. Take your time with these decisions - we're here
            to support whatever works best for you.
          </p>
        </CardHeader>
        <CardBody>
          {/* Deactivation Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Deactivate Account</h3>
              <p className={styles.sectionDescription}>
                Need a break? Deactivating your account is temporary and reversible. You can come
                back anytime.
              </p>
            </div>

            <div className={styles.sectionDetails}>
              <h4 className={styles.detailsTitle}>What happens when you deactivate:</h4>
              <ul className={styles.detailsList}>
                <li>You won't be able to log in until you reactivate</li>
                <li>All active subscriptions will be cancelled</li>
                <li>Your account data is safely preserved</li>
                <li>Your local financial data remains on your device</li>
              </ul>

              <div className={styles.highlight}>
                <strong>Ready to come back?</strong> Simply log in with your email and password to
                reactivate instantly.
              </div>
            </div>

            <Button variant="secondary" onClick={() => setShowDeactivateModal(true)}>
              Deactivate Account
            </Button>
          </div>

          {/* Deletion Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Delete Account</h3>
              <p className={styles.sectionDescription}>
                This is permanent. Please make sure you've downloaded any data you need before
                proceeding.
              </p>
            </div>

            <div className={styles.sectionDetails}>
              <h4 className={styles.detailsTitle}>What happens when you delete:</h4>
              <ul className={styles.detailsList}>
                <li>Your account and profile information will be permanently deleted</li>
                <li>All active subscriptions will be cancelled</li>
                <li>Your local financial data remains on your device (delete manually if needed)</li>
                <li>
                  Some financial records may be retained for 7 years as required by accounting
                  standards
                </li>
              </ul>

              <div className={styles.warning}>
                <strong>This cannot be undone.</strong> You'll need to create a new account if you
                want to use Graceful Books again.
              </div>
            </div>

            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              Delete Account
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Deactivation Confirmation Modal */}
      <Modal
        isOpen={showDeactivateModal}
        onClose={resetDeactivateModal}
        title="Deactivate Your Account"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={resetDeactivateModal} disabled={deactivating}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? 'Deactivating...' : 'Deactivate Account'}
            </Button>
          </>
        }
      >
        <div className={styles.modalContent}>
          <p className={styles.modalDescription}>
            Take all the time you need - we'll be here when you're ready to come back.
          </p>

          <div className={styles.modalWarning}>
            <h4>What will happen:</h4>
            <ul>
              <li>Your account will be suspended immediately</li>
              <li>Active subscriptions will be cancelled</li>
              <li>All your data will be safely preserved</li>
              <li>You can reactivate by logging in anytime</li>
            </ul>
          </div>

          {deactivateError && (
            <Alert variant="error" className={styles.modalAlert}>
              {deactivateError}
            </Alert>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="deactivate-password" className={styles.label}>
              Enter your password to confirm:
            </label>
            <input
              id="deactivate-password"
              type="password"
              className={styles.input}
              value={deactivatePassword}
              onChange={(e) => setDeactivatePassword(e.target.value)}
              placeholder="Your password"
              disabled={deactivating}
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* Deletion Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={resetDeleteModal}
        title="Delete Your Account"
        size="md"
        headerStyle={{ color: '#dc2626' }}
        footer={
          <>
            <Button variant="secondary" onClick={resetDeleteModal} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Account Permanently'}
            </Button>
          </>
        }
      >
        <div className={styles.modalContent}>
          <p className={styles.modalDescription}>
            This action cannot be undone. Please make sure you've downloaded any data you need.
          </p>

          <div className={styles.modalDanger}>
            <h4>This will permanently:</h4>
            <ul>
              <li>Delete your account and profile</li>
              <li>Cancel all subscriptions</li>
              <li>Remove your data from our servers</li>
              <li>Require creating a new account to use Graceful Books again</li>
            </ul>
            <p>
              <strong>Note:</strong> Some financial records may be retained for 7 years as required
              by law.
            </p>
          </div>

          {deleteError && (
            <Alert variant="error" className={styles.modalAlert}>
              {deleteError}
            </Alert>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="delete-password" className={styles.label}>
              Enter your password:
            </label>
            <input
              id="delete-password"
              type="password"
              className={styles.input}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Your password"
              disabled={deleting}
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="delete-confirm" className={styles.label}>
              Type <strong>DELETE</strong> to confirm:
            </label>
            <input
              id="delete-confirm"
              type="text"
              className={styles.input}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={deleting}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
