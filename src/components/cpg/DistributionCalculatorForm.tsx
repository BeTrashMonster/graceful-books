/**
 * Distribution Calculator Form - Redesigned
 *
 * Flexible calculator for distribution costs with:
 * - Multi-product pallets
 * - Per-pallet and per-shipment fees
 * - Dynamic zone selection
 * - Zone comparison feature
 */

import { useState, useEffect, useRef } from 'react';
import { Input } from '../forms/Input';
import { Checkbox } from '../forms/Checkbox';
import { Button } from '../core/Button';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Select } from '../forms/Select';
import { db } from '../../db/database';
import { useAuth } from '../../contexts/AuthContext';
import type { CPGDistributor } from '../../db/schema/cpg.schema';
import type { DistributionCalcParams } from '../../services/cpg/distributionCostCalculator.service';
import { cpuCalculatorService } from '../../services/cpg/cpuCalculator.service';
import Decimal from 'decimal.js';
import styles from './DistributionCalculatorForm.module.css';

export interface DistributionCalculatorFormProps {
  distributor: CPGDistributor;
  onCalculate: (params: DistributionCalcParams) => void;
  loading?: boolean;
  initialValues?: DistributionCalcParams;
  onFormChange?: () => void; // Callback when any form field changes
}

// Product within a pallet
interface PalletProduct {
  id: string;
  productName: string;
  quantity: string; // number of units of this product
  pricePerUnit: string;
  baseCPU: string; // Material cost per unit
  productionCPU: string; // Production labor cost per unit
}

// A single pallet configuration
interface Pallet {
  id: string;
  products: PalletProduct[];
  isExpanded: boolean;
  maxUnits: number;  // Max capacity for this specific pallet
}

// Available product options
interface ProductOption {
  productName: string;
  latestPrice: string | null;
  latestCPU: string | null; // Material cost only
  latestLaborCost: string | null; // Production labor cost
}

// Fee selection with quantities
interface FeeSelection {
  feeId: string;
  selected: boolean;
  quantity?: string;
}

export function DistributionCalculatorForm({
  distributor,
  onCalculate,
  loading = false,
  initialValues,
  onFormChange,
}: DistributionCalculatorFormProps) {
  const { companyId } = useAuth();

  // ===== FORM STATE KEY (per distributor) =====
  const formStateKey = `distribution-calc-${distributor.id}`;

  // ===== SHIPMENT CONFIGURATION =====
  const [numPallets, setNumPallets] = useState('1');
  const [defaultUnitsPerPallet, setDefaultUnitsPerPallet] = useState('100');

  // ===== PALLET BUILDER =====
  const [pallets, setPallets] = useState<Pallet[]>([
    {
      id: generateId(),
      products: [createEmptyProduct()],
      isExpanded: true,
      maxUnits: 100,  // Default max capacity
    },
  ]);

  // ===== PRODUCT OPTIONS =====
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // ===== FEE SELECTION =====
  const [feeSelections, setFeeSelections] = useState<Record<string, FeeSelection>>({});

  // ===== ZONE SELECTION =====
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [numPalletsToZone, setNumPalletsToZone] = useState('');

  // ===== ERRORS =====
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ===== HELPER FUNCTIONS =====
  function generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  function createEmptyProduct(): PalletProduct {
    return {
      id: generateId(),
      productName: '',
      quantity: '',
      pricePerUnit: '',
      baseCPU: '',
      productionCPU: '',
    };
  }

  // ===== LOAD SAVED FORM STATE WHEN DISTRIBUTOR CHANGES =====
  useEffect(() => {
    // If initialValues provided, use those (for loading scenarios)
    if (initialValues) {
      try {
        setNumPallets(initialValues.numPallets);
        setDefaultUnitsPerPallet(initialValues.unitsPerPallet);

        // Load pallet structure
        const loadedPallets: Pallet[] = [];

        console.log('Loading pallets from initialValues:', {
          has_pallet_data: !!initialValues.pallet_data,
          pallet_data_length: initialValues.pallet_data?.length,
          pallet_data: initialValues.pallet_data
        });

        // NEW: If pallet_data exists, use it (accurate saved structure)
        if (initialValues.pallet_data && initialValues.pallet_data.length > 0) {
          console.log('Using pallet_data to load pallets');
          initialValues.pallet_data.forEach((pallet, index) => {
            const palletProducts: PalletProduct[] = pallet.products.map(product => ({
              id: generateId(),
              productName: product.product_name,
              quantity: product.quantity.toString(),
              pricePerUnit: product.price_per_unit,
              baseCPU: product.base_cpu,
              productionCPU: product.production_cpu || '',
            }));

            console.log(`Loaded pallet ${index + 1} with products:`, palletProducts);

            loadedPallets.push({
              id: generateId(),
              products: palletProducts.length > 0 ? palletProducts : [createEmptyProduct()],
              isExpanded: index === 0, // Only expand first pallet
              maxUnits: pallet.units_per_pallet,  // Use saved max capacity
            });
          });
        } else {
          console.log('No pallet_data, using fallback logic');
          // FALLBACK: Old invoices without pallet_data - use guessing logic (backwards compatibility)
          const variantEntries = Object.entries(initialValues.variantData);
          const numPalletsInt = parseInt(initialValues.numPallets) || 1;
          const unitsPerPallet = parseInt(initialValues.unitsPerPallet) || 100;

          // If we have multiple pallets and multiple products, distribute them
          if (numPalletsInt > 1 && variantEntries.length > 1) {
            // Distribute products across pallets (one product per pallet, round-robin if needed)
            for (let i = 0; i < numPalletsInt; i++) {
              const palletProducts: PalletProduct[] = [];

              // Assign products to this pallet using round-robin distribution
              variantEntries.forEach(([productName, data], index) => {
                // Assign this product to pallet (index % numPalletsInt)
                if (index % numPalletsInt === i) {
                  palletProducts.push({
                    id: generateId(),
                    productName,
                    quantity: unitsPerPallet.toString(),
                    pricePerUnit: data.price_per_unit,
                    baseCPU: data.base_cpu,
                    productionCPU: data.production_cpu || '',
                  });
                }
              });

              loadedPallets.push({
                id: generateId(),
                products: palletProducts.length > 0 ? palletProducts : [createEmptyProduct()],
                isExpanded: i === 0, // Only expand first pallet
                maxUnits: unitsPerPallet,  // Use standard capacity for old data
              });
            }
          } else {
            // Single pallet or single product - put all products on all pallets
            for (let i = 0; i < numPalletsInt; i++) {
              const palletProducts: PalletProduct[] = variantEntries.map(([productName, data]) => ({
                id: generateId(),
                productName,
                quantity: (unitsPerPallet / variantEntries.length).toString(),
                pricePerUnit: data.price_per_unit,
                baseCPU: data.base_cpu,
                productionCPU: data.production_cpu || '',
              }));

              loadedPallets.push({
                id: generateId(),
                products: palletProducts.length > 0 ? palletProducts : [createEmptyProduct()],
                isExpanded: i === 0, // Only expand first pallet
                maxUnits: unitsPerPallet,  // Use standard capacity for old data
              });
            }
          }
        }

        setPallets(loadedPallets.length > 0 ? loadedPallets : [{
          id: generateId(),
          products: [createEmptyProduct()],
          isExpanded: true,
          maxUnits: parseInt(initialValues.unitsPerPallet) || 100,
        }]);

        // Load fee selections
        const loadedFeeSelections: Record<string, FeeSelection> = {};
        initialValues.selectedFees.forEach(fee => {
          loadedFeeSelections[fee.feeId] = {
            feeId: fee.feeId,
            selected: true,
            quantity: fee.quantity,
          };
        });

        // Initialize unselected fees
        distributor.fee_structure.forEach(fee => {
          if (!loadedFeeSelections[fee.id]) {
            loadedFeeSelections[fee.id] = {
              feeId: fee.id,
              selected: false,
              quantity: fee.unit === 'percentage'
                ? fee.amount
                : (needsQuantityInput(fee.unit) ? '1' : undefined),
            };
          }
        });

        setFeeSelections(loadedFeeSelections);

        // Load selected zone if any zone fee was selected
        const zoneFee = initialValues.selectedFees.find(fee =>
          fee.unit === 'per_zone' || fee.description.toLowerCase().includes('zone')
        );
        if (zoneFee) {
          setSelectedZone(zoneFee.feeId);
        } else {
          setSelectedZone('');
        }
      } catch (error) {
        console.error('Error loading initialValues:', error);
      }
      return;
    }

    // Otherwise, load from localStorage
    try {
      const saved = localStorage.getItem(formStateKey);
      if (saved) {
        const savedState = JSON.parse(saved);
        // Load saved data for this distributor
        setNumPallets(savedState.numPallets || '1');
        setDefaultUnitsPerPallet(savedState.defaultUnitsPerPallet || '100');
        setPallets(savedState.pallets || [
          {
            id: generateId(),
            products: [createEmptyProduct()],
            isExpanded: true,
            maxUnits: 100,
          },
        ]);
        setSelectedZone(savedState.selectedZone || '');
      } else {
        // New distributor - reset to blank slate
        setNumPallets('1');
        setDefaultUnitsPerPallet('100');
        setPallets([
          {
            id: generateId(),
            products: [createEmptyProduct()],
            isExpanded: true,
            maxUnits: 100,
          },
        ]);
        setSelectedZone('');
      }
    } catch (error) {
      console.error('Error loading saved form state:', error);
      // On error, reset to blank slate
      setNumPallets('1');
      setDefaultUnitsPerPallet('100');
      setPallets([
        {
          id: generateId(),
          products: [createEmptyProduct()],
          isExpanded: true,
        },
      ]);
      setSelectedZone('');
    }
  }, [distributor.id, formStateKey, initialValues]);

  // ===== UPDATE NUMBER OF PALLETS =====
  useEffect(() => {
    const count = parseInt(numPallets) || 1;
    const currentCount = pallets.length;

    if (count > currentCount) {
      // Add more pallets
      const newPallets = [...pallets];
      for (let i = currentCount; i < count; i++) {
        newPallets.push({
          id: generateId(),
          products: [createEmptyProduct()],
          isExpanded: true, // Auto-expand new pallets
          maxUnits: parseInt(defaultUnitsPerPallet) || 100,  // Use standard capacity for new pallets
        });
      }
      setPallets(newPallets);
    } else if (count < currentCount) {
      // Remove pallets
      setPallets(pallets.slice(0, count));
    }
  }, [numPallets]);

  // ===== INITIALIZE FEE SELECTIONS =====
  useEffect(() => {
    // Skip if initialValues provided (they will be loaded separately)
    if (initialValues) {
      return;
    }

    const initialSelections: Record<string, FeeSelection> = {};
    distributor.fee_structure.forEach(fee => {
      initialSelections[fee.id] = {
        feeId: fee.id,
        selected: false,
        // Percentage uses amount as quantity, day-based uses '1', others undefined
        quantity: fee.unit === 'percentage'
          ? fee.amount
          : (needsQuantityInput(fee.unit) ? '1' : undefined),
      };
    });
    setFeeSelections(initialSelections);
  }, [distributor, initialValues]);

  // ===== SAVE FORM STATE TO LOCALSTORAGE =====
  useEffect(() => {
    const stateToSave = {
      numPallets,
      defaultUnitsPerPallet,
      pallets,
      selectedZone,
    };
    try {
      localStorage.setItem(formStateKey, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Error saving form state:', error);
    }
  }, [numPallets, defaultUnitsPerPallet, pallets, selectedZone, formStateKey]);

  // ===== NOTIFY PARENT OF FORM CHANGES =====
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const previousInitialValuesRef = useRef<typeof initialValues>(undefined);
  const onFormChangeRef = useRef(onFormChange);

  // Update ref when callback changes
  useEffect(() => {
    onFormChangeRef.current = onFormChange;
  }, [onFormChange]);

  useEffect(() => {
    // Skip the first render (initial load)
    if (isInitialLoad) {
      setIsInitialLoad(false);
      previousInitialValuesRef.current = initialValues;
      return;
    }

    // Skip if initialValues just changed (loading a scenario)
    if (initialValues !== previousInitialValuesRef.current) {
      previousInitialValuesRef.current = initialValues;
      return;
    }

    // Notify parent that form has changed
    if (onFormChangeRef.current) {
      onFormChangeRef.current();
    }
  }, [numPallets, pallets, feeSelections, selectedZone, isInitialLoad, initialValues]);

  // ===== LOAD AVAILABLE PRODUCTS =====
  useEffect(() => {
    loadProducts();
  }, [companyId]);

  async function loadProducts() {
    try {
      setLoadingProducts(true);

      if (!companyId) {
        setAvailableProducts([]);
        return;
      }

      const products = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .and(p => p.active && !p.deleted_at)
        .toArray();

      const productOptions: ProductOption[] = [];

      for (const product of products) {
        let materialCPU: string | null = null;
        let laborCost: string | null = null;

        try {
          // Use CPU calculator service to get accurate breakdown
          const cpuBreakdown = await cpuCalculatorService.getFinishedProductCPUBreakdown(
            product.id,
            companyId
          );

          if (cpuBreakdown.materialCPU) {
            materialCPU = cpuBreakdown.materialCPU;
          }

          if (cpuBreakdown.laborCost) {
            laborCost = cpuBreakdown.laborCost;
          }
        } catch (error) {
          console.error(`Failed to get CPU for ${product.name}:`, error);
        }

        productOptions.push({
          productName: product.name,
          latestPrice: product.msrp || null,
          latestCPU: materialCPU,
          latestLaborCost: laborCost,
        });
      }

      setAvailableProducts(productOptions);
      console.log('Loaded products:', productOptions);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoadingProducts(false);
    }
  }

  // ===== PALLET MANAGEMENT =====
  function updatePallet(palletId: string, updates: Partial<Pallet>) {
    setPallets(pallets.map(p => p.id === palletId ? { ...p, ...updates } : p));
  }

  function togglePalletExpanded(palletId: string) {
    updatePallet(palletId, { isExpanded: !pallets.find(p => p.id === palletId)?.isExpanded });
  }

  function addProductToPallet(palletId: string) {
    const pallet = pallets.find(p => p.id === palletId);
    if (!pallet) return;

    updatePallet(palletId, {
      products: [...pallet.products, createEmptyProduct()],
    });
  }

  function removeProductFromPallet(palletId: string, productId: string) {
    const pallet = pallets.find(p => p.id === palletId);
    if (!pallet || pallet.products.length === 1) return;

    updatePallet(palletId, {
      products: pallet.products.filter(p => p.id !== productId),
    });
  }

  function updateProduct(palletId: string, productId: string, field: keyof PalletProduct, value: string) {
    const pallet = pallets.find(p => p.id === palletId);
    if (!pallet) return;

    const updatedProducts = pallet.products.map(product => {
      if (product.id === productId) {
        return { ...product, [field]: value };
      }
      return product;
    });

    updatePallet(palletId, { products: updatedProducts });
  }

  function handleProductSelect(palletId: string, productId: string, selectedName: string) {
    const product = availableProducts.find(p => p.productName === selectedName);
    if (!product) return;

    const pallet = pallets.find(p => p.id === palletId);
    if (!pallet) return;

    const updatedProducts = pallet.products.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          productName: product.productName,
          pricePerUnit: product.latestPrice || p.pricePerUnit,
          baseCPU: product.latestCPU || p.baseCPU,
          productionCPU: product.latestLaborCost || p.productionCPU,
          // Auto-fill quantity with default units per pallet if it's the first product
          quantity: pallet.products.length === 1 && !p.quantity ? defaultUnitsPerPallet : p.quantity,
        };
      }
      return p;
    });

    updatePallet(palletId, { products: updatedProducts });
  }

  // ===== VALIDATION =====
  function getTotalUnitsInPallet(pallet: Pallet): number {
    return pallet.products.reduce((sum, product) => {
      return sum + (parseInt(product.quantity) || 0);
    }, 0);
  }

  function validatePallet(pallet: Pallet, index: number): string[] {
    const errors: string[] = [];
    const totalUnits = getTotalUnitsInPallet(pallet);
    const maxUnits = parseInt(defaultUnitsPerPallet) || 0;

    if (totalUnits > maxUnits) {
      errors.push(`Pallet ${index + 1}: Total units (${totalUnits}) exceeds capacity (${maxUnits})`);
    }

    pallet.products.forEach((product, pIdx) => {
      if (!product.productName) {
        errors.push(`Pallet ${index + 1}, Product ${pIdx + 1}: Product name required`);
      }
      if (!product.quantity || parseInt(product.quantity) <= 0) {
        errors.push(`Pallet ${index + 1}, Product ${pIdx + 1}: Quantity required`);
      }
      if (!product.pricePerUnit || parseFloat(product.pricePerUnit) <= 0) {
        errors.push(`Pallet ${index + 1}, Product ${pIdx + 1}: Price required`);
      }
      if (!product.baseCPU || parseFloat(product.baseCPU) <= 0) {
        errors.push(`Pallet ${index + 1}, Product ${pIdx + 1}: Base CPU required`);
      }
    });

    return errors;
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!numPallets || parseInt(numPallets) <= 0) {
      newErrors.numPallets = 'Number of pallets required';
    }

    if (!defaultUnitsPerPallet || parseInt(defaultUnitsPerPallet) <= 0) {
      newErrors.defaultUnitsPerPallet = 'Units per pallet required';
    }

    // Validate all pallets
    const allPalletErrors: string[] = [];
    pallets.forEach((pallet, index) => {
      const palletErrors = validatePallet(pallet, index);
      allPalletErrors.push(...palletErrors);
    });

    if (allPalletErrors.length > 0) {
      newErrors.pallets = allPalletErrors.join('; ');
    }

    // Validate zone selection
    const zoneFieldFees = distributor.fee_structure.filter(f =>
      f.unit === 'per_zone' || f.description.toLowerCase().includes('zone')
    );

    if (zoneFieldFees.length > 0 && !selectedZone) {
      newErrors.zone = 'Please select a delivery zone';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ===== FEE HELPERS =====
  function needsQuantityInput(unit: string): boolean {
    // Only day-based fees need quantity input in the fee selection
    // Percentage gets its value from the fee amount and only adjusts via slider in results
    return unit === 'per_day_full' || unit === 'per_day_half' || unit.includes('per_day');
  }

  function getFeeDisplayName(description: string): string {
    // Rename specific fees for better clarity
    if (description.toLowerCase().includes('warehouse services')) {
      return 'Short Term Storage';
    }
    return description;
  }

  function getUnitLabel(unit: string): string {
    const labels: Record<string, string> = {
      per_pallet: 'per pallet',
      per_case: 'per case',
      per_day_full: 'per full day',
      per_day_half: 'per half day',
      per_shipment: 'per shipment',
      per_zone: 'per zone',
      flat_fee: 'flat fee',
      percentage: '%',
    };
    return labels[unit] || unit;
  }

  function toggleFee(feeId: string) {
    setFeeSelections({
      ...feeSelections,
      [feeId]: {
        ...feeSelections[feeId],
        selected: !feeSelections[feeId].selected,
      },
    });
  }

  function updateFeeQuantity(feeId: string, quantity: string) {
    setFeeSelections({
      ...feeSelections,
      [feeId]: {
        ...feeSelections[feeId],
        quantity,
      },
    });
  }

  // ===== EXTRACT ZONES FROM FEES =====
  function getAvailableZones(): Array<{ id: string; name: string; baseFee: string }> {
    const zones: Array<{ id: string; name: string; baseFee: string }> = [];

    distributor.fee_structure.forEach(fee => {
      if (fee.unit === 'per_zone' || fee.description.toLowerCase().includes('zone')) {
        // Extract zone name/number from description (e.g., "Zone 1", "Zone 2")
        const match = fee.description.match(/zone\s+(\d+)/i);
        let zoneName: string;

        if (match) {
          // Has a number - use it
          zoneName = `Zone ${match[1]}`;
        } else {
          // No number - use the full description
          zoneName = fee.description;
        }

        zones.push({
          id: fee.id,
          name: zoneName,
          baseFee: fee.amount,
        });
      }
    });

    return zones;
  }

  // ===== CALCULATE =====
  function handleCalculate(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Build pallet data with exact structure
    const palletData = pallets.map((pallet, index) => {
      const palletProducts = pallet.products.map(product => ({
        product_name: product.productName,
        quantity: parseInt(product.quantity) || 0,
        price_per_unit: product.pricePerUnit,
        base_cpu: product.baseCPU,
        production_cpu: product.productionCPU || undefined,
      }));

      // Calculate total units for this pallet
      const unitsInPallet = palletProducts.reduce((sum, p) => sum + p.quantity, 0);

      return {
        pallet_number: index + 1,
        units_per_pallet: unitsInPallet,
        products: palletProducts,
      };
    });

    console.log('Built pallet data:', palletData);

    // Build variant data from all pallets (aggregated)
    const variantData: Record<string, { price_per_unit: string; base_cpu: string; production_cpu?: string; quantity: number }> = {};

    pallets.forEach(pallet => {
      pallet.products.forEach(product => {
        const key = product.productName;
        const qty = parseInt(product.quantity) || 0;

        if (variantData[key]) {
          // Aggregate quantities if same product appears in multiple pallets
          variantData[key].quantity += qty;
        } else {
          variantData[key] = {
            price_per_unit: product.pricePerUnit,
            base_cpu: product.baseCPU,
            production_cpu: product.productionCPU || undefined,
            quantity: qty,
          };
        }
      });
    });

    // Build selected fees from checkboxes
    // IMPORTANT: Exclude zone fees from checkboxes - they come from the Zone Selection radio buttons
    const selectedFees = Object.entries(feeSelections)
      .filter(([_, selection]) => selection.selected)
      .map(([feeId, selection]) => {
        const fee = distributor.fee_structure.find(f => f.id === feeId);
        if (!fee) {
          console.warn(`Fee with ID ${feeId} not found in distributor fee structure`);
          return null;
        }

        // Skip zone fees - they're handled separately via selectedZone
        if (fee.unit === 'per_zone' || fee.description.toLowerCase().includes('zone')) {
          return null;
        }

        return {
          feeId,
          description: fee.description,
          amount: fee.amount,
          unit: fee.unit,
          quantity: selection.quantity,
          percentage_basis: fee.percentage_basis,
        };
      })
      .filter((fee): fee is NonNullable<typeof fee> => fee !== null);

    // Add selected zone fee from radio buttons (all pallets go to the selected zone)
    if (selectedZone) {
      const zoneFee = distributor.fee_structure.find(f => f.id === selectedZone);
      if (zoneFee) {
        selectedFees.push({
          feeId: zoneFee.id,
          description: zoneFee.description,
          amount: zoneFee.amount,
          unit: zoneFee.unit,
          quantity: numPallets, // Use total pallets since all go to selected zone
          percentage_basis: zoneFee.percentage_basis,
        });
      }
    }

    const params: DistributionCalcParams = {
      distributorId: distributor.id,
      numPallets,
      unitsPerPallet: defaultUnitsPerPallet,
      pallet_data: palletData, // Actual pallet structure
      variantData: Object.fromEntries(
        Object.entries(variantData).map(([key, val]) => [
          key,
          { price_per_unit: val.price_per_unit, base_cpu: val.base_cpu, production_cpu: val.production_cpu, quantity: val.quantity },
        ])
      ),
      selectedFees,
      msrpMarkupPercentage: null,
    };

    onCalculate(params);
  }

  // ===== RENDER =====
  const availableZones = getAvailableZones();

  return (
    <form onSubmit={handleCalculate} className={styles.formGrid}>
      {/* ===== SHIPMENT CONFIGURATION ===== */}
      <Card>
        <CardHeader>
          <h3 className={styles.sectionTitle}>Shipment Configuration</h3>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', whiteSpace: 'nowrap' }}>
                Number of Pallets <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                min="1"
                value={numPallets}
                onChange={(e) => setNumPallets(e.target.value)}
                required
                style={{
                  width: '150px',
                  padding: '0.625rem 0.875rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '6px',
                  backgroundColor: '#E5F6DF',
                  fontSize: '1rem',
                  color: '#1f2937',
                  transition: 'all 0.15s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#D4AF37';
                  e.target.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e0e0e0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', whiteSpace: 'nowrap' }}>
                Standard Units per Pallet <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                min="1"
                value={defaultUnitsPerPallet}
                onChange={(e) => setDefaultUnitsPerPallet(e.target.value)}
                required
                style={{
                  width: '150px',
                  padding: '0.625rem 0.875rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '6px',
                  backgroundColor: '#E5F6DF',
                  fontSize: '1rem',
                  color: '#1f2937',
                  transition: 'all 0.15s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#D4AF37';
                  e.target.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e0e0e0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>
          {errors.numPallets && <div className={styles.errorText}>{errors.numPallets}</div>}
          {errors.defaultUnitsPerPallet && <div className={styles.errorText}>{errors.defaultUnitsPerPallet}</div>}
        </CardBody>
      </Card>

      {/* ===== PALLET BUILDER ===== */}
      {pallets.map((pallet, index) => {
        const totalUnits = getTotalUnitsInPallet(pallet);
        const maxUnits = pallet.maxUnits || 100;  // Use pallet's own max capacity
        const isOverCapacity = totalUnits > maxUnits;

        return (
          <Card key={pallet.id}>
            <CardHeader>
              <div className={styles.sectionHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                  <h3 className={styles.sectionTitle}>
                    Pallet {index + 1}
                    <span className={`${styles.unitsIndicator} ${isOverCapacity ? styles.overCapacity : ''}`}>
                      {totalUnits} / {maxUnits} units
                    </span>
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label className={styles.variantLabel} style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: 0 }}>Max Units:</label>
                    <input
                      type="number"
                      min="1"
                      value={pallet.maxUnits}
                      onChange={(e) => {
                        const newMaxUnits = parseInt(e.target.value) || 100;
                        updatePallet(pallet.id, { maxUnits: newMaxUnits });
                      }}
                      className={styles.variantInput}
                      style={{ width: '100px', marginBottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => togglePalletExpanded(pallet.id)}
                >
                  {pallet.isExpanded ? '−' : '+'}
                </Button>
              </div>
            </CardHeader>

            {pallet.isExpanded && (
              <CardBody>

                {pallet.products.map((product, pIdx) => (
                  <div key={product.id} className={styles.variantRow}>
                    <div className={styles.variantNumber}>{pIdx + 1}</div>
                    <div className={styles.variantFields}>
                      <div className={styles.variantField}>
                        <label className={styles.variantLabel}>Product</label>
                        {availableProducts.length > 0 ? (
                          <Select
                            value={product.productName}
                            onChange={(e) => handleProductSelect(pallet.id, product.id, e.target.value)}
                            options={[
                              { value: '', label: 'Select a product...' },
                              ...availableProducts.map(p => ({
                                value: p.productName,
                                label: p.productName,
                              })),
                            ]}
                          />
                        ) : (
                          <input
                            type="text"
                            value={product.productName}
                            onChange={(e) => updateProduct(pallet.id, product.id, 'productName', e.target.value)}
                            placeholder="ex: 8oz Body Oil"
                            className={styles.variantInput}
                          />
                        )}
                      </div>

                      <div className={styles.variantField}>
                        <label className={styles.variantLabel}>Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={product.quantity}
                          onChange={(e) => updateProduct(pallet.id, product.id, 'quantity', e.target.value)}
                          placeholder="0"
                          className={styles.variantInput}
                        />
                      </div>

                      <div className={styles.variantField}>
                        <label className={styles.variantLabel}>Price/Unit</label>
                        <div className={styles.amountWrapper}>
                          <span className={styles.currencySymbol}>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={product.pricePerUnit}
                            onChange={(e) => updateProduct(pallet.id, product.id, 'pricePerUnit', e.target.value)}
                            placeholder="0.00"
                            className={styles.variantInputAmount}
                          />
                        </div>
                      </div>

                      <div className={styles.variantField}>
                        <label className={styles.variantLabel}>Base CPU</label>
                        <div className={styles.amountWrapper}>
                          <span className={styles.currencySymbol}>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={product.baseCPU}
                            onChange={(e) => updateProduct(pallet.id, product.id, 'baseCPU', e.target.value)}
                            placeholder="0.00"
                            className={styles.variantInputAmount}
                          />
                        </div>
                      </div>

                      <div className={styles.variantField}>
                        <label className={styles.variantLabel}>Production CPU</label>
                        <div className={styles.amountWrapper}>
                          <span className={styles.currencySymbol}>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={product.productionCPU}
                            onChange={(e) => updateProduct(pallet.id, product.id, 'productionCPU', e.target.value)}
                            placeholder="0.00"
                            className={styles.variantInputAmount}
                          />
                        </div>
                      </div>

                      {pallet.products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProductFromPallet(pallet.id, product.id)}
                          className={styles.removeVariantButton}
                          aria-label="Remove product"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addProductToPallet(pallet.id)}
                >
                  + Add Product to Pallet {index + 1}
                </Button>

                {isOverCapacity && (
                  <div className={styles.errorText}>
                    ⚠️ Total units ({totalUnits}) exceeds pallet capacity ({maxUnits})
                  </div>
                )}
              </CardBody>
            )}
          </Card>
        );
      })}

      {/* ===== FEE SELECTION ===== */}
      <Card>
        <CardHeader>
          <h3 className={styles.sectionTitle}>Fee Selection</h3>
          <p className={styles.sectionDescription}>
            Select applicable distributor fees
          </p>
        </CardHeader>
        <CardBody>
          <div className={styles.feeCheckboxes}>
            {distributor.fee_structure
              .filter(fee => fee.unit !== 'per_zone' && !fee.description.toLowerCase().includes('zone'))
              .map(fee => (
                <div key={fee.id} className={styles.feeCheckboxRow}>
                  <Checkbox
                    label={`${getFeeDisplayName(fee.description)} - ${fee.unit === 'percentage' ? '' : '$'}${fee.amount}${fee.unit === 'percentage' ? '%' : ` ${getUnitLabel(fee.unit)}`}`}
                    checked={feeSelections[fee.id]?.selected || false}
                    onChange={() => toggleFee(fee.id)}
                  />
                  {feeSelections[fee.id]?.selected && needsQuantityInput(fee.unit) && (
                    <Input
                      type="number"
                      min={fee.unit === 'percentage' ? '-100' : '1'}
                      max={fee.unit === 'percentage' ? '100' : undefined}
                      step={fee.unit === 'percentage' ? '1' : '1'}
                      value={feeSelections[fee.id]?.quantity || (fee.unit === 'percentage' ? '0' : '1')}
                      onChange={(e) => updateFeeQuantity(fee.id, e.target.value)}
                      placeholder={fee.unit === 'percentage' ? '%' : 'Days'}
                      className={styles.feeQuantityInput}
                    />
                  )}
                </div>
              ))}
          </div>
        </CardBody>
      </Card>

      {/* ===== ZONE SELECTION ===== */}
      {availableZones.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className={styles.sectionTitle}>Delivery Zone</h3>
            <p className={styles.sectionDescription}>
              Select the delivery zone for this shipment
            </p>
          </CardHeader>
          <CardBody>
            <div className={styles.radioGroup}>
              {availableZones.map(zone => (
                <label key={zone.id} className={styles.radioOption}>
                  <input
                    type="radio"
                    name="zone"
                    value={zone.id}
                    checked={selectedZone === zone.id}
                    onChange={(e) => setSelectedZone(e.target.value)}
                  />
                  <span>{zone.name} - ${zone.baseFee} {getUnitLabel(distributor.fee_structure.find(f => f.id === zone.id)?.unit || 'per_zone')}</span>
                </label>
              ))}
            </div>

            {errors.zone && <div className={styles.errorText}>{errors.zone}</div>}
          </CardBody>
        </Card>
      )}

      {/* ===== ACTIONS ===== */}
      <div className={styles.formActions}>
        <Button type="submit" variant="gold" loading={loading} disabled={loading}>
          Calculate Distribution Costs
        </Button>
      </div>

      {errors.pallets && (
        <div className={styles.errorAlert} role="alert">
          {errors.pallets}
        </div>
      )}
    </form>
  );
}
