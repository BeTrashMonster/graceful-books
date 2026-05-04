/**
 * Add/Edit Product Modal
 *
 * Modal for creating new finished products or editing existing ones.
 * Includes validation for name uniqueness, SKU uniqueness, and Selling Price format.
 * Now includes recipe entry functionality for one-step product + recipe creation.
 */

import { useState, useEffect, useRef } from 'react';
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
import { createDefaultCPGRecipe, type CPGRecipe } from '../../../db/schema/cpg.schema';
import { createDefaultCPGCategory, type CPGCategory } from '../../../db/schema/cpg.schema';
import { createDefaultCPGProductLabor, type CPGProductLabor } from '../../../db/schema/cpg.schema';
import { createDefaultCPGLaborRole, type CPGLaborRole } from '../../../db/schema/cpg.schema';
import { processMathInput } from '../../../utils/mathParser';
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

// Units of measurement for recipe items (matching CPG system)
const UNITS_OF_MEASUREMENT = [
  // Weight
  'oz', 'lb', 'g', 'kg',
  // Volume
  'ml', 'L', 'fl oz', 'cup', 'qt', 'gal',
  // Count
  'each', 'dozen', 'case'
];

// Recipe item interface
interface RecipeItem {
  category_id: string;
  variant?: string;
  // Batch-to-unit conversion support
  entry_mode: 'per_batch' | 'per_unit';
  quantity_per_batch?: string;  // e.g., "10" (for entire batch)
  batch_size?: string;           // e.g., "100" (units produced)
  quantity: string;              // Calculated or directly entered per-unit amount
  unit_of_measurement?: string;  // oz, lb, ml, L, each, etc.
}

// Labor item interface
interface LaborItem {
  labor_role_id: string;
  // Batch-to-unit conversion support
  entry_mode: 'per_batch' | 'per_unit';
  hours_per_batch?: string;  // e.g., "8.00" (hours for entire batch)
  batch_size?: string;       // e.g., "100" (units produced)
  hours_per_unit?: string;   // Calculated or directly entered per-unit hours
}

// Local category interface
interface LocalCategory {
  id: string;
  name: string;
  variants: string[];
  sort_order: number;
}

// Local labor role interface
interface LocalLaborRole {
  id: string;
  role_name: string;
  hourly_rate: string;
}

// Generate temp ID for recipe items and categories
let tempIdCounter = 0;
const generateTempId = (): string => {
  tempIdCounter++;
  const random = Math.random().toString(36).substring(2, 10);
  return `temp-${tempIdCounter}-${random}`;
};

// Calculate quantity per unit from batch data
const calculateQuantityPerUnit = (quantityPerBatch: string, batchSize: string): string => {
  const qty = parseFloat(quantityPerBatch);
  const size = parseFloat(batchSize);

  if (isNaN(qty) || isNaN(size) || size === 0) return '0';

  const qtyPerUnit = qty / size;
  return qtyPerUnit.toFixed(6); // 6 decimal precision
};

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
  const errorAlertRef = useRef<HTMLDivElement>(null);

  // Recipe state
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [invoiceData, setInvoiceData] = useState<Array<{ category_id: string; variant: string | null; unit: string }>>([]);
  const [newCategoryName, setNewCategoryName] = useState<Record<string, string>>({});
  const [showNewCategoryInput, setShowNewCategoryInput] = useState<Record<string, boolean>>({});
  const [showNewVariantInput, setShowNewVariantInput] = useState<Record<string, boolean>>({});
  const [newVariantValue, setNewVariantValue] = useState<Record<string, string>>({});

  // Labor state
  const [laborItems, setLaborItems] = useState<LaborItem[]>([]);
  const [laborRoles, setLaborRoles] = useState<LocalLaborRole[]>([]);
  const [newLaborRoleName, setNewLaborRoleName] = useState<Record<string, string>>({});
  const [newLaborHourlyRate, setNewLaborHourlyRate] = useState<Record<string, string>>({});
  const [showNewLaborRoleInput, setShowNewLaborRoleInput] = useState<Record<string, boolean>>({});

  // Scroll to error when errors are set
  useEffect(() => {
    if (Object.keys(errors).length > 0 && errorAlertRef.current) {
      errorAlertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errors]);

  // Load existing categories, invoices, and labor roles when modal opens
  useEffect(() => {
    if (!isOpen || !companyId) return;

    const loadData = async () => {
      // Load categories
      const existingCategories = await db.cpgCategories
        .where('company_id')
        .equals(companyId)
        .and((c) => c.deleted_at === null)
        .sortBy('sort_order');

      // Convert to local format with variants
      const localCats: LocalCategory[] = existingCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        variants: cat.variants || [],
        sort_order: cat.sort_order
      }));

      setCategories(localCats);

      // Load labor roles
      const existingRoles = await db.cpgLaborRoles
        .where('company_id')
        .equals(companyId)
        .and((r) => r.deleted_at === null)
        .toArray();

      // Convert to local format
      const localRoles: LocalLaborRole[] = existingRoles.map(role => ({
        id: role.id,
        role_name: role.role_name,
        hourly_rate: role.compensation_type === 'hourly'
          ? (role.hourly_rate || '20.00')
          : (role.calculated_hourly_rate || '20.00')
      }));

      setLaborRoles(localRoles);

      // Load invoices for validation
      const invoices = await db.cpgInvoices
        .where('company_id')
        .equals(companyId)
        .and((inv) => inv.deleted_at === null)
        .toArray();

      // Extract unique category+variant+unit combinations from cost attributions
      const invoiceItems: Array<{ category_id: string; variant: string | null; unit: string }> = [];
      invoices.forEach(invoice => {
        Object.values(invoice.cost_attribution || {}).forEach((attr: any) => {
          invoiceItems.push({
            category_id: attr.category_id,
            variant: attr.variant || null,
            unit: attr.unit_of_measurement || 'each'
          });
        });
      });

      setInvoiceData(invoiceItems);
    };

    loadData();
  }, [isOpen, companyId]);

  // Apply purple header styling when modal is open
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

  // Recipe item handlers
  const addRecipeItem = () => {
    setRecipeItems([...recipeItems, {
      category_id: '',
      entry_mode: 'per_batch',
      quantity_per_batch: '',
      batch_size: '',
      quantity: '',
      unit_of_measurement: 'oz'
    }]);
  };

  const removeRecipeItem = (itemIndex: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== itemIndex));
  };

  const updateRecipeItem = (itemIndex: number, field: keyof RecipeItem, value: string) => {
    const updated = [...recipeItems];
    const item = { ...updated[itemIndex], [field]: value };

    // Auto-calculate quantity per unit when in per_batch mode
    if (item.entry_mode === 'per_batch') {
      if (field === 'quantity_per_batch' || field === 'batch_size') {
        const qtyBatch = field === 'quantity_per_batch' ? value : item.quantity_per_batch || '';
        const batchSz = field === 'batch_size' ? value : item.batch_size || '';

        if (qtyBatch && batchSz) {
          item.quantity = calculateQuantityPerUnit(qtyBatch, batchSz);
        }
      }
    }

    updated[itemIndex] = item;
    setRecipeItems(updated);
  };

  // Category handlers (create on-the-fly)
  const createCategory = (itemIndex: number) => {
    const key = `item-${itemIndex}`;
    const name = newCategoryName[key]?.trim();

    if (!name) return;

    // Check if category already exists
    const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Use existing category
      updateRecipeItem(itemIndex, 'category_id', existing.id);
    } else {
      // Create new category (will be saved to DB on submit)
      const newCategory: LocalCategory = {
        id: generateTempId(),
        name,
        variants: [],
        sort_order: categories.length
      };
      setCategories([...categories, newCategory]);
      updateRecipeItem(itemIndex, 'category_id', newCategory.id);
    }

    // Clear input
    setNewCategoryName({ ...newCategoryName, [key]: '' });
    setShowNewCategoryInput({ ...showNewCategoryInput, [key]: false });
  };

  const addVariantToCategory = (categoryId: string, variant: string) => {
    const updated = categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, variants: [...cat.variants, variant] }
        : cat
    );
    setCategories(updated);
  };

  // Validate recipe item against invoices
  const getRecipeItemWarning = (item: RecipeItem): string | null => {
    if (!item.category_id || !item.unit_of_measurement) return null;

    const variant = item.variant || null;

    // Find exact match (category + variant + unit)
    const exactMatch = invoiceData.find(inv =>
      inv.category_id === item.category_id &&
      inv.variant === variant &&
      inv.unit === item.unit_of_measurement
    );

    if (exactMatch) return null; // Perfect match, no warning

    // Find category + variant match with different unit
    const categoryVariantMatch = invoiceData.find(inv =>
      inv.category_id === item.category_id &&
      inv.variant === variant
    );

    if (categoryVariantMatch) {
      // Same category+variant but different unit
      return `Invoice uses ${categoryVariantMatch.unit}, not ${item.unit_of_measurement}`;
    }

    // No invoice found at all for this category+variant
    const category = categories.find(c => c.id === item.category_id);
    const categoryName = category?.name || 'this ingredient';
    const variantText = variant ? ` (${variant})` : '';
    return `No invoice found for ${categoryName}${variantText}`;
  };

  // Labor item handlers
  const addLaborItem = () => {
    setLaborItems([...laborItems, {
      labor_role_id: '',
      entry_mode: 'per_batch',
      hours_per_batch: '',
      batch_size: '',
      hours_per_unit: ''
    }]);
  };

  const removeLaborItem = (itemIndex: number) => {
    setLaborItems(laborItems.filter((_, i) => i !== itemIndex));
  };

  const updateLaborItem = (itemIndex: number, field: keyof LaborItem, value: string) => {
    const updated = [...laborItems];
    const item = { ...updated[itemIndex], [field]: value };

    // Auto-calculate hours per unit when in per_batch mode
    if (item.entry_mode === 'per_batch') {
      if (field === 'hours_per_batch' || field === 'batch_size') {
        const hoursBatch = field === 'hours_per_batch' ? value : item.hours_per_batch || '';
        const batchSz = field === 'batch_size' ? value : item.batch_size || '';

        if (hoursBatch && batchSz) {
          const hours = parseFloat(hoursBatch);
          const size = parseFloat(batchSz);
          if (!isNaN(hours) && !isNaN(size) && size > 0) {
            item.hours_per_unit = (hours / size).toFixed(6);
          }
        }
      }
    }

    updated[itemIndex] = item;
    setLaborItems(updated);
  };

  // Create labor role on-the-fly
  const createLaborRole = (itemIndex: number) => {
    const key = `labor-${itemIndex}`;
    const name = newLaborRoleName[key]?.trim();
    const rate = newLaborHourlyRate[key]?.trim() || '20.00';

    if (!name) return;

    // Check if role already exists
    const existing = laborRoles.find(r => r.role_name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Use existing role
      updateLaborItem(itemIndex, 'labor_role_id', existing.id);
    } else {
      // Create new role (will be saved to DB on submit)
      const newRole: LocalLaborRole = {
        id: generateTempId(),
        role_name: name,
        hourly_rate: rate
      };
      setLaborRoles([...laborRoles, newRole]);
      updateLaborItem(itemIndex, 'labor_role_id', newRole.id);
    }

    // Clear inputs
    setNewLaborRoleName({ ...newLaborRoleName, [key]: '' });
    setNewLaborHourlyRate({ ...newLaborHourlyRate, [key]: '20.00' });
    setShowNewLaborRoleInput({ ...showNewLaborRoleInput, [key]: false });
  };

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
        else if (err.includes('MSRP') || err.includes('Selling Price')) errorMap.msrp = err;
        else if (err.includes('pieces_per_unit')) errorMap.piecesPerUnit = err;
        else errorMap.form = err;
      });
      setErrors(errorMap);
      return;
    }

    // Save to database (product + recipe + categories)
    setIsSubmitting(true);
    try {
      const productId = editingProduct?.id || (productData as CPGFinishedProduct).id;

      // Step 1: Save any new categories that were created inline
      const newCategoriesToSave: CPGCategory[] = [];
      const categoryIdMap: Record<string, string> = {}; // temp ID -> real ID

      for (const cat of categories) {
        if (cat.id.startsWith('temp-')) {
          // This is a new category - save it
          const realCategoryId = nanoid();
          const dbCategory: CPGCategory = {
            ...createDefaultCPGCategory(companyId, cat.name, deviceId || 'default'),
            id: realCategoryId,
            variants: cat.variants,
            sort_order: cat.sort_order,
          };
          newCategoriesToSave.push(dbCategory);
          categoryIdMap[cat.id] = realCategoryId;
        }
      }

      if (newCategoriesToSave.length > 0) {
        await db.cpgCategories.bulkAdd(newCategoriesToSave);
      }

      // Step 2: Save product
      if (editingProduct) {
        // Update existing product
        await db.cpgFinishedProducts.update(editingProduct.id, productData);
      } else {
        // Add new product
        await db.cpgFinishedProducts.add(productData as CPGFinishedProduct);
      }

      // Step 3: Save recipe items (if any)
      if (recipeItems.length > 0) {
        const validRecipeItems = recipeItems.filter(
          item => item.category_id && item.quantity.trim() && item.unit_of_measurement
        );

        const dbRecipeItems: CPGRecipe[] = validRecipeItems.map(item => {
          // Map temp category IDs to real IDs
          const realCategoryId = categoryIdMap[item.category_id] || item.category_id;

          return {
            ...createDefaultCPGRecipe(
              companyId,
              productId,
              realCategoryId,
              deviceId || 'default'
            ),
            id: nanoid(),
            variant: item.variant || null,
            quantity: item.quantity, // Use actual quantity from form
            unit_of_measurement: item.unit_of_measurement || 'oz',
          };
        });

        if (dbRecipeItems.length > 0) {
          await db.cpgRecipes.bulkAdd(dbRecipeItems);
        }
      }

      // Step 4: Save new labor roles and labor assignments (if any)
      const laborRoleIdMap: Record<string, string> = {}; // temp ID -> real ID

      if (laborItems.length > 0) {
        // First, save any new labor roles that were created inline
        const newLaborRolesToSave: CPGLaborRole[] = [];

        for (const role of laborRoles) {
          if (role.id.startsWith('temp-')) {
            // This is a new role - save it
            const realRoleId = nanoid();
            const dbRole: CPGLaborRole = {
              ...createDefaultCPGLaborRole(companyId, role.role_name, deviceId || 'default'),
              id: realRoleId,
              hourly_rate: role.hourly_rate,
              compensation_type: 'hourly',
              salary_amount: null,
              salary_period: null,
              calculated_hourly_rate: null,
            };
            newLaborRolesToSave.push(dbRole);
            laborRoleIdMap[role.id] = realRoleId;
          }
        }

        if (newLaborRolesToSave.length > 0) {
          await db.cpgLaborRoles.bulkAdd(newLaborRolesToSave);
        }

        // Then, save labor assignments
        const validLaborItems = laborItems.filter(
          item => item.labor_role_id &&
            (item.entry_mode === 'per_unit' ? item.hours_per_unit?.trim() :
             (item.hours_per_batch?.trim() && item.batch_size?.trim()))
        );

        const dbLaborItems: CPGProductLabor[] = validLaborItems.map(item => {
          // Map temp role IDs to real IDs
          const realRoleId = laborRoleIdMap[item.labor_role_id] || item.labor_role_id;

          return {
            ...createDefaultCPGProductLabor(
              companyId,
              productId,
              realRoleId,
              deviceId || 'default'
            ),
            id: nanoid(),
            entry_mode: item.entry_mode,
            hours_per_batch: item.hours_per_batch || null,
            batch_size: item.batch_size || null,
            hours_per_unit: item.hours_per_unit || null,
          };
        });

        if (dbLaborItems.length > 0) {
          await db.cpgProductLabors.bulkAdd(dbLaborItems);
        }
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
    setRecipeItems([]);
    setCategories([]);
    setNewCategoryName({});
    setShowNewCategoryInput({});
    setShowNewVariantInput({});
    setNewVariantValue({});
    setLaborItems([]);
    setLaborRoles([]);
    setNewLaborRoleName({});
    setNewLaborHourlyRate({});
    setShowNewLaborRoleInput({});
    setErrors({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingProduct ? 'Edit Product' : 'Add New Product'}
      size="xl"
      closeOnBackdropClick={false}
      footer={
        <div className={styles.modalFooter}>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="gold" onClick={handleSubmit} disabled={isSubmitting}>
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
          <div ref={errorAlertRef} className={styles.errorAlert} role="alert">
            {errors.form}
          </div>
        )}

        <div className={styles.row}>
          <Input
            label="Product Name"
            placeholder="ex: 1oz Body Oil"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
            fullWidth
            autoFocus
          />

          <Input
            label="SKU (Optional)"
            placeholder="ex: BO-1OZ"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            error={errors.sku}
            fullWidth
          />

          <Input
            label="Selling Price (Optional)"
            placeholder="ex: 10.00"
            value={msrp}
            onChange={(e) => setMsrp(e.target.value)}
            onBlur={(e) => {
              const { value, calculated } = processMathInput(e.target.value, true);
              if (calculated || e.target.value !== value) {
                setMsrp(value);
              }
            }}
            error={errors.msrp}
            iconBefore="$"
            fullWidth
          />
        </div>

        <Input
          label="Description (Optional)"
          placeholder="ex: Premium lavender body oil in a 1oz bottle"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
        />

        <div className={styles.rowEqual}>
          <div>
            <label htmlFor="unitOfMeasure" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#374151' }}>
              Unit of Measure
            </label>
            <select
              id="unitOfMeasure"
              value={unitOfMeasure}
              onChange={(e) => setUnitOfMeasure(e.target.value)}
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '0.625rem 0.875rem',
                border: '2px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.9375rem',
                backgroundColor: '#ffffff',
                outline: 'none',
                transition: 'border-color 150ms ease-out',
                boxSizing: 'border-box' as const,
              }}
            >
              {UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
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
        </div>

        {/* Recipe Section */}
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '2px solid #e5e7eb' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
              Recipe
            </h4>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
              Add items by category (ex: "Package") that make up your product. Use variants to specify different types or sizes (ex: "1 oz Small" vs "10 oz Large").
            </p>
          </div>

          {/* Grid container for two items per row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            {recipeItems.map((item, itemIndex) => {
              const key = `item-${itemIndex}`;
              const selectedCategory = categories.find(c => c.id === item.category_id);
              const warning = getRecipeItemWarning(item);

              return (
                <div key={itemIndex} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  padding: '1rem',
                  background: '#E5F6DF',
                  borderRadius: '0.5rem',
                  position: 'relative'
                }}>
                  {/* Category and Variant Row */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                        Item Category
                      </label>
                      {showNewCategoryInput[key] ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            value={newCategoryName[key] || ''}
                            onChange={(e) => setNewCategoryName({ ...newCategoryName, [key]: e.target.value })}
                            placeholder="ex: Package"
                            style={{
                              flex: 1,
                              minHeight: '44px',
                              padding: '0.625rem 0.875rem',
                              border: '2px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.9375rem',
                              backgroundColor: '#ffffff'
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                createCategory(itemIndex);
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value) {
                                createCategory(itemIndex);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => createCategory(itemIndex)}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#d4af37',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              cursor: 'pointer'
                            }}
                          >
                            Create
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewCategoryInput({ ...showNewCategoryInput, [key]: false });
                              setNewCategoryName({ ...newCategoryName, [key]: '' });
                            }}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: 'transparent',
                              color: '#6b7280',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : categories.length > 0 ? (
                        <select
                          value={item.category_id}
                          onChange={(e) => {
                            if (e.target.value === '__new__') {
                              setShowNewCategoryInput({ ...showNewCategoryInput, [key]: true });
                            } else {
                              updateRecipeItem(itemIndex, 'category_id', e.target.value);
                            }
                          }}
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.625rem 0.875rem',
                            border: '2px solid #d1d5db',
                            borderRadius: '0.375rem',
                            fontSize: '0.9375rem',
                            backgroundColor: '#ffffff'
                          }}
                        >
                          <option value="">Select...</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                          <option value="__new__">+ Add New Category</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={newCategoryName[key] || ''}
                          onChange={(e) => setNewCategoryName({ ...newCategoryName, [key]: e.target.value })}
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value) {
                              createCategory(itemIndex);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const value = e.currentTarget.value.trim();
                              if (value) {
                                createCategory(itemIndex);
                              }
                            }
                          }}
                          placeholder="ex: Package"
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.625rem 0.875rem',
                            border: '2px solid #d1d5db',
                            borderRadius: '0.375rem',
                            fontSize: '0.9375rem',
                            backgroundColor: '#ffffff'
                          }}
                        />
                      )}
                    </div>

                    {/* Variant (only show if category selected) */}
                    {selectedCategory && (
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                          Variant (optional)
                        </label>
                        {showNewVariantInput[key] ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="text"
                              value={newVariantValue[key] || ''}
                              onChange={(e) => setNewVariantValue({ ...newVariantValue, [key]: e.target.value })}
                              placeholder="ex: 1 oz Small"
                              style={{
                                flex: 1,
                                minHeight: '44px',
                                padding: '0.625rem 0.875rem',
                                border: '2px solid #d1d5db',
                                borderRadius: '0.375rem',
                                fontSize: '0.9375rem',
                                backgroundColor: '#ffffff'
                              }}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const variant = newVariantValue[key]?.trim();
                                  if (variant) {
                                    addVariantToCategory(selectedCategory.id, variant);
                                    updateRecipeItem(itemIndex, 'variant', variant);
                                    setNewVariantValue({ ...newVariantValue, [key]: '' });
                                    setShowNewVariantInput({ ...showNewVariantInput, [key]: false });
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const variant = e.target.value.trim();
                                if (variant) {
                                  addVariantToCategory(selectedCategory.id, variant);
                                  updateRecipeItem(itemIndex, 'variant', variant);
                                  setNewVariantValue({ ...newVariantValue, [key]: '' });
                                  setShowNewVariantInput({ ...showNewVariantInput, [key]: false });
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const variant = newVariantValue[key]?.trim();
                                if (variant) {
                                  addVariantToCategory(selectedCategory.id, variant);
                                  updateRecipeItem(itemIndex, 'variant', variant);
                                  setNewVariantValue({ ...newVariantValue, [key]: '' });
                                  setShowNewVariantInput({ ...showNewVariantInput, [key]: false });
                                }
                              }}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#d4af37',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                cursor: 'pointer'
                              }}
                            >
                              Create
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowNewVariantInput({ ...showNewVariantInput, [key]: false });
                                setNewVariantValue({ ...newVariantValue, [key]: '' });
                              }}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: 'transparent',
                                color: '#6b7280',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                cursor: 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : selectedCategory.variants.length > 0 ? (
                          <select
                            value={item.variant || ''}
                            onChange={(e) => {
                              if (e.target.value === '__new__') {
                                setShowNewVariantInput({ ...showNewVariantInput, [key]: true });
                              } else {
                                updateRecipeItem(itemIndex, 'variant', e.target.value);
                              }
                            }}
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              padding: '0.625rem 0.875rem',
                              border: '2px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.9375rem',
                              backgroundColor: '#ffffff'
                            }}
                          >
                            <option value="">Select...</option>
                            {selectedCategory.variants.map((variant, i) => (
                              <option key={i} value={variant}>{variant}</option>
                            ))}
                            <option value="__new__">+ Add New Variant</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={item.variant || ''}
                            onChange={(e) => updateRecipeItem(itemIndex, 'variant', e.target.value)}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value && !selectedCategory.variants.includes(value)) {
                                addVariantToCategory(selectedCategory.id, value);
                              }
                            }}
                            placeholder="ex: 1 oz Small"
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              padding: '0.625rem 0.875rem',
                              border: '2px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.9375rem',
                              backgroundColor: '#ffffff'
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Entry Mode Toggle */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                      How do you measure this?
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => updateRecipeItem(itemIndex, 'entry_mode', 'per_batch')}
                        style={{
                          flex: 1,
                          padding: '0.625rem 1rem',
                          backgroundColor: item.entry_mode === 'per_batch' ? '#4b006e' : 'transparent',
                          color: item.entry_mode === 'per_batch' ? 'white' : '#6b7280',
                          border: item.entry_mode === 'per_batch' ? 'none' : '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                      >
                        Per Batch
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRecipeItem(itemIndex, 'entry_mode', 'per_unit')}
                        style={{
                          flex: 1,
                          padding: '0.625rem 1rem',
                          backgroundColor: item.entry_mode === 'per_unit' ? '#4b006e' : 'transparent',
                          color: item.entry_mode === 'per_unit' ? 'white' : '#6b7280',
                          border: item.entry_mode === 'per_unit' ? 'none' : '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                      >
                        Per Unit
                      </button>
                    </div>
                  </div>

                  {/* Batch Entry Mode */}
                  {item.entry_mode === 'per_batch' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                            Quantity per Batch
                          </label>
                          <input
                            type="number"
                            value={item.quantity_per_batch || ''}
                            onChange={(e) => updateRecipeItem(itemIndex, 'quantity_per_batch', e.target.value)}
                            placeholder="ex: 10"
                            step="0.01"
                            min="0"
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              padding: '0.625rem 0.875rem',
                              border: '2px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.9375rem',
                              backgroundColor: '#ffffff'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                            Unit
                          </label>
                          <select
                            value={item.unit_of_measurement || ''}
                            onChange={(e) => updateRecipeItem(itemIndex, 'unit_of_measurement', e.target.value)}
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              padding: '0.625rem 0.875rem',
                              border: '2px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.9375rem',
                              backgroundColor: '#ffffff'
                            }}
                          >
                            {UNITS_OF_MEASUREMENT.map(unit => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                            Batch Size (units made)
                          </label>
                          <input
                            type="number"
                            value={item.batch_size || ''}
                            onChange={(e) => updateRecipeItem(itemIndex, 'batch_size', e.target.value)}
                            placeholder="ex: 100"
                            step="1"
                            min="1"
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              padding: '0.625rem 0.875rem',
                              border: '2px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.9375rem',
                              backgroundColor: '#ffffff'
                            }}
                          />
                        </div>
                      </div>
                      {item.quantity_per_batch && item.batch_size && (
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#059669',
                          fontWeight: 500,
                          padding: '0.5rem',
                          backgroundColor: 'rgba(5, 150, 105, 0.1)',
                          borderRadius: '0.375rem'
                        }}>
                          → {item.quantity} {item.unit_of_measurement} per unit
                        </div>
                      )}
                    </>
                  )}

                  {/* Per Unit Entry Mode */}
                  {item.entry_mode === 'per_unit' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                          Quantity per Unit
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateRecipeItem(itemIndex, 'quantity', e.target.value)}
                          placeholder="ex: 0.10"
                          step="0.000001"
                          min="0"
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.625rem 0.875rem',
                            border: '2px solid #d1d5db',
                            borderRadius: '0.375rem',
                            fontSize: '0.9375rem',
                            backgroundColor: '#ffffff'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                          Unit
                        </label>
                        <select
                          value={item.unit_of_measurement || ''}
                          onChange={(e) => updateRecipeItem(itemIndex, 'unit_of_measurement', e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.625rem 0.875rem',
                            border: '2px solid #d1d5db',
                            borderRadius: '0.375rem',
                            fontSize: '0.9375rem',
                            backgroundColor: '#ffffff'
                          }}
                        >
                          {UNITS_OF_MEASUREMENT.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Warning for missing invoice or unit mismatch */}
                  {warning && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#fef3c7',
                      border: '1px solid #f59e0b',
                      borderRadius: '0.375rem',
                      fontSize: '0.8125rem',
                      color: '#92400e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span style={{ fontSize: '1rem' }}>⚠️</span>
                      <span>{warning}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => removeRecipeItem(itemIndex)}
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      width: '28px',
                      height: '28px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10
                    }}
                    aria-label="Remove ingredient"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addRecipeItem}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: 'transparent',
              color: '#4b006e',
              border: '2px dashed #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4b006e';
              e.currentTarget.style.backgroundColor = 'rgba(75, 0, 110, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            + Add Recipe Item
          </button>
        </div>

        {/* Labor Section */}
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '2px solid #e5e7eb' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
              Labor
            </h4>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
              Add labor roles that contribute to making this product. Track hours per batch or per unit.
            </p>
          </div>

          {/* Grid container for two items per row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            {laborItems.map((item, itemIndex) => {
              const key = `labor-${itemIndex}`;
              const selectedRole = laborRoles.find(r => r.id === item.labor_role_id);

              return (
                <div key={itemIndex} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  padding: '1rem',
                  background: '#E5F6DF',
                  borderRadius: '0.5rem',
                  position: 'relative'
                }}>
                  {/* Labor Role Selection */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                      Labor Role
                    </label>
                    {showNewLaborRoleInput[key] ? (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="text"
                            value={newLaborRoleName[key] || ''}
                            onChange={(e) => setNewLaborRoleName({ ...newLaborRoleName, [key]: e.target.value })}
                            placeholder="ex: Production Worker"
                            style={{
                              flex: 1,
                              minHeight: '44px',
                              padding: '0.625rem 0.875rem',
                              border: '2px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.9375rem',
                              backgroundColor: '#ffffff'
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                createLaborRole(itemIndex);
                              }
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
                              Hourly Rate
                            </label>
                            <input
                              type="number"
                              value={newLaborHourlyRate[key] || '20.00'}
                              onChange={(e) => setNewLaborHourlyRate({ ...newLaborHourlyRate, [key]: e.target.value })}
                              placeholder="20.00"
                              step="0.01"
                              min="0"
                              style={{
                                width: '100%',
                                minHeight: '44px',
                                padding: '0.625rem 0.875rem',
                                border: '2px solid #d1d5db',
                                borderRadius: '0.375rem',
                                fontSize: '0.9375rem',
                                backgroundColor: '#ffffff'
                              }}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => createLaborRole(itemIndex)}
                            style={{
                              flex: 1,
                              padding: '0.5rem 1rem',
                              backgroundColor: '#d4af37',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              cursor: 'pointer'
                            }}
                          >
                            Create
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewLaborRoleInput({ ...showNewLaborRoleInput, [key]: false });
                              setNewLaborRoleName({ ...newLaborRoleName, [key]: '' });
                              setNewLaborHourlyRate({ ...newLaborHourlyRate, [key]: '20.00' });
                            }}
                            style={{
                              flex: 1,
                              padding: '0.5rem 1rem',
                              backgroundColor: 'transparent',
                              color: '#6b7280',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : laborRoles.length > 0 ? (
                      <select
                        value={item.labor_role_id}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setShowNewLaborRoleInput({ ...showNewLaborRoleInput, [key]: true });
                          } else {
                            updateLaborItem(itemIndex, 'labor_role_id', e.target.value);
                          }
                        }}
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '0.625rem 0.875rem',
                          border: '2px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.9375rem',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <option value="">Select...</option>
                        {laborRoles.map(role => (
                          <option key={role.id} value={role.id}>{role.role_name} (${role.hourly_rate}/hr)</option>
                        ))}
                        <option value="__new__">+ Add New Role</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={newLaborRoleName[key] || ''}
                        onChange={(e) => setNewLaborRoleName({ ...newLaborRoleName, [key]: e.target.value })}
                        onBlur={() => {
                          if (newLaborRoleName[key]?.trim()) {
                            createLaborRole(itemIndex);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newLaborRoleName[key]?.trim()) {
                              createLaborRole(itemIndex);
                            }
                          }
                        }}
                        placeholder="ex: Production Worker"
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '0.625rem 0.875rem',
                          border: '2px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.9375rem',
                          backgroundColor: '#ffffff'
                        }}
                      />
                    )}
                  </div>

                  {/* Entry Mode Toggle */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                      How do you measure hours?
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => updateLaborItem(itemIndex, 'entry_mode', 'per_batch')}
                        style={{
                          flex: 1,
                          padding: '0.625rem 1rem',
                          backgroundColor: item.entry_mode === 'per_batch' ? '#4b006e' : 'transparent',
                          color: item.entry_mode === 'per_batch' ? 'white' : '#6b7280',
                          border: item.entry_mode === 'per_batch' ? 'none' : '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                      >
                        Per Batch
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLaborItem(itemIndex, 'entry_mode', 'per_unit')}
                        style={{
                          flex: 1,
                          padding: '0.625rem 1rem',
                          backgroundColor: item.entry_mode === 'per_unit' ? '#4b006e' : 'transparent',
                          color: item.entry_mode === 'per_unit' ? 'white' : '#6b7280',
                          border: item.entry_mode === 'per_unit' ? 'none' : '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                      >
                        Per Unit
                      </button>
                    </div>
                  </div>

                  {/* Batch Entry Mode */}
                  {item.entry_mode === 'per_batch' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                            Hours per Batch
                          </label>
                          <input
                            type="number"
                            value={item.hours_per_batch || ''}
                            onChange={(e) => updateLaborItem(itemIndex, 'hours_per_batch', e.target.value)}
                            placeholder="ex: 8.00"
                            step="0.01"
                            min="0"
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              padding: '0.625rem 0.875rem',
                              border: '2px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.9375rem',
                              backgroundColor: '#ffffff'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                            Batch Size (units)
                          </label>
                          <input
                            type="number"
                            value={item.batch_size || ''}
                            onChange={(e) => updateLaborItem(itemIndex, 'batch_size', e.target.value)}
                            placeholder="ex: 100"
                            step="1"
                            min="1"
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              padding: '0.625rem 0.875rem',
                              border: '2px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.9375rem',
                              backgroundColor: '#ffffff'
                            }}
                          />
                        </div>
                      </div>
                      {item.hours_per_batch && item.batch_size && (
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#059669',
                          fontWeight: 500,
                          padding: '0.5rem',
                          backgroundColor: 'rgba(5, 150, 105, 0.1)',
                          borderRadius: '0.375rem'
                        }}>
                          → {item.hours_per_unit} hours per unit
                        </div>
                      )}
                    </>
                  )}

                  {/* Per Unit Entry Mode */}
                  {item.entry_mode === 'per_unit' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                        Hours per Unit
                      </label>
                      <input
                        type="number"
                        value={item.hours_per_unit || ''}
                        onChange={(e) => updateLaborItem(itemIndex, 'hours_per_unit', e.target.value)}
                        placeholder="ex: 0.08"
                        step="0.000001"
                        min="0"
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '0.625rem 0.875rem',
                          border: '2px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.9375rem',
                          backgroundColor: '#ffffff'
                        }}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => removeLaborItem(itemIndex)}
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      width: '28px',
                      height: '28px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10
                    }}
                    aria-label="Remove labor assignment"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addLaborItem}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: 'transparent',
              color: '#4b006e',
              border: '2px dashed #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4b006e';
              e.currentTarget.style.backgroundColor = 'rgba(75, 0, 110, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            + Add Labor Assignment
          </button>
        </div>
      </form>
    </Modal>
  );
}
