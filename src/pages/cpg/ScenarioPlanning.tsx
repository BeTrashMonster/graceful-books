/**
 * Strategy Planning Page
 *
 * Strategic planning tools for CPG businesses including:
 * - What-If Calculator: Test pricing, costs, and scenarios (existing products + new ideas)
 * - Compare Distributors: Side-by-side distributor comparison (2-4 distributors)
 *
 * Requirements: Group E1 - Strategy Planning
 *
 * @example
 * Route: /cpg/strategy-planning
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
import styles from './ScenarioPlanning.module.css';

type AnalysisType = 'whatif' | 'compare';

/**
 * Strategy Planning Component
 */
export default function ScenarioPlanning() {
  const { companyId, deviceId } = useAuth();
  const [analysisType, setAnalysisType] = useState<AnalysisType>('whatif');
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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Strategy Planning</h1>
      </header>

      {/* Analysis Type Selector */}
      <div className={styles.analysisTypeSelector}>
        <button
          className={analysisType === 'whatif' ? styles.active : ''}
          onClick={() => setAnalysisType('whatif')}
        >
          What-If Calculator
        </button>
        <button
          className={analysisType === 'compare' ? styles.active : ''}
          onClick={() => setAnalysisType('compare')}
        >
          Compare Distributors
        </button>
      </div>

      {/* Tab Content */}
      {analysisType === 'whatif' && (
        <WhatIfCalculatorTab
          distributors={distributors}
          companyId={companyId}
          deviceId={deviceId}
        />
      )}

      {analysisType === 'compare' && (
        <>
          {distributors.length < 2 ? (
            <div className={styles.emptyState}>
              <h2>Not Enough Distributors</h2>
              <p>You need at least 2 distributors to compare them side-by-side. Create distributors first, then come back to compare their costs and terms.</p>
              <Button variant="purple" onClick={() => (window.location.href = '/cpg/distribution-cost')}>
                Go to Distribution Center
              </Button>
            </div>
          ) : (
            <CompareDistributorsTab
              distributors={distributors}
              companyId={companyId}
              service={service}
            />
          )}
        </>
      )}
    </div>
  );
}
