/**
 * SKU Rationalization Tab
 *
 * Analyze which SKUs to keep, review, or discontinue based on
 * margin performance and strategic value.
 */

import { useState } from 'react';
import { Button } from '../../../../components/core/Button';
import { ErrorMessage } from '../../../../components/feedback/ErrorMessage';
import { MarginQualityBadge } from '../../../../components/cpg/MarginQualityBadge';
import type { CPGDistributor } from '../../../../db/schema/cpg.schema';
import { ScenarioPlanningService } from '../../../../services/cpg/scenarioPlanning.service';
import type { SKURationalizationReport } from '../../../../services/cpg/scenarioPlanning.service';
import styles from '../../ScenarioPlanning.module.css';

interface SKURationalizationTabProps {
  distributors: CPGDistributor[];
  companyId: string;
  service: ScenarioPlanningService;
}

export function SKURationalizationTab({ distributors, companyId, service }: SKURationalizationTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [rationalizeDistributorId, setRationalizeDistributorId] = useState<string>('');
  const [rationalizeResult, setRationalizeResult] = useState<SKURationalizationReport | null>(null);
  const [marginThreshold, setMarginThreshold] = useState('50');

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

  return (
    <div className={styles.section}>
      <h2>SKU Rationalization</h2>
      <p>Identify which SKUs to keep, review, or discontinue based on margin performance.</p>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

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

      <div className={styles.buttonContainer}>
        <Button variant="gold" onClick={handleRationalizationAnalysis} disabled={analyzing}>
          {analyzing ? 'Analyzing...' : 'Analyze SKUs'}
        </Button>
      </div>

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
  );
}
