/**
 * Recipe Builder Modal
 *
 * Modal wrapper for the RecipeBuilder component.
 * Opens when user clicks "Edit Recipe" on a finished product.
 *
 * Requirements:
 * - Phase 1, Group B: Recipe Builder UI
 * - X-only close (closeOnBackdropClick={false})
 * - Dispatch CustomEvent on save
 */

import { Modal } from '../../modals/Modal';
import { RecipeBuilder } from '../RecipeBuilder';

export interface RecipeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  finishedProductId: string;
  productName: string;
}

export function RecipeBuilderModal({
  isOpen,
  onClose,
  finishedProductId,
  productName,
}: RecipeBuilderModalProps) {
  const handleSave = () => {
    // Close modal on successful save
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Recipe: ${productName}`}
      size="xl"
      closeOnBackdropClick={false}
    >
      <RecipeBuilder
        finishedProductId={finishedProductId}
        productName={productName}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </Modal>
  );
}
