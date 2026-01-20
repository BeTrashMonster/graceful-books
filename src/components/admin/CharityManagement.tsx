/**
 * CharityManagement Component
 *
 * Admin dashboard for managing charities.
 * Displays statistics and charity list with filters.
 *
 * Requirements:
 * - IC3: Admin Panel - Charity Management
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect } from 'react';
import { CharityList } from './CharityList';
import { CharityVerificationForm } from './CharityVerificationForm';
import type { CharityStatus } from '../../types/database.types';
import { getCharityStatistics } from '../../services/admin/charity.service';
import styles from './CharityManagement.module.css';

interface Statistics {
  total: number;
  verified: number;
  pending: number;
  rejected: number;
  inactive: number;
}

export function CharityManagement() {
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
    inactive: 0,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<CharityStatus | 'ALL'>('ALL');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load statistics
  useEffect(() => {
    loadStatistics();
  }, [refreshTrigger]);

  const loadStatistics = async () => {
    try {
      const stats = await getCharityStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const handleCharityAdded = () => {
    setShowAddForm(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleCharityUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Charity Management</h1>
          <p className={styles.subtitle}>
            Manage and verify charitable organizations available for user selection
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className={styles.addButton}
          aria-label="Add new charity"
        >
          + Add Charity
        </button>
      </header>

      {/* Statistics Cards */}
      <div className={styles.statistics}>
        <StatCard
          label="Total Charities"
          value={statistics.total}
          color="blue"
          selected={selectedStatus === 'ALL'}
          onClick={() => setSelectedStatus('ALL')}
        />
        <StatCard
          label="Verified"
          value={statistics.verified}
          color="green"
          selected={selectedStatus === 'VERIFIED'}
          onClick={() => setSelectedStatus('VERIFIED')}
        />
        <StatCard
          label="Pending Verification"
          value={statistics.pending}
          color="yellow"
          selected={selectedStatus === 'PENDING'}
          onClick={() => setSelectedStatus('PENDING')}
        />
        <StatCard
          label="Rejected"
          value={statistics.rejected}
          color="red"
          selected={selectedStatus === 'REJECTED'}
          onClick={() => setSelectedStatus('REJECTED')}
        />
        <StatCard
          label="Inactive"
          value={statistics.inactive}
          color="gray"
          selected={selectedStatus === 'INACTIVE'}
          onClick={() => setSelectedStatus('INACTIVE')}
        />
      </div>

      {/* Charity List */}
      <div className={styles.listContainer}>
        <CharityList
          statusFilter={selectedStatus === 'ALL' ? undefined : selectedStatus}
          onCharityUpdated={handleCharityUpdated}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Add Charity Modal */}
      {showAddForm && (
        <div className={styles.modalOverlay} onClick={() => setShowAddForm(false)}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-charity-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="add-charity-title">Add New Charity</h2>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className={styles.closeButton}
                aria-label="Close add charity form"
              >
                ×
              </button>
            </div>
            <CharityVerificationForm
              onSuccess={handleCharityAdded}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  selected: boolean;
  onClick: () => void;
}

function StatCard({ label, value, color, selected, onClick }: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.statCard} ${styles[`statCard${color.charAt(0).toUpperCase() + color.slice(1)}`]} ${
        selected ? styles.statCardSelected : ''
      }`}
      aria-label={`Filter by ${label}: ${value} charities`}
      aria-pressed={selected}
    >
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </button>
  );
}
