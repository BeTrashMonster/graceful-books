/**
 * Add Category Modal
 *
 * Allows users to create new CPG categories with optional variants.
 * Examples:
 * - "Oil" with variants ["8oz", "16oz", "32oz"]
 * - "Bottle" with no variants
 * - "Box" with variants ["Small", "Medium", "Large"]
 */

import { useState, useEffect } from 'react';
import { Modal } from '../../modals/Modal';
import { Input } from '../../forms/Input';
import { Button } from '../../core/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../db/database';
import { createDefaultCPGCategory, validateCPGCategory } from '../../../db/schema/cpg.schema';
import { v4 as uuidv4 } from 'uuid';
import styles from './CPGModals.module.css';

export interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddCategoryModal({ isOpen, onClose, onSuccess }: AddCategoryModalProps) {
  const { companyId, deviceId } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [variantsInput, setVariantsInput] = useState('');
  const [categoryCount, setCategoryCount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load category count for progressive disclosure
  useEffect(() => {
    if (!isOpen || !companyId) return;

    const loadCount = async () => {
      const count = await db.cpgCategories
        .where('company_id')
        .equals(companyId)
        .filter(c => c.active && !c.deleted_at)
        .count();
      setCategoryCount(count);
    };

    loadCount();
  }, [isOpen, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!companyId) {
      setErrors({ form: 'Not authenticated' });
      return;
    }

    // Parse variants from comma-separated input
    const variants = variantsInput
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);

    // Create category object
    const categoryData = createDefaultCPGCategory(
      companyId,
      name,
      deviceId || 'default',
      variants.length > 0 ? variants : undefined
    );

    // Validate
    const validationErrors = validateCPGCategory(categoryData);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      validationErrors.forEach(err => {
        if (err.includes('name')) errorMap.name = err;
        else errorMap.form = err;
      });
      setErrors(errorMap);
      return;
    }

    // Save to database
    setIsSubmitting(true);
    try {
      const newId = uuidv4();
      const fullCategory = {
        ...categoryData,
        id: newId,
      };

      console.log('🔵 STEP 1: About to add category:', fullCategory);
      console.log('🔵 STEP 2: Company ID:', companyId);
      console.log('🔵 STEP 3: Device ID:', deviceId);

      const result = await db.cpgCategories.add(fullCategory);
      console.log('✅ STEP 4: Category added successfully! ID:', result);

      // Verify it was saved
      const saved = await db.cpgCategories.get(newId);
      console.log('✅ STEP 5: Verified in database:', saved);

      // Reset form and close
      setName('');
      setDescription('');
      setVariantsInput('');

      // Call onSuccess BEFORE closing so parent can refresh data
      console.log('🔵 STEP 6: Calling onSuccess callback');
      onSuccess?.();

      console.log('🔵 STEP 7: Closing modal');
      onClose();
    } catch (error) {
      console.error('❌ ERROR adding category:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setErrors({ form: `Failed to save category: ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setVariantsInput('');
    setErrors({});
    onClose();
  };

  // Progressive disclosure: Show examples at top for first 3 categories, then at bottom
  const showExamplesAtTop = categoryCount < 3;

  const exampleBox = (
    <div className={styles.exampleBox}>
      <strong>Example: Body Oil Producer</strong>
      <ul>
        <li><strong>Oil</strong> - no variants (purchased in bulk, used for all products)</li>
        <li><strong>Bottle</strong> - variants: 1oz, 5oz (the sizes you sell)</li>
        <li><strong>Box</strong> - variants: 1oz, 5oz (boxes sized to fit each product)</li>
      </ul>
      <p style={{ fontSize: '0.8125rem', marginTop: '0.5rem', marginBottom: 0, color: '#64748b' }}>
        Categories are the components that make up your finished product. Add variants when you buy or use different sizes/types of the same component.
      </p>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Category"
      size="md"
      closeOnBackdropClick={false}
      footer={
        <div className={styles.modalFooter}>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Category'}
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

        {showExamplesAtTop && exampleBox}

        <Input
          label="Category Name"
          placeholder="ex: Ingredients, Packaging, Labels"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
          fullWidth
          autoFocus
          helperText="What type of product component is this?"
        />

        <Input
          label="Description (Optional)"
          placeholder="ex: Oil for my body oil product"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
        />

        <Input
          label="Variants (Optional)"
          placeholder="ex: 1oz, 5oz"
          value={variantsInput}
          onChange={(e) => setVariantsInput(e.target.value)}
          fullWidth
          helperText="Enter sizes or types separated by commas. Leave blank if this component doesn't vary."
        />

        {!showExamplesAtTop && exampleBox}
      </form>
    </Modal>
  );
}
