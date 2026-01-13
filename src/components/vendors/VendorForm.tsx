/**
 * VendorForm Component
 *
 * Form for creating and editing vendors.
 * Handles validation, contact information, and accessibility.
 *
 * Features:
 * - Create new vendor or edit existing
 * - Email and phone validation
 * - Real-time validation feedback
 * - 1099 eligibility checkbox
 * - Duplicate detection warning
 * - WCAG 2.1 AA accessible
 *
 * Per D5: Vendor Management - Basic [MVP]
 */

import { type FC, type FormEvent, useState, useEffect, useCallback } from 'react'
import { Button } from '../core/Button'
import { Input } from '../forms/Input'
import { Checkbox } from '../forms/Checkbox'
import { ParentAccountSelector } from '../contacts/ParentAccountSelector'
import { HierarchyValidator } from '../../validators/hierarchyValidator'
import { db } from '../../db/database'
import type { Vendor, VendorFormData } from '../../types/vendor.types'
import styles from './VendorForm.module.css'

export interface VendorFormProps {
  /**
   * Vendor to edit (undefined for create mode)
   */
  vendor?: Vendor

  /**
   * Called when form is submitted with valid data
   */
  onSubmit: (data: VendorFormData) => void | Promise<void>

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

  /**
   * Duplicate vendors detected (optional warning)
   */
  duplicateWarning?: string
}

/**
 * Validation errors
 */
interface ValidationErrors {
  name?: string
  email?: string
  phone?: string
  address?: {
    line1?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate phone format (basic validation)
 */
function isValidPhone(phone: string): boolean {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '')
  // Check if it has at least 10 digits (flexible for international)
  return digitsOnly.length >= 10
}

/**
 * Validate form data
 */
function validateForm(data: VendorFormData): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!data.name.trim()) {
    errors.name = "We'll need a name for this vendor"
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.email = "That email doesn't look quite right. It should be something like name@example.com"
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.phone = 'Please enter a valid phone number with at least 10 digits'
  }

  // Validate address if any field is filled
  if (data.address) {
    const hasAnyAddressField = data.address.line1 || data.address.city || data.address.state || data.address.postalCode || data.address.country

    if (hasAnyAddressField) {
      errors.address = {}

      if (!data.address.line1?.trim()) {
        errors.address.line1 = 'Street address is required'
      }
      if (!data.address.city?.trim()) {
        errors.address.city = 'City is required'
      }
      if (!data.address.state?.trim()) {
        errors.address.state = 'State is required'
      }
      if (!data.address.postalCode?.trim()) {
        errors.address.postalCode = 'Postal code is required'
      }
      if (!data.address.country?.trim()) {
        errors.address.country = 'Country is required'
      }

      // If no actual errors, delete the address errors object
      if (Object.keys(errors.address).length === 0) {
        delete errors.address
      }
    }
  }

  return errors
}

/**
 * VendorForm Component
 *
 * @example
 * ```tsx
 * <VendorForm
 *   companyId="company-123"
 *   onSubmit={handleSubmit}
 *   onCancel={handleCancel}
 * />
 *
 * // Edit mode
 * <VendorForm
 *   vendor={existingVendor}
 *   companyId="company-123"
 *   onSubmit={handleUpdate}
 *   onCancel={handleCancel}
 * />
 * ```
 */
export const VendorForm: FC<VendorFormProps> = ({
  vendor,
  onSubmit,
  onCancel,
  companyId,
  isSubmitting = false,
  duplicateWarning,
}) => {
  const isEditMode = !!vendor

  // Form state
  const [formData, setFormData] = useState<VendorFormData>({
    name: vendor?.name || '',
    email: vendor?.email || '',
    phone: vendor?.phone || '',
    address: vendor?.address,
    taxId: vendor?.taxId || '',
    is1099Eligible: vendor?.is1099Eligible ?? false,
    notes: vendor?.notes || '',
    isActive: vendor?.isActive ?? true,
    // G3: Hierarchical Contacts fields - maintain backwards compatibility
    parentId: vendor?.parentId || null,
    accountType: vendor?.accountType || 'standalone',
    hierarchyLevel: vendor?.hierarchyLevel || 0,
  })

  const [errors, setErrors] = useState<ValidationErrors>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [showAddress, setShowAddress] = useState(!!vendor?.address)
  // G3: Track total contacts for progressive disclosure
  const [totalContacts, setTotalContacts] = useState(0)

  // G3: Load total contacts count for progressive disclosure
  useEffect(() => {
    async function loadContactCount() {
      try {
        const count = await db.contacts
          .where('company_id')
          .equals(companyId)
          .filter((contact) => contact.active && contact.deleted_at === null)
          .count()
        setTotalContacts(count)
      } catch (error) {
        console.error('Failed to load contact count:', error)
        setTotalContacts(0)
      }
    }
    loadContactCount()
  }, [companyId])

  // Update form data
  const updateField = useCallback((field: keyof VendorFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setTouched((prev) => new Set(prev).add(field))
  }, [])

  // G3: Handle parent account selection
  const handleParentChange = useCallback(
    async (parentId: string | null) => {
      if (!parentId) {
        // No parent selected - set as standalone
        setFormData((prev) => ({
          ...prev,
          parentId: null,
          accountType: 'standalone',
          hierarchyLevel: 0,
        }))
      } else {
        // Fetch parent to calculate hierarchy level
        try {
          const parent = await db.contacts.get(parentId)
          if (parent) {
            setFormData((prev) => ({
              ...prev,
              parentId,
              accountType: 'child',
              hierarchyLevel: (parent.hierarchy_level || 0) + 1,
            }))
          }
        } catch (error) {
          console.error('Failed to fetch parent contact:', error)
        }
      }
      setTouched((prev) => new Set(prev).add('parentId'))
    },
    []
  )

  const updateAddressField = useCallback((field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        ...prev.address,
        [field]: value,
      },
    }))
    setTouched((prev) => new Set(prev).add(`address.${field}`))
  }, [])

  // Validate on field changes
  useEffect(() => {
    if (touched.size > 0) {
      const validationErrors = validateForm(formData)
      setErrors(validationErrors)
    }
  }, [formData, touched])

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Mark all fields as touched
    const allFields = new Set([
      'name',
      'email',
      'phone',
      'taxId',
      'notes',
      'isActive',
      'is1099Eligible',
    ])
    if (showAddress) {
      allFields.add('address.line1')
      allFields.add('address.city')
      allFields.add('address.state')
      allFields.add('address.postalCode')
      allFields.add('address.country')
    }
    setTouched(allFields)

    // Validate
    const validationErrors = validateForm(formData)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    // G3: Validate parent assignment if parent is selected
    if (formData.parentId && vendor?.id) {
      const hierarchyValidation = await HierarchyValidator.validateParentAssignment(
        vendor.id,
        formData.parentId
      )
      if (!hierarchyValidation.valid) {
        setErrors({ ...validationErrors, name: hierarchyValidation.error })
        return
      }
    }

    // Submit (remove address if not shown, maintain hierarchy fields)
    const submitData = {
      ...formData,
      address: showAddress ? formData.address : undefined,
    }
    await onSubmit(submitData)
  }

  return (
    <form className={styles.vendorForm} onSubmit={handleSubmit} noValidate>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>
          {isEditMode ? 'Edit Vendor' : "Let's add your vendor!"}
        </h2>
        <p className={styles.formDescription}>
          {isEditMode
            ? 'Update vendor information below'
            : 'Keeping track of who you pay helps you understand where your money goes.'}
        </p>
      </div>

      {duplicateWarning && (
        <div className={styles.duplicateWarning} role="alert">
          <svg className={styles.warningIcon} aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          <p>{duplicateWarning}</p>
        </div>
      )}

      <div className={styles.formBody}>
        <Input
          label="Vendor Name"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          error={touched.has('name') ? errors.name : undefined}
          required
          fullWidth
          placeholder="e.g., Office Supply Co"
          helperText="The business or person's name"
          disabled={isSubmitting}
        />

        <Input
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          error={touched.has('email') ? errors.email : undefined}
          fullWidth
          placeholder="vendor@example.com"
          helperText="Optional: For communication and records"
          disabled={isSubmitting}
        />

        <Input
          label="Phone Number"
          type="tel"
          value={formData.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          error={touched.has('phone') ? errors.phone : undefined}
          fullWidth
          placeholder="(555) 123-4567"
          helperText="Optional: For quick contact"
          disabled={isSubmitting}
        />

        <div className={styles.addressSection}>
          <Checkbox
            label="Add mailing address"
            checked={showAddress}
            onChange={(e) => setShowAddress(e.target.checked)}
            disabled={isSubmitting}
          />

          {showAddress && (
            <div className={styles.addressFields}>
              <Input
                label="Street Address"
                value={formData.address?.line1}
                onChange={(e) => updateAddressField('line1', e.target.value)}
                error={touched.has('address.line1') ? errors.address?.line1 : undefined}
                fullWidth
                placeholder="123 Main Street"
                disabled={isSubmitting}
              />

              <Input
                label="Address Line 2"
                value={formData.address?.line2}
                onChange={(e) => updateAddressField('line2', e.target.value)}
                fullWidth
                placeholder="Suite 100"
                helperText="Optional: Apartment, suite, etc."
                disabled={isSubmitting}
              />

              <div className={styles.addressRow}>
                <Input
                  label="City"
                  value={formData.address?.city}
                  onChange={(e) => updateAddressField('city', e.target.value)}
                  error={touched.has('address.city') ? errors.address?.city : undefined}
                  fullWidth
                  placeholder="New York"
                  disabled={isSubmitting}
                />

                <Input
                  label="State"
                  value={formData.address?.state}
                  onChange={(e) => updateAddressField('state', e.target.value)}
                  error={touched.has('address.state') ? errors.address?.state : undefined}
                  fullWidth
                  placeholder="NY"
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.addressRow}>
                <Input
                  label="Postal Code"
                  value={formData.address?.postalCode}
                  onChange={(e) => updateAddressField('postalCode', e.target.value)}
                  error={touched.has('address.postalCode') ? errors.address?.postalCode : undefined}
                  fullWidth
                  placeholder="10001"
                  disabled={isSubmitting}
                />

                <Input
                  label="Country"
                  value={formData.address?.country}
                  onChange={(e) => updateAddressField('country', e.target.value)}
                  error={touched.has('address.country') ? errors.address?.country : undefined}
                  fullWidth
                  placeholder="US"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}
        </div>

        <Input
          label="Tax ID / EIN"
          value={formData.taxId}
          onChange={(e) => updateField('taxId', e.target.value)}
          fullWidth
          placeholder="XX-XXXXXXX"
          helperText="Optional: For 1099 reporting"
          disabled={isSubmitting}
        />

        <Checkbox
          label="1099 Eligible"
          checked={formData.is1099Eligible}
          onChange={(e) => updateField('is1099Eligible', e.target.checked)}
          helperText="Check if this vendor should receive a 1099 form"
          disabled={isSubmitting}
        />

        <Input
          label="Notes"
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          fullWidth
          placeholder="Any special information about this vendor"
          helperText="Optional: Internal notes for your reference"
          disabled={isSubmitting}
          maxLength={500}
          showCharCount
        />

        {/* G3: Parent Account Selector - Progressive Disclosure (only show if user has > 5 contacts) */}
        {totalContacts > 5 && (
          <ParentAccountSelector
            value={formData.parentId || null}
            onChange={handleParentChange}
            currentContactId={vendor?.id || ''}
            companyId={companyId}
            disabled={isSubmitting}
            defaultExpanded={!!formData.parentId}
          />
        )}

        <Checkbox
          label="Active"
          checked={formData.isActive}
          onChange={(e) => updateField('isActive', e.target.checked)}
          helperText="Inactive vendors are hidden from most views"
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
          {isEditMode ? 'Save Changes' : 'Add Vendor'}
        </Button>
      </div>
    </form>
  )
}

export type { VendorFormData }
