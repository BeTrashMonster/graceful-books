/**
 * Admin Charity Dashboard
 *
 * Comprehensive charity management dashboard with:
 * - Analytics and impact metrics
 * - Charity CRUD operations
 * - Phase-in/phase-out management
 * - Distribution tracking
 *
 * Requirements:
 * - IC3: Admin Panel - Charity Management
 * - IC2.5: Charity Payment Distribution System
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CharityStatus } from '../../types/database.types';
import type {
  CharityAnalytics,
  CharityPhaseTransition,
  CharityDistribution,
  ComprehensiveAnalytics,
} from '../../services/charities.api';
import {
  getAdminCharities,
  getComprehensiveAnalytics,
  getPhaseTransitions,
  getDistributions,
} from '../../services/charities.api';
import { CharityAnalyticsTab } from '../../components/admin/charity/CharityAnalyticsTab';
import { CharityManagementTab } from '../../components/admin/charity/CharityManagementTab';
import { PhaseTransitionsTab } from '../../components/admin/charity/PhaseTransitionsTab';
import { DistributionsTab } from '../../components/admin/charity/DistributionsTab';
import styles from './AdminCharityDashboard.module.css';

type Tab = 'analytics' | 'management' | 'transitions' | 'distributions';

export default function AdminCharityDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [analytics, setAnalytics] = useState<ComprehensiveAnalytics | null>(null);
  const [charities, setCharities] = useState<CharityAnalytics[]>([]);
  const [transitions, setTransitions] = useState<CharityPhaseTransition[]>([]);
  const [distributions, setDistributions] = useState<CharityDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load all data in parallel
      const [analyticsData, charitiesData, transitionsData, distributionsData] = await Promise.all([
        getComprehensiveAnalytics(),
        getAdminCharities(),
        getPhaseTransitions(),
        getDistributions(),
      ]);

      setAnalytics(analyticsData);
      setCharities(charitiesData);
      setTransitions(transitionsData);
      setDistributions(distributionsData);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  if (loading && !analytics) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <div className={styles.spinner} aria-hidden="true"></div>
        <span>Loading charity dashboard...</span>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className={styles.error} role="alert">
        <h2>Error Loading Dashboard</h2>
        <p>{error}</p>
        <button type="button" onClick={handleRefresh} className={styles.retryButton}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className={styles.backButton}
            aria-label="Back to admin dashboard"
          >
            ← Back to Admin Dashboard
          </button>
          <h1 className={styles.title}>Charity Management Dashboard</h1>
          <p className={styles.subtitle}>
            Manage charities, track impact, and handle phase transitions
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className={styles.refreshButton}
          disabled={loading}
          aria-label="Refresh dashboard data"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {/* Quick Stats Bar */}
      {analytics && (
        <div className={styles.quickStats}>
          <QuickStat
            label="Lifetime Total"
            value={`$${(analytics.summary.lifetimeTotal / 100).toLocaleString()}`}
            color="green"
          />
          <QuickStat
            label="Active Charities"
            value={analytics.summary.activeCharities.toString()}
            color="blue"
          />
          <QuickStat
            label="This Month"
            value={`$${(analytics.summary.currentMonthTotal / 100).toLocaleString()}`}
            color="purple"
          />
          <QuickStat
            label="Unpaid"
            value={`$${(analytics.summary.unpaidAmount / 100).toLocaleString()}`}
            color="orange"
          />
        </div>
      )}

      {/* Tab Navigation */}
      <nav className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'analytics'}
          aria-controls="analytics-panel"
          onClick={() => setActiveTab('analytics')}
          className={`${styles.tab} ${activeTab === 'analytics' ? styles.tabActive : ''}`}
        >
          📊 Analytics
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'management'}
          aria-controls="management-panel"
          onClick={() => setActiveTab('management')}
          className={`${styles.tab} ${activeTab === 'management' ? styles.tabActive : ''}`}
        >
          🏛️ Charities
          {analytics && analytics.summary.pendingCharities > 0 && (
            <span className={styles.badge}>{analytics.summary.pendingCharities}</span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'transitions'}
          aria-controls="transitions-panel"
          onClick={() => setActiveTab('transitions')}
          className={`${styles.tab} ${activeTab === 'transitions' ? styles.tabActive : ''}`}
        >
          🔄 Phase Transitions
          {transitions.filter(t => t.status === 'scheduled').length > 0 && (
            <span className={styles.badge}>
              {transitions.filter(t => t.status === 'scheduled').length}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'distributions'}
          aria-controls="distributions-panel"
          onClick={() => setActiveTab('distributions')}
          className={`${styles.tab} ${activeTab === 'distributions' ? styles.tabActive : ''}`}
        >
          💰 Distributions
          {distributions.filter(d => d.status === 'pending').length > 0 && (
            <span className={styles.badge}>
              {distributions.filter(d => d.status === 'pending').length}
            </span>
          )}
        </button>
      </nav>

      {/* Tab Panels */}
      <div className={styles.tabPanels}>
        {activeTab === 'analytics' && analytics && (
          <div
            role="tabpanel"
            id="analytics-panel"
            aria-labelledby="analytics-tab"
            className={styles.tabPanel}
          >
            <CharityAnalyticsTab
              analytics={analytics}
              charities={charities}
              onRefresh={handleRefresh}
            />
          </div>
        )}

        {activeTab === 'management' && (
          <div
            role="tabpanel"
            id="management-panel"
            aria-labelledby="management-tab"
            className={styles.tabPanel}
          >
            <CharityManagementTab
              charities={charities}
              onRefresh={handleRefresh}
            />
          </div>
        )}

        {activeTab === 'transitions' && (
          <div
            role="tabpanel"
            id="transitions-panel"
            aria-labelledby="transitions-tab"
            className={styles.tabPanel}
          >
            <PhaseTransitionsTab
              transitions={transitions}
              charities={charities}
              onRefresh={handleRefresh}
            />
          </div>
        )}

        {activeTab === 'distributions' && (
          <div
            role="tabpanel"
            id="distributions-panel"
            aria-labelledby="distributions-tab"
            className={styles.tabPanel}
          >
            <DistributionsTab
              distributions={distributions}
              onRefresh={handleRefresh}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Quick Stat Component
 */
interface QuickStatProps {
  label: string;
  value: string;
  color: 'green' | 'blue' | 'purple' | 'orange';
}

function QuickStat({ label, value, color }: QuickStatProps) {
  return (
    <div className={`${styles.quickStat} ${styles[`quickStat${capitalize(color)}`]}`}>
      <div className={styles.quickStatLabel}>{label}</div>
      <div className={styles.quickStatValue}>{value}</div>
    </div>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
