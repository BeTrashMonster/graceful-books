/**
 * Vendor Intel Sub-Tab Component
 *
 * Displays vendor intelligence analysis for selected products.
 *
 * Features:
 * - Vendor overview showing spend per vendor
 * - Price comparison showing all vendors per component
 * - Best price identification and savings opportunities
 * - CSV/PDF export
 *
 * Requirements:
 * - WCAG 2.1 AA compliance
 * - Type-safe implementation
 * - Print-friendly PDF export
 */

import { useState, useEffect, useMemo } from 'react';
import type { CPGCategory, CPGInvoice } from '../../../../db/schema/cpg.schema';
import styles from './VendorIntelTab.module.css';

export interface VendorIntelTabProps {
  companyId: string;
  selectedProducts: Set<string>;
  productCPUData: Map<string, ProductCPUData>;
  invoices: CPGInvoice[];
  categories: CPGCategory[];
  dateRange: '3mo' | '6mo' | '12mo' | 'last-calendar-year' | 'this-calendar-year' | 'custom' | 'all';
  customDateRange?: { start: number; end: number };
  categoryFilter?: Set<string>;
  variantFilter?: Set<string>;
  vendorFilter?: Set<string>;
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
  variant?: string;
  subtotal: string | null;
  isComplete: boolean;
}

interface VendorOverview {
  vendorName: string;
  totalSpend: number;
  invoiceCount: number;
  componentCount: number;
}

interface VendorPrice {
  vendor: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  purchaseCount: number;
}

interface VariantComparison {
  variant: string;
  vendorPrices: VendorPrice[];
  bestPrice: number;
  bestVendor: string;
  worstPrice: number;
}

interface ComponentComparison {
  categoryName: string;
  variants: VariantComparison[];
}

type SortColumn = 'vendor' | 'spend' | 'invoices' | 'components' | 'component' | 'bestPrice' | 'savings';

export default function VendorIntelTab({
  companyId,
  selectedProducts,
  productCPUData,
  invoices,
  categories,
  dateRange,
  customDateRange,
  categoryFilter = new Set(),
  variantFilter = new Set(),
  vendorFilter = new Set(),
}: VendorIntelTabProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [vendorOverviews, setVendorOverviews] = useState<VendorOverview[]>([]);
  const [componentComparisons, setComponentComparisons] = useState<ComponentComparison[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>('spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Load vendor intelligence data
  useEffect(() => {
    loadVendorIntelligence();
  }, [selectedProducts, productCPUData, invoices, dateRange, customDateRange, categoryFilter, variantFilter, vendorFilter]);

  const loadVendorIntelligence = () => {
    if (selectedProducts.size === 0) {
      setVendorOverviews([]);
      setComponentComparisons([]);
      return;
    }

    try {
      const today = Date.now();
      let startDate = 0;
      let endDate = today;

      // Calculate date range
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
          endDate = new Date(lastYear, 11, 31, 23, 59, 59).getTime();
          break;
        case 'this-calendar-year':
          const thisYear = new Date().getFullYear();
          startDate = new Date(thisYear, 0, 1).getTime();
          break;
        case 'custom':
          if (customDateRange) {
            startDate = customDateRange.start;
            endDate = customDateRange.end;
          }
          break;
        case 'all':
          startDate = 0;
          endDate = today;
          break;
      }

      // Filter invoices by date range
      const relevantInvoices = invoices.filter(inv => {
        if (startDate > 0 && inv.invoice_date < startDate) return false;
        if (endDate > 0 && inv.invoice_date > endDate) return false;
        return true;
      });

      // Normalize vendor names for comparison (trim and case-insensitive)
      const normalizedVendorFilter = vendorFilter.size > 0
        ? new Set(Array.from(vendorFilter).map(v => v.trim().toLowerCase()))
        : new Set();

      // For vendor overview, filter by vendor
      const vendorFilteredInvoices = relevantInvoices.filter(inv => {
        if (normalizedVendorFilter.size > 0) {
          const vendorName = (inv.vendor_name || '').trim().toLowerCase();
          if (!normalizedVendorFilter.has(vendorName)) return false;
        }
        return true;
      });

      // Get all components from selected products
      const componentCategories = new Map<string, Set<string>>(); // categoryId -> Set of variants

      selectedProducts.forEach(productId => {
        const cpuData = productCPUData.get(productId);
        if (cpuData?.breakdown) {
          cpuData.breakdown.forEach(comp => {
            // Apply filters
            if (categoryFilter.size > 0 && !categoryFilter.has(comp.categoryId)) return;
            if (variantFilter.size > 0 && !variantFilter.has(comp.variant || '')) return;

            if (!componentCategories.has(comp.categoryId)) {
              componentCategories.set(comp.categoryId, new Set());
            }
            componentCategories.get(comp.categoryId)!.add(comp.variant || '');
          });
        }
      });

      // Calculate vendor overviews (using vendor-filtered invoices, only counting filtered components)
      const vendorStats = new Map<string, { spend: number; invoices: Set<string>; components: Set<string> }>();

      vendorFilteredInvoices.forEach(inv => {
        const vendor = inv.vendor_name || 'Unknown';

        if (!vendorStats.has(vendor)) {
          vendorStats.set(vendor, { spend: 0, invoices: new Set(), components: new Set() });
        }

        const stats = vendorStats.get(vendor)!;
        stats.invoices.add(inv.id);

        Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
          // Check if this component is in our filtered set
          const variants = componentCategories.get(attr.category_id);
          if (variants && (variants.size === 0 || variants.has(attr.variant || ''))) {
            const unitPrice = parseFloat(attr.unit_price);
            const unitsPurchased = parseFloat(attr.units_purchased);

            if (!isNaN(unitPrice) && !isNaN(unitsPurchased)) {
              stats.spend += unitPrice * unitsPurchased;
              stats.components.add(`${attr.category_id}:${attr.variant || ''}`);
            }
          }
        });
      });

      const overviews: VendorOverview[] = Array.from(vendorStats.entries())
        .map(([vendorName, stats]) => ({
          vendorName,
          totalSpend: stats.spend,
          invoiceCount: stats.invoices.size,
          componentCount: stats.components.size,
        }));

      setVendorOverviews(overviews);

      // Calculate component comparisons - group by category, then variants
      const categoryMap = new Map<string, VariantComparison[]>();

      for (const [categoryId, variants] of componentCategories.entries()) {
        const category = categories.find(c => c.id === categoryId);
        const categoryName = category?.name || 'Unknown';

        const variantComparisons: VariantComparison[] = [];

        // For each variant
        for (const variant of variants) {
          // Collect prices by vendor
          const vendorPriceData = new Map<string, number[]>();

          relevantInvoices.forEach(inv => {
            const vendor = inv.vendor_name || 'Unknown';
            const normalizedVendor = vendor.trim().toLowerCase();

            // Apply vendor filter when collecting prices
            if (normalizedVendorFilter.size > 0 && !normalizedVendorFilter.has(normalizedVendor)) {
              return;
            }

            Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
              if (attr.category_id === categoryId && (attr.variant || '') === variant) {
                const unitPrice = parseFloat(attr.unit_price);
                if (!isNaN(unitPrice) && unitPrice > 0) {
                  if (!vendorPriceData.has(vendor)) {
                    vendorPriceData.set(vendor, []);
                  }
                  vendorPriceData.get(vendor)!.push(unitPrice);
                }
              }
            });
          });

          if (vendorPriceData.size === 0) continue;

          // Calculate vendor prices
          const vendorPrices: VendorPrice[] = Array.from(vendorPriceData.entries())
            .map(([vendor, prices]) => ({
              vendor,
              avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
              minPrice: Math.min(...prices),
              maxPrice: Math.max(...prices),
              purchaseCount: prices.length,
            }))
            .sort((a, b) => a.vendor.localeCompare(b.vendor)); // Alphabetical by vendor

          const allAvgPrices = vendorPrices.map(vp => vp.avgPrice);
          const bestPrice = Math.min(...allAvgPrices);
          const worstPrice = Math.max(...allAvgPrices);
          const bestVendor = vendorPrices.find(vp => vp.avgPrice === bestPrice)?.vendor || '';

          variantComparisons.push({
            variant,
            vendorPrices,
            bestPrice,
            bestVendor,
            worstPrice,
          });
        }

        if (variantComparisons.length > 0) {
          categoryMap.set(categoryName, variantComparisons);
        }
      }

      // Convert to array and sort by category name
      const comparisons: ComponentComparison[] = Array.from(categoryMap.entries())
        .map(([categoryName, variants]) => ({
          categoryName,
          variants: variants.sort((a, b) => a.variant.localeCompare(b.variant)),
        }))
        .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

      setComponentComparisons(comparisons);
    } catch (err) {
      console.error('Failed to load vendor intelligence:', err);
    }
  };

  /**
   * Handle column sort
   */
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'spend' ? 'desc' : 'asc');
    }
  };

  /**
   * Sort vendor overviews
   */
  const sortedVendorOverviews = useMemo(() => {
    return [...vendorOverviews].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortColumn) {
        case 'vendor':
          aVal = a.vendorName;
          bVal = b.vendorName;
          break;
        case 'spend':
          aVal = a.totalSpend;
          bVal = b.totalSpend;
          break;
        case 'invoices':
          aVal = a.invoiceCount;
          bVal = b.invoiceCount;
          break;
        case 'components':
          aVal = a.componentCount;
          bVal = b.componentCount;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [vendorOverviews, sortColumn, sortDirection]);

  /**
   * Sort component comparisons (by category)
   */
  const sortedComponentComparisons = useMemo(() => {
    return [...componentComparisons].sort((a, b) => {
      // For hierarchical sorting, we sort by category name primarily
      if (sortColumn === 'component') {
        return sortDirection === 'asc'
          ? a.categoryName.localeCompare(b.categoryName)
          : b.categoryName.localeCompare(a.categoryName);
      }

      // For bestPrice and savings, use the best value across all variants in the category
      let aVal: number, bVal: number;

      if (sortColumn === 'bestPrice') {
        aVal = Math.min(...a.variants.map(v => v.bestPrice));
        bVal = Math.min(...b.variants.map(v => v.bestPrice));
      } else if (sortColumn === 'savings') {
        aVal = Math.max(...a.variants.map(v => v.worstPrice - v.bestPrice));
        bVal = Math.max(...b.variants.map(v => v.worstPrice - v.bestPrice));
      } else {
        return 0;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [componentComparisons, sortColumn, sortDirection]);

  /**
   * Calculate summary metrics
   */
  const summaryMetrics = useMemo(() => {
    // Get the component categories we're showing (filtered by selected products + filters)
    const componentCategories = new Map<string, Set<string>>();
    selectedProducts.forEach(productId => {
      const cpuData = productCPUData.get(productId);
      if (cpuData?.breakdown) {
        cpuData.breakdown.forEach(comp => {
          if (categoryFilter.size > 0 && !categoryFilter.has(comp.categoryId)) return;
          if (variantFilter.size > 0 && !variantFilter.has(comp.variant || '')) return;

          if (!componentCategories.has(comp.categoryId)) {
            componentCategories.set(comp.categoryId, new Set());
          }
          componentCategories.get(comp.categoryId)!.add(comp.variant || '');
        });
      }
    });

    // Calculate total spend from invoices for these specific components
    let totalSpend = 0;
    const today = Date.now();
    let startDate = 0;
    let endDate = today;

    // Calculate date range
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
        endDate = new Date(lastYear, 11, 31, 23, 59, 59).getTime();
        break;
      case 'this-calendar-year':
        const thisYear = new Date().getFullYear();
        startDate = new Date(thisYear, 0, 1).getTime();
        break;
      case 'custom':
        if (customDateRange) {
          startDate = customDateRange.start;
          endDate = customDateRange.end;
        }
        break;
      case 'all':
        startDate = 0;
        endDate = today;
        break;
    }

    invoices.forEach(inv => {
      // Apply date filter
      if (startDate > 0 && inv.invoice_date < startDate) return;
      if (endDate > 0 && inv.invoice_date > endDate) return;

      // Apply vendor filter
      if (vendorFilter.size > 0) {
        const normalizedVendor = (inv.vendor_name || '').trim().toLowerCase();
        const normalizedVendorFilter = new Set(Array.from(vendorFilter).map(v => v.trim().toLowerCase()));
        if (!normalizedVendorFilter.has(normalizedVendor)) return;
      }

      // Sum up costs for components in our filtered set
      Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
        const variants = componentCategories.get(attr.category_id);
        if (variants && (variants.size === 0 || variants.has(attr.variant || ''))) {
          const unitPrice = parseFloat(attr.unit_price);
          const unitsPurchased = parseFloat(attr.units_purchased);
          if (!isNaN(unitPrice) && !isNaN(unitsPurchased)) {
            totalSpend += unitPrice * unitsPurchased;
          }
        }
      });
    });

    // Find biggest cost component (unit price, not total spend)
    let biggestCostComponent = '';
    let biggestCostAmount = 0;
    componentComparisons.forEach(comp => {
      comp.variants.forEach(variant => {
        if (variant.bestPrice > biggestCostAmount) {
          biggestCostAmount = variant.bestPrice;
          biggestCostComponent = variant.variant ? `${comp.categoryName} (${variant.variant})` : comp.categoryName;
        }
      });
    });

    // Calculate average price across all components
    let totalPrices = 0;
    let priceCount = 0;
    componentComparisons.forEach(comp => {
      comp.variants.forEach(variant => {
        totalPrices += variant.bestPrice;
        priceCount++;
      });
    });
    const averagePrice = priceCount > 0 ? totalPrices / priceCount : 0;

    return { totalSpend, biggestCostComponent, biggestCostAmount, averagePrice };
  }, [componentComparisons, selectedProducts, productCPUData, categoryFilter, variantFilter, vendorFilter, dateRange, customDateRange, invoices]);

  /**
   * Export as CSV
   */
  const handleExportCSV = () => {
    const rows: string[] = [];
    rows.push('Component,Vendor,Average Price,Min Price,Max Price,Purchase Count,Best Price,Savings vs Worst');

    sortedComponentComparisons.forEach(comp => {
      comp.variants.forEach(variant => {
        const componentName = variant.variant ? `${comp.categoryName} (${variant.variant})` : comp.categoryName;

        variant.vendorPrices.forEach(vp => {
          const isBest = vp.avgPrice === variant.bestPrice;
          const savings = variant.worstPrice - vp.avgPrice;

          rows.push(
            `"${componentName}","${vp.vendor}","${vp.avgPrice.toFixed(2)}","${vp.minPrice.toFixed(2)}","${vp.maxPrice.toFixed(2)}","${vp.purchaseCount}","${isBest ? 'YES' : ''}","${!isBest && savings > 0 ? '$' + savings.toFixed(2) : ''}"`
          );
        });
      });
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-intel-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  /**
   * Export as PDF
   */
  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(16);
    doc.setTextColor(75, 0, 110);
    doc.text('Vendor Intelligence Report', 14, yPos);
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

    // Vendor Overview Section
    doc.setFontSize(12);
    doc.setTextColor(75, 0, 110);
    doc.text('Vendor Overview', 14, yPos);
    yPos += 2;

    const vendorTableData = sortedVendorOverviews.map(vo => [
      vo.vendorName,
      `$${vo.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      vo.invoiceCount.toString(),
      vo.componentCount.toString(),
    ]);

    autoTable(doc, {
      head: [['Vendor', 'Total Spend', 'Invoices', 'Components']],
      body: vendorTableData,
      startY: yPos,
      styles: {
        fontSize: 9,
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
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
      theme: 'grid',
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Price Comparison Section
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(75, 0, 110);
    doc.text('Price Comparison by Component', 14, yPos);
    yPos += 2;

    const comparisonTableData: any[] = [];
    sortedComponentComparisons.forEach(comp => {
      comp.variants.forEach(variant => {
        const componentName = variant.variant ? `${comp.categoryName} (${variant.variant})` : comp.categoryName;

        const vendorPricesStr = variant.vendorPrices
          .map(vp => `${vp.vendor}: $${vp.avgPrice.toFixed(2)}`)
          .join(', ');

        const bestPriceStr = `$${variant.bestPrice.toFixed(2)}\n(${variant.bestVendor})`;

        const savings = variant.vendorPrices.length > 1 ? variant.worstPrice - variant.bestPrice : 0;
        const savingsStr = savings > 0.01 ? `Save $${savings.toFixed(2)}` : '-';

        comparisonTableData.push([
          componentName,
          vendorPricesStr,
          bestPriceStr,
          savingsStr,
        ]);
      });
    });

    autoTable(doc, {
      head: [['Component', 'Vendor Prices', 'Best Price', 'Savings']],
      body: comparisonTableData,
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
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 70 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25, halign: 'right' },
      },
      theme: 'grid',
      margin: { left: 14, right: 14 },
    });

    doc.save(`vendor-intel-${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
  };

  if (componentComparisons.length === 0) {
    const hasProducts = selectedProducts.size > 0;
    const hasVendorFilter = vendorFilter.size > 0;

    let message = 'Select products to analyze vendor pricing';
    if (hasProducts && hasVendorFilter) {
      message = `No components found from the selected vendor${vendorFilter.size > 1 ? 's' : ''} for these products`;
    } else if (hasProducts) {
      message = 'No vendor data available for selected products';
    }

    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon} aria-hidden="true">🏪</div>
        <div className={styles.emptyTitle}>No vendor data available</div>
        <div className={styles.emptyDescription}>{message}</div>
      </div>
    );
  }

  return (
    <div className={styles.container} role="tabpanel" id="vendors-panel" aria-labelledby="vendors-tab">
      {/* Summary Dashboard */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Total Spend</div>
          <div className={styles.summaryValue}>
            ${summaryMetrics.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Biggest Cost</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <div className={styles.summaryValue}>
              ${summaryMetrics.biggestCostAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={styles.summarySubtext}>/unit</div>
          </div>
          <div className={styles.summarySubtext}>
            {summaryMetrics.biggestCostComponent}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Average Price</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <div className={styles.summaryValue}>
              ${summaryMetrics.averagePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={styles.summarySubtext}>/unit</div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerControls}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              aria-label="Export vendor intelligence data"
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

      {/* Vendor Overview */}
      {sortedVendorOverviews.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Vendor Overview</h4>
          <div className={styles.tableContainer}>
            <table className={styles.vendorTable}>
              <thead>
                <tr>
                  <th
                    onClick={() => handleSort('vendor')}
                    aria-sort={sortColumn === 'vendor' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    VENDOR {sortColumn === 'vendor' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('spend')}
                    className={styles.alignRight}
                    aria-sort={sortColumn === 'spend' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    TOTAL SPEND {sortColumn === 'spend' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('invoices')}
                    className={styles.alignRight}
                    aria-sort={sortColumn === 'invoices' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    INVOICES {sortColumn === 'invoices' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('components')}
                    className={styles.alignRight}
                    aria-sort={sortColumn === 'components' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    COMPONENTS {sortColumn === 'components' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedVendorOverviews.map(vo => (
                  <tr key={vo.vendorName}>
                    <td className={styles.vendorName}>{vo.vendorName}</td>
                    <td className={`${styles.totalSpend} ${styles.alignRight}`}>${vo.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`${styles.invoiceCount} ${styles.alignRight}`}>{vo.invoiceCount}</td>
                    <td className={`${styles.componentCount} ${styles.alignRight}`}>{vo.componentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Price Comparison */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Price Comparison by Component</h4>
        <div className={styles.tableContainer}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th
                  onClick={() => handleSort('component')}
                  aria-sort={sortColumn === 'component' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  COMPONENT {sortColumn === 'component' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th>VENDOR PRICES</th>
                <th
                  onClick={() => handleSort('bestPrice')}
                  className={styles.alignRight}
                  aria-sort={sortColumn === 'bestPrice' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  BEST PRICE {sortColumn === 'bestPrice' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('savings')}
                  className={styles.alignRight}
                  aria-sort={sortColumn === 'savings' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  SAVINGS {sortColumn === 'savings' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedComponentComparisons.map((comp, compIdx) => {
                // If only one variant and it has no variant name, show it directly without nesting
                if (comp.variants.length === 1 && (!comp.variants[0].variant || comp.variants[0].variant === '')) {
                  const variant = comp.variants[0];
                  const savings = variant.worstPrice - variant.bestPrice;
                  const bestVendorPrice = variant.vendorPrices.find(vp => vp.avgPrice === variant.bestPrice);
                  const otherVendors = variant.vendorPrices.filter(vp => vp.avgPrice !== variant.bestPrice);

                  return (
                    <tr key={`${compIdx}-single`} className={styles.categoryRow}>
                      <td className={styles.categoryName}>{comp.categoryName}</td>
                      <td className={styles.vendorPrices}>
                        {bestVendorPrice && (
                          <div className={styles.bestVendorPrice}>
                            <span className={styles.priceAmount}>${bestVendorPrice.avgPrice.toFixed(2)}</span>
                            <span className={styles.vendorBadge}>{bestVendorPrice.vendor}</span>
                          </div>
                        )}
                        {otherVendors.length > 0 && (
                          <div className={styles.otherVendorPrices}>
                            {otherVendors.map((vp, vpIdx) => (
                              <div key={vpIdx} className={styles.otherVendorItem}>
                                <span className={styles.priceAmount}>${vp.avgPrice.toFixed(2)}</span>
                                <span className={styles.vendorName}>{vp.vendor}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className={styles.bestPrice}>
                        <span className={styles.priceAmount}>${variant.bestPrice.toFixed(2)}</span>
                        <span className={styles.vendorLabel}>{variant.bestVendor}</span>
                      </td>
                      <td className={styles.savings}>
                        {savings > 0.01 ? `Save $${savings.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  );
                }

                // Multiple variants - show category header and indented variants
                return (
                  <>
                    {/* Category header row */}
                    <tr key={`${compIdx}-header`} className={styles.categoryRow}>
                      <td className={styles.categoryName} colSpan={4}>{comp.categoryName}</td>
                    </tr>
                    {/* Variant rows */}
                    {comp.variants.map((variant, varIdx) => {
                      const savings = variant.worstPrice - variant.bestPrice;
                      const bestVendorPrice = variant.vendorPrices.find(vp => vp.avgPrice === variant.bestPrice);
                      const otherVendors = variant.vendorPrices.filter(vp => vp.avgPrice !== variant.bestPrice);

                      return (
                        <tr key={`${compIdx}-${varIdx}`} className={styles.variantRow}>
                          <td className={styles.variantName}>{variant.variant}</td>
                          <td className={styles.vendorPrices}>
                            {bestVendorPrice && (
                              <div className={styles.bestVendorPrice}>
                                <span className={styles.priceAmount}>${bestVendorPrice.avgPrice.toFixed(2)}</span>
                                <span className={styles.vendorBadge}>{bestVendorPrice.vendor}</span>
                              </div>
                            )}
                            {otherVendors.length > 0 && (
                              <div className={styles.otherVendorPrices}>
                                {otherVendors.map((vp, vpIdx) => (
                                  <div key={vpIdx} className={styles.otherVendorItem}>
                                    <span className={styles.priceAmount}>${vp.avgPrice.toFixed(2)}</span>
                                    <span className={styles.vendorName}>{vp.vendor}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className={styles.bestPrice}>
                            <span className={styles.priceAmount}>${variant.bestPrice.toFixed(2)}</span>
                            <span className={styles.vendorLabel}>{variant.bestVendor}</span>
                          </td>
                          <td className={styles.savings}>
                            {savings > 0.01 ? `Save $${savings.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
