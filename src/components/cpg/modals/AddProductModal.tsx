/**
 * Add/Edit Product Modal
 *
 * Modal for creating new finished products or editing existing ones.
 * Includes validation for name uniqueness, SKU uniqueness, and MSRP format.
 */

import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { Modal } from '../../modals/Modal';
import { Input } from '../../forms/Input';
import { Button } from '../../core/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../db/database';
import {
  createDefaultCPGFinishedProduct,
  validateCPGFinishedProduct,
  type CPGFinishedProduct,
} from '../../../db/schema/cpg.schema';
import styles from './CPGModals.module.css';

export interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingProduct?: CPGFinishedProduct | null;
}

const UNIT_OPTIONS = [
  { value: 'each', label: 'Each' },
  { value: 'case', label: 'Case' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'pack', label: 'Pack' },
];

export function AddProductModal({
  isOpen,
  onClose,
  onSuccess,
  editingProduct,
}: AddProductModalProps) {
  const { companyId, deviceId } = useAuth();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [msrp, setMsrp] = useState('');
  const [description, setDescription] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('each');
  const [piecesPerUnit, setPiecesPerUnit] = useState('1');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setSku(editingProduct.sku || '');
      setMsrp(editingProduct.msrp || '');
      setDescription(editingProduct.description || '');
      setUnitOfMeasure(editingProduct.unit_of_measure);
      setPiecesPerUnit(editingProduct.pieces_per_unit.toString());
    } else {
      // Reset form for new product
      setName('');
      setSku('');
      setMsrp('');
      setDescription('');
      setUnitOfMeasure('each');
      setPiecesPerUnit('1');
    }
    setErrors({});
  }, [editingProduct, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!companyId) {
      setErrors({ form: 'Not authenticated' });
      return;
    }

    // Parse pieces per unit
    const piecesPerUnitNum = parseInt(piecesPerUnit, 10);
    if (isNaN(piecesPerUnitNum) || piecesPerUnitNum < 1) {
      setErrors({ piecesPerUnit: 'Pieces per unit must be a number >= 1' });
      return;
    }

    // Get all existing products for validation
    const allProducts = await db.cpgFinishedProducts
      .where('company_id')
      .equals(companyId)
      .and((p) => p.deleted_at === null)
      .toArray();

    // Create product object
    const productData: Partial<CPGFinishedProduct> = editingProduct
      ? {
          ...editingProduct,
          name: name.trim(),
          sku: sku.trim() || null,
          msrp: msrp.trim() || null,
          description: description.trim() || null,
          unit_of_measure: unitOfMeasure,
          pieces_per_unit: piecesPerUnitNum,
          updated_at: Date.now(),
        }
      : {
          ...createDefaultCPGFinishedProduct(companyId, name.trim(), deviceId || 'default'),
          id: nanoid(),
          sku: sku.trim() || null,
          msrp: msrp.trim() || null,
          description: description.trim() || null,
          unit_of_measure: unitOfMeasure,
          pieces_per_unit: piecesPerUnitNum,
        };

    // Validate
    const validationErrors = validateCPGFinishedProduct(productData, allProducts);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      validationErrors.forEach((err) => {
        if (err.includes('name')) errorMap.name = err;
        else if (err.includes('SKU')) errorMap.sku = err;
        else if (err.includes('MSRP')) errorMap.msrp = err;
        else if (err.includes('pieces_per_unit')) errorMap.piecesPerUnit = err;
        else errorMap.form = err;
      });
      setErrors(errorMap);
      return;
    }

    // Save to database
    setIsSubmitting(true);
    try {
      if (editingProduct) {
        // Update existing product
        await db.cpgFinishedProducts.update(editingProduct.id, productData);
      } else {
        // Add new product
        await db.cpgFinishedProducts.add(productData as CPGFinishedProduct);
      }

      // Dispatch update event
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'product' } })
      );

      // Call onSuccess and close
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('Failed to save product:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setErrors({ form: `Failed to save product: ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSku('');
    setMsrp('');
    setDescription('');
    setUnitOfMeasure('each');
    setPiecesPerUnit('1');
    setErrors({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingProduct ? 'Edit Product' : 'Add New Product'}
      size="md"
      closeOnBackdropClick={false}
      footer={
        <div className={styles.modalFooter}>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : editingProduct
              ? 'Update Product'
              : 'Add Product'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors.form && (
          <div className={styles.errorAlert} role="alert">
            {errors.form}
          </div>
        )}

        <Input
          label="Product Name"
          placeholder="ex: 1oz Body Oil, 5oz Body Oil"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
          fullWidth
          autoFocus
          helperText="The name of your finished product"
        />

        <Input
          label="SKU (Optional)"
          placeholder="ex: BO-1OZ"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          error={errors.sku}
          fullWidth
          helperText="Stock Keeping Unit - must be unique if provided"
        />

        <Input
          label="MSRP (Optional)"
          placeholder="ex: 10.00"
          value={msrp}
          onChange={(e) => setMsrp(e.target.value)}
          error={errors.msrp}
          fullWidth
          helperText="Manufacturer's Suggested Retail Price"
        />

        <Input
          label="Description (Optional)"
          placeholder="ex: Premium lavender body oil in a 1oz bottle"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          helperText="Brief description of this product"
        />

        <div>
          <label htmlFor="unitOfMeasure" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9375rem' }}>
            Unit of Measure
          </label>
          <select
            id="unitOfMeasure"
            value={unitOfMeasure}
            onChange={(e) => setUnitOfMeasure(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.9375rem',
              backgroundColor: '#ffffff',
            }}
          >
            {UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
            How you sell this product (each, case, dozen, etc.)
          </p>
        </div>

        <Input
          label="Pieces per Unit"
          type="number"
          placeholder="1"
          value={piecesPerUnit}
          onChange={(e) => setPiecesPerUnit(e.target.value)}
          error={errors.piecesPerUnit}
          required
          fullWidth
          helperText="How many individual items in one unit (ex: 12 bottles per case)"
        />
      </form>
    </Modal>
  );
}
