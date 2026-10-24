/**
 * SubscriptionManagement Component
 *
 * Admin panel for managing user subscriptions.
 * Supports pause, resume, cancel, extend trial, grant/revoke access.
 */

import { useState } from 'react';
import { API_URL } from '../../../config/api';
import styles from './SubscriptionManagement.module.css';

export interface Subscription {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  status: string;
  activatedAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  pausedAt: string | null;
  cancelledAt: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  isComplimentary: boolean;
}

export interface SubscriptionManagementProps {
  userId: string;
  subscriptions: Subscription[];
  onRefresh: () => void;
}

// Alias for external use
export type SubscriptionData = Subscription;

type ModalType = 'pause' | 'cancel' | 'extend' | 'grant' | 'revoke' | null;

export function SubscriptionManagement({
  userId,
  subscriptions,
  onRefresh,
}: SubscriptionManagementProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [cancelReason, setCancelReason] = useState('');
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [extendDays, setExtendDays] = useState(7);
  const [grantProduct, setGrantProduct] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [grantExpires, setGrantExpires] = useState('');
  const [revokeReason, setRevokeReason] = useState('');

  const getSession = () => {
    const sessionData = sessionStorage.getItem('graceful_books_admin_session');
    return sessionData ? JSON.parse(sessionData) : null;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return styles.statusActive;
      case 'trialing':
        return styles.statusTrial;
      case 'paused':
        return styles.statusPaused;
      case 'cancelled':
      case 'canceled':
        return styles.statusCancelled;
      case 'frozen':
        return styles.statusFrozen;
      default:
        return styles.statusDefault;
    }
  };

  const handlePause = async () => {
    if (!selectedSubscription) return;
    const session = getSession();
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/subscriptions/${selectedSubscription.id}/pause`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to pause subscription');
      }

      setActiveModal(null);
      setSelectedSubscription(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async (subscription: Subscription) => {
    const session = getSession();
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/subscriptions/${subscription.id}/resume`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to resume subscription');
      }

      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedSubscription) return;
    const session = getSession();
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/subscriptions/${selectedSubscription.id}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify({
            reason: cancelReason,
            immediate: cancelImmediate,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to cancel subscription');
      }

      setActiveModal(null);
      setSelectedSubscription(null);
      setCancelReason('');
      setCancelImmediate(false);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtendTrial = async () => {
    if (!selectedSubscription) return;
    const session = getSession();
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/subscriptions/${selectedSubscription.id}/extend-trial`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify({ days: extendDays }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to extend trial');
      }

      setActiveModal(null);
      setSelectedSubscription(null);
      setExtendDays(7);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extend trial');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    const session = getSession();
    if (!session || !grantProduct) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/grant-access`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify({
            productSlug: grantProduct,
            reason: grantReason,
            expiresAt: grantExpires || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to grant access');
      }

      setActiveModal(null);
      setGrantProduct('');
      setGrantReason('');
      setGrantExpires('');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant access');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedSubscription) return;
    const session = getSession();
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/subscriptions/${selectedSubscription.id}/revoke`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify({ reason: revokeReason }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to revoke access');
      }

      setActiveModal(null);
      setSelectedSubscription(null);
      setRevokeReason('');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke access');
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (type: ModalType, subscription?: Subscription) => {
    setActiveModal(type);
    setSelectedSubscription(subscription || null);
    setError(null);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedSubscription(null);
    setError(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Subscriptions</h3>
        <button
          type="button"
          className={styles.grantButton}
          onClick={() => openModal('grant')}
        >
          + Grant Access
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {subscriptions.length === 0 ? (
        <p className={styles.emptyState}>No subscriptions</p>
      ) : (
        <div className={styles.subscriptionList}>
          {subscriptions.map((sub) => (
            <div key={sub.id} className={styles.subscriptionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.productName}>{sub.productName}</span>
                <span className={`${styles.status} ${getStatusColor(sub.status)}`}>
                  {sub.status.toUpperCase()}
                </span>
              </div>

              <div className={styles.cardDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Activated:</span>
                  <span>{formatDate(sub.activatedAt)}</span>
                </div>
                {sub.currentPeriodEnd && (
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Period ends:</span>
                    <span>{formatDate(sub.currentPeriodEnd)}</span>
                  </div>
                )}
                {sub.pausedAt && (
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Paused:</span>
                    <span>{formatDate(sub.pausedAt)}</span>
                  </div>
                )}
                {sub.isComplimentary && (
                  <div className={styles.detailRow}>
                    <span className={styles.complimentaryBadge}>Complimentary</span>
                  </div>
                )}
                {sub.stripeSubscriptionId && (
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Stripe:</span>
                    <span className={styles.stripeId}>{sub.stripeSubscriptionId}</span>
                  </div>
                )}
              </div>

              <div className={styles.cardActions}>
                {sub.status === 'active' && (
                  <>
                    <button
                      type="button"
                      className={styles.actionButton}
                      onClick={() => openModal('pause', sub)}
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionButton} ${styles.danger}`}
                      onClick={() => openModal('cancel', sub)}
                    >
                      Cancel
                    </button>
                  </>
                )}
                {sub.status === 'trialing' && (
                  <>
                    <button
                      type="button"
                      className={styles.actionButton}
                      onClick={() => openModal('extend', sub)}
                    >
                      Extend Trial
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionButton} ${styles.danger}`}
                      onClick={() => openModal('cancel', sub)}
                    >
                      Cancel
                    </button>
                  </>
                )}
                {sub.status === 'paused' && (
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.success}`}
                    onClick={() => handleResume(sub)}
                    disabled={isLoading}
                  >
                    Resume
                  </button>
                )}
                {sub.isComplimentary && sub.status === 'active' && (
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.danger}`}
                    onClick={() => openModal('revoke', sub)}
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pause Modal */}
      {activeModal === 'pause' && selectedSubscription && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Pause Subscription</h3>
            <p>
              Pause <strong>{selectedSubscription.productName}</strong> for this user?
              They will not have access while paused.
            </p>
            <div className={styles.modalActions}>
              <button type="button" onClick={closeModal}>Cancel</button>
              <button
                type="button"
                className={styles.warning}
                onClick={handlePause}
                disabled={isLoading}
              >
                {isLoading ? 'Pausing...' : 'Pause Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {activeModal === 'cancel' && selectedSubscription && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Cancel Subscription</h3>
            <div className={styles.formGroup}>
              <label>Reason</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
              />
            </div>
            <div className={styles.checkboxGroup}>
              <label>
                <input
                  type="checkbox"
                  checked={cancelImmediate}
                  onChange={(e) => setCancelImmediate(e.target.checked)}
                />
                Cancel immediately (otherwise cancels at period end)
              </label>
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={closeModal}>Back</button>
              <button
                type="button"
                className={styles.danger}
                onClick={handleCancel}
                disabled={isLoading || !cancelReason.trim()}
              >
                {isLoading ? 'Cancelling...' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Trial Modal */}
      {activeModal === 'extend' && selectedSubscription && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Extend Trial</h3>
            <div className={styles.formGroup}>
              <label>Extend by (days)</label>
              <input
                type="number"
                value={extendDays}
                onChange={(e) => setExtendDays(parseInt(e.target.value) || 7)}
                min={1}
                max={365}
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={closeModal}>Cancel</button>
              <button
                type="button"
                className={styles.primary}
                onClick={handleExtendTrial}
                disabled={isLoading}
              >
                {isLoading ? 'Extending...' : `Extend by ${extendDays} days`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grant Access Modal */}
      {activeModal === 'grant' && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Grant Product Access</h3>
            <div className={styles.formGroup}>
              <label>Product</label>
              <select
                value={grantProduct}
                onChange={(e) => setGrantProduct(e.target.value)}
              >
                <option value="">Select a product...</option>
                <option value="cpu-cpg-calculator">CPU/CPG Calculator</option>
                <option value="bookkeeping-suite">Bookkeeping Suite</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Reason</label>
              <textarea
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="Why is access being granted?"
                rows={2}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Expires (optional)</label>
              <input
                type="date"
                value={grantExpires}
                onChange={(e) => setGrantExpires(e.target.value)}
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={closeModal}>Cancel</button>
              <button
                type="button"
                className={styles.primary}
                onClick={handleGrantAccess}
                disabled={isLoading || !grantProduct}
              >
                {isLoading ? 'Granting...' : 'Grant Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {activeModal === 'revoke' && selectedSubscription && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Revoke Access</h3>
            <p className={styles.warning}>
              This will immediately revoke access to <strong>{selectedSubscription.productName}</strong>.
            </p>
            <div className={styles.formGroup}>
              <label>Reason</label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Why is access being revoked?"
                rows={2}
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={closeModal}>Cancel</button>
              <button
                type="button"
                className={styles.danger}
                onClick={handleRevoke}
                disabled={isLoading || !revokeReason.trim()}
              >
                {isLoading ? 'Revoking...' : 'Revoke Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
