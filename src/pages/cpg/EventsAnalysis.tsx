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
import { EventAnalyticsTab } from './tabs/EventAnalyticsTab';
import { PinIcon } from '../../components/common/PinIcon';
import { useTabPinning } from '../../hooks/useTabPinning';
import { PAGE_IDS } from '../../db/schema/tabPreferences.schema';
import styles from './EventsAnalysis.module.css';

type ViewTab = 'decision-tool' | 'event-tracker' | 'event-analytics';

export default function EventsAnalysis() {
  const [searchParams] = useSearchParams();

  // Check if we're editing an existing event
  const editEventId = searchParams.get('edit');

  // Extract date range parameters from URL (passed from dashboard)
  const urlStartDate = searchParams.get('startDate');
  const urlEndDate = searchParams.get('endDate');

  // Tab pinning
  const { defaultTab, pinTab, unpinTab, isTabPinned, isLoading: isPinningLoading } = useTabPinning({
    pageId: PAGE_IDS.EVENTS_ANALYSIS,
  });

  // Tab State
  const [activeTab, setActiveTab] = useState<ViewTab>('decision-tool');
  const [pinnedTabs, setPinnedTabs] = useState<Record<string, boolean>>({});

  // Update active tab when pinned default loads (unless there's a URL parameter or edit mode)
  useEffect(() => {
    const tabParam = searchParams.get('tab');

    // Priority: URL param > edit mode > pinned default
    if (tabParam) {
      if (tabParam === 'event-tracker') {
        setActiveTab('event-tracker');
      } else if (tabParam === 'decision-tool') {
        setActiveTab('decision-tool');
      } else if (tabParam === 'event-analytics') {
        setActiveTab('event-analytics');
      }
    } else if (editEventId) {
      setActiveTab('decision-tool');
    } else if (!isPinningLoading && defaultTab) {
      setActiveTab(defaultTab as ViewTab);
    }
  }, [defaultTab, isPinningLoading, searchParams, editEventId]);

  // Load pinned tabs state
  useEffect(() => {
    const loadPinnedState = async () => {
      const states: Record<string, boolean> = {};
      const tabs: ViewTab[] = ['decision-tool', 'event-tracker', 'event-analytics'];

      for (const tab of tabs) {
        states[tab] = await isTabPinned(tab);
      }

      setPinnedTabs(states);
    };

    loadPinnedState();
  }, [isTabPinned]);

  // Handle tab pin toggle
  const handlePinToggle = async (tabId: ViewTab) => {
    const currentlyPinned = pinnedTabs[tabId];

    try {
      if (currentlyPinned) {
        await unpinTab();
        setPinnedTabs((prev) => ({ ...prev, [tabId]: false }));
      } else {
        await pinTab(tabId);
        setPinnedTabs({
          'decision-tool': tabId === 'decision-tool',
          'event-tracker': tabId === 'event-tracker',
          'event-analytics': tabId === 'event-analytics',
        });
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

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
          <PinIcon
            isPinned={pinnedTabs['decision-tool'] || false}
            onClick={() => handlePinToggle('decision-tool')}
            size={14}
          />
        </button>
        <button
          onClick={() => setActiveTab('event-tracker')}
          className={activeTab === 'event-tracker' ? styles.tabActive : styles.tab}
          role="tab"
          aria-selected={activeTab === 'event-tracker'}
        >
          Event Tracker
          <PinIcon
            isPinned={pinnedTabs['event-tracker'] || false}
            onClick={() => handlePinToggle('event-tracker')}
            size={14}
          />
        </button>
        <button
          onClick={() => setActiveTab('event-analytics')}
          className={activeTab === 'event-analytics' ? styles.tabActive : styles.tab}
          role="tab"
          aria-selected={activeTab === 'event-analytics'}
        >
          Event Analytics
          <PinIcon
            isPinned={pinnedTabs['event-analytics'] || false}
            onClick={() => handlePinToggle('event-analytics')}
            size={14}
          />
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
        {activeTab === 'event-analytics' && <EventAnalyticsTab />}
      </div>
    </div>
  );
}
