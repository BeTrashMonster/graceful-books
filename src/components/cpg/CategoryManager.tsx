/**
 * Category Manager Component
 *
 * Manage CPG categories and their variants.
 *
 * Features:
 * - Add/edit custom categories
 * - Define user-specified variants per category
 * - Set default categories (Ingredients, Packaging, Labels, Inserts)
 * - Toggle active/inactive
 * - Reorder categories
 *
 * Requirements:
 * - Flexible variant management (not hardcoded Small/Large)
 * - Clear UI for adding/removing variants
 * - Validation (prevent empty names)
 * - WCAG 2.1 AA compliance
 */

import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { Modal } from '../modals/Modal';
import { Button } from '../core/Button';
import { FrozenGuardButton } from '../frozen/FrozenGuardButton';
import { Input } from '../forms/Input';
import { db } from '../../db/database';
import { useFrozenState } from '../../contexts/FrozenStateContext';
import type { CPGCategory, CPGUnitConversion } from '../../db/schema/cpg.schema';
import {
  createDefaultCPGCategory,
  validateCPGCategory,
} from '../../db/schema/cpg.schema';
import { UNIT_CATALOG, type Unit } from '../../utils/unitConversion';
import styles from './CategoryManager.module.css';

export interface CategoryManagerProps {
  companyId: string;
  categories: CPGCategory[];
  onClose: () => void;
  onSaved: () => void;
  /** Pre-select a category to edit when the modal opens */
  preSelectedCategoryId?: string;
}

interface CategoryFormData {
  id: string | null;
  name: string;
  description: string;
  variants: string[];
  isNew: boolean;
}

export function CategoryManager({
  companyId,
  categories,
  onClose,
  onSaved,
  preSelectedCategoryId,
}: CategoryManagerProps) {
  const { isFrozen, openReactivationFlow } = useFrozenState();
  const [editingCategory, setEditingCategory] = useState<CategoryFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [categoryConversions, setCategoryConversions] = useState<CPGUnitConversion[]>([]);
  const [loadingConversions, setLoadingConversions] = useState(false);
  // Conversion editor state: which variant is being edited and the form values
  // false = not editing, null = editing the "default/no variant", string = editing that specific variant
  const [editingConversionVariant, setEditingConversionVariant] = useState<string | null | false>(false);
  const [conversionForm, setConversionForm] = useState({
    leftQty: '1',
    leftUnit: 'lb',
    rightQty: '',
    rightUnit: 'cup'
  });
  const [savingConversion, setSavingConversion] = useState(false);
  const [showHistoricalPrompt, setShowHistoricalPrompt] = useState<{
    variant: string | null;
    fromUnit: string;
    toUnit: string;
    factor: number;
  } | null>(null);
  const [lockHistoricalDate, setLockHistoricalDate] = useState<string>(''); // Date input for "Lock Historical"
  const [editingConversionId, setEditingConversionId] = useState<string | null>(null); // ID of conversion being edited (vs new)

  // Load conversions when editing a category
  useEffect(() => {
    if (!editingCategory?.id) {
      setCategoryConversions([]);
      return;
    }

    const loadConversions = async () => {
      setLoadingConversions(true);
      try {
        const conversions = await db.cpgUnitConversions
          .where('company_id')
          .equals(companyId)
          .filter(c => c.category_id === editingCategory.id && !c.deleted_at)
          .toArray();
        setCategoryConversions(conversions);
      } catch (err) {
        console.error('Failed to load conversions:', err);
      } finally {
        setLoadingConversions(false);
      }
    };

    loadConversions();
  }, [editingCategory?.id, companyId]);

  // Auto-select pre-selected category when modal opens
  useEffect(() => {
    if (preSelectedCategoryId && categories.length > 0 && !editingCategory) {
      const category = categories.find(c => c.id === preSelectedCategoryId);
      if (category) {
        setEditingCategory({
          id: category.id,
          name: category.name,
          description: category.description || '',
          variants: category.variants || [],
          isNew: false
        });
      }
    }
  }, [preSelectedCategoryId, categories]);

  // Delete a conversion
  const handleDeleteConversion = async (conversionId: string) => {
    try {
      await db.cpgUnitConversions.update(conversionId, {
        deleted_at: Date.now(),
        updated_at: Date.now()
      });
      setCategoryConversions(prev => prev.filter(c => c.id !== conversionId));
    } catch (err) {
      console.error('Failed to delete conversion:', err);
      setError('Failed to delete conversion. Please try again.');
    }
  };

  // Get unit type helper
  const getUnitType = (unit: string): 'weight' | 'volume' | 'count' | null => {
    const unitDef = UNIT_CATALOG[unit as Unit];
    return unitDef?.type || null;
  };

  // Start editing a conversion for a variant
  const startEditingConversion = (variant: string | null, existingConversion?: CPGUnitConversion) => {
    setEditingConversionVariant(variant);
    setEditingConversionId(existingConversion?.id || null);
    if (existingConversion) {
      setConversionForm({
        leftQty: '1',
        leftUnit: existingConversion.from_unit,
        rightQty: existingConversion.conversion_factor.toString(),
        rightUnit: existingConversion.to_unit
      });
    } else {
      setConversionForm({
        leftQty: '1',
        leftUnit: 'lb',
        rightQty: '',
        rightUnit: 'cup'
      });
    }
  };

  // Cancel editing conversion
  const cancelEditingConversion = () => {
    setEditingConversionVariant(false); // false = not editing anything
    setEditingConversionId(null);
    setConversionForm({ leftQty: '1', leftUnit: 'lb', rightQty: '', rightUnit: 'cup' });
  };

  // Prepare to save conversion (show historical prompt for new, or save directly for edit)
  const prepareToSaveConversion = async () => {
    console.log('🟡 prepareToSaveConversion called:', conversionForm);
    const leftQty = parseFloat(conversionForm.leftQty);
    const rightQty = parseFloat(conversionForm.rightQty);

    if (isNaN(leftQty) || isNaN(rightQty) || leftQty <= 0 || rightQty <= 0) {
      console.log('🔴 prepareToSaveConversion: Invalid quantities', { leftQty, rightQty });
      return;
    }

    const leftType = getUnitType(conversionForm.leftUnit);

    let fromUnit: string;
    let toUnit: string;
    let factor: number;

    if (leftType === 'weight') {
      fromUnit = conversionForm.leftUnit;
      toUnit = conversionForm.rightUnit;
      factor = rightQty / leftQty;
    } else {
      fromUnit = conversionForm.rightUnit;
      toUnit = conversionForm.leftUnit;
      factor = leftQty / rightQty;
    }

    // If editing an existing conversion, update it directly (no historical prompt needed)
    if (editingConversionId) {
      setSavingConversion(true);
      try {
        await db.cpgUnitConversions.update(editingConversionId, {
          from_unit: fromUnit,
          to_unit: toUnit,
          conversion_factor: factor,
          updated_at: Date.now()
        });
        setCategoryConversions(prev => prev.map(c =>
          c.id === editingConversionId
            ? { ...c, from_unit: fromUnit, to_unit: toUnit, conversion_factor: factor }
            : c
        ));
        cancelEditingConversion();
        onSaved();
      } catch (err) {
        console.error('Failed to update conversion:', err);
        setError('Failed to update conversion. Please try again.');
      } finally {
        setSavingConversion(false);
      }
      return;
    }

    // Check if this is the FIRST conversion for this variant (suggest "Apply to All Data")
    const existingForVariant = categoryConversions.filter(c => c.variant === editingConversionVariant);
    const isFirstConversion = existingForVariant.length === 0;

    console.log('🟡 Setting showHistoricalPrompt:', {
      variant: editingConversionVariant,
      fromUnit,
      toUnit,
      factor,
      isFirstConversion
    });

    setShowHistoricalPrompt({
      variant: editingConversionVariant,
      fromUnit,
      toUnit,
      factor
    });
  };

  // Actually save the conversion
  const saveConversion = async (effectiveFrom: number | null) => {
    if (!editingCategory?.id || !showHistoricalPrompt) {
      return;
    }

    setSavingConversion(true);
    try {
      const { variant, fromUnit, toUnit, factor } = showHistoricalPrompt;

      if (effectiveFrom === null) {
        // "Apply to All Data" - Update or create the base (null effective_from) conversion
        // This replaces any existing base conversion for this variant
        const existingBase = categoryConversions.find(c =>
          c.variant === variant &&
          (c.effective_from === null || c.effective_from === undefined)
        );

        if (existingBase) {
          // Update existing base conversion
          await db.cpgUnitConversions.update(existingBase.id, {
            from_unit: fromUnit,
            to_unit: toUnit,
            conversion_factor: factor,
            effective_from: null,
            updated_at: Date.now()
          });
          setCategoryConversions(prev => prev.map(c =>
            c.id === existingBase.id
              ? { ...c, from_unit: fromUnit, to_unit: toUnit, conversion_factor: factor, effective_from: null }
              : c
          ));
        } else {
          // Create new base conversion
          const newConversion: CPGUnitConversion = {
            id: nanoid(),
            company_id: companyId,
            category_id: editingCategory.id,
            variant: variant,
            from_unit: fromUnit,
            to_unit: toUnit,
            conversion_factor: factor,
            effective_from: null,
            created_at: Date.now(),
            updated_at: Date.now(),
            deleted_at: null,
            version_vector: { 'web-client': 1 }
          };
          await db.cpgUnitConversions.add(newConversion);
          setCategoryConversions(prev => [...prev, newConversion]);
        }
      } else {
        // "Lock Historical Data" - Create a NEW conversion with effective_from date
        // This does NOT replace existing conversions - they continue to apply to earlier dates
        // Check if there's already a conversion with this exact effective_from date
        const existingForDate = categoryConversions.find(c =>
          c.variant === variant &&
          c.effective_from === effectiveFrom
        );

        if (existingForDate) {
          // Update the conversion for this specific date
          await db.cpgUnitConversions.update(existingForDate.id, {
            from_unit: fromUnit,
            to_unit: toUnit,
            conversion_factor: factor,
            updated_at: Date.now()
          });
          setCategoryConversions(prev => prev.map(c =>
            c.id === existingForDate.id
              ? { ...c, from_unit: fromUnit, to_unit: toUnit, conversion_factor: factor }
              : c
          ));
        } else {
          // Create new dated conversion (keeps existing conversions intact)
          const newConversion: CPGUnitConversion = {
            id: nanoid(),
            company_id: companyId,
            category_id: editingCategory.id,
            variant: variant,
            from_unit: fromUnit,
            to_unit: toUnit,
            conversion_factor: factor,
            effective_from: effectiveFrom,
            created_at: Date.now(),
            updated_at: Date.now(),
            deleted_at: null,
            version_vector: { 'web-client': 1 }
          };
          await db.cpgUnitConversions.add(newConversion);
          setCategoryConversions(prev => [...prev, newConversion]);
        }
      }

      setShowHistoricalPrompt(null);
      cancelEditingConversion();
    } catch (err) {
      console.error('Failed to save conversion:', err);
      setError('Failed to save conversion. Please try again.');
    } finally {
      setSavingConversion(false);
    }
  };

  // Get ALL conversions for a specific variant (sorted by effective_from, null first then ascending)
  const getConversionsForVariant = (variant: string | null): CPGUnitConversion[] => {
    return categoryConversions
      .filter(c => c.variant === variant)
      .sort((a, b) => {
        if (a.effective_from === null || a.effective_from === undefined) return -1;
        if (b.effective_from === null || b.effective_from === undefined) return 1;
        return a.effective_from - b.effective_from;
      });
  };

  // Get the "current" conversion for a variant (most recent or base)
  const getCurrentConversionForVariant = (variant: string | null): CPGUnitConversion | undefined => {
    const conversions = getConversionsForVariant(variant);
    // Return the most recent one (last in sorted array)
    return conversions.length > 0 ? conversions[conversions.length - 1] : undefined;
  };

  // Default category templates
  const defaultCategories = [
    { name: 'Ingredients', description: 'Raw materials and components' },
    { name: 'Packaging', description: 'Containers and boxes' },
    { name: 'Labels', description: 'Branding and labeling materials' },
    { name: 'Inserts', description: 'Padding and protective materials' },
  ];

  const handleAddCategory = () => {
    setEditingCategory({
      id: null,
      name: '',
      description: '',
      variants: [],
      isNew: true,
    });
    setValidationErrors({});
  };

  const handleEditCategory = (category: CPGCategory) => {
    setEditingCategory({
      id: category.id,
      name: category.name,
      description: category.description || '',
      variants: category.variants || [],
      isNew: false,
    });
    setValidationErrors({});
  };

  const handleArchiveCategory = async (categoryId: string) => {
    try {
      setIsSaving(true);
      setError(null);

      // Soft delete (archive)
      await db.cpgCategories.update(categoryId, {
        deleted_at: Date.now(),
        active: false,
        updated_at: Date.now(),
      });

      onSaved();
    } catch (err) {
      console.error('Failed to archive category:', err);
      setError('Oops! We had trouble archiving that category. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnarchiveCategory = async (categoryId: string) => {
    try {
      setIsSaving(true);
      setError(null);

      await db.cpgCategories.update(categoryId, {
        deleted_at: null,
        active: true,
        updated_at: Date.now(),
      });

      onSaved();
    } catch (err) {
      console.error('Failed to unarchive category:', err);
      setError('Oops! We had trouble restoring that category. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShowDeleteConfirmation = (categoryId: string) => {
    setDeletingCategoryId(categoryId);
    setShowPermanentDeleteConfirm(false);
  };

  const handlePermanentDeleteCategory = async () => {
    if (!deletingCategoryId) return;

    try {
      setIsSaving(true);
      setError(null);

      // Check for references in recipes
      const recipes = await db.cpgRecipes
        .where('category_id')
        .equals(deletingCategoryId)
        .filter((r) => r.active && !r.deleted_at)
        .toArray();

      if (recipes.length > 0) {
        setError(
          `Cannot permanently delete this category. It is referenced in ${recipes.length} recipe(s). Please archive instead.`
        );
        setDeletingCategoryId(null);
        setShowPermanentDeleteConfirm(false);
        return;
      }

      // Check for references in invoices
      const invoices = await db.cpgInvoices
        .where('company_id')
        .equals(companyId)
        .filter((inv) => inv.active && !inv.deleted_at)
        .toArray();

      const referencedInInvoices = invoices.some((inv) => {
        if (!inv.cost_attribution) return false;
        return Object.values(inv.cost_attribution).some(
          (item) => item.category_id === deletingCategoryId
        );
      });

      if (referencedInInvoices) {
        setError(
          'Cannot permanently delete this category. It is referenced in invoice records. Please archive instead.'
        );
        setDeletingCategoryId(null);
        setShowPermanentDeleteConfirm(false);
        return;
      }

      // Permanent delete
      await db.cpgCategories.delete(deletingCategoryId);

      setDeletingCategoryId(null);
      setShowPermanentDeleteConfirm(false);
      onSaved();
    } catch (err) {
      console.error('Failed to permanently delete category:', err);
      setError('Oops! We had trouble deleting that category. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDefaultCategories = async () => {
    try {
      setIsSaving(true);
      setError(null);

      for (const template of defaultCategories) {
        // Check if already exists
        const existing = categories.find((c) => c.name === template.name);
        if (existing) continue;

        const category = {
          ...createDefaultCPGCategory(companyId, template.name, 'web-client'),
          id: nanoid(),
          description: template.description,
        } as CPGCategory;

        await db.cpgCategories.add(category);
      }

      onSaved();
    } catch (err) {
      console.error('Failed to add default categories:', err);
      setError('Oops! We had trouble adding the default categories. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!editingCategory) return;

    // Validate
    const errors: Record<string, string> = {};

    if (!editingCategory.name.trim()) {
      errors.name = 'Category name is required';
    }

    // Check for duplicate names
    const duplicate = categories.find(
      (c) => c.name.toLowerCase() === editingCategory.name.trim().toLowerCase() &&
             c.id !== editingCategory.id
    );
    if (duplicate) {
      errors.name = 'A category with this name already exists';
    }

    // Validate variants (no empty strings)
    const cleanVariants = editingCategory.variants.map((v) => v.trim()).filter((v) => v);
    if (cleanVariants.length !== editingCategory.variants.length) {
      errors.variants = 'Variant names cannot be empty';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      if (editingCategory.isNew) {
        // Create new category
        const newCategory = {
          ...createDefaultCPGCategory(companyId, editingCategory.name.trim(), 'web-client'),
          id: nanoid(),
          description: editingCategory.description.trim() || null,
          variants: cleanVariants.length > 0 ? cleanVariants : null,
        } as CPGCategory;

        const validationResult = validateCPGCategory(newCategory);
        if (validationResult.length > 0) {
          setError(validationResult.join(', '));
          return;
        }

        await db.cpgCategories.add(newCategory);
      } else {
        // Update existing category
        if (!editingCategory.id) return;

        await db.cpgCategories.update(editingCategory.id, {
          name: editingCategory.name.trim(),
          description: editingCategory.description.trim() || null,
          variants: cleanVariants.length > 0 ? cleanVariants : null,
          updated_at: Date.now(),
        });
      }

      setEditingCategory(null);
      onSaved();
    } catch (err) {
      console.error('Failed to save category:', err);
      setError('Oops! We had trouble saving that category. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddVariant = () => {
    if (!editingCategory) return;

    setEditingCategory({
      ...editingCategory,
      variants: [...editingCategory.variants, ''],
    });
  };

  const handleRemoveVariant = (index: number) => {
    if (!editingCategory) return;

    setEditingCategory({
      ...editingCategory,
      variants: editingCategory.variants.filter((_, i) => i !== index),
    });
  };

  const handleVariantChange = (index: number, value: string) => {
    if (!editingCategory) return;

    const newVariants = [...editingCategory.variants];
    newVariants[index] = value;

    setEditingCategory({
      ...editingCategory,
      variants: newVariants,
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="lg"
      closeOnBackdropClick={false}
      aria-labelledby="category-manager-title"
    >
      {/* Custom Header */}
      <div style={{
        background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
        padding: '1rem 1.5rem',
        margin: '-1.5rem -1.5rem 0 -1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'white',
        }}>
          Manage Categories
        </h2>
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '44px',
            minHeight: '44px',
            padding: '0.5rem',
            fontSize: '1.5rem',
            color: 'white',
            background: 'none',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="Close modal"
        >
          ✕
        </button>
      </div>

      <div className={styles.container} style={{ paddingTop: '1rem' }}>
        {error && (
          <div className={styles.errorBanner} role="alert" aria-live="polite">
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Category Editor (when editing) */}
        {editingCategory ? (
          <div className={styles.editor}>
            <div className={styles.editorHeader}>
              <h3 className={styles.editorTitle}>
                {editingCategory.isNew ? 'New Category' : 'Edit Category'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingCategory(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>

            <div className={styles.editorContent}>
              {/* Name and Description on one line */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input
                  label="Category Name"
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, name: e.target.value })
                  }
                  placeholder="ex: Ingredients, Packaging, Labels"
                  required
                  error={validationErrors.name}
                />

                <Input
                  label="Description (Optional)"
                  type="text"
                  value={editingCategory.description}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                  placeholder="Brief description of this category"
                />
              </div>

              <div className={styles.variantsSection}>
                <div className={styles.variantsHeader}>
                  <label className={styles.variantsLabel}>
                    Variants (Optional)
                  </label>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0', lineHeight: '1.5' }}>
                    Define different sizes or types for this category. For example: '8oz', '16oz', '32oz' or 'Small', 'Large'. Leave empty if this category doesn't have variants.
                  </p>
                </div>

                {editingCategory.variants.length > 0 && (
                  <div className={styles.variantsList}>
                    {editingCategory.variants.map((variant, index) => (
                      <div key={index} className={styles.variantRow}>
                        <Input
                          type="text"
                          value={variant}
                          onChange={(e) => handleVariantChange(index, e.target.value)}
                          placeholder={`Variant ${index + 1} (e.g., 8oz, Small)`}
                          fullWidth
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(index)}
                          className={styles.removeVariantButton}
                          aria-label={`Remove variant ${index + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {validationErrors.variants && (
                  <p className={styles.errorText} role="alert">
                    {validationErrors.variants}
                  </p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddVariant}
                  iconBefore={<span>+</span>}
                >
                  Add Variant
                </Button>
              </div>

              {/* Unit Conversions Section - only show when editing existing category */}
              {!editingCategory.isNew && (
                <div style={{
                  marginTop: '1.5rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      fontWeight: 600,
                      fontSize: '0.9375rem',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      Weight ↔ Volume Conversions
                    </label>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
                      Different variants may have different densities. Set conversions for each variant so recipe costs calculate correctly.
                    </p>
                  </div>

                  {loadingConversions ? (
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
                      Loading conversions...
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Show conversion card for each variant + a default option if no variants */}
                      {(editingCategory.variants.length > 0 ? editingCategory.variants : [null]).map((variant) => {
                        const conversions = getConversionsForVariant(variant);
                        const isEditing = editingConversionVariant === variant;
                        const variantName = variant || 'Default (no variant)';
                        const hasConversions = conversions.length > 0;

                        return (
                          <div
                            key={variant || 'default'}
                            style={{
                              backgroundColor: hasConversions ? '#f0fdf4' : '#f8fafc',
                              border: hasConversions ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                              borderRadius: '0.5rem',
                              padding: '0.875rem 1rem',
                              transition: 'all 0.2s'
                            }}
                          >
                            {/* Variant Header */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: (isEditing || hasConversions) ? '0.75rem' : 0
                            }}>
                              <span style={{
                                fontWeight: 600,
                                fontSize: '0.9375rem',
                                color: '#1f2937'
                              }}>
                                {variantName}
                              </span>

                              {!isEditing && (
                                <button
                                  type="button"
                                  onClick={() => startEditingConversion(variant, undefined)}
                                  style={{
                                    padding: '0.375rem 0.75rem',
                                    fontSize: '0.8125rem',
                                    fontWeight: 500,
                                    color: '#4b006e',
                                    backgroundColor: '#f3e8ff',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {hasConversions ? '+ Add New' : 'Add'}
                                </button>
                              )}
                            </div>

                            {/* List of existing conversions */}
                            {!isEditing && conversions.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {conversions.map((conv, idx) => (
                                  <div
                                    key={conv.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.5rem 0.75rem',
                                      backgroundColor: 'white',
                                      borderRadius: '0.375rem',
                                      border: '1px solid #d1fae5'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '0.75rem', color: '#059669' }}>✓</span>
                                      <span style={{ fontSize: '0.875rem', color: '#065f46' }}>
                                        1 {UNIT_CATALOG[conv.from_unit as Unit]?.label || conv.from_unit} = {conv.conversion_factor.toFixed(2)} {UNIT_CATALOG[conv.to_unit as Unit]?.label || conv.to_unit}
                                      </span>
                                      <span style={{
                                        fontSize: '0.75rem',
                                        color: conv.effective_from ? '#6b7280' : '#059669',
                                        backgroundColor: conv.effective_from ? '#f1f5f9' : '#dcfce7',
                                        padding: '0.125rem 0.5rem',
                                        borderRadius: '0.25rem'
                                      }}>
                                        {conv.effective_from
                                          ? `From ${new Date(conv.effective_from).toLocaleDateString()}`
                                          : 'All dates'}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => startEditingConversion(variant, conv)}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          fontSize: '0.75rem',
                                          color: '#4b006e',
                                          backgroundColor: '#f3e8ff',
                                          border: 'none',
                                          borderRadius: '0.25rem',
                                          cursor: 'pointer'
                                        }}
                                        title="Edit this conversion"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteConversion(conv.id)}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          fontSize: '0.875rem',
                                          color: '#dc2626',
                                          backgroundColor: 'transparent',
                                          border: 'none',
                                          borderRadius: '0.25rem',
                                          cursor: 'pointer'
                                        }}
                                        title="Remove this conversion"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Date coverage summary */}
                            {!isEditing && conversions.length > 0 && (
                              <div style={{
                                marginTop: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                backgroundColor: '#f8fafc',
                                borderRadius: '0.375rem',
                                fontSize: '0.75rem',
                                color: '#64748b'
                              }}>
                                {(() => {
                                  const hasAllDates = conversions.some(c => !c.effective_from);
                                  if (hasAllDates) {
                                    return <span style={{ color: '#059669' }}>Coverage: All dates</span>;
                                  }
                                  const sortedByDate = [...conversions]
                                    .filter(c => c.effective_from)
                                    .sort((a, b) => (a.effective_from || 0) - (b.effective_from || 0));
                                  const earliestDate = sortedByDate[0]?.effective_from;
                                  if (earliestDate) {
                                    return (
                                      <span style={{ color: '#d97706' }}>
                                        Coverage: From {new Date(earliestDate).toLocaleDateString()} onwards
                                        <span style={{ marginLeft: '0.5rem', fontStyle: 'italic' }}>
                                          (Older invoices won't have conversions applied)
                                        </span>
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}

                            {/* No conversions message */}
                            {!isEditing && conversions.length === 0 && (
                              <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontStyle: 'italic' }}>
                                No conversion set
                              </span>
                            )}

                            {/* Inline editor */}
                            {isEditing && (
                              <div style={{
                                backgroundColor: 'white',
                                borderRadius: '0.375rem',
                                padding: '0.75rem',
                                border: '1px solid #e5e7eb'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  flexWrap: 'wrap',
                                  marginBottom: '0.75rem'
                                }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={conversionForm.leftQty}
                                    onChange={(e) => setConversionForm(prev => ({ ...prev, leftQty: e.target.value }))}
                                    style={{
                                      width: '60px',
                                      padding: '0.5rem',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.875rem',
                                      textAlign: 'center'
                                    }}
                                  />
                                  <select
                                    value={conversionForm.leftUnit}
                                    onChange={(e) => {
                                      const newUnit = e.target.value;
                                      const newType = getUnitType(newUnit);
                                      let newRightUnit = conversionForm.rightUnit;
                                      if (newType === getUnitType(conversionForm.rightUnit)) {
                                        newRightUnit = newType === 'weight' ? 'cup' : 'lb';
                                      }
                                      setConversionForm(prev => ({ ...prev, leftUnit: newUnit, rightUnit: newRightUnit }));
                                    }}
                                    style={{
                                      padding: '0.5rem',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.875rem',
                                      backgroundColor: 'white'
                                    }}
                                  >
                                    <optgroup label="Weight">
                                      <option value="mg">mg</option>
                                      <option value="g">g</option>
                                      <option value="kg">kg</option>
                                      <option value="oz">oz</option>
                                      <option value="lb">lb</option>
                                    </optgroup>
                                    <optgroup label="Volume">
                                      <option value="ml">ml</option>
                                      <option value="tsp">tsp</option>
                                      <option value="tbsp">tbsp</option>
                                      <option value="fl oz">fl oz</option>
                                      <option value="cup">cup</option>
                                      <option value="pt">pt</option>
                                      <option value="qt">qt</option>
                                      <option value="L">L</option>
                                      <option value="gal">gal</option>
                                    </optgroup>
                                  </select>
                                  <span style={{ fontWeight: 600, fontSize: '1rem', color: '#6b7280' }}>=</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="?"
                                    value={conversionForm.rightQty}
                                    onChange={(e) => setConversionForm(prev => ({ ...prev, rightQty: e.target.value }))}
                                    style={{
                                      width: '70px',
                                      padding: '0.5rem',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.875rem',
                                      textAlign: 'center'
                                    }}
                                  />
                                  <select
                                    value={conversionForm.rightUnit}
                                    onChange={(e) => {
                                      const newUnit = e.target.value;
                                      const newType = getUnitType(newUnit);
                                      let newLeftUnit = conversionForm.leftUnit;
                                      if (newType === getUnitType(conversionForm.leftUnit)) {
                                        newLeftUnit = newType === 'weight' ? 'cup' : 'lb';
                                      }
                                      setConversionForm(prev => ({ ...prev, rightUnit: newUnit, leftUnit: newLeftUnit }));
                                    }}
                                    style={{
                                      padding: '0.5rem',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.875rem',
                                      backgroundColor: 'white'
                                    }}
                                  >
                                    <optgroup label="Weight">
                                      <option value="mg">mg</option>
                                      <option value="g">g</option>
                                      <option value="kg">kg</option>
                                      <option value="oz">oz</option>
                                      <option value="lb">lb</option>
                                    </optgroup>
                                    <optgroup label="Volume">
                                      <option value="ml">ml</option>
                                      <option value="tsp">tsp</option>
                                      <option value="tbsp">tbsp</option>
                                      <option value="fl oz">fl oz</option>
                                      <option value="cup">cup</option>
                                      <option value="pt">pt</option>
                                      <option value="qt">qt</option>
                                      <option value="L">L</option>
                                      <option value="gal">gal</option>
                                    </optgroup>
                                  </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    onClick={cancelEditingConversion}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8125rem',
                                      color: '#6b7280',
                                      backgroundColor: 'white',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '0.375rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={prepareToSaveConversion}
                                    disabled={!conversionForm.rightQty || parseFloat(conversionForm.rightQty) <= 0 || savingConversion}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8125rem',
                                      fontWeight: 600,
                                      color: 'white',
                                      backgroundColor: (!conversionForm.rightQty || parseFloat(conversionForm.rightQty) <= 0) ? '#94a3b8' : '#4b006e',
                                      border: 'none',
                                      borderRadius: '0.375rem',
                                      cursor: (!conversionForm.rightQty || parseFloat(conversionForm.rightQty) <= 0) ? 'not-allowed' : 'pointer'
                                    }}
                                  >
                                    Save Conversion
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* If category has variants but no "default" option shown, add ability to add default */}
                      {editingCategory.variants.length > 0 && (
                        <div
                          style={{
                            backgroundColor: getConversionsForVariant(null).length > 0 ? '#f0fdf4' : '#f8fafc',
                            border: getConversionsForVariant(null).length > 0 ? '1px solid #bbf7d0' : '1px dashed #cbd5e1',
                            borderRadius: '0.5rem',
                            padding: '0.875rem 1rem'
                          }}
                        >
                          {(() => {
                            const defaultConversions = getConversionsForVariant(null);
                            const defaultConversion = defaultConversions.length > 0 ? defaultConversions[0] : undefined;
                            const isEditingDefault = editingConversionVariant === null; // null means editing the default variant

                            return (
                              <>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: isEditingDefault ? '0.75rem' : 0
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{
                                      fontWeight: 600,
                                      fontSize: '0.9375rem',
                                      color: '#6b7280'
                                    }}>
                                      Default (fallback)
                                    </span>
                                    {defaultConversion && !isEditingDefault && (
                                      <span style={{
                                        fontSize: '0.8125rem',
                                        color: '#059669'
                                      }}>
                                        1 {UNIT_CATALOG[defaultConversion.from_unit as Unit]?.label || defaultConversion.from_unit} = {defaultConversion.conversion_factor.toFixed(2)} {UNIT_CATALOG[defaultConversion.to_unit as Unit]?.label || defaultConversion.to_unit}
                                      </span>
                                    )}
                                    {!defaultConversion && !isEditingDefault && (
                                      <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontStyle: 'italic' }}>
                                        Used when variant has no conversion
                                      </span>
                                    )}
                                  </div>

                                  {!isEditingDefault && (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => startEditingConversion(null, defaultConversion)}
                                        style={{
                                          padding: '0.375rem 0.75rem',
                                          fontSize: '0.8125rem',
                                          fontWeight: 500,
                                          color: '#6b7280',
                                          backgroundColor: '#f1f5f9',
                                          border: 'none',
                                          borderRadius: '0.375rem',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {defaultConversion ? 'Edit' : 'Add Default'}
                                      </button>
                                      {defaultConversion && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteConversion(defaultConversion.id)}
                                          style={{
                                            padding: '0.375rem 0.5rem',
                                            fontSize: '0.875rem',
                                            color: '#dc2626',
                                            backgroundColor: '#fef2f2',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Historical Data Prompt Modal */}
              {showHistoricalPrompt && (
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10002
                  }}
                  onClick={() => {
                    setShowHistoricalPrompt(null);
                    setLockHistoricalDate('');
                  }}
                >
                  <div
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '0.75rem',
                      padding: '1.5rem',
                      maxWidth: '480px',
                      width: '90%',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(() => {
                      // Check if this is the first conversion for this variant
                      const existingForVariant = categoryConversions.filter(c => c.variant === showHistoricalPrompt.variant);
                      const isFirstConversion = existingForVariant.length === 0;

                      return (
                        <>
                          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
                            How should this conversion be applied?
                          </h3>

                          {isFirstConversion && (
                            <div style={{
                              padding: '0.75rem',
                              backgroundColor: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              borderRadius: '0.5rem',
                              fontSize: '0.8125rem',
                              color: '#166534',
                              marginBottom: '0.5rem'
                            }}>
                              <strong>Tip:</strong> This is your first conversion for this {showHistoricalPrompt.variant ? 'variant' : 'category'}.
                              We recommend "Apply to All Data" so it covers all your invoices.
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Option 1: Apply to All */}
                            <button
                              type="button"
                              onClick={() => {
                                saveConversion(null);
                                setLockHistoricalDate('');
                              }}
                              disabled={savingConversion}
                              style={{
                                padding: '1rem',
                                backgroundColor: '#4b006e',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.5rem',
                                fontSize: '0.9375rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textAlign: 'left'
                              }}
                            >
                              <div>Apply to All Data {isFirstConversion && <span style={{ opacity: 0.8 }}>(Recommended)</span>}</div>
                              <div style={{ fontSize: '0.8125rem', fontWeight: 400, opacity: 0.9, marginTop: '0.25rem' }}>
                                Use this conversion for all invoices, past and future.{!isFirstConversion && ' Any existing conversions will be replaced.'}
                              </div>
                            </button>

                      {/* Option 2: Lock Historical - with date picker */}
                      <div
                        style={{
                          padding: '1rem',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '0.5rem'
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
                          Lock Historical Data
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                          Keep existing conversion for older invoices. This new conversion will apply from the selected date forward.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <label style={{ fontSize: '0.875rem', color: '#475569' }}>
                            Effective from:
                          </label>
                          <input
                            type="date"
                            value={lockHistoricalDate || new Date().toISOString().split('T')[0]}
                            onChange={(e) => setLockHistoricalDate(e.target.value)}
                            style={{
                              padding: '0.5rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const dateStr = lockHistoricalDate || new Date().toISOString().split('T')[0];
                              // Parse date parts to avoid UTC interpretation
                              const [year, month, day] = dateStr.split('-').map(Number);
                              const date = new Date(year, month - 1, day, 12, 0, 0, 0); // Noon local time to avoid DST issues
                              saveConversion(date.getTime());
                              setLockHistoricalDate('');
                            }}
                            disabled={savingConversion}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#4b006e',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHistoricalPrompt(null);
                          setLockHistoricalDate('');
                        }}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: 'transparent',
                          color: '#6b7280',
                          border: 'none',
                          fontSize: '0.875rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className={styles.editorActions}>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setEditingCategory(null)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>

                <FrozenGuardButton
                  variant="gold"
                  size="md"
                  onClick={handleSaveCategory}
                  loading={isSaving}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Category'}
                </FrozenGuardButton>
              </div>
            </div>
          </div>
        ) : (
          /* Category List (when not editing) */
          <>
            {/* Action Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              {/* Archive Toggle - Subtle Text Link */}
              {categories.some(c => c.deleted_at !== null) && (
                <button
                  type="button"
                  onClick={() => setShowArchived(!showArchived)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  {showArchived ? '← Back to Active' : 'View Archived'}
                </button>
              )}

              {/* Right side buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
                {categories.length === 0 && (
                  <FrozenGuardButton
                    variant="outline"
                    size="md"
                    onClick={handleAddDefaultCategories}
                    loading={isSaving}
                    disabled={isSaving}
                  >
                    Add Default Categories
                  </FrozenGuardButton>
                )}

                <FrozenGuardButton
                  variant="gold"
                  size="md"
                  onClick={handleAddCategory}
                  iconBefore={<span>+</span>}
                >
                  Add Category
                </FrozenGuardButton>
              </div>
            </div>

            {categories.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon} aria-hidden="true">
                  📦
                </div>
                <h3 className={styles.emptyTitle}>No Categories Yet</h3>
                <p className={styles.emptyText}>
                  Categories help you organize your costs. Add default categories (Oil, Bottle,
                  Box, Impact) or create your own custom categories.
                </p>
              </div>
            ) : (
              <div className={styles.categoryList} role="list" aria-label="Categories">
                {categories
                  .filter((cat) => showArchived ? cat.deleted_at !== null : cat.deleted_at === null)
                  .map((category) => {
                    const isArchived = category.deleted_at !== null;
                    return (
                      <article
                        key={category.id}
                        className={`${styles.categoryCard} ${isArchived ? styles.archived : ''}`}
                        role="listitem"
                        style={{
                          justifyContent: (!category.variants || category.variants.length === 0) ? 'center' : 'flex-start',
                        }}
                      >
                        <div className={styles.categoryHeader} style={{
                          flex: (!category.variants || category.variants.length === 0) ? 'none' : '1',
                          marginBottom: (!category.variants || category.variants.length === 0) ? '0' : '0.5rem',
                        }}>
                          <div className={styles.categoryInfo}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              flexWrap: 'wrap',
                            }}>
                              <h4 className={styles.categoryName} style={{ margin: 0 }}>{category.name}</h4>
                              {isArchived && (
                                <span
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    fontSize: '0.7rem',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                  }}
                                >
                                  Archived
                                </span>
                              )}
                            </div>
                            {category.description && (
                              <p className={styles.categoryDescription} style={{ marginTop: '0.25rem' }}>
                                {category.description}
                              </p>
                            )}
                          </div>

                          <div className={styles.categoryActions}>
                            {!isArchived ? (
                              <>
                                <FrozenGuardButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditCategory(category)}
                                >
                                  Edit
                                </FrozenGuardButton>

                                <FrozenGuardButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleShowDeleteConfirmation(category.id)}
                                >
                                  Archive
                                </FrozenGuardButton>
                              </>
                            ) : (
                              <FrozenGuardButton
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnarchiveCategory(category.id)}
                              >
                                Unarchive
                              </FrozenGuardButton>
                            )}
                          </div>
                        </div>

                        {category.variants && category.variants.length > 0 && (
                          <div className={styles.variantTags}>
                            <span className={styles.variantTagsLabel}>Variants:</span>
                            {category.variants.map((variant, idx) => (
                              <span key={idx} className={styles.variantTag}>
                                {variant}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Archive/Delete Confirmation Modal */}
      {deletingCategoryId && !showPermanentDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
            }}
          >
            <h3 style={{ marginBottom: '1rem' }}>Archive this category?</h3>
            <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
              It will be hidden but preserved for records and can be restored later.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => setDeletingCategoryId(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <FrozenGuardButton
                variant="primary"
                onClick={() => {
                  handleArchiveCategory(deletingCategoryId);
                  setDeletingCategoryId(null);
                }}
                loading={isSaving}
                disabled={isSaving}
              >
                Archive
              </FrozenGuardButton>
            </div>
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setShowPermanentDeleteConfirm(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Permanently delete instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {deletingCategoryId && showPermanentDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              border: '2px solid #dc2626',
            }}
          >
            <h3 style={{ marginBottom: '1rem', color: '#dc2626' }}>
              ⚠️ Permanently delete?
            </h3>
            <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
              This cannot be undone and may break references in recipes and invoices. We
              recommend archiving instead.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPermanentDeleteConfirm(false);
                  setDeletingCategoryId(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <FrozenGuardButton
                variant="primary"
                onClick={handlePermanentDeleteCategory}
                loading={isSaving}
                disabled={isSaving}
                style={{ backgroundColor: '#dc2626' }}
              >
                Permanently Delete
              </FrozenGuardButton>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
