/**
 * AccountForm Component
 *
 * Form for creating and editing accounts.
 * Handles validation, parent account selection, and accessibility.
 *
 * Features:
 * - Create new account or edit existing
 * - Parent account selection with type matching validation
 * - Account number validation
 * - Real-time validation feedback
 * - WCAG 2.1 AA accessible
 */

import { type FC, type FormEvent, useState, useEffect, useCallback } from 'react'
import { Button } from '../core/Button'
import { Input } from '../forms/Input'
import { Select, type SelectOption } from '../forms/Select'
import { Checkbox } from '../forms/Checkbox'
import type { Account, AccountType, AccountSubType } from '../../types'
import styles from './AccountForm.module.css'

export interface AccountFormProps {
  /**
   * Account to edit (undefined for create mode)
   */
  account?: Account

  /**
   * Available parent accounts for selection
   */
  parentAccounts?: Account[]

  /**
   * Called when form is submitted with valid data
   */
  onSubmit: (data: AccountFormData) => void | Promise<void>

  /**
   * Called when form is cancelled
   */
  onCancel: () => void

  /**
   * Current company ID
   */
  companyId: string

  /**
   * Whether the form is currently submitting
   */
  isSubmitting?: boolean
}

/**
 * Form data shape
 */
export interface AccountFormData {
  name: string
  accountNumber?: string
  type: AccountType
  subType?: AccountSubType
  parentAccountId?: string
  description?: string
  isActive: boolean
}

/**
 * Account type options
 */
const ACCOUNT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'asset', label: 'Asset - Things your business owns' },
  { value: 'liability', label: 'Liability - Money you owe' },
  { value: 'equity', label: 'Equity - Owner investment and profits' },
  { value: 'income', label: 'Income - Money coming in' },
  { value: 'expense', label: 'Expense - Money going out' },
  { value: 'cost-of-goods-sold', label: 'Cost of Goods Sold - Direct product costs' },
  { value: 'other-income', label: 'Other Income - Non-operating income' },
  { value: 'other-expense', label: 'Other Expense - Non-operating expenses' },
]

/**
 * Validation errors
 */
interface ValidationErrors {
  name?: string
  accountNumber?: string
  type?: string
  parentAccountId?: string
}

/**
 * Validate form data
 */
function validateForm(data: AccountFormData, parentAccount?: Account): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!data.name.trim()) {
    errors.name = 'Account name is required'
  }

  if (!data.type) {
    errors.type = 'Account type is required'
  }

  if (data.parentAccountId && parentAccount && parentAccount.type !== data.type) {
    errors.parentAccountId = 'Sub-account type must match parent account type'
  }

  if (data.accountNumber && !/^[0-9-]+$/.test(data.accountNumber)) {
    errors.accountNumber = 'Account number can only contain numbers and dashes'
  }

  return errors
}

/**
 * AccountForm Component
 *
 * @example
 * ```tsx
 * <AccountForm
 *   companyId="company-123"
 *   onSubmit={handleSubmit}
 *   onCancel={handleCancel}
 * />
 *
 * // Edit mode
 * <AccountForm
 *   account={existingAccount}
 *   companyId="company-123"
 *   onSubmit={handleUpdate}
 *   onCancel={handleCancel}
 * />
 * ```
 */
export const AccountForm: FC<AccountFormProps> = ({
  account,
  parentAccounts = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  const isEditMode = !!account

  // Form state
  const [formData, setFormData] = useState<AccountFormData>({
    name: account?.name || '',
    accountNumber: account?.accountNumber || '',
    type: account?.type || 'asset',
    subType: account?.subType || undefined,
    parentAccountId: account?.parentAccountId || '',
    description: account?.description || '',
    isActive: account?.isActive ?? true,
  })

  const [errors, setErrors] = useState<ValidationErrors>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())

  // Filter parent accounts by type (only show matching type parents)
  const availableParents = parentAccounts.filter(
    (parent) =>
      parent.type === formData.type &&
      parent.id !== account?.id && // Can't be its own parent
      !parent.parentAccountId // Only top-level accounts can be parents
  )

  const parentAccountOptions: SelectOption[] = [
    { value: '', label: 'None (top-level account)' },
    ...availableParents.map((acc) => ({
      value: acc.id,
      label: `${acc.accountNumber ? `${acc.accountNumber} - ` : ''}${acc.name}`,
    })),
  ]

  // Find current parent account for validation
  const currentParent = availableParents.find((acc) => acc.id === formData.parentAccountId)

  // Update form data
  const updateField = useCallback((field: keyof AccountFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setTouched((prev) => new Set(prev).add(field))
  }, [])

  // Validate on field changes
  useEffect(() => {
    if (touched.size > 0) {
      const validationErrors = validateForm(formData, currentParent)
      setErrors(validationErrors)
    }
  }, [formData, currentParent, touched])

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Mark all fields as touched
    setTouched(new Set(Object.keys(formData)))

    // Validate
    const validationErrors = validateForm(formData, currentParent)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    // Submit
    await onSubmit(formData)
  }

  return (
    <form className={styles.accountForm} onSubmit={handleSubmit} noValidate>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>
          {isEditMode ? 'Edit Account' : 'Create New Account'}
        </h2>
        <p className={styles.formDescription}>
          {isEditMode
            ? 'Update account information below'
            : 'Add a new account to your chart of accounts'}
        </p>
      </div>

      <div className={styles.formBody}>
        <Input
          label="Account Name"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          error={touched.has('name') ? errors.name : undefined}
          required
          fullWidth
          placeholder="e.g., Cash, Accounts Receivable"
          helperText="A descriptive name for this account"
          disabled={isSubmitting}
        />

        <Input
          label="Account Number"
          value={formData.accountNumber}
          onChange={(e) => updateField('accountNumber', e.target.value)}
          error={touched.has('accountNumber') ? errors.accountNumber : undefined}
          fullWidth
          placeholder="e.g., 1000, 4500"
          helperText="Optional: Used for organizing and reporting"
          disabled={isSubmitting}
        />

        <Select
          label="Account Type"
          value={formData.type}
          onChange={(e) => {
            updateField('type', e.target.value as AccountType)
            // Clear parent account if type changes
            if (formData.parentAccountId) {
              updateField('parentAccountId', '')
            }
          }}
          options={ACCOUNT_TYPE_OPTIONS}
          error={touched.has('type') ? errors.type : undefined}
          required
          fullWidth
          helperText="Choose the category that best describes this account"
          disabled={isSubmitting || isEditMode} // Can't change type in edit mode
        />

        {availableParents.length > 0 && (
          <Select
            label="Parent Account"
            value={formData.parentAccountId}
            onChange={(e) => updateField('parentAccountId', e.target.value)}
            options={parentAccountOptions}
            error={touched.has('parentAccountId') ? errors.parentAccountId : undefined}
            fullWidth
            helperText="Optional: Make this a sub-account of another account"
            disabled={isSubmitting}
          />
        )}

        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          fullWidth
          placeholder="Optional: What is this account used for?"
          helperText="Internal notes about this account"
          disabled={isSubmitting}
          maxLength={500}
          showCharCount
        />

        <Checkbox
          label="Active"
          checked={formData.isActive}
          onChange={(e) => updateField('isActive', e.target.checked)}
          helperText="Inactive accounts are hidden from most views"
          disabled={isSubmitting}
        />
      </div>

      <div className={styles.formFooter}>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isEditMode ? 'Save Changes' : 'Create Account'}
        </Button>
      </div>
    </form>
  )
}
