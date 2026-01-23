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
import { useNavigate } from 'react-router-dom'
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
   * Sub-accounts to display nested within this card
   */
  subAccounts?: Account[]

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
  subAccounts = [],
  className,
  variant = 'default',
}) => {
  const navigate = useNavigate()

  const handleEdit = (e: MouseEvent, acc: Account = account) => {
    e.stopPropagation()
    onEdit?.(acc)
  }

  const handleDelete = (e: MouseEvent, acc: Account = account) => {
    e.stopPropagation()
    onDelete?.(acc)
  }

  const handleViewRegister = (e: MouseEvent, acc: Account = account) => {
    e.stopPropagation()
    navigate(`/accounts/${acc.id}/register`)
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

      {subAccounts.length > 0 && (
        <div className={styles.subAccounts}>
          <div className={styles.subAccountsHeader}>Sub-accounts</div>
          {subAccounts.map((subAccount) => (
            <div key={subAccount.id} className={styles.subAccountRow}>
              <div className={styles.subAccountInfo}>
                {subAccount.accountNumber && (
                  <span className={styles.subAccountNumber}>{subAccount.accountNumber}</span>
                )}
                <span className={styles.subAccountName}>{subAccount.name}</span>
                {!subAccount.isActive && (
                  <span className={styles.inactiveBadge}>Inactive</span>
                )}
              </div>
              <div className={styles.subAccountBalance}>
                {formatBalance(subAccount.balance)}
              </div>
              {showActions && (
                <div className={styles.subAccountActions}>
                  <button
                    onClick={(e) => handleEdit(e, subAccount)}
                    className={styles.iconButton}
                    aria-label={`Edit ${subAccount.name}`}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, subAccount)}
                    className={styles.iconButton}
                    aria-label={`Delete ${subAccount.name}`}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showActions && (
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => handleViewRegister(e)}
            aria-label={`View register for ${account.name}`}
          >
            View Register
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => handleEdit(e)}
            aria-label={`Edit ${account.name}`}
          >
            Edit
          </Button>
        </div>
      )}
    </div>
  )
}
