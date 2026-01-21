/**
 * Runway Dashboard Component
 *
 * Main dashboard for J6: Emergency Fund & Runway Calculator
 * Shows how long the business can survive at current burn rate
 *
 * Features:
 * - Runway calculation with gauge visualization
 * - Cash flow picture (revenue vs expenses)
 * - Trend chart showing runway history
 * - Method selection (Simple, Trend-Adjusted, Seasonal)
 * - WCAG 2.1 AA compliant
 */

import React, { useState, useEffect } from 'react'
import type {
  RunwayCalculation,
  RunwayCalculationMethod,
  RunwayDateRangePreset,
} from '../../types/runway.types'
import {
  calculateRunway,
  calculateRunwayTrend,
  getDateRangeFromPreset,
} from '../../services/runway/runwayCalculator.service'
import { analyzeBurnRate, analyzeRevenueBreakdown } from '../../services/runway/burnRateAnalyzer.service'
import { RunwayGauge } from './RunwayGauge'
import { RunwayTrendChart } from './RunwayTrendChart'
import { CashFlowPicture } from './CashFlowPicture'
import './RunwayDashboard.css'

interface RunwayDashboardProps {
  companyId: string
  targetMonths?: number
  onScenarioClick?: () => void
}

export const RunwayDashboard: React.FC<RunwayDashboardProps> = ({
  companyId,
  targetMonths = 6,
  onScenarioClick,
}) => {
  const [calculation, setCalculation] = useState<RunwayCalculation | null>(null)
  const [trendHistory, setTrendHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedMethod, setSelectedMethod] = useState<RunwayCalculationMethod>('simple')
  const [selectedDateRange, setSelectedDateRange] = useState<RunwayDateRangePreset>('last-365-days')
  const [showMethodInfo, setShowMethodInfo] = useState(false)

  useEffect(() => {
    loadRunwayData()
  }, [companyId, selectedMethod, selectedDateRange])

  async function loadRunwayData() {
    try {
      setLoading(true)
      setError(null)

      const dateRange = getDateRangeFromPreset(selectedDateRange)

      // Calculate runway
      const calc = await calculateRunway(companyId, selectedMethod, dateRange, targetMonths)
      setCalculation(calc)

      // Calculate trend history
      const trend = await calculateRunwayTrend(companyId, selectedMethod)
      setTrendHistory(trend)

      setLoading(false)
    } catch (err) {
      console.error('Error loading runway data:', err)
      setError('Oops! We had trouble calculating your runway. Please try again.')
      setLoading(false)
    }
  }

  function formatRunwayMonths(months: number | null): string {
    if (months === null) {
      return 'Extending indefinitely'
    }

    // Show confidence range if available
    if (calculation?.confidenceRange) {
      const { min, max } = calculation.confidenceRange
      if (min !== null && max !== null && max - min > 1) {
        return `${min.toFixed(1)}-${max.toFixed(1)} months`
      }
    }

    return `${months.toFixed(1)} months`
  }

  function getHealthMessage(months: number | null): string {
    if (months === null) {
      return "You're cash flow positive - runway is extending!"
    }

    if (months >= targetMonths) {
      return `You're in a healthy range (${targetMonths}+ months recommended).`
    }

    if (months >= targetMonths * 0.75) {
      return `You're close to your target of ${targetMonths} months.`
    }

    return `Your runway is below your target of ${targetMonths} months.`
  }

  function getMethodDescription(method: RunwayCalculationMethod): string {
    switch (method) {
      case 'simple':
        return 'Average monthly expenses over selected period. Good for stable businesses.'
      case 'trend-adjusted':
        return 'Accounts for increasing or decreasing burn rate trends. Better for growing/scaling businesses.'
      case 'seasonal':
        return 'Factors in seasonal patterns. Useful for businesses with predictable cycles (requires 12+ months data).'
    }
  }

  if (loading) {
    return (
      <div className="runway-dashboard loading" role="status" aria-label="Loading runway data">
        <div className="loading-spinner" />
        <p>Calculating your runway...</p>
      </div>
    )
  }

  if (error || !calculation) {
    return (
      <div className="runway-dashboard error" role="alert">
        <div className="error-icon">⚠</div>
        <p>{error || 'Unable to load runway data'}</p>
        <button onClick={loadRunwayData} className="btn-primary">
          Try Again
        </button>
      </div>
    )
  }

  const { cashFlowPicture } = calculation

  return (
    <div className="runway-dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Your Runway</h1>
        <p className="dashboard-subtitle">
          How long your business can operate at current spending
        </p>
      </div>

      {/* Method and Date Range Selectors */}
      <div className="dashboard-controls">
        <div className="control-group">
          <label htmlFor="calculation-method" className="control-label">
            Calculation Method
          </label>
          <select
            id="calculation-method"
            className="control-select"
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value as RunwayCalculationMethod)}
            aria-describedby="method-description"
          >
            <option value="simple">Simple Average</option>
            <option value="trend-adjusted">Trend-Adjusted</option>
            <option value="seasonal">Seasonal</option>
          </select>
          <button
            type="button"
            className="info-button"
            onClick={() => setShowMethodInfo(!showMethodInfo)}
            aria-label="Show calculation method information"
            aria-expanded={showMethodInfo}
          >
            ℹ
          </button>
        </div>

        <div className="control-group">
          <label htmlFor="date-range" className="control-label">
            Date Range
          </label>
          <select
            id="date-range"
            className="control-select"
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value as RunwayDateRangePreset)}
          >
            <option value="last-30-days">Last 30 days</option>
            <option value="last-90-days">Last 90 days</option>
            <option value="last-365-days">Last 365 days</option>
            <option value="year-to-date">Year to date</option>
            <option value="last-year">Last year</option>
            <option value="all-time">All time</option>
          </select>
        </div>
      </div>

      {showMethodInfo && (
        <div className="method-info" role="region" aria-label="Calculation method information">
          <h3>About This Method</h3>
          <p>{getMethodDescription(selectedMethod)}</p>
          <button
            type="button"
            className="btn-text"
            onClick={() => setShowMethodInfo(false)}
            aria-label="Close information"
          >
            Got it
          </button>
        </div>
      )}

      {/* Main Runway Display */}
      <section className="runway-main" aria-labelledby="runway-heading">
        <h2 id="runway-heading" className="section-heading">
          Current Runway
        </h2>

        <div className="runway-summary">
          <div className="runway-number" aria-label={`Runway: ${formatRunwayMonths(calculation.runwayMonths)}`}>
            <span className="runway-value">{formatRunwayMonths(calculation.runwayMonths)}</span>
            <span className="runway-label">of runway</span>
          </div>

          <div className="runway-details">
            <div className="detail-row">
              <span className="detail-label">Current Cash:</span>
              <span className="detail-value">${calculation.currentCash.toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Monthly Net Burn:</span>
              <span
                className={`detail-value ${calculation.monthlyBurnRate >= 0 ? 'positive' : 'negative'}`}
              >
                {calculation.monthlyBurnRate >= 0 ? '+' : ''}$
                {Math.abs(calculation.monthlyBurnRate).toLocaleString()}
              </span>
            </div>
            {calculation.projectedDepletionDate && (
              <div className="detail-row">
                <span className="detail-label">Projected Depletion:</span>
                <span className="detail-value">
                  {calculation.projectedDepletionDate.toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Gauge Visualization */}
        <RunwayGauge
          runwayMonths={calculation.runwayMonths}
          targetMonths={targetMonths}
          healthStatus={calculation.healthStatus}
        />

        <p className="health-message" role="status">
          {getHealthMessage(calculation.runwayMonths)}
        </p>
      </section>

      {/* Cash Flow Picture */}
      <CashFlowPicture cashFlowData={cashFlowPicture} />

      {/* Trend Chart */}
      {trendHistory.length > 0 && (
        <section className="runway-trend" aria-labelledby="trend-heading">
          <h2 id="trend-heading" className="section-heading">
            Runway Trend (Past 12 Months)
          </h2>
          <RunwayTrendChart data={trendHistory} targetMonths={targetMonths} />
        </section>
      )}

      {/* Action Buttons */}
      <div className="dashboard-actions">
        <button type="button" className="btn-secondary" onClick={loadRunwayData}>
          Refresh Data
        </button>
        {onScenarioClick && (
          <button type="button" className="btn-primary" onClick={onScenarioClick}>
            Explore Scenarios
          </button>
        )}
      </div>

      {/* Educational Content */}
      <details className="educational-content">
        <summary>What is runway and why does it matter?</summary>
        <div className="content-body">
          <h3>Understanding Runway</h3>
          <p>
            <strong>Runway</strong> is how long your business can operate at current spending
            before running out of cash. Think of it like a countdown timer that helps you plan
            ahead.
          </p>
          <p>
            <strong>Burn rate</strong> is how much cash your business uses each month. It's the
            difference between what comes in (revenue) and what goes out (expenses).
          </p>
          <p>
            <strong>Why this matters:</strong> Knowing your runway helps you make confident
            decisions about hiring, investing, pricing, and planning for slow months. It's not
            about fear - it's about being prepared.
          </p>
        </div>
      </details>
    </div>
  )
}
