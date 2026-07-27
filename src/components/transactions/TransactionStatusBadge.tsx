/**
 * TransactionStatusBadge Component
 *
 * Displays a status badge for transactions with appropriate colors
 * following the autumn/professional color palette.
 */

import { type FC } from 'react'
import clsx from 'clsx'
import type { TransactionStatus } from '../../types'
import styles from './TransactionStatusBadge.module.css'

export interface TransactionStatusBadgeProps {
  /**
   * Transaction status to display
   */
  status: TransactionStatus
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
 * Maps status to display text
 */
const STATUS_LABELS: Record<TransactionStatus, string> = {
  draft: 'Draft',
  posted: 'Posted',
  void: 'Void',
  reconciled: 'Reconciled',
}

/**
 * TransactionStatusBadge displays the status of a transaction
 * with appropriate colors following the autumn palette:
 * - posted: forest green
 * - draft: amber
 * - void: burgundy
 * - reconciled: teal
 */
export const TransactionStatusBadge: FC<TransactionStatusBadgeProps> = ({
  status,
  size = 'md',
  className,
}) => {
  return (
    <span
      className={clsx(
        styles.badge,
        styles[status],
        styles[size],
        className
      )}
      role="status"
      aria-label={`Status: ${STATUS_LABELS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
