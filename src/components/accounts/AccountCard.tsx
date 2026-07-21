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

import { type FC, type MouseEvent, useState, useRef, useEffect } from 'react'
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
  const [showEditMenu, setShowEditMenu] = useState(false)
  const editMenuRef = useRef<HTMLDivElement>(null)

  // Close edit menu when clicking outside
  useEffect(() => {
    if (!showEditMenu) return
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (editMenuRef.current && !editMenuRef.current.contains(e.target as Node)) {
        setShowEditMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEditMenu])

  const handleEdit = (e: MouseEvent, acc: Account = account) => {
    e.stopPropagation()
    setShowEditMenu(false)
    onEdit?.(acc)
  }

  const handleEditButtonClick = (e: MouseEvent) => {
    e.stopPropagation()
    if (subAccounts.length > 0) {
      setShowEditMenu(!showEditMenu)
    } else {
      onEdit?.(account)
    }
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
          <h3 className={styles.accountName}>
            {account.accountNumber && (
              <span className={styles.accountNumber} aria-label="Account number">
                {account.accountNumber}
              </span>
            )}
            {account.accountNumber && <span className={styles.separator}>·</span>}
            {account.name}
            {!account.isActive && (
              <span className={styles.inactiveBadge} aria-label="Inactive account">
                Inactive
              </span>
            )}
          </h3>
        </div>
        <div className={styles.balanceSection}>
          <span className={styles.balance} aria-label="Current balance">
            {formatBalance(account.balance)}
          </span>
        </div>
      </div>

      {subAccounts.length > 0 && (
        <div className={styles.subAccounts}>
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
          <div className={styles.editButtonWrapper} ref={editMenuRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditButtonClick}
              aria-label={`Edit ${account.name}`}
              aria-expanded={showEditMenu}
              aria-haspopup={subAccounts.length > 0 ? 'menu' : undefined}
            >
              Edit{subAccounts.length > 0 ? ' ▾' : ''}
            </Button>
            {showEditMenu && subAccounts.length > 0 && (
              <div className={styles.editMenu} role="menu">
                <button
                  type="button"
                  className={styles.editMenuItem}
                  onClick={(e) => handleEdit(e, account)}
                  role="menuitem"
                >
                  <span className={styles.editMenuIcon}>📁</span>
                  <span className={styles.editMenuText}>
                    <strong>{account.name}</strong>
                    <small>Parent Account</small>
                  </span>
                </button>
                {subAccounts.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    className={styles.editMenuItem}
                    onClick={(e) => handleEdit(e, sub)}
                    role="menuitem"
                  >
                    <span className={styles.editMenuIcon}>📄</span>
                    <span className={styles.editMenuText}>
                      {sub.accountNumber && <small>{sub.accountNumber} · </small>}
                      {sub.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
