/**
 * Test Data Fixtures
 *
 * Helpers for creating test data for Group D workflows
 */

import { Page } from '@playwright/test'

/**
 * Create a test account via UI
 */
export async function createAccount(
  page: Page,
  accountData: {
    name: string
    accountNumber: string
    type: string
    description?: string
  }
): Promise<void> {
  await page.goto('/chart-of-accounts')
  await page.click('button:has-text("Add Account")')

  await page.fill('[name="name"]', accountData.name)
  await page.fill('[name="accountNumber"]', accountData.accountNumber)
  await page.selectOption('[name="type"]', accountData.type)

  if (accountData.description) {
    await page.fill('[name="description"]', accountData.description)
  }

  await page.click('button[type="submit"]')

  // Wait for success
  await page.waitForSelector('.success-message, [role="alert"]:has-text("created")', {
    timeout: 5000,
  })
}

/**
 * Create a test transaction
 */
export async function createTransaction(
  page: Page,
  transactionData: {
    date: string
    amount: number
    description: string
    account: string
  }
): Promise<void> {
  await page.goto('/transactions')
  await page.click('button:has-text("New Transaction")')

  await page.fill('[name="date"]', transactionData.date)
  await page.fill('[name="amount"]', transactionData.amount.toString())
  await page.fill('[name="description"]', transactionData.description)
  await page.selectOption('[name="account"]', transactionData.account)

  await page.click('button[type="submit"]')

  // Wait for save
  await page.waitForSelector('.success-message, [role="alert"]:has-text("saved")', {
    timeout: 3000,
  })
}

/**
 * Create a test vendor
 */
export async function createVendor(
  page: Page,
  vendorData: {
    name: string
    email?: string
    phone?: string
    address?: string
  }
): Promise<void> {
  await page.goto('/vendors')
  await page.click('button:has-text("Add Vendor")')

  await page.fill('[name="name"]', vendorData.name)

  if (vendorData.email) {
    await page.fill('[name="email"]', vendorData.email)
  }

  if (vendorData.phone) {
    await page.fill('[name="phone"]', vendorData.phone)
  }

  if (vendorData.address) {
    await page.fill('[name="address"]', vendorData.address)
  }

  await page.click('button[type="submit"]')

  // Wait for success
  await page.waitForSelector('.success-message, [role="alert"]:has-text("added")', {
    timeout: 5000,
  })
}

/**
 * Create a test customer
 */
export async function createCustomer(
  page: Page,
  customerData: {
    name: string
    email?: string
    phone?: string
  }
): Promise<void> {
  await page.goto('/customers')
  await page.click('button:has-text("Add Customer")')

  await page.fill('[name="name"]', customerData.name)

  if (customerData.email) {
    await page.fill('[name="email"]', customerData.email)
  }

  if (customerData.phone) {
    await page.fill('[name="phone"]', customerData.phone)
  }

  await page.click('button[type="submit"]')

  await page.waitForSelector('.success-message, [role="alert"]:has-text("added")', {
    timeout: 5000,
  })
}

/**
 * Upload a bank statement for reconciliation
 */
export async function uploadBankStatement(
  page: Page,
  accountId: string,
  statementData: {
    startingBalance: number
    endingBalance: number
    statementDate: string
    transactions: Array<{
      date: string
      description: string
      amount: number
    }>
  }
): Promise<void> {
  await page.goto(`/reconciliation?accountId=${accountId}`)

  // Enter statement details
  await page.fill('[name="startingBalance"]', statementData.startingBalance.toString())
  await page.fill('[name="endingBalance"]', statementData.endingBalance.toString())
  await page.fill('[name="statementDate"]', statementData.statementDate)

  // If CSV upload is supported, create and upload CSV
  // Otherwise, transactions will need to be entered manually
  await page.click('button:has-text("Continue"), button:has-text("Next")')
}

/**
 * Complete the COA wizard with minimal selections
 */
export async function quickSetupCOA(page: Page, industryTemplate: string): Promise<void> {
  // Should be on wizard welcome step
  await page.click('button:has-text("Get Started"), button:has-text("Next")')

  // Select industry template
  await page.click(`[data-template="${industryTemplate}"], button:has-text("${industryTemplate}")`)

  // Skip customization (use defaults)
  await page.click('button:has-text("Next"), button:has-text("Continue")')

  // Review and confirm
  await page.click('button:has-text("Create Accounts"), button:has-text("Confirm")')

  // Wait for completion
  await page.waitForSelector('[data-step="complete"], h2:has-text("All Set")', {
    timeout: 10000,
  })

  await page.click('button:has-text("Done"), button:has-text("Finish")')
}

/**
 * Generate sample transactions for testing reports
 */
export async function generateSampleTransactions(
  page: Page,
  count: number = 10
): Promise<void> {
  const transactions = []
  const today = new Date()

  for (let i = 0; i < count; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    transactions.push({
      date: date.toISOString().split('T')[0],
      amount: Math.floor(Math.random() * 1000) + 100,
      description: `Test Transaction ${i + 1}`,
      account: 'Revenue',
    })
  }

  // Create transactions one by one
  for (const transaction of transactions) {
    await createTransaction(page, transaction)
  }
}
