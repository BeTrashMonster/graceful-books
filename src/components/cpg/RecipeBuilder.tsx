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
import { FrozenGuardButton } from '../frozen/FrozenGuardButton';
import { Input } from '../forms/Input';
import { HelpTooltip } from '../help/HelpTooltip';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import { normalizeVariant, validateCPGRecipe } from '../../db/schema/cpg.schema';
import type { CPGCategory, CPGRecipe, CPGSettings } from '../../db/schema/cpg.schema';
import { cpuCalculatorService } from '../../services/cpg/cpuCalculator.service';
import { v4 as uuidv4 } from 'uuid';
import { type Unit, areUnitsCompatible, getUnitMismatchWarning, UNIT_CATALOG } from '../../utils/unitConversion';
import { formatDateFromTimestamp } from '../../utils/dateUtils';
import styles from './RecipeBuilder.module.css';

export interface RecipeBuilderProps {
  finishedProductId: string;
  productName: string;
  onSave: () => void;
  onCancel: () => void;
  onNavigateToInvoice?: (invoiceId: string, invoiceNumber: string) => void; // Navigate to edit a specific invoice
  highlightCategoryId?: string; // Highlight this category when opening (from navigation)
  highlightVariant?: string | null; // Highlight this variant when opening (from navigation)
}

interface RecipeComponentItem {
  id: string; // Temporary ID for UI (recipe.id if existing, uuid if new)
  recipe_id?: string; // Actual recipe ID from database if existing
  category_id: string;
  variant: string | null;
  quantity: string;
  unit_of_measurement: string; // Unit (oz, lb, ml, each, etc.)
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
  onNavigateToInvoice,
  highlightCategoryId,
  highlightVariant,
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
  const [cpgSettings, setCpgSettings] = useState<CPGSettings | null>(null);
  const [unitWarnings, setUnitWarnings] = useState<Record<string, { count: number; items: Array<{ invoiceNumber: string; invoiceDate: string; invoiceUnit: string; invoiceId: string }> }>>({});
  const [expandedWarnings, setExpandedWarnings] = useState<Record<string, boolean>>({});
  const [confirmNavigation, setConfirmNavigation] = useState<{ invoiceId: string; invoiceNumber: string } | null>(null);
  const [highlightedComponentId, setHighlightedComponentId] = useState<string | null>(null);

  // Load categories and existing recipe
  useEffect(() => {
    if (!companyId) {
      console.log('🔴 RecipeBuilder: No companyId, cannot load categories');
      return;
    }

    const loadData = async () => {
      try {
        console.log('🔵 RecipeBuilder: Loading categories for companyId:', companyId);

        // Load CPG settings for decimal precision
        const settings = await db.cpgSettings
          .where('company_id')
          .equals(companyId)
          .filter((s) => s.active && !s.deleted_at)
          .first();
        setCpgSettings(settings);

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
            unit_of_measurement: (r.unit_of_measurement as string) || 'each', // Default to 'each' for backward compatibility
            isNew: false,
          }));
          setComponents(componentItems);
        } else {
          // Start with one empty component if no recipe exists
          const decimalPlaces = settings?.decimal_places_numbers ?? 2;
          const defaultQuantity = (1).toFixed(decimalPlaces);
          const newComponent: RecipeComponentItem = {
            id: uuidv4(),
            category_id: '',
            variant: null,
            quantity: defaultQuantity,
            unit_of_measurement: 'each', // Default to 'each'
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

  // Highlight the specified component when navigating from invoice
  useEffect(() => {
    if (!highlightCategoryId || components.length === 0) return;

    // Find the component that matches the category and variant
    const matchingComponent = components.find(
      c => c.category_id === highlightCategoryId && c.variant === highlightVariant
    );

    if (matchingComponent) {
      setHighlightedComponentId(matchingComponent.id);
      // Auto-expand the warning for this component if it exists
      if (unitWarnings[matchingComponent.id]) {
        setExpandedWarnings(prev => ({ ...prev, [matchingComponent.id]: true }));
      }
      // Clear highlight after 3 seconds
      setTimeout(() => setHighlightedComponentId(null), 3000);
    }
  }, [highlightCategoryId, highlightVariant, components, unitWarnings]);

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
          // Pass the component's unit so the service can convert or filter incompatible invoices
          const unitCost = await cpuCalculatorService.calculateRawMaterialCPU(
            component.category_id,
            component.variant,
            companyId!,
            dateRange,
            component.unit_of_measurement as Unit // Pass target unit for conversion/filtering
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
            subtotal = subtotalValue.toFixed(6); // Store with full precision
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
        const finalCPU = allHaveCostData && breakdown.length > 0 ? total.toFixed(6) : null;
        console.log('RecipeBuilder CPU calculation:', { total, finalCPU, breakdown });
        setTotalCPU(finalCPU);
        setIsComplete(allHaveCostData);
      } catch (error) {
        console.error('Error calculating costs:', error);
      }
    };

    calculateCosts();
  }, [components, categories]);

  /**
   * Check for unit mismatches between recipe entry and existing invoices
   * Queries invoices table and shows warning if units are incompatible
   */
  const checkUnitMismatch = async (componentId: string, categoryId: string, variant: string | null, recipeUnit: string) => {
    if (!companyId || !categoryId) {
      // Clear warning for this component
      setUnitWarnings(prev => {
        const updated = { ...prev };
        delete updated[componentId];
        return updated;
      });
      return;
    }

    try {
      // Query invoices that have this category+variant in their cost_attribution
      const invoices = await db.cpgInvoices
        .where('company_id')
        .equals(companyId)
        .filter(inv => !inv.deleted_at)
        .toArray();

      // Check cost_attribution for matching category+variant
      const matchingInvoices = invoices.filter(inv => {
        if (!inv.cost_attribution) return false;
        return Object.values(inv.cost_attribution).some(attr =>
          attr.category_id === categoryId && attr.variant === variant
        );
      });

      if (matchingInvoices.length === 0) {
        // No invoices exist yet - clear warning
        setUnitWarnings(prev => {
          const updated = { ...prev };
          delete updated[componentId];
          return updated;
        });
        return;
      }

      // Find ALL invoices with incompatible units (not just the first one)
      const incompatibleItems: Array<{ invoiceNumber: string; invoiceDate: string; invoiceUnit: string; invoiceId: string }> = [];

      for (const invoice of matchingInvoices) {
        const matchingAttrs = Object.values(invoice.cost_attribution || {}).filter(attr =>
          attr.category_id === categoryId && attr.variant === variant
        );

        for (const attr of matchingAttrs) {
          const invoiceUnit = (attr.unit_of_measurement as Unit) || 'each';

          // Only include truly incompatible units (skip convertible ones like oz↔lb)
          if (!areUnitsCompatible(recipeUnit as Unit, invoiceUnit)) {
            const formattedDate = formatDateFromTimestamp(invoice.invoice_date, 'short');

            // Use invoice number if available, otherwise use "Unnamed Invoice"
            const displayNumber = invoice.invoice_number || 'Unnamed Invoice';
            const displayVendor = invoice.vendor_name ? ` - ${invoice.vendor_name}` : '';

            incompatibleItems.push({
              invoiceNumber: `${displayNumber}${displayVendor}`,
              invoiceDate: formattedDate,
              invoiceUnit: UNIT_CATALOG[invoiceUnit]?.label || invoiceUnit,
              invoiceId: invoice.id
            });
            break; // Only add each invoice once
          }
        }
      }

      if (incompatibleItems.length > 0) {
        setUnitWarnings(prev => ({
          ...prev,
          [componentId]: {
            count: incompatibleItems.length,
            items: incompatibleItems
          }
        }));
      } else {
        // All units are compatible - clear warning
        setUnitWarnings(prev => {
          const updated = { ...prev };
          delete updated[componentId];
          return updated;
        });
      }
    } catch (error) {
      console.error('Error checking unit mismatch:', error);
      // Clear warning on error
      setUnitWarnings(prev => {
        const updated = { ...prev };
        delete updated[componentId];
        return updated;
      });
    }
  };

  const addComponent = () => {
    const decimalPlaces = cpgSettings?.decimal_places_numbers ?? 2;
    const defaultQuantity = (1).toFixed(decimalPlaces);
    const newComponent: RecipeComponentItem = {
      id: uuidv4(),
      category_id: '',
      variant: null,
      quantity: defaultQuantity,
      unit_of_measurement: 'each', // Default to 'each'
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

          // Check for unit mismatches when category, variant, or unit changes
          if (field === 'category_id' || field === 'variant' || field === 'unit_of_measurement') {
            const categoryId = field === 'category_id' ? (value as string) : updated.category_id;
            const variant = field === 'variant' ? (value as string | null) : updated.variant;
            const unit = field === 'unit_of_measurement' ? (value as string) : updated.unit_of_measurement;

            // Trigger async check (don't await - it updates state independently)
            checkUnitMismatch(id, categoryId, variant, unit);
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

  const formatQuantity = (value: string): string => {
    const decimalPlaces = cpgSettings?.decimal_places_numbers ?? 2;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    return numValue.toFixed(decimalPlaces);
  };

  const handleQuantityBlur = (componentId: string, value: string) => {
    if (value && value.trim() !== '') {
      const formatted = formatQuantity(value);
      updateComponent(componentId, 'quantity', formatted);
    }
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
            unit_of_measurement: component.unit_of_measurement,
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
              unit_of_measurement: component.unit_of_measurement,
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
            <div style={{ flex: 1.1 }}>Category</div>
            <div style={{ flex: 0.7 }}>Variant</div>
            <div style={{ width: '10px' }}></div>
            <div style={{ flex: 1.2 }}>Qty</div>
            <div style={{ width: '25px', textAlign: 'center' }}>×</div>
            <div style={{ flex: 0.9, textAlign: 'right' }}>Cost/Unit</div>
            <div style={{ width: '25px', textAlign: 'center' }}>=</div>
            <div style={{ flex: 0.7, textAlign: 'right' }}>Line Total</div>
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

            const isHighlighted = component.id === highlightedComponentId;

            return (
              <div
                key={component.id}
                className={styles.componentRow}
                style={isHighlighted ? {
                  backgroundColor: '#fef3c7',
                  border: '2px solid #f59e0b',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  transition: 'all 0.3s ease'
                } : undefined}
              >
                <div className={styles.componentFields}>
                  <div style={{ flex: 1.1 }}>
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

                  <div style={{ flex: 0.7 }}>
                    {hasVariants ? (
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
                    ) : (
                      <div style={{ height: '42px' }}></div>
                    )}
                  </div>

                  {/* Spacer */}
                  <div style={{ width: '10px' }}></div>

                  <div style={{ flex: 0.7 }}>
                    <Input
                      type="number"
                      step="0.01"
                      value={component.quantity}
                      onChange={(e) =>
                        updateComponent(component.id, 'quantity', e.target.value)
                      }
                      onBlur={(e) =>
                        handleQuantityBlur(component.id, e.target.value)
                      }
                      placeholder="0"
                      error={errors[`component_${index}_quantity`]}
                      fullWidth
                      style={{ fontSize: '1rem' }}
                    />
                  </div>

                  {/* Unit of Measurement */}
                  <div style={{ flex: 0.5 }}>
                    <select
                      value={component.unit_of_measurement}
                      onChange={(e) => updateComponent(component.id, 'unit_of_measurement', e.target.value)}
                      className={styles.select}
                    >
                      <optgroup label="Weight">
                        <option value="oz">oz</option>
                        <option value="lb">lb</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                      </optgroup>
                      <optgroup label="Volume">
                        <option value="ml">ml</option>
                        <option value="L">L</option>
                        <option value="fl oz">fl oz</option>
                        <option value="cup">cup</option>
                        <option value="qt">qt</option>
                        <option value="gal">gal</option>
                      </optgroup>
                      <optgroup label="Count">
                        <option value="each">each</option>
                        <option value="dozen">dozen</option>
                        <option value="case">case</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Multiplication symbol */}
                  <div style={{ width: '25px', textAlign: 'center', paddingTop: '0.5rem', fontSize: '1.125rem', color: '#94a3b8', fontWeight: 600 }}>
                    ×
                  </div>

                  {/* Cost/Unit */}
                  <div
                    style={{ flex: 0.9, textAlign: 'right', paddingTop: '0.5rem' }}
                  >
                    {costInfo ? (
                      costInfo.hasCostData ? (
                        <span className={styles.costValue}>
                          ${costInfo.unitCost}
                        </span>
                      ) : (
                        <span className={styles.costMissing} style={{ fontSize: '0.875rem' }}>
                          -
                        </span>
                      )
                    ) : (
                      <span className={styles.costMissing}>-</span>
                    )}
                  </div>

                  {/* Equals symbol */}
                  <div style={{ width: '25px', textAlign: 'center', paddingTop: '0.5rem', fontSize: '1.125rem', color: '#94a3b8', fontWeight: 600 }}>
                    =
                  </div>

                  {/* Line Total */}
                  <div
                    style={{ flex: 0.7, textAlign: 'right', paddingTop: '0.5rem' }}
                  >
                    {costInfo ? (
                      costInfo.hasCostData && costInfo.subtotal ? (
                        <span className={styles.costValue}>
                          ${costInfo.subtotal}
                        </span>
                      ) : (
                        <span className={styles.costMissing} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end', fontSize: '0.875rem' }}>
                          <span className={styles.warningIcon}>⚠️</span>
                          <span>Add invoices</span>
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

                {/* Unit Mismatch Warning */}
                {unitWarnings[component.id] && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#fef3c7',
                    border: '2px solid #f59e0b',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#92400e'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                         onClick={() => setExpandedWarnings(prev => ({ ...prev, [component.id]: !prev[component.id] }))}>
                      <span style={{ fontSize: '1.125rem', flexShrink: 0 }}>⚠️</span>
                      <div style={{ fontWeight: 600, flex: 1 }}>
                        {unitWarnings[component.id].count} {unitWarnings[component.id].count === 1 ? 'invoice uses' : 'invoices use'} incompatible units
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                        {expandedWarnings[component.id] ? '[Hide Details ▲]' : '[Show Details ▼]'}
                      </span>
                    </div>

                    {expandedWarnings[component.id] && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #fbbf24' }}>
                        <div style={{ marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
                          This recipe uses <strong>{UNIT_CATALOG[component.unit_of_measurement as Unit]?.label || component.unit_of_measurement}</strong>, but these invoices can't auto-convert:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {unitWarnings[component.id].items.map((warning, idx) => (
                            <div key={idx} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.5rem',
                              backgroundColor: '#fffbeb',
                              borderRadius: '0.25rem',
                              fontSize: '0.8125rem'
                            }}>
                              <div>
                                • <strong>{warning.invoiceNumber}</strong> ({warning.invoiceDate}): Uses {warning.invoiceUnit}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();

                                  if (!onNavigateToInvoice) {
                                    alert('Navigation not configured');
                                    return;
                                  }

                                  // Show branded confirmation modal
                                  setConfirmNavigation({
                                    invoiceId: warning.invoiceId,
                                    invoiceNumber: warning.invoiceNumber
                                  });
                                }}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem',
                                  color: '#7c3aed',
                                  backgroundColor: 'transparent',
                                  border: '1px solid #7c3aed',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                Edit Invoice →
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
            <FrozenGuardButton
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSubmitting}
              style={{ color: '#dc2626' }}
            >
              Delete Recipe
            </FrozenGuardButton>
          )}
        </div>
        <FrozenGuardButton
          variant="gold"
          onClick={handleSave}
          disabled={isSubmitting || components.length === 0}
        >
          {isSubmitting ? 'Saving...' : 'Save Recipe'}
        </FrozenGuardButton>
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
              <FrozenGuardButton
                variant="primary"
                onClick={handleArchiveRecipe}
                loading={isSubmitting}
                disabled={isSubmitting}
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
              <FrozenGuardButton
                variant="primary"
                onClick={handlePermanentDeleteRecipe}
                loading={isSubmitting}
                disabled={isSubmitting}
                style={{ backgroundColor: '#dc2626' }}
              >
                Permanently Delete
              </FrozenGuardButton>
            </div>
          </div>
        </div>
      )}

      {/* Branded Confirmation Modal for Navigation to Invoice */}
      {confirmNavigation && (
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
            zIndex: 10001
          }}
          onClick={() => setConfirmNavigation(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              margin: '0 0 1rem 0',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#111827'
            }}>
              Edit Invoice
            </h3>

            <p style={{
              margin: '0 0 1.5rem 0',
              color: '#6b7280',
              lineHeight: 1.5
            }}>
              Your recipe changes will be saved automatically before opening the invoice editor for <strong>"{confirmNavigation.invoiceNumber}"</strong>.
            </p>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
              <Button
                variant="outline"
                onClick={() => setConfirmNavigation(null)}
              >
                Cancel
              </Button>
              <Button
                variant="purple"
                onClick={async () => {
                  if (!onNavigateToInvoice) return;

                  const { invoiceId, invoiceNumber } = confirmNavigation;
                  setConfirmNavigation(null);

                  // Call the save handler directly
                  try {
                    await handleSave();
                    // Navigate after save completes
                    onNavigateToInvoice(invoiceId, invoiceNumber);
                    onCancel(); // Close the recipe builder
                  } catch (error) {
                    console.error('Error saving recipe before navigation:', error);
                    alert('Failed to save recipe. Please try again.');
                  }
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save & Edit Invoice'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
