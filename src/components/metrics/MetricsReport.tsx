/**
 * MetricsReport Component
 *
 * Professional financial metrics dashboard with 7 categories of ratios.
 * Includes barter revenue integration, trend analysis, and peer benchmarking.
 *
 * Requirements: J4 - Key Financial Metrics Reports (Nice)
 */

import { useState } from 'react';
import type {
  LiquidityMetrics,
  ProfitabilityMetrics,
  EfficiencyMetrics,
  LeverageMetrics,
  CashFlowMetrics,
  GrowthMetrics,
  ValuationMetrics,
  MetricCategory,
  ExportFormat,
} from '../../types/metrics.types';
import { TrendChart } from './TrendChart';

export interface MetricsReportProps {
  companyId: string;
  asOfDate: number;
  liquidityMetrics?: LiquidityMetrics;
  profitabilityMetrics?: ProfitabilityMetrics;
  efficiencyMetrics?: EfficiencyMetrics;
  leverageMetrics?: LeverageMetrics;
  cashFlowMetrics?: CashFlowMetrics;
  growthMetrics?: GrowthMetrics;
  valuationMetrics?: ValuationMetrics;
  onExport?: (format: ExportFormat) => void;
  onDrillDown?: (metricName: string) => void;
}

export function MetricsReport({
  companyId: _companyId,
  asOfDate,
  liquidityMetrics,
  profitabilityMetrics,
  efficiencyMetrics,
  leverageMetrics,
  cashFlowMetrics,
  growthMetrics,
  valuationMetrics,
  onExport,
  onDrillDown,
}: MetricsReportProps) {
  const [activeCategory, setActiveCategory] = useState<MetricCategory>('liquidity');
  const [showExplanations, setShowExplanations] = useState(true);
  const [showBenchmarks, setShowBenchmarks] = useState(false);
  const [barterIncluded, setBarterIncluded] = useState(true);

  // Check if barter transactions exist
  const hasBarterTransactions = profitabilityMetrics?.barter_options.has_barter_transactions || false;

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div style={{ maxWidth: '1400px', padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, marginBottom: '0.5rem' }}>Key Financial Metrics</h1>
        <p style={{ margin: 0, color: '#666' }}>
          Professional financial ratio analysis as of {formatDate(asOfDate)}
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => setShowExplanations(!showExplanations)}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: showExplanations ? '#0066cc' : 'white',
            color: showExplanations ? 'white' : '#333',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
          aria-pressed={showExplanations}
        >
          {showExplanations ? 'Hide' : 'Show'} Explanations
        </button>

        <button
          type="button"
          onClick={() => setShowBenchmarks(!showBenchmarks)}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: showBenchmarks ? '#0066cc' : 'white',
            color: showBenchmarks ? 'white' : '#333',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
          aria-pressed={showBenchmarks}
        >
          {showBenchmarks ? 'Hide' : 'Show'} Industry Benchmarks
        </button>

        {/* Barter Toggle - only shown if barter transactions exist */}
        {hasBarterTransactions && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#f9f9f9',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={barterIncluded}
              onChange={(e) => setBarterIncluded(e.target.checked)}
              style={{ cursor: 'pointer' }}
              aria-label="Include barter revenue in calculations"
            />
            <span style={{ fontSize: '0.9rem' }}>
              Include Barter Revenue <span aria-hidden="true">↔</span>
            </span>
          </label>
        )}

        {/* Export Buttons */}
        {onExport && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => onExport('pdf')}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
              aria-label="Export metrics report to PDF"
            >
              Export to PDF
            </button>
            <button
              type="button"
              onClick={() => onExport('excel')}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
              aria-label="Export metrics report to Excel"
            >
              Export to Excel
            </button>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div
        role="tablist"
        aria-label="Financial metrics categories"
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #e0e0e0',
          marginBottom: '2rem',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'liquidity', label: 'Liquidity' },
          { id: 'profitability', label: 'Profitability' },
          { id: 'efficiency', label: 'Efficiency' },
          { id: 'leverage', label: 'Leverage' },
          { id: 'cash_flow', label: 'Cash Flow' },
          { id: 'growth', label: 'Growth' },
          { id: 'valuation', label: 'Valuation' },
        ].map((category) => (
          <button
            key={category.id}
            role="tab"
            type="button"
            aria-selected={activeCategory === category.id}
            aria-controls={`${category.id}-panel`}
            id={`${category.id}-tab`}
            onClick={() => setActiveCategory(category.id as MetricCategory)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                // Keyboard navigation between tabs
                const categories = ['liquidity', 'profitability', 'efficiency', 'leverage', 'cash_flow', 'growth', 'valuation'];
                const currentIndex = categories.indexOf(activeCategory);
                const newIndex = e.key === 'ArrowLeft'
                  ? Math.max(0, currentIndex - 1)
                  : Math.min(categories.length - 1, currentIndex + 1);
                setActiveCategory(categories[newIndex] as MetricCategory);
              }
            }}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: activeCategory === category.id ? 600 : 400,
              color: activeCategory === category.id ? '#0066cc' : '#666',
              borderBottom: activeCategory === category.id ? '3px solid #0066cc' : 'none',
              marginBottom: activeCategory === category.id ? '-2px' : '0',
              whiteSpace: 'nowrap',
            }}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeCategory === 'liquidity' && liquidityMetrics && (
        <div role="tabpanel" id="liquidity-panel" aria-labelledby="liquidity-tab">
          <LiquidityPanel
            metrics={liquidityMetrics}
            showExplanations={showExplanations}
            showBenchmarks={showBenchmarks}
            onDrillDown={onDrillDown}
          />
        </div>
      )}

      {activeCategory === 'profitability' && profitabilityMetrics && (
        <div role="tabpanel" id="profitability-panel" aria-labelledby="profitability-tab">
          <ProfitabilityPanel
            metrics={profitabilityMetrics}
            showExplanations={showExplanations}
            showBenchmarks={showBenchmarks}
            barterIncluded={barterIncluded}
            onDrillDown={onDrillDown}
          />
        </div>
      )}

      {activeCategory === 'efficiency' && efficiencyMetrics && (
        <div role="tabpanel" id="efficiency-panel" aria-labelledby="efficiency-tab">
          <EfficiencyPanel
            metrics={efficiencyMetrics}
            showExplanations={showExplanations}
            showBenchmarks={showBenchmarks}
            onDrillDown={onDrillDown}
          />
        </div>
      )}

      {activeCategory === 'leverage' && leverageMetrics && (
        <div role="tabpanel" id="leverage-panel" aria-labelledby="leverage-tab">
          <LeveragePanel
            metrics={leverageMetrics}
            showExplanations={showExplanations}
            showBenchmarks={showBenchmarks}
            onDrillDown={onDrillDown}
          />
        </div>
      )}

      {activeCategory === 'cash_flow' && cashFlowMetrics && (
        <div role="tabpanel" id="cash_flow-panel" aria-labelledby="cash_flow-tab">
          <CashFlowPanel
            metrics={cashFlowMetrics}
            showExplanations={showExplanations}
            showBenchmarks={showBenchmarks}
            onDrillDown={onDrillDown}
          />
        </div>
      )}

      {activeCategory === 'growth' && growthMetrics && (
        <div role="tabpanel" id="growth-panel" aria-labelledby="growth-tab">
          <GrowthPanel
            metrics={growthMetrics}
            showExplanations={showExplanations}
            showBenchmarks={showBenchmarks}
            onDrillDown={onDrillDown}
          />
        </div>
      )}

      {activeCategory === 'valuation' && valuationMetrics && (
        <div role="tabpanel" id="valuation-panel" aria-labelledby="valuation-tab">
          <ValuationPanel
            metrics={valuationMetrics}
            showExplanations={showExplanations}
            showBenchmarks={showBenchmarks}
            onDrillDown={onDrillDown}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Category Panels
// =============================================================================

interface PanelProps {
  showExplanations: boolean;
  showBenchmarks: boolean;
  onDrillDown?: (metricName: string) => void;
}

interface LiquidityPanelProps extends PanelProps {
  metrics: LiquidityMetrics;
}

function LiquidityPanel({ metrics, showExplanations, showBenchmarks, onDrillDown }: LiquidityPanelProps) {
  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Liquidity Ratios</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Can you pay your bills? These metrics measure your ability to meet short-term obligations.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <MetricCard
          name="Current Ratio"
          metric={metrics.current_ratio}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Quick Ratio"
          metric={metrics.quick_ratio}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Cash Ratio"
          metric={metrics.cash_ratio}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Working Capital"
          metric={metrics.working_capital}
          showExplanation={showExplanations}
          showBenchmark={false}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Cash Runway"
          metric={metrics.cash_runway_months}
          showExplanation={showExplanations}
          showBenchmark={false}
          onDrillDown={onDrillDown}
        />
      </div>

      {/* Trend Charts */}
      {metrics.history.current_ratio.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h3>12-Month Trends</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '1rem' }}>
            <TrendChart
              title="Current Ratio Trend"
              dataPoints={metrics.history.current_ratio}
              color="#0066cc"
            />
            <TrendChart
              title="Quick Ratio Trend"
              dataPoints={metrics.history.quick_ratio}
              color="#2e7d32"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface ProfitabilityPanelProps extends PanelProps {
  metrics: ProfitabilityMetrics;
  barterIncluded: boolean;
}

function ProfitabilityPanel({ metrics, showExplanations, showBenchmarks, barterIncluded, onDrillDown }: ProfitabilityPanelProps) {
  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Profitability Ratios</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Are you making money? These metrics measure how efficiently you generate profit.
      </p>

      {/* Revenue Breakdown (if barter exists) */}
      {metrics.revenue_breakdown && (
        <div
          style={{
            padding: '1.5rem',
            marginBottom: '2rem',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9',
          }}
        >
          <h3 style={{ margin: 0, marginBottom: '1rem' }}>Revenue Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Cash Revenue</p>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                ${parseFloat(metrics.revenue_breakdown.cash_revenue).toLocaleString()}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Accrual Revenue</p>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                ${parseFloat(metrics.revenue_breakdown.accrual_revenue).toLocaleString()}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                Barter Revenue <span aria-hidden="true">↔</span>
              </p>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                ${parseFloat(metrics.revenue_breakdown.barter_revenue).toLocaleString()}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Total Revenue</p>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0066cc' }}>
                ${parseFloat(metrics.revenue_breakdown.total_revenue).toLocaleString()}
              </p>
            </div>
          </div>
          {!barterIncluded && (
            <p style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.85rem', color: '#d32f2f' }}>
              Note: Barter revenue is currently excluded from profit calculations below.
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <MetricCard
          name="Gross Profit Margin"
          metric={metrics.gross_profit_margin}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Net Profit Margin"
          metric={metrics.net_profit_margin}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Operating Margin"
          metric={metrics.operating_margin}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Return on Equity (ROE)"
          metric={metrics.return_on_equity}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Return on Assets (ROA)"
          metric={metrics.return_on_assets}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
      </div>
    </div>
  );
}

interface EfficiencyPanelProps extends PanelProps {
  metrics: EfficiencyMetrics;
}

function EfficiencyPanel({ metrics, showExplanations, showBenchmarks, onDrillDown }: EfficiencyPanelProps) {
  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Efficiency Ratios</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        How fast does money move? These metrics measure how quickly you convert assets to cash.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <MetricCard
          name="AR Turnover"
          metric={metrics.ar_turnover}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Days Sales Outstanding"
          metric={metrics.days_sales_outstanding}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="AP Turnover"
          metric={metrics.ap_turnover}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        {metrics.inventory_turnover && (
          <MetricCard
            name="Inventory Turnover"
            metric={metrics.inventory_turnover}
            showExplanation={showExplanations}
            showBenchmark={showBenchmarks}
            onDrillDown={onDrillDown}
          />
        )}
      </div>
    </div>
  );
}

interface LeveragePanelProps extends PanelProps {
  metrics: LeverageMetrics;
}

function LeveragePanel({ metrics, showExplanations, showBenchmarks, onDrillDown }: LeveragePanelProps) {
  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Leverage Ratios</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        How much debt do you have? These metrics measure your financial risk and leverage.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <MetricCard
          name="Debt-to-Equity"
          metric={metrics.debt_to_equity}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Debt-to-Assets"
          metric={metrics.debt_to_assets}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Interest Coverage"
          metric={metrics.interest_coverage}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
      </div>
    </div>
  );
}

interface CashFlowPanelProps extends PanelProps {
  metrics: CashFlowMetrics;
}

function CashFlowPanel({ metrics, showExplanations, showBenchmarks, onDrillDown }: CashFlowPanelProps) {
  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Cash Flow Metrics</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        How is cash moving through your business?
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <MetricCard
          name="Operating Cash Flow"
          metric={metrics.operating_cash_flow}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Free Cash Flow"
          metric={metrics.free_cash_flow}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Cash Conversion Cycle"
          metric={metrics.cash_conversion_cycle}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
      </div>
    </div>
  );
}

interface GrowthPanelProps extends PanelProps {
  metrics: GrowthMetrics;
}

function GrowthPanel({ metrics, showExplanations, showBenchmarks, onDrillDown }: GrowthPanelProps) {
  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Growth Metrics</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        How fast are you growing?
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <MetricCard
          name="Revenue Growth Rate"
          metric={metrics.revenue_growth_rate}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
        <MetricCard
          name="Profit Growth Rate"
          metric={metrics.profit_growth_rate}
          showExplanation={showExplanations}
          showBenchmark={showBenchmarks}
          onDrillDown={onDrillDown}
        />
      </div>
    </div>
  );
}

interface ValuationPanelProps extends PanelProps {
  metrics: ValuationMetrics;
}

function ValuationPanel({ metrics, showExplanations, showBenchmarks, onDrillDown }: ValuationPanelProps) {
  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Valuation Multiples</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        What is your business worth? (Requires market value inputs)
      </p>

      <div
        style={{
          padding: '2rem',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, color: '#666' }}>
          Valuation multiples require market value or enterprise value inputs.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Metric Card Component
// =============================================================================

interface MetricCardProps {
  name: string;
  metric: any;
  showExplanation: boolean;
  showBenchmark: boolean;
  onDrillDown?: (metricName: string) => void;
}

function MetricCard({
  name,
  metric,
  showExplanation,
  showBenchmark,
  onDrillDown,
}: MetricCardProps) {
  return (
    <div
      style={{
        padding: '1.5rem',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: 'white',
      }}
    >
      <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1rem' }}>{name}</h3>

      <div style={{ marginBottom: '1rem' }}>
        <p style={{ margin: 0, fontSize: '2rem', fontWeight: 600, color: '#0066cc' }}>
          {metric.formatted_value}
        </p>
        {showBenchmark && metric.industry_benchmark && (
          <p style={{ margin: 0, marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
            Industry avg: {metric.industry_benchmark}
          </p>
        )}
      </div>

      {showExplanation && (
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, color: '#333' }}>
          {metric.plain_english_explanation}
        </p>
      )}

      {onDrillDown && (
        <button
          type="button"
          onClick={() => onDrillDown(name)}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            border: '1px solid #0066cc',
            borderRadius: '4px',
            backgroundColor: 'white',
            color: '#0066cc',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
          aria-label={`View underlying transactions for ${name}`}
        >
          View Details
        </button>
      )}
    </div>
  );
}
