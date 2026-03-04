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
}

interface VendorIntelData {
  vendors: Map<string, number[]>;
  vendorAvgPrices: Map<string, number>;
  bestPrice: number;
  avgPrice: number;
  maxSavings: number;
  topVendor: string;
  topVendorSpend: number;
  topVendorPercent: number;
  vendorConcentration: boolean;
  priceAnomaly: boolean;
  anomalyVendor: string;
  anomalyDeviation: number;
}

interface Alert {
  id: string;
  type: 'urgent' | 'warning' | 'opportunity' | 'info';
  icon: string;
  title: string;
  message: string;
  component?: string;
  amount?: number;
  action?: string;
  context?: string;
}

type AlertFilter = 'all' | 'urgent' | 'warning' | 'opportunity' | 'info';

export default function SmartAlertsTab({
  companyId,
  selectedProducts,
  productCPUData,
  categories,
  invoices,
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

  // Load trend data for alert generation
  useEffect(() => {
    const loadTrendData = async () => {
      if (selectedProducts.size === 0) {
        setTrendData(new Map());
        return;
      }

      try {
        const trendMap = new Map<string, TrendData>();

        // Get all unique component categories from selected products
        const componentCategories = new Set<string>();
        selectedProducts.forEach(productId => {
          const cpuData = productCPUData.get(productId);
          if (cpuData?.breakdown) {
            cpuData.breakdown.forEach(comp => componentCategories.add(comp.categoryId));
          }
        });

        // Use all-time data for alerts (most comprehensive)
        const startDate = 0;

        // Analyze each component
        for (const categoryId of componentCategories) {
          const relevantInvoices = invoices.filter(inv => {
            if (startDate > 0 && inv.invoice_date < startDate) return false;
            return Object.entries(inv.cost_attribution || {}).some(([_, attr]) =>
              attr.category_id === categoryId
            );
          });

          if (relevantInvoices.length === 0) continue;

          // Get all prices for this component
          const prices: number[] = [];
          const dates: number[] = [];
          relevantInvoices.forEach(inv => {
            Object.entries(inv.cost_attribution || {}).forEach(([_, attr]) => {
              if (attr.category_id === categoryId) {
                const unitPrice = parseFloat(attr.unit_price);
                if (!isNaN(unitPrice) && unitPrice > 0) {
                  prices.push(unitPrice);
                  dates.push(inv.invoice_date);
                }
              }
            });
          });

          if (prices.length === 0) continue;

          // Calculate stats
          const currentPrice = prices[prices.length - 1] || 0;
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

          trendMap.set(categoryId, {
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
          });
        }

        setTrendData(trendMap);
      } catch (err) {
        console.error('Failed to load trend data:', err);
      }
    };

    loadTrendData();
  }, [selectedProducts, productCPUData, invoices]);

  // Load vendor intelligence data for alert generation
  useEffect(() => {
    const loadVendorIntelData = async () => {
      if (!companyId || selectedProducts.size === 0) {
        setVendorIntelData(new Map());
        return;
      }

      try {
        const intelMap = new Map<string, VendorIntelData>();

        // Get all unique component categories from selected products
        const componentCategories = new Set<string>();
        selectedProducts.forEach(productId => {
          const cpuData = productCPUData.get(productId);
          if (cpuData?.breakdown) {
            cpuData.breakdown.forEach(comp => componentCategories.add(comp.categoryId));
          }
        });

        // Analyze each component
        for (const categoryId of componentCategories) {
          const relevantInvoices = invoices.filter(inv =>
            Object.entries(inv.cost_attribution || {}).some(([_, attr]) =>
              attr.category_id === categoryId
            )
          );

          if (relevantInvoices.length === 0) continue;

          // Group by vendor
          const vendorPrices = new Map<string, number[]>();
          const vendorTotals = new Map<string, number>();

          relevantInvoices.forEach(inv => {
            const vendor = inv.vendor_name || 'Unknown';
            Object.entries(inv.cost_attribution || {}).forEach(([_, attr]) => {
              if (attr.category_id === categoryId) {
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

          intelMap.set(categoryId, {
            vendors: vendorPrices,
            vendorAvgPrices,
            bestPrice,
            avgPrice,
            maxSavings,
            topVendor,
            topVendorSpend,
            topVendorPercent,
            vendorConcentration: topVendorPercent > 80,
            priceAnomaly: anomalyVendor !== '',
            anomalyVendor,
            anomalyDeviation,
          });
        }

        setVendorIntelData(intelMap);
      } catch (err) {
        console.error('Failed to load vendor intel data:', err);
      }
    };

    loadVendorIntelData();
  }, [companyId, selectedProducts, productCPUData, invoices]);

  /**
   * Generate smart alerts based on trend and vendor data
   */
  const generateSmartAlerts = (): Alert[] => {
    const alerts: Alert[] = [];
    const priorityOrder = { urgent: 1, warning: 2, opportunity: 3, info: 4 };

    // Analyze trend data for alerts
    trendData.forEach((trend, categoryId) => {
      const category = categories.find(c => c.id === categoryId);
      if (!category) return;

      const current = trend.currentPrice || 0;
      const avg = trend.avgPrice || 0;
      const change = trend.priceChange || 0;
      const volatility = trend.volatility || 'low';
      const lastBuyDate = trend.lastBuyDate || 0;
      const daysSinceLastBuy = (Date.now() - lastBuyDate) / (1000 * 60 * 60 * 24);
      const invoiceCount = trend.invoiceCount || 0;

      // Skip if insufficient data (need at least 2 purchases)
      if (invoiceCount < 2) return;

      // 1. Price Spike Alert (>20% increase)
      if (change > 20) {
        alerts.push({
          id: `spike-${categoryId}`,
          type: 'urgent',
          icon: '🚨',
          title: 'Significant Price Spike',
          message: `${category.name} has increased ${change.toFixed(1)}% recently`,
          component: category.name,
          amount: change,
          action: 'Consider alternative suppliers or locking in prices',
          context: `Current: $${current.toFixed(2)} | Average: $${avg.toFixed(2)}`,
        });
      }

      // 2. Moderate Price Increase (10-20%)
      else if (change > 10 && change <= 20) {
        alerts.push({
          id: `increase-${categoryId}`,
          type: 'warning',
          icon: '⚠️',
          title: 'Price Increase Detected',
          message: `${category.name} has increased ${change.toFixed(1)}%`,
          component: category.name,
          amount: change,
          action: 'Monitor closely for further increases',
          context: `Current: $${current.toFixed(2)} | Average: $${avg.toFixed(2)}`,
        });
      }

      // 3. High Volatility Warning
      if (volatility === 'high') {
        alerts.push({
          id: `volatility-${categoryId}`,
          type: 'warning',
          icon: '📊',
          title: 'High Price Volatility',
          message: `${category.name} shows high price volatility`,
          component: category.name,
          action: 'Consider long-term contracts to stabilize costs',
          context: `Coefficient of Variation: ${(trend.coefficientOfVariation * 100).toFixed(1)}%`,
        });
      }

      // 4. Price Drop Opportunity (< -10%)
      if (change < -10) {
        alerts.push({
          id: `drop-${categoryId}`,
          type: 'opportunity',
          icon: '💰',
          title: 'Price Drop Opportunity',
          message: `${category.name} has decreased ${Math.abs(change).toFixed(1)}%`,
          component: category.name,
          amount: Math.abs(change),
          action: 'Consider increasing order quantity',
          context: `Current: $${current.toFixed(2)} | Average: $${avg.toFixed(2)}`,
        });
      }

      // 5. Stable Low Price
      if (volatility === 'low' && change > -5 && change < 5 && current < avg) {
        alerts.push({
          id: `stable-low-${categoryId}`,
          type: 'opportunity',
          icon: '✅',
          title: 'Stable Low Price',
          message: `${category.name} is stable and below average`,
          component: category.name,
          action: 'Good time to stock up',
          context: `Current: $${current.toFixed(2)} | Average: $${avg.toFixed(2)}`,
        });
      }

      // 6. Stale Data Warning (>90 days since last purchase)
      if (daysSinceLastBuy > 90) {
        alerts.push({
          id: `stale-${categoryId}`,
          type: 'info',
          icon: 'ℹ️',
          title: 'Outdated Pricing Data',
          message: `${category.name} hasn't been purchased in ${Math.floor(daysSinceLastBuy)} days`,
          component: category.name,
          action: 'Update pricing data with recent purchase',
          context: `Last purchase: ${new Date(lastBuyDate).toLocaleDateString()}`,
        });
      }

      // 7. Low Data Quality (< 5 purchases)
      if (invoiceCount < 5 && invoiceCount >= 2) {
        alerts.push({
          id: `low-data-${categoryId}`,
          type: 'info',
          icon: '📉',
          title: 'Limited Purchase History',
          message: `Only ${invoiceCount} purchases for ${category.name}`,
          component: category.name,
          action: 'More purchases will improve trend accuracy',
          context: 'Trend analysis may be less reliable',
        });
      }
    });

    // Analyze vendor data for alerts
    vendorIntelData.forEach((intel, categoryId) => {
      const category = categories.find(c => c.id === categoryId);
      if (!category) return;

      const vendorCount = intel.vendors.size;
      const bestPrice = intel.bestPrice || 0;
      const avgPrice = intel.avgPrice || 0;
      const maxSavings = intel.maxSavings || 0;
      const savingsPercent = avgPrice > 0 ? (maxSavings / avgPrice) * 100 : 0;

      // 8. Significant Savings Opportunity (>15% difference)
      if (savingsPercent > 15 && vendorCount > 1) {
        alerts.push({
          id: `savings-${categoryId}`,
          type: 'opportunity',
          icon: '💵',
          title: 'Significant Savings Available',
          message: `Save ${savingsPercent.toFixed(0)}% on ${category.name}`,
          component: category.name,
          amount: maxSavings,
          action: `Switch to lowest-cost vendor ($${bestPrice.toFixed(2)}/unit)`,
          context: `Current average: $${avgPrice.toFixed(2)}/unit`,
        });
      }

      // 9. Vendor Concentration Risk (>80% from single vendor)
      if (intel.vendorConcentration && intel.topVendor && intel.topVendorPercent > 80) {
        alerts.push({
          id: `concentration-${categoryId}`,
          type: 'warning',
          icon: '⚖️',
          title: 'High Vendor Concentration',
          message: `${category.name}: ${intel.topVendorPercent.toFixed(0)}% purchased from ${intel.topVendor}`,
          component: category.name,
          action: 'Consider diversifying suppliers to reduce risk',
          context: `Supply chain dependency on single vendor`,
        });
      }

      // 10. Single-Source Component
      if (vendorCount === 1) {
        alerts.push({
          id: `single-source-${categoryId}`,
          type: 'warning',
          icon: '🔗',
          title: 'Single-Source Component',
          message: `${category.name} is only purchased from one vendor`,
          component: category.name,
          action: 'Identify backup suppliers to mitigate supply chain risk',
          context: 'High supply chain vulnerability',
        });
      }

      // 11. Price Anomaly (one vendor significantly different)
      if (intel.priceAnomaly && intel.anomalyVendor && intel.anomalyDeviation) {
        const direction = intel.anomalyDeviation > 0 ? 'higher' : 'lower';
        alerts.push({
          id: `anomaly-${categoryId}`,
          type: 'info',
          icon: '🔍',
          title: 'Price Anomaly Detected',
          message: `${category.name}: ${intel.anomalyVendor} is ${Math.abs(intel.anomalyDeviation).toFixed(1)}% ${direction} than average`,
          component: category.name,
          action: direction === 'higher' ? 'Investigate pricing discrepancy' : 'Verify quality and terms',
          context: `Market price variance detected`,
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
