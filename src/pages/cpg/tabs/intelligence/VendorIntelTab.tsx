/**
 * Vendor Intel Sub-Tab Component
 *
 * Displays vendor intelligence analysis with master-detail layout.
 *
 * Features:
 * - Master-detail UI with vendor/component views
 * - Vendor editing with archive functionality
 * - Component invoice dropdown showing all-time invoices
 * - YTD baseline with filtered comparison
 * - Enhanced export options (All/Current, Tables/Vendors)
 * - Archived vendor management
 *
 * Requirements:
 * - WCAG 2.1 AA compliance
 * - Type-safe implementation
 * - Print-friendly exports
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { CPGCategory, CPGInvoice, CPGVendor } from '../../../../db/schema/cpg.schema';
import { db } from '../../../../db/database';
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

interface VendorStats {
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
  categoryId: string;
  variants: VariantComparison[];
}

type SortColumn = 'vendor' | 'spend' | 'invoices' | 'components' | 'component' | 'bestPrice' | 'savings';

// Utility: Format currency with commas
const formatCurrency = (value: number): string => {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Utility: Format number with commas
const formatNumber = (value: number): string => {
  return value.toLocaleString('en-US');
};

// Utility: Get date range label
const getDateRangeLabel = (dateRange: VendorIntelTabProps['dateRange']): string => {
  switch (dateRange) {
    case '3mo': return 'Last 3 Months';
    case '6mo': return 'Last 6 Months';
    case '12mo': return 'Last 12 Months';
    case 'last-calendar-year': return `Last Calendar Year (${new Date().getFullYear() - 1})`;
    case 'this-calendar-year': return `This Calendar Year (${new Date().getFullYear()})`;
    case 'custom': return 'Custom Range';
    case 'all': return 'All Time';
    default: return 'Unknown';
  }
};

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
  // View mode and selection state
  const [viewMode, setViewMode] = useState<'component' | 'vendor'>('vendor');
  const [selectedVendor, setSelectedVendor] = useState<VendorOverview | null>(null);
  const [currentVendorRecord, setCurrentVendorRecord] = useState<CPGVendor | null>(null);
  const [isEditingVendor, setIsEditingVendor] = useState(false);
  const [editVendorName, setEditVendorName] = useState('');
  const [editVendorNotes, setEditVendorNotes] = useState('');

  // Archived vendors
  const [showArchivedVendors, setShowArchivedVendors] = useState(false);

  // Expanded component invoice state
  const [expandedComponentInvoices, setExpandedComponentInvoices] = useState<string | null>(null);

  // Local invoice state
  const [localInvoices, setLocalInvoices] = useState<CPGInvoice[]>(invoices);

  // Export menu
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Data state
  const [vendorOverviews, setVendorOverviews] = useState<VendorOverview[]>([]);
  const [componentComparisons, setComponentComparisons] = useState<ComponentComparison[]>([]);

  // Vendor YTD and filtered stats
  const [selectedVendorYTD, setSelectedVendorYTD] = useState<VendorStats | null>(null);
  const [selectedVendorFiltered, setSelectedVendorFiltered] = useState<VendorStats | null>(null);

  // Sorting
  const [vendorSortColumn, setVendorSortColumn] = useState<SortColumn>('spend');
  const [vendorSortDirection, setVendorSortDirection] = useState<'asc' | 'desc'>('desc');

  // Update local invoices
  useEffect(() => {
    setLocalInvoices(invoices);
  }, [invoices]);

  // Load vendor record
  useEffect(() => {
    if (!selectedVendor) {
      setCurrentVendorRecord(null);
      setSelectedVendorYTD(null);
      setSelectedVendorFiltered(null);
      return;
    }

    const loadVendor = async () => {
      try {
        const existing = await db.cpgVendors
          .where('company_id')
          .equals(companyId)
          .filter(v => v.name === selectedVendor.vendorName && !v.deleted_at)
          .first();

        if (existing) {
          setCurrentVendorRecord(existing);
        } else {
          const newVendor: CPGVendor = {
            id: crypto.randomUUID(),
            company_id: companyId,
            name: selectedVendor.vendorName,
            notes: null,
            active: true,
            created_at: Date.now(),
            updated_at: Date.now(),
            deleted_at: null,
            version_vector: { [companyId]: 1 },
          };
          await db.cpgVendors.add(newVendor);
          setCurrentVendorRecord(newVendor);
        }

        // Calculate YTD stats
        calculateVendorStats();
      } catch (error) {
        console.error('Failed to load/create vendor:', error);
      }
    };

    loadVendor();
  }, [selectedVendor, companyId, localInvoices, selectedProducts, productCPUData, categoryFilter, variantFilter]);

  // Calculate vendor YTD and filtered stats
  const calculateVendorStats = () => {
    if (!selectedVendor) return;

    const today = Date.now();
    const thisYear = new Date().getFullYear();
    const ytdStart = new Date(thisYear, 0, 1).getTime();

    // Get component categories for filtering
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

    // Calculate YTD stats
    const ytdStats = { totalSpend: 0, invoiceCount: 0, componentCount: 0 };
    const ytdComponents = new Set<string>();

    localInvoices.forEach(inv => {
      if (inv.deleted_at) return;
      if (inv.vendor_name !== selectedVendor.vendorName) return;
      if (inv.invoice_date < ytdStart || inv.invoice_date > today) return;

      let hasComponents = false;
      Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
        const variants = componentCategories.get(attr.category_id);
        if (variants && (variants.size === 0 || variants.has(attr.variant || ''))) {
          const unitPrice = parseFloat(attr.unit_price);
          const unitsPurchased = parseFloat(attr.units_purchased);
          if (!isNaN(unitPrice) && !isNaN(unitsPurchased)) {
            ytdStats.totalSpend += unitPrice * unitsPurchased;
            ytdComponents.add(`${attr.category_id}:${attr.variant || ''}`);
            hasComponents = true;
          }
        }
      });

      if (hasComponents) {
        ytdStats.invoiceCount++;
      }
    });
    ytdStats.componentCount = ytdComponents.size;

    setSelectedVendorYTD(ytdStats);

    // Calculate filtered stats
    let startDate = 0;
    let endDate = today;

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
        startDate = ytdStart;
        break;
      case 'custom':
        if (customDateRange) {
          startDate = customDateRange.start;
          endDate = customDateRange.end;
        }
        break;
      case 'all':
        startDate = 0;
        break;
    }

    const filteredStats = { totalSpend: 0, invoiceCount: 0, componentCount: 0 };
    const filteredComponents = new Set<string>();

    localInvoices.forEach(inv => {
      if (inv.deleted_at) return;
      if (inv.vendor_name !== selectedVendor.vendorName) return;
      if (startDate > 0 && inv.invoice_date < startDate) return;
      if (endDate > 0 && inv.invoice_date > endDate) return;

      let hasComponents = false;
      Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
        const variants = componentCategories.get(attr.category_id);
        if (variants && (variants.size === 0 || variants.has(attr.variant || ''))) {
          const unitPrice = parseFloat(attr.unit_price);
          const unitsPurchased = parseFloat(attr.units_purchased);
          if (!isNaN(unitPrice) && !isNaN(unitsPurchased)) {
            filteredStats.totalSpend += unitPrice * unitsPurchased;
            filteredComponents.add(`${attr.category_id}:${attr.variant || ''}`);
            hasComponents = true;
          }
        }
      });

      if (hasComponents) {
        filteredStats.invoiceCount++;
      }
    });
    filteredStats.componentCount = filteredComponents.size;

    setSelectedVendorFiltered(filteredStats);
  };

  // Load vendor intelligence
  useEffect(() => {
    loadVendorIntelligence();
  }, [selectedProducts, productCPUData, localInvoices, dateRange, customDateRange, categoryFilter, variantFilter, vendorFilter, showArchivedVendors]);

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
          break;
      }

      const relevantInvoices = localInvoices.filter(inv => {
        if (inv.deleted_at) return false;
        if (startDate > 0 && inv.invoice_date < startDate) return false;
        if (endDate > 0 && inv.invoice_date > endDate) return false;
        return true;
      });

      const normalizedVendorFilter = vendorFilter.size > 0
        ? new Set(Array.from(vendorFilter).map(v => v.trim().toLowerCase()))
        : new Set();

      const vendorFilteredInvoices = relevantInvoices.filter(inv => {
        if (normalizedVendorFilter.size > 0) {
          const vendorName = (inv.vendor_name || '').trim().toLowerCase();
          if (!normalizedVendorFilter.has(vendorName)) return false;
        }
        return true;
      });

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

      const vendorStats = new Map<string, { spend: number; invoices: Set<string>; components: Set<string> }>();

      vendorFilteredInvoices.forEach(inv => {
        const vendor = inv.vendor_name || 'Unknown';

        if (!vendorStats.has(vendor)) {
          vendorStats.set(vendor, { spend: 0, invoices: new Set(), components: new Set() });
        }

        const stats = vendorStats.get(vendor)!;
        stats.invoices.add(inv.id);

        Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
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
        }))
        .filter(vendor => vendor.componentCount > 0);

      setVendorOverviews(overviews);

      const categoryMap = new Map<string, VariantComparison[]>();

      for (const [categoryId, variants] of componentCategories.entries()) {
        const category = categories.find(c => c.id === categoryId);
        const categoryName = category?.name || 'Unknown';

        const variantComparisons: VariantComparison[] = [];

        for (const variant of variants) {
          const vendorPriceData = new Map<string, number[]>();

          relevantInvoices.forEach(inv => {
            const vendor = inv.vendor_name || 'Unknown';
            const normalizedVendor = vendor.trim().toLowerCase();

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

          const vendorPrices: VendorPrice[] = Array.from(vendorPriceData.entries())
            .map(([vendor, prices]) => ({
              vendor,
              avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
              minPrice: Math.min(...prices),
              maxPrice: Math.max(...prices),
              purchaseCount: prices.length,
            }))
            .sort((a, b) => a.vendor.localeCompare(b.vendor));

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
          categoryMap.set(categoryId, variantComparisons);
        }
      }

      const comparisons: ComponentComparison[] = Array.from(categoryMap.entries())
        .map(([categoryId, variants]) => {
          const category = categories.find(c => c.id === categoryId);
          return {
            categoryId,
            categoryName: category?.name || 'Unknown',
            variants: variants.sort((a, b) => a.variant.localeCompare(b.variant)),
          };
        })
        .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

      setComponentComparisons(comparisons);
    } catch (err) {
      console.error('Failed to load vendor intelligence:', err);
    }
  };

  // Get all-time invoices for a component
  const getComponentInvoices = (categoryId: string, variant: string) => {
    return localInvoices.filter(inv => {
      if (inv.deleted_at) return false;
      return Object.values(inv.cost_attribution || {}).some(
        attr => attr.category_id === categoryId && (attr.variant || '') === variant
      );
    }).sort((a, b) => b.invoice_date - a.invoice_date);
  };

  // Handle vendor save
  const handleSaveVendor = async () => {
    if (!currentVendorRecord) return;

    const oldName = currentVendorRecord.name;
    const newName = editVendorName.trim();
    const nameChanged = oldName !== newName;

    try {
      await db.cpgVendors.update(currentVendorRecord.id, {
        name: newName,
        notes: editVendorNotes.trim() || null,
        updated_at: Date.now(),
      });

      if (nameChanged) {
        const affectedInvoices = await db.cpgInvoices
          .where('company_id')
          .equals(companyId)
          .filter(inv => inv.vendor_name === oldName && !inv.deleted_at)
          .toArray();

        for (const invoice of affectedInvoices) {
          await db.cpgInvoices.update(invoice.id, {
            vendor_name: newName,
            updated_at: Date.now(),
          });
        }

        setLocalInvoices(prev =>
          prev.map(inv =>
            inv.vendor_name === oldName
              ? { ...inv, vendor_name: newName }
              : inv
          )
        );

        if (selectedVendor) {
          setSelectedVendor({
            ...selectedVendor,
            vendorName: newName,
          });
        }
      }

      setIsEditingVendor(false);
    } catch (error) {
      console.error('Failed to save vendor:', error);
    }
  };

  // Handle archive vendor
  const handleArchiveVendor = async () => {
    if (!currentVendorRecord) return;
    if (!confirm(`Archive vendor "${currentVendorRecord.name}"? This will hide it from the main list.`)) return;

    try {
      await db.cpgVendors.update(currentVendorRecord.id, {
        deleted_at: Date.now(),
        updated_at: Date.now(),
      });

      setSelectedVendor(null);
      setIsEditingVendor(false);
      loadVendorIntelligence();
    } catch (error) {
      console.error('Failed to archive vendor:', error);
    }
  };

  // Handle restore vendor
  const handleRestoreVendor = async (vendorId: string) => {
    try {
      await db.cpgVendors.update(vendorId, {
        deleted_at: null,
        updated_at: Date.now(),
      });

      loadVendorIntelligence();
    } catch (error) {
      console.error('Failed to restore vendor:', error);
    }
  };

  // Edit vendor
  const handleEditVendor = () => {
    if (currentVendorRecord) {
      setEditVendorName(currentVendorRecord.name);
      setEditVendorNotes(currentVendorRecord.notes || '');
      setIsEditingVendor(true);
    }
  };

  // Sorted vendors
  const sortedVendors = useMemo(() => {
    return [...vendorOverviews].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (vendorSortColumn) {
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
        return vendorSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return vendorSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [vendorOverviews, vendorSortColumn, vendorSortDirection]);

  // Export handlers
  const handleExportVendorOverviewCSV = (currentOnly: boolean) => {
    const vendors = currentOnly && selectedVendor ? [selectedVendor] : sortedVendors;

    const rows: string[] = [];
    rows.push('Vendor,Total Spend,Invoices,Components');

    vendors.forEach(vo => {
      rows.push(`"${vo.vendorName}","${formatCurrency(vo.totalSpend)}","${vo.invoiceCount}","${vo.componentCount}"`);
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-overview-${currentOnly ? 'current' : 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportPriceComparisonCSV = (currentVendorOnly: boolean) => {
    const rows: string[] = [];
    rows.push('Component,Variant,Vendor,Average Price,Best Price,Savings');

    const comps = currentVendorOnly && selectedVendor
      ? componentComparisons.filter(comp => comp.variants.some(v => v.vendorPrices.some(vp => vp.vendor === selectedVendor.vendorName)))
      : componentComparisons;

    comps.forEach(comp => {
      comp.variants.forEach(variant => {
        const prices = currentVendorOnly && selectedVendor
          ? variant.vendorPrices.filter(vp => vp.vendor === selectedVendor.vendorName)
          : variant.vendorPrices;

        prices.forEach(vp => {
          const savings = variant.worstPrice - vp.avgPrice;
          rows.push(
            `"${comp.categoryName}","${variant.variant}","${vp.vendor}","${formatCurrency(vp.avgPrice)}","${vp.avgPrice === variant.bestPrice ? 'YES' : ''}","${savings > 0 ? formatCurrency(savings) : ''}"`
          );
        });
      });
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price-comparison-${currentVendorOnly ? 'current-vendor' : 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // Filters are active?
  const hasActiveFilters = dateRange !== 'this-calendar-year' || categoryFilter.size > 0 || variantFilter.size > 0 || vendorFilter.size > 0;

  if (componentComparisons.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🏪</div>
        <div className={styles.emptyTitle}>No vendor data available</div>
        <div className={styles.emptyDescription}>
          {selectedProducts.size === 0
            ? 'Select products to analyze vendor pricing'
            : 'No vendor data available for selected products'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setViewMode('vendor')}
            style={{
              padding: '0.5rem 1rem',
              background: viewMode === 'vendor' ? '#4b006e' : 'white',
              color: viewMode === 'vendor' ? 'white' : '#64748b',
              border: viewMode === 'vendor' ? 'none' : '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            By Vendor
          </button>
          <button
            onClick={() => setViewMode('component')}
            style={{
              padding: '0.5rem 1rem',
              background: viewMode === 'component' ? '#4b006e' : 'white',
              color: viewMode === 'component' ? 'white' : '#64748b',
              border: viewMode === 'component' ? 'none' : '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            By Component
          </button>
        </div>

        <div className={styles.headerControls}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={styles.exportButton}
            >
              Export ▼
            </button>
            {showExportMenu && (
              <div className={styles.exportMenu}>
                <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb' }}>
                  Vendor Overview
                </div>
                <button onClick={() => handleExportVendorOverviewCSV(false)} className={styles.exportMenuItem}>
                  All Vendors (CSV)
                </button>
                {selectedVendor && (
                  <button onClick={() => handleExportVendorOverviewCSV(true)} className={styles.exportMenuItem}>
                    Current Vendor Only (CSV)
                  </button>
                )}
                <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb', marginTop: '0.5rem' }}>
                  Price Comparison
                </div>
                <button onClick={() => handleExportPriceComparisonCSV(false)} className={styles.exportMenuItem}>
                  All Components (CSV)
                </button>
                {selectedVendor && (
                  <button onClick={() => handleExportPriceComparisonCSV(true)} className={styles.exportMenuItem}>
                    Current Vendor Components (CSV)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div style={{ display: 'flex', gap: '1.5rem', minHeight: '500px' }}>
        {/* Left Panel */}
        <div style={{
          width: '280px',
          flexShrink: 0,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          {viewMode === 'vendor' ? (
            <>
              <div style={{
                padding: '1rem',
                background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.875rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span>Vendors ({formatNumber(sortedVendors.length)})</span>
                <button
                  onClick={() => setShowArchivedVendors(!showArchivedVendors)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: 'none',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.6875rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {showArchivedVendors ? 'Active' : 'Archived'}
                </button>
              </div>
              <div style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
                {showArchivedVendors ? (
                  <ArchivedVendorsList
                    companyId={companyId}
                    onRestore={handleRestoreVendor}
                  />
                ) : (
                  sortedVendors.map(vendor => {
                    const isSelected = selectedVendor?.vendorName === vendor.vendorName;
                    return (
                      <div
                        key={vendor.vendorName}
                        onClick={() => setSelectedVendor(vendor)}
                        style={{
                          padding: '0.875rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          background: isSelected ? '#f3e8ff' : 'white',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = '#fafbfc';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'white';
                        }}
                      >
                        <div style={{
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          color: '#1e293b',
                          marginBottom: '0.25rem',
                        }}>
                          {vendor.vendorName}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                        }}>
                          {formatCurrency(vendor.totalSpend)} · {formatNumber(vendor.componentCount)} components
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{
                padding: '1rem',
                background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}>
                Components ({formatNumber(componentComparisons.length)})
                <div style={{
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  opacity: 0.9,
                  marginTop: '0.25rem',
                }}>
                  📊 {getDateRangeLabel(dateRange)}
                </div>
              </div>
              <div style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
                {componentComparisons.map(comp => (
                  <div
                    key={comp.categoryId}
                    style={{
                      padding: '0.875rem 1rem',
                      borderBottom: '1px solid #f1f5f9',
                      background: 'white',
                    }}
                  >
                    <div style={{
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#1e293b',
                      marginBottom: '0.25rem',
                    }}>
                      {comp.categoryName}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                    }}>
                      {formatNumber(comp.variants.length)} variant{comp.variants.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right Panel */}
        <div style={{ flex: 1 }}>
          {viewMode === 'vendor' && selectedVendor ? (
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem',
            }}>
              {/* Vendor Header */}
              <div style={{
                background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
                color: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
              }}>
                {isEditingVendor ? (
                  <div>
                    <input
                      type="text"
                      value={editVendorName}
                      onChange={(e) => setEditVendorName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        marginBottom: '0.5rem',
                        border: '1px solid white',
                        borderRadius: '4px',
                      }}
                    />
                    <textarea
                      value={editVendorNotes}
                      onChange={(e) => setEditVendorNotes(e.target.value)}
                      placeholder="Notes..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '0.875rem',
                        marginBottom: '0.75rem',
                        border: '1px solid white',
                        borderRadius: '4px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={handleSaveVendor}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'white',
                          color: '#4b006e',
                          border: 'none',
                          borderRadius: '4px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleArchiveVendor}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Archive
                      </button>
                      <button
                        onClick={() => setIsEditingVendor(false)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'transparent',
                          color: 'white',
                          border: '1px solid white',
                          borderRadius: '4px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                          {selectedVendor.vendorName}
                        </div>
                        {currentVendorRecord?.notes && (
                          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                            {currentVendorRecord.notes}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleEditVendor}
                        style={{
                          padding: '0.375rem 0.75rem',
                          background: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          border: '1px solid rgba(255,255,255,0.3)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    </div>

                    {/* Stats Grid */}
                    {hasActiveFilters && selectedVendorYTD && selectedVendorFiltered ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1rem',
                      }}>
                        {/* YTD Column */}
                        <div>
                          <div style={{ fontSize: '0.6875rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                            Year to Date
                          </div>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Total Spend</div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                              {formatCurrency(selectedVendorYTD.totalSpend)}
                            </div>
                          </div>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Invoices</div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                              {formatNumber(selectedVendorYTD.invoiceCount)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Components</div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                              {formatNumber(selectedVendorYTD.componentCount)}
                            </div>
                          </div>
                        </div>

                        {/* Filtered Column */}
                        <div>
                          <div style={{ fontSize: '0.6875rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                            {getDateRangeLabel(dateRange)}
                          </div>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Total Spend</div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                              {formatCurrency(selectedVendorFiltered.totalSpend)}
                            </div>
                          </div>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Invoices</div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                              {formatNumber(selectedVendorFiltered.invoiceCount)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Components</div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                              {formatNumber(selectedVendorFiltered.componentCount)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : selectedVendorYTD ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '1rem',
                      }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Total Spend</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                            {formatCurrency(selectedVendorYTD.totalSpend)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Invoices</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                            {formatNumber(selectedVendorYTD.invoiceCount)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Components</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                            {formatNumber(selectedVendorYTD.componentCount)}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Components */}
              <h5 style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#4b006e',
                marginBottom: '0.5rem',
              }}>
                Components from {selectedVendor.vendorName}
              </h5>
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b',
                marginBottom: '1rem',
                display: 'inline-block',
                padding: '0.25rem 0.5rem',
                background: '#dbeafe',
                borderRadius: '4px',
              }}>
                📊 Pricing: {getDateRangeLabel(dateRange)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {componentComparisons
                  .filter(comp => comp.variants.some(v => v.vendorPrices.some(vp => vp.vendor === selectedVendor.vendorName)))
                  .map(comp => {
                    const relevantVariants = comp.variants.filter(v =>
                      v.vendorPrices.some(vp => vp.vendor === selectedVendor.vendorName)
                    );

                    return relevantVariants.map(variant => {
                      const vendorPrice = variant.vendorPrices.find(vp => vp.vendor === selectedVendor.vendorName);
                      if (!vendorPrice) return null;

                      const isBest = vendorPrice.avgPrice === variant.bestPrice;
                      const compKey = `${comp.categoryId}-${variant.variant}`;
                      const isExpanded = expandedComponentInvoices === compKey;
                      const componentInvoices = isExpanded ? getComponentInvoices(comp.categoryId, variant.variant) : [];

                      return (
                        <div
                          key={compKey}
                          style={{
                            border: `1px solid ${isBest ? '#e9d5ff' : '#e5e7eb'}`,
                            borderRadius: '6px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              padding: '1rem',
                              background: isBest ? '#f3e8ff' : '#fafbfc',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                                  {comp.categoryName}
                                  {variant.variant && <span style={{ color: '#64748b' }}> · {variant.variant}</span>}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                  {formatNumber(vendorPrice.purchaseCount)} purchase{vendorPrice.purchaseCount !== 1 ? 's' : ''}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div>
                                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#4b006e' }}>
                                    {formatCurrency(vendorPrice.avgPrice)}
                                  </div>
                                  {isBest && (
                                    <div style={{
                                      fontSize: '0.6875rem',
                                      fontWeight: 600,
                                      color: '#6b21a8',
                                      background: '#f3e8ff',
                                      padding: '0.125rem 0.5rem',
                                      borderRadius: '3px',
                                      display: 'inline-block',
                                      marginTop: '0.25rem',
                                    }}>
                                      Best Price
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => setExpandedComponentInvoices(isExpanded ? null : compKey)}
                                  style={{
                                    background: 'rgba(75, 0, 110, 0.1)',
                                    border: '1px solid #e9d5ff',
                                    borderRadius: '4px',
                                    padding: '0.25rem 0.5rem',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: '#4b006e',
                                  }}
                                >
                                  {isExpanded ? '▲' : '▼'} Invoices
                                </button>
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ padding: '1rem', background: 'white', borderTop: '1px solid #e5e7eb' }}>
                              <div style={{
                                fontSize: '0.75rem',
                                color: '#64748b',
                                marginBottom: '0.75rem',
                                display: 'inline-block',
                                padding: '0.25rem 0.5rem',
                                background: '#fef3c7',
                                borderRadius: '4px',
                              }}>
                                🕐 All-Time Invoices ({formatNumber(componentInvoices.length)})
                              </div>
                              {componentInvoices.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {componentInvoices.map(inv => {
                                    const attr = Object.values(inv.cost_attribution || {}).find(
                                      a => a.category_id === comp.categoryId && (a.variant || '') === variant.variant
                                    );
                                    if (!attr) return null;

                                    const unitPrice = parseFloat(attr.unit_price);
                                    const unitsPurchased = parseFloat(attr.units_purchased);
                                    const total = unitPrice * unitsPurchased;

                                    return (
                                      <div
                                        key={inv.id}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          padding: '0.5rem',
                                          background: '#fafbfc',
                                          borderRadius: '4px',
                                          fontSize: '0.8125rem',
                                        }}
                                      >
                                        <div>
                                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                            {inv.invoice_number || 'Unnamed'}
                                          </div>
                                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            {new Date(inv.invoice_date).toLocaleDateString()}
                                          </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <div style={{ fontWeight: 600, color: '#4b006e' }}>
                                            {formatCurrency(unitPrice)}/unit
                                          </div>
                                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            {formatNumber(unitsPurchased)} units = {formatCurrency(total)}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.875rem' }}>
                                  No invoices found for this component
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })}
              </div>
            </div>
          ) : viewMode === 'component' ? (
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem',
            }}>
              <h5 style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#4b006e',
                marginBottom: '0.5rem',
              }}>
                Component Price Comparison
              </h5>
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b',
                marginBottom: '1rem',
                display: 'inline-block',
                padding: '0.25rem 0.5rem',
                background: '#dbeafe',
                borderRadius: '4px',
              }}>
                📊 Pricing: {getDateRangeLabel(dateRange)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {componentComparisons.map(comp => {
                  return comp.variants.map(variant => {
                    const bestVendorPrice = variant.vendorPrices.find(vp => vp.avgPrice === variant.bestPrice);
                    const compKey = `${comp.categoryId}-${variant.variant}`;
                    const isExpanded = expandedComponentInvoices === compKey;
                    const componentInvoices = isExpanded ? getComponentInvoices(comp.categoryId, variant.variant) : [];

                    return (
                      <div
                        key={compKey}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            padding: '1rem',
                            background: '#f3e8ff',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                                {comp.categoryName}
                                {variant.variant && <span style={{ color: '#64748b' }}> · {variant.variant}</span>}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                {formatNumber(variant.vendorPrices.length)} vendor{variant.vendorPrices.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#4b006e' }}>
                                  {formatCurrency(variant.bestPrice)}
                                </div>
                                {bestVendorPrice && (
                                  <div style={{
                                    fontSize: '0.6875rem',
                                    fontWeight: 600,
                                    color: '#6b21a8',
                                    marginTop: '0.25rem',
                                  }}>
                                    {bestVendorPrice.vendor}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => setExpandedComponentInvoices(isExpanded ? null : compKey)}
                                style={{
                                  background: 'rgba(75, 0, 110, 0.1)',
                                  border: '1px solid #e9d5ff',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: '#4b006e',
                                }}
                              >
                                {isExpanded ? '▲' : '▼'} Invoices
                              </button>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ padding: '1rem', background: 'white', borderTop: '1px solid #e5e7eb' }}>
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#64748b',
                              marginBottom: '0.75rem',
                              display: 'inline-block',
                              padding: '0.25rem 0.5rem',
                              background: '#fef3c7',
                              borderRadius: '4px',
                            }}>
                              🕐 All-Time Invoices ({formatNumber(componentInvoices.length)})
                            </div>
                            {componentInvoices.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {componentInvoices.map(inv => {
                                  const attr = Object.values(inv.cost_attribution || {}).find(
                                    a => a.category_id === comp.categoryId && (a.variant || '') === variant.variant
                                  );
                                  if (!attr) return null;

                                  const unitPrice = parseFloat(attr.unit_price);
                                  const unitsPurchased = parseFloat(attr.units_purchased);
                                  const total = unitPrice * unitsPurchased;

                                  return (
                                    <div
                                      key={inv.id}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '0.5rem',
                                        background: '#fafbfc',
                                        borderRadius: '4px',
                                        fontSize: '0.8125rem',
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                          {inv.vendor_name || 'Unknown'} - {inv.invoice_number || 'Unnamed'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                          {new Date(inv.invoice_date).toLocaleDateString()}
                                        </div>
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 600, color: '#4b006e' }}>
                                          {formatCurrency(unitPrice)}/unit
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                          {formatNumber(unitsPurchased)} units = {formatCurrency(total)}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.875rem' }}>
                                No invoices found for this component
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          ) : (
            <div style={{
              background: '#fafbfc',
              border: '2px dashed #e5e7eb',
              borderRadius: '8px',
              padding: '3rem',
              textAlign: 'center',
              color: '#64748b',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👈</div>
              <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                Select a vendor to view details
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Archived Vendors List Component
function ArchivedVendorsList({
  companyId,
  onRestore,
}: {
  companyId: string;
  onRestore: (vendorId: string) => void;
}) {
  const [archivedVendors, setArchivedVendors] = useState<CPGVendor[]>([]);

  useEffect(() => {
    const loadArchived = async () => {
      try {
        const vendors = await db.cpgVendors
          .where('company_id')
          .equals(companyId)
          .filter(v => v.deleted_at !== null)
          .toArray();
        setArchivedVendors(vendors);
      } catch (error) {
        console.error('Failed to load archived vendors:', error);
      }
    };

    loadArchived();
  }, [companyId]);

  if (archivedVendors.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
        No archived vendors
      </div>
    );
  }

  return (
    <>
      {archivedVendors.map(vendor => (
        <div
          key={vendor.id}
          style={{
            padding: '0.875rem 1rem',
            borderBottom: '1px solid #f1f5f9',
            background: 'white',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#64748b' }}>
                {vendor.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Archived {new Date(vendor.deleted_at!).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={() => onRestore(vendor.id)}
              style={{
                padding: '0.25rem 0.5rem',
                background: '#4b006e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Restore
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
