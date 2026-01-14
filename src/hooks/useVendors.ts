/**
 * useVendors Hook
 *
 * React hook for managing vendor operations.
 * Provides CRUD operations with encryption support and real-time updates.
 *
 * Features:
 * - Create, read, update, delete vendors
 * - Real-time updates with Dexie React Hooks
 * - Vendor search and filter
 * - Soft delete with tombstone markers
 * - Duplicate detection
 * - Vendor spending aggregation
 *
 * Per D5: Vendor Management - Basic [MVP]
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo } from 'react'
import {
  createContact,
  getContact,
  updateContact,
  deleteContact,
  queryContacts,
  batchCreateContacts,
} from '../store/contacts'
import type { Vendor, VendorFormData, DuplicateVendorCheck } from '../types/vendor.types'
import type {
  ContactFilter,
  DatabaseResult,
  BatchResult,
} from '../store/types'

/**
 * Vendor query options
 */
export interface UseVendorsOptions {
  companyId?: string
  isActive?: boolean
  includeDeleted?: boolean
  is1099Eligible?: boolean
}

/**
 * Hook return type
 */
export interface UseVendorsReturn {
  // Data
  vendors: Vendor[]
  isLoading: boolean

  // CRUD Operations
  create: (
    vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ) => Promise<DatabaseResult<Vendor>>
  get: (id: string) => Promise<DatabaseResult<Vendor>>
  update: (
    id: string,
    updates: Partial<Omit<Vendor, 'id' | 'companyId' | 'createdAt'>>
  ) => Promise<DatabaseResult<Vendor>>
  remove: (id: string) => Promise<DatabaseResult<void>>

  // Batch Operations
  batchCreate: (
    vendors: Array<Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
  ) => Promise<BatchResult<Vendor>>

  // Utility
  search: (query: string) => Vendor[]
  checkDuplicates: (vendor: VendorFormData) => DuplicateVendorCheck
  refresh: () => void
}

/**
 * Search vendors by name, email, phone, or address
 */
function searchVendors(vendors: Vendor[], query: string): Vendor[] {
  if (!query.trim()) return vendors

  const term = query.toLowerCase()
  return vendors.filter(
    (vendor) =>
      vendor.name.toLowerCase().includes(term) ||
      vendor.email?.toLowerCase().includes(term) ||
      vendor.phone?.includes(term) ||
      vendor.address?.line1?.toLowerCase().includes(term) ||
      vendor.address?.city?.toLowerCase().includes(term) ||
      vendor.notes?.toLowerCase().includes(term)
  )
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score between 0 (no match) and 1 (perfect match)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1.0

  const len1 = s1.length
  const len2 = s2.length

  if (len1 === 0 || len2 === 0) return 0

  const matrix: number[][] = []

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  const distance = matrix[len2][len1]
  const maxLen = Math.max(len1, len2)
  return 1 - distance / maxLen
}

/**
 * Check for duplicate vendors based on name, email, and phone
 */
function checkForDuplicates(
  vendors: Vendor[],
  newVendor: VendorFormData
): DuplicateVendorCheck {
  const potentialDuplicates: DuplicateVendorCheck['potentialDuplicates'] = []

  for (const vendor of vendors) {
    const matchingFields: string[] = []
    let totalScore = 0
    let fieldCount = 0

    // Check name similarity
    const nameSimilarity = calculateSimilarity(vendor.name, newVendor.name)
    // Use 0.80 threshold for high-confidence duplicate detection
    // Focus on obvious duplicates; edge cases handled via merge functionality
    if (nameSimilarity >= 0.80) {
      matchingFields.push('name')
      totalScore += nameSimilarity
      fieldCount++
    }

    // Email and phone are supplementary signals only if name already matches
    // They don't trigger duplicates on their own (per real-world usage patterns)
    if (matchingFields.includes('name')) {
      // Check exact email match to strengthen confidence
      if (
        newVendor.email &&
        vendor.email &&
        vendor.email.toLowerCase() === newVendor.email.toLowerCase()
      ) {
        matchingFields.push('email')
        totalScore += 1.0
        fieldCount++
      }

      // Check phone match to strengthen confidence
      if (newVendor.phone && vendor.phone) {
        const phone1 = vendor.phone.replace(/\D/g, '')
        const phone2 = newVendor.phone.replace(/\D/g, '')
        if (phone1 === phone2 && phone1.length >= 7) {
          matchingFields.push('phone')
          totalScore += 1.0
          fieldCount++
        }
      }
    }

    // If we have matches, calculate average similarity
    if (matchingFields.length > 0) {
      const similarityScore = totalScore / Math.max(fieldCount, 1)

      // High-confidence threshold (0.70) - focus on obvious duplicates
      // Edge cases like "Acme Corp" vs "Acme Corporation" handled via merge feature
      if (similarityScore >= 0.70) {
        potentialDuplicates.push({
          vendor,
          similarityScore,
          matchingFields,
        })
      }
    }
  }

  // Sort by similarity score (highest first)
  potentialDuplicates.sort((a, b) => b.similarityScore - a.similarityScore)

  return {
    isDuplicate: potentialDuplicates.length > 0,
    potentialDuplicates,
  }
}

/**
 * useVendors Hook
 *
 * @param options - Query options to filter vendors
 * @returns Vendor management operations
 *
 * @example
 * ```tsx
 * const { vendors, create, update, remove } = useVendors({
 *   companyId: 'company-123',
 *   isActive: true
 * })
 *
 * // Create a new vendor
 * await create({
 *   companyId: 'company-123',
 *   type: 'vendor',
 *   name: 'Office Supply Co',
 *   email: 'orders@officesupply.com',
 *   isActive: true
 * })
 * ```
 */
export function useVendors(options: UseVendorsOptions = {}): UseVendorsReturn {
  const {
    companyId,
    isActive,
    includeDeleted = false,
    is1099Eligible,
  } = options

  // Build filter object
  const filter: ContactFilter = useMemo(
    () => ({
      companyId,
      type: 'vendor', // Only get vendors
      isActive,
      includeDeleted,
    }),
    [companyId, isActive, includeDeleted]
  )

  // Use live query for real-time updates
  const allVendors = useLiveQuery(async () => {
    const result = await queryContacts(filter)
    return result?.success ? result.data : []
  }, [filter], [])

  // Apply additional filtering for 1099-eligible vendors
  const vendors = useMemo(() => {
    if (!allVendors) return []

    if (is1099Eligible !== undefined) {
      return allVendors.filter(vendor => vendor.is1099Eligible === is1099Eligible)
    }

    return allVendors
  }, [allVendors, is1099Eligible])

  const isLoading = allVendors === undefined

  // Create vendor
  const create = useCallback(
    async (
      vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
    ) => {
      // Ensure type is 'vendor'
      const vendorData = {
        ...vendor,
        type: 'vendor' as const,
      }
      return await createContact(vendorData)
    },
    []
  )

  // Get vendor by ID
  const get = useCallback(async (id: string) => {
    return await getContact(id)
  }, [])

  // Update vendor
  const update = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Vendor, 'id' | 'companyId' | 'createdAt'>>
    ) => {
      return await updateContact(id, updates)
    },
    []
  )

  // Delete vendor (soft delete)
  const remove = useCallback(async (id: string) => {
    return await deleteContact(id)
  }, [])

  // Batch create vendors
  const batchCreate = useCallback(
    async (
      vendorList: Array<Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
    ) => {
      // Ensure all have type 'vendor'
      const vendorsData = vendorList.map(vendor => ({
        ...vendor,
        type: 'vendor' as const,
      }))
      return await batchCreateContacts(vendorsData)
    },
    []
  )

  // Search vendors
  const search = useCallback(
    (query: string) => {
      return searchVendors(vendors || [], query)
    },
    [vendors]
  )

  // Check for duplicate vendors
  const checkDuplicates = useCallback(
    (vendor: VendorFormData): DuplicateVendorCheck => {
      return checkForDuplicates(vendors || [], vendor)
    },
    [vendors]
  )

  // Refresh - force re-query (useLiveQuery handles this automatically)
  const refresh = useCallback(() => {
    // useLiveQuery automatically refreshes when dependencies change
    // This is a no-op but provided for API consistency
  }, [])

  return {
    vendors: vendors || [],
    isLoading,
    create,
    get,
    update,
    remove,
    batchCreate,
    search,
    checkDuplicates,
    refresh,
  }
}
