import { useState, useEffect } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../core/Button'
import { ConflictResolutionButtons } from './ConflictResolutionButtons'
import { getFieldConflicts } from '../../services/conflictResolution.service'
import type { DetectedConflict, CRDTEntity, FieldConflict } from '../../types/crdt.types'
import styles from './ConflictDetailView.module.css'

export interface ConflictDetailViewProps<T extends CRDTEntity = CRDTEntity> {
  /**
   * The conflict to display
   */
  conflict: DetectedConflict<T>
  /**
   * Callback when "Keep Mine" is clicked
   */
  onKeepLocal: (conflictId: string) => void
  /**
   * Callback when "Keep Theirs" is clicked
   */
  onKeepRemote: (conflictId: string) => void
  /**
   * Callback when custom merge is submitted
   */
  onCustomMerge: (conflictId: string, customMerge: Record<string, unknown>) => void
  /**
   * Callback when back/close is clicked
   */
  onBack?: () => void
  /**
   * Whether resolution is in progress
   */
  loading?: boolean
}

/**
 * ConflictDetailView component shows field-by-field comparison of conflicting versions
 *
 * Features:
 * - Side-by-side diff view with conflicting fields highlighted
 * - Field-level selection for custom merge
 * - Keyboard accessible (Tab navigation, Space/Enter for selection)
 * - Screen reader friendly with aria-labels and live regions
 * - WCAG 2.1 AA compliant (color contrast, focus indicators)
 * - Steadiness-style messaging
 * - Shows suggested resolution for each field
 *
 * @example
 * ```tsx
 * <ConflictDetailView
 *   conflict={conflict}
 *   onKeepLocal={handleKeepLocal}
 *   onKeepRemote={handleKeepRemote}
 *   onCustomMerge={handleCustomMerge}
 *   onBack={handleBack}
 * />
 * ```
 */
export function ConflictDetailView<T extends CRDTEntity = CRDTEntity>({
  conflict,
  onKeepLocal,
  onKeepRemote,
  onCustomMerge,
  onBack,
  loading = false,
}: ConflictDetailViewProps<T>) {
  const [fieldConflicts, setFieldConflicts] = useState<FieldConflict[]>([])
  const [selectedValues, setSelectedValues] = useState<Record<string, 'local' | 'remote'>>({})
  const [customMode, setCustomMode] = useState(false)

  // Load field-level conflict details
  useEffect(() => {
    const fields = getFieldConflicts(conflict)
    setFieldConflicts(fields)

    // Initialize selections to local by default
    const initialSelections: Record<string, 'local' | 'remote'> = {}
    fields.forEach(field => {
      initialSelections[field.fieldName] = 'local'
    })
    setSelectedValues(initialSelections)
  }, [conflict])

  const handleFieldSelection = (fieldName: string, choice: 'local' | 'remote') => {
    setSelectedValues(prev => ({
      ...prev,
      [fieldName]: choice,
    }))
  }

  const handleCustomSubmit = () => {
    // Build custom merge object based on selections
    const customMerge: Record<string, unknown> = {}

    fieldConflicts.forEach(field => {
      const choice = selectedValues[field.fieldName]
      customMerge[field.fieldName] = choice === 'local' ? field.localValue : field.remoteValue
    })

    onCustomMerge(conflict.id, customMerge)
  }

  const formatValue = (value: unknown): string => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'string') return value
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'boolean') return value.toString()
    if (Array.isArray(value)) return `[${value.length} items]`
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const entityDescription = `${conflict.entityType} ${conflict.entityId.substring(0, 8)}`

  return (
    <div className={styles.detailView}>
      {/* Header */}
      <div className={styles.header}>
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            aria-label="Go back to conflict list"
          >
            ← Back
          </Button>
        )}
        <div>
          <h2 className={styles.title}>Resolve Conflict</h2>
          <p className={styles.subtitle}>
            {entityDescription} was updated in two places at once. Choose which version to keep for each field.
          </p>
        </div>
      </div>

      {/* Conflict Metadata */}
      <Card variant="bordered" padding="md" className={styles.metadata}>
        <div className={styles.metadataGrid}>
          <div>
            <span className={styles.metadataLabel}>Entity Type:</span>
            <span className={styles.metadataValue}>{conflict.entityType}</span>
          </div>
          <div>
            <span className={styles.metadataLabel}>Severity:</span>
            <span className={`${styles.metadataValue} ${styles[`severity-${conflict.severity}`]}`}>
              {conflict.severity}
            </span>
          </div>
          <div>
            <span className={styles.metadataLabel}>Conflicting Fields:</span>
            <span className={styles.metadataValue}>{conflict.conflictingFields.length}</span>
          </div>
          <div>
            <span className={styles.metadataLabel}>Detected:</span>
            <span className={styles.metadataValue}>
              {new Date(conflict.detectedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      {!customMode && (
        <div className={styles.quickActions}>
          <p className={styles.quickActionsLabel}>Quick actions:</p>
          <ConflictResolutionButtons
            conflict={conflict}
            onKeepLocal={onKeepLocal}
            onKeepRemote={onKeepRemote}
            onCustom={() => setCustomMode(true)}
            loading={loading}
            layout="horizontal"
            showAllOptions={false}
          />
          <Button
            variant="secondary"
            size="md"
            onClick={() => setCustomMode(true)}
            disabled={loading}
          >
            Choose Field by Field
          </Button>
        </div>
      )}

      {/* Field-by-Field Comparison */}
      {customMode && (
        <div className={styles.fieldComparison}>
          <div className={styles.fieldComparisonHeader}>
            <h3>Field-by-Field Comparison</h3>
            <p>Select which version to keep for each field:</p>
          </div>

          <div className={styles.fieldList} role="list">
            {fieldConflicts.map((field, _index) => (
              <Card
                key={field.fieldName}
                variant="bordered"
                padding="md"
                className={styles.fieldCard}
                role="listitem"
                aria-label={`Field: ${field.fieldName}`}
              >
                <div className={styles.fieldHeader}>
                  <h4 className={styles.fieldName}>{field.fieldName}</h4>
                  {field.canAutoResolve && field.suggestedResolution !== undefined && (
                    <span className={styles.suggestedBadge} aria-label="Suggested resolution available">
                      Suggested: {formatValue(field.suggestedResolution)}
                    </span>
                  )}
                </div>

                <div className={styles.fieldOptions}>
                  {/* Local Version */}
                  <button
                    type="button"
                    className={`${styles.fieldOption} ${
                      selectedValues[field.fieldName] === 'local' ? styles.selected : ''
                    }`}
                    onClick={() => handleFieldSelection(field.fieldName, 'local')}
                    aria-pressed={selectedValues[field.fieldName] === 'local'}
                    aria-label={`Keep my version: ${formatValue(field.localValue)}`}
                  >
                    <div className={styles.optionHeader}>
                      <span className={styles.optionLabel}>My Version</span>
                      <span
                        className={styles.checkmark}
                        aria-hidden="true"
                      >
                        {selectedValues[field.fieldName] === 'local' ? '✓' : ''}
                      </span>
                    </div>
                    <div className={styles.optionValue}>
                      <code>{formatValue(field.localValue)}</code>
                    </div>
                  </button>

                  {/* Remote Version */}
                  <button
                    type="button"
                    className={`${styles.fieldOption} ${
                      selectedValues[field.fieldName] === 'remote' ? styles.selected : ''
                    }`}
                    onClick={() => handleFieldSelection(field.fieldName, 'remote')}
                    aria-pressed={selectedValues[field.fieldName] === 'remote'}
                    aria-label={`Keep their version: ${formatValue(field.remoteValue)}`}
                  >
                    <div className={styles.optionHeader}>
                      <span className={styles.optionLabel}>Their Version</span>
                      <span
                        className={styles.checkmark}
                        aria-hidden="true"
                      >
                        {selectedValues[field.fieldName] === 'remote' ? '✓' : ''}
                      </span>
                    </div>
                    <div className={styles.optionValue}>
                      <code>{formatValue(field.remoteValue)}</code>
                    </div>
                  </button>
                </div>
              </Card>
            ))}
          </div>

          {/* Custom Merge Actions */}
          <div className={styles.customActions}>
            <Button
              variant="outline"
              size="md"
              onClick={() => setCustomMode(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCustomSubmit}
              disabled={loading}
              loading={loading}
            >
              Apply Selection
            </Button>
          </div>
        </div>
      )}

      {/* Screen reader live region for status updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
      >
        {loading ? 'Resolving conflict...' : ''}
      </div>
    </div>
  )
}
