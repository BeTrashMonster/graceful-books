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
 * @example
 * Route: /cpg/scenario-planning
 */

import { useState, useEffect } from 'react';
import { Button } from '../../components/core/Button';
import { Loading } from '../../components/feedback/Loading';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import type { CPGDistributor } from '../../db/schema/cpg.schema';
import { ScenarioPlanningService } from '../../services/cpg/scenarioPlanning.service';
import { CompareDistributorsTab } from './tabs/scenario/CompareDistributorsTab';
import { WhatIfCalculatorTab } from './tabs/scenario/WhatIfCalculatorTab';
import { BreakEvenAnalysisTab } from './tabs/scenario/BreakEvenAnalysisTab';
import { SKURationalizationTab } from './tabs/scenario/SKURationalizationTab';
import styles from './ScenarioPlanning.module.css';

type AnalysisType = 'compare' | 'whatif' | 'breakeven' | 'rationalize';

/**
 * ScenarioPlanning Component
 */
export default function ScenarioPlanning() {
  const { companyId, deviceId } = useAuth();
  const [analysisType, setAnalysisType] = useState<AnalysisType>('compare');
  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service] = useState(() => new ScenarioPlanningService(db));

  // Load distributors
  useEffect(() => {
    loadDistributors();
  }, [companyId]);

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

  if (loading) {
    return <Loading message="Loading distributors..." />;
  }

  if (distributors.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>No Distributors Found</h2>
          <p>You need to create at least one distributor before using scenario planning.</p>
          <Button variant="primary" onClick={() => (window.location.href = '/cpg/distribution-cost')}>
            Go to Distribution Center
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Scenario Planning</h1>
      </header>

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

      {/* Tab Content */}
      {analysisType === 'compare' && (
        <CompareDistributorsTab
          distributors={distributors}
          companyId={companyId}
          service={service}
        />
      )}

      {analysisType === 'whatif' && (
        <WhatIfCalculatorTab
          distributors={distributors}
          companyId={companyId}
          deviceId={deviceId}
        />
      )}

      {analysisType === 'breakeven' && (
        <BreakEvenAnalysisTab
          distributors={distributors}
          companyId={companyId}
          service={service}
        />
      )}

      {analysisType === 'rationalize' && (
        <SKURationalizationTab
          distributors={distributors}
          companyId={companyId}
          service={service}
        />
      )}
    </div>
  );
}
