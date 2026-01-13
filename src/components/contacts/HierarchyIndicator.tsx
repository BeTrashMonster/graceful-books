/**
 * HierarchyIndicator Component
 *
 * Displays visual hierarchy information for a contact (customer/vendor).
 * Shows parent/child/standalone status with appropriate icons and navigation.
 *
 * Features:
 * - Visual hierarchy status (parent/child/standalone) with icons
 * - Hierarchy level badge for depth indication
 * - Sub-account count for parent accounts
 * - Breadcrumb navigation to parent (for child accounts)
 * - Compact and expanded view modes
 * - WCAG 2.1 AA accessible
 *
 * Per G3: Hierarchical Contacts Infrastructure
 */

import { type FC, type MouseEvent } from 'react'
import clsx from 'clsx'
import type { Contact } from '../../types/database.types'
import styles from './HierarchyIndicator.module.css'

export interface HierarchyIndicatorProps {
  /**
   * Contact data to display hierarchy information for
   */
  contact: Contact

  /**
   * Display mode - compact shows minimal info, expanded shows full details
   */
  view?: 'compact' | 'expanded'

  /**
   * Number of sub-accounts (required for parent accounts in compact view)
   */
  subAccountCount?: number

  /**
   * Parent contact name (required for child accounts to show breadcrumb)
   */
  parentName?: string

  /**
   * Called when parent breadcrumb link is clicked
   * Only applicable for child accounts
   */
  onNavigateToParent?: (parentId: string) => void

  /**
   * Custom className
   */
  className?: string
}

/**
 * Get icon SVG based on account type
 */
function getHierarchyIcon(accountType: 'standalone' | 'parent' | 'child'): JSX.Element {
  switch (accountType) {
    case 'parent':
      return (
        <svg
          className={styles.icon}
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M8 1a2 2 0 0 1 2 2v1.5a.5.5 0 0 1-1 0V3a1 1 0 0 0-1-1 1 1 0 0 0-1 1v.5a.5.5 0 0 1-1 0V3a2 2 0 0 1 2-2Z" />
          <path d="M4.5 6a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7ZM4 9.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5Zm5 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5ZM4 12.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5Zm5 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5Z" />
          <path
            fillRule="evenodd"
            d="M3 5.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 13 5.5v8a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-8Zm1.5-.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-7Z"
          />
        </svg>
      )

    case 'child':
      return (
        <svg
          className={styles.icon}
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M10.854 3.646a.5.5 0 0 1 0 .708l-6.5 6.5a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L4 9.793l6.146-6.147a.5.5 0 0 1 .708 0Z" />
          <path d="M15.354 3.646a.5.5 0 0 1 0 .708l-6.5 6.5a.5.5 0 0 1-.708 0 .5.5 0 0 1 0-.708l6.5-6.5a.5.5 0 0 1 .708 0Z" />
          <path d="M2.5 0A1.5 1.5 0 0 0 1 1.5v13A1.5 1.5 0 0 0 2.5 16h11a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 13.5 3H11V1.5A1.5 1.5 0 0 0 9.5 0h-7Z" opacity="0.3" />
        </svg>
      )

    case 'standalone':
    default:
      return (
        <svg
          className={styles.icon}
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M3 5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Z" />
          <path
            fillRule="evenodd"
            d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4Z"
          />
        </svg>
      )
  }
}

/**
 * Get human-readable label for account type
 */
function getAccountTypeLabel(accountType: 'standalone' | 'parent' | 'child'): string {
  switch (accountType) {
    case 'parent':
      return 'Parent Account'
    case 'child':
      return 'Sub-Account'
    case 'standalone':
      return 'Standalone Account'
    default:
      return 'Account'
  }
}

/**
 * Get hierarchy level label
 */
function getHierarchyLevelLabel(level: number): string {
  if (level === 0) return 'Top Level'
  if (level === 1) return 'Level 1'
  if (level === 2) return 'Level 2'
  if (level === 3) return 'Level 3'
  return `Level ${level}`
}

/**
 * HierarchyIndicator Component
 *
 * @example
 * ```tsx
 * // Standalone account (compact view)
 * <HierarchyIndicator
 *   contact={standaloneContact}
 *   view="compact"
 * />
 *
 * // Parent account with sub-accounts (expanded view)
 * <HierarchyIndicator
 *   contact={parentContact}
 *   view="expanded"
 *   subAccountCount={5}
 * />
 *
 * // Child account with parent navigation (expanded view)
 * <HierarchyIndicator
 *   contact={childContact}
 *   view="expanded"
 *   parentName="Acme Corp (Main)"
 *   onNavigateToParent={handleNavigateToParent}
 * />
 * ```
 */
export const HierarchyIndicator: FC<HierarchyIndicatorProps> = ({
  contact,
  view = 'compact',
  subAccountCount = 0,
  parentName,
  onNavigateToParent,
  className,
}) => {
  const handleParentClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (contact.parent_id && onNavigateToParent) {
      onNavigateToParent(contact.parent_id)
    }
  }

  const accountTypeLabel = getAccountTypeLabel(contact.account_type)
  const hierarchyLevelLabel = getHierarchyLevelLabel(contact.hierarchy_level)
  const icon = getHierarchyIcon(contact.account_type)

  // Standalone accounts in compact view don't need to show anything
  if (view === 'compact' && contact.account_type === 'standalone') {
    return null
  }

  return (
    <div
      className={clsx(
        styles.hierarchyIndicator,
        styles[view],
        styles[contact.account_type],
        className
      )}
      role="status"
      aria-label={`Hierarchy information: ${accountTypeLabel}`}
    >
      {/* Icon and Type Label */}
      <div className={styles.typeSection}>
        {icon}
        <span className={styles.typeLabel}>{accountTypeLabel}</span>
      </div>

      {/* Hierarchy Level Badge */}
      {contact.hierarchy_level > 0 && view === 'expanded' && (
        <span
          className={styles.levelBadge}
          aria-label={`Hierarchy depth: ${hierarchyLevelLabel}`}
        >
          {hierarchyLevelLabel}
        </span>
      )}

      {/* Sub-account Count (for parent accounts) */}
      {contact.account_type === 'parent' && subAccountCount > 0 && (
        <div className={styles.subAccountCount}>
          <svg
            className={styles.countIcon}
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1H2V4Z" />
            <path
              fillRule="evenodd"
              d="M2 7h12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7Zm3 1a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H5Z"
            />
          </svg>
          <span className={styles.countText}>
            {subAccountCount} {subAccountCount === 1 ? 'sub-account' : 'sub-accounts'}
          </span>
        </div>
      )}

      {/* Parent Breadcrumb (for child accounts) */}
      {contact.account_type === 'child' && contact.parent_id && view === 'expanded' && (
        <div className={styles.breadcrumb}>
          <svg
            className={styles.breadcrumbIcon}
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0Z"
            />
          </svg>
          {onNavigateToParent ? (
            <button
              type="button"
              className={styles.breadcrumbLink}
              onClick={handleParentClick}
              aria-label={`Navigate to parent account: ${parentName || 'Parent'}`}
            >
              {parentName || 'Parent Account'}
            </button>
          ) : (
            <span className={styles.breadcrumbText}>
              {parentName || 'Parent Account'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
