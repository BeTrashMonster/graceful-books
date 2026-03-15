/**
 * CPU Trends Tab Component
 *
 * Displays component price trends grouped by product with visual charts.
 *
 * Features:
 * - Product-centric view showing CPU, Margin, MSRP
 * - Visual line charts showing price trends over time
 * - Component metrics: Current, Average, % Change, Last Buy
 * - CSV/PDF export for trends
 *
 * Requirements:
 * - WCAG 2.1 AA compliance
 * - Type safety with proper error codes
 * - Performance: useMemo for trend calculations
 * - Security: CompanyId validation
 */

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  priceHistory: Array<{ date: number; price: number }>;
}

interface ProductTrendData {
  productId: string;
  productName: string;
  cpu: string;
  margin: string;
  msrp: string;
  components: ComponentTrendData[];
}

interface ChartDataPoint {
  date: string;
  timestamp: number;
  [key: string]: string | number;
}

type SortColumn = 'component' | 'current' | 'avg' | 'change' | 'lastBuy';

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
   * Load and calculate trend data - shows all components matching filters
   */
  const loadProductTrends = async () => {
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

      // Filter and process invoices by date and vendor
      const filteredInvoices = invoices.filter(inv => {
        if (startDate > 0 && inv.invoice_date < startDate) return false;
        if (vendorFilter.size > 0 && !vendorFilter.has(inv.vendor_name || '')) return false;
        return true;
      });

      // If products are selected, show per-product breakdown
      // If no products selected, show all components in a single group
      const productsToProcess = selectedProducts.size > 0
        ? Array.from(selectedProducts)
        : ['all-components'];

      for (const productId of productsToProcess) {
        let product: FinishedProduct | undefined;
        let cpuData: ProductCPUData | undefined;
        let productName = 'All Components';

        if (productId !== 'all-components') {
          product = products.find(p => p.id === productId);
          cpuData = productCPUData.get(productId);
          if (!product) continue;
          productName = product.name;
        }

        // Collect all unique components from invoices that match our filters
        const componentDataMap = new Map<string, {
          categoryId: string;
          categoryName: string;
          variant: string | undefined;
          priceHistory: Array<{ date: number; price: number }>;
        }>();

        // Collect price data for all components that match our filters
        filteredInvoices.forEach(inv => {
          Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
            // Apply category filter
            if (categoryFilter.size > 0 && !categoryFilter.has(attr.category_id)) return;

            // Apply variant filter
            if (variantFilter.size > 0 && !variantFilter.has(attr.variant || '')) return;

            const unitPrice = parseFloat(attr.unit_price);
            if (isNaN(unitPrice) || unitPrice <= 0) return;

            // Create unique key for this component
            const componentKey = `${attr.category_id}:${attr.variant || ''}`;

            if (!componentDataMap.has(componentKey)) {
              const category = categories.find(c => c.id === attr.category_id);
              componentDataMap.set(componentKey, {
                categoryId: attr.category_id,
                categoryName: category?.name || 'Unknown',
                variant: attr.variant || undefined,
                priceHistory: [],
              });
            }

            componentDataMap.get(componentKey)!.priceHistory.push({
              date: inv.invoice_date,
              price: unitPrice,
            });
          });
        });

        // Build component trends from collected data
        const componentTrends: ComponentTrendData[] = [];
        componentDataMap.forEach((data) => {
          if (data.priceHistory.length === 0) return;

          // Sort by date (oldest to newest for charting)
          data.priceHistory.sort((a, b) => a.date - b.date);

          // Calculate current (most recent), average, and change
          const currentPrice = data.priceHistory[data.priceHistory.length - 1].price;
          const avgPrice = data.priceHistory.reduce((sum, p) => sum + p.price, 0) / data.priceHistory.length;
          const priceChange = ((currentPrice - avgPrice) / avgPrice) * 100;

          // Calculate days since last purchase
          const lastBuyDate = data.priceHistory[data.priceHistory.length - 1].date;
          const lastBuyDays = Math.floor((today - lastBuyDate) / (24 * 60 * 60 * 1000));

          componentTrends.push({
            componentName: data.variant
              ? `${data.categoryName} (${data.variant})`
              : data.categoryName,
            current: currentPrice,
            avg: avgPrice,
            change: priceChange,
            lastBuyDays,
            priceHistory: data.priceHistory,
          });
        });

        if (componentTrends.length > 0) {
          // Sort components alphabetically by default
          componentTrends.sort((a, b) => a.componentName.localeCompare(b.componentName));

          trends.push({
            productId: productId,
            productName: productName,
            cpu: cpuData?.cpu || 'N/A',
            margin: cpuData?.margin !== null && cpuData?.margin !== undefined ? `${cpuData.margin.toFixed(1)}%` : 'N/A',
            msrp: cpuData?.msrp || 'N/A',
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
    // First, sort products alphabetically by name
    const sortedProducts = [...productTrends].sort((a, b) =>
      a.productName.localeCompare(b.productName)
    );

    // Then, sort components within each product based on current sort state
    return sortedProducts.map(product => ({
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
   * Prepare chart data by merging all component price histories
   */
  const prepareChartData = (components: ComponentTrendData[]): ChartDataPoint[] => {
    // Collect all unique timestamps
    const allTimestamps = new Set<number>();
    components.forEach(comp => {
      comp.priceHistory.forEach(point => allTimestamps.add(point.date));
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Build chart data points
    return sortedTimestamps.map(timestamp => {
      const dataPoint: ChartDataPoint = {
        date: new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
        timestamp,
      };

      // Add price for each component at this timestamp (or null if no data)
      components.forEach(comp => {
        const priceAtTime = comp.priceHistory.find(p => p.date === timestamp);
        dataPoint[comp.componentName] = priceAtTime ? priceAtTime.price : null as any;
      });

      return dataPoint;
    });
  };

  /**
   * Generate distinct colors for chart lines
   */
  const getComponentColor = (index: number): string => {
    const colors = [
      '#4b006e', // Royal Purple
      '#7c3aed', // Bright Purple
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#ec4899', // Pink
      '#8b5cf6', // Violet
      '#14b8a6', // Teal
      '#f97316', // Orange
    ];
    return colors[index % colors.length];
  };

  /**
   * Export trend data as CSV
   */
  const handleExportCSV = () => {
    const rows: string[] = [];
    rows.push('Product,Component,Current Price,Average Price,Price Change %,Last Purchase (days ago),Volatility,Trend');

    sortedProductTrends.forEach(product => {
      product.components.forEach(comp => {
        const volatility = Math.abs(comp.change) < 5 ? 'low' : Math.abs(comp.change) < 15 ? 'medium' : 'high';
        const trend = comp.change > 5 ? 'increasing' : comp.change < -5 ? 'decreasing' : 'stable';

        rows.push(
          `"${product.productName}","${comp.componentName}","${comp.current.toFixed(2)}","${comp.avg.toFixed(2)}","${comp.change.toFixed(1)}","${comp.lastBuyDays}","${volatility}","${trend}"`
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
      ]);

      autoTable(doc, {
        head: [['Component', 'Current', 'Avg', '%', 'Last Buy']],
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
          0: { cellWidth: 60 },
          1: { cellWidth: 30, halign: 'right' },
          2: { cellWidth: 30, halign: 'right' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' },
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

              {/* Price Trend Chart */}
              <div className={styles.chartSection}>
                <div className={styles.chartHeader}>
                  <h5 className={styles.chartTitle}>Component Price Trends</h5>
                  <p className={styles.chartSubtitle}>Historical price movements over selected date range</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={prepareChartData(product.components)}
                    margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                      label={{ value: 'Price ($)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                      }}
                      formatter={(value: any) => value ? `$${Number(value).toFixed(2)}` : 'N/A'}
                      labelStyle={{ fontWeight: 600, marginBottom: '0.5rem' }}
                      itemSorter={(item: any) => -item.value}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }}
                      iconType="line"
                    />
                    {product.components.map((comp, idx) => (
                      <Line
                        key={comp.componentName}
                        type="monotone"
                        dataKey={comp.componentName}
                        stroke={getComponentColor(idx)}
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 2 }}
                        activeDot={{ r: 5 }}
                        connectNulls={true}
                        name={comp.componentName}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
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
                        TREND {sortColumn === 'change' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSortChange('lastBuy')}
                        className={styles.alignRight}
                        aria-sort={sortColumn === 'lastBuy' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        style={{ cursor: 'pointer' }}
                      >
                        LAST BUY {sortColumn === 'lastBuy' && (sortDirection === 'asc' ? '↑' : '↓')}
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
                              {comp.change > 0 ? '↑ +' : '↓ '}{comp.change.toFixed(1)}%
                            </span>
                          ) : (
                            <span className={styles.stable}>→ Stable</span>
                          )}
                        </td>
                        <td className={styles.priceValue}>{comp.lastBuyDays}d</td>
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
