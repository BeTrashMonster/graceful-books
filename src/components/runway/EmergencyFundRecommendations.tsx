/**
 * Emergency Fund Recommendations Component
 *
 * Provides personalized runway target recommendations based on business type
 * with actionable plans to reach targets
 * WCAG 2.1 AA compliant
 */

import React, { useState } from 'react'
import type { EmergencyFundRecommendation, BusinessType } from '../../types/runway.types'
import { calculateActionPlan } from '../../services/runway/scenarioModeler.service'
import './EmergencyFundRecommendations.css'

interface EmergencyFundRecommendationsProps {
  currentCash: number
  currentRevenue: number
  currentExpenses: number
  currentRunway: number | null
  selectedBusinessType?: BusinessType
  onBusinessTypeChange?: (type: BusinessType) => void
}

export const EmergencyFundRecommendations: React.FC<EmergencyFundRecommendationsProps> = ({
  currentCash,
  currentRevenue,
  currentExpenses,
  currentRunway,
  selectedBusinessType = 'other',
  onBusinessTypeChange,
}) => {
  const [businessType, setBusinessType] = useState<BusinessType>(selectedBusinessType)
  const [customTarget, setCustomTarget] = useState<number | null>(null)

  // Business type recommendations
  const getRecommendedMonths = (type: BusinessType): { min: number; max: number } => {
    switch (type) {
      case 'service-recurring':
        return { min: 3, max: 6 }
      case 'service-project':
        return { min: 6, max: 9 }
      case 'product':
        return { min: 6, max: 9 }
      case 'seasonal':
        return { min: 9, max: 12 }
      case 'high-growth-startup':
        return { min: 12, max: 18 }
      case 'bootstrapped-solopreneur':
        return { min: 6, max: 12 }
      case 'other':
        return { min: 6, max: 12 }
    }
  }

  const getRationale = (type: BusinessType): string => {
    switch (type) {
      case 'service-recurring':
        return 'Service businesses with recurring revenue have predictable cash flow, allowing for a smaller emergency fund.'
      case 'service-project':
        return 'Project-based work can have gaps between contracts. A larger buffer provides security during slow periods.'
      case 'product':
        return 'Product businesses face inventory risk and demand fluctuations. Extra runway helps weather market changes.'
      case 'seasonal':
        return 'Seasonal businesses need enough cash to operate through entire off-seasons.'
      case 'high-growth-startup':
        return 'High-growth requires significant investment. 12-18 months runway allows you to focus on growth without cash pressure.'
      case 'bootstrapped-solopreneur':
        return 'Without external funding, solopreneurs need substantial reserves to handle both business and personal needs.'
      case 'other':
        return '6-12 months is a balanced target for most businesses, providing security without excess cash tied up.'
    }
  }

  const getBusinessTypeLabel = (type: BusinessType): string => {
    switch (type) {
      case 'service-recurring':
        return 'Service Business (Recurring Revenue)'
      case 'service-project':
        return 'Service Business (Project-Based)'
      case 'product':
        return 'Product Business'
      case 'seasonal':
        return 'Seasonal Business'
      case 'high-growth-startup':
        return 'High-Growth Startup'
      case 'bootstrapped-solopreneur':
        return 'Bootstrapped Solopreneur'
      case 'other':
        return 'Other'
    }
  }

  const recommended = getRecommendedMonths(businessType)
  const targetMonths = customTarget ?? recommended.max
  const rationale = getRationale(businessType)

  // Calculate action plan
  const actionPlan = calculateActionPlan(
    currentCash,
    currentRevenue,
    currentExpenses,
    currentRunway,
    targetMonths
  )

  const handleBusinessTypeChange = (type: BusinessType) => {
    setBusinessType(type)
    setCustomTarget(null) // Reset custom target when type changes
    onBusinessTypeChange?.(type)
  }

  const handleCustomTargetChange = (value: number) => {
    setCustomTarget(value)
  }

  const isHealthy = currentRunway !== null ? currentRunway >= targetMonths : true

  return (
    <section className="emergency-fund-recommendations" aria-labelledby="recommendations-heading">
      <h2 id="recommendations-heading" className="section-heading">
        Emergency Fund Recommendations
      </h2>

      {/* Business Type Selector */}
      <div className="business-type-selector">
        <label htmlFor="business-type" className="selector-label">
          What type of business are you?
        </label>
        <select
          id="business-type"
          className="business-type-select"
          value={businessType}
          onChange={(e) => handleBusinessTypeChange(e.target.value as BusinessType)}
        >
          <option value="service-recurring">{getBusinessTypeLabel('service-recurring')}</option>
          <option value="service-project">{getBusinessTypeLabel('service-project')}</option>
          <option value="product">{getBusinessTypeLabel('product')}</option>
          <option value="seasonal">{getBusinessTypeLabel('seasonal')}</option>
          <option value="high-growth-startup">{getBusinessTypeLabel('high-growth-startup')}</option>
          <option value="bootstrapped-solopreneur">
            {getBusinessTypeLabel('bootstrapped-solopreneur')}
          </option>
          <option value="other">{getBusinessTypeLabel('other')}</option>
        </select>
      </div>

      {/* Recommendation Summary */}
      <div className="recommendation-summary">
        <div className="summary-card">
          <h3 className="card-title">Recommended Runway Target</h3>

          <div className="recommended-range">
            <span className="range-label">For {getBusinessTypeLabel(businessType)}:</span>
            <span className="range-value">
              {recommended.min}-{recommended.max} months
            </span>
          </div>

          <p className="recommendation-rationale">{rationale}</p>

          <div className={`current-status ${isHealthy ? 'healthy' : 'needs-attention'}`}>
            <span className="status-icon" aria-hidden="true">
              {isHealthy ? '✓' : '⚠'}
            </span>
            <div className="status-content">
              <span className="status-label">Your current runway:</span>
              <span className="status-value">
                {currentRunway === null ? 'Infinite (cash flow positive)' : `${currentRunway.toFixed(1)} months`}
              </span>
              {isHealthy ? (
                <p className="status-message">You're in a healthy range. Great work!</p>
              ) : (
                <p className="status-message">
                  You're below the recommended target. Here's how to get there:
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Custom Target Option */}
        <details className="custom-target-section">
          <summary>Set a custom runway target</summary>
          <div className="custom-target-content">
            <p>
              The recommendation above is based on typical businesses in your category. Your
              situation might be different - set your own target if you prefer.
            </p>
            <div className="custom-target-input-group">
              <label htmlFor="custom-target" className="input-label">
                Custom target (months):
              </label>
              <input
                type="number"
                id="custom-target"
                className="custom-target-input"
                min={1}
                max={36}
                value={customTarget ?? recommended.max}
                onChange={(e) => handleCustomTargetChange(Number(e.target.value))}
                aria-label="Custom runway target in months"
              />
            </div>
          </div>
        </details>
      </div>

      {/* Action Plan */}
      {!isHealthy && actionPlan.approach !== 'both' && (
        <div className="action-plan">
          <h3 className="plan-title">Your Action Plan</h3>

          <div className="plan-approach">
            <span className="approach-label">Recommended approach:</span>
            <span className="approach-value">
              {actionPlan.approach === 'reduce-burn' ? 'Reduce monthly burn' : 'Build cash reserves'}
            </span>
          </div>

          <div className="plan-details">
            <p className="plan-description">{actionPlan.description}</p>

            {actionPlan.monthlyBurnReduction && (
              <div className="plan-metric">
                <span className="metric-label">Monthly burn reduction needed:</span>
                <span className="metric-value">${actionPlan.monthlyBurnReduction.toLocaleString()}</span>
              </div>
            )}

            {actionPlan.cashReserveIncrease && (
              <div className="plan-metric">
                <span className="metric-label">Cash reserve increase needed:</span>
                <span className="metric-value">${actionPlan.cashReserveIncrease.toLocaleString()}</span>
              </div>
            )}

            {actionPlan.timeToTarget && (
              <div className="plan-metric">
                <span className="metric-label">Time to target:</span>
                <span className="metric-value">{actionPlan.timeToTarget} months</span>
              </div>
            )}
          </div>

          <div className="plan-encouragement">
            <p>
              Remember: Progress is more important than perfection. Even small steps toward your
              target improve your financial security.
            </p>
          </div>
        </div>
      )}

      {/* Educational content */}
      <details className="educational-content">
        <summary>Why have an emergency fund?</summary>
        <div className="content-body">
          <h4>Peace of Mind</h4>
          <p>
            An emergency fund isn't about fear - it's about confidence. Knowing you can handle slow
            months or unexpected expenses lets you make better business decisions.
          </p>

          <h4>Common Uses</h4>
          <ul>
            <li>Covering expenses during seasonal slow periods</li>
            <li>Maintaining operations if a major client leaves</li>
            <li>Handling unexpected repairs or equipment replacement</li>
            <li>Continuing to pay yourself during market downturns</li>
            <li>Having time to find the right new opportunity rather than accepting the first one</li>
          </ul>

          <h4>How Much is Enough?</h4>
          <p>
            There's no one-size-fits-all answer. Consider your business's volatility, your personal
            risk tolerance, and whether you have other sources of income. More is not always
            better - cash sitting in reserves isn't working to grow your business.
          </p>
        </div>
      </details>
    </section>
  )
}
