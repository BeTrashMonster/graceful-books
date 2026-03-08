/**
 * Vendor Intel Sub-Tab Component
 *
 * Master-detail vendor intelligence with visual card-based design.
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
  biggestCost: number;
  biggestCostComponent: string;
  avgPrice: number;
}

interface ComponentRow {
  categoryId: string;
  categoryName: string;
  variant: string;
  lastPricePaid: number;
  bestPrice: number;
  bestVendor: string;
  percentageVsBest: number;
  isBest: boolean;
}

const formatCurrency = (value: number): string => {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumber = (value: number): string => {
  return value.toLocaleString('en-US');
};

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
  const [viewMode, setViewMode] = useState<'component' | 'vendor'>('vendor');
  const [selectedVendor, setSelectedVendor] = useState<VendorOverview | null>(null);
  const [currentVendorRecord, setCurrentVendorRecord] = useState<CPGVendor | null>(null);
  const [isEditingVendor, setIsEditingVendor] = useState(false);
  const [editVendorName, setEditVendorName] = useState('');
  const [editVendorNotes, setEditVendorNotes] = useState('');
  const [showArchivedVendors, setShowArchivedVendors] = useState(false);
  const [localInvoices, setLocalInvoices] = useState<CPGInvoice[]>(invoices);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [vendorOverviews, setVendorOverviews] = useState<VendorOverview[]>([]);

  // Vendor detail data
  const [selectedVendorStats, setSelectedVendorStats] = useState<VendorStats | null>(null);
  const [vendorComponents, setVendorComponents] = useState<ComponentRow[]>([]);
  const [vendorInvoices, setVendorInvoices] = useState<CPGInvoice[]>([]);

  const [vendorSortColumn, setVendorSortColumn] = useState<'spend'>('spend');
  const [vendorSortDirection, setVendorSortDirection] = useState<'desc'>('desc');
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [invoiceDropdownDateRange, setInvoiceDropdownDateRange] = useState<Map<string, VendorIntelTabProps['dateRange']>>(new Map());
  const [categoryMap, setCategoryMap] = useState<Map<string, CPGCategory>>(new Map());

  // Component table sorting
  const [componentSortColumn, setComponentSortColumn] = useState<'component' | 'lastPrice' | 'bestPrice' | 'change'>('component');
  const [componentSortDirection, setComponentSortDirection] = useState<'asc' | 'desc'>('asc');

  // Invoice table sorting
  const [invoiceSortColumn, setInvoiceSortColumn] = useState<'invoice' | 'date' | 'total' | 'components'>('date');
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<'asc' | 'desc'>('desc');

  // Aggregate stats across ALL vendors
  const aggregateStats = useMemo(() => {
    const totalSpend = vendorOverviews.reduce((sum, v) => sum + v.totalSpend, 0);
    const totalInvoices = vendorOverviews.reduce((sum, v) => sum + v.invoiceCount, 0);
    const totalComponents = vendorOverviews.reduce((sum, v) => sum + v.componentCount, 0);

    // Calculate biggest single component cost and average price across all vendors
    const allPrices: number[] = [];
    let biggestCost = 0;
    let biggestCostComponent = '';

    localInvoices.forEach(inv => {
      const attrs = inv.cost_attribution || {};
      Object.values(attrs).forEach(attr => {
        const unitPrice = parseFloat(attr.unit_price);
        const units = parseFloat(attr.units_purchased);
        if (!isNaN(unitPrice) && !isNaN(units)) {
          const cost = unitPrice * units;
          allPrices.push(cost);
          if (cost > biggestCost) {
            biggestCost = cost;
            // Find category name from map
            const category = categoryMap.get(attr.category_id);
            const categoryName = category?.name || 'Unknown Component';
            const variant = attr.variant ? ` (${attr.variant})` : '';
            biggestCostComponent = `${categoryName}${variant}`;
          }
        }
      });
    });

    const avgPrice = allPrices.length > 0
      ? allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length
      : 0;

    return {
      totalSpend,
      totalInvoices,
      totalComponents,
      biggestCost,
      biggestCostComponent,
      avgPrice,
    };
  }, [vendorOverviews, localInvoices, categoryMap]);

  useEffect(() => {
    setLocalInvoices(invoices);
  }, [invoices]);

  // Load all categories for lookups
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const allCategories = await db.cpgCategories
          .where('company_id')
          .equals(companyId)
          .filter(cat => !cat.deleted_at)
          .toArray();

        const map = new Map<string, CPGCategory>();
        allCategories.forEach(cat => map.set(cat.id, cat));
        setCategoryMap(map);
      } catch (err) {
        console.error('Failed to load categories for lookup:', err);
      }
    };
    loadCategories();
  }, [companyId]);

  useEffect(() => {
    if (!selectedVendor) {
      setCurrentVendorRecord(null);
      setSelectedVendorStats(null);
      setVendorComponents([]);
      setVendorInvoices([]);
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

        calculateVendorDetails();
      } catch (error) {
        console.error('Failed to load/create vendor:', error);
      }
    };

    loadVendor();
  }, [selectedVendor, companyId, localInvoices, selectedProducts, productCPUData, categoryFilter, variantFilter, dateRange, customDateRange]);

  const calculateVendorDetails = () => {
    if (!selectedVendor) return;

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

    // Filter invoices
    const filteredInvoices = localInvoices.filter(inv => {
      if (inv.deleted_at) return false;
      if (inv.vendor_name !== selectedVendor.vendorName) return false;
      if (startDate > 0 && inv.invoice_date < startDate) return false;
      if (endDate > 0 && inv.invoice_date > endDate) return false;
      return true;
    });

    // Calculate stats
    let totalSpend = 0;
    let biggestCost = 0;
    let biggestCostComponent = '';
    const allPrices: number[] = [];
    const componentSet = new Set<string>();

    filteredInvoices.forEach(inv => {
      Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
        const variants = componentCategories.get(attr.category_id);
        if (variants && (variants.size === 0 || variants.has(attr.variant || ''))) {
          const unitPrice = parseFloat(attr.unit_price);
          const unitsPurchased = parseFloat(attr.units_purchased);
          if (!isNaN(unitPrice) && !isNaN(unitsPurchased)) {
            const itemTotal = unitPrice * unitsPurchased;
            totalSpend += itemTotal;
            if (itemTotal > biggestCost) {
              biggestCost = itemTotal;
              // Find category name from map
              const category = categoryMap.get(attr.category_id);
              const categoryName = category?.name || 'Unknown Component';
              const variant = attr.variant ? ` (${attr.variant})` : '';
              biggestCostComponent = `${categoryName}${variant}`;
            }
            allPrices.push(unitPrice);
            componentSet.add(`${attr.category_id}:${attr.variant || ''}`);
          }
        }
      });
    });

    const avgPrice = allPrices.length > 0 ? allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length : 0;

    setSelectedVendorStats({
      totalSpend,
      invoiceCount: filteredInvoices.length,
      componentCount: componentSet.size,
      biggestCost,
      biggestCostComponent,
      avgPrice,
    });

    // Build component rows
    const compRows: ComponentRow[] = [];

    // Track data by component
    const componentData = new Map<string, {
      avgPrices: number[];
      lastPriceDate: number;
      lastPrice: number;
    }>();

    const marketData = new Map<string, Map<string, number[]>>(); // compKey -> vendorName -> prices

    // Collect data for this vendor (filtered by date range)
    filteredInvoices.forEach(inv => {
      Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
        const variants = componentCategories.get(attr.category_id);
        if (variants && (variants.size === 0 || variants.has(attr.variant || ''))) {
          const compKey = `${attr.category_id}:${attr.variant || ''}`;
          const unitPrice = parseFloat(attr.unit_price);

          if (!isNaN(unitPrice) && unitPrice > 0) {
            // Track average prices
            if (!componentData.has(compKey)) {
              componentData.set(compKey, {
                avgPrices: [],
                lastPriceDate: 0,
                lastPrice: 0,
              });
            }
            const data = componentData.get(compKey)!;
            data.avgPrices.push(unitPrice);

            // Track most recent price
            if (inv.invoice_date > data.lastPriceDate) {
              data.lastPriceDate = inv.invoice_date;
              data.lastPrice = unitPrice;
            }
          }
        }
      });
    });

    // Collect market data across ALL vendors (filtered by date range)
    localInvoices.forEach(inv => {
      if (inv.deleted_at) return;
      if (startDate > 0 && inv.invoice_date < startDate) return;
      if (endDate > 0 && inv.invoice_date > endDate) return;

      Object.entries(inv.cost_attribution || {}).forEach(([key, attr]) => {
        const variants = componentCategories.get(attr.category_id);
        if (variants && (variants.size === 0 || variants.has(attr.variant || ''))) {
          const compKey = `${attr.category_id}:${attr.variant || ''}`;
          const unitPrice = parseFloat(attr.unit_price);

          if (!isNaN(unitPrice) && unitPrice > 0) {
            if (!marketData.has(compKey)) {
              marketData.set(compKey, new Map());
            }
            const vendors = marketData.get(compKey)!;
            if (!vendors.has(inv.vendor_name || 'Unknown')) {
              vendors.set(inv.vendor_name || 'Unknown', []);
            }
            vendors.get(inv.vendor_name || 'Unknown')!.push(unitPrice);
          }
        }
      });
    });

    // Build component rows
    for (const [compKey, data] of componentData.entries()) {
      if (data.avgPrices.length === 0) continue;

      const [categoryId, variant] = compKey.split(':');
      const category = categories.find(c => c.id === categoryId);

      const avgPrice = data.avgPrices.reduce((sum, p) => sum + p, 0) / data.avgPrices.length;
      const lastPricePaid = data.lastPrice;

      // Find best market price and vendor
      let bestPrice = Infinity;
      let bestVendor = '';
      const vendors = marketData.get(compKey);

      if (vendors) {
        for (const [vendorName, prices] of vendors.entries()) {
          const vendorAvg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
          if (vendorAvg < bestPrice) {
            bestPrice = vendorAvg;
            bestVendor = vendorName;
          }
        }
      }

      // If no market data, use our own price
      if (bestPrice === Infinity) {
        bestPrice = avgPrice;
        bestVendor = selectedVendor.vendorName;
      }

      const isBest = lastPricePaid === bestPrice;
      const percentageVsBest = ((lastPricePaid - bestPrice) / bestPrice) * 100;

      compRows.push({
        categoryId,
        categoryName: category?.name || 'Unknown',
        variant,
        lastPricePaid,
        bestPrice,
        bestVendor,
        percentageVsBest,
        isBest,
      });
    }

    setVendorComponents(compRows.sort((a, b) => a.categoryName.localeCompare(b.categoryName)));

    // Get all-time invoices for this vendor
    const allVendorInvoices = localInvoices.filter(inv => {
      if (inv.deleted_at) return false;
      if (inv.vendor_name !== selectedVendor.vendorName) return false;
      return true;
    }).sort((a, b) => b.invoice_date - a.invoice_date);

    setVendorInvoices(allVendorInvoices);
  };

  useEffect(() => {
    loadVendorIntelligence();
  }, [selectedProducts, productCPUData, localInvoices, dateRange, customDateRange, categoryFilter, variantFilter, vendorFilter, showArchivedVendors]);

  // Sorted component rows
  const sortedVendorComponents = useMemo(() => {
    const sorted = [...vendorComponents];
    sorted.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (componentSortColumn) {
        case 'component':
          aVal = `${a.categoryName} ${a.variant || ''}`.toLowerCase();
          bVal = `${b.categoryName} ${b.variant || ''}`.toLowerCase();
          break;
        case 'lastPrice':
          aVal = a.lastPricePaid;
          bVal = b.lastPricePaid;
          break;
        case 'bestPrice':
          aVal = a.bestPrice;
          bVal = b.bestPrice;
          break;
        case 'change':
          aVal = a.percentageVsBest;
          bVal = b.percentageVsBest;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return componentSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return componentSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
    return sorted;
  }, [vendorComponents, componentSortColumn, componentSortDirection]);

  // Sorted invoice rows
  const sortedVendorInvoices = useMemo(() => {
    const sorted = [...vendorInvoices];
    sorted.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (invoiceSortColumn) {
        case 'invoice':
          aVal = (a.invoice_number || '').toLowerCase();
          bVal = (b.invoice_number || '').toLowerCase();
          break;
        case 'date':
          aVal = a.invoice_date;
          bVal = b.invoice_date;
          break;
        case 'total':
          aVal = Object.values(a.cost_attribution || {}).reduce((sum, attr) => {
            const unitPrice = parseFloat(attr.unit_price);
            const units = parseFloat(attr.units_purchased);
            return sum + (isNaN(unitPrice) || isNaN(units) ? 0 : unitPrice * units);
          }, 0);
          bVal = Object.values(b.cost_attribution || {}).reduce((sum, attr) => {
            const unitPrice = parseFloat(attr.unit_price);
            const units = parseFloat(attr.units_purchased);
            return sum + (isNaN(unitPrice) || isNaN(units) ? 0 : unitPrice * units);
          }, 0);
          break;
        case 'components':
          aVal = Object.keys(a.cost_attribution || {}).length;
          bVal = Object.keys(b.cost_attribution || {}).length;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return invoiceSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return invoiceSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
    return sorted;
  }, [vendorInvoices, invoiceSortColumn, invoiceSortDirection]);

  const loadVendorIntelligence = () => {
    if (selectedProducts.size === 0) {
      setVendorOverviews([]);
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
    } catch (err) {
      console.error('Failed to load vendor intelligence:', err);
    }
  };

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

  const handleArchiveVendor = async () => {
    if (!currentVendorRecord) return;
    if (!confirm(`Archive vendor "${currentVendorRecord.name}"?`)) return;

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

  const handleEditVendor = () => {
    if (currentVendorRecord) {
      setEditVendorName(currentVendorRecord.name);
      setEditVendorNotes(currentVendorRecord.notes || '');
      setIsEditingVendor(true);
    }
  };

  const sortedVendors = useMemo(() => {
    return [...vendorOverviews].sort((a, b) => b.totalSpend - a.totalSpend);
  }, [vendorOverviews]);

  const handleExportVendorOverviewCSV = (currentOnly: boolean) => {
    const vendors = currentOnly && selectedVendor ? [selectedVendor] : sortedVendors;
    const rows: string[] = ['Vendor,Total Spend,Invoices,Components'];
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

  if (sortedVendors.length === 0) {
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
                <button onClick={() => handleExportVendorOverviewCSV(false)} className={styles.exportMenuItem}>
                  All Vendors (CSV)
                </button>
                {selectedVendor && (
                  <button onClick={() => handleExportVendorOverviewCSV(true)} className={styles.exportMenuItem}>
                    Current Vendor (CSV)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Row: Summary Card + Vendor Header */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Left: Aggregate Summary Card */}
        <div style={{
          width: '280px',
          flexShrink: 0,
          background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          fontFamily: 'Roboto, sans-serif',
        }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.9, letterSpacing: '0.5px' }}>
            TOTAL SPEND
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
            {formatCurrency(aggregateStats.totalSpend)}
          </div>
          <div style={{
            borderBottom: '1px solid rgba(255,255,255,0.3)',
            marginBottom: '0.25rem'
          }} />
          <div style={{
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            opacity: 0.95,
            fontWeight: 500,
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
          }}>
            <div>
              <div style={{ fontSize: '0.6875rem', opacity: 0.85, fontWeight: 600, letterSpacing: '0.3px', marginBottom: '0.25rem' }}>BIGGEST COST</div>
              <div style={{ fontWeight: 700, fontFamily: '"Trebuchet MS", sans-serif' }}>{formatCurrency(aggregateStats.biggestCost)}</div>
              {aggregateStats.biggestCostComponent && (
                <div style={{ fontSize: '0.6875rem', opacity: 0.85, marginTop: '0.125rem' }}>{aggregateStats.biggestCostComponent}</div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.6875rem', opacity: 0.85, fontWeight: 600, letterSpacing: '0.3px', marginBottom: '0.25rem' }}>AVG INVOICE</div>
              <div style={{ fontWeight: 700, fontFamily: '"Trebuchet MS", sans-serif' }}>{formatCurrency(aggregateStats.avgPrice)}</div>
            </div>
          </div>
        </div>

        {/* Right: Vendor Header Bar (if vendor selected) */}
        {selectedVendor && selectedVendorStats && (
          <div style={{
            flex: 1,
            background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            {isEditingVendor ? (
              <>
                <div style={{ flex: 1, marginRight: '1rem' }}>
                  <input
                    type="text"
                    value={editVendorName}
                    onChange={(e) => setEditVendorName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      fontSize: '1.5rem',
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
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      fontSize: '0.875rem',
                      border: '1px solid white',
                      borderRadius: '4px',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                  <button onClick={handleSaveVendor} style={{
                    padding: '0.5rem 1rem',
                    background: 'white',
                    color: '#4b006e',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}>Save</button>
                  <button onClick={handleArchiveVendor} style={{
                    padding: '0.5rem 1rem',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}>Archive</button>
                  <button onClick={() => setIsEditingVendor(false)} style={{
                    padding: '0.5rem 1rem',
                    background: 'transparent',
                    color: 'white',
                    border: '1px solid white',
                    borderRadius: '4px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>
                      {selectedVendor.vendorName}
                    </div>
                    {currentVendorRecord?.notes && (
                      <div style={{ fontSize: '0.875rem', opacity: 0.9, fontWeight: 400, marginTop: '0.5rem' }}>
                        {currentVendorRecord.notes}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleEditVendor}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.5)',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✏️ Edit Vendor
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', opacity: 0.8, marginBottom: '0.25rem' }}>
                      TOTAL SPEND
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>
                      {formatCurrency(selectedVendorStats.totalSpend)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', opacity: 0.8, marginBottom: '0.25rem' }}>
                      INVOICES
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>
                      {formatNumber(selectedVendorStats.invoiceCount)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', opacity: 0.8, marginBottom: '0.25rem' }}>
                      COMPONENTS
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>
                      {formatNumber(selectedVendorStats.componentCount)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Row: Vendor List + Content */}
      <div style={{ display: 'flex', gap: '1.5rem', minHeight: '500px' }}>
        {/* Left Panel: Vendor List */}
        <div style={{
          width: '280px',
          flexShrink: 0,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
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
            <span style={{ letterSpacing: '0.5px' }}>VENDORS ({formatNumber(sortedVendors.length)})</span>
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
          <div style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto', padding: '0.75rem' }}>
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
                      padding: '1rem',
                      cursor: 'pointer',
                      background: isSelected ? '#f3e8ff' : 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      marginBottom: '0.75rem',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#fafbfc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'white';
                      }
                    }}
                  >
                    <div style={{
                      fontWeight: 600,
                      fontSize: '0.9375rem',
                      color: '#1e293b',
                      marginBottom: '0.375rem',
                    }}>
                      {vendor.vendorName}
                    </div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: '#64748b',
                    }}>
                      {formatNumber(vendor.invoiceCount)} {vendor.invoiceCount === 1 ? 'invoice' : 'invoices'} · {formatNumber(vendor.componentCount)} {vendor.componentCount === 1 ? 'component' : 'components'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ flex: 1 }}>
          {selectedVendor && selectedVendorStats ? (
            <div>
              {/* Components from this Vendor */}
              <div style={{ marginBottom: '2rem' }}>
                <h5 style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  marginBottom: '0.5rem',
                }}>
                  Components from this Vendor
                </h5>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  marginBottom: '1rem',
                  display: 'inline-block',
                  padding: '0.375rem 0.75rem',
                  background: '#dbeafe',
                  borderRadius: '6px',
                  fontWeight: 500,
                }}>
                  📊 {getDateRangeLabel(dateRange)} · Pricing data based on selected date range
                </div>

                {vendorComponents.length > 0 ? (
                  <div className={styles.tableContainer}>
                    <table className={styles.comparisonTable}>
                      <thead>
                        <tr>
                          <th
                            onClick={() => {
                              if (componentSortColumn === 'component') {
                                setComponentSortDirection(componentSortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setComponentSortColumn('component');
                                setComponentSortDirection('asc');
                              }
                            }}
                          >
                            COMPONENT {componentSortColumn === 'component' ? (componentSortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th
                            className={styles.alignRight}
                            onClick={() => {
                              if (componentSortColumn === 'lastPrice') {
                                setComponentSortDirection(componentSortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setComponentSortColumn('lastPrice');
                                setComponentSortDirection('desc');
                              }
                            }}
                          >
                            LAST PRICE PAID {componentSortColumn === 'lastPrice' ? (componentSortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th
                            className={styles.alignRight}
                            onClick={() => {
                              if (componentSortColumn === 'bestPrice') {
                                setComponentSortDirection(componentSortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setComponentSortColumn('bestPrice');
                                setComponentSortDirection('desc');
                              }
                            }}
                          >
                            BEST VENDOR AVG {componentSortColumn === 'bestPrice' ? (componentSortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th
                            className={styles.alignRight}
                            onClick={() => {
                              if (componentSortColumn === 'change') {
                                setComponentSortDirection(componentSortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setComponentSortColumn('change');
                                setComponentSortDirection('asc');
                              }
                            }}
                          >
                            % CHANGE {componentSortColumn === 'change' ? (componentSortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th style={{ width: '100px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedVendorComponents.map((comp, idx) => {
                          const componentKey = `${comp.categoryId}-${comp.variant}`;
                          const isExpanded = expandedComponents.has(componentKey);

                          // Filter invoices for this specific component
                          const componentInvoices = vendorInvoices.filter(inv => {
                            const attrs = inv.cost_attribution || {};
                            return Object.keys(attrs).some(key => {
                              const attr = attrs[key];
                              return attr.category_id === comp.categoryId &&
                                     (attr.variant || '') === (comp.variant || '');
                            });
                          });

                          const toggleExpanded = () => {
                            setExpandedComponents(prev => {
                              const next = new Set(prev);
                              if (isExpanded) {
                                next.delete(componentKey);
                              } else {
                                next.add(componentKey);
                              }
                              return next;
                            });
                          };

                          return (
                            <React.Fragment key={componentKey}>
                              <tr>
                                <td>
                                  <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{comp.categoryName}</div>
                                  {comp.variant && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem' }}>{comp.variant}</div>}
                                </td>
                                <td className={styles.alignRight} style={{ fontWeight: 600 }}>
                                  {formatCurrency(comp.lastPricePaid)}
                                </td>
                                <td className={styles.alignRight}>
                                  <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{formatCurrency(comp.bestPrice)}</div>
                                  {comp.bestVendor !== selectedVendor.vendorName ? (
                                    <div
                                      onClick={() => {
                                        const vendor = sortedVendors.find(v => v.vendorName === comp.bestVendor);
                                        if (vendor) setSelectedVendor(vendor);
                                      }}
                                      style={{
                                        fontSize: '0.75rem',
                                        color: '#4b006e',
                                        marginTop: '0.125rem',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                      }}
                                    >
                                      → {comp.bestVendor}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem' }}>
                                      {comp.bestVendor}
                                    </div>
                                  )}
                                </td>
                                <td className={styles.alignRight}>
                                  {comp.isBest ? (
                                    <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.875rem' }}>✓ Best</span>
                                  ) : (
                                    <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.875rem' }}>
                                      +{comp.percentageVsBest.toFixed(2)}%
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {componentInvoices.length > 0 && (
                                    <button
                                      onClick={toggleExpanded}
                                      style={{
                                        padding: '0.375rem 0.75rem',
                                        background: 'transparent',
                                        color: '#4b006e',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                      }}
                                    >
                                      {isExpanded ? '▼' : '▶'} Invoices
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {isExpanded && componentInvoices.length > 0 && (() => {
                                // Get current dropdown date range or default to main filter
                                const dropdownDateRange = invoiceDropdownDateRange.get(componentKey) || dateRange;

                                // Filter invoices by dropdown date range
                                const today = Date.now();
                                let startDate = 0;
                                let endDate = today;

                                switch (dropdownDateRange) {
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
                                  case 'all':
                                    startDate = 0;
                                    break;
                                }

                                const filteredComponentInvoices = componentInvoices.filter(inv => {
                                  if (startDate > 0 && inv.invoice_date < startDate) return false;
                                  if (endDate > 0 && inv.invoice_date > endDate) return false;
                                  return true;
                                });

                                // Calculate totals and find lowest price
                                let totalUnitPrices = 0;
                                let totalUnits = 0;
                                let grandTotal = 0;
                                let lowestUnitPrice = Infinity;
                                const invoiceData: Array<{ inv: CPGInvoice; unitPrice: number; units: number; total: number }> = [];

                                filteredComponentInvoices.forEach(inv => {
                                  const attrs = inv.cost_attribution || {};
                                  const attr = Object.values(attrs).find(a =>
                                    a.category_id === comp.categoryId &&
                                    (a.variant || '') === (comp.variant || '')
                                  );
                                  if (!attr) return;

                                  const unitPrice = parseFloat(attr.unit_price);
                                  const units = parseFloat(attr.units_purchased);
                                  const total = unitPrice * units;

                                  if (!isNaN(unitPrice) && !isNaN(units)) {
                                    totalUnitPrices += unitPrice;
                                    totalUnits += units;
                                    grandTotal += total;
                                    if (unitPrice < lowestUnitPrice) lowestUnitPrice = unitPrice;
                                    invoiceData.push({ inv, unitPrice, units, total });
                                  }
                                });

                                const averageForVendor = invoiceData.length > 0 ? totalUnitPrices / invoiceData.length : 0;

                                return (
                                  <tr>
                                    <td colSpan={5} style={{ padding: '0.5rem 1.5rem 1rem', background: '#f8fafc' }}>
                                      {/* Date Range Selector */}
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                                        <select
                                          value={dropdownDateRange}
                                          onChange={(e) => {
                                            const newRange = e.target.value as VendorIntelTabProps['dateRange'];
                                            setInvoiceDropdownDateRange(prev => {
                                              const next = new Map(prev);
                                              next.set(componentKey, newRange);
                                              return next;
                                            });
                                          }}
                                          style={{
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.75rem',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '4px',
                                            background: 'white',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <option value="3mo">Last 3 Months</option>
                                          <option value="6mo">Last 6 Months</option>
                                          <option value="12mo">Last 12 Months</option>
                                          <option value="last-calendar-year">Last Calendar Year</option>
                                          <option value="this-calendar-year">This Calendar Year</option>
                                          <option value="all">All Time</option>
                                        </select>
                                      </div>

                                      <table style={{ width: '100%', fontSize: '0.8125rem' }}>
                                        <thead>
                                          <tr style={{ borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #4b006e 0%, #5e0089 100%)' }}>
                                            <th style={{ textAlign: 'left', padding: '0.375rem 0.5rem', fontWeight: 600, color: 'white', fontSize: '0.6875rem' }}>INVOICE #</th>
                                            <th style={{ textAlign: 'left', padding: '0.375rem 0.5rem', fontWeight: 600, color: 'white', fontSize: '0.6875rem' }}>DATE</th>
                                            <th style={{ textAlign: 'right', padding: '0.375rem 0.5rem', fontWeight: 600, color: 'white', fontSize: '0.6875rem' }}>UNIT PRICE</th>
                                            <th style={{ textAlign: 'right', padding: '0.375rem 0.5rem', fontWeight: 600, color: 'white', fontSize: '0.6875rem' }}>UNITS</th>
                                            <th style={{ textAlign: 'right', padding: '0.375rem 0.5rem', fontWeight: 600, color: 'white', fontSize: '0.6875rem' }}>TOTAL</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {invoiceData.map(({ inv, unitPrice, units, total }) => {
                                            const isLowest = unitPrice === lowestUnitPrice;
                                            return (
                                              <tr
                                                key={inv.id}
                                                style={{
                                                  borderBottom: '1px solid #f1f5f9',
                                                  background: isLowest ? '#ccedd8' : 'transparent',
                                                }}
                                              >
                                                <td style={{ padding: '0.5rem', fontWeight: 500 }}>{inv.invoice_number || 'Unnamed'}</td>
                                                <td style={{ padding: '0.5rem' }}>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(unitPrice)}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatNumber(units)}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: '#4b006e' }}>{formatCurrency(total)}</td>
                                              </tr>
                                            );
                                          })}
                                          {/* Totals Row */}
                                          <tr style={{ borderTop: '2px solid #4b006e', fontWeight: 600, background: 'white' }}>
                                            <td colSpan={2} style={{ padding: '0.5rem', textAlign: 'right' }}>TOTALS:</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(totalUnitPrices)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatNumber(totalUnits)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', color: '#4b006e' }}>{formatCurrency(grandTotal)}</td>
                                          </tr>
                                          {/* Average Row */}
                                          <tr style={{ fontWeight: 500 }}>
                                            <td colSpan={5} style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.8125rem' }}>
                                              <span style={{ background: '#f3e8ff', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#4b006e' }}>
                                                Average for this vendor: <strong>{formatCurrency(averageForVendor)}</strong>
                                              </span>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                );
                              })()}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#fafbfc', borderRadius: '8px' }}>
                    No components found
                  </div>
                )}
              </div>

              {/* Invoices from this Vendor */}
              <div>
                <h5 style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  marginBottom: '0.5rem',
                }}>
                  Invoices from this Vendor
                  <span style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    fontWeight: 400,
                    marginLeft: '0.5rem',
                  }}>
                    (All Time)
                  </span>
                </h5>

                {vendorInvoices.length > 0 ? (
                  <div className={styles.tableContainer}>
                    <table className={styles.comparisonTable}>
                      <thead>
                        <tr>
                          <th
                            onClick={() => {
                              if (invoiceSortColumn === 'invoice') {
                                setInvoiceSortDirection(invoiceSortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setInvoiceSortColumn('invoice');
                                setInvoiceSortDirection('asc');
                              }
                            }}
                          >
                            INVOICE # {invoiceSortColumn === 'invoice' ? (invoiceSortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th
                            onClick={() => {
                              if (invoiceSortColumn === 'date') {
                                setInvoiceSortDirection(invoiceSortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setInvoiceSortColumn('date');
                                setInvoiceSortDirection('desc');
                              }
                            }}
                          >
                            DATE {invoiceSortColumn === 'date' ? (invoiceSortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th
                            className={styles.alignRight}
                            onClick={() => {
                              if (invoiceSortColumn === 'total') {
                                setInvoiceSortDirection(invoiceSortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setInvoiceSortColumn('total');
                                setInvoiceSortDirection('desc');
                              }
                            }}
                          >
                            TOTAL {invoiceSortColumn === 'total' ? (invoiceSortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th
                            onClick={() => {
                              if (invoiceSortColumn === 'components') {
                                setInvoiceSortDirection(invoiceSortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setInvoiceSortColumn('components');
                                setInvoiceSortDirection('desc');
                              }
                            }}
                          >
                            COMPONENTS {invoiceSortColumn === 'components' ? (invoiceSortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th style={{ textAlign: 'center' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedVendorInvoices.map((inv) => {
                          const componentCount = Object.keys(inv.cost_attribution || {}).length;
                          const total = Object.values(inv.cost_attribution || {}).reduce((sum, attr) => {
                            const unitPrice = parseFloat(attr.unit_price);
                            const units = parseFloat(attr.units_purchased);
                            return sum + (isNaN(unitPrice) || isNaN(units) ? 0 : unitPrice * units);
                          }, 0);

                          return (
                            <tr key={inv.id}>
                              <td style={{ fontWeight: 600 }}>{inv.invoice_number || 'Unnamed'}</td>
                              <td>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                              <td className={styles.alignRight} style={{ fontWeight: 600, color: '#4b006e' }}>
                                {formatCurrency(total)}
                              </td>
                              <td>{formatNumber(componentCount)} component{componentCount !== 1 ? 's' : ''}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                  <button style={{
                                    padding: '0.375rem 0.75rem',
                                    background: 'white',
                                    color: '#4b006e',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                  }}>View</button>
                                  <button style={{
                                    padding: '0.375rem 0.75rem',
                                    background: 'white',
                                    color: '#4b006e',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                  }}>Edit</button>
                                  <button style={{
                                    padding: '0.375rem 0.75rem',
                                    background: 'white',
                                    color: '#4b006e',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                  }}>Duplicate</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#fafbfc', borderRadius: '8px' }}>
                    No invoices found
                  </div>
                )}
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
