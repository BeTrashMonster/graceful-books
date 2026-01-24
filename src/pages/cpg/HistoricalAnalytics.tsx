/**
 * Historical Analytics Page
 *
 * Group E2: Historical Analytics for CPG Module
 *
 * Features:
 * - CPU trend line charts (by category, by variant)
 * - Seasonal pattern visualization (identify high/low cost periods)
 * - Distributor comparison over time (total cost trends)
 * - Trade spend ROI dashboard (participation vs. margins)
 *
 * Date range options: 3mo, 6mo, 1yr, all-time
 */

import { useState, useEffect } from 'react';
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
  type TradeSpendROISummary,
} from '../../services/cpg/historicalAnalytics.service';
import type { CPGCategory, CPGDistributor } from '../../db/schema/cpg.schema';
import styles from './HistoricalAnalytics.module.css';

type ViewMode = 'cpu-trend' | 'seasonal' | 'distributor' | 'trade-spend';

export const HistoricalAnalytics = () => {
  const { currentCompany } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('cpu-trend');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<DateRangePreset>('1yr');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVariant, setSelectedVariant] = useState<string>('all');
  const [selectedDistributor, setSelectedDistributor] = useState<string>('all');

  // Available options
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [variants, setVariants] = useState<string[]>([]);
  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);

  // Data
  const [cpuTrend, setCpuTrend] = useState<CPUTrendAnalysis | null>(null);
  const [seasonalPattern, setSeasonalPattern] = useState<SeasonalPattern | null>(null);
  const [distributorTrend, setDistributorTrend] = useState<DistributorCostTrend | null>(null);
  const [tradeSpendROI, setTradeSpendROI] = useState<TradeSpendROISummary | null>(null);

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
        .equals(currentCompany.id)
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
        .equals(currentCompany.id)
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
        case 'trade-spend':
          await loadTradeSpendROI();
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

    const trend = await service.getCPUTrend(currentCompany.id, variant, categoryId, dateRange);
    setCpuTrend(trend);
  };

  const loadSeasonalPattern = async () => {
    if (!currentCompany) return;

    const variant = selectedVariant === 'all' ? null : selectedVariant;
    const categoryId = selectedCategory !== 'all' ? selectedCategory : undefined;

    const pattern = await service.detectSeasonalPatterns(
      currentCompany.id,
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
      currentCompany.id,
      selectedDistributor,
      dateRange
    );
    setDistributorTrend(trend);
  };

  const loadTradeSpendROI = async () => {
    if (!currentCompany) return;

    const roi = await service.analyzeTradeSpendROI(currentCompany.id, dateRange);
    setTradeSpendROI(roi);
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

  if (!currentCompany) {
    return (
      <div className={styles.container}>
        <p>Please select a company to view analytics</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Historical Analytics</h1>
          <p className={styles.subtitle}>
            Analyze cost trends, seasonal patterns, and trade spend ROI over time
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
          aria-selected={viewMode === 'trade-spend'}
          onClick={() => setViewMode('trade-spend')}
          className={viewMode === 'trade-spend' ? styles.tabActive : styles.tab}
        >
          Trade Spend ROI
        </button>
      </div>

      {/* Filters */}
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

      {/* Trade Spend ROI View */}
      {viewMode === 'trade-spend' && !isLoading && tradeSpendROI && (
        <div className={styles.content}>
          {/* Summary Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Promos</div>
              <div className={styles.statValue}>{tradeSpendROI.total_promos_analyzed}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Promo Cost</div>
              <div className={styles.statValue}>{formatCurrency(tradeSpendROI.total_promo_cost)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Participated</div>
              <div className={styles.statValue}>{tradeSpendROI.participated_count}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Avg Margin Impact</div>
              <div
                className={`${styles.statValue} ${parseFloat(tradeSpendROI.average_margin_impact) < 0 ? styles.trendDecreasing : styles.trendIncreasing}`}
              >
                {tradeSpendROI.average_margin_impact}%
              </div>
            </div>
          </div>

          {/* Promos Table */}
          {tradeSpendROI.promos.length > 0 ? (
            <div className={styles.tableContainer}>
              <h2 className={styles.tableTitle}>Trade Spend Summary</h2>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Promo Name</th>
                    <th>Retailer</th>
                    <th>Status</th>
                    <th>Promo Cost</th>
                    <th>Margin w/ Promo</th>
                    <th>Margin w/o Promo</th>
                    <th>Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeSpendROI.promos.map((promo) => (
                    <tr key={promo.promo_id}>
                      <td>{promo.promo_name}</td>
                      <td>{promo.retailer_name || 'N/A'}</td>
                      <td>
                        <span className={styles[`status${promo.participation_status}`]}>
                          {promo.participation_status}
                        </span>
                      </td>
                      <td>{formatCurrency(promo.total_promo_cost)}</td>
                      <td>{formatPercentage(promo.average_margin_with_promo)}</td>
                      <td>{formatPercentage(promo.average_margin_without_promo)}</td>
                      <td
                        className={
                          parseFloat(promo.margin_impact) < 0
                            ? styles.impactNegative
                            : styles.impactPositive
                        }
                      >
                        {promo.margin_impact}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.noData}>No trade spend promos found for the selected date range.</div>
          )}
        </div>
      )}
    </div>
  );
};
