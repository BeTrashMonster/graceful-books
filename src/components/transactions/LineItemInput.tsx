/**
 * LineItemInput Component
 *
 * Individual line item entry for transactions with account selection
 * and debit/credit input.
 *
 * Requirements: B2 - Transaction Entry - Basic
 */

import { useState, useEffect } from 'react'
import type { JournalEntryLine, Account } from '../../types'
import { Input } from '../forms/Input'
import { Select } from '../forms/Select'

export interface LineItemInputProps {
  lineItem: JournalEntryLine
  accounts: Account[]
  onChange: (lineItem: JournalEntryLine) => void
  onRemove?: () => void
  error?: string
  showRemove?: boolean
  disabled?: boolean
}

export function LineItemInput({
  lineItem,
  accounts,
  onChange,
  onRemove,
  error,
  showRemove = true,
  disabled = false,
}: LineItemInputProps) {
  const [localDebit, setLocalDebit] = useState(lineItem.debit.toString())
  const [localCredit, setLocalCredit] = useState(lineItem.credit.toString())

  // Format account options for select
  const accountOptions = accounts
    .filter((acc) => acc.isActive)
    .map((acc) => ({
      value: acc.id,
      label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
    }))

  // Handle account change
  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...lineItem,
      accountId: e.target.value,
    })
  }

  // Handle debit change
  const handleDebitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalDebit(value)

    const numValue = parseFloat(value) || 0
    onChange({
      ...lineItem,
      debit: numValue,
      credit: 0, // Clear credit when entering debit
    })

    if (numValue > 0) {
      setLocalCredit('0')
    }
  }

  // Handle credit change
  const handleCreditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalCredit(value)

    const numValue = parseFloat(value) || 0
    onChange({
      ...lineItem,
      credit: numValue,
      debit: 0, // Clear debit when entering credit
    })

    if (numValue > 0) {
      setLocalDebit('0')
    }
  }

  // Handle memo change
  const handleMemoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    onChange({
      ...lineItem,
      memo: value || undefined,
    })
  }

  // Format currency input on blur
  const formatCurrency = (value: string): string => {
    const num = parseFloat(value) || 0
    return num.toFixed(2)
  }

  const handleDebitBlur = () => {
    setLocalDebit(formatCurrency(localDebit))
  }

  const handleCreditBlur = () => {
    setLocalCredit(formatCurrency(localCredit))
  }

  // Sync local state with prop changes
  useEffect(() => {
    setLocalDebit(lineItem.debit.toFixed(2))
  }, [lineItem.debit])

  useEffect(() => {
    setLocalCredit(lineItem.credit.toFixed(2))
  }, [lineItem.credit])

  const selectedAccount = accounts.find((acc) => acc.id === lineItem.accountId)

  return (
    <div
      className="line-item-input"
      style={{
        display: 'grid',
        gridTemplateColumns: showRemove ? '2fr 1fr 1fr 2fr auto' : '2fr 1fr 1fr 2fr',
        gap: '0.75rem',
        alignItems: 'start',
        padding: '0.75rem',
        backgroundColor: error ? 'var(--color-error-light, #fee)' : 'transparent',
        borderRadius: '0.375rem',
        border: error ? '1px solid var(--color-error, #dc2626)' : 'none',
      }}
    >
      {/* Account Selection */}
      <div>
        <Select
          value={lineItem.accountId}
          onChange={handleAccountChange}
          options={accountOptions}
          placeholder="Select account..."
          disabled={disabled}
          aria-label="Account"
          aria-invalid={!!error}
        />
        {selectedAccount && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary, #6b7280)',
              marginTop: '0.25rem',
            }}
          >
            {selectedAccount.type}
          </div>
        )}
      </div>

      {/* Debit Input */}
      <div>
        <Input
          type="number"
          value={localDebit}
          onChange={handleDebitChange}
          onBlur={handleDebitBlur}
          placeholder="0.00"
          min="0"
          step="0.01"
          disabled={disabled || parseFloat(localCredit) > 0}
          aria-label="Debit"
          style={{
            textAlign: 'right',
            fontFamily: 'monospace',
          }}
        />
      </div>

      {/* Credit Input */}
      <div>
        <Input
          type="number"
          value={localCredit}
          onChange={handleCreditChange}
          onBlur={handleCreditBlur}
          placeholder="0.00"
          min="0"
          step="0.01"
          disabled={disabled || parseFloat(localDebit) > 0}
          aria-label="Credit"
          style={{
            textAlign: 'right',
            fontFamily: 'monospace',
          }}
        />
      </div>

      {/* Memo Input */}
      <div>
        <Input
          type="text"
          value={lineItem.memo || ''}
          onChange={handleMemoChange}
          placeholder="Description (optional)"
          disabled={disabled}
          aria-label="Description"
        />
      </div>

      {/* Remove Button */}
      {showRemove && (
        <div>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remove line item"
            style={{
              padding: '0.5rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border, #e5e7eb)',
              borderRadius: '0.375rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'var(--color-error, #dc2626)',
              fontSize: '1.25rem',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-error-light, #fee)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          style={{
            gridColumn: '1 / -1',
            color: 'var(--color-error, #dc2626)',
            fontSize: '0.875rem',
            marginTop: '-0.5rem',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

/**
 * Line Item Input Header
 * Shows column labels for line items
 */
export function LineItemHeader({ showRemove = true }: { showRemove?: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showRemove ? '2fr 1fr 1fr 2fr auto' : '2fr 1fr 1fr 2fr',
        gap: '0.75rem',
        padding: '0.5rem 0.75rem',
        fontWeight: 600,
        fontSize: '0.875rem',
        color: 'var(--color-text-secondary, #6b7280)',
        borderBottom: '2px solid var(--color-border, #e5e7eb)',
      }}
    >
      <div>Account</div>
      <div style={{ textAlign: 'right' }}>Debit</div>
      <div style={{ textAlign: 'right' }}>Credit</div>
      <div>Description</div>
      {showRemove && <div></div>}
    </div>
  )
}
