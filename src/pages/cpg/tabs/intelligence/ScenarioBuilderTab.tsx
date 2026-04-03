/**
 * Scenario Builder Tab Component
 *
 * Interactive "what-if" analysis tool for cost and pricing scenarios.
 *
 * Features:
 * - Component cost adjustment sliders (-50% to +100%)
 * - Selling Price adjustment sliders (70% to 150% of base)
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
import growthCoinsImage from '../../../../assets/images/growth-coins.png';

// Product CPU data structure
export interface ProductCPUData {
  cpu: string | null;
  materialCPU: string | null;
  laborCost: string | null;
  margin: number | null;
  trend: 'up' | 'down' | 'stable';
  trendValue: string | null;
  topDriver: string | null;
  isComplete: boolean;
  breakdown: ComponentBreakdown[];
  laborBreakdown?: LaborBreakdown[];
}

interface ComponentBreakdown {
  categoryId: string;
  categoryName: string;
  variant?: string | null;
  subtotal: string | null;
  itemCount: number;
}

interface LaborBreakdown {
  roleId: string;
  roleName: string;
  hoursPerUnit: string;
  hourlyRate: string;
  costPerUnit: string;
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
  laborFilter?: Set<string>;
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
  laborFilter = new Set(),
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

  // State: Labor adjustments per product per role
  // Map<productId, Map<roleId, adjustment %>>
  const [laborAdjustments, setLaborAdjustments] = useState<Map<string, Map<string, number>>>(
    new Map()
  );

  // State: Scenario Selling Price per product
  // Map<productId, new Selling Price>
  const [scenarioSellingPrice, setScenarioSellingPrice] = useState<Map<string, number>>(new Map());

  // State: Adjustment mode per product ($ or %) - applies to ALL components in that product
  // Map<productId, 'percentage' | 'dollar'>
  const [productModes, setProductModes] = useState<Map<string, 'percentage' | 'dollar'>>(new Map());

  // State: Labor adjustment mode per product ($ or %)
  // Map<productId, 'percentage' | 'dollar'>
  const [laborModes, setLaborModes] = useState<Map<string, 'percentage' | 'dollar'>>(new Map());

  // State: Track which value is being edited
  // Format: "productId:componentId" or "productId:msrp"
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Format number with commas
  const formatNumberWithCommas = useCallback((num: number): string => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  // Evaluate math expressions in input (e.g., "0.81 + 0.04" or just "+ 0.04")
  const evaluateMathExpression = useCallback((expression: string, currentValue: number): number | null => {
    try {
      // Remove $ and commas
      const cleaned = expression.trim().replace(/[$,]/g, '');

      // If it starts with an operator, prepend the current value
      const mathExpression = /^[\+\-\*\/]/.test(cleaned) ? `${currentValue}${cleaned}` : cleaned;

      // Simple expression validation to prevent eval abuse
      // Only allow numbers, operators, parentheses, and decimal points
      if (!/^[\d\.\+\-\*\/\(\)\s]+$/.test(mathExpression)) {
        return null;
      }

      // Evaluate the expression
      const result = eval(mathExpression);

      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return result;
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  // Filter components based on active filters
  const filterComponents = useCallback((productId: string, components: ComponentBreakdown[]): ComponentBreakdown[] => {
    if (!components) return [];

    const product = finishedProducts.find(p => p.id === productId);
    const isBundle = product?.is_bundle;

    return components.filter(component => {
      // Category filter - if any categories selected, component must match one of them
      if (categoryFilter.size > 0 && !categoryFilter.has(component.categoryId)) {
        return false;
      }

      // Variant filter - if any variants selected, check if THIS product uses one of those variants for this component
      if (variantFilter.size > 0) {
        // For bundles, the component breakdown already has variant info directly
        if (isBundle) {
          const componentVariant = component.variant || '';
          // If this component doesn't match any selected variant, filter it out
          if (!variantFilter.has(componentVariant)) return false;
        } else {
          // For regular products, check recipes
          const productRecipes = recipes.filter(r => r.finished_product_id === productId);
          const componentRecipe = productRecipes.find(r => r.category_id === component.categoryId);

          if (!componentRecipe) return false;

          const recipeVariant = componentRecipe.variant || '';
          if (!variantFilter.has(recipeVariant)) return false;
        }
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
  }, [categoryFilter, variantFilter, vendorFilter, recipes, invoices, finishedProducts]);

  // Filter labor roles based on active labor filter
  const filterLaborRoles = useCallback((laborBreakdown?: LaborBreakdown[]): LaborBreakdown[] => {
    if (!laborBreakdown) return [];

    // If no labor filter active, show all labor roles
    if (laborFilter.size === 0) {
      return laborBreakdown;
    }

    // Filter to only show labor roles that match the filter
    return laborBreakdown.filter(labor => laborFilter.has(labor.roleId));
  }, [laborFilter]);

  // Calculate scenario CPU for a product based on component and labor adjustments
  const calculateScenarioCPU = useCallback(
    (productId: string): { cpu: number; materialCPU: number; laborCost: number; components: ComponentBreakdown[] } | null => {
      const data = productCPUData.get(productId);
      if (!data || !data.breakdown || data.breakdown.length === 0) return null;

      const adjustments = scenarioAdjustments.get(productId) || new Map();
      const mode = productModes.get(productId) || 'percentage';
      let materialCPU = 0;
      const components = data.breakdown.map((component) => {
        const baseSubtotal = component.subtotal ? parseFloat(component.subtotal) : 0;
        const adjustment = adjustments.get(component.categoryId) || 0;

        let adjustedSubtotal;
        if (mode === 'percentage') {
          adjustedSubtotal = baseSubtotal * (1 + adjustment / 100);
        } else {
          // Dollar mode
          adjustedSubtotal = baseSubtotal + adjustment;
        }

        materialCPU += adjustedSubtotal;

        return {
          ...component,
          adjustedSubtotal,
        };
      });

      // Calculate adjusted labor cost
      let laborCost = 0;
      if (data.laborBreakdown && data.laborBreakdown.length > 0) {
        const laborAdj = laborAdjustments.get(productId) || new Map();
        const laborMode = laborModes.get(productId) || 'percentage';

        // Filter labor roles based on laborFilter
        const filteredLaborRoles = filterLaborRoles(data.laborBreakdown);

        filteredLaborRoles.forEach((role) => {
          const baseCost = parseFloat(role.costPerUnit);
          const adjustment = laborAdj.get(role.roleId) || 0;

          let adjustedCost;
          if (laborMode === 'percentage') {
            adjustedCost = baseCost * (1 + adjustment / 100);
          } else {
            adjustedCost = baseCost + adjustment;
          }

          laborCost += adjustedCost;
        });
      }

      const totalCPU = materialCPU + laborCost;

      return { cpu: totalCPU, materialCPU, laborCost, components };
    },
    [productCPUData, scenarioAdjustments, productModes, laborAdjustments, laborModes, filterLaborRoles]
  );

  // Calculate scenario margin
  const calculateScenarioMargin = useCallback(
    (productId: string, scenarioCPU: number): number | null => {
      const product = finishedProducts.find((p) => p.id === productId);
      if (!product) return null;

      const msrp = scenarioSellingPrice.get(productId) || (product.msrp ? parseFloat(product.msrp) : null);
      if (!msrp) return null;

      return ((msrp - scenarioCPU) / msrp) * 100;
    },
    [finishedProducts, scenarioSellingPrice]
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

  // Handle Selling Price adjustment change
  const handleSellingPriceAdjustment = useCallback((productId: string, newSellingPrice: number) => {
    setScenarioSellingPrice((prev) => new Map(prev).set(productId, newSellingPrice));
  }, []);

  // Handle product mode toggle (% or $) - applies to ALL components
  const handleProductModeToggle = useCallback((productId: string, mode: 'percentage' | 'dollar') => {
    const currentMode = productModes.get(productId) || 'percentage';

    // Only recalculate if we're actually changing modes
    if (currentMode !== mode) {
      const data = productCPUData.get(productId);
      if (!data || !data.breakdown) return;

      const adjustments = scenarioAdjustments.get(productId) || new Map();
      const newAdjustments = new Map<string, number>();

      // Recalculate all adjustments to maintain same adjusted values
      data.breakdown.forEach((component) => {
        const baseValue = component.subtotal ? parseFloat(component.subtotal) : 0;
        const currentAdj = adjustments.get(component.categoryId) || 0;

        if (currentAdj === 0) return; // Skip unchanged components

        let currentAdjustedValue;
        if (currentMode === 'percentage') {
          currentAdjustedValue = baseValue * (1 + currentAdj / 100);
        } else {
          currentAdjustedValue = baseValue + currentAdj;
        }

        let newAdjustment;
        if (mode === 'percentage') {
          // Switching to percentage mode
          newAdjustment = ((currentAdjustedValue - baseValue) / baseValue) * 100;
        } else {
          // Switching to dollar mode
          newAdjustment = currentAdjustedValue - baseValue;
        }

        if (Math.abs(newAdjustment) >= 0.0001) {
          newAdjustments.set(component.categoryId, newAdjustment);
        }
      });

      // Update all adjustments at once
      setScenarioAdjustments((prev) => {
        const newMap = new Map(prev);
        newMap.set(productId, newAdjustments);
        return newMap;
      });
    }

    // Update the mode
    setProductModes((prev) => new Map(prev).set(productId, mode));
  }, [productModes, productCPUData, scenarioAdjustments]);

  // Handle labor adjustment change
  const handleLaborAdjustment = useCallback(
    (productId: string, roleId: string, adjustment: number) => {
      setLaborAdjustments((prev) => {
        const newMap = new Map(prev);
        const productAdj = newMap.get(productId) || new Map();

        if (adjustment === 0) {
          productAdj.delete(roleId);
        } else {
          productAdj.set(roleId, adjustment);
        }

        newMap.set(productId, productAdj);
        return newMap;
      });
    },
    []
  );

  // Handle labor mode toggle (% or $)
  const handleLaborModeToggle = useCallback((productId: string, mode: 'percentage' | 'dollar') => {
    const currentMode = laborModes.get(productId) || 'percentage';

    if (currentMode !== mode) {
      const data = productCPUData.get(productId);
      if (!data || !data.laborBreakdown) return;

      const adjustments = laborAdjustments.get(productId) || new Map();
      const newAdjustments = new Map<string, number>();

      data.laborBreakdown.forEach((role) => {
        const baseValue = parseFloat(role.costPerUnit);
        const currentAdj = adjustments.get(role.roleId) || 0;

        if (currentAdj === 0) return;

        let currentAdjustedValue;
        if (currentMode === 'percentage') {
          currentAdjustedValue = baseValue * (1 + currentAdj / 100);
        } else {
          currentAdjustedValue = baseValue + currentAdj;
        }

        let newAdj;
        if (mode === 'percentage') {
          newAdj = ((currentAdjustedValue - baseValue) / baseValue) * 100;
        } else {
          newAdj = currentAdjustedValue - baseValue;
        }

        newAdjustments.set(role.roleId, newAdj);
      });

      setLaborAdjustments((prev) => {
        const newMap = new Map(prev);
        newMap.set(productId, newAdjustments);
        return newMap;
      });
    }

    setLaborModes((prev) => new Map(prev).set(productId, mode));
  }, [laborModes, productCPUData, laborAdjustments]);

  // Reset scenario for a product
  const resetProductScenario = useCallback((productId: string) => {
    setScenarioAdjustments((prev) => {
      const newMap = new Map(prev);
      newMap.delete(productId);
      return newMap;
    });
    setLaborAdjustments((prev) => {
      const newMap = new Map(prev);
      newMap.delete(productId);
      return newMap;
    });
    setScenarioSellingPrice((prev) => {
      const newMap = new Map(prev);
      newMap.delete(productId);
      return newMap;
    });
  }, []);

  // Start editing a value
  const startEditing = useCallback((key: string, currentValue: string) => {
    setEditingValue(key);
    setEditingText(currentValue);
  }, []);

  // Save edited value
  const saveEditedValue = useCallback((productId: string, componentId: string | null, baseValue: number, currentValue: number) => {
    if (!editingValue) return;

    // Try to evaluate as math expression first
    let newValue = evaluateMathExpression(editingText, currentValue);

    // If not a valid expression, try parsing as plain number
    if (newValue === null) {
      const cleanedText = editingText.replace(/[$,]/g, '');
      newValue = parseFloat(cleanedText);
    }

    if (isNaN(newValue) || newValue < 0) {
      // Invalid input, cancel edit
      setEditingValue(null);
      setEditingText('');
      return;
    }

    if (componentId === null) {
      // Editing Selling Price
      handleSellingPriceAdjustment(productId, newValue);
    } else {
      // Editing component cost
      const mode = productModes.get(productId) || 'percentage';
      let adjustment;

      if (mode === 'percentage') {
        // Calculate percentage change from base value
        adjustment = ((newValue - baseValue) / baseValue) * 100;
      } else {
        // Dollar mode - adjustment is difference
        adjustment = newValue - baseValue;
      }

      handleComponentAdjustment(productId, componentId, adjustment);
    }

    setEditingValue(null);
    setEditingText('');
  }, [editingValue, editingText, productModes, handleSellingPriceAdjustment, handleComponentAdjustment, evaluateMathExpression]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingValue(null);
    setEditingText('');
  }, []);

  // Get products to display
  const productsToDisplay = useMemo(() => {
    return Array.from(selectedProducts)
      .map((productId) => {
        const product = finishedProducts.find((p) => p.id === productId);
        const cpuData = productCPUData.get(productId);
        return { productId, product, cpuData };
      })
      .filter((item) => item.product && item.cpuData && item.cpuData.breakdown && item.cpuData.breakdown.length > 0)
      .sort((a, b) => {
        // Sort alphabetically by product name
        const nameA = a.product?.name || '';
        const nameB = b.product?.name || '';
        return nameA.localeCompare(nameB);
      });
  }, [selectedProducts, finishedProducts, productCPUData]);

  // Empty state
  if (productsToDisplay.length === 0) {
    return (
      <div className={styles.emptyState}>
        <img
          src={growthCoinsImage}
          alt=""
          style={{
            width: '180px',
            height: 'auto',
            margin: '0 auto 2rem',
            display: 'block',
          }}
        />
        <p className={styles.emptyTitle} style={{ color: '#4b006e', fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem', letterSpacing: '-0.01em' }}>
          Growing and Flowing
        </p>
        <p className={styles.emptyDescription} style={{ color: '#6b7280', fontSize: '1rem', lineHeight: 1.6 }}>
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
        const baseSellingPrice = product.msrp ? parseFloat(product.msrp) : 0;
        const baseMargin = cpuData.margin || 0;

        // Check which filters are active
        const hasMaterialFilters = categoryFilter.size > 0 || variantFilter.size > 0 || vendorFilter.size > 0;
        const hasLaborFilters = laborFilter.size > 0;
        const hasAnyFilters = hasMaterialFilters || hasLaborFilters;

        // Determine section visibility based on filters
        const showMaterialsSection = !hasAnyFilters || hasMaterialFilters;
        const showLaborSection = !hasAnyFilters || hasLaborFilters;

        // Filter components based on active filters
        const filteredComponents = filterComponents(productId, cpuData.breakdown);

        // Check if all components have no cost data (null or zero subtotals)
        const hasNoCostData = filteredComponents.length > 0 &&
          filteredComponents.every(c => !c.subtotal || parseFloat(c.subtotal) === 0);

        const scenario = calculateScenarioCPU(productId);
        const scenarioCPUValue = scenario?.cpu || baseCPU;
        const scenarioSellingPriceValue = scenarioSellingPrice.get(productId) || baseSellingPrice;
        const scenarioMarginValue = calculateScenarioMargin(productId, scenarioCPUValue) || baseMargin;

        const hasAdjustments = (scenarioAdjustments.get(productId)?.size || 0) > 0 ||
                               (laborAdjustments.get(productId)?.size || 0) > 0 ||
                               scenarioSellingPrice.has(productId);

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
                  </div>
                  {hasAdjustments && (
                    <div className={styles.metricChange}>
                      {cpuDelta >= 0 ? '+' : ''}${cpuDelta.toFixed(2)}
                    </div>
                  )}
                </div>
                <div className={styles.productMetric}>
                  <div className={styles.metricLabel}>Margin</div>
                  <div className={`${styles.metricValue} ${hasAdjustments ? styles.changed : ''}`}>
                    {scenarioMarginValue.toFixed(1)}%
                  </div>
                  {hasAdjustments && (
                    <div className={styles.metricChange}>
                      {marginDelta >= 0 ? '+' : ''}{marginDelta.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.cardContent}>

              {/* Selling Price Adjustment */}
              <div className={styles.msrpSlider}>
                <div className={styles.componentItem}>
                  {/* Selling Price Label */}
                  <div className={styles.componentName}>
                    Selling Price
                  </div>

                  {/* Slider with labels above */}
                  <div className={styles.componentSliderWrapper}>
                    <div className={styles.sliderLabels}>
                      <span>${(baseSellingPrice * 0.7).toFixed(2)}</span>
                      <span>${(baseSellingPrice * 1.5).toFixed(2)}</span>
                    </div>
                    <input
                      id={`msrp-slider-${productId}`}
                      type="range"
                      min={baseSellingPrice * 0.7}
                      max={baseSellingPrice * 1.5}
                      step={0.25}
                      value={scenarioSellingPriceValue}
                      onChange={(e) => {
                        const newSellingPrice = parseFloat(e.target.value);
                        handleSellingPriceAdjustment(productId, newSellingPrice);
                      }}
                      aria-label={`Adjust Selling Price for ${product.name}`}
                      aria-valuemin={baseSellingPrice * 0.7}
                      aria-valuemax={baseSellingPrice * 1.5}
                      aria-valuenow={scenarioSellingPriceValue}
                      aria-valuetext={`$${scenarioSellingPriceValue.toFixed(2)}`}
                      className={styles.slider}
                    />
                  </div>

                  {/* Value - Editable */}
                  <div className={styles.componentValue}>
                    {editingValue === `${productId}:msrp` ? (
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => saveEditedValue(productId, null, baseSellingPrice, scenarioSellingPriceValue)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveEditedValue(productId, null, baseSellingPrice, scenarioSellingPriceValue);
                          } else if (e.key === 'Escape') {
                            cancelEditing();
                          }
                        }}
                        autoFocus
                        style={{
                          width: '100%',
                          border: '1px solid var(--color-primary, #4b006e)',
                          borderRadius: '3px',
                          padding: '0.25rem',
                          fontSize: '0.9375rem',
                          fontWeight: 700,
                          color: 'var(--color-primary, #4b006e)',
                          textAlign: 'right',
                        }}
                        placeholder="Enter value or +/- amount"
                      />
                    ) : (
                      <span
                        onClick={() => startEditing(`${productId}:msrp`, scenarioSellingPriceValue.toFixed(2))}
                        style={{ cursor: 'pointer' }}
                        title="Click to edit (supports math: +0.50, -1.25, *2, etc.)"
                      >
                        ${scenarioSellingPriceValue.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Spacer for badge column */}
                  <span style={{ width: '60px' }}></span>

                  {/* Spacer for toggle column */}
                  <span style={{ width: 'auto' }}></span>
                </div>
              </div>

              {/* Component Adjustments */}
              {showMaterialsSection && (
              <div className={styles.sliderSection}>
                <div className={styles.sliderSectionTitle}>
                  Category Costs
                  <div className={styles.componentModeToggle}>
                    <button
                      className={`${styles.modeButton} ${(productModes.get(productId) || 'percentage') === 'percentage' ? styles.active : ''}`}
                      onClick={() => handleProductModeToggle(productId, 'percentage')}
                      aria-label="Switch to percentage mode"
                    >
                      %
                    </button>
                    <button
                      className={`${styles.modeButton} ${(productModes.get(productId) || 'percentage') === 'dollar' ? styles.active : ''}`}
                      onClick={() => handleProductModeToggle(productId, 'dollar')}
                      aria-label="Switch to dollar mode"
                    >
                      $
                    </button>
                  </div>
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
              ) : hasNoCostData ? (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'var(--color-text-secondary, #64748b)',
                  fontSize: '0.875rem',
                }}>
                  No cost data available for this date range
                </div>
              ) : (
                <div className={styles.componentList}>
                  {[...filteredComponents].sort((a, b) => {
                    // Sort alphabetically by category name, then by variant
                    const nameCompare = a.categoryName.localeCompare(b.categoryName);
                    if (nameCompare !== 0) return nameCompare;

                    const variantA = a.variant || '';
                    const variantB = b.variant || '';
                    return variantA.localeCompare(variantB);
                  }).map((component, idx) => {
                  const baseSubtotal = component.subtotal ? parseFloat(component.subtotal) : 0;
                  const currentAdj = scenarioAdjustments.get(productId)?.get(component.categoryId) || 0;
                  const currentMode = productModes.get(productId) || 'percentage';

                  let adjustedSubtotal;
                  let displayAdjustment;
                  if (currentMode === 'percentage') {
                    adjustedSubtotal = baseSubtotal * (1 + currentAdj / 100);
                    displayAdjustment = currentAdj !== 0 ? `${currentAdj > 0 ? '+' : ''}${currentAdj.toFixed(2)}%` : null;
                  } else {
                    adjustedSubtotal = baseSubtotal + currentAdj;
                    displayAdjustment = currentAdj !== 0 ? `${currentAdj > 0 ? '+' : ''}$${Math.abs(currentAdj).toFixed(2)}` : null;
                  }

                  // Slider range based on mode
                  let sliderMin, sliderMax, sliderStep, minLabel, maxLabel;
                  if (currentMode === 'percentage') {
                    sliderMin = -50;
                    sliderMax = 100;
                    sliderStep = 1;
                    minLabel = '-50%';
                    maxLabel = '+100%';
                  } else {
                    sliderMin = -baseSubtotal * 0.5;
                    sliderMax = baseSubtotal * 1.0;
                    sliderStep = 0.01;
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
                        <div>{component.categoryName}</div>
                        {component.variant && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem' }}>
                            {component.variant}
                          </div>
                        )}
                      </div>

                      {/* Slider with badge underneath */}
                      <div className={styles.componentSliderWrapper}>
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
                        {/* Badge shows underneath slider if adjusted */}
                        {displayAdjustment && (
                          <div className={styles.sliderBadgeWrapper}>
                            <span
                              className={`${styles.componentAdjustmentBadge} ${
                                currentAdj > 0 ? styles.increase : styles.decrease
                              }`}
                            >
                              {displayAdjustment}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* CPU Value - EDITABLE with click */}
                      <div className={styles.componentCPU}>
                        {editingValue === `${productId}:${component.categoryId}` ? (
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={() => saveEditedValue(productId, component.categoryId, baseSubtotal, adjustedSubtotal)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveEditedValue(productId, component.categoryId, baseSubtotal, adjustedSubtotal);
                              } else if (e.key === 'Escape') {
                                cancelEditing();
                              }
                            }}
                            autoFocus
                            style={{
                              width: '100%',
                              border: '1px solid var(--color-primary, #4b006e)',
                              borderRadius: '3px',
                              padding: '0.25rem',
                              fontSize: '0.875rem',
                              fontWeight: 700,
                              color: 'var(--color-primary, #4b006e)',
                              textAlign: 'right',
                            }}
                            placeholder="Enter value or +/- amount"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(`${productId}:${component.categoryId}`, adjustedSubtotal.toFixed(2))}
                            style={{ cursor: 'pointer' }}
                            title="Click to edit (supports math: +0.04, -0.5, *2, etc.)"
                          >
                            ${formatNumberWithCommas(adjustedSubtotal)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
              )}

              {/* Labor Costs Section */}
              {showLaborSection && filterLaborRoles(cpuData.laborBreakdown).length > 0 && (
                <div className={styles.sliderSection} style={{ marginTop: '1.5rem' }}>
                  <div className={styles.sliderSectionTitle} style={{ color: '#D4AF37' }}>
                    Labor Costs
                    <div className={styles.componentModeToggle}>
                      <button
                        className={`${styles.modeButton} ${(laborModes.get(productId) || 'percentage') === 'percentage' ? styles.active : ''}`}
                        onClick={() => handleLaborModeToggle(productId, 'percentage')}
                        aria-label="Switch to percentage mode for labor"
                      >
                        %
                      </button>
                      <button
                        className={`${styles.modeButton} ${(laborModes.get(productId) || 'percentage') === 'dollar' ? styles.active : ''}`}
                        onClick={() => handleLaborModeToggle(productId, 'dollar')}
                        aria-label="Switch to dollar mode for labor"
                      >
                        $
                      </button>
                    </div>
                  </div>

                  <div className={styles.componentList}>
                    {filterLaborRoles(cpuData.laborBreakdown).map((role, idx) => {
                      const baseCost = parseFloat(role.costPerUnit);
                      const currentAdj = laborAdjustments.get(productId)?.get(role.roleId) || 0;
                      const currentMode = laborModes.get(productId) || 'percentage';

                      let adjustedCost;
                      let displayAdjustment;
                      if (currentMode === 'percentage') {
                        adjustedCost = baseCost * (1 + currentAdj / 100);
                        displayAdjustment = currentAdj !== 0 ? `${currentAdj > 0 ? '+' : ''}${currentAdj.toFixed(2)}%` : null;
                      } else {
                        adjustedCost = baseCost + currentAdj;
                        displayAdjustment = currentAdj !== 0 ? `${currentAdj > 0 ? '+' : ''}$${Math.abs(currentAdj).toFixed(2)}` : null;
                      }

                      // Slider range based on mode
                      let sliderMin, sliderMax, sliderStep;
                      if (currentMode === 'percentage') {
                        sliderMin = -50;
                        sliderMax = 100;
                        sliderStep = 1;
                      } else {
                        sliderMin = -baseCost * 0.5;
                        sliderMax = baseCost * 1.0;
                        sliderStep = 0.01;
                      }

                      return (
                        <div
                          key={idx}
                          className={`${styles.componentItem} ${currentAdj !== 0 ? styles.adjusted : ''}`}
                          style={{ borderColor: currentAdj !== 0 ? '#D4AF37' : undefined }}
                        >
                          {/* Role Name */}
                          <div className={styles.componentName} style={{ color: '#D4AF37' }}>
                            <div>{role.roleName}</div>
                            <div style={{ fontSize: '0.75rem', color: '#B8941F', marginTop: '0.125rem' }}>
                              {parseFloat(role.hoursPerUnit).toFixed(2)} hrs @ ${parseFloat(role.hourlyRate).toFixed(2)}/hr
                            </div>
                          </div>

                          {/* Slider with badge underneath */}
                          <div className={styles.componentSliderWrapper}>
                            <input
                              id={`labor-slider-${productId}-${role.roleId}`}
                              type="range"
                              min={sliderMin}
                              max={sliderMax}
                              step={sliderStep}
                              value={currentAdj}
                              onChange={(e) => {
                                const adj = parseFloat(e.target.value);
                                handleLaborAdjustment(productId, role.roleId, adj);
                              }}
                              aria-label={`Adjust labor cost for ${role.roleName}`}
                              aria-valuemin={sliderMin}
                              aria-valuemax={sliderMax}
                              aria-valuenow={currentAdj}
                              aria-valuetext={displayAdjustment || 'No adjustment'}
                              className={styles.slider}
                              style={{
                                background: currentAdj !== 0 ? 'linear-gradient(90deg, #FFF9E6 0%, #D4AF37 50%, #FFF9E6 100%)' : undefined
                              }}
                            />
                            {/* Badge shows underneath slider if adjusted */}
                            {displayAdjustment && (
                              <div className={styles.sliderBadgeWrapper}>
                                <span
                                  className={`${styles.componentAdjustmentBadge} ${
                                    currentAdj > 0 ? styles.increase : styles.decrease
                                  }`}
                                  style={{
                                    backgroundColor: currentAdj > 0 ? '#FFF9E6' : '#FFE8E8',
                                    color: currentAdj > 0 ? '#D4AF37' : '#DC2626'
                                  }}
                                >
                                  {displayAdjustment}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Value */}
                          <div className={styles.componentValue} style={{ color: '#D4AF37' }}>
                            <span>${formatNumberWithCommas(adjustedCost)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
