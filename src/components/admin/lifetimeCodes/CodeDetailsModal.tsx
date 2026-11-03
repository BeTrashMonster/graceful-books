/**
 * CodeDetailsModal Component
 *
 * Modal for viewing lifetime code details and redemptions.
 * Shows:
 * - Code information card
 * - List of users who redeemed
 * - Actions to edit or deactivate
 */

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../../config/api';
import styles from './CodeDetailsModal.module.css';

interface Product {
  id: string;
  name: string;
  slug: string;
}

interface Redemption {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  redeemedAt: string;
  ipAddress: string | null;
}

interface CodeDetails {
  id: string;
  code: string;
  name: string;
  maxRedemptions: number | null;
  redemptionsUsed: number;
  expiresAt: string | null;
  notes: string | null;
  isActive: boolean;
  products: Product[];
  createdAt: string;
  createdByName: string;
  redemptions: Redemption[];
}

export interface CodeDetailsModalProps {
  codeId: string;
  onClose: () => void;
  onDeactivate: () => void;
}

export function CodeDetailsModal({ codeId, onClose, onDeactivate }: CodeDetailsModalProps) {
  const [code, setCode] = useState<CodeDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMaxRedemptions, setEditMaxRedemptions] = useState<string>('');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const getSession = () => {
    const sessionData = sessionStorage.getItem('graceful_books_admin_session');
    return sessionData ? JSON.parse(sessionData) : null;
  };

  const fetchCodeDetails = useCallback(async () => {
    const session = getSession();
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/admin/lifetime-codes/${codeId}`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch code details');
      }

      setCode(data.data);
      // Initialize edit fields
      setEditName(data.data.name);
      setEditMaxRedemptions(data.data.maxRedemptions?.toString() || '');
      setEditExpiresAt(data.data.expiresAt ? data.data.expiresAt.split('T')[0] : '');
      setEditNotes(data.data.notes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch code details');
    } finally {
      setIsLoading(false);
    }
  }, [codeId]);

  useEffect(() => {
    fetchCodeDetails();
  }, [fetchCodeDetails]);

  const handleCopyUrl = async () => {
    if (!code) return;
    const baseUrl = window.location.origin;
    const redeemUrl = `${baseUrl}/redeem?code=${code.code}`;

    try {
      await navigator.clipboard.writeText(redeemUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleDeactivate = async () => {
    const session = getSession();
    if (!session) return;

    if (!window.confirm('Are you sure you want to deactivate this code? It cannot be reactivated.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/lifetime-codes/${codeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to deactivate code');
      }

      onDeactivate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate code');
    }
  };

  const handleSaveEdit = async () => {
    const session = getSession();
    if (!session) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/admin/lifetime-codes/${codeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          maxRedemptions: editMaxRedemptions ? parseInt(editMaxRedemptions, 10) : null,
          expiresAt: editExpiresAt || null,
          notes: editNotes.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update code');
      }

      setIsEditing(false);
      fetchCodeDetails();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update code');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const isExpired = (expiresAt: string | null): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Code Details</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {isLoading ? (
          <div className={styles.loading}>Loading code details...</div>
        ) : code ? (
          <div className={styles.content}>
            {/* Code Info Card */}
            <div className={styles.infoCard}>
              <div className={styles.infoHeader}>
                <div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={styles.editInput}
                    />
                  ) : (
                    <h3 className={styles.codeName}>{code.name}</h3>
                  )}
                  <code className={styles.codeValue}>{code.code}</code>
                </div>
                <div className={styles.statusBadge}>
                  {code.isActive && !isExpired(code.expiresAt) ? (
                    <span className={styles.active}>Active</span>
                  ) : (
                    <span className={styles.inactive}>
                      {isExpired(code.expiresAt) ? 'Expired' : 'Inactive'}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Products</span>
                  <div className={styles.productTags}>
                    {code.products.map((p) => (
                      <span key={p.id} className={styles.productTag}>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Redemptions</span>
                  <span className={styles.infoValue}>
                    {code.redemptionsUsed}
                    {code.maxRedemptions !== null && ` / ${code.maxRedemptions}`}
                    {code.maxRedemptions === null && ' (Unlimited)'}
                  </span>
                </div>

                {isEditing ? (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Max Redemptions</span>
                    <input
                      type="number"
                      value={editMaxRedemptions}
                      onChange={(e) => setEditMaxRedemptions(e.target.value)}
                      placeholder="Unlimited"
                      className={styles.editInput}
                      min={code.redemptionsUsed}
                    />
                  </div>
                ) : null}

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Expires</span>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editExpiresAt}
                      onChange={(e) => setEditExpiresAt(e.target.value)}
                      className={styles.editInput}
                    />
                  ) : (
                    <span className={`${styles.infoValue} ${isExpired(code.expiresAt) ? styles.expiredText : ''}`}>
                      {code.expiresAt ? formatDate(code.expiresAt) : 'Never'}
                      {isExpired(code.expiresAt) && ' (Expired)'}
                    </span>
                  )}
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Created</span>
                  <span className={styles.infoValue}>
                    {formatDate(code.createdAt)} by {code.createdByName}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Notes</span>
                  {isEditing ? (
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Internal notes..."
                      className={styles.editTextarea}
                      rows={2}
                    />
                  ) : (
                    <span className={styles.infoValue}>
                      {code.notes || '-'}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className={styles.infoActions}>
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${copiedUrl ? styles.copied : ''}`}
                      onClick={handleCopyUrl}
                      disabled={!code.isActive}
                    >
                      {copiedUrl ? 'Copied!' : 'Copy URL'}
                    </button>
                    {code.isActive && (
                      <>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setIsEditing(true)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          onClick={handleDeactivate}
                        >
                          Deactivate
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Redemptions List */}
            <div className={styles.redemptionsSection}>
              <h4 className={styles.sectionTitle}>
                Redemptions ({code.redemptions.length})
              </h4>

              {code.redemptions.length === 0 ? (
                <p className={styles.emptyRedemptions}>
                  No redemptions yet
                </p>
              ) : (
                <div className={styles.redemptionsList}>
                  {code.redemptions.map((redemption) => (
                    <div key={redemption.id} className={styles.redemptionItem}>
                      <div className={styles.redemptionUser}>
                        <span className={styles.userName}>{redemption.userName}</span>
                        <span className={styles.userEmail}>{redemption.userEmail}</span>
                      </div>
                      <div className={styles.redemptionMeta}>
                        <span className={styles.redemptionDate}>
                          {formatDateTime(redemption.redeemedAt)}
                        </span>
                        {redemption.ipAddress && (
                          <span className={styles.redemptionIp}>
                            {redemption.ipAddress}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
