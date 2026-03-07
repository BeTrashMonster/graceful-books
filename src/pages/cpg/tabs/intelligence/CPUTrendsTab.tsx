/**
 * CPU Trends Tab Component
 *
 * Displays component price trends grouped by product.
 *
 * Features:
 * - Product-centric view showing CPU, Margin, MSRP
 * - Component trends: Current, Average, % Change, Last Buy, Status
 * - Smart recommendations based on price trends
 * - CSV/PDF export for trends
 *
 * Requirements:
 * - WCAG 2.1 AA compliance
 * - Type safety with proper error codes
 * - Performance: useMemo for trend calculations
 * - Security: CompanyId validation
 */

import { useState, useEffect, useMemo } from 'react';
import type { CPGCategory, CPGInvoice, FinishedProduct } from '../../../../db/schema/cpg.schema';
import styles from './CPUTrendsTab.module.css';

export interface CPUTrendsTabProps {
  companyId: string;
  selectedProducts: Set<string>;
  productCPUData: Map<string, ProductCPUData>;
  products: FinishedProduct[];
  categories: CPGCategory[];
  invoices: CPGInvoice[];
  dateRange: '3mo' | '6mo' | '12mo' | 'last-calendar-year' | 'this-calendar-year' | 'custom' | 'all';
  categoryFilter?: Set<string>;
  variantFilter?: Set<string>;
  vendorFilter?: Set<string>;
}

interface ProductCPUData {
  cpu: string | null;
  margin: number | null;
  msrp: string | null;
  trend: 'up' | 'down' | 'stable';
  trendValue: string | null;
  topDriver: string | null;
  isComplete: boolean;
  breakdown: ComponentBreakdown[];
}

interface ComponentBreakdown {
  categoryId: string;
  categoryName: string;
  variant?: string;
  subtotal: string | null;
  isComplete: boolean;
}

interface ComponentTrendData {
  componentName: string;
  current: number;
  avg: number;
  change: number;
  lastBuyDays: number;
  status: string;
}

interface ProductTrendData {
  productId: string;
  productName: string;
  cpu: string;
  margin: string;
  msrp: string;
  components: ComponentTrendData[];
}

type SortColumn = 'component' | 'current' | 'avg' | 'change' | 'lastBuy' | 'status';

export default function CPUTrendsTab({
  companyId,
  selectedProducts,
  productCPUData,
  products,
  categories,
  invoices,
  dateRange,
  categoryFilter = new Set(),
  variantFilter = new Set(),
  vendorFilter = new Set(),
}: CPUTrendsTabProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [productTrends, setProductTrends] = useState<ProductTrendData[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>('component');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Load trend data when dependencies change
  useEffect(() => {
    loadProductTrends();
  }, [dateRange, selectedProducts, productCPUData, invoices, categoryFilter, variantFilter, vendorFilter]);

  /**
   * Load and calculate trend data for each selected product
   */
  const loadProductTrends = async () => {
    if (selectedProducts.size === 0) {
      setProductTrends([]);
      return;
    }

    try {
      const trends: ProductTrendData[] = [];
      const today = Date.now();

      // Calculate date range
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
          const lastYear = new Date().getFullYear() - 1;
          startDate = new Date(lastYear, 0, 1).getTime();
          break;
        case 'this-calendar-year':
          const thisYear = new Date().getFullYear();
          startDate = new Date(thisYear, 0, 1).getTime();
          break;
        case 'custom':
        case 'all':
          startDate = 0;
          break;
      }

      // Process each selected product
      for (const productId of selectedProducts) {
        const product = products.find(p => p.id === productId);
        const cpuData = productCPUData.get(productId);

        if (!product || !cpuData || !cpuData.breakdown) continue;

        const componentTrends: ComponentTrendData[] = [];

        // Process each component in the product's breakdown
        for (const component of cpuData.breakdown) {
          // Apply filters
          if (categoryFilter.size > 0 && !categoryFilter.has(component.categoryId)) {
            continue;
          }
          if (variantFilter.size > 0 && !variantFilter.has(component.variant || '')) {
            continue;
          }

          // Find relevant invoices for this component
          const relevantInvoices = invoices.filter(inv => {
            if (startDate > 0 && inv.invoice_date < startDate) return false;
            if (vendorFilter.size > 0 && !vendorFilter.has(inv.vendor_name || '')) {
              return false;
            }

            // Check if this component appears in cost_attribution
            return Object.entries(inv.cost_attribution || {}).some(([key, attr]) => {
              if (attr.category_id !== component.categoryId) return false;
              // Match variant if specified
              if (component.variant && attr.variant !== component.variant) return false;
              return true;
            });
          });

          if (relevantInvoices.length === 0) continue;

          // Collect prices and dates
          const prices: number[] = [];
          const dates: number[] = [];

          relevantInvoices.forEach(inv => {
            Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
              if (attr.category_id === component.categoryId) {
                // Match variant if specified
                if (component.variant && attr.variant !== component.variant) return;

                const unitPrice = parseFloat(attr.unit_price);
                if (!isNaN(unitPrice) && unitPrice > 0) {
                  prices.push(unitPrice);
                  dates.push(inv.invoice_date);
                }
              }
            });
          });

          if (prices.length === 0) continue;

          // Sort by date to get most recent
          const pricesByDate = prices.map((price, i) => ({ price, date: dates[i] }))
            .sort((a, b) => b.date - a.date);

          const currentPrice = pricesByDate[0].price;
          const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
          const priceChange = ((currentPrice - avgPrice) / avgPrice) * 100;

          // Calculate days since last purchase
          const lastBuyDate = Math.max(...dates);
          const lastBuyDays = Math.floor((today - lastBuyDate) / (24 * 60 * 60 * 1000));

          // Generate status recommendation
          let status = '';
          if (priceChange < -10) {
            // Decreasing significantly - no recommendation (user can decide)
            status = '';
          } else if (currentPrice <= avgPrice * 0.95) {
            // At or below average - good time to buy
            status = 'At all low - good time to buy';
          } else if (currentPrice > avgPrice * 1.05) {
            // Above average - consider supplier review
            status = 'At all high - consider supplier review';
          } else {
            // Stable - good time to buy
            status = 'At all low - good time to buy';
          }

          componentTrends.push({
            componentName: component.variant
              ? `${component.categoryName} (${component.variant})`
              : component.categoryName,
            current: currentPrice,
            avg: avgPrice,
            change: priceChange,
            lastBuyDays,
            status,
          });
        }

        if (componentTrends.length > 0) {
          // Sort components alphabetically by default
          componentTrends.sort((a, b) => a.componentName.localeCompare(b.componentName));

          trends.push({
            productId: product.id,
            productName: product.name,
            cpu: cpuData.cpu || 'N/A',
            margin: cpuData.margin !== null ? `${cpuData.margin.toFixed(1)}%` : 'N/A',
            msrp: cpuData.msrp || 'N/A',
            components: componentTrends,
          });
        }
      }

      setProductTrends(trends);
    } catch (err) {
      console.error('Failed to load product trends:', err);
    }
  };

  /**
   * Handle sort column change
   */
  const handleSortChange = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  /**
   * Sort product trends based on current sort state
   */
  const sortedProductTrends = useMemo(() => {
    return productTrends.map(product => ({
      ...product,
      components: [...product.components].sort((a, b) => {
        let aVal: any, bVal: any;

        switch (sortColumn) {
          case 'component':
            aVal = a.componentName;
            bVal = b.componentName;
            break;
          case 'current':
            aVal = a.current;
            bVal = b.current;
            break;
          case 'avg':
            aVal = a.avg;
            bVal = b.avg;
            break;
          case 'change':
            aVal = a.change;
            bVal = b.change;
            break;
          case 'lastBuy':
            aVal = a.lastBuyDays;
            bVal = b.lastBuyDays;
            break;
          case 'status':
            aVal = a.status;
            bVal = b.status;
            break;
          default:
            return 0;
        }

        if (typeof aVal === 'string') {
          return sortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      })
    }));
  }, [productTrends, sortColumn, sortDirection]);

  /**
   * Export trend data as CSV
   */
  const handleExportCSV = () => {
    const rows: string[] = [];
    rows.push('Product,Component,Current Price,Average Price,Price Change %,Last Purchase (days ago),Volatility,Trend,Recommendation');

    sortedProductTrends.forEach(product => {
      product.components.forEach(comp => {
        const volatility = Math.abs(comp.change) < 5 ? 'low' : Math.abs(comp.change) < 15 ? 'medium' : 'high';
        const trend = comp.change > 5 ? 'increasing' : comp.change < -5 ? 'decreasing' : 'stable';

        rows.push(
          `"${product.productName}","${comp.componentName}","${comp.current.toFixed(2)}","${comp.avg.toFixed(2)}","${comp.change.toFixed(1)}","${comp.lastBuyDays}","${volatility}","${trend}","${comp.status}"`
        );
      });
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
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(16);
    doc.setTextColor(75, 0, 110);
    doc.text('CPU Trend Analysis', 14, yPos);
    yPos += 8;

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, yPos);
    yPos += 5;

    const dateRangeText = dateRange === 'all' ? 'All Time' :
      dateRange === '3mo' ? 'Last 3 Months' :
      dateRange === '6mo' ? 'Last 6 Months' :
      dateRange === '12mo' ? 'Last 12 Months' :
      dateRange === 'last-calendar-year' ? 'Last Calendar Year' :
      dateRange === 'this-calendar-year' ? 'This Calendar Year' : 'Custom Range';
    doc.text(`Period: ${dateRangeText}`, 14, yPos);
    yPos += 10;

    // Each product gets its own section
    sortedProductTrends.forEach((product, idx) => {
      if (idx > 0) {
        yPos += 8; // Space between products
      }

      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Product header
      doc.setFontSize(12);
      doc.setTextColor(75, 0, 110);
      doc.text(product.productName, 14, yPos);
      yPos += 6;

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`CPU: ${product.cpu} | Margin: ${product.margin} | MSRP: ${product.msrp}`, 14, yPos);
      yPos += 2;

      // Component table
      const tableData = product.components.map(comp => [
        comp.componentName,
        `$${comp.current.toFixed(2)}`,
        `$${comp.avg.toFixed(2)}`,
        comp.change !== 0 ? `${comp.change > 0 ? '+' : ''}${comp.change.toFixed(1)}%` : '—',
        `${comp.lastBuyDays}d`,
        comp.status,
      ]);

      autoTable(doc, {
        head: [['Component', 'Current', 'Avg', '%', 'Last Buy', 'Status']],
        body: tableData,
        startY: yPos,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [75, 0, 110],
          textColor: [255, 255, 255],
          lineColor: [75, 0, 110],
          lineWidth: 0.1,
        },
        bodyStyles: {
          fillColor: [255, 255, 255], // White background for all rows
          textColor: [0, 0, 0],
        },
        alternateRowStyles: {
          fillColor: [255, 255, 255], // Same as bodyStyles - no alternating colors
        },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 20, halign: 'right' },
          2: { cellWidth: 20, halign: 'right' },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 20, halign: 'right' },
          5: { cellWidth: 55 },
        },
        margin: { left: 14, right: 14 },
        theme: 'grid', // Grid theme adds borders to all cells
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;
    });

    doc.save(`cpu-trends-${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
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

      {/* Product trends */}
      {sortedProductTrends.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">📊</div>
          <div className={styles.emptyTitle}>No trend data available</div>
          <div className={styles.emptyDescription}>
            Select products to analyze cost trends over time
          </div>
        </div>
      ) : (
        <div className={styles.productsContainer}>
          {sortedProductTrends.map(product => (
            <div key={product.productId} className={styles.productSection}>
              {/* Product header */}
              <div className={styles.productHeader}>
                <h4 className={styles.productName}>{product.productName}</h4>
                <div className={styles.productMetrics}>
                  <span>CPU: {product.cpu}</span>
                  <span>Margin: {product.margin}</span>
                  <span>MSRP: {product.msrp}</span>
                </div>
              </div>

              {/* Component table */}
              <div className={styles.tableContainer}>
                <table className={styles.trendsTable}>
                  <thead>
                    <tr>
                      <th
                        onClick={() => handleSortChange('component')}
                        aria-sort={sortColumn === 'component' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        style={{ cursor: 'pointer' }}
                      >
                        COMPONENT {sortColumn === 'component' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSortChange('current')}
                        className={styles.alignRight}
                        aria-sort={sortColumn === 'current' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        style={{ cursor: 'pointer' }}
                      >
                        CURRENT {sortColumn === 'current' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSortChange('avg')}
                        className={styles.alignRight}
                        aria-sort={sortColumn === 'avg' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        style={{ cursor: 'pointer' }}
                      >
                        AVG {sortColumn === 'avg' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSortChange('change')}
                        className={styles.alignRight}
                        aria-sort={sortColumn === 'change' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        style={{ cursor: 'pointer' }}
                      >
                        % {sortColumn === 'change' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSortChange('lastBuy')}
                        className={styles.alignRight}
                        aria-sort={sortColumn === 'lastBuy' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        style={{ cursor: 'pointer' }}
                      >
                        LAST BUY {sortColumn === 'lastBuy' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSortChange('status')}
                        aria-sort={sortColumn === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        style={{ cursor: 'pointer' }}
                      >
                        STATUS {sortColumn === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.components.map((comp, idx) => (
                      <tr key={idx}>
                        <td className={styles.componentName}>{comp.componentName}</td>
                        <td className={styles.priceValue}>${comp.current.toFixed(2)}</td>
                        <td className={styles.priceAverage}>${comp.avg.toFixed(2)}</td>
                        <td className={styles.priceValue}>
                          {comp.change !== 0 ? (
                            <span className={comp.change > 0 ? styles.increase : styles.decrease}>
                              {comp.change > 0 ? '+' : ''}{comp.change.toFixed(1)}%
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td className={styles.priceValue}>{comp.lastBuyDays}d</td>
                        <td className={styles.statusText}>{comp.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
