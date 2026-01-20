# Runway Calculator Components

J6: Emergency Fund & Runway Calculator components for Graceful Books.

## Overview

These components help business owners understand how long their business can survive at current burn rate, with sophisticated scenario modeling and personalized recommendations.

## Components

### RunwayDashboard
Main dashboard orchestrating all runway features.

```tsx
import { RunwayDashboard } from '@/components/runway'

<RunwayDashboard
  companyId="company-123"
  targetMonths={6}
  onScenarioClick={() => {/* Handle scenario click */}}
/>
```

**Props:**
- `companyId` (string, required) - Company to analyze
- `targetMonths` (number, optional) - Target runway in months (default: 6)
- `onScenarioClick` (function, optional) - Callback when user clicks "Explore Scenarios"

### RunwayGauge
Visual gauge showing runway with color-coded health status.

```tsx
import { RunwayGauge } from '@/components/runway'

<RunwayGauge
  runwayMonths={5.2}
  targetMonths={6}
  healthStatus="warning"
/>
```

### RunwayTrendChart
Line chart showing runway history over past 12 months.

```tsx
import { RunwayTrendChart } from '@/components/runway'

<RunwayTrendChart
  data={trendDataPoints}
  targetMonths={6}
/>
```

### CashFlowPicture
Revenue vs expenses breakdown with net burn analysis.

```tsx
import { CashFlowPicture } from '@/components/runway'

<CashFlowPicture
  cashFlowData={cashFlowPictureData}
/>
```

### BurnRateAnalyzer
Detailed expense analysis with top categories and fixed/variable breakdown.

```tsx
import { BurnRateAnalyzer } from '@/components/runway'

<BurnRateAnalyzer
  analysis={burnRateAnalysisData}
/>
```

### ScenarioSliders
Interactive dual-slider interface for what-if modeling.

```tsx
import { ScenarioSliders } from '@/components/runway'

<ScenarioSliders
  currentRevenue={12400}
  currentExpenses={8200}
  currentCash={42300}
  currentRunway={5.2}
  onScenarioChange={(scenario) => {/* Handle scenario change */}}
/>
```

### EmergencyFundRecommendations
Personalized runway target recommendations based on business type.

```tsx
import { EmergencyFundRecommendations } from '@/components/runway'

<EmergencyFundRecommendations
  currentCash={42300}
  currentRevenue={12400}
  currentExpenses={8200}
  currentRunway={5.2}
  selectedBusinessType="service-recurring"
  onBusinessTypeChange={(type) => {/* Handle type change */}}
/>
```

## Services

### Runway Calculator Service
Core calculation engine with three methods: Simple, Trend-Adjusted, Seasonal.

```typescript
import {
  calculateRunway,
  calculateRunwayTrend,
  getDateRangeFromPreset,
  suggestCalculationMethod,
} from '@/services/runway'

const dateRange = getDateRangeFromPreset('last-365-days')
const calculation = await calculateRunway('company-123', 'simple', dateRange, 6)
```

### Burn Rate Analyzer Service
Analyzes expenses and revenue sources.

```typescript
import {
  analyzeBurnRate,
  analyzeRevenueBreakdown,
} from '@/services/runway'

const burnRate = await analyzeBurnRate('company-123', dateRange)
const revenue = await analyzeRevenueBreakdown('company-123', dateRange)
```

### Scenario Modeler Service
Models what-if scenarios and generates smart suggestions.

```typescript
import {
  modelRevenueScenario,
  modelExpenseScenario,
  modelCombinedScenario,
  generateSmartSuggestions,
} from '@/services/runway'

const scenario = modelRevenueScenario(
  currentRevenue,
  currentExpenses,
  currentCash,
  { type: 'client-loss', amount: 4000, description: 'Lost Acme Corp' }
)
```

## Key Features

- **Three calculation methods** - Simple average, trend-adjusted, seasonal
- **Confidence ranges** - Shows ranges when volatility is high
- **Smart suggestions** - Auto-suggests relevant scenarios from book data
- **Revenue analysis** - Top clients/products with concentration risk warnings
- **Burn rate breakdown** - Fixed vs variable costs, top 5 expense categories
- **Dual-slider interface** - Real-time runway recalculation
- **Business type recommendations** - Personalized targets (3-18 months)
- **Action plans** - Practical steps to reach runway target
- **WCAG 2.1 AA compliant** - Full keyboard navigation, screen reader support

## WCAG Compliance

All components meet WCAG 2.1 AA standards:
- ✅ Color contrast ≥ 4.5:1 for text
- ✅ Keyboard navigation (Tab, Arrow keys, Page Up/Down)
- ✅ Screen reader alternatives (tables for charts)
- ✅ Focus indicators visible
- ✅ ARIA labels and live regions
- ✅ Semantic HTML

## Styling

All components include CSS files with responsive design and accessibility-compliant colors.

Import CSS in your app:
```typescript
import '@/components/runway/RunwayDashboard.css'
// Or import all at once
```

## Testing

```bash
# Run tests
npm test src/services/runway

# Run with coverage
npm test -- --coverage src/services/runway
```

## Documentation

See `docs/J6_RUNWAY_CALCULATOR_IMPLEMENTATION.md` for complete implementation details.

---

**Built for:** Graceful Books
**Feature:** J6 - Emergency Fund & Runway Calculator
**WCAG:** 2.1 AA Compliant
**Status:** ✅ Implemented
