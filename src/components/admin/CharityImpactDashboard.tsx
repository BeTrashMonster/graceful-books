/**
 * CharityImpactDashboard Component
 *
 * Admin dashboard showing charity impact statistics and monthly growth.
 * Displays lifetime contributions, contributor counts, and trends.
 *
 * Requirements:
 * - IC2.5: Charity Payment Distribution System
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect } from 'react';
import {
  getAllCharityImpactStats,
  type CharityImpactStats,
  type MonthlyGrowthData,
} from '../../services/admin/charityDistribution.service';
import styles from './CharityImpactDashboard.module.css';

export function CharityImpactDashboard() {
  const [stats, setStats] = useState<CharityImpactStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCharity, setSelectedCharity] = useState<CharityImpactStats | null>(null);
  const [sortBy, setSortBy] = useState<'lifetime' | 'contributors' | 'name'>('lifetime');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getAllCharityImpactStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load charity impact data');
      console.error('Error loading charity impact stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toLocaleString()}`;
  };

  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString();
  };

  // Sort stats
  const sortedStats = [...stats].sort((a, b) => {
    switch (sortBy) {
      case 'lifetime':
        return b.lifetime_contributions - a.lifetime_contributions;
      case 'contributors':
        return b.total_contributors - a.total_contributors;
      case 'name':
        return a.charity_name.localeCompare(b.charity_name);
      default:
        return 0;
    }
  });

  // Calculate totals
  const totalContributions = stats.reduce((sum, s) => sum + s.lifetime_contributions, 0);
  const totalCharities = stats.length;
  const avgContribution = totalCharities > 0 ? totalContributions / totalCharities : 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Charity Impact Dashboard</h1>
          <p className={styles.subtitle}>
            Track the impact of user contributions across all charities
          </p>
        </div>
        <button
          type="button"
          onClick={loadStats}
          className={styles.refreshButton}
          disabled={loading}
          aria-label="Refresh impact data"
        >
          Refresh
        </button>
      </header>

      {/* Summary Cards */}
      <div className={styles.summary}>
        <SummaryCard
          label="Total Contributions"
          value={formatCurrency(totalContributions)}
          color="green"
          icon="💰"
        />
        <SummaryCard
          label="Active Charities"
          value={totalCharities.toString()}
          color="blue"
          icon="🏛️"
        />
        <SummaryCard
          label="Average per Charity"
          value={formatCurrency(avgContribution)}
          color="purple"
          icon="📊"
        />
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
          <span>Loading impact data...</span>
        </div>
      )}

      {/* Controls */}
      {!loading && stats.length > 0 && (
        <div className={styles.controls}>
          <div className={styles.sortControls}>
            <label htmlFor="sort-select" className={styles.sortLabel}>
              Sort by:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className={styles.select}
            >
              <option value="lifetime">Lifetime Contributions</option>
              <option value="contributors">Contributor Count</option>
              <option value="name">Charity Name</option>
            </select>
          </div>
        </div>
      )}

      {/* Charity List */}
      {!loading && stats.length > 0 && (
        <div className={styles.charityList}>
          {sortedStats.map(charity => (
            <CharityCard
              key={charity.charity_id}
              charity={charity}
              onViewDetails={() => setSelectedCharity(charity)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && stats.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            No charity impact data available yet.
          </p>
          <p className={styles.emptyStateSubtext}>
            Impact statistics will appear once users start making contributions.
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCharity && (
        <CharityDetailModal
          charity={selectedCharity}
          onClose={() => setSelectedCharity(null)}
        />
      )}
    </div>
  );
}

/**
 * Summary Card Component
 */
interface SummaryCardProps {
  label: string;
  value: string;
  color: 'green' | 'blue' | 'purple';
  icon: string;
}

function SummaryCard({ label, value, color, icon }: SummaryCardProps) {
  return (
    <div className={`${styles.summaryCard} ${styles[`summaryCard${capitalize(color)}`]}`}>
      <div className={styles.summaryIcon} aria-hidden="true">
        {icon}
      </div>
      <div>
        <div className={styles.summaryLabel}>{label}</div>
        <div className={styles.summaryValue}>{value}</div>
      </div>
    </div>
  );
}

/**
 * Charity Card Component
 */
interface CharityCardProps {
  charity: CharityImpactStats;
  onViewDetails: () => void;
}

function CharityCard({ charity, onViewDetails }: CharityCardProps) {
  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toLocaleString()}`;
  };

  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString();
  };

  // Calculate growth trend
  const growth = charity.monthly_growth;
  const hasGrowth = growth.length >= 2;
  const trend = hasGrowth
    ? growth[growth.length - 1].amount > growth[growth.length - 2].amount
      ? 'up'
      : 'down'
    : 'neutral';

  return (
    <div className={styles.charityCard}>
      <div className={styles.cardHeader}>
        <h3 className={styles.charityName}>{charity.charity_name}</h3>
        {trend !== 'neutral' && (
          <span
            className={`${styles.trendBadge} ${
              trend === 'up' ? styles.trendUp : styles.trendDown
            }`}
            aria-label={`Trend: ${trend === 'up' ? 'increasing' : 'decreasing'}`}
          >
            {trend === 'up' ? '↗' : '↘'}
          </span>
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Lifetime Contributions:</span>
          <span className={styles.statValue}>
            {formatCurrency(charity.lifetime_contributions)}
          </span>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>Total Contributors:</span>
          <span className={styles.statValue}>{charity.total_contributors}</span>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>First Contribution:</span>
          <span className={styles.statValue}>
            {formatDate(charity.first_contribution_date)}
          </span>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>Latest Contribution:</span>
          <span className={styles.statValue}>
            {formatDate(charity.latest_contribution_date)}
          </span>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <button
          type="button"
          onClick={onViewDetails}
          className={styles.detailsButton}
          aria-label={`View details for ${charity.charity_name}`}
        >
          View Monthly Growth
        </button>
      </div>
    </div>
  );
}

/**
 * Charity Detail Modal Component
 */
interface CharityDetailModalProps {
  charity: CharityImpactStats;
  onClose: () => void;
}

function CharityDetailModal({ charity, onClose }: CharityDetailModalProps) {
  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>
            {charity.charity_name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className={styles.modalContent}>
          <h3 className={styles.subsectionTitle}>Monthly Growth</h3>

          {charity.monthly_growth.length > 0 ? (
            <div className={styles.growthTable}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Contributors</th>
                  </tr>
                </thead>
                <tbody>
                  {charity.monthly_growth.map((data, _index) => (
                    <tr key={data.month}>
                      <td className={styles.monthCell}>{data.month}</td>
                      <td className={styles.amountCell}>
                        {formatCurrency(data.amount)}
                      </td>
                      <td className={styles.countCell}>{data.contributor_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.noData}>No monthly growth data available</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper Functions
 */

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
