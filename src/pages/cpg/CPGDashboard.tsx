/**
 * CPG Dashboard - Financial Web Visualization
 *
 * Interactive force-directed graph showing where CPG money flows.
 * "Plant that seed of success and watch yourself bloom baby!"
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import { FinancialWebGraph } from '../../components/cpg/FinancialWebGraph';
import { createFinancialWebDataService } from '../../services/cpg/financialWebData.service';
import type { FinancialWebData } from '../../services/cpg/financialWebData.service';
import type { CPGFinishedProduct } from '../../db/schema/cpg.schema';
import styles from './CPGDashboard.module.css';

export default function CPGDashboard() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [webData, setWebData] = useState<FinancialWebData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<'365d' | '180d' | '90d' | '30d' | 'custom'>('365d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [products, setProducts] = useState<CPGFinishedProduct[]>([]);

  const service = createFinancialWebDataService(db);

  useEffect(() => {
    if (companyId) {
      loadProducts();
      loadWebData();
    }
  }, [companyId, dateRange, selectedProductId, customStartDate, customEndDate]);

  const loadProducts = async () => {
    if (!companyId) return;

    try {
      const prods = await db.cpgFinishedProducts
        .where('[company_id+active]')
        .equals([companyId, true])
        .and(p => !p.deleted_at && !p.is_bundle)
        .toArray();

      setProducts(prods);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const loadWebData = async () => {
    if (!companyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getDateRange();

      const data = await service.getFinancialWebData(
        companyId,
        startDate,
        endDate,
        selectedProductId === 'all' ? undefined : selectedProductId
      );

      setWebData(data);
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
      return {
        startDate: customStartDate ? new Date(customStartDate).getTime() : now - 365 * 24 * 60 * 60 * 1000,
        endDate: customEndDate ? new Date(customEndDate).getTime() : now,
      };
    }

    const days = parseInt(dateRange.replace('d', ''));
    const startDate = now - days * 24 * 60 * 60 * 1000;

    return { startDate, endDate };
  };

  const handleNodeClick = (nodeId: string, nodeType: string) => {
    // Navigate based on node type
    if (nodeType === 'category') {
      // Go to CPU Tracker filtered to this category
      navigate(`/cpg/cpu-tracker?category=${nodeId}`);
    } else if (nodeType === 'distribution') {
      navigate('/cpg/distribution-cost');
    } else if (nodeType === 'promo') {
      navigate('/cpg/promo-decision?tab=promo-tracker');
    }
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
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Your Financial Ecosystem</h1>
          <p className={styles.subtitle}>
            Watch your money flow and bloom 🌸
          </p>
        </div>
      </div>

      {/* Filter Panel */}
      <div className={styles.filterPanel}>
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
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="180d">Last 180 Days</option>
            <option value="365d">Last 365 Days</option>
            <option value="custom">Custom Range...</option>
          </select>
        </div>

        {/* Custom Date Range */}
        {dateRange === 'custom' && (
          <>
            <div className={styles.filterGroup}>
              <label htmlFor="start-date" className={styles.filterLabel}>
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className={styles.filterSelect}
              />
            </div>
            <div className={styles.filterGroup}>
              <label htmlFor="end-date" className={styles.filterLabel}>
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className={styles.filterSelect}
              />
            </div>
          </>
        )}

        {/* Product Filter */}
        <div className={styles.filterGroup}>
          <label htmlFor="product" className={styles.filterLabel}>
            View Product
          </label>
          <select
            id="product"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Products (Aggregated)</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* The Graph */}
      <div className={styles.graphContainer}>
        <FinancialWebGraph
          nodes={webData.nodes}
          connections={webData.connections}
          onNodeClick={handleNodeClick}
          width={1200}
          height={700}
        />
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

