/**
 * Vendor Type Definitions
 *
 * Types specific to vendor management functionality.
 * Vendors are contacts with type 'vendor' or 'both'.
 *
 * Per D5: Vendor Management - Basic [MVP]
 */

import type { Contact } from './index'

/**
 * Vendor is a specialized Contact type
 */
export type Vendor = Contact

/**
 * Vendor form data for create/update operations
 */
export interface VendorFormData {
  name: string
  email?: string
  phone?: string
  address?: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  taxId?: string
  is1099Eligible?: boolean
  notes?: string
  isActive: boolean
  // G3: Hierarchical Contacts fields
  parentId?: string | null
  accountType?: 'standalone' | 'parent' | 'child'
  hierarchyLevel?: number
}

/**
 * Vendor summary for reporting
 */
export interface VendorSummary extends Vendor {
  totalExpenses?: number
  totalTransactions?: number
  lastTransactionDate?: Date
  averageExpenseAmount?: number
}

/**
 * Vendor search result with relevance scoring
 */
export interface VendorSearchResult {
  vendor: Vendor
  relevanceScore: number
  matchedFields: string[]
}

/**
 * Vendor statistics for dashboard
 */
export interface VendorStats {
  totalVendors: number
  activeVendors: number
  inactiveVendors: number
  eligible1099Vendors: number
  totalSpend: number
  averageSpendPerVendor: number
}

/**
 * Vendor expense aggregation
 */
export interface VendorExpenseAggregation {
  vendorId: string
  vendorName: string
  totalAmount: number
  transactionCount: number
  firstTransactionDate: Date
  lastTransactionDate: Date
  averageAmount: number
}

/**
 * Duplicate vendor detection result
 */
export interface DuplicateVendorCheck {
  isDuplicate: boolean
  potentialDuplicates: Array<{
    vendor: Vendor
    similarityScore: number
    matchingFields: string[]
  }>
}
