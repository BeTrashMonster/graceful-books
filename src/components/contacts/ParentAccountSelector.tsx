/**
 * ParentAccountSelector Component
 *
 * Allows users to select a parent account when creating or editing a contact.
 * Implements hierarchical account management with validation and progressive disclosure.
 *
 * Features:
 * - Searchable dropdown of valid parent accounts
 * - Excludes current contact and descendants (prevents circular references)
 * - Visual indication of standalone vs parent accounts
 * - Displays account hierarchy level
 * - Progressive disclosure (collapsed by default)
 * - Validates selection using HierarchyValidator
 * - Only shows if user has multiple contacts
 * - WCAG 2.1 AA compliant
 *
 * Requirements:
 * - G3: Hierarchical Contacts Infrastructure
 * - Section 5.2: Parent Account Selector Component
 *
 * @example
 * ```tsx
 * <ParentAccountSelector
 *   value={contact.parent_id}
 *   onChange={(parentId) => setContact({ ...contact, parent_id: parentId })}
 *   currentContactId={contact.id}
 *   companyId={company.id}
 * />
 * ```
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/database'
import { HierarchyValidator } from '../../validators/hierarchyValidator'
import { HierarchyService } from '../../services/hierarchyService'
import { Select } from '../forms/Select'
import type { Contact } from '../../types/database.types'
import { ContactAccountType } from '../../types/database.types'
import styles from './ParentAccountSelector.module.css'

/**
 * Props for ParentAccountSelector component
 */
export interface ParentAccountSelectorProps {
  /**
   * Current parent ID (null for standalone)
   */
  value: string | null

  /**
   * Callback when parent selection changes
   */
  onChange: (parentId: string | null) => void

  /**
   * ID of the current contact being edited
   * Used to exclude self and descendants from parent options
   */
  currentContactId: string

  /**
   * Company ID to filter contacts
   */
  companyId: string

  /**
   * Additional contact IDs to exclude from parent options
   * (e.g., contacts that are already children of this contact)
   */
  excludeIds?: string[]

  /**
   * Whether the field is disabled
   */
  disabled?: boolean

  /**
   * Error message to display
   */
  error?: string

  /**
   * Helper text to display
   */
  helperText?: string

  /**
   * Whether to show expanded by default
   */
  defaultExpanded?: boolean
}

/**
 * Enhanced contact option with hierarchy information
 */
interface ContactOption {
  contact: Contact
  depth: number
  isValid: boolean
  invalidReason?: string
}

/**
 * ParentAccountSelector Component
 *
 * Provides a searchable dropdown for selecting parent contacts with validation
 * and visual hierarchy indicators. Uses progressive disclosure pattern.
 */
export function ParentAccountSelector({
  value,
  onChange,
  currentContactId,
  companyId,
  excludeIds = [],
  disabled = false,
  error,
  helperText = 'Optional: Set this contact as a sub-account under a parent contact',
  defaultExpanded = false,
}: ParentAccountSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [validationError, setValidationError] = useState<string | undefined>(error)
  const [isValidating, setIsValidating] = useState(false)

  // Fetch all contacts for the company (live query for real-time updates)
  const allContacts = useLiveQuery(
    async () => {
      const contacts = await db.contacts
        .where('company_id')
        .equals(companyId)
        .filter(contact => contact.active && contact.deleted_at === null)
        .toArray()
      return contacts
    },
    [companyId],
    []
  )

  // Get descendants of current contact to exclude
  const descendantIds = useLiveQuery(
    async () => {
      if (!currentContactId) return []
      try {
        const descendants = await HierarchyService.getDescendants(currentContactId)
        return descendants.map(d => d.id)
      } catch (error) {
        console.error('Error fetching descendants:', error)
        return []
      }
    },
    [currentContactId],
    []
  )

  // Check if user has multiple contacts (for progressive disclosure)
  const hasMultipleContacts = allContacts.length > 1

  // Build list of valid parent options with hierarchy information
  const parentOptions = useMemo<ContactOption[]>(() => {
    if (!allContacts || !descendantIds) return []

    const excludeSet = new Set([
      currentContactId,
      ...descendantIds,
      ...excludeIds,
    ])

    return allContacts
      .filter(contact => !excludeSet.has(contact.id))
      .map(contact => ({
        contact,
        depth: contact.hierarchy_level,
        isValid: true,
      }))
      .sort((a, b) => {
        // Sort by depth first, then by name
        if (a.depth !== b.depth) return a.depth - b.depth
        return a.contact.name.localeCompare(b.contact.name)
      })
  }, [allContacts, descendantIds, currentContactId, excludeIds])

  // Validate selection when value changes
  useEffect(() => {
    const validateSelection = async () => {
      if (!value) {
        setValidationError(undefined)
        return
      }

      setIsValidating(true)
      try {
        const validation = await HierarchyValidator.validateParentAssignment(
          currentContactId,
          value
        )

        if (!validation.valid) {
          setValidationError(validation.error)
        } else {
          setValidationError(undefined)
        }
      } catch (err) {
        console.error('Validation error:', err)
        setValidationError('Unable to validate parent selection')
      } finally {
        setIsValidating(false)
      }
    }

    validateSelection()
  }, [value, currentContactId])

  // Handle parent selection change
  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = event.target.value || null

      // Clear validation error when changing
      setValidationError(undefined)

      // Validate before allowing change
      if (newValue) {
        setIsValidating(true)
        try {
          const validation = await HierarchyValidator.validateParentAssignment(
            currentContactId,
            newValue
          )

          if (!validation.valid) {
            setValidationError(validation.error)
            return // Don't change value if invalid
          }
        } catch (err) {
          console.error('Validation error:', err)
          setValidationError('Unable to validate parent selection')
          return
        } finally {
          setIsValidating(false)
        }
      }

      onChange(newValue)
    },
    [currentContactId, onChange]
  )

  // Get account type icon
  const getAccountTypeIcon = (accountType: ContactAccountType): string => {
    switch (accountType) {
      case ContactAccountType.PARENT:
        return '📁' // Parent with children
      case ContactAccountType.CHILD:
        return '└─' // Child/sub-account
      case ContactAccountType.STANDALONE:
      default:
        return '📄' // Standalone
    }
  }

  // Format option label with hierarchy indicators
  const formatOptionLabel = (option: ContactOption): string => {
    const indent = '  '.repeat(option.depth)
    const icon = getAccountTypeIcon(option.contact.account_type)
    const levelIndicator = option.depth > 0 ? ` (Level ${option.depth})` : ''

    return `${indent}${icon} ${option.contact.name}${levelIndicator}`
  }

  // Don't render if user only has one contact (no point in parent selection)
  if (!hasMultipleContacts) {
    return null
  }

  // Progressive disclosure: collapsed by default
  if (!isExpanded) {
    return (
      <div className={styles.advancedSection}>
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className={styles.advancedToggle}
          aria-expanded={false}
          aria-controls="parent-account-selector"
          disabled={disabled}
        >
          <span className={styles.toggleIcon} aria-hidden="true">
            ▶
          </span>
          <span className={styles.toggleLabel}>Advanced: Parent Account</span>
          <span className={styles.toggleHint}>
            {value ? '(Parent assigned)' : '(Optional)'}
          </span>
        </button>
      </div>
    )
  }

  // Expanded view with selector
  return (
    <div className={styles.advancedSection} id="parent-account-selector">
      <button
        type="button"
        onClick={() => setIsExpanded(false)}
        className={styles.advancedToggle}
        aria-expanded={true}
        aria-controls="parent-account-selector-content"
        disabled={disabled}
      >
        <span className={styles.toggleIcon} aria-hidden="true">
          ▼
        </span>
        <span className={styles.toggleLabel}>Advanced: Parent Account</span>
      </button>

      <div
        id="parent-account-selector-content"
        className={styles.selectorContent}
        role="region"
        aria-label="Parent account selection"
      >
        <Select
          label="Parent Account"
          value={value || ''}
          onChange={handleChange}
          disabled={disabled || isValidating}
          error={validationError || error}
          helperText={
            isValidating
              ? 'Validating selection...'
              : validationError
                ? undefined
                : helperText
          }
          placeholder="None (Standalone Account)"
          fullWidth
        >
          <option value="">None (Standalone Account)</option>
          {parentOptions.map(option => (
            <option
              key={option.contact.id}
              value={option.contact.id}
              disabled={!option.isValid}
            >
              {formatOptionLabel(option)}
            </option>
          ))}
        </Select>

        {/* Visual hierarchy explanation */}
        <div className={styles.hierarchyLegend}>
          <p className={styles.legendTitle}>Account Types:</p>
          <ul className={styles.legendList}>
            <li>
              <span aria-hidden="true">📄</span> Standalone - Independent account
            </li>
            <li>
              <span aria-hidden="true">📁</span> Parent - Has sub-accounts
            </li>
            <li>
              <span aria-hidden="true">└─</span> Child - Sub-account under parent
            </li>
          </ul>
          <p className={styles.legendNote}>
            Maximum hierarchy depth: 3 levels (Parent → Child → Grandchild)
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Display name for React DevTools
 */
ParentAccountSelector.displayName = 'ParentAccountSelector'
