/**
 * Comprehensive Product Worksheet
 *
 * Natural flow: Add products with their recipes, create categories on-the-fly
 * Includes autosave to localStorage to prevent data loss
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styles from './ComprehensiveWorksheet.module.css';
import { processDateInput } from '../../utils/dateUtils';
import { LoadingOverlay } from '../feedback/Loading';
import { areUnitsCompatible, getUnitType, type Unit } from '../../utils/unitConversion';
import { calculateSHDistribution, type Invoice as SHInvoice } from '../../utils/shDistribution';

import { WorksheetSidebar, type WorksheetStep } from './WorksheetSidebar';
// Autosave configuration
const AUTOSAVE_KEY = 'worksheet-autosave';
const AUTOSAVE_INTERVAL_MS = 30000; // 30 seconds

interface Category {
  id: string;
  name: string;
  variants: string[];
  sort_order: number;
  is_distribution_category?: boolean; // For Shipping & Handling
}

interface Vendor {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  msrp: string;
  sku: string;
}

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

interface Recipe {
  product_id: string;
  items: RecipeItem[];
}

interface InvoiceItem {
  category_id: string;
  variant?: string;
  quantity: string;
  unit_of_measurement?: Unit;
  unit_cost: string;
  line_total?: string; // Auto-calculated or manual override
  is_personal?: boolean; // True if this is a personal item (not business expense)
  distribution_method?: 'equal' | 'weighted'; // For S+H categories only
  unitWarning?: string; // Unit mismatch warning message
  item_type?: 'regular' | 'shipping' | 'personal'; // Type of line item
  // S+H distribution settings
  target_invoices?: string[]; // Invoice IDs to apply S+H to. Empty/undefined = this invoice only
  items_filter?: 'all' | 'categories'; // Apply to all items or specific categories
  selected_categories?: string[]; // Categories to apply S+H to when items_filter is 'categories'
  // Legacy field for backwards compatibility
  distribution_target?: string;
}

interface Invoice {
  id: string;
  vendor_id: string;
  vendor_name: string;
  invoice_date: string;
  invoice_number?: string;
  invoice_total?: string;
  items: InvoiceItem[];
  notes?: string;
}

// Form state for conversion entry (all 4 values editable)
interface ConversionFormState {
  category_id: string;
  variant: string | null;
  leftQty: string;
  leftUnit: string;
  rightQty: string;
  rightUnit: string;
}

// Export format for worksheet JSON (matches database schema)
interface UnitConversion {
  category_id: string;
  variant: string | null;
  from_unit: string;  // e.g., 'lb' (weight unit)
  to_unit: string;    // e.g., 'cup' (volume unit)
  conversion_factor: string; // Calculated: rightQty / leftQty (normalized)
}

interface WorksheetData {
  version: string;
  created_at: string;
  categories: Category[];
  vendors: Vendor[];
  finished_products: Product[];
  recipes: Recipe[];
  invoices: Invoice[];
  unit_conversions: UnitConversion[];
}

interface ComprehensiveWorksheetProps {
  onComplete: (data: WorksheetData) => void;
  onSkip: () => void;
}

type Step = 'products' | 'recipes' | 'invoices' | 'review';

// Generate temp ID in format expected by importer: temp-{timestamp}-{random}
let tempIdCounter = 0;
const generateTempId = (): string => {
  tempIdCounter++;
  const random = Math.random().toString(36).substring(2, 10);
  return `temp-${tempIdCounter}-${random}`;
};

// Units of measurement (matching CPG system and unitConversion.ts)
const UNITS_OF_MEASUREMENT = [
  // Weight (small to large)
  'mg', 'g', 'kg', 'oz', 'lb',
  // Volume (small to large)
  'ml', 'tsp', 'tbsp', 'fl oz', 'cup', 'pt', 'qt', 'L', 'gal',
  // Count
  'each', 'dozen', 'case'
];

// Calculate quantity per unit from batch data
const calculateQuantityPerUnit = (quantityPerBatch: string, batchSize: string): string => {
  const qty = parseFloat(quantityPerBatch);
  const size = parseFloat(batchSize);

  if (isNaN(qty) || isNaN(size) || size === 0) return '0';

  const qtyPerUnit = qty / size;
  return qtyPerUnit.toFixed(6); // 6 decimal precision like labor system
};

// Calculate invoice line total
const calculateLineTotal = (quantity: string, unitCost: string): string => {
  const qty = parseFloat(quantity);
  const cost = parseFloat(unitCost);

  if (isNaN(qty) || isNaN(cost)) return '0.00';

  return (qty * cost).toFixed(2);
};

// Evaluate basic math expressions (150-15.99 = 134.01)
const evaluateMathExpression = (expression: string): string => {
  if (!expression) return '';

  const trimmed = expression.trim();

  // If it's already a number, return it
  if (/^-?\d+\.?\d*$/.test(trimmed)) {
    return trimmed;
  }

  try {
    // Only allow numbers, spaces, and basic operators
    if (!/^[\d\s+\-*/.()]+$/.test(trimmed)) {
      return trimmed; // Return original if invalid characters
    }

    // Evaluate the expression safely
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + trimmed + ')')();

    if (typeof result === 'number' && !isNaN(result)) {
      return result.toFixed(2);
    }
  } catch (e) {
    // If evaluation fails, return original value
    return trimmed;
  }

  return trimmed;
};

export function ComprehensiveWorksheet({ onComplete, onSkip }: ComprehensiveWorksheetProps) {
  const [currentStep, setCurrentStep] = useState<Step>('products');
  const [importing, setImporting] = useState(false);

  // Track categories as they're created (include default Shipping & Handling)
  const [categories, setCategories] = useState<Category[]>([
    {
      id: generateTempId(), // Use proper temp ID, not sentinel
      name: 'Shipping & Handling',
      variants: [],
      sort_order: 9999, // Show at end
      is_distribution_category: true
    }
  ]);

  // Track vendors as they're created
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Track products with embedded recipe UI
  const [products, setProducts] = useState<Array<Product & { recipeItems: RecipeItem[] }>>([
    {
      id: generateTempId(),
      name: '',
      msrp: '',
      sku: '',
      recipeItems: []
    }
  ]);

  const [invoices, setInvoices] = useState<Invoice[]>([
    {
      id: generateTempId(),
      vendor_id: '',
      vendor_name: '',
      invoice_date: '',
      invoice_total: '',
      items: [{
        category_id: '',
        variant: '',
        quantity: '',
        unit_of_measurement: 'oz',
        unit_cost: '',
        line_total: ''
      }],
      notes: ''
    }
  ]);

  // Track unit conversions for weight ↔ volume mismatches (stores form state)
  const [conversionForms, setConversionForms] = useState<ConversionFormState[]>([]);

  // Track which invoices are expanded (accordion)
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set([invoices[0].id]));

  // Track which recipe cards are expanded
  const [expandedRecipes, setExpandedRecipes] = useState<Set<string>>(new Set());
  // Track which S+H dropdowns are open (invoice_id + item_index + type)
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState<string | null>(null);
  const [openInvoiceDropdown, setOpenInvoiceDropdown] = useState<string | null>(null);

  const toggleRecipeExpanded = (productId: string) => {
    setExpandedRecipes(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // For adding new category inline
  const [newCategoryName, setNewCategoryName] = useState<Record<string, string>>({});
  const [showNewCategoryInput, setShowNewCategoryInput] = useState<Record<string, boolean>>({});

  // For adding new variant inline
  const [showNewVariantInput, setShowNewVariantInput] = useState<Record<string, boolean>>({});
  const [newVariantValue, setNewVariantValue] = useState<Record<string, string>>({});

  // For adding new vendor inline
  const [newVendorName, setNewVendorName] = useState<Record<string, string>>({});
  const [showNewVendorInput, setShowNewVendorInput] = useState<Record<string, boolean>>({});

  // Autosave state
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [savedDataTimestamp, setSavedDataTimestamp] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);
  const isRestoringRef = useRef(false);

  // Weight, volume, and count units for conversion dropdowns
  const WEIGHT_UNITS = ['mg', 'g', 'kg', 'oz', 'lb'];
  const VOLUME_UNITS = ['ml', 'tsp', 'tbsp', 'fl oz', 'cup', 'pt', 'qt', 'L', 'gal'];
  const COUNT_UNITS = ['each', 'dozen', 'case'];

  // Get units array for a given unit type
  const getUnitsForType = (unitType: string | null): string[] => {
    switch (unitType) {
      case 'weight': return WEIGHT_UNITS;
      case 'volume': return VOLUME_UNITS;
      case 'count':
      case 'each': return COUNT_UNITS;
      default: return [...WEIGHT_UNITS, ...VOLUME_UNITS, ...COUNT_UNITS];
    }
  };

  // ========================================================================
  // Unit Conversion Helper Functions
  // ========================================================================

  // Get recipe unit for a category+variant (returns first match found across all products)
  const getRecipeUnit = useCallback((categoryId: string, variant: string | null | undefined): string | null => {
    for (const product of products) {
      const recipeItem = product.recipeItems.find(
        r => r.category_id === categoryId && (r.variant || null) === (variant || null)
      );
      if (recipeItem?.unit_of_measurement) {
        return recipeItem.unit_of_measurement;
      }
    }
    return null;
  }, [products]);

  // Get existing conversion form for a category+variant
  const getConversionForm = useCallback((categoryId: string, variant: string | null | undefined): ConversionFormState | null => {
    return conversionForms.find(
      c => c.category_id === categoryId && c.variant === (variant || null)
    ) || null;
  }, [conversionForms]);

  // Check if a conversion exists and is valid for this category+variant
  const hasValidConversion = useCallback((categoryId: string, variant: string | null | undefined): boolean => {
    const form = conversionForms.find(
      c => c.category_id === categoryId && c.variant === (variant || null)
    );
    if (!form) return false;
    const leftQty = parseFloat(form.leftQty);
    const rightQty = parseFloat(form.rightQty);
    return !isNaN(leftQty) && !isNaN(rightQty) && leftQty > 0 && rightQty > 0;
  }, [conversionForms]);

  // Initialize or get conversion form for a category+variant with detected units
  const getOrCreateConversionForm = useCallback((
    categoryId: string,
    variant: string | null | undefined,
    invoiceUnit: string,
    recipeUnit: string
  ): ConversionFormState => {
    const existing = conversionForms.find(
      c => c.category_id === categoryId && c.variant === (variant || null)
    );
    if (existing) return existing;

    // Create new form with detected units
    const invoiceUnitType = getUnitType(invoiceUnit as Unit);
    return {
      category_id: categoryId,
      variant: variant || null,
      leftQty: '1',
      leftUnit: invoiceUnitType === 'weight' ? invoiceUnit : recipeUnit,
      rightQty: '',
      rightUnit: invoiceUnitType === 'weight' ? recipeUnit : invoiceUnit
    };
  }, [conversionForms]);

  // Update a specific field in a conversion form
  const updateConversionForm = useCallback((
    categoryId: string,
    variant: string | null | undefined,
    field: keyof ConversionFormState,
    value: string
  ) => {
    setConversionForms(prev => {
      const existingIndex = prev.findIndex(
        c => c.category_id === categoryId && c.variant === (variant || null)
      );

      if (existingIndex >= 0) {
        // Update existing - dropdowns are now restricted to valid unit types
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], [field]: value };
        return updated;
      } else {
        // Create new (shouldn't normally happen, but handle it)
        return [...prev, {
          category_id: categoryId,
          variant: variant || null,
          leftQty: field === 'leftQty' ? value : '1',
          leftUnit: field === 'leftUnit' ? value : 'lb',
          rightQty: field === 'rightQty' ? value : '',
          rightUnit: field === 'rightUnit' ? value : 'cup'
        }];
      }
    });
  }, []);

  // Ensure a conversion form exists for a category+variant
  const ensureConversionForm = useCallback((
    categoryId: string,
    variant: string | null | undefined,
    invoiceUnit: string,
    recipeUnit: string
  ) => {
    setConversionForms(prev => {
      const exists = prev.some(
        c => c.category_id === categoryId && c.variant === (variant || null)
      );
      if (exists) return prev;

      const invoiceUnitType = getUnitType(invoiceUnit as Unit);
      return [...prev, {
        category_id: categoryId,
        variant: variant || null,
        leftQty: '1',
        leftUnit: invoiceUnitType === 'weight' ? invoiceUnit : recipeUnit,
        rightQty: '',
        rightUnit: invoiceUnitType === 'weight' ? recipeUnit : invoiceUnit
      }];
    });
  }, []);

  // Convert form states to export format (UnitConversion[])
  const convertFormsToExport = useCallback((): UnitConversion[] => {
    return conversionForms
      .filter(form => {
        const leftQty = parseFloat(form.leftQty);
        const rightQty = parseFloat(form.rightQty);
        return !isNaN(leftQty) && !isNaN(rightQty) && leftQty > 0 && rightQty > 0;
      })
      .map(form => {
        const leftQty = parseFloat(form.leftQty);
        const rightQty = parseFloat(form.rightQty);
        const leftType = getUnitType(form.leftUnit as Unit);

        // Normalize: from_unit should always be weight, to_unit should be volume
        let fromUnit: string;
        let toUnit: string;
        let factor: number;

        if (leftType === 'weight') {
          fromUnit = form.leftUnit;
          toUnit = form.rightUnit;
          factor = rightQty / leftQty;
        } else {
          fromUnit = form.rightUnit;
          toUnit = form.leftUnit;
          factor = leftQty / rightQty;
        }

        return {
          category_id: form.category_id,
          variant: form.variant,
          from_unit: fromUnit,
          to_unit: toUnit,
          conversion_factor: factor.toString()
        };
      });
  }, [conversionForms]);

  // Check for saved data on mount
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.timestamp && parsed.categories && parsed.products && parsed.invoices) {
          const savedDate = new Date(parsed.timestamp);
          const formattedDate = savedDate.toLocaleString();
          setSavedDataTimestamp(formattedDate);
          setShowRestoreModal(true);
        }
      }
    } catch (e) {
      console.error('Error checking for autosaved data:', e);
      localStorage.removeItem(AUTOSAVE_KEY);
    }
  }, []);

  // Autosave every 30 seconds
  useEffect(() => {
    // Don't autosave if we're in the process of restoring or importing
    if (isRestoringRef.current || importing) return;

    const saveData = () => {
      // Only save if there's meaningful data
      const hasProducts = products.some(p => p.name.trim());
      const hasInvoices = invoices.some(i => i.vendor_id || i.vendor_name.trim());

      if (!hasProducts && !hasInvoices) return;

      try {
        const dataToSave = {
          timestamp: new Date().toISOString(),
          currentStep,
          categories,
          vendors,
          products,
          invoices,
          conversionForms,
          expandedInvoices: Array.from(expandedInvoices)
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(dataToSave));
        console.log('📁 Worksheet autosaved at', new Date().toLocaleTimeString());
      } catch (e) {
        console.error('Error autosaving worksheet:', e);
      }
    };

    // Save immediately when data changes (debounced by interval)
    const intervalId = setInterval(saveData, AUTOSAVE_INTERVAL_MS);

    // Also save on visibility change (user switching tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentStep, categories, vendors, products, invoices, conversionForms, expandedInvoices, importing]);

  // Warn before leaving with unsaved data
  useEffect(() => {
    const hasUnsavedData = products.some(p => p.name.trim()) || invoices.some(i => i.vendor_id || i.vendor_name.trim());

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedData && !importing) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [products, invoices, importing]);

  // Ensure conversion forms exist for all invoice items with unit warnings
  // This runs whenever invoices change and ensures forms are pre-populated
  useEffect(() => {
    invoices.forEach(invoice => {
      invoice.items.forEach(item => {
        if (item.unitWarning && item.category_id && item.unit_of_measurement) {
          const recipeUnit = getRecipeUnit(item.category_id, item.variant);
          if (recipeUnit) {
            ensureConversionForm(item.category_id, item.variant, item.unit_of_measurement, recipeUnit);
          }
        }
      });
    });
  }, [invoices, ensureConversionForm, getRecipeUnit]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is inside a category dropdown
      if (openCategoryDropdown && !target.closest(`.${styles.categoryCheckboxDropdown}`)) {
        setOpenCategoryDropdown(null);
      }
      // Check if click is inside an invoice dropdown
      if (openInvoiceDropdown && !target.closest(`.${styles.invoiceCheckboxDropdown}`)) {
        setOpenInvoiceDropdown(null);
      }
    };

    if (openCategoryDropdown || openInvoiceDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openCategoryDropdown, openInvoiceDropdown]);

  // Restore saved data
  const handleRestoreData = useCallback(() => {
    try {
      isRestoringRef.current = true;
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);

        // Restore all state
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        if (parsed.categories) setCategories(parsed.categories);
        if (parsed.vendors) setVendors(parsed.vendors);
        if (parsed.products) setProducts(parsed.products);
        if (parsed.invoices) setInvoices(parsed.invoices);
        if (parsed.conversionForms) setConversionForms(parsed.conversionForms);
        if (parsed.expandedInvoices) setExpandedInvoices(new Set(parsed.expandedInvoices));

        console.log('📂 Worksheet data restored');
      }
    } catch (e) {
      console.error('Error restoring worksheet data:', e);
    } finally {
      isRestoringRef.current = false;
      setShowRestoreModal(false);
    }
  }, []);

  // Discard saved data and start fresh
  const handleDiscardSavedData = useCallback(() => {
    localStorage.removeItem(AUTOSAVE_KEY);
    setShowRestoreModal(false);
    console.log('🗑️ Saved worksheet data discarded');
  }, []);

  // Clear autosave data (called after successful submit)
  const clearAutosaveData = useCallback(() => {
    localStorage.removeItem(AUTOSAVE_KEY);
    console.log('🧹 Autosave data cleared after successful save');
  }, []);

  const steps: Step[] = ['products', 'recipes', 'invoices', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const stepTitles: Record<Step, string> = {
    products: 'Your Products',
    recipes: 'Product Recipes',
    invoices: 'Supplier Invoices',
    review: 'Review & Submit'
  };

  const stepDescriptions: Record<Step, string> = {
    products: 'Add your products with their basic info.',
    recipes: 'Add the pieces that go into each product.',
    invoices: 'Add recent supplier invoices to track the cost of each category.',
    review: 'Double-check everything looks right, then confirm to save.'
  };

  // Product handlers
  const addProduct = () => {
    if (products.length < 10) {
      setProducts([...products, {
        id: generateTempId(),
        name: '',
        msrp: '',
        sku: '',
        recipeItems: []
      }]);
    }
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const updateProduct = (index: number, field: keyof Omit<Product, 'id'>, value: string) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  // Recipe item handlers
  const addRecipeItem = (productIndex: number) => {
    const updated = [...products];
    updated[productIndex].recipeItems.push({
      category_id: '',
      entry_mode: 'per_batch', // Default to batch entry
      quantity_per_batch: '',
      batch_size: '',
      quantity: '',
      unit_of_measurement: 'oz' // Default unit
    });
    setProducts(updated);
  };

  const removeRecipeItem = (productIndex: number, itemIndex: number) => {
    const updated = [...products];
    updated[productIndex].recipeItems = updated[productIndex].recipeItems.filter((_, i) => i !== itemIndex);
    setProducts(updated);
  };

  const updateRecipeItem = (productIndex: number, itemIndex: number, field: keyof RecipeItem, value: string) => {
    const updated = [...products];
    const item = { ...updated[productIndex].recipeItems[itemIndex], [field]: value };

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

    updated[productIndex].recipeItems[itemIndex] = item;
    setProducts(updated);
  };

  // Category handlers (create on-the-fly)
  const createCategory = (productIndex: number, itemIndex: number) => {
    const key = `${productIndex}-${itemIndex}`;
    const name = newCategoryName[key]?.trim();

    if (!name) return;

    // Check if category already exists
    const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Use existing category
      updateRecipeItem(productIndex, itemIndex, 'category_id', existing.id);
    } else {
      // Create new category
      const newCategory: Category = {
        id: generateTempId(),
        name,
        variants: [],
        sort_order: categories.length
      };
      setCategories([...categories, newCategory]);
      updateRecipeItem(productIndex, itemIndex, 'category_id', newCategory.id);
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

  const toggleNewCategoryInput = (productIndex: number, itemIndex: number) => {
    const key = `${productIndex}-${itemIndex}`;
    setShowNewCategoryInput({
      ...showNewCategoryInput,
      [key]: !showNewCategoryInput[key]
    });
  };

  // Vendor handlers (create on-the-fly, like categories)
  const createVendor = (invoiceId: string) => {
    const name = newVendorName[invoiceId]?.trim();
    if (!name) return;

    // Check if vendor already exists
    const existing = vendors.find(v => v.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Use existing vendor
      updateInvoice(invoices.findIndex(i => i.id === invoiceId), 'vendor_id', existing.id);
      updateInvoice(invoices.findIndex(i => i.id === invoiceId), 'vendor_name', existing.name);
    } else {
      // Create new vendor
      const newVendor: Vendor = {
        id: generateTempId(),
        name
      };
      setVendors([...vendors, newVendor]);
      const invIndex = invoices.findIndex(i => i.id === invoiceId);
      updateInvoice(invIndex, 'vendor_id', newVendor.id);
      updateInvoice(invIndex, 'vendor_name', newVendor.name);
    }

    // Clear input and close
    setNewVendorName({ ...newVendorName, [invoiceId]: '' });
    setShowNewVendorInput({ ...showNewVendorInput, [invoiceId]: false });
    setOpenVendorDropdown(null);
  };

  const selectVendor = (invoiceId: string, vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor) {
      const invIndex = invoices.findIndex(i => i.id === invoiceId);
      updateInvoice(invIndex, 'vendor_id', vendor.id);
      updateInvoice(invIndex, 'vendor_name', vendor.name);
    }
    setOpenVendorDropdown(null);
  };

  // Invoice handlers
  const addInvoice = () => {
    const newId = generateTempId();
    setInvoices([...invoices, {
      id: newId,
      vendor_id: '',
      vendor_name: '',
      invoice_date: '',
      invoice_total: '',
      items: [{
        category_id: '',
        variant: '',
        quantity: '',
        unit_of_measurement: 'oz',
        unit_cost: '',
        line_total: ''
      }],
      notes: ''
    }]);
    // Collapse all previous invoices, expand only the new one
    setExpandedInvoices(new Set([newId]));
  };

  const toggleInvoiceExpanded = (invoiceId: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  // Calculate sum of line items for an invoice
  const calculateInvoiceLineItemsTotal = (invoice: Invoice): number => {
    return invoice.items.reduce((sum, item) => sum + parseFloat(item.line_total || '0'), 0);
  };

  // Check if invoice line items exceed invoice total
  const isInvoiceTotalMismatch = (invoice: Invoice): boolean => {
    if (!invoice.invoice_total) return false;
    const lineItemsTotal = calculateInvoiceLineItemsTotal(invoice);
    const invoiceTotal = parseFloat(invoice.invoice_total);
    if (isNaN(invoiceTotal)) return false;
    // Check both directions - over OR under
    return Math.abs(lineItemsTotal - invoiceTotal) > 0.01;
  };

  // Validation helpers for review page
  const getProductWarnings = (product: typeof products[0]) => {
    const warnings: string[] = [];
    if (!product.msrp.trim()) warnings.push('Missing MSRP');
    if (!product.sku.trim()) warnings.push('Missing SKU');
    if (product.recipeItems.length === 0) warnings.push('No recipe ingredients');

    const incompleteItems = product.recipeItems.filter(item =>
      !item.category_id || !item.quantity.trim() || !item.unit_of_measurement
    );
    if (incompleteItems.length > 0) {
      warnings.push(`${incompleteItems.length} incomplete recipe item${incompleteItems.length > 1 ? 's' : ''}`);
    }

    return warnings;
  };

  const getInvoiceWarnings = (invoice: Invoice) => {
    const warnings: string[] = [];
    if (!invoice.invoice_date.trim()) warnings.push('Missing date');
    if (!invoice.invoice_number?.trim()) warnings.push('Missing invoice #');
    if (!invoice.invoice_total?.trim()) warnings.push('Missing total');
    if (invoice.items.length === 0) warnings.push('No line items');

    if (isInvoiceTotalMismatch(invoice)) {
      const lineItemsTotal = calculateInvoiceLineItemsTotal(invoice);
      const invoiceTotal = parseFloat(invoice.invoice_total || '0');
      if (lineItemsTotal > invoiceTotal) {
        warnings.push('Line items exceed invoice total');
      } else {
        warnings.push('Line items less than invoice total');
      }
    }

    const incompleteItems = invoice.items.filter(item =>
      !item.category_id || !item.quantity.trim() || !item.unit_cost.trim()
    );
    if (incompleteItems.length > 0) {
      warnings.push(`${incompleteItems.length} incomplete line item${incompleteItems.length > 1 ? 's' : ''}`);
    }

    return warnings;
  };

  const getInvoiceErrors = (invoice: Invoice) => {
    const errors: string[] = [];

    // Check if invoice_total contains unevaluated math expressions
    if (invoice.invoice_total && invoice.invoice_total.trim()) {
      const hasOperators = /[+\-*/]/.test(invoice.invoice_total);
      const isValidNumber = /^-?\d+\.?\d*$/.test(invoice.invoice_total.trim());

      if (hasOperators || !isValidNumber) {
        errors.push(`Invoice total must be a number (not "${invoice.invoice_total}"). Click out of the field to evaluate math.`);
      }
    }

    // Blocking errors - invoice must balance
    if (invoice.invoice_total && invoice.items.length > 0) {
      const lineItemsTotal = calculateInvoiceLineItemsTotal(invoice);
      const invoiceTotal = parseFloat(invoice.invoice_total);
      if (!isNaN(invoiceTotal) && Math.abs(lineItemsTotal - invoiceTotal) > 0.01) {
        const diff = lineItemsTotal - invoiceTotal;
        if (diff > 0) {
          errors.push(`Invoice doesn't balance. Remove $${diff.toFixed(2)} from line items`);
        } else {
          errors.push(`Invoice doesn't balance. Add $${Math.abs(diff).toFixed(2)} to line items`);
        }
      }
    }
    return errors;
  };

  const getMissingInvoiceWarnings = () => {
    const warnings: string[] = [];
    const validProducts = products.filter(p => p.name.trim());
    const validInvoices = invoices.filter(i => i.vendor_id || i.vendor_name.trim());

    // Collect all recipe ingredients (category + variant combinations)
    const recipeIngredients = new Set<string>();
    validProducts.forEach(product => {
      product.recipeItems.forEach(item => {
        if (item.category_id) {
          const key = `${item.category_id}:${item.variant || ''}`;
          recipeIngredients.add(key);
        }
      });
    });

    // Collect all invoiced ingredients
    const invoicedIngredients = new Set<string>();
    validInvoices.forEach(invoice => {
      invoice.items.forEach(item => {
        if (item.category_id && item.quantity.trim() && item.unit_cost.trim()) {
          const key = `${item.category_id}:${item.variant || ''}`;
          invoicedIngredients.add(key);
        }
      });
    });

    // Find missing invoices
    const missingIngredients: string[] = [];
    recipeIngredients.forEach(key => {
      if (!invoicedIngredients.has(key)) {
        const [categoryId, variant] = key.split(':');
        const category = categories.find(c => c.id === categoryId);
        if (category) {
          const displayName = variant ? `${category.name} (${variant})` : category.name;
          missingIngredients.push(displayName);
        }
      }
    });

    if (missingIngredients.length > 0) {
      warnings.push(`Missing invoices for: ${missingIngredients.join(', ')}`);
    }

    return warnings;
  };

  const getCriticalWarnings = () => {
    const warnings: string[] = [];
    // Critical warnings - missing invoices for recipe ingredients
    const missingInvoiceWarnings = getMissingInvoiceWarnings();
    warnings.push(...missingInvoiceWarnings);
    return warnings;
  };

  const getMinorWarnings = () => {
    const warnings: string[] = [];
    const validProducts = products.filter(p => p.name.trim());
    const validInvoices = invoices.filter(i => i.vendor_id || i.vendor_name.trim());

    if (validProducts.length === 0) {
      warnings.push('No products added');
    }

    const productsWithWarnings = validProducts.filter(p => getProductWarnings(p).length > 0);
    if (productsWithWarnings.length > 0) {
      warnings.push(`${productsWithWarnings.length} product${productsWithWarnings.length > 1 ? 's have' : ' has'} incomplete data`);
    }

    const invoicesWithWarnings = validInvoices.filter(i => getInvoiceWarnings(i).length > 0);
    if (invoicesWithWarnings.length > 0) {
      warnings.push(`${invoicesWithWarnings.length} invoice${invoicesWithWarnings.length > 1 ? 's have' : ' has'} incomplete data`);
    }

    return warnings;
  };

  const getOverallWarnings = () => {
    return [...getCriticalWarnings(), ...getMinorWarnings()];
  };

  const getBlockingErrors = () => {
    const errors: string[] = [];
    const validInvoices = invoices.filter(i => i.vendor_id || i.vendor_name.trim());

    validInvoices.forEach(inv => {
      const invErrors = getInvoiceErrors(inv);
      if (invErrors.length > 0) {
        errors.push(`${inv.vendor_name}: ${invErrors.join(', ')}`);
      }
    });

    return errors;
  };

  const removeInvoice = (index: number) => {
    if (invoices.length > 1) {
      setInvoices(invoices.filter((_, i) => i !== index));
    }
  };

  const updateInvoice = (index: number, field: keyof Omit<Invoice, 'id' | 'items'>, value: string) => {
    const updated = [...invoices];
    updated[index] = { ...updated[index], [field]: value };
    setInvoices(updated);
  };

  const addInvoiceItem = (invoiceId: string) => {
    const updated = invoices.map(inv =>
      inv.id === invoiceId
        ? {
            ...inv,
            items: [...inv.items, {
              category_id: '',
              quantity: '',
              unit_of_measurement: 'oz',
              unit_cost: '',
              line_total: '0.00',
              item_type: 'regular' as const
            }]
          }
        : inv
    );
    setInvoices(updated);
  };

  // Add Shipping & Handling item
  const addShippingItem = (invoiceId: string) => {
    // Find the S+H category
    const shCategory = categories.find(c => c.is_distribution_category);
    if (!shCategory) return;

    const updated = invoices.map(inv =>
      inv.id === invoiceId
        ? {
            ...inv,
            items: [...inv.items, {
              category_id: shCategory.id,
              quantity: '1',
              unit_of_measurement: 'each' as Unit,
              unit_cost: '',
              line_total: '0.00',
              item_type: 'shipping' as const,
              distribution_method: 'weighted' as const,
              distribution_target: 'invoice' as const
            }]
          }
        : inv
    );
    setInvoices(updated);
  };

  // Add Personal Item
  const addPersonalItem = (invoiceId: string) => {
    const updated = invoices.map(inv =>
      inv.id === invoiceId
        ? {
            ...inv,
            items: [...inv.items, {
              category_id: '__personal__',
              quantity: '1',
              unit_of_measurement: 'each' as Unit,
              unit_cost: '',
              line_total: '0.00',
              item_type: 'personal' as const,
              is_personal: true
            }]
          }
        : inv
    );
    setInvoices(updated);
  };

  const removeInvoiceItem = (invoiceId: string, itemIndex: number) => {
    const updated = invoices.map(inv =>
      inv.id === invoiceId
        ? { ...inv, items: inv.items.filter((_, i) => i !== itemIndex) }
        : inv
    );
    setInvoices(updated);
  };

  const updateInvoiceItem = (invoiceId: string, itemIndex: number, field: keyof InvoiceItem, value: any) => {
    // Use functional update to ensure we're always working with the latest state
    setInvoices(prevInvoices => prevInvoices.map(inv =>
      inv.id === invoiceId
        ? {
            ...inv,
            items: inv.items.map((item, i) => {
              if (i !== itemIndex) return item;

              const updatedItem = { ...item, [field]: value };
              const qty = parseFloat(field === 'quantity' ? value : updatedItem.quantity);
              const cost = parseFloat(field === 'unit_cost' ? value : updatedItem.unit_cost);
              const total = parseFloat(field === 'line_total' ? value : updatedItem.line_total || '0');

              // Three-way calculation: enter any 2, calculate the third
              if (field === 'quantity' && updatedItem.unit_cost) {
                // qty × cost = total
                updatedItem.line_total = (qty * cost).toFixed(2);
              } else if (field === 'unit_cost' && updatedItem.quantity) {
                // qty × cost = total
                updatedItem.line_total = (qty * cost).toFixed(2);
              } else if (field === 'line_total') {
                // If we have quantity, calculate unit_cost from total ÷ qty
                if (updatedItem.quantity && qty > 0) {
                  updatedItem.unit_cost = (total / qty).toFixed(2);
                }
                // If we have unit_cost, calculate quantity from total ÷ cost
                else if (updatedItem.unit_cost && cost > 0) {
                  updatedItem.quantity = (total / cost).toFixed(2);
                }
              }

              // Check for unit mismatches when category, variant, or unit changes
              if (field === 'category_id' || field === 'variant' || field === 'unit_of_measurement') {
                const categoryId = field === 'category_id' ? value : updatedItem.category_id;
                const variant = field === 'variant' ? value : updatedItem.variant;
                const invoiceUnit = field === 'unit_of_measurement' ? value : updatedItem.unit_of_measurement;

                // Check if this category/variant exists in any recipes with incompatible units
                // Normalize variants: treat undefined, null, and '' as equivalent (no variant)
                const normalizeVariant = (v: string | null | undefined) => v || null;
                const matchingRecipes = products.flatMap(product =>
                  product.recipeItems
                    .filter(recipeItem =>
                      recipeItem.category_id === categoryId &&
                      normalizeVariant(recipeItem.variant) === normalizeVariant(variant) &&
                      recipeItem.unit_of_measurement &&
                      invoiceUnit &&
                      !areUnitsCompatible(invoiceUnit, recipeItem.unit_of_measurement as Unit)
                    )
                    .map(recipeItem => ({
                      productName: product.name,
                      recipeUnit: recipeItem.unit_of_measurement
                    }))
                );

                if (matchingRecipes.length > 0) {
                  const productNames = matchingRecipes.map(r => r.productName).join(', ');
                  const recipeUnit = matchingRecipes[0].recipeUnit;
                  updatedItem.unitWarning = `⚠️ Unit mismatch: Recipe for ${productNames} uses ${recipeUnit}, but invoice uses ${invoiceUnit}. These units cannot be automatically converted.`;
                } else {
                  updatedItem.unitWarning = undefined;
                }
              }

              return updatedItem;
            })
          }
        : inv
    ));
  };

  // Navigation
  const canProceedFromStep = (step: Step): boolean => {
    switch (step) {
      case 'products':
        return products.some(p => p.name.trim() && p.msrp.trim());
      case 'recipes':
        // Recipes are optional - can always proceed
        return true;
      case 'invoices':
        // Block if any invoice has errors (doesn't balance)
        const validInvoices = invoices.filter(i => i.vendor_id || i.vendor_name.trim());
        return validInvoices.every(inv => getInvoiceErrors(inv).length === 0);
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const canProceed = () => canProceedFromStep(currentStep);

  // Check if user can navigate to a specific step (for sidebar click-to-jump)
  const canNavigateToStep = (targetStep: Step): boolean => {
    const targetIndex = steps.indexOf(targetStep);

    // Can always go back to completed steps
    if (targetIndex < currentStepIndex) return true;

    // Can go to current step
    if (targetIndex === currentStepIndex) return true;

    // Can only go forward if all previous steps are valid
    for (let i = 0; i < targetIndex; i++) {
      if (!canProceedFromStep(steps[i])) return false;
    }
    return true;
  };

  const handleStepClick = (step: Step) => {
    if (canNavigateToStep(step)) {
      setCurrentStep(step);
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  // Handler for Continue button (sidebar and footer)
  const handleContinue = () => {
    if (currentStep === 'review') {
      handleSubmit();
    } else {
      handleNext();
    }
  };

  const handleSubmit = () => {
    console.log('📝 Worksheet handleSubmit called');
    // Extract valid products
    const validProducts = products
      .filter(p => p.name.trim() && p.msrp.trim())
      .map(({ recipeItems, ...product }) => product);

    // Extract recipes - category_id, variant, quantity, unit
    const validRecipes = products
      .filter(p => p.name.trim() && p.recipeItems.length > 0)
      .map(p => ({
        product_id: p.id,
        items: p.recipeItems
          .filter(item => item.category_id && item.quantity.trim() && item.unit_of_measurement)
          .map(item => ({
            category_id: item.category_id,
            ...(item.variant && { variant: item.variant }), // Only include if present
            quantity: item.quantity,
            unit: item.unit_of_measurement
          }))
      }))
      .filter(r => r.items.length > 0);

    // Extract valid invoices - category_id, variant, quantity, unit, unit_cost, line_total, invoice_total
    const validInvoices = invoices
      .filter(i => (i.vendor_id || i.vendor_name.trim()) && i.items.length > 0)
      .map(inv => ({
        id: inv.id,
        vendor_id: inv.vendor_id,
        vendor_name: inv.vendor_name,
        invoice_date: inv.invoice_date,
        ...(inv.invoice_number && { invoice_number: inv.invoice_number }), // Only include if present
        ...(inv.invoice_total && { invoice_total: inv.invoice_total }), // FIX: Include invoice total
        items: inv.items
          .filter(item => {
            // For S+H and Personal items, only need unit_cost
            if (item.item_type === 'shipping' || item.item_type === 'personal' || item.is_personal) {
              return item.unit_cost && item.unit_cost.trim();
            }
            // For regular items, need category_id, quantity, unit_cost, unit
            return item.category_id && item.quantity.trim() && item.unit_cost.trim() && item.unit_of_measurement;
          })
          .map(item => ({
            category_id: item.category_id,
            ...(item.variant && { variant: item.variant }), // Only include if present
            quantity: item.quantity,
            unit: item.unit_of_measurement,
            unit_cost: item.unit_cost,
            line_total: item.line_total || (parseFloat(item.quantity || '0') * parseFloat(item.unit_cost || '0')).toFixed(2),
            ...(item.is_personal && { is_personal: true }), // Include if personal item
            ...(item.item_type && { item_type: item.item_type }), // Include item type
            ...(item.distribution_method && { distribution_method: item.distribution_method }), // Include S+H distribution method
            // S+H targeting fields
            ...(item.target_invoices && item.target_invoices.length > 0 && { target_invoices: item.target_invoices }), // Invoice IDs to distribute to
            ...(item.items_filter && { items_filter: item.items_filter }), // 'all' or 'categories'
            ...(item.selected_categories && item.selected_categories.length > 0 && { selected_categories: item.selected_categories }) // Categories when items_filter is 'categories'
          })),
        ...(inv.notes && { notes: inv.notes }) // Only include if present
      }))
      .filter(i => i.items.length > 0);

    const worksheetData: WorksheetData = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      categories,
      vendors,
      finished_products: validProducts,
      recipes: validRecipes,
      invoices: validInvoices,
      unit_conversions: convertFormsToExport()
    };

    console.log('📤 Calling onComplete with data:', worksheetData);

    // Clear autosave data before submitting (data is about to be saved to DB)
    clearAutosaveData();

    setImporting(true);
    onComplete(worksheetData);
  };

  return (
    <div className={styles.worksheetLayout}>
      {/* Restore saved data modal */}
      <div className={styles.mainContent}>
      {showRestoreModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '480px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <h2 style={{ margin: '0 0 1rem', color: '#1f2937', fontSize: '1.25rem' }}>
              Resume Your Work?
            </h2>
            <p style={{ margin: '0 0 0.5rem', color: '#4b5563', lineHeight: 1.6 }}>
              We found unsaved work from a previous session.
            </p>
            <p style={{ margin: '0 0 1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
              Last saved: {savedDataTimestamp}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleDiscardSavedData}
                style={{
                  padding: '0.625rem 1.25rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Start Fresh
              </button>
              <button
                onClick={handleRestoreData}
                style={{
                  padding: '0.625rem 1.25rem',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#4b006e',
                  color: 'white',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Resume Work
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step header */}
      <div className={styles.header}>
        <h2 className={styles.title}>{stepTitles[currentStep]}</h2>
        <p className={styles.description}>{stepDescriptions[currentStep]}</p>
      </div>

      {/* Step content */}
      <div className={styles.content}>
        {currentStep === 'products' && (
          <div className={styles.stepContent}>
            {products.map((product, prodIndex) => (
              <div key={product.id} className={styles.productCardCompact}>
                <div className={styles.productNumberBadge}>{prodIndex + 1}</div>
                <div className={styles.productFieldsRow}>
                  <div className={styles.fieldRow3}>
                    <div className={styles.field}>
                      <label htmlFor={`product-name-${prodIndex}`} className={styles.label}>
                        Product Name <span className={styles.required}>*</span>
                      </label>
                      <input
                        type="text"
                        id={`product-name-${prodIndex}`}
                        value={product.name}
                        onChange={(e) => updateProduct(prodIndex, 'name', e.target.value)}
                        placeholder="ex:Lavender Body Lotion"
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.field}>
                      <label htmlFor={`product-msrp-${prodIndex}`} className={styles.label}>
                        Retail Price <span className={styles.required}>*</span>
                      </label>
                      <div className={styles.inputGroup}>
                        <span className={styles.inputPrefix}>$</span>
                        <input
                          type="number"
                          id={`product-msrp-${prodIndex}`}
                          value={product.msrp}
                          onChange={(e) => updateProduct(prodIndex, 'msrp', e.target.value)}
                          placeholder="19.99"
                          step="0.01"
                          min="0"
                          className={styles.input}
                        />
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor={`product-sku-${prodIndex}`} className={styles.label}>
                        SKU
                      </label>
                      <input
                        type="text"
                        id={`product-sku-${prodIndex}`}
                        value={product.sku}
                        onChange={(e) => updateProduct(prodIndex, 'sku', e.target.value)}
                        placeholder="ex:LBL-8OZ"
                        className={styles.input}
                      />
                    </div>
                  </div>
                </div>
                {products.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProduct(prodIndex)}
                    className={styles.removeProductButton}
                    aria-label="Remove product"
                  >
                    ✕
                  </button>
                )}

                {/* Recipe section - moved to recipes step */}
                {false && (
                <div className={styles.recipeSection}>
                  <h4 className={styles.recipeTitle}>What goes into this product?</h4>
                  <p className={styles.recipeHint}>
                    Add items by category (ex: "Package") that make up your product. Use variants to specify different types or sizes (ex: "1 oz Small" vs "10 oz Large").
                  </p>

                  {product.recipeItems.map((item, itemIndex) => {
                    const key = `${prodIndex}-${itemIndex}`;
                    const selectedCategory = categories.find(c => c.id === item.category_id);

                    return (
                      <div key={itemIndex} className={styles.ingredientRow}>
                        <div className={styles.ingredientFields}>
                          {/* Category and Variant on same line */}
                          <div className={styles.fieldRow}>
                            <div className={styles.field}>
                              <label className={styles.label}>Item Category</label>
                              {showNewCategoryInput[key] ? (
                                <div className={styles.newCategoryInput}>
                                  <input
                                    type="text"
                                    value={newCategoryName[key] || ''}
                                    onChange={(e) => setNewCategoryName({ ...newCategoryName, [key]: e.target.value })}
                                    placeholder="ex: Package"
                                    className={styles.input}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        createCategory(prodIndex, itemIndex);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const value = e.target.value.trim();
                                      if (value) {
                                        createCategory(prodIndex, itemIndex);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => createCategory(prodIndex, itemIndex)}
                                    className={styles.createButton}
                                  >
                                    Create
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowNewCategoryInput({ ...showNewCategoryInput, [key]: false });
                                      setNewCategoryName({ ...newCategoryName, [key]: '' });
                                    }}
                                    className={styles.cancelButton}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : categories.filter(c => !c.is_distribution_category).length > 0 ? (
                                <select
                                  value={item.category_id}
                                  onChange={(e) => {
                                    if (e.target.value === '__new__') {
                                      setShowNewCategoryInput({ ...showNewCategoryInput, [key]: true });
                                    } else {
                                      updateRecipeItem(prodIndex, itemIndex, 'category_id', e.target.value);
                                    }
                                  }}
                                  className={styles.select}
                                >
                                  <option value="">Select...</option>
                                  {categories.filter(c => !c.is_distribution_category).map(cat => (
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
                                      createCategory(prodIndex, itemIndex);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const value = e.currentTarget.value.trim();
                                      if (value) {
                                        createCategory(prodIndex, itemIndex);
                                      }
                                    }
                                  }}
                                  placeholder="ex: Package"
                                  className={styles.input}
                                />
                              )}
                            </div>

                            {/* Variant (only show if category selected) */}
                            {selectedCategory && (
                              <div className={styles.field}>
                                <label className={styles.label}>Variant (optional)</label>
                                {showNewVariantInput[key] ? (
                                  <div className={styles.newCategoryInput}>
                                    <input
                                      type="text"
                                      value={newVariantValue[key] || ''}
                                      onChange={(e) => setNewVariantValue({ ...newVariantValue, [key]: e.target.value })}
                                      placeholder="ex: 1 oz Small"
                                      className={styles.input}
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const variant = newVariantValue[key]?.trim();
                                          if (variant) {
                                            addVariantToCategory(selectedCategory.id, variant);
                                            updateRecipeItem(prodIndex, itemIndex, 'variant', variant);
                                            setNewVariantValue({ ...newVariantValue, [key]: '' });
                                            setShowNewVariantInput({ ...showNewVariantInput, [key]: false });
                                          }
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const variant = e.target.value.trim();
                                        if (variant) {
                                          addVariantToCategory(selectedCategory.id, variant);
                                          updateRecipeItem(prodIndex, itemIndex, 'variant', variant);
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
                                          updateRecipeItem(prodIndex, itemIndex, 'variant', variant);
                                          setNewVariantValue({ ...newVariantValue, [key]: '' });
                                          setShowNewVariantInput({ ...showNewVariantInput, [key]: false });
                                        }
                                      }}
                                      className={styles.createButton}
                                    >
                                      Create
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowNewVariantInput({ ...showNewVariantInput, [key]: false });
                                        setNewVariantValue({ ...newVariantValue, [key]: '' });
                                      }}
                                      className={styles.cancelButton}
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
                                        updateRecipeItem(prodIndex, itemIndex, 'variant', e.target.value);
                                      }
                                    }}
                                    className={styles.select}
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
                                    onChange={(e) => updateRecipeItem(prodIndex, itemIndex, 'variant', e.target.value)}
                                    onBlur={(e) => {
                                      const value = e.target.value.trim();
                                      if (value && !selectedCategory.variants.includes(value)) {
                                        addVariantToCategory(selectedCategory.id, value);
                                      }
                                    }}
                                    placeholder="ex: 1 oz Small"
                                    className={styles.input}
                                  />
                                )}
                              </div>
                            )}
                          </div>


                          {/* Entry mode toggle */}
                          <div className={styles.field}>
                            <label className={styles.label}>How do you measure this?</label>
                            <div className={styles.entryModeToggle}>
                              <button
                                type="button"
                                className={item.entry_mode === 'per_batch' ? styles.toggleActive : styles.toggleInactive}
                                onClick={() => updateRecipeItem(prodIndex, itemIndex, 'entry_mode', 'per_batch')}
                              >
                                Per Batch
                              </button>
                              <button
                                type="button"
                                className={item.entry_mode === 'per_unit' ? styles.toggleActive : styles.toggleInactive}
                                onClick={() => updateRecipeItem(prodIndex, itemIndex, 'entry_mode', 'per_unit')}
                              >
                                Per Unit
                              </button>
                            </div>
                          </div>

                          {/* Batch entry mode */}
                          {item.entry_mode === 'per_batch' && (
                            <>
                              <div className={styles.fieldRow3}>
                                <div className={styles.field}>
                                  <label className={styles.label}>Quantity per Batch</label>
                                  <input
                                    type="number"
                                    value={item.quantity_per_batch || ''}
                                    onChange={(e) => updateRecipeItem(prodIndex, itemIndex, 'quantity_per_batch', e.target.value)}
                                    placeholder="ex:10"
                                    step="0.01"
                                    min="0"
                                    className={styles.input}
                                  />
                                </div>
                                <div className={styles.field}>
                                  <label className={styles.label}>Unit</label>
                                  <select
                                    value={item.unit_of_measurement || ''}
                                    onChange={(e) => updateRecipeItem(prodIndex, itemIndex, 'unit_of_measurement', e.target.value)}
                                    className={styles.select}
                                  >
                                    {UNITS_OF_MEASUREMENT.map(unit => (
                                      <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className={styles.field}>
                                  <label className={styles.label}>Batch Size (units made)</label>
                                  <input
                                    type="number"
                                    value={item.batch_size || ''}
                                    onChange={(e) => updateRecipeItem(prodIndex, itemIndex, 'batch_size', e.target.value)}
                                    placeholder="ex:100"
                                    step="1"
                                    min="1"
                                    className={styles.input}
                                  />
                                </div>
                              </div>
                              {item.quantity_per_batch && item.batch_size && (
                                <div className={styles.calculationHint}>
                                  → {item.quantity} {item.unit_of_measurement} per unit
                                </div>
                              )}
                            </>
                          )}

                          {/* Per unit entry mode */}
                          {item.entry_mode === 'per_unit' && (
                            <div className={styles.fieldRow}>
                              <div className={styles.field}>
                                <label className={styles.label}>Quantity per Unit</label>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateRecipeItem(prodIndex, itemIndex, 'quantity', e.target.value)}
                                  placeholder="ex:0.10"
                                  step="0.000001"
                                  min="0"
                                  className={styles.input}
                                />
                              </div>
                              <div className={styles.field}>
                                <label className={styles.label}>Unit</label>
                                <select
                                  value={item.unit_of_measurement || ''}
                                  onChange={(e) => updateRecipeItem(prodIndex, itemIndex, 'unit_of_measurement', e.target.value)}
                                  className={styles.select}
                                >
                                  {UNITS_OF_MEASUREMENT.map(unit => (
                                    <option key={unit} value={unit}>{unit}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeRecipeItem(prodIndex, itemIndex)}
                          className={styles.removeInlineButton}
                          aria-label="Remove ingredient"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => addRecipeItem(prodIndex)}
                    className={styles.addIngredientButton}
                  >
                    + Add Item
                  </button>
                </div>
                )}
              </div>
            ))}

            {products.length < 10 && (
              <button
                type="button"
                onClick={addProduct}
                className={styles.addButton}
              >
                + Add Another Product
              </button>
            )}
          </div>
        )}

        {currentStep === 'recipes' && (
          <div className={styles.stepContent}>
            {products.filter(p => p.name.trim()).length === 0 ? (
              <div className={styles.note}>
                <p>
                  <strong>No products yet!</strong> Go back to add at least one product before adding recipes.
                </p>
              </div>
            ) : (
              <div className={styles.recipeGrid}>
                {products.filter(p => p.name.trim()).map((product, prodIndex) => {
                  const actualIndex = products.findIndex(p => p.id === product.id);
                  const isExpanded = expandedRecipes.has(product.id);
                  const ingredientCount = product.recipeItems.length;

                  return (
                    <div key={product.id} className={`${styles.recipeCard} ${isExpanded ? styles.recipeCardExpanded : ''}`}>
                      <div
                        className={styles.recipeCardHeader}
                        onClick={() => toggleRecipeExpanded(product.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
                        <div className={styles.productNumberBadge}>{actualIndex + 1}</div>
                        <div className={styles.recipeProductInfo}>
                          <span className={styles.recipeProductName}>{product.name}</span>
                          {product.msrp && <span className={styles.recipeProductPrice}>${product.msrp}</span>}
                        </div>
                        {!isExpanded && (
                          <span className={styles.ingredientCount}>
                            {ingredientCount} {ingredientCount === 1 ? 'piece' : 'pieces'}
                          </span>
                        )}
                      </div>

                      {isExpanded && (
                      <div className={styles.ingredientsList}>
                        {/* Table header */}
                        <div className={styles.ingredientHeader}>
                          <div className={styles.headerLeftSection}>
                            <span className={styles.headerCell} style={{ flex: 2 }}>Category</span>
                            <span className={styles.headerCell} style={{ flex: 1.5 }}>Variant</span>
                            <span className={styles.headerCell} style={{ flex: 1 }}>Mode</span>
                          </div>
                          <div className={styles.headerRightSection}>
                            <span className={styles.headerCell} style={{ flex: 1 }}>Qty</span>
                            <span className={styles.headerCell} style={{ flex: 0.8 }}>Unit</span>
                            <span className={styles.headerCell} style={{ flex: 1.5 }}>Batch Size</span>
                          </div>
                          <span className={styles.headerCell} style={{ width: '24px' }}></span>
                        </div>

                        {product.recipeItems.map((item, itemIndex) => {
                          const key = `${actualIndex}-${itemIndex}`;
                          const selectedCategory = categories.find(c => c.id === item.category_id);

                          return (
                            <div key={itemIndex} className={styles.ingredientRowCompact}>
                              {/* Left side - Category, Variant, Mode (vertically centered) */}
                              <div className={styles.rowLeftSection}>
                                {/* Category */}
                                <div className={styles.tableCell} style={{ flex: 2, minWidth: 0 }}>
                                  {showNewCategoryInput[key] ? (
                                    <input
                                      type="text"
                                      value={newCategoryName[key] || ''}
                                      onChange={(e) => setNewCategoryName({ ...newCategoryName, [key]: e.target.value })}
                                      placeholder="Type name..."
                                      className={styles.tableCellInput}
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          createCategory(actualIndex, itemIndex);
                                        } else if (e.key === 'Escape') {
                                          setShowNewCategoryInput({ ...showNewCategoryInput, [key]: false });
                                          setNewCategoryName({ ...newCategoryName, [key]: '' });
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const value = e.target.value.trim();
                                        if (value) {
                                          createCategory(actualIndex, itemIndex);
                                        } else {
                                          setShowNewCategoryInput({ ...showNewCategoryInput, [key]: false });
                                        }
                                      }}
                                    />
                                  ) : categories.filter(c => !c.is_distribution_category).length > 0 ? (
                                    <select
                                      value={item.category_id}
                                      onChange={(e) => {
                                        if (e.target.value === '__new__') {
                                          setShowNewCategoryInput({ ...showNewCategoryInput, [key]: true });
                                        } else {
                                          updateRecipeItem(actualIndex, itemIndex, 'category_id', e.target.value);
                                        }
                                      }}
                                      className={styles.tableCellSelect}
                                    >
                                      <option value="">Select...</option>
                                      {categories.filter(c => !c.is_distribution_category).map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                      ))}
                                      <option value="__new__">+ New</option>
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={newCategoryName[key] || ''}
                                      onChange={(e) => setNewCategoryName({ ...newCategoryName, [key]: e.target.value })}
                                      placeholder="Type name..."
                                      className={styles.tableCellInput}
                                      onBlur={(e) => {
                                        const value = e.target.value.trim();
                                        if (value) createCategory(actualIndex, itemIndex);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const value = e.currentTarget.value.trim();
                                          if (value) createCategory(actualIndex, itemIndex);
                                        }
                                      }}
                                    />
                                  )}
                                </div>

                                {/* Variant */}
                                <div className={styles.tableCell} style={{ flex: 1.5, minWidth: 0 }}>
                                  {selectedCategory ? (
                                    showNewVariantInput[key] ? (
                                      <input
                                        type="text"
                                        value={newVariantValue[key] || ''}
                                        onChange={(e) => setNewVariantValue({ ...newVariantValue, [key]: e.target.value })}
                                        placeholder="Type name..."
                                        className={styles.tableCellInput}
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const variant = newVariantValue[key]?.trim();
                                            if (variant) {
                                              addVariantToCategory(selectedCategory.id, variant);
                                              updateRecipeItem(actualIndex, itemIndex, 'variant', variant);
                                              setNewVariantValue({ ...newVariantValue, [key]: '' });
                                              setShowNewVariantInput({ ...showNewVariantInput, [key]: false });
                                            }
                                          } else if (e.key === 'Escape') {
                                            setShowNewVariantInput({ ...showNewVariantInput, [key]: false });
                                            setNewVariantValue({ ...newVariantValue, [key]: '' });
                                          }
                                        }}
                                        onBlur={(e) => {
                                          const variant = e.target.value.trim();
                                          if (variant) {
                                            addVariantToCategory(selectedCategory.id, variant);
                                            updateRecipeItem(actualIndex, itemIndex, 'variant', variant);
                                            setNewVariantValue({ ...newVariantValue, [key]: '' });
                                          }
                                          setShowNewVariantInput({ ...showNewVariantInput, [key]: false });
                                        }}
                                      />
                                    ) : selectedCategory.variants.length > 0 ? (
                                      <select
                                        value={item.variant || ''}
                                        onChange={(e) => {
                                          if (e.target.value === '__new__') {
                                            setShowNewVariantInput({ ...showNewVariantInput, [key]: true });
                                          } else {
                                            updateRecipeItem(actualIndex, itemIndex, 'variant', e.target.value);
                                          }
                                        }}
                                        className={styles.tableCellSelect}
                                      >
                                        <option value="">(optional)</option>
                                        {selectedCategory.variants.map((variant, i) => (
                                          <option key={i} value={variant}>{variant}</option>
                                        ))}
                                        <option value="__new__">+ New</option>
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        value={item.variant || ''}
                                        onChange={(e) => updateRecipeItem(actualIndex, itemIndex, 'variant', e.target.value)}
                                        placeholder="(optional)"
                                        className={styles.tableCellInput}
                                        onBlur={(e) => {
                                          const value = e.target.value.trim();
                                          if (value && !selectedCategory.variants.includes(value)) {
                                            addVariantToCategory(selectedCategory.id, value);
                                          }
                                        }}
                                      />
                                    )
                                  ) : (
                                    <span className={styles.tableCellDisabled}>—</span>
                                  )}
                                </div>

                                {/* Mode Toggle */}
                                <div className={styles.tableCell} style={{ flex: 1 }}>
                                  <div className={styles.modeToggle}>
                                    <button
                                      type="button"
                                      className={item.entry_mode === 'per_unit' ? styles.modeActive : styles.modeInactive}
                                      onClick={() => updateRecipeItem(actualIndex, itemIndex, 'entry_mode', 'per_unit')}
                                    >
                                      Unit
                                    </button>
                                    <button
                                      type="button"
                                      className={item.entry_mode === 'per_batch' ? styles.modeActive : styles.modeInactive}
                                      onClick={() => updateRecipeItem(actualIndex, itemIndex, 'entry_mode', 'per_batch')}
                                    >
                                      Batch
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Right side - Qty, Unit, Batch Size with calculation below */}
                              <div className={styles.rowRightSection}>
                                <div className={styles.rowRightTop}>
                                  {/* Quantity */}
                                  <div className={styles.tableCell} style={{ flex: 1 }}>
                                    <input
                                      type="number"
                                      value={item.entry_mode === 'per_batch' ? (item.quantity_per_batch || '') : item.quantity}
                                      onChange={(e) => updateRecipeItem(
                                        actualIndex,
                                        itemIndex,
                                        item.entry_mode === 'per_batch' ? 'quantity_per_batch' : 'quantity',
                                        e.target.value
                                      )}
                                      placeholder="0"
                                      step={item.entry_mode === 'per_batch' ? '0.01' : '0.000001'}
                                      min="0"
                                      className={styles.tableCellInput}
                                    />
                                  </div>

                                  {/* Unit */}
                                  <div className={styles.tableCell} style={{ flex: 0.7 }}>
                                    <select
                                      value={item.unit_of_measurement || ''}
                                      onChange={(e) => updateRecipeItem(actualIndex, itemIndex, 'unit_of_measurement', e.target.value)}
                                      className={styles.tableCellSelectSmall}
                                    >
                                      {UNITS_OF_MEASUREMENT.map(unit => (
                                        <option key={unit} value={unit}>{unit}</option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Batch Size */}
                                  <div className={styles.tableCell} style={{ flex: 1.8 }}>
                                    {item.entry_mode === 'per_batch' ? (
                                      <div className={styles.batchSizeCell}>
                                        <span className={styles.batchArrow}>→</span>
                                        <input
                                          type="number"
                                          value={item.batch_size || ''}
                                          onChange={(e) => updateRecipeItem(actualIndex, itemIndex, 'batch_size', e.target.value)}
                                          placeholder="0"
                                          step="1"
                                          min="1"
                                          className={styles.tableCellInputBatch}
                                        />
                                        <span className={styles.batchUnitsLabel}>units</span>
                                      </div>
                                    ) : (
                                      <span className={styles.tableCellDisabled}>—</span>
                                    )}
                                  </div>
                                </div>

                                {/* Calculation row - only shows for batch mode, centered */}
                                {item.entry_mode === 'per_batch' && item.quantity_per_batch && item.batch_size && (
                                  <div className={styles.rowRightCalc}>
                                    = {item.quantity} {item.unit_of_measurement} per unit
                                  </div>
                                )}
                              </div>

                              {/* Remove */}
                              <button
                                type="button"
                                onClick={() => removeRecipeItem(actualIndex, itemIndex)}
                                className={styles.removeInlineBtn}
                                aria-label="Remove ingredient"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => addRecipeItem(actualIndex)}
                          className={styles.addIngredientButton}
                        >
                          + Add Piece
                        </button>
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {currentStep === 'invoices' && (
          <div className={styles.stepContent}>
            <div className={styles.invoiceGrid}>
            {invoices.map((invoice, invIndex) => {
              const isExpanded = expandedInvoices.has(invoice.id);
              const lineItemsTotal = calculateInvoiceLineItemsTotal(invoice);
              const itemCount = invoice.items.length;

              return (
              <div key={invoice.id} className={`${styles.invoiceCard} ${isExpanded ? styles.invoiceCardExpanded : ''}`}>
                {/* Card Header - always visible */}
                <div
                  className={styles.invoiceCardHeader}
                  onClick={() => toggleInvoiceExpanded(invoice.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
                  <div className={styles.invoiceVendorInfo}>
                    <span className={styles.invoiceVendorName}>
                      {invoice.vendor_name || `Invoice ${invIndex + 1}`}
                    </span>
                    {invoice.invoice_total && (
                      <span className={styles.invoiceTotalBadge}>${invoice.invoice_total}</span>
                    )}
                  </div>
                  {!isExpanded && (
                    <span className={styles.invoiceItemCount}>
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </span>
                  )}
                  {invoices.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeInvoice(invIndex);
                      }}
                      className={styles.invoiceRemoveBtn}
                      aria-label="Remove invoice"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                <div className={styles.invoiceContent}>
                  {/* Invoice Fields Row */}
                  <div className={styles.invoiceFieldsRow}>
                    <div className={styles.invoiceFieldCompact} style={{ flex: 2 }}>
                      <label className={styles.label}>Vendor Name</label>
                      {showNewVendorInput[invoice.id] ? (
                        <div className={styles.newVendorInputRow}>
                          <input
                            type="text"
                            value={newVendorName[invoice.id] || ''}
                            onChange={(e) => setNewVendorName({ ...newVendorName, [invoice.id]: e.target.value })}
                            placeholder="Enter vendor name"
                            className={styles.input}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                createVendor(invoice.id);
                              } else if (e.key === 'Escape') {
                                setShowNewVendorInput({ ...showNewVendorInput, [invoice.id]: false });
                                setNewVendorName({ ...newVendorName, [invoice.id]: '' });
                              }
                            }}
                          />
                          <button
                            type="button"
                            className={styles.newVendorSaveBtn}
                            onClick={() => createVendor(invoice.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className={styles.newVendorCancelBtn}
                            onClick={() => {
                              setShowNewVendorInput({ ...showNewVendorInput, [invoice.id]: false });
                              setNewVendorName({ ...newVendorName, [invoice.id]: '' });
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <select
                          value={invoice.vendor_id || ''}
                          onChange={(e) => {
                            const selectedValue = e.target.value;
                            if (selectedValue === '__new__') {
                              setShowNewVendorInput({ ...showNewVendorInput, [invoice.id]: true });
                            } else {
                              selectVendor(invoice.id, selectedValue);
                            }
                          }}
                          className={styles.input}
                        >
                          <option value="">Select vendor...</option>
                          {vendors
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(v => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          <option value="__new__">+ Add new vendor...</option>
                        </select>
                      )}
                    </div>
                    <div className={styles.invoiceFieldCompact}>
                      <label className={styles.label}>Date</label>
                      <input
                        type="date"
                        value={invoice.invoice_date}
                        onChange={(e) => updateInvoice(invIndex, 'invoice_date', e.target.value)}
                        onBlur={(e) => {
                          const { iso } = processDateInput(e.target.value);
                          if (iso !== e.target.value) {
                            updateInvoice(invIndex, 'invoice_date', iso);
                          }
                        }}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.invoiceFieldCompact}>
                      <label className={styles.label}>Invoice #</label>
                      <input
                        type="text"
                        value={invoice.invoice_number || ''}
                        onChange={(e) => updateInvoice(invIndex, 'invoice_number', e.target.value)}
                        placeholder="INV-001"
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.invoiceFieldCompact}>
                      <label className={styles.label}>Total ($)</label>
                      <input
                        type="text"
                        value={invoice.invoice_total || ''}
                        onChange={(e) => updateInvoice(invIndex, 'invoice_total', e.target.value)}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (!value) return;
                          const evaluated = evaluateMathExpression(value);
                          if (evaluated !== value) {
                            updateInvoice(invIndex, 'invoice_total', evaluated);
                          }
                        }}
                        placeholder="150.00"
                        className={styles.input}
                      />
                    </div>
                  </div>

                  {/* Line Items Table - Regular Items Only */}
                  <div>
                    {/* Table Header */}
                    <div className={styles.lineItemsHeader}>
                      <span className={styles.headerCell} style={{ flex: 2 }}>Category</span>
                      <span className={styles.headerCell} style={{ flex: 1.5 }}>Variant</span>
                      <span className={styles.headerCell} style={{ flex: 0.8 }}>Qty</span>
                      <span className={styles.headerCell} style={{ flex: 0.8 }}>Unit</span>
                      <span className={styles.headerCell} style={{ flex: 1 }}>$/Unit</span>
                      <span className={styles.headerCell} style={{ flex: 1 }}>Total</span>
                      <span style={{ width: '24px' }}></span>
                    </div>
                    {/* Regular Line Item Rows */}
                    {invoice.items.map((item, itemIndex) => {
                      // Skip S+H and Personal items - they have their own sections
                      if (item.item_type === 'shipping' || item.item_type === 'personal' || item.is_personal) return null;

                      const selectedCategory = categories.find(c => c.id === item.category_id);
                      // Also skip if category is a distribution category (S+H)
                      if (selectedCategory?.is_distribution_category) return null;

                      return (
                        <div key={itemIndex}>
                          <div className={styles.lineItemRow}>
                            {/* Category - only show non-distribution categories */}
                            <div className={styles.lineItemCell} style={{ flex: 2 }}>
                              <select
                                value={item.category_id}
                                onChange={(e) => {
                                  const selectedValue = e.target.value;
                                  const updated = invoices.map(inv =>
                                    inv.id === invoice.id
                                      ? {
                                          ...inv,
                                          items: inv.items.map((itm, i) =>
                                            i === itemIndex
                                              ? {
                                                  ...itm,
                                                  category_id: selectedValue,
                                                  variant: ''
                                                }
                                              : itm
                                          )
                                        }
                                      : inv
                                  );
                                  setInvoices(updated);
                                }}
                                className={styles.lineItemSelect}
                              >
                                <option value="">Select...</option>
                                {[...categories]
                                  .filter(cat => !cat.is_distribution_category)
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                  ))}
                              </select>
                            </div>

                            {/* Variant */}
                            <div className={styles.lineItemCell} style={{ flex: 1.5 }}>
                              {selectedCategory && selectedCategory.variants.length > 0 ? (
                                <select
                                  value={item.variant || ''}
                                  onChange={(e) => updateInvoiceItem(invoice.id, itemIndex, 'variant', e.target.value)}
                                  className={styles.lineItemSelect}
                                >
                                  <option value="">(none)</option>
                                  {selectedCategory.variants.map((v, i) => (
                                    <option key={i} value={v}>{v}</option>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem', padding: '0.25rem' }}>—</span>
                              )}
                            </div>

                            {/* Qty */}
                            <div className={styles.lineItemCell} style={{ flex: 0.8 }}>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateInvoiceItem(invoice.id, itemIndex, 'quantity', e.target.value)}
                                placeholder="1"
                                step="0.01"
                                min="0"
                                className={styles.lineItemInput}
                              />
                            </div>

                            {/* Unit */}
                            <div className={styles.lineItemCell} style={{ flex: 0.8 }}>
                              <select
                                value={item.unit_of_measurement || ''}
                                onChange={(e) => updateInvoiceItem(invoice.id, itemIndex, 'unit_of_measurement', e.target.value)}
                                className={styles.lineItemSelect}
                              >
                                {UNITS_OF_MEASUREMENT.map(unit => (
                                  <option key={unit} value={unit}>{unit}</option>
                                ))}
                              </select>
                            </div>

                            {/* $/Unit */}
                            <div className={styles.lineItemCell} style={{ flex: 1 }}>
                              <div className={styles.lineItemMoneyGroup}>
                                <span className={styles.inputPrefix}>$</span>
                                <input
                                  type="number"
                                  value={item.unit_cost}
                                  onChange={(e) => updateInvoiceItem(invoice.id, itemIndex, 'unit_cost', e.target.value)}
                                  placeholder="0.00"
                                  step="0.01"
                                  min="0"
                                  className={styles.lineItemInputMoney}
                                />
                              </div>
                            </div>

                            {/* Total */}
                            <div className={styles.lineItemCell} style={{ flex: 1 }}>
                              <div className={styles.lineItemMoneyGroup}>
                                <span className={styles.inputPrefix}>$</span>
                                <input
                                  type="text"
                                  value={item.line_total || ''}
                                  onChange={(e) => updateInvoiceItem(invoice.id, itemIndex, 'line_total', e.target.value)}
                                  onBlur={(e) => {
                                    const evaluated = evaluateMathExpression(e.target.value);
                                    if (evaluated !== e.target.value) {
                                      updateInvoiceItem(invoice.id, itemIndex, 'line_total', evaluated);
                                    }
                                  }}
                                  placeholder="0.00"
                                  className={styles.lineItemInputMoney}
                                />
                              </div>
                            </div>

                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => removeInvoiceItem(invoice.id, itemIndex)}
                              className={styles.lineItemRemove}
                              aria-label="Remove item"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Conversion Row - only for regular items with unit mismatches */}
                          {item.unitWarning && (() => {
                            const recipeUnit = getRecipeUnit(item.category_id, item.variant);
                            if (!recipeUnit || !item.unit_of_measurement) return null;
                            const form = getOrCreateConversionForm(item.category_id, item.variant, item.unit_of_measurement, recipeUnit);
                            const conversionKey = `${item.category_id}_${item.variant || 'default'}`;
                            const hasConversion = hasValidConversion(item.category_id, item.variant);

                            // Get unit types to restrict dropdowns appropriately
                            const invoiceUnitType = getUnitType(item.unit_of_measurement as Unit);
                            const recipeUnitType = getUnitType(recipeUnit as Unit);
                            const invoiceUnits = getUnitsForType(invoiceUnitType);
                            const recipeUnits = getUnitsForType(recipeUnitType);

                            return (
                              <div className={styles.conversionInline}>
                                <span className={styles.conversionInlineLabel}>Convert:</span>
                                <input
                                  key={`${conversionKey}_leftQty`}
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  defaultValue={form.leftQty}
                                  onBlur={(e) => updateConversionForm(item.category_id, item.variant, 'leftQty', e.target.value)}
                                  className={styles.conversionInlineInput}
                                />
                                <select
                                  key={`${conversionKey}_leftUnit`}
                                  defaultValue={form.leftUnit}
                                  onChange={(e) => updateConversionForm(item.category_id, item.variant, 'leftUnit', e.target.value)}
                                  className={styles.conversionInlineSelect}
                                >
                                  {invoiceUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <span className={styles.conversionInlineEquals}>=</span>
                                <input
                                  key={`${conversionKey}_rightQty`}
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  placeholder="?"
                                  defaultValue={form.rightQty}
                                  onBlur={(e) => updateConversionForm(item.category_id, item.variant, 'rightQty', e.target.value)}
                                  className={styles.conversionInlineInput}
                                />
                                <select
                                  key={`${conversionKey}_rightUnit`}
                                  defaultValue={form.rightUnit}
                                  onChange={(e) => updateConversionForm(item.category_id, item.variant, 'rightUnit', e.target.value)}
                                  className={styles.conversionInlineSelect}
                                >
                                  {recipeUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                {hasConversion ? (
                                  <span className={styles.conversionInlineSuccess}>✓ Saved</span>
                                ) : (
                                  <span className={styles.conversionInlineNote}>Enter conversion</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className={styles.invoiceActionButtons}>
                    <button
                      type="button"
                      onClick={() => addInvoiceItem(invoice.id)}
                      className={styles.addSmallButton}
                    >
                      + Add Line Item
                    </button>
                    <button
                      type="button"
                      onClick={() => addShippingItem(invoice.id)}
                      className={styles.addShippingButton}
                    >
                      + Shipping & Handling
                    </button>
                    <button
                      type="button"
                      onClick={() => addPersonalItem(invoice.id)}
                      className={styles.addPersonalButton}
                    >
                      + Personal Item
                    </button>
                  </div>

                  {/* Shipping & Handling Section */}
                  {invoice.items.some(item => item.item_type === 'shipping' || (categories.find(c => c.id === item.category_id)?.is_distribution_category && item.item_type !== 'personal')) && (
                    <div className={styles.specialItemSection}>
                      <div className={styles.specialItemHeader}>
                        <span className={styles.specialItemIcon}>📦</span>
                        <span className={styles.specialItemTitle}>Shipping & Handling</span>
                      </div>
                      {invoice.items.map((item, itemIndex) => {
                        const selectedCategory = categories.find(c => c.id === item.category_id);
                        const isShipping = item.item_type === 'shipping' || selectedCategory?.is_distribution_category;
                        if (!isShipping || item.is_personal) return null;

                        // Get other invoices (excluding current one) for the invoice dropdown
                        const otherInvoices = invoices.filter(inv => inv.id !== invoice.id && (inv.vendor_id || inv.vendor_name.trim()));
                        const targetInvoices = item.target_invoices || [];
                        const itemsFilter = item.items_filter || 'all';
                        const selectedCats = item.selected_categories || [];

                        // Dropdown keys for this item
                        const invoiceDropdownKey = `inv_${invoice.id}_${itemIndex}`;
                        const categoryDropdownKey = `cat_${invoice.id}_${itemIndex}`;

                        // Get sorted categories (excluding S+H)
                        const sortedCategories = [...categories]
                          .filter(cat => !cat.is_distribution_category)
                          .sort((a, b) => a.name.localeCompare(b.name));

                        return (
                          <div key={itemIndex} className={styles.specialItemRow}>
                            <div className={styles.shippingRowInline}>
                              {/* Invoice Target dropdown */}
                              <div className={styles.shippingFieldInline}>
                                <label className={styles.shippingLabelInline}>Invoices:</label>
                                {otherInvoices.length === 0 ? (
                                  <span className={styles.shippingValueText}>This Invoice</span>
                                ) : (
                                  <div className={styles.invoiceCheckboxDropdown}>
                                    <button
                                      type="button"
                                      className={styles.invoiceDropdownTrigger}
                                      onClick={() => setOpenInvoiceDropdown(
                                        openInvoiceDropdown === invoiceDropdownKey ? null : invoiceDropdownKey
                                      )}
                                    >
                                      <span>
                                        {targetInvoices.length === 0
                                          ? 'This Invoice'
                                          : `${targetInvoices.length} invoice${targetInvoices.length > 1 ? 's' : ''}`}
                                      </span>
                                      <span className={styles.dropdownArrow}>
                                        {openInvoiceDropdown === invoiceDropdownKey ? '▲' : '▼'}
                                      </span>
                                    </button>
                                    {openInvoiceDropdown === invoiceDropdownKey && (
                                      <div
                                        className={styles.invoiceDropdownMenu}
                                        onMouseDown={(e) => e.stopPropagation()}
                                      >
                                        {otherInvoices.map(inv => {
                                          const isChecked = targetInvoices.includes(inv.id);
                                          return (
                                            <div
                                              key={inv.id}
                                              className={styles.invoiceDropdownItem}
                                              onClick={() => {
                                                const newSelected = isChecked
                                                  ? targetInvoices.filter((id: string) => id !== inv.id)
                                                  : [...targetInvoices, inv.id];
                                                updateInvoiceItem(invoice.id, itemIndex, 'target_invoices', newSelected);
                                              }}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                readOnly
                                              />
                                              <span className={styles.invoiceDropdownName}>{inv.vendor_name}</span>
                                              {inv.invoice_total && (
                                                <span className={styles.invoiceDropdownTotal}>${inv.invoice_total}</span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Items Filter dropdown */}
                              <div className={styles.shippingFieldInline}>
                                <label className={styles.shippingLabelInline}>Items:</label>
                                <div className={styles.categoryCheckboxDropdown}>
                                  <button
                                    type="button"
                                    className={styles.categoryDropdownTrigger}
                                    onClick={() => {
                                      if (itemsFilter === 'all') {
                                        // Switch to categories mode and open dropdown
                                        updateInvoiceItem(invoice.id, itemIndex, 'items_filter', 'categories');
                                        setOpenCategoryDropdown(categoryDropdownKey);
                                      } else {
                                        // Toggle dropdown
                                        setOpenCategoryDropdown(
                                          openCategoryDropdown === categoryDropdownKey ? null : categoryDropdownKey
                                        );
                                      }
                                    }}
                                  >
                                    <span>
                                      {itemsFilter === 'all'
                                        ? 'All Items'
                                        : selectedCats.length === 0
                                          ? 'Select categories...'
                                          : `${selectedCats.length} categor${selectedCats.length > 1 ? 'ies' : 'y'}`}
                                    </span>
                                    <span className={styles.dropdownArrow}>
                                      {openCategoryDropdown === categoryDropdownKey ? '▲' : '▼'}
                                    </span>
                                  </button>
                                  {openCategoryDropdown === categoryDropdownKey && (
                                    <div
                                      className={styles.categoryDropdownMenu}
                                      onMouseDown={(e) => e.stopPropagation()}
                                    >
                                      {/* All Items option */}
                                      <div
                                        className={`${styles.categoryDropdownItem} ${styles.categoryDropdownAll}`}
                                        onClick={() => {
                                          updateInvoiceItem(invoice.id, itemIndex, 'items_filter', 'all');
                                          updateInvoiceItem(invoice.id, itemIndex, 'selected_categories', []);
                                          setOpenCategoryDropdown(null);
                                        }}
                                      >
                                        <input
                                          type="radio"
                                          name={`items_filter_${invoice.id}_${itemIndex}`}
                                          checked={itemsFilter === 'all'}
                                          readOnly
                                        />
                                        <span>All Items</span>
                                      </div>
                                      <div className={styles.categoryDropdownDivider} />
                                      {/* Category checkboxes */}
                                      {sortedCategories.map(cat => {
                                        const isChecked = selectedCats.includes(cat.id);
                                        return (
                                          <div
                                            key={cat.id}
                                            className={styles.categoryDropdownItem}
                                            onClick={() => {
                                              console.log('DEBUG: Category clicked', { cat: cat.name, catId: cat.id, isChecked, invoiceId: invoice.id, itemIndex });
                                              const newSelected = isChecked
                                                ? selectedCats.filter((id: string) => id !== cat.id)
                                                : [...selectedCats, cat.id];
                                              console.log('DEBUG: newSelected', newSelected);
                                              updateInvoiceItem(invoice.id, itemIndex, 'selected_categories', newSelected);
                                              // Auto-switch to categories mode when selecting
                                              if (newSelected.length > 0) {
                                                updateInvoiceItem(invoice.id, itemIndex, 'items_filter', 'categories');
                                              }
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              readOnly
                                            />
                                            <span>{cat.name}</span>
                                          </div>
                                        );
                                      })}
                                      {sortedCategories.length === 0 && (
                                        <div className={styles.categoryDropdownEmpty}>No categories available</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Split method toggle */}
                              <div className={styles.shippingFieldInline}>
                                <label className={styles.shippingLabelInline}>Split:</label>
                                <div className={styles.distributionToggle}>
                                  <button
                                    type="button"
                                    className={item.distribution_method !== 'equal' ? styles.distToggleActive : styles.distToggleInactive}
                                    onClick={() => updateInvoiceItem(invoice.id, itemIndex, 'distribution_method', 'weighted')}
                                  >
                                    by %
                                  </button>
                                  <button
                                    type="button"
                                    className={item.distribution_method === 'equal' ? styles.distToggleActive : styles.distToggleInactive}
                                    onClick={() => updateInvoiceItem(invoice.id, itemIndex, 'distribution_method', 'equal')}
                                  >
                                    Evenly
                                  </button>
                                </div>
                              </div>

                              {/* S+H Amount */}
                              <div className={styles.shippingFieldInline}>
                                <label className={styles.shippingLabelInline}>Amount:</label>
                                <div className={styles.shippingAmountInputInline}>
                                  <span className={styles.inputPrefix}>$</span>
                                  <input
                                    type="text"
                                    value={item.unit_cost}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      const updated = invoices.map(inv =>
                                        inv.id === invoice.id
                                          ? {
                                              ...inv,
                                              items: inv.items.map((itm, i) =>
                                                i === itemIndex
                                                  ? { ...itm, unit_cost: value, quantity: '1', unit_of_measurement: 'each', line_total: value }
                                                  : itm
                                              )
                                            }
                                          : inv
                                      );
                                      setInvoices(updated);
                                    }}
                                    placeholder="0.00"
                                    className={styles.shippingAmountFieldInline}
                                  />
                                </div>
                              </div>

                              {/* Remove S+H */}
                              <button
                                type="button"
                                onClick={() => removeInvoiceItem(invoice.id, itemIndex)}
                                className={styles.specialItemRemoveInline}
                                aria-label="Remove shipping"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Distribution Preview */}
                            {(() => {
                              const shAmount = parseFloat(item.unit_cost || '0');
                              if (shAmount <= 0) return null;

                              // Convert invoices to the format expected by the distribution calculator
                              const invoicesForCalc: SHInvoice[] = invoices.map(inv => ({
                                id: inv.id,
                                vendor_name: inv.vendor_name,
                                items: inv.items.map(itm => ({
                                  category_id: itm.category_id,
                                  variant: itm.variant,
                                  line_total: itm.line_total,
                                  unit_cost: itm.unit_cost,
                                  quantity: itm.quantity
                                }))
                              }));

                              // Get S+H category IDs to exclude from distribution
                              const shCategoryIds = categories
                                .filter(c => c.is_distribution_category)
                                .map(c => c.id);

                              const distribution = calculateSHDistribution({
                                amount: shAmount,
                                distribution_method: item.distribution_method || 'weighted',
                                items_filter: item.items_filter || 'all',
                                selected_categories: item.selected_categories || [],
                                target_invoices: item.target_invoices || [],
                                current_invoice_id: invoice.id,
                                excluded_category_ids: shCategoryIds
                              }, invoicesForCalc);

                              if (distribution.eligibleItemsCount === 0) {
                                return (
                                  <div className={styles.distributionPreview}>
                                    <span className={styles.distributionPreviewWarning}>
                                      No eligible items to distribute to
                                    </span>
                                  </div>
                                );
                              }

                              // Get category name with optional variant
                              const getItemLabel = (catId: string, variant?: string) => {
                                const cat = categories.find(c => c.id === catId);
                                const catName = cat?.name || catId;
                                return variant ? `${catName} (${variant})` : catName;
                              };

                              // Get invoice vendor name
                              const getInvoiceVendor = (invId: string) => {
                                const inv = invoices.find(i => i.id === invId);
                                return inv?.vendor_name || 'Unknown';
                              };

                              // Group distributions by invoice
                              const invoiceGroups = distribution.distributions.reduce((acc, dist) => {
                                if (!acc[dist.invoiceId]) {
                                  acc[dist.invoiceId] = [];
                                }
                                acc[dist.invoiceId].push(dist);
                                return acc;
                              }, {} as Record<string, typeof distribution.distributions>);

                              const invoiceIds = Object.keys(invoiceGroups);
                              const hasMultipleInvoices = invoiceIds.length > 1;

                              return (
                                <div className={styles.distributionPreview}>
                                  <span className={styles.distributionPreviewLabel}>
                                    Distribution ({distribution.method === 'weighted' ? 'by %' : 'even'}):
                                  </span>
                                  <div className={styles.distributionPreviewItems}>
                                    {invoiceIds.map((invId, invIdx) => (
                                      <div key={invId} className={styles.distributionInvoiceGroup}>
                                        {hasMultipleInvoices && (
                                          <span className={styles.distributionInvoiceLabel}>
                                            {getInvoiceVendor(invId)}:
                                          </span>
                                        )}
                                        <div className={hasMultipleInvoices ? styles.distributionInvoiceItems : undefined}>
                                          {invoiceGroups[invId].map((dist, idx) => (
                                            <span key={idx} className={styles.distributionPreviewItem}>
                                              {getItemLabel(dist.categoryId, dist.variant)}: ${dist.distributedAmount.toFixed(2)}
                                              {distribution.method === 'weighted' && (
                                                <span className={styles.distributionPreviewPercent}>
                                                  ({dist.percentage.toFixed(1)}%)
                                                </span>
                                              )}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Personal Items Section */}
                  {invoice.items.some(item => item.item_type === 'personal' || item.is_personal) && (
                    <div className={styles.specialItemSection}>
                      <div className={styles.specialItemHeader}>
                        <span className={styles.specialItemIcon}>👤</span>
                        <span className={styles.specialItemTitle}>Personal Items</span>
                        <span className={styles.specialItemSubtitle}>(not a business expense)</span>
                      </div>
                      {invoice.items.map((item, itemIndex) => {
                        const isPersonal = item.item_type === 'personal' || item.is_personal;
                        if (!isPersonal) return null;

                        return (
                          <div key={itemIndex} className={styles.personalItemRow}>
                            <div className={styles.personalItemControls}>
                              <div className={styles.personalItemField}>
                                <label className={styles.personalItemLabel}>Amount:</label>
                                <div className={styles.personalAmountInput}>
                                  <span className={styles.inputPrefix}>$</span>
                                  <input
                                    type="text"
                                    value={item.unit_cost}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      const updated = invoices.map(inv =>
                                        inv.id === invoice.id
                                          ? {
                                              ...inv,
                                              items: inv.items.map((itm, i) =>
                                                i === itemIndex
                                                  ? { ...itm, unit_cost: value, quantity: '1', unit_of_measurement: 'each', line_total: value }
                                                  : itm
                                              )
                                            }
                                          : inv
                                      );
                                      setInvoices(updated);
                                    }}
                                    placeholder="0.00"
                                    className={styles.personalAmountField}
                                  />
                                </div>
                              </div>

                              {/* Remove Personal Item */}
                              <button
                                type="button"
                                onClick={() => removeInvoiceItem(invoice.id, itemIndex)}
                                className={styles.specialItemRemove}
                                aria-label="Remove personal item"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Balance Section - Compact */}
                  {invoice.items.length > 0 && (() => {
                    const invoiceTotal = parseFloat(invoice.invoice_total || '0');
                    const difference = invoiceTotal - lineItemsTotal;
                    const isBalanced = Math.abs(difference) <= 0.01;
                    const hasInvoiceTotal = invoice.invoice_total && invoice.invoice_total.trim();

                    return (
                      <div className={`${styles.invoiceBalanceCompact} ${
                        hasInvoiceTotal
                          ? isBalanced
                            ? styles.balanceBalanced
                            : difference > 0
                              ? styles.balanceUnder
                              : styles.balanceOver
                          : ''
                      }`}>
                        <span className={styles.balanceContent}>
                          <span className={styles.balanceLabel}>Line Items:</span>
                          <span className={styles.balanceAmount}>${lineItemsTotal.toFixed(2)}</span>
                          {hasInvoiceTotal && !isBalanced && (
                            <span className={styles.balanceDiff}>
                              {difference > 0 ? `$${difference.toFixed(2)} under` : `$${Math.abs(difference).toFixed(2)} over`}
                            </span>
                          )}
                          {hasInvoiceTotal && isBalanced && (
                            <span className={styles.balanceCheck}>Balanced</span>
                          )}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Notes - Compact */}
                  <div className={styles.invoiceNotesCompact}>
                    <label className={styles.label}>Notes</label>
                    <textarea
                      value={invoice.notes || ''}
                      onChange={(e) => updateInvoice(invIndex, 'notes', e.target.value)}
                      placeholder="Optional notes..."
                      className={styles.textarea}
                      rows={1}
                    />
                  </div>
                </div>
                )}
              </div>
              );
            })}
            </div>

            <button
              type="button"
              onClick={addInvoice}
              className={styles.addButton}
            >
              + Add Another Invoice
            </button>
          </div>
        )}

        {currentStep === 'review' && (
          <div className={styles.stepContent}>
            {/* Overall Summary */}
            <div className={styles.reviewSummaryCard}>
              <h3 className={styles.reviewSummaryTitle}>Summary</h3>
              <div className={styles.reviewStats}>
                <div className={styles.reviewStat}>
                  <span className={styles.reviewStatNumber}>{products.filter(p => p.name.trim()).length}</span>
                  <span className={styles.reviewStatLabel}>Product{products.filter(p => p.name.trim()).length !== 1 ? 's' : ''}</span>
                </div>
                <div className={styles.reviewStat}>
                  <span className={styles.reviewStatNumber}>{categories.length}</span>
                  <span className={styles.reviewStatLabel}>Categor{categories.length !== 1 ? 'ies' : 'y'}</span>
                </div>
                <div className={styles.reviewStat}>
                  <span className={styles.reviewStatNumber}>{invoices.filter(i => i.vendor_id || i.vendor_name.trim()).length}</span>
                  <span className={styles.reviewStatLabel}>Invoice{invoices.filter(i => i.vendor_id || i.vendor_name.trim()).length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {getBlockingErrors().length > 0 && (
                <div className={styles.reviewErrorsBox}>
                  <div className={styles.reviewErrorsHeader}>⚠️ Cannot Save - Errors Must Be Fixed</div>
                  <ul className={styles.reviewErrorsList}>
                    {getBlockingErrors().map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                  <p className={styles.reviewErrorsNote}>
                    Please go back and fix these issues before continuing.
                  </p>
                </div>
              )}

              {/* Critical Warnings - Missing invoices for recipe items */}
              {getBlockingErrors().length === 0 && getCriticalWarnings().length > 0 && (
                <div className={styles.reviewCriticalBox}>
                  <div className={styles.reviewCriticalHeader}>⚠️ Important: Missing Cost Data</div>
                  <ul className={styles.reviewCriticalList}>
                    {getCriticalWarnings().map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                  <p className={styles.reviewCriticalNote}>
                    These ingredients are in your recipes but don't have invoices. Add invoices to track your actual costs.
                  </p>
                </div>
              )}

              {/* Minor Warnings - Missing SKUs, incomplete data, etc. */}
              {getBlockingErrors().length === 0 && getMinorWarnings().length > 0 && (
                <div className={styles.reviewWarningsBox}>
                  <div className={styles.reviewWarningsHeader}>⚠️ Incomplete Data</div>
                  <ul className={styles.reviewWarningsList}>
                    {getMinorWarnings().map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                  <p className={styles.reviewWarningsNote}>
                    You can still save, but having complete data gives you better insights.
                  </p>
                </div>
              )}

              {getBlockingErrors().length === 0 && getOverallWarnings().length === 0 && (
                <div className={styles.reviewSuccessBox}>
                  Everything looks great! All data is complete.
                </div>
              )}
            </div>

            {/* Products Detail */}
            <div className={styles.reviewSection}>
              <h3 className={styles.reviewSectionTitle}>
                Your Products ({products.filter(p => p.name.trim()).length})
              </h3>
              {products.filter(p => p.name.trim()).length === 0 && (
                <p className={styles.reviewEmpty}>No products added</p>
              )}
              {products.filter(p => p.name.trim()).map(prod => {
                const warnings = getProductWarnings(prod);
                const hasWarnings = warnings.length > 0;
                return (
                  <div
                    key={prod.id}
                    className={`${styles.reviewCard} ${hasWarnings ? styles.reviewCardClickable : ''}`}
                    onClick={hasWarnings ? () => setCurrentStep('products') : undefined}
                    style={hasWarnings ? { cursor: 'pointer' } : undefined}
                    title={hasWarnings ? 'Click to edit this product' : undefined}
                  >
                    <div className={styles.reviewCardHeader}>
                      <div className={styles.reviewCardTitle}>
                        {warnings.length === 0 ? '' : '⚠️ '}<strong>{prod.name}</strong>
                      </div>
                      <div className={styles.reviewCardMeta}>
                        {prod.msrp && <span className={styles.reviewPrice}>${prod.msrp}</span>}
                        {prod.sku && <span className={styles.reviewSku}>SKU: {prod.sku}</span>}
                      </div>
                    </div>
                    {prod.recipeItems.length > 0 && (
                      <div className={styles.reviewCardContent}>
                        <div className={styles.reviewIngredientsList}>
                          {prod.recipeItems.map((item, idx) => {
                            const category = categories.find(c => c.id === item.category_id);
                            if (!category) return null;
                            return (
                              <span key={idx} className={styles.reviewIngredientPill}>
                                {category.name}{item.variant ? ` - ${item.variant}` : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {warnings.length > 0 && (
                      <div className={styles.reviewCardWarnings}>
                        {warnings.map((w, i) => (
                          <span key={i} className={styles.reviewWarningTag}>{w}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Categories Detail */}
            {categories.length > 0 && (
              <div className={styles.reviewSection}>
                <h3 className={styles.reviewSectionTitle}>
                  Ingredient Categories ({categories.length})
                </h3>
                <div className={styles.reviewCategoriesGrid}>
                  {categories.map(cat => (
                    <div key={cat.id} className={styles.reviewCategoryChip}>
                      <strong>{cat.name}</strong>
                      {cat.variants.length > 0 && (
                        <span className={styles.reviewCategoryVariants}>
                          {cat.variants.join(', ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invoices Detail */}
            <div className={styles.reviewSection}>
              <h3 className={styles.reviewSectionTitle}>
                Supplier Invoices ({invoices.filter(i => i.vendor_id || i.vendor_name.trim()).length})
              </h3>
              {invoices.filter(i => i.vendor_id || i.vendor_name.trim()).length === 0 && (
                <p className={styles.reviewEmpty}>No invoices added (optional)</p>
              )}
              {invoices.filter(i => i.vendor_id || i.vendor_name.trim()).map(inv => {
                const warnings = getInvoiceWarnings(inv);
                const errors = getInvoiceErrors(inv);
                const total = calculateInvoiceLineItemsTotal(inv);
                const hasIssues = warnings.length > 0 || errors.length > 0;
                return (
                  <div
                    key={inv.id}
                    className={`${styles.reviewCard} ${hasIssues ? styles.reviewCardClickable : ''}`}
                    onClick={hasIssues ? () => setCurrentStep('invoices') : undefined}
                    style={hasIssues ? { cursor: 'pointer' } : undefined}
                    title={hasIssues ? 'Click to edit this invoice' : undefined}
                  >
                    <div className={styles.reviewCardHeader}>
                      <div className={styles.reviewCardTitle}>
                        {errors.length > 0 ? '⚠️ ' : warnings.length === 0 ? '' : '⚠️ '}<strong>{inv.vendor_name}</strong>
                      </div>
                      <div className={styles.reviewCardMeta}>
                        {inv.invoice_date && <span>{inv.invoice_date}</span>}
                        {inv.invoice_number && <span>#{inv.invoice_number}</span>}
                      </div>
                    </div>
                    <div className={styles.reviewCardContent}>
                      <div className={styles.reviewInvoiceDetails}>
                        <span>Line Items Total: ${total.toFixed(2)}</span>
                        {inv.invoice_total && <span>Invoice Total: ${inv.invoice_total}</span>}
                        <span>{inv.items.length} line item{inv.items.length !== 1 ? 's' : ''}</span>
                      </div>
                      {inv.items.length > 0 && (
                        <div className={styles.reviewIngredientsList}>
                          {inv.items.map((item, idx) => {
                            const category = categories.find(c => c.id === item.category_id);
                            if (!category) return null;
                            return (
                              <span key={idx} className={styles.reviewIngredientPill}>
                                {category.name}{item.variant ? ` - ${item.variant}` : ''}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {errors.length > 0 && (
                      <div className={styles.reviewCardErrors}>
                        {errors.map((e, i) => (
                          <span key={i} className={styles.reviewErrorTag}>{e}</span>
                        ))}
                      </div>
                    )}
                    {warnings.length > 0 && (
                      <div className={styles.reviewCardWarnings}>
                        {warnings.map((w, i) => (
                          <span key={i} className={styles.reviewWarningTag}>{w}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>

      {/* Navigation */}
      <div className={styles.actions}>
        <div className={styles.leftActions}>
          {currentStepIndex > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className={styles.secondaryButton}
            >
              ← Back
            </button>
          )}
        </div>

        <div className={styles.rightActions}>
          <button
            type="button"
            onClick={onSkip}
            className={styles.skipButton}
          >
            Skip for Now
          </button>

          {currentStep !== 'review' ? (
            <button
              type="button"
              onClick={handleNext}
              className={styles.primaryButton}
              disabled={!canProceed()}
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const errors = getBlockingErrors();
                console.log('🔘 Confirm + Save clicked!');
                console.log('❌ Blocking errors:', errors);
                console.log('🔒 Button disabled?', errors.length > 0 || importing);
                if (errors.length === 0 && !importing) {
                  handleSubmit();
                } else {
                  console.log('⚠️ Button is disabled due to errors above or already importing');
                }
              }}
              className={styles.primaryButton}
              disabled={getBlockingErrors().length > 0 || importing}
              style={{
                opacity: getBlockingErrors().length > 0 || importing ? 0.5 : 1,
                cursor: getBlockingErrors().length > 0 || importing ? 'not-allowed' : 'pointer'
              }}
            >
              {importing ? 'Importing...' : '✓ Confirm + Save'}
            </button>
          )}
        </div>
      </div>

      <div className={styles.note}>
        <p>
          <strong>Take your time!</strong> You can access the full CPG worksheet anytime from your dashboard
          to add or edit this information.
        </p>
      </div>

      <LoadingOverlay
        isVisible={importing}
        message="This is the 'calm before your clarity' moment"
        showLogo
      />
      </div>
      <WorksheetSidebar
        currentStep={currentStep as WorksheetStep}
        onStepClick={handleStepClick as (step: WorksheetStep) => void}
        onSkip={onSkip}
        onContinue={handleContinue}
        canNavigateToStep={canNavigateToStep as (step: WorksheetStep) => boolean}
        canContinue={canProceed()}
      />
    </div>
  );
}
