/**
 * CPU Display Component
 *
 * Shows current manufacturing costs for finished products with component breakdowns.
 *
 * Features:
 * - Finished product CPU with expandable breakdown
 * - Missing cost data warnings
 * - Color-coded complete vs incomplete CPUs
 * - Accessible cards with keyboard navigation
 *
 * Requirements:
 * - Clean visual layout
 * - Clear breakdown of component costs
 * - WCAG 2.1 AA compliance
 */

import { useState, useEffect, useRef } from 'react';
import type { FinishedProductCPUBreakdown } from '../../services/cpg/cpuCalculator.service';
import { cpuCalculatorService } from '../../services/cpg/cpuCalculator.service';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import { HelpTooltip } from '../help/HelpTooltip';
import { CPUBreakdownModal } from './modals/CPUBreakdownModal';
import { ProductBreakdownModal } from './modals/ProductBreakdownModal';
import { InvoiceDetailsModal } from './modals/InvoiceDetailsModal';
import { AddInvoiceModal } from './modals/AddInvoiceModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from './CPUDisplay.module.css';

export interface CPUDisplayProps {
  isLoading?: boolean;
  selectedProducts?: Set<string>;
  statusFilter?: 'all' | 'complete' | 'incomplete';
  sortBy?: 'name' | 'cpu-asc' | 'cpu-desc' | 'missing';
  finishedProducts?: any[];
  onProductSelectionChange?: (selected: Set<string>) => void;
  onStatusFilterChange?: (status: 'all' | 'complete' | 'incomplete') => void;
  onSortByChange?: (sortBy: 'name' | 'cpu-asc' | 'cpu-desc' | 'missing') => void;
}

type DateRangePreset = '3mo' | '6mo' | '12mo' | 'last-calendar-year' | 'this-calendar-year' | 'custom' | 'all';
type StatMetric = 'total' | 'avg-cpu' | 'avg-profit-dollars' | 'avg-profit-percent' | 'highest-cost' | 'lowest-cost' | 'avg-components';
type TableSortColumn = 'name' | 'cost' | 'msrp' | 'profit' | 'margin' | 'status';
type SortDirection = 'asc' | 'desc';

export function CPUDisplay({
  isLoading = false,
  selectedProducts = new Set(),
  statusFilter = 'all',
  sortBy = 'name',
  finishedProducts = [],
  onProductSelectionChange,
  onStatusFilterChange,
  onSortByChange
}: CPUDisplayProps) {
  const { companyId } = useAuth();

  const [products, setProducts] = useState<FinishedProductCPUBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | undefined>(undefined);
  const [companyName, setCompanyName] = useState<string>('Your Company');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Date filtering - default to last 12 months
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangePreset>('12mo');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // First stat box - dual metrics
  const [firstStatLeftMetric, setFirstStatLeftMetric] = useState<StatMetric>('total');
  const [firstStatRightMetric, setFirstStatRightMetric] = useState<StatMetric>('avg-cpu');

  // Table sorting
  const [tableSortColumn, setTableSortColumn] = useState<TableSortColumn>('name');
  const [tableSortDirection, setTableSortDirection] = useState<SortDirection>('asc');

  // Card colors (stored by product name/SKU)
  const [cardColors, setCardColors] = useState<Record<string, string>>({});
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Product selector dropdown
  const [showProductSelector, setShowProductSelector] = useState(false);

  // Grid positioning (stored by product key -> grid index)
  const [productPositions, setProductPositions] = useState<Record<string, number>>({});
  const [draggedProductKey, setDraggedProductKey] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Export menu
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Component breakdown modal (for individual raw materials)
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<{ categoryId: string; variant: string | null } | null>(null);

  // Product breakdown modal (for entire product)
  const [showProductBreakdown, setShowProductBreakdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FinishedProductCPUBreakdown | null>(null);

  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  useEffect(() => {
    loadFinishedProductCPUs();
  }, [companyId, dateRangeFilter]);

  // Load card colors from localStorage
  useEffect(() => {
    if (!companyId) return;
    const savedColors = localStorage.getItem(`cpg-cpu-card-colors-${companyId}`);
    if (savedColors) {
      try {
        setCardColors(JSON.parse(savedColors));
      } catch (err) {
        console.error('Failed to parse saved card colors:', err);
      }
    }
  }, [companyId]);

  // Save card colors to localStorage
  useEffect(() => {
    if (!companyId) return;
    if (Object.keys(cardColors).length > 0) {
      localStorage.setItem(`cpg-cpu-card-colors-${companyId}`, JSON.stringify(cardColors));
    }
  }, [cardColors, companyId]);

  // Load product positions from localStorage
  useEffect(() => {
    if (!companyId) return;
    const savedPositions = localStorage.getItem(`cpg-product-grid-positions-${companyId}`);
    if (savedPositions) {
      try {
        setProductPositions(JSON.parse(savedPositions));
      } catch (err) {
        console.error('Failed to parse saved product positions:', err);
      }
    }
  }, [companyId]);

  // Save product positions to localStorage
  useEffect(() => {
    if (!companyId) return;
    if (Object.keys(productPositions).length > 0) {
      localStorage.setItem(`cpg-product-grid-positions-${companyId}`, JSON.stringify(productPositions));
    }
  }, [productPositions, companyId]);

  // Initialize positions for new products
  useEffect(() => {
    if (products.length === 0) return;

    setProductPositions(prev => {
      const updated = { ...prev };
      let hasChanges = false;

      // Get all currently occupied positions
      const occupiedPositions = new Set(Object.values(updated));

      // Assign positions to products that don't have one
      products.forEach((product) => {
        const productKey = product.sku || product.productName;
        if (updated[productKey] === undefined) {
          // Find the first unoccupied position
          let position = 0;
          while (occupiedPositions.has(position)) {
            position++;
          }
          updated[productKey] = position;
          occupiedPositions.add(position); // Mark this position as occupied
          hasChanges = true;
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [products]);

  // Listen for data updates (e.g., invoice edited, recipe changed)
  useEffect(() => {
    const handleDataUpdate = () => {
      console.log('CPUDisplay: Received data update event, reloading...');
      loadFinishedProductCPUs();
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleDataUpdate);
  }, [companyId]);

  const loadFinishedProductCPUs = async () => {
    try {
      setLoading(true);

      // Get company info
      try {
        const company = await db.companies.get(companyId);
        if (company) {
          setCompanyName(company.name);
        }
      } catch (err) {
        console.log('Could not fetch company name:', err);
      }

      // Get invoice date range
      try {
        const invoices = await db.cpgInvoices
          .where('company_id')
          .equals(companyId)
          .filter(inv => !inv.deleted_at)
          .toArray();

        if (invoices.length > 0) {
          const dates = invoices.map(inv => inv.invoice_date).sort((a, b) => a - b);
          const startDate = new Date(dates[0]).toISOString().split('T')[0];
          const endDate = new Date(dates[dates.length - 1]).toISOString().split('T')[0];
          setDateRange({ start: startDate, end: endDate });
        }
      } catch (err) {
        console.log('Could not fetch invoice date range:', err);
      }

      // Get all finished products for this company
      const finishedProducts = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .filter(product => product.active && product.deleted_at === null)
        .toArray();

      // Get date range for filtering
      const dateRange = getDateRangeTimestamps();

      // Calculate CPU for each product
      const productCPUs: FinishedProductCPUBreakdown[] = [];
      for (const product of finishedProducts) {
        try {
          const cpuBreakdown = await cpuCalculatorService.getFinishedProductCPUBreakdown(
            product.id,
            companyId,
            dateRange
          );
          productCPUs.push(cpuBreakdown);
        } catch (error) {
          console.error(`Failed to calculate CPU for product ${product.id}:`, error);
        }
      }

      setProducts(productCPUs);
    } catch (error) {
      console.error('Failed to load finished product CPUs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShowProductBreakdown = (product: FinishedProductCPUBreakdown) => {
    setSelectedProduct(product);
    setShowProductBreakdown(true);
  };

  const handleComponentClick = (categoryId: string, variant: string | null) => {
    setSelectedComponent({ categoryId, variant });
    setShowBreakdownModal(true);
  };

  const handleViewInvoice = (invoiceId: string) => {
    setShowBreakdownModal(false);
    setSelectedInvoiceId(invoiceId);
    setShowInvoiceDetails(true);
  };

  const handleEditInvoice = (invoiceId: string) => {
    setShowInvoiceDetails(false);
    setShowBreakdownModal(false);
    setEditingInvoiceId(invoiceId);
    setShowInvoiceForm(true);
  };

  const handleInvoiceSaved = () => {
    setShowInvoiceForm(false);
    setEditingInvoiceId(null);
    loadFinishedProductCPUs();
  };

  // Date range filter helpers
  const handleDateBlur = (value: string, setter: (value: string) => void) => {
    if (!value) return;

    const parts = value.split('-');
    if (parts.length === 3) {
      let [year, month, day] = parts;

      // Parse year as integer
      const yearNum = parseInt(year, 10);

      // If year is 0-99 (like "0026" from typing "26"), assume 20xx
      if (yearNum >= 0 && yearNum <= 99) {
        year = '20' + String(yearNum).padStart(2, '0');
        setter(`${year}-${month}-${day}`);
      }
    }

    // Reload data when user finishes entering date
    // Check if both dates are set before reloading
    if (dateRangeFilter === 'custom') {
      const startDate = setter === setCustomStartDate ? value : customStartDate;
      const endDate = setter === setCustomEndDate ? value : customEndDate;

      if (startDate && endDate) {
        loadFinishedProductCPUs();
      }
    }
  };

  const getDateRangeTimestamps = (): { start: number; end: number } | null => {
    const now = Date.now();

    switch (dateRangeFilter) {
      case '3mo':
        return { start: now - 90 * 24 * 60 * 60 * 1000, end: now };
      case '6mo':
        return { start: now - 180 * 24 * 60 * 60 * 1000, end: now };
      case '12mo':
        return { start: now - 365 * 24 * 60 * 60 * 1000, end: now };
      case 'last-calendar-year': {
        const lastYear = new Date().getFullYear() - 1;
        return {
          start: new Date(lastYear, 0, 1, 0, 0, 0, 0).getTime(),
          end: new Date(lastYear, 11, 31, 23, 59, 59, 999).getTime(),
        };
      }
      case 'this-calendar-year': {
        const thisYear = new Date().getFullYear();
        return {
          start: new Date(thisYear, 0, 1, 0, 0, 0, 0).getTime(),
          end: now,
        };
      }
      case 'custom':
        if (customStartDate && customEndDate) {
          const [startYear, startMonth, startDay] = customStartDate.split('-').map(Number);
          const [endYear, endMonth, endDay] = customEndDate.split('-').map(Number);

          return {
            start: new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0).getTime(),
            end: new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999).getTime(),
          };
        }
        return null;
      case 'all':
      default:
        return null;
    }
  };

  // Color picker helpers
  const handleCardColorChange = (productKey: string, color: string) => {
    setCardColors(prev => ({ ...prev, [productKey]: color }));
  };

  const resetCardColor = (productKey: string) => {
    setCardColors(prev => {
      const newColors = { ...prev };
      delete newColors[productKey];
      return newColors;
    });
  };

  // Click outside to close color picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Drag and drop handlers for grid positioning
  const handleDragStart = (productKey: string) => {
    setDraggedProductKey(productKey);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(targetIndex);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedProductKey) return;

    // Check if target position is already occupied by another product
    const isOccupied = Object.entries(productPositions).some(
      ([productKey, position]) => productKey !== draggedProductKey && position === targetIndex
    );

    // Only update if position is not occupied
    if (!isOccupied) {
      setProductPositions(prev => ({
        ...prev,
        [draggedProductKey]: targetIndex,
      }));
    }

    setDraggedProductKey(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedProductKey(null);
    setDragOverIndex(null);
  };

  // Export functions
  const exportCSVSummary = () => {
    const headers = ['Product', 'SKU', 'Cost', 'MSRP', 'Profit', 'Margin %', 'Status'];
    const rows = productsWithMetrics.map(p => [
      p.productName,
      p.sku || '',
      p.cost !== null ? `$${p.cost.toFixed(2)}` : '',
      p.msrp !== null ? `$${p.msrp.toFixed(2)}` : '',
      p.profit !== null ? `$${p.profit.toFixed(2)}` : '',
      p.marginPercent !== null ? `${p.marginPercent.toFixed(1)}%` : '',
      p.breakdown.length === 0 ? 'No Recipe' : (p.cost !== null ? 'Complete' : 'Incomplete'),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-costs-summary-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDFSummary = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('Product Cost Summary', 14, 20);

    // Company Name
    doc.setFontSize(12);
    doc.text(companyName, 14, 30);

    // Date Range
    const dateRangeText = dateRangeFilter === 'all'
      ? 'All Time'
      : dateRangeFilter === 'custom' && customStartDate && customEndDate
        ? `${customStartDate} to ${customEndDate}`
        : dateRangeFilter;

    doc.setFontSize(10);
    doc.text(`Date Range: ${dateRangeText}`, 14, 38);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 44);

    // Stats Summary
    doc.setFontSize(12);
    doc.text('Summary', 14, 54);
    doc.setFontSize(10);
    doc.text(`Total Products: ${totalProducts}`, 14, 62);

    if (avgCPU !== null) {
      doc.text(`Average Cost Per Unit: $${avgCPU.toFixed(2)}`, 14, 68);
    }

    // Product Details Table using autoTable
    autoTable(doc, {
      startY: 80,
      head: [['Product', 'Cost', 'MSRP', 'Profit', 'Margin', 'Status']],
      body: productsWithMetrics.map(p => [
        p.productName + (p.sku ? ` (${p.sku})` : ''),
        p.cost !== null ? `$${p.cost.toFixed(2)}` : '-',
        p.msrp !== null ? `$${p.msrp.toFixed(2)}` : '-',
        p.profit !== null ? `$${p.profit.toFixed(2)}` : '-',
        p.marginPercent !== null ? `${p.marginPercent.toFixed(1)}%` : '-',
        p.breakdown.length === 0 ? 'No Recipe' : (p.cost !== null ? 'Complete' : 'Incomplete'),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [75, 0, 110], textColor: 255 },
      styles: { fontSize: 9 },
    });

    doc.save(`product-costs-summary-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportCSVDetail = async () => {
    // Collect all unique categories used across all products
    const categorySet = new Set<string>();
    productsWithMetrics.forEach(product => {
      product.breakdown.forEach(component => {
        const key = component.variant
          ? `${component.categoryName} (${component.variant})`
          : component.categoryName;
        categorySet.add(key);
      });
    });
    const categories = Array.from(categorySet).sort();

    // Build headers - restore original columns + add category columns
    const baseHeaders = [
      'Product',
      'SKU',
      'Total Cost Per Unit',
      'Component Count',
      'Recipe Components',
      'MSRP',
      'Profit Per Unit',
      'Profit Margin %',
      'Status',
      'Missing Components'
    ];
    const headers = [...baseHeaders, ...categories];

    // Build rows
    const rows = productsWithMetrics.map(p => {
      // Base columns (restored original + new)
      const baseData = [
        p.productName,
        p.sku || '',
        p.cost !== null ? p.cost.toFixed(2) : '',
        p.breakdown.length.toString(),
        p.breakdown.map(c =>
          `${c.quantity} ${c.unitOfMeasure} ${c.categoryName}${c.variant ? ` (${c.variant})` : ''}`
        ).join('; '),
        p.msrp !== null ? p.msrp.toFixed(2) : '',
        p.profit !== null ? p.profit.toFixed(2) : '',
        p.marginPercent !== null ? p.marginPercent.toFixed(2) : '',
        p.breakdown.length === 0 ? 'No Recipe' : (p.cost !== null ? 'Complete' : 'Incomplete'),
        p.missingComponents.join('; '),
      ];

      // Category columns - fill with CPU if used in this product
      const categoryData = categories.map(categoryKey => {
        const component = p.breakdown.find(c => {
          const key = c.variant
            ? `${c.categoryName} (${c.variant})`
            : c.categoryName;
          return key === categoryKey;
        });
        return component?.subtotal || '';
      });

      return [...baseData, ...categoryData];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-costs-detail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard} aria-label="Loading">
              <div className={styles.skeletonHeader} />
              <div className={styles.skeletonValue} />
              <div className={styles.skeletonLabel} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon} aria-hidden="true">
          📦
        </div>
        <p className={styles.emptyText}>
          No products defined yet. Add your first product to see manufacturing costs.
        </p>
      </div>
    );
  }

  // Apply filters and sorting
  let filteredProducts = products.filter((product) => {
    // Selected products filter - if no products selected, show all
    if (selectedProducts.size > 0 && !selectedProducts.has(product.productId)) {
      return false;
    }

    // Status filter
    if (statusFilter === 'complete' && !product.isComplete) return false;
    if (statusFilter === 'incomplete' && product.isComplete) return false;

    return true;
  });

  // Apply sorting
  filteredProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.productName.localeCompare(b.productName);
      case 'cpu-asc': {
        const aCPU = a.cpu ? parseFloat(a.cpu) : Infinity;
        const bCPU = b.cpu ? parseFloat(b.cpu) : Infinity;
        return aCPU - bCPU;
      }
      case 'cpu-desc': {
        const aCPU = a.cpu ? parseFloat(a.cpu) : -Infinity;
        const bCPU = b.cpu ? parseFloat(b.cpu) : -Infinity;
        return bCPU - aCPU;
      }
      case 'missing':
        return b.missingComponents.length - a.missingComponents.length;
      default:
        return 0;
    }
  });

  // Calculate profitability metrics for each product
  const productsWithMetrics = filteredProducts.map(product => {
    const cost = product.cpu !== null && product.cpu !== undefined ? parseFloat(product.cpu) : null;
    const msrp = product.msrp !== null && product.msrp !== undefined ? parseFloat(product.msrp.toString()) : null;

    let profit: number | null = null;
    let marginPercent: number | null = null;

    if (cost !== null && msrp !== null && msrp > 0) {
      profit = msrp - cost;
      marginPercent = (profit / msrp) * 100;
    }

    return {
      ...product,
      cost,
      msrp,
      profit,
      marginPercent
    };
  });

  // Calculate stats
  const totalProducts = filteredProducts.length;
  const completeProducts = productsWithMetrics.filter(p => p.marginPercent !== null);
  const productsWithCost = productsWithMetrics.filter(p => p.cost !== null);

  // Calculate average metrics
  const avgCPU = productsWithCost.length > 0
    ? productsWithCost.reduce((sum, p) => sum + (p.cost || 0), 0) / productsWithCost.length
    : null;

  const avgProfitDollars = completeProducts.length > 0
    ? completeProducts.reduce((sum, p) => sum + (p.profit || 0), 0) / completeProducts.length
    : null;

  const avgProfitPercent = completeProducts.length > 0
    ? completeProducts.reduce((sum, p) => sum + (p.marginPercent || 0), 0) / completeProducts.length
    : null;

  const avgComponents = productsWithMetrics.length > 0
    ? productsWithMetrics.reduce((sum, p) => sum + p.breakdown.length, 0) / productsWithMetrics.length
    : null;

  // Find highest and lowest cost products (handle ties)
  const highestCostProducts: typeof productsWithMetrics = [];
  const lowestCostProducts: typeof productsWithMetrics = [];

  if (productsWithCost.length > 0) {
    const maxCost = Math.max(...productsWithCost.map(p => p.cost || 0));
    const minCost = Math.min(...productsWithCost.map(p => p.cost || 0));

    highestCostProducts.push(...productsWithCost.filter(p => p.cost === maxCost));
    lowestCostProducts.push(...productsWithCost.filter(p => p.cost === minCost));
  }

  // Find all top performers (handle ties)
  const topPerformers: typeof productsWithMetrics = [];
  const opportunities: typeof productsWithMetrics = [];

  if (completeProducts.length > 0) {
    const maxMargin = Math.max(...completeProducts.map(p => p.marginPercent || 0));
    const minMargin = Math.min(...completeProducts.map(p => p.marginPercent || 0));

    topPerformers.push(...completeProducts.filter(p => p.marginPercent === maxMargin));
    opportunities.push(...completeProducts.filter(p => p.marginPercent === minMargin));
  }

  // Helper function to render stat metric
  const renderStatMetric = (metric: StatMetric) => {
    switch (metric) {
      case 'total':
        return { label: 'Total Products', value: totalProducts.toString() };
      case 'avg-cpu':
        return { label: 'Average CPU', value: avgCPU !== null ? `$${avgCPU.toFixed(2)}` : '—' };
      case 'avg-profit-dollars':
        return { label: 'Average Profit ($)', value: avgProfitDollars !== null ? `$${avgProfitDollars.toFixed(2)}` : '—' };
      case 'avg-profit-percent':
        return { label: 'Average Profit (%)', value: avgProfitPercent !== null ? `${avgProfitPercent.toFixed(1)}%` : '—' };
      case 'highest-cost':
        return {
          label: 'Most Expensive',
          value: highestCostProducts.length > 0 ? `$${highestCostProducts[0].cost?.toFixed(2)}` : '—',
          subtext: highestCostProducts.map(p => p.productName).join(', ')
        };
      case 'lowest-cost':
        return {
          label: 'Least Expensive',
          value: lowestCostProducts.length > 0 ? `$${lowestCostProducts[0].cost?.toFixed(2)}` : '—',
          subtext: lowestCostProducts.map(p => p.productName).join(', ')
        };
      case 'avg-components':
        return { label: 'Avg Components', value: avgComponents !== null ? avgComponents.toFixed(1) : '—' };
      default:
        return { label: 'Total Products', value: totalProducts.toString() };
    }
  };

  return (
    <div className={styles.container}>
      {/* All Filters in One Row: Date Range | All Products | Status | Sort | Export */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Date Range Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>
            Date Range:
          </label>
          <select
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value as DateRangePreset)}
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
            <option value="last-calendar-year">Last Calendar Year ({new Date().getFullYear() - 1})</option>
            <option value="this-calendar-year">This Calendar Year ({new Date().getFullYear()})</option>
            <option value="custom">Custom Range...</option>
            <option value="all">All Time</option>
          </select>
        </div>

        {/* Custom Date Inputs */}
        {dateRangeFilter === 'custom' && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>
                From:
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                onBlur={(e) => handleDateBlur(e.target.value, setCustomStartDate)}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>
                To:
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                onBlur={(e) => handleDateBlur(e.target.value, setCustomEndDate)}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </>
        )}

        {/* All Products Selector */}
        {onProductSelectionChange && (
          <div style={{ position: 'relative', minWidth: '200px' }}>
            <button
              onClick={() => setShowProductSelector(!showProductSelector)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '0.875rem',
                background: 'white',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              aria-label="Select products to display"
              aria-expanded={showProductSelector}
            >
              <span>
                {selectedProducts.size === 0
                  ? 'All Products'
                  : selectedProducts.size === finishedProducts.length
                  ? 'All Products Selected'
                  : `${selectedProducts.size} Product${selectedProducts.size === 1 ? '' : 's'} Selected`}
              </span>
              <span aria-hidden="true">{showProductSelector ? '▲' : '▼'}</span>
            </button>

            {showProductSelector && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '0.25rem',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 20,
                maxHeight: '300px',
                overflowY: 'auto',
              }}
              role="menu"
              >
                {/* Select All / Clear All */}
                <div style={{
                  padding: '0.5rem',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  gap: '0.5rem',
                }}>
                  <button
                    onClick={() => onProductSelectionChange(new Set(finishedProducts.map((p: any) => p.id)))}
                    style={{
                      flex: 1,
                      padding: '0.25rem 0.5rem',
                      background: '#4b006e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    aria-label="Select all products"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => onProductSelectionChange(new Set())}
                    style={{
                      flex: 1,
                      padding: '0.25rem 0.5rem',
                      background: '#f8fafc',
                      color: '#64748b',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    aria-label="Clear all product selections"
                  >
                    Clear All
                  </button>
                </div>

                {/* Product List */}
                {finishedProducts.map((product: any) => (
                  <label
                    key={product.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f8fafc',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedProducts);
                        if (e.target.checked) {
                          newSet.add(product.id);
                        } else {
                          newSet.delete(product.id);
                        }
                        onProductSelectionChange(newSet);
                      }}
                      style={{ marginRight: '0.5rem' }}
                      aria-label={`Select ${product.name}`}
                    />
                    <span style={{ fontSize: '0.875rem' }}>{product.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status Filter */}
        {onStatusFilterChange && (
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as 'all' | 'complete' | 'incomplete')}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
            aria-label="Filter by completion status"
          >
            <option value="all">Status: All</option>
            <option value="complete">Status: Complete</option>
            <option value="incomplete">Status: Incomplete</option>
          </select>
        )}

        {/* Sort */}
        {onSortByChange && (
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as 'name' | 'cpu-asc' | 'cpu-desc' | 'missing')}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
            aria-label="Sort products"
          >
            <option value="name">Sort: Name (A-Z)</option>
            <option value="cpu-asc">Sort: CPU (Low to High)</option>
            <option value="cpu-desc">Sort: CPU (High to Low)</option>
            <option value="missing">Sort: Missing Components</option>
          </select>
        )}

        {/* Export Dropdown */}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            style={{
              padding: '0.5rem 1rem',
              background: '#4b006e',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Export</span>
            <span aria-hidden="true">▼</span>
          </button>

          {showExportMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 10,
              minWidth: '200px',
            }}>
              <button
                onClick={() => {
                  exportCSVSummary();
                  setShowExportMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                CSV Summary
              </button>
              <button
                onClick={() => {
                  exportPDFSummary();
                  setShowExportMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                PDF Summary
              </button>
              <button
                onClick={() => {
                  exportCSVDetail();
                  setShowExportMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  borderTop: '1px solid #e5e7eb',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                CSV Detail Summary
              </button>
            </div>
          )}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            🔍
          </div>
          <p className={styles.emptyText}>
            No products match your filters. Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <>
          {/* Stat Boxes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}>
            {/* First Stat - Dual Metrics */}
            <div style={{
              background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
              borderRadius: '12px',
              padding: '1.5rem',
              display: 'flex',
              gap: '1.5rem',
              position: 'relative',
              overflow: 'hidden',
              color: 'white',
            }}>
              {/* Left Metric */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                <select
                  value={firstStatLeftMetric}
                  onChange={(e) => setFirstStatLeftMetric(e.target.value as StatMetric)}
                  style={{
                    fontSize: '0.75rem',
                    color: 'white',
                    fontWeight: 500,
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                    maxWidth: '100%',
                  }}
                >
                  <option value="total" style={{ color: '#1f2937' }}>Total Products</option>
                  <option value="avg-cpu" style={{ color: '#1f2937' }}>Average CPU</option>
                  <option value="avg-profit-dollars" style={{ color: '#1f2937' }}>Average Profit ($)</option>
                  <option value="avg-profit-percent" style={{ color: '#1f2937' }}>Average Profit (%)</option>
                  <option value="highest-cost" style={{ color: '#1f2937' }}>Most Expensive</option>
                  <option value="lowest-cost" style={{ color: '#1f2937' }}>Least Expensive</option>
                  <option value="avg-components" style={{ color: '#1f2937' }}>Avg Components</option>
                </select>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                  {renderStatMetric(firstStatLeftMetric).value}
                </div>
                {renderStatMetric(firstStatLeftMetric).subtext && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginTop: '0.25rem',
                    lineHeight: 1.4,
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                  >
                    {renderStatMetric(firstStatLeftMetric).subtext}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{
                width: '1px',
                background: 'rgba(255, 255, 255, 0.3)',
                margin: '-1.5rem 0',
              }} />

              {/* Right Metric */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                <select
                  value={firstStatRightMetric}
                  onChange={(e) => setFirstStatRightMetric(e.target.value as StatMetric)}
                  style={{
                    fontSize: '0.75rem',
                    color: 'white',
                    fontWeight: 500,
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                    maxWidth: '100%',
                  }}
                >
                  <option value="total" style={{ color: '#1f2937' }}>Total Products</option>
                  <option value="avg-cpu" style={{ color: '#1f2937' }}>Average CPU</option>
                  <option value="avg-profit-dollars" style={{ color: '#1f2937' }}>Average Profit ($)</option>
                  <option value="avg-profit-percent" style={{ color: '#1f2937' }}>Average Profit (%)</option>
                  <option value="highest-cost" style={{ color: '#1f2937' }}>Most Expensive</option>
                  <option value="lowest-cost" style={{ color: '#1f2937' }}>Least Expensive</option>
                  <option value="avg-components" style={{ color: '#1f2937' }}>Avg Components</option>
                </select>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                  {renderStatMetric(firstStatRightMetric).value}
                </div>
                {renderStatMetric(firstStatRightMetric).subtext && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginTop: '0.25rem',
                    lineHeight: 1.4,
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                  >
                    {renderStatMetric(firstStatRightMetric).subtext}
                  </div>
                )}
              </div>
            </div>

            {/* Top Performer(s) - Handle Ties */}
            {topPerformers.length > 0 && (
              <div style={{
                background: '#f3e8ff',
                border: '2px solid #9333ea',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                <div style={{ fontSize: '0.875rem', color: '#6b21a8', fontWeight: 600 }}>
                  Top Performer{topPerformers.length > 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.3, color: '#4b006e' }}>
                  {topPerformers.map(p => p.productName).join(', ')}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: '#4b006e' }}>
                  {topPerformers[0].marginPercent?.toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b21a8' }}>
                  margin
                </div>
              </div>
            )}

            {/* Opportunity/Opportunities - Handle Ties */}
            {opportunities.length > 0 && (
              <div style={{
                background: '#dcfce7',
                border: '2px solid #16a34a',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                <div style={{ fontSize: '0.875rem', color: '#15803d', fontWeight: 600 }}>
                  Opportunit{opportunities.length > 1 ? 'ies' : 'y'}
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.3, color: '#166534' }}>
                  {opportunities.map(p => p.productName).join(', ')}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: '#166534' }}>
                  {opportunities[0].marginPercent?.toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.875rem', color: '#15803d' }}>
                  margin
                </div>
              </div>
            )}
          </div>

          {/* View Toggle */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '1rem',
          }}>
            <div style={{
              display: 'inline-flex',
              background: '#f3f4f6',
              borderRadius: '8px',
              padding: '4px',
            }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: viewMode === 'grid' ? 'white' : 'transparent',
                  color: viewMode === 'grid' ? '#1f2937' : '#64748b',
                  borderRadius: '6px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: viewMode === 'table' ? 'white' : 'transparent',
                  color: viewMode === 'table' ? '#1f2937' : '#64748b',
                  borderRadius: '6px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                Table
              </button>
            </div>
          </div>

          {/* Grid View */}
          {viewMode === 'grid' && (() => {
            const orderedProducts = productsWithMetrics;

            // Calculate grid size and position map
            const maxPosition = Math.max(
              ...orderedProducts.map(p => {
                const key = p.sku || p.productName;
                return productPositions[key] ?? 0;
              }),
              orderedProducts.length - 1
            );
            const gridSize = Math.max(maxPosition + 10, 20);

            // Create position map
            const positionMap: Record<number, typeof orderedProducts[0]> = {};
            orderedProducts.forEach(product => {
              const key = product.sku || product.productName;
              const position = productPositions[key];
              if (position !== undefined) {
                positionMap[position] = product;
              }
            });

            return (
              <div className={styles.grid}>
                {Array.from({ length: gridSize }).map((_, index) => {
                  const product = positionMap[index];

                  // Empty grid cell
                  if (!product) {
                    return (
                      <div
                        key={`empty-${index}`}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        style={{
                          border: dragOverIndex === index ? '2px dashed #4b006e' : '2px dashed transparent',
                          background: dragOverIndex === index ? 'rgba(75, 0, 110, 0.05)' : 'transparent',
                          borderRadius: '12px',
                          minHeight: '200px',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#cbd5e1',
                          fontSize: '0.875rem',
                        }}
                      />
                    );
                  }

                  // Product card
                  const hasRecipe = product.breakdown.length > 0;
                  const componentCount = product.breakdown.length;
                  const productKey = product.sku || product.productName;

                  // Determine background color - use custom if set, otherwise default
                  let bgColor = cardColors[productKey];
                  if (!bgColor) {
                    // Default colors: light purple or light green (alternating for variety)
                    bgColor = index % 2 === 0 ? '#f3e8ff' : '#f0fdf4'; // light purple : light green
                  }

                  return (
                    <article
                      key={`${product.sku || product.productName}-${index}`}
                      draggable
                      onDragStart={() => handleDragStart(productKey)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      style={{
                        background: bgColor,
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        transition: 'transform 150ms, box-shadow 150ms',
                        position: 'relative',
                        cursor: draggedProductKey === productKey ? 'grabbing' : 'grab',
                        opacity: draggedProductKey === productKey ? 0.5 : 1,
                      }}
                    onMouseEnter={(e) => {
                      if (draggedProductKey === null) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Color Picker Button */}
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                      <button
                        onClick={() => setShowColorPicker(showColorPicker === productKey ? null : productKey)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          border: '2px solid #64748b',
                          background: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                        }}
                        title="Change card color"
                      >
                        🎨
                      </button>

                      {/* Color Picker Dropdown */}
                      {showColorPicker === productKey && (
                        <div
                          ref={colorPickerRef}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '0.5rem',
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '1rem',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 10,
                            minWidth: '200px',
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 600 }}>
                            CARD COLOR
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            {['#f3e8ff', '#f0fdf4', '#fef2f2', '#fffbeb', '#eff6ff', '#fce7f3', '#fef3c7', '#f0f9ff'].map(color => (
                              <button
                                key={color}
                                onClick={() => {
                                  handleCardColorChange(productKey, color);
                                  setShowColorPicker(null);
                                }}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '6px',
                                  border: cardColors[productKey] === color ? '3px solid #4b006e' : '1px solid #e5e7eb',
                                  background: color,
                                  cursor: 'pointer',
                                }}
                              />
                            ))}
                          </div>
                          <div style={{ marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                              Custom HEX
                            </label>
                            <input
                              type="text"
                              placeholder="#f3e8ff"
                              maxLength={7}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e5e7eb',
                                borderRadius: '4px',
                                fontSize: '0.875rem',
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const value = e.currentTarget.value;
                                  if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                    handleCardColorChange(productKey, value);
                                    setShowColorPicker(null);
                                  }
                                }
                              }}
                            />
                          </div>
                          <button
                            onClick={() => {
                              resetCardColor(productKey);
                              setShowColorPicker(null);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              background: 'white',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#64748b',
                              cursor: 'pointer',
                            }}
                          >
                            Reset to Default
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Header */}
                    <div style={{ paddingRight: '2rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '1.125rem', color: '#1f2937' }}>
                        {product.productName}
                      </div>
                      {product.sku && (
                        <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                          SKU: {product.sku}
                        </div>
                      )}
                    </div>

                    {/* Main Metrics - CPU as Hero */}
                    {!hasRecipe ? (
                      <div style={{
                        padding: '2rem 1rem',
                        textAlign: 'center',
                        color: '#64748b',
                      }}>
                        <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
                        <div style={{ fontWeight: 500 }}>No recipe defined</div>
                      </div>
                    ) : product.cost !== null ? (
                      <>
                        {/* Cost Per Unit - Hero */}
                        <div style={{
                          padding: '1.25rem',
                          background: 'white',
                          borderRadius: '8px',
                          textAlign: 'center',
                        }}>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                            Cost Per Unit
                          </div>
                          <div style={{ fontSize: '3rem', fontWeight: 700, color: '#4b006e', lineHeight: 1 }}>
                            ${product.cost.toFixed(2)}
                          </div>
                        </div>

                        {/* Profit, Margin & MSRP - Context Below */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: product.profit !== null ? '1fr 1fr 1fr' : '1fr',
                          gap: '0.75rem',
                          fontSize: '0.875rem',
                        }}>
                          {product.profit !== null && (
                            <>
                              <div>
                                <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Profit</div>
                                <div style={{
                                  fontWeight: 600,
                                  fontSize: '1rem',
                                  color: product.profit >= 0 ? '#4b006e' : '#ea580c'
                                }}>
                                  ${product.profit.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Margin</div>
                                <div style={{
                                  fontWeight: 600,
                                  fontSize: '1rem',
                                  color: (product.marginPercent ?? 0) >= 0 ? '#4b006e' : '#ea580c'
                                }}>
                                  {product.marginPercent?.toFixed(1)}%
                                </div>
                              </div>
                            </>
                          )}
                          <div>
                            <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>MSRP</div>
                            <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                              {product.msrp ? `$${product.msrp.toFixed(2)}` : '—'}
                            </div>
                          </div>
                        </div>

                        {/* Component Count */}
                        <div style={{ fontSize: '0.875rem', color: '#64748b', textAlign: 'center' }}>
                          {componentCount} {componentCount === 1 ? 'component' : 'components'}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Incomplete - Show what's missing */}
                        <div style={{
                          padding: '2rem 1rem',
                          textAlign: 'center',
                        }}>
                          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
                          <div style={{ fontWeight: 500, color: '#64748b', marginBottom: '0.5rem' }}>
                            Missing cost data
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                            Add invoices to calculate
                          </div>
                        </div>

                        {/* Show MSRP if available */}
                        {product.msrp && (
                          <div style={{ fontSize: '0.875rem', textAlign: 'center' }}>
                            <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>MSRP</div>
                            <div style={{ fontWeight: 600, fontSize: '1rem' }}>${product.msrp.toFixed(2)}</div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Action Button */}
                    {hasRecipe && (
                      <button
                        onClick={() => handleShowProductBreakdown(product)}
                        style={{
                          padding: '0.75rem',
                          background: 'white',
                          border: '2px solid #4b006e',
                          borderRadius: '8px',
                          color: '#4b006e',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 150ms',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#4b006e';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.color = '#4b006e';
                        }}
                        aria-label={`View cost breakdown for ${product.productName}`}
                      >
                        <span>Show Breakdown</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                  </article>
                );
              })}
              </div>
            );
          })()}

          {/* Table View */}
          {viewMode === 'table' && (() => {
            // Apply table sorting
            const sortedProducts = [...productsWithMetrics].sort((a, b) => {
              let aVal: any, bVal: any;

              switch (tableSortColumn) {
                case 'name':
                  aVal = a.productName.toLowerCase();
                  bVal = b.productName.toLowerCase();
                  break;
                case 'cost':
                  aVal = a.cost ?? -Infinity;
                  bVal = b.cost ?? -Infinity;
                  break;
                case 'msrp':
                  aVal = a.msrp ?? -Infinity;
                  bVal = b.msrp ?? -Infinity;
                  break;
                case 'profit':
                  aVal = a.profit ?? -Infinity;
                  bVal = b.profit ?? -Infinity;
                  break;
                case 'margin':
                  aVal = a.marginPercent ?? -Infinity;
                  bVal = b.marginPercent ?? -Infinity;
                  break;
                case 'status':
                  aVal = a.breakdown.length === 0 ? 0 : (a.cost !== null ? 2 : 1);
                  bVal = b.breakdown.length === 0 ? 0 : (b.cost !== null ? 2 : 1);
                  break;
                default:
                  return 0;
              }

              if (typeof aVal === 'string') {
                return tableSortDirection === 'asc'
                  ? aVal.localeCompare(bVal)
                  : bVal.localeCompare(aVal);
              } else {
                return tableSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
              }
            });

            const handleColumnClick = (column: TableSortColumn) => {
              if (tableSortColumn === column) {
                setTableSortDirection(tableSortDirection === 'asc' ? 'desc' : 'asc');
              } else {
                setTableSortColumn(column);
                setTableSortDirection('asc');
              }
            };

            const SortableHeader = ({ column, label, align = 'left' }: { column: TableSortColumn; label: string; align?: 'left' | 'right' | 'center' }) => (
              <th
                onClick={() => handleColumnClick(column)}
                style={{
                  padding: '1rem',
                  textAlign: align,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.025em',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {label}{' '}
                {tableSortColumn === column && (
                  <span aria-hidden="true">{tableSortDirection === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
            );

            return (
              <div style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                overflow: 'hidden',
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}>
                  <thead>
                    <tr style={{
                      background: '#f9fafb',
                      borderBottom: '2px solid #e5e7eb',
                    }}>
                      <SortableHeader column="name" label="Product" align="left" />
                      <SortableHeader column="cost" label="Cost" align="right" />
                      <SortableHeader column="msrp" label="MSRP" align="right" />
                      <SortableHeader column="profit" label="Profit" align="right" />
                      <SortableHeader column="margin" label="Margin" align="right" />
                      <SortableHeader column="status" label="Status" align="center" />
                      <th style={{
                        padding: '1rem',
                        textAlign: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.025em',
                      }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((product, index) => {
                    const hasRecipe = product.breakdown.length > 0;
                    const productKey = product.sku || product.productName;

                    // Use custom color if set, otherwise default (same as cards)
                    let rowBg = cardColors[productKey];
                    if (!rowBg) {
                      rowBg = index % 2 === 0 ? '#f3e8ff' : '#f0fdf4';
                    }

                    return (
                      <tr
                        key={`${product.sku || product.productName}-${index}`}
                        style={{
                          background: rowBg,
                          borderBottom: '1px solid #e5e7eb',
                          transition: 'background 150ms',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = rowBg;
                        }}
                      >
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 600, color: '#1f2937' }}>
                            {product.productName}
                          </div>
                          {product.sku && (
                            <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.125rem' }}>
                              {product.sku}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                          {product.cost !== null ? `$${product.cost.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                          {product.msrp !== null ? `$${product.msrp.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: '#4b006e' }}>
                          {product.profit !== null ? `$${product.profit.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: '#4b006e' }}>
                          {product.marginPercent !== null ? `${product.marginPercent.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          {!hasRecipe ? (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              background: '#f3f4f6',
                              borderRadius: '12px',
                              fontSize: '0.875rem',
                              color: '#64748b',
                              fontWeight: 500,
                            }}>
                              No Recipe
                            </span>
                          ) : product.profit !== null ? (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              background: '#10b981',
                              borderRadius: '12px',
                              fontSize: '0.875rem',
                              color: 'white',
                              fontWeight: 500,
                            }}>
                              Complete
                            </span>
                          ) : (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              background: '#f59e0b',
                              borderRadius: '12px',
                              fontSize: '0.875rem',
                              color: 'white',
                              fontWeight: 500,
                            }}>
                              Incomplete
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          {hasRecipe && (
                            <button
                              onClick={() => handleShowProductBreakdown(product)}
                              style={{
                                padding: '0.5rem 1rem',
                                background: 'white',
                                border: '2px solid #4b006e',
                                borderRadius: '6px',
                                color: '#4b006e',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 150ms',
                                fontSize: '0.875rem',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#4b006e';
                                e.currentTarget.style.color = 'white';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'white';
                                e.currentTarget.style.color = '#4b006e';
                              }}
                            >
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
        </>
      )}

      {/* CPU Breakdown Modal */}
      {showBreakdownModal && selectedComponent && (
        <CPUBreakdownModal
          isOpen={showBreakdownModal}
          onClose={() => {
            setShowBreakdownModal(false);
            setSelectedComponent(null);
          }}
          categoryId={selectedComponent.categoryId}
          variant={selectedComponent.variant}
          companyId={companyId}
          onViewInvoice={handleViewInvoice}
        />
      )}

      {/* Invoice Details Modal */}
      {showInvoiceDetails && selectedInvoiceId && (
        <InvoiceDetailsModal
          isOpen={showInvoiceDetails}
          onClose={() => {
            setShowInvoiceDetails(false);
            setSelectedInvoiceId(null);
          }}
          invoiceId={selectedInvoiceId}
          onEdit={handleEditInvoice}
        />
      )}

      {/* Invoice Edit Modal */}
      {(showInvoiceForm || editingInvoiceId) && (
        <AddInvoiceModal
          isOpen={showInvoiceForm || !!editingInvoiceId}
          onClose={() => {
            setShowInvoiceForm(false);
            setEditingInvoiceId(null);
          }}
          onSuccess={handleInvoiceSaved}
          invoiceId={editingInvoiceId || undefined}
        />
      )}

      {/* Product Breakdown Modal */}
      {showProductBreakdown && selectedProduct && (
        <ProductBreakdownModal
          isOpen={showProductBreakdown}
          onClose={() => {
            setShowProductBreakdown(false);
            setSelectedProduct(null);
          }}
          productName={selectedProduct.productName}
          totalCPU={selectedProduct.cpu}
          isComplete={selectedProduct.isComplete}
          breakdown={selectedProduct.breakdown}
          missingComponents={selectedProduct.missingComponents}
          msrp={selectedProduct.msrp}
          onComponentClick={handleComponentClick}
          dateRange={dateRange}
          companyName={companyName}
          companyId={companyId}
          onNavigateToVendorIntel={(vendorName) => {
            // Dispatch custom event to navigate to Vendor Intel tab
            window.dispatchEvent(
              new CustomEvent('navigate-to-vendor-intel', {
                detail: { vendorName },
              })
            );
          }}
          bundleStructure={selectedProduct.bundleStructure}
        />
      )}
    </div>
  );
}
