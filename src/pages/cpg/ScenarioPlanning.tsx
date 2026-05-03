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
import { PinIcon } from '../../components/common/PinIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useTabPinning } from '../../hooks/useTabPinning';
import { PAGE_IDS } from '../../db/schema/tabPreferences.schema';
import { db } from '../../db/database';
import type { CPGDistributor } from '../../db/schema/cpg.schema';
import { ScenarioPlanningService } from '../../services/cpg/scenarioPlanning.service';
import { CompareDistributorsTab } from './tabs/scenario/CompareDistributorsTab';
import { WhatIfCalculatorTab } from './tabs/scenario/WhatIfCalculatorTab';
import styles from './ScenarioPlanning.module.css';

type AnalysisType = 'whatif' | 'compare';
type SchemaTabType = 'what-if' | 'compare';

// Helper to map internal tab values to schema tab values
const toSchemaTab = (tab: AnalysisType): SchemaTabType => {
  return tab === 'whatif' ? 'what-if' : 'compare';
};

// Helper to map schema tab values to internal tab values
const fromSchemaTab = (tab: SchemaTabType | string): AnalysisType => {
  return tab === 'what-if' ? 'whatif' : 'compare';
};

/**
 * Strategy Planning Component
 */
export default function ScenarioPlanning() {
  const { companyId, deviceId, userIdentifier } = useAuth();

  // Tab pinning
  const { defaultTab, pinTab, unpinTab, isTabPinned, isLoading: isPinningLoading } = useTabPinning({
    pageId: PAGE_IDS.STRATEGY_PLANNING,
  });

  const [analysisType, setAnalysisType] = useState<AnalysisType>('whatif');
  const [pinnedTabs, setPinnedTabs] = useState<Record<string, boolean>>({});
  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service] = useState(() => new ScenarioPlanningService(db));

  // Update active tab when pinned default loads
  useEffect(() => {
    if (!isPinningLoading && defaultTab) {
      setAnalysisType(fromSchemaTab(defaultTab));
    }
  }, [defaultTab, isPinningLoading]);

  // Load pinned tabs state
  useEffect(() => {
    const loadPinnedState = async () => {
      const states: Record<string, boolean> = {};
      const schemaTabs: SchemaTabType[] = ['what-if', 'compare'];

      for (const tab of schemaTabs) {
        states[tab] = await isTabPinned(tab);
      }

      setPinnedTabs(states);
    };

    loadPinnedState();
  }, [isTabPinned]);

  // Handle tab pin toggle
  const handlePinToggle = async (tabId: AnalysisType) => {
    const schemaTabId = toSchemaTab(tabId);
    const currentlyPinned = pinnedTabs[schemaTabId];

    try {
      if (currentlyPinned) {
        await unpinTab();
        setPinnedTabs((prev) => ({ ...prev, [schemaTabId]: false }));
      } else {
        await pinTab(schemaTabId);
        setPinnedTabs({
          'what-if': schemaTabId === 'what-if',
          'compare': schemaTabId === 'compare',
        });
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

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
          className={analysisType === 'whatif' ? styles.tabActive : styles.tab}
          onClick={() => setAnalysisType('whatif')}
        >
          What-If Calculator
          <PinIcon
            isPinned={pinnedTabs['what-if'] || false}
            onClick={() => handlePinToggle('whatif')}
            size={14}
          />
        </button>
        <button
          className={analysisType === 'compare' ? styles.tabActive : styles.tab}
          onClick={() => setAnalysisType('compare')}
        >
          Compare Distributors
          <PinIcon
            isPinned={pinnedTabs['compare'] || false}
            onClick={() => handlePinToggle('compare')}
            size={14}
          />
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
