/**
 * Financial Flow Calculations Utility
 *
 * Provides calculations for the Financial Flow Widget (J1):
 * - Aggregate account balances by primary node categories
 * - Determine transaction flow directions
 * - Calculate node sizes based on balances
 * - Detect barter transactions
 *
 * Requirements:
 * - J1: Financial Flow Widget (Nice)
 * - GAAP-compliant categorization
 * - Barter transaction support (I5 integration)
 */

import type { Account, AccountType, JournalEntry } from '../types'

/**
 * Primary node categories for financial flow visualization
 */
export type FlowNodeType =
  | 'assets'
  | 'liabilities'
  | 'equity'
  | 'revenue'
  | 'cogs'
  | 'expenses'

/**
 * Flow node with balance and metadata
 */
export interface FlowNode {
  type: FlowNodeType
  label: string
  balance: number
  accountIds: string[]
  subNodes: Array<{
    accountId: string
    accountName: string
    balance: number
  }>
  healthStatus: 'healthy' | 'caution' | 'concern'
}

/**
 * Transaction flow between nodes
 */
export interface TransactionFlow {
  id: string
  fromNode: FlowNodeType
  toNode: FlowNodeType
  amount: number
  date: Date
  description: string
  isCash: boolean // solid line
  isAccrual: boolean // dashed line
  isBarter: boolean // bidirectional arrow
}

/**
 * Map account types to flow node categories
 */
export function mapAccountTypeToFlowNode(accountType: AccountType): FlowNodeType {
  switch (accountType) {
    case 'asset':
      return 'assets'
    case 'liability':
      return 'liabilities'
    case 'equity':
      return 'equity'
    case 'income':
    case 'other-income':
      return 'revenue'
    case 'cost-of-goods-sold':
      return 'cogs'
    case 'expense':
    case 'other-expense':
      return 'expenses'
    default:
      return 'assets' // Fallback
  }
}

/**
 * Aggregate account balances by primary node categories
 */
export function aggregateAccountsByNode(accounts: Account[]): FlowNode[] {
  const nodeMap = new Map<FlowNodeType, FlowNode>()

  // Initialize primary nodes
  const nodeTypes: Array<{ type: FlowNodeType; label: string }> = [
    { type: 'assets', label: 'Assets' },
    { type: 'liabilities', label: 'Liabilities' },
    { type: 'equity', label: 'Equity' },
    { type: 'revenue', label: 'Revenue' },
    { type: 'cogs', label: 'Cost of Goods Sold' },
    { type: 'expenses', label: 'Expenses' },
  ]

  nodeTypes.forEach(({ type, label }) => {
    nodeMap.set(type, {
      type,
      label,
      balance: 0,
      accountIds: [],
      subNodes: [],
      healthStatus: 'healthy',
    })
  })

  // Aggregate accounts into nodes
  accounts.forEach((account) => {
    if (!account.isActive || account.deletedAt) return

    const nodeType = mapAccountTypeToFlowNode(account.type)
    const node = nodeMap.get(nodeType)

    if (node) {
      node.balance += account.balance
      node.accountIds.push(account.id)
      node.subNodes.push({
        accountId: account.id,
        accountName: account.name,
        balance: account.balance,
      })
    }
  })

  // Calculate health status for each node
  nodeMap.forEach((node) => {
    node.healthStatus = calculateNodeHealth(node)
  })

  return Array.from(nodeMap.values())
}

/**
 * Calculate health status for a node based on balance and context
 */
function calculateNodeHealth(node: FlowNode): 'healthy' | 'caution' | 'concern' {
  const balance = Math.abs(node.balance)

  // Context matters: big revenue = good, big expenses = potentially concerning
  switch (node.type) {
    case 'assets':
    case 'revenue':
      // More is better
      if (balance > 50000) return 'healthy'
      if (balance > 10000) return 'caution'
      return 'concern'

    case 'liabilities':
    case 'expenses':
      // Less is better (relatively speaking)
      if (balance > 100000) return 'concern'
      if (balance > 50000) return 'caution'
      return 'healthy'

    case 'equity':
      // Positive equity is good
      if (node.balance > 0) return 'healthy'
      if (node.balance > -10000) return 'caution'
      return 'concern'

    case 'cogs':
      // Should be proportional to revenue (simplified)
      return 'healthy'

    default:
      return 'healthy'
  }
}

/**
 * Determine transaction flow direction based on journal entry
 */
export function determineTransactionFlow(transaction: JournalEntry): TransactionFlow[] {
  const flows: TransactionFlow[] = []

  // Group lines by debit/credit and account type
  const debitLines = transaction.lines.filter((line) => line.debit > 0)
  const creditLines = transaction.lines.filter((line) => line.credit > 0)

  // Simple flow detection: from credit accounts to debit accounts
  creditLines.forEach((creditLine) => {
    debitLines.forEach((debitLine) => {
      const amount = Math.min(creditLine.credit, debitLine.debit)

      if (amount > 0) {
        flows.push({
          id: `${transaction.id}-${creditLine.accountId}-${debitLine.accountId}`,
          fromNode: 'assets', // Simplified - would need account type lookup
          toNode: 'expenses', // Simplified - would need account type lookup
          amount,
          date: transaction.date,
          description: transaction.memo || 'Transaction',
          isCash: isCashTransaction(transaction),
          isAccrual: !isCashTransaction(transaction),
          isBarter: isBarterTransaction(transaction),
        })
      }
    })
  })

  return flows
}

/**
 * Detect if a transaction is cash-based (involves cash accounts)
 */
function isCashTransaction(transaction: JournalEntry): boolean {
  // Check if any line item references a cash/bank account
  // This would need to look up account types - simplified for now
  return transaction.lines.some((line) =>
    line.accountId.toLowerCase().includes('cash') ||
    line.accountId.toLowerCase().includes('bank')
  )
}

/**
 * Detect if a transaction is a barter transaction (I5 integration)
 *
 * Barter transactions have:
 * - No cash/bank account involvement
 * - Both revenue and expense components
 * - Equal amounts on both sides
 */
export function isBarterTransaction(transaction: JournalEntry): boolean {
  // Check transaction memo/reference for barter keywords
  const hasBarter =
    transaction.memo?.toLowerCase().includes('barter') ||
    transaction.memo?.toLowerCase().includes('trade') ||
    transaction.reference?.toLowerCase().includes('barter')

  if (hasBarter) return true

  // Check if transaction involves both revenue and expense without cash
  const hasCash = isCashTransaction(transaction)
  if (hasCash) return false

  // Would need to check account types - simplified detection
  return false
}

/**
 * Detect if user has any active barter transactions
 */
export function hasActiveBarterActivity(transactions: JournalEntry[]): boolean {
  return transactions.some((transaction) => isBarterTransaction(transaction))
}

/**
 * Calculate node size based on balance (for visual proportional sizing)
 * Returns a scale factor between 1.0 (minimum) and 3.0 (maximum)
 */
export function calculateNodeSize(balance: number, allBalances: number[]): number {
  if (allBalances.length === 0) return 1.5

  const absBalance = Math.abs(balance)
  const maxBalance = Math.max(...allBalances.map(Math.abs), 1)
  const minBalance = Math.min(...allBalances.filter(b => Math.abs(b) > 0).map(Math.abs), 1)

  // Log scale for better visual distribution
  const logBalance = Math.log10(absBalance + 1)
  const logMax = Math.log10(maxBalance + 1)
  const logMin = Math.log10(minBalance + 1)

  // Normalize to 1.0 - 3.0 range
  const normalized = (logBalance - logMin) / (logMax - logMin || 1)
  return 1.0 + normalized * 2.0
}

/**
 * Get transaction flow direction mappings
 */
export const FLOW_DIRECTIONS: Record<
  string,
  { from: FlowNodeType; to: FlowNodeType }
> = {
  'cash-sale': { from: 'revenue', to: 'assets' },
  'invoice-created': { from: 'revenue', to: 'assets' },
  'customer-payment': { from: 'assets', to: 'assets' }, // AR to Cash
  'bill-entered': { from: 'expenses', to: 'liabilities' },
  'bill-paid': { from: 'assets', to: 'liabilities' },
  'buy-inventory-cash': { from: 'assets', to: 'assets' }, // Cash to Inventory
  'buy-inventory-credit': { from: 'liabilities', to: 'assets' },
  'sell-inventory': { from: 'assets', to: 'cogs' },
  'loan-received': { from: 'liabilities', to: 'assets' },
  'loan-payment': { from: 'assets', to: 'liabilities' },
  'owner-investment': { from: 'equity', to: 'assets' },
  'owner-draw': { from: 'assets', to: 'equity' },
  'barter-transaction': { from: 'revenue', to: 'expenses' }, // Bidirectional
}

/**
 * Get color for node based on type (color-blind safe)
 */
export function getNodeColor(nodeType: FlowNodeType): string {
  const colors: Record<FlowNodeType, string> = {
    assets: '#2563eb', // Blue
    liabilities: '#dc2626', // Red
    equity: '#16a34a', // Green
    revenue: '#9333ea', // Purple
    cogs: '#ea580c', // Orange
    expenses: '#ca8a04', // Yellow
  }
  return colors[nodeType]
}

/**
 * Get health indicator color (color-blind safe with patterns)
 */
export function getHealthColor(status: 'healthy' | 'caution' | 'concern'): string {
  const colors = {
    healthy: '#16a34a', // Green
    caution: '#eab308', // Yellow
    concern: '#dc2626', // Red
  }
  return colors[status]
}

/**
 * Format currency for node labels
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
