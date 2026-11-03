/**
 * LifetimeCodesTab Component
 *
 * Admin tab for managing lifetime access codes.
 * Displays table of codes with actions to create, view, copy URL, and deactivate.
 */

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../../config/api';
import { CreateCodeModal } from './CreateCodeModal';
import { CodeDetailsModal } from './CodeDetailsModal';
import styles from './LifetimeCodesTab.module.css';

export interface LifetimeCode {
  id: string;
  code: string;
  name: string;
  maxRedemptions: number | null;
  redemptionsUsed: number;
  expiresAt: string | null;
  notes: string | null;
  isActive: boolean;
  products: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  createdAt: string;
  createdByName: string;
}

export interface LifetimeCodesTabProps {
  onRefresh?: () => void;
}

export function LifetimeCodesTab({ onRefresh }: LifetimeCodesTabProps) {
  const [codes, setCodes] = useState<LifetimeCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const getSession = () => {
    const sessionData = sessionStorage.getItem('graceful_books_admin_session');
    return sessionData ? JSON.parse(sessionData) : null;
  };

  const fetchCodes = useCallback(async () => {
    const session = getSession();
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/admin/lifetime-codes`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch codes');
      }

      setCodes(data.data.codes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch codes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleDeactivate = async (codeId: string) => {
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

      fetchCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate code');
    }
  };

  const handleCopyUrl = async (code: string, codeId: string) => {
    const baseUrl = window.location.origin;
    const redeemUrl = `${baseUrl}/redeem?code=${code}`;

    try {
      await navigator.clipboard.writeText(redeemUrl);
      setCopiedCodeId(codeId);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleCodeCreated = () => {
    setShowCreateModal(false);
    fetchCodes();
    onRefresh?.();
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRedemptionDisplay = (code: LifetimeCode): string => {
    if (code.maxRedemptions === null) {
      return `${code.redemptionsUsed} / Unlimited`;
    }
    return `${code.redemptionsUsed} / ${code.maxRedemptions}`;
  };

  const isExpired = (expiresAt: string | null): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const filteredCodes = codes.filter((code) => {
    if (filterActive === 'active') return code.isActive && !isExpired(code.expiresAt);
    if (filterActive === 'inactive') return !code.isActive || isExpired(code.expiresAt);
    return true;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Lifetime Access Codes</h2>
          <p className={styles.subtitle}>
            Create and manage codes that grant product access without payment
          </p>
        </div>
        <div className={styles.headerRight}>
          <select
            className={styles.filterSelect}
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">All Codes</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive/Expired</option>
          </select>
          <button
            type="button"
            className={styles.createButton}
            onClick={() => setShowCreateModal(true)}
          >
            + Create Code
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <button type="button" onClick={fetchCodes}>
            Try again
          </button>
        </div>
      )}

      {isLoading ? (
        <div className={styles.loading}>Loading codes...</div>
      ) : filteredCodes.length === 0 ? (
        <div className={styles.empty}>
          <p>
            {filterActive === 'all'
              ? 'No lifetime codes created yet'
              : filterActive === 'active'
              ? 'No active codes'
              : 'No inactive codes'}
          </p>
          {filterActive === 'all' && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
            >
              Create your first code
            </button>
          )}
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Products</th>
                <th>Redemptions</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCodes.map((code) => (
                <tr key={code.id} className={!code.isActive ? styles.inactiveRow : ''}>
                  <td className={styles.nameCell}>
                    <span className={styles.codeName}>{code.name}</span>
                    <span className={styles.createdBy}>
                      by {code.createdByName}
                    </span>
                  </td>
                  <td className={styles.codeCell}>
                    <code className={styles.codeValue}>{code.code}</code>
                  </td>
                  <td className={styles.productsCell}>
                    {code.products.map((p) => (
                      <span key={p.id} className={styles.productBadge}>
                        {p.name}
                      </span>
                    ))}
                  </td>
                  <td className={styles.redemptionsCell}>
                    {getRedemptionDisplay(code)}
                  </td>
                  <td className={styles.expiresCell}>
                    {code.expiresAt ? (
                      <span className={isExpired(code.expiresAt) ? styles.expired : ''}>
                        {formatDate(code.expiresAt)}
                        {isExpired(code.expiresAt) && ' (Expired)'}
                      </span>
                    ) : (
                      <span className={styles.neverExpires}>Never</span>
                    )}
                  </td>
                  <td className={styles.statusCell}>
                    {code.isActive && !isExpired(code.expiresAt) ? (
                      <span className={styles.statusActive}>Active</span>
                    ) : (
                      <span className={styles.statusInactive}>
                        {isExpired(code.expiresAt) ? 'Expired' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className={styles.actionsCell}>
                    <button
                      type="button"
                      className={styles.actionButton}
                      onClick={() => setSelectedCodeId(code.id)}
                      title="View details"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionButton} ${copiedCodeId === code.id ? styles.copied : ''}`}
                      onClick={() => handleCopyUrl(code.code, code.id)}
                      disabled={!code.isActive}
                      title="Copy redemption URL"
                    >
                      {copiedCodeId === code.id ? 'Copied!' : 'Copy URL'}
                    </button>
                    {code.isActive && (
                      <button
                        type="button"
                        className={`${styles.actionButton} ${styles.danger}`}
                        onClick={() => handleDeactivate(code.id)}
                        title="Deactivate code"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Code Modal */}
      {showCreateModal && (
        <CreateCodeModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCodeCreated}
        />
      )}

      {/* Code Details Modal */}
      {selectedCodeId && (
        <CodeDetailsModal
          codeId={selectedCodeId}
          onClose={() => setSelectedCodeId(null)}
          onDeactivate={() => {
            setSelectedCodeId(null);
            fetchCodes();
          }}
        />
      )}
    </div>
  );
}
