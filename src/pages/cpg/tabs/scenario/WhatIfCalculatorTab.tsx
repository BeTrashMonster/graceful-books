/**
 * What-If Calculator Tab
 *
 * Interactive pricing calculator showing instant margin impact
 * when prices change.
 */

import { useState } from 'react';
import { Button } from '../../../../components/core/Button';
import { ErrorMessage } from '../../../../components/feedback/ErrorMessage';
import { MarginQualityBadge } from '../../../../components/cpg/MarginQualityBadge';
import type { CPGDistributor } from '../../../../db/schema/cpg.schema';
import { ScenarioPlanningService } from '../../../../services/cpg/scenarioPlanning.service';
import type { WhatIfPricingResult } from '../../../../services/cpg/scenarioPlanning.service';
import styles from '../../ScenarioPlanning.module.css';

interface WhatIfCalculatorTabProps {
  distributors: CPGDistributor[];
  companyId: string;
  service: ScenarioPlanningService;
}

export function WhatIfCalculatorTab({ distributors, companyId, service }: WhatIfCalculatorTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [whatIfDistributorId, setWhatIfDistributorId] = useState<string>('');
  const [whatIfResult, setWhatIfResult] = useState<WhatIfPricingResult | null>(null);
  const [whatIfPricing, setWhatIfPricing] = useState<Record<string, { current: string; new: string }>>({});

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
        appliedFees: {
          pallet_cost: true,
          warehouse_services: true,
          pallet_build: true,
          floor_space: 'full_day' as const,
          floor_space_days: '1',
          truck_transfer_zone: 'zone1' as const,
          custom_fees: undefined,
        },
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

  return (
    <div className={styles.section}>
      <h2>What-If Pricing Calculator</h2>
      <p>See how pricing changes affect your margins instantly.</p>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

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
  );
}
