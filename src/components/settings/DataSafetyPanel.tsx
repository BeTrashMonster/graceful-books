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
import { openDB } from 'idb'
import { Card, CardHeader, CardBody } from '../ui/Card'
import { Button } from '../core/Button'
import { Alert } from '../feedback/ErrorMessage'
import { Loading } from '../feedback/Loading'
import { BackupService } from '../../services/backup'
import {
  retrieveDirectoryHandle,
  storeDirectoryHandle,
  getBackupDirectoryStatus,
} from '../../services/backup/FileSystemBackup'
import { EncryptedBackup } from '../backup/EncryptedBackup'
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
  companyId?: string // User/company who created this backup
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
  const [backupSavedToFolder, setBackupSavedToFolder] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [showBackupModal, setShowBackupModal] = useState(false)

  // Load backup status and history on mount
  useEffect(() => {
    console.log('🔄 DataSafetyPanel mounted, loading backup data...')
    loadBackupData()
  }, [companyId])

  /**
   * Load backup status and history
   */
  const loadBackupData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get stored directory handle and check status
      const dirHandle = await retrieveDirectoryHandle()
      const directoryStatus = await getBackupDirectoryStatus()

      console.log('📊 Directory status:', directoryStatus)

      // Preserve existing lastBackup if we have one, otherwise load from service
      const existingLastBackup = backupStatus?.lastBackup || null

      const status: BackupStatus = {
        enabled: directoryStatus.configured && (directoryStatus.permissionGranted ?? false),
        location: directoryStatus.configured ? directoryStatus.folderName || 'Configured' : null,
        lastBackup: existingLastBackup, // Preserve existing lastBackup (TODO: load from BackupVersioning)
        nextBackup: null, // TODO: Integrate with BackupScheduler service
        error: directoryStatus.needsReauthorization
          ? 'Permission needs to be renewed. Please re-select your backup folder.'
          : null,
      }

      console.log('✅ Backup status loaded:', status)

      // Load backup history from IndexedDB
      const history = await loadBackupHistory()
      console.log('📜 Backup history loaded:', history)

      setBackupStatus(status)
      setBackupHistory(history)
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
   * Load backup history from IndexedDB
   * Filters by companyId to show only this user's backups
   */
  const loadBackupHistory = async (): Promise<BackupHistoryEntry[]> => {
    try {
      console.log('📖 Loading backup history from IndexedDB for companyId:', companyId)
      const db = await openDB('GracefulBooksBackupHistory', 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
          console.log('🔧 Upgrading backup history database from version', oldVersion)

          // Create store if it doesn't exist (version 1)
          if (!db.objectStoreNames.contains('backups')) {
            const store = db.createObjectStore('backups', { keyPath: 'id' })
            store.createIndex('timestamp', 'timestamp', { unique: false })
            store.createIndex('companyId', 'companyId', { unique: false })
            console.log('✨ Backup history object store created')
          } else if (oldVersion < 2) {
            // Add companyId index for existing databases (version 2 upgrade)
            const store = transaction.objectStore('backups')
            if (!store.indexNames.contains('companyId')) {
              store.createIndex('companyId', 'companyId', { unique: false })
              console.log('✨ Added companyId index to existing backup history')
            }
          }
        },
      })

      // Get all backups for this company
      let allBackups: BackupHistoryEntry[]

      if (companyId) {
        // Filter by companyId using the index
        const index = db.transaction('backups').store.index('companyId')
        allBackups = await index.getAll(companyId)
        console.log(`📦 Found ${allBackups.length} backups for companyId: ${companyId}`)
      } else {
        // No companyId provided - get all backups (fallback for backwards compatibility)
        allBackups = await db.getAll('backups')
        console.log(`📦 No companyId - loaded ${allBackups.length} total backups`)
      }

      const sorted = allBackups
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10) // Only keep 10 most recent

      console.log('✅ Sorted backups (newest first):', sorted)
      return sorted
    } catch (error) {
      console.error('❌ Failed to load backup history:', error)
      return []
    }
  }

  /**
   * Save backup to history
   */
  const saveToBackupHistory = async (entry: BackupHistoryEntry): Promise<void> => {
    try {
      console.log('💾 Attempting to save backup to history:', entry)
      const db = await openDB('GracefulBooksBackupHistory', 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
          console.log('🔧 Creating backup history database...')

          // Create store if it doesn't exist (version 1)
          if (!db.objectStoreNames.contains('backups')) {
            const store = db.createObjectStore('backups', { keyPath: 'id' })
            store.createIndex('timestamp', 'timestamp', { unique: false })
            store.createIndex('companyId', 'companyId', { unique: false })
            console.log('✨ Backup history object store created')
          } else if (oldVersion < 2) {
            // Add companyId index for existing databases (version 2 upgrade)
            const store = transaction.objectStore('backups')
            if (!store.indexNames.contains('companyId')) {
              store.createIndex('companyId', 'companyId', { unique: false })
              console.log('✨ Added companyId index to existing backup history')
            }
          }
        },
      })

      console.log('📂 Database opened successfully')
      await db.add('backups', entry)
      console.log('✅ Backup added to history successfully:', entry)

      // Verify it was saved
      const verify = await db.get('backups', entry.id)
      console.log('🔍 Verification - backup in DB:', verify)
    } catch (error) {
      console.error('❌ Failed to save backup to history:', error)
    }
  }

  /**
   * Handle folder selection for backups
   * Uses File System Access API to request folder permission
   */
  const handleChangeLocation = async () => {
    setError(null)

    try {
      // Check browser support for File System Access API
      if (!('showDirectoryPicker' in window)) {
        setError(
          'Your browser doesn\'t support automatic backups. Please use Chrome or Edge for this feature, or use the "Backup Now" button to download backups manually.'
        )
        return
      }

      // Show directory picker
      // @ts-expect-error - File System Access API not in TypeScript DOM types yet
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      })

      // Verify we can write to this directory (test for system folders)
      try {
        const testFileName = `.test-${Date.now()}.tmp`
        const testFileHandle = await directoryHandle.getFileHandle(testFileName, { create: true })
        await testFileHandle.remove() // Clean up test file
      } catch (testError) {
        // System folder or insufficient permissions
        setError(
          "⚠️ Can't use this folder - it contains system files.\n\n" +
            'Please create a NEW FOLDER specifically for backups:\n' +
            '1. Click "Change Location" again\n' +
            '2. Right-click → "New Folder"\n' +
            '3. Name it something like "Audacious Backups"\n' +
            '4. Select that new folder\n\n' +
            'Avoid: Desktop, Downloads, or system folders.'
        )
        return
      }

      // Get the directory name for display
      const directoryPath = directoryHandle.name

      // Store the handle in IndexedDB
      const storeResult = await storeDirectoryHandle(directoryHandle)

      if (!storeResult.success) {
        setError(`We couldn't save your backup location: ${storeResult.error || 'Unknown error'}`)
        return
      }

      // Update backup status with new location
      setBackupStatus(prev => ({
        enabled: true,
        location: directoryPath,
        lastBackup: prev?.lastBackup || null,
        nextBackup: prev?.nextBackup || null,
        error: null,
      }))

      // Notify parent of settings change
      onSettingsChange?.()

      // Show success message briefly
      setBackupSuccess(true)
      setTimeout(() => setBackupSuccess(false), 3000)
    } catch (err) {
      // User cancelled or permission denied
      if ((err as Error).name === 'AbortError') {
        // User cancelled - not an error, just silently return
        return
      } else {
        const errorMessage = (err as Error).message || ''

        // Check for system folder error
        if (errorMessage.includes('system') || errorMessage.includes('permission')) {
          setError(
            "⚠️ Can't use this folder.\n\nPlease create a NEW FOLDER specifically for backups (avoid Desktop, Downloads, or system folders)."
          )
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Oops! We couldn't open the folder picker. Please try again."
          )
        }
      }
    }
  }

  /**
   * Handle manual backup creation
   * Opens the EncryptedBackup modal which handles mode selection,
   * passphrase/auto-key management, and sentinel verification.
   *
   * IMPORTANT: Do NOT bypass this with direct BackupService.createBackup() calls.
   * The modal ensures:
   * - Mode selection (auto vs manual) with persistent preference
   * - Passphrase verification via encrypted sentinel (manual mode)
   * - Auto-key storage in folder and IndexedDB fallback (auto mode)
   * - Consistent encryption across all backups
   */
  const handleBackupNow = () => {
    setShowBackupModal(true)
  }

  /**
   * Handle successful backup completion from EncryptedBackup modal
   */
  const handleBackupComplete = async () => {
    setShowBackupModal(false)
    setBackupSuccess(true)
    setBackupSavedToFolder(true)

    // Reload backup status and history
    await loadBackupData()

    // Auto-hide success message after 5 seconds
    setTimeout(() => {
      setBackupSuccess(false)
      setBackupSavedToFolder(false)
    }, 5000)

    onSettingsChange?.()
  }

  /**
   * Handle backup download from history
   */
  const handleDownloadBackup = async (entry: BackupHistoryEntry) => {
    try {
      console.log('📥 Attempting to download backup:', entry.filename)

      // Get the backup folder handle
      const dirHandle = await retrieveDirectoryHandle()

      if (!dirHandle) {
        setError('Cannot download backup: backup folder no longer accessible. Please check folder permissions in Settings.')
        return
      }

      console.log('📂 Got directory handle:', dirHandle.name)

      // Try to get the file from the backup folder
      try {
        const fileHandle = await dirHandle.getFileHandle(entry.filename)
        const file = await fileHandle.getFile()

        console.log('✅ Found backup file:', file.name, 'Size:', file.size)

        // Create download link
        const blob = new Blob([await file.text()], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = entry.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        console.log('⬇️ Download triggered for:', entry.filename)
      } catch (fileError) {
        console.error('❌ File not found in backup folder:', fileError)
        setError(`Cannot find backup file "${entry.filename}" in your backup folder. It may have been moved or deleted.`)
      }
    } catch (err) {
      console.error('❌ Download error:', err)
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
    <div id="data-safety" className={styles.container}>
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
                  Backup Folder Configured
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
          {backupSavedToFolder
            ? `✅ Backup complete! Your data is safe and sound. The backup was saved to your backup folder: ${backupStatus?.location || 'your selected folder'}`
            : '⬇️ Backup complete! Your data is safe and sound. The backup file has been downloaded to your Downloads folder.'}
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
              {backupStatus?.location ? 'Change Folder' : 'Choose Backup Folder'}
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

            <Button
              variant="secondary"
              onClick={() => setShowRestoreModal(true)}
              aria-label="Restore from backup file"
            >
              Restore from Backup
            </Button>
          </div>

          {/* Informational Message */}
          {!backupStatus?.enabled && (
            <div className={styles.infoBox}>
              <p className={styles.infoText}>
                <strong>Want to save backups to a folder?</strong> Set up a backup location and use the
                "Backup Now" button to save encrypted backups to your computer. Automatic scheduling
                coming soon!
              </p>
            </div>
          )}

          {backupStatus?.enabled && (
            <div className={styles.infoBox}>
              <p className={styles.infoText}>
                Your backup folder is configured at <strong>{backupStatus.location}</strong>. Click
                "Backup Now" to save an encrypted backup. Your backup is protected by a passphrase
                that only you know.
              </p>
              <p className={styles.infoText} style={{ marginTop: '0.5rem', fontSize: '0.9em', opacity: 0.8 }}>
                📅 <em>Automatic daily backups coming soon! For now, use "Backup Now" to manually save
                your data.</em>
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
                <strong>Passphrase encryption:</strong> Your manual backups are encrypted with a
                passphrase that only you know. Without it, no one can read your backup files.
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

      {/* Create Backup Modal */}
      <EncryptedBackup
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        initialMode="backup"
        hideModeToggle={true}
        onBackupComplete={handleBackupComplete}
        companyId={companyId}
      />

      {/* Restore from Backup Modal */}
      <EncryptedBackup
        isOpen={showRestoreModal}
        onClose={() => {
          setShowRestoreModal(false)
          // Reload backup data to show any restored entries
          loadBackupData()
        }}
        initialMode="restore"
        hideModeToggle={true}
        onRestoreComplete={() => {
          // Don't auto-reload - let EncryptedBackup show the restore complete state
          // User will click "Close and View Data" which triggers onClose
          setShowRestoreModal(false)
          // Reload backup data to show restored entries in history
          loadBackupData()
        }}
        companyId={companyId}
      />
    </div>
  )
}

DataSafetyPanel.displayName = 'DataSafetyPanel'
