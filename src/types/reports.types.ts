/**
 * Report Types and Interfaces
 *
 * Defines types for financial reports including Balance Sheet and P&L.
 * All monetary amounts are stored as numbers (using decimal.js for calculations).
 */

import type { AccountType, AccountingMethod } from './index'

/**
 * Date range for report filtering
 */
export interface DateRange {
  startDate: Date
  endDate: Date
  preset?: DateRangePreset
  label?: string
}

/**
 * Predefined date range options
 */
export type DateRangePreset =
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'last-quarter'
  | 'this-year'
  | 'last-year'
  | 'year-to-date'
  | 'custom'

/**
 * Comparison period configuration
 */
export interface ComparisonPeriod {
  enabled: boolean
  type: 'previous-period' | 'previous-year' | 'custom'
  startDate?: Date
  endDate?: Date
  label?: string
}

/**
 * Report period type
 */
export type ReportPeriod = 'current' | 'year-to-date' | 'custom'

/**
 * Balance Sheet section types
 */
export type BalanceSheetSection = 'assets' | 'liabilities' | 'equity'

/**
 * Balance Sheet account classification
 */
export type AccountClassification = 'current' | 'long-term'

/**
 * Balance Sheet line item
 */
export interface BalanceSheetLine {
  accountId: string
  accountName: string
  accountNumber?: string
  balance: number
  classification?: AccountClassification
  isSubAccount: boolean
  parentAccountId?: string
  level: number
}

/**
 * Balance Sheet section data
 */
export interface BalanceSheetSectionData {
  title: string
  plainEnglishTitle: string
  description: string
  lines: BalanceSheetLine[]
  total: number
}

/**
 * Complete Balance Sheet data
 */
export interface BalanceSheetData {
  companyId: string
  asOfDate: Date
  generatedAt: Date
  assets: BalanceSheetSectionData
  liabilities: BalanceSheetSectionData
  equity: BalanceSheetSectionData
  totalAssets: number
  totalLiabilitiesAndEquity: number
  isBalanced: boolean
  balanceDifference: number
}

/**
 * Report filter options
 */
export interface ReportFilter {
  companyId: string
  asOfDate?: Date
  startDate?: Date
  endDate?: Date
  includeInactive?: boolean
  includeZeroBalances?: boolean
}

/**
 * Report export format
 */
export type ReportExportFormat = 'pdf' | 'csv' | 'json'

/**
 * Report export options
 */
export interface ReportExportOptions {
  format: ReportExportFormat
  filename?: string
  includeMetadata?: boolean
  landscape?: boolean
}

/**
 * Educational content for report sections
 */
export interface ReportEducationalContent {
  title: string
  shortDescription: string
  longDescription: string
  examples?: string[]
  whyItMatters: string
}

/**
 * Balance Sheet educational content
 */
export interface BalanceSheetEducation {
  overview: ReportEducationalContent
  assets: ReportEducationalContent
  liabilities: ReportEducationalContent
  equity: ReportEducationalContent
  balancingEquation: ReportEducationalContent
}

/**
 * Report calculation result
 */
export interface ReportCalculationResult<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Account balance as of date
 */
export interface AccountBalance {
  accountId: string
  accountName: string
  accountNumber?: string
  accountType: AccountType
  balance: number
  asOfDate: Date
  parentAccountId?: string
  isActive: boolean
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  reportType: 'balance-sheet' | 'profit-loss' | 'cash-flow'
  companyId: string
  companyName?: string
  generatedAt: Date
  generatedBy: string
  asOfDate?: Date
  startDate?: Date
  endDate?: Date
}

// =============================================================================
// Profit & Loss Report Types
// =============================================================================

/**
 * P&L section type
 */
export type PLSectionType = 'revenue' | 'cogs' | 'expenses' | 'other-income' | 'other-expenses'

/**
 * Individual line item in a P&L report
 */
export interface PLLineItem {
  accountId: string
  accountNumber?: string
  accountName: string
  amount: number
  percentage?: number
  comparisonAmount?: number
  variance?: number
  variancePercentage?: number
}

/**
 * P&L section (e.g., Revenue, Expenses)
 */
export interface PLSection {
  type: PLSectionType
  title: string
  description: string
  educationalContent?: string
  lineItems: PLLineItem[]
  subtotal: number
  comparisonSubtotal?: number
  variance?: number
  variancePercentage?: number
}

/**
 * Complete P&L report data
 */
export interface ProfitLossReport {
  companyId: string
  companyName: string
  dateRange: DateRange
  comparisonPeriod?: ComparisonPeriod
  accountingMethod: AccountingMethod
  generatedAt: Date

  // Revenue section
  revenue: PLSection

  // Cost of Goods Sold
  costOfGoodsSold: PLSection

  // Gross Profit
  grossProfit: {
    amount: number
    percentage: number
    comparisonAmount?: number
    variance?: number
    variancePercentage?: number
  }

  // Operating Expenses
  operatingExpenses: PLSection

  // Operating Income
  operatingIncome: {
    amount: number
    percentage: number
    comparisonAmount?: number
    variance?: number
    variancePercentage?: number
  }

  // Other Income/Expenses
  otherIncome?: PLSection
  otherExpenses?: PLSection

  // Net Income
  netIncome: {
    amount: number
    percentage: number
    comparisonAmount?: number
    variance?: number
    variancePercentage?: number
    isProfitable: boolean
  }
}

/**
 * P&L specific options
 */
export interface ProfitLossOptions {
  companyId: string
  dateRange: DateRange
  comparisonPeriod?: ComparisonPeriod
  accountingMethod?: AccountingMethod
  showEducationalContent?: boolean
  includeZeroBalances?: boolean
  groupBy?: 'account' | 'category'
  includeSubAccounts?: boolean
}

/**
 * "What does this mean?" educational content
 */
export interface WhatDoesThisMean {
  revenue: string
  costOfGoodsSold: string
  grossProfit: string
  operatingExpenses: string
  operatingIncome: string
  netIncome: string
  profitable: string
  loss: string
}

// =============================================================================
// PDF Export Types
// =============================================================================

/**
 * PDF export options
 */
export interface PDFExportOptions {
  includeCompanyLogo?: boolean
  includeEducationalContent?: boolean
  includeComparison?: boolean
  pageSize?: 'letter' | 'a4'
  orientation?: 'portrait' | 'landscape'
  title?: string
  subtitle?: string
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean
  format: ReportExportFormat
  blob?: Blob
  filename?: string
  error?: string
}

/**
 * AR Aging Report Types
 * TODO: Complete implementation for F5 - A/R Aging Report
 */

export type ARAgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'

export const ARAgingBucketLabels: Record<ARAgingBucket, { formal: string; friendly: string }> = {
  'current': { formal: 'Current', friendly: 'Not due yet' },
  '1-30': { formal: '1-30 days', friendly: 'Just a bit overdue' },
  '31-60': { formal: '31-60 days', friendly: 'Getting older' },
  '61-90': { formal: '61-90 days', friendly: 'Needs attention' },
  '90+': { formal: '90+ days', friendly: 'Time for a friendly nudge' },
}

export interface ARAgingBucketData {
  bucket: ARAgingBucket
  label: string
  friendlyLabel: string
  amount: number
  invoiceCount: number
  invoices: any[]
}

export interface CustomerARAging {
  customerId: string
  customerName: string
  totalOwed: number
  buckets: Record<ARAgingBucket, ARAgingBucketData>
  oldestInvoiceDate?: number
  oldestInvoiceDays?: number
}

export interface FollowUpRecommendation {
  customerId: string
  customerName: string
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  message: string
  suggestedAction: string
  amount: number
  daysOverdue: number
}

export interface ARAgingReportOptions {
  companyId: string
  asOfDate?: number
  includeZeroBalances?: boolean
  sortBy?: 'customer' | 'amount' | 'days'
  sortOrder?: 'asc' | 'desc'
}

export interface ARAgingReport {
  generatedAt: number
  asOfDate: number
  companyId: string
  totalReceivables: number
  buckets: Record<ARAgingBucket, ARAgingBucketData>
  customers: CustomerARAging[]
  recommendations: FollowUpRecommendation[]
  summary: {
    totalCustomers: number
    customersOverdue: number
    percentOverdue: number
    averageDaysOverdue: number
  }
}

/**
 * Email Follow-Up Template Types
 * TODO: Complete implementation for email automation
 */

export interface EmailFollowUpTemplateContent {
  subject: string
  body: string
  variables: Record<string, string>
}

export interface EmailFollowUpTemplate {
  id: string
  name: string
  description?: string
  triggerDays: number
  content: EmailFollowUpTemplateContent
  active: boolean
  createdAt: number
  updatedAt: number
}

/**
 * Balance Sheet Report type
 * TODO: Extend BalanceSheetData with report-specific metadata
 */
export interface BalanceSheetReport extends BalanceSheetData {
  generatedAt?: number
  companyId?: string
  reportPeriod?: ReportPeriod
}
