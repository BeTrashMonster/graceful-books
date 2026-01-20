/**
 * TrendChart Component
 *
 * Displays 12-month trend data for metrics with accessible fallback.
 *
 * Requirements: J4 - Key Financial Metrics Reports (Nice)
 * WCAG 2.1 AA: Provides data table alternative for screen readers
 */

import { useState } from 'react';
import type { MetricDataPoint } from '../../types/metrics.types';

export interface TrendChartProps {
  title: string;
  dataPoints: MetricDataPoint[];
  color?: string;
  height?: number;
}

export function TrendChart({ title, dataPoints, color = '#0066cc', height = 200 }: TrendChartProps) {
  const [showDataTable, setShowDataTable] = useState(false);

  if (dataPoints.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, color: '#666' }}>No historical data available for {title}</p>
      </div>
    );
  }

  // Calculate min/max for scaling
  const values = dataPoints.map((dp) => parseFloat(dp.value));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1; // Avoid divide by zero

  // Simple SVG line chart
  const width = 600;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = dataPoints
    .map((dp, index) => {
      const x = padding + (index / (dataPoints.length - 1)) * chartWidth;
      const value = parseFloat(dp.value);
      const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div
      style={{
        padding: '1.5rem',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: 'white',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>{title}</h4>
        <button
          type="button"
          onClick={() => setShowDataTable(!showDataTable)}
          style={{
            padding: '0.25rem 0.75rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
          aria-label={showDataTable ? 'Hide data table' : 'Show data table'}
        >
          {showDataTable ? 'Hide' : 'Show'} Data Table
        </button>
      </div>

      {!showDataTable ? (
        <>
          {/* Visual Chart */}
          <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ maxWidth: '100%' }}
            role="img"
            aria-label={`Line chart showing ${title} trend over time from ${dataPoints[0]!.label} to ${dataPoints[dataPoints.length - 1]!.label}`}
          >
            {/* Grid lines */}
            <g stroke="#e0e0e0" strokeWidth="1">
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                <line
                  key={pct}
                  x1={padding}
                  y1={padding + chartHeight * pct}
                  x2={width - padding}
                  y2={padding + chartHeight * pct}
                />
              ))}
            </g>

            {/* Line */}
            <polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Data points */}
            {dataPoints.map((dp, index) => {
              const x = padding + (index / (dataPoints.length - 1)) * chartWidth;
              const value = parseFloat(dp.value);
              const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="4"
                  fill={color}
                  aria-label={`${dp.label}: ${dp.value}`}
                >
                  <title>{`${dp.label}: ${dp.value}`}</title>
                </circle>
              );
            })}

            {/* X-axis labels */}
            <g fontSize="10" textAnchor="middle" fill="#666">
              {dataPoints.map((dp, index) => {
                const x = padding + (index / (dataPoints.length - 1)) * chartWidth;
                // Only show every 3rd label to avoid crowding
                if (index % 3 === 0 || index === dataPoints.length - 1) {
                  return (
                    <text key={index} x={x} y={height - 10}>
                      {dp.label}
                    </text>
                  );
                }
                return null;
              })}
            </g>

            {/* Y-axis labels */}
            <g fontSize="10" textAnchor="end" fill="#666">
              {[0, 0.5, 1].map((pct) => {
                const value = minValue + range * (1 - pct);
                return (
                  <text
                    key={pct}
                    x={padding - 10}
                    y={padding + chartHeight * pct + 4}
                  >
                    {value.toFixed(2)}
                  </text>
                );
              })}
            </g>
          </svg>
        </>
      ) : (
        /* Accessible Data Table */
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
          aria-label={`Data table for ${title}`}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Period</th>
              <th style={{ textAlign: 'right', padding: '0.75rem' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {dataPoints.map((dp, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '0.75rem' }}>{dp.label}</td>
                <td style={{ textAlign: 'right', padding: '0.75rem' }}>{dp.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
