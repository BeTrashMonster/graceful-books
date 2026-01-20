/**
 * Tax Document Manager Service
 *
 * Manages tax documents for tax preparation workflow (J8).
 * Handles document upload, categorization, and status tracking.
 *
 * Per ROADMAP J8 Tax Time Preparation Mode specification
 */

import { db } from '../../db'
import type {
  TaxDocument,
  TaxDocumentCategory,
  TaxDocumentStatus,
  TaxYear,
} from '../../types/tax.types'

/**
 * Tax document categories as per J8 spec
 */
export const TAX_DOCUMENT_CATEGORIES: TaxDocumentCategory[] = [
  {
    id: 'income-documents',
    name: 'Income Documents',
    description: '1099s, K-1s, W-2s',
    required: true,
    order: 1,
  },
  {
    id: 'expense-receipts',
    name: 'Expense Receipts',
    description: 'Major purchases, business expenses',
    required: true,
    order: 2,
  },
  {
    id: 'mileage-log',
    name: 'Mileage Log',
    description: 'Business miles driven',
    required: false,
    order: 3,
  },
  {
    id: 'home-office',
    name: 'Home Office',
    description: 'Square footage, expenses',
    required: false,
    order: 4,
  },
  {
    id: 'asset-purchases',
    name: 'Asset Purchases',
    description: 'Equipment, vehicles (depreciation)',
    required: false,
    order: 5,
  },
  {
    id: 'bank-statements',
    name: 'Bank/Credit Card Statements',
    description: 'Year-end statements',
    required: true,
    order: 6,
  },
  {
    id: 'prior-year-return',
    name: 'Prior Year Tax Return',
    description: 'For reference',
    required: false,
    order: 7,
  },
  {
    id: 'other',
    name: 'Other',
    description: 'Catch-all for misc documents',
    required: false,
    order: 8,
  },
]

/**
 * Get all tax document categories
 */
export function getTaxDocumentCategories(): TaxDocumentCategory[] {
  return TAX_DOCUMENT_CATEGORIES
}

/**
 * Get tax document category by ID
 */
export function getTaxDocumentCategoryById(
  categoryId: string
): TaxDocumentCategory | undefined {
  return TAX_DOCUMENT_CATEGORIES.find((cat) => cat.id === categoryId)
}

/**
 * Upload tax document
 */
export async function uploadTaxDocument(
  userId: string,
  taxYear: TaxYear,
  categoryId: string,
  file: File,
  notes?: string
): Promise<TaxDocument> {
  // Validate category
  const category = getTaxDocumentCategoryById(categoryId)
  if (!category) {
    throw new Error(`Invalid tax document category: ${categoryId}`)
  }

  // Validate file type
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only PDF and image files (JPEG, PNG) are allowed')
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error('File size must be less than 10MB')
  }

  // Read file as data URL for storage (client-side)
  const fileData = await readFileAsDataURL(file)

  // Create document record
  const document: TaxDocument = {
    id: crypto.randomUUID(),
    userId,
    taxYear,
    categoryId,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    fileData, // Store encrypted in production
    notes: notes || '',
    status: 'uploaded',
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Save to database
  await db.taxDocuments.add(document)

  return document
}

/**
 * Helper function to read file as data URL
 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file as data URL'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Get all tax documents for a tax year
 */
export async function getTaxDocuments(
  userId: string,
  taxYear: TaxYear
): Promise<TaxDocument[]> {
  const documents = await db.taxDocuments
    .where({ userId, taxYear })
    .toArray()

  return documents.sort((a, b) => {
    // Sort by category order, then by upload date
    const catA = getTaxDocumentCategoryById(a.categoryId)
    const catB = getTaxDocumentCategoryById(b.categoryId)
    const orderDiff = (catA?.order || 999) - (catB?.order || 999)
    if (orderDiff !== 0) return orderDiff
    return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  })
}

/**
 * Get tax documents by category
 */
export async function getTaxDocumentsByCategory(
  userId: string,
  taxYear: TaxYear,
  categoryId: string
): Promise<TaxDocument[]> {
  const documents = await db.taxDocuments
    .where({ userId, taxYear, categoryId })
    .toArray()

  return documents.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )
}

/**
 * Update tax document status
 */
export async function updateTaxDocumentStatus(
  documentId: string,
  status: TaxDocumentStatus
): Promise<void> {
  await db.taxDocuments.update(documentId, {
    status,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Update tax document notes
 */
export async function updateTaxDocumentNotes(
  documentId: string,
  notes: string
): Promise<void> {
  await db.taxDocuments.update(documentId, {
    notes,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Delete tax document
 */
export async function deleteTaxDocument(documentId: string): Promise<void> {
  await db.taxDocuments.delete(documentId)
}

/**
 * Get category completion status
 */
export async function getCategoryStatus(
  userId: string,
  taxYear: TaxYear,
  categoryId: string
): Promise<{
  status: 'not-applicable' | 'in-progress' | 'complete'
  documentCount: number
}> {
  const documents = await getTaxDocumentsByCategory(userId, taxYear, categoryId)

  // Check for N/A marker
  const naMarker = await db.taxCategoryStatus.get({
    userId,
    taxYear,
    categoryId,
  })

  if (naMarker?.status === 'not-applicable') {
    return {
      status: 'not-applicable',
      documentCount: 0,
    }
  }

  if (naMarker?.status === 'complete') {
    return {
      status: 'complete',
      documentCount: documents.length,
    }
  }

  if (documents.length === 0) {
    return {
      status: 'in-progress',
      documentCount: 0,
    }
  }

  return {
    status: 'in-progress',
    documentCount: documents.length,
  }
}

/**
 * Set category status
 */
export async function setCategoryStatus(
  userId: string,
  taxYear: TaxYear,
  categoryId: string,
  status: 'not-applicable' | 'in-progress' | 'complete'
): Promise<void> {
  const existing = await db.taxCategoryStatus.get({
    userId,
    taxYear,
    categoryId,
  })

  if (existing) {
    await db.taxCategoryStatus.update(existing.id!, {
      status,
      updatedAt: new Date().toISOString(),
    })
  } else {
    await db.taxCategoryStatus.add({
      id: crypto.randomUUID(),
      userId,
      taxYear,
      categoryId,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
}

/**
 * Calculate overall completion percentage
 */
export async function calculateTaxPrepProgress(
  userId: string,
  taxYear: TaxYear
): Promise<{
  percentage: number
  categoriesComplete: number
  categoriesTotal: number
}> {
  const categories = getTaxDocumentCategories()
  let complete = 0

  for (const category of categories) {
    const status = await getCategoryStatus(userId, taxYear, category.id)
    if (status.status === 'complete' || status.status === 'not-applicable') {
      complete++
    }
  }

  return {
    percentage: Math.round((complete / categories.length) * 100),
    categoriesComplete: complete,
    categoriesTotal: categories.length,
  }
}
