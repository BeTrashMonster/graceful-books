/**
 * Runway Trend Chart Component
 *
 * Shows runway history over the past 12 months
 * WCAG 2.1 AA compliant with table alternative
 */

import React from 'react'
import type { RunwayTrendDataPoint } from '../../types/runway.types'
import './RunwayTrendChart.css'

interface RunwayTrendChartProps {
  data: RunwayTrendDataPoint[]
  targetMonths: number
}

export const RunwayTrendChart: React.FC<RunwayTrendChartProps> = ({ data, targetMonths }) => {
  if (data.length === 0) {
    return (
      <div className="runway-trend-chart empty">
        <p>Not enough data to show trend. Check back after a few months of activity.</p>
      </div>
    )
  }

  // Find max runway for scaling
  const maxRunway = Math.max(...data.map((d) => d.runwayMonths ?? targetMonths * 2), targetMonths * 1.5)

  // Calculate chart dimensions
  const chartHeight = 200
  const _chartWidth = 100 // percentage

  // Generate SVG path for line chart
  const generatePath = () => {
    if (data.length === 0) return ''

    const points = data.map((point, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = point.runwayMonths === null
        ? 0 // Top of chart for infinite runway
        : chartHeight - (point.runwayMonths / maxRunway) * chartHeight

      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }

  const path = generatePath()

  // Generate target line
  const targetY = chartHeight - (targetMonths / maxRunway) * chartHeight

  return (
    <div className="runway-trend-chart">
      {/* Visual chart */}
      <div
        className="chart-container"
        role="img"
        aria-label={`Runway trend over ${data.length} months showing ${data[data.length - 1].runwayMonths === null ? 'infinite runway' : `${data[data.length - 1].runwayMonths?.toFixed(1)} months`}`}
      >
        <svg
          viewBox={`0 0 100 ${chartHeight}`}
          preserveAspectRatio="none"
          className="trend-chart-svg"
          aria-hidden="true"
        >
          {/* Grid lines */}
          <line
            x1="0"
            y1={targetY}
            x2="100"
            y2={targetY}
            className="target-line"
            strokeDasharray="5,5"
          />

          {/* Runway line */}
          <path d={path} className="runway-line" fill="none" stroke="#0066cc" strokeWidth="2" />

          {/* Data points */}
          {data.map((point, index) => {
            const x = (index / (data.length - 1)) * 100
            const y =
              point.runwayMonths === null
                ? 0
                : chartHeight - (point.runwayMonths / maxRunway) * chartHeight

            return (
              <circle key={index} cx={x} cy={y} r="1.5" className="data-point" fill="#0066cc" />
            )
          })}
        </svg>

        {/* Y-axis labels */}
        <div className="y-axis-labels" aria-hidden="true">
          <span className="axis-label">{maxRunway.toFixed(0)}mo</span>
          <span className="axis-label">{(maxRunway / 2).toFixed(0)}mo</span>
          <span className="axis-label">0mo</span>
        </div>

        {/* X-axis labels */}
        <div className="x-axis-labels" aria-hidden="true">
          <span className="axis-label">
            {data[0].date.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="axis-label">
            {data[Math.floor(data.length / 2)]?.date.toLocaleDateString('en-US', {
              month: 'short',
            })}
          </span>
          <span className="axis-label">
            {data[data.length - 1].date.toLocaleDateString('en-US', { month: 'short' })}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="chart-legend" aria-hidden="true">
        <div className="legend-item">
          <span className="legend-line runway" />
          <span className="legend-label">Runway</span>
        </div>
        <div className="legend-item">
          <span className="legend-line target" />
          <span className="legend-label">Target ({targetMonths}mo)</span>
        </div>
      </div>

      {/* Screen reader table alternative */}
      <details className="chart-data-table">
        <summary>View runway trend data as table</summary>
        <table>
          <caption>Runway Trend Data (Past 12 Months)</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Runway (months)</th>
              <th scope="col">Cash</th>
              <th scope="col">Burn Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point, index) => (
              <tr key={index}>
                <td>{point.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td>
                <td>
                  {point.runwayMonths === null
                    ? 'Infinite (cash flow positive)'
                    : point.runwayMonths.toFixed(1)}
                </td>
                <td>${point.cash.toLocaleString()}</td>
                <td>
                  {point.burnRate >= 0 ? '+' : ''}${point.burnRate.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
