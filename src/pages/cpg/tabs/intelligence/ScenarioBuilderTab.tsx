/**
 * Scenario Builder Tab Component
 *
 * Interactive "what-if" analysis tool for cost and pricing scenarios.
 *
 * Features:
 * - Component cost adjustment sliders (-50% to +100%)
 * - MSRP adjustment sliders (70% to 150% of base)
 * - Real-time CPU and margin recalculation
 * - Visual comparison: Current vs Scenario
 * - Reset functionality per product
 * - Visual highlights for adjusted components
 *
 * Requirements:
 * - WCAG 2.1 AA: Sliders have labels, keyboard accessible
 * - Performance: useMemo for calculations, useCallback for handlers
 * - Type Safety: No any types except for schema types
 * - Security: Validate companyId
 *
 * Props:
 * - companyId: Company ID for security validation
 * - selectedProducts: Set of product IDs to display scenarios for
 * - productCPUData: Map of product CPU data with breakdowns
 * - finishedProducts: Array of finished product records
 */

import { useState, useMemo, useCallback } from 'react';
import styles from './ScenarioBuilderTab.module.css';

// Product CPU data structure
export interface ProductCPUData {
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
  subtotal: string | null;
  itemCount: number;
}

export interface ScenarioBuilderTabProps {
  companyId: string;
  selectedProducts: Set<string>;
  productCPUData: Map<string, ProductCPUData>;
  finishedProducts: any[]; // TODO: Add proper type from schema
  dateRange?: '3mo' | '6mo' | '12mo' | 'last-calendar-year' | 'this-calendar-year' | 'custom' | 'all';
  categoryFilter?: string;
  variantFilter?: string;
  vendorFilter?: string;
  recipes?: any[];
  invoices?: any[];
}

export default function ScenarioBuilderTab({
  companyId,
  selectedProducts,
  productCPUData,
  finishedProducts,
  categoryFilter = 'all',
  variantFilter = 'all',
  vendorFilter = 'all',
  recipes = [],
  invoices = [],
}: ScenarioBuilderTabProps) {
  // Validate companyId exists (security requirement)
  if (!companyId || typeof companyId !== 'string') {
    throw new Error('Invalid companyId provided to ScenarioBuilderTab');
  }

  // State: Scenario adjustments per product per component
  // Map<productId, Map<componentId, adjustment %>>
  const [scenarioAdjustments, setScenarioAdjustments] = useState<Map<string, Map<string, number>>>(
    new Map()
  );

  // State: Scenario MSRP per product
  // Map<productId, new MSRP>
  const [scenarioMSRP, setScenarioMSRP] = useState<Map<string, number>>(new Map());

  // Format number with commas
  const formatNumberWithCommas = useCallback((num: number): string => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  // Filter components based on active filters
  const filterComponents = useCallback((productId: string, components: ComponentBreakdown[]): ComponentBreakdown[] => {
    if (!components) return [];

    console.log('🔍 Filtering components for product:', productId);
    console.log('Active filters:', { categoryFilter, variantFilter, vendorFilter });
    console.log('Total recipes received:', recipes?.length || 0);
    console.log('Recipes array:', recipes);

    return components.filter(component => {
      console.log(`  Checking component: ${component.categoryName} (${component.categoryId})`);

      // Category filter
      if (categoryFilter !== 'all' && component.categoryId !== categoryFilter) {
        console.log('    ❌ Category mismatch');
        return false;
      }

      // Variant filter - check if THIS product uses this variant for this component
      if (variantFilter !== 'all') {
        const productRecipes = recipes.filter(r => r.finished_product_id === productId);
        console.log(`    Product has ${productRecipes.length} recipes`);

        const componentRecipe = productRecipes.find(r => r.category_id === component.categoryId);
        console.log('    Component recipe:', componentRecipe);

        if (!componentRecipe) {
          console.log('    ❌ No recipe found for this component');
          return false;
        }

        const recipeVariant = componentRecipe.variant || '';
        console.log(`    Recipe variant: "${recipeVariant}" vs Filter: "${variantFilter}"`);

        if (recipeVariant !== variantFilter) {
          console.log('    ❌ Variant mismatch');
          return false;
        }
      }

      // Vendor filter - check if this component has been purchased from the selected vendor
      if (vendorFilter !== 'all') {
        const hasVendor = invoices.some(invoice => {
          if (invoice.deleted_at || invoice.vendor_name !== vendorFilter) return false;
          if (!invoice.cost_attribution) return false;

          return Object.values(invoice.cost_attribution).some((attr: any) => {
            return attr.category_id === component.categoryId;
          });
        });
        if (!hasVendor) {
          console.log('    ❌ Vendor mismatch');
          return false;
        }
      }

      console.log('    ✅ Component passes filter');
      return true;
    });
  }, [categoryFilter, variantFilter, vendorFilter, recipes, invoices]);

  // Calculate scenario CPU for a product based on component adjustments
  const calculateScenarioCPU = useCallback(
    (productId: string): { cpu: number; components: ComponentBreakdown[] } | null => {
      const data = productCPUData.get(productId);
      if (!data || !data.breakdown || data.breakdown.length === 0) return null;

      const adjustments = scenarioAdjustments.get(productId) || new Map();
      let totalCPU = 0;
      const components = data.breakdown.map((component) => {
        const baseSubtotal = component.subtotal ? parseFloat(component.subtotal) : 0;
        const adjustment = adjustments.get(component.categoryId) || 0;
        const adjustedSubtotal = baseSubtotal * (1 + adjustment / 100);
        totalCPU += adjustedSubtotal;

        return {
          ...component,
          adjustedSubtotal,
        };
      });

      return { cpu: totalCPU, components };
    },
    [productCPUData, scenarioAdjustments]
  );

  // Calculate scenario margin
  const calculateScenarioMargin = useCallback(
    (productId: string, scenarioCPU: number): number | null => {
      const product = finishedProducts.find((p) => p.id === productId);
      if (!product) return null;

      const msrp = scenarioMSRP.get(productId) || (product.msrp ? parseFloat(product.msrp) : null);
      if (!msrp) return null;

      return ((msrp - scenarioCPU) / msrp) * 100;
    },
    [finishedProducts, scenarioMSRP]
  );

  // Handle component adjustment change
  const handleComponentAdjustment = useCallback(
    (productId: string, componentId: string, adjustment: number) => {
      setScenarioAdjustments((prev) => {
        const newMap = new Map(prev);
        const productAdj = newMap.get(productId) || new Map();

        if (adjustment === 0) {
          productAdj.delete(componentId);
        } else {
          productAdj.set(componentId, adjustment);
        }

        newMap.set(productId, productAdj);
        return newMap;
      });
    },
    []
  );

  // Handle MSRP adjustment change
  const handleMSRPAdjustment = useCallback((productId: string, newMSRP: number) => {
    setScenarioMSRP((prev) => new Map(prev).set(productId, newMSRP));
  }, []);

  // Reset scenario for a product
  const resetProductScenario = useCallback((productId: string) => {
    setScenarioAdjustments((prev) => {
      const newMap = new Map(prev);
      newMap.delete(productId);
      return newMap;
    });
    setScenarioMSRP((prev) => {
      const newMap = new Map(prev);
      newMap.delete(productId);
      return newMap;
    });
  }, []);

  // Get products to display
  const productsToDisplay = useMemo(() => {
    return Array.from(selectedProducts)
      .map((productId) => {
        const product = finishedProducts.find((p) => p.id === productId);
        const cpuData = productCPUData.get(productId);
        return { productId, product, cpuData };
      })
      .filter((item) => item.product && item.cpuData && item.cpuData.breakdown && item.cpuData.breakdown.length > 0);
  }, [selectedProducts, finishedProducts, productCPUData]);

  // Empty state
  if (productsToDisplay.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon} aria-hidden="true">
          🎯
        </div>
        <p className={styles.emptyTitle}>
          No Products Selected
        </p>
        <p className={styles.emptyDescription}>
          Select products above to build cost and pricing scenarios
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container} role="tabpanel" id="scenario-panel" aria-labelledby="scenario-tab">
      {productsToDisplay.map(({ productId, product, cpuData }) => {
        if (!product || !cpuData) return null;

        const baseCPU = cpuData.cpu ? parseFloat(cpuData.cpu) : 0;
        const baseMSRP = product.msrp ? parseFloat(product.msrp) : 0;
        const baseMargin = cpuData.margin || 0;

        // Filter components based on active filters
        const filteredComponents = filterComponents(productId, cpuData.breakdown);

        const scenario = calculateScenarioCPU(productId);
        const scenarioCPUValue = scenario?.cpu || baseCPU;
        const scenarioMSRPValue = scenarioMSRP.get(productId) || baseMSRP;
        const scenarioMarginValue = calculateScenarioMargin(productId, scenarioCPUValue) || baseMargin;

        const hasAdjustments = (scenarioAdjustments.get(productId)?.size || 0) > 0 || scenarioMSRP.has(productId);

        return (
          <div key={productId} className={styles.productCard}>
            <h3 className={styles.productName}>
              {product.name}
              {hasAdjustments && <span className={styles.productBadge}>Modified</span>}
            </h3>

            {/* Current vs Scenario Comparison */}
            <div className={styles.comparison}>
              <div className={styles.comparisonColumn}>
                <div className={styles.comparisonLabel}>Current</div>
                <div className={styles.comparisonValue}>
                  ${formatNumberWithCommas(baseCPU)}
                </div>
                <div className={styles.comparisonMetric}>
                  Margin: {baseMargin.toFixed(1)}%
                </div>
              </div>
              <div className={`${styles.comparisonColumn} ${styles.scenario} ${hasAdjustments ? styles.hasChanges : ''}`}>
                <div className={styles.comparisonLabel}>Your Scenario</div>
                <div className={`${styles.comparisonValue} ${hasAdjustments ? styles.highlight : ''}`}>
                  ${formatNumberWithCommas(scenarioCPUValue)}
                </div>
                <div className={styles.comparisonMetric}>
                  Margin: {scenarioMarginValue.toFixed(1)}%
                  {hasAdjustments && (
                    <span className={styles.comparisonDiff}>
                      {scenarioMarginValue > baseMargin ? '+' : ''}
                      {(scenarioMarginValue - baseMargin).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* MSRP Adjustment */}
            <div className={styles.sliderSection}>
              <div className={styles.sliderSectionTitle}>
                <span className={styles.sliderSectionIcon}>💰</span>
                Retail Price
              </div>
              <div className={styles.msrpSlider}>
                <div className={styles.msrpLabel}>
                  <span className={styles.msrpLabelText}>MSRP</span>
                  <span className={styles.msrpValue}>${scenarioMSRPValue.toFixed(2)}</span>
                </div>
                <div className={styles.sliderWrapper}>
                  <input
                    id={`msrp-slider-${productId}`}
                    type="range"
                    min={baseMSRP * 0.7}
                    max={baseMSRP * 1.5}
                    step={0.25}
                    value={scenarioMSRPValue}
                    onChange={(e) => {
                      const newMSRP = parseFloat(e.target.value);
                      handleMSRPAdjustment(productId, newMSRP);
                    }}
                    aria-label={`Adjust MSRP for ${product.name}`}
                    aria-valuemin={baseMSRP * 0.7}
                    aria-valuemax={baseMSRP * 1.5}
                    aria-valuenow={scenarioMSRPValue}
                    aria-valuetext={`$${scenarioMSRPValue.toFixed(2)}`}
                    className={styles.slider}
                  />
                </div>
                <div className={styles.sliderLabels}>
                  <span>${(baseMSRP * 0.7).toFixed(2)}</span>
                  <span>${(baseMSRP * 1.5).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Component Adjustments */}
            <div className={styles.sliderSection}>
              <div className={styles.sliderSectionTitle}>
                <span className={styles.sliderSectionIcon}>🧪</span>
                Component Costs
              </div>
              {filteredComponents.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'var(--color-text-secondary, #64748b)',
                  fontSize: '0.875rem',
                }}>
                  No components match the current filters
                </div>
              ) : (
                <div className={styles.componentList}>
                  {filteredComponents.map((component, idx) => {
                  const baseSubtotal = component.subtotal ? parseFloat(component.subtotal) : 0;
                  const currentAdj = scenarioAdjustments.get(productId)?.get(component.categoryId) || 0;
                  const adjustedSubtotal = baseSubtotal * (1 + currentAdj / 100);

                  return (
                    <div
                      key={idx}
                      className={`${styles.componentItem} ${currentAdj !== 0 ? styles.adjusted : ''}`}
                    >
                      <div className={styles.componentHeader}>
                        <div className={styles.componentName}>
                          {component.categoryName}
                        </div>
                        <div className={styles.componentValue}>
                          ${formatNumberWithCommas(adjustedSubtotal)}
                          {currentAdj !== 0 && (
                            <span
                              className={`${styles.componentAdjustmentBadge} ${
                                currentAdj > 0 ? styles.increase : styles.decrease
                              }`}
                            >
                              {currentAdj > 0 ? '+' : ''}
                              {currentAdj}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.sliderWrapper}>
                        <input
                          id={`component-slider-${productId}-${component.categoryId}`}
                          type="range"
                          min={-50}
                          max={100}
                          step={5}
                          value={currentAdj}
                          onChange={(e) => {
                            const adj = parseInt(e.target.value, 10);
                            handleComponentAdjustment(productId, component.categoryId, adj);
                          }}
                          aria-label={`Adjust cost for ${component.categoryName}`}
                          aria-valuemin={-50}
                          aria-valuemax={100}
                          aria-valuenow={currentAdj}
                          aria-valuetext={`${currentAdj > 0 ? '+' : ''}${currentAdj}%`}
                          className={styles.slider}
                        />
                      </div>
                      <div className={styles.sliderLabels}>
                        <span>-50%</span>
                        <span>+100%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>

            {/* Reset Button */}
            {hasAdjustments && (
              <button
                onClick={() => resetProductScenario(productId)}
                aria-label={`Reset scenario to current values for ${product.name}`}
                className={styles.resetButton}
              >
                <span aria-hidden="true">↺</span>
                Reset to Current
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
