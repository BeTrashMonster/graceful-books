/**
 * Events Analysis Page
 *
 * Main page for analyzing farmers markets and events.
 * Features two tabs: Decision Tool (planning) and Event Tracker (historical data)
 */

import { useState } from 'react';
import { EventDecisionToolTab } from './tabs/EventDecisionToolTab';
import { EventTrackerTab } from './tabs/EventTrackerTab';
import styles from './EventsAnalysis.module.css';

type ViewTab = 'decision-tool' | 'event-tracker';

export default function EventsAnalysis() {
  const [activeTab, setActiveTab] = useState<ViewTab>('decision-tool');

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Events Analysis</h1>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          onClick={() => setActiveTab('decision-tool')}
          className={activeTab === 'decision-tool' ? styles.tabActive : styles.tab}
          role="tab"
          aria-selected={activeTab === 'decision-tool'}
        >
          Decision Tool
        </button>
        <button
          onClick={() => setActiveTab('event-tracker')}
          className={activeTab === 'event-tracker' ? styles.tabActive : styles.tab}
          role="tab"
          aria-selected={activeTab === 'event-tracker'}
        >
          Event Tracker
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent} role="tabpanel">
        {activeTab === 'decision-tool' && <EventDecisionToolTab />}
        {activeTab === 'event-tracker' && <EventTrackerTab />}
      </div>
    </div>
  );
}
