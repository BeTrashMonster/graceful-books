/**
 * AccountCard Component
 *
 * Displays an individual account with key information.
 * Used in lists and detail views.
 *
 * Features:
 * - Account type badge with color coding
 * - Balance display with formatting
 * - Account number and description
 * - Parent account indicator
 * - Active/inactive status
 * - Quick actions (edit, delete)
 * - WCAG 2.1 AA accessible
 */

import { type FC, type MouseEvent } from 'react'
import clsx from 'clsx'
import { Button } from '../core/Button'
import type { Account } from '../../types'
import styles from './AccountCard.module.css'

export interface AccountCardProps {
  /**
   * Account data to display
   */
  account: Account

  /**
   * Show quick action buttons
   */
  showActions?: boolean

  /**
   * Called when edit button is clicked
   */
  onEdit?: (account: Account) => void

  /**
   * Called when delete button is clicked
   */
  onDelete?: (account: Account) => void

  /**
   * Called when card is clicked
   */
  onClick?: (account: Account) => void

  /**
   * Show parent account name if available
   */
  parentAccountName?: string

  /**
   * Custom className
   */
  className?: string

  /**
   * Visual variant
   */
  variant?: 'default' | 'compact'
}

/**
 * Get account type display label
 */
function getAccountTypeLabel(type: Account['type']): string {
  const labels: Record<Account['type'], string> = {
    'asset': 'Asset',
    'liability': 'Liability',
    'equity': 'Equity',
    'income': 'Income',
    'expense': 'Expense',
    'cost-of-goods-sold': 'COGS',
    'other-income': 'Other Income',
    'other-expense': 'Other Expense',
  }
  return labels[type] || type
}

/**
 * Format balance with currency
 */
function formatBalance(balance: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance)
}

/**
 * AccountCard Component
 *
 * @example
 * ```tsx
 * <AccountCard
 *   account={account}
 *   showActions
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 * ```
 */
export const AccountCard: FC<AccountCardProps> = ({
  account,
  showActions = false,
  onEdit,
  onDelete,
  onClick,
  parentAccountName,
  className,
  variant = 'default',
}) => {
  const handleEdit = (e: MouseEvent) => {
    e.stopPropagation()
    onEdit?.(account)
  }

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation()
    onDelete?.(account)
  }

  const handleClick = () => {
    onClick?.(account)
  }

  return (
    <div
      className={clsx(
        styles.accountCard,
        styles[variant],
        !account.isActive && styles.inactive,
        onClick && styles.clickable,
        className
      )}
      onClick={onClick ? handleClick : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleClick()
              }
            }
          : undefined
      }
      aria-label={`Account: ${account.name}`}
    >
      <div className={styles.header}>
        <div className={styles.titleSection}>
          {account.accountNumber && (
            <span className={styles.accountNumber} aria-label="Account number">
              {account.accountNumber}
            </span>
          )}
          <h3 className={styles.accountName}>{account.name}</h3>
          {!account.isActive && (
            <span className={styles.inactiveBadge} aria-label="Inactive account">
              Inactive
            </span>
          )}
        </div>
        <div className={styles.balanceSection}>
          <span className={styles.balance} aria-label="Current balance">
            {formatBalance(account.balance)}
          </span>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.metadata}>
          <span
            className={clsx(styles.typeBadge, styles[`type-${account.type}`])}
            aria-label="Account type"
          >
            {getAccountTypeLabel(account.type)}
          </span>

          {account.subType && (
            <span className={styles.subType} aria-label="Account sub-type">
              {account.subType}
            </span>
          )}

          {parentAccountName && (
            <span className={styles.parentAccount} aria-label="Parent account">
              Sub-account of: {parentAccountName}
            </span>
          )}
        </div>

        {account.description && variant === 'default' && (
          <p className={styles.description}>{account.description}</p>
        )}
      </div>

      {showActions && (
        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            aria-label={`Edit ${account.name}`}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            aria-label={`Delete ${account.name}`}
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  )
}
