/**
 * Historical Analytics Page
 *
 * Group E2: Historical Analytics for CPG Module
 *
 * Features:
 * - Seasonal pattern visualization (identify high/low cost periods)
 * - Promo Tracker (unified promo management and ROI tracking)
 *
 * Date range options: 3mo, 6mo, 1yr, all-time
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db';
import {
  createHistoricalAnalyticsService,
  type DateRangePreset,
  type CPUTrendAnalysis,
  type SeasonalPattern,
} from '../../services/cpg/historicalAnalytics.service';
import type { CPGCategory, CPGSalesPromo } from '../../db/schema/cpg.schema';
import { MarkPromoCompleteModal } from '../../components/cpg/modals/MarkPromoCompleteModal';
import { Modal } from '../../components/modals/Modal';
import { Button } from '../../components/core/Button';
import styles from './HistoricalAnalytics.module.css';

type ViewMode = 'seasonal' | 'promo-tracker';
type PromoStatus = 'all' | 'draft' | 'approved' | 'declined' | 'active' | 'completed';
type MarginQuality = 'all' | 'gutCheck' | 'good' | 'better' | 'best';

interface HistoricalAnalyticsProps {
  initialTab?: 'seasonal' | 'promo-tracker';
  hideNavigation?: boolean;
}

export default function HistoricalAnalytics({ initialTab: propInitialTab, hideNavigation = false }: HistoricalAnalyticsProps = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companyId } = useAuth();

  // Get initial tab from URL parameter or props, default to 'seasonal'
  const tabParam = searchParams.get('tab') as ViewMode | null;

  const initialTab = tabParam && ['seasonal', 'promo-tracker'].includes(tabParam)
    ? tabParam
    : (propInitialTab || 'seasonal');

  const [viewMode, setViewMode] = useState<ViewMode>(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<DateRangePreset>('12mo');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVariant, setSelectedVariant] = useState<string>('all');

  // Promo Tracker Filters
  const [statusFilter, setStatusFilter] = useState<PromoStatus>('all');
  const [retailerFilter, setRetailerFilter] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState<string>('');
  const [marginQualityFilter, setMarginQualityFilter] = useState<MarginQuality>('all');
  const [promoDateRangeFilter, setPromoDateRangeFilter] = useState<string>('all');

  // Available options
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [variants, setVariants] = useState<string[]>([]);

  // Analytics Data
  const [seasonalPattern, setSeasonalPattern] = useState<SeasonalPattern | null>(null);

  // Promo Tracker Data
  const [promos, setPromos] = useState<CPGSalesPromo[]>([]);
  const [retailers, setRetailers] = useState<string[]>([]);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedPromoForComplete, setSelectedPromoForComplete] = useState<CPGSalesPromo | null>(null);

  const service = createHistoricalAnalyticsService(db);

  useEffect(() => {
    loadFilterOptions();
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId, viewMode, dateRange, selectedCategory, selectedVariant, customStartDate, customEndDate]);

  const loadFilterOptions = async () => {
    if (!companyId) return;

    try {
      // Load categories
      const cats = await db.cpgCategories
        .where('company_id')
        .equals(companyId)
        .and((cat) => cat.active && !cat.deleted_at)
        .toArray();

      setCategories(cats);

      // Collect unique variants
      const uniqueVariants = new Set<string>();
      cats.forEach((cat) => {
        if (cat.variants) {
          cat.variants.forEach((v) => uniqueVariants.add(v));
        }
      });
      setVariants(Array.from(uniqueVariants).sort());
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  const loadData = async () => {
    if (!companyId) return;

    setIsLoading(true);
    setError(null);

    try {
      switch (viewMode) {
        case 'seasonal':
          await loadSeasonalPattern();
          break;
        case 'promo-tracker':
          await loadPromos();
          break;
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };


  const loadSeasonalPattern = async () => {
    if (!companyId) return;

    const variant = selectedVariant === 'all' ? null : selectedVariant;
    const categoryId = selectedCategory !== 'all' ? selectedCategory : undefined;

    const pattern = await service.detectSeasonalPatterns(
      companyId,
      variant,
      categoryId,
      2 // minimum 2 years of data
    );
    setSeasonalPattern(pattern);
  };

  const loadPromos = async () => {
    if (!companyId) return;

    try {
      // Load all promos for this company
      const allPromos = await db.cpgSalesPromos
        .where('company_id')
        .equals(companyId)
        .and((promo) => !promo.deleted_at)
        .reverse()
        .sortBy('created_at');

      setPromos(allPromos);

      // Extract unique retailers for filter
      const uniqueRetailers = Array.from(
        new Set(allPromos.map((p) => p.retailer_name).filter(Boolean))
      ).sort();
      setRetailers(uniqueRetailers as string[]);
    } catch (error) {
      console.error('Failed to load promos:', error);
    }
  };

  const getFilteredPromos = (): CPGSalesPromo[] => {
    let filtered = [...promos];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((promo) => promo.status === statusFilter);
    }

    // Filter by retailer
    if (retailerFilter !== 'all') {
      filtered = filtered.filter((promo) => promo.retailer_name === retailerFilter);
    }

    // Filter by name search
    if (nameSearch.trim()) {
      const search = nameSearch.toLowerCase();
      filtered = filtered.filter((promo) =>
        promo.promo_name.toLowerCase().includes(search)
      );
    }

    // Filter by margin quality
    if (marginQualityFilter !== 'all') {
      filtered = filtered.filter((promo) => {
        const recommendation = promo.recommendation || 'neutral';
        return getMarginQuality(recommendation) === marginQualityFilter;
      });
    }

    // Filter by date range
    if (promoDateRangeFilter !== 'all') {
      const now = Date.now();
      const ranges: Record<string, number> = {
        '3mo': 90 * 24 * 60 * 60 * 1000,
        '6mo': 180 * 24 * 60 * 60 * 1000,
        '1yr': 365 * 24 * 60 * 60 * 1000,
      };

      const rangeMs = ranges[promoDateRangeFilter];
      if (rangeMs) {
        filtered = filtered.filter((promo) => {
          const promoDate = promo.promo_start_date || promo.created_at;
          return now - promoDate <= rangeMs;
        });
      }
    }

    return filtered;
  };

  const getMarginQuality = (recommendation: string): MarginQuality => {
    switch (recommendation) {
      case 'approve':
      case 'strong-approve':
        return 'best';
      case 'neutral':
        return 'good';
      case 'caution':
        return 'gutCheck';
      case 'decline':
        return 'gutCheck';
      default:
        return 'good';
    }
  };

  const getMarginQualityBadge = (promo: CPGSalesPromo): JSX.Element | null => {
    if (!promo.recommendation) return null;

    const quality = getMarginQuality(promo.recommendation);
    const badges: Record<MarginQuality, { text: string; className: string }> = {
      best: { text: 'Best', className: styles.marginBest },
      better: { text: 'Better', className: styles.marginBetter },
      good: { text: 'Good', className: styles.marginGood },
      poor: { text: 'Gut Check', className: styles.marginGutCheck },
      all: { text: '', className: '' },
    };

    const badge = badges[quality];
    if (!badge || !badge.text) return null;

    return <span className={badge.className}>{badge.text}</span>;
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'approved':
        return styles.statusapproved;
      case 'declined':
        return styles.statusdeclined;
      case 'draft':
        return styles.statusdraft;
      case 'active':
        return styles.statusactive;
      case 'completed':
        return styles.statuscompleted;
      default:
        return styles.statusdraft;
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatPercentage = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${num.toFixed(2)}%`;
  };

  const handleDateBlur = (value: string, setter: (value: string) => void) => {
    if (!value) return;

    const parts = value.split('-');
    if (parts.length === 3) {
      let [year, month, day] = parts;

      // Parse year as integer to remove leading zeros
      const yearNum = parseInt(year, 10);

      // If year is 0-99, assume 20xx (only when user is done typing)
      if (yearNum >= 0 && yearNum <= 99 && year.length === 4) {
        year = '20' + String(yearNum).padStart(2, '0');
        setter(`${year}-${month}-${day}`);
      }
    }
  };

  const handleEdit = (promoId: string) => {
    navigate(`/cpg/promo-decision?edit=${promoId}`);
    setActionMenuOpen(null);
  };

  const handleDelete = async (promoId: string) => {
    if (!confirm('Are you sure you want to delete this promo? This action cannot be undone.')) {
      return;
    }

    try {
      await db.cpgSalesPromos.update(promoId, {
        deleted_at: Date.now(),
      });

      await loadPromos();
      setActionMenuOpen(null);
    } catch (error) {
      console.error('Failed to delete promo:', error);
      alert('Failed to delete promo. Please try again.');
    }
  };

  const handleMarkComplete = (promoId: string) => {
    const promo = promos.find(p => p.id === promoId);
    if (!promo) return;

    setSelectedPromoForComplete(promo);
    setCompleteModalOpen(true);
    setActionMenuOpen(null);
  };

  const handleCompleteSubmit = async (actualPayback: string, actualUnitsSold: string) => {
    if (!selectedPromoForComplete) return;

    try {
      await db.cpgSalesPromos.update(selectedPromoForComplete.id, {
        status: 'completed',
        actual_payback: actualPayback,
        actual_units_sold: actualUnitsSold,
        updated_at: Date.now(),
      });

      await loadPromos();
      setCompleteModalOpen(false);
      setSelectedPromoForComplete(null);
    } catch (error) {
      console.error('Failed to mark promo as complete:', error);
      throw error;
    }
  };

  const getTotalUnitsAvailable = (promo: CPGSalesPromo): number => {
    if (!promo.variant_promo_data) return 0;
    return Object.values(promo.variant_promo_data).reduce((total, variant) => {
      return total + parseFloat(variant.units_available || '0');
    }, 0);
  };

  const calculateSellThrough = (promo: CPGSalesPromo): number => {
    if (!promo.actual_units_sold) return 0;
    const totalUnits = getTotalUnitsAvailable(promo);
    if (totalUnits === 0) return 0;
    return (parseFloat(promo.actual_units_sold) / totalUnits) * 100;
  };

  const getSellThroughColor = (percentage: number): string => {
    if (percentage >= 90) return styles.sellThroughExcellent;
    if (percentage >= 70) return styles.sellThroughGood;
    if (percentage >= 50) return styles.sellThroughModerate;
    return styles.sellThroughLow;
  };

  const toggleActionMenu = (promoId: string) => {
    setActionMenuOpen(actionMenuOpen === promoId ? null : promoId);
  };


  if (!companyId) {
    return (
      <div className={styles.container}>
        <p>Please select a company to view analytics</p>
      </div>
    );
  }

  const filteredPromos = viewMode === 'promo-tracker' ? getFilteredPromos() : [];

  return (
    <div className={hideNavigation ? styles.containerEmbedded : styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.subtitle}>
            Analyze seasonal patterns and promotional campaigns
          </p>
        </div>
      </div>

      {/* View Mode Tabs */}
      {!hideNavigation && (
        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={viewMode === 'seasonal'}
            onClick={() => setViewMode('seasonal')}
            className={viewMode === 'seasonal' ? styles.tabActive : styles.tab}
          >
            Seasonal Patterns
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'promo-tracker'}
            onClick={() => setViewMode('promo-tracker')}
            className={viewMode === 'promo-tracker' ? styles.tabActive : styles.tab}
          >
            Promo Tracker
          </button>
        </div>
      )}

      {/* Filters for Analytics Tabs */}
      {viewMode !== 'promo-tracker' && (
        <div className={styles.filters}>
          {/* Date Range Filter */}
          {viewMode !== 'seasonal' && (
            <div className={styles.filterGroup}>
              <label htmlFor="date-range" className={styles.filterLabel}>
                Date Range
              </label>
              <select
                id="date-range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
                className={styles.filterSelect}
              >
                <option value="3mo">Last 3 Months</option>
                <option value="6mo">Last 6 Months</option>
                <option value="12mo">Last 12 Months (365 days)</option>
                <option value="last-calendar-year">Last Calendar Year (2024)</option>
                <option value="this-calendar-year">This Calendar Year (2025)</option>
                <option value="custom">Custom Range...</option>
                <option value="all">All Time</option>
              </select>
            </div>
          )}

          {/* Custom Date Range Inputs */}
          {viewMode !== 'seasonal' && dateRange === 'custom' && (
            <>
              <div className={styles.filterGroup}>
                <label htmlFor="custom-start" className={styles.filterLabel}>
                  Start Date
                </label>
                <input
                  id="custom-start"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  onBlur={(e) => handleDateBlur(e.target.value, setCustomStartDate)}
                  className={styles.filterSelect}
                />
              </div>
              <div className={styles.filterGroup}>
                <label htmlFor="custom-end" className={styles.filterLabel}>
                  End Date
                </label>
                <input
                  id="custom-end"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  onBlur={(e) => handleDateBlur(e.target.value, setCustomEndDate)}
                  className={styles.filterSelect}
                />
              </div>
            </>
          )}

          {/* Category Filter */}
          {viewMode === 'seasonal' && (
            <div className={styles.filterGroup}>
              <label htmlFor="category" className={styles.filterLabel}>
                Category
              </label>
              <select
                id="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Variant Filter */}
          {viewMode === 'seasonal' && (
            <div className={styles.filterGroup}>
              <label htmlFor="variant" className={styles.filterLabel}>
                Variant
              </label>
              <select
                id="variant"
                value={selectedVariant}
                onChange={(e) => setSelectedVariant(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Variants</option>
                {variants.map((variant) => (
                  <option key={variant} value={variant}>
                    {variant}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Filters for Promo Tracker Tab */}
      {viewMode === 'promo-tracker' && (
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label htmlFor="status-filter" className={styles.filterLabel}>
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PromoStatus)}
              className={styles.filterSelect}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="retailer-filter" className={styles.filterLabel}>
              Retailer
            </label>
            <select
              id="retailer-filter"
              value={retailerFilter}
              onChange={(e) => setRetailerFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Retailers</option>
              {retailers.map((retailer) => (
                <option key={retailer} value={retailer}>
                  {retailer}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="name-search" className={styles.filterLabel}>
              Promo Name
            </label>
            <input
              id="name-search"
              type="text"
              placeholder="Search by name..."
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              className={styles.filterSelect}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="margin-filter" className={styles.filterLabel}>
              Margin Quality
            </label>
            <select
              id="margin-filter"
              value={marginQualityFilter}
              onChange={(e) => setMarginQualityFilter(e.target.value as MarginQuality)}
              className={styles.filterSelect}
            >
              <option value="all">All Qualities</option>
              <option value="best">Best</option>
              <option value="better">Better</option>
              <option value="good">Good</option>
              <option value="poor">Poor</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="promo-date-filter" className={styles.filterLabel}>
              Date Range
            </label>
            <select
              id="promo-date-filter"
              value={promoDateRangeFilter}
              onChange={(e) => setPromoDateRangeFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Time</option>
              <option value="3mo">Last 3 Months</option>
              <option value="6mo">Last 6 Months</option>
              <option value="1yr">Last Year</option>
            </select>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loading} aria-live="polite">
          Loading analytics...
        </div>
      )}

      {/* Seasonal Pattern View */}
      {viewMode === 'seasonal' && !isLoading && seasonalPattern && (
        <div className={styles.content}>
          {/* Insight Card */}
          <div className={styles.insightCard}>
            <div className={styles.insightIcon}>💡</div>
            <div>
              <div className={styles.insightLabel}>Key Insight</div>
              <div className={styles.insightText}>{seasonalPattern.insight}</div>
            </div>
          </div>

          {/* Seasonal Pattern Chart */}
          <div className={styles.chartContainer}>
            <h2 className={styles.chartTitle}>Seasonal Cost Patterns</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={seasonalPattern.patterns}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month_name" angle={-45} textAnchor="end" height={80} />
                <YAxis
                  label={{ value: 'Seasonal Index', angle: -90, position: 'insideLeft' }}
                  domain={[80, 120]}
                />
                <Tooltip
                  formatter={(value) => Number(value).toFixed(2) as any}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className={styles.tooltip}>
                          <p className={styles.tooltipLabel}>{data.month_name}</p>
                          <p>Avg CPU: {formatCurrency(data.average_cpu)}</p>
                          <p>Seasonal Index: {data.seasonal_index}</p>
                          <p>Samples: {data.sample_size}</p>
                          <p className={styles.tooltipObservation}>
                            {data.observation === 'high' && '↑ High Cost Period'}
                            {data.observation === 'low' && '↓ Low Cost Period'}
                            {data.observation === 'normal' && '→ Normal'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar
                  dataKey="seasonal_index"
                  fill={'#60a5fa'}
                  name="Seasonal Index"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Breakdown Table */}
          <div className={styles.tableContainer}>
            <h2 className={styles.tableTitle}>Monthly Breakdown</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Avg CPU</th>
                  <th>Seasonal Index</th>
                  <th>Pattern</th>
                  <th>Sample Size</th>
                </tr>
              </thead>
              <tbody>
                {seasonalPattern.patterns.map((pattern) => (
                  <tr key={pattern.month}>
                    <td>{pattern.month_name}</td>
                    <td>{formatCurrency(pattern.average_cpu)}</td>
                    <td>{pattern.seasonal_index}</td>
                    <td>
                      <span
                        className={
                          pattern.observation === 'high'
                            ? styles.observationHigh
                            : pattern.observation === 'low'
                              ? styles.observationLow
                              : styles.observationNormal
                        }
                      >
                        {pattern.observation === 'high' && '↑ High'}
                        {pattern.observation === 'low' && '↓ Low'}
                        {pattern.observation === 'normal' && '→ Normal'}
                      </span>
                    </td>
                    <td>{pattern.sample_size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Promo Tracker View */}
      {viewMode === 'promo-tracker' && !isLoading && (
        <div className={styles.content}>
          <div className={styles.tableContainer}>
            {filteredPromos.length === 0 ? (
              <div className={styles.noData}>
                {promos.length === 0
                  ? 'No promos found. Create your first promo using the Promo Analysis tool!'
                  : 'No promos match your filters. Try adjusting your search criteria.'}
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Promo Name</th>
                    <th>Retailer</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Projected Payback</th>
                    <th>Actual Payback</th>
                    <th>Variance</th>
                    <th>Sell-Through</th>
                    <th>Margin Quality</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPromos.map((promo) => {
                    const isCompleted = promo.status === 'completed';
                    const sellThrough = isCompleted ? calculateSellThrough(promo) : 0;
                    const variance = isCompleted && promo.actual_payback
                      ? parseFloat(promo.total_promo_cost) - parseFloat(promo.actual_payback)
                      : 0;

                    return (
                      <tr key={promo.id}>
                        <td>
                          <strong>{promo.promo_name}</strong>
                        </td>
                        <td>{promo.retailer_name || 'N/A'}</td>
                        <td>
                          <span className={getStatusBadgeClass(promo.status)}>
                            {promo.status}
                          </span>
                        </td>
                        <td>{promo.promo_start_date ? formatDate(promo.promo_start_date) : 'N/A'}</td>
                        <td>{promo.promo_end_date ? formatDate(promo.promo_end_date) : 'N/A'}</td>
                        <td>{formatCurrency(promo.total_promo_cost)}</td>
                        <td>
                          {isCompleted && promo.actual_payback
                            ? formatCurrency(promo.actual_payback)
                            : '—'}
                        </td>
                        <td>
                          {isCompleted && promo.actual_payback
                            ? formatCurrency(variance)
                            : '—'}
                        </td>
                        <td>
                          {isCompleted && promo.actual_units_sold ? (
                            <div className={styles.sellThroughCell}>
                              <div className={styles.sellThroughText}>
                                {sellThrough.toFixed(1)}%
                              </div>
                              <div className={styles.sellThroughBar}>
                                <div
                                  className={`${styles.sellThroughFill} ${getSellThroughColor(sellThrough)}`}
                                  style={{ width: `${Math.min(sellThrough, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{getMarginQualityBadge(promo)}</td>
                        <td>
                          <div className={styles.actionCell}>
                            <button
                              className={styles.actionButton}
                              onClick={() => toggleActionMenu(promo.id)}
                              aria-label="Open actions menu"
                            >
                              ⋮
                            </button>
                            {actionMenuOpen === promo.id && (
                              <div className={styles.actionMenu}>
                                <button
                                  className={styles.actionMenuItem}
                                  onClick={() => handleEdit(promo.id)}
                                >
                                  ✏️ Edit
                                </button>
                                {promo.status === 'approved' && (
                                  <button
                                    className={styles.actionMenuItem}
                                    onClick={() => handleMarkComplete(promo.id)}
                                  >
                                    ✓ Mark Complete
                                  </button>
                                )}
                                <button
                                  className={`${styles.actionMenuItem} ${styles.actionMenuItemDanger}`}
                                  onClick={() => handleDelete(promo.id)}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Mark Complete Modal */}
      {selectedPromoForComplete && (
        <MarkPromoCompleteModal
          isOpen={completeModalOpen}
          onClose={() => {
            setCompleteModalOpen(false);
            setSelectedPromoForComplete(null);
          }}
          onSubmit={handleCompleteSubmit}
          promoName={selectedPromoForComplete.promo_name}
          projectedPayback={selectedPromoForComplete.total_promo_cost}
          projectedUnits={getTotalUnitsAvailable(selectedPromoForComplete).toString()}
        />
      )}

    </div>
  );
}
