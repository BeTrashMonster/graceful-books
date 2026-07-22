/**
 * VendorModal Component
 *
 * Full vendor entry form with all fields an accountant needs.
 * Includes 1099 tracking, address, tax ID, and payment terms.
 */

import { useState } from 'react'
import { Modal } from '../modals/Modal'
import { Input } from '../forms/Input'
import { Select } from '../forms/Select'
import { useVendors } from '../../hooks/useVendors'
import type { Vendor } from '../../types/vendor.types'
import styles from './VendorModal.module.css'

export interface VendorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (vendor: Vendor) => void
  companyId: string
  initialName?: string
}

const US_STATES = [
  { value: '', label: 'Select state...' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
]

const PAYMENT_TERMS = [
  { value: '', label: 'None' },
  { value: 'due-on-receipt', label: 'Due on Receipt' },
  { value: 'net-15', label: 'Net 15' },
  { value: 'net-30', label: 'Net 30' },
  { value: 'net-45', label: 'Net 45' },
  { value: 'net-60', label: 'Net 60' },
  { value: 'net-90', label: 'Net 90' },
]

export function VendorModal({
  isOpen,
  onClose,
  onSave,
  companyId,
  initialName = '',
}: VendorModalProps) {
  const { create } = useVendors({ companyId })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [taxId, setTaxId] = useState('')
  const [is1099Eligible, setIs1099Eligible] = useState(false)
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Vendor name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const vendorData = {
        companyId,
        type: 'vendor' as const,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: addressLine1.trim()
          ? {
              line1: addressLine1.trim(),
              line2: addressLine2.trim() || undefined,
              city: city.trim(),
              state: state,
              postalCode: postalCode.trim(),
              country: 'US',
            }
          : undefined,
        taxId: taxId.trim() || undefined,
        is1099Eligible,
        notes: notes.trim() || undefined,
        isActive: true,
      }

      const result = await create(vendorData)

      if (result.success) {
        onSave(result.data)
        handleClose()
      } else {
        setError(result.error?.message || 'Failed to create vendor')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    // Reset form
    setName(initialName)
    setEmail('')
    setPhone('')
    setAddressLine1('')
    setAddressLine2('')
    setCity('')
    setState('')
    setPostalCode('')
    setTaxId('')
    setIs1099Eligible(false)
    setPaymentTerms('')
    setNotes('')
    setError(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Vendor"
      size="lg"
      closeOnBackdropClick={false}
      headerStyle={{
        background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
        color: 'white',
      }}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}

        {/* Basic Information */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Basic Information</h3>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>
                Vendor Name <span className={styles.required}>*</span>
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Company or individual name"
                disabled={isSubmitting}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendor@example.com"
                disabled={isSubmitting}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Phone</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                disabled={isSubmitting}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Payment Terms</label>
              <Select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                options={PAYMENT_TERMS}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Address</h3>
          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label}>Street Address</label>
              <Input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="123 Main Street"
                disabled={isSubmitting}
              />
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label}>Suite / Unit</label>
              <Input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Suite 100"
                disabled={isSubmitting}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>City</label>
              <Input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                disabled={isSubmitting}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>State</label>
              <Select
                value={state}
                onChange={(e) => setState(e.target.value)}
                options={US_STATES}
                disabled={isSubmitting}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>ZIP Code</label>
              <Input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="12345"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Tax Information */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Tax Information</h3>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Tax ID (EIN/SSN)</label>
              <Input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="XX-XXXXXXX"
                disabled={isSubmitting}
              />
            </div>
            <div className={`${styles.field} ${styles.checkboxField}`}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={is1099Eligible}
                  onChange={(e) => setIs1099Eligible(e.target.checked)}
                  disabled={isSubmitting}
                  className={styles.checkbox}
                />
                <span>Track for 1099 reporting</span>
              </label>
              <p className={styles.helpText}>
                Check this if you pay this vendor $600+ per year for services
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information..."
              disabled={isSubmitting}
              className={styles.textarea}
              rows={3}
            />
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className={styles.cancelButton}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className={styles.saveButton}
          >
            {isSubmitting ? 'Saving...' : 'Save Vendor'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
