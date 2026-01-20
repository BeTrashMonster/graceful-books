/**
 * Burn Rate Analyzer Component
 *
 * Shows expense breakdown and burn rate analysis
 * WCAG 2.1 AA compliant
 */

import React from 'react'
import type { BurnRateAnalysis, ExpenseCategory } from '../../types/runway.types'
import './BurnRateAnalyzer.css'

interface BurnRateAnalyzerProps {
  analysis: BurnRateAnalysis
}

export const BurnRateAnalyzer: React.FC<BurnRateAnalyzerProps> = ({ analysis }) => {
  const {
    averageBurnRate,
    trendDirection,
    trendPercentage,
    topExpenseCategories,
    fixedCostsTotal,
    variableCostsTotal,
    fixedPercentage,
    variablePercentage,
  } = analysis

  const getTrendIcon = () => {
    switch (trendDirection) {
      case 'increasing':
        return '📈'
      case 'decreasing':
        return '📉'
      case 'stable':
        return '➡️'
    }
  }

  const getTrendMessage = () => {
    switch (trendDirection) {
      case 'increasing':
        return `Your burn rate is increasing by ${trendPercentage.toFixed(1)}% - keep an eye on this.`
      case 'decreasing':
        return `Your burn rate is decreasing by ${trendPercentage.toFixed(1)}% - great work!`
      case 'stable':
        return 'Your burn rate is stable - consistent and predictable.'
    }
  }

  const getCostTypeLabel = (type: 'fixed' | 'variable' | 'semi-variable'): string => {
    switch (type) {
      case 'fixed':
        return 'Fixed'
      case 'variable':
        return 'Variable'
      case 'semi-variable':
        return 'Semi-Variable'
    }
  }

  const getCostTypeDescription = (type: 'fixed' | 'variable' | 'semi-variable'): string => {
    switch (type) {
      case 'fixed':
        return 'Consistent month-to-month'
      case 'variable':
        return 'Changes significantly'
      case 'semi-variable':
        return 'Some variation'
    }
  }

  return (
    <section className="burn-rate-analyzer" aria-labelledby="burn-rate-heading">
      <h2 id="burn-rate-heading" className="section-heading">
        Your Burn Rate Analysis
      </h2>

      {/* Average Burn Rate */}
      <div className="burn-rate-summary">
        <div className="summary-main">
          <span className="summary-label">Average Monthly Burn</span>
          <span className="summary-value">${averageBurnRate.toLocaleString()}</span>
        </div>

        <div className={`trend-indicator ${trendDirection}`}>
          <span className="trend-icon" aria-hidden="true">
            {getTrendIcon()}
          </span>
          <span className="trend-message">{getTrendMessage()}</span>
        </div>
      </div>

      {/* Fixed vs Variable Costs */}
      <div className="cost-breakdown">
        <h3 className="subsection-heading">Fixed vs Variable Costs</h3>

        <div className="cost-bars">
          <div className="cost-bar-container">
            <div className="cost-bar-labels">
              <span className="bar-label">Fixed</span>
              <span className="bar-value">${fixedCostsTotal.toLocaleString()}</span>
            </div>
            <div className="cost-bar-track">
              <div
                className="cost-bar-fill fixed"
                style={{ width: `${fixedPercentage}%` }}
                role="img"
                aria-label={`Fixed costs: ${fixedPercentage.toFixed(0)}% of total expenses`}
              />
            </div>
            <span className="bar-percentage">{fixedPercentage.toFixed(0)}%</span>
          </div>

          <div className="cost-bar-container">
            <div className="cost-bar-labels">
              <span className="bar-label">Variable</span>
              <span className="bar-value">${variableCostsTotal.toLocaleString()}</span>
            </div>
            <div className="cost-bar-track">
              <div
                className="cost-bar-fill variable"
                style={{ width: `${variablePercentage}%` }}
                role="img"
                aria-label={`Variable costs: ${variablePercentage.toFixed(0)}% of total expenses`}
              />
            </div>
            <span className="bar-percentage">{variablePercentage.toFixed(0)}%</span>
          </div>
        </div>

        <p className="cost-insight">
          {fixedPercentage > 70
            ? 'You have high fixed costs. Focus on growing revenue to improve margins.'
            : variablePercentage > 70
            ? 'You have high variable costs. Good flexibility to scale expenses with revenue.'
            : 'You have a balanced mix of fixed and variable costs.'}
        </p>
      </div>

      {/* Top Expense Categories */}
      <div className="top-expenses">
        <h3 className="subsection-heading">Top 5 Expense Categories</h3>

        <div className="expense-list">
          {topExpenseCategories.map((category, index) => (
            <div key={category.id} className="expense-item">
              <div className="expense-rank" aria-label={`Rank ${index + 1}`}>
                {index + 1}
              </div>

              <div className="expense-details">
                <div className="expense-header">
                  <span className="expense-name">{category.name}</span>
                  <span className="expense-amount">${category.monthlyAmount.toLocaleString()}</span>
                </div>

                <div className="expense-meta">
                  <span className="expense-percentage">{category.percentage.toFixed(1)}% of burn</span>
                  <span className="expense-type" title={getCostTypeDescription(category.type)}>
                    {getCostTypeLabel(category.type)}
                  </span>
                  {category.trend !== 'stable' && (
                    <span className={`expense-trend ${category.trend}`}>
                      {category.trend === 'increasing' ? '↗' : '↘'}{' '}
                      {category.trendPercentage.toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="expense-bar">
                  <div
                    className="expense-bar-fill"
                    style={{ width: `${category.percentage}%` }}
                    role="img"
                    aria-label={`${category.name}: ${category.percentage.toFixed(1)}% of total expenses`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Educational content */}
      <details className="educational-content">
        <summary>Understanding fixed vs variable costs</summary>
        <div className="content-body">
          <h4>Fixed Costs</h4>
          <p>
            Expenses that stay roughly the same each month, like rent, insurance, or salaries.
            These costs don't change much whether you have a great month or a slow month.
          </p>

          <h4>Variable Costs</h4>
          <p>
            Expenses that fluctuate based on your business activity, like materials, commissions,
            or advertising. These go up when you're busy and down when you're not.
          </p>

          <h4>Why it matters</h4>
          <p>
            High fixed costs mean you need consistent revenue to stay afloat. High variable costs
            give you more flexibility to adjust spending based on revenue.
          </p>
        </div>
      </details>
    </section>
  )
}
