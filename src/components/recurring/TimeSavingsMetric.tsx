/**
 * TimeSavingsMetric Component
 *
 * Displays time-savings metrics from recurring transactions.
 *
 * Requirements:
 * - E2: Recurring Transactions [MVP]
 * - Show "Recurring transactions have saved you from entering X transactions manually"
 * - Delight detail from roadmap
 */

import { format } from 'date-fns';
import type { TimeSavingsMetrics } from '../../types/recurring.types';

export interface TimeSavingsMetricProps {
  metrics: TimeSavingsMetrics;
  variant?: 'card' | 'banner' | 'compact';
}

export function TimeSavingsMetric({
  metrics,
  variant = 'card',
}: TimeSavingsMetricProps) {
  if (variant === 'compact') {
    return <CompactMetric metrics={metrics} />;
  }

  if (variant === 'banner') {
    return <BannerMetric metrics={metrics} />;
  }

  return <CardMetric metrics={metrics} />;
}

function CardMetric({ metrics }: { metrics: TimeSavingsMetrics }) {
  const hours = Math.floor(metrics.estimated_time_saved_minutes / 60);
  const minutes = metrics.estimated_time_saved_minutes % 60;

  if (metrics.total_auto_created_transactions === 0) {
    return (
      <div
        style={{
          padding: '24px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.125rem', color: '#333' }}>
          Time Savings
        </h3>
        <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
          Create your first recurring transaction to start saving time!
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: '#f0fff0',
        borderRadius: '8px',
        border: '1px solid #90ee90',
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.125rem', color: '#2d5016' }}>
        Time Savings from Recurring Transactions
      </h3>

      {/* Main metric */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2d5016', marginBottom: '8px' }}>
          {metrics.total_auto_created_transactions}
        </div>
        <p style={{ margin: 0, fontSize: '1rem', color: '#4d7c2f' }}>
          transactions created automatically
        </p>
      </div>

      {/* Time saved */}
      <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#fff', borderRadius: '4px' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#2d5016', marginBottom: '4px' }}>
          {hours > 0 && `${hours}h `}
          {minutes}min
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
          estimated time saved
        </p>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#999' }}>
          (Based on 5 minutes per manual transaction entry)
        </p>
      </div>

      {/* Active recurring transactions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid #c0e0c0' }}>
        <span style={{ fontSize: '0.875rem', color: '#666' }}>
          Active recurring transactions:
        </span>
        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#2d5016' }}>
          {metrics.total_recurring_transactions}
        </span>
      </div>

      {/* Next scheduled */}
      {metrics.next_scheduled_occurrences.length > 0 && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #c0e0c0' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', fontWeight: '600', color: '#2d5016' }}>
            Next Scheduled:
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.875rem', color: '#666' }}>
            {metrics.next_scheduled_occurrences.slice(0, 3).map((occurrence) => (
              <li key={occurrence.recurring_transaction_id} style={{ marginBottom: '4px' }}>
                <strong>{occurrence.recurring_transaction_name}</strong> -{' '}
                {format(new Date(occurrence.next_occurrence), 'MMM d, yyyy')}
              </li>
            ))}
          </ul>
          {metrics.next_scheduled_occurrences.length > 3 && (
            <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#999' }}>
              ...and {metrics.next_scheduled_occurrences.length - 3} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BannerMetric({ metrics }: { metrics: TimeSavingsMetrics }) {
  if (metrics.total_auto_created_transactions === 0) {
    return null;
  }

  const hours = Math.floor(metrics.estimated_time_saved_minutes / 60);
  const minutes = metrics.estimated_time_saved_minutes % 60;

  return (
    <div
      style={{
        padding: '16px 24px',
        backgroundColor: '#f0fff0',
        borderRadius: '6px',
        border: '1px solid #90ee90',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#2d5016' }}>
          Recurring transactions have saved you from entering{' '}
          <strong>{metrics.total_auto_created_transactions}</strong> transactions manually
        </p>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#4d7c2f' }}>
          That's approximately{' '}
          {hours > 0 && `${hours} hours and `}
          {minutes} minutes saved!
        </p>
      </div>
      <div style={{ fontSize: '2rem' }}>⏱️</div>
    </div>
  );
}

function CompactMetric({ metrics }: { metrics: TimeSavingsMetrics }) {
  if (metrics.total_auto_created_transactions === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: '#f0fff0',
        borderRadius: '4px',
        fontSize: '0.875rem',
        color: '#2d5016',
      }}
    >
      <span>⏱️</span>
      <span>
        <strong>{metrics.total_auto_created_transactions}</strong> transactions auto-created
      </span>
      <span style={{ color: '#4d7c2f' }}>
        ({metrics.estimated_time_saved_minutes} min saved)
      </span>
    </div>
  );
}
