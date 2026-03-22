/**
 * Financial Timeline Component (Vertical Sidebar Version)
 *
 * Displays a vertical month navigator for financial statements.
 * Shows P&L and Balance Sheet completion status with intuitive indicators.
 *
 * Features:
 * - Vertical month list (all 12 months visible)
 * - Year selector at top
 * - Status indicators (both/one/none)
 * - Hover preview with key financial info
 * - Click to select month
 * - Sticky positioning
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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

  // Get status class for month
  const getMonthClass = (data: MonthData) => {
    if (data.hasPL && data.hasBS) return styles.monthBoth; // Green
    if (data.hasPL || data.hasBS) return styles.monthOne; // Yellow
    return styles.monthNone; // Gray
  };

  // Get status indicator
  const getStatusIndicator = (data: MonthData) => {
    if (data.hasPL && data.hasBS) return '✓✓';
    if (data.hasPL) return '✓ P&L';
    if (data.hasBS) return '✓ BS';
    return '○';
  };

  // Check if month is currently selected
  const isMonthSelected = (data: MonthData) => {
    return selectedMonth === data.month && propSelectedYear === data.year;
  };

  // Format currency for tooltip
  const formatCurrency = (value: string | number | undefined) => {
    if (!value) return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className={styles.timeline}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>Select Month</h3>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className={styles.yearSelect}
          aria-label="Select year"
        >
          {years.map(year => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* Vertical Month List */}
      <div className={styles.monthList}>
        {monthsData.map((data) => (
          <div
            key={data.month}
            className={`${styles.monthRow} ${getMonthClass(data)} ${isMonthSelected(data) ? styles.monthSelected : ''}`}
            onClick={() => onMonthClick(data.month, data.year, { pl: data.hasPL, bs: data.hasBS })}
            onMouseEnter={() => setHoveredMonth(data.month)}
            onMouseLeave={() => setHoveredMonth(null)}
            role="button"
            tabIndex={0}
            aria-label={`${MONTHS[data.month]} ${selectedYear}`}
          >
            <span className={styles.monthName}>{MONTHS[data.month]}</span>
            <span className={styles.monthStatus}>{getStatusIndicator(data)}</span>

            {/* Hover Tooltip */}
            {hoveredMonth === data.month && (
              <div className={styles.tooltip}>
                <div className={styles.tooltipContent}>
                  <h4 className={styles.tooltipTitle}>{MONTHS[data.month]} {selectedYear}</h4>

                  <div className={styles.tooltipSection}>
                    <div className={styles.tooltipHeader}>
                      <span className={styles.tooltipIcon}>📄</span>
                      <span className={styles.tooltipLabel}>Profit & Loss</span>
                    </div>
                    {data.hasPL && data.plData ? (
                      <div className={styles.tooltipStats}>
                        <div className={styles.tooltipStat}>
                          <span>Net Income:</span>
                          <span className={parseFloat(data.plData.totals.net_income || '0') >= 0 ? styles.positive : styles.negative}>
                            {formatCurrency(data.plData.totals.net_income)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.tooltipEmpty}>Not entered yet</p>
                    )}
                  </div>

                  <div className={styles.tooltipSection}>
                    <div className={styles.tooltipHeader}>
                      <span className={styles.tooltipIcon}>⚖</span>
                      <span className={styles.tooltipLabel}>Balance Sheet</span>
                    </div>
                    {data.hasBS && data.bsData ? (
                      <div className={styles.tooltipStats}>
                        {data.bsData.totals.is_balanced ? (
                          <div className={styles.balanced}>✓ Balanced</div>
                        ) : (
                          <div className={styles.unbalanced}>⚠ Needs Review</div>
                        )}
                      </div>
                    ) : (
                      <p className={styles.tooltipEmpty}>Not entered yet</p>
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
        <div className={styles.legendTitle}>Status</div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendBoth}`}></span>
          <span>Both Statements</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendOne}`}></span>
          <span>One Statement</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendNone}`}></span>
          <span>Not Started</span>
        </div>
      </div>
    </div>
  );
}
