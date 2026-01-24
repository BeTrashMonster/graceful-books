/**
 * Distribution Cost Analysis Report
 *
 * Compare distributors side-by-side:
 * - Total costs, cost per unit, margin impact
 * - Identify most cost-effective distributor
 * - Show fee breakdown by distributor
 * - Trend analysis (costs over time)
 *
 * Per Group D3: CPG-Specific Reporting
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { ReportExportButton } from '../../../components/cpg/reports/ReportExportButton';
import { compareDistributors } from '../../../services/cpg/cpgReporting.service';
import type { DistributorComparison } from '../../../services/cpg/cpgReporting.service';
import { db } from '../../../db';
import type { CPGDistributor } from '../../../db/schema/cpg.schema';
import styles from './DistributionCostReport.module.css';

export const DistributionCostReport = () => {
  const { currentCompany } = useAuth();
  const [comparison, setComparison] = useState<DistributorComparison | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Available distributors
  const [allDistributors, setAllDistributors] = useState<CPGDistributor[]>([]);
  const [selectedDistributorIds, setSelectedDistributorIds] = useState<string[]>([]);

  useEffect(() => {
    loadDistributors();
  }, [currentCompany]);

  useEffect(() => {
    if (selectedDistributorIds.length > 0) {
      loadComparison();
    } else {
      setComparison(null);
    }
  }, [selectedDistributorIds]);

  const loadDistributors = async () => {
    if (!currentCompany) return;

    try {
      const distributors = await db.cpgDistributors
        .where('company_id')
        .equals(currentCompany.id)
        .and((dist) => dist.active && !dist.deleted_at)
        .toArray();

      setAllDistributors(distributors);

      // Auto-select all distributors
      if (distributors.length > 0) {
        setSelectedDistributorIds(distributors.map((d) => d.id));
      }
    } catch (err) {
      console.error('Failed to load distributors:', err);
      setError('Failed to load distributors. Please try again.');
    }
  };

  const loadComparison = async () => {
    if (!currentCompany || selectedDistributorIds.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await compareDistributors(currentCompany.id, selectedDistributorIds);
      setComparison(data);
    } catch (err) {
      console.error('Failed to load comparison:', err);
      setError('Failed to load comparison. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDistributorToggle = (distributorId: string) => {
    setSelectedDistributorIds((prev) => {
      if (prev.includes(distributorId)) {
        return prev.filter((id) => id !== distributorId);
      } else {
        return [...prev, distributorId];
      }
    });
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Prepare data for CSV export
  const exportData =
    comparison?.distributors.map((dist) => ({
      Distributor: dist.distributorName,
      'Total Cost': dist.totalCost,
      'Cost Per Unit': dist.costPerUnit,
      'Margin Impact': dist.marginImpact,
      'Fee Count': dist.feeBreakdown.length,
    })) || [];

  if (!currentCompany) {
    return <div className={styles.container}>Please select a company</div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Distribution Cost Analysis</h1>
          <p className={styles.subtitle}>Compare distributors and identify the most cost-effective option</p>
        </div>
        <ReportExportButton
          reportData={exportData}
          reportType="distribution-cost-analysis"
          filename={`distribution-costs-${new Date().toISOString().split('T')[0]}.csv`}
        />
      </div>

      {/* Distributor Selection */}
      <div className={styles.selection}>
        <label className={styles.selectionLabel}>Select Distributors to Compare</label>
        <div className={styles.checkboxGroup}>
          {allDistributors.map((dist) => (
            <label key={dist.id} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selectedDistributorIds.includes(dist.id)}
                onChange={() => handleDistributorToggle(dist.id)}
                className={styles.checkbox}
              />
              <span>{dist.name}</span>
            </label>
          ))}
        </div>
        {allDistributors.length === 0 && (
          <p className={styles.emptyMessage}>No distributors found. Create a distributor first.</p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading comparison...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button onClick={loadComparison} className={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {/* Comparison Results */}
      {!isLoading && !error && comparison && (
        <>
          {/* Summary Cards */}
          <div className={styles.summaryCards}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Distributors Compared</div>
              <div className={styles.cardValue}>{comparison.distributors.length}</div>
            </div>
            <div className={`${styles.card} ${styles.successCard}`}>
              <div className={styles.cardLabel}>Most Cost-Effective</div>
              <div className={styles.cardValue}>
                {comparison.distributors.find((d) => d.distributorId === comparison.mostCostEffective)
                  ?.distributorName || 'N/A'}
              </div>
            </div>
            <div className={`${styles.card} ${styles.warningCard}`}>
              <div className={styles.cardLabel}>Least Cost-Effective</div>
              <div className={styles.cardValue}>
                {comparison.distributors.find((d) => d.distributorId === comparison.leastCostEffective)
                  ?.distributorName || 'N/A'}
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className={styles.tableContainer}>
            {comparison.distributors.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No distributor data available. Select distributors and run calculations first.</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Distributor</th>
                    <th className={styles.rightAlign}>Total Cost</th>
                    <th className={styles.rightAlign}>Cost Per Unit</th>
                    <th className={styles.rightAlign}>Margin Impact</th>
                    <th className={styles.rightAlign}>Fee Count</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.distributors.map((dist) => (
                    <tr
                      key={dist.distributorId}
                      className={
                        dist.distributorId === comparison.mostCostEffective
                          ? styles.bestRow
                          : dist.distributorId === comparison.leastCostEffective
                            ? styles.worstRow
                            : ''
                      }
                    >
                      <td className={styles.distributorName}>
                        {dist.distributorName}
                        {dist.distributorId === comparison.mostCostEffective && (
                          <span className={styles.bestBadge}>Best</span>
                        )}
                      </td>
                      <td className={styles.rightAlign}>{formatCurrency(dist.totalCost)}</td>
                      <td className={styles.rightAlign}>{formatCurrency(dist.costPerUnit)}</td>
                      <td className={styles.rightAlign}>
                        <span className={dist.marginImpact < 0 ? styles.negative : styles.positive}>
                          {formatPercentage(dist.marginImpact)}
                        </span>
                      </td>
                      <td className={styles.rightAlign}>{dist.feeBreakdown.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Fee Breakdown */}
          <div className={styles.feeBreakdownSection}>
            <h2 className={styles.sectionTitle}>Fee Breakdown by Distributor</h2>
            <div className={styles.feeBreakdownGrid}>
              {comparison.distributors.map((dist) => (
                <div key={dist.distributorId} className={styles.feeBreakdownCard}>
                  <h3 className={styles.feeBreakdownTitle}>{dist.distributorName}</h3>
                  {dist.feeBreakdown.length === 0 ? (
                    <p className={styles.noFees}>No fee structure defined</p>
                  ) : (
                    <ul className={styles.feeList}>
                      {dist.feeBreakdown.map((fee, index) => (
                        <li key={index} className={styles.feeItem}>
                          <span className={styles.feeName}>{fee.feeName}</span>
                          <span className={styles.feeAmount}>{formatCurrency(fee.feeAmount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className={styles.feeTotal}>
                    <span className={styles.feeTotalLabel}>Total:</span>
                    <span className={styles.feeTotalAmount}>{formatCurrency(dist.totalCost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* No Selection State */}
      {!isLoading && !error && !comparison && selectedDistributorIds.length === 0 && (
        <div className={styles.emptyState}>
          <p>Select at least one distributor to view the comparison.</p>
        </div>
      )}
    </div>
  );
};
