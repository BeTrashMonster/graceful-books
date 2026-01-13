/**
 * useAccounts Hook
 *
 * React hook for managing Chart of Accounts operations.
 * Provides CRUD operations with encryption support and real-time updates.
 *
 * Features:
 * - Create, read, update, delete accounts
 * - Real-time updates with Dexie React Hooks
 * - Hierarchical account tree structure
 * - Account validation
 * - Soft delete with tombstone markers
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo } from 'react'
import {
  createAccount,
  getAccount,
  updateAccount,
  deleteAccount,
  queryAccounts,
  getAccountsHierarchy,
  batchCreateAccounts,
} from '../store/accounts'
import type { Account } from '../types'
import type {
  AccountFilter,
  DatabaseResult,
  BatchResult,
} from '../store/types'

/**
 * Account query options
 */
export interface UseAccountsOptions {
  companyId?: string
  type?: Account['type']
  isActive?: boolean
  parentAccountId?: string | null
  includeDeleted?: boolean
}

/**
 * Account tree node for hierarchical display
 */
export interface AccountTreeNode {
  id: string
  companyId: string
  name: string
  accountNumber?: string
  type: Account['type']
  subType?: Account['subType']
  parentAccountId?: string
  description?: string
  isActive: boolean
  balance: number
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
  children: AccountTreeNode[]
  level: number
  path: string[]
}

/**
 * Hook return type
 */
export interface UseAccountsReturn {
  // Data
  accounts: Account[]
  isLoading: boolean

  // CRUD Operations
  create: (
    account: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'balance'>
  ) => Promise<DatabaseResult<Account>>
  get: (id: string) => Promise<DatabaseResult<Account>>
  update: (
    id: string,
    updates: Partial<Omit<Account, 'id' | 'companyId' | 'createdAt'>>
  ) => Promise<DatabaseResult<Account>>
  remove: (id: string) => Promise<DatabaseResult<void>>

  // Batch Operations
  batchCreate: (
    accounts: Array<Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'balance'>>
  ) => Promise<BatchResult<Account>>

  // Query Operations
  getHierarchy: () => Promise<DatabaseResult<Account[]>>
  buildTree: (accounts: Account[]) => AccountTreeNode[]

  // Utility
  refresh: () => void
}

/**
 * Build hierarchical tree structure from flat account list
 */
function buildAccountTree(accounts: Account[]): AccountTreeNode[] {
  const accountMap = new Map<string, AccountTreeNode>()
  const rootAccounts: AccountTreeNode[] = []

  // First pass: Create tree nodes
  accounts.forEach(account => {
    accountMap.set(account.id, {
      ...account,
      children: [],
      level: 0,
      path: [account.id],
    })
  })

  // Second pass: Build hierarchy
  accounts.forEach(account => {
    const node = accountMap.get(account.id)!

    if (account.parentAccountId) {
      const parent = accountMap.get(account.parentAccountId)
      if (parent) {
        node.level = parent.level + 1
        node.path = [...parent.path, account.id]
        parent.children.push(node)
      } else {
        // Parent not found, treat as root
        rootAccounts.push(node)
      }
    } else {
      rootAccounts.push(node)
    }
  })

  // Sort children recursively
  function sortChildren(nodes: AccountTreeNode[]): void {
    nodes.sort((a, b) => {
      // Sort by account number first, then name
      if (a.accountNumber && b.accountNumber) {
        return a.accountNumber.localeCompare(b.accountNumber)
      }
      return a.name.localeCompare(b.name)
    })

    nodes.forEach(node => {
      if (node.children.length > 0) {
        sortChildren(node.children)
      }
    })
  }

  sortChildren(rootAccounts)

  return rootAccounts
}

/**
 * useAccounts Hook
 *
 * @param options - Query options to filter accounts
 * @returns Account management operations
 *
 * @example
 * ```tsx
 * const { accounts, create, update, remove } = useAccounts({
 *   companyId: 'company-123',
 *   isActive: true
 * })
 *
 * // Create a new account
 * await create({
 *   companyId: 'company-123',
 *   name: 'Cash',
 *   type: 'asset',
 *   isActive: true
 * })
 * ```
 */
export function useAccounts(options: UseAccountsOptions = {}): UseAccountsReturn {
  const {
    companyId,
    type,
    isActive,
    parentAccountId,
    includeDeleted = false,
  } = options

  // Build filter object
  const filter: AccountFilter = useMemo(
    () => ({
      companyId,
      type,
      isActive,
      parentAccountId: parentAccountId === null ? undefined : parentAccountId,
      includeDeleted,
    }),
    [companyId, type, isActive, parentAccountId, includeDeleted]
  )

  // Use live query for real-time updates
  const accounts = useLiveQuery(async () => {
    const result = await queryAccounts(filter)
    return result?.success ? result.data : []
  }, [filter], [])

  const isLoading = accounts === undefined

  // Create account
  const create = useCallback(
    async (
      account: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'balance'>
    ) => {
      return await createAccount(account)
    },
    []
  )

  // Get account by ID
  const get = useCallback(async (id: string) => {
    return await getAccount(id)
  }, [])

  // Update account
  const update = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Account, 'id' | 'companyId' | 'createdAt'>>
    ) => {
      return await updateAccount(id, updates)
    },
    []
  )

  // Delete account (soft delete)
  const remove = useCallback(async (id: string) => {
    return await deleteAccount(id)
  }, [])

  // Batch create accounts
  const batchCreate = useCallback(
    async (
      accountList: Array<Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'balance'>>
    ) => {
      return await batchCreateAccounts(accountList)
    },
    []
  )

  // Get accounts hierarchy
  const getHierarchy = useCallback(async (): Promise<DatabaseResult<Account[]>> => {
    if (!companyId) {
      return {
        success: false as const,
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Company ID is required for hierarchy',
        },
      }
    }
    return await getAccountsHierarchy(companyId)
  }, [companyId])

  // Build tree structure
  const buildTree = useCallback((accountList: Account[]) => {
    return buildAccountTree(accountList)
  }, [])

  // Refresh - force re-query (useLiveQuery handles this automatically)
  const refresh = useCallback(() => {
    // useLiveQuery automatically refreshes when dependencies change
    // This is a no-op but provided for API consistency
  }, [])

  return {
    accounts: accounts || [],
    isLoading,
    create,
    get,
    update,
    remove,
    batchCreate,
    getHierarchy,
    buildTree,
    refresh,
  }
}
