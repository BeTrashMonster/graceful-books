/**
 * Chart of Accounts Page
 *
 * Main page for viewing and managing the chart of accounts.
 * Provides full CRUD operations with modal-based forms.
 *
 * Features:
 * - View all accounts (list/tree)
 * - Create new accounts
 * - Edit existing accounts
 * - Delete accounts (with confirmation)
 * - Search and filter
 * - WCAG 2.1 AA accessible
 */

import { type FC, useState } from 'react'
import { useAccounts } from '../hooks/useAccounts'
import { AccountList } from '../components/accounts/AccountList'
import { AccountForm, type AccountFormData } from '../components/accounts/AccountForm'
import { ChartOfAccountsWizard } from '../components/wizards'
import { Modal } from '../components/modals/Modal'
import { Button } from '../components/core/Button'
import type { Account } from '../types'

export interface ChartOfAccountsProps {
  /**
   * Current company ID
   */
  companyId: string
}

type ModalState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; account: Account }
  | { type: 'delete'; account: Account }
  | { type: 'wizard' }

/**
 * Chart of Accounts Page
 */
export const ChartOfAccounts: FC<ChartOfAccountsProps> = ({ companyId }) => {
  const {
    accounts,
    isLoading,
    create,
    update,
    remove,
    buildTree,
  } = useAccounts({ companyId, isActive: undefined, includeDeleted: false })

  const [modalState, setModalState] = useState<ModalState>({ type: 'closed' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const treeNodes = buildTree(accounts)
  const hasAccounts = accounts.length > 0

  // Get top-level accounts for parent selection
  const parentAccounts = accounts.filter((acc) => !acc.parentAccountId && acc.isActive)

  const handleCreate = () => {
    setModalState({ type: 'create' })
  }

  const handleEdit = (account: Account) => {
    setModalState({ type: 'edit', account })
  }

  const handleDelete = (account: Account) => {
    setModalState({ type: 'delete', account })
  }

  const handleCloseModal = () => {
    setModalState({ type: 'closed' })
    setIsSubmitting(false)
  }

  const handleFormSubmit = async (data: AccountFormData) => {
    setIsSubmitting(true)

    try {
      if (modalState.type === 'create') {
        const result = await create({
          companyId,
          ...data,
        })

        if (result.success) {
          handleCloseModal()
        } else {
          alert(`Error creating account: ${result.error.message}`)
        }
      } else if (modalState.type === 'edit') {
        const result = await update(modalState.account.id, data)

        if (result.success) {
          handleCloseModal()
        } else {
          alert(`Error updating account: ${result.error.message}`)
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (modalState.type !== 'delete') return

    setIsSubmitting(true)

    try {
      const result = await remove(modalState.account.id)

      if (result.success) {
        handleCloseModal()
      } else {
        alert(`Error deleting account: ${result.error.message}`)
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartWizard = () => {
    setModalState({ type: 'wizard' })
  }

  const handleWizardComplete = (_createdAccounts: Account[]) => {
    handleCloseModal()
    // Accounts will automatically appear via the useAccounts hook
  }

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Chart of Accounts</h1>
        <p style={{ color: '#6b7280' }}>
          Manage your chart of accounts - the foundation of your financial records
        </p>
      </header>

      {!hasAccounts && !isLoading ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          backgroundColor: '#f9fafb',
          borderRadius: '12px',
          border: '2px dashed #d1d5db'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '1rem' }}>
            Let's set up your chart of accounts
          </h2>
          <p style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
            We'll guide you through creating the accounts you need to track your business finances.
            It's easier than you think - we promise!
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Button variant="primary" size="lg" onClick={handleStartWizard}>
              Start guided setup
            </Button>
            <Button variant="outline" size="lg" onClick={handleCreate}>
              Create manually
            </Button>
          </div>
        </div>
      ) : (
        <AccountList
          accounts={accounts}
          treeNodes={treeNodes}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreate={handleCreate}
          isLoading={isLoading}
          parentAccounts={parentAccounts}
        />
      )}

      {/* Create/Edit Modal */}
      {(modalState.type === 'create' || modalState.type === 'edit') && (
        <Modal
          isOpen
          onClose={handleCloseModal}
          title={modalState.type === 'create' ? 'Create Account' : 'Edit Account'}
        >
          <AccountForm
            account={modalState.type === 'edit' ? modalState.account : undefined}
            companyId={companyId}
            parentAccounts={parentAccounts}
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
          title="Delete Account"
        >
          <div style={{ padding: '1rem' }}>
            <p>
              Are you sure you want to delete <strong>{modalState.account.name}</strong>?
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              This action cannot be undone. The account will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
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
                Delete Account
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Chart of Accounts Wizard */}
      {modalState.type === 'wizard' && (
        <ChartOfAccountsWizard
          companyId={companyId}
          onComplete={handleWizardComplete}
          onCancel={handleCloseModal}
          isModal={true}
        />
      )}
    </div>
  )
}
