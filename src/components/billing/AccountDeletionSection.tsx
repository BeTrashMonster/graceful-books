/**
 * AccountDeletionSection Component
 *
 * Allows users to permanently delete their account.
 * This is the nuclear option - pause subscription is the gentler alternative.
 */

import { useState } from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../core/Button';
import { Modal } from '../modals/Modal';
import { Alert } from '../feedback/ErrorMessage';
import { deleteAccount } from '../../services/billing.api';
import styles from './AccountDeletionSection.module.css';

interface AccountDeletionSectionProps {
  onAccountDeleted: () => void;
}

export function AccountDeletionSection({ onAccountDeleted }: AccountDeletionSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle account deletion
   */
  const handleDelete = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteAccount({
        password,
        confirmText,
      });

      // Close modal and notify parent
      setShowModal(false);
      onAccountDeleted();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete account';
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Reset modal
   */
  const handleCloseModal = () => {
    setPassword('');
    setConfirmText('');
    setError(null);
    setShowModal(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className={styles.dangerTitle}>Delete Account</h2>
        </CardHeader>
        <CardBody>
          <div className={styles.warningBox}>
            <div className={styles.warningIcon}>⚠️</div>
            <div className={styles.warningContent}>
              <h3>This action is permanent and cannot be undone</h3>
              <p>
                Before deleting your account, consider pausing your subscription instead. When
                paused, you keep full access to view your data but won't be charged.
              </p>
            </div>
          </div>

          <div className={styles.details}>
            <h4>What happens when you delete your account:</h4>
            <ul>
              <li>Your account and profile information will be permanently deleted</li>
              <li>All active subscriptions will be cancelled</li>
              <li>Your local financial data remains on your device (delete manually if needed)</li>
              <li>
                Some financial records may be retained for 7 years as required by accounting
                standards and legal compliance
              </li>
            </ul>
          </div>

          <div className={styles.alternativeBox}>
            <strong>Looking for a temporary break?</strong>
            <p>
              Instead of deleting your account, you can pause your subscription above. This keeps
              your data safe and accessible while stopping all charges.
            </p>
          </div>

          <Button variant="danger" onClick={() => setShowModal(true)}>
            Delete Account Permanently
          </Button>
        </CardBody>
      </Card>

      {/* Deletion Confirmation Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title="Delete Your Account"
        size="md"
        headerStyle={{ color: '#dc2626' }}
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Account Permanently'}
            </Button>
          </>
        }
      >
        <div className={styles.modalContent}>
          <p className={styles.modalWarning}>
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

          {error && <Alert variant="error">{error}</Alert>}

          <div className={styles.formGroup}>
            <label htmlFor="delete-password" className={styles.label}>
              Enter your password:
            </label>
            <input
              id="delete-password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={deleting}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
