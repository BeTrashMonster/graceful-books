import { useState, useEffect } from 'react'
import { Modal } from '../modals/Modal'
import { Button } from '../core/Button'
import { Card } from '../ui/Card'
import { ConflictDetailView } from './ConflictDetailView'
import { ConflictResolutionButtons } from './ConflictResolutionButtons'
import {
  getUnresolvedConflicts,
  updateConflictResolution,
  markConflictViewed,
} from '../../store/conflicts'
import {
  applyManualResolution,
  resolveConflictAuto,
} from '../../services/conflictResolution.service'
import type {
  ConflictHistoryEntry,
  DetectedConflict,
  ManualResolutionDecision,
} from '../../types/crdt.types'
import styles from './ConflictListModal.module.css'

export interface ConflictListModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean
  /**
   * Callback when modal should close
   */
  onClose: () => void
  /**
   * Callback when a conflict is resolved
   */
  onConflictResolved?: (conflictId: string) => void
}

/**
 * ConflictListModal component displays all unresolved conflicts
 *
 * Features:
 * - List view of all conflicts with metadata
 * - Click to expand detail view
 * - Quick resolution actions in list view
 * - Full detail view with field-by-field comparison
 * - Keyboard accessible (Tab, Enter, Esc)
 * - Screen reader friendly with aria-labels
 * - WCAG 2.1 AA compliant
 * - Steadiness-style messaging
 * - Real-time updates when conflicts are resolved
 *
 * @example
 * ```tsx
 * <ConflictListModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   onConflictResolved={handleResolved}
 * />
 * ```
 */
export function ConflictListModal({
  isOpen,
  onClose,
  onConflictResolved,
}: ConflictListModalProps) {
  const [conflicts, setConflicts] = useState<ConflictHistoryEntry[]>([])
  const [selectedConflict, setSelectedConflict] = useState<DetectedConflict | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string>('')

  // Load unresolved conflicts
  useEffect(() => {
    if (!isOpen) return

    loadConflicts()
  }, [isOpen])

  const loadConflicts = async () => {
    setLoading(true)
    try {
      const unresolvedConflicts = await getUnresolvedConflicts()
      setConflicts(unresolvedConflicts)
    } catch (error) {
      console.error('Failed to load conflicts:', error)
    } finally {
      setLoading(false)
    }
  }

  const parseConflictFromHistory = (entry: ConflictHistoryEntry): DetectedConflict => {
    return {
      id: entry.conflictId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      conflictType: entry.conflictType,
      severity: entry.severity,
      localVersion: JSON.parse(entry.localSnapshot),
      remoteVersion: JSON.parse(entry.remoteSnapshot),
      conflictingFields: [], // Will be calculated by service
      detectedAt: entry.detectedAt,
      deviceId: '', // Not needed for resolution
    }
  }

  const handleConflictClick = async (entry: ConflictHistoryEntry) => {
    const conflict = parseConflictFromHistory(entry)
    setSelectedConflict(conflict)

    // Mark as viewed
    try {
      await markConflictViewed(entry.conflictId)
    } catch (error) {
      console.error('Failed to mark conflict as viewed:', error)
    }
  }

  const handleKeepLocal = async (conflictId: string) => {
    setResolvingConflictId(conflictId)
    try {
      const conflict = conflicts.find(c => c.conflictId === conflictId)
      if (!conflict) return

      const detectedConflict = parseConflictFromHistory(conflict)

      const decision: ManualResolutionDecision = {
        conflictId,
        resolvedBy: 'current-user', // TODO: Get from auth context
        strategy: 'keep_local',
      }

      const resolution = applyManualResolution(detectedConflict, decision)
      await updateConflictResolution(conflictId, resolution)

      showSuccessMessage('Conflict resolved! Your version has been saved.')
      await loadConflicts()
      setSelectedConflict(null)

      if (onConflictResolved) {
        onConflictResolved(conflictId)
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      alert('Oops! Something unexpected happened while resolving the conflict. Please try again.')
    } finally {
      setResolvingConflictId(null)
    }
  }

  const handleKeepRemote = async (conflictId: string) => {
    setResolvingConflictId(conflictId)
    try {
      const conflict = conflicts.find(c => c.conflictId === conflictId)
      if (!conflict) return

      const detectedConflict = parseConflictFromHistory(conflict)

      const decision: ManualResolutionDecision = {
        conflictId,
        resolvedBy: 'current-user', // TODO: Get from auth context
        strategy: 'keep_remote',
      }

      const resolution = applyManualResolution(detectedConflict, decision)
      await updateConflictResolution(conflictId, resolution)

      showSuccessMessage('Conflict resolved! Their version has been saved.')
      await loadConflicts()
      setSelectedConflict(null)

      if (onConflictResolved) {
        onConflictResolved(conflictId)
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      alert('Oops! Something unexpected happened while resolving the conflict. Please try again.')
    } finally {
      setResolvingConflictId(null)
    }
  }

  const handleMergeFields = async (conflictId: string) => {
    setResolvingConflictId(conflictId)
    try {
      const conflict = conflicts.find(c => c.conflictId === conflictId)
      if (!conflict) return

      const detectedConflict = parseConflictFromHistory(conflict)

      const resolution = resolveConflictAuto(detectedConflict, 'auto_merge' as any)
      await updateConflictResolution(conflictId, resolution)

      showSuccessMessage('Conflict resolved! We automatically merged both versions.')
      await loadConflicts()
      setSelectedConflict(null)

      if (onConflictResolved) {
        onConflictResolved(conflictId)
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      alert('Oops! Something unexpected happened while resolving the conflict. Please try again.')
    } finally {
      setResolvingConflictId(null)
    }
  }

  const handleCustomMerge = async (conflictId: string, customMerge: Record<string, unknown>) => {
    setResolvingConflictId(conflictId)
    try {
      const conflict = conflicts.find(c => c.conflictId === conflictId)
      if (!conflict) return

      const detectedConflict = parseConflictFromHistory(conflict)

      const decision: ManualResolutionDecision = {
        conflictId,
        resolvedBy: 'current-user', // TODO: Get from auth context
        strategy: 'custom_merge',
        customMerge,
      }

      const resolution = applyManualResolution(detectedConflict, decision)
      await updateConflictResolution(conflictId, resolution)

      showSuccessMessage('Conflict resolved! Your custom selection has been saved.')
      await loadConflicts()
      setSelectedConflict(null)

      if (onConflictResolved) {
        onConflictResolved(conflictId)
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      alert('Oops! Something unexpected happened while resolving the conflict. Please try again.')
    } finally {
      setResolvingConflictId(null)
    }
  }

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 5000)
  }

  const handleBack = () => {
    setSelectedConflict(null)
  }

  const formatEntityName = (entry: ConflictHistoryEntry): string => {
    const local = JSON.parse(entry.localSnapshot)

    switch (entry.entityType) {
      case 'Transaction':
        return local.transaction_number || `Transaction ${entry.entityId.substring(0, 8)}`
      case 'Account':
        return local.name || `Account ${entry.entityId.substring(0, 8)}`
      case 'Contact':
        return local.name || `Contact ${entry.entityId.substring(0, 8)}`
      case 'Product':
        return local.name || `Product ${entry.entityId.substring(0, 8)}`
      case 'Invoice':
        return local.invoice_number || `Invoice ${entry.entityId.substring(0, 8)}`
      default:
        return `${entry.entityType} ${entry.entityId.substring(0, 8)}`
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={selectedConflict ? 'Conflict Details' : 'Conflicts Need Your Attention'}
      size={selectedConflict ? 'xl' : 'lg'}
      closeOnBackdropClick={!resolvingConflictId}
      closeOnEscape={!resolvingConflictId}
    >
      {/* Success Message */}
      {successMessage && (
        <div
          className={styles.successMessage}
          role="alert"
          aria-live="assertive"
        >
          <svg className={styles.successIcon} viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Detail View */}
      {selectedConflict && (
        <ConflictDetailView
          conflict={selectedConflict}
          onKeepLocal={handleKeepLocal}
          onKeepRemote={handleKeepRemote}
          onCustomMerge={handleCustomMerge}
          onBack={handleBack}
          loading={resolvingConflictId === selectedConflict.id}
        />
      )}

      {/* List View */}
      {!selectedConflict && (
        <>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner} aria-label="Loading conflicts">
                <span className={styles.spinnerCircle} />
              </div>
              <p>Loading conflicts...</p>
            </div>
          )}

          {!loading && conflicts.length === 0 && (
            <div className={styles.emptyState}>
              <svg className={styles.emptyIcon} viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <h3>All clear!</h3>
              <p>There are no conflicts that need your attention right now.</p>
            </div>
          )}

          {!loading && conflicts.length > 0 && (
            <div className={styles.conflictList}>
              <p className={styles.listDescription}>
                These items were updated in two places at once. Choose which version to keep for each one.
              </p>

              <div className={styles.conflicts} role="list">
                {conflicts.map((entry) => (
                  <Card
                    key={entry.conflictId}
                    variant="bordered"
                    padding="md"
                    className={styles.conflictCard}
                    role="listitem"
                  >
                    <div className={styles.conflictHeader}>
                      <div className={styles.conflictInfo}>
                        <h3 className={styles.conflictTitle}>
                          {formatEntityName(entry)}
                        </h3>
                        <div className={styles.conflictMeta}>
                          <span className={styles.entityType}>{entry.entityType}</span>
                          <span className={styles.separator}>•</span>
                          <span className={`${styles.severity} ${styles[`severity-${entry.severity}`]}`}>
                            {entry.severity}
                          </span>
                          <span className={styles.separator}>•</span>
                          <span className={styles.timestamp}>
                            {new Date(entry.detectedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className={styles.conflictDescription}>
                          {entry.conflictType === 'delete_update'
                            ? 'One version was deleted while the other was updated.'
                            : `${JSON.parse(entry.localSnapshot).updated_at && JSON.parse(entry.remoteSnapshot).updated_at
                                ? 'Both versions were modified at the same time.'
                                : 'Conflicting changes detected.'}`}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleConflictClick(entry)}
                        aria-label={`View details for ${formatEntityName(entry)}`}
                      >
                        View Details →
                      </Button>
                    </div>

                    <div className={styles.conflictActions}>
                      <ConflictResolutionButtons
                        conflict={parseConflictFromHistory(entry)}
                        onKeepLocal={handleKeepLocal}
                        onKeepRemote={handleKeepRemote}
                        onMergeFields={handleMergeFields}
                        onCustom={() => handleConflictClick(entry)}
                        loading={resolvingConflictId === entry.conflictId}
                        layout="horizontal"
                        size="sm"
                        showAllOptions={true}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
