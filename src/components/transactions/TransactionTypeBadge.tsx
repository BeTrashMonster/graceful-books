/**
 * TransactionTypeBadge Component
 *
 * Displays the transaction type in plain English.
 */

import { type FC } from 'react'
import clsx from 'clsx'
import type { TransactionType } from '../../types'
import styles from './TransactionTypeBadge.module.css'

export interface TransactionTypeBadgeProps {
  /**
   * Transaction type to display
   */
  type: TransactionType
  /**
   * Size variant
   */
  size?: 'sm' | 'md'
  /**
   * Additional class name
   */
  className?: string
}

/**
 * Maps transaction type to plain English labels
 */
const TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Expense',
  check: 'Check',
  bill: 'Bill',
  'bill-payment': 'Bill Payment',
  income: 'Income',
  deposit: 'Deposit',
  invoice: 'Invoice',
  'invoice-payment': 'Invoice Payment',
  transfer: 'Transfer',
  'credit-card-payment': 'Credit Card Payment',
  'liability-payment': 'Liability Payment',
  'journal-entry': 'Journal Entry',
  'opening-balance': 'Opening Balance',
}

/**
 * Maps transaction type to color category for styling
 */
type ColorCategory = 'rust' | 'green' | 'blue' | 'purple' | 'neutral'

const TYPE_COLORS: Record<TransactionType, ColorCategory> = {
  expense: 'rust',
  check: 'rust',
  bill: 'rust',
  'bill-payment': 'rust',
  income: 'green',
  deposit: 'green',
  invoice: 'green',
  'invoice-payment': 'green',
  transfer: 'blue',
  'credit-card-payment': 'purple',
  'liability-payment': 'purple',
  'journal-entry': 'neutral',
  'opening-balance': 'neutral',
}

/**
 * TransactionTypeBadge displays the type of transaction in plain English
 */
export const TransactionTypeBadge: FC<TransactionTypeBadgeProps> = ({
  type,
  size = 'md',
  className,
}) => {
  const colorCategory = TYPE_COLORS[type] || 'neutral'

  return (
    <span
      className={clsx(
        styles.badge,
        styles[size],
        styles[colorCategory],
        className
      )}
      aria-label={`Transaction type: ${TYPE_LABELS[type]}`}
    >
      {TYPE_LABELS[type]}
    </span>
  )
}
