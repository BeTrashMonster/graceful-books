/**
 * Compare Distributors Tab
 *
 * Side-by-side comparison of 2-4 distributors to find the best option
 * based on costs, margins, and overall value.
 */

import { useState, useEffect } from 'react';
import { Button } from '../../../../components/core/Button';
import { ErrorMessage } from '../../../../components/feedback/ErrorMessage';
import { MarginQualityBadge } from '../../../../components/cpg/MarginQualityBadge';
import type { CPGDistributor, CPGCategory } from '../../../../db/schema/cpg.schema';
import { db } from '../../../../db/database';
import { ScenarioPlanningService } from '../../../../services/cpg/scenarioPlanning.service';
import type { DistributorComparisonReport } from '../../../../services/cpg/scenarioPlanning.service';
import styles from '../../ScenarioPlanning.module.css';

interface CompareDistributorsTabProps {
  distributors: CPGDistributor[];
  companyId: string;
  service: ScenarioPlanningService;
}

interface ProductOption {
  id: string; // category_id + variant or 'new'
  label: string; // Display name
  categoryName: string;
  variant: string;
  isNew: boolean;
}

export function CompareDistributorsTab({ distributors, companyId, service }: CompareDistributorsTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedDistributorIds, setSelectedDistributorIds] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<DistributorComparisonReport | null>(null);
  const [costTrends, setCostTrends] = useState<Record<string, string>>({});
  const [_categories, _setCategories] = useState<CPGCategory[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [comparisonParams, setComparisonParams] = useState({
    numPallets: '1',
    unitsPerPallet: '100',
    variants: [{ productId: 'new', name: '8oz Jar', price: '10.00', baseCPU: '3.00', quantity: '100' }],
  });
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false);
  const [customFees, setCustomFees] = useState<Record<string, Array<{
    feeId: string;
    description: string;
    amount: string;
    unit: string;
    quantity: string;
    enabled: boolean;
    percentage_basis?: string;
  }>>>({});

  // Load finished products and build product options
  useEffect(() => {
    loadProducts();
  }, [companyId]);

  // Initialize custom fees when distributors are selected
  useEffect(() => {
    const newCustomFees: typeof customFees = {};

    selectedDistributorIds.forEach(distId => {
      const distributor = distributors.find(d => d.id === distId);
      if (distributor && !customFees[distId]) {
        newCustomFees[distId] = distributor.fee_structure.map(fee => ({
          feeId: fee.id,
          description: fee.description,
          amount: fee.amount,
          unit: fee.unit,
          quantity: '1', // Default all to 1
          enabled: true,
          percentage_basis: fee.percentage_basis,
        }));
      }
    });

    if (Object.keys(newCustomFees).length > 0) {
      setCustomFees({ ...customFees, ...newCustomFees });
    }
  }, [selectedDistributorIds]);

  const loadProducts = async () => {
    try {
      const allProducts = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .and((p) => p.active && p.deleted_at === null)
        .toArray();

      // Build product options from finished products
      const options: ProductOption[] = [
        {
          id: 'new',
          label: '+ New Product (customize details)',
          categoryName: '',
          variant: '',
          isNew: true,
        },
      ];

      allProducts.forEach((product) => {
        options.push({
          id: product.id,
          label: product.name,
          categoryName: product.name,
          variant: '',
          isNew: false,
        });
      });

      setProductOptions(options);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  const handleCompareDistributors = async () => {
    if (selectedDistributorIds.length < 2) {
      setError('Please select at least 2 distributors to compare.');
      return;
    }

    // Validate variant data
    if (comparisonParams.variants.length === 0) {
      setError('Please add at least one product variant.');
      return;
    }

    for (const variant of comparisonParams.variants) {
      if (!variant.name.trim()) {
        setError('Please enter a name for all product variants.');
        return;
      }
      if (!variant.price || parseFloat(variant.price) <= 0) {
        setError('Please enter valid sell prices for all variants.');
        return;
      }
      if (!variant.baseCPU || parseFloat(variant.baseCPU) < 0) {
        setError('Please enter valid base CPU for all variants.');
        return;
      }
      if (!variant.quantity || parseInt(variant.quantity) <= 0) {
        setError('Please enter valid quantities for all variants.');
        return;
      }
    }

    try {
      setAnalyzing(true);
      setError(null);

      // Build variantData with quantity as number
      const variantData: Record<string, { price_per_unit: string; base_cpu: string; quantity: number }> = {};
      comparisonParams.variants.forEach((v) => {
        const qty = parseInt(v.quantity, 10);
        if (isNaN(qty)) {
          throw new Error(`Invalid quantity for ${v.name}`);
        }
        variantData[v.name] = {
          price_per_unit: v.price,
          base_cpu: v.baseCPU,
          quantity: qty,
        };
      });

      // Build selectedFees from customFees - only include enabled fees
      // Use the first distributor's fees as baseline (all distributors will be calculated with their own fees in the service)
      const firstDistId = selectedDistributorIds[0];
      const selectedFees = customFees[firstDistId!]
        ?.filter(fee => fee.enabled)
        .map(fee => ({
          feeId: fee.feeId,
          description: fee.description,
          amount: fee.amount,
          unit: fee.unit as 'per_pallet' | 'per_case' | 'per_day_full' | 'per_day_half' | 'per_shipment' | 'per_zone' | 'flat_fee' | 'percentage',
          quantity: fee.quantity || undefined,
          percentage_basis: fee.percentage_basis as 'product_value' | 'distribution_cost' | 'discount' | undefined,
        })) || [];

      const result = await service.compareDistributors({
        companyId,
        distributorIds: selectedDistributorIds,
        numPallets: comparisonParams.numPallets,
        unitsPerPallet: comparisonParams.unitsPerPallet,
        variantData,
        selectedFees,
        customFees, // Pass all custom fees so service can use distributor-specific fees
      });

      // Calculate cost trends for each distributor
      const trends: Record<string, string> = {};
      for (const dist of result.distributors) {
        // Fetch last calculation for this distributor
        const lastCalcs = await db.cpgDistributionCalculations
          .where('[company_id+distributor_id]')
          .equals([companyId, dist.distributorId])
          .and((calc) => calc.active && calc.deleted_at === null)
          .reverse()
          .sortBy('calculation_date');

        if (lastCalcs && lastCalcs.length > 0) {
          const lastCalc = lastCalcs[0]!;
          const lastCost = parseFloat(lastCalc.total_distribution_cost);
          const currentCost = parseFloat(dist.totalDistributionCost);

          if (lastCost > 0) {
            const percentChange = ((currentCost - lastCost) / lastCost) * 100;
            trends[dist.distributorId] = percentChange.toFixed(1);
          } else {
            trends[dist.distributorId] = 'N/A';
          }
        } else {
          trends[dist.distributorId] = 'N/A';
        }
      }

      setCostTrends(trends);
      setComparisonResult(result);
    } catch (err: any) {
      console.error('Error comparing distributors:', err);
      setError(err.message || 'Oops! Something went wrong. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const addComparisonVariant = () => {
    setComparisonParams({
      ...comparisonParams,
      variants: [
        ...comparisonParams.variants,
        { productId: 'new', name: '', price: '10.00', baseCPU: '3.00', quantity: '100' },
      ],
    });
  };

  const handleProductSelection = async (index: number, productId: string) => {
    const updated = [...comparisonParams.variants];
    const productOption = productOptions.find((p) => p.id === productId);

    if (!productOption) return;

    if (productOption.isNew) {
      // New product - clear fields
      updated[index] = {
        productId: 'new',
        name: '',
        price: '10.00',
        baseCPU: '3.00',
        quantity: '100',
      };
      setComparisonParams({ ...comparisonParams, variants: updated });
    } else {
      // Existing finished product - get product details
      const finishedProduct = await db.cpgFinishedProducts.get(productId);
      if (!finishedProduct) return;

      const productName = finishedProduct.name;
      const msrp = finishedProduct.msrp || '10.00';

      // Calculate Base CPU from recipe
      let baseCPU = '3.00'; // Default fallback

      // Get recipes for this product
      const recipes = await db.cpgRecipes
        .where('[company_id+finished_product_id]')
        .equals([companyId, productId])
        .and((recipe) => recipe.active && recipe.deleted_at === null)
        .toArray();

      if (recipes && recipes.length > 0) {
        let totalCost = 0;

        for (const recipe of recipes) {
          // Find the latest invoice that has this category+variant
          const invoices = await db.cpgInvoices
            .where('company_id')
            .equals(companyId)
            .and((inv) => inv.active && inv.deleted_at === null)
            .reverse()
            .sortBy('invoice_date');

          // Look through invoices to find the latest CPU for this category+variant
          let componentCPU = 0;
          for (const invoice of invoices) {
            if (invoice.calculated_cpus) {
              const key = recipe.variant
                ? `${recipe.category_id}_${recipe.variant}`
                : recipe.category_id;

              if (invoice.calculated_cpus[key]) {
                componentCPU = parseFloat(invoice.calculated_cpus[key]);
                break; // Found the latest one
              }
            }
          }

          // Multiply by quantity needed in recipe
          const quantityNeeded = parseFloat(recipe.quantity);
          totalCost += componentCPU * quantityNeeded;
        }

        if (totalCost > 0) {
          baseCPU = totalCost.toFixed(2);
        }
      }

      updated[index] = {
        productId,
        name: productName,
        price: msrp,
        baseCPU,
        quantity: updated[index]?.quantity || '100',
      };
      setComparisonParams({ ...comparisonParams, variants: updated });
    }
  };

  const removeComparisonVariant = (index: number) => {
    setComparisonParams({
      ...comparisonParams,
      variants: comparisonParams.variants.filter((_, i) => i !== index),
    });
  };

  const updateComparisonVariant = (index: number, field: string, value: string) => {
    const updated = [...comparisonParams.variants];
    updated[index] = { ...updated[index]!, [field]: value };
    setComparisonParams({ ...comparisonParams, variants: updated });
  };

  const toggleDistributorSelection = (id: string) => {
    if (selectedDistributorIds.includes(id)) {
      setSelectedDistributorIds(selectedDistributorIds.filter((did) => did !== id));
      setError(null); // Clear error when unchecking
    } else {
      if (selectedDistributorIds.length < 4) {
        setSelectedDistributorIds([...selectedDistributorIds, id]);
        setError(null); // Clear error when successfully checking
      } else {
        setError('Maximum 4 distributors can be compared at once.');
      }
    }
  };

  return (
    <div className={styles.section}>
      <h2>Compare Distributors Side-by-Side</h2>
      <p>Select 2-4 distributors to compare costs and margins.</p>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Distributor Selection */}
      <div className={styles.distributorGrid}>
        {distributors.map((dist) => (
          <label key={dist.id} className={styles.distributorCard}>
            <input
              type="checkbox"
              checked={selectedDistributorIds.includes(dist.id)}
              onChange={() => toggleDistributorSelection(dist.id)}
            />
            <span className={styles.distributorName}>{dist.name}</span>
          </label>
        ))}
      </div>

      {/* Fee Breakdown - Show when distributors are selected */}
      {selectedDistributorIds.length > 0 && (
        <div className={styles.feeBreakdownSection}>
          <div className={styles.feeBreakdownHeader} onClick={() => setShowFeeBreakdown(!showFeeBreakdown)}>
            <h3>Fee Breakdown & Customization</h3>
            <span className={styles.toggleIcon}>{showFeeBreakdown ? '▼' : '▶'}</span>
          </div>
          {showFeeBreakdown && (
            <div className={styles.feeBreakdownContent}>
              <p className={styles.feeBreakdownHelp}>
                Customize which fees to include in the comparison and adjust quantities (days, zones, etc.) as needed.
                Each distributor will be calculated with their own fees.
              </p>
              {selectedDistributorIds.map(distId => {
                const distributor = distributors.find(d => d.id === distId);
                const fees = customFees[distId] || [];
                if (!distributor) return null;

                return (
                  <div key={distId} className={styles.distributorFees}>
                    <h4>{distributor.name}</h4>
                    <div className={styles.feeList}>
                      {fees.map((fee, index) => {
                        // Format fee display based on type
                        const isPercentage = fee.unit === 'percentage';
                        const needsQuantity = fee.unit === 'per_pallet' || fee.unit.includes('per_day') || fee.unit === 'per_zone' || fee.unit === 'per_case';

                        // Format unit display
                        let unitDisplay = '';
                        if (fee.unit === 'per_pallet') unitDisplay = '/ pallet';
                        else if (fee.unit === 'per_case') unitDisplay = '/ case';
                        else if (fee.unit === 'per_day_full') unitDisplay = '/ day (full)';
                        else if (fee.unit === 'per_day_half') unitDisplay = '/ day (half)';
                        else if (fee.unit === 'per_zone') unitDisplay = '/ zone';
                        else if (fee.unit === 'per_shipment') unitDisplay = '/ shipment';
                        else if (fee.unit === 'flat_fee') unitDisplay = 'flat fee';
                        else if (fee.unit === 'percentage') {
                          if (fee.percentage_basis === 'product_value') unitDisplay = '% of product value';
                          else if (fee.percentage_basis === 'distribution_cost') unitDisplay = '% of dist. cost';
                          else if (fee.percentage_basis === 'discount') unitDisplay = '% discount';
                          else unitDisplay = '%';
                        }

                        // Format amount display
                        const amountDisplay = isPercentage ? `${fee.amount}%` : `$${fee.amount}`;

                        return (
                          <div key={fee.feeId} className={styles.feeRow}>
                            <div className={styles.feeLeft}>
                              <input
                                type="checkbox"
                                checked={fee.enabled}
                                onChange={(e) => {
                                  const updated = [...fees];
                                  updated[index] = { ...updated[index]!, enabled: e.target.checked };
                                  setCustomFees({ ...customFees, [distId]: updated });
                                }}
                              />
                              <span className={styles.feeDescription}>{fee.description}</span>
                            </div>
                            <div className={styles.feeRight}>
                              <span className={styles.feeAmount}>{amountDisplay} {unitDisplay}</span>
                              {needsQuantity && (
                                <input
                                  type="text"
                                  className={styles.feeQuantityInput}
                                  placeholder="Qty"
                                  value={fee.quantity}
                                  onChange={(e) => {
                                    const updated = [...fees];
                                    updated[index] = { ...updated[index]!, quantity: e.target.value };
                                    setCustomFees({ ...customFees, [distId]: updated });
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Variant Configuration */}
      <div className={styles.variantConfig}>
        <h3>Products to Compare</h3>
        {comparisonParams.variants.map((variant, index) => (
          <div key={index} className={styles.variantRowWithLabels}>
            <div className={styles.variantFieldGroup}>
              <label>Product</label>
              <select
                value={variant.productId}
                onChange={(e) => handleProductSelection(index, e.target.value)}
              >
                {productOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.variantFieldGroup}>
              <label>Product Name</label>
              <input
                type="text"
                placeholder="Product name"
                value={variant.name}
                onChange={(e) => updateComparisonVariant(index, 'name', e.target.value)}
                disabled={variant.productId !== 'new'}
              />
            </div>
            <div className={styles.variantFieldGroup}>
              <label>Sell Price</label>
              <input
                type="text"
                placeholder="10.00"
                value={variant.price}
                onChange={(e) => updateComparisonVariant(index, 'price', e.target.value)}
              />
            </div>
            <div className={styles.variantFieldGroup}>
              <label>Base CPU</label>
              <input
                type="text"
                placeholder="3.00"
                value={variant.baseCPU}
                onChange={(e) => updateComparisonVariant(index, 'baseCPU', e.target.value)}
              />
            </div>
            <div className={styles.variantFieldGroup}>
              <label>Quantity</label>
              <input
                type="text"
                placeholder="100"
                value={variant.quantity}
                onChange={(e) => updateComparisonVariant(index, 'quantity', e.target.value)}
              />
            </div>
            {comparisonParams.variants.length > 1 && (
              <button className={styles.removeVariantButton} onClick={() => removeComparisonVariant(index)}>Remove</button>
            )}
          </div>
        ))}
        <Button variant="purple" onClick={addComparisonVariant}>
          Add Product
        </Button>
      </div>

      <div className={styles.buttonContainer}>
        <Button
          variant="gold"
          onClick={handleCompareDistributors}
          disabled={analyzing}
          style={{
            fontSize: '0.9375rem',
            padding: '0.875rem 1rem',
            borderRadius: '0.5rem',
          }}
        >
          {analyzing ? 'Comparing...' : 'Compare Distributors'}
        </Button>
      </div>

      {/* Comparison Results */}
      {comparisonResult && (
        <div className={styles.comparisonResults}>
          <h3>Comparison Results</h3>

          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th>Distributor</th>
                <th>Total Est. Dist. Cost</th>
                <th>Est. Added Cost/Unit</th>
                <th>Avg Net Margin</th>
                <th>Cost Trend</th>
              </tr>
            </thead>
            <tbody>
              {comparisonResult.distributors.map((dist) => {
                const trend = costTrends[dist.distributorId];
                const trendNum = trend && trend !== 'N/A' ? parseFloat(trend) : null;

                return (
                  <tr key={dist.distributorId}>
                    <td>{dist.distributorName}</td>
                    <td>${dist.totalDistributionCost}</td>
                    <td>${dist.distributionCostPerUnit}</td>
                    <td>
                      <MarginQualityBadge
                        quality={parseFloat(dist.averageMargin) >= 70 ? 'best' : parseFloat(dist.averageMargin) >= 60 ? 'better' : parseFloat(dist.averageMargin) >= 50 ? 'good' : 'poor'}
                        marginPercentage={dist.averageMargin}
                      />
                    </td>
                    <td>
                      {trend === 'N/A' ? (
                        <span style={{ color: '#666', fontSize: '0.875rem' }}>No history</span>
                      ) : trendNum !== null ? (
                        <span style={{
                          color: trendNum > 0 ? '#dc2626' : trendNum < 0 ? '#22c55e' : '#666',
                          fontWeight: 600,
                          fontSize: '0.875rem'
                        }}>
                          {trendNum > 0 ? '+' : ''}{trend}%
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Per-variant breakdown */}
          <div className={styles.variantBreakdown}>
            <h4>Margin by Product</h4>
            {comparisonResult.variantNames.map((variantName) => {
              // Get base CPU and price from the variant data
              const variantData = comparisonParams.variants.find(v => v.name === variantName);
              const baseCPU = variantData?.baseCPU || '0.00';
              const _sellPrice = variantData?.price || '0.00';

              return (
                <div key={variantName} className={styles.variantSection}>
                  <h5>{variantName}</h5>
                  <table className={styles.variantTableCentered}>
                    <thead>
                      <tr>
                        <th>Distributor</th>
                        <th>Base CPU</th>
                        <th>Est. Added Cost/Unit</th>
                        <th>Total Est. CPU</th>
                        <th>Net Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonResult.distributors.map((dist) => {
                        const variantResult = dist.variantResults[variantName];
                        if (!variantResult) return null;

                        const addedCost = (parseFloat(variantResult.total_cpu) - parseFloat(baseCPU)).toFixed(2);

                        return (
                          <tr key={dist.distributorId}>
                            <td>{dist.distributorName}</td>
                            <td>${baseCPU}</td>
                            <td>${addedCost}</td>
                            <td>${variantResult.total_cpu}</td>
                            <td>
                              <MarginQualityBadge
                                quality={variantResult.margin_quality}
                                marginPercentage={variantResult.net_profit_margin}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
