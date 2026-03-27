/**
 * Impact Share Page
 *
 * Main page for managing impact pricing scenarios for CPG businesses.
 * Helps entrepreneurs understand the financial impact of adding
 * social/environmental impact costs to their products.
 *
 * Features:
 * - Scenario Builder (Tab 1): Create and edit impact pricing scenarios
 * - Compare Scenarios (Tab 2): Side-by-side scenario comparison
 * - Manage Scenarios (Tab 3): Data table with all scenario management
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScenarioBuilderTab } from './tabs/impactShare/ScenarioBuilderTab';
import { CompareScenariosTab } from './tabs/impactShare/CompareScenariosTab';
import { ManageScenariosTab } from './tabs/impactShare/ManageScenariosTab';
import styles from './ImpactShare.module.css';

type ViewTab = 'builder' | 'compare' | 'manage';

export default function ImpactShare() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Check if we're editing an existing scenario
  const editScenarioId = searchParams.get('edit');

  // Tab State - default to builder, or check URL param
  const [activeTab, setActiveTab] = useState<ViewTab>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'compare' || tabParam === 'manage') {
      return tabParam as ViewTab;
    }
    return 'builder';
  });

  // Switch to builder tab when editing a scenario
  useEffect(() => {
    if (editScenarioId) {
      setActiveTab('builder');
    }
  }, [editScenarioId]);

  // Update URL when tab changes
  const handleTabChange = (tab: ViewTab) => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Impact Share</h1>
        <p className="page-description">
          Model impact pricing scenarios and see how social/environmental costs affect your margins.
        </p>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          onClick={() => handleTabChange('builder')}
          className={activeTab === 'builder' ? styles.tabActive : styles.tab}
          role="tab"
          aria-selected={activeTab === 'builder'}
        >
          Scenario Builder
        </button>
        <button
          onClick={() => handleTabChange('compare')}
          className={activeTab === 'compare' ? styles.tabActive : styles.tab}
          role="tab"
          aria-selected={activeTab === 'compare'}
        >
          Compare Scenarios
        </button>
        <button
          onClick={() => handleTabChange('manage')}
          className={activeTab === 'manage' ? styles.tabActive : styles.tab}
          role="tab"
          aria-selected={activeTab === 'manage'}
        >
          Manage Scenarios
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent} role="tabpanel">
        {activeTab === 'builder' && <ScenarioBuilderTab editScenarioId={editScenarioId} />}
        {activeTab === 'compare' && <CompareScenariosTab />}
        {activeTab === 'manage' && <ManageScenariosTab />}
      </div>
    </div>
  );
}
