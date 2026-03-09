/**
 * Smart Alerts Sub-Tab Component
 *
 * Displays intelligent cost alerts based on trend and vendor analysis.
 *
 * Features:
 * - Alert generation from trend and vendor data
 * - Price spike detection
 * - Savings opportunity alerts
 * - Supply chain risk warnings
 * - Alert filtering (all/urgent/warning/opportunity/info)
 * - Dismiss/undismiss functionality with localStorage persistence
 *
 * Requirements:
 * - Receives trend and vendor data from parent CostIntelligenceTab
 * - Generates actionable alerts with priority levels
 * - WCAG 2.1 AA compliance
 * - Type-safe implementation
 * - Persists dismissed alerts to localStorage
 */

import { useState, useEffect, useMemo } from 'react';
import type { CPGCategory, CPGInvoice } from '../../../../db/schema/cpg.schema';

export interface SmartAlertsTabProps {
  companyId: string;
  selectedProducts: Set<string>;
  productCPUData: Map<string, ProductCPUData>;
  categories: CPGCategory[];
  invoices: CPGInvoice[];
  dateRange?: '3mo' | '6mo' | '12mo' | 'all';
  onNavigateToVendorIntel?: (filters: {
    categoryId?: string;
    variant?: string;
    vendorName?: string;
  }) => void;
}

interface ProductCPUData {
  cpu: string | null;
  margin: number | null;
  trend: 'up' | 'down' | 'stable';
  trendValue: string | null;
  topDriver: string | null;
  isComplete: boolean;
  breakdown: any[];
}

interface TrendData {
  currentPrice: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceChange: number;
  volatility: 'low' | 'medium' | 'high';
  coefficientOfVariation: number;
  invoiceCount: number;
  lastBuyDate: number;
  prices: number[];
  dates: number[];
  variant: string | null;
  lastVendor: string;
}

interface VendorIntelData {
  vendors: Map<string, number[]>;
  vendorAvgPrices: Map<string, number>;
  bestPrice: number;
  bestVendor: string;
  avgPrice: number;
  maxSavings: number;
  topVendor: string;
  topVendorSpend: number;
  topVendorPercent: number;
  vendorConcentration: boolean;
  priceAnomaly: boolean;
  anomalyVendor: string;
  anomalyDeviation: number;
  variant: string | null;
}

interface Alert {
  id: string;
  type: 'urgent' | 'warning' | 'opportunity' | 'info';
  icon: string;
  title: string;
  message: string;
  component?: string;
  variant?: string;
  vendor?: string;
  amount?: number;
  action?: string;
  context?: string;
  categoryId?: string;
  bestAlternative?: {
    vendor: string;
    price: number;
    savings: number;
  };
}

type AlertFilter = 'all' | 'urgent' | 'warning' | 'opportunity' | 'info';

export default function SmartAlertsTab({
  companyId,
  selectedProducts,
  productCPUData,
  categories,
  invoices,
  onNavigateToVendorIntel,
}: SmartAlertsTabProps) {
  // State
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [showDismissedAlerts, setShowDismissedAlerts] = useState(false);
  const [trendData, setTrendData] = useState<Map<string, TrendData>>(new Map());
  const [vendorIntelData, setVendorIntelData] = useState<Map<string, VendorIntelData>>(new Map());

  // Load dismissed alerts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cpu-dismissed-alerts');
      if (stored) {
        const parsed = JSON.parse(stored);
        setDismissedAlerts(new Set(parsed));
      }
    } catch (err) {
      console.error('Failed to load dismissed alerts:', err);
    }
  }, []);

  // Persist dismissed alerts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cpu-dismissed-alerts', JSON.stringify(Array.from(dismissedAlerts)));
    } catch (err) {
      console.error('Failed to save dismissed alerts:', err);
    }
  }, [dismissedAlerts]);

  // Load trend data for alert generation (variant-specific)
  useEffect(() => {
    const loadTrendData = async () => {
      if (selectedProducts.size === 0) {
        setTrendData(new Map());
        return;
      }

      try {
        const trendMap = new Map<string, TrendData>();

        // Get all unique component+variant combinations from selected products
        const componentVariants = new Map<string, Set<string>>();
        selectedProducts.forEach(productId => {
          const cpuData = productCPUData.get(productId);
          if (cpuData?.breakdown) {
            cpuData.breakdown.forEach(comp => {
              if (!componentVariants.has(comp.categoryId)) {
                componentVariants.set(comp.categoryId, new Set());
              }
              componentVariants.get(comp.categoryId)!.add(comp.variant || '');
            });
          }
        });

        // Use all-time data for alerts (most comprehensive)
        const startDate = 0;

        // Analyze each component+variant combination
        for (const [categoryId, variants] of componentVariants.entries()) {
          for (const variant of variants) {
            const relevantInvoices = invoices.filter(inv => {
              if (startDate > 0 && inv.invoice_date < startDate) return false;
              return Object.entries(inv.cost_attribution || {}).some(([_, attr]) =>
                attr.category_id === categoryId && (attr.variant || '') === variant
              );
            });

            if (relevantInvoices.length === 0) continue;

            // Get all prices for this specific variant
            const priceData: Array<{ price: number; date: number; vendor: string }> = [];
            relevantInvoices.forEach(inv => {
              Object.entries(inv.cost_attribution || {}).forEach(([_, attr]) => {
                if (attr.category_id === categoryId && (attr.variant || '') === variant) {
                  const unitPrice = parseFloat(attr.unit_price);
                  if (!isNaN(unitPrice) && unitPrice > 0) {
                    priceData.push({
                      price: unitPrice,
                      date: inv.invoice_date,
                      vendor: inv.vendor_name || 'Unknown',
                    });
                  }
                }
              });
            });

            if (priceData.length === 0) continue;

            // Sort by date
            priceData.sort((a, b) => a.date - b.date);

            const prices = priceData.map(d => d.price);
            const dates = priceData.map(d => d.date);
            const lastEntry = priceData[priceData.length - 1];

            // Calculate stats
            const currentPrice = lastEntry.price;
            const lastVendor = lastEntry.vendor;
            const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const priceChange = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

            // Calculate volatility (coefficient of variation)
            const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
            const stdDev = Math.sqrt(variance);
            const coefficientOfVariation = (stdDev / avgPrice) * 100;

            let volatility: 'low' | 'medium' | 'high';
            if (coefficientOfVariation < 10) volatility = 'low';
            else if (coefficientOfVariation < 25) volatility = 'medium';
            else volatility = 'high';

            // Get last buy date
            const lastBuyDate = Math.max(...dates);

            const key = `${categoryId}:${variant}`;
            trendMap.set(key, {
              currentPrice,
              avgPrice,
              minPrice,
              maxPrice,
              priceChange,
              volatility,
              coefficientOfVariation,
              invoiceCount: relevantInvoices.length,
              lastBuyDate,
              prices,
              dates,
              variant,
              lastVendor,
            });
          }
        }

        setTrendData(trendMap);
      } catch (err) {
        console.error('Failed to load trend data:', err);
      }
    };

    loadTrendData();
  }, [selectedProducts, productCPUData, invoices]);

  // Load vendor intelligence data for alert generation (variant-specific)
  useEffect(() => {
    const loadVendorIntelData = async () => {
      if (!companyId || selectedProducts.size === 0) {
        setVendorIntelData(new Map());
        return;
      }

      try {
        const intelMap = new Map<string, VendorIntelData>();

        // Get all unique component+variant combinations from selected products
        const componentVariants = new Map<string, Set<string>>();
        selectedProducts.forEach(productId => {
          const cpuData = productCPUData.get(productId);
          if (cpuData?.breakdown) {
            cpuData.breakdown.forEach(comp => {
              if (!componentVariants.has(comp.categoryId)) {
                componentVariants.set(comp.categoryId, new Set());
              }
              componentVariants.get(comp.categoryId)!.add(comp.variant || '');
            });
          }
        });

        // Analyze each component+variant combination
        for (const [categoryId, variants] of componentVariants.entries()) {
          for (const variant of variants) {
            const relevantInvoices = invoices.filter(inv =>
              Object.entries(inv.cost_attribution || {}).some(([_, attr]) =>
                attr.category_id === categoryId && (attr.variant || '') === variant
              )
            );

            if (relevantInvoices.length === 0) continue;

            // Group by vendor
            const vendorPrices = new Map<string, number[]>();
            const vendorTotals = new Map<string, number>();

            relevantInvoices.forEach(inv => {
              const vendor = inv.vendor_name || 'Unknown';
              Object.entries(inv.cost_attribution || {}).forEach(([_, attr]) => {
                if (attr.category_id === categoryId && (attr.variant || '') === variant) {
                  const unitPrice = parseFloat(attr.unit_price);
                  const unitsPurchased = parseFloat(attr.units_purchased);
                  const lineTotal = unitPrice * unitsPurchased;

                  if (!isNaN(unitPrice) && unitPrice > 0) {
                    if (!vendorPrices.has(vendor)) {
                      vendorPrices.set(vendor, []);
                      vendorTotals.set(vendor, 0);
                    }
                    vendorPrices.get(vendor)!.push(unitPrice);
                    vendorTotals.set(vendor, (vendorTotals.get(vendor) || 0) + lineTotal);
                  }
                }
              });
            });

            if (vendorPrices.size === 0) continue;

            // Calculate vendor stats
            const vendorAvgPrices = new Map<string, number>();
            vendorPrices.forEach((prices, vendor) => {
              const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
              vendorAvgPrices.set(vendor, avg);
            });

            const bestPrice = Math.min(...Array.from(vendorAvgPrices.values()));
            let bestVendor = '';
            vendorAvgPrices.forEach((price, vendor) => {
              if (price === bestPrice) bestVendor = vendor;
            });

            const avgPrice = Array.from(vendorAvgPrices.values()).reduce((sum, p) => sum + p, 0) / vendorAvgPrices.size;
            const maxSavings = avgPrice - bestPrice;

            // Find top vendor by spend
            let topVendor = '';
            let topVendorSpend = 0;
            vendorTotals.forEach((spend, vendor) => {
              if (spend > topVendorSpend) {
                topVendorSpend = spend;
                topVendor = vendor;
              }
            });

            const totalSpend = Array.from(vendorTotals.values()).reduce((sum, s) => sum + s, 0);
            const topVendorPercent = (topVendorSpend / totalSpend) * 100;

            // Detect price anomalies
            const priceValues = Array.from(vendorAvgPrices.values());
            const priceAvg = priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;

            let anomalyVendor = '';
            let anomalyDeviation = 0;
            vendorAvgPrices.forEach((price, vendor) => {
              const deviation = ((price - priceAvg) / priceAvg) * 100;
              if (Math.abs(deviation) > Math.abs(anomalyDeviation) && Math.abs(deviation) > 20) {
                anomalyVendor = vendor;
                anomalyDeviation = deviation;
              }
            });

            const key = `${categoryId}:${variant}`;
            intelMap.set(key, {
              vendors: vendorPrices,
              vendorAvgPrices,
              bestPrice,
              bestVendor,
              avgPrice,
              maxSavings,
              topVendor,
              topVendorSpend,
              topVendorPercent,
              vendorConcentration: topVendorPercent > 80,
              priceAnomaly: anomalyVendor !== '',
              anomalyVendor,
              anomalyDeviation,
              variant,
            });
          }
        }

        setVendorIntelData(intelMap);
      } catch (err) {
        console.error('Failed to load vendor intel data:', err);
      }
    };

    loadVendorIntelData();
  }, [companyId, selectedProducts, productCPUData, invoices]);

  /**
   * Generate smart alerts based on trend and vendor data (variant-specific)
   */
  const generateSmartAlerts = (): Alert[] => {
    const alerts: Alert[] = [];
    const priorityOrder = { urgent: 1, warning: 2, opportunity: 3, info: 4 };

    // Analyze trend data for alerts (variant-specific)
    trendData.forEach((trend, key) => {
      const [categoryId, variant] = key.split(':');
      const category = categories.find(c => c.id === categoryId);
      if (!category) return;

      const current = trend.currentPrice || 0;
      const avg = trend.avgPrice || 0;
      const change = trend.priceChange || 0;
      const volatility = trend.volatility || 'low';
      const lastBuyDate = trend.lastBuyDate || 0;
      const daysSinceLastBuy = (Date.now() - lastBuyDate) / (1000 * 60 * 60 * 24);
      const invoiceCount = trend.invoiceCount || 0;
      const lastVendor = trend.lastVendor || 'Unknown';

      // Get vendor intelligence for this variant
      const intel = vendorIntelData.get(key);
      const bestAlternative = intel ? {
        vendor: intel.bestVendor,
        price: intel.bestPrice,
        savings: current - intel.bestPrice,
      } : undefined;

      // Skip if insufficient data (need at least 2 purchases)
      if (invoiceCount < 2) return;

      // Display name with variant
      const displayName = variant ? `${category.name} (${variant})` : category.name;

      // 1. Price Spike Alert (>20% increase)
      if (change > 20) {
        const contextParts = [`${lastVendor}: $${current.toFixed(2)} (up ${change.toFixed(1)}% from your $${avg.toFixed(2)} avg)`];
        if (bestAlternative && bestAlternative.savings > 0) {
          contextParts.push(`${bestAlternative.vendor} offers $${bestAlternative.price.toFixed(2)} (save $${bestAlternative.savings.toFixed(2)}/unit)`);
        }

        alerts.push({
          id: `spike-${key}`,
          type: 'urgent',
          icon: '🚨',
          title: 'Significant Price Spike',
          message: `${displayName} increased ${change.toFixed(1)}%`,
          component: category.name,
          variant,
          vendor: lastVendor,
          categoryId,
          amount: change,
          action: bestAlternative && bestAlternative.savings > 0
            ? `Switch to ${bestAlternative.vendor} to save $${bestAlternative.savings.toFixed(2)}/unit`
            : 'Negotiate with current vendor or find alternatives',
          context: contextParts.join(' • '),
          bestAlternative,
        });
      }

      // 2. Moderate Price Increase (10-20%)
      else if (change > 10 && change <= 20) {
        const contextParts = [`${lastVendor}: $${current.toFixed(2)} (up ${change.toFixed(1)}% from your $${avg.toFixed(2)} avg)`];
        if (bestAlternative && bestAlternative.savings > 0) {
          contextParts.push(`${bestAlternative.vendor} offers $${bestAlternative.price.toFixed(2)}`);
        }

        alerts.push({
          id: `increase-${key}`,
          type: 'warning',
          icon: '⚠️',
          title: 'Price Increase Detected',
          message: `${displayName} increased ${change.toFixed(1)}%`,
          component: category.name,
          variant,
          vendor: lastVendor,
          categoryId,
          amount: change,
          action: bestAlternative && bestAlternative.savings > 0
            ? `Consider switching to ${bestAlternative.vendor} ($${bestAlternative.price.toFixed(2)}/unit)`
            : 'Monitor closely and negotiate',
          context: contextParts.join(' • '),
          bestAlternative,
        });
      }

      // 3. High Volatility Warning
      if (volatility === 'high') {
        alerts.push({
          id: `volatility-${key}`,
          type: 'warning',
          icon: '📊',
          title: 'High Price Volatility',
          message: `${displayName} shows high price volatility`,
          component: category.name,
          variant,
          vendor: lastVendor,
          categoryId,
          action: 'Consider long-term contracts to stabilize costs',
          context: `Price varies ${(trend.coefficientOfVariation).toFixed(1)}% • Range: $${trend.minPrice.toFixed(2)}-$${trend.maxPrice.toFixed(2)}`,
        });
      }

      // 4. Price Drop Opportunity (< -10%)
      if (change < -10) {
        alerts.push({
          id: `drop-${key}`,
          type: 'opportunity',
          icon: '💰',
          title: 'Price Drop Opportunity',
          message: `${displayName} decreased ${Math.abs(change).toFixed(1)}%`,
          component: category.name,
          variant,
          vendor: lastVendor,
          categoryId,
          amount: Math.abs(change),
          action: `Great time to stock up from ${lastVendor}`,
          context: `${lastVendor}: $${current.toFixed(2)} (down from your $${avg.toFixed(2)} avg)`,
        });
      }

      // 5. Stable Low Price
      if (volatility === 'low' && change > -5 && change < 5 && current < avg) {
        alerts.push({
          id: `stable-low-${key}`,
          type: 'opportunity',
          icon: '✅',
          title: 'Stable Low Price',
          message: `${displayName} is stable and below average`,
          component: category.name,
          variant,
          vendor: lastVendor,
          categoryId,
          action: `Good time to stock up from ${lastVendor}`,
          context: `${lastVendor}: $${current.toFixed(2)} (${Math.abs(avg - current).toFixed(2)} below your avg)`,
        });
      }

      // 6. Stale Data Warning (>90 days since last purchase)
      if (daysSinceLastBuy > 90) {
        alerts.push({
          id: `stale-${key}`,
          type: 'info',
          icon: 'ℹ️',
          title: 'Outdated Pricing Data',
          message: `${displayName} hasn't been purchased in ${Math.floor(daysSinceLastBuy)} days`,
          component: category.name,
          variant,
          categoryId,
          action: 'Update pricing data with recent purchase',
          context: `Last purchase from ${lastVendor}: ${new Date(lastBuyDate).toLocaleDateString()}`,
        });
      }

      // 7. Low Data Quality (< 5 purchases)
      if (invoiceCount < 5 && invoiceCount >= 2) {
        alerts.push({
          id: `low-data-${key}`,
          type: 'info',
          icon: '📉',
          title: 'Limited Purchase History',
          message: `Only ${invoiceCount} purchases for ${displayName}`,
          component: category.name,
          variant,
          categoryId,
          action: 'More purchases will improve trend accuracy',
          context: 'Trend analysis may be less reliable with limited data',
        });
      }
    });

    // Analyze vendor data for alerts (variant-specific)
    vendorIntelData.forEach((intel, key) => {
      const [categoryId, variant] = key.split(':');
      const category = categories.find(c => c.id === categoryId);
      if (!category) return;

      const displayName = variant ? `${category.name} (${variant})` : category.name;
      const vendorCount = intel.vendors.size;
      const bestPrice = intel.bestPrice || 0;
      const bestVendor = intel.bestVendor || '';
      const avgPrice = intel.avgPrice || 0;
      const maxSavings = intel.maxSavings || 0;
      const savingsPercent = avgPrice > 0 ? (maxSavings / avgPrice) * 100 : 0;

      // 8. Significant Savings Opportunity (>15% difference)
      if (savingsPercent > 15 && vendorCount > 1) {
        alerts.push({
          id: `savings-${key}`,
          type: 'opportunity',
          icon: '💵',
          title: 'Significant Savings Available',
          message: `Save ${savingsPercent.toFixed(0)}% on ${displayName}`,
          component: category.name,
          variant,
          vendor: bestVendor,
          categoryId,
          amount: maxSavings,
          action: `Switch to ${bestVendor} to save $${maxSavings.toFixed(2)}/unit`,
          context: `${bestVendor}: $${bestPrice.toFixed(2)}/unit (your avg: $${avgPrice.toFixed(2)})`,
          bestAlternative: {
            vendor: bestVendor,
            price: bestPrice,
            savings: maxSavings,
          },
        });
      }

      // 9. Vendor Concentration Risk (>80% from single vendor)
      if (intel.vendorConcentration && intel.topVendor && intel.topVendorPercent > 80) {
        alerts.push({
          id: `concentration-${key}`,
          type: 'warning',
          icon: '⚖️',
          title: 'High Vendor Concentration',
          message: `${displayName}: ${intel.topVendorPercent.toFixed(0)}% from ${intel.topVendor}`,
          component: category.name,
          variant,
          vendor: intel.topVendor,
          categoryId,
          action: 'Diversify suppliers to reduce supply chain risk',
          context: `${intel.topVendor} represents ${intel.topVendorPercent.toFixed(0)}% of your spend`,
        });
      }

      // 10. Single-Source Component
      if (vendorCount === 1) {
        const singleVendor = Array.from(intel.vendors.keys())[0];
        alerts.push({
          id: `single-source-${key}`,
          type: 'warning',
          icon: '🔗',
          title: 'Single-Source Variant',
          message: `${displayName} only purchased from ${singleVendor}`,
          component: category.name,
          variant,
          vendor: singleVendor,
          categoryId,
          action: 'Identify backup suppliers to mitigate risk',
          context: 'High supply chain vulnerability',
        });
      }

      // 11. Price Anomaly (one vendor significantly different)
      if (intel.priceAnomaly && intel.anomalyVendor && intel.anomalyDeviation) {
        const direction = intel.anomalyDeviation > 0 ? 'higher' : 'lower';
        const anomalyPrice = intel.vendorAvgPrices.get(intel.anomalyVendor) || 0;
        alerts.push({
          id: `anomaly-${key}`,
          type: 'info',
          icon: '🔍',
          title: 'Price Anomaly Detected',
          message: `${displayName}: ${intel.anomalyVendor} is ${Math.abs(intel.anomalyDeviation).toFixed(1)}% ${direction}`,
          component: category.name,
          variant,
          vendor: intel.anomalyVendor,
          categoryId,
          action: direction === 'higher' ? 'Investigate pricing discrepancy or negotiate' : 'Verify quality matches your needs',
          context: `${intel.anomalyVendor}: $${anomalyPrice.toFixed(2)} (market avg: $${avgPrice.toFixed(2)})`,
        });
      }
    });

    // Filter out dismissed alerts
    const activeAlerts = alerts.filter(alert => !dismissedAlerts.has(alert.id));

    // Sort by priority
    return activeAlerts.sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);
  };

  // Memoize smart alerts to avoid recalculating on every render
  const smartAlerts = useMemo(() => {
    return generateSmartAlerts();
  }, [trendData, vendorIntelData, categories, dismissedAlerts, selectedProducts]);

  // Get filtered alerts
  const filteredAlerts = useMemo(() => {
    if (alertFilter === 'all') return smartAlerts;
    return smartAlerts.filter(alert => alert.type === alertFilter);
  }, [smartAlerts, alertFilter]);

  // Get dismissed alerts for display
  const dismissedAlertsForDisplay = useMemo(() => {
    const allAlerts = generateSmartAlerts();
    return Array.from(dismissedAlerts)
      .map(id => allAlerts.find(a => a.id === id))
      .filter(Boolean) as Alert[];
  }, [dismissedAlerts, trendData, vendorIntelData, categories]);

  // Handle dismiss alert
  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(new Set(dismissedAlerts).add(alertId));
  };

  // Handle restore alert
  const handleRestoreAlert = (alertId: string) => {
    const newSet = new Set(dismissedAlerts);
    newSet.delete(alertId);
    setDismissedAlerts(newSet);
  };

  // Alert type counts for filter buttons
  const alertCounts = useMemo(() => {
    return {
      urgent: smartAlerts.filter(a => a.type === 'urgent').length,
      warning: smartAlerts.filter(a => a.type === 'warning').length,
      opportunity: smartAlerts.filter(a => a.type === 'opportunity').length,
      info: smartAlerts.filter(a => a.type === 'info').length,
    };
  }, [smartAlerts]);

  // Alert border colors
  const borderColors = {
    urgent: '#dc2626',
    warning: '#ea580c',
    opportunity: '#16a34a',
    info: '#0284c7',
  };

  return (
    <div>
      {/* Alert Type Filter Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.5rem',
      }}>
        {[
          { type: 'urgent', label: 'Urgent', icon: '🚨', color: '#dc2626' },
          { type: 'warning', label: 'Warnings', icon: '⚠️', color: '#ea580c' },
          { type: 'opportunity', label: 'Opportunities', icon: '💰', color: '#16a34a' },
          { type: 'info', label: 'Info', icon: 'ℹ️', color: '#0284c7' },
        ].map(({ type, label, icon, color }) => {
          const count = alertCounts[type as keyof typeof alertCounts];
          const isActive = alertFilter === type;
          return (
            <button
              key={type}
              onClick={() => setAlertFilter(alertFilter === type ? 'all' : type as AlertFilter)}
              aria-pressed={isActive}
              aria-label={`Filter ${label} alerts (${count})`}
              style={{
                padding: '1rem',
                background: isActive ? color : 'white',
                color: isActive ? 'white' : '#1e293b',
                border: `2px solid ${color}`,
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{icon}</span>
              <span>{label}</span>
              <span style={{
                fontSize: '1.25rem',
                fontWeight: 700,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Actions Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <div>
          {alertFilter !== 'all' && (
            <button
              onClick={() => setAlertFilter('all')}
              aria-label="Show all alerts"
              style={{
                padding: '0.5rem 0.75rem',
                background: '#f8fafc',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              ← Show All
            </button>
          )}
        </div>
        <button
          onClick={() => setShowDismissedAlerts(!showDismissedAlerts)}
          aria-pressed={showDismissedAlerts}
          aria-label={`${showDismissedAlerts ? 'Hide' : 'View'} dismissed alerts (${dismissedAlerts.size})`}
          style={{
            padding: '0.5rem 0.75rem',
            background: showDismissedAlerts ? '#4b006e' : 'white',
            color: showDismissedAlerts ? 'white' : '#4b006e',
            border: `1px solid ${showDismissedAlerts ? '#4b006e' : '#e5e7eb'}`,
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showDismissedAlerts ? 'Hide' : 'View'} Dismissed ({dismissedAlerts.size})
        </button>
      </div>

      {/* Alerts List */}
      {!showDismissedAlerts && filteredAlerts.length === 0 ? (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: '#64748b',
          background: '#f8fafc',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            All Clear
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            No alerts at this time. Your pricing looks stable!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(showDismissedAlerts ? dismissedAlertsForDisplay : filteredAlerts).map(alert => {
            const isDismissed = dismissedAlerts.has(alert.id);

            return (
              <div
                key={alert.id}
                role="alert"
                aria-live={alert.type === 'urgent' ? 'assertive' : 'polite'}
                style={{
                  padding: '1rem',
                  background: 'white',
                  border: `2px solid ${borderColors[alert.type]}`,
                  borderLeft: `6px solid ${borderColors[alert.type]}`,
                  borderRadius: '8px',
                  opacity: isDismissed ? 0.6 : 1,
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.5rem',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                    }}>
                      <span style={{ fontSize: '1.25rem' }} aria-hidden="true">{alert.icon}</span>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                        {alert.title}
                      </h4>
                    </div>
                    <p style={{ fontSize: '0.875rem', margin: '0.5rem 0', color: '#1e293b' }}>
                      {alert.message}
                    </p>
                    {alert.action && (
                      <p style={{
                        fontSize: '0.875rem',
                        margin: '0.5rem 0',
                        color: '#4b006e',
                        fontWeight: 600,
                      }}>
                        💡 {alert.action}
                      </p>
                    )}
                    {alert.context && (
                      <p style={{
                        fontSize: '0.75rem',
                        margin: '0.5rem 0',
                        color: '#64748b',
                        fontStyle: 'italic',
                      }}>
                        {alert.context}
                      </p>
                    )}
                    {alert.amount !== undefined && (
                      <p style={{
                        fontSize: '0.875rem',
                        margin: '0.5rem 0',
                        color: '#16a34a',
                        fontWeight: 700,
                      }}>
                        Amount: ${alert.amount.toFixed(2)}
                      </p>
                    )}
                    {/* Best alternative information */}
                    {alert.bestAlternative && alert.bestAlternative.savings > 0 && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        background: '#dcfce7',
                        border: '1px solid #16a34a',
                        borderRadius: '6px',
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#15803d', marginBottom: '0.25rem' }}>
                          💰 Best Alternative
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#166534' }}>
                          <strong>{alert.bestAlternative.vendor}</strong>: ${alert.bestAlternative.price.toFixed(2)}/unit
                          <span style={{ color: '#16a34a', fontWeight: 600, marginLeft: '0.5rem' }}>
                            (save ${alert.bestAlternative.savings.toFixed(2)}/unit)
                          </span>
                        </div>
                      </div>
                    )}
                    {/* View Details button */}
                    {onNavigateToVendorIntel && alert.categoryId && (
                      <button
                        onClick={() => {
                          onNavigateToVendorIntel({
                            categoryId: alert.categoryId,
                            variant: alert.variant,
                            vendorName: alert.vendor,
                          });
                        }}
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.5rem 1rem',
                          background: '#4b006e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        → View in Vendor Intel
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => isDismissed ? handleRestoreAlert(alert.id) : handleDismissAlert(alert.id)}
                    aria-label={isDismissed ? `Restore ${alert.title}` : `Dismiss ${alert.title}`}
                    style={{
                      padding: '0.5rem 1rem',
                      background: isDismissed ? '#16a34a' : '#f8fafc',
                      color: isDismissed ? 'white' : '#64748b',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isDismissed ? 'Restore' : 'Dismiss'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
