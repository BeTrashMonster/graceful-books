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
import { useAccounts } from '../hooks/useAccounts'
import { useAuth } from '../contexts/AuthContext'
import type { JournalEntry } from '../types'

export default function Transactions() {
  const { companyId, userIdentifier } = useAuth()

  // Fallback to demo IDs for development
  const activeCompanyId = companyId || 'demo-company-id'
  const activeUserId = userIdentifier || 'demo-user-id'

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

  // Load accounts from database
  const { accounts, isLoading: accountsLoading } = useAccounts({
    companyId: activeCompanyId,
    isActive: true
  })

  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Load transactions on mount
  useEffect(() => {
    loadTransactions({ companyId: activeCompanyId })
  }, [loadTransactions, activeCompanyId])

  const handleCreateNew = () => {
    const newTransaction = useNewTransaction(activeCompanyId, activeUserId)
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
        loadTransactions({ companyId: activeCompanyId })
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

            {accounts.length === 0 && !accountsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ fontSize: '1.125rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                  Let's set up your Chart of Accounts first!
                </p>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                  Before you can record transactions, we need to set up the accounts you'll track.
                  Don't worry - we'll walk you through it step by step.
                </p>
                <button
                  onClick={() => window.location.href = '/accounts'}
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
                  Set Up Chart of Accounts
                </button>
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'transparent',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '1rem',
                    marginLeft: '1rem',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : currentTransaction && (
              <TransactionForm
                transaction={currentTransaction}
                accounts={accounts}
                onChange={handleTransactionChange}
                onSave={handleSave}
                onCancel={handleCancel}
                isLoading={isLoading || accountsLoading}
                error={error || undefined}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
