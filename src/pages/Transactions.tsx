/**
 * Transactions Page - Transaction Entry Hub
 *
 * A central hub for recording business transactions with helpful insights.
 * Features a 2x2 grid of transaction types with contextual information.
 *
 * Requirements: B2 - Transaction Entry - Basic
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Breadcrumbs } from '../components/navigation/Breadcrumbs'
import { TransactionForm } from '../components/transactions/TransactionForm'
import { SimpleTransactionForm } from '../components/transactions/SimpleTransactionForm'
import { ExpenseForm } from '../components/transactions/ExpenseForm'
import { RecentActivityTable } from '../components/transactions/RecentActivityTable'
import { TransactionDetailDrawer } from '../components/transactions/TransactionDetailDrawer'
import { Modal } from '../components/modals/Modal'
import { useTransactions, useNewTransaction } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useVendors } from '../hooks/useVendors'
import { useCustomers } from '../hooks/useCustomers'
import { useAuth } from '../contexts/AuthContext'
import type { JournalEntry } from '../types'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

type TransactionType = 'spent' | 'received' | 'transfer' | 'paid-credit' | null

interface TransactionTypeCard {
  type: TransactionType
  title: string
  subtitle: string
  color: string
  gradient: string
}

const TRANSACTION_TYPES: TransactionTypeCard[] = [
  {
    type: 'spent',
    title: 'Record an Expense',
    subtitle: 'Track purchases and business costs',
    color: '#7c2d12', // Rust
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)',
  },
  {
    type: 'received',
    title: 'Record Income or Deposits',
    subtitle: 'Capture money coming in',
    color: '#1a4731', // Forest Green
    gradient: 'linear-gradient(135deg, #1a4731 0%, #276749 100%)',
  },
  {
    type: 'transfer',
    title: 'Transfer Funds',
    subtitle: 'Move money between accounts',
    color: '#1e3a5f', // Royal Blue
    gradient: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
  },
  {
    type: 'paid-credit',
    title: 'Pay Credit Card or Liability',
    subtitle: 'Make a payment toward any balance you owe',
    color: '#4b006e', // Royal Purple
    gradient: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
  },
]

export default function Transactions() {
  const { companyId, userIdentifier } = useAuth()

  // Fallback to demo IDs for development
  // IMPORTANT: Must match the fallback in ChartOfAccounts.tsx and AccountRegisterPage.tsx
  const activeCompanyId = companyId || 'demo-company'
  const activeUserId = userIdentifier || 'demo-user'

  const {
    transactions,
    currentTransaction,
    isLoading,
    error,
    loadTransactions,
    createNewTransaction,
    updateExistingTransaction,
    setCurrentTransaction,
    clearError,
  } = useTransactions()

  // Load accounts from database
  const { accounts, isLoading: accountsLoading } = useAccounts({
    companyId: activeCompanyId,
    isActive: true,
  })

  // Load vendors and customers for the activity table
  const { vendors } = useVendors({ companyId: activeCompanyId })
  const { customers } = useCustomers({ companyId: activeCompanyId })

  const [selectedType, setSelectedType] = useState<TransactionType>(null)
  const [showAdvancedForm, setShowAdvancedForm] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<JournalEntry | null>(null)

  // State for transaction detail drawer
  const [viewingTransactionId, setViewingTransactionId] = useState<string | null>(null)

  // Load transactions on mount
  useEffect(() => {
    loadTransactions({ companyId: activeCompanyId })
  }, [loadTransactions, activeCompanyId])

  // Calculate insights from transactions
  const insights = useMemo(() => {
    const now = new Date()
    const thisMonthStart = startOfMonth(now)
    const thisMonthEnd = endOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    // Helper to check if transaction is in date range
    const inRange = (txn: JournalEntry, start: Date, end: Date) => {
      const txnDate = new Date(txn.date)
      return txnDate >= start && txnDate <= end
    }

    // Get amounts (handling both cents and dollars based on reference)
    const getAmount = (txn: JournalEntry): number => {
      const raw = txn.lines.reduce((sum, line) => sum + (line.debit || line.credit), 0) / 2
      return txn.reference === 'OPENING' ? raw / 100 : raw
    }

    // Filter by account type
    const expenseAccountIds = new Set(
      accounts
        .filter((a) => ['expense', 'cost-of-goods-sold', 'other-expense'].includes(a.type))
        .map((a) => a.id)
    )
    const incomeAccountIds = new Set(
      accounts.filter((a) => ['income', 'other-income'].includes(a.type)).map((a) => a.id)
    )
    // Credit card accounts: liability accounts that are credit cards
    // Match by name patterns or account number convention (2xxx range for liabilities)
    const creditCardAccountIds = new Set(
      accounts
        .filter((a) => {
          if (a.type !== 'liability') return false
          const nameLower = a.name.toLowerCase()
          // Check common credit card name patterns
          if (nameLower.includes('credit') ||
              nameLower.includes('visa') ||
              nameLower.includes('mastercard') ||
              nameLower.includes('amex') ||
              nameLower.includes('american express') ||
              nameLower.includes('discover') ||
              nameLower.includes('card')) {
            return true
          }
          // Fallback: if it's a current liability (subType), include it
          if (a.subType === 'current-liability') {
            return true
          }
          return false
        })
        .map((a) => a.id)
    )

    // Bank accounts: asset accounts that are cash/bank
    // Match by name patterns or account number convention (1xxx range for assets)
    const bankAccountIds = new Set(
      accounts
        .filter((a) => {
          if (a.type !== 'asset') return false
          const nameLower = a.name.toLowerCase()
          // Check common bank account name patterns
          if (nameLower.includes('checking') ||
              nameLower.includes('savings') ||
              nameLower.includes('cash') ||
              nameLower.includes('bank') ||
              nameLower.includes('money market') ||
              nameLower.includes('petty')) {
            return true
          }
          // Fallback: if it's a current asset (subType), include it
          if (a.subType === 'current-asset') {
            return true
          }
          return false
        })
        .map((a) => a.id)
    )

    // Categorize transactions
    const expenseTransactions = transactions.filter((txn) =>
      txn.lines.some((line) => expenseAccountIds.has(line.accountId) && line.debit > 0)
    )
    const incomeTransactions = transactions.filter((txn) =>
      txn.lines.some((line) => incomeAccountIds.has(line.accountId) && line.credit > 0)
    )
    const transferTransactions = transactions.filter(
      (txn) =>
        txn.lines.every((line) => bankAccountIds.has(line.accountId)) && txn.lines.length === 2
    )
    const creditPaymentTransactions = transactions.filter((txn) =>
      txn.lines.some((line) => creditCardAccountIds.has(line.accountId) && line.debit > 0)
    )

    // Calculate totals
    const thisMonthExpenses = expenseTransactions
      .filter((txn) => inRange(txn, thisMonthStart, thisMonthEnd))
      .reduce((sum, txn) => sum + getAmount(txn), 0)
    const lastMonthExpenses = expenseTransactions
      .filter((txn) => inRange(txn, lastMonthStart, lastMonthEnd))
      .reduce((sum, txn) => sum + getAmount(txn), 0)

    const thisMonthIncome = incomeTransactions
      .filter((txn) => inRange(txn, thisMonthStart, thisMonthEnd))
      .reduce((sum, txn) => sum + getAmount(txn), 0)
    const lastMonthIncome = incomeTransactions
      .filter((txn) => inRange(txn, lastMonthStart, lastMonthEnd))
      .reduce((sum, txn) => sum + getAmount(txn), 0)

    // Find top expense category this month
    const expenseByCategory: Record<string, number> = {}
    expenseTransactions
      .filter((txn) => inRange(txn, thisMonthStart, thisMonthEnd))
      .forEach((txn) => {
        txn.lines.forEach((line) => {
          if (expenseAccountIds.has(line.accountId) && line.debit > 0) {
            const account = accounts.find((a) => a.id === line.accountId)
            if (account) {
              const amount = txn.reference === 'OPENING' ? line.debit / 100 : line.debit
              expenseByCategory[account.name] = (expenseByCategory[account.name] || 0) + amount
            }
          }
        })
      })
    const topExpenseCategory = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0]

    // Find top income source this month
    const incomeBySource: Record<string, number> = {}
    incomeTransactions
      .filter((txn) => inRange(txn, thisMonthStart, thisMonthEnd))
      .forEach((txn) => {
        txn.lines.forEach((line) => {
          if (incomeAccountIds.has(line.accountId) && line.credit > 0) {
            const account = accounts.find((a) => a.id === line.accountId)
            if (account) {
              const amount = txn.reference === 'OPENING' ? line.credit / 100 : line.credit
              incomeBySource[account.name] = (incomeBySource[account.name] || 0) + amount
            }
          }
        })
      })
    const topIncomeSource = Object.entries(incomeBySource).sort((a, b) => b[1] - a[1])[0]

    // Get recent transactions for each type
    const recentExpense = expenseTransactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0]
    const recentIncome = incomeTransactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0]
    const recentTransfer = transferTransactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0]
    const recentCreditPayment = creditPaymentTransactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0]

    // Calculate credit card balance from transactions
    // For liability accounts: credits increase balance (charges), debits decrease (payments)
    let creditCardBalance = 0
    const postedTransactions = transactions.filter((txn) => txn.status === 'posted' || txn.status === 'reconciled')

    postedTransactions.forEach((txn) => {
      txn.lines.forEach((line) => {
        if (creditCardAccountIds.has(line.accountId)) {
          creditCardBalance += line.credit - line.debit
        }
      })
    })

    // Calculate bank balances from transactions
    // For asset accounts: debits increase balance (deposits), credits decrease (withdrawals)
    let bankBalance = 0
    postedTransactions.forEach((txn) => {
      txn.lines.forEach((line) => {
        if (bankAccountIds.has(line.accountId)) {
          bankBalance += line.debit - line.credit
        }
      })
    })

    return {
      spent: {
        thisMonth: thisMonthExpenses,
        lastMonth: lastMonthExpenses,
        trend:
          lastMonthExpenses > 0
            ? ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
            : 0,
        topCategory: topExpenseCategory,
        recent: recentExpense,
        count: expenseTransactions.filter((txn) => inRange(txn, thisMonthStart, thisMonthEnd))
          .length,
      },
      received: {
        thisMonth: thisMonthIncome,
        lastMonth: lastMonthIncome,
        trend:
          lastMonthIncome > 0 ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0,
        topSource: topIncomeSource,
        recent: recentIncome,
        count: incomeTransactions.filter((txn) => inRange(txn, thisMonthStart, thisMonthEnd))
          .length,
      },
      transfer: {
        recent: recentTransfer,
        bankBalance,
        count: transferTransactions.length,
      },
      creditCard: {
        balance: creditCardBalance,
        recent: recentCreditPayment,
        count: creditPaymentTransactions.length,
      },
    }
  }, [transactions, accounts])

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatCurrencyFull = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const handleSelectType = (type: TransactionType) => {
    if (!type) return
    setSelectedType(type)
    const newTransaction = useNewTransaction(activeCompanyId, activeUserId)
    setCurrentTransaction(newTransaction)
    clearError()
  }

  const handleOpenAdvanced = () => {
    setShowAdvancedForm(true)
    const newTransaction = useNewTransaction(activeCompanyId, activeUserId)
    setCurrentTransaction(newTransaction)
    clearError()
  }

  const handleSave = async (transactionToSave?: JournalEntry) => {
    // Use the passed transaction (to avoid race condition) or fall back to state
    const txn = transactionToSave || currentTransaction
    if (!txn) return

    if (editingTransaction) {
      const result = await updateExistingTransaction(txn.id, txn)
      if (result) {
        setEditingTransaction(null)
        setSelectedType(null)
        loadTransactions({ companyId: activeCompanyId })
      }
    } else {
      const result = await createNewTransaction(txn)
      if (result) {
        setSelectedType(null)
        setShowAdvancedForm(false)
        loadTransactions({ companyId: activeCompanyId })
      }
    }
  }

  const handleCancel = () => {
    setSelectedType(null)
    setShowAdvancedForm(false)
    setEditingTransaction(null)
    setCurrentTransaction(null)
    clearError()
  }

  const handleTransactionChange = (transaction: JournalEntry) => {
    setCurrentTransaction(transaction)
  }

  // Handle clicking on a transaction in the activity table
  const handleTransactionClick = useCallback((transaction: JournalEntry) => {
    setViewingTransactionId(transaction.id)
  }, [])

  // Handle closing the transaction detail drawer
  const handleCloseDetailDrawer = useCallback(() => {
    setViewingTransactionId(null)
  }, [])

  // Handle transaction updates from the drawer
  const handleTransactionUpdated = useCallback(() => {
    loadTransactions({ companyId: activeCompanyId })
  }, [loadTransactions, activeCompanyId])

  const renderInsight = (type: TransactionType) => {
    if (!type) return null

    const insightStyle = {
      fontSize: '0.8125rem',
      color: 'rgba(255, 255, 255, 0.75)',
      lineHeight: 1.5,
    }
    const highlightStyle = {
      fontWeight: 600,
      color: 'white',
      marginBottom: '0.25rem',
    }

    switch (type) {
      case 'spent':
        return (
          <div style={insightStyle}>
            {insights.spent.thisMonth > 0 ? (
              <>
                <div style={highlightStyle}>
                  {formatCurrency(insights.spent.thisMonth)} this month
                </div>
                {insights.spent.topCategory && (
                  <div>Top category: {insights.spent.topCategory[0]}</div>
                )}
                {insights.spent.trend !== 0 && (
                  <div>
                    {insights.spent.trend > 0 ? '↑' : '↓'}{' '}
                    {Math.abs(insights.spent.trend).toFixed(0)}% vs last month
                  </div>
                )}
              </>
            ) : (
              <div>No expenses recorded this month</div>
            )}
          </div>
        )

      case 'received':
        return (
          <div style={insightStyle}>
            {insights.received.thisMonth > 0 ? (
              <>
                <div style={highlightStyle}>
                  {formatCurrency(insights.received.thisMonth)} this month
                </div>
                {insights.received.topSource && (
                  <div>Top source: {insights.received.topSource[0]}</div>
                )}
                {insights.received.trend !== 0 && (
                  <div>
                    {insights.received.trend > 0 ? '↑' : '↓'}{' '}
                    {Math.abs(insights.received.trend).toFixed(0)}% vs last month
                  </div>
                )}
              </>
            ) : (
              <div>No income recorded this month</div>
            )}
          </div>
        )

      case 'transfer':
        return (
          <div style={insightStyle}>
            <div style={highlightStyle}>
              {formatCurrency(insights.transfer.bankBalance)} in bank accounts
            </div>
            {insights.transfer.recent ? (
              <div>
                Last transfer: {format(new Date(insights.transfer.recent.date), 'MMM d')}
              </div>
            ) : (
              <div>No transfers recorded yet</div>
            )}
          </div>
        )

      case 'paid-credit':
        return (
          <div style={insightStyle}>
            {insights.creditCard.balance > 0 ? (
              <>
                <div style={highlightStyle}>
                  {formatCurrencyFull(insights.creditCard.balance)} balance due
                </div>
                {insights.creditCard.recent && (
                  <div>
                    Last payment: {format(new Date(insights.creditCard.recent.date), 'MMM d')}
                  </div>
                )}
              </>
            ) : (
              <div>No outstanding balance</div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Record a Transaction</h1>
        <p className="page-description">
          What happened with your money? Choose the type of transaction to record.
        </p>
      </div>

      <div className="page-content">
        {/* 2x2 Transaction Type Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          {TRANSACTION_TYPES.map((card) => (
            <button
              key={card.type}
              onClick={() => handleSelectType(card.type)}
              style={{
                padding: '1.75rem',
                background: card.gradient,
                border: 'none',
                borderRadius: '0.75rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
                minHeight: '180px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.25)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h3
                  style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '1.375rem',
                    fontWeight: 700,
                    color: 'white',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    margin: '0 0 1.25rem 0',
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.8)',
                  }}
                >
                  {card.subtitle}
                </p>
                <div style={{ flex: 1 }}>
                  {renderInsight(card.type)}
                </div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: '1.25rem',
                  right: '1.25rem',
                  padding: '0.625rem 1.25rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(4px)',
                  color: 'white',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                Add Entry
              </div>
            </button>
          ))}
        </div>

        {/* Advanced Entry Option */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: '#f8f7f6',
            borderRadius: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2.5rem',
            border: '1px solid #e5e4e3',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#374151' }}>
              Advanced Journal Entry
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              Full double-entry form for complex or multi-line transactions
            </p>
          </div>
          <button
            onClick={handleOpenAdvanced}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: '#334155',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.875rem',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1e293b'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#334155'
            }}
          >
            Open Form
          </button>
        </div>

        {/* Recent Activity */}
        <RecentActivityTable
          transactions={transactions}
          vendors={vendors}
          customers={customers}
          onTransactionClick={handleTransactionClick}
          initialPageSize={10}
          showFilters={true}
          showExport={true}
        />
      </div>

      {/* Simple Transaction Modal */}
      {selectedType && currentTransaction && (
        <Modal
          isOpen={!!selectedType}
          onClose={handleCancel}
          title={TRANSACTION_TYPES.find((t) => t.type === selectedType)?.title || 'New Transaction'}
          size="lg"
          closeOnBackdropClick={false}
          headerStyle={{
            background: TRANSACTION_TYPES.find((t) => t.type === selectedType)?.gradient,
            color: 'white',
          }}
        >
          {accounts.length === 0 && !accountsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p
                style={{
                  fontSize: '1.125rem',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '1rem',
                }}
              >
                Let's set up your Chart of Accounts first!
              </p>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                Before you can record transactions, we need to set up the accounts you'll track.
              </p>
              <button
                onClick={() => (window.location.href = '/accounts')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--color-primary, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Set Up Chart of Accounts
              </button>
            </div>
          ) : selectedType === 'spent' ? (
            <ExpenseForm
              transaction={currentTransaction}
              accounts={accounts}
              companyId={activeCompanyId}
              onChange={handleTransactionChange}
              onSave={handleSave}
              onCancel={handleCancel}
              isLoading={isLoading || accountsLoading}
              error={error || undefined}
            />
          ) : (
            <SimpleTransactionForm
              transaction={currentTransaction}
              accounts={accounts}
              onChange={handleTransactionChange}
              onSave={handleSave}
              onCancel={handleCancel}
              isLoading={isLoading || accountsLoading}
              error={error || undefined}
              defaultTransactionType={selectedType || undefined}
            />
          )}
        </Modal>
      )}

      {/* Advanced Transaction Modal */}
      {showAdvancedForm && currentTransaction && (
        <Modal
          isOpen={showAdvancedForm}
          onClose={handleCancel}
          title="Advanced Journal Entry"
          size="lg"
          closeOnBackdropClick={false}
          headerStyle={{
            background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
            color: 'white',
          }}
        >
          {accounts.length === 0 && !accountsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p
                style={{
                  fontSize: '1.125rem',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '1rem',
                }}
              >
                Let's set up your Chart of Accounts first!
              </p>
              <button
                onClick={() => (window.location.href = '/accounts')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--color-primary, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Set Up Chart of Accounts
              </button>
            </div>
          ) : (
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
        </Modal>
      )}

      {/* Transaction Detail Drawer */}
      {viewingTransactionId && (
        <TransactionDetailDrawer
          isOpen={true}
          onClose={handleCloseDetailDrawer}
          transactionId={viewingTransactionId}
          companyId={activeCompanyId}
          onTransactionUpdated={handleTransactionUpdated}
          onTransactionVoided={handleTransactionUpdated}
          onTransactionDeleted={handleTransactionUpdated}
        />
      )}
    </div>
  )
}
