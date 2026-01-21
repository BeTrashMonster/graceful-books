/**
 * Burn Rate Analyzer Service
 *
 * Analyzes expense patterns to understand burn rate composition and trends.
 * Breaks down expenses by category, identifies fixed vs variable costs,
 * and detects spending trends.
 *
 * Implements J6: Emergency Fund & Runway Calculator from ROADMAP.md
 *
 * Features:
 * - Top expense category identification
 * - Fixed vs variable cost classification
 * - Expense trend analysis
 * - Spending pattern detection
 */

import Decimal from 'decimal.js'
import type {
  BurnRateAnalysis,
  ExpenseCategory,
  RunwayDateRange,
  RevenueBreakdown,
  RevenueSource,
  ConcentrationRisk,
} from '../../types/runway.types'
import { db } from '../../db/database'

// Configure Decimal.js for currency precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/**
 * Classify cost type based on variability
 */
function classifyCostType(
  monthlyAmounts: number[]
): 'fixed' | 'variable' | 'semi-variable' {
  if (monthlyAmounts.length < 2) return 'semi-variable'

  const mean = monthlyAmounts.reduce((sum, val) => sum + val, 0) / monthlyAmounts.length
  if (mean === 0) return 'variable'

  // Calculate coefficient of variation
  const squaredDiffs = monthlyAmounts.map((val) => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / monthlyAmounts.length
  const stdDev = Math.sqrt(variance)
  const cv = stdDev / mean

  // Fixed: CV < 15%
  // Variable: CV > 40%
  // Semi-variable: Between 15% and 40%
  if (cv < 0.15) return 'fixed'
  if (cv > 0.4) return 'variable'
  return 'semi-variable'
}

/**
 * Calculate trend direction and percentage
 */
function calculateTrend(monthlyAmounts: number[]): {
  direction: 'increasing' | 'stable' | 'decreasing'
  percentage: number
} {
  if (monthlyAmounts.length < 2) {
    return { direction: 'stable', percentage: 0 }
  }

  // Compare recent half to older half
  const midpoint = Math.floor(monthlyAmounts.length / 2)
  const olderHalf = monthlyAmounts.slice(0, midpoint)
  const recentHalf = monthlyAmounts.slice(midpoint)

  const olderAvg = olderHalf.reduce((sum, val) => sum + val, 0) / olderHalf.length
  const recentAvg = recentHalf.reduce((sum, val) => sum + val, 0) / recentHalf.length

  if (olderAvg === 0) {
    return { direction: 'stable', percentage: 0 }
  }

  const changePercentage = ((recentAvg - olderAvg) / olderAvg) * 100

  let direction: 'increasing' | 'stable' | 'decreasing'
  if (Math.abs(changePercentage) < 5) {
    direction = 'stable'
  } else if (changePercentage > 0) {
    direction = 'increasing'
  } else {
    direction = 'decreasing'
  }

  return {
    direction,
    percentage: Math.abs(changePercentage),
  }
}

/**
 * Analyze burn rate and expense breakdown
 */
export async function analyzeBurnRate(
  companyId: string,
  dateRange: RunwayDateRange
): Promise<BurnRateAnalysis> {
  // Get all transactions in date range
  const transactions = await db.journalEntries
    .where('companyId')
    .equals(companyId)
    .and((tx) => {
      const txDate = new Date(tx.date)
      return (
        txDate >= dateRange.startDate &&
        txDate <= dateRange.endDate &&
        tx.status !== 'void'
      )
    })
    .toArray()

  // Group expenses by account (category)
  const accountExpenses = new Map<
    string,
    { accountId: string; accountName: string; monthlyAmounts: Map<string, Decimal> }
  >()

  for (const transaction of transactions) {
    const txDate = new Date(transaction.date)
    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

    // Get account details for each line
    const accountIds = transaction.lines.map((line: any) => line.accountId)
    const accounts = await db.accounts.where('id').anyOf(accountIds).toArray()
    const accountMap = new Map(accounts.map((acc) => [acc.id, acc]))

    for (const line of transaction.lines) {
      const account = accountMap.get(line.accountId)
      if (!account) continue

      // Only process expense accounts
      if (
        account.type !== 'expense' &&
        account.type !== 'cost-of-goods-sold' &&
        account.type !== 'other-expense'
      ) {
        continue
      }

      // Initialize account tracking
      if (!accountExpenses.has(account.id)) {
        accountExpenses.set(account.id, {
          accountId: account.id,
          accountName: account.name,
          monthlyAmounts: new Map(),
        })
      }

      const accountData = accountExpenses.get(account.id)!

      // Initialize month if needed
      if (!accountData.monthlyAmounts.has(monthKey)) {
        accountData.monthlyAmounts.set(monthKey, new Decimal(0))
      }

      // Add expense amount (use absolute value of debit - credit)
      const amount = new Decimal(line.debit).minus(line.credit).abs()
      const currentAmount = accountData.monthlyAmounts.get(monthKey)!
      accountData.monthlyAmounts.set(monthKey, currentAmount.plus(amount))
    }
  }

  // Calculate average monthly amount and classify each category
  const expenseCategories: ExpenseCategory[] = []
  let totalMonthlyExpenses = new Decimal(0)

  for (const [accountId, data] of accountExpenses) {
    const monthlyAmounts = Array.from(data.monthlyAmounts.values()).map((d) => d.toNumber())

    if (monthlyAmounts.length === 0) continue

    const totalAmount = monthlyAmounts.reduce((sum, val) => sum + val, 0)
    const avgMonthlyAmount = totalAmount / monthlyAmounts.length

    totalMonthlyExpenses = totalMonthlyExpenses.plus(avgMonthlyAmount)

    const costType = classifyCostType(monthlyAmounts)
    const trend = calculateTrend(monthlyAmounts)

    expenseCategories.push({
      id: accountId,
      name: data.accountName,
      monthlyAmount: avgMonthlyAmount,
      percentage: 0, // Will calculate after we have total
      type: costType,
      trend: trend.direction,
      trendPercentage: trend.percentage,
    })
  }

  // Calculate percentages
  const totalExpenses = totalMonthlyExpenses.toNumber()
  for (const category of expenseCategories) {
    category.percentage = totalExpenses > 0 ? (category.monthlyAmount / totalExpenses) * 100 : 0
  }

  // Sort by amount (descending) and take top 5
  expenseCategories.sort((a, b) => b.monthlyAmount - a.monthlyAmount)
  const topExpenseCategories = expenseCategories.slice(0, 5)

  // Calculate fixed vs variable totals
  let fixedTotal = new Decimal(0)
  let variableTotal = new Decimal(0)

  for (const category of expenseCategories) {
    if (category.type === 'fixed') {
      fixedTotal = fixedTotal.plus(category.monthlyAmount)
    } else {
      variableTotal = variableTotal.plus(category.monthlyAmount)
    }
  }

  const fixedCostsTotal = fixedTotal.toNumber()
  const variableCostsTotal = variableTotal.toNumber()
  const fixedPercentage = totalExpenses > 0 ? (fixedCostsTotal / totalExpenses) * 100 : 0
  const variablePercentage = totalExpenses > 0 ? (variableCostsTotal / totalExpenses) * 100 : 0

  // Calculate overall burn rate trend
  const allMonthlyTotals = new Map<string, Decimal>()

  for (const [, data] of accountExpenses) {
    for (const [monthKey, amount] of data.monthlyAmounts) {
      if (!allMonthlyTotals.has(monthKey)) {
        allMonthlyTotals.set(monthKey, new Decimal(0))
      }
      const current = allMonthlyTotals.get(monthKey)!
      allMonthlyTotals.set(monthKey, current.plus(amount))
    }
  }

  const monthlyTotalsArray = Array.from(allMonthlyTotals.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, amount]) => amount.toNumber())

  const overallTrend = calculateTrend(monthlyTotalsArray)

  return {
    averageBurnRate: totalExpenses,
    trendDirection: overallTrend.direction,
    trendPercentage: overallTrend.percentage,
    topExpenseCategories,
    fixedCostsTotal,
    variableCostsTotal,
    fixedPercentage,
    variablePercentage,
  }
}

/**
 * Analyze revenue sources and breakdown
 */
export async function analyzeRevenueBreakdown(
  companyId: string,
  dateRange: RunwayDateRange
): Promise<RevenueBreakdown> {
  // Get all transactions in date range
  const transactions = await db.journalEntries
    .where('companyId')
    .equals(companyId)
    .and((tx) => {
      const txDate = new Date(tx.date)
      return (
        txDate >= dateRange.startDate &&
        txDate <= dateRange.endDate &&
        tx.status !== 'void'
      )
    })
    .toArray()

  // Track revenue by client (contact) and by account (product/service)
  const clientRevenue = new Map<
    string,
    { contactId: string; contactName: string; monthlyAmounts: Map<string, Decimal>; recurring: boolean }
  >()
  const accountRevenue = new Map<
    string,
    { accountId: string; accountName: string; monthlyAmounts: Map<string, Decimal> }
  >()

  for (const transaction of transactions) {
    const txDate = new Date(transaction.date)
    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

    // Get account details
    const accountIds = transaction.lines.map((line: any) => line.accountId)
    const accounts = await db.accounts.where('id').anyOf(accountIds).toArray()
    const accountMap = new Map(accounts.map((acc) => [acc.id, acc]))

    for (const line of transaction.lines) {
      const account = accountMap.get(line.accountId)
      if (!account) continue

      // Only process income accounts
      if (account.type !== 'income' && account.type !== 'other-income') {
        continue
      }

      const amount = new Decimal(line.credit).minus(line.debit)
      if (amount.lte(0)) continue

      // Track by account (product/service)
      if (!accountRevenue.has(account.id)) {
        accountRevenue.set(account.id, {
          accountId: account.id,
          accountName: account.name,
          monthlyAmounts: new Map(),
        })
      }

      const accountData = accountRevenue.get(account.id)!
      if (!accountData.monthlyAmounts.has(monthKey)) {
        accountData.monthlyAmounts.set(monthKey, new Decimal(0))
      }
      const currentAmount = accountData.monthlyAmounts.get(monthKey)!
      accountData.monthlyAmounts.set(monthKey, currentAmount.plus(amount))
    }
  }

  // Get invoices to track revenue by client
  const invoices = await db.invoices
    .where('companyId')
    .equals(companyId)
    .and((inv) => {
      const invDate = new Date(inv.invoice_date)
      return invDate >= dateRange.startDate && invDate <= dateRange.endDate && inv.status !== 'void'
    })
    .toArray()

  // Get contacts
  const contactIds = [...new Set(invoices.map((inv) => inv.contactId))]
  const contacts = await db.contacts.where('id').anyOf(contactIds).toArray()
  const contactMap = new Map(contacts.map((c) => [c.id, c]))

  for (const invoice of invoices) {
    const contact = contactMap.get(invoice.contactId)
    if (!contact) continue

    const invDate = new Date(invoice.invoice_date)
    const monthKey = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, '0')}`

    if (!clientRevenue.has(contact.id)) {
      clientRevenue.set(contact.id, {
        contactId: contact.id,
        contactName: contact.name,
        monthlyAmounts: new Map(),
        recurring: false, // Will determine based on frequency
      })
    }

    const clientData = clientRevenue.get(contact.id)!
    if (!clientData.monthlyAmounts.has(monthKey)) {
      clientData.monthlyAmounts.set(monthKey, new Decimal(0))
    }

    const currentAmount = clientData.monthlyAmounts.get(monthKey)!
    const invoiceTotal = new Decimal(invoice.total)
    clientData.monthlyAmounts.set(monthKey, currentAmount.plus(invoiceTotal))
  }

  // Determine if client revenue is recurring (appears in 50%+ of months)
  const totalMonths = Math.ceil(
    (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
  )

  for (const [, data] of clientRevenue) {
    const monthsWithRevenue = data.monthlyAmounts.size
    data.recurring = monthsWithRevenue / totalMonths >= 0.5
  }

  // Calculate totals and build revenue sources
  let totalMonthlyRevenue = new Decimal(0)
  const topClients: RevenueSource[] = []
  const topProducts: RevenueSource[] = []

  // Process clients
  for (const [contactId, data] of clientRevenue) {
    const amounts = Array.from(data.monthlyAmounts.values()).map((d) => d.toNumber())
    const totalAmount = amounts.reduce((sum, val) => sum + val, 0)
    const avgMonthly = totalAmount / amounts.length

    totalMonthlyRevenue = totalMonthlyRevenue.plus(avgMonthly)

    const trend = calculateTrend(amounts)

    topClients.push({
      id: contactId,
      name: data.contactName,
      type: 'client',
      monthlyAmount: avgMonthly,
      percentage: 0, // Calculate later
      trend: trend.direction === 'increasing' ? 'growing' : trend.direction === 'decreasing' ? 'declining' : 'stable',
      trendPercentage: trend.percentage,
      isRecurring: data.recurring,
    })
  }

  // Process products/services
  for (const [accountId, data] of accountRevenue) {
    const amounts = Array.from(data.monthlyAmounts.values()).map((d) => d.toNumber())
    const totalAmount = amounts.reduce((sum, val) => sum + val, 0)
    const avgMonthly = totalAmount / amounts.length

    const trend = calculateTrend(amounts)

    topProducts.push({
      id: accountId,
      name: data.accountName,
      type: 'product',
      monthlyAmount: avgMonthly,
      percentage: 0, // Calculate later
      trend: trend.direction === 'increasing' ? 'growing' : trend.direction === 'decreasing' ? 'declining' : 'stable',
      trendPercentage: trend.percentage,
      isRecurring: false, // Products are not typically recurring
    })
  }

  const totalRevenue = totalMonthlyRevenue.toNumber()

  // Calculate percentages
  for (const client of topClients) {
    client.percentage = totalRevenue > 0 ? (client.monthlyAmount / totalRevenue) * 100 : 0
  }
  for (const product of topProducts) {
    product.percentage = totalRevenue > 0 ? (product.monthlyAmount / totalRevenue) * 100 : 0
  }

  // Sort and take top 5
  topClients.sort((a, b) => b.monthlyAmount - a.monthlyAmount)
  topProducts.sort((a, b) => b.monthlyAmount - a.monthlyAmount)

  const top5Clients = topClients.slice(0, 5)
  const top5Products = topProducts.slice(0, 5)

  // Check for concentration risk
  const concentrationRisk: ConcentrationRisk = checkConcentrationRisk(
    top5Clients,
    top5Products
  )

  // Calculate recurring vs project revenue
  const recurringRevenue = topClients
    .filter((c) => c.isRecurring)
    .reduce((sum, c) => sum + c.monthlyAmount, 0)
  const recurringPercentage = totalRevenue > 0 ? (recurringRevenue / totalRevenue) * 100 : 0
  const projectPercentage = 100 - recurringPercentage

  return {
    totalMonthlyRevenue: totalRevenue,
    topClients: top5Clients,
    topProducts: top5Products,
    concentrationRisk,
    recurringPercentage,
    projectPercentage,
  }
}

/**
 * Check for concentration risk
 */
function checkConcentrationRisk(
  clients: RevenueSource[],
  products: RevenueSource[]
): ConcentrationRisk {
  // Check if any single client > 25% of revenue
  for (const client of clients) {
    if (client.percentage > 25) {
      return {
        hasRisk: true,
        type: 'client',
        name: client.name,
        percentage: client.percentage,
        threshold: 25,
        message: `High concentration: ${client.name} represents ${client.percentage.toFixed(1)}% of revenue`,
      }
    }
  }

  // Check if any single product > 40% of revenue
  for (const product of products) {
    if (product.percentage > 40) {
      return {
        hasRisk: true,
        type: 'product',
        name: product.name,
        percentage: product.percentage,
        threshold: 40,
        message: `High concentration: ${product.name} represents ${product.percentage.toFixed(1)}% of revenue`,
      }
    }
  }

  return {
    hasRisk: false,
    threshold: 25,
  }
}
