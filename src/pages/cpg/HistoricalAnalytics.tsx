/**
 * Historical Analytics Page
 *
 * Group E2: Historical Analytics for CPG Module
 *
 * Features:
 * - CPU trend line charts (by category, by variant)
 * - Seasonal pattern visualization (identify high/low cost periods)
 * - Distributor comparison over time (total cost trends)
 * - Promo Tracker (replaces Trade Spend ROI - unified promo management)
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
  type DistributorCostTrend,
} from '../../services/cpg/historicalAnalytics.service';
import type { CPGCategory, CPGDistributor, CPGSalesPromo } from '../../db/schema/cpg.schema';
import { MarkPromoCompleteModal } from '../../components/cpg/modals/MarkPromoCompleteModal';
import styles from './HistoricalAnalytics.module.css';

type ViewMode = 'cpu-trend' | 'seasonal' | 'distributor' | 'promo-tracker';
type PromoStatus = 'all' | 'draft' | 'approved' | 'declined' | 'active' | 'completed';
type MarginQuality = 'all' | 'poor' | 'good' | 'better' | 'best';

export default function HistoricalAnalytics() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companyId } = useAuth();
  const currentCompany = companyId || 'cpg-demo';

  // Get initial tab from URL parameter, default to 'cpu-trend'
  const tabParam = searchParams.get('tab') as ViewMode | null;
  const initialTab = tabParam && ['cpu-trend', 'seasonal', 'distributor', 'promo-tracker'].includes(tabParam)
    ? tabParam
    : 'cpu-trend';

  const [viewMode, setViewMode] = useState<ViewMode>(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<DateRangePreset>('1yr');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVariant, setSelectedVariant] = useState<string>('all');
  const [selectedDistributor, setSelectedDistributor] = useState<string>('all');

  // Promo Tracker Filters
  const [statusFilter, setStatusFilter] = useState<PromoStatus>('all');
  const [retailerFilter, setRetailerFilter] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState<string>('');
  const [marginQualityFilter, setMarginQualityFilter] = useState<MarginQuality>('all');
  const [promoDateRangeFilter, setPromoDateRangeFilter] = useState<string>('all');

  // Available options
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [variants, setVariants] = useState<string[]>([]);
  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);

  // Analytics Data
  const [cpuTrend, setCpuTrend] = useState<CPUTrendAnalysis | null>(null);
  const [seasonalPattern, setSeasonalPattern] = useState<SeasonalPattern | null>(null);
  const [distributorTrend, setDistributorTrend] = useState<DistributorCostTrend | null>(null);

  // Promo Tracker Data
  const [promos, setPromos] = useState<CPGSalesPromo[]>([]);
  const [retailers, setRetailers] = useState<string[]>([]);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedPromoForComplete, setSelectedPromoForComplete] = useState<CPGSalesPromo | null>(null);

  const service = createHistoricalAnalyticsService(db);

  useEffect(() => {
    loadFilterOptions();
  }, [currentCompany]);

  useEffect(() => {
    if (currentCompany) {
      loadData();
    }
  }, [currentCompany, viewMode, dateRange, selectedCategory, selectedVariant, selectedDistributor]);

  const loadFilterOptions = async () => {
    if (!currentCompany) return;

    try {
      // Load categories
      const cats = await db.cpgCategories
        .where('company_id')
        .equals(currentCompany)
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

      // Load distributors
      const dists = await db.cpgDistributors
        .where('company_id')
        .equals(currentCompany)
        .and((dist) => dist.active && !dist.deleted_at)
        .toArray();

      setDistributors(dists);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  const loadData = async () => {
    if (!currentCompany) return;

    setIsLoading(true);
    setError(null);

    try {
      switch (viewMode) {
        case 'cpu-trend':
          await loadCPUTrend();
          break;
        case 'seasonal':
          await loadSeasonalPattern();
          break;
        case 'distributor':
          await loadDistributorTrend();
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

  const loadCPUTrend = async () => {
    if (!currentCompany) return;

    const variant = selectedVariant === 'all' ? null : selectedVariant;
    const categoryId = selectedCategory !== 'all' ? selectedCategory : undefined;

    const trend = await service.getCPUTrend(currentCompany, variant, categoryId, dateRange);
    setCpuTrend(trend);
  };

  const loadSeasonalPattern = async () => {
    if (!currentCompany) return;

    const variant = selectedVariant === 'all' ? null : selectedVariant;
    const categoryId = selectedCategory !== 'all' ? selectedCategory : undefined;

    const pattern = await service.detectSeasonalPatterns(
      currentCompany,
      variant,
      categoryId,
      2 // minimum 2 years of data
    );
    setSeasonalPattern(pattern);
  };

  const loadDistributorTrend = async () => {
    if (!currentCompany) return;

    if (selectedDistributor === 'all') {
      setDistributorTrend(null);
      return;
    }

    const trend = await service.getDistributorCostTrend(
      currentCompany,
      selectedDistributor,
      dateRange
    );
    setDistributorTrend(trend);
  };

  const loadPromos = async () => {
    if (!currentCompany) return;

    try {
      // Load all promos for this company
      const allPromos = await db.cpgSalesPromos
        .where('company_id')
        .equals(currentCompany)
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
        return 'poor';
      case 'decline':
        return 'poor';
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
      poor: { text: 'Poor', className: styles.marginPoor },
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

  const getTrendDirectionIcon = (direction: 'increasing' | 'decreasing' | 'stable'): string => {
    switch (direction) {
      case 'increasing':
        return '↑';
      case 'decreasing':
        return '↓';
      case 'stable':
        return '→';
    }
  };

  const getTrendDirectionClass = (direction: 'increasing' | 'decreasing' | 'stable'): string => {
    switch (direction) {
      case 'increasing':
        return styles.trendIncreasing || '';
      case 'decreasing':
        return styles.trendDecreasing || '';
      case 'stable':
        return styles.trendStable || '';
      default:
        return styles.trendStable || '';
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

  if (!currentCompany) {
    return (
      <div className={styles.container}>
        <p>Please select a company to view analytics</p>
      </div>
    );
  }

  const filteredPromos = viewMode === 'promo-tracker' ? getFilteredPromos() : [];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.subtitle}>
            Analyze cost trends, seasonal patterns, distributor costs, and promotional campaigns
          </p>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={viewMode === 'cpu-trend'}
          onClick={() => setViewMode('cpu-trend')}
          className={viewMode === 'cpu-trend' ? styles.tabActive : styles.tab}
        >
          CPU Trends
        </button>
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
          aria-selected={viewMode === 'distributor'}
          onClick={() => setViewMode('distributor')}
          className={viewMode === 'distributor' ? styles.tabActive : styles.tab}
        >
          Distributor Costs
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
                <option value="1yr">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
          )}

          {/* Category Filter */}
          {(viewMode === 'cpu-trend' || viewMode === 'seasonal') && (
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
          {(viewMode === 'cpu-trend' || viewMode === 'seasonal') && (
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

          {/* Distributor Filter */}
          {viewMode === 'distributor' && (
            <div className={styles.filterGroup}>
              <label htmlFor="distributor" className={styles.filterLabel}>
                Distributor
              </label>
              <select
                id="distributor"
                value={selectedDistributor}
                onChange={(e) => setSelectedDistributor(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">Select Distributor...</option>
                {distributors.map((dist) => (
                  <option key={dist.id} value={dist.id}>
                    {dist.name}
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

      {/* CPU Trend View */}
      {viewMode === 'cpu-trend' && !isLoading && cpuTrend && (
        <div className={styles.content}>
          {/* Statistics Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Average CPU</div>
              <div className={styles.statValue}>{formatCurrency(cpuTrend.statistics.average_cpu)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Min CPU</div>
              <div className={styles.statValue}>{formatCurrency(cpuTrend.statistics.min_cpu)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Max CPU</div>
              <div className={styles.statValue}>{formatCurrency(cpuTrend.statistics.max_cpu)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Trend</div>
              <div
                className={`${styles.statValue} ${getTrendDirectionClass(cpuTrend.statistics.trend_direction)}`}
              >
                {getTrendDirectionIcon(cpuTrend.statistics.trend_direction)}{' '}
                {cpuTrend.statistics.change_percentage}%
              </div>
            </div>
          </div>

          {/* Rolling Averages */}
          {(cpuTrend.statistics.rolling_average_3mo || cpuTrend.statistics.rolling_average_6mo) && (
            <div className={styles.rollingAverages}>
              {cpuTrend.statistics.rolling_average_3mo && (
                <div className={styles.rollingAvg}>
                  <span className={styles.rollingLabel}>3-Month Average:</span>
                  <span className={styles.rollingValue}>
                    {formatCurrency(cpuTrend.statistics.rolling_average_3mo)}
                  </span>
                </div>
              )}
              {cpuTrend.statistics.rolling_average_6mo && (
                <div className={styles.rollingAvg}>
                  <span className={styles.rollingLabel}>6-Month Average:</span>
                  <span className={styles.rollingValue}>
                    {formatCurrency(cpuTrend.statistics.rolling_average_6mo)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* CPU Trend Chart */}
          {cpuTrend.data_points.length > 0 ? (
            <div className={styles.chartContainer}>
              <h2 className={styles.chartTitle}>
                CPU Trend {selectedVariant !== 'all' ? `- ${selectedVariant}` : ''}
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={cpuTrend.data_points.map((point) => ({
                    date: formatDate(point.date),
                    cpu: parseFloat(point.cpu),
                    fullDate: point.date,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                  <YAxis
                    label={{ value: 'Cost Per Unit ($)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value)) as any}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="CPU"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={styles.noData}>
              No CPU data available for the selected filters. Try adjusting your date range or
              variant selection.
            </div>
          )}
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

      {/* Distributor Cost Trend View */}
      {viewMode === 'distributor' && !isLoading && (
        <div className={styles.content}>
          {selectedDistributor === 'all' ? (
            <div className={styles.noData}>Please select a distributor to view cost trends</div>
          ) : distributorTrend ? (
            <>
              {/* Statistics Cards */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Avg Total Cost</div>
                  <div className={styles.statValue}>
                    {formatCurrency(distributorTrend.statistics.average_total_cost)}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Avg Cost Per Unit</div>
                  <div className={styles.statValue}>
                    {formatCurrency(distributorTrend.statistics.average_cost_per_unit)}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Cost Range</div>
                  <div className={styles.statValue}>
                    {formatCurrency(distributorTrend.statistics.min_cost)} -{' '}
                    {formatCurrency(distributorTrend.statistics.max_cost)}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Trend</div>
                  <div
                    className={`${styles.statValue} ${getTrendDirectionClass(distributorTrend.statistics.trend_direction)}`}
                  >
                    {getTrendDirectionIcon(distributorTrend.statistics.trend_direction)}{' '}
                    {distributorTrend.statistics.change_percentage}%
                  </div>
                </div>
              </div>

              {/* Distributor Cost Chart */}
              {distributorTrend.data_points.length > 0 ? (
                <div className={styles.chartContainer}>
                  <h2 className={styles.chartTitle}>
                    Distribution Cost Trend - {distributorTrend.distributor_name}
                  </h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={distributorTrend.data_points.map((point) => ({
                        date: formatDate(point.date),
                        total: parseFloat(point.total_distribution_cost),
                        perUnit: parseFloat(point.distribution_cost_per_unit),
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                      <YAxis
                        yAxisId="left"
                        label={{ value: 'Total Cost ($)', angle: -90, position: 'insideLeft' }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        label={{
                          value: 'Cost Per Unit ($)',
                          angle: 90,
                          position: 'insideRight',
                        }}
                      />
                      <Tooltip formatter={(value) => formatCurrency(Number(value)) as any} />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="total"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Total Cost"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="perUnit"
                        stroke="#82ca9d"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Cost Per Unit"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className={styles.noData}>
                  No distribution cost calculations found for this distributor in the selected date
                  range.
                </div>
              )}
            </>
          ) : null}
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
