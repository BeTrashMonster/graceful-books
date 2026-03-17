/**
 * Compare Distributors Tab
 *
 * Side-by-side comparison of 2-4 distributors to find the best option
 * based on costs, margins, and overall value.
 */

import { useState } from 'react';
import { Button } from '../../../../components/core/Button';
import { ErrorMessage } from '../../../../components/feedback/ErrorMessage';
import { MarginQualityBadge } from '../../../../components/cpg/MarginQualityBadge';
import type { CPGDistributor } from '../../../../db/schema/cpg.schema';
import { ScenarioPlanningService } from '../../../../services/cpg/scenarioPlanning.service';
import type { DistributorComparisonReport } from '../../../../services/cpg/scenarioPlanning.service';
import styles from '../../ScenarioPlanning.module.css';

interface CompareDistributorsTabProps {
  distributors: CPGDistributor[];
  companyId: string;
  service: ScenarioPlanningService;
}

export function CompareDistributorsTab({ distributors, companyId, service }: CompareDistributorsTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
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
        <Button variant="purple" onClick={addComparisonVariant}>
          Add Variant
        </Button>
      </div>

      <div className={styles.buttonContainer}>
        <Button variant="gold" onClick={handleCompareDistributors} disabled={analyzing}>
          {analyzing ? 'Comparing...' : 'Compare Distributors'}
        </Button>
      </div>

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
  );
}
