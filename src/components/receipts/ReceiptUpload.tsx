import { useState, useRef, useCallback, type ChangeEvent, type DragEvent } from 'react'
import clsx from 'clsx'
import { Button } from '../core/Button'
import styles from './ReceiptUpload.module.css'

export interface ReceiptUploadProps {
  /**
   * Callback when file is selected
   */
  onFileSelect: (file: File) => void
  /**
   * Whether upload is in progress
   */
  isUploading?: boolean
  /**
   * Error message to display
   */
  error?: string
  /**
   * Success message to display
   */
  success?: string
  /**
   * Additional class name
   */
  className?: string
}

/**
 * Receipt Upload Component
 *
 * Features:
 * - Drag-and-drop file upload
 * - Click to browse files
 * - Mobile camera capture
 * - File type and size validation
 * - Progress indication
 * - Error handling
 * - Accessibility compliant
 *
 * @example
 * ```tsx
 * <ReceiptUpload
 *   onFileSelect={handleFileSelect}
 *   isUploading={isUploading}
 *   error={error}
 * />
 * ```
 */
export const ReceiptUpload = ({
  onFileSelect,
  isUploading = false,
  error,
  success,
  className,
}: ReceiptUploadProps) => {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf']

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Please upload a JPEG, PNG, HEIC, or PDF file.'
    }

    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 10MB.'
    }

    return null
  }, [])

  const handleFileSelect = useCallback(
    (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        // Error will be handled by parent
        return
      }

      onFileSelect(file)
    },
    [validateFile, onFileSelect]
  )

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0 && files[0]) {
        handleFileSelect(files[0])
      }
    },
    [handleFileSelect]
  )

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0 && files[0]) {
        handleFileSelect(files[0])
      }
    },
    [handleFileSelect]
  )

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick]
  )

  return (
    <div className={clsx(styles.uploadWrapper, className)}>
      <div
        className={clsx(
          styles.dropZone,
          isDragging && styles.dragging,
          isUploading && styles.uploading,
          error && styles.error,
          success && styles.success
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Upload receipt"
        aria-disabled={isUploading}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleInputChange}
          disabled={isUploading}
          className={styles.fileInput}
          aria-hidden="true"
          capture="environment"
        />

        {isUploading ? (
          <div className={styles.uploadingState}>
            <div className={styles.spinner} aria-label="Uploading" />
            <p>Uploading receipt...</p>
          </div>
        ) : (
          <>
            <div className={styles.uploadIcon} aria-hidden="true">
              📄
            </div>
            <p className={styles.uploadTitle}>
              {isDragging ? 'Drop receipt here' : 'Drag and drop receipt here'}
            </p>
            <p className={styles.uploadSubtitle}>or</p>
            <Button type="button" variant="secondary" disabled={isUploading}>
              Browse Files
            </Button>
            <p className={styles.uploadHint}>
              Supports JPEG, PNG, HEIC, and PDF files up to 10MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p className={styles.errorMessage} role="alert" aria-live="polite">
          {error}
        </p>
      )}

      {success && !error && (
        <p className={styles.successMessage} role="status" aria-live="polite">
          {success}
        </p>
      )}
    </div>
  )
}
