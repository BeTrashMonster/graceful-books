/**
 * What-If Calculator Tab
 *
 * Comprehensive scenario planning tool that brings together CPG (production costs),
 * Distribution (getting product to market), and Retail/Promo (selling to consumers).
 *
 * Users can select a distributor, promo, and products to see the full financial picture
 * and experiment with different scenarios using adjustable fields.
 *
 * Features:
 * - Distributor selection with Average/Recent/Custom CPU options
 * - Promo selection with saved promo data
 * - Hierarchical product auto-population based on selections
 * - Purple pill/tag selector for additional products
 * - Comprehensive results with adjustable fields
 * - Sliding bars, $ vs % toggle, and math expression support
 * - Real-time recalculation as values change
 *
 * Requirements:
 * - WCAG 2.1 AA compliance
 * - Steadiness communication style
 * - Type safety with proper error handling
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../../../../components/core/Button';
import { ErrorMessage } from '../../../../components/feedback/ErrorMessage';
import { MarginQualityBadge } from '../../../../components/cpg/MarginQualityBadge';
import { Loading } from '../../../../components/feedback/Loading';
import type {
  CPGDistributor,
  CPGDistributionCalculation,
  CPGSalesPromo,
  CPGFinishedProduct,
  CPGSettings,
} from '../../../../db/schema/cpg.schema';
import { getProfitMarginQualityWithSettings } from '../../../../db/schema/cpg.schema';
import { cpuCalculatorService } from '../../../../services/cpg/cpuCalculator.service';
import { db } from '../../../../db/database';
import styles from './WhatIfCalculatorTab.module.css';

// ============================================================================
// Types
// ============================================================================

interface ProductData {
  id: string;
  name: string;
  baseCPU: number;
  msrp: number | null;
  source: 'distributor' | 'promo' | 'both' | 'manual'; // How this product was added
}

interface DistributorData {
  id: string;
  name: string;
  averageCPU: number | null;
  mostRecentCPU: number | null;
}

interface PromoData {
  id: string;
  name: string;
  retailerName: string | null;
  promoCostPerUnit: Record<string, number>; // Product ID → promo cost
}

interface CalculationResult {
  productId: string;
  productName: string;
  baseCPU: number;
  distributionCPU: number;
  promoCPU: number;
  totalCPU: number;
  retailPrice: number;
  margin: number;
  marginQuality: 'gutCheck' | 'good' | 'better' | 'best';
}

interface WhatIfCalculatorTabProps {
  distributors: CPGDistributor[];
  companyId: string;
  deviceId: string;
}

// ============================================================================
// Component
// ============================================================================

export function WhatIfCalculatorTab({ distributors, companyId, deviceId }: WhatIfCalculatorTabProps) {
  // ========================================
  // State - Data Loading
  // ========================================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distributorsList, setDistributorsList] = useState<DistributorData[]>([]);
  const [promosList, setPromosList] = useState<PromoData[]>([]);
  const [allProducts, setAllProducts] = useState<CPGFinishedProduct[]>([]);
  const [cpgSettings, setCpgSettings] = useState<CPGSettings | null>(null);

  // ========================================
  // State - Selections
  // ========================================
  const [selectedDistributorId, setSelectedDistributorId] = useState<string>('');
  const [distributorCPUMode, setDistributorCPUMode] = useState<'average' | 'recent' | 'custom'>('average');
  const [distributorCustomCPU, setDistributorCustomCPU] = useState<string>('');

  const [selectedPromoId, setSelectedPromoId] = useState<string>('');

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showProductSelector, setShowProductSelector] = useState(false);

  // ========================================
  // State - Results
  // ========================================
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<CalculationResult[] | null>(null);

  // Adjustable fields state (for the what-if scenario adjustments)
  const [adjustedValues, setAdjustedValues] = useState<Map<string, Map<string, number>>>(new Map());
  const [whatIfMode, setWhatIfMode] = useState<'per-product' | 'overall'>('per-product');

  // Individual toggles for each slider type (per product)
  const [sliderToggles, setSliderToggles] = useState<Map<string, Map<string, 'dollar' | 'percentage'>>>(new Map());

  // Overall mode adjustments
  const [overallAdjustments, setOverallAdjustments] = useState({
    baseCPU: 0,
    distributionCPU: 0,
    promoCPU: 0,
    retailPrice: 0,
  });
  const [overallToggles, setOverallToggles] = useState({
    baseCPU: 'percentage' as 'dollar' | 'percentage',
    distributionCPU: 'percentage' as 'dollar' | 'percentage',
    promoCPU: 'percentage' as 'dollar' | 'percentage',
    retailPrice: 'percentage' as 'dollar' | 'percentage',
  });

  // ========================================
  // Load Data on Mount
  // ========================================
  useEffect(() => {
    loadInitialData();
  }, [companyId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load CPG settings
      const settings = await db.cpgSettings
        .where('company_id')
        .equals(companyId)
        .first();
      setCpgSettings(settings || null);

      // Load distributors with their calculation data
      const distributorsData: DistributorData[] = [];
      for (const dist of distributors) {
        // Get all distribution calculations for this distributor
        const calculations = await db.cpgDistributionCalculations
          .where('[company_id+distributor_id]')
          .equals([companyId, dist.id])
          .and(calc => calc.active && calc.deleted_at === null)
          .toArray();

        // Calculate average and get most recent
        let averageCPU: number | null = null;
        let mostRecentCPU: number | null = null;

        if (calculations.length > 0) {
          const cpus = calculations
            .map(c => parseFloat(c.distribution_cost_per_unit))
            .filter(cpu => !isNaN(cpu));

          if (cpus.length > 0) {
            averageCPU = cpus.reduce((sum, cpu) => sum + cpu, 0) / cpus.length;

            // Get most recent (latest calculation_date)
            const sortedCalcs = [...calculations].sort((a, b) => b.calculation_date - a.calculation_date);
            mostRecentCPU = parseFloat(sortedCalcs[0].distribution_cost_per_unit);
          }
        }

        distributorsData.push({
          id: dist.id,
          name: dist.name,
          averageCPU,
          mostRecentCPU,
        });
      }
      // Sort distributors alphabetically by name
      distributorsData.sort((a, b) => a.name.localeCompare(b.name));
      setDistributorsList(distributorsData);

      // Load promos
      const promos = await db.cpgSalesPromos
        .where('company_id')
        .equals(companyId)
        .and(promo => promo.active && promo.deleted_at === null)
        .toArray();

      const promosData: PromoData[] = promos.map(promo => {
        // Extract promo cost per unit from variant_promo_results
        const promoCostPerUnit: Record<string, number> = {};
        if (promo.variant_promo_results) {
          Object.entries(promo.variant_promo_results).forEach(([productName, result]) => {
            // We need to map product names to IDs - for now, store by name
            // TODO: Improve this mapping if products have SKUs
            const cost = parseFloat(result.sales_promo_cost_per_unit);
            if (!isNaN(cost)) {
              promoCostPerUnit[productName] = cost;
            }
          });
        }

        return {
          id: promo.id,
          name: promo.promo_name,
          retailerName: promo.retailer_name,
          promoCostPerUnit,
        };
      });

      // Sort promos alphabetically by name
      promosData.sort((a, b) => a.name.localeCompare(b.name));
      setPromosList(promosData);

      // Load all products
      const products = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .and(p => p.active && p.deleted_at === null)
        .toArray();
      setAllProducts(products);

    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Failed to load data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // Auto-populate products when selections change
  // ========================================
  useEffect(() => {
    autoPopulateProducts();
  }, [selectedDistributorId, selectedPromoId]);

  const autoPopulateProducts = async () => {
    if (!selectedDistributorId && !selectedPromoId) {
      // No selections - clear products
      setSelectedProducts(new Set());
      return;
    }

    try {
      const productsToAdd = new Set<string>();

      // Get products from distributor calculations
      let distributorProductIds = new Set<string>();
      if (selectedDistributorId) {
        const calculations = await db.cpgDistributionCalculations
          .where('[company_id+distributor_id]')
          .equals([companyId, selectedDistributorId])
          .and(calc => calc.active && calc.deleted_at === null)
          .toArray();

        // Extract product IDs from pallet_data
        calculations.forEach(calc => {
          if (calc.pallet_data) {
            calc.pallet_data.forEach(pallet => {
              pallet.products.forEach(product => {
                // Try to find product by name
                const matchingProduct = allProducts.find(p =>
                  p.name === product.product_name || p.sku === product.product_name
                );
                if (matchingProduct) {
                  distributorProductIds.add(matchingProduct.id);
                }
              });
            });
          }
        });
      }

      // Get products from promo
      let promoProductIds = new Set<string>();
      if (selectedPromoId) {
        const promo = await db.cpgSalesPromos.get(selectedPromoId);
        if (promo && promo.variant_promo_data) {
          Object.keys(promo.variant_promo_data).forEach(productName => {
            const matchingProduct = allProducts.find(p =>
              p.name === productName || p.sku === productName
            );
            if (matchingProduct) {
              promoProductIds.add(matchingProduct.id);
            }
          });
        }
      }

      // Hierarchical logic:
      // 1. If both selected: Add products common to both
      // 2. If only one selected: Add all products from that selection
      if (selectedDistributorId && selectedPromoId) {
        // Add products common to both
        distributorProductIds.forEach(id => {
          if (promoProductIds.has(id)) {
            productsToAdd.add(id);
          }
        });
      } else if (selectedDistributorId) {
        distributorProductIds.forEach(id => productsToAdd.add(id));
      } else if (selectedPromoId) {
        promoProductIds.forEach(id => productsToAdd.add(id));
      }

      setSelectedProducts(productsToAdd);
    } catch (err) {
      console.error('Error auto-populating products:', err);
    }
  };

  // ========================================
  // Product Selection Handlers
  // ========================================
  const addProduct = (productId: string) => {
    setSelectedProducts(prev => new Set([...prev, productId]));
    setShowProductSelector(false);
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const updated = new Set(prev);
      updated.delete(productId);
      return updated;
    });
  };

  // ========================================
  // Calculate Impact
  // ========================================
  const handleCalculateImpact = async () => {
    if (selectedProducts.size === 0) {
      setError('Please select at least one product to analyze.');
      return;
    }

    try {
      setCalculating(true);
      setError(null);

      const calculationResults: CalculationResult[] = [];

      // Get distribution CPU
      let distributionCPU = 0;
      if (selectedDistributorId) {
        const distributorData = distributorsList.find(d => d.id === selectedDistributorId);
        if (distributorData) {
          if (distributorCPUMode === 'average' && distributorData.averageCPU !== null) {
            distributionCPU = distributorData.averageCPU;
          } else if (distributorCPUMode === 'recent' && distributorData.mostRecentCPU !== null) {
            distributionCPU = distributorData.mostRecentCPU;
          } else if (distributorCPUMode === 'custom' && distributorCustomCPU) {
            const customValue = parseFloat(distributorCustomCPU);
            if (!isNaN(customValue)) {
              distributionCPU = customValue;
            }
          }
        }
      }

      // Get promo data
      let promoData: PromoData | null = null;
      if (selectedPromoId) {
        promoData = promosList.find(p => p.id === selectedPromoId) || null;
      }

      // Calculate for each selected product
      for (const productId of selectedProducts) {
        const product = allProducts.find(p => p.id === productId);
        if (!product) continue;

        // Calculate base CPU
        const cpuResult = await cpuCalculatorService.calculateFinishedProductCPU(
          productId,
          companyId,
          null
        );
        const baseCPU = cpuResult.cpu ? parseFloat(cpuResult.cpu) : 0;

        // Get promo CPU for this product
        let promoCPU = 0;
        if (promoData) {
          // Try to find promo cost by product name or SKU
          const promoCost = promoData.promoCostPerUnit[product.name] ||
                           (product.sku ? promoData.promoCostPerUnit[product.sku] : 0) ||
                           0;
          promoCPU = promoCost;
        }

        // Calculate total CPU
        const totalCPU = baseCPU + distributionCPU + promoCPU;

        // Calculate margin
        const retailPrice = product.msrp ? parseFloat(product.msrp) : 0;
        const margin = retailPrice > 0 ? ((retailPrice - totalCPU) / retailPrice) * 100 : 0;

        // Determine margin quality
        const marginQuality = cpgSettings
          ? getProfitMarginQualityWithSettings(margin.toFixed(2), cpgSettings)
          : 'gutCheck';

        calculationResults.push({
          productId: product.id,
          productName: product.name,
          baseCPU,
          distributionCPU,
          promoCPU,
          totalCPU,
          retailPrice,
          margin,
          marginQuality,
        });
      }

      // Sort results alphabetically by product name
      calculationResults.sort((a, b) => a.productName.localeCompare(b.productName));

      setResults(calculationResults);
    } catch (err) {
      console.error('Error calculating impact:', err);
      setError('Failed to calculate impact. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  // ========================================
  // Value Adjustment Helpers
  // ========================================

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

  // Get adjusted value for a specific product and field
  const getAdjustedValue = (productId: string, field: string): number | null => {
    const productAdjustments = adjustedValues.get(productId);
    if (!productAdjustments) return null;
    return productAdjustments.get(field) || null;
  };

  // Set adjusted value for a specific product and field
  const setAdjustedValue = (productId: string, field: string, value: number) => {
    const updated = new Map(adjustedValues);
    const productAdjustments = updated.get(productId) || new Map<string, number>();
    productAdjustments.set(field, value);
    updated.set(productId, productAdjustments);
    setAdjustedValues(updated);
  };

  // Calculate adjusted result for a product
  const calculateAdjustedResult = (result: CalculationResult): CalculationResult => {
    const productAdjustments = adjustedValues.get(result.productId);
    if (!productAdjustments) return result;

    // Apply adjustments
    const baseCPU = productAdjustments.get('baseCPU') ?? result.baseCPU;
    const distributionCPU = productAdjustments.get('distributionCPU') ?? result.distributionCPU;
    const promoCPU = productAdjustments.get('promoCPU') ?? result.promoCPU;
    const retailPrice = productAdjustments.get('retailPrice') ?? result.retailPrice;

    // Recalculate
    const totalCPU = baseCPU + distributionCPU + promoCPU;
    const margin = retailPrice > 0 ? ((retailPrice - totalCPU) / retailPrice) * 100 : 0;
    const marginQuality = cpgSettings
      ? getProfitMarginQualityWithSettings(margin.toFixed(2), cpgSettings)
      : 'gutCheck';

    return {
      ...result,
      baseCPU,
      distributionCPU,
      promoCPU,
      totalCPU,
      retailPrice,
      margin,
      marginQuality,
    };
  };

  // Reset adjustments for a product
  const resetProductAdjustments = (productId: string) => {
    const updated = new Map(adjustedValues);
    updated.delete(productId);
    setAdjustedValues(updated);
  };

  // Get toggle state for a specific product and field
  const getSliderToggle = (productId: string, field: string): 'dollar' | 'percentage' => {
    const productToggles = sliderToggles.get(productId);
    if (!productToggles) return 'dollar';
    return productToggles.get(field) || 'dollar';
  };

  // Set toggle state for a specific product and field
  const setSliderToggle = (productId: string, field: string, mode: 'dollar' | 'percentage') => {
    const updated = new Map(sliderToggles);
    const productToggles = updated.get(productId) || new Map<string, 'dollar' | 'percentage'>();
    productToggles.set(field, mode);
    updated.set(productId, productToggles);
    setSliderToggles(updated);
  };

  // Calculate rounded range for sliders
  const calculateRange = (originalValue: number, percentage: number): { min: number; max: number } => {
    const minCalc = originalValue * (1 - percentage / 100);
    const maxCalc = originalValue * (1 + percentage / 100);

    // Round down to nearest dollar for min, up for max
    const min = Math.floor(minCalc);
    const max = Math.ceil(maxCalc);

    return { min, max };
  };

  // ========================================
  // Render Helper Functions
  // ========================================
  const renderDistributorFields = () => {
    if (!selectedDistributorId) return null;

    const distributorData = distributorsList.find(d => d.id === selectedDistributorId);
    if (!distributorData) return null;

    return (
      <div className={styles.distributorFields}>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="distributorCPUMode"
              value="average"
              checked={distributorCPUMode === 'average'}
              onChange={() => setDistributorCPUMode('average')}
              disabled={distributorData.averageCPU === null}
            />
            <span>
              Average CPU: {distributorData.averageCPU !== null
                ? `$${distributorData.averageCPU.toFixed(2)}`
                : 'N/A'}
            </span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="distributorCPUMode"
              value="recent"
              checked={distributorCPUMode === 'recent'}
              onChange={() => setDistributorCPUMode('recent')}
              disabled={distributorData.mostRecentCPU === null}
            />
            <span>
              Most Recent CPU: {distributorData.mostRecentCPU !== null
                ? `$${distributorData.mostRecentCPU.toFixed(2)}`
                : 'N/A'}
            </span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="distributorCPUMode"
              value="custom"
              checked={distributorCPUMode === 'custom'}
              onChange={() => setDistributorCPUMode('custom')}
            />
            <span>Custom:</span>
            <input
              type="text"
              className={styles.customInput}
              value={distributorCustomCPU}
              onChange={(e) => setDistributorCustomCPU(e.target.value)}
              placeholder="0.00"
              disabled={distributorCPUMode !== 'custom'}
            />
          </label>
        </div>
      </div>
    );
  };

  const renderPromoFields = () => {
    if (!selectedPromoId) return null;

    const promoData = promosList.find(p => p.id === selectedPromoId);
    if (!promoData) return null;

    const productNames = Object.keys(promoData.promoCostPerUnit);

    return (
      <div className={styles.promoFields}>
        <div className={styles.promoInfoGrid}>
          {promoData.retailerName && (
            <div className={styles.promoInfoItem}>
              <strong>Retailer:</strong> {promoData.retailerName}
            </div>
          )}
          <div className={styles.promoInfoItem}>
            <strong>Products in promo:</strong> {productNames.join(', ')}
          </div>
        </div>
      </div>
    );
  };

  const renderProductPills = () => {
    const selectedProductsList = Array.from(selectedProducts)
      .map(id => allProducts.find(p => p.id === id))
      .filter((p): p is CPGFinishedProduct => p !== undefined);

    return (
      <div className={styles.productPills}>
        {selectedProductsList.map(product => (
          <div key={product.id} className={styles.productPill}>
            <span className={styles.productPillText}>{product.name}</span>
            <button
              className={styles.productPillRemove}
              onClick={() => removeProduct(product.id)}
              aria-label={`Remove ${product.name}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className={styles.addProductButton}
          onClick={() => setShowProductSelector(!showProductSelector)}
        >
          + Add Product
        </button>
      </div>
    );
  };

  const renderProductSelector = () => {
    if (!showProductSelector) return null;

    const availableProducts = allProducts.filter(p => !selectedProducts.has(p.id));

    return (
      <div className={styles.productSelector}>
        <h4>Select Product</h4>
        <div className={styles.productList}>
          {availableProducts.map(product => (
            <button
              key={product.id}
              className={styles.productOption}
              onClick={() => addProduct(product.id)}
            >
              {product.name}
              {product.sku && <span className={styles.productSku}> ({product.sku})</span>}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className={styles.resultsSection}>
        <h3>Impact Analysis</h3>

        {/* Initial Calculation Results Table */}
        <div className={styles.initialResults}>
          <h4>Initial Calculation</h4>
          <table className={styles.resultsTable}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Base CPU</th>
                <th>Distribution CPU</th>
                <th>Promo CPU</th>
                <th>Total CPU</th>
                <th>Retail Price</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {results.map(result => {
                const adjustedResult = calculateAdjustedResult(result);
                const hasAdjustments = adjustedValues.has(result.productId);

                return (
                  <tr key={result.productId} className={hasAdjustments ? styles.hasAdjustments : ''}>
                    <td>{result.productName}</td>
                    <td>${result.baseCPU.toFixed(2)}</td>
                    <td>${result.distributionCPU.toFixed(2)}</td>
                    <td>${result.promoCPU.toFixed(2)}</td>
                    <td><strong>${result.totalCPU.toFixed(2)}</strong></td>
                    <td>${result.retailPrice.toFixed(2)}</td>
                    <td>
                      <MarginQualityBadge
                        quality={result.marginQuality}
                        marginPercentage={result.margin.toFixed(2)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* What-If Scenario Section */}
        <div className={styles.whatIfSection}>
          <div className={styles.whatIfHeader}>
            <h4>What-If Scenario: Adjust Values</h4>
            <p>Use sliders or enter values directly to explore different scenarios.</p>
          </div>

          {/* Mode Toggle: Per Product / Overall */}
          <div className={styles.modeToggle}>
            <button
              className={whatIfMode === 'per-product' ? styles.active : ''}
              onClick={() => setWhatIfMode('per-product')}
            >
              Per Product
            </button>
            <button
              className={whatIfMode === 'overall' ? styles.active : ''}
              onClick={() => setWhatIfMode('overall')}
            >
              Overall
            </button>
          </div>

          {/* Per Product Mode */}
          {whatIfMode === 'per-product' && (
            <div className={styles.productCards}>
              {results.map(result => {
                const adjustedResult = calculateAdjustedResult(result);
                const hasAdjustments = adjustedValues.has(result.productId);

                // Calculate ranges for sliders
                const baseCPURange = calculateRange(result.baseCPU, 50);
                const distCPURange = calculateRange(result.distributionCPU, 50);
                const promoCPURange = calculateRange(result.promoCPU, 50);
                const retailRange = calculateRange(result.retailPrice, 30);

                // Get toggle states
                const baseCPUToggle = getSliderToggle(result.productId, 'baseCPU');
                const distCPUToggle = getSliderToggle(result.productId, 'distributionCPU');
                const promoCPUToggle = getSliderToggle(result.productId, 'promoCPU');
                const retailToggle = getSliderToggle(result.productId, 'retailPrice');

                return (
                  <div key={result.productId} className={styles.productCard}>
                    {/* Card Header */}
                    <div className={styles.cardHeader}>
                      <h4>{result.productName}</h4>
                      {hasAdjustments && (
                        <button
                          className={styles.resetButton}
                          onClick={() => resetProductAdjustments(result.productId)}
                          title="Reset to original values"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Sliders Section */}
                    <div className={styles.slidersGrid}>
                      {/* Base CPU Slider */}
                      <div className={styles.sliderControl}>
                        <div className={styles.sliderLabelRow}>
                          <label>Base CPU</label>
                          <div className={styles.toggleSwitch}>
                            <button
                              className={baseCPUToggle === 'dollar' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'baseCPU', 'dollar')}
                            >
                              $
                            </button>
                            <button
                              className={baseCPUToggle === 'percentage' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'baseCPU', 'percentage')}
                            >
                              %
                            </button>
                          </div>
                        </div>
                        <div className={styles.adjustedValue}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={adjustedResult.baseCPU.toFixed(2)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                setAdjustedValue(result.productId, 'baseCPU', val);
                              }
                            }}
                          />
                        </div>
                        <input
                          type="range"
                          className={styles.slider}
                          min={baseCPURange.min}
                          max={baseCPURange.max}
                          step="0.01"
                          value={adjustedResult.baseCPU}
                          onChange={(e) => setAdjustedValue(result.productId, 'baseCPU', parseFloat(e.target.value))}
                        />
                        <div className={styles.sliderRange}>
                          <span>${baseCPURange.min}</span>
                          <span>${baseCPURange.max}</span>
                        </div>
                        {adjustedResult.baseCPU !== result.baseCPU && (
                          <div className={styles.delta}>
                            {adjustedResult.baseCPU > result.baseCPU ? '↑' : '↓'} $
                            {Math.abs(adjustedResult.baseCPU - result.baseCPU).toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Distribution CPU Slider */}
                      <div className={styles.sliderControl}>
                        <div className={styles.sliderLabelRow}>
                          <label>Distribution CPU</label>
                          <div className={styles.toggleSwitch}>
                            <button
                              className={distCPUToggle === 'dollar' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'distributionCPU', 'dollar')}
                            >
                              $
                            </button>
                            <button
                              className={distCPUToggle === 'percentage' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'distributionCPU', 'percentage')}
                            >
                              %
                            </button>
                          </div>
                        </div>
                        <div className={styles.adjustedValue}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={adjustedResult.distributionCPU.toFixed(2)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                setAdjustedValue(result.productId, 'distributionCPU', val);
                              }
                            }}
                          />
                        </div>
                        <input
                          type="range"
                          className={styles.slider}
                          min={distCPURange.min}
                          max={distCPURange.max}
                          step="0.01"
                          value={adjustedResult.distributionCPU}
                          onChange={(e) => setAdjustedValue(result.productId, 'distributionCPU', parseFloat(e.target.value))}
                        />
                        <div className={styles.sliderRange}>
                          <span>${distCPURange.min}</span>
                          <span>${distCPURange.max}</span>
                        </div>
                        {adjustedResult.distributionCPU !== result.distributionCPU && (
                          <div className={styles.delta}>
                            {adjustedResult.distributionCPU > result.distributionCPU ? '↑' : '↓'} $
                            {Math.abs(adjustedResult.distributionCPU - result.distributionCPU).toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Promo CPU Slider */}
                      <div className={styles.sliderControl}>
                        <div className={styles.sliderLabelRow}>
                          <label>Promo CPU</label>
                          <div className={styles.toggleSwitch}>
                            <button
                              className={promoCPUToggle === 'dollar' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'promoCPU', 'dollar')}
                            >
                              $
                            </button>
                            <button
                              className={promoCPUToggle === 'percentage' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'promoCPU', 'percentage')}
                            >
                              %
                            </button>
                          </div>
                        </div>
                        <div className={styles.adjustedValue}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={adjustedResult.promoCPU.toFixed(2)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                setAdjustedValue(result.productId, 'promoCPU', val);
                              }
                            }}
                          />
                        </div>
                        <input
                          type="range"
                          className={styles.slider}
                          min={promoCPURange.min}
                          max={promoCPURange.max}
                          step="0.01"
                          value={adjustedResult.promoCPU}
                          onChange={(e) => setAdjustedValue(result.productId, 'promoCPU', parseFloat(e.target.value))}
                        />
                        <div className={styles.sliderRange}>
                          <span>${promoCPURange.min}</span>
                          <span>${promoCPURange.max}</span>
                        </div>
                        {adjustedResult.promoCPU !== result.promoCPU && (
                          <div className={styles.delta}>
                            {adjustedResult.promoCPU > result.promoCPU ? '↑' : '↓'} $
                            {Math.abs(adjustedResult.promoCPU - result.promoCPU).toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Retail Price Slider */}
                      <div className={styles.sliderControl}>
                        <div className={styles.sliderLabelRow}>
                          <label>Retail Price</label>
                          <div className={styles.toggleSwitch}>
                            <button
                              className={retailToggle === 'dollar' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'retailPrice', 'dollar')}
                            >
                              $
                            </button>
                            <button
                              className={retailToggle === 'percentage' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'retailPrice', 'percentage')}
                            >
                              %
                            </button>
                          </div>
                        </div>
                        <div className={styles.adjustedValue}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={adjustedResult.retailPrice.toFixed(2)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                setAdjustedValue(result.productId, 'retailPrice', val);
                              }
                            }}
                          />
                        </div>
                        <input
                          type="range"
                          className={styles.slider}
                          min={retailRange.min}
                          max={retailRange.max}
                          step="0.01"
                          value={adjustedResult.retailPrice}
                          onChange={(e) => setAdjustedValue(result.productId, 'retailPrice', parseFloat(e.target.value))}
                        />
                        <div className={styles.sliderRange}>
                          <span>${retailRange.min}</span>
                          <span>${retailRange.max}</span>
                        </div>
                        {adjustedResult.retailPrice !== result.retailPrice && (
                          <div className={styles.delta}>
                            {adjustedResult.retailPrice > result.retailPrice ? '↑' : '↓'} $
                            {Math.abs(adjustedResult.retailPrice - result.retailPrice).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Results Display */}
                    <div className={styles.resultsDisplay}>
                      <div className={styles.resultBox}>
                        <div className={styles.resultLabel}>Total CPU</div>
                        <div className={styles.resultValue}>${adjustedResult.totalCPU.toFixed(2)}</div>
                      </div>
                      <div className={styles.resultBox}>
                        <div className={styles.resultLabel}>Margin</div>
                        <div className={styles.resultValue}>
                          <MarginQualityBadge
                            quality={adjustedResult.marginQuality}
                            marginPercentage={adjustedResult.margin.toFixed(2)}
                          />
                        </div>
                      </div>
                      {hasAdjustments && (
                        <div className={styles.resultBox}>
                          <div className={styles.resultLabel}>Margin Change</div>
                          <div
                            className={
                              adjustedResult.margin > result.margin
                                ? styles.positiveChange
                                : adjustedResult.margin < result.margin
                                ? styles.negativeChange
                                : styles.resultValue
                            }
                          >
                            {adjustedResult.margin > result.margin ? '+' : ''}
                            {(adjustedResult.margin - result.margin).toFixed(2)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Overall Mode */}
          {whatIfMode === 'overall' && (
            <div className={styles.overallMode}>
              <p>Overall mode coming soon - adjust all products at once.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ========================================
  // Main Render
  // ========================================
  if (loading) {
    return <Loading message="Loading data..." />;
  }

  return (
    <div className={styles.container}>
      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Selection Area */}
      <div className={styles.selectionArea}>
        <h3>Build Your Scenario</h3>

        {/* Distributor Selection */}
        <div className={styles.formGroup}>
          <label htmlFor="distributor-select">
            Select Distributor <span className={styles.optional}>(optional)</span>
          </label>
          <select
            id="distributor-select"
            value={selectedDistributorId}
            onChange={(e) => setSelectedDistributorId(e.target.value)}
            className={styles.select}
          >
            <option value="">-- None --</option>
            {distributorsList.map(dist => (
              <option key={dist.id} value={dist.id}>
                {dist.name}
              </option>
            ))}
          </select>
        </div>

        {renderDistributorFields()}

        {/* Promo Selection */}
        <div className={styles.formGroup}>
          <label htmlFor="promo-select">
            Select Retailer Promo <span className={styles.optional}>(optional)</span>
          </label>
          <select
            id="promo-select"
            value={selectedPromoId}
            onChange={(e) => setSelectedPromoId(e.target.value)}
            className={styles.select}
          >
            <option value="">-- None --</option>
            {promosList.map(promo => (
              <option key={promo.id} value={promo.id}>
                {promo.name}
                {promo.retailerName && ` (${promo.retailerName})`}
              </option>
            ))}
          </select>
        </div>

        {renderPromoFields()}

        {/* Product Selection */}
        <div className={styles.formGroup}>
          <label>Products</label>
          {renderProductPills()}
          {renderProductSelector()}
        </div>

        {/* Calculate Button */}
        <div className={styles.buttonContainer}>
          <Button
            variant="gold"
            onClick={handleCalculateImpact}
            disabled={calculating || selectedProducts.size === 0}
            style={{
              fontSize: '0.9375rem',
              padding: '0.875rem 1.5rem',
              borderRadius: '0.5rem',
            }}
          >
            {calculating ? 'Calculating...' : 'Calculate Impact'}
          </Button>
        </div>
      </div>

      {/* Results */}
      {renderResults()}
    </div>
  );
}
