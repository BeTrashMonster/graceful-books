/**
 * Events Analysis Page
 *
 * Main page for analyzing farmers markets and events.
 * Features two tabs: Decision Tool (planning) and Event Tracker (historical data)
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EventDecisionToolTab } from './tabs/EventDecisionToolTab';
import { EventTrackerTab } from './tabs/EventTrackerTab';
import styles from './EventsAnalysis.module.css';

type ViewTab = 'decision-tool' | 'event-tracker';

export default function EventsAnalysis() {
  const [searchParams] = useSearchParams();

  // Check if we're editing an existing event
  const editEventId = searchParams.get('edit');

  // Extract date range parameters from URL (passed from dashboard)
  const urlStartDate = searchParams.get('startDate');
  const urlEndDate = searchParams.get('endDate');

  // Tab State - default to decision-tool, or check URL param
  const [activeTab, setActiveTab] = useState<ViewTab>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'event-tracker') {
      return 'event-tracker';
    }
    return 'decision-tool';
  });

  // Switch to decision-tool tab when editing an event
  useEffect(() => {
    if (editEventId) {
      setActiveTab('decision-tool');
    }
  }, [editEventId]);

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
        {activeTab === 'decision-tool' && <EventDecisionToolTab editEventId={editEventId} />}
        {activeTab === 'event-tracker' && (
          <EventTrackerTab
            urlStartDate={urlStartDate}
            urlEndDate={urlEndDate}
          />
        )}
      </div>
    </div>
  );
}
