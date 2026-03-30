/**
 * Labor + Roles Page
 *
 * Manages labor roles and compensation for CPG cost tracking.
 *
 * Features:
 * - Labor Scenarios: Plan and model different labor configurations
 * - Labor Roles: Manage labor roles with compensation details
 * - Reports: Analyze labor costs across products and roles
 *
 * Requirements:
 * - Labor + Roles Roadmap Phase 2 & Phase 4
 */

import { useState, useEffect } from 'react';
import { LaborScenariosTab } from './tabs/labor/LaborScenariosTab';
import { LaborRolesTab } from './tabs/labor/LaborRolesTab';
import { LaborReportsTab } from './tabs/labor/LaborReportsTab';
import { PinIcon } from '../../components/common/PinIcon';
import { useTabPinning } from '../../hooks/useTabPinning';
import { useAuth } from '../../contexts/AuthContext';
import { PAGE_IDS } from '../../db/schema/tabPreferences.schema';
import styles from './LaborRoles.module.css';

type TabType = 'scenarios' | 'roles' | 'reports';

export default function LaborRoles() {
  // Tab pinning
  const { defaultTab, pinTab, unpinTab, isTabPinned, isLoading: isPinningLoading } = useTabPinning({
    pageId: PAGE_IDS.LABOR_ROLES,
  });

  const [activeTab, setActiveTab] = useState<TabType>('scenarios');
  const [pinnedTabs, setPinnedTabs] = useState<Record<string, boolean>>({});

  // Update active tab when pinned default loads
  useEffect(() => {
    if (!isPinningLoading && defaultTab) {
      setActiveTab(defaultTab as TabType);
    }
  }, [defaultTab, isPinningLoading]);

  // Load pinned tabs state
  useEffect(() => {
    const loadPinnedState = async () => {
      const states: Record<string, boolean> = {};
      const tabs: TabType[] = ['scenarios', 'roles', 'reports'];

      for (const tab of tabs) {
        states[tab] = await isTabPinned(tab);
      }

      setPinnedTabs(states);
    };

    loadPinnedState();
  }, [isTabPinned]);

  // Handle tab pin toggle
  const handlePinToggle = async (tabId: TabType) => {
    const currentlyPinned = pinnedTabs[tabId];

    try {
      if (currentlyPinned) {
        await unpinTab();
        setPinnedTabs((prev) => ({ ...prev, [tabId]: false }));
      } else {
        await pinTab(tabId);
        setPinnedTabs({
          scenarios: tabId === 'scenarios',
          roles: tabId === 'roles',
          reports: tabId === 'reports',
        });
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Labor + Roles</h1>
      </header>

      {/* Tab Selector */}
      <div className={styles.tabSelector}>
        <button
          className={activeTab === 'scenarios' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('scenarios')}
        >
          Labor Scenarios
          <PinIcon
            isPinned={pinnedTabs['scenarios'] || false}
            onClick={() => handlePinToggle('scenarios')}
            size={14}
          />
        </button>
        <button
          className={activeTab === 'roles' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('roles')}
        >
          Labor Roles
          <PinIcon
            isPinned={pinnedTabs['roles'] || false}
            onClick={() => handlePinToggle('roles')}
            size={14}
          />
        </button>
        <button
          className={activeTab === 'reports' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('reports')}
        >
          Reports
          <PinIcon
            isPinned={pinnedTabs['reports'] || false}
            onClick={() => handlePinToggle('reports')}
            size={14}
          />
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'scenarios' && <LaborScenariosTab />}
      {activeTab === 'roles' && <LaborRolesTab />}
      {activeTab === 'reports' && <LaborReportsTab />}
    </div>
  );
}
