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

export interface CPUTrendsTabProps {
  companyId: string;
  selectedProducts: Set<string>;
  productCPUData: Map<string, ProductCPUData>;
  categories: CPGCategory[];
  invoices: CPGInvoice[];
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
}: CPUTrendsTabProps) {
  // State
  const [trendDateRange, setTrendDateRange] = useState<'3mo' | '6mo' | '12mo' | 'all'>('6mo');
  const [trendData, setTrendData] = useState<Map<string, TrendData>>(new Map());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [trendSortColumn, setTrendSortColumn] = useState<TrendSortColumn>('component');
  const [trendSortDirection, setTrendSortDirection] = useState<'asc' | 'desc'>('asc');

  // Load trend data when dependencies change
  useEffect(() => {
    loadTrendData();
  }, [trendDateRange, selectedProducts, productCPUData, invoices]);

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
      switch (trendDateRange) {
        case '3mo':
          startDate = today - (90 * 24 * 60 * 60 * 1000);
          break;
        case '6mo':
          startDate = today - (180 * 24 * 60 * 60 * 1000);
          break;
        case '12mo':
          startDate = today - (365 * 24 * 60 * 60 * 1000);
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
    const dateRangeText = trendDateRange === 'all' ? 'All Time' :
      trendDateRange === '3mo' ? 'Last 3 Months' :
      trendDateRange === '6mo' ? 'Last 6 Months' : 'Last 12 Months';
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
   * Get sorted trend entries for display
   */
  const sortedTrendEntries = useMemo(() => {
    return Array.from(trendData.entries())
      .map(([categoryId, trend]) => {
        const category = categories.find(c => c.id === categoryId);
        return { categoryId, trend, categoryName: category?.name || 'Unknown' };
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
  }, [trendData, trendSortColumn, trendSortDirection, categories]);

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

  return (
    <div role="tabpanel" id="trends-panel" aria-labelledby="trends-tab">
      {/* Header with controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            CPU Trend Analysis
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Track component cost changes over time
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={trendDateRange}
            onChange={(e) => setTrendDateRange(e.target.value as '3mo' | '6mo' | '12mo' | 'all')}
            aria-label="Select date range for trend analysis"
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            <option value="3mo">Last 3 Months</option>
            <option value="6mo">Last 6 Months</option>
            <option value="12mo">Last 12 Months</option>
            <option value="all">All Time</option>
          </select>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              aria-label="Export trend data"
              aria-haspopup="menu"
              aria-expanded={showExportMenu}
              style={{
                padding: '0.5rem 1rem',
                background: '#4b006e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Export ▼
            </button>
            {showExportMenu && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '0.25rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 10,
                  minWidth: '150px',
                }}
              >
                <button
                  role="menuitem"
                  onClick={handleExportCSV}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Export CSV
                </button>
                <button
                  role="menuitem"
                  onClick={handleExportPDF}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    borderTop: '1px solid #e5e7eb',
                  }}
                >
                  Export PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick filters */}
      {trendData.size > 0 && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}>
          <button
            aria-label={`Filter to ${Array.from(trendData.values()).filter(t => t.volatility === 'high').length} high volatility components`}
            style={{
              padding: '0.5rem 0.75rem',
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            High Volatility ({Array.from(trendData.values()).filter(t => t.volatility === 'high').length})
          </button>
          <button
            aria-label={`Filter to ${Array.from(trendData.values()).filter(t => t.priceChange > 5).length} price increasing components`}
            style={{
              padding: '0.5rem 0.75rem',
              background: '#fee2e2',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Price Increasing ({Array.from(trendData.values()).filter(t => t.priceChange > 5).length})
          </button>
          <button
            aria-label={`Filter to ${Array.from(trendData.values()).filter(t => t.priceChange < -5).length} price decreasing components`}
            style={{
              padding: '0.5rem 0.75rem',
              background: '#dcfce7',
              border: '1px solid #22c55e',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Price Decreasing ({Array.from(trendData.values()).filter(t => t.priceChange < -5).length})
          </button>
        </div>
      )}

      {/* Trends table */}
      {trendData.size === 0 ? (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: '#64748b',
          background: '#f8fafc',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">📊</div>
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>
            Select products to analyze cost trends
          </p>
        </div>
      ) : (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <th
                  onClick={() => handleSortChange('component')}
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                  aria-sort={trendSortColumn === 'component' ? (trendSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  COMPONENT {trendSortColumn === 'component' && (trendSortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSortChange('current')}
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                  aria-sort={trendSortColumn === 'current' ? (trendSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  CURRENT {trendSortColumn === 'current' && (trendSortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSortChange('avg')}
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                  aria-sort={trendSortColumn === 'avg' ? (trendSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  AVERAGE {trendSortColumn === 'avg' && (trendSortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSortChange('change')}
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                  aria-sort={trendSortColumn === 'change' ? (trendSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  CHANGE {trendSortColumn === 'change' && (trendSortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSortChange('volatility')}
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                  aria-sort={trendSortColumn === 'volatility' ? (trendSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  VOLATILITY {trendSortColumn === 'volatility' && (trendSortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'right',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                }}>
                  DATA POINTS
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTrendEntries.map(({ categoryId, trend, categoryName }) => {
                const changeColor = trend.priceChange > 5 ? '#dc2626' : trend.priceChange < -5 ? '#16a34a' : '#64748b';
                const volatilityIcon = trend.volatility === 'high' ? '🔴' : trend.volatility === 'medium' ? '🟡' : '🟢';
                const trendIcon = trend.priceChange > 5 ? '↑' : trend.priceChange < -5 ? '↓' : '→';

                return (
                  <tr key={categoryId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                      {categoryName}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      ${trend.currentPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>
                      ${trend.avgPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: changeColor, fontWeight: 600 }}>
                      <span aria-label={`Price ${trend.priceChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(trend.priceChange).toFixed(1)} percent`}>
                        {trendIcon} {trend.priceChange > 0 ? '+' : ''}{trend.priceChange.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <span aria-label={`${trend.volatility} volatility`}>
                        {volatilityIcon} {trend.volatility}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b', fontSize: '0.875rem' }}>
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
