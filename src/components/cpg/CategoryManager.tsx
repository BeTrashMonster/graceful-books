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

import { useState } from 'react';
import { nanoid } from 'nanoid';
import { Modal } from '../modals/Modal';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { HelpTooltip } from '../help/HelpTooltip';
import { db } from '../../db/database';
import type { CPGCategory } from '../../db/schema/cpg.schema';
import {
  createDefaultCPGCategory,
  validateCPGCategory,
} from '../../db/schema/cpg.schema';
import styles from './CategoryManager.module.css';

export interface CategoryManagerProps {
  companyId: string;
  categories: CPGCategory[];
  onClose: () => void;
  onSaved: () => void;
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
}: CategoryManagerProps) {
  const [editingCategory, setEditingCategory] = useState<CategoryFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);

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
      title="Manage Categories"
      size="lg"
      closeOnBackdropClick={false}
      aria-labelledby="category-manager-title"
    >
      <div className={styles.container}>
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
                fullWidth
              />

              <Input
                label="Description (Optional)"
                type="text"
                value={editingCategory.description}
                onChange={(e) =>
                  setEditingCategory({ ...editingCategory, description: e.target.value })
                }
                placeholder="Brief description of this category"
                fullWidth
              />

              <div className={styles.variantsSection}>
                <div className={styles.variantsHeader}>
                  <label className={styles.variantsLabel}>
                    Variants (Optional)
                    <HelpTooltip content="Define different sizes or types for this category. For example: '8oz', '16oz', '32oz' or 'Small', 'Large'. Leave empty if this category doesn't have variants." />
                  </label>
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

              <div className={styles.editorActions}>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setEditingCategory(null)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSaveCategory}
                  loading={isSaving}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Category'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Category List (when not editing) */
          <>
            <div className={styles.actions}>
              <Button
                variant="primary"
                size="md"
                onClick={handleAddCategory}
                iconBefore={<span>+</span>}
              >
                Add Category
              </Button>

              {categories.length === 0 && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleAddDefaultCategories}
                  loading={isSaving}
                  disabled={isSaving}
                >
                  Add Default Categories
                </Button>
              )}
            </div>

            {/* Show Archived Toggle */}
            {categories.some(c => c.deleted_at !== null) && (
              <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  <span>Show Archived</span>
                </label>
              </div>
            )}

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
                  .filter((cat) => showArchived || cat.deleted_at === null)
                  .map((category) => {
                    const isArchived = category.deleted_at !== null;
                    return (
                      <article
                        key={category.id}
                        className={`${styles.categoryCard} ${isArchived ? styles.archived : ''}`}
                        role="listitem"
                        style={isArchived ? { opacity: 0.6, backgroundColor: '#f8f9fa' } : {}}
                      >
                        <div className={styles.categoryHeader}>
                          <div className={styles.categoryInfo}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <h4 className={styles.categoryName}>{category.name}</h4>
                              {isArchived && (
                                <span
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    borderRadius: '4px',
                                  }}
                                >
                                  Archived
                                </span>
                              )}
                            </div>
                            {category.description && (
                              <p className={styles.categoryDescription}>
                                {category.description}
                              </p>
                            )}
                          </div>

                          <div className={styles.categoryActions}>
                            {!isArchived ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditCategory(category)}
                                >
                                  Edit
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleShowDeleteConfirmation(category.id)}
                                >
                                  Archive
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnarchiveCategory(category.id)}
                              >
                                Unarchive
                              </Button>
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
              <Button
                variant="primary"
                onClick={() => {
                  handleArchiveCategory(deletingCategoryId);
                  setDeletingCategoryId(null);
                }}
                loading={isSaving}
                disabled={isSaving}
              >
                Archive
              </Button>
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
              <Button
                variant="primary"
                onClick={handlePermanentDeleteCategory}
                loading={isSaving}
                disabled={isSaving}
                style={{ backgroundColor: '#dc2626' }}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
