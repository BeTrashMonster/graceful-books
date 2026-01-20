/**
 * MonthlyDistributionReport Component
 *
 * Admin component for generating and managing monthly charity distribution reports.
 * Allows admin to generate reports, export to CSV, and manage payment distribution.
 *
 * Requirements:
 * - IC2.5: Charity Payment Distribution System
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect } from 'react';
import {
  generateMonthlyReport,
  exportReportToCSV,
  createDistributionRecords,
  getDistributionsForMonth,
  reconcileContributions,
  type MonthlyDistributionReport as ReportData,
} from '../../services/admin/charityDistribution.service';
import type { CharityDistribution } from '../../types/billing.types';
import styles from './MonthlyDistributionReport.module.css';

export function MonthlyDistributionReport() {
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [report, setReport] = useState<ReportData | null>(null);
  const [distributions, setDistributions] = useState<CharityDistribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reconciliation, setReconciliation] = useState<{
    expected_total: number;
    distributed_total: number;
    difference: number;
    is_balanced: boolean;
  } | null>(null);

  // Load report when month changes
  useEffect(() => {
    if (selectedMonth) {
      loadReport();
    }
  }, [selectedMonth]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const [reportData, existingDistributions, reconciliationData] = await Promise.all([
        generateMonthlyReport(selectedMonth),
        getDistributionsForMonth(selectedMonth),
        reconcileContributions(selectedMonth),
      ]);

      setReport(reportData);
      setDistributions(existingDistributions);
      setReconciliation(reconciliationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDistributions = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const created = await createDistributionRecords(selectedMonth);
      setDistributions(created);
      setSuccessMessage(
        `Distribution records created successfully for ${created.length} charities.`
      );

      // Reload reconciliation
      const reconciliationData = await reconcileContributions(selectedMonth);
      setReconciliation(reconciliationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create distribution records');
      console.error('Error creating distributions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;

    try {
      const csv = exportReportToCSV(report);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `charity-distribution-${selectedMonth}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMessage('Report exported successfully to CSV.');
    } catch (err) {
      setError('Failed to export CSV');
      console.error('Error exporting CSV:', err);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
    setSuccessMessage(null);
    setError(null);
  };

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const hasDistributions = distributions.length > 0;
  const allPending = distributions.every(d => d.status === 'pending');
  const allSent = distributions.every(d => d.status === 'sent' || d.status === 'confirmed');

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Monthly Distribution Report</h1>
          <p className={styles.subtitle}>
            Review and process monthly charity contributions
          </p>
        </div>
      </header>

      {/* Month Selector */}
      <div className={styles.controls}>
        <div className={styles.monthSelector}>
          <label htmlFor="month-select" className={styles.label}>
            Select Month
          </label>
          <input
            id="month-select"
            type="month"
            value={selectedMonth}
            onChange={handleMonthChange}
            max={getCurrentMonth()}
            className={styles.monthInput}
            aria-describedby="month-help"
          />
          <span id="month-help" className={styles.helpText}>
            Choose the month to generate the distribution report
          </span>
        </div>

        <div className={styles.actionButtons}>
          {report && (
            <button
              type="button"
              onClick={handleExportCSV}
              className={styles.exportButton}
              disabled={loading}
              aria-label="Export report to CSV"
            >
              Export CSV
            </button>
          )}

          {report && !hasDistributions && (
            <button
              type="button"
              onClick={handleCreateDistributions}
              className={styles.primaryButton}
              disabled={loading}
              aria-label="Create distribution records"
            >
              Create Distribution Records
            </button>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className={styles.errorMessage} role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {successMessage && (
        <div className={styles.successMessage} role="status" aria-live="polite">
          <strong>Success:</strong> {successMessage}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={styles.loading} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true"></div>
          <span>Loading report...</span>
        </div>
      )}

      {/* Report Summary */}
      {report && !loading && (
        <div className={styles.summary}>
          <h2 className={styles.sectionTitle}>Summary</h2>
          <div className={styles.summaryGrid}>
            <SummaryCard
              label="Total Amount to Distribute"
              value={formatCurrency(report.total_amount)}
              color="blue"
            />
            <SummaryCard
              label="Number of Charities"
              value={report.charity_count.toString()}
              color="green"
            />
            <SummaryCard
              label="Report Generated"
              value={new Date(report.generated_at).toLocaleDateString()}
              color="gray"
            />
          </div>

          {/* Reconciliation Status */}
          {reconciliation && (
            <div className={styles.reconciliation}>
              <h3 className={styles.reconciliationTitle}>Reconciliation Status</h3>
              <div className={styles.reconciliationGrid}>
                <div className={styles.reconciliationItem}>
                  <span className={styles.reconciliationLabel}>Expected Total:</span>
                  <span className={styles.reconciliationValue}>
                    {formatCurrency(reconciliation.expected_total)}
                  </span>
                </div>
                <div className={styles.reconciliationItem}>
                  <span className={styles.reconciliationLabel}>Distributed Total:</span>
                  <span className={styles.reconciliationValue}>
                    {formatCurrency(reconciliation.distributed_total)}
                  </span>
                </div>
                <div className={styles.reconciliationItem}>
                  <span className={styles.reconciliationLabel}>Difference:</span>
                  <span
                    className={`${styles.reconciliationValue} ${
                      reconciliation.is_balanced ? styles.balanced : styles.unbalanced
                    }`}
                  >
                    {formatCurrency(Math.abs(reconciliation.difference))}
                    {reconciliation.is_balanced && ' ✓'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contribution List */}
      {report && report.contributions.length > 0 && !loading && (
        <div className={styles.contributionsList}>
          <h2 className={styles.sectionTitle}>
            Contributions ({report.contributions.length})
          </h2>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Charity Name</th>
                  <th scope="col">EIN</th>
                  <th scope="col">Total Amount</th>
                  <th scope="col">Contributors</th>
                  <th scope="col">Payment Address</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.contributions.map((contribution, _index) => {
                  const distRecord = distributions.find(
                    d => d.charity_id === contribution.charity_id
                  );

                  return (
                    <tr key={contribution.charity_id}>
                      <td className={styles.charityName}>
                        {contribution.charity_name}
                        <a
                          href={contribution.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.websiteLink}
                          aria-label={`Visit ${contribution.charity_name} website`}
                        >
                          View website
                        </a>
                      </td>
                      <td className={styles.ein}>{contribution.charity_ein}</td>
                      <td className={styles.amount}>
                        {formatCurrency(contribution.total_amount)}
                      </td>
                      <td className={styles.count}>{contribution.contributor_count}</td>
                      <td className={styles.address}>
                        {contribution.payment_address || (
                          <span className={styles.missingAddress}>Not provided</span>
                        )}
                      </td>
                      <td className={styles.status}>
                        {distRecord ? (
                          <StatusBadge status={distRecord.status} />
                        ) : (
                          <span className={styles.noDist}>Not created</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {report && report.contributions.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            No contributions found for {formatMonthDisplay(selectedMonth)}.
          </p>
          <p className={styles.emptyStateSubtext}>
            This could mean no users had active subscriptions during this month,
            or no users have selected a charity yet.
          </p>
        </div>
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
  color: 'blue' | 'green' | 'gray';
}

function SummaryCard({ label, value, color }: SummaryCardProps) {
  return (
    <div className={`${styles.summaryCard} ${styles[`summaryCard${capitalize(color)}`]}`}>
      <div className={styles.summaryCardLabel}>{label}</div>
      <div className={styles.summaryCardValue}>{value}</div>
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
 * Helper Functions
 */

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthDisplay(monthString: string): string {
  const [year, month] = monthString.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
