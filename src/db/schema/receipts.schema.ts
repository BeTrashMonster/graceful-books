/**
 * Receipts Schema Definition
 *
 * Defines the structure for receipt storage including image data,
 * metadata, and transaction linking.
 *
 * Requirements:
 * - ACCT-003: Receipt Capture
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { VersionVector } from '../../types/database.types'
import type { ReceiptMimeType } from '../../types'

/**
 * Dexie.js schema definition for Receipts table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying receipts by company
 * - transaction_id: For finding receipts linked to transactions
 * - upload_date: For date-range queries
 * - [company_id+upload_date]: Compound index for filtered queries
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 * - deleted_at: For soft delete filtering
 */
export const receiptsSchema =
  'id, company_id, transaction_id, upload_date, [company_id+upload_date], updated_at, deleted_at'

/**
 * Table name constant
 */
export const RECEIPTS_TABLE = 'receipts'

/**
 * Receipt entity stored in database
 * Includes CRDT fields and encryption markers
 */
export interface ReceiptEntity {
  id: string
  company_id: string
  transaction_id: string | null
  file_name: string
  mime_type: ReceiptMimeType
  file_size: number
  upload_date: number
  image_data: string
  thumbnail_data: string | null
  notes: string | null
  created_at: number
  updated_at: number
  deleted_at: number | null
  version_vector: VersionVector
}

/**
 * Default values for new Receipt
 */
export const createDefaultReceipt = (
  companyId: string,
  fileName: string,
  mimeType: ReceiptMimeType,
  fileSize: number,
  imageData: string,
  deviceId: string
): Partial<ReceiptEntity> => {
  const now = Date.now()

  return {
    company_id: companyId,
    transaction_id: null,
    file_name: fileName,
    mime_type: mimeType,
    file_size: fileSize,
    upload_date: now,
    image_data: imageData,
    thumbnail_data: null,
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  }
}

/**
 * Validation: Ensure receipt has valid fields
 */
export const validateReceipt = (receipt: Partial<ReceiptEntity>): string[] => {
  const errors: string[] = []

  if (!receipt.company_id) {
    errors.push('company_id is required')
  }

  if (!receipt.file_name || receipt.file_name.trim() === '') {
    errors.push('file_name is required')
  }

  if (!receipt.mime_type) {
    errors.push('mime_type is required')
  }

  const validMimeTypes: ReceiptMimeType[] = [
    'image/jpeg',
    'image/png',
    'image/heic',
    'application/pdf',
  ]
  if (receipt.mime_type && !validMimeTypes.includes(receipt.mime_type)) {
    errors.push(`mime_type must be one of: ${validMimeTypes.join(', ')}`)
  }

  if (!receipt.file_size || receipt.file_size <= 0) {
    errors.push('file_size must be greater than 0')
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  if (receipt.file_size && receipt.file_size > MAX_FILE_SIZE) {
    errors.push(`file_size must not exceed ${MAX_FILE_SIZE} bytes (10MB)`)
  }

  if (!receipt.image_data || receipt.image_data.trim() === '') {
    errors.push('image_data is required')
  }

  if (!receipt.upload_date) {
    errors.push('upload_date is required')
  }

  return errors
}

/**
 * Query helper: Get all receipts for a company
 */
export interface GetReceiptsQuery {
  company_id: string
  transaction_id?: string
  upload_date_from?: number
  upload_date_to?: number
  linked_only?: boolean
  unlinked_only?: boolean
}

/**
 * Filter receipts by search criteria
 */
export const filterReceipts = (
  receipts: ReceiptEntity[],
  searchTerm: string
): ReceiptEntity[] => {
  if (!searchTerm || searchTerm.trim() === '') {
    return receipts
  }

  const term = searchTerm.toLowerCase()

  return receipts.filter((receipt) => {
    return (
      receipt.file_name.toLowerCase().includes(term) ||
      (receipt.notes && receipt.notes.toLowerCase().includes(term))
    )
  })
}

/**
 * Supported image formats for validation
 */
export const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'application/pdf',
] as const

/**
 * Maximum file size (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * File extension mapping
 */
export const MIME_TYPE_EXTENSIONS: Record<ReceiptMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'application/pdf': '.pdf',
}

/**
 * Get file extension from MIME type
 */
export const getExtensionFromMimeType = (mimeType: ReceiptMimeType): string => {
  return MIME_TYPE_EXTENSIONS[mimeType] || ''
}

/**
 * Get MIME type from file extension
 */
export const getMimeTypeFromExtension = (fileName: string): ReceiptMimeType | null => {
  const extension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0]

  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.heic':
      return 'image/heic'
    case '.pdf':
      return 'application/pdf'
    default:
      return null
  }
}
