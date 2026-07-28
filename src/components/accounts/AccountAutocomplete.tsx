/**
 * AccountAutocomplete Component
 *
 * Searchable typeahead dropdown for selecting accounts.
 * Shows ALL accounts grouped by type with search filtering.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import type { Account } from '../../types'
import styles from './AccountAutocomplete.module.css'

export interface AccountAutocompleteProps {
  value: string
  onChange: (accountId: string, account?: Account) => void
  accounts: Account[]
  placeholder?: string
  disabled?: boolean
  flexAccounts?: Account[]
  getFlexLabel?: (acc: Account) => string
}

// Account type display labels
const TYPE_LABELS: Record<string, string> = {
  'asset': 'Assets',
  'liability': 'Liabilities',
  'equity': 'Equity',
  'income': 'Income',
  'expense': 'Expenses',
  'cost-of-goods-sold': 'Cost of Goods Sold',
  'other-income': 'Other Income',
  'other-expense': 'Other Expense',
}

// Order for account type groups
const TYPE_ORDER = [
  'expense',
  'cost-of-goods-sold',
  'other-expense',
  'asset',
  'liability',
  'equity',
  'income',
  'other-income',
]

export function AccountAutocomplete({
  value,
  onChange,
  accounts,
  placeholder = 'Search accounts...',
  disabled = false,
  flexAccounts = [],
  getFlexLabel,
}: AccountAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Find selected account
  const selectedAccount = useMemo(() => {
    if (!value) return null
    const acc = accounts.find((a) => a.id === value)
    if (acc) return acc
    // Check flex accounts too
    return flexAccounts.find((a) => a.id === value) || null
  }, [value, accounts, flexAccounts])

  // Filter and group accounts based on search
  const { filteredAccounts, groupedResults } = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()

    // Filter accounts
    const filtered = term
      ? accounts.filter(
          (acc) =>
            acc.name.toLowerCase().includes(term) ||
            acc.accountNumber?.toLowerCase().includes(term) ||
            acc.description?.toLowerCase().includes(term)
        )
      : accounts

    // Group by type
    const groups: Record<string, Account[]> = {}
    for (const acc of filtered) {
      const groupKey = acc.type
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(acc)
    }

    // Sort each group
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        // Sort by account number if present, then by name
        if (a.accountNumber && b.accountNumber) {
          return a.accountNumber.localeCompare(b.accountNumber)
        }
        return (a.name || '').localeCompare(b.name || '')
      })
    }

    // Filter flex accounts too
    const filteredFlex = term
      ? flexAccounts.filter((acc) =>
          acc.name.toLowerCase().includes(term) ||
          (getFlexLabel?.(acc) || '').toLowerCase().includes(term)
        )
      : flexAccounts

    return { filteredAccounts: filtered, groupedResults: groups, filteredFlex }
  }, [accounts, flexAccounts, searchTerm, getFlexLabel])

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    if (!isOpen) setIsOpen(true)
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  const handleSelectAccount = (account: Account, label?: string) => {
    onChange(account.id, account)
    setSearchTerm('')
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setSearchTerm('')
  }

  // Display value
  const displayValue = selectedAccount
    ? flexAccounts.some((f) => f.id === selectedAccount.id) && getFlexLabel
      ? getFlexLabel(selectedAccount)
      : `${selectedAccount.accountNumber ? selectedAccount.accountNumber + ' - ' : ''}${selectedAccount.name}`
    : searchTerm

  // Count total results
  const totalResults = filteredAccounts.length + (flexAccounts.length > 0 ? flexAccounts.filter(
    (acc) => !searchTerm || acc.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).length : 0)

  return (
    <div className={styles.container} ref={dropdownRef}>
      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={styles.input}
          autoComplete="off"
        />
        {selectedAccount && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className={styles.clearButton}
            aria-label="Clear selection"
          >
            &times;
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className={styles.dropdown}>
          {totalResults === 0 && searchTerm.trim() && (
            <div className={styles.noResults}>
              No accounts found matching "{searchTerm}"
            </div>
          )}

          {/* Flex accounts (personal items) if present */}
          {flexAccounts.length > 0 && (
            <>
              {flexAccounts
                .filter(
                  (acc) =>
                    !searchTerm ||
                    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (getFlexLabel?.(acc) || '').toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSelectAccount(acc)}
                    className={`${styles.accountItem} ${value === acc.id ? styles.selected : ''} ${styles.flexItem}`}
                  >
                    <span className={styles.accountName}>
                      {getFlexLabel ? getFlexLabel(acc) : acc.name}
                    </span>
                    <span className={styles.accountType}>Personal</span>
                  </button>
                ))}
            </>
          )}

          {/* Grouped account list */}
          {TYPE_ORDER.filter((type) => groupedResults[type]?.length > 0).map((type) => (
            <div key={type} className={styles.accountGroup}>
              <div className={styles.groupHeader}>{TYPE_LABELS[type] || type}</div>
              {groupedResults[type].slice(0, searchTerm ? 50 : 15).map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleSelectAccount(acc)}
                  className={`${styles.accountItem} ${value === acc.id ? styles.selected : ''}`}
                >
                  <span className={styles.accountName}>
                    {acc.accountNumber && (
                      <span className={styles.accountNumber}>{acc.accountNumber}</span>
                    )}
                    {acc.name}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
