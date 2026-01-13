/**
 * Receipts Data Access Layer
 *
 * Provides CRUD operations for receipt images with:
 * - Image upload and compression
 * - Thumbnail generation
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Transaction linking
 * - Query builders for common operations
 *
 * Requirements:
 * - ACCT-003: Receipt Capture
 */

import { nanoid } from 'nanoid'
import { db } from './database'
import type {
  DatabaseResult,
  DatabaseError,
  EncryptionContext,
  VersionVector,
  BatchResult,
  ReceiptEntity,
} from './types'
import type { Receipt, ReceiptMimeType } from '../types'

/**
 * Receipt filter for queries
 */
export interface ReceiptFilter {
  companyId?: string
  transactionId?: string
  fromDate?: Date
  toDate?: Date
  linkedOnly?: boolean
  unlinkedOnly?: boolean
  includeDeleted?: boolean
  searchTerm?: string
}

/**
 * Receipt upload metadata
 */
export interface ReceiptUploadMetadata {
  companyId: string
  fileName: string
  mimeType: ReceiptMimeType
  fileSize: number
  notes?: string
  transactionId?: string
}

/**
 * Generate current device ID (stored in localStorage)
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId')
  if (!deviceId) {
    deviceId = nanoid()
    localStorage.setItem('deviceId', deviceId)
  }
  return deviceId
}

/**
 * Initialize version vector for a new entity
 */
function initVersionVector(): VersionVector {
  const deviceId = getDeviceId()
  return { [deviceId]: 1 }
}

/**
 * Increment version vector for an update
 */
function incrementVersionVector(current: VersionVector): VersionVector {
  const deviceId = getDeviceId()
  return {
    ...current,
    [deviceId]: (current[deviceId] || 0) + 1,
  }
}

/**
 * Convert Receipt to ReceiptEntity (adds CRDT fields)
 */
function toReceiptEntity(
  receipt: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
    id?: string
    createdAt?: Date
    updatedAt?: Date
  }
): ReceiptEntity {
  const now = new Date()
  const deviceId = getDeviceId()

  return {
    id: receipt.id || nanoid(),
    companyId: receipt.companyId,
    transactionId: receipt.transactionId,
    fileName: receipt.fileName,
    mimeType: receipt.mimeType,
    fileSize: receipt.fileSize,
    uploadDate: receipt.uploadDate,
    imageData: receipt.imageData,
    thumbnailData: receipt.thumbnailData,
    notes: receipt.notes,
    createdAt: receipt.createdAt || now,
    updatedAt: now,
    deletedAt: undefined,
    versionVector: initVersionVector(),
    lastModifiedBy: deviceId,
    lastModifiedAt: now,
    _encrypted: {
      imageData: true,
      thumbnailData: true,
      notes: true,
    },
  }
}

/**
 * Convert ReceiptEntity to Receipt (removes CRDT fields)
 */
function fromReceiptEntity(entity: ReceiptEntity): Receipt {
  return {
    id: entity.id,
    companyId: entity.companyId,
    transactionId: entity.transactionId,
    fileName: entity.fileName,
    mimeType: entity.mimeType,
    fileSize: entity.fileSize,
    uploadDate: entity.uploadDate,
    imageData: entity.imageData,
    thumbnailData: entity.thumbnailData,
    notes: entity.notes,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt,
  }
}

/**
 * Compress image to reduce storage size
 * Uses canvas API to resize and compress
 */
async function compressImage(
  dataUrl: string,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height
        if (width > height) {
          width = maxWidth
          height = width / aspectRatio
        } else {
          height = maxHeight
          width = height * aspectRatio
        }
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Convert to JPEG for better compression
      const compressed = canvas.toDataURL('image/jpeg', quality)
      resolve(compressed)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

/**
 * Generate thumbnail from image
 */
async function generateThumbnail(
  dataUrl: string,
  maxWidth: number = 200,
  maxHeight: number = 200
): Promise<string> {
  return compressImage(dataUrl, maxWidth, maxHeight, 0.7)
}

/**
 * Validate file type
 */
function validateFileType(mimeType: string): mimeType is ReceiptMimeType {
  const validTypes: ReceiptMimeType[] = [
    'image/jpeg',
    'image/png',
    'image/heic',
    'application/pdf',
  ]
  return validTypes.includes(mimeType as ReceiptMimeType)
}

/**
 * Upload and store a receipt
 */
export async function uploadReceipt(
  file: File,
  metadata: ReceiptUploadMetadata,
  context?: EncryptionContext
): Promise<DatabaseResult<Receipt>> {
  try {
    // Validate file type
    if (!validateFileType(file.type)) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Unsupported file type: ${file.type}. Supported types: JPEG, PNG, HEIC, PDF`,
        },
      }
    }

    // Validate file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (metadata.fileSize > MAX_FILE_SIZE) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `File size exceeds maximum of 10MB`,
        },
      }
    }

    // Read file as data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    // Compress image if it's not a PDF
    let imageData = dataUrl
    let thumbnailData: string | undefined

    if (file.type.startsWith('image/')) {
      imageData = await compressImage(dataUrl)
      thumbnailData = await generateThumbnail(dataUrl)
    }

    // Create receipt entity
    const receipt: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
      companyId: metadata.companyId,
      transactionId: metadata.transactionId,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      fileSize: metadata.fileSize,
      uploadDate: new Date(),
      imageData,
      thumbnailData,
      notes: metadata.notes,
    }

    let entity = toReceiptEntity(receipt)

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context
      entity = {
        ...entity,
        imageData: await encryptionService.encrypt(entity.imageData),
        thumbnailData: entity.thumbnailData
          ? await encryptionService.encrypt(entity.thumbnailData)
          : undefined,
        notes: entity.notes ? await encryptionService.encrypt(entity.notes) : undefined,
      }
    }

    // Store in database
    await db.receipts.add(entity)

    // Return decrypted receipt
    const result = fromReceiptEntity(entity)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Get receipt by ID
 */
export async function getReceipt(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Receipt>> {
  try {
    const entity = await db.receipts.get(id)

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Receipt not found: ${id}`,
        },
      }
    }

    // Check if soft deleted
    if (entity.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Receipt has been deleted: ${id}`,
        },
      }
    }

    // Decrypt if service provided
    let result = entity
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...entity,
        imageData: await encryptionService.decrypt(entity.imageData),
        thumbnailData: entity.thumbnailData
          ? await encryptionService.decrypt(entity.thumbnailData)
          : undefined,
        notes: entity.notes ? await encryptionService.decrypt(entity.notes) : undefined,
      }
    }

    return { success: true, data: fromReceiptEntity(result) }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Query receipts with filters
 */
export async function queryReceipts(
  filter: ReceiptFilter,
  context?: EncryptionContext
): Promise<DatabaseResult<Receipt[]>> {
  try {
    let query = db.receipts.toCollection()

    // Apply filters
    if (filter.companyId) {
      query = db.receipts.where('companyId').equals(filter.companyId)
    }

    if (filter.transactionId) {
      query = db.receipts.where('transactionId').equals(filter.transactionId)
    }

    if (filter.fromDate && filter.toDate && filter.companyId) {
      query = db.receipts
        .where('[companyId+uploadDate]')
        .between([filter.companyId, filter.fromDate], [filter.companyId, filter.toDate])
    }

    // Filter linked/unlinked
    if (filter.linkedOnly) {
      query = query.and((receipt) => receipt.transactionId !== undefined)
    } else if (filter.unlinkedOnly) {
      query = query.and((receipt) => receipt.transactionId === undefined)
    }

    // Filter out deleted unless explicitly requested
    if (!filter.includeDeleted) {
      query = query.and((receipt) => !receipt.deletedAt)
    }

    const entities = await query.toArray()

    // Apply search term filter
    let filtered = entities
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase()
      filtered = entities.filter(
        (receipt) =>
          receipt.fileName.toLowerCase().includes(term) ||
          (receipt.notes && receipt.notes.toLowerCase().includes(term))
      )
    }

    // Decrypt if service provided
    let results = filtered
    if (context?.encryptionService) {
      const { encryptionService } = context
      results = await Promise.all(
        filtered.map(async (entity) => ({
          ...entity,
          imageData: await encryptionService.decrypt(entity.imageData),
          thumbnailData: entity.thumbnailData
            ? await encryptionService.decrypt(entity.thumbnailData)
            : undefined,
          notes: entity.notes ? await encryptionService.decrypt(entity.notes) : undefined,
        }))
      )
    }

    return {
      success: true,
      data: results.map(fromReceiptEntity),
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Get receipts for a company
 */
export async function getReceipts(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Receipt[]>> {
  return queryReceipts({ companyId }, context)
}

/**
 * Link a receipt to a transaction
 */
export async function linkToTransaction(
  receiptId: string,
  transactionId: string
): Promise<DatabaseResult<Receipt>> {
  try {
    const existing = await db.receipts.get(receiptId)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Receipt not found: ${receiptId}`,
        },
      }
    }

    if (existing.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Receipt has been deleted: ${receiptId}`,
        },
      }
    }

    const now = new Date()
    const deviceId = getDeviceId()

    await db.receipts.update(receiptId, {
      transactionId,
      updatedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    })

    const updated = await db.receipts.get(receiptId)
    return { success: true, data: fromReceiptEntity(updated!) }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Unlink a receipt from a transaction
 */
export async function unlinkFromTransaction(
  receiptId: string
): Promise<DatabaseResult<Receipt>> {
  try {
    const existing = await db.receipts.get(receiptId)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Receipt not found: ${receiptId}`,
        },
      }
    }

    const now = new Date()
    const deviceId = getDeviceId()

    await db.receipts.update(receiptId, {
      transactionId: undefined,
      updatedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    })

    const updated = await db.receipts.get(receiptId)
    return { success: true, data: fromReceiptEntity(updated!) }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Update receipt notes
 */
export async function updateReceiptNotes(
  receiptId: string,
  notes: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Receipt>> {
  try {
    const existing = await db.receipts.get(receiptId)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Receipt not found: ${receiptId}`,
        },
      }
    }

    if (existing.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Receipt has been deleted: ${receiptId}`,
        },
      }
    }

    const now = new Date()
    const deviceId = getDeviceId()

    let encryptedNotes = notes
    if (context?.encryptionService) {
      encryptedNotes = await context.encryptionService.encrypt(notes)
    }

    await db.receipts.update(receiptId, {
      notes: encryptedNotes,
      updatedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    })

    const updated = await db.receipts.get(receiptId)

    // Decrypt for return
    let result = updated!
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...updated!,
        notes: result.notes ? await encryptionService.decrypt(result.notes) : undefined,
      }
    }

    return { success: true, data: fromReceiptEntity(result) }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Delete a receipt (soft delete with tombstone)
 */
export async function deleteReceipt(receiptId: string): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.receipts.get(receiptId)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Receipt not found: ${receiptId}`,
        },
      }
    }

    if (existing.deletedAt) {
      return { success: true, data: undefined } // Already deleted
    }

    // Soft delete with tombstone marker
    const now = new Date()
    const deviceId = getDeviceId()

    await db.receipts.update(receiptId, {
      deletedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    })

    return { success: true, data: undefined }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Batch delete receipts
 */
export async function batchDeleteReceipts(
  receiptIds: string[]
): Promise<BatchResult<void>> {
  const successful: void[] = []
  const failed: Array<{ item: void; error: DatabaseError }> = []

  for (const id of receiptIds) {
    const result = await deleteReceipt(id)
    if (result.success) {
      successful.push(undefined)
    } else {
      failed.push({
        item: undefined,
        error: result.error,
      })
    }
  }

  return { successful, failed }
}
