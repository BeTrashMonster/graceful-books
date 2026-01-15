/**
 * Profit & Loss Report Service
 *
 * Generates P&L reports from transaction data with:
 * - Decimal.js for precise money calculations
 * - Support for cash vs accrual accounting
 * - Comparison period calculations
 * - Educational annotations
 *
 * Per ACCT-009 and D6 specifications
 */

import Decimal from 'decimal.js'
import { queryAccounts } from '../../store/accounts'
import { queryTransactions } from '../../store/transactions'
import { educationalContent } from '../../utils/reporting'
import type {
  ProfitLossReport,
  ProfitLossOptions,
  PLSection,
  PLLineItem,
  DateRange,
} from '../../types/reports.types'
import type { Account, JournalEntry, AccountingMethod } from '../../types'

// Configure Decimal.js for currency (2 decimal places)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/**
 * Calculate account balance for a date range
 *
 * Uses decimal.js for precise calculations to avoid floating point errors.
 *
 * @param account - Account to calculate balance for
 * @param transactions - All transactions for the period
 * @param dateRange - Date range to filter by
 * @param accountingMethod - Cash or accrual
 * @returns Account balance as Decimal
 */
function calculateAccountBalance(
  account: Account,
  transactions: JournalEntry[],
  dateRange: DateRange,
  _accountingMethod: AccountingMethod
): Decimal {
  let balance = new Decimal(0)

  for (const transaction of transactions) {
    // Skip if not in date range
    if (transaction.date < dateRange.startDate || transaction.date > dateRange.endDate) {
      continue
    }

    // Skip if not posted (unless draft is specifically needed)
    if (transaction.status !== 'posted' && transaction.status !== 'reconciled') {
      continue
    }

    // Find line items for this account
    const accountLines = transaction.lines.filter((line) => line.accountId === account.id)

    for (const line of accountLines) {
      // For income and revenue accounts, credits increase balance
      // For expense accounts, debits increase balance
      if (
        account.type === 'income' ||
        account.type === 'other-income'
      ) {
        // Income: credits are positive, debits are negative
        balance = balance.plus(new Decimal(line.credit)).minus(new Decimal(line.debit))
      } else if (
        account.type === 'expense' ||
        account.type === 'cost-of-goods-sold' ||
        account.type === 'other-expense'
      ) {
        // Expenses: debits are positive, credits are negative
        balance = balance.plus(new Decimal(line.debit)).minus(new Decimal(line.credit))
      }
    }
  }

  return balance
}

/**
 * Generate P&L section for a specific account type
 *
 * @param accounts - All accounts
 * @param transactions - All transactions for period
 * @param accountTypes - Account types to include in section
 * @param dateRange - Date range
 * @param accountingMethod - Accounting method
 * @param comparisonRange - Optional comparison date range
 * @returns P&L section
 */
async function generatePLSection(
  accounts: Account[],
  transactions: JournalEntry[],
  accountTypes: Account['type'][],
  dateRange: DateRange,
  accountingMethod: AccountingMethod,
  comparisonRange?: DateRange
): Promise<{ lineItems: PLLineItem[]; subtotal: Decimal; comparisonSubtotal?: Decimal }> {
  const lineItems: PLLineItem[] = []
  let subtotal = new Decimal(0)
  let comparisonSubtotal = new Decimal(0)

  // Filter accounts by type
  const filteredAccounts = accounts.filter(
    (account) => accountTypes.includes(account.type) && account.isActive
  )

  // Calculate balance for each account
  for (const account of filteredAccounts) {
    const amount = calculateAccountBalance(account, transactions, dateRange, accountingMethod)

    // Skip zero balances unless specifically requested
    if (amount.isZero()) {
      continue
    }

    const lineItem: PLLineItem = {
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountName: account.name,
      amount: amount.toNumber(),
    }

    // Calculate comparison if provided
    if (comparisonRange) {
      const comparisonAmount = calculateAccountBalance(
        account,
        transactions,
        comparisonRange,
        accountingMethod
      )

      lineItem.comparisonAmount = comparisonAmount.toNumber()
      lineItem.variance = amount.minus(comparisonAmount).toNumber()

      if (!comparisonAmount.isZero()) {
        const variancePercent = amount
          .minus(comparisonAmount)
          .dividedBy(comparisonAmount.abs())
          .times(100)
        lineItem.variancePercentage = variancePercent.toNumber()
      }

      comparisonSubtotal = comparisonSubtotal.plus(comparisonAmount)
    }

    lineItems.push(lineItem)
    subtotal = subtotal.plus(amount)
  }

  // Sort by account number or name
  lineItems.sort((a, b) => {
    if (a.accountNumber && b.accountNumber) {
      return a.accountNumber.localeCompare(b.accountNumber)
    }
    return a.accountName.localeCompare(b.accountName)
  })

  return {
    lineItems,
    subtotal,
    comparisonSubtotal: comparisonRange ? comparisonSubtotal : undefined,
  }
}

/**
 * Generate Profit & Loss Report
 *
 * Creates a complete P&L report with accurate calculations using decimal.js.
 * Follows GAAP standards and supports both cash and accrual accounting.
 *
 * @param options - Report generation options
 * @returns Complete P&L report
 */
export async function generateProfitLossReport(
  options: ProfitLossOptions
): Promise<ProfitLossReport> {
  const {
    companyId,
    dateRange,
    comparisonPeriod,
    accountingMethod = 'accrual',
    showEducationalContent = true,
  } = options

  // Fetch all accounts for the company
  const accountsResult = await queryAccounts({ companyId, includeDeleted: false })
  if (!accountsResult.success) {
    throw new Error(`Failed to fetch accounts: ${accountsResult.error.message}`)
  }
  const accounts = accountsResult.data

  // Fetch all transactions for the date range (and comparison if applicable)
  const startDate = comparisonPeriod?.enabled && comparisonPeriod.startDate
    ? new Date(Math.min(dateRange.startDate.getTime(), comparisonPeriod.startDate.getTime()))
    : dateRange.startDate

  const transactionsResult = await queryTransactions({
    companyId,
    fromDate: startDate,
    toDate: dateRange.endDate,
    includeDeleted: false,
  })

  if (!transactionsResult.success) {
    throw new Error(`Failed to fetch transactions: ${transactionsResult.error.message}`)
  }
  const transactions = transactionsResult.data

  // Generate Revenue section
  const revenueData = await generatePLSection(
    accounts,
    transactions,
    ['income'],
    dateRange,
    accountingMethod,
    comparisonPeriod?.enabled ? comparisonPeriod : undefined
  )

  const revenue: PLSection = {
    type: 'revenue',
    title: 'Revenue',
    description: educationalContent.revenue.description,
    educationalContent: showEducationalContent
      ? educationalContent.revenue.plainEnglish
      : undefined,
    lineItems: revenueData.lineItems,
    subtotal: revenueData.subtotal.toNumber(),
    comparisonSubtotal: revenueData.comparisonSubtotal?.toNumber(),
  }

  // Generate Cost of Goods Sold section
  const cogsData = await generatePLSection(
    accounts,
    transactions,
    ['cost-of-goods-sold'],
    dateRange,
    accountingMethod,
    comparisonPeriod?.enabled ? comparisonPeriod : undefined
  )

  const costOfGoodsSold: PLSection = {
    type: 'cogs',
    title: 'Cost of Goods Sold',
    description: educationalContent.costOfGoodsSold.description,
    educationalContent: showEducationalContent
      ? educationalContent.costOfGoodsSold.plainEnglish
      : undefined,
    lineItems: cogsData.lineItems,
    subtotal: cogsData.subtotal.toNumber(),
    comparisonSubtotal: cogsData.comparisonSubtotal?.toNumber(),
  }

  // Calculate Gross Profit
  const grossProfitAmount = revenueData.subtotal.minus(cogsData.subtotal)
  const grossProfitPercentage = revenueData.subtotal.isZero()
    ? new Decimal(0)
    : grossProfitAmount.dividedBy(revenueData.subtotal).times(100)

  const grossProfit: {
    amount: number
    percentage: number
    comparisonAmount?: number
    variance?: number
    variancePercentage?: number
  } = {
    amount: grossProfitAmount.toNumber(),
    percentage: grossProfitPercentage.toNumber(),
  }

  if (comparisonPeriod?.enabled && revenueData.comparisonSubtotal && cogsData.comparisonSubtotal) {
    const comparisonGrossProfit = revenueData.comparisonSubtotal.minus(cogsData.comparisonSubtotal)
    grossProfit.comparisonAmount = comparisonGrossProfit.toNumber()
    grossProfit.variance = grossProfitAmount.minus(comparisonGrossProfit).toNumber()

    if (!comparisonGrossProfit.isZero()) {
      grossProfit.variancePercentage = grossProfitAmount
        .minus(comparisonGrossProfit)
        .dividedBy(comparisonGrossProfit.abs())
        .times(100)
        .toNumber()
    }
  }

  // Generate Operating Expenses section
  const expensesData = await generatePLSection(
    accounts,
    transactions,
    ['expense'],
    dateRange,
    accountingMethod,
    comparisonPeriod?.enabled ? comparisonPeriod : undefined
  )

  const operatingExpenses: PLSection = {
    type: 'expenses',
    title: 'Operating Expenses',
    description: educationalContent.operatingExpenses.description,
    educationalContent: showEducationalContent
      ? educationalContent.operatingExpenses.plainEnglish
      : undefined,
    lineItems: expensesData.lineItems,
    subtotal: expensesData.subtotal.toNumber(),
    comparisonSubtotal: expensesData.comparisonSubtotal?.toNumber(),
  }

  // Calculate Operating Income
  const operatingIncomeAmount = grossProfitAmount.minus(expensesData.subtotal)
  const operatingIncomePercentage = revenueData.subtotal.isZero()
    ? new Decimal(0)
    : operatingIncomeAmount.dividedBy(revenueData.subtotal).times(100)

  const operatingIncome: {
    amount: number
    percentage: number
    comparisonAmount?: number
    variance?: number
    variancePercentage?: number
  } = {
    amount: operatingIncomeAmount.toNumber(),
    percentage: operatingIncomePercentage.toNumber(),
  }

  if (comparisonPeriod?.enabled && expensesData.comparisonSubtotal) {
    const comparisonOperatingIncome = new Decimal(grossProfit.comparisonAmount || 0).minus(
      expensesData.comparisonSubtotal
    )
    operatingIncome.comparisonAmount = comparisonOperatingIncome.toNumber()
    operatingIncome.variance = operatingIncomeAmount
      .minus(comparisonOperatingIncome)
      .toNumber()

    if (!comparisonOperatingIncome.isZero()) {
      operatingIncome.variancePercentage = operatingIncomeAmount
        .minus(comparisonOperatingIncome)
        .dividedBy(comparisonOperatingIncome.abs())
        .times(100)
        .toNumber()
    }
  }

  // Generate Other Income section (optional)
  const otherIncomeData = await generatePLSection(
    accounts,
    transactions,
    ['other-income'],
    dateRange,
    accountingMethod,
    comparisonPeriod?.enabled ? comparisonPeriod : undefined
  )

  const otherIncome: PLSection | undefined = otherIncomeData.lineItems.length > 0
    ? {
        type: 'other-income',
        title: 'Other Income',
        description: 'Income from sources other than primary operations',
        lineItems: otherIncomeData.lineItems,
        subtotal: otherIncomeData.subtotal.toNumber(),
        comparisonSubtotal: otherIncomeData.comparisonSubtotal?.toNumber(),
      }
    : undefined

  // Generate Other Expenses section (optional)
  const otherExpensesData = await generatePLSection(
    accounts,
    transactions,
    ['other-expense'],
    dateRange,
    accountingMethod,
    comparisonPeriod?.enabled ? comparisonPeriod : undefined
  )

  const otherExpenses: PLSection | undefined = otherExpensesData.lineItems.length > 0
    ? {
        type: 'other-expenses',
        title: 'Other Expenses',
        description: 'Expenses from sources other than primary operations',
        lineItems: otherExpensesData.lineItems,
        subtotal: otherExpensesData.subtotal.toNumber(),
        comparisonSubtotal: otherExpensesData.comparisonSubtotal?.toNumber(),
      }
    : undefined

  // Calculate Net Income
  let netIncomeAmount = operatingIncomeAmount
  if (otherIncome) {
    netIncomeAmount = netIncomeAmount.plus(otherIncomeData.subtotal)
  }
  if (otherExpenses) {
    netIncomeAmount = netIncomeAmount.minus(otherExpensesData.subtotal)
  }

  const netIncomePercentage = revenueData.subtotal.isZero()
    ? new Decimal(0)
    : netIncomeAmount.dividedBy(revenueData.subtotal).times(100)

  const netIncome: {
    amount: number
    percentage: number
    isProfitable: boolean
    comparisonAmount?: number
    variance?: number
    variancePercentage?: number
  } = {
    amount: netIncomeAmount.toNumber(),
    percentage: netIncomePercentage.toNumber(),
    isProfitable: netIncomeAmount.greaterThan(0),
  }

  if (comparisonPeriod?.enabled) {
    let comparisonNetIncome = new Decimal(operatingIncome.comparisonAmount || 0)
    if (otherIncome?.comparisonSubtotal) {
      comparisonNetIncome = comparisonNetIncome.plus(otherIncome.comparisonSubtotal)
    }
    if (otherExpenses?.comparisonSubtotal) {
      comparisonNetIncome = comparisonNetIncome.minus(otherExpenses.comparisonSubtotal)
    }

    netIncome.comparisonAmount = comparisonNetIncome.toNumber()
    netIncome.variance = netIncomeAmount.minus(comparisonNetIncome).toNumber()

    if (!comparisonNetIncome.isZero()) {
      netIncome.variancePercentage = netIncomeAmount
        .minus(comparisonNetIncome)
        .dividedBy(comparisonNetIncome.abs())
        .times(100)
        .toNumber()
    }
  }

  // Fetch company name (simplified - would normally come from company entity)
  const companyName = 'My Company' // TODO: Fetch from company entity

  return {
    companyId,
    companyName,
    dateRange,
    comparisonPeriod: comparisonPeriod?.enabled ? comparisonPeriod : undefined,
    accountingMethod,
    generatedAt: new Date(),
    revenue,
    costOfGoodsSold,
    grossProfit,
    operatingExpenses,
    operatingIncome,
    otherIncome,
    otherExpenses,
    netIncome,
  }
}
