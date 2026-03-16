/**
 * Historical Analytics Page
 *
 * Group E2: Historical Analytics for CPG Module
 *
 * Features:
 * - Seasonal pattern visualization (identify high/low cost periods)
 *
 * Date range options: 3mo, 6mo, 1yr, all-time
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
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
  type SeasonalPattern,
} from '../../services/cpg/historicalAnalytics.service';
import type { CPGCategory } from '../../db/schema/cpg.schema';
import styles from './HistoricalAnalytics.module.css';

type ViewMode = 'seasonal';

interface HistoricalAnalyticsProps {
  initialTab?: 'seasonal';
  hideNavigation?: boolean;
}

export default function HistoricalAnalytics({ initialTab: propInitialTab, hideNavigation = false }: HistoricalAnalyticsProps = {}) {
  const [searchParams] = useSearchParams();
  const { companyId } = useAuth();

  // Get initial tab from URL parameter or props, default to 'seasonal'
  const tabParam = searchParams.get('tab') as ViewMode | null;

  const initialTab = tabParam && ['seasonal'].includes(tabParam)
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

  // Available options
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [variants, setVariants] = useState<string[]>([]);

  // Analytics Data
  const [seasonalPattern, setSeasonalPattern] = useState<SeasonalPattern | null>(null);

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


  if (!companyId) {
    return (
      <div className={styles.container}>
        <p>Please select a company to view analytics</p>
      </div>
    );
  }

  // Helper functions
  const formatCurrency = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const handleDateBlur = (value: string, setter: (value: string) => void) => {
    if (!value) return;

    // Handle partial year input (e.g., "0026-02-18" -> "2026-02-18")
    const parts = value.split('-');
    if (parts.length === 3) {
      let [year, month, day] = parts;

      // Pad year to 4 digits if needed
      while (year.length < 4) {
        year = '0' + year;
      }

      // Normalize to YYYY format if user entered 2-digit year
      if (year.startsWith('00') && year.length === 4) {
        const twoDigitYear = parseInt(year.substring(2), 10);
        const currentYear = new Date().getFullYear();
        const currentCentury = Math.floor(currentYear / 100) * 100;

        // If 2-digit year is within 10 years of current year, assume current century
        // Otherwise, if less than current 2-digit year, assume current century, else previous
        const fullYear = twoDigitYear <= (currentYear % 100) + 10
          ? currentCentury + twoDigitYear
          : currentCentury + twoDigitYear;

        year = fullYear.toString();
      }

      setter(`${year}-${month}-${day}`);
    }
  };

  return (
    <div className={hideNavigation ? styles.containerEmbedded : styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.subtitle}>
            Analyze seasonal cost patterns
          </p>
        </div>
      </div>

      {/* Filters */}
      {!hideNavigation && (
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

    </div>
  );
}
