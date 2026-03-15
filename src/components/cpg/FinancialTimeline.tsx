/**
 * Financial Timeline Component
 *
 * Displays a compact timeline view of completed financial statements by month.
 * Shows P&L and Balance Sheet completion status with color coding.
 *
 * Features:
 * - Year filter dropdown
 * - Color-coded month boxes (green/yellow/gray)
 * - Hover preview with financial totals
 * - Click to view/edit specific period
 */

import { useState } from 'react';
import type { StandaloneFinancials } from '../../db/schema/standaloneFinancials.schema';
import styles from './FinancialTimeline.module.css';

export interface FinancialTimelineProps {
  plStatements: StandaloneFinancials[];
  balanceSheets: StandaloneFinancials[];
  onMonthClick: (month: number, year: number, hasData: { pl: boolean; bs: boolean }) => void;
  currentYear?: number;
  selectedMonth?: number | null;
  selectedYear?: number | null;
}

interface MonthData {
  month: number;
  year: number;
  hasPL: boolean;
  hasBS: boolean;
  plData?: StandaloneFinancials;
  bsData?: StandaloneFinancials;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function FinancialTimeline({
  plStatements,
  balanceSheets,
  onMonthClick,
  currentYear = new Date().getFullYear(),
  selectedMonth = null,
  selectedYear: propSelectedYear = null
}: FinancialTimelineProps) {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  // Get all years that have data
  const allYears = new Set<number>();
  [...plStatements, ...balanceSheets].forEach(statement => {
    const year = new Date(statement.period_end).getFullYear();
    allYears.add(year);
  });
  allYears.add(currentYear); // Always include current year

  const years = Array.from(allYears).sort((a, b) => b - a);

  // Build month data for selected year
  const monthsData: MonthData[] = MONTHS.map((_, index) => {
    const month = index;

    // Find statements for this month/year
    const plStatement = plStatements.find(s => {
      const date = new Date(s.period_end);
      return date.getMonth() === month && date.getFullYear() === selectedYear;
    });

    const bsStatement = balanceSheets.find(s => {
      const date = new Date(s.period_end);
      return date.getMonth() === month && date.getFullYear() === selectedYear;
    });

    return {
      month,
      year: selectedYear,
      hasPL: !!plStatement,
      hasBS: !!bsStatement,
      plData: plStatement,
      bsData: bsStatement,
    };
  });

  // Determine status for display
  const getStatus = () => {
    const hasAnyManual = monthsData.some(m => m.hasPL || m.hasBS);
    if (!hasAnyManual) return '';
    return 'Manual Entry';
  };

  // Get color class for month box
  const getMonthClass = (data: MonthData) => {
    if (data.hasPL && data.hasBS) return styles.monthComplete; // Green
    if (data.hasPL || data.hasBS) return styles.monthPartial; // Yellow
    return styles.monthEmpty; // Gray
  };

  // Check if month is currently selected
  const isMonthSelected = (data: MonthData) => {
    return selectedMonth === data.month && propSelectedYear === data.year;
  };

  return (
    <div className={styles.timeline}>
      {/* Header with year filter */}
      <div className={styles.timelineHeader}>
        <div className={styles.yearFilter}>
          <label htmlFor="year-select" className={styles.yearLabel}>Year:</label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={styles.yearSelect}
          >
            {years.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        {getStatus() && (
          <div className={styles.status}>Status: {getStatus()}</div>
        )}
      </div>

      {/* Month boxes */}
      <div className={styles.monthsContainer}>
        {monthsData.map((data, index) => (
          <div
            key={index}
            className={`${styles.monthBox} ${getMonthClass(data)} ${isMonthSelected(data) ? styles.monthSelected : ''}`}
            onClick={() => onMonthClick(data.month, data.year, { pl: data.hasPL, bs: data.hasBS })}
            onMouseEnter={() => setHoveredMonth(index)}
            onMouseLeave={() => setHoveredMonth(null)}
          >
            <span className={styles.monthName}>{MONTHS[index]}</span>
            <span className={styles.monthIndicator}>
              {data.hasPL && data.hasBS ? '✓✓' : data.hasPL ? '✓' : data.hasBS ? '✓' : ''}
            </span>

            {/* Hover Preview Tooltip */}
            {hoveredMonth === index && (
              <div className={styles.tooltip}>
                <div className={styles.tooltipContent}>
                  {/* P&L Card */}
                  <div className={styles.previewCard}>
                    <div className={styles.previewHeader}>
                      <span className={styles.previewIcon}>📄</span>
                      <span className={styles.previewTitle}>P&L</span>
                    </div>
                    {data.hasPL && data.plData ? (
                      <div className={styles.previewStats}>
                        <div className={styles.previewStat}>
                          <span>Revenue:</span>
                          <span>${data.plData.totals.revenue || '0.00'}</span>
                        </div>
                        <div className={styles.previewStat}>
                          <span>COGS:</span>
                          <span>${data.plData.totals.cogs || '0.00'}</span>
                        </div>
                        <div className={styles.previewStat}>
                          <span>Expenses:</span>
                          <span>${data.plData.totals.expenses || '0.00'}</span>
                        </div>
                        <div className={`${styles.previewStat} ${styles.previewTotal}`}>
                          <span>Net Income:</span>
                          <span className={parseFloat(data.plData.totals.net_income || '0') >= 0 ? styles.positive : styles.negative}>
                            ${data.plData.totals.net_income || '0.00'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.previewEmpty}>
                        <p>Click to add this month's P&L report</p>
                      </div>
                    )}
                  </div>

                  {/* Balance Sheet Card */}
                  <div className={styles.previewCard}>
                    <div className={styles.previewHeader}>
                      <span className={styles.previewIcon}>📄</span>
                      <span className={styles.previewTitle}>Balance Sheet</span>
                    </div>
                    {data.hasBS && data.bsData ? (
                      <div className={styles.previewStats}>
                        <div className={styles.previewStat}>
                          <span>Assets:</span>
                          <span>${data.bsData.totals.total_assets || '0.00'}</span>
                        </div>
                        <div className={styles.previewStat}>
                          <span>Liabilities:</span>
                          <span>${data.bsData.totals.total_liabilities || '0.00'}</span>
                        </div>
                        <div className={`${styles.previewStat} ${styles.previewTotal}`}>
                          <span>Equity:</span>
                          <span>${data.bsData.totals.equity || '0.00'}</span>
                        </div>
                        <div className={styles.balanceStatus}>
                          {data.bsData.totals.is_balanced ? (
                            <span className={styles.balanced}>✓ Balanced</span>
                          ) : (
                            <span className={styles.unbalanced}>⚠ Needs Review</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.previewEmpty}>
                        <p>Click to add this month's Balance Sheet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendBox} ${styles.monthComplete}`}></span>
          <span>Both P&L and Balance Sheet complete</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendBox} ${styles.monthPartial}`}></span>
          <span>P&L or Balance Sheet only</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendBox} ${styles.monthEmpty}`}></span>
          <span>No data</span>
        </div>
      </div>
    </div>
  );
}
