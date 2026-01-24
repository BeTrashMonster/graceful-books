import { Select } from '../forms/Select';
import { Button } from '../core/Button';
import type { CPGDistributor } from '../../db/schema/cpg.schema';
import styles from './DistributorSelector.module.css';

export interface DistributorSelectorProps {
  /**
   * List of available distributors
   */
  distributors: CPGDistributor[];
  /**
   * Currently selected distributor ID
   */
  selectedDistributorId: string | null;
  /**
   * Callback when distributor selection changes
   */
  onSelect: (distributorId: string) => void;
  /**
   * Callback when "Add New Distributor" is clicked
   */
  onAddNew: () => void;
  /**
   * Loading state
   */
  loading?: boolean;
  /**
   * Disabled state
   */
  disabled?: boolean;
}

/**
 * DistributorSelector Component
 *
 * Dropdown to select distributor with "Add New Distributor" button.
 *
 * Requirements: Group C2 - Distribution Cost Analyzer
 *
 * Features:
 * - Dropdown of available distributors
 * - "Add New Distributor" button
 * - Loading states
 * - Keyboard accessible
 *
 * @example
 * ```tsx
 * <DistributorSelector
 *   distributors={distributors}
 *   selectedDistributorId={selectedId}
 *   onSelect={(id) => setSelectedId(id)}
 *   onAddNew={() => setShowAddForm(true)}
 * />
 * ```
 */
export function DistributorSelector({
  distributors,
  selectedDistributorId,
  onSelect,
  onAddNew,
  loading = false,
  disabled = false,
}: DistributorSelectorProps) {
  const activeDistributors = distributors.filter(
    (d) => d.active && d.deleted_at === null
  );

  const selectOptions = activeDistributors.map((distributor) => ({
    value: distributor.id,
    label: distributor.name,
  }));

  return (
    <div className={styles.container}>
      <div className={styles.selectWrapper}>
        <Select
          label="Distributor"
          placeholder="Select a distributor"
          options={selectOptions}
          value={selectedDistributorId || ''}
          onChange={(e) => onSelect(e.target.value)}
          disabled={disabled || loading}
          fullWidth
          required
        />
      </div>

      <div className={styles.addButtonWrapper}>
        <Button
          variant="outline"
          onClick={onAddNew}
          disabled={disabled || loading}
          iconBefore={<span>+</span>}
        >
          Add New Distributor
        </Button>
      </div>

      {activeDistributors.length === 0 && !loading && (
        <p className={styles.emptyState} role="status">
          No distributors found. Create your first distributor to get started.
        </p>
      )}
    </div>
  );
}
