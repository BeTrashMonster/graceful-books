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
  categoryFilter?: Set<string>;
  variantFilter?: Set<string>;
  vendorFilter?: Set<string>;
  recipes?: any[];
  invoices?: any[];
}

export default function ScenarioBuilderTab({
  companyId,
  selectedProducts,
  productCPUData,
  finishedProducts,
  categoryFilter = new Set(),
  variantFilter = new Set(),
  vendorFilter = new Set(),
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

  // State: Adjustment mode per component ($ or %)
  // Map<productId, Map<componentId, 'percentage' | 'dollar'>>
  const [componentModes, setComponentModes] = useState<Map<string, Map<string, 'percentage' | 'dollar'>>>(new Map());

  // Format number with commas
  const formatNumberWithCommas = useCallback((num: number): string => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  // Filter components based on active filters
  const filterComponents = useCallback((productId: string, components: ComponentBreakdown[]): ComponentBreakdown[] => {
    if (!components) return [];

    return components.filter(component => {
      // Category filter - if any categories selected, component must match one of them
      if (categoryFilter.size > 0 && !categoryFilter.has(component.categoryId)) {
        return false;
      }

      // Variant filter - if any variants selected, check if THIS product uses one of those variants for this component
      if (variantFilter.size > 0) {
        const productRecipes = recipes.filter(r => r.finished_product_id === productId);
        const componentRecipe = productRecipes.find(r => r.category_id === component.categoryId);

        if (!componentRecipe) return false;

        const recipeVariant = componentRecipe.variant || '';
        if (!variantFilter.has(recipeVariant)) return false;
      }

      // Vendor filter - if any vendors selected, check if this component has been purchased from one of them
      if (vendorFilter.size > 0) {
        const hasVendor = invoices.some(invoice => {
          if (invoice.deleted_at || !vendorFilter.has(invoice.vendor_name || '')) return false;
          if (!invoice.cost_attribution) return false;

          return Object.values(invoice.cost_attribution).some((attr: any) => {
            return attr.category_id === component.categoryId;
          });
        });
        if (!hasVendor) return false;
      }

      return true;
    });
  }, [categoryFilter, variantFilter, vendorFilter, recipes, invoices]);

  // Calculate scenario CPU for a product based on component adjustments
  const calculateScenarioCPU = useCallback(
    (productId: string): { cpu: number; components: ComponentBreakdown[] } | null => {
      const data = productCPUData.get(productId);
      if (!data || !data.breakdown || data.breakdown.length === 0) return null;

      const adjustments = scenarioAdjustments.get(productId) || new Map();
      const modes = componentModes.get(productId) || new Map();
      let totalCPU = 0;
      const components = data.breakdown.map((component) => {
        const baseSubtotal = component.subtotal ? parseFloat(component.subtotal) : 0;
        const adjustment = adjustments.get(component.categoryId) || 0;
        const mode = modes.get(component.categoryId) || 'percentage';

        let adjustedSubtotal;
        if (mode === 'percentage') {
          adjustedSubtotal = baseSubtotal * (1 + adjustment / 100);
        } else {
          // Dollar mode
          adjustedSubtotal = baseSubtotal + adjustment;
        }

        totalCPU += adjustedSubtotal;

        return {
          ...component,
          adjustedSubtotal,
        };
      });

      return { cpu: totalCPU, components };
    },
    [productCPUData, scenarioAdjustments, componentModes]
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

  // Handle component mode toggle (% or $)
  const handleComponentModeToggle = useCallback((productId: string, componentId: string, mode: 'percentage' | 'dollar') => {
    setComponentModes((prev) => {
      const newMap = new Map(prev);
      const productModes = newMap.get(productId) || new Map();
      productModes.set(componentId, mode);
      newMap.set(productId, productModes);
      return newMap;
    });
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

        const cpuDelta = scenarioCPUValue - baseCPU;
        const marginDelta = scenarioMarginValue - baseMargin;

        return (
          <div key={productId} className={styles.productCard}>
            <div className={styles.productName}>
              <div className={styles.productTitle}>
                {product.name}
                {hasAdjustments && <span className={styles.productBadge}>Modified</span>}
              </div>
              <div className={styles.productMetrics}>
                <div className={styles.productMetric}>
                  <div className={styles.metricLabel}>CPU</div>
                  <div className={`${styles.metricValue} ${hasAdjustments ? styles.changed : ''}`}>
                    ${formatNumberWithCommas(scenarioCPUValue)}
                    {hasAdjustments && (
                      <span className={styles.metricChange}>
                        ({cpuDelta >= 0 ? '+' : ''}${cpuDelta.toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.productMetric}>
                  <div className={styles.metricLabel}>Margin</div>
                  <div className={`${styles.metricValue} ${hasAdjustments ? styles.changed : ''}`}>
                    {scenarioMarginValue.toFixed(1)}%
                    {hasAdjustments && (
                      <span className={styles.metricChange}>
                        ({marginDelta >= 0 ? '+' : ''}{marginDelta.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.cardContent}>

              {/* MSRP Adjustment */}
              <div className={styles.sliderSection}>
                <div className={styles.sliderSectionTitle}>
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
                  const currentMode = componentModes.get(productId)?.get(component.categoryId) || 'percentage';

                  let adjustedSubtotal;
                  let displayAdjustment;
                  if (currentMode === 'percentage') {
                    adjustedSubtotal = baseSubtotal * (1 + currentAdj / 100);
                    displayAdjustment = currentAdj !== 0 ? `${currentAdj > 0 ? '+' : ''}${currentAdj}%` : null;
                  } else {
                    adjustedSubtotal = baseSubtotal + currentAdj;
                    displayAdjustment = currentAdj !== 0 ? `${currentAdj > 0 ? '+' : ''}$${Math.abs(currentAdj).toFixed(2)}` : null;
                  }

                  // Slider range based on mode
                  let sliderMin, sliderMax, sliderStep, minLabel, maxLabel;
                  if (currentMode === 'percentage') {
                    sliderMin = -50;
                    sliderMax = 100;
                    sliderStep = 5;
                    minLabel = '-50%';
                    maxLabel = '+100%';
                  } else {
                    sliderMin = -baseSubtotal * 0.5;
                    sliderMax = baseSubtotal * 1.0;
                    sliderStep = 0.25;
                    minLabel = `-$${(baseSubtotal * 0.5).toFixed(2)}`;
                    maxLabel = `+$${(baseSubtotal * 1.0).toFixed(2)}`;
                  }

                  return (
                    <div
                      key={idx}
                      className={`${styles.componentItem} ${currentAdj !== 0 ? styles.adjusted : ''}`}
                    >
                      {/* Component Name */}
                      <div className={styles.componentName}>
                        {component.categoryName}
                      </div>

                      {/* Slider immediately after name */}
                      <div className={styles.componentSliderWrapper}>
                        <div className={styles.sliderLabels}>
                          <span>{minLabel}</span>
                          <span>{maxLabel}</span>
                        </div>
                        <input
                          id={`component-slider-${productId}-${component.categoryId}`}
                          type="range"
                          min={sliderMin}
                          max={sliderMax}
                          step={sliderStep}
                          value={currentAdj}
                          onChange={(e) => {
                            const adj = parseFloat(e.target.value);
                            handleComponentAdjustment(productId, component.categoryId, adj);
                          }}
                          aria-label={`Adjust cost for ${component.categoryName}`}
                          aria-valuemin={sliderMin}
                          aria-valuemax={sliderMax}
                          aria-valuenow={currentAdj}
                          aria-valuetext={displayAdjustment || 'No adjustment'}
                          className={styles.slider}
                        />
                      </div>

                      {/* Value */}
                      <div className={styles.componentValue}>
                        ${formatNumberWithCommas(adjustedSubtotal)}
                      </div>

                      {/* Badge (if adjusted) */}
                      {displayAdjustment ? (
                        <span
                          className={`${styles.componentAdjustmentBadge} ${
                            currentAdj > 0 ? styles.increase : styles.decrease
                          }`}
                        >
                          {displayAdjustment}
                        </span>
                      ) : (
                        <span style={{ width: '60px' }}></span>
                      )}

                      {/* Mode toggle buttons */}
                      <div className={styles.componentModeToggle}>
                        <button
                          className={`${styles.modeButton} ${currentMode === 'percentage' ? styles.active : ''}`}
                          onClick={() => handleComponentModeToggle(productId, component.categoryId, 'percentage')}
                          aria-label="Switch to percentage mode"
                        >
                          %
                        </button>
                        <button
                          className={`${styles.modeButton} ${currentMode === 'dollar' ? styles.active : ''}`}
                          onClick={() => handleComponentModeToggle(productId, component.categoryId, 'dollar')}
                          aria-label="Switch to dollar mode"
                        >
                          $
                        </button>
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
          </div>
        );
      })}
    </div>
  );
}
