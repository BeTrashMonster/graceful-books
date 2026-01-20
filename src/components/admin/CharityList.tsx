/**
 * CharityList Component
 *
 * Displays list of charities with filtering, search, and detail view.
 * Allows admin to verify, reject, or manage charities.
 *
 * Requirements:
 * - IC3: Admin Panel - Charity Management
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect } from 'react';
import type { Charity, CharityStatus, CharityCategory } from '../../types/database.types';
import {
  getAllCharities,
  addVerificationNote,
  verifyCharity,
  rejectCharity,
  removeCharity,
  type CharityFilterOptions,
} from '../../services/admin/charity.service';
import { getCategoryDisplay } from '../../db/schema/charity.schema';
import styles from './CharityList.module.css';

interface CharityListProps {
  statusFilter?: CharityStatus;
  onCharityUpdated: () => void;
  refreshTrigger: number;
}

export function CharityList({ statusFilter, onCharityUpdated, refreshTrigger }: CharityListProps) {
  const [charities, setCharities] = useState<Charity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load charities
  useEffect(() => {
    loadCharities();
  }, [statusFilter, searchTerm, refreshTrigger]);

  const loadCharities = async () => {
    setIsLoading(true);
    try {
      const filters: CharityFilterOptions = {
        status: statusFilter,
        searchTerm: searchTerm || undefined,
      };
      const data = await getAllCharities(filters);
      setCharities(data);
    } catch (error) {
      console.error('Error loading charities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCharityClick = (charity: Charity) => {
    setSelectedCharity(charity);
  };

  const handleCloseDetail = () => {
    setSelectedCharity(null);
  };

  if (isLoading) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        Loading charities...
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Search */}
      <div className={styles.searchContainer}>
        <label htmlFor="charity-search" className={styles.searchLabel}>
          Search charities
        </label>
        <input
          type="search"
          id="charity-search"
          placeholder="Search by name, EIN, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
          aria-label="Search charities by name, EIN, or description"
        />
      </div>

      {/* Charity Table */}
      {charities.length === 0 ? (
        <div className={styles.empty}>
          <p>No charities found matching your criteria.</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">EIN</th>
                <th scope="col">Category</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {charities.map((charity) => (
                <tr key={charity.id} className={styles.row}>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleCharityClick(charity)}
                      className={styles.charityName}
                    >
                      {charity.name}
                    </button>
                  </td>
                  <td className={styles.ein}>{charity.ein}</td>
                  <td>{getCategoryDisplay(charity.category)}</td>
                  <td>
                    <StatusBadge status={charity.status} />
                  </td>
                  <td className={styles.date}>
                    {new Date(charity.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleCharityClick(charity)}
                      className={styles.viewButton}
                      aria-label={`View details for ${charity.name}`}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Charity Detail Modal */}
      {selectedCharity && (
        <CharityDetailModal
          charity={selectedCharity}
          onClose={handleCloseDetail}
          onUpdate={() => {
            handleCloseDetail();
            onCharityUpdated();
          }}
        />
      )}
    </div>
  );
}

interface StatusBadgeProps {
  status: CharityStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<CharityStatus, { label: string; className: string }> = {
    PENDING: { label: 'Pending', className: styles.statusPending },
    VERIFIED: { label: 'Verified', className: styles.statusVerified },
    REJECTED: { label: 'Rejected', className: styles.statusRejected },
    INACTIVE: { label: 'Inactive', className: styles.statusInactive },
  };

  const config = statusConfig[status];

  return <span className={`${styles.statusBadge} ${config.className}`}>{config.label}</span>;
}

interface CharityDetailModalProps {
  charity: Charity;
  onClose: () => void;
  onUpdate: () => void;
}

function CharityDetailModal({ charity, onClose, onUpdate }: CharityDetailModalProps) {
  const [verificationNote, setVerificationNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddNote = async () => {
    if (!verificationNote.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await addVerificationNote({
        charityId: charity.id,
        note: verificationNote,
      });
      setVerificationNote('');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!confirm(`Are you sure you want to verify ${charity.name}? Users will be able to select this charity.`)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // TODO: Get actual admin user ID from auth context
      await verifyCharity({
        charityId: charity.id,
        verifiedBy: 'admin-user-id',
      });
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify charity');
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    if (!confirm(`Are you sure you want to reject ${charity.name}?`)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // TODO: Get actual admin user ID from auth context
      await rejectCharity({
        charityId: charity.id,
        reason: rejectionReason,
        rejectedBy: 'admin-user-id',
      });
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject charity');
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to mark ${charity.name} as inactive?`)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await removeCharity(charity.id);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove charity');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="charity-detail-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="charity-detail-title">{charity.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close charity details"
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Charity Info */}
          <div className={styles.infoSection}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Status:</span>
              <StatusBadge status={charity.status} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>EIN:</span>
              <span>{charity.ein}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Category:</span>
              <span>{getCategoryDisplay(charity.category)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Website:</span>
              <a
                href={charity.website}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                {charity.website}
              </a>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Description:</span>
              <p className={styles.description}>{charity.description}</p>
            </div>
          </div>

          {/* Verification Notes */}
          {charity.verification_notes && (
            <div className={styles.notesSection}>
              <h3 className={styles.notesTitle}>Verification Notes</h3>
              <pre className={styles.notesContent}>{charity.verification_notes}</pre>
            </div>
          )}

          {/* Rejection Reason */}
          {charity.rejection_reason && (
            <div className={styles.rejectionSection}>
              <h3 className={styles.rejectionTitle}>Rejection Reason</h3>
              <p className={styles.rejectionReason}>{charity.rejection_reason}</p>
            </div>
          )}

          {/* IRS Lookup Link */}
          <div className={styles.actionSection}>
            <h3 className={styles.actionTitle}>Step 3: IRS Verification</h3>
            <a
              href={`https://apps.irs.gov/app/eos/`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.irsLink}
            >
              Open IRS Tax Exempt Organization Search →
            </a>
            <p className={styles.actionHelp}>
              Search for the charity by EIN ({charity.ein}) and verify 501(c)(3) status.
            </p>
          </div>

          {/* Add Verification Note */}
          {charity.status === 'PENDING' && (
            <div className={styles.actionSection}>
              <h3 className={styles.actionTitle}>Add Verification Note</h3>
              <textarea
                value={verificationNote}
                onChange={(e) => setVerificationNote(e.target.value)}
                placeholder="E.g., 'Verified via IRS EOS on [date]. Status: Active PC.' or 'Website verified. Mission aligns. Transparency: Good.'"
                rows={3}
                className={styles.textarea}
                aria-label="Verification note"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={isSubmitting || !verificationNote.trim()}
                className={styles.addNoteButton}
              >
                Add Note
              </button>
            </div>
          )}

          {/* Actions */}
          {charity.status === 'PENDING' && (
            <>
              <div className={styles.actionSection}>
                <h3 className={styles.actionTitle}>Step 5: Final Approval</h3>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={isSubmitting}
                  className={styles.verifyButton}
                >
                  ✓ Verify Charity
                </button>
              </div>

              <div className={styles.actionSection}>
                <h3 className={styles.actionTitle}>Or Reject</h3>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason for rejection..."
                  rows={2}
                  className={styles.textarea}
                  aria-label="Rejection reason"
                />
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isSubmitting || !rejectionReason.trim()}
                  className={styles.rejectButton}
                >
                  ✗ Reject Charity
                </button>
              </div>
            </>
          )}

          {/* Remove Action */}
          {charity.status !== 'INACTIVE' && (
            <div className={styles.actionSection}>
              <button
                type="button"
                onClick={handleRemove}
                disabled={isSubmitting}
                className={styles.removeButton}
              >
                Mark as Inactive
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
