/**
 * Receipts Page
 *
 * Main page for managing receipt uploads and viewing
 *
 * Features:
 * - Upload receipts via drag-and-drop or file browser
 * - View receipts in gallery grid
 * - Full-size receipt viewing
 * - Link receipts to transactions
 * - Search and filter capabilities
 * - Accessibility compliant
 */

import { useState, useEffect } from 'react'
import { ReceiptUpload } from '../components/receipts/ReceiptUpload'
import { ReceiptGallery } from '../components/receipts/ReceiptGallery'
import { ReceiptViewer } from '../components/receipts/ReceiptViewer'
import { ReceiptLinkModal, type Transaction } from '../components/receipts/ReceiptLinkModal'
import type { Receipt } from '../types'
import {
  uploadReceipt,
  getReceipts,
  linkToTransaction,
  unlinkFromTransaction,
  deleteReceipt,
} from '../store/receipts'
import styles from './Receipts.module.css'

/**
 * Receipts Page Component
 */
export default function Receipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [linkingReceipt, setLinkingReceipt] = useState<Receipt | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLinking, setIsLinking] = useState(false)
  const [uploadError, setUploadError] = useState<string | undefined>()
  const [uploadSuccess, setUploadSuccess] = useState<string | undefined>()

  // Mock company ID - in real app this would come from auth context
  const companyId = 'mock-company-id'

  // Load receipts on mount
  useEffect(() => {
    loadReceipts()
    loadTransactions()
  }, [])

  const loadReceipts = async () => {
    setIsLoading(true)
    try {
      const result = await getReceipts(companyId)
      if (result.success) {
        setReceipts(result.data)
      }
    } catch (error) {
      console.error('Failed to load receipts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadTransactions = async () => {
    // Mock transactions - in real app this would call queryTransactions
    setTransactions([
      {
        id: 'txn-1',
        date: new Date('2026-01-10'),
        reference: 'INV-001',
        memo: 'Office supplies',
        totalAmount: 125.5,
      },
      {
        id: 'txn-2',
        date: new Date('2026-01-09'),
        reference: 'INV-002',
        memo: 'Software subscription',
        totalAmount: 99.0,
      },
      {
        id: 'txn-3',
        date: new Date('2026-01-08'),
        memo: 'Client lunch',
        totalAmount: 67.25,
      },
    ])
  }

  const handleFileSelect = async (file: File) => {
    setIsUploading(true)
    setUploadError(undefined)
    setUploadSuccess(undefined)

    try {
      const result = await uploadReceipt(
        file,
        {
          companyId,
          fileName: file.name,
          mimeType: file.type as any,
          fileSize: file.size,
        }
      )

      if (result.success) {
        setUploadSuccess('Receipt saved! That is one less piece of paper to worry about.')
        await loadReceipts()

        // Clear success message after 5 seconds
        setTimeout(() => setUploadSuccess(undefined), 5000)
      } else {
        setUploadError(
          result.error.message ||
            "We couldn't upload that receipt. Please check the file and try again."
        )
      }
    } catch (error) {
      setUploadError(
        'Something went wrong while uploading. Please try again in a moment.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleReceiptClick = (receipt: Receipt) => {
    setSelectedReceipt(receipt)
  }

  const handleCloseViewer = () => {
    setSelectedReceipt(null)
  }

  const handleOpenLinkModal = () => {
    if (selectedReceipt) {
      setLinkingReceipt(selectedReceipt)
    }
  }

  const handleCloseLinkModal = () => {
    setLinkingReceipt(null)
  }

  const handleLink = async (transactionId: string) => {
    if (!linkingReceipt) return

    setIsLinking(true)
    try {
      const result = await linkToTransaction(linkingReceipt.id, transactionId)
      if (result.success) {
        await loadReceipts()
        setLinkingReceipt(null)
        setSelectedReceipt(null)
        // Show success message
        setUploadSuccess('Perfect match! Receipt and transaction are now best friends.')
        setTimeout(() => setUploadSuccess(undefined), 5000)
      }
    } catch (error) {
      console.error('Failed to link receipt:', error)
    } finally {
      setIsLinking(false)
    }
  }

  const handleUnlink = async () => {
    if (!linkingReceipt) return

    setIsLinking(true)
    try {
      const result = await unlinkFromTransaction(linkingReceipt.id)
      if (result.success) {
        await loadReceipts()
        setLinkingReceipt(null)
        setSelectedReceipt(null)
      }
    } catch (error) {
      console.error('Failed to unlink receipt:', error)
    } finally {
      setIsLinking(false)
    }
  }

  const handleDelete = async (receiptId: string) => {
    if (!confirm('Are you sure you want to delete this receipt?')) {
      return
    }

    try {
      const result = await deleteReceipt(receiptId)
      if (result.success) {
        await loadReceipts()
        if (selectedReceipt?.id === receiptId) {
          setSelectedReceipt(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete receipt:', error)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Receipts</h1>
        <p className={styles.subtitle}>
          Upload and organize your receipts. Link them to transactions to keep everything in
          one place.
        </p>
      </header>

      <section className={styles.uploadSection} aria-labelledby="upload-heading">
        <h2 id="upload-heading" className={styles.sectionTitle}>
          Upload New Receipt
        </h2>
        <ReceiptUpload
          onFileSelect={handleFileSelect}
          isUploading={isUploading}
          error={uploadError}
          success={uploadSuccess}
        />
      </section>

      <section className={styles.gallerySection} aria-labelledby="gallery-heading">
        <h2 id="gallery-heading" className={styles.sectionTitle}>
          Your Receipts
        </h2>
        <ReceiptGallery
          receipts={receipts}
          onReceiptClick={handleReceiptClick}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      </section>

      <ReceiptViewer
        receipt={selectedReceipt}
        isOpen={!!selectedReceipt}
        onClose={handleCloseViewer}
        onLink={handleOpenLinkModal}
      />

      <ReceiptLinkModal
        receipt={linkingReceipt}
        transactions={transactions}
        isOpen={!!linkingReceipt}
        onClose={handleCloseLinkModal}
        onLink={handleLink}
        onUnlink={handleUnlink}
        isLoading={isLinking}
      />
    </div>
  )
}
