/**
 * CharityDistribution Component
 *
 * Admin workflow for managing charity payment distributions.
 * Allows admin to mark payments as sent and confirmed.
 *
 * Requirements:
 * - IC2.5: Charity Payment Distribution System
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect } from 'react';
import {
  getDistributionsForMonth,
  markPaymentSent,
  confirmPayment,
  getUnpaidDistributions,
  type MarkPaymentSentInput,
  type ConfirmPaymentInput,
} from '../../services/admin/charityDistribution.service';
import type { CharityDistribution as Distribution } from '../../types/billing.types';
import styles from './CharityDistribution.module.css';

interface CharityDistributionProps {
  month?: string; // Optional month to filter by
  onDistributionUpdated?: () => void;
}

export function CharityDistribution({
  month,
  onDistributionUpdated,
}: CharityDistributionProps) {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistribution, setSelectedDistribution] = useState<Distribution | null>(
    null
  );
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  // Load distributions
  useEffect(() => {
    loadDistributions();
  }, [month, showOverdueOnly]);

  const loadDistributions = async () => {
    setLoading(true);
    setError(null);

    try {
      let data: Distribution[];

      if (showOverdueOnly) {
        data = await getUnpaidDistributions();
      } else if (month) {
        data = await getDistributionsForMonth(month);
      } else {
        // Load current month by default
        const currentMonth = getCurrentMonth();
        data = await getDistributionsForMonth(currentMonth);
      }

      setDistributions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load distributions');
      console.error('Error loading distributions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsSent = (distribution: Distribution) => {
    setSelectedDistribution(distribution);
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = (distribution: Distribution) => {
    setSelectedDistribution(distribution);
    setShowConfirmModal(true);
  };

  const handlePaymentSubmit = async (
    paymentMethod: 'ach' | 'check' | 'wire',
    confirmationNumber: string
  ) => {
    if (!selectedDistribution) return;

    setLoading(true);
    setError(null);

    try {
      const input: MarkPaymentSentInput = {
        distributionId: selectedDistribution.id,
        paymentMethod,
        confirmationNumber,
        sentBy: 'current-admin-user-id', // TODO: Get from auth context
      };

      await markPaymentSent(input);

      // Reload distributions
      await loadDistributions();

      setShowPaymentModal(false);
      setSelectedDistribution(null);

      if (onDistributionUpdated) {
        onDistributionUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark payment as sent');
      console.error('Error marking payment as sent:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!selectedDistribution) return;

    setLoading(true);
    setError(null);

    try {
      const input: ConfirmPaymentInput = {
        distributionId: selectedDistribution.id,
        confirmedBy: 'current-admin-user-id', // TODO: Get from auth context
      };

      await confirmPayment(input);

      // Reload distributions
      await loadDistributions();

      setShowConfirmModal(false);
      setSelectedDistribution(null);

      if (onDistributionUpdated) {
        onDistributionUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm payment');
      console.error('Error confirming payment:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString();
  };

  const pendingCount = distributions.filter(d => d.status === 'pending').length;
  const sentCount = distributions.filter(d => d.status === 'sent').length;
  const confirmedCount = distributions.filter(d => d.status === 'confirmed').length;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Payment Distribution Management</h2>
          <p className={styles.subtitle}>
            Track and manage charity payment distributions
          </p>
        </div>
      </header>

      {/* Filter Controls */}
      <div className={styles.controls}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={showOverdueOnly}
            onChange={e => setShowOverdueOnly(e.target.checked)}
            className={styles.checkbox}
          />
          <span>Show overdue payments only (pending &gt; 15 days)</span>
        </label>

        <button
          type="button"
          onClick={loadDistributions}
          className={styles.refreshButton}
          disabled={loading}
          aria-label="Refresh distribution list"
        >
          Refresh
        </button>
      </div>

      {/* Status Summary */}
      <div className={styles.summary}>
        <StatusCard label="Pending" count={pendingCount} color="yellow" />
        <StatusCard label="Sent" count={sentCount} color="blue" />
        <StatusCard label="Confirmed" count={confirmedCount} color="green" />
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorMessage} role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={styles.loading} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true"></div>
          <span>Loading distributions...</span>
        </div>
      )}

      {/* Distributions Table */}
      {!loading && distributions.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Charity</th>
                <th scope="col">EIN</th>
                <th scope="col">Amount</th>
                <th scope="col">Contributors</th>
                <th scope="col">Status</th>
                <th scope="col">Payment Method</th>
                <th scope="col">Sent Date</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {distributions.map(dist => (
                <tr key={dist.id}>
                  <td className={styles.month}>{dist.month}</td>
                  <td className={styles.charityName}>{dist.charity_name}</td>
                  <td className={styles.ein}>{dist.charity_ein}</td>
                  <td className={styles.amount}>{formatCurrency(dist.total_amount)}</td>
                  <td className={styles.count}>{dist.contributor_count}</td>
                  <td>
                    <StatusBadge status={dist.status} />
                  </td>
                  <td className={styles.paymentMethod}>
                    {dist.payment_method ? (
                      <span className={styles.method}>
                        {dist.payment_method.toUpperCase()}
                      </span>
                    ) : (
                      <span className={styles.noMethod}>-</span>
                    )}
                  </td>
                  <td className={styles.date}>
                    {dist.sent_at ? formatDate(dist.sent_at) : '-'}
                  </td>
                  <td className={styles.actions}>
                    {dist.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsSent(dist)}
                        className={styles.actionButton}
                        aria-label={`Mark payment to ${dist.charity_name} as sent`}
                      >
                        Mark as Sent
                      </button>
                    )}
                    {dist.status === 'sent' && (
                      <button
                        type="button"
                        onClick={() => handleConfirmPayment(dist)}
                        className={styles.actionButton}
                        aria-label={`Confirm payment to ${dist.charity_name}`}
                      >
                        Confirm
                      </button>
                    )}
                    {dist.status === 'confirmed' && (
                      <span className={styles.completedText}>Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && distributions.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            {showOverdueOnly
              ? 'No overdue payments found.'
              : 'No distributions found for the selected period.'}
          </p>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedDistribution && (
        <PaymentModal
          distribution={selectedDistribution}
          onSubmit={handlePaymentSubmit}
          onCancel={() => {
            setShowPaymentModal(false);
            setSelectedDistribution(null);
          }}
        />
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && selectedDistribution && (
        <ConfirmationModal
          distribution={selectedDistribution}
          onConfirm={handleConfirmSubmit}
          onCancel={() => {
            setShowConfirmModal(false);
            setSelectedDistribution(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Status Card Component
 */
interface StatusCardProps {
  label: string;
  count: number;
  color: 'yellow' | 'blue' | 'green';
}

function StatusCard({ label, count, color }: StatusCardProps) {
  return (
    <div className={`${styles.statusCard} ${styles[`statusCard${capitalize(color)}`]}`}>
      <div className={styles.statusCardLabel}>{label}</div>
      <div className={styles.statusCardCount}>{count}</div>
    </div>
  );
}

/**
 * Status Badge Component
 */
interface StatusBadgeProps {
  status: 'pending' | 'sent' | 'confirmed';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    pending: { label: 'Pending', className: styles.statusPending },
    sent: { label: 'Sent', className: styles.statusSent },
    confirmed: { label: 'Confirmed', className: styles.statusConfirmed },
  };

  const config = statusConfig[status];

  return (
    <span className={`${styles.statusBadge} ${config.className}`}>
      {config.label}
    </span>
  );
}

/**
 * Payment Modal Component
 */
interface PaymentModalProps {
  distribution: Distribution;
  onSubmit: (paymentMethod: 'ach' | 'check' | 'wire', confirmationNumber: string) => void;
  onCancel: () => void;
}

function PaymentModal({ distribution, onSubmit, onCancel }: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'ach' | 'check' | 'wire'>('ach');
  const [confirmationNumber, setConfirmationNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(paymentMethod, confirmationNumber);
  };

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
      >
        <h3 id="payment-modal-title" className={styles.modalTitle}>
          Mark Payment as Sent
        </h3>

        <div className={styles.modalContent}>
          <p className={styles.modalText}>
            <strong>Charity:</strong> {distribution.charity_name}
          </p>
          <p className={styles.modalText}>
            <strong>Amount:</strong> ${(distribution.total_amount / 100).toFixed(2)}
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="payment-method" className={styles.formLabel}>
                Payment Method <span className={styles.required}>*</span>
              </label>
              <select
                id="payment-method"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as 'ach' | 'check' | 'wire')}
                className={styles.select}
                required
              >
                <option value="ach">ACH Transfer</option>
                <option value="check">Check</option>
                <option value="wire">Wire Transfer</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmation-number" className={styles.formLabel}>
                Confirmation Number (optional)
              </label>
              <input
                id="confirmation-number"
                type="text"
                value={confirmationNumber}
                onChange={e => setConfirmationNumber(e.target.value)}
                className={styles.input}
                placeholder="e.g., TXN-123456"
              />
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={onCancel}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button type="submit" className={styles.submitButton}>
                Mark as Sent
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * Confirmation Modal Component
 */
interface ConfirmationModalProps {
  distribution: Distribution;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmationModal({ distribution, onConfirm, onCancel }: ConfirmationModalProps) {
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <h3 id="confirm-modal-title" className={styles.modalTitle}>
          Confirm Payment Receipt
        </h3>

        <div className={styles.modalContent}>
          <p className={styles.modalText}>
            Has the charity confirmed receipt of the payment?
          </p>
          <p className={styles.modalText}>
            <strong>Charity:</strong> {distribution.charity_name}
          </p>
          <p className={styles.modalText}>
            <strong>Amount:</strong> ${(distribution.total_amount / 100).toFixed(2)}
          </p>
          <p className={styles.modalText}>
            <strong>Payment Method:</strong>{' '}
            {distribution.payment_method?.toUpperCase() || 'N/A'}
          </p>

          <div className={styles.modalActions}>
            <button type="button" onClick={onCancel} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="button" onClick={onConfirm} className={styles.submitButton}>
              Confirm Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper Functions
 */

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
