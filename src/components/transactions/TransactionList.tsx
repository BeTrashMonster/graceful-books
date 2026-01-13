/**
 * TransactionList Component
 *
 * List view of all transactions with filtering and sorting.
 *
 * Requirements: B2 - Transaction Entry - Basic
 */

import { format } from 'date-fns'
import type { JournalEntry } from '../../types'

export interface TransactionListProps {
  transactions: JournalEntry[]
  onSelect: (transaction: JournalEntry) => void
  onDelete?: (id: string) => void
  isLoading?: boolean
}

export function TransactionList({
  transactions,
  onSelect,
  onDelete,
  isLoading = false,
}: TransactionListProps) {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const getTotalAmount = (transaction: JournalEntry): number => {
    return transaction.lines.reduce(
      (sum, line) => sum + (line.debit || line.credit),
      0
    ) / 2 // Divide by 2 since debits + credits = 2x transaction amount
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'posted':
        return 'var(--color-success, #10b981)'
      case 'draft':
        return 'var(--color-warning, #f59e0b)'
      case 'void':
        return 'var(--color-error, #dc2626)'
      default:
        return 'var(--color-text-secondary, #6b7280)'
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading transactions...</div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div
        style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--color-text-secondary, #6b7280)',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          No transactions yet
        </div>
        <div>Create your first transaction to get started.</div>
      </div>
    )
  }

  return (
    <div className="transaction-list">
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: '2px solid var(--color-border, #e5e7eb)',
            }}
          >
            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
              Date
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
              Reference
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
              Memo
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
              Amount
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
              Status
            </th>
            {onDelete && (
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr
              key={transaction.id}
              onClick={() => onSelect(transaction)}
              style={{
                borderBottom: '1px solid var(--color-border, #e5e7eb)',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-background-secondary, #f9fafb)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <td style={{ padding: '0.75rem' }}>
                {format(new Date(transaction.date), 'MMM dd, yyyy')}
              </td>
              <td style={{ padding: '0.75rem' }}>{transaction.reference || '—'}</td>
              <td style={{ padding: '0.75rem' }}>{transaction.memo || '—'}</td>
              <td
                style={{
                  padding: '0.75rem',
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                }}
              >
                {formatCurrency(getTotalAmount(transaction))}
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    backgroundColor: `${getStatusColor(transaction.status)}20`,
                    color: getStatusColor(transaction.status),
                    textTransform: 'capitalize',
                  }}
                >
                  {transaction.status}
                </span>
              </td>
              {onDelete && (
                <td
                  style={{ padding: '0.75rem', textAlign: 'center' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {transaction.status === 'draft' && (
                    <button
                      onClick={() => onDelete(transaction.id)}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'var(--color-error, #dc2626)',
                        cursor: 'pointer',
                        fontSize: '1.25rem',
                      }}
                      aria-label="Delete transaction"
                    >
                      🗑️
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
