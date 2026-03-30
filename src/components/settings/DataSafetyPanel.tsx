/**
 * DataSafetyPanel Component
 *
 * Settings panel for managing data safety and backup preferences.
 * Displays backup status, location, history, and provides backup controls.
 *
 * Requirements:
 * - Task 2.7: Settings Panel - Backup Status UI
 * - ROADMAP_BACKUP_AND_SYNC.md Phase 2
 * - WCAG 2.1 AA compliance
 * - Steadiness communication style
 *
 * Integration Points:
 * - FileSystemBackup (Task 2.1) - folder selection and file operations
 * - BackupScheduler (Task 2.3) - automatic backup triggers
 * - BackupVersioning (Task 2.4) - backup history and retention
 * - BackupService - manual backup creation and download
 */

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardBody } from '../ui/Card'
import { Button } from '../core/Button'
import { Alert } from '../feedback/ErrorMessage'
import { Loading } from '../feedback/Loading'
import { BackupService } from '../../services/backup'
import styles from './DataSafetyPanel.module.css'

/**
 * Backup status from FileSystemBackup service
 */
interface BackupStatus {
  enabled: boolean
  location: string | null
  lastBackup: Date | null
  nextBackup: Date | null
  error: string | null
}

/**
 * Backup history entry from BackupVersioning service
 */
interface BackupHistoryEntry {
  id: string
  filename: string
  timestamp: Date
  size: number
  status: 'success' | 'failed'
  errorMessage?: string
}

/**
 * Props for DataSafetyPanel component
 */
export interface DataSafetyPanelProps {
  /**
   * Company ID for filtering backups
   */
  companyId?: string
  /**
   * Callback when backup settings change
   */
  onSettingsChange?: () => void
}

/**
 * DataSafetyPanel Component
 *
 * Provides a comprehensive view of data backup status and controls.
 * Shows automatic backup configuration, manual backup options, and backup history.
 *
 * Features:
 * - Backup status indicator (ON/OFF)
 * - Current backup location display
 * - Last backup timestamp
 * - Change location button
 * - Manual backup trigger
 * - Backup history (last 10)
 * - Download backup option
 * - Joy messaging throughout
 *
 * @example
 * ```tsx
 * <DataSafetyPanel
 *   companyId="company-123"
 *   onSettingsChange={() => console.log('Settings updated')}
 * />
 * ```
 */
export function DataSafetyPanel({ companyId, onSettingsChange }: DataSafetyPanelProps) {
  // State management
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null)
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [backupSuccess, setBackupSuccess] = useState(false)

  // Load backup status and history on mount
  useEffect(() => {
    loadBackupData()
  }, [companyId])

  /**
   * Load backup status and history
   * TODO: Replace with actual FileSystemBackup and BackupVersioning services
   */
  const loadBackupData = async () => {
    setLoading(true)
    setError(null)

    try {
      // TODO: Replace with actual service calls when Phase 2 services are implemented
      // const status = await FileSystemBackup.getStatus()
      // const history = await BackupVersioning.getHistory(10)

      // Placeholder data for demonstration
      const mockStatus: BackupStatus = {
        enabled: false, // Will be true once File System Access API is set up
        location: null, // Will show path once folder is selected
        lastBackup: null, // Will show timestamp after first backup
        nextBackup: null, // Will show next scheduled backup time
        error: null,
      }

      const mockHistory: BackupHistoryEntry[] = []

      setBackupStatus(mockStatus)
      setBackupHistory(mockHistory)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't load your backup settings. Please try refreshing the page."
      )
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle folder selection for backups
   * Uses File System Access API to request folder permission
   */
  const handleChangeLocation = async () => {
    try {
      // Check browser support for File System Access API
      if (!('showDirectoryPicker' in window)) {
        setError(
          'Your browser doesn\'t support automatic backups. Please use Chrome or Edge for this feature, or use the "Backup Now" button to download backups manually.'
        )
        return
      }

      // TODO: Call FileSystemBackup.requestFolderPermission()
      // const result = await FileSystemBackup.requestFolderPermission()

      // For now, show user-friendly message
      setError(
        'Folder selection is coming soon! This feature will let you choose where your automatic backups are saved.'
      )

      // After implementation:
      // if (result.success) {
      //   await loadBackupData()
      //   onSettingsChange?.()
      // }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Oops! We couldn't open the folder picker. Please try again."
      )
    }
  }

  /**
   * Handle manual backup creation
   * Creates encrypted backup and triggers download
   */
  const handleBackupNow = async () => {
    setCreatingBackup(true)
    setError(null)
    setBackupSuccess(false)

    try {
      // For manual backups, we'll prompt for passphrase
      // TODO: Show passphrase modal instead of prompt
      const passphrase = prompt(
        'Enter a passphrase to encrypt your backup.\n\nThis passphrase will be required to restore your data, so please keep it safe!'
      )

      if (!passphrase) {
        setCreatingBackup(false)
        return
      }

      // Create encrypted backup
      const result = await BackupService.createBackup(passphrase)

      if (result.success && result.blob && result.filename) {
        // Download the backup
        BackupService.downloadBackup(result.blob, result.filename)

        setBackupSuccess(true)
        setBackupStatus((prev) =>
          prev
            ? {
                ...prev,
                lastBackup: new Date(),
              }
            : null
        )

        // Auto-hide success message after 5 seconds
        setTimeout(() => setBackupSuccess(false), 5000)

        // Reload backup history
        await loadBackupData()
        onSettingsChange?.()
      } else {
        setError(result.error || 'Failed to create backup. Please try again.')
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Oops! Something unexpected happened while creating your backup. Please try again.'
      )
    } finally {
      setCreatingBackup(false)
    }
  }

  /**
   * Handle backup download from history
   */
  const handleDownloadBackup = async (entry: BackupHistoryEntry) => {
    try {
      // TODO: Implement download from BackupVersioning service
      // const blob = await BackupVersioning.getBackupBlob(entry.id)
      // BackupService.downloadBackup(blob, entry.filename)

      setError('Downloading previous backups is coming soon!')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't download that backup. Please try again."
      )
    }
  }

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  /**
   * Format relative time for display
   */
  const formatRelativeTime = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  // Show loading state
  if (loading) {
    return (
      <Card>
        <CardBody>
          <Loading message="Loading your backup settings..." centered />
        </CardBody>
      </Card>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <Card variant="elevated">
        <CardHeader>
          <div className={styles.header}>
            <div>
              <h2 className={styles.title}>Data Safety</h2>
              <p className={styles.subtitle}>Peace of mind in one glance</p>
            </div>
            <div className={styles.statusBadge}>
              {backupStatus?.enabled ? (
                <span className={styles.statusOn}>
                  <span className={styles.statusDot} aria-hidden="true" />
                  Automatic Backups ON
                </span>
              ) : (
                <span className={styles.statusOff}>
                  <span className={styles.statusDot} aria-hidden="true" />
                  Manual Backups Only
                </span>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Success Message */}
      {backupSuccess && (
        <Alert variant="success" showIcon>
          Backup complete! Your data is safe and sound. The backup file has been downloaded to
          your computer.
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="warning" showIcon>
          {error}
        </Alert>
      )}

      {/* Backup Status Section */}
      <Card>
        <CardHeader>
          <h3 className={styles.sectionTitle}>Backup Status</h3>
        </CardHeader>
        <CardBody>
          <div className={styles.statusGrid}>
            {/* Backup Location */}
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Backup Location:</span>
              <span className={styles.statusValue}>
                {backupStatus?.location || 'Not configured'}
              </span>
            </div>

            {/* Last Backup */}
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Last Backup:</span>
              <span className={styles.statusValue}>
                {backupStatus?.lastBackup
                  ? formatRelativeTime(backupStatus.lastBackup)
                  : 'Never'}
              </span>
            </div>

            {/* Next Backup (only if automatic backups enabled) */}
            {backupStatus?.enabled && backupStatus?.nextBackup && (
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Next Automatic Backup:</span>
                <span className={styles.statusValue}>
                  {formatRelativeTime(backupStatus.nextBackup)}
                </span>
              </div>
            )}
          </div>

          {/* Backup Actions */}
          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={handleChangeLocation}
              iconBefore="📁"
              aria-label="Change backup location"
            >
              {backupStatus?.location ? 'Change Location' : 'Set Up Automatic Backups'}
            </Button>

            <Button
              variant="primary"
              onClick={handleBackupNow}
              loading={creatingBackup}
              iconBefore="💾"
              aria-label="Create backup now"
            >
              {creatingBackup ? 'Creating Backup...' : 'Backup Now'}
            </Button>
          </div>

          {/* Informational Message */}
          {!backupStatus?.enabled && (
            <div className={styles.infoBox}>
              <p className={styles.infoText}>
                <strong>Want automatic backups?</strong> Set up a backup location to have your data
                automatically saved to your computer. Your backups are encrypted and only you can
                access them.
              </p>
            </div>
          )}

          {backupStatus?.enabled && (
            <div className={styles.infoBox}>
              <p className={styles.infoText}>
                Your data is automatically backed up to{' '}
                <strong>{backupStatus.location}</strong> every day and whenever you make important
                changes. All backups are encrypted with bank-level security.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Backup History Section */}
      <Card>
        <CardHeader>
          <h3 className={styles.sectionTitle}>Backup History</h3>
          <p className={styles.sectionSubtitle}>Your 10 most recent backups</p>
        </CardHeader>
        <CardBody>
          {backupHistory.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyStateIcon} aria-hidden="true">
                📦
              </p>
              <p className={styles.emptyStateTitle}>No backups yet</p>
              <p className={styles.emptyStateText}>
                Your first backup will appear here. Click "Backup Now" to create one!
              </p>
            </div>
          ) : (
            <div className={styles.historyList}>
              {backupHistory.map((entry) => (
                <div key={entry.id} className={styles.historyItem}>
                  <div className={styles.historyIcon} aria-hidden="true">
                    {entry.status === 'success' ? '✓' : '⚠'}
                  </div>
                  <div className={styles.historyDetails}>
                    <p className={styles.historyFilename}>{entry.filename}</p>
                    <p className={styles.historyMeta}>
                      {formatRelativeTime(entry.timestamp)} · {formatFileSize(entry.size)}
                      {entry.status === 'failed' && entry.errorMessage && (
                        <span className={styles.historyError}> · {entry.errorMessage}</span>
                      )}
                    </p>
                  </div>
                  {entry.status === 'success' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadBackup(entry)}
                      aria-label={`Download backup ${entry.filename}`}
                    >
                      Download
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Security Information */}
      <Card variant="bordered">
        <CardBody>
          <div className={styles.securityInfo}>
            <h4 className={styles.securityTitle}>How your backups are protected</h4>
            <ul className={styles.securityList}>
              <li>
                <strong>Bank-level encryption:</strong> Your backups are encrypted with
                AES-256-GCM, the same encryption banks use to protect financial data.
              </li>
              <li>
                <strong>Zero-knowledge security:</strong> Your backup files are encrypted before
                leaving your device. We can't see your data - only you have the key.
              </li>
              <li>
                <strong>Multiple safety nets:</strong> Keep backups on your computer, in your
                email, and synced across devices for maximum protection.
              </li>
              <li>
                <strong>Smart retention:</strong> We keep your last 10 backups plus one daily
                snapshot for 30 days, so you always have a recent copy without cluttering your
                storage.
              </li>
            </ul>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

DataSafetyPanel.displayName = 'DataSafetyPanel'
