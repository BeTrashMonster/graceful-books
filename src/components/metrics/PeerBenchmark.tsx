/**
 * PeerBenchmark Component
 *
 * Displays industry benchmark comparisons for metrics.
 *
 * Requirements: J4 - Key Financial Metrics Reports (Nice)
 */

import type { IndustryBenchmark } from '../../types/metrics.types';

export interface PeerBenchmarkProps {
  metricName: string;
  yourValue: string;
  benchmark?: IndustryBenchmark;
  industry?: string;
}

export function PeerBenchmark({ metricName, yourValue, benchmark, industry }: PeerBenchmarkProps) {
  if (!benchmark) {
    return (
      <div
        style={{
          padding: '1.5rem',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
        }}
      >
        <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>{metricName} - Industry Comparison</h4>
        <p style={{ margin: 0, color: '#666' }}>
          Industry benchmark data not available for this metric.
        </p>
      </div>
    );
  }

  const yourNumericValue = parseFloat(yourValue);
  const lowerQuartile = parseFloat(benchmark.lower_quartile);
  const upperQuartile = parseFloat(benchmark.upper_quartile);

  // Determine position relative to benchmark
  let position: 'below' | 'within' | 'above';
  if (yourNumericValue < lowerQuartile) {
    position = 'below';
  } else if (yourNumericValue > upperQuartile) {
    position = 'above';
  } else {
    position = 'within';
  }

  const positionColor =
    position === 'above' ? '#2e7d32' :
    position === 'within' ? '#0066cc' : '#d32f2f';

  return (
    <div
      style={{
        padding: '1.5rem',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: 'white',
      }}
    >
      <h4 style={{ margin: 0, marginBottom: '1rem' }}>
        {metricName} - {industry || benchmark.industry} Comparison
      </h4>

      {/* Visual comparison bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            height: '40px',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Quartile ranges */}
          <div
            style={{
              position: 'absolute',
              left: '25%',
              right: '25%',
              top: 0,
              bottom: 0,
              backgroundColor: '#e3f2fd',
            }}
          />

          {/* Your position marker */}
          <div
            style={{
              position: 'absolute',
              left: `${((yourNumericValue - lowerQuartile) / (upperQuartile - lowerQuartile)) * 50 + 25}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '4px',
              height: '100%',
              backgroundColor: positionColor,
            }}
            aria-label={`Your value: ${yourValue}`}
          >
            <div
              style={{
                position: 'absolute',
                top: '-30px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '0.25rem 0.5rem',
                backgroundColor: positionColor,
                color: 'white',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              You: {yourValue}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
          <span>Low: {benchmark.lower_quartile}</span>
          <span>Median: {benchmark.median}</span>
          <span>High: {benchmark.upper_quartile}</span>
        </div>
      </div>

      {/* Interpretation */}
      <div style={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          {position === 'above' && (
            <>
              <strong style={{ color: positionColor }}>Above industry average.</strong>{' '}
              Your {metricName.toLowerCase()} is stronger than most businesses in {benchmark.industry}.
            </>
          )}
          {position === 'within' && (
            <>
              <strong style={{ color: positionColor }}>Within industry range.</strong>{' '}
              Your {metricName.toLowerCase()} is typical for {benchmark.industry} businesses.
            </>
          )}
          {position === 'below' && (
            <>
              <strong style={{ color: positionColor }}>Below industry average.</strong>{' '}
              Your {metricName.toLowerCase()} is lower than most businesses in {benchmark.industry}.
            </>
          )}
        </p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#666' }}>
          Source: {benchmark.source} ({benchmark.as_of_year})
        </p>
      </div>
    </div>
  );
}
