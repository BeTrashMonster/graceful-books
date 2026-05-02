/**
 * Retention Policy Settings Component
 *
 * Admin UI for configuring data retention policies.
 * Implements S7-5: Data Retention Policies from Security Hardening Roadmap.
 *
 * Features:
 * - Configure retention periods per entity type
 * - View retention statistics
 * - Manual purge trigger
 * - Deletion audit log viewer
 * - 7-year enforcement indicator
 */

import React, { useState, useEffect } from 'react';
import type {
  RetentionPolicy,
  RetentionEntityType,
  RetentionStatistics,
  DeletionLog,
} from '../../types/retention.types';
import {
  _LEGAL_MINIMUM_RETENTION_DAYS,
  requiresLegalRetention,
  calculateEffectiveRetention,
} from '../../types/retention.types';
import {
  getRetentionPolicies,
  upsertRetentionPolicy,
  _deleteRetentionPolicy,
  getRetentionStatistics,
  autoPurgeCompany,
  getDeletionLogs,
} from '../../services/retention.service';
import { formatRetentionPeriod, getEntityTypeDisplay } from '../../db/schema/retention.schema';
import { logger } from '../../utils/logger';
import styles from './RetentionPolicySettings.module.css';

const retentionLogger = logger.child('RetentionPolicySettings');

interface RetentionPolicySettingsProps {
  companyId: string;
  userId: string;
  userRole: string; // Only 'admin' should access this
}

export const RetentionPolicySettings: React.FC<RetentionPolicySettingsProps> = ({
  companyId,
  userId,
  userRole,
}) => {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [statistics, setStatistics] = useState<RetentionStatistics | null>(null);
  const [deletionLogs, setDeletionLogs] = useState<DeletionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<{
    entityType: RetentionEntityType;
    retentionDays: number;
    enforceMinimum: boolean;
    description: string;
  } | null>(null);

  // Check if user is admin
  if (userRole !== 'admin') {
    return (
      <div className={styles.unauthorized}>
        <h2>Access Denied</h2>
        <p>Only administrators can configure retention policies.</p>
      </div>
    );
  }

  // Load policies and statistics
  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [policiesData, statsData, logsData] = await Promise.all([
        getRetentionPolicies(companyId),
        getRetentionStatistics(companyId),
        getDeletionLogs(companyId, { limit: 50 }),
      ]);

      setPolicies(policiesData);
      setStatistics(statsData);
      setDeletionLogs(logsData);
    } catch (err: any) {
      retentionLogger.error('Failed to load retention data', { error: err });
      setError('Failed to load retention policies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicy = async () => {
    if (!editingPolicy) return;

    setError(null);

    try {
      await upsertRetentionPolicy(
        companyId,
        userId,
        editingPolicy.entityType,
        editingPolicy.retentionDays,
        editingPolicy.enforceMinimum,
        editingPolicy.description || null
      );

      setEditingPolicy(null);
      await loadData();
    } catch (err: any) {
      retentionLogger.error('Failed to save retention policy', { error: err });
      setError('Failed to save retention policy. Please try again.');
    }
  };

  const handleRunPurge = async (dryRun: boolean = false) => {
    if (!dryRun) {
      const confirmed = window.confirm(
        'Are you sure you want to permanently delete eligible records? This action cannot be undone.'
      );
      if (!confirmed) return;
    }

    setPurging(true);
    setError(null);

    try {
      const result = await autoPurgeCompany(companyId, {
        enabled: true,
        schedule_cron: '0 2 * * *',
        batch_size: 100,
        dry_run: dryRun,
        notify_admin: true,
      });

      if (dryRun) {
        alert(
          `Dry run complete. Would purge ${result.total_purged} records. ${result.total_protected} records protected by 7-year rule.`
        );
      } else {
        alert(
          `Purge complete. Deleted ${result.total_purged} records. ${result.total_protected} records protected by 7-year rule. ${result.total_failed} failed.`
        );
      }

      await loadData();
    } catch (err: any) {
      retentionLogger.error('Failed to run purge', { error: err });
      setError('Failed to run purge. Please try again.');
    } finally {
      setPurging(false);
    }
  };

  const entityTypes: RetentionEntityType[] = [
    'ALL',
    'ACCOUNT',
    'TRANSACTION',
    'CONTACT',
    'PRODUCT',
    'INVOICE',
    'BILL',
    'RECEIPT',
    'RECONCILIATION',
    'CATEGORY',
    'TAG',
  ];

  const getPolicyForType = (entityType: RetentionEntityType): RetentionPolicy | undefined => {
    return policies.find((p) => p.entity_type === entityType);
  };

  if (loading) {
    return <div className={styles.loading}>Loading retention policies...</div>;
  }

  return (
    <div className={styles.container}>
      <h1>Data Retention Policies</h1>
      <p className={styles.description}>
        Configure how long deleted records are kept before permanent deletion. Financial records
        are automatically protected by the 7-year legal retention requirement.
      </p>

      {error && <div className={styles.error}>{error}</div>}

      {/* Statistics Section */}
      {statistics && (
        <div className={styles.statisticsCard}>
          <h2>Retention Statistics</h2>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Soft-Deleted Records</div>
              <div className={styles.statValue}>{statistics.total_soft_deleted}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Eligible for Purge</div>
              <div className={styles.statValue}>{statistics.eligible_for_purge}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Protected by 7-Year Rule</div>
              <div className={styles.statValue}>{statistics.protected_by_law}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Days Until Next Eligible</div>
              <div className={styles.statValue}>
                {statistics.days_until_next_purge === Infinity
                  ? 'N/A'
                  : statistics.days_until_next_purge}
              </div>
            </div>
          </div>

          <div className={styles.purgeButtons}>
            <button
              onClick={() => handleRunPurge(true)}
              disabled={purging || statistics.eligible_for_purge === 0}
              className={styles.buttonSecondary}
            >
              {purging ? 'Running...' : 'Preview Purge (Dry Run)'}
            </button>
            <button
              onClick={() => handleRunPurge(false)}
              disabled={purging || statistics.eligible_for_purge === 0}
              className={styles.buttonPrimary}
            >
              {purging ? 'Running...' : 'Run Purge Now'}
            </button>
          </div>
        </div>
      )}

      {/* Policies Section */}
      <div className={styles.policiesCard}>
        <h2>Retention Policies</h2>
        <table className={styles.policiesTable}>
          <thead>
            <tr>
              <th>Entity Type</th>
              <th>Retention Period</th>
              <th>Effective Period</th>
              <th>7-Year Rule</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entityTypes.map((entityType) => {
              const policy = getPolicyForType(entityType);
              const retentionDays = policy?.retention_days || 90;
              const enforceMinimum = policy?.enforce_minimum !== false;
              const effectiveDays = calculateEffectiveRetention(
                entityType,
                retentionDays,
                enforceMinimum
              );
              const isFinancial = requiresLegalRetention(entityType);

              return (
                <tr key={entityType}>
                  <td>
                    {getEntityTypeDisplay(entityType)}
                    {isFinancial && (
                      <span className={styles.financialBadge} title="Financial record">
                        💼
                      </span>
                    )}
                  </td>
                  <td>{formatRetentionPeriod(retentionDays)}</td>
                  <td>
                    {formatRetentionPeriod(effectiveDays)}
                    {effectiveDays !== retentionDays && (
                      <span className={styles.enforcedBadge} title="Extended by 7-year rule">
                        ⚖️
                      </span>
                    )}
                  </td>
                  <td>
                    {isFinancial ? (
                      <span className={styles.badgeYes}>Required</span>
                    ) : (
                      <span className={styles.badgeNo}>Not Required</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() =>
                        setEditingPolicy({
                          entityType,
                          retentionDays: policy?.retention_days || 90,
                          enforceMinimum: policy?.enforce_minimum !== false,
                          description: policy?.description || '',
                        })
                      }
                      className={styles.buttonEdit}
                    >
                      {policy ? 'Edit' : 'Create'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Policy Modal */}
      {editingPolicy && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>Configure Retention Policy</h2>
            <p>
              Entity Type: <strong>{getEntityTypeDisplay(editingPolicy.entityType)}</strong>
            </p>

            {requiresLegalRetention(editingPolicy.entityType) && (
              <div className={styles.legalNotice}>
                ⚖️ This is a financial record type. Federal law requires 7-year retention
                (2,557 days) for accounting records.
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="retentionDays">Retention Period (days)</label>
              <input
                id="retentionDays"
                type="number"
                min="1"
                max="36500"
                value={editingPolicy.retentionDays}
                onChange={(e) =>
                  setEditingPolicy({
                    ...editingPolicy,
                    retentionDays: parseInt(e.target.value, 10),
                  })
                }
                className={styles.input}
              />
              <small className={styles.helpText}>
                {formatRetentionPeriod(editingPolicy.retentionDays)}
              </small>
            </div>

            <div className={styles.formGroup}>
              <label>
                <input
                  type="checkbox"
                  checked={editingPolicy.enforceMinimum}
                  onChange={(e) =>
                    setEditingPolicy({
                      ...editingPolicy,
                      enforceMinimum: e.target.checked,
                    })
                  }
                />
                Enforce 7-year minimum for financial records
              </label>
              <small className={styles.helpText}>
                Recommended: Keep enabled to comply with legal requirements.
              </small>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="description">Description (optional)</label>
              <textarea
                id="description"
                value={editingPolicy.description}
                onChange={(e) =>
                  setEditingPolicy({
                    ...editingPolicy,
                    description: e.target.value,
                  })
                }
                className={styles.textarea}
                rows={3}
                placeholder="Optional notes about this policy..."
              />
            </div>

            {requiresLegalRetention(editingPolicy.entityType) &&
              editingPolicy.enforceMinimum && (
                <div className={styles.effectiveRetention}>
                  <strong>Effective Retention:</strong>{' '}
                  {formatRetentionPeriod(
                    calculateEffectiveRetention(
                      editingPolicy.entityType,
                      editingPolicy.retentionDays,
                      editingPolicy.enforceMinimum
                    )
                  )}
                </div>
              )}

            <div className={styles.modalButtons}>
              <button onClick={() => setEditingPolicy(null)} className={styles.buttonSecondary}>
                Cancel
              </button>
              <button onClick={handleSavePolicy} className={styles.buttonPrimary}>
                Save Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Logs Section */}
      <div className={styles.logsCard}>
        <h2>Recent Deletion Log</h2>
        {deletionLogs.length === 0 ? (
          <p className={styles.emptyState}>No deletion records yet.</p>
        ) : (
          <table className={styles.logsTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Entity Type</th>
                <th>Method</th>
                <th>Deleted By</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {deletionLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.hard_deleted_at).toLocaleString()}</td>
                  <td>{getEntityTypeDisplay(log.entity_type)}</td>
                  <td>
                    <span className={styles.methodBadge}>{log.deletion_method}</span>
                  </td>
                  <td>{log.deleted_by}</td>
                  <td className={styles.reasonCell}>{log.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RetentionPolicySettings;
