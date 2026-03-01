/**
 * CPU Tracker Page
 *
 * Implements Group C1: CPU Tracker Page for CPG Module
 *
 * Features:
 * - Invoice entry form with line-by-line cost attribution
 * - Current CPU display for all variants
 * - Historical CPU timeline
 * - Category and variant management
 *
 * Requirements:
 * - CPG_MODULE_ROADMAP.md Group C1
 * - AGENT_REVIEW_PROD_CHECKLIST.md
 * - User-defined variants (not hardcoded Small/Large)
 * - Clean & seamless UX (not clunky or overwhelming)
 * - Progressive disclosure of advanced features
 * - Real-time CPU calculation updates
 * - WCAG 2.1 AA compliance
 */

import { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '../../components/core/Button';
import { AddInvoiceModal } from '../../components/cpg/modals/AddInvoiceModal';
import { CPUDisplay } from '../../components/cpg/CPUDisplay';
import { CPUTimeline } from '../../components/cpg/CPUTimeline';
import { CategoryManager } from '../../components/cpg/CategoryManager';
import { InvoiceDetailsModal } from '../../components/cpg/modals/InvoiceDetailsModal';
import { useAuth } from '../../contexts/AuthContext';
import { cpuCalculatorService } from '../../services/cpg/cpuCalculator.service';
import { db } from '../../db/database';
import type { CPGCategory, CPGInvoice } from '../../db/schema/cpg.schema';
import type { CPUHistoryEntry } from '../../services/cpg/cpuCalculator.service';
import styles from './CPUTracker.module.css';

type CPUTrackerTab = 'products' | 'raw-materials' | 'comparison';

export default function CPUTracker() {
  const { companyId } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<CPUTrackerTab>('products');

  // State
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [invoices, setInvoices] = useState<CPGInvoice[]>([]);
  const [cpuHistory, setCPUHistory] = useState<CPUHistoryEntry[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceFormMode, setInvoiceFormMode] = useState<'new' | 'edit' | 'duplicate'>('new');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Product filters for Tab 1
  const [productSearchFilter, setProductSearchFilter] = useState<string>('');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [productSortBy, setProductSortBy] = useState<'name' | 'cpu-asc' | 'cpu-desc' | 'missing'>('name');

  // Raw materials filters for Tab 2
  type DateRangePreset = '3mo' | '6mo' | '12mo' | 'last-calendar-year' | 'this-calendar-year' | 'custom' | 'all';
  const [rawMaterialsDatePreset, setRawMaterialsDatePreset] = useState<DateRangePreset>('3mo');
  const [rawMaterialsDateRange, setRawMaterialsDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
    end: new Date().toISOString().split('T')[0], // today
  });
  const [rawMaterialsCategoryFilter, setRawMaterialsCategoryFilter] = useState<string | undefined>(undefined);
  const [rawMaterialsVariantFilter, setRawMaterialsVariantFilter] = useState<string>('');
  const [rawMaterialsVendorFilter, setRawMaterialsVendorFilter] = useState<string>('');
  const [rawMaterialsSortBy, setRawMaterialsSortBy] = useState<'date-asc' | 'date-desc' | 'vendor' | 'total-asc' | 'total-desc'>('date-desc');
  const [showRawMaterialsExportMenu, setShowRawMaterialsExportMenu] = useState(false);

  // Cost Intelligence (Tab 3) - Product comparison with trends
  const [selectedProductsForComparison, setSelectedProductsForComparison] = useState<Set<string>>(new Set());
  const [comparisonSearchTerm, setComparisonSearchTerm] = useState<string>('');
  const [comparisonCategoryFilter, setComparisonCategoryFilter] = useState<string>('all');
  const [comparisonVariantFilter, setComparisonVariantFilter] = useState<string>('all');
  const [comparisonDateRange, setComparisonDateRange] = useState<'3mo' | '6mo' | '12mo' | 'all'>('6mo');
  const [productCPUData, setProductCPUData] = useState<Map<string, { cpu: string | null; margin: number | null; trend: 'up' | 'down' | 'stable'; trendValue: string | null; topDriver: string | null; isComplete: boolean; breakdown: any[] }>>(new Map());
  const [intelligenceTab, setIntelligenceTab] = useState<'scenario' | 'trends' | 'vendors' | 'alerts'>('scenario');
  const [scenarioAdjustments, setScenarioAdjustments] = useState<Map<string, Map<string, number>>>(new Map()); // productId -> componentId -> adjustment %
  const [scenarioMSRP, setScenarioMSRP] = useState<Map<string, number>>(new Map()); // productId -> new MSRP

  // Handle date preset changes for Raw Materials tab
  const handleRawMaterialsDatePresetChange = (preset: DateRangePreset) => {
    setRawMaterialsDatePreset(preset);
    const today = new Date();
    let start: Date;
    let end: Date = today;

    switch (preset) {
      case '3mo':
        start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6mo':
        start = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '12mo':
        start = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'last-calendar-year':
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31);
        break;
      case 'this-calendar-year':
        start = new Date(today.getFullYear(), 0, 1);
        end = today;
        break;
      case 'all':
        start = new Date('2000-01-01');
        end = today;
        break;
      case 'custom':
        return; // Don't update dates for custom
      default:
        start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    setRawMaterialsDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  // Smart year detection for date inputs - handles 2-digit year entries
  const handleRawMaterialsDateBlur = (value: string, setter: (val: string) => void) => {
    if (!value) return;

    const parts = value.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);

      // Handle 2-digit years (26 -> 2026)
      if (parts[0].length === 2 && year >= 0 && year <= 99) {
        const fullYear = `20${parts[0].padStart(2, '0')}`;
        setter(`${fullYear}-${parts[1]}-${parts[2]}`);
      }
      // Handle browser-converted 4-digit years like "0026" -> "2026"
      else if (parts[0].length === 4 && year >= 0 && year <= 99) {
        const fullYear = `20${year.toString().padStart(2, '0')}`;
        setter(`${fullYear}-${parts[1]}-${parts[2]}`);
      }
    }
  };

  // Format number with commas
  const formatNumberWithCommas = (num: number): string => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Load data
  useEffect(() => {
    loadData();
  }, [companyId, showArchived]);

  // Listen for data updates from modals (e.g., category added from Getting Started card)
  useEffect(() => {
    const handleDataUpdate = () => {
      console.log('CPUTracker: Received data update event, reloading...');
      loadData();
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleDataUpdate);
  }, [companyId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load categories
      const categoriesData = await db.cpgCategories
        .where('company_id')
        .equals(companyId)
        .filter(cat => cat.active && cat.deleted_at === null)
        .sortBy('sort_order');

      setCategories(categoriesData);

      // Load invoices (include archived if showArchived is true)
      const invoicesData = await db.cpgInvoices
        .where('company_id')
        .equals(companyId)
        .filter(inv => showArchived || (inv.active && inv.deleted_at === null))
        .reverse()
        .sortBy('invoice_date');

      setInvoices(invoicesData);

      // Check if any invoices are missing calculated_cpus and fix them
      const invoicesNeedingRecalculation = invoicesData.filter(inv => !inv.calculated_cpus);
      if (invoicesNeedingRecalculation.length > 0) {
        console.log(`🔧 Found ${invoicesNeedingRecalculation.length} invoices without CPU calculations. Recalculating...`);
        await cpuCalculatorService.recalculateAllCPUs(companyId);
        // Notify other components to reload
        window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'auto-recalculation' } }));
      }

      // Load finished products
      const productsData = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .filter(prod => prod.active && prod.deleted_at === null)
        .toArray();

      setFinishedProducts(productsData);

      // Load CPU history
      const history = await cpuCalculatorService.getCPUHistory(
        companyId,
        selectedCategoryFilter,
        showArchived
      );
      setCPUHistory(history);

    } catch (err) {
      console.error('Failed to load CPU tracker data:', err);
      setError('Oops! We had trouble loading your cost data. Let\'s try that again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvoiceSaved = async () => {
    setShowInvoiceForm(false);
    await loadData();
  };

  const handleCategoriesUpdated = async () => {
    await loadData();
  };

  const handleCategoryFilterChange = async (categoryId: string | undefined) => {
    setSelectedCategoryFilter(categoryId);

    // Reload history with new filter
    try {
      const history = await cpuCalculatorService.getCPUHistory(
        companyId,
        categoryId,
        showArchived
      );
      setCPUHistory(history);
    } catch (err) {
      console.error('Failed to filter CPU history:', err);
    }
  };

  const handleManualRecalculate = async () => {
    setIsRecalculating(true);
    try {
      console.log('🔧 Manually recalculating all CPUs...');
      await cpuCalculatorService.recalculateAllCPUs(companyId);
      console.log('✅ Recalculation complete!');

      // Dispatch event to notify CPUDisplay and other components
      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'recalculation' } }));

      await loadData();
    } catch (err) {
      console.error('Failed to recalculate CPUs:', err);
      setError('Failed to recalculate costs. Please try again.');
    } finally {
      setIsRecalculating(false);
    }
  };

  // Load CPU data for selected products (Cost Intelligence tab)
  const loadProductCPUData = async (productIds: string[]) => {
    if (productIds.length === 0) {
      setProductCPUData(new Map());
      return;
    }

    try {
      const cpuDataMap = new Map<string, { cpu: string | null; margin: number | null; trend: 'up' | 'down' | 'stable'; trendValue: string | null; topDriver: string | null; isComplete: boolean; breakdown: any[] }>();

      for (const productId of productIds) {
        const product = finishedProducts.find(p => p.id === productId);
        if (!product) continue;

        // Calculate current CPU
        const cpuResult = await cpuCalculatorService.calculateFinishedProductCPU(productId, companyId);

        // Calculate margin if MSRP exists
        let margin: number | null = null;
        if (product.msrp && cpuResult.cpu) {
          const msrpNum = parseFloat(product.msrp);
          const cpuNum = parseFloat(cpuResult.cpu);
          margin = ((msrpNum - cpuNum) / msrpNum) * 100;
        }

        // Find top cost driver
        let topDriver: string | null = null;
        if (cpuResult.breakdown.length > 0) {
          const sorted = [...cpuResult.breakdown]
            .filter(b => b.subtotal !== null)
            .sort((a, b) => parseFloat(b.subtotal!) - parseFloat(a.subtotal!));
          if (sorted.length > 0) {
            topDriver = sorted[0].categoryName;
          }
        }

        // For now, set trend as stable (we'll calculate actual trends later)
        // TODO: Calculate actual CPU trend from historical data
        cpuDataMap.set(productId, {
          cpu: cpuResult.cpu,
          margin,
          trend: 'stable',
          trendValue: null,
          topDriver,
          isComplete: cpuResult.isComplete,
          breakdown: cpuResult.breakdown
        });
      }

      setProductCPUData(cpuDataMap);
    } catch (err) {
      console.error('Failed to load product CPU data:', err);
    }
  };

  // Load CPU data when selected products change
  useEffect(() => {
    if (activeTab === 'comparison' && selectedProductsForComparison.size > 0) {
      loadProductCPUData(Array.from(selectedProductsForComparison));
    }
  }, [selectedProductsForComparison, activeTab, finishedProducts]);

  // Quick select functions for Cost Intelligence tab
  const selectAllProducts = () => {
    const filtered = getFilteredProducts();
    setSelectedProductsForComparison(new Set(filtered.map(p => p.id)));
  };

  const selectTopMarginProducts = (count: number = 5) => {
    const productsWithMargin = finishedProducts
      .map(p => {
        const data = productCPUData.get(p.id);
        return { id: p.id, margin: data?.margin ?? -999 };
      })
      .sort((a, b) => b.margin - a.margin)
      .slice(0, count)
      .map(p => p.id);

    setSelectedProductsForComparison(new Set(productsWithMargin));
  };

  const selectBottomMarginProducts = (count: number = 5) => {
    const productsWithMargin = finishedProducts
      .filter(p => {
        const data = productCPUData.get(p.id);
        return data?.margin !== null && data?.margin !== undefined;
      })
      .map(p => {
        const data = productCPUData.get(p.id);
        return { id: p.id, margin: data?.margin ?? 999 };
      })
      .sort((a, b) => a.margin - b.margin)
      .slice(0, count)
      .map(p => p.id);

    setSelectedProductsForComparison(new Set(productsWithMargin));
  };

  const selectMissingCostData = () => {
    const productsWithMissingData = finishedProducts
      .filter(p => {
        const data = productCPUData.get(p.id);
        return !data?.isComplete;
      })
      .map(p => p.id);

    setSelectedProductsForComparison(new Set(productsWithMissingData));
  };

  // Get filtered products for Cost Intelligence tab
  const getFilteredProducts = () => {
    return finishedProducts.filter(product => {
      // Search filter
      if (comparisonSearchTerm) {
        const searchLower = comparisonSearchTerm.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(searchLower);
        const matchesSKU = product.sku?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesSKU) return false;
      }

      // Category filter
      if (comparisonCategoryFilter !== 'all') {
        // TODO: Filter by product category when we have that data
        // For now, skip this filter
      }

      // Variant filter
      if (comparisonVariantFilter !== 'all') {
        // TODO: Filter by product variant when we have that data
        // For now, skip this filter
      }

      return true;
    });
  };

  // Calculate scenario CPU for a product based on component adjustments
  const calculateScenarioCPU = (productId: string): { cpu: number; components: any[] } | null => {
    const data = productCPUData.get(productId);
    if (!data || !data.breakdown || data.breakdown.length === 0) return null;

    const adjustments = scenarioAdjustments.get(productId) || new Map();
    let totalCPU = 0;
    const components = data.breakdown.map(component => {
      const baseSubtotal = component.subtotal ? parseFloat(component.subtotal) : 0;
      const adjustment = adjustments.get(component.categoryId) || 0;
      const adjustedSubtotal = baseSubtotal * (1 + adjustment / 100);
      totalCPU += adjustedSubtotal;

      return {
        ...component,
        adjustment,
        adjustedSubtotal
      };
    });

    return { cpu: totalCPU, components };
  };

  // Calculate scenario margin
  const calculateScenarioMargin = (productId: string, scenarioCPU: number): number | null => {
    const product = finishedProducts.find(p => p.id === productId);
    if (!product) return null;

    const msrp = scenarioMSRP.get(productId) || (product.msrp ? parseFloat(product.msrp) : null);
    if (!msrp) return null;

    return ((msrp - scenarioCPU) / msrp) * 100;
  };

  const handleArchiveInvoice = async (invoiceId: string) => {
    try {
      setError(null);

      // Archive invoice (soft delete)
      await db.cpgInvoices.update(invoiceId, {
        deleted_at: Date.now(),
        active: false,
        updated_at: Date.now(),
      });

      // Reload data
      await loadData();
    } catch (err) {
      console.error('Failed to archive invoice:', err);
      setError('Oops! We had trouble archiving that invoice. Please try again.');
    }
  };

  const handleUnarchiveInvoice = async (invoiceId: string) => {
    try {
      setError(null);

      await db.cpgInvoices.update(invoiceId, {
        deleted_at: null,
        active: true,
        updated_at: Date.now(),
      });

      // Reload data
      await loadData();
    } catch (err) {
      console.error('Failed to unarchive invoice:', err);
      setError('Oops! We had trouble restoring that invoice. Please try again.');
    }
  };

  // Filter and sort invoices for Raw Materials tab (Single source of truth - fixes code duplication)
  const filteredRawMaterialInvoices = useMemo(() => {
    let filtered = invoices.filter(inv => {
      // Date filter
      const invDate = new Date(inv.invoice_date);
      const startDate = new Date(rawMaterialsDateRange.start);
      const endDate = new Date(rawMaterialsDateRange.end);
      if (invDate < startDate || invDate > endDate) return false;

      // Vendor filter (exact match, case-insensitive)
      if (rawMaterialsVendorFilter && inv.vendor_name.toLowerCase() !== rawMaterialsVendorFilter.toLowerCase()) {
        return false;
      }

      // Category filter
      if (rawMaterialsCategoryFilter) {
        const hasCategory = inv.cost_attribution && Object.values(inv.cost_attribution).some(
          attr => attr.category_id === rawMaterialsCategoryFilter
        );
        if (!hasCategory) return false;
      }

      // Variant filter - improved logic
      if (rawMaterialsVariantFilter) {
        if (!inv.cost_attribution) return false;
        const hasVariant = Object.values(inv.cost_attribution).some(attr => {
          const variant = attr.variant || '';
          return variant.toLowerCase().includes(rawMaterialsVariantFilter.toLowerCase());
        });
        if (!hasVariant) return false;
      }

      return true;
    });

    // Sort invoices
    filtered.sort((a, b) => {
      switch (rawMaterialsSortBy) {
        case 'date-asc':
          return a.invoice_date - b.invoice_date;
        case 'date-desc':
          return b.invoice_date - a.invoice_date;
        case 'vendor':
          return a.vendor_name.localeCompare(b.vendor_name);
        case 'total-asc': {
          const aTotal = typeof a.total_paid === 'number' ? a.total_paid : parseFloat(a.total_paid || '0');
          const bTotal = typeof b.total_paid === 'number' ? b.total_paid : parseFloat(b.total_paid || '0');
          return aTotal - bTotal;
        }
        case 'total-desc': {
          const aTotal = typeof a.total_paid === 'number' ? a.total_paid : parseFloat(a.total_paid || '0');
          const bTotal = typeof b.total_paid === 'number' ? b.total_paid : parseFloat(b.total_paid || '0');
          return bTotal - aTotal;
        }
        default:
          return b.invoice_date - a.invoice_date;
      }
    });

    return filtered;
  }, [invoices, rawMaterialsDateRange, rawMaterialsVendorFilter, rawMaterialsCategoryFilter, rawMaterialsVariantFilter, rawMaterialsSortBy]);

  // Calculate stats for Raw Materials tab
  const rawMaterialStats = useMemo(() => {
    // Total spent in filtered invoices
    const totalSpent = filteredRawMaterialInvoices.reduce((sum, inv) => {
      const amount = typeof inv.total_paid === 'number' ? inv.total_paid : parseFloat(inv.total_paid || '0');
      return sum + amount;
    }, 0);

    // Invoice count (for filtered invoices)
    const invoiceCount = filteredRawMaterialInvoices.length;

    // Spend by category (all categories)
    const spendByCategory = new Map<string, { name: string; total: number }>();
    filteredRawMaterialInvoices.forEach(inv => {
      if (inv.cost_attribution) {
        Object.values(inv.cost_attribution).forEach(attr => {
          const category = categories.find(c => c.id === attr.category_id);
          if (category) {
            const lineTotal = attr.manual_line_total
              ? parseFloat(attr.manual_line_total)
              : parseFloat(attr.units_purchased) * parseFloat(attr.unit_price);

            const existing = spendByCategory.get(category.id);
            if (existing) {
              existing.total += lineTotal;
            } else {
              spendByCategory.set(category.id, { name: category.name, total: lineTotal });
            }
          }
        });
      }
    });

    // Average invoice amount
    const averageInvoiceAmount = filteredRawMaterialInvoices.length > 0
      ? totalSpent / filteredRawMaterialInvoices.length
      : 0;

    // Spend by selected category (if filter active)
    const spentOnSelectedCategory = rawMaterialsCategoryFilter
      ? (spendByCategory.get(rawMaterialsCategoryFilter)?.total || 0)
      : null;

    // Top vendor by spend (calculate from date-filtered only, ignore vendor filter for context)
    const dateFilteredInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.invoice_date);
      const startDate = new Date(rawMaterialsDateRange.start);
      const endDate = new Date(rawMaterialsDateRange.end);
      return invDate >= startDate && invDate <= endDate;
    });

    const allVendorsSpend = new Map<string, number>();
    dateFilteredInvoices.forEach(inv => {
      const amount = typeof inv.total_paid === 'number' ? inv.total_paid : parseFloat(inv.total_paid || '0');
      const existing = allVendorsSpend.get(inv.vendor_name);
      allVendorsSpend.set(inv.vendor_name, (existing || 0) + amount);
    });

    let topVendor: { name: string; total: number } | null = null;
    allVendorsSpend.forEach((total, name) => {
      if (!topVendor || total > topVendor.total) {
        topVendor = { name, total };
      }
    });

    // Top category by spend (calculate from date-filtered only, ignore category filter for context)
    const allCategoriesSpend = new Map<string, { name: string; total: number }>();
    dateFilteredInvoices.forEach(inv => {
      if (inv.cost_attribution) {
        Object.values(inv.cost_attribution).forEach(attr => {
          const category = categories.find(c => c.id === attr.category_id);
          if (category) {
            const lineTotal = attr.manual_line_total
              ? parseFloat(attr.manual_line_total)
              : parseFloat(attr.units_purchased) * parseFloat(attr.unit_price);

            const existing = allCategoriesSpend.get(category.id);
            if (existing) {
              existing.total += lineTotal;
            } else {
              allCategoriesSpend.set(category.id, { name: category.name, total: lineTotal });
            }
          }
        });
      }
    });

    let topCategory: { name: string; total: number } | null = null;
    allCategoriesSpend.forEach((categoryData) => {
      if (!topCategory || categoryData.total > topCategory.total) {
        topCategory = categoryData;
      }
    });

    // Top variant by spend (calculate from date-filtered only, ignore variant filter for context)
    const allVariantsSpend = new Map<string, number>();
    dateFilteredInvoices.forEach(inv => {
      if (inv.cost_attribution) {
        Object.values(inv.cost_attribution).forEach(attr => {
          if (attr.variant) {
            const lineTotal = attr.manual_line_total
              ? parseFloat(attr.manual_line_total)
              : parseFloat(attr.units_purchased) * parseFloat(attr.unit_price);

            const existing = allVariantsSpend.get(attr.variant);
            allVariantsSpend.set(attr.variant, (existing || 0) + lineTotal);
          }
        });
      }
    });

    let topVariant: { name: string; total: number } | null = null;
    allVariantsSpend.forEach((total, name) => {
      if (!topVariant || total > topVariant.total) {
        topVariant = { name, total };
      }
    });

    return {
      totalSpent,
      invoiceCount,
      averageInvoiceAmount,
      topVendor,
      topCategory,
      topVariant,
      spentOnSelectedCategory,
      spendByCategoryMap: spendByCategory,
    };
  }, [filteredRawMaterialInvoices, categories, rawMaterialsCategoryFilter, rawMaterialsDateRange, invoices]);

  // Get all unique variants from invoices for dropdown
  const availableVariants = useMemo(() => {
    const variants = new Set<string>();
    invoices.forEach(inv => {
      if (inv.cost_attribution) {
        Object.values(inv.cost_attribution).forEach(attr => {
          if (attr.variant) {
            variants.add(attr.variant);
          }
        });
      }
    });
    return Array.from(variants).sort();
  }, [invoices]);

  // Export functions for Raw Materials tab
  const exportRawMaterialsCSVSummary = () => {
    const headers = ['Date', 'Vendor', 'Invoice #', 'Categories', 'Total Paid'];
    const rows = filteredRawMaterialInvoices.map(inv => [
      new Date(inv.invoice_date).toLocaleDateString(),
      inv.vendor_name,
      inv.invoice_number || '-',
      inv.cost_attribution
        ? Object.values(inv.cost_attribution).map(attr => {
            const category = categories.find(c => c.id === attr.category_id);
            return category?.name || 'Unknown';
          }).join(', ')
        : '-',
      `$${typeof inv.total_paid === 'number' ? inv.total_paid.toFixed(2) : parseFloat(inv.total_paid || '0').toFixed(2)}`,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raw-materials-summary-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportRawMaterialsPDFSummary = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Raw Material Invoice Summary', 14, 20);

    doc.setFontSize(10);
    doc.text(`Date Range: ${new Date(rawMaterialsDateRange.start).toLocaleDateString()} - ${new Date(rawMaterialsDateRange.end).toLocaleDateString()}`, 14, 30);
    doc.text(`Total Spent: $${rawMaterialStats.totalSpent.toFixed(2)}`, 14, 36);
    doc.text(`Invoice Count: ${filteredRawMaterialInvoices.length}`, 14, 42);

    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Vendor', 'Invoice #', 'Categories', 'Total']],
      body: filteredRawMaterialInvoices.map(inv => [
        new Date(inv.invoice_date).toLocaleDateString(),
        inv.vendor_name,
        inv.invoice_number || '-',
        inv.cost_attribution
          ? Object.values(inv.cost_attribution).map(attr => {
              const category = categories.find(c => c.id === attr.category_id);
              return category?.name || 'Unknown';
            }).join(', ')
          : '-',
        `$${typeof inv.total_paid === 'number' ? inv.total_paid.toFixed(2) : parseFloat(inv.total_paid || '0').toFixed(2)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [75, 0, 110], textColor: 255 },
      styles: { fontSize: 9 },
    });

    doc.save(`raw-materials-summary-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportRawMaterialsCSVDetail = () => {
    const headers = [
      'Date',
      'Vendor',
      'Invoice #',
      'Category',
      'Variant',
      'Units Purchased',
      'Unit Price',
      'Units Received',
      'Line Total',
      'Invoice Total',
    ];

    const rows: string[][] = [];
    filteredRawMaterialInvoices.forEach(inv => {
      if (inv.cost_attribution) {
        Object.values(inv.cost_attribution).forEach(attr => {
          const category = categories.find(c => c.id === attr.category_id);
          const lineTotal = attr.manual_line_total
            ? parseFloat(attr.manual_line_total)
            : parseFloat(attr.units_purchased) * parseFloat(attr.unit_price);

          rows.push([
            new Date(inv.invoice_date).toLocaleDateString(),
            inv.vendor_name,
            inv.invoice_number || '-',
            category?.name || 'Unknown',
            attr.variant || '-',
            attr.units_purchased,
            `$${parseFloat(attr.unit_price).toFixed(2)}`,
            attr.units_received || attr.units_purchased,
            `$${lineTotal.toFixed(2)}`,
            `$${typeof inv.total_paid === 'number' ? inv.total_paid.toFixed(2) : parseFloat(inv.total_paid || '0').toFixed(2)}`,
          ]);
        });
      } else {
        // Invoice with no cost attribution
        rows.push([
          new Date(inv.invoice_date).toLocaleDateString(),
          inv.vendor_name,
          inv.invoice_number || '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          `$${typeof inv.total_paid === 'number' ? inv.total_paid.toFixed(2) : parseFloat(inv.total_paid || '0').toFixed(2)}`,
        ]);
      }
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raw-materials-detail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className={styles.pageContainer}>
        <div className="page-content" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className={styles.loader} role="status" aria-label="Loading CPU tracker">
            <span className={styles.spinner} />
          </div>
          <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>
            Loading your cost data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className="page-header">
        <div className={styles.headerContent}>
          <div>
            <h1 className="page-title">Cost Per Unit Tracker</h1>
            {invoices.length === 0 && (
              <p className="page-description">
                Track your true costs with ease. Enter invoices once, and we'll calculate your Cost Per Unit (CPU) for each product variant automatically.
              </p>
            )}
          </div>

          <div className={styles.headerActions}>
            {invoices.some(inv => !inv.calculated_cpus) && (
              <Button
                variant="outline"
                size="md"
                onClick={handleManualRecalculate}
                disabled={isRecalculating}
                iconBefore={<span aria-hidden="true">🔧</span>}
              >
                {isRecalculating ? 'Recalculating...' : 'Fix Missing Costs'}
              </Button>
            )}

            <Button
              variant="outline"
              size="md"
              onClick={() => setShowCategoryManager(true)}
              iconBefore={<span aria-hidden="true">⚙️</span>}
            >
              Manage Categories
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => setShowInvoiceForm(true)}
              iconBefore={<span aria-hidden="true">+</span>}
            >
              New Invoice
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert" aria-live="polite">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className={styles.dismissButton}
          >
            ×
          </button>
        </div>
      )}

      <div className="page-content">
        {/* Getting Started - Show if no categories or invoices */}
        {categories.length === 0 && invoices.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon} aria-hidden="true">📦</div>
            <h2 className={styles.emptyStateTitle}>Let's Get Started!</h2>
            <p className={styles.emptyStateDescription}>
              To track your Cost Per Unit (CPU), you'll need to set up your cost categories first.
              These are the different components that make up your product (like Oil, Bottle, Box, etc.).
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowCategoryManager(true)}
              iconBefore={<span aria-hidden="true">⚙️</span>}
            >
              Set Up Categories
            </Button>
          </div>
        )}

        {/* Main Content - Show if categories exist */}
        {categories.length > 0 && (
          <>
            {/* Tab Navigation */}
            <div className={styles.tabs} role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === 'products'}
                aria-controls="products-panel"
                onClick={() => setActiveTab('products')}
                className={activeTab === 'products' ? styles.tabActive : styles.tab}
              >
                Product Costs
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'raw-materials'}
                aria-controls="raw-materials-panel"
                onClick={() => setActiveTab('raw-materials')}
                className={activeTab === 'raw-materials' ? styles.tabActive : styles.tab}
              >
                Invoices
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'comparison'}
                aria-controls="comparison-panel"
                onClick={() => setActiveTab('comparison')}
                className={activeTab === 'comparison' ? styles.tabActive : styles.tab}
              >
                Cost Intelligence
              </button>
            </div>

            {/* Tab 1: Product Costs */}
            {activeTab === 'products' && (
              <div id="products-panel" role="tabpanel" aria-labelledby="products-tab">
                {/* Current CPU Display */}
                <section className={styles.section} aria-labelledby="current-cpu-heading">
                  <div className={styles.sectionHeader}>
                    <h2 id="current-cpu-heading" className={styles.sectionTitle}>
                      Product Costs
                    </h2>

                    {/* Product Filters */}
                    <div className={styles.productFilters}>
                      {/* Search */}
                      <input
                        type="search"
                        placeholder="Search products..."
                        value={productSearchFilter}
                        onChange={(e) => setProductSearchFilter(e.target.value)}
                        className={styles.searchInput}
                        aria-label="Search products"
                      />

                      {/* Status Filter */}
                      <select
                        value={productStatusFilter}
                        onChange={(e) => setProductStatusFilter(e.target.value as 'all' | 'complete' | 'incomplete')}
                        className={styles.filterSelect}
                        aria-label="Filter by completion status"
                      >
                        <option value="all">All Products</option>
                        <option value="complete">Complete Only</option>
                        <option value="incomplete">Incomplete Only</option>
                      </select>

                      {/* Sort */}
                      <select
                        value={productSortBy}
                        onChange={(e) => setProductSortBy(e.target.value as any)}
                        className={styles.filterSelect}
                        aria-label="Sort products"
                      >
                        <option value="name">Sort: Name (A-Z)</option>
                        <option value="cpu-asc">Sort: CPU (Low to High)</option>
                        <option value="cpu-desc">Sort: CPU (High to Low)</option>
                        <option value="missing">Sort: Missing Components</option>
                      </select>
                    </div>
                  </div>

                  <CPUDisplay
                    isLoading={isLoading}
                    searchFilter={productSearchFilter}
                    statusFilter={productStatusFilter}
                    sortBy={productSortBy}
                  />
                </section>
              </div>
            )}

            {/* Tab 2: Raw Material Costs (Invoice History) */}
            {activeTab === 'raw-materials' && (
              <div id="raw-materials-panel" role="tabpanel" aria-labelledby="raw-materials-tab">
                {/* Date Range & Export Controls */}
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}>
                  {/* Date Range Preset */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>
                      Date Range:
                    </label>
                    <select
                      value={rawMaterialsDatePreset}
                      onChange={(e) => handleRawMaterialsDatePresetChange(e.target.value as DateRangePreset)}
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
                  {rawMaterialsDatePreset === 'custom' && (
                    <>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <label htmlFor="rm-start-date" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>
                          From:
                        </label>
                        <input
                          type="date"
                          id="rm-start-date"
                          value={rawMaterialsDateRange.start}
                          onChange={(e) => setRawMaterialsDateRange(prev => ({ ...prev, start: e.target.value }))}
                          onBlur={(e) => handleRawMaterialsDateBlur(e.target.value, (val) => setRawMaterialsDateRange(prev => ({ ...prev, start: val })))}
                          style={{
                            padding: '0.5rem 0.75rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                          }}
                          aria-label="Start date for raw materials filter"
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <label htmlFor="rm-end-date" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>
                          To:
                        </label>
                        <input
                          type="date"
                          id="rm-end-date"
                          value={rawMaterialsDateRange.end}
                          onChange={(e) => setRawMaterialsDateRange(prev => ({ ...prev, end: e.target.value }))}
                          onBlur={(e) => handleRawMaterialsDateBlur(e.target.value, (val) => setRawMaterialsDateRange(prev => ({ ...prev, end: val })))}
                          style={{
                            padding: '0.5rem 0.75rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                          }}
                          aria-label="End date for raw materials filter"
                        />
                      </div>
                    </>
                  )}

                  {/* Category Filter */}
                  <select
                    value={rawMaterialsCategoryFilter || ''}
                    onChange={(e) => setRawMaterialsCategoryFilter(e.target.value || undefined)}
                    className={styles.filterSelect}
                    aria-label="Filter by category"
                    style={{
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="">All Categories</option>
                    {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>

                  {/* Variant Filter */}
                  <select
                    value={rawMaterialsVariantFilter}
                    onChange={(e) => setRawMaterialsVariantFilter(e.target.value)}
                    className={styles.filterSelect}
                    aria-label="Filter by variant"
                    style={{
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="">All Variants</option>
                    {availableVariants.map((variant) => (
                      <option key={variant} value={variant}>{variant}</option>
                    ))}
                  </select>

                  {/* Vendor Filter */}
                  <input
                    type="search"
                    placeholder="Filter by vendor..."
                    value={rawMaterialsVendorFilter}
                    onChange={(e) => setRawMaterialsVendorFilter(e.target.value)}
                    className={styles.searchInput}
                    aria-label="Filter by vendor"
                    style={{
                      minWidth: '150px',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                    }}
                    list="vendor-suggestions"
                  />
                  <datalist id="vendor-suggestions">
                    {Array.from(new Set(invoices.map(inv => inv.vendor_name))).sort().map(vendor => (
                      <option key={vendor} value={vendor} />
                    ))}
                  </datalist>

                  {/* Export Dropdown */}
                  <div style={{ marginLeft: 'auto', position: 'relative' }}>
                    <button
                      onClick={() => setShowRawMaterialsExportMenu(!showRawMaterialsExportMenu)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#4b006e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                      aria-label="Export raw materials data"
                      aria-expanded={showRawMaterialsExportMenu}
                      aria-haspopup="menu"
                    >
                      Export
                      <span style={{ fontSize: '0.75rem' }}>▼</span>
                    </button>

                    {showRawMaterialsExportMenu && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '0.25rem',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        overflow: 'hidden',
                        zIndex: 1000,
                        minWidth: '200px',
                      }}
                      role="menu"
                      >
                        <button
                          onClick={() => {
                            exportRawMaterialsCSVSummary();
                            setShowRawMaterialsExportMenu(false);
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
                          role="menuitem"
                        >
                          CSV Summary
                        </button>
                        <button
                          onClick={() => {
                            exportRawMaterialsPDFSummary();
                            setShowRawMaterialsExportMenu(false);
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
                          role="menuitem"
                        >
                          PDF Summary
                        </button>
                        <button
                          onClick={() => {
                            exportRawMaterialsCSVDetail();
                            setShowRawMaterialsExportMenu(false);
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
                          role="menuitem"
                        >
                          CSV Detail Summary
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Filter Status Banner */}
                {(rawMaterialsCategoryFilter || rawMaterialsVariantFilter || rawMaterialsVendorFilter) && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '6px',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    fontSize: '0.875rem',
                  }}
                  role="status"
                  aria-live="polite"
                  >
                    <span style={{ color: '#0c4a6e' }}>
                      Showing {filteredRawMaterialInvoices.length} of {invoices.length} invoices
                      {rawMaterialsDatePreset !== 'all' && ` • ${new Date(rawMaterialsDateRange.start).toLocaleDateString()} - ${new Date(rawMaterialsDateRange.end).toLocaleDateString()}`}
                      {rawMaterialsCategoryFilter && ` • Category: ${categories.find(c => c.id === rawMaterialsCategoryFilter)?.name}`}
                      {rawMaterialsVariantFilter && ` • Variant: "${rawMaterialsVariantFilter}"`}
                      {rawMaterialsVendorFilter && ` • Vendor: "${rawMaterialsVendorFilter}"`}
                    </span>
                    <button
                      onClick={() => {
                        setRawMaterialsCategoryFilter(undefined);
                        setRawMaterialsVariantFilter('');
                        setRawMaterialsVendorFilter('');
                      }}
                      style={{
                        marginLeft: 'auto',
                        padding: '0.25rem 0.75rem',
                        background: 'transparent',
                        border: '1px solid #0c4a6e',
                        borderRadius: '4px',
                        color: '#0c4a6e',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                      aria-label="Clear all filters"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}

                {/* Stat Boxes */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginBottom: '2rem',
                }}>
                  {/* Total Spent */}
                  <div style={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '1.5rem',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginBottom: '0.5rem' }}>
                      Total Spent
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4b006e', lineHeight: 1 }}>
                      ${formatNumberWithCommas(rawMaterialStats.totalSpent)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                      {filteredRawMaterialInvoices.length} {filteredRawMaterialInvoices.length === 1 ? 'invoice' : 'invoices'}
                    </div>
                  </div>

                  {/* Average Invoice Amount */}
                  {filteredRawMaterialInvoices.length > 0 && (
                    <div style={{
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '1.5rem',
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginBottom: '0.5rem' }}>
                        Average Invoice Amount
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4b006e', lineHeight: 1 }}>
                        ${formatNumberWithCommas(rawMaterialStats.averageInvoiceAmount)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                        per invoice
                      </div>
                    </div>
                  )}

                  {/* Top Category by Spend (show when category filter active, otherwise Top Vendor) */}
                  {rawMaterialsCategoryFilter && rawMaterialStats.topCategory ? (
                    <div style={{
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '1.5rem',
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginBottom: '0.5rem' }}>
                        Top Category by Spend
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4b006e', lineHeight: 1 }}>
                        ${formatNumberWithCommas(rawMaterialStats.topCategory.total)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                        {rawMaterialStats.topCategory.name}
                      </div>
                    </div>
                  ) : rawMaterialsVariantFilter && rawMaterialStats.topVariant ? (
                    <div style={{
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '1.5rem',
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginBottom: '0.5rem' }}>
                        Top Variant by Spend
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4b006e', lineHeight: 1 }}>
                        ${formatNumberWithCommas(rawMaterialStats.topVariant.total)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                        {rawMaterialStats.topVariant.name}
                      </div>
                    </div>
                  ) : rawMaterialStats.topVendor && (
                    <div style={{
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '1.5rem',
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginBottom: '0.5rem' }}>
                        Top Vendor by Spend
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4b006e', lineHeight: 1 }}>
                        ${formatNumberWithCommas(rawMaterialStats.topVendor.total)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                        {rawMaterialStats.topVendor.name}
                      </div>
                    </div>
                  )}
                </div>

                {/* Category Breakdown Visualization */}
                {rawMaterialStats.spendByCategoryMap.size > 0 && (
                  <div style={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '2rem',
                  }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', marginBottom: '1rem' }}>
                      Spend by Category
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {Array.from(rawMaterialStats.spendByCategoryMap.entries())
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([categoryId, data]) => {
                          const percentage = (data.total / rawMaterialStats.totalSpent) * 100;
                          return (
                            <div key={categoryId} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ minWidth: '120px', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                                {data.name}
                              </div>
                              <div style={{ flex: 1, position: 'relative' }}>
                                <div style={{
                                  height: '24px',
                                  background: '#f3f4f6',
                                  borderRadius: '4px',
                                  overflow: 'hidden',
                                }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${percentage}%`,
                                    background: '#4b006e',
                                    transition: 'width 300ms ease-out',
                                  }} />
                                </div>
                              </div>
                              <div style={{ minWidth: '100px', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#4b006e' }}>
                                ${formatNumberWithCommas(data.total)}
                              </div>
                              <div style={{ minWidth: '50px', textAlign: 'right', fontSize: '0.875rem', color: '#64748b' }}>
                                {percentage.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Invoice History Table */}
                <div style={{
                  background: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                }}>
                  {filteredRawMaterialInvoices.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '3rem 2rem',
                      background: '#f9fafb',
                    }}>
                      {invoices.length === 0 ? (
                        <>
                          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📦</span>
                          <span style={{ color: '#64748b', fontSize: '1.125rem', display: 'block', marginBottom: '0.5rem' }}>
                            No invoices yet
                          </span>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                            Ready to track your raw material costs? Add your first invoice to get started.
                          </p>
                          <Button
                            variant="primary"
                            size="md"
                            onClick={() => setShowInvoiceForm(true)}
                            iconBefore={<span aria-hidden="true">+</span>}
                          >
                            New Invoice
                          </Button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🔍</span>
                          <span style={{ color: '#64748b', fontSize: '1.125rem', display: 'block', marginBottom: '0.5rem' }}>
                            No invoices match your filters
                          </span>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                            Try adjusting your date range, vendor, category, or variant filters.
                          </p>
                          <button
                            onClick={() => {
                              setRawMaterialsCategoryFilter(undefined);
                              setRawMaterialsVariantFilter('');
                              setRawMaterialsVendorFilter('');
                              handleRawMaterialsDatePresetChange('all');
                            }}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#4b006e',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            Clear All Filters
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <table className={styles.table} aria-label="Raw material invoice history" aria-describedby="invoice-count-status">
                      <caption id="invoice-count-status" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
                        Showing {filteredRawMaterialInvoices.length} invoices
                      </caption>
                      <thead>
                        <tr>
                          <th
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => setRawMaterialsSortBy(rawMaterialsSortBy === 'date-desc' ? 'date-asc' : 'date-desc')}
                            aria-sort={rawMaterialsSortBy === 'date-desc' ? 'descending' : rawMaterialsSortBy === 'date-asc' ? 'ascending' : 'none'}
                          >
                            Date {rawMaterialsSortBy === 'date-desc' ? '▼' : rawMaterialsSortBy === 'date-asc' ? '▲' : ''}
                          </th>
                          <th
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => setRawMaterialsSortBy('vendor')}
                            aria-sort={rawMaterialsSortBy === 'vendor' ? 'ascending' : 'none'}
                          >
                            Vendor {rawMaterialsSortBy === 'vendor' ? '▲' : ''}
                          </th>
                          <th>Invoice #</th>
                          <th>Categories</th>
                          <th
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => setRawMaterialsSortBy(rawMaterialsSortBy === 'total-desc' ? 'total-asc' : 'total-desc')}
                            aria-sort={rawMaterialsSortBy === 'total-desc' ? 'descending' : rawMaterialsSortBy === 'total-asc' ? 'ascending' : 'none'}
                          >
                            Total Paid {rawMaterialsSortBy === 'total-desc' ? '▼' : rawMaterialsSortBy === 'total-asc' ? '▲' : ''}
                          </th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRawMaterialInvoices.map((invoice) => {
                          const invoiceCategories = invoice.cost_attribution
                            ? Object.values(invoice.cost_attribution).map(attr => {
                                const category = categories.find(c => c.id === attr.category_id);
                                return category?.name || 'Unknown';
                              })
                            : [];

                          const uniqueCategories = Array.from(new Set(invoiceCategories));

                          return (
                            <tr key={invoice.id}>
                              <td>{new Date(invoice.invoice_date).toLocaleDateString()}</td>
                              <td>{invoice.vendor_name}</td>
                              <td>{invoice.invoice_number || '-'}</td>
                              <td>
                                {uniqueCategories.length > 0 ? (
                                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                    {uniqueCategories.slice(0, 3).map((catName, idx) => (
                                      <span
                                        key={idx}
                                        style={{
                                          padding: '0.125rem 0.5rem',
                                          background: '#f3f4f6',
                                          color: '#374151',
                                          borderRadius: '4px',
                                          fontSize: '0.75rem',
                                          fontWeight: 500,
                                          border: '1px solid #e5e7eb',
                                        }}
                                      >
                                        {catName}
                                      </span>
                                    ))}
                                    {uniqueCategories.length > 3 && (
                                      <span
                                        style={{
                                          padding: '0.125rem 0.5rem',
                                          background: '#f3f4f6',
                                          color: '#64748b',
                                          borderRadius: '4px',
                                          fontSize: '0.75rem',
                                          fontWeight: 500,
                                          border: '1px solid #e5e7eb',
                                        }}
                                        title={uniqueCategories.slice(3).join(', ')}
                                      >
                                        +{uniqueCategories.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                ) : '-'}
                              </td>
                              <td style={{ fontWeight: 600, color: '#4b006e' }}>
                                ${formatNumberWithCommas(typeof invoice.total_paid === 'number' ? invoice.total_paid : parseFloat(invoice.total_paid || '0'))}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className={styles.actionButton}
                                    onClick={() => {
                                      setSelectedInvoiceId(invoice.id);
                                      setShowInvoiceDetails(true);
                                    }}
                                    aria-label={`View invoice ${invoice.invoice_number || 'details'}`}
                                  >
                                    View
                                  </button>
                                  <button
                                    className={styles.actionButton}
                                    onClick={() => {
                                      setEditingInvoiceId(invoice.id);
                                      setInvoiceFormMode('edit');
                                      setShowInvoiceForm(true);
                                    }}
                                    style={{ background: '#f3f4f6', color: '#374151' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                    aria-label={`Edit invoice ${invoice.invoice_number || ''}`}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className={styles.actionButton}
                                    onClick={() => {
                                      setEditingInvoiceId(invoice.id);
                                      setInvoiceFormMode('duplicate');
                                      setShowInvoiceForm(true);
                                    }}
                                    style={{ background: '#f3f4f6', color: '#374151' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                    aria-label={`Duplicate invoice ${invoice.invoice_number || ''}`}
                                  >
                                    Duplicate
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Cost Intelligence */}
            {activeTab === 'comparison' && (
              <div id="comparison-panel" role="tabpanel" aria-labelledby="comparison-tab">
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Cost Intelligence</h2>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                    Compare product costs, margins, and pricing trends side-by-side to identify your most profitable products.
                  </p>

                  {finishedProducts.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon} aria-hidden="true">📦</div>
                      <p className={styles.emptyText}>
                        No finished products defined yet. Add your first product to start analyzing profitability.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Product Selector with Filters */}
                      <div style={{
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        marginBottom: '2rem',
                      }}>
                        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {/* Search Input */}
                          <input
                            type="search"
                            placeholder="🔍 Type to search products..."
                            value={comparisonSearchTerm}
                            onChange={(e) => setComparisonSearchTerm(e.target.value)}
                            style={{
                              flex: '1 1 300px',
                              padding: '0.75rem 1rem',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '0.875rem',
                            }}
                          />

                          {/* Category Filter */}
                          <select
                            value={comparisonCategoryFilter}
                            onChange={(e) => setComparisonCategoryFilter(e.target.value)}
                            style={{
                              padding: '0.75rem',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '0.875rem',
                              background: 'white',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="all">All Categories</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>

                          {/* Date Range for Trends */}
                          <select
                            value={comparisonDateRange}
                            onChange={(e) => setComparisonDateRange(e.target.value as any)}
                            style={{
                              padding: '0.75rem',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '0.875rem',
                              background: 'white',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="3mo">Last 3 Months</option>
                            <option value="6mo">Last 6 Months</option>
                            <option value="12mo">Last 12 Months</option>
                            <option value="all">All Time</option>
                          </select>
                        </div>

                        {/* Selected Products (Chips) */}
                        {selectedProductsForComparison.size > 0 && (
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#64748b',
                              marginBottom: '0.5rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              Comparing ({selectedProductsForComparison.size})
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              {Array.from(selectedProductsForComparison).map(productId => {
                                const product = finishedProducts.find(p => p.id === productId);
                                if (!product) return null;
                                return (
                                  <div
                                    key={productId}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      padding: '0.375rem 0.75rem',
                                      background: '#f3e8ff',
                                      color: '#4b006e',
                                      borderRadius: '6px',
                                      fontSize: '0.875rem',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {product.name}
                                    <button
                                      onClick={() => {
                                        const newSet = new Set(selectedProductsForComparison);
                                        newSet.delete(productId);
                                        setSelectedProductsForComparison(newSet);
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        fontSize: '1.125rem',
                                        lineHeight: 1,
                                        color: '#4b006e',
                                        opacity: 0.7,
                                      }}
                                      aria-label={`Remove ${product.name}`}
                                    >
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                              <button
                                onClick={() => setSelectedProductsForComparison(new Set())}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  background: 'none',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  color: '#64748b',
                                }}
                              >
                                Clear All
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Quick Select Buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={selectAllProducts}
                            style={{
                              padding: '0.5rem 1rem',
                              background: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            All Products
                          </button>
                          <button
                            onClick={() => selectTopMarginProducts(5)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            Top 5 by Margin
                          </button>
                          <button
                            onClick={() => selectBottomMarginProducts(5)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            Bottom 5 by Margin
                          </button>
                          <button
                            onClick={selectMissingCostData}
                            style={{
                              padding: '0.5rem 1rem',
                              background: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            Missing Cost Data
                          </button>
                        </div>
                      </div>

                      {/* Comparison Display */}
                      {selectedProductsForComparison.size === 0 ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '4rem 2rem',
                          color: '#64748b',
                        }}>
                          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                          <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                            Select products to compare
                          </p>
                          <p style={{ fontSize: '0.875rem' }}>
                            Use the search bar above or click a quick select button to get started
                          </p>
                        </div>
                      ) : (
                        <div>
                          {/* Comparison Cards */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '1.5rem',
                            marginBottom: '2rem',
                          }}>
                            {Array.from(selectedProductsForComparison).map(productId => {
                              const product = finishedProducts.find(p => p.id === productId);
                              if (!product) return null;

                              const cpuData = productCPUData.get(productId);
                              const cpu = cpuData?.cpu ? parseFloat(cpuData.cpu) : null;
                              const msrp = product.msrp ? parseFloat(product.msrp) : null;
                              const margin = cpuData?.margin;

                              // Determine margin color
                              let marginColor = '#64748b';
                              if (margin !== null && margin !== undefined) {
                                if (margin >= 70) marginColor = '#16a34a'; // Green
                                else if (margin >= 50) marginColor = '#eab308'; // Yellow
                                else marginColor = '#dc2626'; // Red
                              }

                              return (
                                <div
                                  key={productId}
                                  style={{
                                    background: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                  }}
                                >
                                  <div style={{ marginBottom: '1rem' }}>
                                    <h3 style={{
                                      fontSize: '1rem',
                                      fontWeight: 700,
                                      color: '#1e293b',
                                      marginBottom: '0.25rem',
                                    }}>
                                      {product.name}
                                    </h3>
                                    {product.sku && (
                                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        SKU: {product.sku}
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {/* Current CPU */}
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                        Current CPU
                                      </div>
                                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4b006e' }}>
                                        {cpu !== null ? `$${formatNumberWithCommas(cpu)}` : 'N/A'}
                                      </div>
                                    </div>

                                    {/* MSRP */}
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                        MSRP
                                      </div>
                                      <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                                        {msrp !== null ? `$${formatNumberWithCommas(msrp)}` : 'Not set'}
                                      </div>
                                    </div>

                                    {/* Margin */}
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                        Gross Margin
                                      </div>
                                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: marginColor }}>
                                        {margin !== null && margin !== undefined ? `${margin.toFixed(1)}%` : 'N/A'}
                                        {margin !== null && margin !== undefined && (
                                          <span style={{ fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                                            {margin >= 70 ? '✓' : margin >= 50 ? '⚠' : '⚠'}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Top Cost Driver */}
                                    {cpuData?.topDriver && (
                                      <div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                          Top Cost Driver
                                        </div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                          {cpuData.topDriver}
                                        </div>
                                      </div>
                                    )}

                                    {/* Data Status */}
                                    <div style={{
                                      marginTop: '0.5rem',
                                      padding: '0.5rem',
                                      background: cpuData?.isComplete ? '#f0fdf4' : '#fef3c7',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      color: cpuData?.isComplete ? '#16a34a' : '#d97706',
                                    }}>
                                      {cpuData?.isComplete ? '✓ Complete Cost Data' : '⚠ Incomplete Cost Data'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Intelligence Tabs */}
                          <div style={{
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            overflow: 'hidden',
                          }}>
                            {/* Tab Navigation */}
                            <div style={{
                              display: 'flex',
                              borderBottom: '1px solid #e5e7eb',
                              background: '#f8fafc',
                            }}>
                              <button
                                onClick={() => setIntelligenceTab('scenario')}
                                style={{
                                  flex: 1,
                                  padding: '1rem',
                                  border: 'none',
                                  background: intelligenceTab === 'scenario' ? 'white' : 'transparent',
                                  borderBottom: intelligenceTab === 'scenario' ? '2px solid #4b006e' : '2px solid transparent',
                                  fontWeight: intelligenceTab === 'scenario' ? 600 : 400,
                                  color: intelligenceTab === 'scenario' ? '#4b006e' : '#64748b',
                                  cursor: 'pointer',
                                }}
                              >
                                Scenario Builder
                              </button>
                              <button
                                onClick={() => setIntelligenceTab('trends')}
                                style={{
                                  flex: 1,
                                  padding: '1rem',
                                  border: 'none',
                                  background: intelligenceTab === 'trends' ? 'white' : 'transparent',
                                  borderBottom: intelligenceTab === 'trends' ? '2px solid #4b006e' : '2px solid transparent',
                                  fontWeight: intelligenceTab === 'trends' ? 600 : 400,
                                  color: intelligenceTab === 'trends' ? '#4b006e' : '#64748b',
                                  cursor: 'pointer',
                                }}
                              >
                                CPU Trends
                              </button>
                              <button
                                onClick={() => setIntelligenceTab('vendors')}
                                style={{
                                  flex: 1,
                                  padding: '1rem',
                                  border: 'none',
                                  background: intelligenceTab === 'vendors' ? 'white' : 'transparent',
                                  borderBottom: intelligenceTab === 'vendors' ? '2px solid #4b006e' : '2px solid transparent',
                                  fontWeight: intelligenceTab === 'vendors' ? 600 : 400,
                                  color: intelligenceTab === 'vendors' ? '#4b006e' : '#64748b',
                                  cursor: 'pointer',
                                }}
                              >
                                Vendor Intel
                              </button>
                              <button
                                onClick={() => setIntelligenceTab('alerts')}
                                style={{
                                  flex: 1,
                                  padding: '1rem',
                                  border: 'none',
                                  background: intelligenceTab === 'alerts' ? 'white' : 'transparent',
                                  borderBottom: intelligenceTab === 'alerts' ? '2px solid #4b006e' : '2px solid transparent',
                                  fontWeight: intelligenceTab === 'alerts' ? 600 : 400,
                                  color: intelligenceTab === 'alerts' ? '#4b006e' : '#64748b',
                                  cursor: 'pointer',
                                }}
                              >
                                Smart Alerts
                              </button>
                            </div>

                            {/* Tab Content */}
                            <div style={{ padding: '1.5rem' }}>
                              {/* Scenario Builder Tab */}
                              {intelligenceTab === 'scenario' && (
                                <div>
                                  <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                                    Adjust component costs to model scenarios like tariffs, vendor changes, or seasonal pricing.
                                  </p>

                                  {Array.from(selectedProductsForComparison).map(productId => {
                                    const product = finishedProducts.find(p => p.id === productId);
                                    const cpuData = productCPUData.get(productId);
                                    if (!product || !cpuData || !cpuData.breakdown || cpuData.breakdown.length === 0) return null;

                                    const baseCPU = cpuData.cpu ? parseFloat(cpuData.cpu) : 0;
                                    const baseMSRP = product.msrp ? parseFloat(product.msrp) : 0;
                                    const baseMargin = cpuData.margin || 0;

                                    const scenario = calculateScenarioCPU(productId);
                                    const scenarioCPUValue = scenario?.cpu || baseCPU;
                                    const scenarioMSRPValue = scenarioMSRP.get(productId) || baseMSRP;
                                    const scenarioMarginValue = calculateScenarioMargin(productId, scenarioCPUValue) || baseMargin;

                                    const hasAdjustments = (scenarioAdjustments.get(productId)?.size || 0) > 0 || scenarioMSRP.has(productId);

                                    return (
                                      <div key={productId} style={{
                                        marginBottom: '2rem',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        padding: '1.5rem',
                                      }}>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
                                          {product.name}
                                        </h4>

                                        {/* Current vs Scenario Comparison */}
                                        <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: '1fr 1fr',
                                          gap: '1rem',
                                          marginBottom: '1.5rem',
                                          padding: '1rem',
                                          background: '#f8fafc',
                                          borderRadius: '8px',
                                        }}>
                                          <div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>CURRENT</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                                              CPU: ${formatNumberWithCommas(baseCPU)}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                              Margin: {baseMargin.toFixed(1)}%
                                            </div>
                                          </div>
                                          <div style={{
                                            borderLeft: hasAdjustments ? '3px solid #4b006e' : '3px solid #e5e7eb',
                                            paddingLeft: '1rem',
                                          }}>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>YOUR SCENARIO</div>
                                            <div style={{
                                              fontSize: '1.25rem',
                                              fontWeight: 700,
                                              color: hasAdjustments ? '#4b006e' : '#1e293b',
                                            }}>
                                              CPU: ${formatNumberWithCommas(scenarioCPUValue)}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: hasAdjustments ? '#4b006e' : '#64748b' }}>
                                              Margin: {scenarioMarginValue.toFixed(1)}%
                                              {hasAdjustments && (
                                                <span style={{ marginLeft: '0.5rem' }}>
                                                  ({scenarioMarginValue > baseMargin ? '+' : ''}{(scenarioMarginValue - baseMargin).toFixed(1)}%)
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* MSRP Adjustment */}
                                        <div style={{ marginBottom: '1.5rem' }}>
                                          <label style={{
                                            display: 'block',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            marginBottom: '0.5rem',
                                          }}>
                                            MSRP: ${scenarioMSRPValue.toFixed(2)}
                                          </label>
                                          <input
                                            type="range"
                                            min={baseMSRP * 0.7}
                                            max={baseMSRP * 1.5}
                                            step={0.25}
                                            value={scenarioMSRPValue}
                                            onChange={(e) => {
                                              const newMSRP = parseFloat(e.target.value);
                                              setScenarioMSRP(prev => new Map(prev).set(productId, newMSRP));
                                            }}
                                            style={{
                                              width: '100%',
                                              height: '6px',
                                              borderRadius: '3px',
                                              background: '#e5e7eb',
                                              outline: 'none',
                                              cursor: 'pointer',
                                            }}
                                          />
                                          <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontSize: '0.75rem',
                                            color: '#64748b',
                                            marginTop: '0.25rem',
                                          }}>
                                            <span>-30%</span>
                                            <span>+50%</span>
                                          </div>
                                        </div>

                                        {/* Component Adjustments */}
                                        <div>
                                          <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                                            Component Costs
                                          </div>
                                          {cpuData.breakdown.map((component, idx) => {
                                            const baseSubtotal = component.subtotal ? parseFloat(component.subtotal) : 0;
                                            const currentAdj = scenarioAdjustments.get(productId)?.get(component.categoryId) || 0;
                                            const adjustedSubtotal = baseSubtotal * (1 + currentAdj / 100);

                                            return (
                                              <div key={idx} style={{
                                                marginBottom: '1rem',
                                                padding: '0.75rem',
                                                background: currentAdj !== 0 ? '#fef3c7' : 'white',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '6px',
                                              }}>
                                                <div style={{
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  marginBottom: '0.5rem',
                                                }}>
                                                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                                    {component.categoryName}
                                                  </div>
                                                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                                    ${formatNumberWithCommas(adjustedSubtotal)}
                                                    {currentAdj !== 0 && (
                                                      <span style={{
                                                        fontSize: '0.75rem',
                                                        color: currentAdj > 0 ? '#dc2626' : '#16a34a',
                                                        marginLeft: '0.5rem',
                                                      }}>
                                                        ({currentAdj > 0 ? '+' : ''}{currentAdj}%)
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                                <input
                                                  type="range"
                                                  min={-50}
                                                  max={100}
                                                  step={5}
                                                  value={currentAdj}
                                                  onChange={(e) => {
                                                    const adj = parseInt(e.target.value);
                                                    setScenarioAdjustments(prev => {
                                                      const newMap = new Map(prev);
                                                      const productAdj = newMap.get(productId) || new Map();
                                                      if (adj === 0) {
                                                        productAdj.delete(component.categoryId);
                                                      } else {
                                                        productAdj.set(component.categoryId, adj);
                                                      }
                                                      newMap.set(productId, productAdj);
                                                      return newMap;
                                                    });
                                                  }}
                                                  style={{
                                                    width: '100%',
                                                    height: '6px',
                                                    borderRadius: '3px',
                                                    background: '#e5e7eb',
                                                    outline: 'none',
                                                    cursor: 'pointer',
                                                  }}
                                                />
                                                <div style={{
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  fontSize: '0.75rem',
                                                  color: '#64748b',
                                                  marginTop: '0.25rem',
                                                }}>
                                                  <span>-50% (cheaper vendor)</span>
                                                  <span>+100% (tariff/shortage)</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>

                                        {/* Reset Button */}
                                        {hasAdjustments && (
                                          <button
                                            onClick={() => {
                                              setScenarioAdjustments(prev => {
                                                const newMap = new Map(prev);
                                                newMap.delete(productId);
                                                return newMap;
                                              });
                                              setScenarioMSRP(prev => {
                                                const newMap = new Map(prev);
                                                newMap.delete(productId);
                                                return newMap;
                                              });
                                            }}
                                            style={{
                                              marginTop: '1rem',
                                              padding: '0.5rem 1rem',
                                              background: 'white',
                                              border: '1px solid #e5e7eb',
                                              borderRadius: '6px',
                                              fontSize: '0.875rem',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            Reset to Current
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Trends Tab */}
                              {intelligenceTab === 'trends' && (
                                <div style={{
                                  padding: '2rem',
                                  textAlign: 'center',
                                  color: '#64748b',
                                }}>
                                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</div>
                                  <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                                    CPU Trend Analysis
                                  </p>
                                  <p style={{ fontSize: '0.875rem' }}>
                                    Coming soon: Interactive charts showing cost trends over time with driver annotations
                                  </p>
                                </div>
                              )}

                              {/* Vendors Tab */}
                              {intelligenceTab === 'vendors' && (
                                <div style={{
                                  padding: '2rem',
                                  textAlign: 'center',
                                  color: '#64748b',
                                }}>
                                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏪</div>
                                  <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                                    Vendor Intelligence
                                  </p>
                                  <p style={{ fontSize: '0.875rem' }}>
                                    Coming soon: Vendor price comparison and savings opportunities
                                  </p>
                                </div>
                              )}

                              {/* Alerts Tab */}
                              {intelligenceTab === 'alerts' && (
                                <div style={{
                                  padding: '2rem',
                                  textAlign: 'center',
                                  color: '#64748b',
                                }}>
                                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔔</div>
                                  <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                                    Smart Alerts
                                  </p>
                                  <p style={{ fontSize: '0.875rem' }}>
                                    Coming soon: Automated recommendations and margin alerts
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </div>
            )}
          </>
        )}

        {/* No invoices yet */}
        {categories.length > 0 && invoices.length === 0 && (
          <div className={styles.emptyInvoices}>
            <p className={styles.emptyInvoicesText}>
              You're all set! Now you can start entering invoices to track your costs.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowInvoiceForm(true)}
              iconBefore={<span aria-hidden="true">+</span>}
            >
              Enter Your First Invoice
            </Button>
          </div>
        )}
      </div>

      {/* Invoice Entry Form Modal */}
      {(showInvoiceForm || editingInvoiceId) && (
        <AddInvoiceModal
          isOpen={showInvoiceForm || !!editingInvoiceId}
          onClose={() => {
            setShowInvoiceForm(false);
            setEditingInvoiceId(null);
            setInvoiceFormMode('new');
          }}
          onSuccess={handleInvoiceSaved}
          invoiceId={editingInvoiceId || undefined}
          mode={invoiceFormMode}
        />
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <CategoryManager
          companyId={companyId}
          categories={categories}
          onClose={() => setShowCategoryManager(false)}
          onSaved={handleCategoriesUpdated}
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
          onEdit={(invoiceId) => {
            setEditingInvoiceId(invoiceId);
            setShowInvoiceForm(true);
          }}
        />
      )}
    </div>
  );
}
