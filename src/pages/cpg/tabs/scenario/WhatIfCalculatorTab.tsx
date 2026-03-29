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
  CPGLaborRole,
} from '../../../../db/schema/cpg.schema';
import { getProfitMarginQualityWithSettings } from '../../../../db/schema/cpg.schema';
import { cpuCalculatorService } from '../../../../services/cpg/cpuCalculator.service';
import { LaborRoleService } from '../../../../services/cpg/laborRole.service';
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
  baseCPU: number; // Total production cost (materials + labor)
  materialCPU: number; // Materials cost only
  laborCost: number; // Labor cost only
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

  // Labor roles and additional labor state
  const [laborRoleService] = useState(() => new LaborRoleService(db));
  const [laborRoles, setLaborRoles] = useState<CPGLaborRole[]>([]);
  const [additionalLaborRole, setAdditionalLaborRole] = useState<string>(''); // Role ID or 'custom'
  const [additionalLaborHours, setAdditionalLaborHours] = useState<string>('');
  const [additionalLaborRate, setAdditionalLaborRate] = useState<string>('');

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
    materialCPU: 0,
    laborCost: 0,
    baseCPU: 0,
    distributionCPU: 0,
    promoCPU: 0,
    retailPrice: 0,
  });
  const [overallToggles, setOverallToggles] = useState({
    materialCPU: 'percentage' as 'dollar' | 'percentage',
    laborCost: 'percentage' as 'dollar' | 'percentage',
    baseCPU: 'percentage' as 'dollar' | 'percentage',
    distributionCPU: 'percentage' as 'dollar' | 'percentage',
    promoCPU: 'percentage' as 'dollar' | 'percentage',
    retailPrice: 'percentage' as 'dollar' | 'percentage',
  });

  // ========================================
  // State - Cost a New Idea Mode
  // ========================================
  const [calculatorMode, setCalculatorMode] = useState<'existing' | 'new-idea'>('existing');
  const [targetRetailPrice, setTargetRetailPrice] = useState<string>('');
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{
    id: string;
    category: string;
    variant: string;
    quantity: string;
    costPerUnit: string;
  }>>([]);
  const [newIngredient, setNewIngredient] = useState({
    category: '',
    variant: '',
    quantity: '',
    costPerUnit: '',
  });

  // Labor roles for recipe
  const [recipeLaborRoles, setRecipeLaborRoles] = useState<Array<{
    id: string;
    roleName: string;
    hoursPerUnit: string;
    hourlyRate: string;
  }>>([]);
  const [newLaborRole, setNewLaborRole] = useState({
    roleName: '',
    hoursPerUnit: '',
    hourlyRate: '',
  });

  // Unit Cost Calculator state
  const [calculatorType, setCalculatorType] = useState<'weight' | 'volume'>('weight');
  const [calculatorPrice, setCalculatorPrice] = useState<string>('');
  const [calculatorQuantity, setCalculatorQuantity] = useState<string>('');
  const [calculatorFromUnit, setCalculatorFromUnit] = useState<string>('lb');
  const [calculatorToQuantity, setCalculatorToQuantity] = useState<string>('');
  const [calculatorToUnit, setCalculatorToUnit] = useState<string>('oz');
  const [calculatedCPU, setCalculatedCPU] = useState<number | null>(null);

  // Categories with full data (for variants lookup)
  const [categoriesData, setCategoriesData] = useState<CPGCategory[]>([]);
  const [availableVariants, setAvailableVariants] = useState<string[]>([]);

  // New Idea calculation result
  const [newIdeaResult, setNewIdeaResult] = useState<{
    materialCPU: number;
    laborCost: number;
    baseCPU: number;
    distributionCPU: number;
    promoCPU: number;
    totalCPU: number;
    retailPrice: number;
    profitMargin: number;
    marginPercentage: number;
    marginQuality: 'good' | 'better' | 'best' | 'gutCheck';
  } | null>(null);

  // ========================================
  // Load Data on Mount
  // ========================================
  useEffect(() => {
    loadInitialData();
  }, [companyId]);

  // ========================================
  // Auto-calculate when calculator values change
  // ========================================
  useEffect(() => {
    calculateUnitCost();
  }, [calculatorPrice, calculatorQuantity, calculatorFromUnit, calculatorToQuantity, calculatorToUnit, calculatorType]);

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

      // Load labor roles
      const laborRolesData = await laborRoleService.getRoles(companyId);
      setLaborRoles(laborRolesData);

      // Load categories for Cost a New Idea mode
      const categories = await db.cpgCategories
        .where('company_id')
        .equals(companyId)
        .and(c => c.active && c.deleted_at === null)
        .toArray();

      // Sort by sort_order, then by name
      categories.sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name);
      });

      setCategoriesData(categories);

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

        // Calculate base CPU (with material and labor breakdown)
        const cpuResult = await cpuCalculatorService.calculateFinishedProductCPU(
          productId,
          companyId,
          null
        );
        let baseCPU = cpuResult.cpu ? parseFloat(cpuResult.cpu) : 0;
        const materialCPU = cpuResult.materialCPU ? parseFloat(cpuResult.materialCPU) : 0;
        let laborCost = cpuResult.laborCost ? parseFloat(cpuResult.laborCost) : 0;

        // Add additional labor if specified
        if (additionalLaborHours && additionalLaborRate) {
          const hours = parseFloat(additionalLaborHours);
          const rate = parseFloat(additionalLaborRate);
          if (!isNaN(hours) && !isNaN(rate) && hours > 0 && rate > 0) {
            const additionalLaborCost = hours * rate;
            laborCost += additionalLaborCost;
            baseCPU += additionalLaborCost;
          }
        }

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
          materialCPU,
          laborCost,
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

    // Apply adjustments to material and labor separately
    const materialCPU = productAdjustments.get('materialCPU') ?? result.materialCPU;
    const laborCost = productAdjustments.get('laborCost') ?? result.laborCost;
    const baseCPU = materialCPU + laborCost; // Base CPU is sum of material + labor
    const distributionCPU = productAdjustments.get('distributionCPU') ?? result.distributionCPU;
    const promoCPU = productAdjustments.get('promoCPU') ?? result.promoCPU;
    const retailPrice = productAdjustments.get('retailPrice') ?? result.retailPrice;

    // Recalculate total and margin
    const totalCPU = baseCPU + distributionCPU + promoCPU;
    const margin = retailPrice > 0 ? ((retailPrice - totalCPU) / retailPrice) * 100 : 0;
    const marginQuality = cpgSettings
      ? getProfitMarginQualityWithSettings(margin.toFixed(2), cpgSettings)
      : 'gutCheck';

    return {
      ...result,
      materialCPU,
      laborCost,
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

  // Apply overall adjustments to a result
  const applyOverallAdjustment = (result: CalculationResult): CalculationResult => {
    let materialCPU = result.materialCPU;
    let laborCost = result.laborCost;
    let distributionCPU = result.distributionCPU;
    let promoCPU = result.promoCPU;
    let retailPrice = result.retailPrice;

    // Apply Material CPU adjustment
    if (overallAdjustments.materialCPU !== 0) {
      if (overallToggles.materialCPU === 'dollar') {
        materialCPU += overallAdjustments.materialCPU;
      } else {
        materialCPU *= 1 + overallAdjustments.materialCPU / 100;
      }
      materialCPU = Math.max(0, materialCPU);
    }

    // Apply Labor Cost adjustment
    if (overallAdjustments.laborCost !== 0) {
      if (overallToggles.laborCost === 'dollar') {
        laborCost += overallAdjustments.laborCost;
      } else {
        laborCost *= 1 + overallAdjustments.laborCost / 100;
      }
      laborCost = Math.max(0, laborCost);
    }

    // Calculate Base CPU from adjusted material and labor
    const baseCPU = materialCPU + laborCost;

    // Apply Distribution CPU adjustment
    if (overallAdjustments.distributionCPU !== 0) {
      if (overallToggles.distributionCPU === 'dollar') {
        distributionCPU += overallAdjustments.distributionCPU;
      } else {
        distributionCPU *= 1 + overallAdjustments.distributionCPU / 100;
      }
      distributionCPU = Math.max(0, distributionCPU);
    }

    // Apply Promo CPU adjustment
    if (overallAdjustments.promoCPU !== 0) {
      if (overallToggles.promoCPU === 'dollar') {
        promoCPU += overallAdjustments.promoCPU;
      } else {
        promoCPU *= 1 + overallAdjustments.promoCPU / 100;
      }
      promoCPU = Math.max(0, promoCPU);
    }

    // Apply Retail Price adjustment
    if (overallAdjustments.retailPrice !== 0) {
      if (overallToggles.retailPrice === 'dollar') {
        retailPrice += overallAdjustments.retailPrice;
      } else {
        retailPrice *= 1 + overallAdjustments.retailPrice / 100;
      }
      retailPrice = Math.max(0, retailPrice);
    }

    const totalCPU = baseCPU + distributionCPU + promoCPU;
    const margin = retailPrice > 0 ? ((retailPrice - totalCPU) / retailPrice) * 100 : 0;
    const marginQuality = cpgSettings
      ? getProfitMarginQualityWithSettings(margin, cpgSettings)
      : 'gutCheck';

    return {
      ...result,
      materialCPU,
      laborCost,
      baseCPU,
      distributionCPU,
      promoCPU,
      totalCPU,
      retailPrice,
      margin,
      marginQuality,
    };
  };

  // Check if any overall adjustments have been made
  const hasOverallAdjustments =
    overallAdjustments.materialCPU !== 0 ||
    overallAdjustments.laborCost !== 0 ||
    overallAdjustments.baseCPU !== 0 ||
    overallAdjustments.distributionCPU !== 0 ||
    overallAdjustments.promoCPU !== 0 ||
    overallAdjustments.retailPrice !== 0;

  // ========================================
  // Cost a New Idea Helper Functions
  // ========================================

  // Unit conversion functions
  const convertToBaseUnit = (value: number, fromUnit: string, type: 'weight' | 'volume'): number => {
    if (type === 'weight') {
      // Convert to grams as base unit
      const weightConversions: Record<string, number> = {
        'g': 1,
        'kg': 1000,
        'oz': 28.3495,
        'lb': 453.592,
      };
      return value * (weightConversions[fromUnit] || 1);
    } else {
      // Convert to mL as base unit
      const volumeConversions: Record<string, number> = {
        'mL': 1,
        'L': 1000,
        'fl oz': 29.5735,
        'cup': 236.588,
        'pt': 473.176,
        'qt': 946.353,
        'gal': 3785.41,
        'tsp': 4.92892,
        'tbsp': 14.7868,
      };
      return value * (volumeConversions[fromUnit] || 1);
    }
  };

  const calculateUnitCost = () => {
    const price = parseFloat(calculatorPrice);
    const fromQty = parseFloat(calculatorQuantity);
    const toQty = parseFloat(calculatorToQuantity);

    if (isNaN(price) || isNaN(fromQty) || isNaN(toQty) || fromQty <= 0 || toQty <= 0) {
      setCalculatedCPU(null);
      return;
    }

    // Convert both to base units
    const fromBaseUnits = convertToBaseUnit(fromQty, calculatorFromUnit, calculatorType);
    const toBaseUnits = convertToBaseUnit(toQty, calculatorToUnit, calculatorType);

    // Calculate cost per recipe unit
    const costPerBaseUnit = price / fromBaseUnits;
    const cpu = costPerBaseUnit * toBaseUnits;

    setCalculatedCPU(cpu);
  };

  const insertCalculatedCPU = () => {
    if (calculatedCPU !== null && calculatorToQuantity) {
      const qty = parseFloat(calculatorToQuantity);

      // calculatedCPU is the TOTAL cost for the quantity
      // We need cost PER unit for the recipe
      const costPerUnit = qty > 0 ? calculatedCPU / qty : calculatedCPU;

      // Add directly to recipe with calculated values
      const ingredient = {
        id: Date.now().toString(),
        category: 'Unit Cost Calculation',
        variant: '', // User can edit this
        quantity: calculatorToQuantity,
        costPerUnit: costPerUnit.toFixed(2),
      };
      setRecipeIngredients([...recipeIngredients, ingredient]);

      // Reset calculator
      setCalculatorPrice('');
      setCalculatorQuantity('');
      setCalculatorToQuantity('');
      setCalculatedCPU(null);
    }
  };

  // Handle category selection - populate variants and CPU
  const handleCategoryChange = async (categoryName: string) => {
    setNewIngredient({ ...newIngredient, category: categoryName, variant: '', costPerUnit: '' });
    setAvailableVariants([]);

    if (!categoryName) return;

    // Find the category data
    const category = categoriesData.find(c => c.name === categoryName);
    if (!category) return;

    // Set available variants
    const variants = category.variants || [];
    setAvailableVariants(variants);

    // Auto-populate first variant if only one exists
    if (variants.length === 1) {
      handleVariantChange(categoryName, variants[0]);
    }
  };

  // Handle variant selection - fetch average CPU from last 365 days
  const handleVariantChange = async (categoryName: string, variantName: string) => {
    if (!categoryName || !variantName) return;

    // Set variant immediately
    setNewIngredient(prev => ({ ...prev, category: categoryName, variant: variantName, costPerUnit: '' }));

    try {
      const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);

      console.log('=== CPU LOOKUP DEBUG ===');
      console.log('Looking for category:', `"${categoryName}"`);
      console.log('Looking for variant:', `"${variantName}"`);

      // Step 1: Find the category ID from the category name
      const category = categoriesData.find(c => c.name === categoryName);
      if (!category) {
        console.log('❌ Category not found in categoriesData');
        return;
      }

      console.log('✅ Found category ID:', category.id);

      // Step 2: Get all invoices from last 365 days
      const allInvoices = await db.cpgInvoices
        .where('company_id')
        .equals(companyId)
        .and(inv =>
          inv.active &&
          inv.deleted_at === null &&
          inv.invoice_date >= oneYearAgo
        )
        .toArray();

      console.log('Total invoices in range:', allInvoices.length);

      // Step 3: Search through cost_attribution for matching category_id + variant
      const cpuValues: number[] = [];

      console.log('Searching through', allInvoices.length, 'invoices...');

      allInvoices.forEach((invoice, idx) => {
        if (!invoice.cost_attribution || !invoice.calculated_cpus) {
          console.log(`Invoice ${idx + 1}: No cost_attribution or calculated_cpus`);
          return;
        }

        console.log(`Invoice ${idx + 1} (${invoice.invoice_number || invoice.id}):`);
        console.log('  - cost_attribution keys:', Object.keys(invoice.cost_attribution));
        console.log('  - calculated_cpus keys:', Object.keys(invoice.calculated_cpus));

        // Search each cost_attribution entry
        Object.entries(invoice.cost_attribution).forEach(([key, attribution]) => {
          const categoryMatch = attribution.category_id === category.id;

          // Strip quotes from both sides for comparison (variants might be stored with quotes)
          const cleanAttributionVariant = attribution.variant?.replace(/^["']|["']$/g, '') || '';
          const cleanLookupVariant = variantName.replace(/^["']|["']$/g, '');
          const variantMatch = cleanAttributionVariant === cleanLookupVariant;

          console.log(`    Checking key "${key}":`);
          console.log(`      Category: ${attribution.category_id} === ${category.id} ? ${categoryMatch}`);
          console.log(`      Variant: "${cleanAttributionVariant}" === "${cleanLookupVariant}" ? ${variantMatch}`);
          console.log(`      Both match? ${categoryMatch && variantMatch}`);

          if (categoryMatch && variantMatch) {
            // Found a match! Get the CPU from calculated_cpus
            // The CPU key format is: "category_id_variant" (e.g., "y4XR7LunYkgEyFOPqQhan_1 oz")
            // NOT the cost_attribution key format (e.g., "BottleBranding_1oz")
            const cpuKey = `${category.id}_${cleanAttributionVariant}`;

            const cpuValue = invoice.calculated_cpus?.[cpuKey];
            console.log(`      Looking for CPU with key "${cpuKey}"`);
            console.log(`      Found CPU value:`, cpuValue);

            const cpu = parseFloat(cpuValue || '0');
            console.log(`      Parsed CPU:`, cpu);

            if (cpu > 0) {
              cpuValues.push(cpu);
              console.log(`      ✅ MATCH! Added CPU: ${cpu}`);
            } else {
              console.log(`      ⚠️ CPU is 0 or invalid`);
            }
          }
        });
      });

      console.log('Total CPU values found:', cpuValues.length, cpuValues);

      if (cpuValues.length > 0) {
        const avgCPU = cpuValues.reduce((sum, cpu) => sum + cpu, 0) / cpuValues.length;
        console.log('✅ Average CPU:', avgCPU);
        setNewIngredient(prev => ({ ...prev, variant: variantName, costPerUnit: avgCPU.toFixed(2) }));
      } else {
        console.log('❌ No CPU values found for this category+variant in last 365 days');
      }
    } catch (err) {
      console.error('💥 Error fetching average CPU:', err);
    }
  };

  const addIngredientToRecipe = () => {
    if (!newIngredient.category || !newIngredient.quantity || !newIngredient.costPerUnit) {
      return;
    }

    const ingredient = {
      id: Date.now().toString(),
      category: newIngredient.category,
      variant: newIngredient.variant,
      quantity: newIngredient.quantity,
      costPerUnit: newIngredient.costPerUnit,
    };

    setRecipeIngredients([...recipeIngredients, ingredient]);
    setNewIngredient({ category: '', variant: '', quantity: '', costPerUnit: '' });
    setAvailableVariants([]);
  };

  const removeIngredientFromRecipe = (id: string) => {
    setRecipeIngredients(recipeIngredients.filter(ing => ing.id !== id));
  };

  const updateRecipeIngredient = (id: string, field: string, value: string) => {
    setRecipeIngredients(recipeIngredients.map(ing =>
      ing.id === id ? { ...ing, [field]: value } : ing
    ));
  };

  // Labor role recipe functions
  const addLaborRoleToRecipe = () => {
    if (!newLaborRole.roleName || !newLaborRole.hoursPerUnit || !newLaborRole.hourlyRate) {
      return;
    }

    const laborRole = {
      id: Date.now().toString(),
      roleName: newLaborRole.roleName,
      hoursPerUnit: newLaborRole.hoursPerUnit,
      hourlyRate: newLaborRole.hourlyRate,
    };

    setRecipeLaborRoles([...recipeLaborRoles, laborRole]);
    setNewLaborRole({ roleName: '', hoursPerUnit: '', hourlyRate: '' });
  };

  const removeLaborRoleFromRecipe = (id: string) => {
    setRecipeLaborRoles(recipeLaborRoles.filter(role => role.id !== id));
  };

  const updateRecipeLaborRole = (id: string, field: string, value: string) => {
    setRecipeLaborRoles(recipeLaborRoles.map(role =>
      role.id === id ? { ...role, [field]: value } : role
    ));
  };

  const calculateRecipeMaterialCPU = (): number => {
    return recipeIngredients.reduce((total, ing) => {
      const qty = parseFloat(ing.quantity);
      const cpu = parseFloat(ing.costPerUnit);
      return total + (isNaN(qty) || isNaN(cpu) ? 0 : qty * cpu);
    }, 0);
  };

  const calculateRecipeLaborCost = (): number => {
    return recipeLaborRoles.reduce((total, role) => {
      const hours = parseFloat(role.hoursPerUnit);
      const rate = parseFloat(role.hourlyRate);
      return total + (isNaN(hours) || isNaN(rate) ? 0 : hours * rate);
    }, 0);
  };

  const calculateRecipeTotalCPU = (): number => {
    return calculateRecipeMaterialCPU() + calculateRecipeLaborCost();
  };

  const exportRecipeCSV = () => {
    const materialCPU = calculateRecipeMaterialCPU();
    const laborCost = calculateRecipeLaborCost();
    const totalCPU = calculateRecipeTotalCPU();
    const retailPrice = parseFloat(targetRetailPrice) || 0;
    const profitMargin = retailPrice > 0 ? ((retailPrice - totalCPU) / retailPrice * 100) : 0;

    let csv = 'New Product Costing Export\n';
    csv += `Target Retail Price,$${targetRetailPrice || '0.00'}\n\n`;

    // Materials section
    csv += 'MATERIALS\n';
    csv += 'Category,Variant,Qty,Cost/Unit,Total Cost\n';

    recipeIngredients.forEach(ing => {
      const qty = parseFloat(ing.quantity) || 0;
      const cpu = parseFloat(ing.costPerUnit) || 0;
      const total = qty * cpu;
      csv += `${ing.category},${ing.variant},${qty},$${cpu.toFixed(2)},$${total.toFixed(2)}\n`;
    });

    csv += `Material CPU Subtotal,,,,$${materialCPU.toFixed(2)}\n\n`;

    // Labor section
    if (recipeLaborRoles.length > 0) {
      csv += 'LABOR\n';
      csv += 'Role,Hours/Unit,Rate ($/hr),Cost/Unit\n';

      recipeLaborRoles.forEach(role => {
        const hours = parseFloat(role.hoursPerUnit) || 0;
        const rate = parseFloat(role.hourlyRate) || 0;
        const costPerUnit = hours * rate;
        csv += `${role.roleName},${hours},$${rate.toFixed(2)},$${costPerUnit.toFixed(2)}\n`;
      });

      csv += `Labor Cost Subtotal,,,$${laborCost.toFixed(2)}\n\n`;
    }

    csv += `Total Base CPU,,,,$${totalCPU.toFixed(2)}\n`;
    csv += `Profit Margin (at target price),,,,${profitMargin.toFixed(1)}%\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recipe-export-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // ========================================
  // Calculate New Idea Impact
  // ========================================
  const handleCalculateNewIdea = () => {
    if (recipeIngredients.length === 0) {
      setError('Please add ingredients to your recipe first.');
      return;
    }

    if (!targetRetailPrice || parseFloat(targetRetailPrice) <= 0) {
      setError('Please enter a target retail price.');
      return;
    }

    try {
      setCalculating(true);
      setError(null);

      // Base CPU from recipe (material + labor)
      const materialCPU = calculateRecipeMaterialCPU();
      const laborCost = calculateRecipeLaborCost();
      const baseCPU = calculateRecipeTotalCPU();

      // Get distribution CPU if selected
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

      // Promo CPU for new ideas (no promo data exists yet for a hypothetical product)
      const promoCPU = 0;

      // Calculate totals
      const totalCPU = baseCPU + distributionCPU + promoCPU;
      const retailPrice = parseFloat(targetRetailPrice);
      const profitMargin = retailPrice - totalCPU;
      const marginPercentage = retailPrice > 0 ? ((profitMargin / retailPrice) * 100) : 0;

      // Determine margin quality
      const marginQuality = cpgSettings
        ? getProfitMarginQualityWithSettings(marginPercentage.toFixed(2), cpgSettings)
        : 'gutCheck';

      setNewIdeaResult({
        materialCPU,
        laborCost,
        baseCPU,
        distributionCPU,
        promoCPU,
        totalCPU,
        retailPrice,
        profitMargin,
        marginPercentage,
        marginQuality,
      });

      setCalculating(false);
    } catch (err) {
      console.error('Error calculating new idea:', err);
      setError('Failed to calculate. Please try again.');
      setCalculating(false);
    }
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
                <th>Material CPU</th>
                <th style={{ color: '#D4AF37' }}>Labor Cost</th>
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
                    <td>${adjustedResult.materialCPU.toFixed(2)}</td>
                    <td style={{ color: '#D4AF37', fontWeight: adjustedResult.laborCost > 0 ? 600 : 'normal' }}>
                      ${adjustedResult.laborCost.toFixed(2)}
                    </td>
                    <td>${adjustedResult.baseCPU.toFixed(2)}</td>
                    <td>${adjustedResult.distributionCPU.toFixed(2)}</td>
                    <td>${adjustedResult.promoCPU.toFixed(2)}</td>
                    <td><strong>${adjustedResult.totalCPU.toFixed(2)}</strong></td>
                    <td>${adjustedResult.retailPrice.toFixed(2)}</td>
                    <td>
                      <MarginQualityBadge
                        quality={adjustedResult.marginQuality}
                        marginPercentage={adjustedResult.margin.toFixed(2)}
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
                const materialCPURange = calculateRange(result.materialCPU, 50);
                const laborRange = calculateRange(result.laborCost, 50);
                const baseCPURange = calculateRange(result.baseCPU, 50);
                const distCPURange = calculateRange(result.distributionCPU, 50);
                const promoCPURange = calculateRange(result.promoCPU, 50);
                const retailRange = calculateRange(result.retailPrice, 30);

                // Get toggle states
                const materialCPUToggle = getSliderToggle(result.productId, 'materialCPU');
                const laborToggle = getSliderToggle(result.productId, 'laborCost');
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
                      {/* Material CPU Slider */}
                      <div className={styles.sliderControl}>
                        <div className={styles.sliderLabelRow}>
                          <label>Material CPU</label>
                          <div className={styles.toggleSwitch}>
                            <button
                              className={materialCPUToggle === 'dollar' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'materialCPU', 'dollar')}
                            >
                              $
                            </button>
                            <button
                              className={materialCPUToggle === 'percentage' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'materialCPU', 'percentage')}
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
                            value={adjustedResult.materialCPU.toFixed(2)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                setAdjustedValue(result.productId, 'materialCPU', val);
                              }
                            }}
                          />
                        </div>
                        {result.materialCPU > 0 && (
                          <>
                            <input
                              type="range"
                              className={styles.slider}
                              min={materialCPURange.min}
                              max={materialCPURange.max}
                              step="0.01"
                              value={adjustedResult.materialCPU}
                              onChange={(e) => setAdjustedValue(result.productId, 'materialCPU', parseFloat(e.target.value))}
                            />
                            <div className={styles.sliderRange}>
                              {materialCPUToggle === 'dollar' ? (
                                <>
                                  <span>${materialCPURange.min}</span>
                                  <span>${materialCPURange.max}</span>
                                </>
                              ) : (
                                <>
                                  <span>-50%</span>
                                  <span>+50%</span>
                                </>
                              )}
                            </div>
                          </>
                        )}
                        {adjustedResult.materialCPU !== result.materialCPU && (
                          <div className={styles.delta}>
                            {materialCPUToggle === 'dollar' ? (
                              <>
                                {adjustedResult.materialCPU > result.materialCPU ? '↑' : '↓'} $
                                {Math.abs(adjustedResult.materialCPU - result.materialCPU).toFixed(2)}
                              </>
                            ) : (
                              <>
                                {adjustedResult.materialCPU > result.materialCPU ? '↑' : '↓'}
                                {(((adjustedResult.materialCPU - result.materialCPU) / result.materialCPU) * 100).toFixed(1)}%
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Labor Cost Slider */}
                      <div className={styles.sliderControl}>
                        <div className={styles.sliderLabelRow}>
                          <label style={{ color: '#D4AF37', fontWeight: 600 }}>Labor Cost</label>
                          <div className={styles.toggleSwitch}>
                            <button
                              className={laborToggle === 'dollar' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'laborCost', 'dollar')}
                              style={{
                                backgroundColor: laborToggle === 'dollar' ? '#D4AF37' : undefined,
                                borderColor: '#D4AF37',
                                color: laborToggle === 'dollar' ? '#2d1b00' : '#D4AF37'
                              }}
                            >
                              $
                            </button>
                            <button
                              className={laborToggle === 'percentage' ? styles.active : ''}
                              onClick={() => setSliderToggle(result.productId, 'laborCost', 'percentage')}
                              style={{
                                backgroundColor: laborToggle === 'percentage' ? '#D4AF37' : undefined,
                                borderColor: '#D4AF37',
                                color: laborToggle === 'percentage' ? '#2d1b00' : '#D4AF37'
                              }}
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
                            value={adjustedResult.laborCost.toFixed(2)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                setAdjustedValue(result.productId, 'laborCost', val);
                              }
                            }}
                            style={{ color: '#D4AF37', fontWeight: 600 }}
                          />
                        </div>
                        {result.laborCost > 0 && (
                          <>
                            <input
                              type="range"
                              className={styles.slider}
                              min={laborRange.min}
                              max={laborRange.max}
                              step="0.01"
                              value={adjustedResult.laborCost}
                              onChange={(e) => setAdjustedValue(result.productId, 'laborCost', parseFloat(e.target.value))}
                              style={{
                                accentColor: '#D4AF37'
                              }}
                            />
                            <div className={styles.sliderRange}>
                              {laborToggle === 'dollar' ? (
                                <>
                                  <span style={{ color: '#D4AF37' }}>${laborRange.min}</span>
                                  <span style={{ color: '#D4AF37' }}>${laborRange.max}</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ color: '#D4AF37' }}>-50%</span>
                                  <span style={{ color: '#D4AF37' }}>+50%</span>
                                </>
                              )}
                            </div>
                          </>
                        )}
                        {adjustedResult.laborCost !== result.laborCost && (
                          <div className={styles.delta} style={{ color: '#D4AF37' }}>
                            {laborToggle === 'dollar' ? (
                              <>
                                {adjustedResult.laborCost > result.laborCost ? '↑' : '↓'} $
                                {Math.abs(adjustedResult.laborCost - result.laborCost).toFixed(2)}
                              </>
                            ) : (
                              <>
                                {adjustedResult.laborCost > result.laborCost ? '↑' : '↓'}
                                {(((adjustedResult.laborCost - result.laborCost) / result.laborCost) * 100).toFixed(1)}%
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Base CPU Display (Read-only - calculated from Material + Labor) */}
                      <div className={styles.sliderControl}>
                        <div className={styles.sliderLabelRow}>
                          <label>Base CPU (Material + Labor)</label>
                        </div>
                        <div className={styles.adjustedValue}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={adjustedResult.baseCPU.toFixed(2)}
                            disabled
                            style={{ backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }}
                          />
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
                        {result.distributionCPU > 0 ? (
                          <>
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
                              {distCPUToggle === 'dollar' ? (
                                <>
                                  <span>${distCPURange.min}</span>
                                  <span>${distCPURange.max}</span>
                                </>
                              ) : (
                                <>
                                  <span>-50%</span>
                                  <span>+50%</span>
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            No distributor selected. Type a value above to add distribution cost.
                          </div>
                        )}
                        {adjustedResult.distributionCPU !== result.distributionCPU && (
                          <div className={styles.delta}>
                            {distCPUToggle === 'dollar' ? (
                              <>
                                {adjustedResult.distributionCPU > result.distributionCPU ? '↑' : '↓'} $
                                {Math.abs(adjustedResult.distributionCPU - result.distributionCPU).toFixed(2)}
                              </>
                            ) : (
                              <>
                                {adjustedResult.distributionCPU > result.distributionCPU ? '↑' : '↓'}
                                {(((adjustedResult.distributionCPU - result.distributionCPU) / result.distributionCPU) * 100).toFixed(1)}%
                              </>
                            )}
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
                        {result.promoCPU > 0 ? (
                          <>
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
                              {promoCPUToggle === 'dollar' ? (
                                <>
                                  <span>${promoCPURange.min}</span>
                                  <span>${promoCPURange.max}</span>
                                </>
                              ) : (
                                <>
                                  <span>-50%</span>
                                  <span>+50%</span>
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            No promo selected. Type a value above to add promo cost.
                          </div>
                        )}
                        {adjustedResult.promoCPU !== result.promoCPU && (
                          <div className={styles.delta}>
                            {promoCPUToggle === 'dollar' ? (
                              <>
                                {adjustedResult.promoCPU > result.promoCPU ? '↑' : '↓'} $
                                {Math.abs(adjustedResult.promoCPU - result.promoCPU).toFixed(2)}
                              </>
                            ) : (
                              <>
                                {adjustedResult.promoCPU > result.promoCPU ? '↑' : '↓'}
                                {(((adjustedResult.promoCPU - result.promoCPU) / result.promoCPU) * 100).toFixed(1)}%
                              </>
                            )}
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
                          {retailToggle === 'dollar' ? (
                            <>
                              <span>${retailRange.min}</span>
                              <span>${retailRange.max}</span>
                            </>
                          ) : (
                            <>
                              <span>-30%</span>
                              <span>+30%</span>
                            </>
                          )}
                        </div>
                        {adjustedResult.retailPrice !== result.retailPrice && (
                          <div className={styles.delta}>
                            {retailToggle === 'dollar' ? (
                              <>
                                {adjustedResult.retailPrice > result.retailPrice ? '↑' : '↓'} $
                                {Math.abs(adjustedResult.retailPrice - result.retailPrice).toFixed(2)}
                              </>
                            ) : (
                              <>
                                {adjustedResult.retailPrice > result.retailPrice ? '↑' : '↓'}
                                {(((adjustedResult.retailPrice - result.retailPrice) / result.retailPrice) * 100).toFixed(1)}%
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Results Display */}
                    <div className={styles.resultsDisplay}>
                      {/* Total CPU - Original vs Adjusted */}
                      <div className={styles.resultBox}>
                        <div className={styles.resultLabel}>{hasAdjustments ? 'CPU' : 'Total CPU'}</div>
                        {hasAdjustments ? (
                          <>
                            <div className={styles.comparisonRow}>
                              <div className={styles.comparisonColumn}>
                                <div className={styles.comparisonSubLabel}>Original</div>
                                <div className={styles.comparisonValue}>${result.totalCPU.toFixed(2)}</div>
                              </div>
                              <div className={styles.comparisonColumn}>
                                <div className={styles.comparisonSubLabel}>Adjusted</div>
                                <div className={styles.comparisonValue}>${adjustedResult.totalCPU.toFixed(2)}</div>
                              </div>
                            </div>
                            <div
                              className={
                                adjustedResult.totalCPU > result.totalCPU
                                  ? styles.deltaPositive
                                  : styles.deltaNegative
                              }
                            >
                              Δ {adjustedResult.totalCPU > result.totalCPU ? '+' : ''}
                              ${(adjustedResult.totalCPU - result.totalCPU).toFixed(2)}
                            </div>
                          </>
                        ) : (
                          <div className={styles.resultValue}>${adjustedResult.totalCPU.toFixed(2)}</div>
                        )}
                      </div>

                      {/* Total Profit Margin - Original vs Adjusted */}
                      <div className={styles.resultBox}>
                        <div className={styles.resultLabel}>
                          {hasAdjustments ? 'Profit Margin' : 'Total Profit Margin'}
                        </div>
                        {hasAdjustments ? (
                          <>
                            <div className={styles.comparisonRow}>
                              <div className={styles.comparisonColumn}>
                                <div className={styles.comparisonSubLabel}>Original</div>
                                <div className={styles.comparisonValue}>
                                  ${(result.retailPrice - result.totalCPU).toFixed(2)}
                                </div>
                              </div>
                              <div className={styles.comparisonColumn}>
                                <div className={styles.comparisonSubLabel}>Adjusted</div>
                                <div className={styles.comparisonValue}>
                                  ${(adjustedResult.retailPrice - adjustedResult.totalCPU).toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <div
                              className={
                                (adjustedResult.retailPrice - adjustedResult.totalCPU) >
                                (result.retailPrice - result.totalCPU)
                                  ? styles.deltaPositive
                                  : styles.deltaNegative
                              }
                            >
                              Δ{' '}
                              {(adjustedResult.retailPrice - adjustedResult.totalCPU) >
                              (result.retailPrice - result.totalCPU)
                                ? '+'
                                : ''}
                              $
                              {(
                                adjustedResult.retailPrice -
                                adjustedResult.totalCPU -
                                (result.retailPrice - result.totalCPU)
                              ).toFixed(2)}
                            </div>
                          </>
                        ) : (
                          <div className={styles.resultValue}>
                            ${(adjustedResult.retailPrice - adjustedResult.totalCPU).toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Margin Badge */}
                      <div className={styles.resultBox}>
                        <div className={styles.resultLabel}>Margin</div>
                        <div className={styles.resultValue}>
                          <MarginQualityBadge
                            quality={adjustedResult.marginQuality}
                            marginPercentage={adjustedResult.margin.toFixed(2)}
                          />
                        </div>
                      </div>

                      {/* Total Margin Change */}
                      <div className={styles.resultBox}>
                        <div className={styles.resultLabel}>Total Margin Change</div>
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Overall Mode */}
          {whatIfMode === 'overall' && (
            <div className={styles.overallContainer}>
              {/* Reset Button */}
              {hasOverallAdjustments && (
                <div className={styles.overallResetContainer}>
                  <button
                    className={styles.resetButton}
                    onClick={() => {
                      setOverallAdjustments({
                        materialCPU: 0,
                        laborCost: 0,
                        baseCPU: 0,
                        distributionCPU: 0,
                        promoCPU: 0,
                        retailPrice: 0,
                      });
                    }}
                    title="Reset all adjustments"
                  >
                    Reset All Adjustments
                  </button>
                </div>
              )}

              {/* Overall Sliders */}
              <div className={styles.overallSliders}>
                {/* Material CPU Slider */}
                <div className={styles.overallSliderControl}>
                  <div className={styles.sliderLabelRow}>
                    <label>Material CPU</label>
                    <div className={styles.toggleSwitch}>
                      <button
                        className={overallToggles.materialCPU === 'dollar' ? styles.active : ''}
                        onClick={() =>
                          setOverallToggles({ ...overallToggles, materialCPU: 'dollar' })
                        }
                      >
                        $
                      </button>
                      <button
                        className={overallToggles.materialCPU === 'percentage' ? styles.active : ''}
                        onClick={() =>
                          setOverallToggles({ ...overallToggles, materialCPU: 'percentage' })
                        }
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <div className={styles.adjustedValue}>
                    <input
                      type="text"
                      value={
                        overallToggles.materialCPU === 'dollar'
                          ? `${overallAdjustments.materialCPU >= 0 ? '+' : ''}$${overallAdjustments.materialCPU.toFixed(2)}`
                          : `${overallAdjustments.materialCPU >= 0 ? '+' : ''}${overallAdjustments.materialCPU.toFixed(0)}%`
                      }
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/[^0-9.-]/g, '');
                        const val = parseFloat(cleanValue);
                        if (!isNaN(val)) {
                          setOverallAdjustments({ ...overallAdjustments, materialCPU: val });
                        }
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    className={styles.slider}
                    min={overallToggles.materialCPU === 'dollar' ? '-10' : '-50'}
                    max={overallToggles.materialCPU === 'dollar' ? '10' : '50'}
                    step={overallToggles.materialCPU === 'dollar' ? '0.01' : '1'}
                    value={overallAdjustments.materialCPU}
                    onChange={(e) =>
                      setOverallAdjustments({ ...overallAdjustments, materialCPU: parseFloat(e.target.value) })
                    }
                  />
                  <div className={styles.sliderRange}>
                    {overallToggles.materialCPU === 'dollar' ? (
                      <>
                        <span>-$10</span>
                        <span>+$10</span>
                      </>
                    ) : (
                      <>
                        <span>-50%</span>
                        <span>+50%</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Labor Cost Slider */}
                <div className={styles.overallSliderControl}>
                  <div className={styles.sliderLabelRow}>
                    <label style={{ color: '#D4AF37', fontWeight: 600 }}>Labor Cost</label>
                    <div className={styles.toggleSwitch}>
                      <button
                        className={overallToggles.laborCost === 'dollar' ? styles.active : ''}
                        onClick={() =>
                          setOverallToggles({ ...overallToggles, laborCost: 'dollar' })
                        }
                        style={{
                          backgroundColor: overallToggles.laborCost === 'dollar' ? '#D4AF37' : undefined,
                          borderColor: '#D4AF37',
                          color: overallToggles.laborCost === 'dollar' ? '#2d1b00' : '#D4AF37'
                        }}
                      >
                        $
                      </button>
                      <button
                        className={overallToggles.laborCost === 'percentage' ? styles.active : ''}
                        onClick={() =>
                          setOverallToggles({ ...overallToggles, laborCost: 'percentage' })
                        }
                        style={{
                          backgroundColor: overallToggles.laborCost === 'percentage' ? '#D4AF37' : undefined,
                          borderColor: '#D4AF37',
                          color: overallToggles.laborCost === 'percentage' ? '#2d1b00' : '#D4AF37'
                        }}
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <div className={styles.adjustedValue}>
                    <input
                      type="text"
                      value={
                        overallToggles.laborCost === 'dollar'
                          ? `${overallAdjustments.laborCost >= 0 ? '+' : ''}$${overallAdjustments.laborCost.toFixed(2)}`
                          : `${overallAdjustments.laborCost >= 0 ? '+' : ''}${overallAdjustments.laborCost.toFixed(0)}%`
                      }
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/[^0-9.-]/g, '');
                        const val = parseFloat(cleanValue);
                        if (!isNaN(val)) {
                          setOverallAdjustments({ ...overallAdjustments, laborCost: val });
                        }
                      }}
                      style={{ color: '#D4AF37', fontWeight: 600 }}
                    />
                  </div>
                  <input
                    type="range"
                    className={styles.slider}
                    min={overallToggles.laborCost === 'dollar' ? '-10' : '-50'}
                    max={overallToggles.laborCost === 'dollar' ? '10' : '50'}
                    step={overallToggles.laborCost === 'dollar' ? '0.01' : '1'}
                    value={overallAdjustments.laborCost}
                    onChange={(e) =>
                      setOverallAdjustments({ ...overallAdjustments, laborCost: parseFloat(e.target.value) })
                    }
                    style={{ accentColor: '#D4AF37' }}
                  />
                  <div className={styles.sliderRange} style={{ color: '#D4AF37' }}>
                    {overallToggles.laborCost === 'dollar' ? (
                      <>
                        <span>-$10</span>
                        <span>+$10</span>
                      </>
                    ) : (
                      <>
                        <span>-50%</span>
                        <span>+50%</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Distribution CPU Slider */}
                <div className={styles.overallSliderControl}>
                  <div className={styles.sliderLabelRow}>
                    <label>Distribution CPU</label>
                    <div className={styles.toggleSwitch}>
                      <button
                        className={overallToggles.distributionCPU === 'dollar' ? styles.active : ''}
                        onClick={() =>
                          setOverallToggles({ ...overallToggles, distributionCPU: 'dollar' })
                        }
                      >
                        $
                      </button>
                      <button
                        className={overallToggles.distributionCPU === 'percentage' ? styles.active : ''}
                        onClick={() =>
                          setOverallToggles({ ...overallToggles, distributionCPU: 'percentage' })
                        }
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <div className={styles.adjustedValue}>
                    <input
                      type="text"
                      value={
                        overallToggles.distributionCPU === 'dollar'
                          ? `${overallAdjustments.distributionCPU >= 0 ? '+' : ''}$${overallAdjustments.distributionCPU.toFixed(2)}`
                          : `${overallAdjustments.distributionCPU >= 0 ? '+' : ''}${overallAdjustments.distributionCPU.toFixed(0)}%`
                      }
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/[^0-9.-]/g, '');
                        const val = parseFloat(cleanValue);
                        if (!isNaN(val)) {
                          setOverallAdjustments({ ...overallAdjustments, distributionCPU: val });
                        }
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    className={styles.slider}
                    min={overallToggles.distributionCPU === 'dollar' ? '-10' : '-50'}
                    max={overallToggles.distributionCPU === 'dollar' ? '10' : '50'}
                    step={overallToggles.distributionCPU === 'dollar' ? '0.01' : '1'}
                    value={overallAdjustments.distributionCPU}
                    onChange={(e) =>
                      setOverallAdjustments({
                        ...overallAdjustments,
                        distributionCPU: parseFloat(e.target.value),
                      })
                    }
                  />
                  <div className={styles.sliderRange}>
                    {overallToggles.distributionCPU === 'dollar' ? (
                      <>
                        <span>-$10</span>
                        <span>+$10</span>
                      </>
                    ) : (
                      <>
                        <span>-50%</span>
                        <span>+50%</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Promo CPU Slider */}
                <div className={styles.overallSliderControl}>
                  <div className={styles.sliderLabelRow}>
                    <label>Promo CPU</label>
                    <div className={styles.toggleSwitch}>
                      <button
                        className={overallToggles.promoCPU === 'dollar' ? styles.active : ''}
                        onClick={() =>
                          setOverallToggles({ ...overallToggles, promoCPU: 'dollar' })
                        }
                      >
                        $
                      </button>
                      <button
                        className={overallToggles.promoCPU === 'percentage' ? styles.active : ''}
                        onClick={() =>
                          setOverallToggles({ ...overallToggles, promoCPU: 'percentage' })
                        }
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <div className={styles.adjustedValue}>
                    <input
                      type="text"
                      value={
                        overallToggles.promoCPU === 'dollar'
                          ? `${overallAdjustments.promoCPU >= 0 ? '+' : ''}$${overallAdjustments.promoCPU.toFixed(2)}`
                          : `${overallAdjustments.promoCPU >= 0 ? '+' : ''}${overallAdjustments.promoCPU.toFixed(0)}%`
                      }
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/[^0-9.-]/g, '');
                        const val = parseFloat(cleanValue);
                        if (!isNaN(val)) {
                          setOverallAdjustments({ ...overallAdjustments, promoCPU: val });
                        }
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    className={styles.slider}
                    min={overallToggles.promoCPU === 'dollar' ? '-10' : '-50'}
                    max={overallToggles.promoCPU === 'dollar' ? '10' : '50'}
                    step={overallToggles.promoCPU === 'dollar' ? '0.01' : '1'}
                    value={overallAdjustments.promoCPU}
                    onChange={(e) =>
                      setOverallAdjustments({ ...overallAdjustments, promoCPU: parseFloat(e.target.value) })
                    }
                  />
                  <div className={styles.sliderRange}>
                    {overallToggles.promoCPU === 'dollar' ? (
                      <>
                        <span>-$10</span>
                        <span>+$10</span>
                      </>
                    ) : (
                      <>
                        <span>-50%</span>
                        <span>+50%</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Retail Price Slider */}
                <div className={styles.overallSliderControl}>
                  <div className={styles.sliderLabelRow}>
                    <label>Retail Price</label>
                    <div className={styles.toggleSwitch}>
                      <button
                        className={overallToggles.retailPrice === 'dollar' ? styles.active : ''}
                        onClick={() =>
                          setOverallToggles({ ...overallToggles, retailPrice: 'dollar' })
                        }
                      >
                        $
                      </button>
                      <button
                        className={overallToggles.retailPrice === 'percentage' ? styles.active : ''}
                        onClick={() =>
                          setOverallToggles({ ...overallToggles, retailPrice: 'percentage' })
                        }
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <div className={styles.adjustedValue}>
                    <input
                      type="text"
                      value={
                        overallToggles.retailPrice === 'dollar'
                          ? `${overallAdjustments.retailPrice >= 0 ? '+' : ''}$${overallAdjustments.retailPrice.toFixed(2)}`
                          : `${overallAdjustments.retailPrice >= 0 ? '+' : ''}${overallAdjustments.retailPrice.toFixed(0)}%`
                      }
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/[^0-9.-]/g, '');
                        const val = parseFloat(cleanValue);
                        if (!isNaN(val)) {
                          setOverallAdjustments({ ...overallAdjustments, retailPrice: val });
                        }
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    className={styles.slider}
                    min={overallToggles.retailPrice === 'dollar' ? '-10' : '-30'}
                    max={overallToggles.retailPrice === 'dollar' ? '10' : '30'}
                    step={overallToggles.retailPrice === 'dollar' ? '0.01' : '1'}
                    value={overallAdjustments.retailPrice}
                    onChange={(e) =>
                      setOverallAdjustments({ ...overallAdjustments, retailPrice: parseFloat(e.target.value) })
                    }
                  />
                  <div className={styles.sliderRange}>
                    {overallToggles.retailPrice === 'dollar' ? (
                      <>
                        <span>-$10</span>
                        <span>+$10</span>
                      </>
                    ) : (
                      <>
                        <span>-30%</span>
                        <span>+30%</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Aggregated Summary */}
              {(() => {
                const originalTotalCPU = results.reduce((sum, r) => sum + r.totalCPU, 0);
                const originalTotalProfitMargin = results.reduce(
                  (sum, r) => sum + (r.retailPrice - r.totalCPU),
                  0
                );
                const originalTotalRevenue = results.reduce((sum, r) => sum + r.retailPrice, 0);
                const originalAvgMargin =
                  originalTotalRevenue > 0
                    ? ((originalTotalProfitMargin / originalTotalRevenue) * 100)
                    : 0;

                const adjustedResults = results.map(applyOverallAdjustment);
                const adjustedTotalCPU = adjustedResults.reduce((sum, r) => sum + r.totalCPU, 0);
                const adjustedTotalProfitMargin = adjustedResults.reduce(
                  (sum, r) => sum + (r.retailPrice - r.totalCPU),
                  0
                );
                const adjustedTotalRevenue = adjustedResults.reduce((sum, r) => sum + r.retailPrice, 0);
                const adjustedAvgMargin =
                  adjustedTotalRevenue > 0
                    ? ((adjustedTotalProfitMargin / adjustedTotalRevenue) * 100)
                    : 0;

                return (
                  <>
                    <div className={styles.resultsDisplay}>
                      {/* Combined CPU */}
                      <div className={styles.resultBox}>
                        <div className={styles.resultLabel}>
                          {hasOverallAdjustments ? 'CPU' : 'Combined CPU'}
                        </div>
                        {hasOverallAdjustments ? (
                          <>
                            <div className={styles.comparisonRow}>
                              <div className={styles.comparisonColumn}>
                                <div className={styles.comparisonSubLabel}>Original</div>
                                <div className={styles.comparisonValue}>
                                  ${originalTotalCPU.toFixed(2)}
                                </div>
                              </div>
                              <div className={styles.comparisonColumn}>
                                <div className={styles.comparisonSubLabel}>Adjusted</div>
                                <div className={styles.comparisonValue}>
                                  ${adjustedTotalCPU.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <div
                              className={
                                adjustedTotalCPU > originalTotalCPU
                                  ? styles.deltaPositive
                                  : styles.deltaNegative
                              }
                            >
                              Δ {adjustedTotalCPU > originalTotalCPU ? '+' : ''}$
                              {(adjustedTotalCPU - originalTotalCPU).toFixed(2)}
                            </div>
                          </>
                        ) : (
                          <div className={styles.resultValue}>${originalTotalCPU.toFixed(2)}</div>
                        )}
                      </div>

                      {/* Combined Profit Margin */}
                      <div className={styles.resultBox}>
                        <div className={styles.resultLabel}>
                          {hasOverallAdjustments ? 'Profit Margin' : 'Combined Profit Margin'}
                        </div>
                        {hasOverallAdjustments ? (
                          <>
                            <div className={styles.comparisonRow}>
                              <div className={styles.comparisonColumn}>
                                <div className={styles.comparisonSubLabel}>Original</div>
                                <div className={styles.comparisonValue}>
                                  ${originalTotalProfitMargin.toFixed(2)}
                                </div>
                              </div>
                              <div className={styles.comparisonColumn}>
                                <div className={styles.comparisonSubLabel}>Adjusted</div>
                                <div className={styles.comparisonValue}>
                                  ${adjustedTotalProfitMargin.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <div
                              className={
                                adjustedTotalProfitMargin > originalTotalProfitMargin
                                  ? styles.deltaPositive
                                  : styles.deltaNegative
                              }
                            >
                              Δ {adjustedTotalProfitMargin > originalTotalProfitMargin ? '+' : ''}$
                              {(adjustedTotalProfitMargin - originalTotalProfitMargin).toFixed(2)}
                            </div>
                          </>
                        ) : (
                          <div className={styles.resultValue}>
                            ${originalTotalProfitMargin.toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Average Margin */}
                      <div className={styles.resultBox}>
                        <div className={styles.resultLabel}>Average Margin</div>
                        <div className={styles.resultValue}>{adjustedAvgMargin.toFixed(2)}%</div>
                      </div>

                      {/* Margin Change */}
                      <div className={styles.resultBox}>
                        <div className={styles.resultLabel}>Margin Change</div>
                        <div
                          className={
                            adjustedAvgMargin > originalAvgMargin
                              ? styles.positiveChange
                              : adjustedAvgMargin < originalAvgMargin
                              ? styles.negativeChange
                              : styles.resultValue
                          }
                        >
                          {adjustedAvgMargin > originalAvgMargin ? '+' : ''}
                          {(adjustedAvgMargin - originalAvgMargin).toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Products Table */}
                    <div className={styles.overallProductsTable}>
                      <h4>Impact on Each Product</h4>
                      <table className={styles.resultsTable}>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Base CPU</th>
                            <th>Dist CPU</th>
                            <th>Promo CPU</th>
                            <th>Total CPU</th>
                            <th>Retail</th>
                            <th>Margin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adjustedResults.map((adjusted, idx) => {
                            const original = results[idx];
                            const hasChange =
                              adjusted.baseCPU !== original.baseCPU ||
                              adjusted.distributionCPU !== original.distributionCPU ||
                              adjusted.promoCPU !== original.promoCPU ||
                              adjusted.retailPrice !== original.retailPrice;

                            return (
                              <tr key={adjusted.productId} className={hasChange ? styles.hasAdjustments : ''}>
                                <td>{adjusted.productName}</td>
                                <td>${adjusted.baseCPU.toFixed(2)}</td>
                                <td>${adjusted.distributionCPU.toFixed(2)}</td>
                                <td>${adjusted.promoCPU.toFixed(2)}</td>
                                <td>
                                  <strong>${adjusted.totalCPU.toFixed(2)}</strong>
                                </td>
                                <td>${adjusted.retailPrice.toFixed(2)}</td>
                                <td>
                                  <MarginQualityBadge
                                    quality={adjusted.marginQuality}
                                    marginPercentage={adjusted.margin.toFixed(2)}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
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

      {/* Calculator Mode Toggle */}
      <div className={styles.calculatorModeToggle}>
        <button
          className={calculatorMode === 'existing' ? styles.active : ''}
          onClick={() => setCalculatorMode('existing')}
        >
          Existing Products
        </button>
        <button
          className={calculatorMode === 'new-idea' ? styles.active : ''}
          onClick={() => setCalculatorMode('new-idea')}
        >
          Cost a New Idea
        </button>
      </div>

      {/* Existing Products Mode */}
      {calculatorMode === 'existing' && (
        <>
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

        {/* Additional Labor */}
        <div className={styles.formGroup}>
          <label>
            Additional Labor <span className={styles.optional}>(not already accounted for)</span>
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              value={additionalLaborRole}
              onChange={(e) => {
                const roleId = e.target.value;
                setAdditionalLaborRole(roleId);
                // Auto-fill rate if role selected
                if (roleId && roleId !== 'custom') {
                  const role = laborRoles.find(r => r.id === roleId);
                  if (role) {
                    // Use the correct field based on compensation type
                    const rate = role.compensation_type === 'hourly'
                      ? role.hourly_rate
                      : role.calculated_hourly_rate;
                    setAdditionalLaborRate(rate || '');
                  }
                } else {
                  // Clear rate if custom or none
                  setAdditionalLaborRate('');
                }
              }}
              className={styles.input}
              style={{ flex: '1' }}
            >
              <option value="">-- Select Role (Optional) --</option>
              {laborRoles.map(role => (
                <option key={role.id} value={role.id}>
                  {role.role_name}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              value={additionalLaborHours}
              onChange={(e) => setAdditionalLaborHours(e.target.value)}
              placeholder="Additional Hours"
              className={styles.input}
              style={{ flex: '1' }}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={additionalLaborRate}
              onChange={(e) => setAdditionalLaborRate(e.target.value)}
              placeholder="Hourly Rate ($)"
              className={styles.input}
              style={{ flex: '1' }}
            />
          </div>
        </div>

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
        </>
      )}

      {/* Cost a New Idea Mode */}
      {calculatorMode === 'new-idea' && (
        <div className={styles.newIdeaContainer}>
          <div className={styles.newIdeaLayout}>
            {/* Left Panel - Recipe Entry (70%) */}
            <div className={styles.recipePanel}>
              {/* Header for left section only */}
              <h3 className={styles.buildYourIdeaHeader}>Build Your Idea</h3>

              <div className={styles.targetPrice}>
                <label>Target Retail Price:</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetRetailPrice}
                  onChange={(e) => setTargetRetailPrice(e.target.value)}
                  placeholder="$0.00"
                  className={styles.targetPriceInput}
                />
              </div>

              <div className={styles.addIngredientSection}>
                <h4>Add Ingredient:</h4>
                <div className={styles.ingredientInputRow}>
                  {/* Category Selection */}
                  <select
                    value={newIngredient.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className={styles.categorySelect}
                  >
                    <option value="">Category</option>
                    {categoriesData.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                    <option value="__custom__">+ Custom</option>
                  </select>

                  {/* Custom Category Input */}
                  {newIngredient.category === '__custom__' && (
                    <input
                      type="text"
                      placeholder="Custom category name"
                      onChange={(e) => setNewIngredient({ ...newIngredient, category: e.target.value, variant: '' })}
                      className={styles.variantInput}
                    />
                  )}

                  {/* Variant Selection/Input */}
                  {newIngredient.category && newIngredient.category !== '__custom__' && (
                    <>
                      {availableVariants.length > 0 ? (
                        <select
                          value={newIngredient.variant}
                          onChange={(e) => handleVariantChange(newIngredient.category, e.target.value)}
                          className={styles.variantInput}
                        >
                          <option value="">Variant</option>
                          {availableVariants.map(variant => (
                            <option key={variant} value={variant}>{variant}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Variant (optional)"
                          value={newIngredient.variant}
                          onChange={(e) => setNewIngredient({ ...newIngredient, variant: e.target.value })}
                          className={styles.variantInput}
                        />
                      )}
                    </>
                  )}

                  {/* Quantity */}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Qty"
                    value={newIngredient.quantity}
                    onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                    className={styles.qtyInput}
                  />

                  {/* Cost Per Unit */}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="$CPU"
                    value={newIngredient.costPerUnit}
                    onChange={(e) => setNewIngredient({ ...newIngredient, costPerUnit: e.target.value })}
                    className={styles.cpuInput}
                  />

                  {/* Add Button */}
                  <Button
                    variant="gold"
                    onClick={addIngredientToRecipe}
                    disabled={!newIngredient.category || !newIngredient.quantity || !newIngredient.costPerUnit}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    Add to Recipe →
                  </Button>
                </div>
              </div>

              <div className={styles.recipeTableSection}>
                <h4>Current Recipe:</h4>
                {recipeIngredients.length > 0 ? (
                  <table className={styles.recipeTable}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Variant</th>
                        <th>Qty</th>
                        <th>CPU</th>
                        <th>Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipeIngredients.map(ing => {
                        const qty = parseFloat(ing.quantity) || 0;
                        const cpu = parseFloat(ing.costPerUnit) || 0;
                        const total = qty * cpu;
                        return (
                          <tr key={ing.id}>
                            <td>
                              <input
                                type="text"
                                value={ing.category}
                                onChange={(e) => updateRecipeIngredient(ing.id, 'category', e.target.value)}
                                className={styles.recipeEditInput}
                                placeholder="Category"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={ing.variant}
                                onChange={(e) => updateRecipeIngredient(ing.id, 'variant', e.target.value)}
                                className={styles.recipeEditInput}
                                placeholder="Variant"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={ing.quantity}
                                onChange={(e) => updateRecipeIngredient(ing.id, 'quantity', e.target.value)}
                                className={styles.recipeEditInput}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={ing.costPerUnit}
                                onChange={(e) => updateRecipeIngredient(ing.id, 'costPerUnit', e.target.value)}
                                className={styles.recipeEditInput}
                                style={{ width: '90px' }}
                              />
                            </td>
                            <td>${total.toFixed(2)}</td>
                            <td>
                              <button
                                onClick={() => removeIngredientFromRecipe(ing.id)}
                                className={styles.removeButton}
                                title="Remove"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className={styles.emptyRecipe}>No ingredients added yet.</p>
                )}
              </div>

              {/* Labor Roles Section */}
              <div className={styles.laborRolesSection} style={{ marginTop: '2rem' }}>
                <h4 style={{ color: '#D4AF37' }}>Labor Roles:</h4>
                <div className={styles.addLaborSection}>
                  <div className={styles.laborInputRow} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* Role Name */}
                    <input
                      type="text"
                      placeholder="Role Name (e.g., Chef, Packager)"
                      value={newLaborRole.roleName}
                      onChange={(e) => setNewLaborRole({ ...newLaborRole, roleName: e.target.value })}
                      className={styles.laborInput}
                      style={{ flex: '2', padding: '0.5rem', border: '2px solid #D4AF37', borderRadius: '4px' }}
                    />

                    {/* Hours Per Unit */}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Hours/Unit"
                      value={newLaborRole.hoursPerUnit}
                      onChange={(e) => setNewLaborRole({ ...newLaborRole, hoursPerUnit: e.target.value })}
                      className={styles.hoursInput}
                      style={{ width: '120px', padding: '0.5rem', border: '2px solid #D4AF37', borderRadius: '4px' }}
                    />

                    {/* Hourly Rate */}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="$/Hour"
                      value={newLaborRole.hourlyRate}
                      onChange={(e) => setNewLaborRole({ ...newLaborRole, hourlyRate: e.target.value })}
                      className={styles.rateInput}
                      style={{ width: '120px', padding: '0.5rem', border: '2px solid #D4AF37', borderRadius: '4px' }}
                    />

                    {/* Add Button */}
                    <Button
                      variant="gold"
                      onClick={addLaborRoleToRecipe}
                      disabled={!newLaborRole.roleName || !newLaborRole.hoursPerUnit || !newLaborRole.hourlyRate}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                      Add Labor →
                    </Button>
                  </div>
                </div>

                {recipeLaborRoles.length > 0 && (
                  <table className={styles.recipeTable} style={{ marginTop: '1rem', borderColor: '#D4AF37' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FFF9E6' }}>
                        <th style={{ color: '#D4AF37' }}>Role</th>
                        <th style={{ color: '#D4AF37' }}>Hours/Unit</th>
                        <th style={{ color: '#D4AF37' }}>Rate ($/hr)</th>
                        <th style={{ color: '#D4AF37' }}>Cost/Unit</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipeLaborRoles.map(role => {
                        const hours = parseFloat(role.hoursPerUnit) || 0;
                        const rate = parseFloat(role.hourlyRate) || 0;
                        const costPerUnit = hours * rate;
                        return (
                          <tr key={role.id} style={{ backgroundColor: '#FFF9E6' }}>
                            <td>
                              <input
                                type="text"
                                value={role.roleName}
                                onChange={(e) => updateRecipeLaborRole(role.id, 'roleName', e.target.value)}
                                className={styles.recipeEditInput}
                                placeholder="Role Name"
                                style={{ color: '#D4AF37', fontWeight: 600 }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={role.hoursPerUnit}
                                onChange={(e) => updateRecipeLaborRole(role.id, 'hoursPerUnit', e.target.value)}
                                className={styles.recipeEditInput}
                                style={{ width: '100px', color: '#D4AF37' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={role.hourlyRate}
                                onChange={(e) => updateRecipeLaborRole(role.id, 'hourlyRate', e.target.value)}
                                className={styles.recipeEditInput}
                                style={{ width: '100px', color: '#D4AF37' }}
                              />
                            </td>
                            <td style={{ color: '#D4AF37', fontWeight: 600 }}>${costPerUnit.toFixed(2)}</td>
                            <td>
                              <button
                                onClick={() => removeLaborRoleFromRecipe(role.id)}
                                className={styles.removeButton}
                                title="Remove"
                                style={{ color: '#D4AF37' }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Recipe Summary */}
              {(recipeIngredients.length > 0 || recipeLaborRoles.length > 0) && (() => {
                const materialCPU = calculateRecipeMaterialCPU();
                const laborCost = calculateRecipeLaborCost();
                const totalCPU = calculateRecipeTotalCPU();
                const retailPrice = parseFloat(targetRetailPrice) || 0;
                const profitMargin = retailPrice - totalCPU;
                const marginPercentage = retailPrice > 0 ? ((profitMargin / retailPrice) * 100) : 0;
                const marginQuality = cpgSettings
                  ? getProfitMarginQualityWithSettings(marginPercentage.toFixed(2), cpgSettings)
                  : 'gutCheck';

                return (
                  <>
                    <div className={styles.recipeSummary}>
                      <div className={styles.metricColumn}>
                        <div className={styles.metricLabel}>Material CPU</div>
                        <div className={styles.metricValue}>${materialCPU.toFixed(2)}</div>
                      </div>
                      <div className={styles.metricColumn}>
                        <div className={styles.metricLabel} style={{ color: '#D4AF37' }}>Labor Cost</div>
                        <div className={styles.metricValue} style={{ color: '#D4AF37', fontWeight: 600 }}>
                          ${laborCost.toFixed(2)}
                        </div>
                      </div>
                      <div className={styles.metricColumn}>
                        <div className={styles.metricLabel}>Total CPU</div>
                        <div className={styles.metricValue}>${totalCPU.toFixed(2)}</div>
                      </div>
                      <div className={styles.metricColumn}>
                        <div className={styles.metricLabel}>Total Profit Margin</div>
                        <div className={styles.metricValue}>${profitMargin.toFixed(2)}</div>
                      </div>
                      <div className={styles.metricColumn}>
                        <div className={styles.metricLabel}>Margin</div>
                        <div className={styles.metricValue}>
                          <MarginQualityBadge
                            quality={marginQuality}
                            marginPercentage={marginPercentage.toFixed(2)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className={styles.exportButtonContainer}>
                      <button
                        onClick={exportRecipeCSV}
                        className={styles.exportRecipeButton}
                      >
                        Export Recipe (CSV)
                      </button>
                    </div>
                  </>
                );
              })()}

              {/* Distributor and Promo Selection for New Idea */}
              {recipeIngredients.length > 0 && (
                <>
                  <div className={styles.newIdeaDistributor}>
                    <h4>Test with Distribution & Promo:</h4>
                    <div className={styles.horizontalFormGroup}>
                      <label>Select Distributor:</label>
                      <select
                        value={selectedDistributorId}
                        onChange={(e) => setSelectedDistributorId(e.target.value)}
                        className={styles.greenDropdown}
                      >
                        <option value="">-- Select --</option>
                        {distributorsList.map(dist => (
                          <option key={dist.id} value={dist.id}>
                            {dist.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {renderDistributorFields()}

                    <div className={styles.horizontalFormGroup}>
                      <label>Select Retailer Promo (optional):</label>
                      <select
                        value={selectedPromoId}
                        onChange={(e) => setSelectedPromoId(e.target.value)}
                        className={styles.greenDropdown}
                      >
                        <option value="">-- None --</option>
                        {promosList.map(promo => (
                          <option key={promo.id} value={promo.id}>
                            {promo.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {renderPromoFields()}
                  </div>

                  <div className={styles.buttonContainer}>
                    <Button
                      variant="gold"
                      onClick={handleCalculateNewIdea}
                      disabled={calculating}
                      style={{
                        fontSize: '0.9375rem',
                        padding: '0.875rem 1.5rem',
                        borderRadius: '0.5rem',
                      }}
                    >
                      {calculating ? 'Calculating...' : 'Calculate Impact'}
                    </Button>
                  </div>
                </>
              )}

              {/* New Idea Results */}
              {newIdeaResult && (
                <div className={styles.newIdeaResults}>
                  <h3>Your New Idea Analysis</h3>

                  <div className={styles.resultsGrid}>
                    <div className={styles.resultCard}>
                      <div className={styles.resultLabel}>Material CPU</div>
                      <div className={styles.resultValue}>${newIdeaResult.materialCPU.toFixed(2)}</div>
                    </div>

                    <div className={styles.resultCard}>
                      <div className={styles.resultLabel} style={{ color: '#D4AF37' }}>Labor Cost</div>
                      <div className={styles.resultValue} style={{ color: '#D4AF37', fontWeight: 600 }}>
                        ${newIdeaResult.laborCost.toFixed(2)}
                      </div>
                    </div>

                    <div className={styles.resultCard}>
                      <div className={styles.resultLabel}>Base CPU (Material + Labor)</div>
                      <div className={styles.resultValue}>${newIdeaResult.baseCPU.toFixed(2)}</div>
                    </div>

                    {newIdeaResult.distributionCPU > 0 && (
                      <div className={styles.resultCard}>
                        <div className={styles.resultLabel}>Distribution CPU</div>
                        <div className={styles.resultValue}>${newIdeaResult.distributionCPU.toFixed(2)}</div>
                      </div>
                    )}

                    <div className={styles.resultCard}>
                      <div className={styles.resultLabel}>Total CPU</div>
                      <div className={styles.resultValue}>${newIdeaResult.totalCPU.toFixed(2)}</div>
                    </div>

                    <div className={styles.resultCard}>
                      <div className={styles.resultLabel}>Target Retail Price</div>
                      <div className={styles.resultValue}>${newIdeaResult.retailPrice.toFixed(2)}</div>
                    </div>

                    <div className={styles.resultCard}>
                      <div className={styles.resultLabel}>Profit Margin</div>
                      <div className={styles.resultValue}>${newIdeaResult.profitMargin.toFixed(2)}</div>
                    </div>

                    <div className={styles.resultCard}>
                      <div className={styles.resultLabel}>Margin %</div>
                      <div className={styles.resultValue}>
                        <MarginQualityBadge
                          quality={newIdeaResult.marginQuality}
                          marginPercentage={newIdeaResult.marginPercentage.toFixed(2)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Unit Cost Calculator (30%) */}
            <div className={styles.calculatorPanel}>
              <h4 className={styles.calculatorTitle}>Unit Cost Calculator</h4>

              <div className={styles.calculatorToggle}>
                <button
                  className={calculatorType === 'weight' ? styles.active : ''}
                  onClick={() => setCalculatorType('weight')}
                >
                  Weight
                </button>
                <button
                  className={calculatorType === 'volume' ? styles.active : ''}
                  onClick={() => setCalculatorType('volume')}
                >
                  Volume
                </button>
              </div>

              <div className={styles.calculatorInputs}>
                {/* I paid: $ */}
                <div className={styles.calculatorField}>
                  <label>I paid:</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="$"
                    value={calculatorPrice}
                    onChange={(e) => setCalculatorPrice(e.target.value)}
                  />
                </div>

                {/* for X units */}
                <div className={styles.calculatorField}>
                  <label>for</label>
                  <div className={styles.calculatorRow}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Qty"
                      value={calculatorQuantity}
                      onChange={(e) => setCalculatorQuantity(e.target.value)}
                    />
                    <select
                      value={calculatorFromUnit}
                      onChange={(e) => setCalculatorFromUnit(e.target.value)}
                    >
                      {calculatorType === 'weight' ? (
                        <>
                          <option value="oz">oz</option>
                          <option value="lb">lb</option>
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                        </>
                      ) : (
                        <>
                          <option value="fl oz">fl oz</option>
                          <option value="cup">cup</option>
                          <option value="pt">pt</option>
                          <option value="qt">qt</option>
                          <option value="L">L</option>
                          <option value="mL">mL</option>
                          <option value="gal">gal</option>
                          <option value="tsp">tsp</option>
                          <option value="tbsp">tbsp</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Recipe needs: X units */}
                <div className={styles.calculatorField}>
                  <label>Recipe needs:</label>
                  <div className={styles.calculatorRow}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Qty"
                      value={calculatorToQuantity}
                      onChange={(e) => setCalculatorToQuantity(e.target.value)}
                    />
                    <select
                      value={calculatorToUnit}
                      onChange={(e) => setCalculatorToUnit(e.target.value)}
                    >
                      {calculatorType === 'weight' ? (
                      <>
                        <option value="oz">oz</option>
                        <option value="lb">lb</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                      </>
                    ) : (
                      <>
                        <option value="fl oz">fl oz</option>
                        <option value="cup">cup</option>
                        <option value="pt">pt</option>
                        <option value="qt">qt</option>
                        <option value="L">L</option>
                        <option value="mL">mL</option>
                        <option value="gal">gal</option>
                        <option value="tsp">tsp</option>
                        <option value="tbsp">tbsp</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

                <div className={styles.calculatorResult}>
                  <strong>= CPU:</strong>
                  <span className={styles.cpuResult}>
                    {calculatedCPU !== null ? `$${calculatedCPU.toFixed(2)}` : '$--'}
                  </span>
                </div>

                {calculatedCPU !== null && (
                  <Button
                    variant="gold"
                    onClick={insertCalculatedCPU}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    Add to Recipe →
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
