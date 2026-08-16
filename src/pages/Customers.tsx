/**
 * Customers Page
 *
 * Main page for viewing and managing customers with tabbed interface.
 * Provides full CRUD operations with modal-based forms.
 *
 * Features:
 * - Tabbed interface: Customer Center, Invoices
 * - Tab pinning for default tab preference
 * - Customer Center with insights, transaction history, and profile editing
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
import { useSearchParams } from 'react-router-dom'
import { useCustomers } from '../hooks/useCustomers'
import { useAuth } from '../contexts/AuthContext'
import { useTabPinning } from '../hooks/useTabPinning'
import { PAGE_IDS, TAB_IDS } from '../db/schema/tabPreferences.schema'
import { CustomerForm, type CustomerFormData } from '../components/customers/CustomerForm'
import { CustomerInsights } from '../components/customers/CustomerInsights'
import { Modal } from '../components/modals/Modal'
import { Button } from '../components/core/Button'
import { PinIcon } from '../components/common/PinIcon'
import type { Contact } from '../types'
import styles from './Customers.module.css'

type CustomerTab = 'customer-center' | 'invoices'

export interface CustomersProps {
  /**
   * Current company ID (optional - will use auth context or demo fallback)
   */
  companyId?: string
}

type ModalState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; customer: Contact }
  | { type: 'delete'; customer: Contact }

/**
 * Customers Page
 */
const Customers: FC<CustomersProps> = ({ companyId: propCompanyId }) => {
  const { companyId: authCompanyId } = useAuth()

  // Use prop companyId, then auth context, then fallback to 'demo-company'
  // IMPORTANT: Must match the fallback in Transactions.tsx and other pages
  const companyId = propCompanyId || authCompanyId || 'demo-company'

  // Tab pinning
  const { defaultTab, pinTab, unpinTab, isTabPinned, isLoading: isPinningLoading } = useTabPinning({
    pageId: PAGE_IDS.CUSTOMERS,
  })

  // URL search params for tab navigation (e.g., /customers?tab=invoices)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as CustomerTab | null

  // Map schema tab IDs to component tab IDs
  const mapSchemaToTab = (schemaTabId: string): CustomerTab => {
    switch (schemaTabId) {
      case TAB_IDS.CUSTOMERS_INVOICES:
        return 'invoices'
      case TAB_IDS.CUSTOMERS_CENTER:
      default:
        return 'customer-center'
    }
  }

  const mapTabToSchema = (tab: CustomerTab): string => {
    switch (tab) {
      case 'invoices':
        return TAB_IDS.CUSTOMERS_INVOICES
      case 'customer-center':
      default:
        return TAB_IDS.CUSTOMERS_CENTER
    }
  }

  const [currentTab, setCurrentTab] = useState<CustomerTab>('customer-center')
  const [pinnedTabs, setPinnedTabs] = useState<Record<string, boolean>>({})

  // Set initial tab from URL param, then pinned preference
  useEffect(() => {
    if (tabFromUrl && ['customer-center', 'invoices'].includes(tabFromUrl)) {
      setCurrentTab(tabFromUrl)
    } else if (!isPinningLoading && defaultTab) {
      setCurrentTab(mapSchemaToTab(defaultTab))
    }
  }, [tabFromUrl, defaultTab, isPinningLoading])

  // Load pinned tabs state
  useEffect(() => {
    const loadPinnedState = async () => {
      const states: Record<string, boolean> = {}
      const tabIds: CustomerTab[] = ['customer-center', 'invoices']
      for (const tab of tabIds) {
        states[tab] = await isTabPinned(mapTabToSchema(tab))
      }
      setPinnedTabs(states)
    }
    loadPinnedState()
  }, [isTabPinned])

  // Handle tab change - update URL
  const handleTabChange = (tab: CustomerTab) => {
    setCurrentTab(tab)
    if (tab === 'customer-center') {
      searchParams.delete('tab')
    } else {
      searchParams.set('tab', tab)
    }
    setSearchParams(searchParams, { replace: true })
  }

  // Handle pin toggle
  const handlePinToggle = async (tab: CustomerTab) => {
    try {
      const schemaTabId = mapTabToSchema(tab)
      if (pinnedTabs[tab]) {
        await unpinTab()
        setPinnedTabs((prev) => ({ ...prev, [tab]: false }))
      } else {
        await pinTab(schemaTabId)
        // Only one tab can be pinned
        setPinnedTabs({
          'customer-center': tab === 'customer-center',
          'invoices': tab === 'invoices',
        })
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
  }

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

  // Type assertion for customer to Contact
  const handleDeleteFromInsights = (customer: Contact) => {
    setModalState({ type: 'delete', customer })
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Customers</h1>
        <p>Manage your customer relationships - the heart of your business</p>
      </header>

      {/* Tab Selector */}
      <div className={styles.tabSelector}>
        <button
          className={currentTab === 'customer-center' ? styles.tabActive : styles.tab}
          onClick={() => handleTabChange('customer-center')}
        >
          Customer Center
          <PinIcon
            isPinned={pinnedTabs['customer-center'] || false}
            onClick={() => handlePinToggle('customer-center')}
            size={14}
          />
        </button>
        <button
          className={currentTab === 'invoices' ? styles.tabActive : styles.tab}
          onClick={() => handleTabChange('invoices')}
        >
          Invoices
          <PinIcon
            isPinned={pinnedTabs['invoices'] || false}
            onClick={() => handlePinToggle('invoices')}
            size={14}
          />
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {currentTab === 'customer-center' && (
          <CustomerInsights
            companyId={companyId}
            customers={customers}
            onEditCustomer={handleEdit}
            onCreateCustomer={handleCreate}
            isLoading={isLoading}
          />
        )}

        {currentTab === 'invoices' && (
          <div className={styles.invoicesTab}>
            <div className={styles.comingSoon}>
              <h2>Invoices</h2>
              <p>Full invoice management coming soon. For now, use Customer Center to view invoice activity.</p>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(modalState.type === 'create' || modalState.type === 'edit') && (
        <Modal
          isOpen
          onClose={handleCloseModal}
          title={modalState.type === 'create' ? 'Add Customer' : 'Edit Customer'}
          headerStyle={{
            background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
            color: 'white',
          }}
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
