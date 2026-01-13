/**
 * Tests for useAccounts Hook
 *
 * Tests account CRUD operations, hierarchical tree building, and error handling
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAccounts } from './useAccounts'
import type { Account } from '../types'
import * as accountStore from '../store/accounts'

// Mock the account store
vi.mock('../store/accounts', () => ({
  createAccount: vi.fn(),
  getAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  queryAccounts: vi.fn(),
  getAccountsHierarchy: vi.fn(),
  batchCreateAccounts: vi.fn(),
}))

// Mock dexie-react-hooks
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((queryFn) => {
    // Execute the query function immediately for tests
    const result = queryFn()
    if (result instanceof Promise) {
      // Return empty array for initial render
      return []
    }
    return result
  }),
}))

describe('useAccounts Hook', () => {
  const mockCompanyId = 'company-123'

  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      companyId: mockCompanyId,
      name: 'Cash',
      accountNumber: '1000',
      type: 'asset',
      isActive: true,
      balance: 10000,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'acc-2',
      companyId: mockCompanyId,
      name: 'Accounts Receivable',
      accountNumber: '1200',
      type: 'asset',
      isActive: true,
      balance: 5000,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'acc-3',
      companyId: mockCompanyId,
      name: 'Petty Cash',
      accountNumber: '1010',
      type: 'asset',
      parentAccountId: 'acc-1',
      isActive: true,
      balance: 500,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with empty accounts', () => {
      const { result } = renderHook(() => useAccounts())

      expect(result.current.accounts).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it('should accept query options', () => {
      const { result } = renderHook(() =>
        useAccounts({
          companyId: mockCompanyId,
          isActive: true,
        })
      )

      expect(result.current.accounts).toBeDefined()
    })
  })

  describe('create operation', () => {
    it('should create a new account', async () => {
      const newAccount: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'balance'> = {
        companyId: mockCompanyId,
        name: 'New Account',
        accountNumber: '2000',
        type: 'liability',
        isActive: true,
      }

      const createdAccount: Account = {
        ...newAccount,
        id: 'acc-new',
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(accountStore.createAccount).mockResolvedValue({
        success: true,
        data: createdAccount,
      })

      const { result } = renderHook(() => useAccounts())

      const response = await result.current.create(newAccount)

      expect(response.success).toBe(true)
      if (response.success) {
        expect(response.data.name).toBe('New Account')
        expect(response.data.type).toBe('liability')
      }
      expect(accountStore.createAccount).toHaveBeenCalledWith(newAccount)
    })

    it('should handle create errors', async () => {
      const newAccount: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'balance'> = {
        companyId: mockCompanyId,
        name: 'Invalid Account',
        type: 'asset',
        isActive: true,
      }

      vi.mocked(accountStore.createAccount).mockResolvedValue({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Account validation failed',
        },
      })

      const { result } = renderHook(() => useAccounts())

      const response = await result.current.create(newAccount)

      expect(response.success).toBe(false)
      if (!response.success) {
        expect(response.error.code).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('get operation', () => {
    it('should get account by ID', async () => {
      const mockAccount = mockAccounts[0]!

      vi.mocked(accountStore.getAccount).mockResolvedValue({
        success: true,
        data: mockAccount,
      })

      const { result } = renderHook(() => useAccounts())

      const response = await result.current.get('acc-1')

      expect(response.success).toBe(true)
      if (response.success) {
        expect(response.data.id).toBe('acc-1')
        expect(response.data.name).toBe('Cash')
      }
      expect(accountStore.getAccount).toHaveBeenCalledWith('acc-1')
    })

    it('should handle account not found', async () => {
      vi.mocked(accountStore.getAccount).mockResolvedValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found',
        },
      })

      const { result } = renderHook(() => useAccounts())

      const response = await result.current.get('non-existent')

      expect(response.success).toBe(false)
      if (!response.success) {
        expect(response.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('update operation', () => {
    it('should update an account', async () => {
      const updates = { name: 'Updated Cash Account' }
      const updatedAccount: Account = {
        ...mockAccounts[0]!,
        name: 'Updated Cash Account',
        updatedAt: new Date(),
      }

      vi.mocked(accountStore.updateAccount).mockResolvedValue({
        success: true,
        data: updatedAccount,
      })

      const { result } = renderHook(() => useAccounts())

      const response = await result.current.update('acc-1', updates)

      expect(response.success).toBe(true)
      if (response.success) {
        expect(response.data.name).toBe('Updated Cash Account')
      }
      expect(accountStore.updateAccount).toHaveBeenCalledWith('acc-1', updates)
    })

    it('should handle update errors', async () => {
      vi.mocked(accountStore.updateAccount).mockResolvedValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found',
        },
      })

      const { result } = renderHook(() => useAccounts())

      const response = await result.current.update('non-existent', { name: 'New Name' })

      expect(response.success).toBe(false)
    })
  })

  describe('remove operation', () => {
    it('should delete an account', async () => {
      vi.mocked(accountStore.deleteAccount).mockResolvedValue({
        success: true,
        data: undefined,
      })

      const { result } = renderHook(() => useAccounts())

      const response = await result.current.remove('acc-1')

      expect(response.success).toBe(true)
      expect(accountStore.deleteAccount).toHaveBeenCalledWith('acc-1')
    })

    it('should handle delete errors', async () => {
      vi.mocked(accountStore.deleteAccount).mockResolvedValue({
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot delete account with transactions',
        },
      })

      const { result } = renderHook(() => useAccounts())

      const response = await result.current.remove('acc-1')

      expect(response.success).toBe(false)
      if (!response.success) {
        expect(response.error.code).toBe('CONSTRAINT_VIOLATION')
      }
    })
  })

  describe('batch operations', () => {
    it('should batch create multiple accounts', async () => {
      const newAccounts = [
        {
          companyId: mockCompanyId,
          name: 'Account 1',
          type: 'asset' as const,
          isActive: true,
        },
        {
          companyId: mockCompanyId,
          name: 'Account 2',
          type: 'liability' as const,
          isActive: true,
        },
      ]

      vi.mocked(accountStore.batchCreateAccounts).mockResolvedValue({
        successful: [
          { ...newAccounts[0]!, id: 'acc-4', balance: 0, createdAt: new Date(), updatedAt: new Date() },
          { ...newAccounts[1]!, id: 'acc-5', balance: 0, createdAt: new Date(), updatedAt: new Date() },
        ],
        failed: [],
      })

      const { result } = renderHook(() => useAccounts())

      const response = await result.current.batchCreate(newAccounts)

      expect(response.successful).toHaveLength(2)
      expect(response.failed).toHaveLength(0)
    })

    it('should handle partial batch failures', async () => {
      const newAccounts = [
        {
          companyId: mockCompanyId,
          name: 'Valid Account',
          type: 'asset' as const,
          isActive: true,
        },
        {
          companyId: mockCompanyId,
          name: 'Invalid Account',
          type: 'asset' as const,
          isActive: true,
        },
      ]

      vi.mocked(accountStore.batchCreateAccounts).mockResolvedValue({
        successful: [
          { ...newAccounts[0]!, id: 'acc-6', balance: 0, createdAt: new Date(), updatedAt: new Date() },
        ],
        failed: [
          {
            item: { ...newAccounts[1]!, id: '', balance: 0, createdAt: new Date(), updatedAt: new Date() },
            error: { code: 'VALIDATION_ERROR', message: 'Validation failed' },
          },
        ],
      })

      const { result } = renderHook(() => useAccounts())

      const response = await result.current.batchCreate(newAccounts)

      expect(response.successful).toHaveLength(1)
      expect(response.failed).toHaveLength(1)
    })
  })

  describe('hierarchy operations', () => {
    it('should get accounts hierarchy', async () => {
      vi.mocked(accountStore.getAccountsHierarchy).mockResolvedValue({
        success: true,
        data: mockAccounts,
      })

      const { result } = renderHook(() => useAccounts({ companyId: mockCompanyId }))

      const response = await result.current.getHierarchy()

      expect(response.success).toBe(true)
      if (response.success) {
        expect(response.data).toHaveLength(3)
      }
      expect(accountStore.getAccountsHierarchy).toHaveBeenCalledWith(mockCompanyId)
    })

    it('should require company ID for hierarchy', async () => {
      const { result } = renderHook(() => useAccounts())

      const response = await result.current.getHierarchy()

      expect(response.success).toBe(false)
      if (!response.success) {
        expect(response.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should build tree structure from flat accounts', () => {
      const { result } = renderHook(() => useAccounts())

      const tree = result.current.buildTree(mockAccounts)

      expect(tree).toHaveLength(2) // Two root accounts (Cash and AR)
      expect(tree[0]!.name).toBe('Cash')
      expect(tree[0]!.children).toHaveLength(1) // Cash has one sub-account
      expect(tree[0]!.children![0]!.name).toBe('Petty Cash')
      expect(tree[0]!.children![0]!.level).toBe(1)
    })

    it('should handle accounts with no parent', () => {
      const flatAccounts: Account[] = [
        {
          id: 'acc-1',
          companyId: mockCompanyId,
          name: 'Root 1',
          type: 'asset',
          isActive: true,
          balance: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'acc-2',
          companyId: mockCompanyId,
          name: 'Root 2',
          type: 'liability',
          isActive: true,
          balance: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { result } = renderHook(() => useAccounts())

      const tree = result.current.buildTree(flatAccounts)

      expect(tree).toHaveLength(2)
      expect(tree[0]!.level).toBe(0)
      expect(tree[1]!.level).toBe(0)
    })

    it('should sort accounts by account number and name', () => {
      const unsortedAccounts: Account[] = [
        {
          id: 'acc-3',
          companyId: mockCompanyId,
          name: 'C Account',
          accountNumber: '3000',
          type: 'asset',
          isActive: true,
          balance: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'acc-1',
          companyId: mockCompanyId,
          name: 'A Account',
          accountNumber: '1000',
          type: 'asset',
          isActive: true,
          balance: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'acc-2',
          companyId: mockCompanyId,
          name: 'B Account',
          accountNumber: '2000',
          type: 'asset',
          isActive: true,
          balance: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { result } = renderHook(() => useAccounts())

      const tree = result.current.buildTree(unsortedAccounts)

      expect(tree[0]!.accountNumber).toBe('1000')
      expect(tree[1]!.accountNumber).toBe('2000')
      expect(tree[2]!.accountNumber).toBe('3000')
    })
  })

  describe('refresh operation', () => {
    it('should provide refresh function', () => {
      const { result } = renderHook(() => useAccounts())

      expect(typeof result.current.refresh).toBe('function')

      // Should not throw
      result.current.refresh()
    })
  })
})
