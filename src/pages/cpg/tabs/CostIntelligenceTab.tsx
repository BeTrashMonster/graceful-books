/**
 * Cost Intelligence Tab Component
 *
 * Container component that manages product comparison and cost intelligence features.
 *
 * Features:
 * - Product selection with search and filters
 * - Sub-tab navigation (Scenario Builder, CPU Trends, Vendor Intel, Smart Alerts)
 * - Quick select actions (All Products, Top/Bottom by Margin, Missing Cost Data)
 * - Product CPU data loading and management
 *
 * Requirements:
 * - Clean component boundaries
 * - Single responsibility (cost intelligence coordination)
 * - WCAG 2.1 AA compliance
 * - Type-safe props and state management
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { CPGCategory, CPGInvoice, CPGRecipe } from '../../../db/schema/cpg.schema';
import { cpuCalculatorService } from '../../../services/cpg/cpuCalculator.service';
import { db } from '../../../db/database';
import CPUTrendsTab from './intelligence/CPUTrendsTab';
import VendorIntelTab from './intelligence/VendorIntelTab';
import SmartAlertsTab from './intelligence/SmartAlertsTab';
import styles from '../CPUTracker.module.css';
import ScenarioBuilderTab from './intelligence/ScenarioBuilderTab';

export interface CostIntelligenceTabProps {
  companyId: string;
  finishedProducts: any[]; // TODO: Add proper type from schema
  categories: CPGCategory[];
  invoices: CPGInvoice[];
  recipes?: any[]; // Product recipes that define which variant each product uses
  onOpenCategoryManager: () => void;
  onViewInvoice?: (invoiceId: string) => void;
  onEditInvoice?: (invoiceId: string) => void;
  onDuplicateInvoice?: (invoiceId: string) => void;
  initialIntelligenceTab?: IntelligenceSubTab;
  initialVendorFilter?: string;
  initialCategoryFilter?: string; // Single category filter (for Vendor Intel)
  initialCategoryFilters?: string[]; // Multiple category filters (for CPU Trends)
  initialProductFilters?: string[]; // Multiple product filters (for CPU Trends)
  initialStartDate?: number; // Timestamp for custom date range
  initialEndDate?: number; // Timestamp for custom date range
}

type IntelligenceSubTab = 'scenario' | 'trends' | 'vendors' | 'alerts';

interface ProductCPUData {
  cpu: string | null;
  margin: number | null;
  trend: 'up' | 'down' | 'stable';
  trendValue: string | null;
  topDriver: string | null;
  isComplete: boolean;
  breakdown: any[];
}

export default function CostIntelligenceTab({
  companyId,
  finishedProducts,
  categories,
  invoices,
  onOpenCategoryManager,
  onViewInvoice,
  onEditInvoice,
  onDuplicateInvoice,
  initialIntelligenceTab,
  initialVendorFilter,
  initialCategoryFilter,
  initialCategoryFilters,
  initialProductFilters,
  initialStartDate,
  initialEndDate,
}: CostIntelligenceTabProps) {
  // Product selection state
  const [selectedProductsForComparison, setSelectedProductsForComparison] = useState<Set<string>>(
    initialProductFilters ? new Set(initialProductFilters) : new Set()
  );
  const [comparisonCategoryFilter, setComparisonCategoryFilter] = useState<Set<string>>(
    initialCategoryFilter ? new Set([initialCategoryFilter]) :
    initialCategoryFilters ? new Set(initialCategoryFilters) :
    new Set()
  );
  const [comparisonVariantFilter, setComparisonVariantFilter] = useState<Set<string>>(new Set());
  const [comparisonVendorFilter, setComparisonVendorFilter] = useState<Set<string>>(
    initialVendorFilter ? new Set([initialVendorFilter]) : new Set()
  );
  const [comparisonDateRange, setComparisonDateRange] = useState<'3mo' | '6mo' | '12mo' | 'last-calendar-year' | 'this-calendar-year' | 'custom' | 'all'>(
    initialStartDate && initialEndDate ? 'custom' : '12mo'
  );
  const [comparisonCustomStartDate, setComparisonCustomStartDate] = useState<string>(() => {
    if (!initialStartDate) return '';
    const date = new Date(initialStartDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [comparisonCustomEndDate, setComparisonCustomEndDate] = useState<string>(() => {
    if (!initialEndDate) return '';
    const date = new Date(initialEndDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showVariantDropdown, setShowVariantDropdown] = useState(false);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);

  // Product CPU data
  const [productCPUData, setProductCPUData] = useState<Map<string, ProductCPUData>>(new Map());
  const [isLoadingCPUData, setIsLoadingCPUData] = useState(false);

  // Product recipes (defines which variant each product uses for each component)
  const [recipes, setRecipes] = useState<CPGRecipe[]>([]);

  // Sub-tab navigation
  const [intelligenceTab, setIntelligenceTab] = useState<IntelligenceSubTab>(initialIntelligenceTab || 'scenario');

  // Ref for focus management - scroll to content after selection
  const analysisContentRef = useRef<HTMLDivElement>(null);

  // TODO: Phase 3A - Uncomment when Scenario Builder component is created
  // const [scenarioAdjustments, setScenarioAdjustments] = useState<Map<string, Map<string, number>>>(new Map());
  // const [scenarioMSRP, setScenarioMSRP] = useState<Map<string, number>>(new Map());
  // const [adjustmentMode, setAdjustmentMode] = useState<Map<string, Map<string, 'percentage' | 'dollar'>>>(new Map());
  // const [msrpAdjustmentMode, setMsrpAdjustmentMode] = useState<Map<string, 'percentage' | 'dollar'>>(new Map());

  // Track the last valid date range to prevent reload when switching to incomplete custom
  const lastValidDateRangeRef = useRef<string>('12mo');

  // Stable date range - only updates when there's an actual complete date range change
  // This prevents reload when switching to 'custom' without dates filled
  const stableDateRangeKey = useMemo(() => {
    let newValue: string;

    if (comparisonDateRange === 'custom') {
      // Only update if BOTH dates are filled
      if (comparisonCustomStartDate && comparisonCustomEndDate) {
        newValue = `custom|${comparisonCustomStartDate}|${comparisonCustomEndDate}`;
      } else {
        // If custom selected but incomplete, keep using the last valid date range
        return lastValidDateRangeRef.current;
      }
    } else {
      // For all other date ranges, use the value directly
      newValue = comparisonDateRange;
    }

    // Update the ref with the new valid value
    lastValidDateRangeRef.current = newValue;
    return newValue;
  }, [comparisonDateRange, comparisonCustomStartDate, comparisonCustomEndDate]);

  // Load CPU data for selected products
  const loadProductCPUData = useCallback(async (productIds: string[]) => {
    if (productIds.length === 0) {
      setProductCPUData(new Map());
      setIsLoadingCPUData(false);
      return;
    }

    try {
      setIsLoadingCPUData(true);
      const cpuDataMap = new Map<string, ProductCPUData>();

      // Calculate date range based on selected filter
      const now = Date.now();
      let dateRange: { start: number; end: number } | null = null;

      switch (comparisonDateRange) {
        case '3mo':
          dateRange = { start: now - 90 * 24 * 60 * 60 * 1000, end: now };
          break;
        case '6mo':
          dateRange = { start: now - 180 * 24 * 60 * 60 * 1000, end: now };
          break;
        case '12mo':
          dateRange = { start: now - 365 * 24 * 60 * 60 * 1000, end: now };
          break;
        case 'last-calendar-year': {
          const lastYear = new Date().getFullYear() - 1;
          dateRange = {
            start: new Date(lastYear, 0, 1, 0, 0, 0, 0).getTime(),
            end: new Date(lastYear, 11, 31, 23, 59, 59, 999).getTime(),
          };
          break;
        }
        case 'this-calendar-year': {
          const thisYear = new Date().getFullYear();
          dateRange = {
            start: new Date(thisYear, 0, 1, 0, 0, 0, 0).getTime(),
            end: now,
          };
          break;
        }
        case 'custom':
          if (comparisonCustomStartDate && comparisonCustomEndDate) {
            dateRange = {
              start: new Date(comparisonCustomStartDate).getTime(),
              end: new Date(comparisonCustomEndDate).getTime(),
            };
          }
          break;
        case 'all':
        default:
          dateRange = null; // No filtering
          break;
      }

      for (const productId of productIds) {
        const product = finishedProducts.find(p => p.id === productId);
        if (!product) continue;

        // Calculate current CPU with date range
        const cpuResult = await cpuCalculatorService.calculateFinishedProductCPU(productId, companyId, dateRange);

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
            topDriver = sorted[0]?.categoryName || null;
          }
        }

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
    } finally {
      setIsLoadingCPUData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedProducts, companyId, stableDateRangeKey]);

  // Handle date blur to convert 2-digit years to 20xx
  const handleDateBlur = useCallback((value: string, setter: (value: string) => void) => {
    if (!value) return;

    const parts = value.split('-');
    if (parts.length === 3) {
      let [year, month, day] = parts;

      // Parse year as integer
      const yearNum = parseInt(year, 10);

      // If year is 0-99, assume 20xx
      if (yearNum >= 0 && yearNum <= 99) {
        year = '20' + String(yearNum).padStart(2, '0');
        setter(`${year}-${month}-${day}`);
      }
    }
  }, []);

  // Load recipes for filtering
  useEffect(() => {
    const loadRecipes = async () => {
      try {
        const allRecipes = await db.cpgRecipes
          .where('company_id')
          .equals(companyId)
          .and(r => !r.deleted_at)
          .toArray();
        console.log('📚 Loaded recipes:', allRecipes.length, allRecipes);
        setRecipes(allRecipes);
      } catch (err) {
        console.error('Failed to load recipes:', err);
      }
    };

    loadRecipes();
  }, [companyId]);

  // Load CPU data for ALL products on mount (needed for filtering)
  useEffect(() => {
    if (finishedProducts.length > 0) {
      loadProductCPUData(finishedProducts.map(p => p.id));
    }
  }, [finishedProducts, loadProductCPUData]);

  // Reload when selected products change (in case new products added)
  useEffect(() => {
    if (selectedProductsForComparison.size > 0) {
      const selectedIds = Array.from(selectedProductsForComparison);
      const missingData = selectedIds.filter(id => !productCPUData.has(id));
      if (missingData.length > 0) {
        loadProductCPUData(missingData);
      }
    }
  }, [selectedProductsForComparison, productCPUData, loadProductCPUData]);

  // Focus management: Scroll to analysis content after selection
  useEffect(() => {
    if (selectedProductsForComparison.size > 0 && !isLoadingCPUData && analysisContentRef.current) {
      // Wait a tiny moment for render to complete, then scroll
      setTimeout(() => {
        analysisContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedProductsForComparison.size, isLoadingCPUData]);

  // Get unique variants from categories
  const availableVariants = useMemo(() => {
    const variants = new Set<string>();
    categories.forEach(cat => {
      if (!cat.deleted_at && cat.variants) {
        cat.variants.forEach(v => variants.add(v));
      }
    });
    return Array.from(variants).sort();
  }, [categories]);

  // Get unique vendors from invoices
  const availableVendors = useMemo(() => {
    const vendors = new Set<string>();
    invoices.forEach(inv => {
      if (!inv.deleted_at && inv.vendor_name) {
        vendors.add(inv.vendor_name);
      }
    });
    return Array.from(vendors).sort();
  }, [invoices]);

  // Get filtered products based on category, variant, and vendor filters
  // This determines which PRODUCTS to show, not which components within products
  const getFilteredProducts = useCallback(() => {
    // If no filters active, show all products
    if (comparisonCategoryFilter.size === 0 &&
        comparisonVariantFilter.size === 0 &&
        comparisonVendorFilter.size === 0) {
      return finishedProducts;
    }

    return finishedProducts.filter(product => {
      const cpuData = productCPUData.get(product.id);
      const hasCPUData = cpuData && cpuData.breakdown && cpuData.breakdown.length > 0;

      // Category filter - requires CPU data, but show product if data not loaded yet (optimistic)
      if (comparisonCategoryFilter.size > 0) {
        if (!hasCPUData) {
          // Data not loaded yet - include product optimistically
          return true;
        }
        const hasCategory = cpuData.breakdown.some(b => comparisonCategoryFilter.has(b.categoryId));
        if (!hasCategory) return false;
      }

      // Variant filter - check if product's recipe specifies one of the selected variants
      if (comparisonVariantFilter.size > 0) {
        const productRecipes = recipes.filter(r => r.finished_product_id === product.id);
        const hasVariant = productRecipes.some(recipe => {
          const recipeVariant = recipe.variant || '';
          return comparisonVariantFilter.has(recipeVariant);
        });
        if (!hasVariant) return false;
      }

      // Vendor filter - check invoices (doesn't strictly need CPU data)
      if (comparisonVendorFilter.size > 0) {
        if (!hasCPUData) {
          // Data not loaded yet - include product optimistically
          return true;
        }
        const hasVendor = invoices.some(invoice => {
          if (invoice.deleted_at || !comparisonVendorFilter.has(invoice.vendor_name || '')) return false;
          if (!invoice.cost_attribution) return false;

          return Object.values(invoice.cost_attribution).some(attr => {
            return cpuData.breakdown.some(b => b.categoryId === attr.category_id);
          });
        });
        if (!hasVendor) return false;
      }

      return true;
    });
  }, [finishedProducts, comparisonCategoryFilter, comparisonVariantFilter, comparisonVendorFilter, productCPUData, invoices, recipes]);

  // Quick select functions
  const selectAllProducts = useCallback(() => {
    const filtered = getFilteredProducts();
    setSelectedProductsForComparison(new Set(filtered.map(p => p.id)));
  }, [getFilteredProducts]);

  const selectTopMarginProducts = useCallback((count: number = 5) => {
    const productsWithMargin = finishedProducts
      .map(p => {
        const data = productCPUData.get(p.id);
        return { id: p.id, margin: data?.margin ?? -999 };
      })
      .sort((a, b) => b.margin - a.margin)
      .slice(0, count)
      .map(p => p.id);

    setSelectedProductsForComparison(new Set(productsWithMargin));
  }, [finishedProducts, productCPUData]);

  const selectBottomMarginProducts = useCallback((count: number = 5) => {
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
  }, [finishedProducts, productCPUData]);

  const selectMissingCostData = useCallback(() => {
    const productsWithMissingData = finishedProducts
      .filter(p => {
        const data = productCPUData.get(p.id);
        return !data?.isComplete;
      })
      .map(p => p.id);

    setSelectedProductsForComparison(new Set(productsWithMissingData));
  }, [finishedProducts, productCPUData]);

  // TODO: Phase 3A - Uncomment when Scenario Builder component is created
  // const calculateScenarioCPU = useCallback((productId: string): { cpu: number; components: any[] } | null => {
  //   const data = productCPUData.get(productId);
  //   if (!data || !data.breakdown || data.breakdown.length === 0) return null;
  //
  //   const adjustments = scenarioAdjustments.get(productId) || new Map();
  //   let totalCPU = 0;
  //   const components = data.breakdown.map(component => {
  //     const baseSubtotal = component.subtotal ? parseFloat(component.subtotal) : 0;
  //     const adjustment = adjustments.get(component.categoryId) || 0;
  //     const adjustedSubtotal = baseSubtotal * (1 + adjustment / 100);
  //     totalCPU += adjustedSubtotal;
  //
  //     return {
  //       ...component,
  //       adjustment,
  //       adjustedSubtotal
  //     };
  //   });
  //
  //   return { cpu: totalCPU, components };
  // }, [productCPUData, scenarioAdjustments]);

  // TODO: Phase 3A - Uncomment when Scenario Builder component is created
  // const calculateScenarioMargin = useCallback((productId: string, scenarioCPU: number): number | null => {
  //   const product = finishedProducts.find(p => p.id === productId);
  //   if (!product) return null;
  //
  //   const msrp = scenarioMSRP.get(productId) || (product.msrp ? parseFloat(product.msrp) : null);
  //   if (!msrp) return null;
  //
  //   return ((msrp - scenarioCPU) / msrp) * 100;
  // }, [finishedProducts, scenarioMSRP]);

  if (finishedProducts.length === 0) {
    return (
      <div id="comparison-panel" role="tabpanel" aria-labelledby="comparison-tab">
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Cost Intelligence</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
            Compare product costs, margins, and pricing trends side-by-side to identify your most profitable products.
          </p>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon} aria-hidden="true">📦</div>
            <p className={styles.emptyText}>
              No finished products defined yet. Add your first product to start analyzing profitability.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // Analysis type descriptions
  const analysisTypes = {
    scenario: {
      title: 'Scenario Builder',
      color: '#4b006e',
    },
    trends: {
      title: 'CPU Trends',
      color: '#7c3aed',
    },
    vendors: {
      title: 'Vendor Intel',
      color: '#6366f1',
    },
    alerts: {
      title: 'Smart Alerts',
      color: '#8b5cf6',
    },
  };

  return (
    <div id="comparison-panel" role="tabpanel" aria-labelledby="comparison-tab">
      <section className={styles.section}>
        {/* Analysis Type Tabs */}
        <div className="cost-intelligence-analysis-tabs" style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          borderBottom: '2px solid #e0e0e0',
          justifyContent: 'center',
        }}>
          {(Object.keys(analysisTypes) as IntelligenceSubTab[]).map((type) => {
            const analysis = analysisTypes[type];
            const isActive = intelligenceTab === type;
            return (
              <button
                key={type}
                className="cost-intelligence-analysis-tab"
                onClick={() => setIntelligenceTab(type)}
                style={{
                  padding: '1rem 1.5rem',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(232, 212, 160, 0.1) 0%, rgba(212, 175, 55, 0.15) 100%)'
                    : 'none',
                  color: isActive ? '#D4AF37' : '#666',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #D4AF37' : '3px solid transparent',
                  fontSize: '1rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '-2px',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#D4AF37';
                    e.currentTarget.style.background = 'rgba(212, 175, 55, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#666';
                    e.currentTarget.style.background = 'none';
                  }
                }}
              >
                {analysis.title}
              </button>
            );
          })}
        </div>

            {/* Product Selector with Filters */}
        <div style={{
          background: '#ffffff',
          borderLeft: '4px solid #D4AF37',
          borderRight: '4px solid #D4AF37',
          borderBottom: '4px solid #D4AF37',
          borderTop: 'none',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem',
          overflow: 'visible',
          boxShadow: '0 2px 8px rgba(184, 134, 11, 0.15)',
        }}>
          {/* Filter Row */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Product Dropdown Selector */}
            <div style={{ position: 'relative', flex: '1 1 auto', minWidth: '120px' }}>
              <button
                onClick={() => setShowProductDropdown(!showProductDropdown)}
                aria-expanded={showProductDropdown}
                aria-label="Select products for comparison"
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  border: '2px solid #D4AF37',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: '#E5F6DF',
                  color: '#475569',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <span>
                  {selectedProductsForComparison.size === 0
                    ? 'Products'
                    : selectedProductsForComparison.size === finishedProducts.length
                    ? `All (${finishedProducts.length})`
                    : `${selectedProductsForComparison.size} Selected`}
                </span>
                <span aria-hidden="true" style={{ fontSize: '0.75rem' }}>{showProductDropdown ? '▲' : '▼'}</span>
              </button>

              {showProductDropdown && (
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
                  zIndex: 1000,
                  maxHeight: '250px',
                  overflowY: 'auto',
                }}>
                  {/* Select All / Clear All */}
                  <div style={{
                    padding: '0.375rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '0.375rem',
                  }}>
                    <button
                      onClick={() => {
                        setSelectedProductsForComparison(new Set(getFilteredProducts().map(p => p.id)));
                        setShowProductDropdown(false);
                      }}
                      aria-label="Select all products"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedProductsForComparison(new Set())}
                      aria-label="Clear all selected products"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: 'white',
                        color: '#64748b',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Product List */}
                  {getFilteredProducts().map(product => (
                    <label
                      key={product.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.4rem 0.625rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f8fafc',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProductsForComparison.has(product.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedProductsForComparison);
                          if (e.target.checked) {
                            newSet.add(product.id);
                          } else {
                            newSet.delete(product.id);
                          }
                          setSelectedProductsForComparison(newSet);
                        }}
                        style={{ marginRight: '0.5rem' }}
                        aria-label={`Select ${product.name}`}
                      />
                      <span style={{ fontSize: '0.8125rem' }}>{product.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Category Filter */}
            <div style={{ position: 'relative', flex: '1 1 auto', minWidth: '120px' }}>
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                aria-expanded={showCategoryDropdown}
                aria-label="Filter by categories"
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  border: '2px solid #D4AF37',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: '#E5F6DF',
                  color: '#475569',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <span>
                  {comparisonCategoryFilter.size === 0
                    ? 'Categories'
                    : `${comparisonCategoryFilter.size} Selected`}
                </span>
                <span aria-hidden="true" style={{ fontSize: '0.75rem' }}>{showCategoryDropdown ? '▲' : '▼'}</span>
              </button>

              {showCategoryDropdown && (
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
                  zIndex: 1000,
                  maxHeight: '250px',
                  overflowY: 'auto',
                }}>
                  {/* Select All / Clear All */}
                  <div style={{
                    padding: '0.375rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '0.375rem',
                  }}>
                    <button
                      onClick={() => {
                        const allCategories = categories.filter(cat => !cat.deleted_at).map(cat => cat.id);
                        setComparisonCategoryFilter(new Set(allCategories));
                        setShowCategoryDropdown(false);
                      }}
                      aria-label="Select all categories"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setComparisonCategoryFilter(new Set())}
                      aria-label="Clear all categories"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: 'white',
                        color: '#64748b',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Category List */}
                  {categories.filter(cat => !cat.deleted_at).map(cat => (
                    <label
                      key={cat.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.4rem 0.625rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f8fafc',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <input
                        type="checkbox"
                        checked={comparisonCategoryFilter.has(cat.id)}
                        onChange={(e) => {
                          const newSet = new Set(comparisonCategoryFilter);
                          if (e.target.checked) {
                            newSet.add(cat.id);
                          } else {
                            newSet.delete(cat.id);
                          }
                          setComparisonCategoryFilter(newSet);
                        }}
                        style={{ marginRight: '0.5rem' }}
                        aria-label={`Select ${cat.name}`}
                      />
                      <span style={{ fontSize: '0.8125rem' }}>{cat.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Variant Filter */}
            <div style={{ position: 'relative', flex: '1 1 auto', minWidth: '110px' }}>
              <button
                onClick={() => setShowVariantDropdown(!showVariantDropdown)}
                aria-expanded={showVariantDropdown}
                aria-label="Filter by variants"
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  border: '2px solid #D4AF37',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: '#E5F6DF',
                  color: '#475569',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <span>
                  {comparisonVariantFilter.size === 0
                    ? 'Variants'
                    : `${comparisonVariantFilter.size} Selected`}
                </span>
                <span aria-hidden="true" style={{ fontSize: '0.75rem' }}>{showVariantDropdown ? '▲' : '▼'}</span>
              </button>

              {showVariantDropdown && (
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
                  zIndex: 1000,
                  maxHeight: '250px',
                  overflowY: 'auto',
                }}>
                  {/* Select All / Clear All */}
                  <div style={{
                    padding: '0.375rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '0.375rem',
                  }}>
                    <button
                      onClick={() => {
                        setComparisonVariantFilter(new Set(availableVariants));
                        setShowVariantDropdown(false);
                      }}
                      aria-label="Select all variants"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setComparisonVariantFilter(new Set())}
                      aria-label="Clear all variants"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: 'white',
                        color: '#64748b',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Variant List */}
                  {availableVariants.map(variant => (
                    <label
                      key={variant}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.4rem 0.625rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f8fafc',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <input
                        type="checkbox"
                        checked={comparisonVariantFilter.has(variant)}
                        onChange={(e) => {
                          const newSet = new Set(comparisonVariantFilter);
                          if (e.target.checked) {
                            newSet.add(variant);
                          } else {
                            newSet.delete(variant);
                          }
                          setComparisonVariantFilter(newSet);
                        }}
                        style={{ marginRight: '0.5rem' }}
                        aria-label={`Select ${variant}`}
                      />
                      <span style={{ fontSize: '0.8125rem' }}>{variant}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Vendor Filter */}
            <div style={{ position: 'relative', flex: '1 1 auto', minWidth: '110px' }}>
              <button
                onClick={() => setShowVendorDropdown(!showVendorDropdown)}
                aria-expanded={showVendorDropdown}
                aria-label="Filter by vendors"
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  border: '2px solid #D4AF37',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: '#E5F6DF',
                  color: '#475569',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <span>
                  {comparisonVendorFilter.size === 0
                    ? 'Vendors'
                    : `${comparisonVendorFilter.size} Selected`}
                </span>
                <span aria-hidden="true" style={{ fontSize: '0.75rem' }}>{showVendorDropdown ? '▲' : '▼'}</span>
              </button>

              {showVendorDropdown && (
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
                  zIndex: 1000,
                  maxHeight: '250px',
                  overflowY: 'auto',
                }}>
                  {/* Select All / Clear All */}
                  <div style={{
                    padding: '0.375rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '0.375rem',
                  }}>
                    <button
                      onClick={() => {
                        setComparisonVendorFilter(new Set(availableVendors));
                        setShowVendorDropdown(false);
                      }}
                      aria-label="Select all vendors"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setComparisonVendorFilter(new Set())}
                      aria-label="Clear all vendors"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: 'white',
                        color: '#64748b',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Vendor List */}
                  {availableVendors.map(vendor => (
                    <label
                      key={vendor}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.4rem 0.625rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f8fafc',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <input
                        type="checkbox"
                        checked={comparisonVendorFilter.has(vendor)}
                        onChange={(e) => {
                          const newSet = new Set(comparisonVendorFilter);
                          if (e.target.checked) {
                            newSet.add(vendor);
                          } else {
                            newSet.delete(vendor);
                          }
                          setComparisonVendorFilter(newSet);
                        }}
                        style={{ marginRight: '0.5rem' }}
                        aria-label={`Select ${vendor}`}
                      />
                      <span style={{ fontSize: '0.8125rem' }}>{vendor}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Date Range for Analysis */}
            <select
              value={comparisonDateRange}
              onChange={(e) => setComparisonDateRange(e.target.value as any)}
              aria-label="Select date range for analysis"
              style={{
                flex: '1 1 auto',
                minWidth: '140px',
                padding: '0.625rem 0.875rem',
                border: '2px solid #D4AF37',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 500,
                background: '#E5F6DF',
                color: '#475569',
                cursor: 'pointer',
                transition: 'all 0.2s',
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

            {/* Custom Date Inputs - shown when custom is selected */}
            {comparisonDateRange === 'custom' && (
              <>
                <input
                  type="date"
                  value={comparisonCustomStartDate}
                  onChange={(e) => setComparisonCustomStartDate(e.target.value)}
                  onBlur={(e) => handleDateBlur(e.target.value, setComparisonCustomStartDate)}
                  aria-label="Start date"
                  style={{
                    flex: '0 1 140px',
                    padding: '0.625rem 0.875rem',
                    border: '2px solid #D4AF37',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    background: '#E5F6DF',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                />
                <input
                  type="date"
                  value={comparisonCustomEndDate}
                  onChange={(e) => setComparisonCustomEndDate(e.target.value)}
                  onBlur={(e) => handleDateBlur(e.target.value, setComparisonCustomEndDate)}
                  aria-label="End date"
                  style={{
                    flex: '0 1 140px',
                    padding: '0.625rem 0.875rem',
                    border: '2px solid #D4AF37',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    background: '#E5F6DF',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                />
              </>
            )}
          </div>

          {/* Quick Filter Buttons + Selected Products (inline) */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
            <button
              onClick={selectAllProducts}
              style={{
                padding: '0.5rem 0.875rem',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                fontWeight: 500,
                color: '#64748b',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.color = '#475569';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              All Products
            </button>
            <button
              onClick={() => selectTopMarginProducts(5)}
              style={{
                padding: '0.5rem 0.875rem',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                fontWeight: 500,
                color: '#64748b',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.color = '#475569';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              Highest Margin Products
            </button>
            <button
              onClick={() => selectBottomMarginProducts(5)}
              style={{
                padding: '0.5rem 0.875rem',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                fontWeight: 500,
                color: '#64748b',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.color = '#475569';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              Lowest Margin Products
            </button>

            {/* Selected Products (Chips) - inline after quick filter buttons */}
            {selectedProductsForComparison.size > 0 && (
              <>
                {Array.from(selectedProductsForComparison).map(productId => {
                  const product = finishedProducts.find(p => p.id === productId);
                  if (!product) return null;
                  return (
                    <div
                      key={productId}
                      className="cost-intelligence-product-chip"
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
                  aria-label="Clear all selected products"
                  style={{
                    padding: '0.375rem 0.75rem',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    color: '#64748b',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#475569';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  Clear All
                </button>
              </>
            )}
          </div>

        </div>

        {/* Loading State for CPU Calculations */}
        {isLoadingCPUData && (
          <div style={{
            background: 'linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%)',
            border: '2px dashed #9333ea',
            borderRadius: '12px',
            padding: '2rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '4px solid #e9d5ff',
              borderTop: '4px solid #7c3aed',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}></div>
            <span style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#4b006e',
            }}>
              Analyzing costs...
            </span>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }

              /* Mobile Responsive Styles */
              @media (max-width: 768px) {
                .cost-intelligence-analysis-tabs {
                  flex-direction: column !important;
                  gap: 0.5rem !important;
                }

                .cost-intelligence-analysis-tab {
                  flex: none !important;
                  width: 100% !important;
                }

                .cost-intelligence-product-chip {
                  display: none !important;
                }

                .cost-intelligence-refine-buttons {
                  display: none !important;
                }
              }
            `}</style>
          </div>
        )}

        {/* Comparison Display */}
        <div ref={analysisContentRef}>
          {/* Tab Content */}
          {intelligenceTab === 'scenario' && (
                  <>
                    {console.log('🎯 Passing to ScenarioBuilderTab:', {
                      recipesCount: recipes.length,
                      recipes: recipes.slice(0, 3),
                      filters: { categoryFilter: comparisonCategoryFilter, variantFilter: comparisonVariantFilter }
                    })}
                    <ScenarioBuilderTab
                      companyId={companyId}
                      selectedProducts={selectedProductsForComparison}
                      productCPUData={productCPUData}
                      finishedProducts={finishedProducts}
                      dateRange={comparisonDateRange}
                      categoryFilter={comparisonCategoryFilter}
                      variantFilter={comparisonVariantFilter}
                      vendorFilter={comparisonVendorFilter}
                      recipes={recipes}
                      invoices={invoices}
                    />
                  </>
                )}

                {intelligenceTab === 'trends' && (
                  <CPUTrendsTab
                    companyId={companyId}
                    selectedProducts={selectedProductsForComparison}
                    productCPUData={productCPUData}
                    products={finishedProducts}
                    categories={categories}
                    invoices={invoices}
                    dateRange={comparisonDateRange}
                    categoryFilter={comparisonCategoryFilter}
                    variantFilter={comparisonVariantFilter}
                    vendorFilter={comparisonVendorFilter}
                  />
                )}

                {intelligenceTab === 'vendors' && (
                  <VendorIntelTab
                    companyId={companyId}
                    selectedProducts={selectedProductsForComparison}
                    productCPUData={productCPUData}
                    invoices={invoices}
                    categories={categories}
                    dateRange={comparisonDateRange}
                    customDateRange={
                      comparisonDateRange === 'custom' && comparisonCustomStartDate && comparisonCustomEndDate
                        ? {
                            start: new Date(comparisonCustomStartDate).getTime(),
                            end: new Date(comparisonCustomEndDate).setHours(23, 59, 59, 999),
                          }
                        : undefined
                    }
                    categoryFilter={comparisonCategoryFilter}
                    variantFilter={comparisonVariantFilter}
                    vendorFilter={comparisonVendorFilter}
                    onOpenCategoryManager={onOpenCategoryManager}
                    onViewInvoice={onViewInvoice}
                    onEditInvoice={onEditInvoice}
                    onDuplicateInvoice={onDuplicateInvoice}
                  />
                )}

                {intelligenceTab === 'alerts' && (
                  <SmartAlertsTab
                    companyId={companyId}
                    selectedProducts={selectedProductsForComparison}
                    productCPUData={productCPUData}
                    categories={categories}
                    invoices={invoices}
                    dateRange={comparisonDateRange}
                    onNavigateToVendorIntel={(filters) => {
                      // Switch to Vendor Intel tab
                      setIntelligenceTab('vendors');

                      // Apply filters from the alert
                      if (filters.categoryId) {
                        setComparisonCategoryFilter(new Set([filters.categoryId]));
                      }
                      if (filters.variant) {
                        setComparisonVariantFilter(new Set([filters.variant]));
                      }
                      if (filters.vendorName) {
                        setComparisonVendorFilter(new Set([filters.vendorName]));
                      }

                      // Scroll to content after tab switch
                      setTimeout(() => {
                        analysisContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 100);
                    }}
                  />
                )}
        </div>
      </section>
    </div>
  );
}
