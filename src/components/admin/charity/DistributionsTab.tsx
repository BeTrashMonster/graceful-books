/**
 * Distributions Tab
 *
 * Track and manage charity payment distributions
 */

import { useState } from 'react';
import type { CharityDistribution, MarkDistributionPaidRequest } from '../../../services/charities.api';
import { markDistributionPaid } from '../../../services/charities.api';
import styles from './DistributionsTab.module.css';

interface Props {
  distributions: CharityDistribution[];
  onRefresh: () => void;
}

export function DistributionsTab({ distributions, onRefresh }: Props) {
  const [selectedDistribution, setSelectedDistribution] = useState<CharityDistribution | null>(null);

  const handleMarkPaid = async (distributionId: string, data: MarkDistributionPaidRequest) => {
    try {
      await markDistributionPaid(distributionId, data);
      setSelectedDistribution(null);
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to mark as paid');
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString();

  // Group by status
  const pending = distributions.filter(d => d.status === 'pending');
  const processing = distributions.filter(d => d.status === 'processing');
  const completed = distributions.filter(d => d.status === 'confirmed' || d.status === 'sent');

  const totalPending = pending.reduce((sum, d) => sum + d.totalAmount, 0);

  return (
    <div className={styles.container}>
      {/* Summary */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Pending Distributions</div>
          <div className={styles.summaryValue}>{formatCurrency(totalPending)}</div>
          <div className={styles.summarySubtext}>{pending.length} payments</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Processing</div>
          <div className={styles.summaryValue}>{processing.length}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Completed</div>
          <div className={styles.summaryValue}>{completed.length}</div>
        </div>
      </div>

      {/* Pending Section */}
      <section className={styles.section}>
        <h3>Pending Distributions ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className={styles.empty}>No pending distributions</p>
        ) : (
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Charity</th>
                  <th>EIN</th>
                  <th>Amount</th>
                  <th>Contributors</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((dist) => (
                  <tr key={dist.id}>
                    <td>{dist.month}</td>
                    <td>{dist.charityName}</td>
                    <td>{dist.charityEin}</td>
                    <td className={styles.amount}>{formatCurrency(dist.totalAmount)}</td>
                    <td>{dist.contributorCount}</td>
                    <td>
                      <button
                        onClick={() => setSelectedDistribution(dist)}
                        className={styles.markPaidBtn}
                      >
                        Mark as Paid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Completed Section */}
      <section className={styles.section}>
        <details>
          <summary>Completed Distributions ({completed.length})</summary>
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Charity</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Paid Date</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((dist) => (
                  <tr key={dist.id}>
                    <td>{dist.month}</td>
                    <td>{dist.charityName}</td>
                    <td className={styles.amount}>{formatCurrency(dist.totalAmount)}</td>
                    <td>{dist.paymentMethod?.toUpperCase() || 'N/A'}</td>
                    <td>{dist.paymentReference || 'N/A'}</td>
                    <td>{dist.confirmedAt ? formatDate(dist.confirmedAt) : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* Mark Paid Modal */}
      {selectedDistribution && (
        <MarkPaidModal
          distribution={selectedDistribution}
          onMarkPaid={(data) => handleMarkPaid(selectedDistribution.id, data)}
          onClose={() => setSelectedDistribution(null)}
        />
      )}
    </div>
  );
}

interface MarkPaidModalProps {
  distribution: CharityDistribution;
  onMarkPaid: (data: MarkDistributionPaidRequest) => void;
  onClose: () => void;
}

function MarkPaidModal({ distribution, onMarkPaid, onClose }: MarkPaidModalProps) {
  const [formData, setFormData] = useState<MarkDistributionPaidRequest>({
    paymentMethod: 'ach',
    paymentReference: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onMarkPaid(formData);
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>Mark Distribution as Paid</h2>

        <div className={styles.distributionInfo}>
          <p><strong>Charity:</strong> {distribution.charityName}</p>
          <p><strong>Month:</strong> {distribution.month}</p>
          <p><strong>Amount:</strong> {formatCurrency(distribution.totalAmount)}</p>
          <p><strong>Contributors:</strong> {distribution.contributorCount}</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            Payment Method:
            <select
              value={formData.paymentMethod}
              onChange={(e) =>
                setFormData({ ...formData, paymentMethod: e.target.value as any })
              }
              required
            >
              <option value="ach">ACH</option>
              <option value="check">Check</option>
              <option value="wire">Wire Transfer</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            Payment Reference (Check #, Confirmation #):
            <input
              type="text"
              value={formData.paymentReference}
              onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
              placeholder="e.g., Check #1234, Confirmation ABC123"
            />
          </label>

          <label>
            Notes:
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes..."
              rows={3}
            />
          </label>

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn}>
              Confirm Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
