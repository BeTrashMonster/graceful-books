/**
 * Trade Spend Summary Report
 *
 * Lists all sales promos (past and upcoming):
 * - Total trade spend by period
 * - ROI (if sales data available)
 * - Margin impact of each promo
 * - Filter by retailer, status (approved/declined)
 * - Recommendations summary (participate vs. decline count)
 *
 * Per Group D3: CPG-Specific Reporting
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { ReportDateRangePicker, DateRange } from '../../../components/cpg/reports/ReportDateRangePicker';
import { ReportExportButton } from '../../../components/cpg/reports/ReportExportButton';
import { getTradeSpendSummary } from '../../../services/cpg/cpgReporting.service';
import type { TradeSpendSummary } from '../../../services/cpg/cpgReporting.service';
import styles from './TradeSpendReport.module.css';

type StatusFilter = 'all' | 'draft' | 'submitted' | 'approved' | 'declined';
type RecommendationFilter = 'all' | 'participate' | 'decline' | 'neutral';

export const TradeSpendReport = () => {
  const { currentCompany } = useAuth();
  const [summary, setSummary] = useState<TradeSpendSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range (default to last 90 days)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 90);
    start.setHours(0, 0, 0, 0);
    return { startDate: start, endDate: end, label: 'Last 90 Days' };
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [recommendationFilter, setRecommendationFilter] = useState<RecommendationFilter>('all');
  const [retailerFilter, setRetailerFilter] = useState<string>('all');

  // Available retailers for filter
  const [retailers, setRetailers] = useState<string[]>([]);

  useEffect(() => {
    loadReport();
  }, [currentCompany, dateRange]);

  useEffect(() => {
    if (summary) {
      extractRetailers();
    }
  }, [summary]);

  const loadReport = async () => {
    if (!currentCompany) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getTradeSpendSummary(
        currentCompany.id,
        dateRange.startDate.getTime(),
        dateRange.endDate.getTime()
      );
      setSummary(data);
    } catch (err) {
      console.error('Failed to load trade spend report:', err);
      setError('Failed to load report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const extractRetailers = () => {
    if (!summary) return;

    const uniqueRetailers = new Set<string>();
    summary.promos.forEach((promo) => {
      if (promo.retailerName) {
        uniqueRetailers.add(promo.retailerName);
      }
    });
    setRetailers(Array.from(uniqueRetailers).sort());
  };

  const getFilteredPromos = () => {
    if (!summary) return [];

    let filtered = [...summary.promos];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((promo) => promo.status === statusFilter);
    }

    // Apply recommendation filter
    if (recommendationFilter !== 'all') {
      filtered = filtered.filter((promo) => promo.recommendation === recommendationFilter);
    }

    // Apply retailer filter
    if (retailerFilter !== 'all') {
      filtered = filtered.filter((promo) => promo.retailerName === retailerFilter);
    }

    return filtered;
  };

  const filteredPromos = getFilteredPromos();

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(timestamp));
  };

  const formatPercentage = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getRecommendationBadge = (recommendation: string | null) => {
    if (!recommendation) return null;

    let badgeClass = '';
    let badgeText = '';

    switch (recommendation) {
      case 'participate':
        badgeClass = styles.participateBadge || '';
        badgeText = 'Participate';
        break;
      case 'decline':
        badgeClass = styles.declineBadge || '';
        badgeText = 'Decline';
        break;
      case 'neutral':
        badgeClass = styles.neutralBadge || '';
        badgeText = 'Neutral';
        break;
    }

    return <span className={`${styles.badge} ${badgeClass}`}>{badgeText}</span>;
  };

  const getStatusBadge = (status: string) => {
    let badgeClass = '';
    let badgeText = '';

    switch (status) {
      case 'approved':
        badgeClass = styles.approvedStatus || '';
        badgeText = 'Approved';
        break;
      case 'declined':
        badgeClass = styles.declinedStatus || '';
        badgeText = 'Declined';
        break;
      case 'submitted':
        badgeClass = styles.submittedStatus || '';
        badgeText = 'Submitted';
        break;
      case 'draft':
        badgeClass = styles.draftStatus || '';
        badgeText = 'Draft';
        break;
    }

    return <span className={`${styles.statusBadge} ${badgeClass}`}>{badgeText}</span>;
  };

  // Prepare data for CSV export
  const exportData = filteredPromos.map((promo) => ({
    'Promo Name': promo.promoName,
    Retailer: promo.retailerName || 'N/A',
    'Start Date': formatDate(promo.startDate),
    'End Date': formatDate(promo.endDate),
    'Total Cost': promo.totalCost,
    'Margin Impact': promo.marginImpact,
    Recommendation: promo.recommendation || 'N/A',
    Status: promo.status,
  }));

  if (!currentCompany) {
    return <div className={styles.container}>Please select a company</div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Trade Spend Summary</h1>
          <p className={styles.subtitle}>Sales promotions and trade spend analysis</p>
        </div>
        <ReportExportButton
          reportData={exportData}
          reportType="trade-spend-summary"
          filename={`trade-spend-${new Date().toISOString().split('T')[0]}.csv`}
        />
      </div>

      {/* Date Range Picker */}
      <ReportDateRangePicker selectedRange={dateRange} onRangeChange={setDateRange} />

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="status-filter" className={styles.filterLabel}>
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={styles.filterSelect}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="recommendation-filter" className={styles.filterLabel}>
            Recommendation
          </label>
          <select
            id="recommendation-filter"
            value={recommendationFilter}
            onChange={(e) => setRecommendationFilter(e.target.value as RecommendationFilter)}
            className={styles.filterSelect}
          >
            <option value="all">All Recommendations</option>
            <option value="participate">Participate</option>
            <option value="decline">Decline</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="retailer-filter" className={styles.filterLabel}>
            Retailer
          </label>
          <select
            id="retailer-filter"
            value={retailerFilter}
            onChange={(e) => setRetailerFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Retailers</option>
            {retailers.map((retailer) => (
              <option key={retailer} value={retailer}>
                {retailer}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading report...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button onClick={loadReport} className={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {/* Summary */}
      {!isLoading && !error && summary && (
        <>
          {/* Summary Cards */}
          <div className={styles.summaryCards}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Total Trade Spend</div>
              <div className={styles.cardValue}>{formatCurrency(summary.totalTradeSpend)}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Total Promos</div>
              <div className={styles.cardValue}>{summary.promoCount}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Approved</div>
              <div className={styles.cardValue}>{summary.approvedCount}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Declined</div>
              <div className={styles.cardValue}>{summary.declinedCount}</div>
            </div>
          </div>

          {/* Recommendation Summary */}
          <div className={styles.recommendationSummary}>
            <h2 className={styles.sectionTitle}>Recommendation Summary</h2>
            <div className={styles.recommendationGrid}>
              <div className={`${styles.recommendationCard} ${styles.participateCard}`}>
                <div className={styles.recommendationCount}>{summary.participateRecommendations}</div>
                <div className={styles.recommendationLabel}>Participate</div>
              </div>
              <div className={`${styles.recommendationCard} ${styles.declineCard}`}>
                <div className={styles.recommendationCount}>{summary.declineRecommendations}</div>
                <div className={styles.recommendationLabel}>Decline</div>
              </div>
              <div className={`${styles.recommendationCard} ${styles.neutralCard}`}>
                <div className={styles.recommendationCount}>{summary.neutralRecommendations}</div>
                <div className={styles.recommendationLabel}>Neutral</div>
              </div>
            </div>
          </div>

          {/* Promos Table */}
          <div className={styles.tableContainer}>
            {filteredPromos.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No promos found matching your filters.</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Promo Name</th>
                    <th>Retailer</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th className={styles.rightAlign}>Total Cost</th>
                    <th className={styles.rightAlign}>Margin Impact</th>
                    <th>Recommendation</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPromos.map((promo) => (
                    <tr key={promo.promoId}>
                      <td className={styles.promoName}>{promo.promoName}</td>
                      <td>{promo.retailerName || 'N/A'}</td>
                      <td>{formatDate(promo.startDate)}</td>
                      <td>{formatDate(promo.endDate)}</td>
                      <td className={styles.rightAlign}>{formatCurrency(promo.totalCost)}</td>
                      <td className={styles.rightAlign}>
                        <span className={promo.marginImpact < 0 ? styles.negative : styles.positive}>
                          {formatPercentage(promo.marginImpact)}
                        </span>
                      </td>
                      <td>{getRecommendationBadge(promo.recommendation)}</td>
                      <td>{getStatusBadge(promo.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};
