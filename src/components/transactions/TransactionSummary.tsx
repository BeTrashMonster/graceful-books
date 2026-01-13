/**
 * TransactionSummary Component
 *
 * Shows debits/credits balance and validation status for a transaction.
 *
 * Requirements: B2 - Transaction Entry - Basic
 */

import type { JournalEntryLine } from '../../types'
import { calculateBalance, validateTransaction } from '../../utils/transactionValidation'

export interface TransactionSummaryProps {
  lines: JournalEntryLine[]
  showValidation?: boolean
}

export function TransactionSummary({
  lines,
  showValidation = true,
}: TransactionSummaryProps) {
  const { totalDebits, totalCredits, difference, isBalanced } =
    calculateBalance(lines)

  const validation = showValidation ? validateTransaction(lines, {
    requireMinimumLines: false,
    allowUnbalanced: true,
  }) : null

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <div
      className="transaction-summary"
      style={{
        padding: '1rem',
        backgroundColor: 'var(--color-background-secondary, #f9fafb)',
        borderRadius: '0.5rem',
        border: '1px solid var(--color-border, #e5e7eb)',
      }}
    >
      {/* Balance Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          marginBottom: validation ? '1rem' : 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #6b7280)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.25rem',
            }}
          >
            Total Debits
          </div>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              fontFamily: 'monospace',
              color: 'var(--color-text, #111827)',
            }}
          >
            {formatCurrency(totalDebits)}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #6b7280)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.25rem',
            }}
          >
            Total Credits
          </div>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              fontFamily: 'monospace',
              color: 'var(--color-text, #111827)',
            }}
          >
            {formatCurrency(totalCredits)}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #6b7280)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.25rem',
            }}
          >
            Difference
          </div>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              fontFamily: 'monospace',
              color: isBalanced
                ? 'var(--color-success, #10b981)'
                : 'var(--color-error, #dc2626)',
            }}
          >
            {formatCurrency(Math.abs(difference))}
          </div>
        </div>
      </div>

      {/* Balance Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem',
          backgroundColor: isBalanced
            ? 'var(--color-success-light, #d1fae5)'
            : 'var(--color-warning-light, #fef3c7)',
          borderRadius: '0.375rem',
          marginBottom: validation ? '1rem' : 0,
        }}
      >
        <div
          style={{
            fontSize: '1.25rem',
          }}
        >
          {isBalanced ? '✓' : '⚠'}
        </div>
        <div>
          <div
            style={{
              fontWeight: 600,
              color: isBalanced
                ? 'var(--color-success-dark, #047857)'
                : 'var(--color-warning-dark, #92400e)',
            }}
          >
            {isBalanced ? 'Transaction is balanced' : 'Transaction is not balanced'}
          </div>
          {!isBalanced && (
            <div
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary, #6b7280)',
                marginTop: '0.25rem',
              }}
            >
              Debits and credits must be equal. Adjust amounts to balance.
            </div>
          )}
        </div>
      </div>

      {/* Validation Errors */}
      {validation && validation.errors.length > 0 && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--color-error-light, #fee)',
            borderRadius: '0.375rem',
            marginBottom: validation.warnings.length > 0 ? '1rem' : 0,
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: 'var(--color-error-dark, #991b1b)',
              marginBottom: '0.5rem',
            }}
          >
            Validation Errors
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.5rem',
              fontSize: '0.875rem',
              color: 'var(--color-error, #dc2626)',
            }}
          >
            {validation.errors.map((error, index) => (
              <li key={index} style={{ marginBottom: '0.25rem' }}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation Warnings */}
      {validation && validation.warnings.length > 0 && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--color-warning-light, #fef3c7)',
            borderRadius: '0.375rem',
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: 'var(--color-warning-dark, #92400e)',
              marginBottom: '0.5rem',
            }}
          >
            Warnings
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.5rem',
              fontSize: '0.875rem',
              color: 'var(--color-warning-dark, #92400e)',
            }}
          >
            {validation.warnings.map((warning, index) => (
              <li key={index} style={{ marginBottom: '0.25rem' }}>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
