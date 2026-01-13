/**
 * RecurringTransactionList Component
 *
 * List of recurring transactions with edit and delete options.
 *
 * Requirements:
 * - E2: Recurring Transactions [MVP]
 * - Display recurring transactions with next occurrence
 * - Edit series or single instance
 * - Show active/inactive status
 */

import { format } from 'date-fns';
import { Button } from '../core/Button';
import { getRecurrenceDescription } from '../../services/recurrence.service';
import type { RecurringTransactionSummary } from '../../types/recurring.types';

export interface RecurringTransactionListProps {
  recurringTransactions: RecurringTransactionSummary[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  isLoading?: boolean;
}

export function RecurringTransactionList({
  recurringTransactions,
  onEdit,
  onDelete,
  onToggleActive,
  isLoading = false,
}: RecurringTransactionListProps) {
  if (recurringTransactions.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#666' }}>
        <p style={{ fontSize: '1.125rem', marginBottom: '8px' }}>
          No recurring transactions yet
        </p>
        <p style={{ fontSize: '0.875rem' }}>
          Create your first recurring transaction to save time on repetitive entries
        </p>
      </div>
    );
  }

  return (
    <div className="recurring-transaction-list">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Name</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Schedule</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Next Occurrence</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Mode</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Created</th>
            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Status</th>
            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {recurringTransactions.map((rt) => (
            <RecurringTransactionRow
              key={rt.id}
              recurringTransaction={rt}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              isLoading={isLoading}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface RecurringTransactionRowProps {
  recurringTransaction: RecurringTransactionSummary;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  isLoading?: boolean;
}

function RecurringTransactionRow({
  recurringTransaction,
  onEdit,
  onDelete,
  onToggleActive,
  isLoading = false,
}: RecurringTransactionRowProps) {
  const schedule = getRecurrenceDescription(recurringTransaction.recurrence_rule);

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${recurringTransaction.name}"?`)) {
      onDelete(recurringTransaction.id);
    }
  };

  const handleToggleActive = () => {
    onToggleActive(recurringTransaction.id, !recurringTransaction.active);
  };

  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '12px' }}>
        <div>
          <div style={{ fontWeight: '500', marginBottom: '4px' }}>
            {recurringTransaction.name}
          </div>
          {recurringTransaction.created_count > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              {recurringTransaction.created_count} transaction{recurringTransaction.created_count !== 1 ? 's' : ''} created
            </div>
          )}
        </div>
      </td>
      <td style={{ padding: '12px', fontSize: '0.875rem' }}>
        {schedule}
      </td>
      <td style={{ padding: '12px' }}>
        {recurringTransaction.next_occurrence ? (
          <div>
            <div style={{ fontWeight: '500' }}>
              {format(new Date(recurringTransaction.next_occurrence), 'MMM d, yyyy')}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              {getTimeUntil(recurringTransaction.next_occurrence)}
            </div>
          </div>
        ) : (
          <span style={{ color: '#999', fontSize: '0.875rem' }}>Ended</span>
        )}
      </td>
      <td style={{ padding: '12px', fontSize: '0.875rem' }}>
        {recurringTransaction.auto_creation_mode === 'AUTO' ? (
          <span style={{ color: '#0066cc' }}>Auto-post</span>
        ) : (
          <span style={{ color: '#666' }}>Draft</span>
        )}
      </td>
      <td style={{ padding: '12px', fontSize: '0.875rem', color: '#666' }}>
        {format(new Date(recurringTransaction.created_at), 'MMM d, yyyy')}
      </td>
      <td style={{ padding: '12px', textAlign: 'center' }}>
        <button
          onClick={handleToggleActive}
          disabled={isLoading}
          style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '500',
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            backgroundColor: recurringTransaction.active ? '#d4edda' : '#f8d7da',
            color: recurringTransaction.active ? '#155724' : '#721c24',
          }}
        >
          {recurringTransaction.active ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td style={{ padding: '12px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <Button
            size="small"
            onClick={() => onEdit(recurringTransaction.id)}
            disabled={isLoading}
          >
            Edit
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={handleDelete}
            disabled={isLoading}
          >
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

/**
 * Get human-readable time until date
 */
function getTimeUntil(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;

  if (diff < 0) {
    return 'Overdue';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days === 0) {
    if (hours === 0) {
      return 'Today';
    }
    return `In ${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  if (days === 1) {
    return 'Tomorrow';
  }

  if (days < 7) {
    return `In ${days} days`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return `In ${weeks} week${weeks !== 1 ? 's' : ''}`;
  }

  const months = Math.floor(days / 30);
  return `In ${months} month${months !== 1 ? 's' : ''}`;
}
