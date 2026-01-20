/**
 * Runway Gauge Component
 *
 * Visual gauge showing runway months with color coding
 * WCAG 2.1 AA compliant with text alternatives
 */

import React from 'react'
import type { RunwayHealthStatus } from '../../types/runway.types'
import './RunwayGauge.css'

interface RunwayGaugeProps {
  runwayMonths: number | null
  targetMonths: number
  healthStatus: RunwayHealthStatus
}

export const RunwayGauge: React.FC<RunwayGaugeProps> = ({
  runwayMonths,
  targetMonths,
  healthStatus,
}) => {
  // Calculate fill percentage (max out at 150% of target for visual purposes)
  const maxMonths = targetMonths * 1.5
  const fillPercentage =
    runwayMonths === null ? 100 : Math.min((runwayMonths / maxMonths) * 100, 100)

  // Get color class based on health status
  const colorClass = `gauge-fill-${healthStatus}`

  // Get icon based on health status
  const getHealthIcon = () => {
    switch (healthStatus) {
      case 'healthy':
        return '✓'
      case 'warning':
        return '⚠'
      case 'critical':
        return '!'
    }
  }

  const getAriaLabel = () => {
    if (runwayMonths === null) {
      return `Cash flow positive. Runway extending indefinitely. Health status: ${healthStatus}`
    }
    return `${runwayMonths.toFixed(1)} months of runway out of ${targetMonths} month target. Health status: ${healthStatus}`
  }

  return (
    <div className="runway-gauge" role="img" aria-label={getAriaLabel()}>
      {/* Visual gauge bar */}
      <div className="gauge-container">
        <div className="gauge-track">
          <div
            className={`gauge-fill ${colorClass}`}
            style={{ width: `${fillPercentage}%` }}
            role="presentation"
          />

          {/* Target marker */}
          <div
            className="gauge-target-marker"
            style={{ left: `${(targetMonths / maxMonths) * 100}%` }}
            aria-hidden="true"
          >
            <div className="marker-line" />
            <div className="marker-label">Target: {targetMonths}mo</div>
          </div>
        </div>

        {/* Scale labels */}
        <div className="gauge-scale" aria-hidden="true">
          <span className="scale-label">0</span>
          <span className="scale-label">{targetMonths / 2}</span>
          <span className="scale-label">{targetMonths}</span>
          <span className="scale-label">{maxMonths}</span>
        </div>
      </div>

      {/* Health indicator */}
      <div className={`gauge-health-indicator ${healthStatus}`} aria-hidden="true">
        <span className="health-icon">{getHealthIcon()}</span>
        <span className="health-label">{healthStatus}</span>
      </div>

      {/* Screen reader alternative */}
      <div className="sr-only">
        <table>
          <caption>Runway Gauge Data</caption>
          <tbody>
            <tr>
              <th scope="row">Current Runway</th>
              <td>{runwayMonths === null ? 'Infinite (cash flow positive)' : `${runwayMonths.toFixed(1)} months`}</td>
            </tr>
            <tr>
              <th scope="row">Target Runway</th>
              <td>{targetMonths} months</td>
            </tr>
            <tr>
              <th scope="row">Health Status</th>
              <td>{healthStatus}</td>
            </tr>
            <tr>
              <th scope="row">Progress</th>
              <td>
                {runwayMonths === null
                  ? 'Above target (cash flow positive)'
                  : runwayMonths >= targetMonths
                  ? 'At or above target'
                  : `${((runwayMonths / targetMonths) * 100).toFixed(0)}% of target`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
