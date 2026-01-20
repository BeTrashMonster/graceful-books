# Metrics Components

Professional financial metrics reporting components for J4: Key Financial Metrics Reports.

## Components

### MetricsReport
Main dashboard component with 7 category tabs.

**Usage:**
```tsx
<MetricsReport
  companyId="company-123"
  asOfDate={Date.now()}
  liquidityMetrics={liquidityMetrics}
  profitabilityMetrics={profitabilityMetrics}
  efficiencyMetrics={efficiencyMetrics}
  onExport={(format) => handleExport(format)}
  onDrillDown={(metric) => showDetails(metric)}
/>
```

**Features:**
- 7 category tabs (Liquidity, Profitability, Efficiency, Leverage, Cash Flow, Growth, Valuation)
- Keyboard navigation (Arrow keys between tabs)
- Plain English explanations toggle
- Industry benchmarks toggle
- Barter revenue toggle (conditional)
- Export buttons (PDF, Excel)
- Drill-down support
- WCAG 2.1 AA compliant

### TrendChart
12-month trend visualization with accessible fallback.

**Usage:**
```tsx
<TrendChart
  title="Current Ratio Trend"
  dataPoints={metrics.history.current_ratio}
  color="#0066cc"
  height={200}
/>
```

**Features:**
- SVG line chart
- Data table toggle (for screen readers)
- Responsive design
- Tooltip on hover

### PeerBenchmark
Industry comparison visualization.

**Usage:**
```tsx
<PeerBenchmark
  metricName="Current Ratio"
  yourValue="2.5"
  benchmark={industryBenchmark}
  industry="Professional Services"
/>
```

**Features:**
- Visual quartile comparison
- Position indicator
- Plain English interpretation

## Accessibility

All components are WCAG 2.1 AA compliant:
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ Color contrast ≥ 4.5:1
- ✅ Alternative content
- ✅ Focus indicators

## Services

See `src/services/metrics/` for calculation services:
- `LiquidityMetricsService`
- `ProfitabilityMetricsService`
- `EfficiencyMetricsService`
- `LeverageMetricsService`
- And more...

## Types

See `src/types/metrics.types.ts` for all metric type definitions.

## Documentation

Full implementation details in `docs/J4_KEY_FINANCIAL_METRICS_IMPLEMENTATION.md`.
