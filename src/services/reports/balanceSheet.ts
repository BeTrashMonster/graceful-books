/**
 * Balance Sheet Calculation Service
 *
 * Generates balance sheet reports with:
 * - Account balance calculation as of specific date
 * - Asset/Liability/Equity section organization
 * - Current vs. long-term classification
 * - Balance equation validation (Assets = Liabilities + Equity)
 * - Educational content integration
 */

import Decimal from 'decimal.js'
import type { Account, AccountType } from '../../types'
import type {
  BalanceSheetData,
  BalanceSheetSectionData,
  BalanceSheetLine,
  ReportFilter,
  ReportCalculationResult,
  BalanceSheetEducation,
  AccountClassification,
} from '../../types/reports.types'
import { queryAccounts } from '../../store/accounts'
import { queryTransactions } from '../../store/transactions'

/**
 * Calculate account balance as of a specific date
 *
 * Uses double-entry accounting principles:
 * - Assets: Debit increases, Credit decreases
 * - Liabilities: Credit increases, Debit decreases
 * - Equity: Credit increases, Debit decreases
 */
export async function calculateAccountBalance(
  accountId: string,
  asOfDate: Date,
  companyId: string
): Promise<Decimal> {
  // Get all posted transactions for this account up to the date
  const transactionsResult = await queryTransactions({
    companyId,
    accountId,
    status: 'posted',
    toDate: asOfDate,
  })

  if (!transactionsResult.success) {
    return new Decimal(0)
  }

  const transactions = transactionsResult.data

  // Get account to determine type
  const accountResult = await queryAccounts({ companyId })
  if (!accountResult.success) {
    return new Decimal(0)
  }

  const account = accountResult.data.find((a) => a.id === accountId)
  if (!account) {
    return new Decimal(0)
  }

  // Calculate balance based on debits and credits
  let balance = new Decimal(0)

  for (const transaction of transactions) {
    // Filter to transactions on or before the as-of date
    if (transaction.date > asOfDate) {
      continue
    }

    // Find lines for this account
    const lines = transaction.lines.filter((line) => line.accountId === accountId)

    for (const line of lines) {
      const debit = new Decimal(line.debit)
      const credit = new Decimal(line.credit)

      // Apply accounting equation rules
      if (isDebitAccount(account.type)) {
        // Assets, Expenses, COGS: Debit increases, Credit decreases
        balance = balance.plus(debit).minus(credit)
      } else {
        // Liabilities, Equity, Income: Credit increases, Debit decreases
        balance = balance.plus(credit).minus(debit)
      }
    }
  }

  return balance
}

/**
 * Determine if account type increases with debits
 */
function isDebitAccount(accountType: AccountType): boolean {
  return accountType === 'asset' || accountType === 'expense' || accountType === 'cost-of-goods-sold'
}

/**
 * Classify account as current or long-term
 *
 * Current assets/liabilities: Expected to be converted to cash or settled within one year
 * Long-term: Beyond one year
 */
function classifyAccount(account: Account): AccountClassification {
  const currentKeywords = [
    'cash',
    'checking',
    'savings',
    'receivable',
    'inventory',
    'prepaid',
    'payable',
    'accrued',
    'unearned',
    'short-term',
  ]

  const longTermKeywords = [
    'equipment',
    'building',
    'vehicle',
    'furniture',
    'land',
    'patent',
    'trademark',
    'loan',
    'mortgage',
    'bond',
    'long-term',
    'note',
  ]

  const nameLower = account.name.toLowerCase()
  const subTypeLower = account.subType?.toLowerCase() || ''

  // Check for long-term indicators first
  for (const keyword of longTermKeywords) {
    if (nameLower.includes(keyword) || subTypeLower.includes(keyword)) {
      return 'long-term'
    }
  }

  // Check for current indicators
  for (const keyword of currentKeywords) {
    if (nameLower.includes(keyword) || subTypeLower.includes(keyword)) {
      return 'current'
    }
  }

  // Default classification based on account type
  if (account.type === 'asset' || account.type === 'liability') {
    return 'current' // Conservative default
  }

  return 'current'
}

/**
 * Build hierarchical account tree with balances
 */
async function buildAccountTree(
  accounts: Account[],
  balances: Map<string, Decimal>,
  _asOfDate: Date
): Promise<BalanceSheetLine[]> {
  const lines: BalanceSheetLine[] = []

  // Separate parent accounts and sub-accounts
  const parentAccounts = accounts.filter((a) => !a.parentAccountId)
  const subAccountsMap = new Map<string, Account[]>()

  for (const account of accounts) {
    if (account.parentAccountId) {
      const existing = subAccountsMap.get(account.parentAccountId) || []
      existing.push(account)
      subAccountsMap.set(account.parentAccountId, existing)
    }
  }

  // Build tree recursively
  function addAccountToTree(account: Account, level: number) {
    const balance = balances.get(account.id) || new Decimal(0)
    const subAccounts = subAccountsMap.get(account.id) || []

    // Add parent account line
    lines.push({
      accountId: account.id,
      accountName: account.name,
      accountNumber: account.accountNumber,
      balance: balance.toNumber(),
      classification: classifyAccount(account),
      isSubAccount: level > 0,
      parentAccountId: account.parentAccountId,
      level,
    })

    // Add sub-accounts
    for (const subAccount of subAccounts.sort((a, b) =>
      a.accountNumber && b.accountNumber
        ? a.accountNumber.localeCompare(b.accountNumber)
        : a.name.localeCompare(b.name)
    )) {
      addAccountToTree(subAccount, level + 1)
    }
  }

  // Add all parent accounts
  for (const account of parentAccounts.sort((a, b) =>
    a.accountNumber && b.accountNumber
      ? a.accountNumber.localeCompare(b.accountNumber)
      : a.name.localeCompare(b.name)
  )) {
    addAccountToTree(account, 0)
  }

  return lines
}

/**
 * Generate complete balance sheet
 */
export async function generateBalanceSheet(
  filter: ReportFilter
): Promise<ReportCalculationResult<BalanceSheetData>> {
  try {
    const { companyId, asOfDate = new Date(), includeZeroBalances = false } = filter

    // Get all accounts
    const accountsResult = await queryAccounts({
      companyId,
      isActive: true,
    })

    if (!accountsResult.success) {
      return {
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: 'Failed to retrieve accounts',
          details: accountsResult.error,
        },
      }
    }

    const allAccounts = accountsResult.data

    // Separate accounts by type
    const assetAccounts = allAccounts.filter((a) => a.type === 'asset')
    const liabilityAccounts = allAccounts.filter((a) => a.type === 'liability')
    const equityAccounts = allAccounts.filter((a) => a.type === 'equity')

    // Get income and expense accounts for net income calculation
    const incomeAccounts = allAccounts.filter((a) =>
      a.type === 'income' || a.type === 'other-income'
    )
    const expenseAccounts = allAccounts.filter((a) =>
      a.type === 'expense' || a.type === 'cost-of-goods-sold' || a.type === 'other-expense'
    )

    // Calculate balances for all accounts
    const balanceMap = new Map<string, Decimal>()

    for (const account of allAccounts) {
      const balance = await calculateAccountBalance(account.id, asOfDate, companyId)
      balanceMap.set(account.id, balance)
    }

    // Calculate rollup balances for parent accounts (sum of sub-accounts)
    const rollupBalances = new Map<string, Decimal>()
    for (const account of allAccounts) {
      if (account.parentAccountId) {
        const balance = balanceMap.get(account.id) || new Decimal(0)
        const currentRollup = rollupBalances.get(account.parentAccountId) || new Decimal(0)
        rollupBalances.set(account.parentAccountId, currentRollup.plus(balance))
      }
    }

    // Update balances with rollup values for parent accounts
    for (const account of allAccounts) {
      if (!account.parentAccountId) {
        // This is a potential parent account
        const directBalance = balanceMap.get(account.id) || new Decimal(0)
        const rollupBalance = rollupBalances.get(account.id) || new Decimal(0)
        const totalBalance = directBalance.plus(rollupBalance)
        balanceMap.set(account.id, totalBalance)
      }
    }

    // Filter out zero balances if requested
    const filterAccounts = (accounts: Account[]) => {
      if (includeZeroBalances) {
        return accounts
      }
      return accounts.filter((a) => {
        const balance = balanceMap.get(a.id) || new Decimal(0)
        return !balance.isZero()
      })
    }

    // Build sections
    const assetsLines = await buildAccountTree(
      filterAccounts(assetAccounts),
      balanceMap,
      asOfDate
    )

    const liabilitiesLines = await buildAccountTree(
      filterAccounts(liabilityAccounts),
      balanceMap,
      asOfDate
    )

    const equityLines = await buildAccountTree(
      filterAccounts(equityAccounts),
      balanceMap,
      asOfDate
    )

    // Calculate totals using Decimal for precision
    const totalAssets = assetsLines.reduce(
      (sum, line) => sum.plus(new Decimal(line.balance)),
      new Decimal(0)
    )

    const totalLiabilities = liabilitiesLines.reduce(
      (sum, line) => sum.plus(new Decimal(line.balance)),
      new Decimal(0)
    )

    const totalEquity = equityLines.reduce(
      (sum, line) => sum.plus(new Decimal(line.balance)),
      new Decimal(0)
    )

    // Calculate net income (Revenue - Expenses)
    // Income accounts: credit balances (positive values)
    // Expense accounts: debit balances (positive values)
    // Net income = Total Income - Total Expenses
    const totalIncome = incomeAccounts.reduce((sum, account) => {
      const balance = balanceMap.get(account.id) || new Decimal(0)
      return sum.plus(balance)
    }, new Decimal(0))

    const totalExpenses = expenseAccounts.reduce((sum, account) => {
      const balance = balanceMap.get(account.id) || new Decimal(0)
      return sum.plus(balance)
    }, new Decimal(0))

    const netIncome = totalIncome.minus(totalExpenses)

    // Add net income to equity (this represents retained earnings/current period income)
    const totalEquityWithIncome = totalEquity.plus(netIncome)
    const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquityWithIncome)

    // Check if balanced (Assets = Liabilities + Equity)
    const balanceDifference = totalAssets.minus(totalLiabilitiesAndEquity)
    const isBalanced = balanceDifference.abs().lessThan(new Decimal(0.01))

    // Build section data
    const assets: BalanceSheetSectionData = {
      title: 'Assets',
      plainEnglishTitle: 'What You Own',
      description: 'Resources owned by your business that have economic value.',
      lines: assetsLines,
      total: totalAssets.toNumber(),
    }

    const liabilities: BalanceSheetSectionData = {
      title: 'Liabilities',
      plainEnglishTitle: 'What You Owe',
      description: 'Obligations and debts your business owes to others.',
      lines: liabilitiesLines,
      total: totalLiabilities.toNumber(),
    }

    const equity: BalanceSheetSectionData = {
      title: 'Equity',
      plainEnglishTitle: "What's Left Over",
      description: "The owner's stake in the business after all debts are paid.",
      lines: equityLines,
      total: totalEquity.toNumber(),
    }

    const balanceSheetData: BalanceSheetData = {
      companyId,
      asOfDate,
      generatedAt: new Date(),
      assets,
      liabilities,
      equity,
      totalAssets: totalAssets.toNumber(),
      totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toNumber(),
      isBalanced,
      balanceDifference: balanceDifference.toNumber(),
    }

    return {
      success: true,
      data: balanceSheetData,
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'CALCULATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error during calculation',
        details: error,
      },
    }
  }
}

/**
 * Get educational content for balance sheet
 */
export function getBalanceSheetEducation(): BalanceSheetEducation {
  return {
    overview: {
      title: 'Understanding Your Balance Sheet',
      shortDescription: 'A snapshot of what you own and owe at a specific moment in time.',
      longDescription:
        'The balance sheet is like a financial snapshot of your business. It shows what you own (assets), what you owe (liabilities), and what remains for you as the owner (equity). This report always balances because of the fundamental accounting equation: Assets = Liabilities + Equity.',
      examples: [
        'If you have $10,000 in the bank (asset) and owe $3,000 on a loan (liability), your equity is $7,000.',
        'Buying equipment with cash: Cash (asset) decreases, Equipment (asset) increases - total assets stay the same.',
      ],
      whyItMatters:
        'The balance sheet helps you understand your business financial health and net worth at any given time.',
    },
    assets: {
      title: 'Assets - What You Own',
      shortDescription: 'Everything your business owns that has value.',
      longDescription:
        'Assets are resources your business controls that can provide future economic benefits. They include cash, money customers owe you, inventory, equipment, vehicles, and property. Assets are typically organized by how quickly they can be converted to cash: current assets (within a year) and long-term assets (beyond a year).',
      examples: [
        'Current: Cash, bank accounts, accounts receivable, inventory',
        'Long-term: Equipment, vehicles, buildings, land, patents',
      ],
      whyItMatters:
        'Assets represent what your business can use to generate revenue and grow. The more productive assets you have, the stronger your business foundation.',
    },
    liabilities: {
      title: 'Liabilities - What You Owe',
      shortDescription: 'All debts and obligations your business must pay.',
      longDescription:
        'Liabilities are amounts your business owes to others. They include bills you need to pay, loans, credit card balances, and money you owe to suppliers. Like assets, liabilities are organized by when they need to be paid: current liabilities (within a year) and long-term liabilities (beyond a year).',
      examples: [
        'Current: Accounts payable, credit cards, short-term loans, accrued expenses',
        'Long-term: Mortgages, equipment loans, bonds, long-term notes',
      ],
      whyItMatters:
        "Liabilities show your business obligations. Managing them well ensures you can pay your bills on time and maintain good relationships with creditors. Too much debt relative to assets can signal financial stress.",
    },
    equity: {
      title: "Equity - What's Left Over",
      shortDescription: "The owner's stake in the business after paying all debts.",
      longDescription:
        "Equity represents the owner's residual interest in the business. It's what would be left if you sold all assets and paid off all liabilities. Equity increases when you invest money in the business or when the business makes a profit. It decreases when you take money out or when the business has losses.",
      examples: [
        "Owner's capital: Initial investment plus additional contributions",
        'Retained earnings: Accumulated profits kept in the business',
        'Draws: Money taken out by owners (decreases equity)',
      ],
      whyItMatters:
        'Equity shows the true value of your ownership stake. Growing equity means your business is building value over time.',
    },
    balancingEquation: {
      title: 'The Balance Sheet Equation',
      shortDescription: 'Assets = Liabilities + Equity',
      longDescription:
        'The balance sheet always balances because of the fundamental accounting equation. Everything your business owns (assets) is either owed to creditors (liabilities) or belongs to you (equity). If you have $50,000 in assets, $20,000 in liabilities, your equity must be $30,000. This equation is always true for every business.',
      examples: [
        'Starting a business: You invest $10,000 cash. Assets = $10,000, Equity = $10,000, Liabilities = $0',
        'Taking a loan: Borrow $5,000. Assets = $15,000, Liabilities = $5,000, Equity = $10,000',
      ],
      whyItMatters:
        'Understanding this equation helps you see how every financial decision affects your business. Taking on debt increases assets and liabilities. Making a profit increases assets and equity.',
    },
  }
}
