/**
 * Recipe Builder Component
 *
 * Allows users to create and edit recipes (Bill of Materials) for finished products.
 * Shows list of components with quantity and current cost per unit.
 * Calculates total CPU with graceful handling of missing cost data.
 *
 * Requirements:
 * - Phase 1, Group B: Recipe Builder UI
 * - Add/remove components with category+variant selection
 * - Quantity validation (must be > 0)
 * - Prevent duplicate category+variant combinations
 * - Show estimated CPU based on current raw material costs
 * - Graceful handling when cost data is missing
 */

import { useState, useEffect } from 'react';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { HelpTooltip } from '../help/HelpTooltip';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import { normalizeVariant, validateCPGRecipe } from '../../db/schema/cpg.schema';
import type { CPGCategory, CPGRecipe } from '../../db/schema/cpg.schema';
import { cpuCalculatorService } from '../../services/cpg/cpuCalculator.service';
import { v4 as uuidv4 } from 'uuid';
import styles from './RecipeBuilder.module.css';

export interface RecipeBuilderProps {
  finishedProductId: string;
  productName: string;
  onSave: () => void;
  onCancel: () => void;
}

interface RecipeComponentItem {
  id: string; // Temporary ID for UI (recipe.id if existing, uuid if new)
  recipe_id?: string; // Actual recipe ID from database if existing
  category_id: string;
  variant: string | null;
  quantity: string;
  isNew?: boolean; // Track if this is a new line or existing
}

interface ComponentCost {
  category_id: string;
  variant: string | null;
  categoryName: string;
  quantity: string;
  unitCost: string | null;
  subtotal: string | null;
  hasCostData: boolean;
  unitOfMeasure: string;
}

export function RecipeBuilder({
  finishedProductId,
  productName,
  onSave,
  onCancel,
}: RecipeBuilderProps) {
  const { companyId, deviceId } = useAuth();
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [components, setComponents] = useState<RecipeComponentItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [costBreakdown, setCostBreakdown] = useState<ComponentCost[]>([]);
  const [totalCPU, setTotalCPU] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);

  // Load categories and existing recipe
  useEffect(() => {
    if (!companyId) {
      console.log('🔴 RecipeBuilder: No companyId, cannot load categories');
      return;
    }

    const loadData = async () => {
      try {
        console.log('🔵 RecipeBuilder: Loading categories for companyId:', companyId);

        // Load categories - use simple query to avoid compound index issues
        const cats = await db.cpgCategories
          .where('company_id')
          .equals(companyId)
          .filter((c) => c.active && !c.deleted_at)
          .sortBy('name');

        console.log('✅ RecipeBuilder: Loaded categories:', cats.length, cats);
        setCategories(cats);

        // Load existing recipe - use simple query
        const existingRecipe = await db.cpgRecipes
          .where('finished_product_id')
          .equals(finishedProductId)
          .filter((r) => r.company_id === companyId && r.active && !r.deleted_at)
          .toArray();

        if (existingRecipe.length > 0) {
          const componentItems: RecipeComponentItem[] = existingRecipe.map((r) => ({
            id: r.id,
            recipe_id: r.id,
            category_id: r.category_id,
            variant: r.variant,
            quantity: r.quantity,
            isNew: false,
          }));
          setComponents(componentItems);
        } else {
          // Start with one empty component if no recipe exists
          const newComponent: RecipeComponentItem = {
            id: uuidv4(),
            category_id: '',
            variant: null,
            quantity: '1.00',
            isNew: true,
          };
          setComponents([newComponent]);
        }
      } catch (error) {
        console.error('Error loading recipe data:', error);
      }
    };

    loadData();
  }, [companyId, finishedProductId]);

  // Calculate costs whenever components change
  useEffect(() => {
    if (components.length === 0) return;

    const calculateCosts = async () => {
      try {
        const breakdown: ComponentCost[] = [];
        let total = 0; // Fixed: avoid double rounding - add unrounded values
        let allHaveCostData = true;

        // Calculate date range: last 365 days
        const now = Date.now();
        const dateRange = { start: now - 365 * 24 * 60 * 60 * 1000, end: now };

        for (const component of components) {
          if (!component.category_id) continue;

          const category = categories.find((c) => c.id === component.category_id);
          if (!category) continue;

          // Get CPU using weighted average from cpuCalculatorService (last 365 days)
          const unitCost = await cpuCalculatorService.calculateRawMaterialCPU(
            component.category_id,
            component.variant,
            companyId!,
            dateRange
          );
          const hasCostData = unitCost !== null;

          if (!hasCostData) {
            allHaveCostData = false;
          }

          // Calculate subtotal WITHOUT rounding for accurate total
          let subtotal: string | null = null;
          let subtotalValue = 0;
          if (hasCostData && component.quantity) {
            subtotalValue = parseFloat(unitCost!) * parseFloat(component.quantity);
            subtotal = subtotalValue.toFixed(2); // Round for display only
            total += subtotalValue; // Add unrounded value to total
          }

          breakdown.push({
            category_id: component.category_id,
            variant: component.variant,
            categoryName: category.name,
            quantity: component.quantity,
            unitCost,
            subtotal,
            hasCostData,
            unitOfMeasure: category.unit_of_measure,
          });
        }

        setCostBreakdown(breakdown);
        const finalCPU = allHaveCostData && breakdown.length > 0 ? total.toFixed(2) : null;
        console.log('RecipeBuilder CPU calculation:', { total, finalCPU, breakdown });
        setTotalCPU(finalCPU);
        setIsComplete(allHaveCostData);
      } catch (error) {
        console.error('Error calculating costs:', error);
      }
    };

    calculateCosts();
  }, [components, categories]);

  const addComponent = () => {
    const newComponent: RecipeComponentItem = {
      id: uuidv4(),
      category_id: '',
      variant: null,
      quantity: '1.00',
      isNew: true,
    };
    setComponents((prev) => [...prev, newComponent]);
  };

  const removeComponent = (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const updateComponent = (
    id: string,
    field: keyof RecipeComponentItem,
    value: string | null
  ) => {
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, [field]: value };
          // Reset variant when category changes
          if (field === 'category_id') {
            updated.variant = null;
          }
          return updated;
        }
        return c;
      })
    );
  };

  const getCategory = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId);
  };

  const handleArchiveRecipe = async () => {
    if (!companyId) return;

    setIsSubmitting(true);
    try {
      // Get all recipe lines for this product
      const recipes = await db.cpgRecipes
        .where('finished_product_id')
        .equals(finishedProductId)
        .filter((r) => r.company_id === companyId && r.active && !r.deleted_at)
        .toArray();

      // Archive all recipe lines
      for (const recipe of recipes) {
        await db.cpgRecipes.update(recipe.id, {
          deleted_at: Date.now(),
          updated_at: Date.now(),
          version_vector: {
            ...recipe.version_vector,
            [deviceId || 'default']: (recipe.version_vector[deviceId || 'default'] || 0) + 1,
          },
        });
      }

      // Dispatch custom event
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'recipe' } })
      );

      onSave();
    } catch (error) {
      console.error('Error archiving recipe:', error);
      setErrors({ form: 'Failed to archive recipe. Please try again.' });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handlePermanentDeleteRecipe = async () => {
    if (!companyId) return;

    setIsSubmitting(true);
    try {
      // Get all recipe lines for this product
      const recipes = await db.cpgRecipes
        .where('finished_product_id')
        .equals(finishedProductId)
        .filter((r) => r.company_id === companyId)
        .toArray();

      // Permanently delete all recipe lines
      for (const recipe of recipes) {
        await db.cpgRecipes.delete(recipe.id);
      }

      // Dispatch custom event
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'recipe' } })
      );

      onSave();
    } catch (error) {
      console.error('Error deleting recipe:', error);
      setErrors({ form: 'Failed to delete recipe. Please try again.' });
    } finally {
      setIsSubmitting(false);
      setShowPermanentDeleteConfirm(false);
    }
  };

  const handleSave = async () => {
    setErrors({});

    if (!companyId) {
      setErrors({ form: 'Not authenticated' });
      return;
    }

    if (components.length === 0) {
      setErrors({ form: 'Please add at least one component' });
      return;
    }

    // Validate each component
    let hasErrors = false;
    const existingRecipes = await db.cpgRecipes
      .where('finished_product_id')
      .equals(finishedProductId)
      .filter((r) => r.company_id === companyId && r.active && !r.deleted_at)
      .toArray();

    components.forEach((component, index) => {
      if (!component.category_id) {
        setErrors((prev) => ({
          ...prev,
          [`component_${index}_category`]: 'Category is required',
        }));
        hasErrors = true;
        return;
      }

      if (!component.quantity || component.quantity.trim() === '') {
        setErrors((prev) => ({
          ...prev,
          [`component_${index}_quantity`]: 'Quantity is required',
        }));
        hasErrors = true;
        return;
      }

      const quantityNum = parseFloat(component.quantity);
      if (isNaN(quantityNum) || quantityNum <= 0) {
        setErrors((prev) => ({
          ...prev,
          [`component_${index}_quantity`]: 'Quantity must be greater than 0',
        }));
        hasErrors = true;
        return;
      }

      // Check for duplicates
      const normalizedVariant = normalizeVariant(component.variant);
      const duplicateCount = components.filter((c) => {
        if (c.id === component.id) return false;
        return (
          c.category_id === component.category_id &&
          normalizeVariant(c.variant) === normalizedVariant
        );
      }).length;

      if (duplicateCount > 0) {
        setErrors((prev) => ({
          ...prev,
          [`component_${index}_duplicate`]:
            'This category and variant combination is already in the recipe',
        }));
        hasErrors = true;
      }
    });

    if (hasErrors) return;

    setIsSubmitting(true);
    try {
      // Save all components
      for (const component of components) {
        if (component.isNew) {
          // Create new recipe line
          const newRecipe: Partial<CPGRecipe> = {
            id: uuidv4(),
            company_id: companyId,
            finished_product_id: finishedProductId,
            category_id: component.category_id,
            variant: component.variant,
            quantity: component.quantity,
            notes: null,
            active: true,
            created_at: Date.now(),
            updated_at: Date.now(),
            deleted_at: null,
            version_vector: { [deviceId || 'default']: 1 },
          };

          await db.cpgRecipes.add(newRecipe as any);
        } else {
          // Update existing recipe line
          const existingRecipe = await db.cpgRecipes.get(component.recipe_id!);
          if (existingRecipe) {
            await db.cpgRecipes.update(component.recipe_id!, {
              category_id: component.category_id,
              variant: component.variant,
              quantity: component.quantity,
              updated_at: Date.now(),
              version_vector: {
                ...existingRecipe.version_vector,
                [deviceId || 'default']:
                  (existingRecipe.version_vector[deviceId || 'default'] || 0) + 1,
              },
            });
          }
        }
      }

      // Delete any removed components
      const currentComponentIds = components
        .filter((c) => !c.isNew)
        .map((c) => c.recipe_id!);
      const existingRecipeIds = existingRecipes.map((r) => r.id);
      const deletedIds = existingRecipeIds.filter(
        (id) => !currentComponentIds.includes(id)
      );

      for (const id of deletedIds) {
        const recipe = await db.cpgRecipes.get(id);
        if (recipe) {
          await db.cpgRecipes.update(id, {
            deleted_at: Date.now(),
            updated_at: Date.now(),
            version_vector: {
              ...recipe.version_vector,
              [deviceId || 'default']:
                (recipe.version_vector[deviceId || 'default'] || 0) + 1,
            },
          });
        }
      }

      // Dispatch custom event
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'recipe' } })
      );

      onSave();
    } catch (error) {
      console.error('Error saving recipe:', error);
      setErrors({ form: 'Failed to save recipe. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.recipeBuilder}>
      {errors.form && (
        <div className={styles.errorAlert} role="alert">
          {errors.form}
        </div>
      )}

      <div>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#4b006e',
          marginBottom: '1rem',
          marginTop: 0
        }}>
          Recipe Components
        </h3>
        <div className={styles.componentList}>
          <div className={styles.componentHeader}>
            <div style={{ flex: 1.5 }}>Category</div>
            <div style={{ flex: 1 }}>Variant</div>
            <div style={{ flex: 1 }}>Qty</div>
            <div style={{ flex: 1, textAlign: 'right' }}>Cost/Unit</div>
            <div style={{ width: '80px' }}></div>
          </div>

        {components.length === 0 ? (
          <div className={styles.emptyState}>
            No components added yet. Click "Add Component" to start building your recipe.
          </div>
        ) : (
          components.map((component, index) => {
            const category = getCategory(component.category_id);
            const hasVariants =
              category && category.variants && category.variants.length > 0;
            const costInfo = costBreakdown.find(
              (c) =>
                c.category_id === component.category_id &&
                normalizeVariant(c.variant) === normalizeVariant(component.variant)
            );

            return (
              <div key={component.id} className={styles.componentRow}>
                <div className={styles.componentFields}>
                  <div style={{ flex: 1.5 }}>
                    <select
                      value={component.category_id}
                      onChange={(e) =>
                        updateComponent(component.id, 'category_id', e.target.value)
                      }
                      className={styles.select}
                    >
                      <option value="">Select category...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    {errors[`component_${index}_category`] && (
                      <div className={styles.fieldError}>
                        {errors[`component_${index}_category`]}
                      </div>
                    )}
                    {errors[`component_${index}_duplicate`] && (
                      <div className={styles.fieldError}>
                        {errors[`component_${index}_duplicate`]}
                      </div>
                    )}
                  </div>

                  {hasVariants && (
                    <div style={{ flex: 1 }}>
                      <select
                        value={component.variant || ''}
                        onChange={(e) =>
                          updateComponent(
                            component.id,
                            'variant',
                            e.target.value || null
                          )
                        }
                        className={styles.select}
                      >
                        <option value="">No variant</option>
                        {category?.variants?.map((variant) => (
                          <option key={variant} value={variant}>
                            {variant}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Input
                      type="number"
                      step="0.01"
                      value={component.quantity}
                      onChange={(e) =>
                        updateComponent(component.id, 'quantity', e.target.value)
                      }
                      placeholder="0"
                      error={errors[`component_${index}_quantity`]}
                      fullWidth
                      style={{ fontSize: '1.125rem' }}
                    />
                    {category && (
                      <div style={{
                        fontSize: '0.9375rem',
                        color: '#64748b',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        minWidth: 'fit-content'
                      }}>
                        {category.unit_of_measure}
                      </div>
                    )}
                  </div>

                  <div
                    style={{ flex: 1, textAlign: 'right', paddingTop: '0.5rem' }}
                  >
                    {costInfo ? (
                      costInfo.hasCostData ? (
                        <span className={styles.costValue}>
                          ${costInfo.unitCost}
                        </span>
                      ) : (
                        <span className={styles.costMissing} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end', fontSize: '0.875rem' }}>
                          <span className={styles.warningIcon}>⚠️</span>
                          <span>Add invoices to calculate</span>
                          <HelpTooltip
                            content={`Once you enter invoices for ${category?.name || 'this category'}${component.variant ? ` (${component.variant})` : ''}, we'll automatically calculate the cost per unit. Go to the Invoice Timeline below to add your invoices.`}
                            position="left"
                          />
                        </span>
                      )
                    ) : (
                      <span className={styles.costMissing}>-</span>
                    )}
                  </div>

                  <div style={{ width: '80px', paddingTop: '0.5rem' }}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeComponent(component.id)}
                      disabled={components.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem' }}>
          <Button
            type="button"
            variant="outline"
            onClick={addComponent}
          >
            + Add Component
          </Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#4b006e',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Estimated CPU
            </div>
            <div className={styles.costSummary}>
              {components.length === 0 ? (
                <div className={styles.costSummaryEmpty}>-</div>
              ) : isComplete && totalCPU !== null ? (
                <div className={styles.costSummaryComplete}>
                  <span className={styles.totalCPU}>${totalCPU}</span>
                  <span className={styles.completeLabel}>✓</span>
                </div>
              ) : (
                <div className={styles.costSummaryIncomplete}>
                  <span className={styles.totalCPU}>Incomplete</span>
                  <span className={styles.warningIcon}>⚠️</span>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className={styles.actions}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          {components.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSubmitting}
              style={{ color: '#dc2626' }}
            >
              Delete Recipe
            </Button>
          )}
        </div>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isSubmitting || components.length === 0}
        >
          {isSubmitting ? 'Saving...' : 'Save Recipe'}
        </Button>
      </div>

      {/* Archive Recipe Confirmation Modal */}
      {showDeleteConfirm && !showPermanentDeleteConfirm && (
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
            <h3 style={{ marginBottom: '1rem' }}>Archive this recipe?</h3>
            <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
              The recipe will be hidden but preserved. You can recreate it later if needed.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleArchiveRecipe}
                loading={isSubmitting}
                disabled={isSubmitting}
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
      {showDeleteConfirm && showPermanentDeleteConfirm && (
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
              This cannot be undone. The recipe configuration will be lost forever.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPermanentDeleteConfirm(false);
                  setShowDeleteConfirm(false);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handlePermanentDeleteRecipe}
                loading={isSubmitting}
                disabled={isSubmitting}
                style={{ backgroundColor: '#dc2626' }}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
