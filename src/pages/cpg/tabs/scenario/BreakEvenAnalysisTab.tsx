/**
 * Break-Even Analysis Tab
 *
 * Calculate how many units need to be sold to cover fixed costs
 * for new or existing SKUs.
 */

import { useState } from 'react';
import { Button } from '../../../../components/core/Button';
import { ErrorMessage } from '../../../../components/feedback/ErrorMessage';
import type { CPGDistributor } from '../../../../db/schema/cpg.schema';
import { ScenarioPlanningService } from '../../../../services/cpg/scenarioPlanning.service';
import type { BreakEvenAnalysisResult } from '../../../../services/cpg/scenarioPlanning.service';
import styles from '../../ScenarioPlanning.module.css';

interface BreakEvenAnalysisTabProps {
  distributors: CPGDistributor[];
  companyId: string;
  service: ScenarioPlanningService;
}

export function BreakEvenAnalysisTab({ distributors, companyId, service }: BreakEvenAnalysisTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [breakEvenDistributorId, setBreakEvenDistributorId] = useState<string>('');
  const [breakEvenResult, setBreakEvenResult] = useState<BreakEvenAnalysisResult | null>(null);
  const [breakEvenParams, setBreakEvenParams] = useState({
    variantName: 'New SKU',
    fixedCosts: '10000.00',
    pricePerUnit: '10.00',
    baseCPU: '3.00',
  });

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

      setBreakEvenResult(result);
    } catch (err: any) {
      console.error('Error calculating break-even:', err);
      setError(err.message || 'Oops! Something went wrong. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className={styles.section}>
      <h2>Break-Even Analysis</h2>
      <p>Calculate how many units you need to sell to cover fixed costs.</p>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

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

      <div className={styles.buttonContainer}>
        <Button variant="gold" onClick={handleBreakEvenAnalysis} disabled={analyzing}>
          {analyzing ? 'Calculating...' : 'Calculate Break-Even'}
        </Button>
      </div>

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
  );
}
