/**
 * AccountList Component
 *
 * Displays a searchable, filterable list of accounts.
 * Can be displayed as cards or in tree view.
 *
 * Features:
 * - Search by name or account number
 * - Filter by type and status
 * - Sort by various criteria
 * - Toggle between card and tree views
 * - Display amounts for selectable date range
 * - WCAG 2.1 AA accessible
 */

import { type FC, useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '../forms/Input'
import { Select, type SelectOption } from '../forms/Select'
import { Button } from '../core/Button'
import { AccountCard } from './AccountCard'
import { AccountTree } from './AccountTree'
import { DateRangePopover } from './DateRangePopover'
import { useAccountBalances } from '../../hooks/useAccountBalances'
import {
  type DateRangePeriod,
  getDateRangeForPeriod,
  getPeriodOptions,
} from '../../utils/dateRanges'
import type { Account } from '../../types'
import type { AccountTreeNode } from '../../hooks/useAccounts'
import styles from './AccountList.module.css'

// Royal/Professional color palette for sections
const SECTION_COLOR_PALETTE = [
  { name: 'Royal Blue', header: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', card: '#e8f2fc', border: '#a8c8ed' },
  { name: 'Burgundy', header: 'linear-gradient(135deg, #742a2a 0%, #9b2c2c 100%)', card: '#fce8ea', border: '#f5b8be' },
  { name: 'Royal Purple', header: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)', card: '#f3e8ff', border: '#dbb8f5' },
  { name: 'Forest Green', header: 'linear-gradient(135deg, #1a4731 0%, #276749 100%)', card: '#e6f0e8', border: '#b5cebb' },
  { name: 'Rust', header: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)', card: '#ffedd5', border: '#f5c89a' },
  { name: 'Amber', header: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)', card: '#fef3c7', border: '#f5d67a' },
  { name: 'Teal', header: 'linear-gradient(135deg, #134e4a 0%, #0f766e 100%)', card: '#e2efed', border: '#a8cec8' },
  { name: 'Slate', header: 'linear-gradient(135deg, #334155 0%, #475569 100%)', card: '#e8ecf1', border: '#a8b5c4' },
  { name: 'Gold', header: 'linear-gradient(135deg, #92400e 0%, #d4af37 100%)', card: '#fefce8', border: '#e8d47a' },
  { name: 'Navy', header: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', card: '#e8e8fc', border: '#b8b8f0' },
]

// Storage key for section colors
const SECTION_COLORS_KEY = 'graceful-books-section-colors'

type SectionColors = Record<string, number> // account type -> palette index

export interface AccountListProps {
  /**
   * Accounts to display
   */
  accounts: Account[]

  /**
   * Tree nodes for hierarchical view
   */
  treeNodes?: AccountTreeNode[]

  /**
   * Called when an account is selected for editing
   */
  onEdit?: (account: Account) => void

  /**
   * Called when an account is selected for deletion
   */
  onDelete?: (account: Account) => void

  /**
   * Called when create button is clicked
   */
  onCreate?: () => void

  /**
   * Whether data is currently loading
   */
  isLoading?: boolean
}

type ViewMode = 'card' | 'tree'
type SortBy = 'name' | 'number' | 'type' | 'balance'

/**
 * AccountList Component
 */
export const AccountList: FC<AccountListProps> = ({
  accounts,
  treeNodes = [],
  onEdit,
  onDelete,
  onCreate,
  isLoading = false,
}) => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('active')
  const [sortBy, setSortBy] = useState<SortBy>('number')
  const [viewMode, setViewMode] = useState<ViewMode>('card')

  // Date range state for "Display Amounts For" feature
  const [selectedPeriod, setSelectedPeriod] = useState<DateRangePeriod>('all-time')
  const [customDateRange, setCustomDateRange] = useState<{ startDate: Date; endDate: Date } | undefined>()
  const [showCustomDatePopover, setShowCustomDatePopover] = useState(false)
  const periodSelectRef = useRef<HTMLDivElement>(null)

  // Section color customization
  const [sectionColors, setSectionColors] = useState<SectionColors>({})
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null)

  // Load section colors from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SECTION_COLORS_KEY)
      if (saved) {
        setSectionColors(JSON.parse(saved))
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  // Save section colors to localStorage
  const saveSectionColor = useCallback((accountType: string, colorIndex: number) => {
    const newColors = { ...sectionColors, [accountType]: colorIndex }
    setSectionColors(newColors)
    localStorage.setItem(SECTION_COLORS_KEY, JSON.stringify(newColors))
    setColorPickerOpen(null)
  }, [sectionColors])

  // Calculate the actual date range based on selection
  const dateRange = useMemo(() => {
    return getDateRangeForPeriod(selectedPeriod, customDateRange)
  }, [selectedPeriod, customDateRange])

  // Get balances: Balance Sheet uses account.balance, Income Statement calculates from transactions
  const calculatedBalances = useAccountBalances(accounts, dateRange)

  // Merge calculated balances with accounts
  // For parent accounts, calculate balance as sum of sub-accounts
  const accountsWithBalances = useMemo(() => {
    // First pass: get individual balances for non-parent accounts
    const accountBalances = new Map<string, number>()
    const childrenByParent = new Map<string, string[]>()

    // Build parent-children mapping
    accounts.forEach((account) => {
      if (account.parentAccountId) {
        const siblings = childrenByParent.get(account.parentAccountId) || []
        siblings.push(account.id)
        childrenByParent.set(account.parentAccountId, siblings)
      }
    })

    // Calculate balances for all accounts
    accounts.forEach((account) => {
      accountBalances.set(account.id, calculatedBalances.get(account.id) ?? account.balance)
    })

    // For parent accounts (accounts that have children), replace balance with sum of children
    childrenByParent.forEach((childIds, parentId) => {
      const childrenTotal = childIds.reduce((sum, childId) => {
        return sum + (accountBalances.get(childId) || 0)
      }, 0)
      accountBalances.set(parentId, childrenTotal)
    })

    return accounts.map((account) => ({
      ...account,
      balance: accountBalances.get(account.id) ?? account.balance,
    }))
  }, [accounts, calculatedBalances])

  const handleViewRegister = (account: Account) => {
    navigate(`/accounts/${account.id}/register`)
  }

  // Filter and sort accounts
  const filteredAccounts = useMemo(() => {
    let filtered = [...accountsWithBalances]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (acc) =>
          acc.name.toLowerCase().includes(term) ||
          acc.accountNumber?.toLowerCase().includes(term) ||
          acc.description?.toLowerCase().includes(term)
      )
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((acc) => acc.type === filterType)
    }

    // Status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter((acc) => acc.isActive)
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter((acc) => !acc.isActive)
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'number':
          if (a.accountNumber && b.accountNumber) {
            return a.accountNumber.localeCompare(b.accountNumber)
          }
          return a.name.localeCompare(b.name)
        case 'type':
          return a.type.localeCompare(b.type)
        case 'balance':
          return b.balance - a.balance
        default:
          return 0
      }
    })

    return filtered
  }, [accountsWithBalances, searchTerm, filterType, filterStatus, sortBy])

  const typeOptions: SelectOption[] = [
    { value: 'all', label: 'All Types' },
    { value: 'asset', label: 'Assets' },
    { value: 'liability', label: 'Liabilities' },
    { value: 'equity', label: 'Equity' },
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expenses' },
    { value: 'cost-of-goods-sold', label: 'COGS' },
    { value: 'other-income', label: 'Other Income' },
    { value: 'other-expense', label: 'Other Expenses' },
  ]

  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Accounts' },
    { value: 'active', label: 'Active Only' },
    { value: 'inactive', label: 'Inactive Only' },
  ]

  const sortOptions: SelectOption[] = [
    { value: 'number', label: 'Account Number' },
    { value: 'name', label: 'Name' },
    { value: 'type', label: 'Type' },
    { value: 'balance', label: 'Balance' },
  ]

  const periodOptions: SelectOption[] = getPeriodOptions().map((opt) => ({
    value: opt.value,
    label: opt.label,
  }))

  // Handle period selection
  const handlePeriodChange = (value: string) => {
    const period = value as DateRangePeriod
    if (period === 'custom') {
      setShowCustomDatePopover(true)
    } else {
      setSelectedPeriod(period)
      setCustomDateRange(undefined)
    }
  }

  // Handle custom date range apply
  const handleCustomDateApply = (startDate: Date, endDate: Date) => {
    setCustomDateRange({ startDate, endDate })
    setSelectedPeriod('custom')
    setShowCustomDatePopover(false)
  }

  if (isLoading) {
    return (
      <div className={styles.accountList}>
        <div className={styles.loading}>Loading accounts...</div>
      </div>
    )
  }

  return (
    <div className={styles.accountList}>
      <div className={styles.toolbar}>
        <div className={styles.searchBar}>
          <Input
            type="search"
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            aria-label="Search accounts"
          />
        </div>

        <div className={styles.filters}>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            options={typeOptions}
            aria-label="Filter by type"
          />

          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={statusOptions}
            aria-label="Filter by status"
          />

          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            options={sortOptions}
            aria-label="Sort by"
          />
        </div>

        <div className={styles.actions}>
          <div className={styles.viewToggle}>
            <Button
              variant={viewMode === 'card' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('card')}
              aria-label="Card view"
              aria-pressed={viewMode === 'card'}
            >
              Cards
            </Button>
            <Button
              variant={viewMode === 'tree' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('tree')}
              aria-label="Tree view"
              aria-pressed={viewMode === 'tree'}
            >
              Tree
            </Button>
          </div>

          {onCreate && (
            <Button variant="primary" onClick={onCreate}>
              Create Account
            </Button>
          )}
        </div>
      </div>

      <div className={styles.results}>
        <p className={styles.resultsCount}>
          {filteredAccounts.length} {filteredAccounts.length === 1 ? 'account' : 'accounts'}
        </p>

        <div className={styles.periodSelector} ref={periodSelectRef}>
          <span className={styles.periodLabel}>Display Amounts For:</span>
          <Select
            value={selectedPeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
            options={periodOptions}
            aria-label="Display amounts for period"
          />
          <DateRangePopover
            isOpen={showCustomDatePopover}
            onClose={() => setShowCustomDatePopover(false)}
            onApply={handleCustomDateApply}
            initialStartDate={customDateRange?.startDate}
            initialEndDate={customDateRange?.endDate}
            anchorRef={periodSelectRef as React.RefObject<HTMLElement>}
          />
        </div>
      </div>

      {filteredAccounts.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No accounts found</p>
          {searchTerm && <p>Try adjusting your search or filters</p>}
        </div>
      ) : (
        <div className={styles.content}>
          {viewMode === 'card' ? (
            <div className={styles.sectionsContainer}>
              {/* Group accounts by type */}
              {(['asset', 'liability', 'equity', 'income', 'cost-of-goods-sold', 'expense', 'other-income', 'other-expense'] as const)
                .map((accountType) => {
                  const typeAccounts = filteredAccounts.filter(
                    (acc) => acc.type === accountType && !acc.parentAccountId
                  )
                  if (typeAccounts.length === 0) return null

                  const sectionLabels: Record<string, string> = {
                    'asset': 'Assets',
                    'liability': 'Liabilities',
                    'equity': 'Equity',
                    'income': 'Income',
                    'expense': 'Expenses',
                    'cost-of-goods-sold': 'Cost of Goods Sold',
                    'other-income': 'Other Income',
                    'other-expense': 'Other Expenses',
                  }

                  // Get custom color or use default based on account type
                  const defaultColorIndex: Record<string, number> = {
                    'asset': 0, 'liability': 1, 'equity': 2, 'income': 3,
                    'cost-of-goods-sold': 4, 'expense': 5, 'other-income': 6, 'other-expense': 5,
                  }
                  const colorIndex = sectionColors[accountType] ?? defaultColorIndex[accountType] ?? 0
                  const colorTheme = SECTION_COLOR_PALETTE[colorIndex]

                  return (
                    <section
                      key={accountType}
                      className={styles.accountSection}
                      style={{
                        '--section-header-bg': colorTheme.header,
                        '--card-bg': colorTheme.card,
                        '--card-border': colorTheme.border,
                      } as React.CSSProperties}
                    >
                      <h2 className={styles.sectionHeader}>
                        <span className={styles.sectionTitle}>{sectionLabels[accountType]}</span>
                        <div className={styles.sectionActions}>
                          <span className={styles.sectionCount}>{typeAccounts.length}</span>
                          <button
                            type="button"
                            className={styles.colorPickerButton}
                            onClick={() => setColorPickerOpen(colorPickerOpen === accountType ? null : accountType)}
                            aria-label="Change section color"
                            title="Change color"
                          >
                            <span className={styles.colorPickerIcon}>●</span>
                          </button>
                        </div>
                      </h2>
                      {colorPickerOpen === accountType && (
                        <div className={styles.colorPicker}>
                          {SECTION_COLOR_PALETTE.map((color, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className={`${styles.colorSwatch} ${idx === colorIndex ? styles.selected : ''}`}
                              style={{ background: color.header }}
                              onClick={() => saveSectionColor(accountType, idx)}
                              aria-label={`Select ${color.name}`}
                              title={color.name}
                            />
                          ))}
                        </div>
                      )}
                      <div className={styles.cardGrid}>
                        {typeAccounts.map((account) => {
                          const children = filteredAccounts.filter(
                            (child) => child.parentAccountId === account.id
                          )
                          return (
                            <AccountCard
                              key={account.id}
                              account={account}
                              showActions
                              onEdit={onEdit}
                              onDelete={onDelete}
                              subAccounts={children}
                            />
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
            </div>
          ) : (
            <AccountTree
              nodes={treeNodes}
              groupByType
              showBalances
              balances={calculatedBalances}
              onSelect={handleViewRegister}
            />
          )}
        </div>
      )}
    </div>
  )
}
