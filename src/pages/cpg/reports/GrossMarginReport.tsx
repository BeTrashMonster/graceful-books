/**
 * Gross Margin by Product Report
 *
 * Shows detailed gross margin analysis for each product/variant:
 * - Product | Variant | Revenue | CPU | Gross Margin % | Margin Quality
 * - Sort by margin % (highest/lowest)
 * - Filter by category, variant, margin quality
 * - Color-coded margin quality indicators
 * - Export to CSV
 *
 * Per Group D3: CPG-Specific Reporting
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { ReportExportButton } from '../../../components/cpg/reports/ReportExportButton';
import { getGrossMarginByProduct } from '../../../services/cpg/cpgReporting.service';
import type { GrossMarginData, MarginQuality } from '../../../services/cpg/cpgReporting.service';
import { db } from '../../../db';
import styles from './GrossMarginReport.module.css';

type SortField = 'categoryName' | 'cpu' | 'grossMarginPercentage';
type SortOrder = 'asc' | 'desc';

export const GrossMarginReport = () => {
  const { currentCompany } = useAuth();
  const [marginData, setMarginData] = useState<GrossMarginData[]>([]);
  const [filteredData, setFilteredData] = useState<GrossMarginData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVariant, setSelectedVariant] = useState<string>('all');
  const [selectedMarginQuality, setSelectedMarginQuality] = useState<MarginQuality | 'all'>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('grossMarginPercentage');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Available filter options
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [variants, setVariants] = useState<string[]>([]);

  useEffect(() => {
    loadReport();
    loadFilterOptions();
  }, [currentCompany]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [marginData, selectedCategory, selectedVariant, selectedMarginQuality, sortField, sortOrder]);

  const loadReport = async () => {
    if (!currentCompany) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getGrossMarginByProduct(currentCompany.id);
      setMarginData(data);
    } catch (err) {
      console.error('Failed to load gross margin report:', err);
      setError('Failed to load report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFilterOptions = async () => {
    if (!currentCompany) return;

    try {
      // Load categories
      const cats = await db.cpgCategories
        .where('company_id')
        .equals(currentCompany.id)
        .and((cat) => cat.active && !cat.deleted_at)
        .toArray();

      setCategories(cats.map((c) => ({ id: c.id, name: c.name })));

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

  const applyFiltersAndSort = () => {
    let filtered = [...marginData];

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((item) => item.categoryId === selectedCategory);
    }

    // Apply variant filter
    if (selectedVariant !== 'all') {
      filtered = filtered.filter((item) => item.variant === selectedVariant);
    }

    // Apply margin quality filter
    if (selectedMarginQuality !== 'all') {
      filtered = filtered.filter((item) => item.marginQuality === selectedMarginQuality);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'categoryName':
          comparison = a.categoryName.localeCompare(b.categoryName);
          break;
        case 'cpu':
          comparison = a.cpu - b.cpu;
          break;
        case 'grossMarginPercentage':
          comparison = a.grossMarginPercentage - b.grossMarginPercentage;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredData(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getMarginQualityClass = (quality: MarginQuality): string => {
    switch (quality) {
      case 'best':
        return styles.marginBest || '';
      case 'better':
        return styles.marginBetter || '';
      case 'good':
        return styles.marginGood || '';
      case 'poor':
        return styles.marginPoor || '';
      default:
        return styles.marginGood || '';
    }
  };

  const getMarginQualityLabel = (quality: MarginQuality): string => {
    switch (quality) {
      case 'best':
        return 'Best (70%+)';
      case 'better':
        return 'Better (60-70%)';
      case 'good':
        return 'Good (50-60%)';
      case 'poor':
        return 'Poor (<50%)';
      default:
        return 'Good (50-60%)';
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  // Prepare data for CSV export
  const exportData = filteredData.map((item) => ({
    Product: item.categoryName,
    Variant: item.variant || 'N/A',
    Revenue: item.revenue,
    CPU: item.cpu,
    'Gross Margin': item.grossMargin,
    'Gross Margin %': item.grossMarginPercentage,
    'Margin Quality': getMarginQualityLabel(item.marginQuality),
  }));

  if (!currentCompany) {
    return <div className={styles.container}>Please select a company</div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gross Margin by Product</h1>
          <p className={styles.subtitle}>Detailed margin analysis for each product and variant</p>
        </div>
        <ReportExportButton
          reportData={exportData}
          reportType="gross-margin-by-product"
          filename={`gross-margin-${new Date().toISOString().split('T')[0]}.csv`}
        />
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="category-filter" className={styles.filterLabel}>
            Category
          </label>
          <select
            id="category-filter"
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

        <div className={styles.filterGroup}>
          <label htmlFor="variant-filter" className={styles.filterLabel}>
            Variant
          </label>
          <select
            id="variant-filter"
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

        <div className={styles.filterGroup}>
          <label htmlFor="margin-filter" className={styles.filterLabel}>
            Margin Quality
          </label>
          <select
            id="margin-filter"
            value={selectedMarginQuality}
            onChange={(e) => setSelectedMarginQuality(e.target.value as MarginQuality | 'all')}
            className={styles.filterSelect}
          >
            <option value="all">All Margins</option>
            <option value="best">Best (70%+)</option>
            <option value="better">Better (60-70%)</option>
            <option value="good">Good (50-60%)</option>
            <option value="poor">Poor (&lt;50%)</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {!isLoading && !error && (
        <div className={styles.summaryCards}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Total Products</div>
            <div className={styles.cardValue}>{filteredData.length}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Average Margin</div>
            <div className={styles.cardValue}>
              {filteredData.length > 0
                ? formatPercentage(
                    filteredData.reduce((sum, item) => sum + item.grossMarginPercentage, 0) /
                      filteredData.length
                  )
                : 'N/A'}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Best Margin</div>
            <div className={styles.cardValue}>
              {filteredData.length > 0
                ? formatPercentage(Math.max(...filteredData.map((item) => item.grossMarginPercentage)))
                : 'N/A'}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Lowest Margin</div>
            <div className={styles.cardValue}>
              {filteredData.length > 0
                ? formatPercentage(Math.min(...filteredData.map((item) => item.grossMarginPercentage)))
                : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading report...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button onClick={loadReport} className={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {/* Report Table */}
      {!isLoading && !error && (
        <div className={styles.tableContainer}>
          {filteredData.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No margin data available. Start by entering invoices with cost attribution.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th
                    onClick={() => handleSort('categoryName')}
                    className={`${styles.sortable} ${sortField === 'categoryName' ? styles.sorted : ''}`}
                  >
                    Product
                    {sortField === 'categoryName' && (
                      <span className={styles.sortIcon}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th>Variant</th>
                  <th className={styles.rightAlign}>Revenue</th>
                  <th
                    onClick={() => handleSort('cpu')}
                    className={`${styles.sortable} ${styles.rightAlign} ${sortField === 'cpu' ? styles.sorted : ''}`}
                  >
                    CPU
                    {sortField === 'cpu' && (
                      <span className={styles.sortIcon}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className={styles.rightAlign}>Gross Margin</th>
                  <th
                    onClick={() => handleSort('grossMarginPercentage')}
                    className={`${styles.sortable} ${styles.rightAlign} ${sortField === 'grossMarginPercentage' ? styles.sorted : ''}`}
                  >
                    Margin %
                    {sortField === 'grossMarginPercentage' && (
                      <span className={styles.sortIcon}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th>Quality</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, index) => (
                  <tr key={`${item.categoryId}-${item.variant}-${index}`}>
                    <td className={styles.productName}>{item.categoryName}</td>
                    <td>{item.variant || 'N/A'}</td>
                    <td className={styles.rightAlign}>{formatCurrency(item.revenue)}</td>
                    <td className={styles.rightAlign}>{formatCurrency(item.cpu)}</td>
                    <td className={styles.rightAlign}>{formatCurrency(item.grossMargin)}</td>
                    <td className={styles.rightAlign}>
                      <span className={getMarginQualityClass(item.marginQuality)}>
                        {formatPercentage(item.grossMarginPercentage)}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${getMarginQualityClass(item.marginQuality)}`}>
                        {item.marginQuality.charAt(0).toUpperCase() + item.marginQuality.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
