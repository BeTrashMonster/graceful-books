/**
 * Comprehensive Product Worksheet
 *
 * Natural flow: Add products with their recipes, create categories on-the-fly
 */

import { useState, useEffect } from 'react';
import styles from './ComprehensiveWorksheet.module.css';
import { processDateInput } from '../../utils/dateUtils';
import { LoadingOverlay } from '../feedback/Loading';
import { areUnitsCompatible, type Unit } from '../../utils/unitConversion';

interface Category {
  id: string;
  name: string;
  variants: string[];
  sort_order: number;
  is_distribution_category?: boolean; // For Shipping & Handling
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
}

interface Invoice {
  id: string;
  vendor_name: string;
  invoice_date: string;
  invoice_number?: string;
  invoice_total?: string;
  items: InvoiceItem[];
  notes?: string;
}

interface WorksheetData {
  version: string;
  created_at: string;
  categories: Category[];
  finished_products: Product[];
  recipes: Recipe[];
  invoices: Invoice[];
}

interface ComprehensiveWorksheetProps {
  onComplete: (data: WorksheetData) => void;
  onSkip: () => void;
}

type Step = 'products' | 'invoices' | 'review';

// Generate temp ID in format expected by importer: temp-{timestamp}-{random}
let tempIdCounter = 0;
const generateTempId = (): string => {
  tempIdCounter++;
  const random = Math.random().toString(36).substring(2, 10);
  return `temp-${tempIdCounter}-${random}`;
};

// Units of measurement (matching CPG system)
const UNITS_OF_MEASUREMENT = [
  // Weight
  'oz', 'lb', 'g', 'kg',
  // Volume
  'ml', 'L', 'fl oz', 'cup', 'qt', 'gal',
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
      id: '__shipping__',
      name: 'Shipping & Handling',
      variants: [],
      sort_order: 9999, // Show at end
      is_distribution_category: true
    }
  ]);

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

  // Track which invoices are expanded (accordion)
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set([invoices[0].id]));

  // For adding new category inline
  const [newCategoryName, setNewCategoryName] = useState<Record<string, string>>({});
  const [showNewCategoryInput, setShowNewCategoryInput] = useState<Record<string, boolean>>({});

  // For adding new variant inline
  const [showNewVariantInput, setShowNewVariantInput] = useState<Record<string, boolean>>({});
  const [newVariantValue, setNewVariantValue] = useState<Record<string, string>>({});

  const steps: Step[] = ['products', 'invoices', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const stepTitles: Record<Step, string> = {
    products: 'Your Products + Recipes',
    invoices: 'Supplier Invoices',
    review: 'Review + Sign'
  };

  const stepDescriptions: Record<Step, string> = {
    products: 'Add your products and the ingredients that go into each one.',
    invoices: 'Add recent supplier invoices to track ingredient costs.',
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

  // Invoice handlers
  const addInvoice = () => {
    const newId = generateTempId();
    setInvoices([...invoices, {
      id: newId,
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
    const validInvoices = invoices.filter(i => i.vendor_name.trim());

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
    const validInvoices = invoices.filter(i => i.vendor_name.trim());

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
    const validInvoices = invoices.filter(i => i.vendor_name.trim());

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
              line_total: '0.00'
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
    const updated = invoices.map(inv =>
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
                const matchingRecipes = products.flatMap(product =>
                  product.recipeItems
                    .filter(recipeItem =>
                      recipeItem.category_id === categoryId &&
                      recipeItem.variant === variant &&
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
    );
    setInvoices(updated);
  };

  // Navigation
  const canProceed = () => {
    switch (currentStep) {
      case 'products':
        return products.some(p => p.name.trim() && p.msrp.trim());
      case 'invoices':
        // Block if any invoice has errors (doesn't balance)
        const validInvoices = invoices.filter(i => i.vendor_name.trim());
        return validInvoices.every(inv => getInvoiceErrors(inv).length === 0);
      case 'review':
        return true;
      default:
        return false;
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
      .filter(i => i.vendor_name.trim() && i.items.length > 0)
      .map(inv => ({
        id: inv.id,
        vendor_name: inv.vendor_name,
        invoice_date: inv.invoice_date,
        ...(inv.invoice_number && { invoice_number: inv.invoice_number }), // Only include if present
        ...(inv.invoice_total && { invoice_total: inv.invoice_total }), // FIX: Include invoice total
        items: inv.items
          .filter(item => item.category_id && item.quantity.trim() && item.unit_cost.trim() && item.unit_of_measurement)
          .map(item => ({
            category_id: item.category_id,
            ...(item.variant && { variant: item.variant }), // Only include if present
            quantity: item.quantity,
            unit: item.unit_of_measurement,
            unit_cost: item.unit_cost,
            line_total: item.line_total || (parseFloat(item.quantity || '0') * parseFloat(item.unit_cost || '0')).toFixed(2) // FIX: Include line total
          })),
        ...(inv.notes && { notes: inv.notes }) // Only include if present
      }))
      .filter(i => i.items.length > 0);

    const worksheetData = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      categories,
      finished_products: validProducts,
      recipes: validRecipes,
      invoices: validInvoices
    };

    console.log('📤 Calling onComplete with data:', worksheetData);
    setImporting(true);
    onComplete(worksheetData);
  };

  return (
    <div className={styles.container}>
      {/* Progress bar */}
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <p className={styles.progressText}>
          Step {currentStepIndex + 1} of {steps.length}
        </p>
      </div>

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
              <div key={product.id} className={styles.productCard}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Product {prodIndex + 1}</h3>
                  {products.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProduct(prodIndex)}
                      className={styles.removeButton}
                      aria-label="Remove product"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Product details - all on one line */}
                <div className={styles.productDetails}>
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

                    <div className={styles.fieldSmall}>
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

                    <div className={styles.fieldSmall}>
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

                {/* Recipe section */}
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

        {currentStep === 'invoices' && (
          <div className={styles.stepContent}>
            {invoices.map((invoice, invIndex) => {
              const isExpanded = expandedInvoices.has(invoice.id);
              const lineItemsTotal = calculateInvoiceLineItemsTotal(invoice);
              const hasMismatch = isInvoiceTotalMismatch(invoice);

              return (
              <div key={invoice.id} className={styles.card}>
                <div
                  className={styles.cardHeader}
                  onClick={() => toggleInvoiceExpanded(invoice.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
                    <h3 className={styles.cardTitle}>
                      Invoice {invIndex + 1}
                      {invoice.vendor_name && ` - ${invoice.vendor_name}`}
                      {!isExpanded && invoice.invoice_total && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                          (${invoice.invoice_total})
                        </span>
                      )}
                    </h3>
                  </div>
                  {invoices.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeInvoice(invIndex);
                      }}
                      className={styles.removeButton}
                      aria-label="Remove invoice"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {!isExpanded && (
                  <div className={styles.collapsedSummary}>
                    <div>
                      {invoice.invoice_date && `Date: ${invoice.invoice_date}`}
                      {invoice.invoice_number && ` • #${invoice.invoice_number}`}
                    </div>
                    <div>Line Items: {invoice.items.length}</div>
                  </div>
                )}

                {isExpanded && (
                <div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Vendor Name</label>
                    <input
                      type="text"
                      value={invoice.vendor_name}
                      onChange={(e) => updateInvoice(invIndex, 'vendor_name', e.target.value)}
                      placeholder="ex:Mountain Rose Herbs"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Invoice Date</label>
                    <input
                      type="date"
                      value={invoice.invoice_date}
                      onChange={(e) => updateInvoice(invIndex, 'invoice_date', e.target.value)}
                      onBlur={(e) => {
                        // Process date input to expand 2-digit years (26 → 2026) and handle timezone
                        const { iso } = processDateInput(e.target.value);
                        if (iso !== e.target.value) {
                          updateInvoice(invIndex, 'invoice_date', iso);
                        }
                      }}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Invoice Total</label>
                    <div className={styles.inputGroup}>
                      <span className={styles.inputPrefix}>$</span>
                      <input
                        type="text"
                        value={invoice.invoice_total || ''}
                        onChange={(e) => updateInvoice(invIndex, 'invoice_total', e.target.value)}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (!value) return;

                          // Always try to evaluate (handles both math and plain numbers)
                          const evaluated = evaluateMathExpression(value);

                          // Always update to ensure formatting
                          if (evaluated !== value) {
                            updateInvoice(invIndex, 'invoice_total', evaluated);
                          }
                        }}
                        placeholder="150.00"
                        className={styles.input}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Invoice #</label>
                    <input
                      type="text"
                      value={invoice.invoice_number || ''}
                      onChange={(e) => updateInvoice(invIndex, 'invoice_number', e.target.value)}
                      placeholder="ex:INV-2026-001"
                      className={styles.input}
                    />
                  </div>
                </div>

                <h4 className={styles.invoiceItemsTitle}>Line Items</h4>
                {invoice.items.map((item, itemIndex) => {
                  const selectedCategory = categories.find(c => c.id === item.category_id);

                  return (
                    <div key={itemIndex}>
                      <div className={styles.invoiceItemRow}>
                      {/* Category and Variant grouped */}
                      <div className={styles.fieldMedium}>
                        <label className={styles.label}>Category</label>
                        <select
                          value={item.category_id}
                          onChange={(e) => {
                            const selectedValue = e.target.value;
                            const isPersonal = selectedValue === '__personal__';
                            const selectedCat = categories.find(c => c.id === selectedValue);
                            const isDistribution = selectedCat?.is_distribution_category;

                            // Update all fields in a single state update
                            const updated = invoices.map(inv =>
                              inv.id === invoice.id
                                ? {
                                    ...inv,
                                    items: inv.items.map((item, i) =>
                                      i === itemIndex
                                        ? {
                                            ...item,
                                            category_id: selectedValue,
                                            is_personal: isPersonal,
                                            variant: '', // Reset variant when category changes
                                            // Set defaults for S+H categories
                                            distribution_method: isDistribution ? 'weighted' : undefined,
                                            quantity: isDistribution || isPersonal ? '1' : item.quantity
                                          }
                                        : item
                                    )
                                  }
                                : inv
                            );
                            setInvoices(updated);
                          }}
                          className={styles.select}
                        >
                          <option value="">Select...</option>
                          <option value="__personal__" style={{ fontStyle: 'italic', color: '#6b7280' }}>
                            👤 Personal Item
                          </option>
                          <option value="" disabled>
                            ────────────
                          </option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Variant (hide for personal items) */}
                      {selectedCategory && selectedCategory.variants.length > 0 && !item.is_personal && (
                        <div className={styles.fieldMedium}>
                          <label className={styles.label}>Variant</label>
                          <select
                            value={item.variant || ''}
                            onChange={(e) => updateInvoiceItem(invoice.id, itemIndex, 'variant', e.target.value)}
                            className={styles.select}
                          >
                            <option value="">Select...</option>
                            {selectedCategory.variants.map((variant, i) => (
                              <option key={i} value={variant}>{variant}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Distribution Method (S+H categories only) - hide for personal items */}
                      {selectedCategory?.is_distribution_category && !item.is_personal && (
                        <div className={styles.fieldMedium}>
                          <label className={styles.label}>Distribution</label>
                          <select
                            value={item.distribution_method || 'weighted'}
                            onChange={(e) => updateInvoiceItem(invoice.id, itemIndex, 'distribution_method', e.target.value)}
                            className={styles.select}
                          >
                            <option value="weighted">Weighted (by value)</option>
                            <option value="equal">Equal Split</option>
                          </select>
                        </div>
                      )}

                      {/* For S+H categories and personal items: just show Total Cost/Amount */}
                      {selectedCategory?.is_distribution_category || item.is_personal ? (
                        <div className={styles.fieldMedium}>
                          <label className={styles.label}>{item.is_personal ? 'Amount' : 'Total Cost'}</label>
                          <div className={styles.inputGroup}>
                            <span className={styles.inputPrefix}>$</span>
                            <input
                              type="text"
                              value={item.unit_cost}
                              onChange={(e) => {
                                updateInvoiceItem(invoice.id, itemIndex, 'unit_cost', e.target.value);
                                updateInvoiceItem(invoice.id, itemIndex, 'quantity', '1'); // Always 1 for S+H and personal items
                              }}
                              placeholder="0.00"
                              className={styles.input}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* For regular categories: show Qty, Unit, $/Unit, Total */}
                          <div className={styles.fieldSmall}>
                            <label className={styles.label}>Qty</label>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateInvoiceItem(invoice.id, itemIndex, 'quantity', e.target.value)}
                              placeholder="16"
                              step="0.01"
                              min="0"
                              className={styles.input}
                            />
                          </div>

                          <div className={styles.fieldSmall}>
                            <label className={styles.label}>Unit</label>
                            <select
                              value={item.unit_of_measurement || ''}
                              onChange={(e) => updateInvoiceItem(invoice.id, itemIndex, 'unit_of_measurement', e.target.value)}
                              className={styles.select}
                            >
                              {UNITS_OF_MEASUREMENT.map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </div>

                          <div className={styles.invoicePriceFields}>
                            <div className={styles.fieldXSmall}>
                              <label className={styles.label}>$/Unit</label>
                              <div className={styles.inputGroup}>
                                <span className={styles.inputPrefix}>$</span>
                                <input
                                  type="number"
                                  value={item.unit_cost}
                                  onChange={(e) => updateInvoiceItem(invoice.id, itemIndex, 'unit_cost', e.target.value)}
                                  placeholder="12.99"
                                  step="0.01"
                                  min="0"
                                  className={styles.input}
                                />
                              </div>
                            </div>

                            <div className={styles.fieldXSmall}>
                              <label className={styles.label}>Total</label>
                              <div className={styles.inputGroup}>
                                <span className={styles.inputPrefix}>$</span>
                                <input
                                  type="text"
                                  value={item.line_total || ''}
                                  onChange={(e) => updateInvoiceItem(invoice.id, itemIndex, 'line_total', e.target.value)}
                                  onBlur={(e) => {
                                    // Evaluate math expressions (150-15.99 = 134.01)
                                    const evaluated = evaluateMathExpression(e.target.value);
                                    if (evaluated !== e.target.value) {
                                      updateInvoiceItem(invoice.id, itemIndex, 'line_total', evaluated);
                                    }
                                  }}
                                  placeholder="0.00"
                                  className={styles.input}
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => removeInvoiceItem(invoice.id, itemIndex)}
                        className={styles.removeInlineButton}
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                      </div>
                      {item.unitWarning && (
                        <div style={{
                          marginTop: '0.5rem',
                          padding: '0.75rem',
                          backgroundColor: '#fef3c7',
                          border: '1px solid #fbbf24',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          color: '#92400e'
                        }}>
                          {item.unitWarning}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => addInvoiceItem(invoice.id)}
                  className={styles.addSmallButton}
                >
                  + Add Line Item
                </button>

                {invoice.items.length > 0 && invoice.invoice_total && (
                  <div className={styles.invoiceBalanceSection}>
                    {(() => {
                      const invoiceTotal = parseFloat(invoice.invoice_total || '0');
                      const remaining = invoiceTotal - lineItemsTotal;
                      const isBalanced = Math.abs(remaining) <= 0.01;

                      return (
                        <>
                          {!isBalanced && (
                            <div className={styles.remainingAmount}>
                              <span className={styles.remainingLabel}>
                                {remaining > 0 ? 'Still need:' : 'Over by:'}
                              </span>
                              <span className={styles.remainingValue}>
                                ${Math.abs(remaining).toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className={styles.invoiceTotal}>
                            <span className={styles.invoiceTotalLabel}>Line Items Sum:</span>
                            <span className={styles.invoiceTotalAmount}>
                              ${lineItemsTotal.toFixed(2)}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {invoice.items.length > 0 && !invoice.invoice_total && (
                  <div className={styles.invoiceTotal}>
                    <span className={styles.invoiceTotalLabel}>Line Items Sum:</span>
                    <span className={styles.invoiceTotalAmount}>
                      ${lineItemsTotal.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className={styles.field}>
                  <label className={styles.label}>Notes</label>
                  <textarea
                    value={invoice.notes || ''}
                    onChange={(e) => updateInvoice(invIndex, 'notes', e.target.value)}
                    placeholder="Any additional notes about this invoice..."
                    className={styles.textarea}
                    rows={2}
                  />
                </div>
                </div>
                )}
              </div>
              );
            })}

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
                  <span className={styles.reviewStatNumber}>{invoices.filter(i => i.vendor_name.trim()).length}</span>
                  <span className={styles.reviewStatLabel}>Invoice{invoices.filter(i => i.vendor_name.trim()).length !== 1 ? 's' : ''}</span>
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
                Supplier Invoices ({invoices.filter(i => i.vendor_name.trim()).length})
              </h3>
              {invoices.filter(i => i.vendor_name.trim()).length === 0 && (
                <p className={styles.reviewEmpty}>No invoices added (optional)</p>
              )}
              {invoices.filter(i => i.vendor_name.trim()).map(inv => {
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

            {/* Sign-off */}
            <div className={styles.reviewSignature}>
              <div className={styles.reviewSignatureContent}>
                <p className={styles.reviewSignatureText}>
                  By clicking "Confirm & Save" below, I confirm that the information above is accurate to the best of my knowledge.
                </p>
              </div>
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
  );
}
