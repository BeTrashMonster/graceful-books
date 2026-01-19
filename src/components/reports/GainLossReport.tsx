/**
 * Gain/Loss Report Component
 *
 * Displays realized and unrealized foreign currency gains and losses.
 * Implements WCAG 2.1 AA compliance with educational tooltips.
 *
 * Requirements:
 * - I4: Multi-Currency - Full
 * - DISC-adapted communication
 * - Educational tooltips explaining gain/loss concepts
 * - Accessible data tables
 */

import { useState, useEffect } from 'react';
import Decimal from 'decimal.js';
import type { CurrencyCode, CurrencyGainLoss } from '../../types/currency.types';
import { GainLossType } from '../../types/currency.types';

// Configure Decimal.js for 28 decimal places precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Types
// ============================================================================

export interface GainLossReportProps {
  companyId: string;
  startDate: number;
  endDate: number;
  baseCurrency: CurrencyCode;
  onExport?: (format: 'pdf' | 'csv') => Promise<void>;
  className?: string;
}

interface GainLossSummary {
  totalRealized: Decimal;
  totalUnrealized: Decimal;
  totalNet: Decimal;
  byCurrency: Map<CurrencyCode, {
    realized: Decimal;
    unrealized: Decimal;
    net: Decimal;
  }>;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Gain/Loss Report Component
 *
 * Displays comprehensive foreign currency gain/loss reporting
 */
export function GainLossReport({
  companyId,
  startDate,
  endDate,
  baseCurrency,
  onExport,
  className = '',
}: GainLossReportProps) {
  const [gainLosses, setGainLosses] = useState<CurrencyGainLoss[]>([]);
  const [summary, setSummary] = useState<GainLossSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'realized' | 'unrealized'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'currency'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load gain/loss data
  useEffect(() => {
    loadGainLossData();
  }, [companyId, startDate, endDate]);

  // Calculate summary when data changes
  useEffect(() => {
    if (gainLosses.length > 0) {
      const summaryData = calculateSummary(gainLosses);
      setSummary(summaryData);
    }
  }, [gainLosses]);

  const loadGainLossData = async () => {
    setLoading(true);
    try {
      // In production, this would fetch from the database
      // For now, we'll use mock data
      const mockData: CurrencyGainLoss[] = [];
      setGainLosses(mockData);
    } catch (error) {
      console.error('Failed to load gain/loss data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedData = () => {
    let data = [...gainLosses];

    // Apply filter
    if (filter === 'realized') {
      data = data.filter((gl) => gl.type === GainLossType.REALIZED);
    } else if (filter === 'unrealized') {
      data = data.filter((gl) => gl.type === GainLossType.UNREALIZED);
    }

    // Apply sort
    data.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'date') {
        comparison = a.calculation_date - b.calculation_date;
      } else if (sortBy === 'amount') {
        const amountA = new Decimal(a.gain_loss_amount);
        const amountB = new Decimal(b.gain_loss_amount);
        comparison = amountA.minus(amountB).toNumber();
      } else if (sortBy === 'currency') {
        comparison = a.currency.localeCompare(b.currency);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return data;
  };

  if (loading) {
    return <div className="gain-loss-report__loading">Loading gain/loss data...</div>;
  }

  const data = filteredAndSortedData();

  return (
    <div className={`gain-loss-report ${className}`}>
      {/* Header */}
      <div className="gain-loss-report__header">
        <h2 className="gain-loss-report__title">
          Foreign Currency Gain/Loss Report
        </h2>
        <div className="gain-loss-report__date-range">
          {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
        </div>
      </div>

      {/* Educational Tooltip */}
      <div className="gain-loss-report__help">
        <div className="help-icon" aria-label="Help">?</div>
        <div className="help-tooltip">
          <h4>Understanding Currency Gains and Losses</h4>
          <p><strong>Realized Gains/Losses:</strong></p>
          <p>
            These occur when you complete a transaction (like receiving payment on an invoice)
            at a different exchange rate than when you recorded it. These are actual, real
            gains or losses that affect your profit/loss.
          </p>
          <p><strong>Unrealized Gains/Losses:</strong></p>
          <p>
            These are "paper" gains or losses from revaluing outstanding foreign currency
            balances at current exchange rates. These don't affect cash flow until the
            transaction is completed.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="gain-loss-report__summary">
          <div className="summary-card">
            <div className="summary-card__label">Total Realized Gain/Loss</div>
            <div className={`summary-card__value ${summary.totalRealized.isNegative() ? 'loss' : 'gain'}`}>
              {formatAmount(summary.totalRealized, baseCurrency)}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-card__label">Total Unrealized Gain/Loss</div>
            <div className={`summary-card__value ${summary.totalUnrealized.isNegative() ? 'loss' : 'gain'}`}>
              {formatAmount(summary.totalUnrealized, baseCurrency)}
            </div>
          </div>

          <div className="summary-card summary-card--highlighted">
            <div className="summary-card__label">Net Gain/Loss</div>
            <div className={`summary-card__value ${summary.totalNet.isNegative() ? 'loss' : 'gain'}`}>
              {formatAmount(summary.totalNet, baseCurrency)}
            </div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="gain-loss-report__controls">
        <div className="controls-left">
          {/* Filter */}
          <div className="filter-group">
            <label htmlFor="type-filter">Show:</label>
            <select
              id="type-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="filter-select"
            >
              <option value="all">All Gains/Losses</option>
              <option value="realized">Realized Only</option>
              <option value="unrealized">Unrealized Only</option>
            </select>
          </div>

          {/* Sort */}
          <div className="filter-group">
            <label htmlFor="sort-by">Sort by:</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="filter-select"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="currency">Currency</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="sort-order-btn"
              aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Export Actions */}
        {onExport && (
          <div className="controls-right">
            <button
              onClick={() => onExport('pdf')}
              className="btn btn-secondary"
            >
              Export PDF
            </button>
            <button
              onClick={() => onExport('csv')}
              className="btn btn-secondary"
            >
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Data Table */}
      {data.length === 0 ? (
        <div className="gain-loss-report__empty">
          <p>No currency gains or losses found for this period.</p>
          <p className="empty-subtext">
            Foreign currency gains and losses will appear here when you have transactions
            in multiple currencies.
          </p>
        </div>
      ) : (
        <div className="gain-loss-report__table-wrapper">
          <table className="gain-loss-report__table" role="table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Currency</th>
                <th scope="col">Original Amount</th>
                <th scope="col">Original Rate</th>
                <th scope="col">Current Rate</th>
                <th scope="col">Rate Change</th>
                <th scope="col">Gain/Loss ({baseCurrency})</th>
              </tr>
            </thead>
            <tbody>
              {data.map((gl, index) => (
                <tr key={`${gl.transaction_id}-${index}`}>
                  <td data-label="Date">
                    {new Date(gl.calculation_date).toLocaleDateString()}
                  </td>
                  <td data-label="Type">
                    <span className={`type-badge type-badge--${gl.type.toLowerCase()}`}>
                      {gl.type === GainLossType.REALIZED ? 'Realized' : 'Unrealized'}
                    </span>
                  </td>
                  <td data-label="Currency">{gl.currency}</td>
                  <td data-label="Original Amount">
                    {formatCurrencyAmount(gl.original_amount, gl.currency)}
                  </td>
                  <td data-label="Original Rate">
                    {formatRate(gl.original_rate)}
                  </td>
                  <td data-label="Current Rate">
                    {formatRate(gl.current_rate)}
                  </td>
                  <td data-label="Rate Change">
                    {calculateRateChange(gl.original_rate, gl.current_rate)}
                  </td>
                  <td data-label="Gain/Loss">
                    <span className={`amount ${isGainOrLoss(gl.gain_loss_amount)}`}>
                      {formatGainLoss(gl.gain_loss_amount, baseCurrency)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* By Currency Breakdown */}
      {summary && summary.byCurrency.size > 0 && (
        <div className="gain-loss-report__by-currency">
          <h3>Breakdown by Currency</h3>
          <div className="currency-breakdown">
            {Array.from(summary.byCurrency.entries()).map(([currency, totals]) => (
              <div key={currency} className="currency-card">
                <div className="currency-card__header">
                  <h4>{currency}</h4>
                </div>
                <div className="currency-card__details">
                  <div className="detail-row">
                    <span>Realized:</span>
                    <span className={totals.realized.isNegative() ? 'loss' : 'gain'}>
                      {formatAmount(totals.realized, baseCurrency)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>Unrealized:</span>
                    <span className={totals.unrealized.isNegative() ? 'loss' : 'gain'}>
                      {formatAmount(totals.unrealized, baseCurrency)}
                    </span>
                  </div>
                  <div className="detail-row detail-row--total">
                    <span>Net:</span>
                    <span className={totals.net.isNegative() ? 'loss' : 'gain'}>
                      {formatAmount(totals.net, baseCurrency)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DISC-Adapted Footer */}
      <div className="gain-loss-report__footer">
        <div className="disc-help" data-disc-style="influence">
          <strong>Great news!</strong> Understanding your currency gains and losses helps you
          make smarter decisions about when to invoice and pay in foreign currencies.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate summary statistics
 */
function calculateSummary(gainLosses: CurrencyGainLoss[]): GainLossSummary {
  let totalRealized = new Decimal(0);
  let totalUnrealized = new Decimal(0);
  const byCurrency = new Map<CurrencyCode, {
    realized: Decimal;
    unrealized: Decimal;
    net: Decimal;
  }>();

  for (const gl of gainLosses) {
    const amount = new Decimal(gl.gain_loss_amount);

    // Update totals
    if (gl.type === GainLossType.REALIZED) {
      totalRealized = totalRealized.plus(amount);
    } else {
      totalUnrealized = totalUnrealized.plus(amount);
    }

    // Update by currency
    const currencyData = byCurrency.get(gl.currency) || {
      realized: new Decimal(0),
      unrealized: new Decimal(0),
      net: new Decimal(0),
    };

    if (gl.type === GainLossType.REALIZED) {
      currencyData.realized = currencyData.realized.plus(amount);
    } else {
      currencyData.unrealized = currencyData.unrealized.plus(amount);
    }
    currencyData.net = currencyData.realized.plus(currencyData.unrealized);

    byCurrency.set(gl.currency, currencyData);
  }

  return {
    totalRealized,
    totalUnrealized,
    totalNet: totalRealized.plus(totalUnrealized),
    byCurrency,
  };
}

/**
 * Format amount with currency symbol
 */
function formatAmount(amount: Decimal, currency: CurrencyCode): string {
  const formatted = amount.abs().toFixed(2);
  const symbol = getCurrencySymbol(currency);

  if (amount.isNegative()) {
    return `-${symbol}${formatted}`;
  } else if (amount.isPositive()) {
    return `+${symbol}${formatted}`;
  } else {
    return `${symbol}${formatted}`;
  }
}

/**
 * Format currency amount
 */
function formatCurrencyAmount(amount: string, currency: CurrencyCode): string {
  const decimal = new Decimal(amount);
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${decimal.toFixed(2)}`;
}

/**
 * Format exchange rate
 */
function formatRate(rate: string): string {
  const decimal = new Decimal(rate);
  return decimal.toFixed(6);
}

/**
 * Format gain/loss with appropriate sign
 */
function formatGainLoss(amount: string, currency: CurrencyCode): string {
  const decimal = new Decimal(amount);
  return formatAmount(decimal, currency);
}

/**
 * Calculate percentage rate change
 */
function calculateRateChange(originalRate: string, currentRate: string): string {
  const original = new Decimal(originalRate);
  const current = new Decimal(currentRate);

  if (original.isZero()) {
    return 'N/A';
  }

  const change = current.minus(original).div(original).mul(100);
  return `${change.toFixed(2)}%`;
}

/**
 * Determine if amount is gain or loss
 */
function isGainOrLoss(amount: string): 'gain' | 'loss' | 'neutral' {
  const decimal = new Decimal(amount);
  if (decimal.isPositive()) return 'gain';
  if (decimal.isNegative()) return 'loss';
  return 'neutral';
}

/**
 * Get currency symbol
 */
function getCurrencySymbol(currency: CurrencyCode): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'A$',
    // Add more as needed
  };

  return symbols[currency] || currency;
}
