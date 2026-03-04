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

import { useState, useEffect, useCallback } from 'react';
import type { CPGCategory, CPGInvoice } from '../../../db/schema/cpg.schema';
import { cpuCalculatorService } from '../../../services/cpg/cpuCalculator.service';
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
}: CostIntelligenceTabProps) {
  // Product selection state
  const [selectedProductsForComparison, setSelectedProductsForComparison] = useState<Set<string>>(new Set());
  const [comparisonCategoryFilter, setComparisonCategoryFilter] = useState<string>('all');
  const [comparisonDateRange, setComparisonDateRange] = useState<'3mo' | '6mo' | '12mo' | 'all'>('6mo');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Product CPU data
  const [productCPUData, setProductCPUData] = useState<Map<string, ProductCPUData>>(new Map());

  // Sub-tab navigation
  const [intelligenceTab, setIntelligenceTab] = useState<IntelligenceSubTab>('scenario');

  // TODO: Phase 3A - Uncomment when Scenario Builder component is created
  // const [scenarioAdjustments, setScenarioAdjustments] = useState<Map<string, Map<string, number>>>(new Map());
  // const [scenarioMSRP, setScenarioMSRP] = useState<Map<string, number>>(new Map());
  // const [adjustmentMode, setAdjustmentMode] = useState<Map<string, Map<string, 'percentage' | 'dollar'>>>(new Map());
  // const [msrpAdjustmentMode, setMsrpAdjustmentMode] = useState<Map<string, 'percentage' | 'dollar'>>(new Map());

  // Load CPU data for selected products
  const loadProductCPUData = useCallback(async (productIds: string[]) => {
    if (productIds.length === 0) {
      setProductCPUData(new Map());
      return;
    }

    try {
      const cpuDataMap = new Map<string, ProductCPUData>();

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
    }
  }, [finishedProducts, companyId]);

  // Load CPU data when selected products change
  useEffect(() => {
    if (selectedProductsForComparison.size > 0) {
      loadProductCPUData(Array.from(selectedProductsForComparison));
    }
  }, [selectedProductsForComparison, loadProductCPUData]);

  // Get filtered products based on category filter
  const getFilteredProducts = useCallback(() => {
    return finishedProducts.filter(_product => {
      // Category filter
      if (comparisonCategoryFilter !== 'all') {
        // TODO: Filter by product category when we have that data
        // For now, skip this filter
      }

      return true;
    });
  }, [finishedProducts, comparisonCategoryFilter]);

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

  return (
    <div id="comparison-panel" role="tabpanel" aria-labelledby="comparison-tab">
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Cost Intelligence</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Compare product costs, margins, and pricing trends side-by-side to identify your most profitable products.
        </p>

        {/* Product Selector with Filters */}
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Product Dropdown Selector */}
            <div style={{ position: 'relative', flex: '1 1 300px' }}>
              <button
                onClick={() => setShowProductDropdown(!showProductDropdown)}
                aria-expanded={showProductDropdown}
                aria-label="Select products for comparison"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  {selectedProductsForComparison.size === 0
                    ? '📦 Select Products...'
                    : selectedProductsForComparison.size === finishedProducts.length
                    ? `All Products (${finishedProducts.length})`
                    : `${selectedProductsForComparison.size} Product${selectedProductsForComparison.size === 1 ? '' : 's'} Selected`}
                </span>
                <span aria-hidden="true">{showProductDropdown ? '▲' : '▼'}</span>
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
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}>
                  {/* Select All / Clear All */}
                  <div style={{
                    padding: '0.5rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '0.5rem',
                  }}>
                    <button
                      onClick={() => setSelectedProductsForComparison(new Set(finishedProducts.map(p => p.id)))}
                      aria-label="Select all products"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: '#4b006e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
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
                        background: '#f8fafc',
                        color: '#64748b',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Product List */}
                  {finishedProducts.map(product => (
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
                      <span style={{ fontSize: '0.875rem' }}>{product.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Category Filter */}
            <select
              value={comparisonCategoryFilter}
              onChange={(e) => setComparisonCategoryFilter(e.target.value)}
              aria-label="Filter by category"
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
              aria-label="Select date range for analysis"
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
                  aria-label="Clear all selected products"
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
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">📊</div>
            <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
              Select products to compare
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              Use the dropdown above or click a quick select button to get started
            </p>
          </div>
        ) : (
          <div>
            {/* Intelligence Sub-Tabs */}
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              overflow: 'hidden',
            }}>
              {/* Tab Navigation */}
              <div
                role="tablist"
                aria-label="Cost Intelligence analysis types"
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  background: '#f8fafc',
                  borderBottom: '2px solid #e5e7eb',
                }}
              >
                <button
                  role="tab"
                  aria-selected={intelligenceTab === 'scenario'}
                  aria-controls="scenario-panel"
                  onClick={() => setIntelligenceTab('scenario')}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: intelligenceTab === 'scenario' ? '#4b006e' : 'white',
                    borderRadius: '8px',
                    fontWeight: 600,
                    color: intelligenceTab === 'scenario' ? 'white' : '#64748b',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                  }}
                >
                  Scenario Builder
                </button>
                <button
                  role="tab"
                  aria-selected={intelligenceTab === 'trends'}
                  aria-controls="trends-panel"
                  onClick={() => setIntelligenceTab('trends')}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: intelligenceTab === 'trends' ? '#4b006e' : 'white',
                    borderRadius: '8px',
                    fontWeight: 600,
                    color: intelligenceTab === 'trends' ? 'white' : '#64748b',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                  }}
                >
                  CPU Trends
                </button>
                <button
                  role="tab"
                  aria-selected={intelligenceTab === 'vendors'}
                  aria-controls="vendors-panel"
                  onClick={() => setIntelligenceTab('vendors')}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: intelligenceTab === 'vendors' ? '#4b006e' : 'white',
                    borderRadius: '8px',
                    fontWeight: 600,
                    color: intelligenceTab === 'vendors' ? 'white' : '#64748b',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                  }}
                >
                  Vendor Intel
                </button>
                <button
                  role="tab"
                  aria-selected={intelligenceTab === 'alerts'}
                  aria-controls="alerts-panel"
                  onClick={() => setIntelligenceTab('alerts')}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: intelligenceTab === 'alerts' ? '#4b006e' : 'white',
                    borderRadius: '8px',
                    fontWeight: 600,
                    color: intelligenceTab === 'alerts' ? 'white' : '#64748b',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                  }}
                >
                  Smart Alerts
                </button>
              </div>

              {/* Tab Content - Placeholders for sub-components */}
              <div style={{ padding: '1.5rem' }}>
                {intelligenceTab === 'scenario' && (
                  <ScenarioBuilderTab
                    companyId={companyId}
                    selectedProducts={selectedProductsForComparison}
                    productCPUData={productCPUData}
                    finishedProducts={finishedProducts}
                  />
                )}

                {intelligenceTab === 'trends' && (
                  <CPUTrendsTab
                    companyId={companyId}
                    selectedProducts={selectedProductsForComparison}
                    productCPUData={productCPUData}
                    categories={categories}
                    invoices={invoices}
                  />
                )}

                {intelligenceTab === 'vendors' && (
                  <VendorIntelTab
                    companyId={companyId}
                    selectedProducts={selectedProductsForComparison}
                    productCPUData={productCPUData}
                    invoices={invoices}
                    categories={categories}
                  />
                )}

                {intelligenceTab === 'alerts' && (
                  <SmartAlertsTab
                    companyId={companyId}
                    selectedProducts={selectedProductsForComparison}
                    productCPUData={productCPUData}
                    categories={categories}
                    invoices={invoices}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
