/**
 * Vendors Page
 *
 * Main page for viewing and managing vendors.
 * Provides full CRUD operations with modal-based forms.
 *
 * Features:
 * - View all vendors
 * - Create new vendors
 * - Edit existing vendors
 * - Delete vendors (with confirmation)
 * - Search and filter
 * - Duplicate detection
 * - Celebration messages for milestones
 * - WCAG 2.1 AA accessible
 *
 * Per D5: Vendor Management - Basic [MVP]
 */

import { type FC, useState, useEffect } from 'react'
import { useVendors } from '../hooks/useVendors'
import { VendorList } from '../components/vendors/VendorList'
import { VendorForm, type VendorFormData } from '../components/vendors/VendorForm'
import { Modal } from '../components/modals/Modal'
import { Button } from '../components/core/Button'
import type { Vendor } from '../types/vendor.types'

export interface VendorsProps {
  /**
   * Current company ID
   */
  companyId: string
}

type ModalState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; vendor: Vendor }
  | { type: 'delete'; vendor: Vendor }

/**
 * Vendors Page
 */
const Vendors: FC<VendorsProps> = ({ companyId }) => {
  const {
    vendors,
    isLoading,
    create,
    update,
    remove,
    checkDuplicates,
  } = useVendors({ companyId, isActive: undefined, includeDeleted: false })

  const [modalState, setModalState] = useState<ModalState>({ type: 'closed' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [previousCount, setPreviousCount] = useState(0)
  const [duplicateWarning, setDuplicateWarning] = useState<string | undefined>()

  // Check for milestone celebrations
  useEffect(() => {
    if (vendors.length > previousCount) {
      const milestones = [1, 10, 25, 50, 100]
      if (milestones.includes(vendors.length)) {
        setShowCelebration(true)
        // Hide celebration after 5 seconds
        const timer = setTimeout(() => setShowCelebration(false), 5000)
        return () => clearTimeout(timer)
      }
    }
    setPreviousCount(vendors.length)
  }, [vendors.length, previousCount])

  const handleCreate = () => {
    setDuplicateWarning(undefined)
    setModalState({ type: 'create' })
  }

  const handleEdit = (vendor: Vendor) => {
    setDuplicateWarning(undefined)
    setModalState({ type: 'edit', vendor })
  }

  const handleDelete = (vendor: Vendor) => {
    setModalState({ type: 'delete', vendor })
  }

  const handleCloseModal = () => {
    setModalState({ type: 'closed' })
    setIsSubmitting(false)
    setDuplicateWarning(undefined)
  }

  const handleFormSubmit = async (data: VendorFormData) => {
    setIsSubmitting(true)

    try {
      if (modalState.type === 'create') {
        // Check for duplicates before creating
        const dupeCheck = checkDuplicates(data)
        if (dupeCheck.isDuplicate && !duplicateWarning) {
          // Show warning on first attempt
          const topDuplicate = dupeCheck.potentialDuplicates[0]
          setDuplicateWarning(
            `We found a similar vendor: "${topDuplicate.vendor.name}". Is this the same one? If not, click "Add Vendor" again to proceed.`
          )
          setIsSubmitting(false)
          return
        }

        const result = await create({
          companyId,
          type: 'vendor',
          ...data,
        })

        if (result.success) {
          handleCloseModal()
        } else {
          const errorMessage = 'error' in result ? result.error.message : 'Unknown error'
          alert(`We couldn't add that vendor. ${errorMessage}`)
        }
      } else if (modalState.type === 'edit') {
        const result = await update(modalState.vendor.id, data)

        if (result.success) {
          handleCloseModal()
        } else {
          const errorMessage = 'error' in result ? result.error.message : 'Unknown error'
          alert(`We couldn't save those changes. ${errorMessage}`)
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('Something unexpected happened. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (modalState.type !== 'delete') return

    setIsSubmitting(true)

    try {
      const result = await remove(modalState.vendor.id)

      if (result.success) {
        handleCloseModal()
      } else {
        const errorMessage = 'error' in result ? result.error.message : 'Unknown error'
        alert(`We couldn't remove that vendor. ${errorMessage}`)
      }
    } catch (error) {
      console.error('Error deleting vendor:', error)
      alert('Something unexpected happened. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Vendors</h1>
        <p style={{ color: '#6b7280' }}>
          Keeping track of who you pay helps you understand where your money goes
        </p>
      </header>

      <VendorList
        vendors={vendors}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreate={handleCreate}
        isLoading={isLoading}
        vendorCount={showCelebration ? vendors.length : undefined}
      />

      {/* Create/Edit Modal */}
      {(modalState.type === 'create' || modalState.type === 'edit') && (
        <Modal
          isOpen
          onClose={handleCloseModal}
          title={modalState.type === 'create' ? 'Add Vendor' : 'Edit Vendor'}
        >
          <VendorForm
            vendor={modalState.type === 'edit' ? modalState.vendor : undefined}
            companyId={companyId}
            onSubmit={handleFormSubmit}
            onCancel={handleCloseModal}
            isSubmitting={isSubmitting}
            duplicateWarning={duplicateWarning}
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {modalState.type === 'delete' && (
        <Modal
          isOpen
          onClose={handleCloseModal}
          title="Remove Vendor"
        >
          <div style={{ padding: '1rem' }}>
            <p>
              Are you sure you want to remove <strong>{modalState.vendor.name}</strong>?
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Don't worry - this won't delete any past transactions. The vendor will just be marked as inactive and hidden from your list.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                Remove Vendor
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Vendors
