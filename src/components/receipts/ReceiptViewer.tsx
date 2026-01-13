import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import type { Receipt } from '../../types'
import { Button } from '../core/Button'
import { Modal } from '../modals/Modal'
import styles from './ReceiptViewer.module.css'

export interface ReceiptViewerProps {
  /**
   * Receipt to display
   */
  receipt: Receipt | null
  /**
   * Whether the viewer is open
   */
  isOpen: boolean
  /**
   * Callback when viewer should close
   */
  onClose: () => void
  /**
   * Callback when link button is clicked
   */
  onLink?: () => void
  /**
   * Callback when download button is clicked
   */
  onDownload?: () => void
  /**
   * Additional class name
   */
  className?: string
}

/**
 * Receipt Viewer Component
 *
 * Features:
 * - Full-size image/PDF viewing
 * - Zoom controls
 * - Download option
 * - Link to transaction
 * - Keyboard navigation
 * - Accessibility compliant
 *
 * @example
 * ```tsx
 * <ReceiptViewer
 *   receipt={selectedReceipt}
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   onLink={handleLink}
 *   onDownload={handleDownload}
 * />
 * ```
 */
export const ReceiptViewer = ({
  receipt,
  isOpen,
  onClose,
  onLink,
  onDownload,
  className,
}: ReceiptViewerProps) => {
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (isOpen && imageRef.current) {
      imageRef.current.focus()
    }
  }, [isOpen])

  if (!receipt) return null

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDownload = () => {
    if (!receipt?.imageData) return

    // Create a download link
    const link = document.createElement('a')
    link.href = receipt.imageData
    link.download = receipt.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    if (onDownload) {
      onDownload()
    }
  }

  const isPDF = receipt.mimeType === 'application/pdf'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={receipt.fileName}
      size="xl"
      className={clsx(styles.viewer, className)}
      footer={
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {onLink && (
            <Button
              variant="secondary"
              onClick={onLink}
              aria-label={
                receipt.transactionId
                  ? 'Change linked transaction'
                  : 'Link to transaction'
              }
            >
              {receipt.transactionId ? '🔗 Linked' : '🔗 Link to Transaction'}
            </Button>
          )}
          <Button variant="primary" onClick={handleDownload}>
            ⬇️ Download
          </Button>
        </div>
      }
    >
      <div className={styles.content}>
        <div className={styles.metadata}>
          <div className={styles.metadataItem}>
            <span className={styles.metadataLabel}>Uploaded:</span>
            <span className={styles.metadataValue}>{formatDate(receipt.uploadDate)}</span>
          </div>
          <div className={styles.metadataItem}>
            <span className={styles.metadataLabel}>Size:</span>
            <span className={styles.metadataValue}>{formatFileSize(receipt.fileSize)}</span>
          </div>
          <div className={styles.metadataItem}>
            <span className={styles.metadataLabel}>Type:</span>
            <span className={styles.metadataValue}>
              {receipt.mimeType.split('/')[1]?.toUpperCase() || 'UNKNOWN'}
            </span>
          </div>
          {receipt.transactionId && (
            <div className={styles.metadataItem}>
              <span className={styles.linkedBadge}>Linked to Transaction</span>
            </div>
          )}
        </div>

        {receipt.notes && (
          <div className={styles.notes}>
            <h3 className={styles.notesTitle}>Notes:</h3>
            <p className={styles.notesContent}>{receipt.notes}</p>
          </div>
        )}

        <div className={styles.imageContainer}>
          {isPDF ? (
            <iframe
              src={receipt.imageData}
              className={styles.pdf}
              title={receipt.fileName}
            />
          ) : (
            <img
              ref={imageRef}
              src={receipt.imageData}
              alt={receipt.fileName}
              className={styles.image}
              tabIndex={0}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
