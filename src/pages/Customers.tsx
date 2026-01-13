/**
 * Customers Page
 *
 * Main page for viewing and managing customers.
 * Provides full CRUD operations with modal-based forms.
 *
 * Features:
 * - View all customers
 * - Create new customers
 * - Edit existing customers
 * - Delete customers (with confirmation)
 * - Search and filter
 * - Celebration messages for milestones
 * - WCAG 2.1 AA accessible
 *
 * Per ACCT-002: Customer Management
 */

import { type FC, useState, useEffect } from 'react'
import { useCustomers } from '../hooks/useCustomers'
import { CustomerList } from '../components/customers/CustomerList'
import { CustomerForm, type CustomerFormData } from '../components/customers/CustomerForm'
import { Modal } from '../components/modals/Modal'
import { Button } from '../components/core/Button'
import type { Contact } from '../types'

export interface CustomersProps {
  /**
   * Current company ID
   */
  companyId: string
}

type ModalState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; customer: Contact }
  | { type: 'delete'; customer: Contact }

/**
 * Customers Page
 */
const Customers: FC<CustomersProps> = ({ companyId }) => {
  const {
    customers,
    isLoading,
    create,
    update,
    remove,
  } = useCustomers({ companyId, isActive: undefined, includeDeleted: false })

  const [modalState, setModalState] = useState<ModalState>({ type: 'closed' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [previousCount, setPreviousCount] = useState(0)

  // Check for milestone celebrations
  useEffect(() => {
    if (customers.length > previousCount) {
      const milestones = [1, 10, 25, 50, 100]
      if (milestones.includes(customers.length)) {
        setShowCelebration(true)
        // Hide celebration after 5 seconds
        const timer = setTimeout(() => setShowCelebration(false), 5000)
        return () => clearTimeout(timer)
      }
    }
    setPreviousCount(customers.length)
  }, [customers.length, previousCount])

  const handleCreate = () => {
    setModalState({ type: 'create' })
  }

  const handleEdit = (customer: Contact) => {
    setModalState({ type: 'edit', customer })
  }

  const handleDelete = (customer: Contact) => {
    setModalState({ type: 'delete', customer })
  }

  const handleCloseModal = () => {
    setModalState({ type: 'closed' })
    setIsSubmitting(false)
  }

  const handleFormSubmit = async (data: CustomerFormData) => {
    setIsSubmitting(true)

    try {
      if (modalState.type === 'create') {
        const result = await create({
          companyId,
          type: 'customer',
          ...data,
        })

        if (result.success) {
          handleCloseModal()
        } else {
          alert(`We couldn't add that customer. ${result.error.message}`)
        }
      } else if (modalState.type === 'edit') {
        const result = await update(modalState.customer.id, data)

        if (result.success) {
          handleCloseModal()
        } else {
          alert(`We couldn't save those changes. ${result.error.message}`)
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
      const result = await remove(modalState.customer.id)

      if (result.success) {
        handleCloseModal()
      } else {
        alert(`We couldn't remove that customer. ${result.error.message}`)
      }
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Something unexpected happened. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Customers</h1>
        <p style={{ color: '#6b7280' }}>
          Manage your customer relationships - the heart of your business
        </p>
      </header>

      <CustomerList
        customers={customers}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreate={handleCreate}
        isLoading={isLoading}
        customerCount={showCelebration ? customers.length : undefined}
      />

      {/* Create/Edit Modal */}
      {(modalState.type === 'create' || modalState.type === 'edit') && (
        <Modal
          isOpen
          onClose={handleCloseModal}
          title={modalState.type === 'create' ? 'Add Customer' : 'Edit Customer'}
        >
          <CustomerForm
            customer={modalState.type === 'edit' ? modalState.customer : undefined}
            companyId={companyId}
            onSubmit={handleFormSubmit}
            onCancel={handleCloseModal}
            isSubmitting={isSubmitting}
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {modalState.type === 'delete' && (
        <Modal
          isOpen
          onClose={handleCloseModal}
          title="Remove Customer"
        >
          <div style={{ padding: '1rem' }}>
            <p>
              Are you sure you want to remove <strong>{modalState.customer.name}</strong>?
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Don't worry - this won't delete any past transactions. The customer will just be marked as inactive and hidden from your list.
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
                Remove Customer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Customers
