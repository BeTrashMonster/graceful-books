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

import { useEffect } from 'react';
import { Modal } from '../../modals/Modal';
import { RecipeBuilder } from '../RecipeBuilder';

export interface RecipeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  finishedProductId: string;
  productName: string;
  onNavigateToInvoice?: (invoiceId: string, invoiceNumber: string) => void;
}

export function RecipeBuilderModal({
  isOpen,
  onClose,
  finishedProductId,
  productName,
  onNavigateToInvoice,
}: RecipeBuilderModalProps) {
  // Apply purple header styling to modal
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return;

      const modalTitle = dialog.querySelector('#modal-title') as HTMLElement;
      const modalHeader = modalTitle?.parentElement as HTMLElement;
      const closeButton = dialog.querySelector('[aria-label="Close modal"]') as HTMLElement;

      if (modalHeader) {
        modalHeader.style.backgroundColor = '#4b006e';
        modalHeader.style.padding = '0.75rem 1.5rem';
        modalHeader.style.borderBottom = 'none';
      }

      if (modalTitle) {
        modalTitle.style.color = '#ffffff';
      }

      if (closeButton) {
        closeButton.style.color = '#ffffff';
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

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
        onNavigateToInvoice={onNavigateToInvoice}
      />
    </Modal>
  );
}
