/**
 * Tests for Receipts Store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  uploadReceipt,
  getReceipt,
  linkToTransaction,
  unlinkFromTransaction,
  deleteReceipt,
} from './receipts'
import { db } from './database'

// Mock the database
vi.mock('./database', () => ({
  db: {
    receipts: {
      add: vi.fn(),
      get: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
          and: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
      toCollection: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
        and: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })),
      update: vi.fn(),
    },
  },
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock FileReader
class FileReaderMock {
  result: string | null = null
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null

  readAsDataURL(_blob: Blob) {
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,mockImageData'
      if (this.onload) {
        this.onload.call(this as any, {} as ProgressEvent<FileReader>)
      }
    }, 0)
  }
}

global.FileReader = FileReaderMock as any

// Mock Image
class ImageMock {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 800
  height = 600
  private _src = ''

  get src(): string {
    return this._src
  }

  set src(value: string) {
    this._src = value
    setTimeout(() => {
      if (this.onload) {
        this.onload()
      }
    }, 0)
  }
}

global.Image = ImageMock as any

// Mock canvas
const mockCanvas = {
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
  })),
  toDataURL: vi.fn(() => 'data:image/jpeg;base64,compressedImageData'),
  width: 0,
  height: 0,
}

global.document.createElement = vi.fn((tagName: string) => {
  if (tagName === 'canvas') {
    return mockCanvas as any
  }
  return {} as any
})

describe('Receipts Store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  describe('uploadReceipt', () => {
    it('should upload a valid receipt', async () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' })
      const metadata = {
        companyId: 'company-1',
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg' as const,
        fileSize: 1024,
      }

      vi.mocked(db.receipts.add).mockResolvedValue('receipt-id-1')

      const result = await uploadReceipt(mockFile, metadata)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fileName).toBe('receipt.jpg')
        expect(result.data.companyId).toBe('company-1')
      }
    })

    it('should reject invalid file type', async () => {
      const mockFile = new File(['test'], 'file.txt', { type: 'text/plain' })
      const metadata = {
        companyId: 'company-1',
        fileName: 'file.txt',
        mimeType: 'text/plain' as any,
        fileSize: 1024,
      }

      const result = await uploadReceipt(mockFile, metadata)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('Unsupported file type')
      }
    })

    it('should reject files larger than 10MB', async () => {
      const mockFile = new File(['test'], 'large.jpg', { type: 'image/jpeg' })
      const metadata = {
        companyId: 'company-1',
        fileName: 'large.jpg',
        mimeType: 'image/jpeg' as const,
        fileSize: 11 * 1024 * 1024, // 11MB
      }

      const result = await uploadReceipt(mockFile, metadata)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('10MB')
      }
    })
  })

  describe('getReceipt', () => {
    it('should retrieve a receipt by ID', async () => {
      const mockReceipt = {
        id: 'receipt-1',
        companyId: 'company-1',
        transactionId: undefined,
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg' as const,
        fileSize: 1024,
        uploadDate: new Date(),
        imageData: 'encrypted-data',
        thumbnailData: undefined,
        notes: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date(),
        _encrypted: {
          imageData: true,
          thumbnailData: true,
          notes: true,
        },
      }

      vi.mocked(db.receipts.get).mockResolvedValue(mockReceipt)

      const result = await getReceipt('receipt-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('receipt-1')
        expect(result.data.fileName).toBe('receipt.jpg')
      }
    })

    it('should return NOT_FOUND for non-existent receipt', async () => {
      vi.mocked(db.receipts.get).mockResolvedValue(undefined)

      const result = await getReceipt('non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('linkToTransaction', () => {
    it('should link receipt to transaction', async () => {
      const mockReceipt = {
        id: 'receipt-1',
        companyId: 'company-1',
        transactionId: undefined,
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg' as const,
        fileSize: 1024,
        uploadDate: new Date(),
        imageData: 'encrypted-data',
        thumbnailData: undefined,
        notes: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date(),
        _encrypted: {
          imageData: true,
          thumbnailData: true,
          notes: true,
        },
      }

      const updatedReceipt = {
        ...mockReceipt,
        transactionId: 'txn-1',
        versionVector: { 'device-1': 2 },
      }

      vi.mocked(db.receipts.get).mockResolvedValueOnce(mockReceipt)
      vi.mocked(db.receipts.update).mockResolvedValue(1)
      vi.mocked(db.receipts.get).mockResolvedValueOnce(updatedReceipt)

      const result = await linkToTransaction('receipt-1', 'txn-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.transactionId).toBe('txn-1')
      }
    })
  })

  describe('unlinkFromTransaction', () => {
    it('should unlink receipt from transaction', async () => {
      const mockReceipt = {
        id: 'receipt-1',
        companyId: 'company-1',
        transactionId: 'txn-1',
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg' as const,
        fileSize: 1024,
        uploadDate: new Date(),
        imageData: 'encrypted-data',
        thumbnailData: undefined,
        notes: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date(),
        _encrypted: {
          imageData: true,
          thumbnailData: true,
          notes: true,
        },
      }

      const updatedReceipt = {
        ...mockReceipt,
        transactionId: undefined,
        versionVector: { 'device-1': 2 },
      }

      vi.mocked(db.receipts.get).mockResolvedValueOnce(mockReceipt)
      vi.mocked(db.receipts.update).mockResolvedValue(1)
      vi.mocked(db.receipts.get).mockResolvedValueOnce(updatedReceipt)

      const result = await unlinkFromTransaction('receipt-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.transactionId).toBeUndefined()
      }
    })
  })

  describe('deleteReceipt', () => {
    it('should soft delete a receipt', async () => {
      const mockReceipt = {
        id: 'receipt-1',
        companyId: 'company-1',
        transactionId: undefined,
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg' as const,
        fileSize: 1024,
        uploadDate: new Date(),
        imageData: 'encrypted-data',
        thumbnailData: undefined,
        notes: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        versionVector: { 'device-1': 1 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date(),
        _encrypted: {
          imageData: true,
          thumbnailData: true,
          notes: true,
        },
      }

      vi.mocked(db.receipts.get).mockResolvedValue(mockReceipt)
      vi.mocked(db.receipts.update).mockResolvedValue(1)

      const result = await deleteReceipt('receipt-1')

      expect(result.success).toBe(true)
      expect(db.receipts.update).toHaveBeenCalledWith(
        'receipt-1',
        expect.objectContaining({
          deletedAt: expect.any(Date),
        })
      )
    })
  })
})
