/**
 * Scenario Planning Page
 *
 * Advanced analytics for CPG businesses including:
 * - Side-by-side distributor comparison (2-4 distributors)
 * - Interactive what-if pricing calculator with sliders
 * - Break-even analysis for new SKUs
 * - SKU rationalization recommendations
 *
 * Requirements: Group E1 - Scenario Planning
 *
 * Features:
 * - Compare multiple distributors simultaneously
 * - Adjust pricing and see instant margin impact
 * - Calculate break-even units for new products
 * - Recommend which SKUs to discontinue based on margins
 *
 * User Flow:
 * 1. Select analysis type (Compare, What-If, Break-Even, Rationalization)
 * 2. Configure parameters for analysis
 * 3. View results with visualizations
 * 4. Take action based on recommendations
 *
 * @example
 * Route: /cpg/scenario-planning
 */

import { useState, useEffect } from 'react';
import { Button } from '../../components/core/Button';
import { Loading } from '../../components/feedback/Loading';
import { ErrorMessage } from '../../components/feedback/ErrorMessage';
import { MarginQualityBadge } from '../../components/cpg/MarginQualityBadge';
import { db } from '../../db/database';
import type { CPGDistributor } from '../../db/schema/cpg.schema';
import { ScenarioPlanningService } from '../../services/cpg/scenarioPlanning.service';
import type {
  DistributorComparisonReport,
  WhatIfPricingResult,
  BreakEvenAnalysisResult,
  SKURationalizationReport,
} from '../../services/cpg/scenarioPlanning.service';
import styles from './ScenarioPlanning.module.css';

type AnalysisType = 'compare' | 'whatif' | 'breakeven' | 'rationalize';

/**
 * ScenarioPlanning Component
 */
export default function ScenarioPlanning() {
  // State
  const [analysisType, setAnalysisType] = useState<AnalysisType>('compare');
  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Comparison state
  const [selectedDistributorIds, setSelectedDistributorIds] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<DistributorComparisonReport | null>(null);
  const [comparisonParams, setComparisonParams] = useState({
    numPallets: '1.00',
    unitsPerPallet: '100',
    variants: [{ name: '8oz', price: '10.00', baseCPU: '3.00' }],
    appliedFees: {
      pallet_cost: true,
      warehouse_services: true,
      pallet_build: true,
      floor_space: 'full_day' as const,
      floor_space_days: '1',
      truck_transfer_zone: 'zone1' as const,
      custom_fees: undefined,
    },
  });

  // What-if state
  const [whatIfDistributorId, setWhatIfDistributorId] = useState<string>('');
  const [whatIfResult, setWhatIfResult] = useState<WhatIfPricingResult | null>(null);
  const [whatIfPricing, setWhatIfPricing] = useState<Record<string, { current: string; new: string }>>({});

  // Break-even state
  const [breakEvenDistributorId, setBreakEvenDistributorId] = useState<string>('');
  const [breakEvenResult, setBreakEvenResult] = useState<BreakEvenAnalysisResult | null>(null);
  const [breakEvenParams, setBreakEvenParams] = useState({
    variantName: 'New SKU',
    fixedCosts: '10000.00',
    pricePerUnit: '10.00',
    baseCPU: '3.00',
  });

  // Rationalization state
  const [rationalizeDistributorId, setRationalizeDistributorId] = useState<string>('');
  const [rationalizeResult, setRationalizeResult] = useState<SKURationalizationReport | null>(null);
  const [marginThreshold, setMarginThreshold] = useState('50');

  // Service
  const [service] = useState(() => new ScenarioPlanningService(db));

  // Constants
  const companyId = 'company-1'; // TODO: Get from auth context

  // Load distributors
  useEffect(() => {
    loadDistributors();
  }, []);

  const loadDistributors = async () => {
    try {
      setLoading(true);
      setError(null);

      const allDistributors = await db.cpgDistributors
        .where('company_id')
        .equals(companyId)
        .and((d) => d.active && d.deleted_at === null)
        .toArray();

      setDistributors(allDistributors);
    } catch (err) {
      console.error('Error loading distributors:', err);
      setError('Oops! We had trouble loading your distributors. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompareDistributors = async () => {
    if (selectedDistributorIds.length < 2) {
      setError('Please select at least 2 distributors to compare.');
      return;
    }

    try {
      setAnalyzing(true);
      setError(null);

      const variantData: Record<string, { price_per_unit: string; base_cpu: string }> = {};
      comparisonParams.variants.forEach((v) => {
        variantData[v.name] = {
          price_per_unit: v.price,
          base_cpu: v.baseCPU,
        };
      });

      const result = await service.compareDistributors({
        companyId,
        distributorIds: selectedDistributorIds,
        numPallets: comparisonParams.numPallets,
        unitsPerPallet: comparisonParams.unitsPerPallet,
        variantData,
        appliedFees: comparisonParams.appliedFees,
      });

      setComparisonResult(result);
    } catch (err: any) {
      console.error('Error comparing distributors:', err);
      setError(err.message || 'Oops! Something went wrong. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleWhatIfAnalysis = async () => {
    if (!whatIfDistributorId) {
      setError('Please select a distributor.');
      return;
    }

    try {
      setAnalyzing(true);
      setError(null);

      const currentPricing: Record<string, { price_per_unit: string; base_cpu: string }> = {};
      const newPricing: Record<string, string> = {};

      Object.entries(whatIfPricing).forEach(([variant, prices]) => {
        currentPricing[variant] = {
          price_per_unit: prices.current,
          base_cpu: '3.00', // TODO: Get from actual data
        };
        newPricing[variant] = prices.new;
      });

      const result = await service.calculateWhatIfPricing({
        companyId,
        distributorId: whatIfDistributorId,
        numPallets: '1.00',
        unitsPerPallet: '100',
        appliedFees: comparisonParams.appliedFees,
        currentPricing,
        newPricing,
      });

      setWhatIfResult(result);
    } catch (err: any) {
      console.error('Error calculating what-if:', err);
      setError(err.message || 'Oops! Something went wrong. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleBreakEvenAnalysis = async () => {
    if (!breakEvenDistributorId) {
      setError('Please select a distributor.');
      return;
    }

    try {
      setAnalyzing(true);
      setError(null);

      const result = await service.calculateBreakEven({
        companyId,
        distributorId: breakEvenDistributorId,
        variantName: breakEvenParams.variantName,
        fixedCosts: breakEvenParams.fixedCosts,
        pricePerUnit: breakEvenParams.pricePerUnit,
        baseCPU: breakEvenParams.baseCPU,
        numPallets: '1.00',
        unitsPerPallet: '100',
        appliedFees: comparisonParams.appliedFees,
      });

      setBreakEvenResult(result);
    } catch (err: any) {
      console.error('Error calculating break-even:', err);
      setError(err.message || 'Oops! Something went wrong. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRationalizationAnalysis = async () => {
    if (!rationalizeDistributorId) {
      setError('Please select a distributor.');
      return;
    }

    try {
      setAnalyzing(true);
      setError(null);

      const result = await service.analyzeSKURationalization({
        companyId,
        distributorId: rationalizeDistributorId,
        marginThreshold,
      });

      setRationalizeResult(result);
    } catch (err: any) {
      console.error('Error analyzing SKU rationalization:', err);
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
        { name: '', price: '0.00', baseCPU: '0.00' },
      ],
    });
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
    } else {
      if (selectedDistributorIds.length < 4) {
        setSelectedDistributorIds([...selectedDistributorIds, id]);
      } else {
        setError('Maximum 4 distributors can be compared at once.');
      }
    }
  };

  if (loading) {
    return <Loading message="Loading distributors..." />;
  }

  if (distributors.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>No Distributors Found</h2>
          <p>You need to create at least one distributor before using scenario planning.</p>
          <Button variant="primary" onClick={() => (window.location.href = '/cpg/distribution-cost-analyzer')}>
            Go to Distribution Cost Analyzer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Scenario Planning</h1>
        <p>Compare distributors, analyze pricing changes, and optimize your product lineup.</p>
      </header>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Analysis Type Selector */}
      <div className={styles.analysisTypeSelector}>
        <button
          className={analysisType === 'compare' ? styles.active : ''}
          onClick={() => setAnalysisType('compare')}
        >
          Compare Distributors
        </button>
        <button
          className={analysisType === 'whatif' ? styles.active : ''}
          onClick={() => setAnalysisType('whatif')}
        >
          What-If Calculator
        </button>
        <button
          className={analysisType === 'breakeven' ? styles.active : ''}
          onClick={() => setAnalysisType('breakeven')}
        >
          Break-Even Analysis
        </button>
        <button
          className={analysisType === 'rationalize' ? styles.active : ''}
          onClick={() => setAnalysisType('rationalize')}
        >
          SKU Rationalization
        </button>
      </div>

      {/* Compare Distributors */}
      {analysisType === 'compare' && (
        <div className={styles.section}>
          <h2>Compare Distributors Side-by-Side</h2>
          <p>Select 2-4 distributors to compare costs and margins.</p>

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

          {/* Variant Configuration */}
          <div className={styles.variantConfig}>
            <h3>Product Variants</h3>
            {comparisonParams.variants.map((variant, index) => (
              <div key={index} className={styles.variantRow}>
                <input
                  type="text"
                  placeholder="Variant name (e.g., 8oz)"
                  value={variant.name}
                  onChange={(e) => updateComparisonVariant(index, 'name', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Price per unit"
                  value={variant.price}
                  onChange={(e) => updateComparisonVariant(index, 'price', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Base CPU"
                  value={variant.baseCPU}
                  onChange={(e) => updateComparisonVariant(index, 'baseCPU', e.target.value)}
                />
                {comparisonParams.variants.length > 1 && (
                  <button onClick={() => removeComparisonVariant(index)}>Remove</button>
                )}
              </div>
            ))}
            <Button variant="secondary" onClick={addComparisonVariant}>
              Add Variant
            </Button>
          </div>

          <Button variant="primary" onClick={handleCompareDistributors} disabled={analyzing}>
            {analyzing ? 'Comparing...' : 'Compare Distributors'}
          </Button>

          {/* Comparison Results */}
          {comparisonResult && (
            <div className={styles.comparisonResults}>
              <h3>Comparison Results</h3>
              <div className={styles.bestDistributor}>
                <strong>Recommended:</strong> {comparisonResult.bestDistributor.distributorName}
                <p>{comparisonResult.bestDistributor.reason}</p>
              </div>

              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th>Distributor</th>
                    <th>Total Cost</th>
                    <th>Cost Per Unit</th>
                    <th>Avg Margin</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonResult.distributors.map((dist) => (
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
                      <td>{dist.recommendationScore.toFixed(0)}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Per-variant breakdown */}
              <div className={styles.variantBreakdown}>
                <h4>Margin by Variant</h4>
                {comparisonResult.variantNames.map((variantName) => (
                  <div key={variantName} className={styles.variantSection}>
                    <h5>{variantName}</h5>
                    <table className={styles.variantTable}>
                      <thead>
                        <tr>
                          <th>Distributor</th>
                          <th>Total CPU</th>
                          <th>Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonResult.distributors.map((dist) => {
                          const variantResult = dist.variantResults[variantName];
                          return variantResult ? (
                            <tr key={dist.distributorId}>
                              <td>{dist.distributorName}</td>
                              <td>${variantResult.total_cpu}</td>
                              <td>
                                <MarginQualityBadge
                                  quality={variantResult.margin_quality}
                                  marginPercentage={variantResult.net_profit_margin}
                                />
                              </td>
                            </tr>
                          ) : null;
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* What-If Calculator */}
      {analysisType === 'whatif' && (
        <div className={styles.section}>
          <h2>What-If Pricing Calculator</h2>
          <p>See how pricing changes affect your margins instantly.</p>

          <div className={styles.formGroup}>
            <label>Select Distributor:</label>
            <select
              value={whatIfDistributorId}
              onChange={(e) => setWhatIfDistributorId(e.target.value)}
            >
              <option value="">-- Select --</option>
              {distributors.map((dist) => (
                <option key={dist.id} value={dist.id}>
                  {dist.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.whatIfConfig}>
            <h3>Price Scenarios</h3>
            <p className={styles.helpText}>Adjust pricing to see margin impact</p>
            {Object.keys(whatIfPricing).length === 0 ? (
              <div className={styles.emptyState}>
                <p>Add variants to analyze pricing scenarios.</p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setWhatIfPricing({ '8oz': { current: '10.00', new: '10.00' } })
                  }
                >
                  Add Variant
                </Button>
              </div>
            ) : (
              Object.entries(whatIfPricing).map(([variant, prices]) => (
                <div key={variant} className={styles.whatIfRow}>
                  <span className={styles.variantLabel}>{variant}</span>
                  <div className={styles.priceInputs}>
                    <div>
                      <label>Current Price:</label>
                      <input
                        type="text"
                        value={prices.current}
                        onChange={(e) =>
                          setWhatIfPricing({
                            ...whatIfPricing,
                            [variant]: { ...prices, current: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label>New Price:</label>
                      <input
                        type="text"
                        value={prices.new}
                        onChange={(e) =>
                          setWhatIfPricing({
                            ...whatIfPricing,
                            [variant]: { ...prices, new: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <Button variant="primary" onClick={handleWhatIfAnalysis} disabled={analyzing}>
            {analyzing ? 'Analyzing...' : 'Calculate Impact'}
          </Button>

          {/* What-If Results */}
          {whatIfResult && (
            <div className={styles.whatIfResults}>
              <h3>Impact Analysis</h3>
              <div className={styles.overallImpact}>
                <div className={styles.impactCard}>
                  <span className={styles.label}>Average Margin Before:</span>
                  <span className={styles.value}>
                    {whatIfResult.overallImpact.averageMarginBefore}%
                  </span>
                </div>
                <div className={styles.impactCard}>
                  <span className={styles.label}>Average Margin After:</span>
                  <span className={styles.value}>
                    {whatIfResult.overallImpact.averageMarginAfter}%
                  </span>
                </div>
                <div className={styles.impactCard}>
                  <span className={styles.label}>Margin Impact:</span>
                  <span
                    className={
                      parseFloat(whatIfResult.overallImpact.totalMarginImpact) > 0
                        ? styles.positive
                        : styles.negative
                    }
                  >
                    {parseFloat(whatIfResult.overallImpact.totalMarginImpact) > 0 ? '+' : ''}
                    {whatIfResult.overallImpact.totalMarginImpact}%
                  </span>
                </div>
              </div>

              <table className={styles.whatIfTable}>
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>Price Change</th>
                    <th>Current Margin</th>
                    <th>New Margin</th>
                    <th>Impact</th>
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(whatIfResult.variantComparisons).map(([variant, comparison]) => (
                    <tr key={variant}>
                      <td>{variant}</td>
                      <td>
                        ${comparison.currentPrice} → ${comparison.newPrice} ({comparison.priceChange}
                        %)
                      </td>
                      <td>
                        <MarginQualityBadge
                          quality={comparison.marginQualityBefore}
                          marginPercentage={comparison.currentMargin}
                        />
                      </td>
                      <td>
                        <MarginQualityBadge
                          quality={comparison.marginQualityAfter}
                          marginPercentage={comparison.newMargin}
                        />
                      </td>
                      <td
                        className={
                          parseFloat(comparison.marginImpact) > 0
                            ? styles.positive
                            : styles.negative
                        }
                      >
                        {parseFloat(comparison.marginImpact) > 0 ? '+' : ''}
                        {comparison.marginImpact}%
                      </td>
                      <td className={styles.recommendation}>{comparison.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Break-Even Analysis */}
      {analysisType === 'breakeven' && (
        <div className={styles.section}>
          <h2>Break-Even Analysis</h2>
          <p>Calculate how many units you need to sell to cover fixed costs.</p>

          <div className={styles.formGroup}>
            <label>Select Distributor:</label>
            <select
              value={breakEvenDistributorId}
              onChange={(e) => setBreakEvenDistributorId(e.target.value)}
            >
              <option value="">-- Select --</option>
              {distributors.map((dist) => (
                <option key={dist.id} value={dist.id}>
                  {dist.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.breakEvenForm}>
            <div className={styles.formGroup}>
              <label>SKU Name:</label>
              <input
                type="text"
                value={breakEvenParams.variantName}
                onChange={(e) =>
                  setBreakEvenParams({ ...breakEvenParams, variantName: e.target.value })
                }
              />
            </div>
            <div className={styles.formGroup}>
              <label>Fixed Costs (setup, equipment, etc.):</label>
              <input
                type="text"
                value={breakEvenParams.fixedCosts}
                onChange={(e) =>
                  setBreakEvenParams({ ...breakEvenParams, fixedCosts: e.target.value })
                }
              />
            </div>
            <div className={styles.formGroup}>
              <label>Planned Price Per Unit:</label>
              <input
                type="text"
                value={breakEvenParams.pricePerUnit}
                onChange={(e) =>
                  setBreakEvenParams({ ...breakEvenParams, pricePerUnit: e.target.value })
                }
              />
            </div>
            <div className={styles.formGroup}>
              <label>Base CPU (from invoice calculations):</label>
              <input
                type="text"
                value={breakEvenParams.baseCPU}
                onChange={(e) =>
                  setBreakEvenParams({ ...breakEvenParams, baseCPU: e.target.value })
                }
              />
            </div>
          </div>

          <Button variant="primary" onClick={handleBreakEvenAnalysis} disabled={analyzing}>
            {analyzing ? 'Calculating...' : 'Calculate Break-Even'}
          </Button>

          {/* Break-Even Results */}
          {breakEvenResult && (
            <div className={styles.breakEvenResults}>
              <h3>Break-Even Analysis for {breakEvenResult.variantName}</h3>

              <div className={styles.breakEvenSummary}>
                <div className={styles.summaryCard}>
                  <span className={styles.label}>Break-Even Units:</span>
                  <span className={styles.bigValue}>{breakEvenResult.breakEvenUnits}</span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.label}>Break-Even Revenue:</span>
                  <span className={styles.bigValue}>${breakEvenResult.breakEvenRevenue}</span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.label}>Break-Even Pallets:</span>
                  <span className={styles.bigValue}>{breakEvenResult.breakEvenPallets}</span>
                </div>
              </div>

              <div className={styles.breakEvenDetails}>
                <table className={styles.detailsTable}>
                  <tbody>
                    <tr>
                      <td>Fixed Costs:</td>
                      <td>${breakEvenResult.fixedCosts}</td>
                    </tr>
                    <tr>
                      <td>Price Per Unit:</td>
                      <td>${breakEvenResult.pricePerUnit}</td>
                    </tr>
                    <tr>
                      <td>Variable Cost Per Unit:</td>
                      <td>${breakEvenResult.variableCostPerUnit}</td>
                    </tr>
                    <tr>
                      <td>Contribution Margin:</td>
                      <td>
                        ${breakEvenResult.contributionMargin} (
                        {breakEvenResult.contributionMarginPercentage}%)
                      </td>
                    </tr>
                    <tr>
                      <td>Margin at Break-Even:</td>
                      <td>{breakEvenResult.marginAtBreakEven}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className={styles.recommendation}>
                <h4>Recommendation</h4>
                <p>{breakEvenResult.recommendation}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SKU Rationalization */}
      {analysisType === 'rationalize' && (
        <div className={styles.section}>
          <h2>SKU Rationalization</h2>
          <p>Identify which SKUs to keep, review, or discontinue based on margin performance.</p>

          <div className={styles.formGroup}>
            <label>Select Distributor:</label>
            <select
              value={rationalizeDistributorId}
              onChange={(e) => setRationalizeDistributorId(e.target.value)}
            >
              <option value="">-- Select --</option>
              {distributors.map((dist) => (
                <option key={dist.id} value={dist.id}>
                  {dist.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Minimum Acceptable Margin (%):</label>
            <input
              type="text"
              value={marginThreshold}
              onChange={(e) => setMarginThreshold(e.target.value)}
            />
            <span className={styles.helpText}>
              SKUs below 40% will be recommended for discontinuation
            </span>
          </div>

          <Button variant="primary" onClick={handleRationalizationAnalysis} disabled={analyzing}>
            {analyzing ? 'Analyzing...' : 'Analyze SKUs'}
          </Button>

          {/* Rationalization Results */}
          {rationalizeResult && (
            <div className={styles.rationalizeResults}>
              <h3>SKU Rationalization Report</h3>

              <div className={styles.rationalizeSummary}>
                <div className={styles.summaryCard}>
                  <span className={styles.label}>Total SKUs:</span>
                  <span className={styles.value}>{rationalizeResult.totalSKUs}</span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.label}>Keep:</span>
                  <span className={styles.valueGreen}>{rationalizeResult.summary.keepCount}</span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.label}>Review:</span>
                  <span className={styles.valueYellow}>
                    {rationalizeResult.summary.reviewCount}
                  </span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.label}>Discontinue:</span>
                  <span className={styles.valueRed}>
                    {rationalizeResult.summary.discontinueCount}
                  </span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.label}>Potential Savings:</span>
                  <span className={styles.value}>${rationalizeResult.summary.potentialSavings}</span>
                </div>
              </div>

              <div className={styles.recommendationsList}>
                {rationalizeResult.recommendations.map((rec) => (
                  <div
                    key={rec.variantName}
                    className={`${styles.recommendationCard} ${styles[rec.recommendation]}`}
                  >
                    <div className={styles.recHeader}>
                      <h4>{rec.variantName}</h4>
                      <MarginQualityBadge
                        quality={rec.marginQuality}
                        marginPercentage={rec.currentMargin}
                      />
                      <span className={`${styles.recBadge} ${styles[rec.recommendation]}`}>
                        {rec.recommendation.toUpperCase()}
                      </span>
                    </div>
                    <p className={styles.reason}>{rec.reason}</p>
                    <div className={styles.actionSteps}>
                      <strong>Action Steps:</strong>
                      <ul>
                        {rec.actionSteps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
