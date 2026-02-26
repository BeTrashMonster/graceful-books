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
  ComposedChart,
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
import { Modal } from '../../components/modals/Modal';
import { Button } from '../../components/core/Button';
import styles from './HistoricalAnalytics.module.css';

type ViewMode = 'cpu-trend' | 'seasonal' | 'distributor' | 'promo-tracker';
type CPUSubTab = 'overview' | 'invoice-history' | 'finished-product' | 'comparison';
type PromoStatus = 'all' | 'draft' | 'approved' | 'declined' | 'active' | 'completed';
type MarginQuality = 'all' | 'gutCheck' | 'good' | 'better' | 'best';

interface HistoricalAnalyticsProps {
  initialTab?: 'cpu-trend' | 'seasonal' | 'distributor-cost' | 'promo-tracker';
  hideNavigation?: boolean;
}

export default function HistoricalAnalytics({ initialTab: propInitialTab, hideNavigation = false }: HistoricalAnalyticsProps = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companyId } = useAuth();

  // Get initial tab from URL parameter or props, default to 'cpu-trend'
  const tabParam = searchParams.get('tab') as ViewMode | null;

  // Map 'distributor-cost' to 'distributor'
  const mappedPropTab = propInitialTab === 'distributor-cost' ? 'distributor' : propInitialTab;

  const initialTab = tabParam && ['cpu-trend', 'seasonal', 'distributor', 'promo-tracker'].includes(tabParam)
    ? tabParam
    : (mappedPropTab || 'cpu-trend');

  // Get initial distributor from URL parameter
  const distributorParam = searchParams.get('distributor');

  const [viewMode, setViewMode] = useState<ViewMode>(initialTab);
  const [cpuSubTab, setCpuSubTab] = useState<CPUSubTab>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<DateRangePreset>('12mo');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVariant, setSelectedVariant] = useState<string>('all');
  const [selectedDistributor, setSelectedDistributor] = useState<string>(distributorParam || 'all');
  const [compareDistributor, setCompareDistributor] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [comparisonChartView, setComparisonChartView] = useState<'trend' | 'bars'>('trend');
  const [includeDrafts, setIncludeDrafts] = useState<boolean>(false);

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
  const [compareDistributorTrend, setCompareDistributorTrend] = useState<DistributorCostTrend | null>(null);
  const [fullCalculations, setFullCalculations] = useState<any[]>([]);
  const [vendorInvoices, setVendorInvoices] = useState<any[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<any[]>([]);
  const [finishedProductTrends, setFinishedProductTrends] = useState<any[]>([]);
  const [selectedFinishedProduct, setSelectedFinishedProduct] = useState<string>('all');
  const [componentComparisons, setComponentComparisons] = useState<any[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<Set<string>>(new Set());
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['date', 'invoiceNumber', 'products', 'pallets', 'unitsPerPallet', 'totalUnits', 'totalCost', 'costPerUnit', 'actions']);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showTableExportMenu, setShowTableExportMenu] = useState(false);


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
  }, [companyId, viewMode, dateRange, selectedCategory, selectedVariant, selectedDistributor, compareDistributor, customStartDate, customEndDate, includeDrafts]);

  useEffect(() => {
    if (companyId && viewMode === 'cpu-trend' && cpuSubTab === 'invoice-history') {
      loadVendorInvoices();
    }
  }, [companyId, viewMode, cpuSubTab, dateRange, selectedCategory, selectedVariant]);

  useEffect(() => {
    if (companyId && viewMode === 'cpu-trend' && cpuSubTab === 'finished-product') {
      loadFinishedProductTrends();
    }
  }, [companyId, viewMode, cpuSubTab, dateRange, includeDrafts, selectedFinishedProduct]);

  useEffect(() => {
    if (companyId && viewMode === 'cpu-trend' && cpuSubTab === 'comparison') {
      loadComponentComparisons();
    }
  }, [companyId, viewMode, cpuSubTab, dateRange, categories]);

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

      // Load distributors
      const dists = await db.cpgDistributors
        .where('company_id')
        .equals(companyId)
        .and((dist) => dist.active && !dist.deleted_at)
        .toArray();

      setDistributors(dists);
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
    if (!companyId) return;

    const variant = selectedVariant === 'all' ? null : selectedVariant;
    const categoryId = selectedCategory !== 'all' ? selectedCategory : undefined;

    const trend = await service.getCPUTrend(companyId, variant, categoryId, dateRange);
    setCpuTrend(trend);
  };

  const loadVendorInvoices = async () => {
    if (!companyId) return;

    try {
      // Calculate date range
      const { startDate, endDate } = service['calculateDateRange'](dateRange);

      // Load invoices in date range
      let invoices = await db.cpgInvoices
        .where('company_id')
        .equals(companyId)
        .and((inv) => inv.invoice_date >= startDate && inv.invoice_date <= endDate)
        .and((inv) => inv.deleted_at === null && inv.active)
        .reverse()
        .sortBy('invoice_date');

      // Filter by category if specified
      if (selectedCategory !== 'all') {
        invoices = invoices.filter((inv) =>
          Object.values(inv.cost_attribution).some((attr) => attr.category_id === selectedCategory)
        );
      }

      // Filter by variant if specified and extract relevant data
      const variantKey = selectedVariant === 'all' ? null : selectedVariant;

      if (variantKey) {
        invoices = invoices.filter((inv) => {
          return inv.calculated_cpus && inv.calculated_cpus[variantKey];
        });
      }

      // Transform invoices into display format
      const transformedInvoices = invoices.map((inv) => {
        // Get the CPU for the selected variant (or first available if 'all')
        let cpu = 'N/A';
        let variant = 'N/A';

        if (inv.calculated_cpus) {
          if (variantKey && inv.calculated_cpus[variantKey]) {
            cpu = inv.calculated_cpus[variantKey];
            variant = variantKey;
          } else if (variantKey === null) {
            // Show all CPUs for this invoice
            const cpuEntries = Object.entries(inv.calculated_cpus);
            if (cpuEntries.length > 0) {
              cpu = cpuEntries[0][1] as string;
              variant = cpuEntries[0][0];
            }
          }
        }

        // Get category info from cost_attribution
        const attributions = Object.values(inv.cost_attribution);
        const firstAttr = attributions[0];

        return {
          id: inv.id,
          invoice_date: inv.invoice_date,
          invoice_number: inv.invoice_number,
          vendor_name: inv.vendor_name,
          category_id: firstAttr?.category_id || 'N/A',
          variant,
          cpu,
          units_purchased: firstAttr?.units_purchased || 'N/A',
          unit_price: firstAttr?.unit_price || 'N/A',
          total_cost: inv.total_cost,
          additional_costs: inv.additional_costs ? Object.values(inv.additional_costs).reduce((sum, val) => sum + parseFloat(val as string), 0) : 0,
          cost_attribution: inv.cost_attribution,
          calculated_cpus: inv.calculated_cpus,
        };
      });

      setVendorInvoices(transformedInvoices);
    } catch (err) {
      console.error('Failed to load vendor invoices:', err);
      setError('Failed to load vendor invoice history. Please try again.');
    }
  };

  const loadFinishedProductTrends = async () => {
    if (!companyId) return;

    try {
      // Calculate date range
      const { startDate, endDate } = service['calculateDateRange'](dateRange);

      // Load finished products
      const products = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .and((p) => p.active && !p.deleted_at)
        .toArray();

      setFinishedProducts(products);

      // Load distribution calculations in date range
      let calculations = await db.cpgDistributionCalculations
        .where('company_id')
        .equals(companyId)
        .and((calc) => calc.calculation_date >= startDate && calc.calculation_date <= endDate)
        .and((calc) => calc.active && calc.deleted_at === null)
        .sortBy('calculation_date');

      // Include or exclude drafts based on toggle
      if (!includeDrafts) {
        calculations = calculations.filter(calc => !calc.is_draft);
      }

      // Load distributors for display
      const dists = await db.cpgDistributors
        .where('company_id')
        .equals(companyId)
        .and((dist) => dist.active && !dist.deleted_at)
        .toArray();

      // Transform calculations into trend data grouped by product
      const productTrendMap = new Map<string, any[]>();

      calculations.forEach((calc) => {
        if (!calc.variant_data || !calc.variant_results) return;

        // Extract product data from this calculation
        Object.entries(calc.variant_data).forEach(([productName, varData]: [string, any]) => {
          const result = calc.variant_results?.[productName];
          if (!result) return;

          const baseCPU = parseFloat(varData.base_cpu);
          const distCPU = parseFloat(calc.distribution_cost_per_unit);
          const totalCPU = parseFloat(result.total_cpu);
          const margin = parseFloat(result.net_profit_margin);

          const dataPoint = {
            date: calc.calculation_date,
            calculation_id: calc.id,
            calculation_name: calc.calculation_name,
            distributor_id: calc.distributor_id,
            distributor_name: dists.find(d => d.id === calc.distributor_id)?.name || 'Unknown',
            product_name: productName,
            base_cpu: baseCPU,
            distribution_cpu: distCPU,
            total_cpu: totalCPU,
            selling_price: parseFloat(varData.price_per_unit),
            margin_percent: margin,
            margin_quality: result.margin_quality,
            units: varData.quantity || 0,
            is_draft: calc.is_draft,
          };

          if (!productTrendMap.has(productName)) {
            productTrendMap.set(productName, []);
          }
          productTrendMap.get(productName)!.push(dataPoint);
        });
      });

      // Calculate statistics for each product
      const trends = Array.from(productTrendMap.entries()).map(([productName, dataPoints]) => {
        // Sort by date
        dataPoints.sort((a, b) => a.date - b.date);

        const totalCPUs = dataPoints.map(d => d.total_cpu);
        const baseCPUs = dataPoints.map(d => d.base_cpu);
        const distCPUs = dataPoints.map(d => d.distribution_cpu);

        const avgTotalCPU = totalCPUs.reduce((sum, val) => sum + val, 0) / totalCPUs.length;
        const avgBaseCPU = baseCPUs.reduce((sum, val) => sum + val, 0) / baseCPUs.length;
        const avgDistCPU = distCPUs.reduce((sum, val) => sum + val, 0) / distCPUs.length;

        const minTotalCPU = Math.min(...totalCPUs);
        const maxTotalCPU = Math.max(...totalCPUs);

        // Calculate trend direction
        const firstCPU = dataPoints[0].total_cpu;
        const lastCPU = dataPoints[dataPoints.length - 1].total_cpu;
        const changePercent = ((lastCPU - firstCPU) / firstCPU) * 100;

        let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (Math.abs(changePercent) > 5) {
          trendDirection = changePercent > 0 ? 'increasing' : 'decreasing';
        }

        // Get distributors used
        const distributorsUsed = new Set(dataPoints.map(d => d.distributor_name));

        return {
          product_name: productName,
          data_points: dataPoints,
          statistics: {
            avg_total_cpu: avgTotalCPU.toFixed(2),
            avg_base_cpu: avgBaseCPU.toFixed(2),
            avg_distribution_cpu: avgDistCPU.toFixed(2),
            min_total_cpu: minTotalCPU.toFixed(2),
            max_total_cpu: maxTotalCPU.toFixed(2),
            trend_direction: trendDirection,
            change_percentage: changePercent.toFixed(1),
            total_calculations: dataPoints.length,
            distributors_used: Array.from(distributorsUsed),
          },
        };
      });

      setFinishedProductTrends(trends);
    } catch (err) {
      console.error('Failed to load finished product trends:', err);
      setError('Failed to load finished product CPU trends. Please try again.');
    }
  };

  const loadComponentComparisons = async () => {
    if (!companyId) return;

    try {
      // Calculate date range
      const { startDate, endDate } = service['calculateDateRange'](dateRange);

      // Load all invoices in date range
      const invoices = await db.cpgInvoices
        .where('company_id')
        .equals(companyId)
        .and((inv) => inv.invoice_date >= startDate && inv.invoice_date <= endDate)
        .and((inv) => inv.deleted_at === null && inv.active)
        .toArray();

      // Build comparison data for each category+variant
      const componentMap = new Map<string, any>();

      invoices.forEach((invoice) => {
        if (!invoice.calculated_cpus) return;

        Object.entries(invoice.calculated_cpus).forEach(([key, cpu]) => {
          const cpuValue = parseFloat(cpu as string);

          if (!componentMap.has(key)) {
            // Find category info
            const attribution = Object.values(invoice.cost_attribution).find(
              (attr) => {
                const variantKey = attr.variant ? `${attr.category_id}_${attr.variant}` : attr.category_id;
                return variantKey === key;
              }
            );

            componentMap.set(key, {
              key,
              category_id: attribution?.category_id || '',
              variant: attribution?.variant || null,
              cpus: [],
              invoices: [],
            });
          }

          componentMap.get(key)!.cpus.push(cpuValue);
          componentMap.get(key)!.invoices.push({
            date: invoice.invoice_date,
            invoice_number: invoice.invoice_number,
            vendor_name: invoice.vendor_name,
            cpu: cpuValue,
          });
        });
      });

      // Calculate statistics for each component
      const comparisons = Array.from(componentMap.values()).map((comp) => {
        const cpus = comp.cpus;
        const avgCPU = cpus.reduce((sum: number, val: number) => sum + val, 0) / cpus.length;
        const minCPU = Math.min(...cpus);
        const maxCPU = Math.max(...cpus);

        // Calculate volatility (standard deviation)
        const variance = cpus.reduce((sum: number, val: number) => sum + Math.pow(val - avgCPU, 2), 0) / cpus.length;
        const stdDev = Math.sqrt(variance);
        const volatility = (stdDev / avgCPU) * 100; // CV (Coefficient of Variation)

        // Calculate trend
        const sortedInvoices = comp.invoices.sort((a: any, b: any) => a.date - b.date);
        const firstCPU = sortedInvoices[0]?.cpu || avgCPU;
        const lastCPU = sortedInvoices[sortedInvoices.length - 1]?.cpu || avgCPU;
        const changePercent = ((lastCPU - firstCPU) / firstCPU) * 100;

        let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (Math.abs(changePercent) > 5) {
          trendDirection = changePercent > 0 ? 'increasing' : 'decreasing';
        }

        // Get category name
        const category = categories.find(c => c.id === comp.category_id);

        return {
          key: comp.key,
          category_id: comp.category_id,
          category_name: category?.name || comp.category_id,
          variant: comp.variant,
          display_name: comp.variant ? `${category?.name || comp.category_id} (${comp.variant})` : (category?.name || comp.category_id),
          statistics: {
            avg_cpu: avgCPU.toFixed(2),
            min_cpu: minCPU.toFixed(2),
            max_cpu: maxCPU.toFixed(2),
            volatility_percent: volatility.toFixed(1),
            trend_direction: trendDirection,
            change_percentage: changePercent.toFixed(1),
            total_invoices: cpus.length,
            price_range: maxCPU - minCPU,
          },
          invoices: sortedInvoices,
        };
      });

      // Sort by category name then variant
      comparisons.sort((a, b) => {
        if (a.category_name !== b.category_name) {
          return a.category_name.localeCompare(b.category_name);
        }
        const varA = a.variant || '';
        const varB = b.variant || '';
        return varA.localeCompare(varB);
      });

      setComponentComparisons(comparisons);
    } catch (err) {
      console.error('Failed to load component comparisons:', err);
      setError('Failed to load component comparison data. Please try again.');
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

  const loadDistributorTrend = async () => {
    if (!companyId) return;

    if (selectedDistributor === 'all') {
      setDistributorTrend(null);
      setCompareDistributorTrend(null);
      return;
    }

    console.log('Loading distributor trend for:', {
      companyId,
      selectedDistributor,
      dateRange,
    });

    // Get date range (custom or preset)
    let range: DateRangePreset | { start: number; end: number } = dateRange;
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      // Parse date strings as local time (date inputs use YYYY-MM-DD format)
      const [startYear, startMonth, startDay] = customStartDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = customEndDate.split('-').map(Number);

      const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
      const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

      range = {
        start: startDate.getTime(),
        end: endDate.getTime(),
      };

      console.log('Custom date range:', {
        customStartDate,
        customEndDate,
        startTimestamp: startDate.getTime(),
        endTimestamp: endDate.getTime(),
        startDateReadable: startDate.toLocaleString(),
        endDateReadable: endDate.toLocaleString(),
      });
    }

    const trend = await service.getDistributorCostTrend(
      companyId,
      selectedDistributor,
      range,
      includeDrafts
    );

    console.log('Distributor trend loaded:', trend);
    setDistributorTrend(trend);

    // Also fetch full calculation details for the table
    if (trend.data_points.length > 0) {
      const calcIds = trend.data_points.map(p => p.calculation_id).filter(Boolean);
      const fullCalcs = await Promise.all(
        calcIds.map(id => db.cpgDistributionCalculations.get(id))
      );
      setFullCalculations(fullCalcs.filter(Boolean));
    } else {
      setFullCalculations([]);
    }

    // Load comparison distributor if comparison mode is active
    if (showComparison && compareDistributor && compareDistributor !== 'none') {
      console.log('Loading comparison distributor trend for:', compareDistributor);
      const compareTrend = await service.getDistributorCostTrend(
        companyId,
        compareDistributor,
        range,
        includeDrafts
      );
      console.log('Comparison trend loaded:', compareTrend);
      setCompareDistributorTrend(compareTrend);
    } else {
      setCompareDistributorTrend(null);
    }
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

  const allColumns = [
    { id: 'date', label: 'Date' },
    { id: 'invoiceNumber', label: 'Invoice #' },
    { id: 'products', label: 'Products' },
    { id: 'pallets', label: 'Pallets' },
    { id: 'unitsPerPallet', label: 'Units/Pallet' },
    { id: 'totalUnits', label: 'Total Units' },
    { id: 'totalCost', label: 'Total Cost' },
    { id: 'costPerUnit', label: 'Cost Per Unit' },
    { id: 'actions', label: 'Actions' },
  ];

  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  const exportSummaryToCSV = (trend: DistributorCostTrend, fullCalcs: any[]) => {
    // Create CSV content
    const headers = ['Date', 'Invoice #', 'Products', 'Pallets', 'Units/Pallet', 'Total Units', 'Total Cost', 'Cost Per Unit'];
    const rows = trend.data_points.map(point => {
      const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);
      const fullCalc = fullCalcs.find(c => c?.id === point.calculation_id);
      const products = fullCalc?.variant_data ? Object.keys(fullCalc.variant_data).join(', ') : '';
      // Get invoice number from fullCalc (which has all the data)
      const invoiceNumber = fullCalc?.invoice_number || '';

      return [
        formatDate(point.date),
        invoiceNumber,
        products,
        point.num_pallets,
        point.units_per_pallet,
        totalUnits.toString(),
        point.total_distribution_cost,
        point.distribution_cost_per_unit,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `distributor-costs-${trend.distributor_name}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDetailedToCSV = (trend: DistributorCostTrend, fullCalcs: any[]) => {
    const rows: string[] = [];

    // Export header
    rows.push(`DETAILED DISTRIBUTION COST REPORT - ${trend.distributor_name}`);
    rows.push(`Date Range: ${formatDate(trend.start_date)} to ${formatDate(trend.end_date)}`);
    rows.push(`Total Calculations: ${fullCalcs.length}`);
    rows.push('');

    fullCalcs.forEach((calc, index) => {
      if (!calc) return;

      const point = trend.data_points.find(p => p.calculation_id === calc.id);
      if (!point) return;

      const calcNumber = index + 1;
      const totalUnits = parseFloat(calc.num_pallets) * parseFloat(calc.units_per_pallet);
      const numPallets = parseFloat(calc.num_pallets);
      const products = Object.keys(calc.variant_data || {});
      const palletWord = numPallets === 1 ? 'Pallet' : 'Pallets';

      // Visual separator for calculation
      rows.push('');
      rows.push('################################################################################');
      rows.push(`###  INVOICE ${calc.invoice_number || 'N/A'} - SHIPMENT: ${formatDate(point.date).toUpperCase()} - ${numPallets} ${palletWord}  ###`);
      rows.push('################################################################################');

      // Basic shipment info
      rows.push('');
      rows.push('SHIPMENT SUMMARY');
      rows.push(`Pallets,${calc.num_pallets}`);
      rows.push(`Units per Pallet,${calc.units_per_pallet}`);
      rows.push(`Total Units,${totalUnits}`);

      // Fee breakdown - show Qty, unit Amount, and Total
      if (calc.fee_breakdown && calc.fee_breakdown.length > 0) {
        rows.push('');
        rows.push('FEES');
        rows.push('Description,Qty,Amount,Total');

        let feesTotal = 0;
        // Need to match fee_breakdown with selected_fees to get quantity info
        calc.fee_breakdown.forEach((fee: any) => {
          const feeAmount = parseFloat(fee.feeAmount);
          feesTotal += feeAmount;

          // Find matching selected_fee to get unit amount and quantity
          const selectedFee = calc.selected_fees?.find((sf: any) => sf.feeId === fee.feeId);
          let qty = '1';
          let unitAmount = fee.feeAmount;

          if (selectedFee) {
            if (selectedFee.unit === 'per_pallet') {
              qty = selectedFee.quantity || calc.num_pallets;
              unitAmount = selectedFee.amount;
            } else if (selectedFee.unit.includes('per_day')) {
              qty = selectedFee.quantity || '1';
              unitAmount = selectedFee.amount;
            } else if (selectedFee.unit === 'percentage') {
              qty = selectedFee.quantity || selectedFee.amount;
              unitAmount = selectedFee.amount;
            } else {
              qty = selectedFee.quantity || '1';
              unitAmount = selectedFee.amount;
            }
          }

          rows.push(`"${selectedFee?.description || fee.feeName}",${qty},$${parseFloat(unitAmount).toFixed(2)},$${feeAmount.toFixed(2)}`);
        });

        rows.push(',,,TOTAL: $' + feesTotal.toFixed(2));
      }

      // Pallet Breakdown (if pallet_data exists - accurate structure)
      if (calc.pallet_data && calc.pallet_data.length > 0) {
        rows.push('');
        rows.push('PALLET BREAKDOWN');
        rows.push('');

        calc.pallet_data.forEach((pallet: any) => {
          rows.push(`Pallet ${pallet.pallet_number} (${pallet.units_per_pallet} units total)`);
          pallet.products.forEach((product: any) => {
            rows.push(`  ${product.product_name},${product.quantity} units,$${parseFloat(product.price_per_unit).toFixed(2)}/unit`);
          });
          rows.push('');
        });
      }

      // Cost Summary
      rows.push('');
      rows.push('COST SUMMARY');
      rows.push(`Total Distribution Cost,$${parseFloat(calc.total_distribution_cost).toFixed(2)}`);
      rows.push(`Distribution Cost Per Unit,$${parseFloat(calc.distribution_cost_per_unit).toFixed(2)}`);

      if (calc.invoice_total_amount) {
        rows.push(`Invoice Total,$${parseFloat(calc.invoice_total_amount).toFixed(2)}`);
      }

      if (calc.payment_status && calc.payment_status !== 'unpaid') {
        rows.push(`Payment Status,${calc.payment_status.replace('_', ' ').toUpperCase()}`);
        if (calc.amount_paid) {
          rows.push(`Amount Paid,$${parseFloat(calc.amount_paid).toFixed(2)}`);
        }
      }

      // Product breakdown
      if (calc.variant_data && Object.keys(calc.variant_data).length > 0) {
        rows.push('');
        rows.push('PRODUCT DETAILS');

        // Create pallet lookup if pallet_data exists
        const palletLookup: Record<string, { pallet_number: number, quantity: number }> = {};

        if (calc.pallet_data && calc.pallet_data.length > 0) {
          calc.pallet_data.forEach((pallet: any) => {
            pallet.products.forEach((product: any) => {
              palletLookup[product.product_name] = {
                pallet_number: pallet.pallet_number,
                quantity: product.quantity  // Quantity of THIS product, not total units on pallet
              };
            });
          });
        }

        rows.push('Product,Pallet #,Units,Base CPU,Dist Cost/Unit,Total CPU,Price,Margin %,MSRP');

        products.forEach((variant) => {
          const varData = calc.variant_data[variant];
          const result = calc.variant_results?.[variant];
          if (!result) return;

          const msrp = result.msrp || 'N/A';
          const palletInfo = palletLookup[variant];
          const palletNum = palletInfo ? palletInfo.pallet_number : 'N/A';
          const productUnits = palletInfo ? palletInfo.quantity : 'N/A';

          rows.push(`${variant},${palletNum},${productUnits},$${varData.base_cpu},$${calc.distribution_cost_per_unit},$${result.total_cpu},$${varData.price_per_unit},${result.net_profit_margin}%,${msrp}`);
        });
      }

      // Notes
      if (calc.notes) {
        rows.push('');
        rows.push('NOTES');
        rows.push(`"${calc.notes}"`);
      }

      rows.push('');
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `distributor-costs-DETAILED-${trend.distributor_name}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSummaryToPDF = async (trend: DistributorCostTrend, fullCalcs: any[]) => {
    // Dynamic import to keep bundle size down
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    // Title
    doc.setFontSize(16);
    doc.text(`Distribution Cost Analysis - ${trend.distributor_name}`, 14, 20);

    doc.setFontSize(10);
    doc.text(`Date Range: ${formatDate(trend.start_date)} - ${formatDate(trend.end_date)}`, 14, 28);

    // Statistics
    doc.setFontSize(12);
    doc.text('Summary Statistics', 14, 38);
    doc.setFontSize(10);
    doc.text(`Average Total Cost: ${formatCurrency(trend.statistics.average_total_cost)}`, 14, 45);
    doc.text(`Average Cost Per Unit: ${formatCurrency(trend.statistics.average_cost_per_unit)}`, 14, 52);
    doc.text(`Cost Range: ${formatCurrency(trend.statistics.min_cost)} - ${formatCurrency(trend.statistics.max_cost)}`, 14, 59);

    // Table
    let y = 70;
    doc.setFontSize(12);
    doc.text('Calculation History', 14, y);
    y += 7;

    doc.setFontSize(7);
    // Table headers
    doc.text('Date', 14, y);
    doc.text('Invoice #', 35, y);
    doc.text('Products', 60, y);
    doc.text('Pallets', 95, y);
    doc.text('Units/Pallet', 115, y);
    doc.text('Total Units', 143, y);
    doc.text('Total Cost', 168, y);
    doc.text('Cost/Unit', 188, y);
    y += 5;

    // Table rows
    trend.data_points.forEach((point, index) => {
      const fullCalc = fullCalcs.find(c => c?.id === point.calculation_id);
      const products = fullCalc?.variant_data ? Object.keys(fullCalc.variant_data).join(', ') : '';
      // Get invoice number from fullCalc (which has all the data)
      const invoiceNumber = fullCalc?.invoice_number || '';
      const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);

      // Wrap product text to fit
      const wrappedProducts = doc.splitTextToSize(products, 30); // 30mm width for products column
      const rowHeight = Math.max(7, wrappedProducts.length * 3.5); // Adjust row height based on wrapped lines

      // Check if we need a new page
      if (y + rowHeight > 270) {
        doc.addPage();
        y = 20;
      }

      // Draw all cells at the same y position
      doc.text(formatDate(point.date), 14, y);
      doc.text(invoiceNumber.substring(0, 10), 35, y);
      // Draw wrapped product text
      wrappedProducts.forEach((line: string, lineIndex: number) => {
        doc.text(line, 60, y + (lineIndex * 3.5));
      });
      doc.text(point.num_pallets, 95, y);
      doc.text(point.units_per_pallet, 115, y);
      doc.text(totalUnits.toString(), 143, y);
      doc.text(formatCurrency(point.total_distribution_cost), 168, y);
      doc.text(formatCurrency(point.distribution_cost_per_unit), 188, y);

      y += rowHeight;
    });

    // Add timestamp footer - RIGHT ALIGNED
    const pageCount = doc.getNumberOfPages();
    const generatedTimestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const footerText = `Report generated: ${generatedTimestamp}`;
    const pageWidth = 210; // A4 portrait width in mm

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      const textWidth = doc.getTextWidth(footerText);
      doc.text(footerText, pageWidth - textWidth - 14, 285);
      doc.setTextColor(0, 0, 0);
    }

    // Download
    doc.save(`distributor-costs-SUMMARY-${trend.distributor_name}-${Date.now()}.pdf`);
  };

  const exportDetailedToPDF = async (trend: DistributorCostTrend, fullCalcs: any[]) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    // Title page
    doc.setFontSize(18);
    doc.text(`Detailed Distribution Cost Report`, 14, 20);
    doc.setFontSize(14);
    doc.text(`${trend.distributor_name}`, 14, 30);

    doc.setFontSize(10);
    doc.text(`Date Range: ${formatDate(trend.start_date)} - ${formatDate(trend.end_date)}`, 14, 38);
    doc.text(`Total Calculations: ${fullCalcs.length}`, 14, 44);

    let y = 55;

    fullCalcs.forEach((calc, index) => {
      if (!calc) return;

      const point = trend.data_points.find(p => p.calculation_id === calc.id);
      if (!point) return;

      const calcNumber = index + 1;
      const totalUnits = parseFloat(calc.num_pallets) * parseFloat(calc.units_per_pallet);
      const numPallets = parseFloat(calc.num_pallets);
      const palletWord = numPallets === 1 ? 'Pallet' : 'Pallets';
      const products = Object.keys(calc.variant_data || {});

      // New page for each calculation
      if (index > 0) {
        doc.addPage();
        y = 20;
      }

      // Calculation header with visual separator (purple color)
      doc.setFontSize(14);
      doc.setFillColor(128, 90, 213); // Purple color
      doc.rect(10, y - 5, 190, 15, 'F');
      doc.setTextColor(255, 255, 255);
      const invoiceNum = calc.invoice_number || 'N/A';
      doc.text(`INVOICE ${invoiceNum} - SHIPMENT: ${formatDate(point.date).toUpperCase()} - ${numPallets} ${palletWord}`, 14, y + 3);
      doc.setTextColor(0, 0, 0);
      y += 15;

      // Shipment summary
      doc.setFontSize(12);
      doc.text('Shipment Summary', 14, y);
      y += 7;

      doc.setFontSize(9);
      doc.text(`Invoice Number: ${calc.invoice_number || 'N/A'}`, 20, y);
      y += 5;
      doc.text(`Pallets: ${calc.num_pallets}`, 20, y);
      y += 5;
      doc.text(`Units per Pallet: ${calc.units_per_pallet}`, 20, y);
      y += 5;
      doc.text(`Total Units: ${totalUnits}`, 20, y);
      y += 5;
      const productsList = products.join(', ');
      const wrappedProducts = doc.splitTextToSize(`Products: ${productsList}`, 170);
      wrappedProducts.forEach((line: string) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 4;
      });
      y += 3;

      // Fee breakdown - show Qty, unit Amount, and Total
      if (calc.fee_breakdown && calc.fee_breakdown.length > 0) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(12);
        doc.text('Fees', 14, y);
        y += 7;

        doc.setFontSize(9);
        // Table header
        doc.text('Description', 20, y);
        doc.text('Qty', 120, y);
        doc.text('Amount', 145, y);
        doc.text('Total', 175, y);
        y += 5;

        let feesTotal = 0;
        calc.fee_breakdown.forEach((fee: any) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }

          const feeAmount = parseFloat(fee.feeAmount);
          feesTotal += feeAmount;

          // Find matching selected_fee to get unit amount and quantity
          const selectedFee = calc.selected_fees?.find((sf: any) => sf.feeId === fee.feeId);
          let qty = '1';
          let unitAmount = fee.feeAmount;

          if (selectedFee) {
            if (selectedFee.unit === 'per_pallet') {
              qty = selectedFee.quantity || calc.num_pallets;
              unitAmount = selectedFee.amount;
            } else if (selectedFee.unit.includes('per_day')) {
              qty = selectedFee.quantity || '1';
              unitAmount = selectedFee.amount;
            } else if (selectedFee.unit === 'percentage') {
              qty = selectedFee.quantity || selectedFee.amount;
              unitAmount = selectedFee.amount;
            } else {
              qty = selectedFee.quantity || '1';
              unitAmount = selectedFee.amount;
            }
          }

          const desc = (selectedFee?.description || fee.feeName).length > 60
            ? (selectedFee?.description || fee.feeName).substring(0, 57) + '...'
            : (selectedFee?.description || fee.feeName);
          doc.text(desc, 20, y);
          doc.text(qty.toString(), 120, y);
          doc.text(`$${parseFloat(unitAmount).toFixed(2)}`, 145, y);
          doc.text(`$${feeAmount.toFixed(2)}`, 175, y);
          y += 5;
        });

        // Total row
        y += 2;
        doc.setFontSize(10);
        doc.text('TOTAL', 145, y, { align: 'right' });
        doc.text(`$${feesTotal.toFixed(2)}`, 175, y);
        y += 10;
      }

      // Pallet Breakdown (if pallet_data exists - accurate structure)
      if (calc.pallet_data && calc.pallet_data.length > 0) {
        if (y > 200) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(12);
        doc.text('Pallet Breakdown', 14, y);
        y += 7;

        doc.setFontSize(9);
        calc.pallet_data.forEach((pallet: any) => {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }

          doc.setFontSize(10);
          doc.text(`Pallet ${pallet.pallet_number} (${pallet.units_per_pallet} units):`, 20, y);
          y += 5;

          doc.setFontSize(9);
          pallet.products.forEach((product: any) => {
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
            doc.text(`  ${product.product_name}: ${product.quantity} units @ $${parseFloat(product.price_per_unit).toFixed(2)}`, 25, y);
            y += 4;
          });
          y += 3;
        });
        y += 5;
      }

      // Cost Summary
      if (y > 220) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(12);
      doc.text('Cost Summary', 14, y);
      y += 7;

      doc.setFontSize(9);
      doc.text(`Total Distribution Cost: ${formatCurrency(calc.total_distribution_cost)}`, 20, y);
      y += 5;
      doc.text(`Distribution Cost Per Unit: ${formatCurrency(calc.distribution_cost_per_unit)}`, 20, y);
      y += 5;

      if (calc.invoice_total_amount) {
        doc.text(`Invoice Total: ${formatCurrency(calc.invoice_total_amount)}`, 20, y);
        y += 5;
      }

      if (calc.payment_status && calc.payment_status !== 'unpaid') {
        doc.text(`Payment Status: ${calc.payment_status.replace('_', ' ').toUpperCase()}`, 20, y);
        y += 5;
        if (calc.amount_paid) {
          doc.text(`Amount Paid: ${formatCurrency(calc.amount_paid)}`, 20, y);
          y += 5;
        }
      }
      y += 5;

      // Product breakdown
      if (calc.variant_data && Object.keys(calc.variant_data).length > 0) {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(12);
        doc.text('Product/Variant Breakdown', 14, y);
        y += 7;

        Object.entries(calc.variant_data).forEach(([variant, varData]: [string, any]) => {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }

          const result = calc.variant_results?.[variant];
          if (!result) return;

          const baseCPU = parseFloat(varData.base_cpu);
          const distCostPerUnit = parseFloat(calc.distribution_cost_per_unit);
          const totalCPU = parseFloat(result.total_cpu);
          const price = parseFloat(varData.price_per_unit);
          const profitPerUnit = price - totalCPU;

          doc.setFontSize(10);
          doc.text(`${variant}:`, 20, y);
          y += 6;

          doc.setFontSize(8);
          doc.text(`Base CPU: $${baseCPU.toFixed(2)}`, 25, y);
          y += 4;
          doc.text(`+ Distribution Cost Per Unit: $${distCostPerUnit.toFixed(2)}`, 25, y);
          y += 4;
          doc.text(`= Total CPU: $${totalCPU.toFixed(2)}`, 25, y);
          y += 4;
          doc.text(`Selling Price: $${price.toFixed(2)}`, 25, y);
          y += 4;
          doc.text(`Profit: $${profitPerUnit.toFixed(2)} (${result.net_profit_margin}%)`, 25, y);
          y += 4;
          if (result.msrp) {
            doc.text(`MSRP: ${formatCurrency(result.msrp)}`, 25, y);
            y += 4;
          }
          y += 4;
        });
      }

      // Notes
      if (calc.notes) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.text('Notes', 14, y);
        y += 7;
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(calc.notes, 180);
        doc.text(lines, 20, y);
      }
    });

    // Add timestamp footer - RIGHT ALIGNED
    const pageCount = doc.getNumberOfPages();
    const generatedTimestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const footerText = `Report generated: ${generatedTimestamp}`;
    const pageWidth = 210; // A4 portrait width in mm

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      const textWidth = doc.getTextWidth(footerText);
      doc.text(footerText, pageWidth - textWidth - 14, 285);
      doc.setTextColor(0, 0, 0);
    }

    // Download
    doc.save(`distributor-costs-DETAILED-${trend.distributor_name}-${Date.now()}.pdf`);
  };


  const exportDataTableCSV = (trend: DistributorCostTrend, fullCalcs: any[]) => {
    // Create a flat table format perfect for pivot tables
    const rows: string[] = [];

    // Headers
    const headers = [
      'Date',
      'Invoice Number',
      'Distributor',
      'Pallets',
      'Pallet #',
      'Product Units',
      'Product',
      'Base CPU',
      'Distribution Cost Per Unit',
      'Total CPU',
      'Selling Price',
      'Profit Per Unit',
      'Margin %',
      'MSRP',
      'Fee Description',
      'Fee Amount',
      'Total Distribution Cost'
    ];
    rows.push(headers.join(','));

    // Data rows - one row per product per calculation
    fullCalcs.forEach((calc, index) => {
      if (!calc) return;

      const point = trend.data_points.find(p => p.calculation_id === calc.id);
      if (!point) return;

      const calcNumber = index + 1;

      // Build product lookup from pallet_data for accurate quantities
      const productLookup: Record<string, { pallet_number: number, quantity: number }> = {};
      if (calc.pallet_data && calc.pallet_data.length > 0) {
        calc.pallet_data.forEach((pallet: any) => {
          pallet.products.forEach((product: any) => {
            productLookup[product.product_name] = {
              pallet_number: pallet.pallet_number,
              quantity: product.quantity
            };
          });
        });
      }

      // Get all products
      const products = Object.keys(calc.variant_data || {});

      products.forEach((variant) => {
        const varData = calc.variant_data[variant];
        const result = calc.variant_results?.[variant];
        if (!result) return;

        // Get product-specific data
        const productInfo = productLookup[variant];
        const palletNum = productInfo ? productInfo.pallet_number : 'N/A';
        const productUnits = productInfo ? productInfo.quantity : (varData.quantity || 'N/A');

        const baseCPU = parseFloat(varData.base_cpu);
        const distCostPerUnit = parseFloat(calc.distribution_cost_per_unit);
        const totalCPU = parseFloat(result.total_cpu);
        const price = parseFloat(varData.price_per_unit);
        const profitPerUnit = price - totalCPU;

        // Create a row for each fee (or one row if no fees)
        // Use calculated fee_breakdown instead of selected_fees
        if (calc.fee_breakdown && calc.fee_breakdown.length > 0) {
          calc.fee_breakdown.forEach((fee: any) => {
            rows.push([
              `"${formatDate(point.date)}"`,
              calc.invoice_number || 'N/A',
              trend.distributor_name,
              calc.num_pallets,
              palletNum,
              productUnits,
              `"${variant}"`,
              baseCPU.toFixed(2),
              distCostPerUnit.toFixed(2),
              totalCPU.toFixed(2),
              price.toFixed(2),
              profitPerUnit.toFixed(2),
              result.net_profit_margin,
              result.msrp || '',
              `"${fee.feeName}"`,
              parseFloat(fee.feeAmount).toFixed(2),
              calc.total_distribution_cost
            ].join(','));
          });
        } else {
          // No fees, just product row
          rows.push([
            `"${formatDate(point.date)}"`,
            calc.invoice_number || 'N/A',
            trend.distributor_name,
            calc.num_pallets,
            palletNum,
            productUnits,
            `"${variant}"`,
            baseCPU.toFixed(2),
            distCostPerUnit.toFixed(2),
            totalCPU.toFixed(2),
            price.toFixed(2),
            profitPerUnit.toFixed(2),
            result.net_profit_margin,
            result.msrp || '',
            '',
            '',
            calc.total_distribution_cost
          ].join(','));
        }
      });
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `distributor-data-table-${trend.distributor_name}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportChartToPDF = async (trend: DistributorCostTrend, compareTrend: DistributorCostTrend | null) => {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    // Find the chart (just the recharts wrapper, not the whole container)
    const chartElement = document.querySelector('.recharts-wrapper') as HTMLElement;
    if (!chartElement) {
      alert('Chart not found. Please try again.');
      return;
    }

    // Capture the chart as image with high quality
    const canvas = await html2canvas(chartElement, {
      backgroundColor: '#ffffff',
      scale: 2,
    });

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

    // Title
    doc.setFontSize(16);
    const title = compareTrend
      ? `Distribution Cost Comparison: ${trend.distributor_name} vs ${compareTrend.distributor_name}`
      : `Distribution Cost Trend - ${trend.distributor_name}`;
    doc.text(title, 14, 20);

    doc.setFontSize(10);
    doc.text(`Date Range: ${formatDate(trend.start_date)} - ${formatDate(trend.end_date)}`, 14, 28);

    // Add chart image
    const imgWidth = 270;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    doc.addImage(imgData, 'PNG', 10, 35, imgWidth, imgHeight);

    // Add statistics - side by side if comparing
    let y = 35 + imgHeight + 10;

    if (compareTrend) {
      // Side-by-side layout for comparison
      const leftX = 14;
      const rightX = 150; // Right column starts at midpoint

      // Left column - Primary distributor
      doc.setFontSize(12);
      doc.text(`${trend.distributor_name} Statistics:`, leftX, y);
      let leftY = y + 7;
      doc.setFontSize(10);
      doc.text(`Average Total Cost: ${formatCurrency(trend.statistics.average_total_cost)}`, leftX + 6, leftY);
      leftY += 6;
      doc.text(`Average Cost Per Unit: ${formatCurrency(trend.statistics.average_cost_per_unit)}`, leftX + 6, leftY);
      leftY += 6;
      doc.text(`Trend: ${trend.statistics.trend_direction} (${trend.statistics.change_percentage}%)`, leftX + 6, leftY);

      // Right column - Comparison distributor
      doc.setFontSize(12);
      doc.text(`${compareTrend.distributor_name} Statistics:`, rightX, y);
      let rightY = y + 7;
      doc.setFontSize(10);
      doc.text(`Average Total Cost: ${formatCurrency(compareTrend.statistics.average_total_cost)}`, rightX + 6, rightY);
      rightY += 6;
      doc.text(`Average Cost Per Unit: ${formatCurrency(compareTrend.statistics.average_cost_per_unit)}`, rightX + 6, rightY);
      rightY += 6;
      doc.text(`Trend: ${compareTrend.statistics.trend_direction} (${compareTrend.statistics.change_percentage}%)`, rightX + 6, rightY);
    } else {
      // Single column layout for single distributor
      doc.setFontSize(12);
      doc.text(`${trend.distributor_name} Statistics:`, 14, y);
      y += 7;
      doc.setFontSize(10);
      doc.text(`Average Total Cost: ${formatCurrency(trend.statistics.average_total_cost)}`, 20, y);
      y += 6;
      doc.text(`Average Cost Per Unit: ${formatCurrency(trend.statistics.average_cost_per_unit)}`, 20, y);
      y += 6;
      doc.text(`Trend: ${trend.statistics.trend_direction} (${trend.statistics.change_percentage}%)`, 20, y);
    }

    // Add timestamp footer - RIGHT ALIGNED
    const generatedTimestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const pageWidth = 297; // A4 landscape width in mm
    const pageHeight = 210; // A4 landscape height in mm
    const footerText = `Report generated: ${generatedTimestamp}`;

    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);

    // Get text width to right align
    const textWidth = doc.getTextWidth(footerText);
    doc.text(footerText, pageWidth - textWidth - 14, pageHeight - 5);

    doc.setTextColor(0, 0, 0);

    doc.save(`distributor-chart-${trend.distributor_name}-${Date.now()}.pdf`);
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
      {!hideNavigation && (
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
            <>
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
                  {distributors
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((dist) => (
                      <option key={dist.id} value={dist.id}>
                        {dist.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Comparison Toggle */}
              {selectedDistributor !== 'all' && (
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel} style={{ visibility: 'hidden' }}>
                    Spacer
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label className={styles.comparisonCheckbox}>
                      <input
                        type="checkbox"
                        checked={showComparison}
                        onChange={(e) => {
                          setShowComparison(e.target.checked);
                          if (!e.target.checked) {
                            setCompareDistributor(null);
                          }
                        }}
                      />
                      <span>Compare with another distributor</span>
                    </label>
                    <label className={styles.comparisonCheckbox}>
                      <input
                        type="checkbox"
                        checked={includeDrafts}
                        onChange={(e) => setIncludeDrafts(e.target.checked)}
                      />
                      <span>Include draft scenarios</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Compare Distributor Dropdown */}
              {showComparison && selectedDistributor !== 'all' && (
                <div className={styles.filterGroup}>
                  <label htmlFor="compare-distributor" className={styles.filterLabel}>
                    Compare To
                  </label>
                  <select
                    id="compare-distributor"
                    value={compareDistributor || 'none'}
                    onChange={(e) => setCompareDistributor(e.target.value === 'none' ? null : e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="none">Select Distributor...</option>
                    {distributors
                      .filter((dist) => dist.id !== selectedDistributor)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((dist) => (
                        <option key={dist.id} value={dist.id}>
                          {dist.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </>
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
      {viewMode === 'cpu-trend' && !isLoading && (
        <div className={styles.content}>
          {/* CPU Sub-Tab Navigation */}
          <div className={styles.subTabs} role="tablist">
            <button
              role="tab"
              aria-selected={cpuSubTab === 'overview'}
              onClick={() => setCpuSubTab('overview')}
              className={cpuSubTab === 'overview' ? styles.subTabActive : styles.subTab}
            >
              Raw Material CPU Overview
            </button>
            <button
              role="tab"
              aria-selected={cpuSubTab === 'invoice-history'}
              onClick={() => setCpuSubTab('invoice-history')}
              className={cpuSubTab === 'invoice-history' ? styles.subTabActive : styles.subTab}
            >
              Vendor Invoice History
            </button>
            <button
              role="tab"
              aria-selected={cpuSubTab === 'finished-product'}
              onClick={() => setCpuSubTab('finished-product')}
              className={cpuSubTab === 'finished-product' ? styles.subTabActive : styles.subTab}
            >
              Finished Product Total CPU
            </button>
            <button
              role="tab"
              aria-selected={cpuSubTab === 'comparison'}
              onClick={() => setCpuSubTab('comparison')}
              className={cpuSubTab === 'comparison' ? styles.subTabActive : styles.subTab}
            >
              Component Comparison
            </button>
          </div>

          {/* Raw Material CPU Overview Tab */}
          {cpuSubTab === 'overview' && cpuTrend && (
            <>
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
            </>
          )}

          {/* Vendor Invoice History Tab */}
          {cpuSubTab === 'invoice-history' && (
            <div className={styles.tabContent}>
              <div className={styles.infoBox}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Vendor Invoice History</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  These vendor invoices comprise the CPU calculations for your selected filters. This shows transparency into which invoices are feeding the trend data.
                </p>
              </div>

              {vendorInvoices.length > 0 ? (
                <>
                  {/* Summary Stats */}
                  <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Total Invoices</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>{vendorInvoices.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Date Range</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>
                        {formatDate(Math.min(...vendorInvoices.map(i => i.invoice_date)))} - {formatDate(Math.max(...vendorInvoices.map(i => i.invoice_date)))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Average CPU</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>
                        {formatCurrency(
                          (vendorInvoices
                            .filter(i => i.cpu !== 'N/A')
                            .reduce((sum, i) => sum + parseFloat(i.cpu), 0) / vendorInvoices.filter(i => i.cpu !== 'N/A').length).toFixed(2)
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Invoice Table */}
                  <div className={styles.tableContainer}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 className={styles.tableTitle}>Vendor Invoice Details</h3>
                      <button
                        onClick={() => {/* TODO: Export function */}}
                        className={styles.exportButton}
                        title="Export invoice history to CSV"
                      >
                        📊 Export to CSV
                      </button>
                    </div>

                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Invoice #</th>
                          <th>Vendor</th>
                          <th>Category</th>
                          <th>Variant</th>
                          <th>Units</th>
                          <th>Unit Price</th>
                          <th>CPU</th>
                          <th>Additional Costs</th>
                          <th>Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorInvoices.map((invoice) => (
                          <tr key={invoice.id}>
                            <td>{formatDate(invoice.invoice_date)}</td>
                            <td>{invoice.invoice_number || 'N/A'}</td>
                            <td>{invoice.vendor_name || 'N/A'}</td>
                            <td>
                              {invoice.category_id !== 'N/A'
                                ? categories.find(c => c.id === invoice.category_id)?.name || invoice.category_id
                                : 'Multiple'}
                            </td>
                            <td>{invoice.variant || '-'}</td>
                            <td>{invoice.units_purchased}</td>
                            <td>{invoice.unit_price !== 'N/A' ? formatCurrency(invoice.unit_price) : 'N/A'}</td>
                            <td style={{ fontWeight: 600, color: '#3b82f6' }}>
                              {invoice.cpu !== 'N/A' ? formatCurrency(invoice.cpu) : 'N/A'}
                            </td>
                            <td>{formatCurrency(invoice.additional_costs.toFixed(2))}</td>
                            <td>{formatCurrency(invoice.total_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className={styles.noData}>
                  No vendor invoices found for the selected filters and date range. Try adjusting your filters or date range.
                </div>
              )}
            </div>
          )}

          {/* Finished Product Total CPU Tab */}
          {cpuSubTab === 'finished-product' && (
            <div className={styles.tabContent}>
              <div className={styles.infoBox}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Finished Product Total CPU</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  Analyze how raw material costs (Base CPU) and distribution costs combine to create your finished product Total CPU. This aggregates data from multiple distribution calculations and distributors.
                </p>
              </div>

              {/* Include Drafts Toggle */}
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="include-drafts-finished"
                  checked={includeDrafts}
                  onChange={(e) => setIncludeDrafts(e.target.checked)}
                  style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                />
                <label htmlFor="include-drafts-finished" style={{ fontSize: '0.875rem', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                  Include draft scenarios in analysis
                </label>
              </div>

              {/* Product Selector */}
              {finishedProducts.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="product-filter" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                    Filter by Product
                  </label>
                  <select
                    id="product-filter"
                    value={selectedFinishedProduct}
                    onChange={(e) => setSelectedFinishedProduct(e.target.value)}
                    className={styles.filterSelect}
                    style={{ maxWidth: '300px' }}
                  >
                    <option value="all">All Products</option>
                    {finishedProducts.map((product) => (
                      <option key={product.id} value={product.name}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {finishedProductTrends.length > 0 ? (
                <>
                  {/* Summary Stats Grid */}
                  <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
                    {finishedProductTrends
                      .filter(trend => selectedFinishedProduct === 'all' || trend.product_name === selectedFinishedProduct)
                      .map((trend) => (
                        <div key={trend.product_name} className={styles.statCard}>
                          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #3b82f6' }}>
                            {trend.product_name}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                              <div className={styles.statLabel}>Avg Total CPU</div>
                              <div className={styles.statValue} style={{ fontSize: '1.25rem' }}>
                                {formatCurrency(trend.statistics.avg_total_cpu)}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                Base: {formatCurrency(trend.statistics.avg_base_cpu)} + Dist: {formatCurrency(trend.statistics.avg_distribution_cpu)}
                              </div>
                            </div>
                            <div>
                              <div className={styles.statLabel}>Trend</div>
                              <div className={`${styles.statValue} ${getTrendDirectionClass(trend.statistics.trend_direction)}`} style={{ fontSize: '1rem' }}>
                                {getTrendDirectionIcon(trend.statistics.trend_direction)} {trend.statistics.change_percentage}%
                              </div>
                            </div>
                            <div>
                              <div className={styles.statLabel}>Calculations</div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1f2937' }}>
                                {trend.statistics.total_calculations}
                              </div>
                            </div>
                            <div>
                              <div className={styles.statLabel}>Distributors Used</div>
                              <div style={{ fontSize: '0.75rem', color: '#374151' }}>
                                {trend.statistics.distributors_used.join(', ')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Detailed Calculation History */}
                  {finishedProductTrends
                    .filter(trend => selectedFinishedProduct === 'all' || trend.product_name === selectedFinishedProduct)
                    .map((trend) => (
                      <div key={trend.product_name} className={styles.tableContainer} style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h3 className={styles.tableTitle}>
                            {trend.product_name} - Calculation History
                          </h3>
                          <button
                            onClick={() => {/* TODO: Export function */}}
                            className={styles.exportButton}
                            title="Export calculation history to CSV"
                          >
                            📊 Export to CSV
                          </button>
                        </div>

                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Calculation</th>
                              <th>Distributor</th>
                              <th>Units</th>
                              <th>Base CPU</th>
                              <th>Dist CPU</th>
                              <th>Total CPU</th>
                              <th>Selling Price</th>
                              <th>Margin %</th>
                              <th>Margin Quality</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trend.data_points.map((point, idx) => (
                              <tr key={`${point.calculation_id}-${idx}`}>
                                <td>{formatDate(point.date)}</td>
                                <td>{point.calculation_name || 'Unnamed'}</td>
                                <td>{point.distributor_name}</td>
                                <td>{point.units}</td>
                                <td>{formatCurrency(point.base_cpu.toFixed(2))}</td>
                                <td>{formatCurrency(point.distribution_cpu.toFixed(2))}</td>
                                <td style={{ fontWeight: 600, color: '#3b82f6' }}>
                                  {formatCurrency(point.total_cpu.toFixed(2))}
                                </td>
                                <td>{formatCurrency(point.selling_price.toFixed(2))}</td>
                                <td style={{
                                  color: point.margin_percent > 0 ? '#059669' : '#dc2626',
                                  fontWeight: 600
                                }}>
                                  {point.margin_percent.toFixed(1)}%
                                </td>
                                <td>
                                  <span className={styles[`margin${point.margin_quality.charAt(0).toUpperCase()}${point.margin_quality.slice(1)}`]}>
                                    {point.margin_quality === 'gutCheck' ? 'Gut Check' :
                                     point.margin_quality.charAt(0).toUpperCase() + point.margin_quality.slice(1)}
                                  </span>
                                </td>
                                <td>
                                  {point.is_draft ? (
                                    <span style={{ padding: '0.25rem 0.5rem', background: '#fef3c7', color: '#92400e', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 500 }}>
                                      Draft
                                    </span>
                                  ) : (
                                    <span style={{ padding: '0.25rem 0.5rem', background: '#dcfce7', color: '#166534', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 500 }}>
                                      Invoice
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                </>
              ) : (
                <div className={styles.noData}>
                  No finished product data found for the selected date range. Make sure you have distribution calculations saved {includeDrafts ? '(including drafts)' : '(invoices only)'}.
                </div>
              )}
            </div>
          )}

          {/* Component Comparison Tab */}
          {cpuSubTab === 'comparison' && (
            <div className={styles.tabContent}>
              <div className={styles.infoBox}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Component Comparison</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  Compare raw materials (categories + variants) side-by-side to identify cost trends, volatility, and procurement opportunities. Select 2-6 components to compare.
                </p>
              </div>

              {componentComparisons.length > 0 ? (
                <>
                  {/* Action Toolbar */}
                  {selectedComponents.size > 0 && (
                    <div style={{ padding: '1rem', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e40af' }}>
                        {selectedComponents.size} component{selectedComponents.size !== 1 ? 's' : ''} selected
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {selectedComponents.size >= 2 && selectedComponents.size <= 6 && (
                          <button
                            onClick={() => setShowComparisonModal(true)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: 500,
                            }}
                          >
                            Compare Side-by-Side
                          </button>
                        )}
                        {selectedComponents.size > 6 && (
                          <div style={{ padding: '0.5rem 1rem', background: '#fef3c7', color: '#92400e', borderRadius: '6px', fontSize: '0.875rem' }}>
                            ⚠️ Maximum 6 components for comparison
                          </div>
                        )}
                        <button
                          onClick={() => setSelectedComponents(new Set())}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'white',
                            color: '#6b7280',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Component Selection Table */}
                  <div className={styles.tableContainer}>
                    <h3 className={styles.tableTitle}>Raw Material Components</h3>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>
                            <input
                              type="checkbox"
                              checked={selectedComponents.size === componentComparisons.length}
                              onChange={() => {
                                if (selectedComponents.size === componentComparisons.length) {
                                  setSelectedComponents(new Set());
                                } else {
                                  setSelectedComponents(new Set(componentComparisons.map(c => c.key)));
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </th>
                          <th>Component</th>
                          <th>Avg CPU</th>
                          <th>Min CPU</th>
                          <th>Max CPU</th>
                          <th>Volatility %</th>
                          <th>Trend</th>
                          <th>Invoices</th>
                        </tr>
                      </thead>
                      <tbody>
                        {componentComparisons.map((comp) => (
                          <tr key={comp.key}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedComponents.has(comp.key)}
                                onChange={() => {
                                  const newSet = new Set(selectedComponents);
                                  if (newSet.has(comp.key)) {
                                    newSet.delete(comp.key);
                                  } else {
                                    newSet.add(comp.key);
                                  }
                                  setSelectedComponents(newSet);
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ fontWeight: 500 }}>{comp.display_name}</td>
                            <td style={{ fontWeight: 600, color: '#3b82f6' }}>
                              {formatCurrency(comp.statistics.avg_cpu)}
                            </td>
                            <td>{formatCurrency(comp.statistics.min_cpu)}</td>
                            <td>{formatCurrency(comp.statistics.max_cpu)}</td>
                            <td>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                background: parseFloat(comp.statistics.volatility_percent) > 15 ? '#fee2e2' :
                                           parseFloat(comp.statistics.volatility_percent) > 8 ? '#fef3c7' : '#dcfce7',
                                color: parseFloat(comp.statistics.volatility_percent) > 15 ? '#991b1b' :
                                       parseFloat(comp.statistics.volatility_percent) > 8 ? '#92400e' : '#166534',
                              }}>
                                {comp.statistics.volatility_percent}%
                              </span>
                            </td>
                            <td>
                              <div className={getTrendDirectionClass(comp.statistics.trend_direction)} style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                {getTrendDirectionIcon(comp.statistics.trend_direction)} {comp.statistics.change_percentage}%
                              </div>
                            </td>
                            <td>{comp.statistics.total_invoices}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Comparison Modal */}
                  {showComparisonModal && selectedComponents.size >= 2 && selectedComponents.size <= 6 && (() => {
                    const selectedItems = componentComparisons.filter(c => selectedComponents.has(c.key));

                    // Find best values
                    const avgCPUs = selectedItems.map(s => parseFloat(s.statistics.avg_cpu));
                    const volatilities = selectedItems.map(s => parseFloat(s.statistics.volatility_percent));
                    const lowestCPU = Math.min(...avgCPUs);
                    const lowestVolatility = Math.min(...volatilities);

                    return (
                      <Modal
                        isOpen={showComparisonModal}
                        onClose={() => setShowComparisonModal(false)}
                        title="Compare Components Side-by-Side"
                        size="xl"
                      >
                        {/* Quick Decision Guide */}
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#065f46', margin: '0 0 0.75rem 0' }}>
                            💡 Quick Decision Guide
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.875rem' }}>
                            <div>
                              <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Lowest Average CPU</div>
                              <div style={{ fontWeight: 600, color: '#065f46' }}>
                                {selectedItems.find(s => parseFloat(s.statistics.avg_cpu) === lowestCPU)?.display_name}
                              </div>
                              <div style={{ fontSize: '0.8125rem', color: '#059669' }}>{formatCurrency(lowestCPU.toFixed(2))}</div>
                            </div>
                            <div>
                              <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Most Stable (Lowest Volatility)</div>
                              <div style={{ fontWeight: 600, color: '#065f46' }}>
                                {selectedItems.find(s => parseFloat(s.statistics.volatility_percent) === lowestVolatility)?.display_name}
                              </div>
                              <div style={{ fontSize: '0.8125rem', color: '#059669' }}>{lowestVolatility.toFixed(1)}% variation</div>
                            </div>
                          </div>
                        </div>

                        {/* Comparison Table */}
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Metric</th>
                                {selectedItems.map((comp) => (
                                  <th key={comp.key} style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                                    {comp.display_name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Average CPU</td>
                                {selectedItems.map(comp => {
                                  const cpu = parseFloat(comp.statistics.avg_cpu);
                                  const isBest = cpu === lowestCPU;
                                  return (
                                    <td key={comp.key} style={{ padding: '0.75rem' }}>
                                      <div style={{ fontWeight: 600, color: isBest ? '#059669' : '#111827' }}>
                                        {formatCurrency(comp.statistics.avg_cpu)}
                                        {isBest && <span style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: '#059669' }}>✅ Best</span>}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                              <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                                <td style={{ padding: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Price Range</td>
                                {selectedItems.map(comp => (
                                  <td key={comp.key} style={{ padding: '0.75rem' }}>
                                    {formatCurrency(comp.statistics.min_cpu)} - {formatCurrency(comp.statistics.max_cpu)}
                                  </td>
                                ))}
                              </tr>
                              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Volatility</td>
                                {selectedItems.map(comp => {
                                  const vol = parseFloat(comp.statistics.volatility_percent);
                                  const isBest = vol === lowestVolatility;
                                  return (
                                    <td key={comp.key} style={{ padding: '0.75rem' }}>
                                      <div style={{ fontWeight: 600, color: isBest ? '#059669' : '#111827' }}>
                                        {comp.statistics.volatility_percent}%
                                        {isBest && <span style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: '#059669' }}>✅ Most Stable</span>}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                              <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                                <td style={{ padding: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Trend</td>
                                {selectedItems.map(comp => (
                                  <td key={comp.key} style={{ padding: '0.75rem' }}>
                                    <div className={getTrendDirectionClass(comp.statistics.trend_direction)} style={{ fontWeight: 600 }}>
                                      {getTrendDirectionIcon(comp.statistics.trend_direction)} {comp.statistics.change_percentage}%
                                    </div>
                                  </td>
                                ))}
                              </tr>
                              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Total Invoices</td>
                                {selectedItems.map(comp => (
                                  <td key={comp.key} style={{ padding: '0.75rem' }}>{comp.statistics.total_invoices}</td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                          <Button variant="outline" onClick={() => setShowComparisonModal(false)}>
                            Close
                          </Button>
                        </div>
                      </Modal>
                    );
                  })()}
                </>
              ) : (
                <div className={styles.noData}>
                  No component data found for the selected date range. Make sure you have vendor invoices with calculated CPUs.
                </div>
              )}
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
              {showComparison && compareDistributorTrend ? (
                <div className={styles.comparisonStatsContainer}>
                  {/* Primary Distributor Stats */}
                  <div className={styles.comparisonStatsSection}>
                    <h3 className={styles.comparisonDistributorName}>
                      {distributorTrend.distributor_name}
                      <span className={styles.primaryBadge}>Primary</span>
                    </h3>
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
                  </div>

                  {/* Comparison Distributor Stats */}
                  <div className={styles.comparisonStatsSection}>
                    <h3 className={styles.comparisonDistributorName}>
                      {compareDistributorTrend.distributor_name}
                      <span className={styles.comparisonBadge}>Comparison</span>
                    </h3>
                    <div className={styles.statsGrid}>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Avg Total Cost</div>
                        <div className={styles.statValue}>
                          {formatCurrency(compareDistributorTrend.statistics.average_total_cost)}
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Avg Cost Per Unit</div>
                        <div className={styles.statValue}>
                          {formatCurrency(compareDistributorTrend.statistics.average_cost_per_unit)}
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Cost Range</div>
                        <div className={styles.statValue}>
                          {formatCurrency(compareDistributorTrend.statistics.min_cost)} -{' '}
                          {formatCurrency(compareDistributorTrend.statistics.max_cost)}
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Trend</div>
                        <div
                          className={`${styles.statValue} ${getTrendDirectionClass(compareDistributorTrend.statistics.trend_direction)}`}
                        >
                          {getTrendDirectionIcon(compareDistributorTrend.statistics.trend_direction)}{' '}
                          {compareDistributorTrend.statistics.change_percentage}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
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
              )}

              {/* Distributor Cost Chart */}
              {distributorTrend.data_points.length > 0 ? (
                <div className={styles.chartContainer}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 className={styles.chartTitle} style={{ margin: 0 }}>
                      Distribution Cost Trend
                      {showComparison && compareDistributorTrend
                        ? ` - ${distributorTrend.distributor_name} vs ${compareDistributorTrend.distributor_name}`
                        : ` - ${distributorTrend.distributor_name}`}
                    </h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {/* View Toggle for Comparison Mode */}
                      {showComparison && compareDistributorTrend && (
                        <div style={{
                          display: 'inline-flex',
                          background: '#f3f4f6',
                          borderRadius: '6px',
                          padding: '2px',
                          marginRight: '0.5rem'
                        }}>
                          <button
                            onClick={() => setComparisonChartView('trend')}
                            style={{
                              padding: '0.4rem 0.8rem',
                              border: 'none',
                              borderRadius: '4px',
                              background: comparisonChartView === 'trend' ? '#fff' : 'transparent',
                              fontWeight: comparisonChartView === 'trend' ? '600' : 'normal',
                              color: comparisonChartView === 'trend' ? '#1f2937' : '#6b7280',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              boxShadow: comparisonChartView === 'trend' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                              transition: 'all 0.2s'
                            }}
                          >
                            📈 Trend
                          </button>
                          <button
                            onClick={() => setComparisonChartView('bars')}
                            style={{
                              padding: '0.4rem 0.8rem',
                              border: 'none',
                              borderRadius: '4px',
                              background: comparisonChartView === 'bars' ? '#fff' : 'transparent',
                              fontWeight: comparisonChartView === 'bars' ? '600' : 'normal',
                              color: comparisonChartView === 'bars' ? '#1f2937' : '#6b7280',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              boxShadow: comparisonChartView === 'bars' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                              transition: 'all 0.2s'
                            }}
                          >
                            📊 Compare
                          </button>
                        </div>
                      )}
                      <button
                        className={styles.exportButton}
                        onClick={() => {
                          exportChartToPDF(distributorTrend, compareDistributorTrend);
                        }}
                      >
                        📄 Export as PDF
                      </button>
                    </div>
                  </div>

                  {/* Insight Banner - Only show when NOT comparing */}
                  {!showComparison && (() => {
                    const trend = distributorTrend.statistics.trend_direction;
                    const changePercent = parseFloat(distributorTrend.statistics.change_percentage);
                    const avgCost = parseFloat(distributorTrend.statistics.average_cost_per_unit);

                    // Find best and worst deals
                    const sortedPoints = [...distributorTrend.data_points].sort((a, b) =>
                      parseFloat(a.distribution_cost_per_unit) - parseFloat(b.distribution_cost_per_unit)
                    );
                    const bestDeal = sortedPoints[0];
                    const worstDeal = sortedPoints[sortedPoints.length - 1];

                    const trendIcon = trend === 'increasing' ? '📈' : trend === 'decreasing' ? '📉' : '➡️';
                    const trendColor = trend === 'increasing' ? '#ef4444' : trend === 'decreasing' ? '#10b981' : '#6b7280';
                    const trendText = trend === 'increasing'
                      ? `Costs are trending UP by ${Math.abs(changePercent).toFixed(1)}%`
                      : trend === 'decreasing'
                      ? `Costs are trending DOWN by ${Math.abs(changePercent).toFixed(1)}%`
                      : 'Costs are holding steady';

                    return (
                      <div style={{
                        background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>{trendIcon}</span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: trendColor }}>
                            {trendText}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
                          <div>
                            <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Your Average</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
                              {formatCurrency(avgCost)}/unit
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#10b981', marginBottom: '0.25rem' }}>✓ Best Deal</div>
                            <div style={{ fontSize: '1rem', fontWeight: '600' }}>
                              {formatCurrency(bestDeal.distribution_cost_per_unit)} on {formatDate(bestDeal.date)}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#ef4444', marginBottom: '0.25rem' }}>⚠ Highest Cost</div>
                            <div style={{ fontSize: '1rem', fontWeight: '600' }}>
                              {formatCurrency(worstDeal.distribution_cost_per_unit)} on {formatDate(worstDeal.date)}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          marginTop: '0.75rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid #d1d5db',
                          fontSize: '0.85rem',
                          color: '#6b7280',
                          fontStyle: 'italic'
                        }}>
                          💡 Green bars = below average cost (good deals), Red bars = above average (watch these)
                        </div>
                      </div>
                    );
                  })()}

                  {/* Trend Chart View (Option 1) */}
                  {(!showComparison || comparisonChartView === 'trend') && (
                  <>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart
                      data={(() => {
                        // Calculate average cost per unit for color coding
                        const avgCostPerUnit = distributorTrend.data_points.reduce((sum, point) =>
                          sum + parseFloat(point.distribution_cost_per_unit), 0
                        ) / distributorTrend.data_points.length;

                        // Combine data points from both distributors if comparing
                        if (showComparison && compareDistributorTrend) {
                          const allDataPoints: any[] = [];

                          const compareAvgCostPerUnit = compareDistributorTrend.data_points.reduce((sum, point) =>
                            sum + parseFloat(point.distribution_cost_per_unit), 0
                          ) / compareDistributorTrend.data_points.length;

                          // Add primary distributor data - each invoice gets its own point
                          distributorTrend.data_points.forEach((point, index) => {
                            const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);
                            const costPerUnit = parseFloat(point.distribution_cost_per_unit);
                            const isAboveAverage = costPerUnit > avgCostPerUnit;

                            allDataPoints.push({
                              // Make date unique by appending calculation_id so multiple invoices on same date show separately
                              date: `${formatDate(point.date)}::${point.calculation_id || index}`,
                              timestamp: point.date,
                              perUnit: costPerUnit,
                              totalUnits: totalUnits,
                              numPallets: parseFloat(point.num_pallets),
                              isAboveAverage: isAboveAverage,
                              avgCostPerUnit: avgCostPerUnit,
                              originalPoint: point,
                              uniqueKey: `primary-${point.calculation_id || index}`,
                            });
                          });

                          // Add comparison distributor data - each invoice gets its own point
                          compareDistributorTrend.data_points.forEach((point, index) => {
                            const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);
                            const costPerUnit = parseFloat(point.distribution_cost_per_unit);
                            const isAboveAverage = costPerUnit > compareAvgCostPerUnit;

                            allDataPoints.push({
                              // Make date unique by appending calculation_id
                              date: `${formatDate(point.date)}::${point.calculation_id || index}`,
                              timestamp: point.date,
                              comparePerUnit: costPerUnit,
                              compareTotalUnits: totalUnits,
                              compareNumPallets: parseFloat(point.num_pallets),
                              compareIsAboveAverage: isAboveAverage,
                              compareAvgCostPerUnit: compareAvgCostPerUnit,
                              compareOriginalPoint: point,
                              uniqueKey: `compare-${point.calculation_id || index}`,
                            });
                          });

                          // Sort by timestamp, then by uniqueKey for consistent ordering
                          return allDataPoints.sort((a, b) => {
                            if (a.timestamp !== b.timestamp) {
                              return a.timestamp - b.timestamp;
                            }
                            return a.uniqueKey.localeCompare(b.uniqueKey);
                          });
                        }

                        // Single distributor view
                        // Each point needs a unique key for Recharts to treat them separately
                        return distributorTrend.data_points.map((point, index) => {
                          const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);
                          const costPerUnit = parseFloat(point.distribution_cost_per_unit);
                          const isAboveAverage = costPerUnit > avgCostPerUnit;
                          const formattedDate = formatDate(point.date);

                          return {
                            // Use calculation_id + index to ensure uniqueness for Recharts
                            date: `${formattedDate}::${point.calculation_id || index}`,
                            displayDate: formattedDate, // Clean date for display
                            timestamp: point.date,
                            perUnit: costPerUnit,
                            totalUnits: totalUnits,
                            numPallets: parseFloat(point.num_pallets),
                            isAboveAverage: isAboveAverage,
                            avgCostPerUnit: avgCostPerUnit,
                            originalPoint: point,
                            calculationId: point.calculation_id || `calc-${index}`,
                          };
                        });
                      })()}
                      margin={{ top: 20, right: 60, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tickFormatter={(value) => {
                          // Strip out the ::calculation_id part to show clean dates
                          return value.split('::')[0];
                        }}
                      />
                      <YAxis
                        yAxisId="left"
                        label={{ value: 'Cost Per Unit ($)', angle: -90, position: 'insideLeft' }}
                      />
                      {/* Only show right axis (volume) when NOT comparing */}
                      {!showComparison && (
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          label={{
                            value: 'Total Units',
                            angle: 90,
                            position: 'insideRight',
                          }}
                        />
                      )}
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length > 0) {
                            const dataPoint = payload[0].payload;

                            // Comparison Mode Tooltip - show whichever distributor this point belongs to
                            if (showComparison && compareDistributorTrend) {
                              const primaryPoint = dataPoint.originalPoint;
                              const comparePoint = dataPoint.compareOriginalPoint;
                              const point = primaryPoint || comparePoint;

                              if (!point) return null;

                              const isPrimary = !!primaryPoint;
                              const distributorName = isPrimary ? distributorTrend.distributor_name : compareDistributorTrend.distributor_name;
                              const color = isPrimary ? '#3b82f6' : '#8b5cf6';

                              return (
                                <div className={styles.chartTooltip}>
                                  <p className={styles.tooltipDate} style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                    {formatDate(point.date)}
                                  </p>
                                  <p style={{ fontWeight: 'bold', color, marginBottom: '0.5rem' }}>
                                    {distributorName}
                                  </p>
                                  <p><strong>Cost/Unit:</strong> {formatCurrency(point.distribution_cost_per_unit)}</p>
                                  <p><strong>Total Cost:</strong> {formatCurrency(point.total_distribution_cost)}</p>
                                  <p><strong>Volume:</strong> {dataPoint.totalUnits || dataPoint.compareTotalUnits} units</p>
                                  {point.invoice_number && (
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                                      Invoice: {point.invoice_number}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            // Single Distributor Tooltip
                            const point = dataPoint.originalPoint;
                            if (!point) return null;

                            const costPerUnit = parseFloat(point.distribution_cost_per_unit);
                            const avgCostPerUnit = dataPoint.avgCostPerUnit;
                            const variance = ((costPerUnit - avgCostPerUnit) / avgCostPerUnit) * 100;
                            const isGoodDeal = costPerUnit < avgCostPerUnit;

                            return (
                              <div className={styles.chartTooltip}>
                                <p className={styles.tooltipDate}>{formatDate(point.date)}</p>
                                <p><strong>Cost Per Unit:</strong> {formatCurrency(point.distribution_cost_per_unit)}</p>
                                <p><strong>Volume:</strong> {dataPoint.totalUnits.toLocaleString()} units ({point.num_pallets} pallets)</p>
                                <p><strong>Total Cost:</strong> {formatCurrency(point.total_distribution_cost)}</p>
                                <div style={{
                                  marginTop: '0.5rem',
                                  paddingTop: '0.5rem',
                                  borderTop: '1px solid #e5e7eb',
                                  color: isGoodDeal ? '#10b981' : '#ef4444',
                                  fontWeight: 'bold'
                                }}>
                                  {isGoodDeal ? '✓' : '⚠'} {Math.abs(variance).toFixed(1)}% {isGoodDeal ? 'below' : 'above'} your average
                                </div>
                                {point.calculation_name && (
                                  <p className={styles.tooltipDetail} style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                                    {point.calculation_name}
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />

                      {/* Volume Bars - Only show when NOT comparing (too noisy with 2 distributors) */}
                      {!showComparison && (
                        <Bar
                          yAxisId="right"
                          dataKey="totalUnits"
                          fill="#10b981"
                          opacity={0.6}
                          name="Volume (Units)"
                          shape={(props: any) => {
                            const { x, y, width, height, payload } = props;
                            const fill = payload.isAboveAverage ? '#ef4444' : '#10b981';
                            return <rect x={x} y={y} width={width} height={height} fill={fill} opacity={0.6} />;
                          }}
                        />
                      )}

                      {/* Cost Per Unit Line - Primary Distributor */}
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="perUnit"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 8 }}
                        name={showComparison ? distributorTrend.distributor_name : 'Cost Per Unit'}
                      />

                      {/* Comparison Distributor - Only show cost line */}
                      {showComparison && compareDistributorTrend && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="comparePerUnit"
                          stroke="#8b5cf6"
                          strokeWidth={3}
                          strokeDasharray="5 5"
                          dot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 8 }}
                          name={compareDistributorTrend.distributor_name}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>


                  {/* Helper text for comparison mode */}
                  {showComparison && compareDistributorTrend && comparisonChartView === 'trend' && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      color: '#6b7280'
                    }}>
                      <strong style={{ color: '#374151' }}>📊 Comparison View:</strong> Solid blue line = {distributorTrend.distributor_name}, Dashed purple line = {compareDistributorTrend.distributor_name}. Hover over any date to see both distributors' costs and the difference.
                    </div>
                  )}
                  </>
                  )}

                  {/* Side-by-Side Bar Chart View (Option 2) */}
                  {showComparison && compareDistributorTrend && comparisonChartView === 'bars' && (
                    <>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={[
                            {
                              metric: 'Avg Cost/Unit',
                              [distributorTrend.distributor_name]: parseFloat(distributorTrend.statistics.average_cost_per_unit),
                              [compareDistributorTrend.distributor_name]: parseFloat(compareDistributorTrend.statistics.average_cost_per_unit),
                            },
                            {
                              metric: 'Min Cost',
                              [distributorTrend.distributor_name]: parseFloat(distributorTrend.statistics.min_cost),
                              [compareDistributorTrend.distributor_name]: parseFloat(compareDistributorTrend.statistics.min_cost),
                            },
                            {
                              metric: 'Max Cost',
                              [distributorTrend.distributor_name]: parseFloat(distributorTrend.statistics.max_cost),
                              [compareDistributorTrend.distributor_name]: parseFloat(compareDistributorTrend.statistics.max_cost),
                            },
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="metric" />
                          <YAxis label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft' }} />
                          <Tooltip
                            formatter={(value: any) => `$${value.toFixed(2)}`}
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              padding: '0.75rem'
                            }}
                          />
                          <Legend />
                          <Bar dataKey={distributorTrend.distributor_name} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey={compareDistributorTrend.distributor_name} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Insight cards below bars */}
                      <div style={{
                        marginTop: '1.5rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '1rem'
                      }}>
                        {/* Cost Difference Card */}
                        <div style={{
                          padding: '1rem',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            Avg Cost Difference
                          </div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
                            {(() => {
                              const diff = parseFloat(distributorTrend.statistics.average_cost_per_unit) - parseFloat(compareDistributorTrend.statistics.average_cost_per_unit);
                              const isLower = diff < 0;
                              return (
                                <span style={{ color: isLower ? '#10b981' : '#ef4444' }}>
                                  {isLower ? '↓' : '↑'} ${Math.abs(diff).toFixed(2)}
                                </span>
                              );
                            })()}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {parseFloat(distributorTrend.statistics.average_cost_per_unit) < parseFloat(compareDistributorTrend.statistics.average_cost_per_unit)
                              ? `${distributorTrend.distributor_name} is cheaper`
                              : `${compareDistributorTrend.distributor_name} is cheaper`}
                          </div>
                        </div>

                        {/* Trend Direction Card */}
                        <div style={{
                          padding: '1rem',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            Cost Trends
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                            <div>
                              <div style={{ fontWeight: '600', color: '#3b82f6' }}>
                                {distributorTrend.distributor_name}:
                              </div>
                              <div style={{
                                color: distributorTrend.statistics.trend_direction === 'decreasing' ? '#10b981' : '#ef4444'
                              }}>
                                {distributorTrend.statistics.trend_direction === 'increasing' ? '📈' : '📉'} {distributorTrend.statistics.change_percentage}%
                              </div>
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', color: '#8b5cf6' }}>
                                {compareDistributorTrend.distributor_name}:
                              </div>
                              <div style={{
                                color: compareDistributorTrend.statistics.trend_direction === 'decreasing' ? '#10b981' : '#ef4444'
                              }}>
                                {compareDistributorTrend.statistics.trend_direction === 'increasing' ? '📈' : '📉'} {compareDistributorTrend.statistics.change_percentage}%
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Data Points Card */}
                        <div style={{
                          padding: '1rem',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            Shipments Analyzed
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                            <div>
                              <span style={{ fontWeight: '600', color: '#3b82f6' }}>{distributorTrend.distributor_name}:</span>
                              <span style={{ marginLeft: '0.5rem' }}>{distributorTrend.data_points.length}</span>
                            </div>
                            <div>
                              <span style={{ fontWeight: '600', color: '#8b5cf6' }}>{compareDistributorTrend.distributor_name}:</span>
                              <span style={{ marginLeft: '0.5rem' }}>{compareDistributorTrend.data_points.length}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {/* Calculations History Table */}
              {distributorTrend.data_points.length > 0 && (
                <div className={styles.tableContainer}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <h2 className={styles.tableTitle} style={{ margin: 0 }}>
                      Calculation History Summary for {distributorTrend.distributor_name}
                    </h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      {/* Column Selector */}
                      <div style={{ position: 'relative' }}>
                        <button
                          className={styles.exportButton}
                          onClick={() => setShowColumnSelector(!showColumnSelector)}
                        >
                          ⚙️ Columns
                        </button>
                        {showColumnSelector && (
                          <div className={styles.columnSelector}>
                            <div className={styles.columnSelectorHeader}>
                              <strong>Select Columns</strong>
                              <button
                                onClick={() => setShowColumnSelector(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                              >
                                ✕
                              </button>
                            </div>
                            {allColumns.map(col => (
                              <label key={col.id} className={styles.columnOption}>
                                <input
                                  type="checkbox"
                                  checked={visibleColumns.includes(col.id)}
                                  onChange={() => toggleColumn(col.id)}
                                />
                                <span>{col.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Export Section */}
                      <div style={{ position: 'relative' }}>
                        <button
                          className={styles.exportButton}
                          onClick={() => setShowTableExportMenu(!showTableExportMenu)}
                        >
                          📥 Export Table ▼
                        </button>
                        {showTableExportMenu && (
                          <div className={styles.exportDropdown}>
                            <div className={styles.exportDropdownHeader}>
                              <strong>Table Exports</strong>
                              <button
                                onClick={() => setShowTableExportMenu(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className={styles.exportDropdownSection}>
                              <div className={styles.exportDropdownSectionTitle}>Summary Exports</div>
                              <button
                                className={styles.exportDropdownItem}
                                onClick={() => {
                                  exportSummaryToCSV(distributorTrend, fullCalculations);
                                  setShowTableExportMenu(false);
                                }}
                              >
                                📊 Summary CSV
                              </button>
                              <button
                                className={styles.exportDropdownItem}
                                onClick={() => {
                                  exportSummaryToPDF(distributorTrend, fullCalculations);
                                  setShowTableExportMenu(false);
                                }}
                              >
                                📄 Summary PDF
                              </button>
                            </div>
                            <div className={styles.exportDropdownSection}>
                              <div className={styles.exportDropdownSectionTitle}>Detailed Exports</div>
                              <button
                                className={styles.exportDropdownItem}
                                onClick={() => {
                                  exportDetailedToCSV(distributorTrend, fullCalculations);
                                  setShowTableExportMenu(false);
                                }}
                              >
                                📊 Detailed CSV
                              </button>
                              <button
                                className={styles.exportDropdownItem}
                                onClick={() => {
                                  exportDetailedToPDF(distributorTrend, fullCalculations);
                                  setShowTableExportMenu(false);
                                }}
                              >
                                📄 Detailed PDF
                              </button>
                            </div>
                            <div className={styles.exportDropdownSection}>
                              <div className={styles.exportDropdownSectionTitle}>Data Analysis</div>
                              <button
                                className={styles.exportDropdownItem}
                                onClick={() => {
                                  exportDataTableCSV(distributorTrend, fullCalculations);
                                  setShowTableExportMenu(false);
                                }}
                                title="Export in flat table format for pivot tables and data analysis"
                              >
                                📊 Data Table CSV
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {visibleColumns.includes('date') && <th>Date</th>}
                        {visibleColumns.includes('invoiceNumber') && <th>Invoice #</th>}
                        {visibleColumns.includes('products') && <th>Products</th>}
                        {visibleColumns.includes('pallets') && <th>Pallets</th>}
                        {visibleColumns.includes('unitsPerPallet') && <th>Units/Pallet</th>}
                        {visibleColumns.includes('totalUnits') && <th>Total Units</th>}
                        {visibleColumns.includes('totalCost') && <th>Total Cost</th>}
                        {visibleColumns.includes('costPerUnit') && <th>Cost Per Unit</th>}
                        {visibleColumns.includes('actions') && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {distributorTrend.data_points.map((point) => {
                        const totalUnits = parseFloat(point.num_pallets) * parseFloat(point.units_per_pallet);
                        const fullCalc = fullCalculations.find(c => c?.id === point.calculation_id);
                        const products = fullCalc?.variant_data ? Object.keys(fullCalc.variant_data).join(', ') : '—';
                        return (
                          <tr key={point.calculation_id}>
                            {visibleColumns.includes('date') && <td>{formatDate(point.date)}</td>}
                            {visibleColumns.includes('invoiceNumber') && (
                              <td>
                                {fullCalc?.invoice_number || (fullCalc?.is_draft ? '—' : '—')}
                              </td>
                            )}
                            {visibleColumns.includes('products') && (
                              <td>
                                <strong>{products}</strong>
                              </td>
                            )}
                            {visibleColumns.includes('pallets') && <td>{point.num_pallets}</td>}
                            {visibleColumns.includes('unitsPerPallet') && <td>{point.units_per_pallet}</td>}
                            {visibleColumns.includes('totalUnits') && <td>{totalUnits.toLocaleString()}</td>}
                            {visibleColumns.includes('totalCost') && <td>{formatCurrency(point.total_distribution_cost)}</td>}
                            {visibleColumns.includes('costPerUnit') && (
                              <td className={styles.highlightCell}>
                                {formatCurrency(point.distribution_cost_per_unit)}
                              </td>
                            )}
                            {visibleColumns.includes('actions') && (
                              <td>
                                <button
                                  onClick={() => navigate(`/cpg/distribution-cost?calculation=${point.calculation_id}`)}
                                  className={styles.actionButton}
                                  title="Edit this calculation"
                                  style={{
                                    padding: '0.25rem 0.75rem',
                                    fontSize: '0.875rem',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Edit
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {distributorTrend.data_points.length === 0 && (
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
