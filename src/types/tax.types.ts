/**
 * Type definitions for Tax Preparation Mode (J8)
 */

export type TaxYear = string // Format: "2025"

export type TaxDocumentStatus = 'uploaded' | 'verified' | 'archived'

export interface TaxDocumentCategory {
  id: string
  name: string
  description: string
  required: boolean
  order: number
}

export interface TaxDocument {
  id: string
  userId: string
  taxYear: TaxYear
  categoryId: string
  fileName: string
  fileType: string
  fileSize: number
  fileData: string // Data URL or encrypted blob reference
  notes: string
  status: TaxDocumentStatus
  uploadedAt: string
  updatedAt: string
}

export interface TaxCategoryStatus {
  id?: string
  userId: string
  taxYear: TaxYear
  categoryId: string
  status: 'not-applicable' | 'in-progress' | 'complete'
  createdAt: string
  updatedAt: string
}

export interface TaxPrepSession {
  id?: string
  userId: string
  taxYear: TaxYear
  businessStructure: 'sole-proprietor' | 'partnership' | 's-corp' | 'c-corp'
  workingWithCPA: boolean
  activatedAt: string
  completedAt?: string
  status: 'active' | 'complete' | 'archived'
}

export interface TaxPackage {
  id: string
  userId: string
  taxYear: TaxYear
  generatedAt: string
  documents: TaxDocument[]
  reports: {
    profitLoss: Blob
    balanceSheet: Blob
    cashFlow?: Blob
    transactionCSV: Blob
    depreciationSchedule?: Blob
  }
  notes: string
}

export interface TaxAdvisorAccess {
  id?: string
  clientUserId: string
  advisorUserId: string
  taxYear: TaxYear
  grantedAt: string
  expiresAt?: string // Auto-expire (e.g., April 30)
  status: 'active' | 'expired' | 'revoked'
  reviewStatus?: 'pending' | 'reviewed' | 'needs-info'
  advisorNotes?: string
}
