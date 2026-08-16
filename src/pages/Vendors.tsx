/**
 * Vendors Page
 *
 * Main page for viewing and managing vendors with tabbed interface.
 * Provides full CRUD operations with modal-based forms.
 *
 * Features:
 * - Tabbed interface: Vendor Center, Bills, Receipts
 * - Tab pinning for default tab preference
 * - Vendor Center with insights, transaction history, and profile editing
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
import { useSearchParams } from 'react-router-dom'
import { useVendors } from '../hooks/useVendors'
import { useAuth } from '../contexts/AuthContext'
import { useTabPinning } from '../hooks/useTabPinning'
import { PAGE_IDS, TAB_IDS } from '../db/schema/tabPreferences.schema'
import { VendorForm, type VendorFormData } from '../components/vendors/VendorForm'
import { VendorBills } from '../components/vendors/VendorBills'
import { VendorReceipts } from '../components/vendors/VendorReceipts'
import { VendorInsights } from '../components/vendors/VendorInsights'
import { Modal } from '../components/modals/Modal'
import { Button } from '../components/core/Button'
import { PinIcon } from '../components/common/PinIcon'
import type { Vendor } from '../types/vendor.types'
import styles from './Vendors.module.css'

type VendorTab = 'vendor-center' | 'bills' | 'receipts'

export interface VendorsProps {
  /**
   * Current company ID (optional - will use auth context or demo fallback)
   */
  companyId?: string
}

type ModalState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; vendor: Vendor }
  | { type: 'delete'; vendor: Vendor }

/**
 * Vendors Page
 */
const Vendors: FC<VendorsProps> = ({ companyId: propCompanyId }) => {
  const { companyId: authCompanyId } = useAuth()

  // Use prop companyId, then auth context, then fallback to 'demo-company'
  // IMPORTANT: Must match the fallback in Transactions.tsx and other pages
  const companyId = propCompanyId || authCompanyId || 'demo-company'

  // Tab pinning
  const { defaultTab, pinTab, unpinTab, isTabPinned, isLoading: isPinningLoading } = useTabPinning({
    pageId: PAGE_IDS.VENDORS,
  })

  // URL search params for tab navigation (e.g., /vendors?tab=receipts)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as VendorTab | null

  // Map schema tab IDs to component tab IDs
  const mapSchemaToTab = (schemaTabId: string): VendorTab => {
    switch (schemaTabId) {
      case TAB_IDS.VENDORS_BILLS:
        return 'bills'
      case TAB_IDS.VENDORS_RECEIPTS:
        return 'receipts'
      case TAB_IDS.VENDORS_CENTER:
      default:
        return 'vendor-center'
    }
  }

  const mapTabToSchema = (tab: VendorTab): string => {
    switch (tab) {
      case 'bills':
        return TAB_IDS.VENDORS_BILLS
      case 'receipts':
        return TAB_IDS.VENDORS_RECEIPTS
      case 'vendor-center':
      default:
        return TAB_IDS.VENDORS_CENTER
    }
  }

  const [currentTab, setCurrentTab] = useState<VendorTab>('vendor-center')
  const [pinnedTabs, setPinnedTabs] = useState<Record<string, boolean>>({})

  // Set initial tab from URL param, then pinned preference
  useEffect(() => {
    if (tabFromUrl && ['vendor-center', 'bills', 'receipts'].includes(tabFromUrl)) {
      setCurrentTab(tabFromUrl)
    } else if (!isPinningLoading && defaultTab) {
      setCurrentTab(mapSchemaToTab(defaultTab))
    }
  }, [tabFromUrl, defaultTab, isPinningLoading])

  // Load pinned tabs state
  useEffect(() => {
    const loadPinnedState = async () => {
      const states: Record<string, boolean> = {}
      const tabIds: VendorTab[] = ['vendor-center', 'bills', 'receipts']
      for (const tab of tabIds) {
        states[tab] = await isTabPinned(mapTabToSchema(tab))
      }
      setPinnedTabs(states)
    }
    loadPinnedState()
  }, [isTabPinned])

  // Handle tab change - update URL
  const handleTabChange = (tab: VendorTab) => {
    setCurrentTab(tab)
    if (tab === 'vendor-center') {
      searchParams.delete('tab')
    } else {
      searchParams.set('tab', tab)
    }
    setSearchParams(searchParams, { replace: true })
  }

  // Handle pin toggle
  const handlePinToggle = async (tab: VendorTab) => {
    try {
      const schemaTabId = mapTabToSchema(tab)
      if (pinnedTabs[tab]) {
        await unpinTab()
        setPinnedTabs((prev) => ({ ...prev, [tab]: false }))
      } else {
        await pinTab(schemaTabId)
        // Only one tab can be pinned
        setPinnedTabs({
          'vendor-center': tab === 'vendor-center',
          'bills': tab === 'bills',
          'receipts': tab === 'receipts',
        })
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
  }

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
          const topDuplicate = dupeCheck.potentialDuplicates[0]!
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
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Money Going Out</h1>
        </div>
        <Button variant="primary" size="lg" onClick={handleCreate}>
          Add Vendor
        </Button>
      </header>

      {/* Tab Selector */}
      <div className={styles.tabSelector}>
        <button
          className={currentTab === 'vendor-center' ? styles.tabActive : styles.tab}
          onClick={() => handleTabChange('vendor-center')}
        >
          Vendor Center
          <PinIcon
            isPinned={pinnedTabs['vendor-center'] || false}
            onClick={() => handlePinToggle('vendor-center')}
            size={14}
          />
        </button>
        <button
          className={currentTab === 'bills' ? styles.tabActive : styles.tab}
          onClick={() => handleTabChange('bills')}
        >
          Bills
          <PinIcon
            isPinned={pinnedTabs['bills'] || false}
            onClick={() => handlePinToggle('bills')}
            size={14}
          />
        </button>
        <button
          className={currentTab === 'receipts' ? styles.tabActive : styles.tab}
          onClick={() => handleTabChange('receipts')}
        >
          Receipts
          <PinIcon
            isPinned={pinnedTabs['receipts'] || false}
            onClick={() => handlePinToggle('receipts')}
            size={14}
          />
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {currentTab === 'vendor-center' && (
          <VendorInsights
            companyId={companyId}
            vendors={vendors}
            onEditVendor={handleEdit}
            onCreateVendor={handleCreate}
            isLoading={isLoading}
          />
        )}

        {currentTab === 'bills' && (
          <VendorBills companyId={companyId} />
        )}

        {currentTab === 'receipts' && (
          <VendorReceipts companyId={companyId} />
        )}
      </div>

      {/* Create/Edit Modal */}
      {(modalState.type === 'create' || modalState.type === 'edit') && (
        <Modal
          isOpen
          onClose={handleCloseModal}
          title={modalState.type === 'create' ? 'Add Vendor' : 'Edit Vendor'}
          headerStyle={{
            background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
            color: 'white',
          }}
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
