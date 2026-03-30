/**
 * File Upload Restoration Component
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 5, Task 5.4:
 * Handles restoration from local backup files.
 *
 * User Flow:
 * 1. User selects backup file from computer
 * 2. Validate file format and integrity
 * 3. Prompt for password
 * 4. Decrypt and restore data
 * 5. Show success celebration
 *
 * Joy Engineering: "Drop your backup, enter your password, done! ✨"
 */

import { useState, ChangeEvent, FormEvent, DragEvent } from 'react'
import { Button } from '../core/Button'
import { Card, CardHeader, CardBody } from '../ui/Card'
import styles from './FileUploadRestore.module.css'

/**
 * File Upload Restore Props
 */
export interface FileUploadRestoreProps {
  /**
   * Called when restoration is successful
   */
  onSuccess: () => void

  /**
   * Called when user wants to go back
   */
  onBack: () => void

  /**
   * Optional restoration service (for testing)
   */
  restorationService?: {
    validateBackupFile: (file: File) => Promise<{ valid: boolean; error?: string }>
    restoreFromFile: (file: File, password: string) => Promise<void>
  }
}

/**
 * Restoration flow step
 */
type RestoreStep = 'select-file' | 'input-password' | 'restoring' | 'success' | 'error'

/**
 * File Upload Restoration Component
 *
 * Supports drag-and-drop and file picker.
 *
 * @example
 * ```tsx
 * <FileUploadRestore
 *   onSuccess={() => navigate('/dashboard')}
 *   onBack={() => navigate('/restore')}
 * />
 * ```
 */
export function FileUploadRestore({
  onSuccess,
  onBack,
  restorationService,
}: FileUploadRestoreProps) {
  const [step, setStep] = useState<RestoreStep>('select-file')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  /**
   * Validates backup file format
   */
  const validateFileFormat = (file: File): boolean => {
    // Check file extension
    const validExtensions = ['.encrypted', '.backup', '.json']
    const hasValidExtension = validExtensions.some(ext => file.name.endsWith(ext))

    // Check file size (max 500MB)
    const maxSize = 500 * 1024 * 1024
    const isValidSize = file.size > 0 && file.size <= maxSize

    return hasValidExtension && isValidSize
  }

  /**
   * Handles file selection
   */
  const handleFileSelect = async (file: File) => {
    setError('')

    // Validate file format
    if (!validateFileFormat(file)) {
      setError('Invalid backup file. Please select a .encrypted or .backup file.')
      return
    }

    setIsValidating(true)
    setSelectedFile(file)

    try {
      // Validate with service (if provided)
      if (restorationService) {
        const result = await restorationService.validateBackupFile(file)

        if (!result.valid) {
          setError(result.error || 'This backup file appears to be corrupted.')
          setSelectedFile(null)
          setIsValidating(false)
          return
        }
      }

      // Move to password step
      setStep('input-password')
    } catch (err) {
      setError('Unable to validate backup file. The file may be corrupted.')
      setSelectedFile(null)
    } finally {
      setIsValidating(false)
    }
  }

  /**
   * Handles file input change
   */
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  /**
   * Handles drag over
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  /**
   * Handles drag leave
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  /**
   * Handles file drop
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  /**
   * Handles password submission and restoration
   */
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password || !selectedFile) {
      setError('Please enter your password')
      return
    }

    setIsRestoring(true)
    setStep('restoring')

    try {
      if (restorationService) {
        await restorationService.restoreFromFile(selectedFile, password)
      } else {
        // Mock restoration for development
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      setStep('success')

      // Auto-navigate after celebration
      setTimeout(() => {
        onSuccess()
      }, 3000)
    } catch (err) {
      setStep('error')
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to restore your data. The password may be incorrect or the backup may be corrupted.'
      )
    } finally {
      setIsRestoring(false)
    }
  }

  /**
   * Handles retry after error
   */
  const handleRetry = () => {
    setError('')
    setPassword('')
    setStep('input-password')
  }

  /**
   * Handles starting over
   */
  const handleStartOver = () => {
    setError('')
    setPassword('')
    setSelectedFile(null)
    setStep('select-file')
  }

  /**
   * Render file selection step
   */
  if (step === 'select-file') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardHeader>
            <h2 className={styles.title}>Choose Your Backup File 📁</h2>
            <p className={styles.subtitle}>
              Select a backup file from your computer. You can drag and drop or click to browse.
            </p>
          </CardHeader>

          <CardBody>
            <div
              className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              aria-label="Drop backup file or click to browse"
            >
              <input
                type="file"
                id="file-input"
                accept=".encrypted,.backup,.json"
                onChange={handleFileInputChange}
                className={styles.fileInput}
                disabled={isValidating}
              />
              <label htmlFor="file-input" className={styles.dropZoneLabel}>
                <div className={styles.dropZoneIcon} aria-hidden="true">
                  📁
                </div>
                <p className={styles.dropZoneText}>
                  {isDragging ? 'Drop your backup file here' : 'Drag and drop your backup file here'}
                </p>
                <p className={styles.dropZoneHint}>or</p>
                <Button
                  variant="primary"
                  disabled={isValidating}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  {isValidating ? 'Validating...' : 'Browse Files'}
                </Button>
              </label>
            </div>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <p className={styles.hint}>
              Supported formats: .encrypted, .backup, .json (max 500MB)
            </p>

            <div className={styles.actions}>
              <Button variant="ghost" onClick={onBack} disabled={isValidating}>
                Back
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  /**
   * Render password input step
   */
  if (step === 'input-password') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardHeader>
            <h2 className={styles.title}>Enter Your Password 🔑</h2>
            <p className={styles.subtitle}>
              Your backup is encrypted. Enter your password to decrypt and restore it.
            </p>
            {selectedFile && (
              <p className={styles.fileName}>
                File: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </CardHeader>

          <CardBody>
            <form onSubmit={handlePasswordSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="password" className={styles.label}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={styles.input}
                  required
                  autoFocus
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'password-error' : undefined}
                />
                {error && (
                  <p id="password-error" className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                <p className={styles.hint}>
                  This is the password you use to log into Graceful Books
                </p>
              </div>

              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleStartOver}
                  disabled={isRestoring}
                >
                  Choose Different File
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isRestoring}
                  disabled={!password}
                >
                  Restore My Data
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    )
  }

  /**
   * Render restoring step
   */
  if (step === 'restoring') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardBody>
            <div className={styles.loading}>
              <div className={styles.spinner} aria-hidden="true" />
              <h2 className={styles.loadingTitle}>Restoring Your Data...</h2>
              <p className={styles.loadingMessage}>
                Decrypting and importing your financial records. This may take a moment.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  /**
   * Render success step
   */
  if (step === 'success') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardBody>
            <div className={styles.success}>
              <div className={styles.celebration} aria-hidden="true">
                ✨
              </div>
              <h2 className={styles.successTitle}>Restoration Complete!</h2>
              <p className={styles.successMessage}>
                Your data has been restored successfully. Drop your backup, enter your password, done! ✨
              </p>
              <Button variant="primary" onClick={onSuccess} className={styles.successButton}>
                Go to Dashboard
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  /**
   * Render error step
   */
  if (step === 'error') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardBody>
            <div className={styles.errorState}>
              <div className={styles.errorIcon} aria-hidden="true">
                ⚠️
              </div>
              <h2 className={styles.errorTitle}>Restoration Failed</h2>
              <p className={styles.errorMessage}>{error}</p>
              <div className={styles.actions}>
                <Button variant="ghost" onClick={onBack}>
                  Try Another Method
                </Button>
                <Button variant="primary" onClick={handleRetry}>
                  Try Again
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return null
}
