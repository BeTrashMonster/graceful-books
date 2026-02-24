/**
 * useCustomers Hook
 *
 * React hook for managing customer operations.
 * Provides CRUD operations with encryption support and real-time updates.
 *
 * Features:
 * - Create, read, update, delete customers
 * - Real-time updates with Dexie React Hooks
 * - Customer search and filter
 * - Soft delete with tombstone markers
 *
 * Per ACCT-002: Customer Management
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
import { useAuth } from '../contexts/AuthContext'
import type { Contact } from '../types'
import type {
  ContactFilter,
  DatabaseResult,
  BatchResult,
} from '../store/types'

/**
 * Customer query options
 */
export interface UseCustomersOptions {
  companyId?: string
  isActive?: boolean
  includeDeleted?: boolean
}

/**
 * Hook return type
 */
export interface UseCustomersReturn {
  // Data
  customers: Contact[]
  isLoading: boolean

  // CRUD Operations
  create: (
    customer: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ) => Promise<DatabaseResult<Contact>>
  get: (id: string) => Promise<DatabaseResult<Contact>>
  update: (
    id: string,
    updates: Partial<Omit<Contact, 'id' | 'companyId' | 'createdAt'>>
  ) => Promise<DatabaseResult<Contact>>
  remove: (id: string) => Promise<DatabaseResult<void>>

  // Batch Operations
  batchCreate: (
    customers: Array<Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
  ) => Promise<BatchResult<Contact>>

  // Utility
  search: (query: string) => Contact[]
  refresh: () => void
}

/**
 * Search customers by name, email, phone, or address
 */
function searchCustomers(customers: Contact[], query: string): Contact[] {
  if (!query.trim()) return customers

  const term = query.toLowerCase()
  return customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(term) ||
      customer.email?.toLowerCase().includes(term) ||
      customer.phone?.includes(term) ||
      customer.address?.line1?.toLowerCase().includes(term) ||
      customer.address?.city?.toLowerCase().includes(term) ||
      customer.notes?.toLowerCase().includes(term)
  )
}

/**
 * useCustomers Hook
 *
 * @param options - Query options to filter customers
 * @returns Customer management operations
 *
 * @example
 * ```tsx
 * const { customers, create, update, remove } = useCustomers({
 *   companyId: 'company-123',
 *   isActive: true
 * })
 *
 * // Create a new customer
 * await create({
 *   companyId: 'company-123',
 *   type: 'customer',
 *   name: 'Acme Corporation',
 *   email: 'contact@acme.com',
 *   isActive: true
 * })
 * ```
 */
export function useCustomers(options: UseCustomersOptions = {}): UseCustomersReturn {
  const { companyId: authCompanyId } = useAuth()

  const {
    companyId: optionsCompanyId,
    isActive,
    includeDeleted = false,
  } = options

  // Use companyId from options if provided, otherwise use auth companyId
  const companyId = optionsCompanyId || authCompanyId

  // Build filter object (without companyId since it's now a required parameter)
  const filter = useMemo(
    () => ({
      type: 'customer' as const, // Only get customers
      isActive,
      includeDeleted,
    }),
    [isActive, includeDeleted]
  )

  // Use live query for real-time updates
  const customers = useLiveQuery(async () => {
    // SECURITY: Guard against missing companyId
    if (!companyId) {
      return []
    }
    const result = await queryContacts(companyId, filter)
    return result?.success ? result.data : []
  }, [companyId, filter], [])

  const isLoading = customers === undefined

  // Create customer
  const create = useCallback(
    async (
      customer: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
    ) => {
      // Ensure type is 'customer'
      const customerData = {
        ...customer,
        type: 'customer' as const,
      }
      return await createContact(customerData)
    },
    []
  )

  // Get customer by ID
  const get = useCallback(async (id: string) => {
    // SECURITY: Require companyId for authorization
    if (!companyId) {
      return {
        success: false as const,
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Not authenticated - companyId required',
        },
      }
    }
    return await getContact(id, companyId)
  }, [companyId])

  // Update customer
  const update = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Contact, 'id' | 'companyId' | 'createdAt'>>
    ) => {
      // SECURITY: Require companyId for authorization
      if (!companyId) {
        return {
          success: false as const,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: 'Not authenticated - companyId required',
          },
        }
      }
      return await updateContact(id, companyId, updates)
    },
    [companyId]
  )

  // Delete customer (soft delete)
  const remove = useCallback(async (id: string) => {
    // SECURITY: Require companyId for authorization
    if (!companyId) {
      return {
        success: false as const,
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Not authenticated - companyId required',
        },
      }
    }
    return await deleteContact(id, companyId)
  }, [companyId])

  // Batch create customers
  const batchCreate = useCallback(
    async (
      customerList: Array<Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
    ) => {
      // Ensure all have type 'customer'
      const customersData = customerList.map(customer => ({
        ...customer,
        type: 'customer' as const,
      }))
      return await batchCreateContacts(customersData)
    },
    []
  )

  // Search customers
  const search = useCallback(
    (query: string) => {
      return searchCustomers(customers || [], query)
    },
    [customers]
  )

  // Refresh - force re-query (useLiveQuery handles this automatically)
  const refresh = useCallback(() => {
    // useLiveQuery automatically refreshes when dependencies change
    // This is a no-op but provided for API consistency
  }, [])

  return {
    customers: customers || [],
    isLoading,
    create,
    get,
    update,
    remove,
    batchCreate,
    search,
    refresh,
  }
}
