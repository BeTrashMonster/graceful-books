# Cost Intelligence Tab - Recovered Code

## Summary

This document contains ALL the working Cost Intelligence code that was built before it was destroyed. Extracted from conversation history on 2026-03-04.

The Cost Intelligence feature was built in **CPUTracker.tsx**, NOT HistoricalAnalytics.tsx.

## Key Features Built

1. **Scenario Builder Tab** - Adjustable MSRP and component costs with margin calculations
2. **CPU Trends Tab** - Historical pricing analysis with volatility indicators
3. **Vendor Intel Tab** - Multi-vendor price comparison and savings opportunities
4. **Smart Alerts Tab** - Automated recommendations with dismiss/restore functionality

---

## 1. Core Data Loading Functions

### loadTrendData() Function

Location: CPUTracker.tsx
Extracted from: Line 6670, 2026-03-04T00:59:43.207Z

```typescript
// Load trend data for CPU Trends tab
const loadTrendData = async () => {
  if (selectedProductsForComparison.size === 0) {
    setTrendData(new Map());
    return;
  }

  try {
    const trendMap = new Map<string, any>();

    // Get all unique component categories from selected products
    const componentCategories = new Set<string>();
    selectedProductsForComparison.forEach(productId => {
      const cpuData = productCPUData.get(productId);
      if (cpuData?.breakdown) {
        cpuData.breakdown.forEach(comp => componentCategories.add(comp.categoryId));
      }
    });

    // Calculate date range for trend analysis
    const today = Date.now();
    let startDate = 0;
    switch (trendDateRange) {
      case '3mo':
        startDate = today - (90 * 24 * 60 * 60 * 1000);
        break;
      case '6mo':
        startDate = today - (180 * 24 * 60 * 60 * 1000);
        break;
      case '12mo':
        startDate = today - (365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = 0;
        break;
    }

    // Analyze each component
    for (const categoryId of componentCategories) {
      const relevantInvoices = invoices.filter(inv => {
        if (startDate > 0 && inv.invoice_date < startDate) return false;
        return inv.line_items?.some(item => item.category_id === categoryId);
      });

      if (relevantInvoices.length === 0) continue;

      // Get all prices for this component
      const prices: number[] = [];
      const dates: number[] = [];
      relevantInvoices.forEach(inv => {
        inv.line_items?.forEach(item => {
          if (item.category_id === categoryId && item.total) {
            const price = parseFloat(item.total) / (item.quantity || 1);
            prices.push(price);
            dates.push(inv.invoice_date);
          }
        });
      });

      if (prices.length === 0) continue;

      // Calculate stats
      const currentPrice = prices[prices.length - 1];
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceChange = ((currentPrice - avgPrice) / avgPrice) * 100;

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
```

### loadVendorIntelData() Function

Location: CPUTracker.tsx
Extracted from: Line 6670, 2026-03-04T00:59:43.207Z

```typescript
// Load vendor intelligence data
const loadVendorIntelData = async () => {
  if (selectedProductsForComparison.size === 0) {
    setVendorIntelData(new Map());
    return;
  }

  try {
    const intelMap = new Map<string, any>();

    // Get all unique component categories from selected products
    const componentCategories = new Set<string>();
    selectedProductsForComparison.forEach(productId => {
      const cpuData = productCPUData.get(productId);
      if (cpuData?.breakdown) {
        cpuData.breakdown.forEach(comp => componentCategories.add(comp.categoryId));
      }
    });

    // Analyze each component
    for (const categoryId of componentCategories) {
      const relevantInvoices = invoices.filter(inv =>
        inv.line_items?.some(item => item.category_id === categoryId)
      );

      if (relevantInvoices.length === 0) continue;

      // Group by vendor
      const vendorPrices = new Map<string, number[]>();
      const vendorTotals = new Map<string, number>();

      relevantInvoices.forEach(inv => {
        const vendor = inv.vendor || 'Unknown';
        inv.line_items?.forEach(item => {
          if (item.category_id === categoryId && item.total) {
            const price = parseFloat(item.total) / (item.quantity || 1);
            if (!vendorPrices.has(vendor)) {
              vendorPrices.set(vendor, []);
              vendorTotals.set(vendor, 0);
            }
            vendorPrices.get(vendor)!.push(price);
            vendorTotals.set(vendor, vendorTotals.get(vendor)! + parseFloat(item.total));
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
      const priceStdDev = Math.sqrt(priceValues.reduce((sum, p) => sum + Math.pow(p - priceAvg, 2), 0) / priceValues.length);

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
```

---

## 2. Smart Alerts Generation Function

### generateSmartAlerts() Function

Location: CPUTracker.tsx
Extracted from: Line 6650, 2026-03-04T00:57:54.206Z

This is the COMPREHENSIVE version with 11 different alert types:

```typescript
// Generate Smart Alerts based on trend and vendor data
const generateSmartAlerts = () => {
  const alerts: Array<{
    id: string;
    type: 'urgent' | 'warning' | 'opportunity' | 'info';
    icon: string;
    title: string;
    message: string;
    component?: string;
    amount?: number;
    action?: string;
    context?: string;
  }> = [];

  const priorityOrder = { urgent: 1, warning: 2, opportunity: 3, info: 4 };

  // Analyze trend data for alerts
  trendData.forEach((trend, componentId) => {
    const category = categories.find(c => c.id === componentId);
    if (!category) return;

    const current = trend.currentPrice || 0;
    const avg = trend.avgPrice || 0;
    const change = trend.priceChange || 0;
    const volatility = trend.volatility || 'low';
    const lastBuyDate = trend.lastBuyDate || 0;
    const daysSinceLastBuy = (Date.now() - lastBuyDate) / (1000 * 60 * 60 * 24);

    // 1. Price Spike Alert (>20% increase)
    if (change > 20) {
      alerts.push({
        id: `spike-${componentId}`,
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
        id: `increase-${componentId}`,
        type: 'warning',
        icon: '⚠️',
        title: 'Price Increase Detected',
        message: `${category.name} has increased ${change.toFixed(1)}%`,
        component: category.name,
        amount: change,
        action: 'Monitor closely and review pricing strategy',
        context: `Current: $${current.toFixed(2)} | Average: $${avg.toFixed(2)}`,
      });
    }

    // 3. Volatile & Rising
    if (volatility === 'high' && change > 5) {
      alerts.push({
        id: `volatile-${componentId}`,
        type: 'warning',
        icon: '📊',
        title: 'Volatile Pricing Trend',
        message: `${category.name} shows high price volatility with upward trend`,
        component: category.name,
        action: 'Consider hedging strategies or supplier diversification',
      });
    }

    // 4. Outdated Data (90+ days since last purchase)
    if (daysSinceLastBuy > 90 && trend.invoiceCount && (trend.invoiceCount as number) > 0) {
      alerts.push({
        id: `stale-${componentId}`,
        type: 'info',
        icon: '📅',
        title: 'Outdated Pricing Data',
        message: `${category.name} hasn't been purchased in ${Math.round(daysSinceLastBuy)} days`,
        component: category.name,
        action: 'Verify current market prices before next order',
      });
    }

    // 5. Stable Pricing (low volatility, <3% change)
    if (volatility === 'low' && Math.abs(change) < 3 && trend.invoiceCount && (trend.invoiceCount as number) >= 3) {
      alerts.push({
        id: `stable-${componentId}`,
        type: 'info',
        icon: '✅',
        title: 'Stable Pricing',
        message: `${category.name} shows consistent, reliable pricing`,
        component: category.name,
        context: `${trend.invoiceCount} invoices analyzed`,
      });
    }

    // 6. Low Activity (1-2 invoices only)
    if (trend.invoiceCount && (trend.invoiceCount as number) > 0 && (trend.invoiceCount as number) <= 2) {
      alerts.push({
        id: `low-activity-${componentId}`,
        type: 'info',
        icon: 'ℹ️',
        title: 'Limited Purchase History',
        message: `${category.name} has only ${trend.invoiceCount} invoice(s) on record`,
        component: category.name,
        action: 'Collect more data for better trend analysis',
      });
    }
  });

  // Analyze vendor data for alerts
  vendorIntelData.forEach((intel, componentId) => {
    const category = categories.find(c => c.id === componentId);
    if (!category) return;

    const vendorCount = intel.vendors?.size || 0;
    const bestPrice = intel.bestPrice || 0;
    const avgPrice = intel.avgPrice || 0;
    const maxSavings = intel.maxSavings || 0;
    const savingsPercent = avgPrice > 0 ? (maxSavings / avgPrice) * 100 : 0;

    // 7. Significant Savings Opportunity (>15%)
    if (savingsPercent > 15) {
      alerts.push({
        id: `savings-${componentId}`,
        type: 'opportunity',
        icon: '💰',
        title: 'Significant Savings Available',
        message: `${category.name}: Save up to ${savingsPercent.toFixed(1)}% by switching vendors`,
        component: category.name,
        amount: maxSavings,
        action: `Best price: $${bestPrice.toFixed(2)} vs current average: $${avgPrice.toFixed(2)}`,
      });
    }

    // 8. Moderate Savings (5-15%)
    else if (savingsPercent >= 5 && savingsPercent <= 15) {
      alerts.push({
        id: `moderate-savings-${componentId}`,
        type: 'opportunity',
        icon: '💵',
        title: 'Potential Savings',
        message: `${category.name}: Save ${savingsPercent.toFixed(1)}% with better vendor selection`,
        component: category.name,
        amount: maxSavings,
      });
    }

    // 9. Vendor Concentration Risk (80%+ from single vendor)
    if (intel.vendorConcentration && intel.topVendor && intel.topVendorPercent && intel.topVendorPercent > 80) {
      alerts.push({
        id: `concentration-${componentId}`,
        type: 'warning',
        icon: '⚖️',
        title: 'High Vendor Concentration',
        message: `${category.name}: ${intel.topVendorPercent.toFixed(0)}% purchased from ${intel.topVendor}`,
        component: category.name,
        action: 'Consider diversifying suppliers to reduce risk',
      });
    }

    // 10. Single-Source Component
    if (vendorCount === 1) {
      alerts.push({
        id: `single-source-${componentId}`,
        type: 'warning',
        icon: '🔗',
        title: 'Single-Source Component',
        message: `${category.name} is only purchased from one vendor`,
        component: category.name,
        action: 'Identify backup suppliers to mitigate supply chain risk',
      });
    }

    // 11. Price Anomaly (one vendor significantly higher/lower)
    if (intel.priceAnomaly && intel.anomalyVendor && intel.anomalyDeviation) {
      const direction = intel.anomalyDeviation > 0 ? 'higher' : 'lower';
      alerts.push({
        id: `anomaly-${componentId}`,
        type: 'info',
        icon: '🔍',
        title: 'Price Anomaly Detected',
        message: `${category.name}: ${intel.anomalyVendor} is ${Math.abs(intel.anomalyDeviation).toFixed(1)}% ${direction} than average`,
        component: category.name,
        action: direction === 'higher' ? 'Investigate pricing discrepancy' : 'Verify quality and terms',
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
}, [trendData, vendorIntelData, categories, dismissedAlerts]);

// Persist dismissed alerts to localStorage
useEffect(() => {
  localStorage.setItem('cpu-dismissed-alerts', JSON.stringify(Array.from(dismissedAlerts)));
}, [dismissedAlerts]);
```

---

## 3. Required State Variables

Add these state variables to CPUTracker.tsx:

```typescript
// Cost Intelligence state
const [intelligenceTab, setIntelligenceTab] = useState<'scenario' | 'trends' | 'vendors' | 'alerts'>('scenario');
const [trendData, setTrendData] = useState<Map<string, any>>(new Map());
const [vendorIntelData, setVendorIntelData] = useState<Map<string, any>>(new Map());
const [trendDateRange, setTrendDateRange] = useState<'3mo' | '6mo' | '12mo' | 'all'>('12mo');
const [trendFilter, setTrendFilter] = useState<'all' | 'high-volatility' | 'increasing' | 'decreasing'>('all');
const [trendSortColumn, setTrendSortColumn] = useState<string>('component');
const [trendSortDirection, setTrendSortDirection] = useState<'asc' | 'desc'>('asc');
const [showTrendExportMenu, setShowTrendExportMenu] = useState(false);
const [vendorSortColumn, setVendorSortColumn] = useState<string>('component');
const [vendorSortDirection, setVendorSortDirection] = useState<'asc' | 'desc'>('asc');
const [showVendorExportMenu, setShowVendorExportMenu] = useState(false);
const [alertFilter, setAlertFilter] = useState<'all' | 'urgent' | 'warning' | 'opportunity' | 'info'>('all');
const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
const [showDismissedAlerts, setShowDismissedAlerts] = useState(false);

// Load dismissed alerts from localStorage on mount
useEffect(() => {
  const stored = localStorage.getItem('cpu-dismissed-alerts');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      setDismissedAlerts(new Set(parsed));
    } catch (e) {
      console.error('Failed to parse dismissed alerts:', e);
    }
  }
}, []);
```

---

## 4. Tab Navigation JSX

Extracted from: Line 7079, 2026-03-04T04:25:42.814Z

```tsx
{/* Tab Navigation */}
<div style={{
  display: 'flex',
  gap: '0.5rem',
  padding: '0.75rem',
  background: '#f8fafc',
  borderBottom: '2px solid #e5e7eb',
}}>
  <button
    onClick={() => setIntelligenceTab('scenario')}
    style={{
      flex: 1,
      padding: '0.75rem 1rem',
      border: 'none',
      background: intelligenceTab === 'scenario' ? '#4b006e' : 'white',
      borderRadius: '8px',
      fontWeight: 600,
      color: intelligenceTab === 'scenario' ? 'white' : '#64748b',
      cursor: 'pointer',
      fontSize: '0.875rem',
      transition: 'all 0.2s',
    }}
  >
    Scenario Builder
  </button>
  <button
    onClick={() => setIntelligenceTab('trends')}
    style={{
      flex: 1,
      padding: '0.75rem 1rem',
      border: 'none',
      background: intelligenceTab === 'trends' ? '#4b006e' : 'white',
      borderRadius: '8px',
      fontWeight: 600,
      color: intelligenceTab === 'trends' ? 'white' : '#64748b',
      cursor: 'pointer',
      fontSize: '0.875rem',
      transition: 'all 0.2s',
    }}
  >
    CPU Trends
  </button>
  <button
    onClick={() => setIntelligenceTab('vendors')}
    style={{
      flex: 1,
      padding: '0.75rem 1rem',
      border: 'none',
      background: intelligenceTab === 'vendors' ? '#4b006e' : 'white',
      borderRadius: '8px',
      fontWeight: 600,
      color: intelligenceTab === 'vendors' ? 'white' : '#64748b',
      cursor: 'pointer',
      fontSize: '0.875rem',
      transition: 'all 0.2s',
    }}
  >
    Vendor Intel
  </button>
  <button
    onClick={() => setIntelligenceTab('alerts')}
    style={{
      flex: 1,
      padding: '0.75rem 1rem',
      border: 'none',
      background: intelligenceTab === 'alerts' ? '#4b006e' : 'white',
      borderRadius: '8px',
      fontWeight: 600,
      color: intelligenceTab === 'alerts' ? 'white' : '#64748b',
      cursor: 'pointer',
      fontSize: '0.875rem',
      transition: 'all 0.2s',
    }}
  >
    Smart Alerts
  </button>
</div>
```

---

## 5. Vendor Intel Tab JSX

See the full 315-line implementation in the original extraction file at lines 1211-1520.

Key features:
- Header with title and export dropdown
- Overview cards showing: Total Vendors, Total Spend, Invoices, Components
- Sortable comparison table with columns: Component, Vendors, Best Price, Avg Price, Potential Savings
- Green highlighting for best prices
- Red highlighting for savings opportunities
- Empty state when no products selected

---

## 6. Smart Alerts Tab JSX

See the full implementation in the original extraction file at lines 1551-1760.

Key features:
- Header with title and description
- 4 summary cards (Urgent, Warnings, Opportunities, Info) - clickable to filter
- Filter by type functionality
- Dismiss/Restore alert functionality with localStorage persistence
- Color-coded alerts: Red (urgent), Orange (warning), Green (opportunity), Blue (info)
- Alert cards with: Icon, Title, Message, Action recommendation, Context
- View dismissed alerts toggle

---

## 7. useEffect Hooks for Data Loading

Add these useEffect hooks to trigger data loading:

```typescript
// Load trend and vendor data when products are selected
useEffect(() => {
  if (selectedProductsForComparison.size > 0) {
    loadTrendData();
    loadVendorIntelData();
  }
}, [selectedProductsForComparison, trendDateRange]);
```

---

## Notes

1. **Dark Purple Branding**: All active tabs and buttons use `#4b006e` background color with white text
2. **Compact Styling**: Most elements use 0.75rem - 0.875rem font sizes for professional, space-efficient design
3. **Export Functionality**: Export dropdowns are present but event handlers need to be implemented
4. **Smart Sorting**: Both Trends and Vendor Intel tables support column sorting
5. **localStorage Persistence**: Dismissed alerts are saved and restored across sessions
6. **Empty States**: All tabs have proper empty states with helpful messaging

---

## Implementation Checklist

- [ ] Copy state variables into CPUTracker.tsx
- [ ] Copy loadTrendData() function
- [ ] Copy loadVendorIntelData() function
- [ ] Copy generateSmartAlerts() function
- [ ] Copy tab navigation JSX
- [ ] Copy Vendor Intel tab JSX (see full file for complete code)
- [ ] Copy Smart Alerts tab JSX (see full file for complete code)
- [ ] Add useEffect hooks for data loading
- [ ] Test product selection triggers data loading
- [ ] Test alert dismiss/restore with localStorage
- [ ] Implement export functionality (CSV/PDF)

---

## Timeline

- **March 3, 2026 19:38-20:12 UTC**: Initial Cost Intelligence builds
- **March 4, 2026 00:55-01:02 UTC**: Major feature completion (Vendor Intel, Smart Alerts)
- **March 4, 2026 04:25 UTC**: Final tab navigation styling polish
- **March 4, 2026 04:40 UTC**: Code confirmed working before destruction

---

End of recovered code documentation.
