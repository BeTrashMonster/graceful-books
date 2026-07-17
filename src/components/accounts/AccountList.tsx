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

import { type FC, useState, useMemo, useRef } from 'react'
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

  // Calculate the actual date range based on selection
  const dateRange = useMemo(() => {
    return getDateRangeForPeriod(selectedPeriod, customDateRange)
  }, [selectedPeriod, customDateRange])

  // Get balances: Balance Sheet uses account.balance, Income Statement calculates from transactions
  const calculatedBalances = useAccountBalances(accounts, dateRange)

  // Merge calculated balances with accounts
  const accountsWithBalances = useMemo(() => {
    return accounts.map((account) => ({
      ...account,
      balance: calculatedBalances.get(account.id) ?? account.balance,
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
            <div className={styles.cardGrid}>
              {filteredAccounts.filter(acc => !acc.parentAccountId).map((account) => {
                const children = filteredAccounts.filter(child => child.parentAccountId === account.id)
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
