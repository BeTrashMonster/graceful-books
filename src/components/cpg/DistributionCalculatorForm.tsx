import { useState, useEffect } from 'react';
import { Input } from '../forms/Input';
import { Checkbox } from '../forms/Checkbox';
import { Radio } from '../forms/Radio';
import { Button } from '../core/Button';
import { Card, CardHeader, CardBody, CardFooter } from '../ui/Card';
import type { CPGDistributor } from '../../db/schema/cpg.schema';
import type { DistributionCalcParams } from '../../services/cpg/distributionCostCalculator.service';
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
 * Fee Selection (checkboxes):
 * - Pallet cost
 * - Warehouse services
 * - Pallet build
 * - Floor space: None | Full Day | Half Day + Days input
 * - Truck transfer: None | Zone 1 | Zone 2
 * - Custom fees (multi-select)
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
  const [numPallets, setNumPallets] = useState('1');
  const [unitsPerPallet, setUnitsPerPallet] = useState('');
  const [msrpMarkupPercentage, setMsrpMarkupPercentage] = useState('');

  // Variants - user can add multiple
  const [variants, setVariants] = useState<VariantInput[]>([
    {
      id: Math.random().toString(36).substr(2, 9),
      variantName: '',
      pricePerUnit: '',
      baseCPU: '',
    },
  ]);

  // Fee selections
  const [palletCost, setPalletCost] = useState(false);
  const [warehouseServices, setWarehouseServices] = useState(false);
  const [palletBuild, setPalletBuild] = useState(false);
  const [floorSpace, setFloorSpace] = useState<'none' | 'full_day' | 'half_day'>('none');
  const [floorSpaceDays, setFloorSpaceDays] = useState('1');
  const [truckTransferZone, setTruckTransferZone] = useState<'none' | 'zone1' | 'zone2'>('none');
  const [selectedCustomFees, setSelectedCustomFees] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

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
    setVariants(variants.filter((v) => v.id !== id));
  };

  const updateVariant = (
    id: string,
    field: 'variantName' | 'pricePerUnit' | 'baseCPU',
    value: string
  ) => {
    setVariants(
      variants.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const toggleCustomFee = (feeName: string) => {
    setSelectedCustomFees((prev) =>
      prev.includes(feeName)
        ? prev.filter((name) => name !== feeName)
        : [...prev, feeName]
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!numPallets || parseFloat(numPallets) <= 0) {
      newErrors.numPallets = 'Number of pallets must be greater than 0';
    }

    if (!unitsPerPallet || parseFloat(unitsPerPallet) <= 0) {
      newErrors.unitsPerPallet = 'Units per pallet must be greater than 0';
    }

    if (variants.length === 0) {
      newErrors.variants = 'At least one variant is required';
    }

    variants.forEach((variant) => {
      if (!variant.variantName.trim()) {
        newErrors[`variant_${variant.id}_name`] = 'Variant name is required';
      }
      if (!variant.pricePerUnit || parseFloat(variant.pricePerUnit) < 0) {
        newErrors[`variant_${variant.id}_price`] = 'Valid price is required';
      }
      if (!variant.baseCPU || parseFloat(variant.baseCPU) < 0) {
        newErrors[`variant_${variant.id}_cpu`] = 'Valid base CPU is required';
      }
    });

    if (floorSpace !== 'none' && (!floorSpaceDays || parseFloat(floorSpaceDays) <= 0)) {
      newErrors.floorSpaceDays = 'Days must be greater than 0';
    }

    if (
      msrpMarkupPercentage &&
      (parseFloat(msrpMarkupPercentage) < 0 || parseFloat(msrpMarkupPercentage) > 1000)
    ) {
      newErrors.msrpMarkupPercentage = 'MSRP markup must be between 0 and 1000%';
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
    const variantData: DistributionCalcParams['variantData'] = {};
    variants.forEach((v) => {
      if (v.variantName.trim()) {
        variantData[v.variantName.trim()] = {
          price_per_unit: v.pricePerUnit.trim(),
          base_cpu: v.baseCPU.trim(),
        };
      }
    });

    const params: DistributionCalcParams = {
      distributorId: distributor.id,
      numPallets: numPallets.trim(),
      unitsPerPallet: unitsPerPallet.trim(),
      variantData,
      appliedFees: {
        pallet_cost: palletCost,
        warehouse_services: warehouseServices,
        pallet_build: palletBuild,
        floor_space: floorSpace,
        floor_space_days: floorSpace !== 'none' ? floorSpaceDays.trim() : undefined,
        truck_transfer_zone: truckTransferZone,
        custom_fees: selectedCustomFees.length > 0 ? selectedCustomFees : undefined,
      },
      msrpMarkupPercentage: msrpMarkupPercentage.trim() || undefined,
    };

    onCalculate(params);
  };

  const customFeesAvailable = distributor.fee_structure.custom_fees
    ? Object.keys(distributor.fee_structure.custom_fees)
    : [];

  return (
    <Card variant="bordered" padding="lg">
      <form onSubmit={handleCalculate}>
        <CardHeader>
          <h3 className={styles.formTitle}>Distribution Calculator</h3>
          <p className={styles.formDescription}>
            Calculate distribution costs and profit margins for {distributor.name}.
          </p>
        </CardHeader>

        <CardBody>
          <div className={styles.formGrid}>
            {/* Pallet & Unit Parameters */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Pallet Parameters</h4>
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
                  fullWidth
                  placeholder="1.00"
                />
                <Input
                  label="Units Per Pallet"
                  type="number"
                  step="1"
                  min="0"
                  value={unitsPerPallet}
                  onChange={(e) => setUnitsPerPallet(e.target.value)}
                  error={errors.unitsPerPallet}
                  required
                  fullWidth
                  placeholder="100"
                  helperText="Total units on each pallet"
                />
              </div>
            </div>

            {/* Variant Pricing */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Product Variants</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariant}
                  iconBefore={<span>+</span>}
                >
                  Add Variant
                </Button>
              </div>

              {errors.variants && (
                <p className={styles.errorText}>{errors.variants}</p>
              )}

              <div className={styles.variantsList}>
                {variants.map((variant, index) => (
                  <div key={variant.id} className={styles.variantRow}>
                    <div className={styles.variantNumber}>{index + 1}</div>
                    <Input
                      label="Variant Name"
                      value={variant.variantName}
                      onChange={(e) =>
                        updateVariant(variant.id, 'variantName', e.target.value)
                      }
                      error={errors[`variant_${variant.id}_name`]}
                      placeholder="e.g., 8oz, Small"
                      fullWidth
                    />
                    <Input
                      label="Price Per Unit"
                      type="number"
                      step="0.01"
                      min="0"
                      value={variant.pricePerUnit}
                      onChange={(e) =>
                        updateVariant(variant.id, 'pricePerUnit', e.target.value)
                      }
                      error={errors[`variant_${variant.id}_price`]}
                      iconBefore={<span>$</span>}
                      placeholder="0.00"
                      fullWidth
                    />
                    <Input
                      label="Base CPU"
                      type="number"
                      step="0.01"
                      min="0"
                      value={variant.baseCPU}
                      onChange={(e) => updateVariant(variant.id, 'baseCPU', e.target.value)}
                      error={errors[`variant_${variant.id}_cpu`]}
                      iconBefore={<span>$</span>}
                      placeholder="0.00"
                      helperText="From latest invoice"
                      fullWidth
                    />
                    {variants.length > 1 && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => removeVariant(variant.id)}
                        aria-label="Remove variant"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Fee Selection */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Fee Selection</h4>
              <p className={styles.sectionDescription}>
                Select which fees apply to this calculation.
              </p>

              <div className={styles.feeCheckboxes}>
                {/* Basic Fees */}
                {distributor.fee_structure.pallet_cost && (
                  <Checkbox
                    label={`Pallet Cost ($${distributor.fee_structure.pallet_cost})`}
                    checked={palletCost}
                    onChange={(e) => setPalletCost(e.target.checked)}
                  />
                )}

                {distributor.fee_structure.warehouse_services && (
                  <Checkbox
                    label={`Warehouse Services ($${distributor.fee_structure.warehouse_services})`}
                    checked={warehouseServices}
                    onChange={(e) => setWarehouseServices(e.target.checked)}
                  />
                )}

                {distributor.fee_structure.pallet_build && (
                  <Checkbox
                    label={`Pallet Build ($${distributor.fee_structure.pallet_build})`}
                    checked={palletBuild}
                    onChange={(e) => setPalletBuild(e.target.checked)}
                  />
                )}

                {/* Floor Space */}
                {(distributor.fee_structure.floor_space_full_day ||
                  distributor.fee_structure.floor_space_half_day) && (
                  <div className={styles.floorSpaceSection}>
                    <h5 className={styles.subsectionTitle}>Floor Space</h5>
                    <div className={styles.radioGroup}>
                      <Radio
                        label="None"
                        name="floorSpace"
                        value="none"
                        checked={floorSpace === 'none'}
                        onChange={() => setFloorSpace('none')}
                      />
                      {distributor.fee_structure.floor_space_full_day && (
                        <Radio
                          label={`Full Day ($${distributor.fee_structure.floor_space_full_day})`}
                          name="floorSpace"
                          value="full_day"
                          checked={floorSpace === 'full_day'}
                          onChange={() => setFloorSpace('full_day')}
                        />
                      )}
                      {distributor.fee_structure.floor_space_half_day && (
                        <Radio
                          label={`Half Day ($${distributor.fee_structure.floor_space_half_day})`}
                          name="floorSpace"
                          value="half_day"
                          checked={floorSpace === 'half_day'}
                          onChange={() => setFloorSpace('half_day')}
                        />
                      )}
                    </div>
                    {floorSpace !== 'none' && (
                      <Input
                        label="Number of Days"
                        type="number"
                        step="1"
                        min="1"
                        value={floorSpaceDays}
                        onChange={(e) => setFloorSpaceDays(e.target.value)}
                        error={errors.floorSpaceDays}
                        placeholder="1"
                        fullWidth
                      />
                    )}
                  </div>
                )}

                {/* Truck Transfer */}
                {(distributor.fee_structure.truck_transfer_zone1 ||
                  distributor.fee_structure.truck_transfer_zone2) && (
                  <div className={styles.truckTransferSection}>
                    <h5 className={styles.subsectionTitle}>Truck Transfer</h5>
                    <div className={styles.radioGroup}>
                      <Radio
                        label="None"
                        name="truckTransfer"
                        value="none"
                        checked={truckTransferZone === 'none'}
                        onChange={() => setTruckTransferZone('none')}
                      />
                      {distributor.fee_structure.truck_transfer_zone1 && (
                        <Radio
                          label={`Zone 1 ($${distributor.fee_structure.truck_transfer_zone1})`}
                          name="truckTransfer"
                          value="zone1"
                          checked={truckTransferZone === 'zone1'}
                          onChange={() => setTruckTransferZone('zone1')}
                        />
                      )}
                      {distributor.fee_structure.truck_transfer_zone2 && (
                        <Radio
                          label={`Zone 2 ($${distributor.fee_structure.truck_transfer_zone2})`}
                          name="truckTransfer"
                          value="zone2"
                          checked={truckTransferZone === 'zone2'}
                          onChange={() => setTruckTransferZone('zone2')}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Custom Fees */}
                {customFeesAvailable.length > 0 && (
                  <div className={styles.customFeesSection}>
                    <h5 className={styles.subsectionTitle}>Custom Fees</h5>
                    <div className={styles.customFeeCheckboxes}>
                      {customFeesAvailable.map((feeName) => (
                        <Checkbox
                          key={feeName}
                          label={`${feeName} ($${distributor.fee_structure.custom_fees![feeName]})`}
                          checked={selectedCustomFees.includes(feeName)}
                          onChange={() => toggleCustomFee(feeName)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* MSRP Markup */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>MSRP Calculation (Optional)</h4>
              <Input
                label="MSRP Markup Percentage"
                type="number"
                step="0.01"
                min="0"
                max="1000"
                value={msrpMarkupPercentage}
                onChange={(e) => setMsrpMarkupPercentage(e.target.value)}
                error={errors.msrpMarkupPercentage}
                iconAfter={<span>%</span>}
                placeholder="50"
                helperText="Markup from wholesale to retail (e.g., 50 for 50%)"
                fullWidth
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
