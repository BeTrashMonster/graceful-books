/**
 * Cash Flow Picture Component
 *
 * Shows revenue vs expenses breakdown
 * WCAG 2.1 AA compliant
 */

import React from 'react'
import type { CashFlowPicture as CashFlowPictureType } from '../../types/runway.types'
import './CashFlowPicture.css'

interface CashFlowPictureProps {
  cashFlowData: CashFlowPictureType
}

export const CashFlowPicture: React.FC<CashFlowPictureProps> = ({ cashFlowData }) => {
  const {
    dateRange,
    monthlyRevenue,
    monthlyExpenses,
    netBurn,
    direction,
    revenueVolatility,
    expenseVolatility,
    hasSeasonalPattern,
  } = cashFlowData

  const getDirectionMessage = () => {
    switch (direction) {
      case 'positive':
        return "You're cash flow positive - runway is extending!"
      case 'negative':
        return "You're burning cash - focus on reducing expenses or increasing revenue."
      case 'neutral':
        return "You're breaking even - small changes could tip the balance."
    }
  }

  const getDirectionIcon = () => {
    switch (direction) {
      case 'positive':
        return '↗'
      case 'negative':
        return '↘'
      case 'neutral':
        return '→'
    }
  }

  const getVolatilityMessage = () => {
    const avgVolatility = (revenueVolatility + expenseVolatility) / 2
    if (avgVolatility < 0.2) {
      return 'Your cash flow is stable and predictable.'
    } else if (avgVolatility < 0.4) {
      return 'Your cash flow has some variability - keep an eye on it.'
    } else {
      return 'Your cash flow is quite volatile - consider building extra buffer.'
    }
  }

  return (
    <section className="cash-flow-picture" aria-labelledby="cash-flow-heading">
      <h2 id="cash-flow-heading" className="section-heading">
        Your Cash Flow Picture
      </h2>

      <div className="cash-flow-period">
        <p className="period-label">Showing averages from:</p>
        <p className="period-value">{dateRange.label}</p>
      </div>

      {/* Revenue vs Expenses */}
      <div className="cash-flow-breakdown">
        <div className="breakdown-item revenue">
          <div className="item-header">
            <span className="item-icon" aria-hidden="true">
              💰
            </span>
            <span className="item-label">Monthly Revenue (avg)</span>
          </div>
          <div className="item-value">${monthlyRevenue.toLocaleString()}</div>
          {revenueVolatility > 0.3 && (
            <div className="item-note">
              <span className="note-icon" aria-hidden="true">
                ⚡
              </span>
              Variable
            </div>
          )}
        </div>

        <div className="breakdown-item expenses">
          <div className="item-header">
            <span className="item-icon" aria-hidden="true">
              💸
            </span>
            <span className="item-label">Monthly Expenses (avg)</span>
          </div>
          <div className="item-value">${monthlyExpenses.toLocaleString()}</div>
          {expenseVolatility > 0.3 && (
            <div className="item-note">
              <span className="note-icon" aria-hidden="true">
                ⚡
              </span>
              Variable
            </div>
          )}
        </div>

        <div className={`breakdown-item net-burn ${direction}`}>
          <div className="item-header">
            <span className="item-icon" aria-hidden="true">
              {getDirectionIcon()}
            </span>
            <span className="item-label">Net Burn</span>
          </div>
          <div className="item-value">
            {netBurn >= 0 ? '+' : ''}${Math.abs(netBurn).toLocaleString()}
          </div>
          <div className={`item-status ${direction}`}>{direction}</div>
        </div>
      </div>

      {/* Cash flow message */}
      <div className={`cash-flow-message ${direction}`} role="status">
        <span className="message-icon" aria-hidden="true">
          {direction === 'positive' ? '✓' : direction === 'negative' ? '⚠' : 'ℹ'}
        </span>
        <p className="message-text">{getDirectionMessage()}</p>
      </div>

      {/* Volatility note */}
      {(revenueVolatility > 0.3 || expenseVolatility > 0.3) && (
        <div className="volatility-note">
          <p>{getVolatilityMessage()}</p>
        </div>
      )}

      {/* Seasonal pattern note */}
      {hasSeasonalPattern && (
        <div className="seasonal-note">
          <span className="note-icon" aria-hidden="true">
            📅
          </span>
          <p>
            We detected a seasonal pattern in your revenue or expenses. Consider using the
            "Seasonal" calculation method for more accurate projections.
          </p>
        </div>
      )}

      {/* Educational tooltip */}
      <details className="educational-tooltip">
        <summary>What is net burn?</summary>
        <div className="tooltip-content">
          <p>
            <strong>Net burn</strong> is the difference between your revenue and expenses:
          </p>
          <p className="formula">Net Burn = Revenue - Expenses</p>
          <ul>
            <li>
              <strong>Positive</strong> (like +$4,200): You're making more than you spend. Your
              cash is growing!
            </li>
            <li>
              <strong>Negative</strong> (like -$2,100): You're spending more than you make. You're
              using your cash reserves.
            </li>
            <li>
              <strong>Near zero</strong>: You're breaking even.
            </li>
          </ul>
        </div>
      </details>
    </section>
  )
}
