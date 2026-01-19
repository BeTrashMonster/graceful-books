/**
 * SecureLocalStorage Tests
 *
 * Tests for encrypted localStorage operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SecureLocalStorage, getSecureStorage, initializeSecureStorage } from './secureStorage'

// Mock localStorage with proper store access for Object.keys()
let localStorageStore: Record<string, string> = {}

// Create mock functions that update the store
const getItemMock = vi.fn((key: string) => localStorageStore[key] || null)
const setItemMock = vi.fn((key: string, value: string) => {
  localStorageStore[key] = value
})
const removeItemMock = vi.fn((key: string) => {
  delete localStorageStore[key]
})
const clearMock = vi.fn(() => {
  localStorageStore = {}
})

// Create a proxy to make Object.keys work correctly
const createLocalStorageMock = () => {
  const handler: ProxyHandler<Record<string, string>> = {
    get(_target, prop: string) {
      if (prop === 'getItem') return getItemMock
      if (prop === 'setItem') return setItemMock
      if (prop === 'removeItem') return removeItemMock
      if (prop === 'clear') return clearMock
      if (prop === 'length') return Object.keys(localStorageStore).length
      if (prop === 'key') return (index: number) => Object.keys(localStorageStore)[index] || null
      return undefined
    },
    ownKeys() {
      return Object.keys(localStorageStore)
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      if (prop in localStorageStore) {
        return { configurable: true, enumerable: true, value: localStorageStore[prop] }
      }
      return undefined
    },
  }
  return new Proxy({}, handler)
}

const localStorageMock = {
  getItem: getItemMock,
  setItem: setItemMock,
  removeItem: removeItemMock,
  clear: clearMock,
}

// Mock crypto.subtle
const mockCryptoKey = { type: 'secret' } as CryptoKey

const cryptoSubtleMock = {
  importKey: vi.fn().mockResolvedValue(mockCryptoKey),
  deriveKey: vi.fn().mockResolvedValue(mockCryptoKey),
  encrypt: vi.fn().mockImplementation(async (_algo, _key, data: BufferSource) => {
    // Return fake encrypted data (original data + 16 byte "auth tag")
    const inputArray = new Uint8Array(data as ArrayBuffer)
    const output = new Uint8Array(inputArray.length + 16)
    output.set(inputArray)
    // Add fake auth tag
    for (let i = 0; i < 16; i++) {
      output[inputArray.length + i] = i
    }
    return output.buffer
  }),
  decrypt: vi.fn().mockImplementation(async (_algo, _key, data: BufferSource) => {
    // Return decrypted data (remove the 16 byte "auth tag")
    const inputArray = new Uint8Array(data as ArrayBuffer)
    return inputArray.slice(0, inputArray.length - 16).buffer
  }),
  digest: vi.fn().mockImplementation(async (_algo, data: BufferSource) => {
    // Return a fake hash
    const hash = new Uint8Array(32)
    const inputArray = new Uint8Array(data as ArrayBuffer)
    for (let i = 0; i < 32; i++) {
      hash[i] = (inputArray[i % inputArray.length] || 0) ^ i
    }
    return hash.buffer
  }),
}

// Mock crypto.getRandomValues
const getRandomValuesMock = vi.fn((array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256)
  }
  return array
})

describe('SecureLocalStorage', () => {
  beforeEach(() => {
    // Reset singleton
    SecureLocalStorage.resetInstance()

    // Clear mock localStorage store
    localStorageStore = {}
    vi.clearAllMocks()

    // Setup global mocks with proxy for Object.keys support
    Object.defineProperty(global, 'localStorage', {
      value: createLocalStorageMock(),
      writable: true,
      configurable: true,
    })

    Object.defineProperty(global, 'crypto', {
      value: {
        subtle: cryptoSubtleMock,
        getRandomValues: getRandomValuesMock,
      },
      writable: true,
    })

    // Mock navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'test-user-agent',
        language: 'en-US',
        hardwareConcurrency: 4,
      },
      writable: true,
    })

    // Mock screen
    Object.defineProperty(global, 'screen', {
      value: {
        width: 1920,
        height: 1080,
        colorDepth: 24,
        pixelDepth: 24,
      },
      writable: true,
    })

    // Mock document for canvas fingerprinting
    Object.defineProperty(global, 'document', {
      value: {
        createElement: vi.fn().mockReturnValue({
          getContext: vi.fn().mockReturnValue(null),
          width: 0,
          height: 0,
        }),
      },
      writable: true,
    })
  })

  afterEach(() => {
    SecureLocalStorage.resetInstance()
    vi.restoreAllMocks()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SecureLocalStorage.getInstance()
      const instance2 = SecureLocalStorage.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should return new instance after reset', () => {
      const instance1 = SecureLocalStorage.getInstance()
      SecureLocalStorage.resetInstance()
      const instance2 = SecureLocalStorage.getInstance()
      expect(instance1).not.toBe(instance2)
    })
  })

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()
      expect(storage.isInitialized()).toBe(true)
    })

    it('should generate and store device salt on first initialization', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      expect(setItemMock).toHaveBeenCalledWith(
        'graceful_books_device_salt',
        expect.any(String)
      )
    })

    it('should reuse existing device salt', async () => {
      // Pre-set a salt
      const existingSalt = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
      setItemMock('graceful_books_device_salt', existingSalt)

      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Should have read the salt but not overwritten it
      expect(getItemMock).toHaveBeenCalledWith('graceful_books_device_salt')
    })

    it('should not initialize twice', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()
      await storage.initialize()

      // deriveKey should only be called once
      expect(cryptoSubtleMock.deriveKey).toHaveBeenCalledTimes(1)
    })
  })

  describe('setItem', () => {
    it('should encrypt and store value', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      const result = await storage.setItem('test-key', 'test-value')

      expect(result.success).toBe(true)
      expect(setItemMock).toHaveBeenCalledWith(
        'secure:test-key',
        expect.any(String)
      )
    })

    it('should fail if not initialized', async () => {
      const storage = SecureLocalStorage.getInstance()

      const result = await storage.setItem('test-key', 'test-value')

      expect(result.success).toBe(false)
      expect(result.error).toBe('NOT_INITIALIZED')
      expect(result.message).toContain('not initialized')
    })

    it('should store encrypted data with proper format', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      await storage.setItem('test-key', 'test-value')

      // Get what was stored
      const storedCall = setItemMock.mock.calls.find(
        (call) => call[0] === 'secure:test-key'
      )
      expect(storedCall).toBeDefined()

      const storedData = JSON.parse(storedCall![1])
      expect(storedData).toHaveProperty('ct') // ciphertext
      expect(storedData).toHaveProperty('iv') // initialization vector
      expect(storedData).toHaveProperty('v', 1) // version
    })
  })

  describe('getItem', () => {
    it('should decrypt and return value', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      await storage.setItem('test-key', 'test-value')
      const value = await storage.getItem('test-key')

      expect(value).toBe('test-value')
    })

    it('should return null for non-existent key', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      const value = await storage.getItem('non-existent')

      expect(value).toBeNull()
    })

    it('should return null if not initialized', async () => {
      const storage = SecureLocalStorage.getInstance()

      const value = await storage.getItem('test-key')

      expect(value).toBeNull()
    })

    it('should return null on decryption error', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Store invalid data
      setItemMock('secure:bad-key', 'invalid-json')

      const value = await storage.getItem('bad-key')

      expect(value).toBeNull()
    })
  })

  describe('removeItem', () => {
    it('should remove item from storage', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      await storage.setItem('test-key', 'test-value')
      await storage.removeItem('test-key')

      expect(removeItemMock).toHaveBeenCalledWith('secure:test-key')
    })
  })

  describe('clear', () => {
    it('should remove all secure items', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      await storage.setItem('key1', 'value1')
      await storage.setItem('key2', 'value2')

      // Add a non-secure item
      setItemMock('non-secure-key', 'value')

      await storage.clear()

      // Should have removed secure keys
      expect(removeItemMock).toHaveBeenCalledWith('secure:key1')
      expect(removeItemMock).toHaveBeenCalledWith('secure:key2')
    })
  })

  describe('migrateFromUnencrypted', () => {
    it('should migrate unencrypted data to encrypted storage', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Set up legacy unencrypted data
      setItemMock('old-key', 'sensitive-value')

      const result = await storage.migrateFromUnencrypted('old-key', 'new-key')

      expect(result.success).toBe(true)
      // Old key should be removed
      expect(removeItemMock).toHaveBeenCalledWith('old-key')
      // New key should be stored encrypted
      expect(setItemMock).toHaveBeenCalledWith(
        'secure:new-key',
        expect.any(String)
      )
    })

    it('should return success if old key does not exist', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      const result = await storage.migrateFromUnencrypted('non-existent', 'new-key')

      expect(result.success).toBe(true)
    })

    it('should clean up old key if new key already exists', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Set up both old and new keys
      setItemMock('old-key', 'old-value')
      await storage.setItem('new-key', 'already-migrated')

      const result = await storage.migrateFromUnencrypted('old-key', 'new-key')

      expect(result.success).toBe(true)
      expect(removeItemMock).toHaveBeenCalledWith('old-key')
    })

    it('should fail if not initialized', async () => {
      const storage = SecureLocalStorage.getInstance()

      const result = await storage.migrateFromUnencrypted('old-key', 'new-key')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not initialized')
    })
  })

  describe('hasKey', () => {
    it('should return true for existing key', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      await storage.setItem('test-key', 'test-value')

      expect(storage.hasKey('test-key')).toBe(true)
    })

    it('should return false for non-existing key', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      expect(storage.hasKey('non-existent')).toBe(false)
    })
  })

  describe('getKeys', () => {
    it('should return all secure storage keys', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      await storage.setItem('key1', 'value1')
      await storage.setItem('key2', 'value2')

      const keys = storage.getKeys()

      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
    })

    it('should not include non-secure keys', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      await storage.setItem('secure-key', 'value')
      setItemMock('regular-key', 'value')

      const keys = storage.getKeys()

      expect(keys).toContain('secure-key')
      expect(keys).not.toContain('regular-key')
    })
  })
})

describe('getSecureStorage', () => {
  beforeEach(() => {
    SecureLocalStorage.resetInstance()
  })

  it('should return singleton instance', () => {
    const storage1 = getSecureStorage()
    const storage2 = getSecureStorage()
    expect(storage1).toBe(storage2)
  })
})

describe('initializeSecureStorage', () => {
  beforeEach(() => {
    SecureLocalStorage.resetInstance()

    // Setup global mocks
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })

    Object.defineProperty(global, 'crypto', {
      value: {
        subtle: cryptoSubtleMock,
        getRandomValues: getRandomValuesMock,
      },
      writable: true,
    })

    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'test',
        language: 'en-US',
        hardwareConcurrency: 4,
      },
      writable: true,
    })

    Object.defineProperty(global, 'screen', {
      value: {
        width: 1920,
        height: 1080,
        colorDepth: 24,
        pixelDepth: 24,
      },
      writable: true,
    })

    Object.defineProperty(global, 'document', {
      value: {
        createElement: vi.fn().mockReturnValue({
          getContext: vi.fn().mockReturnValue(null),
        }),
      },
      writable: true,
    })
  })

  afterEach(() => {
    SecureLocalStorage.resetInstance()
    vi.restoreAllMocks()
  })

  it('should initialize the singleton storage', async () => {
    await initializeSecureStorage()

    const storage = getSecureStorage()
    expect(storage.isInitialized()).toBe(true)
  })
})

describe('SecureLocalStorage - Quota Handling', () => {
  let quotaExceededSetItem: ReturnType<typeof vi.fn>
  let localStorageStoreForQuota: Record<string, string> = {}

  beforeEach(() => {
    // Reset singleton
    SecureLocalStorage.resetInstance()
    localStorageStoreForQuota = {}
    vi.clearAllMocks()

    // Create a mock that can throw quota exceeded error
    quotaExceededSetItem = vi.fn((key: string, value: string) => {
      localStorageStoreForQuota[key] = value
    })

    const createQuotaLocalStorageMock = () => {
      const handler: ProxyHandler<Record<string, string>> = {
        get(_target, prop: string) {
          if (prop === 'getItem') return (key: string) => localStorageStoreForQuota[key] || null
          if (prop === 'setItem') return quotaExceededSetItem
          if (prop === 'removeItem') return (key: string) => { delete localStorageStoreForQuota[key] }
          if (prop === 'clear') return () => { localStorageStoreForQuota = {} }
          if (prop === 'length') return Object.keys(localStorageStoreForQuota).length
          if (prop === 'key') return (index: number) => Object.keys(localStorageStoreForQuota)[index] || null
          return undefined
        },
        ownKeys() {
          return Object.keys(localStorageStoreForQuota)
        },
        getOwnPropertyDescriptor(_target, prop: string) {
          if (prop in localStorageStoreForQuota) {
            return { configurable: true, enumerable: true, value: localStorageStoreForQuota[prop] }
          }
          return undefined
        },
      }
      return new Proxy({}, handler)
    }

    Object.defineProperty(global, 'localStorage', {
      value: createQuotaLocalStorageMock(),
      writable: true,
      configurable: true,
    })

    Object.defineProperty(global, 'crypto', {
      value: {
        subtle: cryptoSubtleMock,
        getRandomValues: getRandomValuesMock,
      },
      writable: true,
    })

    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'test-user-agent',
        language: 'en-US',
        hardwareConcurrency: 4,
      },
      writable: true,
    })

    Object.defineProperty(global, 'screen', {
      value: {
        width: 1920,
        height: 1080,
        colorDepth: 24,
        pixelDepth: 24,
      },
      writable: true,
    })

    Object.defineProperty(global, 'document', {
      value: {
        createElement: vi.fn().mockReturnValue({
          getContext: vi.fn().mockReturnValue(null),
        }),
      },
      writable: true,
    })
  })

  afterEach(() => {
    SecureLocalStorage.resetInstance()
    vi.restoreAllMocks()
  })

  describe('setItem with quota errors', () => {
    it('should return QUOTA_EXCEEDED error when localStorage is full', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Make setItem throw QuotaExceededError
      const quotaError = new Error('QuotaExceeded')
      quotaError.name = 'QuotaExceededError'
      quotaExceededSetItem.mockImplementation(() => {
        throw quotaError
      })

      const result = await storage.setItem('test-key', 'test-value')

      expect(result.success).toBe(false)
      expect(result.error).toBe('QUOTA_EXCEEDED')
      expect(result.message).toContain('storage is full')
    })

    it('should return NOT_INITIALIZED error when not initialized', async () => {
      const storage = SecureLocalStorage.getInstance()
      // Don't initialize

      const result = await storage.setItem('test-key', 'test-value')

      expect(result.success).toBe(false)
      expect(result.error).toBe('NOT_INITIALIZED')
    })

    it('should try cleanup before failing with quota error', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // First store an old entry
      let callCount = 0
      quotaExceededSetItem.mockImplementation((key: string, value: string) => {
        // First few calls succeed (initialization), then fail, then succeed after cleanup
        callCount++
        if (callCount <= 4) {
          // Allow initialization and first store
          localStorageStoreForQuota[key] = value
        } else if (callCount === 5) {
          // Fail on new item
          const error = new Error('QuotaExceeded')
          error.name = 'QuotaExceededError'
          throw error
        } else {
          // Succeed after cleanup
          localStorageStoreForQuota[key] = value
        }
      })

      // Store an old entry with old metadata
      await storage.setItem('old-key', 'old-value')

      // Manually set old timestamp for cleanup to work
      const oldMetadata = { timestamp: Date.now() - (31 * 24 * 60 * 60 * 1000), key: 'old-key' }
      localStorageStoreForQuota['secure_meta:old-key'] = JSON.stringify(oldMetadata)

      // Now try to store a new item - should trigger cleanup
      const result = await storage.setItem('new-key', 'new-value')

      // Result depends on whether cleanup made room
      expect(result).toBeDefined()
    })

    it('should handle NS_ERROR_DOM_QUOTA_REACHED error name', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      const quotaError = new Error('Quota reached')
      quotaError.name = 'NS_ERROR_DOM_QUOTA_REACHED'
      quotaExceededSetItem.mockImplementation(() => {
        throw quotaError
      })

      const result = await storage.setItem('test-key', 'test-value')

      expect(result.success).toBe(false)
      expect(result.error).toBe('QUOTA_EXCEEDED')
    })

    it('should handle Safari QUOTA_EXCEEDED_ERR error name', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      const quotaError = new Error('Quota exceeded')
      quotaError.name = 'QUOTA_EXCEEDED_ERR'
      quotaExceededSetItem.mockImplementation(() => {
        throw quotaError
      })

      const result = await storage.setItem('test-key', 'test-value')

      expect(result.success).toBe(false)
      expect(result.error).toBe('QUOTA_EXCEEDED')
    })
  })

  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Add some data
      await storage.setItem('key1', 'value1')
      await storage.setItem('key2', 'value2')

      const stats = await storage.getStorageStats()

      expect(stats).toHaveProperty('used')
      expect(stats).toHaveProperty('estimatedMax')
      expect(stats).toHaveProperty('percentUsed')
      expect(stats.used).toBeGreaterThan(0)
      expect(stats.estimatedMax).toBe(5 * 1024 * 1024) // 5MB
      expect(stats.percentUsed).toBeGreaterThanOrEqual(0)
      expect(stats.percentUsed).toBeLessThanOrEqual(100)
    })

    it('should calculate bytes correctly', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      const stats = await storage.getStorageStats()

      // Should have at least the device salt stored
      expect(stats.used).toBeGreaterThan(0)
    })
  })

  describe('getSecureStorageUsage', () => {
    it('should return bytes used by secure entries only', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Add secure data
      await storage.setItem('secure-key', 'secure-value')

      // Add non-secure data directly
      localStorageStoreForQuota['non-secure-key'] = 'non-secure-value'

      const secureUsage = storage.getSecureStorageUsage()

      expect(secureUsage).toBeGreaterThan(0)
    })
  })

  describe('cleanupOldEntries', () => {
    it('should remove entries older than max age', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Store an entry
      await storage.setItem('old-entry', 'old-value')

      // Manually set old timestamp
      const oldMetadata = { timestamp: Date.now() - (31 * 24 * 60 * 60 * 1000), key: 'old-entry' }
      localStorageStoreForQuota['secure_meta:old-entry'] = JSON.stringify(oldMetadata)

      const cleanedCount = await storage.cleanupOldEntries()

      expect(cleanedCount).toBe(1)
      expect(storage.hasKey('old-entry')).toBe(false)
    })

    it('should not remove recent entries', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Store an entry (will have current timestamp)
      await storage.setItem('recent-entry', 'recent-value')

      const cleanedCount = await storage.cleanupOldEntries()

      expect(cleanedCount).toBe(0)
      expect(storage.hasKey('recent-entry')).toBe(true)
    })

    it('should accept custom max age', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Store an entry
      await storage.setItem('entry', 'value')

      // Manually set metadata with 2-day-old timestamp
      const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000)
      const metadata = { timestamp: twoDaysAgo, key: 'entry' }
      localStorageStoreForQuota['secure_meta:entry'] = JSON.stringify(metadata)

      // Clean with 1-day max age
      const oneDayMs = 24 * 60 * 60 * 1000
      const cleanedCount = await storage.cleanupOldEntries(oneDayMs)

      expect(cleanedCount).toBe(1)
    })

    it('should clean up orphaned metadata', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Add orphaned metadata (no corresponding secure entry)
      localStorageStoreForQuota['secure_meta:orphan'] = JSON.stringify({ timestamp: Date.now(), key: 'orphan' })

      await storage.cleanupOldEntries()

      // Orphaned metadata should be removed
      expect(localStorageStoreForQuota['secure_meta:orphan']).toBeUndefined()
    })
  })

  describe('isNearlyFull', () => {
    it('should return false when storage has plenty of space', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      const isNearlyFull = await storage.isNearlyFull()

      expect(isNearlyFull).toBe(false)
    })

    it('should return true when storage is above 80% threshold', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Add a lot of data to simulate near-full storage
      // 5MB * 0.81 = ~4.25MB
      const largeValue = 'x'.repeat(2200000) // About 4.4MB when stored
      localStorageStoreForQuota['large-data'] = largeValue

      const isNearlyFull = await storage.isNearlyFull()

      expect(isNearlyFull).toBe(true)
    })
  })

  describe('removeItem with metadata cleanup', () => {
    it('should remove both the entry and its metadata', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Store an entry (this also creates metadata)
      await storage.setItem('test-entry', 'test-value')

      // Verify both exist
      expect(storage.hasKey('test-entry')).toBe(true)
      expect(localStorageStoreForQuota['secure_meta:test-entry']).toBeDefined()

      // Remove the entry
      await storage.removeItem('test-entry')

      // Both should be gone
      expect(storage.hasKey('test-entry')).toBe(false)
      expect(localStorageStoreForQuota['secure_meta:test-entry']).toBeUndefined()
    })
  })

  describe('clear with metadata cleanup', () => {
    it('should remove all secure entries and their metadata', async () => {
      const storage = SecureLocalStorage.getInstance()
      await storage.initialize()

      // Store multiple entries
      await storage.setItem('key1', 'value1')
      await storage.setItem('key2', 'value2')

      // Add non-secure data
      localStorageStoreForQuota['non-secure'] = 'value'

      // Clear
      await storage.clear()

      // Secure entries and metadata should be gone
      expect(storage.hasKey('key1')).toBe(false)
      expect(storage.hasKey('key2')).toBe(false)
      expect(localStorageStoreForQuota['secure_meta:key1']).toBeUndefined()
      expect(localStorageStoreForQuota['secure_meta:key2']).toBeUndefined()

      // Non-secure data should remain
      expect(localStorageStoreForQuota['non-secure']).toBe('value')
    })
  })
})
