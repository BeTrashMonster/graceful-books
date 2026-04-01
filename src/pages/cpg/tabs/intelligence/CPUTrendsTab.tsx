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
import lockAndKeyImage from '../../../../assets/images/lock-and-key.png';

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
  laborFilter?: Set<string>;
}

interface ProductCPUData {
  cpu: string | null;
  materialCPU: string | null;
  laborCost: string | null;
  margin: number | null;
  msrp: string | null;
  trend: 'up' | 'down' | 'stable';
  trendValue: string | null;
  topDriver: string | null;
  isComplete: boolean;
  breakdown: ComponentBreakdown[];
  laborBreakdown?: LaborBreakdown[];
}

interface LaborBreakdown {
  roleId: string;
  roleName: string;
  hoursPerUnit: string;
  hourlyRate: string;
  costPerUnit: string;
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
  isLabor?: boolean; // Flag to indicate this is a labor cost, not material
}

interface SHDistributionData {
  categoryName: string;
  shPerUnit: number;
  avgSHPerUnit: number;
  change: number;
  priceHistory: Array<{ date: number; price: number }>;
}

interface ProductTrendData {
  productId: string;
  productName: string;
  cpu: string;
  margin: string;
  msrp: string;
  components: ComponentTrendData[];
  shDistribution?: SHDistributionData[]; // S+H distribution breakdown (only when viewing S+H category)
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
  laborFilter = new Set(),
}: CPUTrendsTabProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [productTrends, setProductTrends] = useState<ProductTrendData[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>('component');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Load trend data when dependencies change
  useEffect(() => {
    loadProductTrends();
  }, [dateRange, selectedProducts, productCPUData, invoices, categoryFilter, variantFilter, vendorFilter, laborFilter]);

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
        let aggregateCPU: string | null = null;
        let aggregateMargin: number | null = null;
        let aggregateMSRP: string | null = null;

        if (productId !== 'all-components') {
          product = products.find(p => p.id === productId);
          cpuData = productCPUData.get(productId);
          if (!product) continue;
          productName = product.name;
        } else {
          // Generate dynamic name based on active filters
          if (categoryFilter.size === 1) {
            // Single category selected - use that category name
            const categoryId = Array.from(categoryFilter)[0];
            const category = categories.find(c => c.id === categoryId);
            productName = category?.name || 'Components';
          } else if (categoryFilter.size > 1) {
            productName = 'Selected Categories';
          } else if (vendorFilter.size === 1) {
            const vendorName = Array.from(vendorFilter)[0];
            productName = `Components from ${vendorName}`;
          } else if (vendorFilter.size > 1 || variantFilter.size > 0) {
            productName = 'Filtered Components';
          } else {
            productName = 'All Components';
          }
        }

        // Calculate aggregate values for all-components view (not used for display, just legacy)
        if (productId === 'all-components') {
          const allProductData = Array.from(productCPUData.values()).filter(data => data.isComplete);
          if (allProductData.length > 0) {
            // Average CPU (legacy - not displayed)
            const cpuValues = allProductData.map(data => data.cpu).filter(cpu => cpu !== null) as string[];
            if (cpuValues.length > 0) {
              const avgCPU = cpuValues.reduce((sum, cpu) => sum + parseFloat(cpu), 0) / cpuValues.length;
              aggregateCPU = avgCPU.toFixed(2);
            }

            // Average Margin
            const marginValues = allProductData.map(data => data.margin).filter(m => m !== null) as number[];
            if (marginValues.length > 0) {
              aggregateMargin = marginValues.reduce((sum, m) => sum + m, 0) / marginValues.length;
            }

            // Average MSRP
            const msrpValues = allProductData.map(data => data.msrp).filter(msrp => msrp !== null) as string[];
            if (msrpValues.length > 0) {
              const avgMSRP = msrpValues.reduce((sum, msrp) => sum + parseFloat(msrp), 0) / msrpValues.length;
              aggregateMSRP = avgMSRP.toFixed(2);
            }
          }
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
            const category = categories.find(c => c.id === attr.category_id);
            const isSHCategory = category?.is_distribution_category === true;

            // Skip S+H categories UNLESS they're explicitly being filtered for
            // (When not filtered, S+H is baked into material prices and shouldn't show separately)
            if (isSHCategory && (categoryFilter.size === 0 || !categoryFilter.has(attr.category_id))) {
              return;
            }

            // For individual products, only include components in the product's recipe
            if (productId !== 'all-components' && cpuData) {
              const isInRecipe = cpuData.breakdown?.some(comp =>
                comp.categoryId === attr.category_id &&
                (!comp.variant || comp.variant === attr.variant)
              );
              if (!isInRecipe) return;
            }

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

        // Check if we're viewing an S+H category to calculate distribution breakdown
        const isViewingSHCategory = Array.from(categoryFilter).some(catId => {
          const cat = categories.find(c => c.id === catId);
          return cat?.is_distribution_category === true;
        });

        // Calculate S+H distribution breakdown if viewing S+H category
        const shDistributionMap = new Map<string, {
          categoryName: string;
          priceHistory: Array<{ date: number; price: number }>;
        }>();

        if (isViewingSHCategory) {
          // Loop through invoices to calculate how S+H was distributed to each material category
          filteredInvoices.forEach(inv => {
            // Find S+H items on this invoice
            const shItems = Object.entries(inv.cost_attribution || {})
              .filter(([key, attr]) => {
                const category = categories.find(c => c.id === attr.category_id);
                return category?.is_distribution_category === true;
              });

            if (shItems.length === 0) return;

            // Find material items on this invoice
            const materialItems = Object.entries(inv.cost_attribution || {})
              .filter(([key, attr]) => {
                const category = categories.find(c => c.id === attr.category_id);
                return category?.is_distribution_category !== true;
              })
              .map(([key, attr]) => ({
                categoryId: attr.category_id,
                categoryName: categories.find(c => c.id === attr.category_id)?.name || 'Unknown',
                variant: attr.variant,
                unitsPurchased: parseFloat(attr.units_purchased),
                unitPrice: parseFloat(attr.unit_price),
                total: parseFloat(attr.units_purchased) * parseFloat(attr.unit_price),
              }))
              .filter(item => !isNaN(item.unitsPurchased) && !isNaN(item.unitPrice) && item.total > 0);

            if (materialItems.length === 0) return;

            // Calculate total material value for weighted distribution
            const totalMaterialValue = materialItems.reduce((sum, item) => sum + item.total, 0);

            // For each S+H item, distribute to materials
            shItems.forEach(([key, shAttr]) => {
              const shTotal = parseFloat(shAttr.unit_price); // S+H is stored as total in unit_price
              if (isNaN(shTotal) || shTotal <= 0) return;

              // Distribute S+H to each material category
              materialItems.forEach(matItem => {
                // Calculate S+H allocation (weighted by material value)
                const allocation = totalMaterialValue > 0 ? (matItem.total / totalMaterialValue) * shTotal : 0;

                // Calculate S+H per unit
                const shPerUnit = matItem.unitsPurchased > 0 ? allocation / matItem.unitsPurchased : 0;

                if (shPerUnit <= 0) return;

                // Create unique key for material category (without variant for aggregation)
                const matKey = matItem.categoryName;

                if (!shDistributionMap.has(matKey)) {
                  shDistributionMap.set(matKey, {
                    categoryName: matItem.categoryName,
                    priceHistory: [],
                  });
                }

                shDistributionMap.get(matKey)!.priceHistory.push({
                  date: inv.invoice_date,
                  price: shPerUnit,
                });
              });
            });
          });
        }

        // Determine filter visibility
        const hasMaterialFilters = categoryFilter.size > 0 || variantFilter.size > 0 || vendorFilter.size > 0;
        const hasLaborFilters = laborFilter.size > 0;
        const hasAnyFilters = hasMaterialFilters || hasLaborFilters;
        const showMaterialsSection = !hasAnyFilters || hasMaterialFilters;
        const showLaborSection = !hasAnyFilters || hasLaborFilters;

        // Build component trends from collected data
        const componentTrends: ComponentTrendData[] = [];

        // Add material components if filters allow
        if (showMaterialsSection) {
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
        }

        // Add labor cost data if available and filters allow
        if (productId !== 'all-components' && cpuData?.laborBreakdown && showLaborSection) {
          cpuData.laborBreakdown.forEach(labor => {
            // Apply labor filter
            if (laborFilter.size > 0 && !laborFilter.has(labor.roleId)) return;

            const costPerUnit = parseFloat(labor.costPerUnit);
            if (isNaN(costPerUnit) || costPerUnit <= 0) return;

            // Labor doesn't have historical data, so we create a single point
            // representing the current cost
            componentTrends.push({
              componentName: `${labor.roleName} (Labor)`,
              current: costPerUnit,
              avg: costPerUnit, // No history, so avg = current
              change: 0, // No history, so no change
              lastBuyDays: 0, // N/A for labor
              priceHistory: [{ date: today, price: costPerUnit }],
              isLabor: true,
            });
          });
        }

        if (componentTrends.length > 0) {
          // Sort components alphabetically by default
          componentTrends.sort((a, b) => a.componentName.localeCompare(b.componentName));

          // Calculate CPU - use cpuData if available (which includes quantities)
          let calculatedCPU = 0;
          if (productId !== 'all-components' && cpuData) {
            // For individual products, use the subtotals from breakdown (already includes quantities)
            calculatedCPU = cpuData.breakdown?.reduce((sum, comp) => {
              const subtotal = comp.subtotal ? parseFloat(comp.subtotal) : 0;
              return sum + subtotal;
            }, 0) || 0;
          } else {
            // For "all components", just sum unit prices
            calculatedCPU = componentTrends.reduce((sum, comp) => sum + comp.current, 0);
          }

          // Determine which values to use
          let displayCPU: string;
          let displayMargin: string;
          let displayMSRP: string;

          if (productId === 'all-components') {
            // For "All Components" view, don't show product-level metrics
            displayCPU = 'N/A';
            displayMargin = 'N/A';
            displayMSRP = 'N/A';
          } else {
            // For individual products, use cpuData values directly (already calculated with quantities)
            displayCPU = cpuData?.cpu || 'N/A';
            displayMargin = cpuData?.margin !== null && cpuData?.margin !== undefined ? `${cpuData.margin.toFixed(1)}%` : 'N/A';
            displayMSRP = cpuData?.msrp || product?.msrp || 'N/A';
          }

          // Build S+H distribution breakdown if viewing S+H category
          let shDistribution: SHDistributionData[] | undefined;
          if (isViewingSHCategory && shDistributionMap.size > 0) {
            shDistribution = [];
            shDistributionMap.forEach((data) => {
              if (data.priceHistory.length === 0) return;

              // Sort by date
              data.priceHistory.sort((a, b) => a.date - b.date);

              // Calculate current, average, and change
              const currentSH = data.priceHistory[data.priceHistory.length - 1].price;
              const avgSH = data.priceHistory.reduce((sum, p) => sum + p.price, 0) / data.priceHistory.length;
              const change = ((currentSH - avgSH) / avgSH) * 100;

              shDistribution!.push({
                categoryName: data.categoryName,
                shPerUnit: currentSH,
                avgSHPerUnit: avgSH,
                change,
                priceHistory: data.priceHistory,
              });
            });

            // Sort alphabetically
            shDistribution.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
          }

          trends.push({
            productId: productId,
            productName: productName,
            cpu: displayCPU,
            margin: displayMargin,
            msrp: displayMSRP,
            components: componentTrends,
            shDistribution,
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
    rows.push('Product,Component,Type,Current Price,Average Price,Price Change %,Last Purchase (days ago),Volatility,Trend');

    sortedProductTrends.forEach(product => {
      product.components.forEach(comp => {
        const type = comp.isLabor ? 'Labor' : 'Material';
        const volatility = comp.isLabor ? 'N/A' : (Math.abs(comp.change) < 5 ? 'low' : Math.abs(comp.change) < 15 ? 'medium' : 'high');
        const trend = comp.isLabor ? 'N/A' : (comp.change > 5 ? 'increasing' : comp.change < -5 ? 'decreasing' : 'stable');
        const avgPrice = comp.isLabor ? 'N/A' : comp.avg.toFixed(2);
        const priceChange = comp.isLabor ? 'N/A' : comp.change.toFixed(1);
        const lastBuy = comp.isLabor ? 'N/A' : comp.lastBuyDays.toString();

        rows.push(
          `"${product.productName}","${comp.componentName}","${type}","${comp.current.toFixed(2)}","${avgPrice}","${priceChange}","${lastBuy}","${volatility}","${trend}"`
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
        comp.isLabor ? 'N/A' : `$${comp.avg.toFixed(2)}`,
        comp.isLabor ? 'N/A' : (comp.change !== 0 ? `${comp.change > 0 ? '+' : ''}${comp.change.toFixed(1)}%` : '—'),
        comp.isLabor ? 'N/A' : `${comp.lastBuyDays}d`,
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
          <h3 style={{ fontSize: '1.75rem' }}>CPU Trend Analysis</h3>
        </div>
        <div className={styles.headerControls}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              aria-label="Export trend data"
              aria-haspopup="menu"
              aria-expanded={showExportMenu}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'linear-gradient(135deg, #E8D4A0 0%, #D4AF37 50%, #B8860B 100%)',
                color: '#2d1b00',
                border: '1px solid #B8860B',
                borderRadius: '6px',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(184, 134, 11, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #F4E5C3 0%, #E8D4A0 50%, #C9A961 100%)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(184, 134, 11, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #E8D4A0 0%, #D4AF37 50%, #B8860B 100%)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(184, 134, 11, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
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
          <img
            src={lockAndKeyImage}
            alt=""
            style={{
              width: '160px',
              height: 'auto',
              margin: '0 auto 2rem',
              display: 'block',
            }}
          />
          <div className={styles.emptyTitle} style={{ color: '#4b006e', fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem', letterSpacing: '-0.01em' }}>
            Ready to Unlock Cost Trends?
          </div>
          <div className={styles.emptyDescription} style={{ color: '#6b7280', fontSize: '1rem', lineHeight: 1.6 }}>
            Select products to see how their component prices have evolved naturally over time
          </div>
        </div>
      ) : (
        <div className={styles.productsContainer}>
          {sortedProductTrends.map(product => (
            <div key={product.productId} className={styles.productSection}>
              {/* Product header */}
              <div className={styles.productHeader}>
                <h4 className={styles.productName}>{product.productName}</h4>
                {product.productId !== 'all-components' && (
                  <div className={styles.productMetrics}>
                    <span>CPU: {product.cpu}</span>
                    <span>Margin: {product.margin}</span>
                    <span>MSRP: {product.msrp}</span>
                  </div>
                )}
              </div>

              {/* Price Trend Chart */}
              <div className={styles.chartSection}>
                <div className={styles.chartHeader}>
                  <h5 className={styles.chartTitle}>
                    {product.shDistribution ? 'Raw S+H Cost Trends' : 'Component Price Trends'}
                  </h5>
                  <p className={styles.chartSubtitle}>
                    {product.shDistribution
                      ? 'Total Shipping + Handling costs paid per invoice'
                      : 'Historical price movements over selected date range'}
                  </p>
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
                        stroke={comp.isLabor ? '#D4AF37' : getComponentColor(idx)}
                        strokeWidth={comp.isLabor ? 3 : 2}
                        dot={{ r: comp.isLabor ? 4 : 3, strokeWidth: 2, fill: comp.isLabor ? '#D4AF37' : undefined }}
                        activeDot={{ r: comp.isLabor ? 6 : 5 }}
                        connectNulls={true}
                        name={comp.componentName}
                        strokeDasharray={comp.isLabor ? '5 5' : undefined}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Component table */}
              {product.shDistribution && (
                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                  <h5 style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: '#4b006e',
                    marginBottom: '0.5rem'
                  }}>
                    📊 Raw S+H Costs
                  </h5>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '0'
                  }}>
                    Total Shipping + Handling paid per invoice (before distribution)
                  </p>
                </div>
              )}
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
                      <tr key={idx} style={comp.isLabor ? { backgroundColor: '#FFF9E6' } : undefined}>
                        <td className={styles.componentName} style={comp.isLabor ? { color: '#D4AF37', fontWeight: 600 } : undefined}>
                          {comp.componentName}
                        </td>
                        <td className={styles.priceValue} style={comp.isLabor ? { color: '#D4AF37', fontWeight: 600 } : undefined}>
                          ${comp.current.toFixed(2)}
                        </td>
                        <td className={styles.priceAverage} style={comp.isLabor ? { color: '#9ca3af' } : undefined}>
                          {comp.isLabor ? 'N/A' : `$${comp.avg.toFixed(2)}`}
                        </td>
                        <td className={styles.priceValue}>
                          {comp.isLabor ? (
                            <span style={{ color: '#9ca3af' }}>N/A</span>
                          ) : comp.change !== 0 ? (
                            <span className={comp.change > 0 ? styles.increase : styles.decrease}>
                              {comp.change > 0 ? '↑ +' : '↓ '}{comp.change.toFixed(1)}%
                            </span>
                          ) : (
                            <span className={styles.stable}>→ Stable</span>
                          )}
                        </td>
                        <td className={styles.priceValue} style={comp.isLabor ? { color: '#9ca3af' } : undefined}>
                          {comp.isLabor ? 'N/A' : `${comp.lastBuyDays}d`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* S+H Distribution Breakdown (only when viewing S+H category) */}
              {product.shDistribution && product.shDistribution.length > 0 && (
                <div style={{ marginTop: '2rem' }}>
                  <div style={{
                    borderTop: '2px solid #fbbf24',
                    paddingTop: '1.5rem',
                    marginBottom: '1rem'
                  }}>
                    <h5 style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: '#92400e',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      📦 S+H Distribution by Category
                    </h5>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#78350f',
                      marginBottom: '1rem'
                    }}>
                      How Shipping + Handling costs are allocated per unit across material categories
                    </p>
                  </div>

                  <div className={styles.tableContainer}>
                    <table className={styles.trendsTable}>
                      <thead>
                        <tr>
                          <th style={{ background: '#fef3c7', color: '#92400e' }}>CATEGORY</th>
                          <th className={styles.alignRight} style={{ background: '#fef3c7', color: '#92400e' }}>S+H/UNIT CURRENT</th>
                          <th className={styles.alignRight} style={{ background: '#fef3c7', color: '#92400e' }}>S+H/UNIT AVG</th>
                          <th className={styles.alignRight} style={{ background: '#fef3c7', color: '#92400e' }}>TREND</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.shDistribution.map((dist, idx) => (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fffbeb' : 'white' }}>
                            <td className={styles.componentName} style={{ color: '#78350f', fontWeight: 500 }}>
                              {dist.categoryName}
                            </td>
                            <td className={styles.priceValue} style={{ color: '#92400e', fontWeight: 600 }}>
                              ${dist.shPerUnit.toFixed(4)}
                            </td>
                            <td className={styles.priceAverage} style={{ color: '#92400e' }}>
                              ${dist.avgSHPerUnit.toFixed(4)}
                            </td>
                            <td className={styles.priceValue}>
                              {dist.change !== 0 ? (
                                <span className={dist.change > 0 ? styles.increase : styles.decrease}>
                                  {dist.change > 0 ? '↑ +' : '↓ '}{dist.change.toFixed(1)}%
                                </span>
                              ) : (
                                <span className={styles.stable}>→ Stable</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
