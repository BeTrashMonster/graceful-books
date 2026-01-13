/**
 * Transactions Page
 *
 * Main page for viewing and managing transactions with CRUD functionality.
 *
 * Requirements: B2 - Transaction Entry - Basic
 */

import { useState, useEffect } from 'react'
import { Breadcrumbs } from '../components/navigation/Breadcrumbs'
import { TransactionList } from '../components/transactions/TransactionList'
import { TransactionForm } from '../components/transactions/TransactionForm'
import { useTransactions, useNewTransaction } from '../hooks/useTransactions'
import type { JournalEntry, Account } from '../types'

// Mock company and user IDs - in a real app, these would come from auth context
const MOCK_COMPANY_ID = 'comp-1'
const MOCK_USER_ID = 'user-1'

export default function Transactions() {
  const {
    transactions,
    currentTransaction,
    isLoading,
    error,
    loadTransactions,
    
    createNewTransaction,
    updateExistingTransaction,
    removeTransaction,
    setCurrentTransaction,
    clearError,
  } = useTransactions()

  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Mock accounts - in a real app, these would be loaded from the database
  const [mockAccounts] = useState<Account[]>([
    {
      id: 'acc-1',
      companyId: MOCK_COMPANY_ID,
      name: 'Cash',
      accountNumber: '1000',
      type: 'asset',
      isActive: true,
      balance: 5000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc-2',
      companyId: MOCK_COMPANY_ID,
      name: 'Accounts Receivable',
      accountNumber: '1200',
      type: 'asset',
      isActive: true,
      balance: 2000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc-3',
      companyId: MOCK_COMPANY_ID,
      name: 'Revenue',
      accountNumber: '4000',
      type: 'income',
      isActive: true,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc-4',
      companyId: MOCK_COMPANY_ID,
      name: 'Expenses',
      accountNumber: '6000',
      type: 'expense',
      isActive: true,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ])

  // Load transactions on mount
  useEffect(() => {
    loadTransactions({ companyId: MOCK_COMPANY_ID })
  }, [loadTransactions])

  const handleCreateNew = () => {
    const newTransaction = useNewTransaction(MOCK_COMPANY_ID, MOCK_USER_ID)
    setCurrentTransaction(newTransaction)
    setIsEditing(false)
    setShowForm(true)
    clearError()
  }

  const handleEdit = (transaction: JournalEntry) => {
    setCurrentTransaction(transaction)
    setIsEditing(true)
    setShowForm(true)
    clearError()
  }

  const handleSave = async () => {
    if (!currentTransaction) return

    if (isEditing) {
      const result = await updateExistingTransaction(
        currentTransaction.id,
        currentTransaction
      )
      if (result) {
        setShowForm(false)
        loadTransactions({ companyId: MOCK_COMPANY_ID })
      }
    } else {
      const result = await createNewTransaction(currentTransaction)
      if (result) {
        setShowForm(false)
        loadTransactions({ companyId: MOCK_COMPANY_ID })
      }
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setCurrentTransaction(null)
    clearError()
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      const success = await removeTransaction(id)
      if (success) {
        loadTransactions({ companyId: MOCK_COMPANY_ID })
      }
    }
  }

  const handleTransactionChange = (transaction: JournalEntry) => {
    setCurrentTransaction(transaction)
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <div className="page-header">
        <h1 className="page-title">Transactions</h1>
        <p className="page-description">
          View and manage all your financial transactions.
        </p>
      </div>

      <div className="page-content">
        {!showForm ? (
          <>
            {/* Action Bar */}
            <div
              style={{
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
                  {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={handleCreateNew}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--color-primary, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '1rem',
                }}
              >
                + New Transaction
              </button>
            </div>

            {/* Transaction List */}
            <div className="card">
              <TransactionList
                transactions={transactions}
                onSelect={handleEdit}
                onDelete={handleDelete}
                isLoading={isLoading}
              />
            </div>
          </>
        ) : (
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>
              {isEditing ? 'Edit Transaction' : 'New Transaction'}
            </h2>
            {currentTransaction && (
              <TransactionForm
                transaction={currentTransaction}
                accounts={mockAccounts}
                onChange={handleTransactionChange}
                onSave={handleSave}
                onCancel={handleCancel}
                isLoading={isLoading}
                error={error || undefined}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
