/**
 * CustomerCard Component
 *
 * Displays an individual customer with key information.
 * Used in lists and detail views.
 *
 * Features:
 * - Contact information display
 * - Active/inactive status
 * - Quick actions (edit, delete)
 * - WCAG 2.1 AA accessible
 *
 * Per ACCT-002: Customer Management
 */

import { type FC, type MouseEvent } from 'react'
import clsx from 'clsx'
import { Button } from '../core/Button'
import type { Contact } from '../../types'
import styles from './CustomerCard.module.css'

export interface CustomerCardProps {
  /**
   * Customer data to display
   */
  customer: Contact

  /**
   * Show quick action buttons
   */
  showActions?: boolean

  /**
   * Called when edit button is clicked
   */
  onEdit?: (customer: Contact) => void

  /**
   * Called when delete button is clicked
   */
  onDelete?: (customer: Contact) => void

  /**
   * Called when card is clicked
   */
  onClick?: (customer: Contact) => void

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
 * Format address for display
 */
function formatAddress(customer: Contact): string | null {
  if (!customer.address) return null

  const { line1, line2, city, state, postalCode } = customer.address
  const parts = [
    line1,
    line2,
    `${city}, ${state} ${postalCode}`,
  ].filter(Boolean)

  return parts.join(', ')
}

/**
 * CustomerCard Component
 *
 * @example
 * ```tsx
 * <CustomerCard
 *   customer={customer}
 *   showActions
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 * ```
 */
export const CustomerCard: FC<CustomerCardProps> = ({
  customer,
  showActions = false,
  onEdit,
  onDelete,
  onClick,
  className,
  variant = 'default',
}) => {
  const handleEdit = (e: MouseEvent) => {
    e.stopPropagation()
    onEdit?.(customer)
  }

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation()
    onDelete?.(customer)
  }

  const handleClick = () => {
    onClick?.(customer)
  }

  const formattedAddress = formatAddress(customer)

  return (
    <div
      className={clsx(
        styles.customerCard,
        styles[variant],
        !customer.isActive && styles.inactive,
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
      aria-label={`Customer: ${customer.name}`}
    >
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h3 className={styles.customerName}>{customer.name}</h3>
          {!customer.isActive && (
            <span className={styles.inactiveBadge} aria-label="Inactive customer">
              Inactive
            </span>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.contactInfo}>
          {customer.email && (
            <div className={styles.contactItem}>
              <span className={styles.contactLabel} aria-label="Email address">
                <svg className={styles.icon} aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 3a1 1 0 0 0-1 1v.5l7 4.667L15 4.5V4a1 1 0 0 0-1-1H2Z" />
                  <path d="M1 6.5v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5L8 11.167 1 6.5Z" />
                </svg>
              </span>
              <a href={`mailto:${customer.email}`} className={styles.contactValue}>
                {customer.email}
              </a>
            </div>
          )}

          {customer.phone && (
            <div className={styles.contactItem}>
              <span className={styles.contactLabel} aria-label="Phone number">
                <svg className={styles.icon} aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328Z" />
                </svg>
              </span>
              <a href={`tel:${customer.phone}`} className={styles.contactValue}>
                {customer.phone}
              </a>
            </div>
          )}

          {formattedAddress && variant === 'default' && (
            <div className={styles.contactItem}>
              <span className={styles.contactLabel} aria-label="Mailing address">
                <svg className={styles.icon} aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 1.5a1 1 0 0 1 1.414 0l6.647 6.646a.5.5 0 0 1-.708.708L14 8.207V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V8.207l-.646.647a.5.5 0 0 1-.708-.708L7.293 1.5Z" />
                </svg>
              </span>
              <span className={styles.contactValue}>
                {formattedAddress}
              </span>
            </div>
          )}
        </div>

        {customer.notes && variant === 'default' && (
          <div className={styles.notes}>
            <span className={styles.notesLabel}>Notes:</span>
            <p className={styles.notesText}>{customer.notes}</p>
          </div>
        )}
      </div>

      {showActions && (
        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            aria-label={`Edit ${customer.name}`}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            aria-label={`Delete ${customer.name}`}
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  )
}
