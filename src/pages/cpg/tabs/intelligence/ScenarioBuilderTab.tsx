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
}

export default function ScenarioBuilderTab({
  companyId,
  selectedProducts,
  productCPUData,
  finishedProducts,
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
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#64748b',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">
          🎯
        </div>
        <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          No Products Selected
        </p>
        <p style={{ fontSize: '0.875rem' }}>
          Select products above to build cost and pricing scenarios
        </p>
      </div>
    );
  }

  return (
    <div role="tabpanel" id="scenario-panel" aria-labelledby="scenario-tab">
      {productsToDisplay.map(({ productId, product, cpuData }) => {
        if (!product || !cpuData) return null;

        const baseCPU = cpuData.cpu ? parseFloat(cpuData.cpu) : 0;
        const baseMSRP = product.msrp ? parseFloat(product.msrp) : 0;
        const baseMargin = cpuData.margin || 0;

        const scenario = calculateScenarioCPU(productId);
        const scenarioCPUValue = scenario?.cpu || baseCPU;
        const scenarioMSRPValue = scenarioMSRP.get(productId) || baseMSRP;
        const scenarioMarginValue = calculateScenarioMargin(productId, scenarioCPUValue) || baseMargin;

        const hasAdjustments = (scenarioAdjustments.get(productId)?.size || 0) > 0 || scenarioMSRP.has(productId);

        return (
          <div
            key={productId}
            style={{
              marginBottom: '1.5rem',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1rem',
            }}
          >
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                marginBottom: '0.75rem',
                marginTop: 0,
              }}
            >
              {product.name}
            </h3>

            {/* Current vs Scenario Comparison */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                marginBottom: '1rem',
                padding: '0.75rem',
                background: '#f8fafc',
                borderRadius: '6px',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                  }}
                >
                  CURRENT
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  CPU: ${formatNumberWithCommas(baseCPU)}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  Margin: {baseMargin.toFixed(1)}%
                </div>
              </div>
              <div
                style={{
                  borderLeft: hasAdjustments ? '3px solid #4b006e' : '3px solid #e5e7eb',
                  paddingLeft: '1rem',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                  }}
                >
                  YOUR SCENARIO
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: hasAdjustments ? '#4b006e' : '#1e293b',
                  }}
                >
                  CPU: ${formatNumberWithCommas(scenarioCPUValue)}
                </div>
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: hasAdjustments ? '#4b006e' : '#64748b',
                  }}
                >
                  Margin: {scenarioMarginValue.toFixed(1)}%
                  {hasAdjustments && (
                    <span style={{ marginLeft: '0.5rem' }}>
                      ({scenarioMarginValue > baseMargin ? '+' : ''}
                      {(scenarioMarginValue - baseMargin).toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* MSRP Adjustment */}
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor={`msrp-slider-${productId}`}
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                }}
              >
                MSRP: ${scenarioMSRPValue.toFixed(2)}
              </label>
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
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: '#e5e7eb',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Component Adjustments */}
            <div>
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                }}
              >
                Components
              </div>
              {cpuData.breakdown.map((component, idx) => {
                const baseSubtotal = component.subtotal ? parseFloat(component.subtotal) : 0;
                const currentAdj = scenarioAdjustments.get(productId)?.get(component.categoryId) || 0;
                const adjustedSubtotal = baseSubtotal * (1 + currentAdj / 100);

                return (
                  <div
                    key={idx}
                    style={{
                      marginBottom: '0.5rem',
                      padding: '0.5rem',
                      background: currentAdj !== 0 ? '#fef3c7' : 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {component.categoryName}
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        ${formatNumberWithCommas(adjustedSubtotal)}
                        {currentAdj !== 0 && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: currentAdj > 0 ? '#dc2626' : '#16a34a',
                              marginLeft: '0.5rem',
                            }}
                          >
                            ({currentAdj > 0 ? '+' : ''}
                            {currentAdj}%)
                          </span>
                        )}
                      </div>
                    </div>
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
                      style={{
                        width: '100%',
                        height: '6px',
                        borderRadius: '3px',
                        background: '#e5e7eb',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Reset Button */}
            {hasAdjustments && (
              <button
                onClick={() => resetProductScenario(productId)}
                aria-label={`Reset scenario to current values for ${product.name}`}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  color: '#64748b',
                }}
              >
                Reset to Current
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
