import { useState, useEffect } from 'react';
import { Input } from '../forms/Input';
import { Checkbox } from '../forms/Checkbox';
import { Button } from '../core/Button';
import { Card, CardHeader, CardBody, CardFooter } from '../ui/Card';
import { Select } from '../forms/Select';
import { db } from '../../db/database';
import { useAuth } from '../../contexts/AuthContext';
import type { CPGDistributor, CPGCategory, CPGInvoice } from '../../db/schema/cpg.schema';
import type { DistributionCalcParams } from '../../services/cpg/distributionCostCalculator.service';
import Decimal from 'decimal.js';
import styles from './DistributionCalculatorForm.module.css';

export interface DistributionCalculatorFormProps {
  /**
   * Selected distributor
   */
  distributor: CPGDistributor;
  /**
   * Callback when calculation is requested
   */
  onCalculate: (params: DistributionCalcParams) => void;
  /**
   * Loading state
   */
  loading?: boolean;
  /**
   * Latest base CPUs (from invoices) to auto-populate
   */
  latestBaseCPUs?: Record<string, string>;
}

interface VariantInput {
  id: string;
  variantName: string;
  pricePerUnit: string;
  baseCPU: string;
}

interface VariantOption {
  type: 'product' | 'category-variant';
  productId?: string;
  productName: string;
  categoryName?: string;
  variantName?: string;
  latestPrice: string | null;
  latestCPU: string | null;
}

// Track which fees are selected and any associated quantities
interface FeeSelection {
  feeId: string;
  selected: boolean;
  quantity?: string; // For per_day fees, etc.
}

/**
 * DistributionCalculatorForm Component
 *
 * Form with inputs and checkboxes for distribution cost calculation.
 *
 * Requirements: Group C2 - Distribution Cost Analyzer
 *
 * Inputs:
 * - Number of pallets
 * - Units per pallet
 * - Price per unit - per variant
 * - Base CPU - per variant (auto-populate from latest invoice)
 * - MSRP markup % (optional)
 *
 * Fee Selection (dynamic based on distributor's fee_structure):
 * - Each fee can be selected via checkbox
 * - Some fees may need quantity inputs (e.g., days for per_day fees)
 *
 * @example
 * ```tsx
 * <DistributionCalculatorForm
 *   distributor={selectedDistributor}
 *   onCalculate={(params) => runCalculation(params)}
 *   latestBaseCPUs={{ "8oz": "2.15", "16oz": "3.20" }}
 * />
 * ```
 */
export function DistributionCalculatorForm({
  distributor,
  onCalculate,
  loading = false,
  latestBaseCPUs = {},
}: DistributionCalculatorFormProps) {
  const { companyId: authCompanyId } = useAuth();
  const companyId = authCompanyId || 'company-1';

  const [numPallets, setNumPallets] = useState('1');
  const [unitsPerPallet, setUnitsPerPallet] = useState('');
  const [msrpMarkupPercentage, setMsrpMarkupPercentage] = useState('');

  // Available variants from CPG categories
  const [availableVariants, setAvailableVariants] = useState<VariantOption[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(true);

  // Variants - user can add multiple
  const [variants, setVariants] = useState<VariantInput[]>([
    {
      id: Math.random().toString(36).substr(2, 9),
      variantName: '',
      pricePerUnit: '',
      baseCPU: '',
    },
  ]);

  // Fee selections - dynamic based on distributor fees
  const [feeSelections, setFeeSelections] = useState<Record<string, FeeSelection>>({});

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize fee selections when distributor changes
  useEffect(() => {
    const initialSelections: Record<string, FeeSelection> = {};
    distributor.fee_structure.forEach(fee => {
      initialSelections[fee.id] = {
        feeId: fee.id,
        selected: false,
        quantity: fee.unit.includes('day') ? '1' : undefined,
      };
    });
    setFeeSelections(initialSelections);
  }, [distributor]);

  // Load available variants from finished products
  useEffect(() => {
    const loadVariants = async () => {
      try {
        setLoadingVariants(true);

        if (!companyId || companyId === '') {
          setAvailableVariants([]);
          setLoadingVariants(false);
          return;
        }

        const allProducts = await db.cpgFinishedProducts
          .where('company_id')
          .equals(companyId)
          .toArray();

        const products = allProducts.filter((p) => p.active && !p.deleted_at);

        const variantOptions: VariantOption[] = [];

        for (const product of products) {
          const recipes = await db.cpgRecipes
            .where('[company_id+finished_product_id]')
            .equals([companyId, product.id])
            .and((r) => r.active && !r.deleted_at)
            .toArray();

          let calculatedCPU: string | null = null;

          if (recipes.length > 0) {
            let totalCPU = new Decimal(0);

            for (const recipe of recipes) {
              const category = await db.cpgCategories.get(recipe.category_id);
              if (!category) continue;

              const invoices = await db.cpgInvoices
                .where('company_id')
                .equals(companyId)
                .and((inv) => !inv.deleted_at)
                .reverse()
                .sortBy('invoice_date');

              let componentCPU: string | null = null;

              for (const invoice of invoices) {
                if (invoice.calculated_cpus) {
                  const cpuKey = recipe.variant
                    ? `${category.id}_${recipe.variant}`
                    : category.id;
                  componentCPU = invoice.calculated_cpus[cpuKey] || null;
                  if (componentCPU) break;
                }
              }

              if (componentCPU) {
                const quantity = new Decimal(recipe.quantity);
                const cpu = new Decimal(componentCPU);
                totalCPU = totalCPU.plus(quantity.times(cpu));
              }
            }

            if (totalCPU.greaterThan(0)) {
              calculatedCPU = totalCPU.toFixed(2);
            }
          }

          variantOptions.push({
            type: 'product',
            productId: product.id,
            productName: product.name,
            latestPrice: product.msrp || null,
            latestCPU: calculatedCPU,
          });
        }

        variantOptions.sort((a, b) => a.productName.localeCompare(b.productName));
        setAvailableVariants(variantOptions);
      } catch (error) {
        console.error('Error loading variants:', error);
      } finally {
        setLoadingVariants(false);
      }
    };

    loadVariants();
  }, [companyId]);

  // Auto-populate base CPUs when available
  useEffect(() => {
    if (Object.keys(latestBaseCPUs).length > 0) {
      setVariants(
        Object.entries(latestBaseCPUs).map(([variantName, baseCPU]) => ({
          id: Math.random().toString(36).substr(2, 9),
          variantName,
          pricePerUnit: '',
          baseCPU,
        }))
      );
    }
  }, [latestBaseCPUs]);

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        id: Math.random().toString(36).substr(2, 9),
        variantName: '',
        pricePerUnit: '',
        baseCPU: '',
      },
    ]);
  };

  const removeVariant = (id: string) => {
    if (variants.length > 1) {
      setVariants(variants.filter((v) => v.id !== id));
    }
  };

  const updateVariant = (id: string, field: keyof VariantInput, value: string) => {
    setVariants(variants.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const handleVariantSelect = (id: string, selectedOption: string) => {
    const selected = availableVariants.find((opt) => {
      if (opt.type === 'product') {
        return opt.productName === selectedOption;
      }
      return false;
    });

    if (selected) {
      // Update all fields at once to avoid state batching issues
      setVariants(variants.map((v) => {
        if (v.id === id) {
          return {
            ...v,
            variantName: selected.productName,
            pricePerUnit: selected.latestPrice || v.pricePerUnit,
            baseCPU: selected.latestCPU || v.baseCPU,
          };
        }
        return v;
      }));
    }
  };

  const toggleFee = (feeId: string) => {
    setFeeSelections(prev => ({
      ...prev,
      [feeId]: {
        ...prev[feeId],
        selected: !prev[feeId].selected,
      },
    }));
  };

  const updateFeeQuantity = (feeId: string, quantity: string) => {
    setFeeSelections(prev => ({
      ...prev,
      [feeId]: {
        ...prev[feeId],
        quantity,
      },
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!numPallets || parseFloat(numPallets) <= 0) {
      newErrors.numPallets = 'Number of pallets must be greater than 0';
    }

    if (!unitsPerPallet || parseFloat(unitsPerPallet) <= 0) {
      newErrors.unitsPerPallet = 'Units per pallet must be greater than 0';
    }

    variants.forEach((variant, index) => {
      if (!variant.variantName.trim()) {
        newErrors[`variant_${variant.id}_name`] = 'Product name is required';
      }
      if (!variant.pricePerUnit || parseFloat(variant.pricePerUnit) <= 0) {
        newErrors[`variant_${variant.id}_price`] = 'Price must be greater than 0';
      }
      if (!variant.baseCPU || parseFloat(variant.baseCPU) < 0) {
        newErrors[`variant_${variant.id}_cpu`] = 'Base CPU is required';
      }
    });

    // Validate fee quantities where needed
    Object.entries(feeSelections).forEach(([feeId, selection]) => {
      if (selection.selected && selection.quantity !== undefined) {
        const qty = parseFloat(selection.quantity);
        if (isNaN(qty) || qty <= 0) {
          newErrors[`fee_${feeId}_quantity`] = 'Quantity must be greater than 0';
        }
      }
    });

    if (msrpMarkupPercentage && parseFloat(msrpMarkupPercentage) < 0) {
      newErrors.msrpMarkupPercentage = 'MSRP markup cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Build variant data
    const variantData: Record<string, { price_per_unit: string; base_cpu: string }> = {};
    variants.forEach((variant) => {
      variantData[variant.variantName] = {
        price_per_unit: variant.pricePerUnit,
        base_cpu: variant.baseCPU,
      };
    });

    // Build selected fees with their configurations
    const selectedFees = Object.entries(feeSelections)
      .filter(([_, selection]) => selection.selected)
      .map(([feeId, selection]) => {
        const fee = distributor.fee_structure.find(f => f.id === feeId);
        return {
          feeId,
          description: fee!.description,
          amount: fee!.amount,
          unit: fee!.unit,
          quantity: selection.quantity,
        };
      });

    const params: DistributionCalcParams = {
      distributorId: distributor.id,
      numPallets,
      unitsPerPallet,
      variantData,
      selectedFees, // Pass the flexible fee selections
      msrpMarkupPercentage: msrpMarkupPercentage || null,
    };

    onCalculate(params);
  };

  const needsQuantityInput = (unit: string): boolean => {
    return unit === 'per_day_full' || unit === 'per_day_half';
  };

  const getUnitLabel = (unit: string): string => {
    const labels: Record<string, string> = {
      per_pallet: 'per pallet',
      per_case: 'per case',
      per_day_full: 'per day (full)',
      per_day_half: 'per day (half)',
      per_shipment: 'per shipment',
      per_zone: 'per zone',
      flat_fee: 'flat fee',
      percentage: '%',
    };
    return labels[unit] || unit;
  };

  return (
    <Card variant="bordered" padding="lg">
      <form onSubmit={handleCalculate}>
        <CardHeader>
          <h3 className={styles.formTitle}>Distribution Cost Calculator</h3>
          <p className={styles.formDescription}>
            Calculate distribution costs and profit margins for {distributor.name}.
          </p>
        </CardHeader>

        <CardBody>
          <div className={styles.formGrid}>
            {/* Basic Calculation Inputs */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Shipment Details</h4>

              <div className={styles.inputRow}>
                <Input
                  label="Number of Pallets"
                  type="number"
                  step="0.01"
                  min="0"
                  value={numPallets}
                  onChange={(e) => setNumPallets(e.target.value)}
                  error={errors.numPallets}
                  required
                  placeholder="1.00"
                />

                <Input
                  label="Units per Pallet"
                  type="number"
                  step="1"
                  min="0"
                  value={unitsPerPallet}
                  onChange={(e) => setUnitsPerPallet(e.target.value)}
                  error={errors.unitsPerPallet}
                  required
                  placeholder="100"
                  helperText="Total number of individual units on each pallet"
                />
              </div>
            </div>

            {/* Products / Variants */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Products</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariant}
                  iconBefore={<span>+</span>}
                >
                  Add Product
                </Button>
              </div>

              {loadingVariants && (
                <p className={styles.loadingText}>Loading products...</p>
              )}

              <div className={styles.variantsList}>
                {variants.map((variant, index) => (
                  <div key={variant.id} className={styles.variantRow}>
                    <div className={styles.variantNumber}>{index + 1}</div>
                    <div className={styles.variantFields}>
                      <div className={styles.variantField}>
                        <label className={styles.variantLabel}>Product</label>
                        {availableVariants.length > 0 ? (
                          <Select
                            value={variant.variantName}
                            onChange={(e) => handleVariantSelect(variant.id, e.target.value)}
                            options={[
                              { value: '', label: 'Select a product...' },
                              ...availableVariants.map((opt) => ({
                                value: opt.productName,
                                label: opt.productName,
                              })),
                            ]}
                            error={errors[`variant_${variant.id}_name`]}
                          />
                        ) : (
                          <input
                            type="text"
                            value={variant.variantName}
                            onChange={(e) => updateVariant(variant.id, 'variantName', e.target.value)}
                            placeholder="ex: 8oz Body Oil"
                            className={styles.variantInput}
                          />
                        )}
                      </div>

                      <div className={styles.variantField}>
                        <label className={styles.variantLabel}>Price/Unit</label>
                        <div className={styles.amountWrapper}>
                          <span className={styles.currencySymbol}>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={variant.pricePerUnit}
                            onChange={(e) => updateVariant(variant.id, 'pricePerUnit', e.target.value)}
                            placeholder="0.00"
                            className={styles.variantInputAmount}
                          />
                        </div>
                        {errors[`variant_${variant.id}_price`] && (
                          <span className={styles.errorText}>{errors[`variant_${variant.id}_price`]}</span>
                        )}
                      </div>

                      <div className={styles.variantField}>
                        <label className={styles.variantLabel}>Base CPU</label>
                        <div className={styles.amountWrapper}>
                          <span className={styles.currencySymbol}>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={variant.baseCPU}
                            onChange={(e) => updateVariant(variant.id, 'baseCPU', e.target.value)}
                            placeholder="0.00"
                            className={styles.variantInputAmount}
                          />
                        </div>
                        {errors[`variant_${variant.id}_cpu`] && (
                          <span className={styles.errorText}>{errors[`variant_${variant.id}_cpu`]}</span>
                        )}
                      </div>

                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVariant(variant.id)}
                          className={styles.removeVariantButton}
                          aria-label="Remove product"
                          title="Remove product"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fee Selection - Dynamic */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Distributor Fees</h4>
              <p className={styles.sectionDescription}>
                Select which fees apply to this calculation.
              </p>

              {distributor.fee_structure.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No fees configured for this distributor. Edit the distributor to add fees.</p>
                </div>
              ) : (
                <div className={styles.feeCheckboxes}>
                  {distributor.fee_structure.map((fee) => (
                    <div key={fee.id} className={styles.feeCheckboxRow}>
                      <Checkbox
                        label={`${fee.description} ($${fee.amount} ${getUnitLabel(fee.unit)})`}
                        checked={feeSelections[fee.id]?.selected || false}
                        onChange={() => toggleFee(fee.id)}
                      />

                      {feeSelections[fee.id]?.selected && needsQuantityInput(fee.unit) && (
                        <div className={styles.feeQuantityInput}>
                          <Input
                            label="Days"
                            type="number"
                            step="1"
                            min="1"
                            value={feeSelections[fee.id].quantity || '1'}
                            onChange={(e) => updateFeeQuantity(fee.id, e.target.value)}
                            error={errors[`fee_${fee.id}_quantity`]}
                            placeholder="1"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MSRP Markup (Optional) */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>MSRP Calculation (Optional)</h4>
              <p className={styles.sectionDescription}>
                Add a markup percentage to calculate MSRP from wholesale price.
              </p>

              <Input
                label="MSRP Markup Percentage"
                type="number"
                step="0.1"
                min="0"
                value={msrpMarkupPercentage}
                onChange={(e) => setMsrpMarkupPercentage(e.target.value)}
                error={errors.msrpMarkupPercentage}
                placeholder="50"
                helperText="e.g., 50 for 50% markup"
                iconAfter={<span>%</span>}
              />
            </div>
          </div>
        </CardBody>

        <CardFooter>
          <div className={styles.formActions}>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
              size="lg"
            >
              Calculate Distribution Costs
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
