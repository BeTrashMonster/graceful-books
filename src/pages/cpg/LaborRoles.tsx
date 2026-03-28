/**
 * Labor + Roles Page
 *
 * Manages labor roles and compensation for CPG cost tracking.
 *
 * Features:
 * - Labor Scenarios: Plan and model different labor configurations
 * - Labor Roles: Manage labor roles with compensation details
 *
 * Requirements:
 * - Labor + Roles Roadmap Phase 2
 */

import { useState } from 'react';
import { LaborScenariosTab } from './tabs/labor/LaborScenariosTab';
import { LaborRolesTab } from './tabs/labor/LaborRolesTab';
import styles from './LaborRoles.module.css';

type TabType = 'scenarios' | 'roles';

export default function LaborRoles() {
  const [activeTab, setActiveTab] = useState<TabType>('scenarios');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Labor + Roles</h1>
      </header>

      {/* Tab Selector */}
      <div className={styles.tabSelector}>
        <button
          className={activeTab === 'scenarios' ? styles.active : ''}
          onClick={() => setActiveTab('scenarios')}
        >
          Labor Scenarios
        </button>
        <button
          className={activeTab === 'roles' ? styles.active : ''}
          onClick={() => setActiveTab('roles')}
        >
          Labor Roles
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'scenarios' && <LaborScenariosTab />}
      {activeTab === 'roles' && <LaborRolesTab />}
    </div>
  );
}
