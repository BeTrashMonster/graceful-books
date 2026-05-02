/**
 * Compare Scenarios Tab
 *
 * Side-by-side comparison of up to 3 Impact Share scenarios.
 *
 * Features:
 * - Select up to 3 scenarios from Active and Saved scenarios
 * - Comparison table showing all selected products
 * - Each scenario shows: Method, Base CPU, Impact Share, Total CPU, Margin
 * - Empty state when no scenarios available
 * - URL parameter support for pre-selecting scenario
 */

import { useState, useEffect, _useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loading } from '../../../../components/feedback/Loading';
import { ErrorMessage } from '../../../../components/feedback/ErrorMessage';
import { MarginQualityBadge } from '../../../../components/cpg/MarginQualityBadge';
import type { CPGImpactScenario } from '../../../../db/schema/cpg.schema';
import { impactShareService } from '../../../../services/cpg/impactShare.service';
import { _db } from '../../../../_db/database';
import { useAuth } from '../../../../contexts/AuthContext';
import styles from './CompareScenariosTab.module.css';

// ============================================================================
// Component
// ============================================================================

export function CompareScenariosTab() {
  const [searchParams] = useSearchParams();
  const { companyId } = useAuth();

  // ========================================
  // State - Data Loading
  // ========================================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableScenarios, setAvailableScenarios] = useState<CPGImpactScenario[]>([]);

  // ========================================
  // State - Scenario Selection
  // ========================================
  const [scenarioA, setScenarioA] = useState<string>('');
  const [scenarioB, setScenarioB] = useState<string>('');
  const [scenarioC, setScenarioC] = useState<string>('');

  // ========================================
  // State - Comparison Data
  // ========================================
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [comparing, setComparing] = useState(false);

  // ========================================
  // Data Loading
  // ========================================

  useEffect(() => {
    const loadScenarios = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load all Active and Saved scenarios (exclude Inactive)
        const scenarios = await impactShareService.getAllScenarios(companyId, false);

        setAvailableScenarios(scenarios);

        // Check for URL parameter to pre-select scenario
        const preselectedScenarioId = searchParams.get('scenario');
        if (preselectedScenarioId && scenarios.find((s) => s.id === preselectedScenarioId)) {
          setScenarioA(preselectedScenarioId);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading scenarios:', err);
        setError('Failed to load scenarios. Please refresh and try again.');
        setLoading(false);
      }
    };

    if (companyId) {
      loadScenarios();
    }
  }, [companyId, searchParams]);

  // ========================================
  // Compare Scenarios
  // ========================================

  useEffect(() => {
    const runComparison = async () => {
      const selectedIds = [scenarioA, scenarioB, scenarioC].filter((id) => id !== '');

      if (selectedIds.length === 0) {
        setComparisonData(null);
        return;
      }

      try {
        setComparing(true);
        setError(null);

        const comparison = await impactShareService.compareScenarios(selectedIds);

        setComparisonData(comparison);
        setComparing(false);
      } catch (err) {
        console.error('Error comparing scenarios:', err);
        setError('Failed to compare scenarios. Please try again.');
        setComparing(false);
      }
    };

    runComparison();
  }, [scenarioA, scenarioB, scenarioC]);

  // ========================================
  // Helper Functions
  // ========================================

  const _getScenarioName = (scenarioId: string) => {
    const scenario = availableScenarios.find((s) => s.id === scenarioId);
    return scenario ? scenario.scenario_name : 'Unknown';
  };

  const getScenarioStatus = (scenarioId: string) => {
    const scenario = availableScenarios.find((s) => s.id === scenarioId);
    return scenario ? scenario.status : 'saved';
  };

  // ========================================
  // Loading State
  // ========================================

  if (loading) {
    return <Loading message="Loading scenarios..." />;
  }

  // ========================================
  // Empty State
  // ========================================

  if (availableScenarios.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>📊</div>
        <h3 className={styles.emptyStateTitle}>No Scenarios to Compare</h3>
        <p className={styles.emptyStateMessage}>
          You haven't created any scenarios yet. Create and save scenarios in the Scenario Builder
          tab to compare them here.
        </p>
      </div>
    );
  }

  // ========================================
  // Render
  // ========================================

  return (
    <div className={styles.container}>
      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      <div className={styles.selectorCard}>
        <h2 className={styles.sectionTitle}>Select Scenarios to Compare</h2>
        <p className={styles.sectionDescription}>
          Choose up to 3 scenarios to see how they compare side-by-side.
        </p>

        <div className={styles.selectorGrid}>
          {/* Scenario A */}
          <div className={styles.selectorField}>
            <label htmlFor="scenarioA" className={styles.label}>
              Scenario A
            </label>
            <select
              id="scenarioA"
              value={scenarioA}
              onChange={(e) => setScenarioA(e.target.value)}
              className={styles.select}
            >
              <option value="">-- Select Scenario --</option>
              {availableScenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.scenario_name}{' '}
                  {scenario.status === 'active' ? '(Active)' : '(Saved)'}
                </option>
              ))}
            </select>
          </div>

          {/* Scenario B */}
          <div className={styles.selectorField}>
            <label htmlFor="scenarioB" className={styles.label}>
              Scenario B
            </label>
            <select
              id="scenarioB"
              value={scenarioB}
              onChange={(e) => setScenarioB(e.target.value)}
              className={styles.select}
            >
              <option value="">-- Select Scenario --</option>
              {availableScenarios
                .filter((s) => s.id !== scenarioA)
                .map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.scenario_name}{' '}
                    {scenario.status === 'active' ? '(Active)' : '(Saved)'}
                  </option>
                ))}
            </select>
          </div>

          {/* Scenario C */}
          <div className={styles.selectorField}>
            <label htmlFor="scenarioC" className={styles.label}>
              Scenario C
            </label>
            <select
              id="scenarioC"
              value={scenarioC}
              onChange={(e) => setScenarioC(e.target.value)}
              className={styles.select}
            >
              <option value="">-- Select Scenario --</option>
              {availableScenarios
                .filter((s) => s.id !== scenarioA && s.id !== scenarioB)
                .map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.scenario_name}{' '}
                    {scenario.status === 'active' ? '(Active)' : '(Saved)'}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Comparison Results */}
      {comparing && <Loading message="Comparing scenarios..." />}

      {!comparing && comparisonData && (
        <div className={styles.comparisonCard}>
          <h2 className={styles.sectionTitle}>Comparison Results</h2>

          {/* Scenario Headers */}
          <div className={styles.scenarioHeaders}>
            {comparisonData.scenarios.map((scenario: any) => (
              <div key={scenario.id} className={styles.scenarioHeader}>
                <h3 className={styles.scenarioName}>{scenario.name}</h3>
                <div className={styles.scenarioMethod}>{scenario.method}</div>
                <div className={styles.scenarioBadge}>
                  {getScenarioStatus(scenario.id) === 'active' ? (
                    <span className={styles.activeBadge}>Active</span>
                  ) : (
                    <span className={styles.savedBadge}>Saved</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          <div className={styles.tableWrapper}>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th className={styles.productColumn}>Product</th>
                  <th>Retail</th>
                  <th>Base CPU</th>
                  {comparisonData.scenarios.map((scenario: any) => (
                    <th key={scenario.id} className={styles.scenarioColumn}>
                      {scenario.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonData.products.map((product: any) => (
                  <tr key={product.productId}>
                    <td className={styles.productName}>{product.productName}</td>
                    <td className={styles.numericCell}>${product.retailPrice}</td>
                    <td className={styles.numericCell}>${product.baseCPU}</td>
                    {comparisonData.scenarios.map((scenario: any) => {
                      const scenarioData = product.scenarios[scenario.id];

                      if (!scenarioData) {
                        return (
                          <td key={scenario.id} className={styles.noDataCell}>
                            —
                          </td>
                        );
                      }

                      return (
                        <td key={scenario.id} className={styles.scenarioCell}>
                          <div className={styles.cellContent}>
                            <div className={styles.cellRow}>
                              <span className={styles.cellLabel}>Impact:</span>
                              <span className={styles.cellValue}>${scenarioData.impactAmount}</span>
                            </div>
                            <div className={styles.cellRow}>
                              <span className={styles.cellLabel}>Total CPU:</span>
                              <span className={styles.cellValue}>${scenarioData.totalCPU}</span>
                            </div>
                            <div className={styles.cellRow}>
                              <span className={styles.cellLabel}>Margin:</span>
                              <span className={styles.cellValue}>
                                ${scenarioData.margin} ({scenarioData.marginPercent}%)
                              </span>
                            </div>
                            <div className={styles.cellRow}>
                              <MarginQualityBadge
                                quality={
                                  parseFloat(scenarioData.marginPercent) >= 70
                                    ? 'best'
                                    : parseFloat(scenarioData.marginPercent) >= 50
                                    ? 'better'
                                    : parseFloat(scenarioData.marginPercent) >= 30
                                    ? 'good'
                                    : 'gutCheck'
                                }
                              />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!comparing && !comparisonData && scenarioA === '' && scenarioB === '' && scenarioC === '' && (
        <div className={styles.placeholderCard}>
          <p className={styles.placeholderText}>
            Select at least one scenario above to see the comparison.
          </p>
        </div>
      )}
    </div>
  );
}
