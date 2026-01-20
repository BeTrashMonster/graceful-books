/**
 * Scenario Sliders Component
 *
 * Dual-slider interface for exploring "what-if" scenarios
 * Real-time runway recalculation as sliders move
 * WCAG 2.1 AA compliant with keyboard navigation
 */

import React, { useState, useEffect } from 'react'
import type { RunwayScenario } from '../../types/runway.types'
import { modelCustomScenario } from '../../services/runway/scenarioModeler.service'
import './ScenarioSliders.css'

interface ScenarioSlidersProps {
  currentRevenue: number
  currentExpenses: number
  currentCash: number
  currentRunway: number | null
  onScenarioChange?: (scenario: RunwayScenario) => void
}

export const ScenarioSliders: React.FC<ScenarioSlidersProps> = ({
  currentRevenue,
  currentExpenses,
  currentCash,
  currentRunway: _currentRunway,
  onScenarioChange,
}) => {
  // Slider states
  const [revenueSlider, setRevenueSlider] = useState(currentRevenue)
  const [expenseSlider, setExpenseSlider] = useState(currentExpenses)

  // Current scenario
  const [scenario, setScenario] = useState<RunwayScenario | null>(null)

  // Slider ranges (50% down to 200% up)
  const revenueMin = currentRevenue * 0.5
  const revenueMax = currentRevenue * 2
  const expenseMin = currentExpenses * 0.5
  const expenseMax = currentExpenses * 2

  // Update scenario whenever sliders change
  useEffect(() => {
    const newScenario = modelCustomScenario(
      currentRevenue,
      currentExpenses,
      currentCash,
      revenueSlider,
      expenseSlider,
      'Custom scenario'
    )
    setScenario(newScenario)
    onScenarioChange?.(newScenario)
  }, [revenueSlider, expenseSlider, currentRevenue, currentExpenses, currentCash, onScenarioChange])

  const handleRevenueChange = (value: number) => {
    setRevenueSlider(value)
  }

  const handleExpenseChange = (value: number) => {
    setExpenseSlider(value)
  }

  const handleReset = () => {
    setRevenueSlider(currentRevenue)
    setExpenseSlider(currentExpenses)
  }

  const formatCurrency = (amount: number) => {
    return `$${Math.round(amount).toLocaleString()}`
  }

  const getRunwayDisplay = (months: number | null): string => {
    if (months === null) return 'Extending ✓'
    if (months < 0) return 'N/A'
    return `${months.toFixed(1)} months`
  }

  const getImpactClass = (impact: 'positive' | 'negative' | 'neutral'): string => {
    return `impact-${impact}`
  }

  return (
    <div className="scenario-sliders" aria-labelledby="scenario-heading">
      <h2 id="scenario-heading" className="section-heading">
        Explore Your Runway
      </h2>

      <p className="section-description">
        Adjust the sliders to see how changes in revenue or expenses affect your runway in
        real-time.
      </p>

      {/* Revenue Slider */}
      <div className="slider-container">
        <div className="slider-header">
          <label htmlFor="revenue-slider" className="slider-label">
            Monthly Revenue
          </label>
          <span className="slider-value" aria-live="polite" aria-atomic="true">
            {formatCurrency(revenueSlider)}
          </span>
        </div>

        <div className="slider-track-container">
          <span className="slider-min" aria-hidden="true">
            {formatCurrency(revenueMin)}
          </span>

          <input
            type="range"
            id="revenue-slider"
            className="slider-input revenue"
            min={revenueMin}
            max={revenueMax}
            step={100}
            value={revenueSlider}
            onChange={(e) => handleRevenueChange(Number(e.target.value))}
            aria-label="Adjust monthly revenue"
            aria-valuemin={revenueMin}
            aria-valuemax={revenueMax}
            aria-valuenow={revenueSlider}
            aria-valuetext={formatCurrency(revenueSlider)}
          />

          <span className="slider-max" aria-hidden="true">
            {formatCurrency(revenueMax)}
          </span>
        </div>

        <div className="slider-change">
          {revenueSlider !== currentRevenue && (
            <span className={revenueSlider > currentRevenue ? 'change-positive' : 'change-negative'}>
              {revenueSlider > currentRevenue ? '+' : ''}
              {formatCurrency(revenueSlider - currentRevenue)} from current
            </span>
          )}
        </div>
      </div>

      {/* Expense Slider */}
      <div className="slider-container">
        <div className="slider-header">
          <label htmlFor="expense-slider" className="slider-label">
            Monthly Expenses
          </label>
          <span className="slider-value" aria-live="polite" aria-atomic="true">
            {formatCurrency(expenseSlider)}
          </span>
        </div>

        <div className="slider-track-container">
          <span className="slider-min" aria-hidden="true">
            {formatCurrency(expenseMin)}
          </span>

          <input
            type="range"
            id="expense-slider"
            className="slider-input expense"
            min={expenseMin}
            max={expenseMax}
            step={100}
            value={expenseSlider}
            onChange={(e) => handleExpenseChange(Number(e.target.value))}
            aria-label="Adjust monthly expenses"
            aria-valuemin={expenseMin}
            aria-valuemax={expenseMax}
            aria-valuenow={expenseSlider}
            aria-valuetext={formatCurrency(expenseSlider)}
          />

          <span className="slider-max" aria-hidden="true">
            {formatCurrency(expenseMax)}
          </span>
        </div>

        <div className="slider-change">
          {expenseSlider !== currentExpenses && (
            <span className={expenseSlider < currentExpenses ? 'change-positive' : 'change-negative'}>
              {expenseSlider > currentExpenses ? '+' : ''}
              {formatCurrency(expenseSlider - currentExpenses)} from current
            </span>
          )}
        </div>
      </div>

      {/* Scenario Results */}
      {scenario && (
        <div className="scenario-results" role="region" aria-label="Scenario results">
          <div className="results-grid">
            <div className="result-item">
              <span className="result-label">Net Burn</span>
              <span className="result-value">
                {scenario.newNetBurn >= 0 ? '+' : ''}
                {formatCurrency(scenario.newNetBurn)}
              </span>
              {scenario.newNetBurn !== scenario.currentNetBurn && (
                <span className="result-change">
                  (was {scenario.currentNetBurn >= 0 ? '+' : ''}
                  {formatCurrency(scenario.currentNetBurn)})
                </span>
              )}
            </div>

            <div className={`result-item runway ${getImpactClass(scenario.impact)}`}>
              <span className="result-label">Runway</span>
              <span className="result-value">{getRunwayDisplay(scenario.newRunway)}</span>
              {scenario.newRunway !== scenario.currentRunway && (
                <span className="result-change">
                  (was {getRunwayDisplay(scenario.currentRunway)})
                </span>
              )}
            </div>
          </div>

          {/* Impact message */}
          <div className={`impact-message ${getImpactClass(scenario.impact)}`} role="status">
            <span className="impact-icon" aria-hidden="true">
              {scenario.impact === 'positive'
                ? '✓'
                : scenario.impact === 'negative'
                ? '⚠'
                : 'ℹ'}
            </span>
            <p className="impact-text">{scenario.impactDescription}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="slider-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={handleReset}
          disabled={revenueSlider === currentRevenue && expenseSlider === currentExpenses}
        >
          Reset to Current
        </button>
      </div>

      {/* Keyboard instructions */}
      <div className="keyboard-help" role="note">
        <p>
          <strong>Keyboard tip:</strong> Use arrow keys to adjust sliders in small increments, or
          Page Up/Down for larger jumps.
        </p>
      </div>

      {/* Educational content */}
      <details className="educational-content">
        <summary>How to use scenario modeling</summary>
        <div className="content-body">
          <h4>Exploring Scenarios</h4>
          <p>
            This tool helps you answer "what if" questions about your business. Drag the sliders
            to see how changes affect your runway.
          </p>

          <h4>Example Questions</h4>
          <ul>
            <li>What if I lost my biggest client? (decrease revenue slider)</li>
            <li>What if I cut my rent by moving? (decrease expense slider)</li>
            <li>What if I raised prices by 10%? (increase revenue slider)</li>
            <li>What if I hired someone? (increase expense slider)</li>
          </ul>

          <h4>Remember</h4>
          <p>
            These are projections, not predictions. Real results depend on many factors. Use this
            as a planning tool, not a guarantee.
          </p>
        </div>
      </details>
    </div>
  )
}
