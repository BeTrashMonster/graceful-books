/**
 * CPG-Enhanced P&L Report
 *
 * Standard P&L enhanced with CPG data:
 * - CPU breakdown by category/variant
 * - Distribution costs by distributor
 * - Trade spend (sales promos)
 * - Gross margin % by product line
 * - Compare periods (month-over-month, year-over-year)
 *
 * Per Group D3: CPG-Specific Reporting
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { ReportDateRangePicker, DateRange } from '../../../components/cpg/reports/ReportDateRangePicker';
import { ReportExportButton } from '../../../components/cpg/reports/ReportExportButton';
import { generateCPGProfitLoss } from '../../../services/cpg/cpgReporting.service';
import type { CPGProfitLossReport } from '../../../services/cpg/cpgReporting.service';
import styles from './CPGProfitLoss.module.css';

export const CPGProfitLoss = () => {
  const { currentCompany } = useAuth();
  const [report, setReport] = useState<CPGProfitLossReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range (default to last 30 days)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { startDate: start, endDate: end, label: 'Last 30 Days' };
  });

  useEffect(() => {
    loadReport();
  }, [currentCompany, dateRange]);

  const loadReport = async () => {
    if (!currentCompany) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await generateCPGProfitLoss(
        currentCompany.id,
        dateRange.startDate.getTime(),
        dateRange.endDate.getTime()
      );
      setReport(data);
    } catch (err) {
      console.error('Failed to load CPG P&L report:', err);
      setError('Failed to load report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  // Prepare data for CSV export
  const exportData = report
    ? [
        { Section: 'Revenue', Amount: report.revenue },
        { Section: 'COGS', Amount: report.cogs },
        { Section: 'Operating Expenses', Amount: report.operatingExpenses },
        { Section: 'Net Income', Amount: report.netIncome },
        ...report.cpuBreakdown.map((item) => ({
          Section: `CPU - ${item.categoryName} ${item.variant || ''}`,
          Amount: item.cpu,
        })),
      ]
    : [];

  if (!currentCompany) {
    return <div className={styles.container}>Please select a company</div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>CPG-Enhanced P&L Report</h1>
          <p className={styles.subtitle}>Profit & Loss with cost per unit and distribution breakdowns</p>
        </div>
        <ReportExportButton
          reportData={exportData}
          reportType="cpg-profit-loss"
          filename={`cpg-pl-${new Date().toISOString().split('T')[0]}.csv`}
        />
      </div>

      {/* Date Range Picker */}
      <ReportDateRangePicker selectedRange={dateRange} onRangeChange={setDateRange} />

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

      {/* Report Content */}
      {!isLoading && !error && report && (
        <>
          {/* Summary Cards */}
          <div className={styles.summaryCards}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Revenue</div>
              <div className={styles.cardValue}>{formatCurrency(report.revenue)}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>COGS</div>
              <div className={styles.cardValue}>{formatCurrency(report.cogs)}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Gross Profit</div>
              <div className={styles.cardValue}>
                {formatCurrency(report.revenue - report.cogs)}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Net Income</div>
              <div className={`${styles.cardValue} ${report.netIncome >= 0 ? styles.positive : styles.negative}`}>
                {formatCurrency(report.netIncome)}
              </div>
            </div>
          </div>

          {/* CPU Breakdown */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Cost Per Unit (CPU) Breakdown</h2>
            {report.cpuBreakdown.length === 0 ? (
              <p className={styles.emptyMessage}>No CPU data available for this period.</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Variant</th>
                      <th className={styles.rightAlign}>CPU</th>
                      <th className={styles.rightAlign}>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.cpuBreakdown.map((item, index) => (
                      <tr key={index}>
                        <td>{item.categoryName}</td>
                        <td>{item.variant || 'N/A'}</td>
                        <td className={styles.rightAlign}>{formatCurrency(item.cpu)}</td>
                        <td className={styles.rightAlign}>{formatCurrency(item.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Distribution Costs */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Distribution Costs</h2>
            {report.distributionCosts.length === 0 ? (
              <p className={styles.emptyMessage}>No distribution cost data for this period.</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Distributor</th>
                      <th className={styles.rightAlign}>Total Cost</th>
                      <th className={styles.rightAlign}>Cost Per Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.distributionCosts.map((item, index) => (
                      <tr key={index}>
                        <td>{item.distributorName}</td>
                        <td className={styles.rightAlign}>{formatCurrency(item.totalCost)}</td>
                        <td className={styles.rightAlign}>{formatCurrency(item.costPerUnit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Trade Spend */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Trade Spend Summary</h2>
            <div className={styles.tradeSpendGrid}>
              <div className={styles.tradeSpendCard}>
                <div className={styles.cardLabel}>Total Spend</div>
                <div className={styles.cardValue}>{formatCurrency(report.tradeSpend.totalSpend)}</div>
              </div>
              <div className={styles.tradeSpendCard}>
                <div className={styles.cardLabel}>Promo Count</div>
                <div className={styles.cardValue}>{report.tradeSpend.promoCount}</div>
              </div>
              <div className={styles.tradeSpendCard}>
                <div className={styles.cardLabel}>Avg Margin Impact</div>
                <div className={styles.cardValue}>
                  <span className={report.tradeSpend.avgMarginImpact < 0 ? styles.negative : styles.positive}>
                    {formatPercentage(report.tradeSpend.avgMarginImpact)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Gross Margin by Product */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Gross Margin by Product</h2>
            {report.grossMarginByProduct.length === 0 ? (
              <p className={styles.emptyMessage}>No margin data available for this period.</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Variant</th>
                      <th className={styles.rightAlign}>Gross Margin</th>
                      <th className={styles.rightAlign}>Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.grossMarginByProduct.map((item, index) => (
                      <tr key={index}>
                        <td>{item.categoryName}</td>
                        <td>{item.variant || 'N/A'}</td>
                        <td className={styles.rightAlign}>{formatCurrency(item.margin)}</td>
                        <td className={styles.rightAlign}>
                          <span
                            className={
                              item.marginPercentage >= 70
                                ? styles.marginBest
                                : item.marginPercentage >= 60
                                  ? styles.marginBetter
                                  : item.marginPercentage >= 50
                                    ? styles.marginGood
                                    : styles.marginPoor
                            }
                          >
                            {formatPercentage(item.marginPercentage)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
