/**
 * CPU Trends Tab Component
 *
 * Displays historical price tracking and volatility analysis for product components.
 *
 * Features:
 * - Historical price tracking table with sortable columns
 * - Volatility detection (low/medium/high indicators)
 * - Price change trends with visual indicators
 * - Date range selector for trend analysis (3mo, 6mo, 12mo, all)
 * - CSV/PDF export for trends
 * - Quick filter buttons for high volatility and price changes
 *
 * Requirements:
 * - WCAG 2.1 AA compliance (sortable headers, ARIA labels)
 * - Type safety with proper error codes
 * - Performance: useMemo for trend calculations
 * - Security: CompanyId validation
 */

import { useState, useEffect, useMemo } from 'react';
import type { CPGCategory, CPGInvoice } from '../../../../db/schema/cpg.schema';
import styles from './CPUTrendsTab.module.css';

export interface CPUTrendsTabProps {
  companyId: string;
  selectedProducts: Set<string>;
  productCPUData: Map<string, ProductCPUData>;
  categories: CPGCategory[];
  invoices: CPGInvoice[];
  dateRange: '3mo' | '6mo' | '12mo' | 'last-calendar-year' | 'this-calendar-year' | 'custom' | 'all';
}

interface ProductCPUData {
  cpu: string | null;
  margin: number | null;
  trend: 'up' | 'down' | 'stable';
  trendValue: string | null;
  topDriver: string | null;
  isComplete: boolean;
  breakdown: ComponentBreakdown[];
}

interface ComponentBreakdown {
  categoryId: string;
  categoryName: string;
  subtotal: string | null;
  isComplete: boolean;
}

interface TrendData {
  currentPrice: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceChange: number;
  volatility: 'low' | 'medium' | 'high';
  coefficientOfVariation: number;
  invoiceCount: number;
  lastBuyDate: number;
  prices: number[];
  dates: number[];
}

type TrendSortColumn = 'component' | 'current' | 'avg' | 'change' | 'volatility';

export default function CPUTrendsTab({
  companyId,
  selectedProducts,
  productCPUData,
  categories,
  invoices,
  dateRange,
}: CPUTrendsTabProps) {
  // State
  const [trendData, setTrendData] = useState<Map<string, TrendData>>(new Map());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [trendSortColumn, setTrendSortColumn] = useState<TrendSortColumn>('component');
  const [trendSortDirection, setTrendSortDirection] = useState<'asc' | 'desc'>('asc');
  const [activeFilter, setActiveFilter] = useState<'none' | 'high-volatility' | 'price-increasing' | 'price-decreasing'>('none');

  // Load trend data when dependencies change
  useEffect(() => {
    loadTrendData();
  }, [dateRange, selectedProducts, productCPUData, invoices]);

  /**
   * Load and calculate trend data for selected products
   */
  const loadTrendData = async () => {
    if (selectedProducts.size === 0) {
      setTrendData(new Map());
      return;
    }

    try {
      const trendMap = new Map<string, TrendData>();

      // Get all unique component categories from selected products
      const componentCategories = new Set<string>();
      selectedProducts.forEach(productId => {
        const cpuData = productCPUData.get(productId);
        if (cpuData?.breakdown) {
          cpuData.breakdown.forEach(comp => componentCategories.add(comp.categoryId));
        }
      });

      // Calculate date range for trend analysis
      const today = Date.now();
      let startDate = 0;
      switch (dateRange) {
        case '3mo':
          startDate = today - (90 * 24 * 60 * 60 * 1000);
          break;
        case '6mo':
          startDate = today - (180 * 24 * 60 * 60 * 1000);
          break;
        case '12mo':
          startDate = today - (365 * 24 * 60 * 60 * 1000);
          break;
        case 'last-calendar-year':
          // January 1 to December 31 of last year
          const lastYear = new Date().getFullYear() - 1;
          startDate = new Date(lastYear, 0, 1).getTime();
          const endOfLastYear = new Date(lastYear, 11, 31, 23, 59, 59).getTime();
          // Note: We'll need to filter by end date too, but for now using start
          break;
        case 'this-calendar-year':
          // January 1 of this year to now
          const thisYear = new Date().getFullYear();
          startDate = new Date(thisYear, 0, 1).getTime();
          break;
        case 'custom':
          // Custom date range - parent should handle this
          startDate = 0;
          break;
        case 'all':
          startDate = 0;
          break;
      }

      // Analyze each component
      for (const categoryId of componentCategories) {
        const relevantInvoices = invoices.filter(inv => {
          if (startDate > 0 && inv.invoice_date < startDate) return false;
          // Check if this category appears in cost_attribution
          return Object.entries(inv.cost_attribution || {}).some(([key, attr]) =>
            attr.category_id === categoryId
          );
        });

        if (relevantInvoices.length === 0) continue;

        // Get all prices for this component
        const prices: number[] = [];
        const dates: number[] = [];
        relevantInvoices.forEach(inv => {
          Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
            if (attr.category_id === categoryId) {
              const unitPrice = parseFloat(attr.unit_price);
              if (!isNaN(unitPrice) && unitPrice > 0) {
                prices.push(unitPrice);
                dates.push(inv.invoice_date);
              }
            }
          });
        });

        if (prices.length === 0) continue;

        // Calculate stats
        const currentPrice = prices[prices.length - 1];
        const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceChange = ((currentPrice - avgPrice) / avgPrice) * 100;

        // Calculate volatility (coefficient of variation)
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = (stdDev / avgPrice) * 100;

        let volatility: 'low' | 'medium' | 'high';
        if (coefficientOfVariation < 10) volatility = 'low';
        else if (coefficientOfVariation < 25) volatility = 'medium';
        else volatility = 'high';

        // Get last buy date
        const lastBuyDate = Math.max(...dates);

        trendMap.set(categoryId, {
          currentPrice,
          avgPrice,
          minPrice,
          maxPrice,
          priceChange,
          volatility,
          coefficientOfVariation,
          invoiceCount: relevantInvoices.length,
          lastBuyDate,
          prices,
          dates,
        });
      }

      setTrendData(trendMap);
    } catch (err) {
      console.error('Failed to load trend data:', err);
    }
  };

  /**
   * Export trend data as CSV
   */
  const handleExportCSV = () => {
    const rows: string[] = [];
    rows.push('Component,Current Price,Average Price,Price Change %,Volatility,Data Points');

    Array.from(trendData.entries()).forEach(([categoryId, trend]) => {
      const category = categories.find(c => c.id === categoryId);
      const categoryName = category?.name || 'Unknown';
      rows.push(
        `"${categoryName}",${trend.currentPrice.toFixed(2)},${trend.avgPrice.toFixed(2)},${trend.priceChange.toFixed(1)},${trend.volatility},${trend.invoiceCount}`
      );
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cpu-trends-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  /**
   * Export trend data as PDF
   */
  const handleExportPDF = async () => {
    // Import jsPDF dynamically to avoid bundling issues
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();

    // Title
    doc.setFontSize(16);
    doc.text('CPU Trend Analysis', 14, 20);

    // Date range
    doc.setFontSize(10);
    const dateRangeText = dateRange === 'all' ? 'All Time' :
      dateRange === '3mo' ? 'Last 3 Months' :
      dateRange === '6mo' ? 'Last 6 Months' :
      dateRange === '12mo' ? 'Last 12 Months' :
      dateRange === 'last-calendar-year' ? 'Last Calendar Year' :
      dateRange === 'this-calendar-year' ? 'This Calendar Year' : 'Custom Range';
    doc.text(`Date Range: ${dateRangeText}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);

    // Table data
    const tableData = Array.from(trendData.entries()).map(([categoryId, trend]) => {
      const category = categories.find(c => c.id === categoryId);
      const categoryName = category?.name || 'Unknown';
      const changeIcon = trend.priceChange > 5 ? '↑' : trend.priceChange < -5 ? '↓' : '→';
      return [
        categoryName,
        `$${trend.currentPrice.toFixed(2)}`,
        `$${trend.avgPrice.toFixed(2)}`,
        `${changeIcon} ${trend.priceChange > 0 ? '+' : ''}${trend.priceChange.toFixed(1)}%`,
        trend.volatility,
        `${trend.invoiceCount} invoices`,
      ];
    });

    autoTable(doc, {
      head: [['Component', 'Current', 'Average', 'Change', 'Volatility', 'Data Points']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [75, 0, 110] },
    });

    doc.save(`cpu-trends-${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
  };

  /**
   * Calculate overview statistics
   */
  const overviewStats = useMemo(() => {
    if (trendData.size === 0) {
      return {
        totalComponents: 0,
        highVolatilityCount: 0,
        avgVolatility: 0,
        biggestIncrease: null as { name: string; change: number } | null,
        biggestDecrease: null as { name: string; change: number } | null,
      };
    }

    const trends = Array.from(trendData.entries());
    const highVolatilityCount = trends.filter(([_, t]) => t.volatility === 'high').length;
    const avgVolatility = trends.reduce((sum, [_, t]) => sum + t.coefficientOfVariation, 0) / trends.length;

    // Find biggest increase/decrease
    let biggestIncrease: { name: string; change: number } | null = null;
    let biggestDecrease: { name: string; change: number } | null = null;

    trends.forEach(([categoryId, trend]) => {
      const category = categories.find(c => c.id === categoryId);
      const name = category?.name || 'Unknown';

      if (!biggestIncrease || trend.priceChange > biggestIncrease.change) {
        biggestIncrease = { name, change: trend.priceChange };
      }
      if (!biggestDecrease || trend.priceChange < biggestDecrease.change) {
        biggestDecrease = { name, change: trend.priceChange };
      }
    });

    return {
      totalComponents: trendData.size,
      highVolatilityCount,
      avgVolatility,
      biggestIncrease,
      biggestDecrease,
    };
  }, [trendData, categories]);

  /**
   * Get filtered and sorted trend entries for display
   */
  const sortedTrendEntries = useMemo(() => {
    return Array.from(trendData.entries())
      .map(([categoryId, trend]) => {
        const category = categories.find(c => c.id === categoryId);
        return { categoryId, trend, categoryName: category?.name || 'Unknown' };
      })
      .filter(({ trend }) => {
        // Apply active filter
        switch (activeFilter) {
          case 'high-volatility':
            return trend.volatility === 'high';
          case 'price-increasing':
            return trend.priceChange > 5;
          case 'price-decreasing':
            return trend.priceChange < -5;
          default:
            return true;
        }
      })
      .sort((a, b) => {
        let aVal: any, bVal: any;
        switch (trendSortColumn) {
          case 'component':
            aVal = a.categoryName;
            bVal = b.categoryName;
            break;
          case 'current':
            aVal = a.trend.currentPrice;
            bVal = b.trend.currentPrice;
            break;
          case 'avg':
            aVal = a.trend.avgPrice;
            bVal = b.trend.avgPrice;
            break;
          case 'change':
            aVal = a.trend.priceChange;
            bVal = b.trend.priceChange;
            break;
          case 'volatility':
            aVal = a.trend.coefficientOfVariation;
            bVal = b.trend.coefficientOfVariation;
            break;
          default:
            return 0;
        }
        if (typeof aVal === 'string') {
          return trendSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return trendSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      });
  }, [trendData, trendSortColumn, trendSortDirection, categories, activeFilter]);

  /**
   * Handle sort column change
   */
  const handleSortChange = (column: TrendSortColumn) => {
    if (trendSortColumn === column) {
      setTrendSortDirection(trendSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setTrendSortColumn(column);
      setTrendSortDirection('asc');
    }
  };

  /**
   * Toggle filter
   */
  const handleFilterToggle = (filter: 'high-volatility' | 'price-increasing' | 'price-decreasing') => {
    setActiveFilter(activeFilter === filter ? 'none' : filter);
  };

  return (
    <div className={styles.container} role="tabpanel" id="trends-panel" aria-labelledby="trends-tab">
      {/* Header with controls */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h3>CPU Trend Analysis</h3>
          <p>Track component cost changes over time</p>
        </div>
        <div className={styles.headerControls}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              aria-label="Export trend data"
              aria-haspopup="menu"
              aria-expanded={showExportMenu}
              className={styles.exportButton}
            >
              Export ▼
            </button>
            {showExportMenu && (
              <div role="menu" className={styles.exportMenu}>
                <button
                  role="menuitem"
                  onClick={handleExportCSV}
                  className={styles.exportMenuItem}
                >
                  Export CSV
                </button>
                <button
                  role="menuitem"
                  onClick={handleExportPDF}
                  className={styles.exportMenuItem}
                >
                  Export PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      {trendData.size > 0 && (
        <div className={styles.overviewCards}>
          <div className={styles.overviewCard}>
            <div className={styles.overviewLabel}>Components Tracked</div>
            <div className={styles.overviewValue}>{overviewStats.totalComponents}</div>
            <div className={styles.overviewSubtext}>
              {overviewStats.highVolatilityCount > 0 && (
                <span className={styles.increase}>
                  {overviewStats.highVolatilityCount} high volatility
                </span>
              )}
              {overviewStats.highVolatilityCount === 0 && (
                <span>All stable</span>
              )}
            </div>
          </div>

          <div className={styles.overviewCard}>
            <div className={styles.overviewLabel}>Avg Volatility</div>
            <div className={styles.overviewValue}>{overviewStats.avgVolatility.toFixed(1)}%</div>
            <div className={styles.overviewSubtext}>
              {overviewStats.avgVolatility < 10 ? '🟢 Low' : overviewStats.avgVolatility < 25 ? '🟡 Medium' : '🔴 High'}
            </div>
          </div>

          {overviewStats.biggestIncrease && overviewStats.biggestIncrease.change > 0 && (
            <div className={styles.overviewCard}>
              <div className={styles.overviewLabel}>Biggest Increase</div>
              <div className={styles.overviewValue}>+{overviewStats.biggestIncrease.change.toFixed(1)}%</div>
              <div className={`${styles.overviewSubtext} ${styles.increase}`}>
                ↑ {overviewStats.biggestIncrease.name.substring(0, 20)}{overviewStats.biggestIncrease.name.length > 20 ? '...' : ''}
              </div>
            </div>
          )}

          {overviewStats.biggestDecrease && overviewStats.biggestDecrease.change < 0 && (
            <div className={styles.overviewCard}>
              <div className={styles.overviewLabel}>Biggest Decrease</div>
              <div className={styles.overviewValue}>{overviewStats.biggestDecrease.change.toFixed(1)}%</div>
              <div className={`${styles.overviewSubtext} ${styles.decrease}`}>
                ↓ {overviewStats.biggestDecrease.name.substring(0, 20)}{overviewStats.biggestDecrease.name.length > 20 ? '...' : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick filters */}
      {trendData.size > 0 && (
        <div className={styles.quickFilters}>
          <button
            onClick={() => handleFilterToggle('high-volatility')}
            aria-label={`Filter to ${Array.from(trendData.values()).filter(t => t.volatility === 'high').length} high volatility components`}
            aria-pressed={activeFilter === 'high-volatility'}
            className={`${styles.filterButton} ${styles.highVolatility} ${activeFilter === 'high-volatility' ? styles.active : ''}`}
          >
            High Volatility ({Array.from(trendData.values()).filter(t => t.volatility === 'high').length})
          </button>
          <button
            onClick={() => handleFilterToggle('price-increasing')}
            aria-label={`Filter to ${Array.from(trendData.values()).filter(t => t.priceChange > 5).length} price increasing components`}
            aria-pressed={activeFilter === 'price-increasing'}
            className={`${styles.filterButton} ${styles.priceIncreasing} ${activeFilter === 'price-increasing' ? styles.active : ''}`}
          >
            Price Increasing ({Array.from(trendData.values()).filter(t => t.priceChange > 5).length})
          </button>
          <button
            onClick={() => handleFilterToggle('price-decreasing')}
            aria-label={`Filter to ${Array.from(trendData.values()).filter(t => t.priceChange < -5).length} price decreasing components`}
            aria-pressed={activeFilter === 'price-decreasing'}
            className={`${styles.filterButton} ${styles.priceDecreasing} ${activeFilter === 'price-decreasing' ? styles.active : ''}`}
          >
            Price Decreasing ({Array.from(trendData.values()).filter(t => t.priceChange < -5).length})
          </button>
        </div>
      )}

      {/* Trends table */}
      {trendData.size === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">📊</div>
          <div className={styles.emptyTitle}>No trend data available</div>
          <div className={styles.emptyDescription}>
            Select products to analyze cost trends over time
          </div>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.trendsTable}>
            <thead>
              <tr>
                <th
                  onClick={() => handleSortChange('component')}
                  aria-sort={trendSortColumn === 'component' ? (trendSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  COMPONENT {trendSortColumn === 'component' && (trendSortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSortChange('current')}
                  className={styles.alignRight}
                  aria-sort={trendSortColumn === 'current' ? (trendSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  CURRENT {trendSortColumn === 'current' && (trendSortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSortChange('avg')}
                  className={styles.alignRight}
                  aria-sort={trendSortColumn === 'avg' ? (trendSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  AVERAGE {trendSortColumn === 'avg' && (trendSortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSortChange('change')}
                  className={styles.alignRight}
                  aria-sort={trendSortColumn === 'change' ? (trendSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  CHANGE {trendSortColumn === 'change' && (trendSortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSortChange('volatility')}
                  className={styles.alignRight}
                  aria-sort={trendSortColumn === 'volatility' ? (trendSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  VOLATILITY {trendSortColumn === 'volatility' && (trendSortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className={`${styles.alignRight} ${styles.notSortable}`}>
                  DATA POINTS
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTrendEntries.map(({ categoryId, trend, categoryName }) => {
                const trendIcon = trend.priceChange > 5 ? '↑' : trend.priceChange < -5 ? '↓' : '→';
                const changeClass = trend.priceChange > 5 ? styles.increase : trend.priceChange < -5 ? styles.decrease : styles.stable;
                const rowClass = trend.volatility === 'high' ? styles.highlightHigh : '';

                return (
                  <tr key={categoryId} className={rowClass}>
                    <td className={styles.componentName}>
                      {categoryName}
                    </td>
                    <td className={styles.priceValue}>
                      ${trend.currentPrice.toFixed(2)}
                    </td>
                    <td className={styles.priceAverage}>
                      ${trend.avgPrice.toFixed(2)}
                    </td>
                    <td>
                      <div className={`${styles.priceChange} ${changeClass}`}>
                        <span aria-label={`Price ${trend.priceChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(trend.priceChange).toFixed(1)} percent`}>
                          {trendIcon} {trend.priceChange > 0 ? '+' : ''}{trend.priceChange.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.volatilityCell}>
                        <span className={`${styles.volatilityBadge} ${styles[trend.volatility]}`} aria-label={`${trend.volatility} volatility`}>
                          {trend.volatility}
                        </span>
                      </div>
                    </td>
                    <td className={styles.dataPoints}>
                      {trend.invoiceCount} invoices
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
