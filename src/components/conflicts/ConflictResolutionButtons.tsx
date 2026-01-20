import { Button } from '../core/Button'
import type { DetectedConflict, CRDTEntity } from '../../types/crdt.types'
import styles from './ConflictResolutionButtons.module.css'

export interface ConflictResolutionButtonsProps<T extends CRDTEntity = CRDTEntity> {
  /**
   * The conflict to resolve
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
   * Callback when "Merge Fields" is clicked
   */
  onMergeFields?: (conflictId: string) => void
  /**
   * Callback when "Custom" is clicked (opens detail view)
   */
  onCustom?: (conflictId: string) => void
  /**
   * Whether actions are currently processing
   */
  loading?: boolean
  /**
   * Layout variant
   */
  layout?: 'horizontal' | 'vertical'
  /**
   * Size of buttons
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Show all buttons or just primary actions
   */
  showAllOptions?: boolean
}

/**
 * ConflictResolutionButtons component provides action controls for resolving conflicts
 *
 * Features:
 * - Four resolution strategies: Keep Mine, Keep Theirs, Merge Fields, Custom
 * - Keyboard accessible (Tab navigation, Enter/Space activation)
 * - Screen reader friendly with aria-labels
 * - WCAG 2.1 AA compliant
 * - Responsive layout (horizontal/vertical)
 * - Steadiness-style messaging
 *
 * @example
 * ```tsx
 * <ConflictResolutionButtons
 *   conflict={conflict}
 *   onKeepLocal={handleKeepLocal}
 *   onKeepRemote={handleKeepRemote}
 *   onMergeFields={handleMerge}
 *   onCustom={handleCustom}
 * />
 * ```
 */
export function ConflictResolutionButtons<T extends CRDTEntity = CRDTEntity>({
  conflict,
  onKeepLocal,
  onKeepRemote,
  onMergeFields,
  onCustom,
  loading = false,
  layout = 'horizontal',
  size = 'md',
  showAllOptions = true,
}: ConflictResolutionButtonsProps<T>) {
  const handleKeepLocal = () => {
    onKeepLocal(conflict.id)
  }

  const handleKeepRemote = () => {
    onKeepRemote(conflict.id)
  }

  const handleMergeFields = () => {
    if (onMergeFields) {
      onMergeFields(conflict.id)
    }
  }

  const handleCustom = () => {
    if (onCustom) {
      onCustom(conflict.id)
    }
  }

  return (
    <div
      className={`${styles.buttonGroup} ${styles[layout]}`}
      role="group"
      aria-label="Conflict resolution options"
    >
      <Button
        variant="primary"
        size={size}
        onClick={handleKeepLocal}
        disabled={loading}
        loading={loading}
      >
        Keep Mine
      </Button>

      <Button
        variant="outline"
        size={size}
        onClick={handleKeepRemote}
        disabled={loading}
      >
        Keep Theirs
      </Button>

      {showAllOptions && onMergeFields && (
        <Button
          variant="secondary"
          size={size}
          onClick={handleMergeFields}
          disabled={loading}
        >
          Merge Fields
        </Button>
      )}

      {showAllOptions && onCustom && (
        <Button
          variant="ghost"
          size={size}
          onClick={handleCustom}
          disabled={loading}
        >
          Custom
        </Button>
      )}
    </div>
  )
}
