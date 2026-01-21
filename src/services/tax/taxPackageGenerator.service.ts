/**
 * Tax Package Generator Service
 *
 * Generates complete tax packages including:
 * - Auto-generated financial reports (P&L, Balance Sheet, Cash Flow)
 * - Transaction CSV export
 * - Depreciation schedule (if assets exist)
 * - All uploaded documents
 * - Packaged as ZIP file
 *
 * Per ROADMAP J8 Tax Time Preparation Mode specification
 */

import JSZip from 'jszip'
import { format } from 'date-fns'
import { generateProfitLossReport } from '../reports/profitLoss'
import { generateBalanceSheet } from '../reports/balanceSheet'
import { generateBalanceSheetPDF, generateProfitLossPDF } from '../reports/pdfExport'
import { db } from '../../db'
import { getTaxDocuments } from './taxDocumentManager.service'
import type { TaxYear, TaxPackage } from '../../types/tax.types'
import type { Transaction } from '../../types/database.types'

/**
 * Generate complete tax package as ZIP file
 */
export async function generateTaxPackage(
  userId: string,
  taxYear: TaxYear,
  companyName?: string
): Promise<{ blob: Blob; package: TaxPackage }> {
  const zip = new JSZip()

  // Create folders
  const reportsFolder = zip.folder('reports')
  const documentsFolder = zip.folder('documents')

  if (!reportsFolder || !documentsFolder) {
    throw new Error('Failed to create ZIP folder structure')
  }

  // 1. Generate P&L Report
  const startDate = new Date(`${taxYear}-01-01`)
  const endDate = new Date(`${taxYear}-12-31`)

  const plReport = await generateProfitLossReport({
    companyId: companyId,
    dateRange: {
      startDate: startDate,
      endDate: endDate,
    },
    accountingMethod: 'accrual', // Default to accrual for tax purposes
  })

  const plPDF = await generateProfitLossPDF(plReport, companyName)
  reportsFolder.file('Profit_Loss_Statement.pdf', plPDF)

  // 2. Generate Balance Sheet
  const balanceSheet = await generateBalanceSheet(endDate as any)
  const bsPDF = await generateBalanceSheetPDF(balanceSheet as any, companyName)
  reportsFolder.file('Balance_Sheet.pdf', bsPDF)

  // 3. Generate Transaction CSV
  const transactions = await db.transactions
    .where('date')
    .between(startDate.toISOString(), endDate.toISOString(), true, true)
    .toArray()

  const transactionCSV = generateTransactionCSV(transactions)
  reportsFolder.file('Transactions.csv', transactionCSV)

  // 4. Generate Depreciation Schedule (if assets exist)
  const depreciationSchedule = await generateDepreciationSchedule(userId, taxYear)
  if (depreciationSchedule) {
    reportsFolder.file('Depreciation_Schedule.pdf', depreciationSchedule)
  }

  // 5. Add all uploaded tax documents
  const taxDocuments = await getTaxDocuments(userId, taxYear)
  for (const doc of taxDocuments) {
    // Extract base64 data from data URL
    const base64Data = doc.fileData.split(',')[1]
    const categoryFolder = documentsFolder.folder(doc.categoryId)
    if (categoryFolder) {
      categoryFolder.file(doc.fileName, base64Data, { base64: true })
    }
  }

  // 6. Generate README with instructions
  const readme = generateReadme(companyName || 'Your Business', taxYear)
  zip.file('README.txt', readme)

  // Generate ZIP blob
  const blob = await zip.generateAsync({ type: 'blob' })

  // Create package record
  const taxPackage: TaxPackage = {
    id: crypto.randomUUID(),
    userId,
    taxYear,
    generatedAt: new Date().toISOString(),
    documents: taxDocuments,
    reports: {
      profitLoss: plPDF,
      balanceSheet: bsPDF,
      transactionCSV: new Blob([transactionCSV], { type: 'text/csv' }),
      depreciationSchedule: depreciationSchedule || undefined,
    },
    notes: '',
  }

  // Save package record to database
  await db.taxPackages.add(taxPackage)

  return { blob, package: taxPackage }
}

/**
 * Generate transaction CSV export
 */
function generateTransactionCSV(transactions: Transaction[]): string {
  const headers = [
    'Date',
    'Description',
    'Type',
    'Status',
    'Account',
    'Debit',
    'Credit',
    'Memo',
  ]

  const rows = [headers.join(',')]

  for (const transaction of transactions) {
    for (const line of transaction.lines!) {
      const row = [
        format(new Date(transaction.date), 'yyyy-MM-dd'),
        `"${transaction.description.replace(/"/g, '""')}"`,
        transaction.type,
        transaction.status,
        line.accountId,
        line.debit.toString(),
        line.credit.toString(),
        `"${(line.memo || '').replace(/"/g, '""')}"`,
      ]
      rows.push(row.join(','))
    }
  }

  return rows.join('\n')
}

/**
 * Generate depreciation schedule
 * TODO: Implement based on asset purchases and depreciation method
 */
async function generateDepreciationSchedule(
  userId: string,
  taxYear: TaxYear
): Promise<Blob | null> {
  // Check if user has any assets eligible for depreciation
  const assetPurchases = await db.taxDocuments
    .where({ userId, taxYear, categoryId: 'asset-purchases' })
    .toArray()

  if (assetPurchases.length === 0) {
    return null
  }

  // Generate simple depreciation schedule
  // In production, this would calculate actual depreciation based on purchase date,
  // cost, useful life, and method (straight-line, MACRS, etc.)
  const schedule = `DEPRECIATION SCHEDULE - ${taxYear}

This is a placeholder for the depreciation schedule.
Please work with your tax professional to calculate proper depreciation
for the ${assetPurchases.length} asset purchase(s) you uploaded.

Assets requiring depreciation analysis:
${assetPurchases.map((doc, i) => `${i + 1}. ${doc.fileName}`).join('\n')}

Note: Depreciation calculation requires:
- Asset cost basis
- Date placed in service
- Useful life (years)
- Depreciation method (straight-line, MACRS, etc.)
- Section 179 election (if applicable)

Consult your CPA for proper depreciation calculation.
`

  return new Blob([schedule], { type: 'text/plain' })
}

/**
 * Generate README file for tax package
 */
function generateReadme(companyName: string, taxYear: TaxYear): string {
  return `TAX PREPARATION PACKAGE
${companyName} - ${taxYear} Tax Year

Generated on: ${format(new Date(), 'MMMM d, yyyy')}

This package contains everything your tax preparer needs:

REPORTS/ (Auto-generated from your books)
  - Profit_Loss_Statement.pdf
  - Balance_Sheet.pdf
  - Transactions.csv (all transactions for the year)
  - Depreciation_Schedule.pdf (if applicable)

DOCUMENTS/ (Organized by category)
  - income-documents/ (1099s, K-1s, W-2s)
  - expense-receipts/ (Major purchases, business expenses)
  - mileage-log/ (Business miles driven)
  - home-office/ (Square footage, expenses)
  - asset-purchases/ (Equipment, vehicles for depreciation)
  - bank-statements/ (Year-end statements)
  - prior-year-return/ (For reference)
  - other/ (Miscellaneous documents)

HOW TO USE THIS PACKAGE:

1. Review the reports to ensure all income and expenses are recorded
2. Check that all required documents are present
3. Send this entire ZIP file to your tax preparer
4. If using tax software (TurboTax, etc.), import the Transactions.csv

QUESTIONS?
Contact your tax professional or revisit your Graceful Books tax prep dashboard.

This package was generated by Graceful Books Tax Preparation Mode.
https://gracefulbooks.com
`
}

/**
 * Email tax package to accountant
 */
export async function emailTaxPackageToAccountant(
  packageId: string,
  accountantEmail: string,
  personalMessage?: string
): Promise<void> {
  const taxPackage = await db.taxPackages.get(packageId)
  if (!taxPackage) {
    throw new Error('Tax package not found')
  }

  // Generate ZIP blob
  const { blob } = await generateTaxPackage(
    taxPackage.userId,
    taxPackage.taxYear
  )

  // In production, this would use the IC4 email service
  // For now, we'll simulate the email send
  console.log('Email tax package to:', accountantEmail)
  console.log('Personal message:', personalMessage)
  console.log('Package size:', blob.size, 'bytes')

  // TODO: Integrate with IC4 email service
  // await emailService.sendTaxPackage({
  //   to: accountantEmail,
  //   subject: `Tax Preparation Package - ${taxPackage.taxYear}`,
  //   body: personalMessage || 'Please find attached my tax preparation package.',
  //   attachments: [{ filename: `Tax_Package_${taxPackage.taxYear}.zip`, blob }]
  // })
}

/**
 * Share tax package with advisor (J7 integration)
 */
export async function shareTaxPackageWithAdvisor(
  clientUserId: string,
  advisorUserId: string,
  taxYear: TaxYear,
  expirationDate?: Date
): Promise<void> {
  // Grant advisor "tax season" access
  const access = {
    id: crypto.randomUUID(),
    clientUserId,
    advisorUserId,
    taxYear,
    grantedAt: new Date().toISOString(),
    expiresAt: expirationDate?.toISOString() || new Date(`${taxYear}-04-30`).toISOString(),
    status: 'active' as const,
    reviewStatus: 'pending' as const,
  }

  await db.taxAdvisorAccess.add(access)

  // TODO: Send IC4 email notification to advisor (Template 5)
  console.log(`Tax season access granted to advisor ${advisorUserId} for client ${clientUserId}`)
}

/**
 * Check if advisor has access to client's tax package
 */
export async function hasAdvisorAccess(
  advisorUserId: string,
  clientUserId: string,
  taxYear: TaxYear
): Promise<boolean> {
  const access = await db.taxAdvisorAccess
    .where({ advisorUserId, clientUserId, taxYear })
    .first()

  if (!access || access.status !== 'active') {
    return false
  }

  // Check if expired
  if (access.expiresAt) {
    const expirationDate = new Date(access.expiresAt)
    if (expirationDate < new Date()) {
      // Auto-expire access
      await db.taxAdvisorAccess.update(access.id!, { status: 'expired' })
      return false
    }
  }

  return true
}

/**
 * Revoke advisor access to tax package
 */
export async function revokeAdvisorAccess(
  clientUserId: string,
  advisorUserId: string,
  taxYear: TaxYear
): Promise<void> {
  const access = await db.taxAdvisorAccess
    .where({ advisorUserId, clientUserId, taxYear })
    .first()

  if (access) {
    await db.taxAdvisorAccess.update(access.id!, { status: 'revoked' })
  }
}
