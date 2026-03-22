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

import { useState, useRef } from 'react';
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
  isFullPL: boolean;
  isFullBS: boolean;
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
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, right: 0 });
  const monthRowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Get all years that have data
  const allYears = new Set<number>();
  [...plStatements, ...balanceSheets].forEach(statement => {
    const year = new Date(statement.period_end).getFullYear();
    allYears.add(year);
  });
  allYears.add(currentYear); // Always include current year

  const years = Array.from(allYears).sort((a, b) => b - a);

  // Helper function to check if a statement covers the full month
  const isFullMonth = (periodStart: number, periodEnd: number, month: number, year: number): boolean => {
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    // Get the first and last day of the month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

    // Check if the period covers the entire month (within 1 day tolerance for date handling)
    const coversStart = startDate <= new Date(monthStart.getTime() + 24 * 60 * 60 * 1000);
    const coversEnd = endDate >= new Date(monthEnd.getTime() - 24 * 60 * 60 * 1000);

    return coversStart && coversEnd;
  };

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
      isFullPL: plStatement ? isFullMonth(plStatement.period_start, plStatement.period_end, month, selectedYear) : false,
      isFullBS: bsStatement ? isFullMonth(bsStatement.period_start, bsStatement.period_end, month, selectedYear) : false,
      plData: plStatement,
      bsData: bsStatement,
    };
  });

  // Get status class for month
  const getMonthClass = (data: MonthData) => {
    // Both statements entered
    if (data.hasPL && data.hasBS) {
      // Check if both are full month
      if (data.isFullPL && data.isFullBS) {
        return styles.monthBothFull; // Green - truly complete!
      } else {
        return styles.monthBothPartial; // Purple - partial data (in progress!)
      }
    }

    // One statement entered
    if (data.hasPL || data.hasBS) {
      const isFull = data.hasPL ? data.isFullPL : data.isFullBS;
      if (isFull) {
        return styles.monthOneFull; // Yellow with ✓
      } else {
        return styles.monthOnePartial; // Yellow with ◐
      }
    }

    return styles.monthNone; // Gray - not started
  };

  // Get status indicator
  const getStatusIndicator = (data: MonthData) => {
    // Both statements
    if (data.hasPL && data.hasBS) {
      if (data.isFullPL && data.isFullBS) {
        return '✓✓'; // Both full
      } else {
        return '◐◐'; // Both partial
      }
    }

    // One statement
    if (data.hasPL) {
      return data.isFullPL ? '✓ P&L' : '◐ P&L';
    }
    if (data.hasBS) {
      return data.isFullBS ? '✓ BS' : '◐ BS';
    }

    return '○'; // Not started
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

  // Format date range for tooltip
  const formatDateRange = (periodStart: number, periodEnd: number) => {
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const start = startDate.toLocaleDateString('en-US', formatOptions);
    const end = endDate.toLocaleDateString('en-US', formatOptions);

    return `${start} - ${end}`;
  };

  // Handle mouse enter with position calculation
  const handleMouseEnter = (month: number, index: number) => {
    setHoveredMonth(month);

    // Calculate tooltip position based on month row position
    const monthRow = monthRowRefs.current[index];
    if (monthRow) {
      const rect = monthRow.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top,
        right: window.innerWidth - rect.left + 16, // 16px gap from left edge of month row
      });
    }
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
        {monthsData.map((data, index) => (
          <div
            key={data.month}
            ref={el => monthRowRefs.current[index] = el}
            className={`${styles.monthRow} ${getMonthClass(data)} ${isMonthSelected(data) ? styles.monthSelected : ''}`}
            onClick={() => onMonthClick(data.month, data.year, { pl: data.hasPL, bs: data.hasBS })}
            onMouseEnter={() => handleMouseEnter(data.month, index)}
            onMouseLeave={() => setHoveredMonth(null)}
            role="button"
            tabIndex={0}
            aria-label={`${MONTHS[data.month]} ${selectedYear}`}
          >
            <span className={styles.monthName}>{MONTHS[data.month]}</span>
            <span className={styles.monthStatus}>{getStatusIndicator(data)}</span>
          </div>
        ))}
      </div>

      {/* Hover Tooltip - Rendered outside scroll container */}
      {hoveredMonth !== null && (
        <div
          className={styles.tooltip}
          style={{
            position: 'fixed',
            top: `${tooltipPosition.top}px`,
            right: `${tooltipPosition.right}px`,
          }}
        >
          <div className={styles.tooltipContent}>
            <h4 className={styles.tooltipTitle}>{MONTHS[hoveredMonth]} {selectedYear}</h4>

            {/* P&L Section */}
            <div className={styles.tooltipSection}>
              <div className={styles.tooltipHeader}>
                <div className={styles.tooltipHeaderLeft}>
                  <span className={styles.tooltipIcon}>📄</span>
                  <span className={styles.tooltipLabel}>Profit & Loss</span>
                </div>
                {monthsData[hoveredMonth]?.plData && (
                  <span className={styles.tooltipDateRange}>
                    {formatDateRange(monthsData[hoveredMonth].plData!.period_start, monthsData[hoveredMonth].plData!.period_end)}
                  </span>
                )}
              </div>
              {monthsData[hoveredMonth]?.hasPL && monthsData[hoveredMonth]?.plData ? (
                <div className={styles.tooltipStats}>
                  <div className={styles.tooltipStat}>
                    <span>Revenue:</span>
                    <span>{formatCurrency(monthsData[hoveredMonth].plData!.totals.revenue)}</span>
                  </div>
                  <div className={styles.tooltipStat}>
                    <span>COGS:</span>
                    <span>{formatCurrency(monthsData[hoveredMonth].plData!.totals.cogs)}</span>
                  </div>
                  <div className={styles.tooltipStat}>
                    <span>Expenses:</span>
                    <span>{formatCurrency(monthsData[hoveredMonth].plData!.totals.expenses)}</span>
                  </div>
                  <div className={`${styles.tooltipStat} ${styles.tooltipTotal}`}>
                    <span>Net Income:</span>
                    <span className={parseFloat(monthsData[hoveredMonth].plData!.totals.net_income || '0') >= 0 ? styles.positive : styles.negative}>
                      {formatCurrency(monthsData[hoveredMonth].plData!.totals.net_income)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className={styles.tooltipEmpty}>Not entered yet</p>
              )}
            </div>

            {/* Balance Sheet Section */}
            <div className={styles.tooltipSection}>
              <div className={styles.tooltipHeader}>
                <div className={styles.tooltipHeaderLeft}>
                  <span className={styles.tooltipIcon}>⚖</span>
                  <span className={styles.tooltipLabel}>Balance Sheet</span>
                </div>
                {monthsData[hoveredMonth]?.bsData && (
                  <span className={styles.tooltipDateRange}>
                    {formatDateRange(monthsData[hoveredMonth].bsData!.period_start, monthsData[hoveredMonth].bsData!.period_end)}
                  </span>
                )}
              </div>
              {monthsData[hoveredMonth]?.hasBS && monthsData[hoveredMonth]?.bsData ? (
                <div className={styles.tooltipStats}>
                  <div className={styles.tooltipStat}>
                    <span>Assets:</span>
                    <span>{formatCurrency(monthsData[hoveredMonth].bsData!.totals.total_assets)}</span>
                  </div>
                  <div className={styles.tooltipStat}>
                    <span>Liabilities:</span>
                    <span>{formatCurrency(monthsData[hoveredMonth].bsData!.totals.total_liabilities)}</span>
                  </div>
                  <div className={`${styles.tooltipStat} ${styles.tooltipTotal}`}>
                    <span>Equity:</span>
                    <span>{formatCurrency(monthsData[hoveredMonth].bsData!.totals.equity)}</span>
                  </div>
                  <div className={styles.balanceStatus}>
                    {monthsData[hoveredMonth].bsData!.totals.is_balanced ? (
                      <div className={styles.balanced}>✓ Balanced</div>
                    ) : (
                      <div className={styles.unbalanced}>⚠ Needs Review</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className={styles.tooltipEmpty}>Not entered yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendTitle}>Status</div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendBothFull}`}></span>
          <span>Full Month Complete</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendBothPartial}`}></span>
          <span>Partial Month Data</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendOne}`}></span>
          <span>One Statement Only</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendNone}`}></span>
          <span>Not Started</span>
        </div>
      </div>
    </div>
  );
}
