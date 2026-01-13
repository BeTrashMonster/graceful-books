/**
 * TransactionForm Component
 *
 * Form for creating and editing transactions with double-entry validation.
 *
 * Requirements: B2 - Transaction Entry - Basic
 */

import { useState } from 'react'
import type { JournalEntry, JournalEntryLine, Account } from '../../types'
import { LineItemInput, LineItemHeader } from './LineItemInput'
import { TransactionSummary } from './TransactionSummary'
import { Input } from '../forms/Input'
import { useNewLineItem } from '../../hooks/useTransactions'
import { validateLineItem } from '../../utils/transactionValidation'

export interface TransactionFormProps {
  transaction: JournalEntry
  accounts: Account[]
  onChange: (transaction: JournalEntry) => void
  onSave: () => void
  onCancel: () => void
  isLoading?: boolean
  error?: string
}

export function TransactionForm({
  transaction,
  accounts,
  onChange,
  onSave,
  onCancel,
  isLoading = false,
  error,
}: TransactionFormProps) {
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...transaction,
      date: new Date(e.target.value),
    })
  }

  const handleReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...transaction,
      reference: e.target.value || undefined,
    })
  }

  const handleMemoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...transaction,
      memo: e.target.value || undefined,
    })
  }

  const handleLineChange = (index: number, line: JournalEntryLine) => {
    const newLines = [...transaction.lines]
    newLines[index] = line

    // Validate the line
    const validation = validateLineItem(line)
    setLineErrors((prev) => ({
      ...prev,
      [line.id]: validation.isValid ? '' : validation.errors.join(', '),
    }))

    onChange({
      ...transaction,
      lines: newLines,
    })
  }

  const handleAddLine = () => {
    const newLine = useNewLineItem()
    onChange({
      ...transaction,
      lines: [...transaction.lines, newLine],
    })
  }

  const handleRemoveLine = (index: number) => {
    const newLines = transaction.lines.filter((_, i) => i !== index)
    onChange({
      ...transaction,
      lines: newLines,
    })
  }

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0] || ''
  }

  const canEdit = transaction.status === 'draft'

  return (
    <div className="transaction-form" style={{ maxWidth: '1200px' }}>
      {/* Header Info */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <label
            htmlFor="transaction-date"
            style={{
              display: 'block',
              fontWeight: 600,
              marginBottom: '0.5rem',
            }}
          >
            Date *
          </label>
          <Input
            id="transaction-date"
            type="date"
            value={formatDateForInput(transaction.date)}
            onChange={handleDateChange}
            disabled={!canEdit || isLoading}
          />
        </div>

        <div>
          <label
            htmlFor="transaction-reference"
            style={{
              display: 'block',
              fontWeight: 600,
              marginBottom: '0.5rem',
            }}
          >
            Reference
          </label>
          <Input
            id="transaction-reference"
            type="text"
            value={transaction.reference || ''}
            onChange={handleReferenceChange}
            placeholder="Invoice #, check #, etc."
            disabled={!canEdit || isLoading}
          />
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label
          htmlFor="transaction-memo"
          style={{
            display: 'block',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}
        >
          Memo
        </label>
        <Input
          id="transaction-memo"
          type="text"
          value={transaction.memo || ''}
          onChange={handleMemoChange}
          placeholder="Description of this transaction"
          disabled={!canEdit || isLoading}
        />
      </div>

      {/* Line Items */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Line Items
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={handleAddLine}
              disabled={isLoading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--color-primary, #3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              + Add Line
            </button>
          )}
        </div>

        <div style={{ border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '0.5rem', overflow: 'hidden' }}>
          <LineItemHeader showRemove={canEdit && transaction.lines.length > 2} />

          {transaction.lines.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary, #6b7280)' }}>
              No line items yet. Click "Add Line" to get started.
            </div>
          ) : (
            transaction.lines.map((line, index) => (
              <LineItemInput
                key={line.id}
                lineItem={line}
                accounts={accounts}
                onChange={(updatedLine) => handleLineChange(index, updatedLine)}
                onRemove={
                  canEdit && transaction.lines.length > 2
                    ? () => handleRemoveLine(index)
                    : undefined
                }
                error={lineErrors[line.id]}
                showRemove={canEdit && transaction.lines.length > 2}
                disabled={!canEdit || isLoading}
              />
            ))
          )}
        </div>
      </div>

      {/* Transaction Summary */}
      <div style={{ marginBottom: '1.5rem' }}>
        <TransactionSummary lines={transaction.lines} showValidation={true} />
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--color-error-light, #fee)',
            borderRadius: '0.375rem',
            marginBottom: '1rem',
            color: 'var(--color-error, #dc2626)',
          }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'transparent',
            color: 'var(--color-text, #111827)',
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: '0.375rem',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          Cancel
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={onSave}
            disabled={isLoading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--color-primary, #3b82f6)',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {isLoading ? 'Saving...' : 'Save Transaction'}
          </button>
        )}
      </div>
    </div>
  )
}
