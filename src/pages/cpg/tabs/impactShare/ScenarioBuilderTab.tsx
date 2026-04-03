/**
 * Scenario Builder Tab
 *
 * Create and edit Impact Share scenarios with real-time calculation preview.
 *
 * Features:
 * - Scenario name input
 * - Method selector (4 options: fixed_amount, percent_retail, percent_cpu, percent_profit)
 * - Amount/percentage input (conditional based on method)
 * - Product multi-selector with search
 * - Real-time calculation preview for each selected product
 * - Save Scenario, Activate, and Compare actions
 * - Edit mode support via URL parameter
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import { Button } from '../../../../components/core/Button';
import { ErrorMessage } from '../../../../components/feedback/ErrorMessage';
import { Loading } from '../../../../components/feedback/Loading';
import { MarginQualityBadge } from '../../../../components/cpg/MarginQualityBadge';
import type {
  CPGImpactScenario,
  CPGFinishedProduct,
  CPGSettings,
} from '../../../../db/schema/cpg.schema';
import { getProfitMarginQualityWithSettings } from '../../../../db/schema/cpg.schema';
import { impactShareService } from '../../../../services/cpg/impactShare.service';
import { cpuCalculatorService } from '../../../../services/cpg/cpuCalculator.service';
import { db } from '../../../../db/database';
import { useAuth } from '../../../../contexts/AuthContext';
import styles from './ScenarioBuilderTab.module.css';

// Configure Decimal.js for currency precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Types
// ============================================================================

interface ScenarioBuilderTabProps {
  editScenarioId?: string | null;
}

interface ProductCalculation {
  productId: string;
  productName: string;
  retailPrice: string;
  baseCPU: string;
  impactAmount: string;
  totalCPUWithImpact: string;
  margin: string;
  marginPercent: string;
  marginQuality: 'gutCheck' | 'good' | 'better' | 'best';
}

// ============================================================================
// Component
// ============================================================================

export function ScenarioBuilderTab({ editScenarioId }: ScenarioBuilderTabProps) {
  const navigate = useNavigate();
  const { companyId, deviceId } = useAuth();

  // ========================================
  // State - Data Loading
  // ========================================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<CPGFinishedProduct[]>([]);
  const [cpgSettings, setCpgSettings] = useState<CPGSettings | null>(null);
  const [editingScenario, setEditingScenario] = useState<CPGImpactScenario | null>(null);

  // ========================================
  // State - Form Fields
  // ========================================
  const [scenarioName, setScenarioName] = useState('');
  const [methodType, setMethodType] = useState<
    'fixed_amount' | 'percent_retail' | 'percent_cpu' | 'percent_profit'
  >('fixed_amount');
  const [amount, setAmount] = useState('0.00');
  const [percentage, setPercentage] = useState('0.00');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // ========================================
  // State - Calculations
  // ========================================
  const [calculations, setCalculations] = useState<ProductCalculation[]>([]);
  const [calculatingPreview, setCalculatingPreview] = useState(false);

  // ========================================
  // State - Actions
  // ========================================
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastSavedScenarioId, setLastSavedScenarioId] = useState<string | null>(null);

  // ========================================
  // Data Loading
  // ========================================

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load all finished products
        const products = await db.cpgFinishedProducts
          .where('company_id')
          .equals(companyId)
          .and((p) => !p.deleted_at)
          .sortBy('name');

        setAllProducts(products);

        // Load CPG settings for margin quality
        const settings = await db.cpgSettings.where('company_id').equals(companyId).first();
        setCpgSettings(settings || null);

        // If editing, load scenario
        if (editScenarioId) {
          const scenario = await db.cpgImpactScenarios.get(editScenarioId);
          if (scenario) {
            setEditingScenario(scenario);
            setScenarioName(scenario.scenario_name);
            setMethodType(scenario.method_type);
            setAmount(scenario.amount);
            setPercentage(scenario.percentage);
            setSelectedProductIds(scenario.selected_product_ids);
          } else {
            setError(`Scenario not found: ${editScenarioId}`);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data. Please refresh and try again.');
        setLoading(false);
      }
    };

    if (companyId) {
      loadData();
    }
  }, [companyId, editScenarioId]);

  // ========================================
  // Real-time Calculation Preview
  // ========================================

  useEffect(() => {
    const calculatePreviews = async () => {
      if (selectedProductIds.length === 0) {
        setCalculations([]);
        return;
      }

      setCalculatingPreview(true);

      try {
        const results: ProductCalculation[] = [];

        for (const productId of selectedProductIds) {
          const product = allProducts.find((p) => p.id === productId);
          if (!product) continue;

          const cpuBreakdown = await cpuCalculatorService.getFinishedProductCPUBreakdown(
            productId,
            companyId
          );
          const baseCPU = new Decimal(cpuBreakdown.cpu);
          const retailPrice = new Decimal(product.msrp || '0');

          let impactAmount: Decimal;

          switch (methodType) {
            case 'fixed_amount':
              impactAmount = new Decimal(amount || '0');
              break;

            case 'percent_retail':
              impactAmount = retailPrice.times(new Decimal(percentage || '0').div(100));
              break;

            case 'percent_cpu':
              impactAmount = baseCPU.times(new Decimal(percentage || '0').div(100));
              break;

            case 'percent_profit':
              const grossProfit = retailPrice.minus(baseCPU);
              impactAmount = grossProfit.times(new Decimal(percentage || '0').div(100));
              break;

            default:
              impactAmount = new Decimal(0);
          }

          const totalCPUWithImpact = baseCPU.plus(impactAmount);
          const margin = retailPrice.minus(totalCPUWithImpact);
          const marginPercent = retailPrice.isZero()
            ? new Decimal(0)
            : margin.div(retailPrice).times(100);

          const marginQuality = getProfitMarginQualityWithSettings(
            parseFloat(marginPercent.toFixed(2)),
            cpgSettings || undefined
          );

          results.push({
            productId,
            productName: product.name,
            retailPrice: retailPrice.toFixed(2),
            baseCPU: baseCPU.toFixed(2),
            impactAmount: impactAmount.toFixed(2),
            totalCPUWithImpact: totalCPUWithImpact.toFixed(2),
            margin: margin.toFixed(2),
            marginPercent: marginPercent.toFixed(2),
            marginQuality,
          });
        }

        setCalculations(results);
      } catch (err) {
        console.error('Error calculating previews:', err);
      } finally {
        setCalculatingPreview(false);
      }
    };

    // Debounce calculation to avoid too many updates
    const timeoutId = setTimeout(calculatePreviews, 300);
    return () => clearTimeout(timeoutId);
  }, [
    selectedProductIds,
    methodType,
    amount,
    percentage,
    allProducts,
    companyId,
    cpgSettings,
  ]);

  // ========================================
  // Product Selection Handlers
  // ========================================

  const handleProductToggle = useCallback((productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }, []);

  const handleSelectAllProducts = useCallback(() => {
    const allIds = allProducts.map((p) => p.id);
    setSelectedProductIds(allIds);
  }, [allProducts]);

  const handleDeselectAllProducts = useCallback(() => {
    setSelectedProductIds([]);
  }, []);

  // ========================================
  // Form Handlers
  // ========================================

  const handleMethodChange = (method: typeof methodType) => {
    setMethodType(method);
    // Reset values when switching methods
    if (method === 'fixed_amount') {
      setAmount('0.00');
    } else {
      setPercentage('0.00');
    }
  };

  const handleSave = async (activate: boolean = false) => {
    if (!scenarioName.trim()) {
      setError('Please enter a scenario name.');
      return;
    }

    if (selectedProductIds.length === 0) {
      setError('Please select at least one product.');
      return;
    }

    if (methodType === 'fixed_amount' && (!amount || parseFloat(amount) < 0)) {
      setError('Please enter a valid amount.');
      return;
    }

    if (methodType !== 'fixed_amount' && (!percentage || parseFloat(percentage) < 0)) {
      setError('Please enter a valid percentage.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingScenario) {
        // Update existing scenario
        await impactShareService.updateScenario(
          editingScenario.id,
          {
            scenario_name: scenarioName,
            method_type: methodType,
            amount,
            percentage,
            selected_product_ids: selectedProductIds,
          },
          deviceId
        );

        if (activate) {
          await impactShareService.activateScenario(editingScenario.id, deviceId);
        }

        setLastSavedScenarioId(editingScenario.id);
      } else {
        // Create new scenario
        const newScenario = await impactShareService.createScenario(
          {
            companyId,
            scenarioName,
            methodType,
            amount,
            percentage,
            selectedProductIds,
          },
          deviceId
        );

        if (activate) {
          await impactShareService.activateScenario(newScenario.id, deviceId);
        }

        setLastSavedScenarioId(newScenario.id);
      }

      setSaveSuccess(true);
      setSaving(false);

      // Clear success message after 5 seconds
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      console.error('Error saving scenario:', err);
      setError(`Failed to save scenario: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setSaving(false);
    }
  };

  const handleCompare = () => {
    if (lastSavedScenarioId) {
      navigate(`/cpg/impact-share?tab=compare&scenario=${lastSavedScenarioId}`);
    }
  };

  // ========================================
  // Filtered Products for Search
  // ========================================

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return allProducts;

    const search = productSearch.toLowerCase();
    return allProducts.filter((product) => product.name.toLowerCase().includes(search));
  }, [allProducts, productSearch]);

  // ========================================
  // Loading State
  // ========================================

  if (loading) {
    return <Loading message="Loading scenario builder..." />;
  }

  // ========================================
  // Render
  // ========================================

  return (
    <div className={styles.container}>
      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {saveSuccess && (
        <div className={styles.successMessage}>
          <div className={styles.successIcon}>✓</div>
          <div className={styles.successContent}>
            <p className={styles.successText}>
              Scenario {editingScenario ? 'updated' : 'created'} successfully!
            </p>
            <p className={styles.successLink}>
              <button onClick={handleCompare} className={styles.link}>
                Compare this scenario
              </button>{' '}
              or continue editing below.
            </p>
          </div>
        </div>
      )}

      <div className={styles.builderCard}>
        <h2 className={styles.sectionTitle}>
          {editingScenario ? 'Edit Scenario' : 'Create New Scenario'}
        </h2>

        {/* Scenario Name */}
        <div className={styles.formField}>
          <label htmlFor="scenarioName" className={styles.label}>
            Scenario Name <span className={styles.required}>*</span>
          </label>
          <input
            id="scenarioName"
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="e.g., Holiday Give-Back, Artisan Line Mission"
            className={styles.input}
          />
        </div>

        {/* Method Selector */}
        <div className={styles.formField}>
          <label className={styles.label}>
            Impact Method <span className={styles.required}>*</span>
          </label>
          <div className={styles.methodGrid}>
            <button
              type="button"
              onClick={() => handleMethodChange('fixed_amount')}
              className={
                methodType === 'fixed_amount' ? styles.methodButtonActive : styles.methodButton
              }
            >
              <div className={styles.methodTitle}>Fixed Amount</div>
              <div className={styles.methodDescription}>Add $ per unit</div>
            </button>

            <button
              type="button"
              onClick={() => handleMethodChange('percent_retail')}
              className={
                methodType === 'percent_retail' ? styles.methodButtonActive : styles.methodButton
              }
            >
              <div className={styles.methodTitle}>% of Retail</div>
              <div className={styles.methodDescription}>Add % of retail price</div>
            </button>

            <button
              type="button"
              onClick={() => handleMethodChange('percent_cpu')}
              className={
                methodType === 'percent_cpu' ? styles.methodButtonActive : styles.methodButton
              }
            >
              <div className={styles.methodTitle}>% of Base CPU</div>
              <div className={styles.methodDescription}>Add % of base cost</div>
            </button>

            <button
              type="button"
              onClick={() => handleMethodChange('percent_profit')}
              className={
                methodType === 'percent_profit' ? styles.methodButtonActive : styles.methodButton
              }
            >
              <div className={styles.methodTitle}>% of Gross Profit</div>
              <div className={styles.methodDescription}>Add % of (retail - base CPU)</div>
            </button>
          </div>
        </div>

        {/* Amount/Percentage Input */}
        <div className={styles.formField}>
          <label htmlFor="impactValue" className={styles.label}>
            {methodType === 'fixed_amount' ? 'Amount per Unit' : 'Percentage'}{' '}
            <span className={styles.required}>*</span>
          </label>
          {methodType === 'fixed_amount' ? (
            <div className={styles.inputGroup}>
              <span className={styles.inputPrefix}>$</span>
              <input
                id="impactValue"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={styles.inputWithPrefix}
              />
            </div>
          ) : (
            <div className={styles.inputGroup}>
              <input
                id="impactValue"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className={styles.inputWithSuffix}
              />
              <span className={styles.inputSuffix}>%</span>
            </div>
          )}
        </div>

        {/* Product Selection */}
        <div className={styles.formField}>
          <label className={styles.label}>
            Select Products <span className={styles.required}>*</span>
          </label>
          <div className={styles.productSelector}>
            <div className={styles.productActions}>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products..."
                className={styles.searchInput}
              />
              <div className={styles.selectActions}>
                <button type="button" onClick={handleSelectAllProducts} className={styles.selectButton}>
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllProducts}
                  className={styles.selectButton}
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className={styles.productList}>
              {filteredProducts.length === 0 ? (
                <p className={styles.emptyText}>
                  {productSearch ? 'No products found.' : 'No products available.'}
                </p>
              ) : (
                filteredProducts.map((product) => (
                  <label key={product.id} className={styles.productCheckbox}>
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(product.id)}
                      onChange={() => handleProductToggle(product.id)}
                    />
                    <span className={styles.productName}>{product.name}</span>
                    <span className={styles.productPrice}>
                      {product.msrp ? `$${parseFloat(product.msrp).toFixed(2)}` : 'No Selling Price'}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className={styles.selectionSummary}>
              {selectedProductIds.length} product{selectedProductIds.length !== 1 ? 's' : ''} selected
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <Button
            onClick={() => handleSave(false)}
            disabled={saving || !scenarioName.trim() || selectedProductIds.length === 0}
            variant="secondary"
            size="large"
          >
            {saving ? 'Saving...' : 'Save Scenario'}
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving || !scenarioName.trim() || selectedProductIds.length === 0}
            variant="primary"
            size="large"
          >
            {saving ? 'Activating...' : 'Save & Activate'}
          </Button>
          {lastSavedScenarioId && (
            <Button onClick={handleCompare} variant="outline" size="large">
              Compare
            </Button>
          )}
        </div>
      </div>

      {/* Calculation Preview */}
      {selectedProductIds.length > 0 && (
        <div className={styles.previewCard}>
          <h2 className={styles.sectionTitle}>Impact Preview</h2>

          {calculatingPreview ? (
            <Loading message="Calculating..." />
          ) : (
            <div className={styles.previewList}>
              {calculations.map((calc) => (
                <div key={calc.productId} className={styles.previewItem}>
                  <h3 className={styles.productTitle}>{calc.productName}</h3>
                  <div className={styles.calculationRow}>
                    <div className={styles.calcItem}>
                      <span className={styles.calcLabel}>Retail Price:</span>
                      <span className={styles.calcValue}>${calc.retailPrice}</span>
                    </div>
                    <div className={styles.calcItem}>
                      <span className={styles.calcLabel}>Base CPU:</span>
                      <span className={styles.calcValue}>${calc.baseCPU}</span>
                    </div>
                    <div className={styles.calcItem}>
                      <span className={styles.calcLabel}>Impact Share:</span>
                      <span className={styles.calcValue}>${calc.impactAmount}</span>
                    </div>
                    <div className={styles.calcItem}>
                      <span className={styles.calcLabel}>Total CPU:</span>
                      <span className={styles.calcValue}>${calc.totalCPUWithImpact}</span>
                    </div>
                  </div>
                  <div className={styles.marginRow}>
                    <div className={styles.marginCalc}>
                      ${calc.retailPrice} - ${calc.totalCPUWithImpact} = ${calc.margin} ({calc.marginPercent}%)
                    </div>
                    <MarginQualityBadge quality={calc.marginQuality} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
