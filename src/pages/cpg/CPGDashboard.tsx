/**
 * CPG Dashboard - Financial Web Visualization
 *
 * Interactive force-directed graph showing where CPG money flows.
 * "Plant that seed of success and watch yourself bloom baby!"
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import { FinancialWebGraph } from '../../components/cpg/FinancialWebGraph';
import { DatePicker } from '../../components/common/DatePicker';
import { createFinancialWebDataService } from '../../services/cpg/financialWebData.service';
import type { FinancialWebData } from '../../services/cpg/financialWebData.service';
import type { CPGFinishedProduct } from '../../db/schema/cpg.schema';
import { UserFeaturePreferencesService } from '../../services/userFeaturePreferences.service';
import type { FeatureName } from '../../services/userFeaturePreferences.service';
import styles from './CPGDashboard.module.css';

export default function CPGDashboard() {
  const navigate = useNavigate();
  const { companyId, userIdentifier: userId } = useAuth();
  const [rawWebData, setRawWebData] = useState<FinancialWebData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<'3mo' | '6mo' | '12mo' | '365d' | 'last-calendar-year' | 'this-calendar-year' | 'all' | 'custom'>('365d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<CPGFinishedProduct[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showOnlyConnected, setShowOnlyConnected] = useState(false);
  const [showInactiveNodes, setShowInactiveNodes] = useState(true); // Show inactive by default

  // User feature preferences
  const [userFeaturePrefs, setUserFeaturePrefs] = useState<Record<FeatureName, boolean>>({
    events: false,
    distribution: false,
    promos: false,
  });

  const service = createFinancialWebDataService(db);
  const prefsService = new UserFeaturePreferencesService(db);

  // Load user feature preferences
  useEffect(() => {
    if (userId) {
      loadUserPreferences();

      // Initialize default preferences for new users
      prefsService.initializeUserPreferences(userId).catch(err => {
        console.error('Failed to initialize preferences:', err);
      });
    }

    // Listen for preference updates from Settings page
    const handlePreferenceUpdate = async () => {
      console.log('🔔 Dashboard heard feature-preferences-updated event');
      if (userId) {
        await loadUserPreferences();
        await loadWebData(); // Reload dashboard data
        console.log('✅ Dashboard fully reloaded from Settings update');
      }
    };

    window.addEventListener('feature-preferences-updated', handlePreferenceUpdate);
    return () => window.removeEventListener('feature-preferences-updated', handlePreferenceUpdate);
  }, [userId]);

  const loadUserPreferences = async () => {
    if (!userId) return;
    try {
      const prefs = await prefsService.getUserPreferences(userId);
      console.log('📋 Dashboard loaded user preferences:', prefs);
      setUserFeaturePrefs(prefs);
    } catch (err) {
      console.error('❌ Failed to load user preferences:', err);
    }
  };

  const handleActivateFeature = async (featureName: FeatureName) => {
    console.log('🎯 Activate button clicked! Feature:', featureName, 'UserId:', userId);

    if (!userId) {
      console.error('❌ No userId available for activation');
      alert('Session error. Please refresh the page and try again.');
      return;
    }

    try {
      console.log('💾 Activating feature in database...');
      await prefsService.activateFeature(userId, featureName);
      console.log('✅ Feature activated in DB, reloading...');

      // Update local state
      await loadUserPreferences();
      await loadWebData();

      // Notify sidebar and other components
      window.dispatchEvent(new CustomEvent('feature-preferences-updated', {
        detail: { featureName, newState: true }
      }));

      console.log('🎉 Dashboard reloaded, navigating to feature...');

      // Navigate to the appropriate page
      const routeMap: Record<FeatureName, string> = {
        events: '/cpg/events-analysis',
        distribution: '/cpg/distribution-cost',
        promos: '/cpg/promo-decision',
      };

      navigate(routeMap[featureName]);
    } catch (err) {
      console.error('❌ Failed to activate feature:', err);
      alert('Failed to activate feature. Please try again.');
    }
  };

  // Apply "show only connected" filter and inactive nodes filter
  const webData = useMemo(() => {
    if (!rawWebData) return null;

    let filteredData = { ...rawWebData };

    // Filter out inactive nodes if showInactiveNodes is false
    if (!showInactiveNodes) {
      filteredData = {
        ...filteredData,
        nodes: filteredData.nodes.filter(node => {
          // Keep all category nodes
          if (node.type === 'category') return true;
          // For operational nodes, check if feature is active
          if (node.type === 'distribution' || node.type === 'promo' || node.type === 'events') {
            const featureName = node.type === 'promo' ? 'promos' : node.type;
            return userFeaturePrefs[featureName as FeatureName];
          }
          return true;
        }),
      };
    }

    if (!showOnlyConnected) {
      return filteredData;
    }

    // Get IDs of all category nodes that appear in connections
    const connectedCategoryIds = new Set<string>();
    rawWebData.connections.forEach(conn => {
      connectedCategoryIds.add(conn.source);
      connectedCategoryIds.add(conn.target);
    });

    // Filter nodes: keep operational nodes always, filter categories
    const filteredNodes = rawWebData.nodes.filter(node => {
      // Always keep Distribution and Promo nodes
      if (node.type === 'distribution' || node.type === 'promo') {
        return true;
      }

      // For category nodes:
      // 1. Must have spending > 0
      // 2. Must appear in at least one connection (if there are any connections)
      const hasSpending = parseFloat(node.totalSpent) > 0;
      const isConnected = rawWebData.connections.length === 0 || connectedCategoryIds.has(node.id);

      return hasSpending && isConnected;
    });

    // Create a set of remaining node IDs for quick lookup
    const remainingNodeIds = new Set(filteredNodes.map(n => n.id));

    // Filter connections to only include those where both source and target are still present
    const filteredConnections = rawWebData.connections.filter(conn =>
      remainingNodeIds.has(conn.source) && remainingNodeIds.has(conn.target)
    );

    return {
      ...filteredData,
      nodes: filteredNodes,
      connections: filteredConnections,
    };
  }, [rawWebData, showOnlyConnected, showInactiveNodes, userFeaturePrefs]);

  useEffect(() => {
    if (companyId) {
      loadProducts();

      // Only reload if we have valid date range for custom mode
      if (dateRange === 'custom') {
        if (customStartDate && customEndDate) {
          loadWebData();
        }
      } else {
        loadWebData();
      }
    }
  }, [companyId, dateRange, selectedProductIds, customStartDate, customEndDate, userFeaturePrefs]);

  const loadProducts = async () => {
    if (!companyId) return;

    try {
      const prods = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .and(p => p.active && !p.deleted_at && !p.is_bundle)
        .toArray();

      // Sort products alphabetically by name
      const sortedProds = prods.sort((a, b) => a.name.localeCompare(b.name));

      setProducts(sortedProds);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const handleProductToggle = (productId: string) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const loadWebData = async () => {
    if (!companyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getDateRange();

      console.log('🔍 Loading web data with date range:', {
        startDate: new Date(startDate).toLocaleDateString(),
        endDate: new Date(endDate).toLocaleDateString(),
        startTimestamp: startDate,
        endTimestamp: endDate,
        customStartDate,
        customEndDate,
        dateRangeMode: dateRange
      });

      // Set user feature preferences on service
      console.log('🎯 Setting user feature prefs on service:', userFeaturePrefs);
      service.setUserFeaturePrefs(userFeaturePrefs);

      const data = await service.getFinancialWebData(
        companyId,
        startDate,
        endDate,
        selectedProductIds.size > 0 ? Array.from(selectedProductIds) : undefined
      );

      console.log('📊 Web data loaded:', {
        nodeCount: data.nodes.length,
        connectionCount: data.connections.length,
        nodes: data.nodes.map(n => ({ name: n.name, spent: n.totalSpent, type: n.type }))
      });

      setRawWebData(data);
    } catch (err: any) {
      console.error('Failed to load web data:', err);
      setError(err.message || 'Failed to load financial data');
    } finally {
      setIsLoading(false);
    }
  };

  const getDateRange = (): { startDate: number; endDate: number } => {
    const now = Date.now();
    const endDate = now;

    if (dateRange === 'custom') {
      // Parse dates in local timezone, not UTC
      const parseLocalDate = (dateStr: string, isEndDate: boolean): number => {
        if (!dateStr) return now;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return now;
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // 0-indexed
        const day = parseInt(parts[2]);

        // For end dates, set to end of day (23:59:59.999) to include all invoices from that day
        if (isEndDate) {
          return new Date(year, month, day, 23, 59, 59, 999).getTime();
        }

        // For start dates, set to start of day (00:00:00.000)
        return new Date(year, month, day).getTime();
      };

      return {
        startDate: customStartDate ? parseLocalDate(customStartDate, false) : now - 365 * 24 * 60 * 60 * 1000,
        endDate: customEndDate ? parseLocalDate(customEndDate, true) : now,
      };
    }

    if (dateRange === 'all') {
      return {
        startDate: 0, // Beginning of time
        endDate,
      };
    }

    // Handle calendar year ranges
    if (dateRange === 'last-calendar-year') {
      const year = new Date().getFullYear() - 1;
      return {
        startDate: new Date(year, 0, 1).getTime(), // Jan 1
        endDate: new Date(year, 11, 31, 23, 59, 59, 999).getTime(), // Dec 31
      };
    }

    if (dateRange === 'this-calendar-year') {
      const year = new Date().getFullYear();
      return {
        startDate: new Date(year, 0, 1).getTime(), // Jan 1
        endDate: now, // Today
      };
    }

    // Handle month-based ranges (3mo, 6mo, 12mo)
    if (dateRange.endsWith('mo')) {
      const months = parseInt(dateRange.replace('mo', ''));
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      return { startDate: startDate.getTime(), endDate };
    }

    // Handle day-based ranges (365d)
    const days = parseInt(dateRange.replace('d', ''));
    const startDate = now - days * 24 * 60 * 60 * 1000;

    return { startDate, endDate };
  };

  const handleNodeClick = (nodeId: string, nodeType: string) => {
    if (nodeType === 'category') {
      // Build URL params for CPU Tracker > Cost Intelligence > Vendor Intel
      const { startDate, endDate } = getDateRange();
      const params = new URLSearchParams({
        tab: 'comparison',
        intelligenceTab: 'vendors',
        categoryId: nodeId,
        startDate: startDate.toString(),
        endDate: endDate.toString(),
      });
      navigate(`/cpg/cpu-tracker?${params.toString()}`);
    } else if (nodeType === 'distribution') {
      navigate('/cpg/distribution-cost');
    } else if (nodeType === 'promo') {
      navigate('/cpg/promo-decision');
    } else if (nodeType === 'events') {
      // Navigate to Events Analysis (Decision Tool - same as sidebar)
      navigate('/cpg/events-analysis');
    }
  };

  const handleConnectionClick = (sourceId: string, targetId: string, productIds: string[]) => {
    // Build URL params for CPU Tracker > Cost Intelligence > CPU Trends
    const { startDate, endDate } = getDateRange();
    const params = new URLSearchParams({
      tab: 'comparison',
      intelligenceTab: 'trends',
      categoryIds: `${sourceId},${targetId}`,
      productIds: productIds.join(','),
      startDate: startDate.toString(),
      endDate: endDate.toString(),
    });
    navigate(`/cpg/cpu-tracker?${params.toString()}`);
  };

  // Update custom date (useEffect will handle reload)
  const handleCustomDateChange = (value: string, isStartDate: boolean) => {
    if (isStartDate) {
      setCustomStartDate(value);
    } else {
      setCustomEndDate(value);
    }
    // useEffect will trigger loadWebData() when both dates are set
  };

  if (!companyId) {
    return (
      <div className={styles.container}>
        <p className={styles.emptyMessage}>Please select a company to view your financial web</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Oops!</h2>
          <p>{error}</p>
          <button onClick={loadWebData} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !webData) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.seedGrowing}>🌱</div>
          <p>Growing your financial web...</p>
        </div>
      </div>
    );
  }

  // Empty state - no data yet
  if (webData.nodes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.seedIcon}>🌱</div>
          <h2>Plant Your First Seed!</h2>
          <p>Add your first invoice to see where your money flows</p>
          <button
            onClick={() => navigate('/cpg/cpu-tracker')}
            className={styles.getStartedButton}
          >
            Add Invoice
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Graph + Filters Side-by-Side */}
      <div className={styles.mainLayout}>
        {/* The Graph */}
        <div className={styles.graphContainer}>
          <div>
            <FinancialWebGraph
              nodes={webData.nodes}
              connections={webData.connections}
              onNodeClick={handleNodeClick}
              onConnectionClick={handleConnectionClick}
              onActivateFeature={handleActivateFeature}
              userFeaturePrefs={userFeaturePrefs}
              width={1000}
              height={700}
            />
          </div>
        </div>

        {/* Filter Panel - Sidebar */}
        <div className={styles.filterPanel}>
          <div className={styles.filterPanelContent}>
            {/* Date Range */}
            <div className={styles.filterGroup}>
          <label htmlFor="date-range" className={styles.filterLabel}>
            Time Period
          </label>
          <select
            id="date-range"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className={styles.filterSelect}
          >
            <option value="3mo">Last 3 Months</option>
            <option value="6mo">Last 6 Months</option>
            <option value="12mo">Last 12 Months</option>
            <option value="365d">Last 365 Days</option>
            <option value="last-calendar-year">Last Calendar Year ({new Date().getFullYear() - 1})</option>
            <option value="this-calendar-year">This Calendar Year ({new Date().getFullYear()})</option>
            <option value="custom">Custom Range...</option>
            <option value="all">All Time</option>
          </select>
        </div>

        {/* Custom Date Range */}
        {dateRange === 'custom' && (
          <>
            <div className={styles.filterGroup}>
              <label htmlFor="start-date" className={styles.filterLabel}>
                Start Date
              </label>
              <DatePicker
                value={customStartDate}
                onChange={(value) => handleCustomDateChange(value, true)}
                placeholder="Select start date..."
              />
            </div>
            <div className={styles.filterGroup}>
              <label htmlFor="end-date" className={styles.filterLabel}>
                End Date
              </label>
              <DatePicker
                value={customEndDate}
                onChange={(value) => handleCustomDateChange(value, false)}
                placeholder="Select end date..."
              />
            </div>
          </>
        )}

        {/* Product Filter */}
        <div className={styles.filterGroup} style={{ position: 'relative' }}>
          <label htmlFor="product-filter" className={styles.filterLabel}>
            Filter by Products
          </label>
          <button
            id="product-filter"
            onClick={() => setShowProductDropdown(!showProductDropdown)}
            aria-expanded={showProductDropdown}
            aria-label="Filter by products"
            className={styles.dropdownButton}
          >
            <span>
              {selectedProductIds.size === 0
                ? 'All Products'
                : selectedProductIds.size === products.length
                ? `All (${products.length})`
                : `${selectedProductIds.size} Selected`}
            </span>
            <span aria-hidden="true" className={styles.dropdownArrow}>
              {showProductDropdown ? '▲' : '▼'}
            </span>
          </button>

          {showProductDropdown && (
            <div className={styles.dropdownMenu}>
              {/* Select All / Clear All */}
              <div className={styles.dropdownActions}>
                <button
                  onClick={() => {
                    setSelectedProductIds(new Set(products.map(p => p.id)));
                    setShowProductDropdown(false);
                  }}
                  className={styles.actionButton}
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedProductIds(new Set())}
                  className={styles.actionButton}
                >
                  Clear All
                </button>
              </div>

              {/* Product List */}
              {products.length === 0 ? (
                <div className={styles.noProducts}>No products available</div>
              ) : (
                products.map(product => (
                  <label key={product.id} className={styles.dropdownItem}>
                    <input
                      type="checkbox"
                      checked={selectedProductIds.has(product.id)}
                      onChange={() => handleProductToggle(product.id)}
                      className={styles.dropdownCheckbox}
                    />
                    <span>{product.name}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {/* Show Only Connected Checkbox */}
        <div className={styles.filterGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={showOnlyConnected}
              onChange={(e) => setShowOnlyConnected(e.target.checked)}
              className={styles.checkbox}
            />
            <span>Show only connected items</span>
          </label>
        </div>

        {/* Show Inactive Nodes Checkbox + Manage Features */}
        <div className={styles.filterGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={showInactiveNodes}
              onChange={(e) => setShowInactiveNodes(e.target.checked)}
              className={styles.checkbox}
            />
            <span>Show inactive nodes</span>
          </label>
          <button
            onClick={() => navigate('/cpg/settings')}
            className={styles.manageFeaturesLink}
          >
            Manage Feature
          </button>
        </div>
        </div>
      </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <h3>How to Use This View</h3>
        <div className={styles.legendGrid}>
          <div className={styles.legendItem}>
            <span className={styles.legendIconCategory}>●</span>
            <div>
              <strong>Category Nodes</strong>
              <p>Sized by total $ spent. Click to view invoices.</p>
            </div>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendIconDistribution}>●</span>
            <div>
              <strong>Distribution</strong>
              <p>Shipping & warehousing costs. Click to analyze.</p>
            </div>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendIconPromo}>●</span>
            <div>
              <strong>Promos</strong>
              <p>Promotional spend. Click to track ROI.</p>
            </div>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendIconEvents}>●</span>
            <div>
              <strong>Events</strong>
              <p>Event costs, travel, and labor. Click to view tracker.</p>
            </div>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendIconLine}>━</span>
            <div>
              <strong>Connections</strong>
              <p>Categories used together in products. Hover to see which ones!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

