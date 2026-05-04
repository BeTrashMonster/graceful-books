/**
 * Add Invoice Modal
 *
 * Allows users to create new CPG invoices with cost attribution across categories and variants.
 * This is the most complex modal as it handles dynamic category/variant selection.
 */

import { useState, useEffect, useRef } from 'react';
import { Modal } from '../../modals/Modal';
import { Input } from '../../forms/Input';
import { Autocomplete } from '../../forms/Autocomplete';
import { Button } from '../../core/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useCPGSettingsContext } from '../../../contexts/CPGSettingsContext';
import { db } from '../../../db/database';
import { createDefaultCPGInvoice, validateCPGInvoice, createDefaultCPGVendor } from '../../../db/schema/cpg.schema';
import type { CPGCategory, CPGVendor } from '../../../db/schema/cpg.schema';
import { cpuCalculatorService } from '../../../services/cpg/cpuCalculator.service';
import { CPGCategoryService } from '../../../services/cpg/cpgCategory.service';
import { v4 as uuidv4 } from 'uuid';
import { processMathInput } from '../../../utils/mathParser';
import { processDateInput } from '../../../utils/dateUtils';
import { UNIT_CATALOG, type Unit, getUnitsByType, areUnitsCompatible, getUnitMismatchWarning } from '../../../utils/unitConversion';
import styles from './CPGModals.module.css';

export interface AddInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onNeedCategories?: () => void;
  onNavigateToRecipe?: (finishedProductId: string, productName: string, categoryId?: string, variant?: string | null) => void; // Navigate to recipe builder for a product
  invoiceId?: string; // If provided, modal is in edit or duplicate mode
  mode?: 'new' | 'edit' | 'duplicate'; // Determines the modal behavior
}

interface CostAttributionItem {
  id: string;
  category_id: string;
  variant: string | null;
  description: string;
  units_purchased: string;
  unit_of_measurement: Unit; // Unit (oz, lb, ml, each, etc.)
  unit_price: string;
  units_received: string;
  manual_line_total?: string; // Optional override for rounding issues
  distribution_method?: 'equal' | 'weighted'; // For S+H categories only
  showAdvanced?: boolean; // Toggle for advanced fields
  lastChangedField?: 'units' | 'price' | 'total'; // Track which field user last changed for smart calculation
  is_personal?: boolean; // True if this is a personal item (not business expense)
}

export function AddInvoiceModal({ isOpen, onClose, onSuccess, onNeedCategories, onNavigateToRecipe, invoiceId, mode = 'new' }: AddInvoiceModalProps) {
  const auth = useAuth();
  console.log('AddInvoiceModal - Full auth object:', auth);
  console.log('AddInvoiceModal - auth keys:', Object.keys(auth));
  const companyId = auth.companyId;
  const deviceId = auth.deviceId || 'default-device';
  console.log('AddInvoiceModal - Extracted values:', { companyId, deviceId });
  const { formatCurrency } = useCPGSettingsContext();
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = today.getFullYear();
    return `${month}/${day}/${year}`;
  });
  const [vendorName, setVendorName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [totalInvoiceAmount, setTotalInvoiceAmount] = useState('');
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [vendors, setVendors] = useState<CPGVendor[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<Array<{id: string; name: string}>>([]);
  const [costItems, setCostItems] = useState<CostAttributionItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [unitWarnings, setUnitWarnings] = useState<Record<string, { count: number; items: Array<{ productName: string; recipeUnit: string; finishedProductId: string; categoryId: string; variant: string | null }> }>>({});
  const [expandedWarnings, setExpandedWarnings] = useState<Record<string, boolean>>({});
  const [confirmNavigation, setConfirmNavigation] = useState<{ productId: string; productName: string; categoryId: string; variant: string | null } | null>(null);
  const errorAlertRef = useRef<HTMLDivElement>(null);

  const isEditMode = mode === 'edit';
  const isDuplicateMode = mode === 'duplicate';

  // Scroll to error when errors are set
  useEffect(() => {
    if (Object.keys(errors).length > 0 && errorAlertRef.current) {
      errorAlertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errors]);

  // Apply purple header styling when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      // Find elements using more specific selectors (CSS Modules generate unique class names)
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) {
        console.log('Dialog not found');
        return;
      }

      // Modal header is the first child with h2 inside
      const modalTitle = dialog.querySelector('#modal-title') as HTMLElement;
      const modalHeader = modalTitle?.parentElement as HTMLElement;
      const closeButton = dialog.querySelector('[aria-label="Close modal"]') as HTMLElement;

      console.log('Found elements:', { modalHeader, modalTitle, closeButton });

      if (modalHeader) {
        modalHeader.style.backgroundColor = '#4b006e';
        modalHeader.style.padding = '0.75rem 1.5rem';
        modalHeader.style.borderBottom = 'none';
        console.log('Applied header styles');
      }

      if (modalTitle) {
        modalTitle.style.color = '#ffffff';
        console.log('Applied title styles');
      }

      if (closeButton) {
        closeButton.style.color = '#ffffff';
        console.log('Applied button styles');
      }
    }, 100); // Increased delay to ensure modal is fully rendered

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Load categories
  useEffect(() => {
    if (!isOpen || !companyId) return;

    const loadData = async () => {
      try {
        // Ensure S+H category exists for this company
        await CPGCategoryService.ensureShippingHandlingCategory(companyId, deviceId);

        // Load categories (alphabetically)
        const cats = await db.cpgCategories
          .where('company_id')
          .equals(companyId)
          .filter(c => c.active && !c.deleted_at)
          .sortBy('name'); // Alphabetical order by name
        setCategories(cats);

        // Load vendors
        const vendorsList = await db.cpgVendors
          .where('company_id')
          .equals(companyId)
          .filter(v => v.active && !v.deleted_at)
          .sortBy('name');
        console.log('Loaded vendors:', vendorsList.map(v => v.name));
        setVendors(vendorsList);

        // Load payment accounts (for full bookkeeping mode)
        // Check if accounts table exists (full bookkeeping software)
        if (db.accounts) {
          try {
            const accounts = await db.accounts
              .where('company_id')
              .equals(companyId)
              .filter(a => !a.deleted_at && (a.type === 'Bank' || a.type === 'Credit Card'))
              .toArray();
            setPaymentAccounts(accounts.map(a => ({ id: a.id, name: a.name })));
          } catch (e) {
            // Accounts table doesn't exist or error - standalone mode
            setPaymentAccounts([]);
          }
        }

        // Auto-add first cost item if none exist
        if (costItems.length === 0 && cats.length > 0) {
          addCostItem();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [isOpen, companyId]);

  // Load existing invoice data when in edit mode
  useEffect(() => {
    if (!isOpen || !invoiceId || !companyId) return;

    const loadInvoiceData = async () => {
      try {
        setIsLoadingInvoice(true);
        const invoice = await db.cpgInvoices.get(invoiceId);

        if (!invoice) {
          setErrors({ form: 'Invoice not found' });
          return;
        }

        // Populate form fields
        setInvoiceNumber(invoice.invoice_number || '');
        // Use UTC methods to avoid timezone issues
        const date = new Date(invoice.invoice_date);
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const year = date.getUTCFullYear();
        setInvoiceDate(`${month}/${day}/${year}`);
        setVendorName(invoice.vendor_name || '');
        setPaymentMethod(invoice.payment_method || '');
        setNotes(invoice.notes || '');
        // Preserve full precision when loading invoice for editing
        const formattedTotal = invoice.total_paid
          ? parseFloat(invoice.total_paid).toString()
          : '';
        setTotalInvoiceAmount(formattedTotal);

        // Populate cost items from cost_attribution
        // IMPORTANT: Preserve ALL user-entered values exactly as stored
        const items: CostAttributionItem[] = Object.entries(invoice.cost_attribution || {}).map(([key, item]) => ({
          id: key,
          category_id: item.category_id,
          variant: item.variant || null,
          description: item.description || '',
          units_purchased: item.units_purchased,
          unit_of_measurement: (item.unit_of_measurement as Unit) || 'each', // Default to 'each' for backward compatibility
          unit_price: item.unit_price,
          units_received: item.units_received || item.units_purchased,
          manual_line_total: item.manual_line_total || undefined, // Preserve manual line total
          distribution_method: item.distribution_method,
        }));

        setCostItems(items);
      } catch (error) {
        console.error('Error loading invoice data:', error);
        setErrors({ form: 'Failed to load invoice data' });
      } finally {
        setIsLoadingInvoice(false);
      }
    };

    loadInvoiceData();
  }, [isOpen, invoiceId, companyId]);

  const addCostItem = () => {
    setCostItems(prev => [
      ...prev,
      {
        id: uuidv4(),
        category_id: categories[0]?.id || '',
        variant: null,
        description: '',
        units_purchased: '',
        unit_of_measurement: 'each' as Unit, // Default to 'each'
        unit_price: '',
        units_received: '',
        distribution_method: undefined,
      },
    ]);
  };

  const removeCostItem = (id: string) => {
    setCostItems(prev => prev.filter(item => item.id !== id));
  };

  /**
   * Smart calculation helper - calculates missing value from 2 provided values
   * Supports: Units + Price → Total, Total + Units → Price, Total + Price → Units
   */
  const calculateMissingValue = (item: CostAttributionItem, changedField: 'units' | 'price' | 'total'): Partial<CostAttributionItem> => {
    const units = parseFloat(item.units_purchased || '0');
    const price = parseFloat(item.unit_price || '0');
    const total = parseFloat(item.manual_line_total || '0');

    const hasUnits = item.units_purchased && item.units_purchased.trim() !== '' && units > 0;
    const hasPrice = item.unit_price && item.unit_price.trim() !== '' && price > 0;
    const hasTotal = item.manual_line_total && item.manual_line_total.trim() !== '' && total > 0;

    // Scenario: Changed units or price → calculate line total
    if ((changedField === 'units' || changedField === 'price') && hasUnits && hasPrice) {
      const calculated = units * price;
      return { manual_line_total: calculated.toFixed(6).replace(/\.?0+$/, '') };
    }

    // Scenario: Changed line total + have units → calculate price
    if (changedField === 'total' && hasTotal && hasUnits) {
      const calculated = total / units;
      return { unit_price: calculated.toFixed(6).replace(/\.?0+$/, '') };
    }

    // Scenario: Changed line total + have price → calculate units
    if (changedField === 'total' && hasTotal && hasPrice) {
      const calculated = total / price;
      return { units_purchased: calculated.toFixed(6).replace(/\.?0+$/, '') };
    }

    // Scenario: Changed units + have total (but not price) → calculate price
    if (changedField === 'units' && hasUnits && hasTotal && !hasPrice) {
      const calculated = total / units;
      return { unit_price: calculated.toFixed(6).replace(/\.?0+$/, '') };
    }

    // Scenario: Changed price + have total (but not units) → calculate units
    if (changedField === 'price' && hasPrice && hasTotal && !hasUnits) {
      const calculated = total / price;
      return { units_purchased: calculated.toFixed(6).replace(/\.?0+$/, '') };
    }

    return {};
  };

  const updateCostItem = (id: string, field: keyof CostAttributionItem, value: any) => {
    if (field === 'distribution_method') {
      console.log('[AddInvoiceModal] updateCostItem - distribution_method:', { id, value });
    }

    setCostItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };

          // Auto-fill units_received when units_purchased changes
          // Update if: empty, or was previously synced with units_purchased
          if (field === 'units_purchased' && typeof value === 'string') {
            if (!item.units_received || item.units_received === item.units_purchased) {
              updated.units_received = value;
            }
          }

          // Check for unit mismatches when category, variant, or unit changes
          if (field === 'category_id' || field === 'variant' || field === 'unit_of_measurement') {
            const categoryId = field === 'category_id' ? value : updated.category_id;
            const variant = field === 'variant' ? value : updated.variant;
            const unit = field === 'unit_of_measurement' ? value : updated.unit_of_measurement;

            // Trigger async check (don't await - it updates state independently)
            checkUnitMismatch(id, categoryId, variant, unit);
          }

          // NOTE: Smart calculation moved to onBlur to prevent mid-typing recalculation

          if (field === 'distribution_method') {
            console.log('[AddInvoiceModal] Updated item:', updated);
          }
          return updated;
        }
        return item;
      })
    );
  };

  /**
   * Trigger smart calculation after user finishes editing a field (onBlur)
   * This prevents recalculation while typing
   */
  const handleFieldBlur = (id: string, field: 'units' | 'price' | 'total') => {
    setCostItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const category = getCategory(item.category_id);
          // Skip calculation for S+H categories
          if (category?.is_distribution_category) {
            return item;
          }

          const calculated = calculateMissingValue(item, field);
          return { ...item, ...calculated };
        }
        return item;
      })
    );
  };

  // Calculate running balance
  const calculateLineItemsTotal = (): number => {
    return costItems.reduce((sum, item) => {
      // Use manual line total if specified, otherwise calculate
      if (item.manual_line_total && parseFloat(item.manual_line_total) > 0) {
        return sum + parseFloat(item.manual_line_total);
      }
      const units = parseFloat(item.units_purchased || '0');
      const price = parseFloat(item.unit_price || '0');
      return sum + (units * price);
    }, 0);
  };

  const lineItemsTotal = calculateLineItemsTotal();
  const invoiceTotal = parseFloat(totalInvoiceAmount || '0');
  const remaining = invoiceTotal - lineItemsTotal;

  const getCategory = (categoryId: string) => {
    return categories.find(c => c.id === categoryId);
  };

  /**
   * Check for unit mismatches between invoice entry and existing recipes
   * Queries recipes table and shows warning if units are incompatible
   */
  const checkUnitMismatch = async (itemId: string, categoryId: string, variant: string | null, invoiceUnit: Unit) => {
    if (!companyId || !categoryId) {
      // Clear warning for this item
      setUnitWarnings(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
      return;
    }

    try {
      // Query recipes that use this category+variant
      const recipes = await db.cpgRecipes
        .where('company_id')
        .equals(companyId)
        .filter(r =>
          r.active &&
          !r.deleted_at &&
          r.category_id === categoryId &&
          r.variant === variant
        )
        .toArray();

      if (recipes.length === 0) {
        // No recipes exist yet - clear warning
        setUnitWarnings(prev => {
          const updated = { ...prev };
          delete updated[itemId];
          return updated;
        });
        return;
      }

      // Find ALL recipes with incompatible units (not just the first one)
      const incompatibleItems: Array<{ productName: string; recipeUnit: string; finishedProductId: string; categoryId: string; variant: string | null }> = [];

      for (const recipe of recipes) {
        const recipeUnit = (recipe.unit_of_measurement as Unit) || 'each';

        // Only include truly incompatible units (skip convertible ones like oz↔lb)
        if (!areUnitsCompatible(invoiceUnit, recipeUnit)) {
          // Get the finished product name
          const finishedProduct = await db.cpgFinishedProducts.get(recipe.finished_product_id);

          // Skip recipes with missing or deleted products (orphaned data)
          if (!finishedProduct || !finishedProduct.active || finishedProduct.deleted_at) {
            console.warn(
              '⚠️ Found orphaned recipe (recipe.id=' + recipe.id + ') pointing to ' +
              (finishedProduct ? 'deleted' : 'missing') + ' product (product_id=' + recipe.finished_product_id + '). ' +
              'This recipe will be hidden from warnings. Consider cleaning up orphaned recipes.'
            );
            continue;
          }

          incompatibleItems.push({
            productName: finishedProduct.name,
            recipeUnit: UNIT_CATALOG[recipeUnit]?.label || recipeUnit,
            finishedProductId: recipe.finished_product_id,
            categoryId,
            variant
          });
        }
      }

      if (incompatibleItems.length > 0) {
        setUnitWarnings(prev => ({
          ...prev,
          [itemId]: {
            count: incompatibleItems.length,
            items: incompatibleItems
          }
        }));
      } else {
        // All units are compatible - clear warning
        setUnitWarnings(prev => {
          const updated = { ...prev };
          delete updated[itemId];
          return updated;
        });
      }
    } catch (error) {
      console.error('Error checking unit mismatch:', error);
      // Clear warning on error
      setUnitWarnings(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    }
  };

  // Core save logic that can be called from handleSubmit or navigation flow
  const saveInvoice = async (): Promise<boolean> => {
    setErrors({});

    if (!companyId) {
      setErrors({ form: 'Not authenticated' });
      return false;
    }

    if (!invoiceDate) {
      setErrors({ form: 'Please enter an invoice date' });
      return false;
    }

    // Convert date to ISO format and then to timestamp at noon UTC to avoid timezone issues
    const { iso } = processDateInput(invoiceDate);
    const invoiceDateTimestamp = new Date(iso + 'T12:00:00Z').getTime();

    if (isNaN(invoiceDateTimestamp) || invoiceDateTimestamp <= 0) {
      setErrors({ form: `Invalid invoice date: ${invoiceDate}. Please use MM/DD/YYYY format.` });
      return false;
    }

    if (!totalInvoiceAmount || parseFloat(totalInvoiceAmount) <= 0) {
      setErrors({ form: 'Please enter a total invoice amount' });
      return false;
    }

    // Filter out empty cost items (items with no data entered)
    // An item is considered "filled" if it has a category AND at least one numeric field
    const filledCostItems = costItems.filter(item => {
      const hasCategory = !!item.category_id;
      const hasUnits = item.units_purchased && item.units_purchased.trim() !== '';
      const hasPrice = item.unit_price && item.unit_price.trim() !== '';

      // Must have category AND (units OR price)
      return hasCategory && (hasUnits || hasPrice);
    });

    if (filledCostItems.length === 0) {
      setErrors({ form: 'Please add at least one cost item' });
      return false;
    }

    // Check balance validation (±$0.01 tolerance)
    const balanceDiff = Math.abs(remaining);
    if (balanceDiff > 0.01) {
      setErrors({
        form: `Line items (${formatCurrency(lineItemsTotal)}) don't match invoice total (${formatCurrency(invoiceTotal)}). Remaining: ${formatCurrency(remaining)}`
      });
      return false;
    }

    // Build cost attribution object
    const costAttribution: Record<string, any> = {};
    let hasErrors = false;

    filledCostItems.forEach((item, index) => {
      // Skip category validation for personal items
      const isPersonal = item.is_personal || item.category_id === '__personal__';

      if (!item.category_id && !isPersonal) {
        setErrors(prev => ({ ...prev, [`item_${index}_category`]: 'Category required' }));
        hasErrors = true;
        return;
      }

      // For personal items, skip category-specific validation
      if (isPersonal) {
        // Personal items still need description and price, will be validated below
      } else {
        const category = getCategory(item.category_id);
        if (!category) return;

        // If category has variants, variant must be selected
        if (category.variants && category.variants.length > 0 && !item.variant) {
          setErrors(prev => ({ ...prev, [`item_${index}_variant`]: 'Variant required' }));
          hasErrors = true;
          return;
        }

        // If category is a distribution category (S+H), distribution method must be selected
        if (category.is_distribution_category && !item.distribution_method) {
          setErrors(prev => ({ ...prev, [`item_${index}_distribution`]: 'Distribution method required' }));
          hasErrors = true;
          return;
        }
      }

      const category = isPersonal ? null : getCategory(item.category_id);

      // For personal items or S+H categories, units is auto-set to 1, so only validate price
      if (isPersonal || category?.is_distribution_category) {
        const price = parseFloat(item.unit_price);
        if (!item.unit_price || item.unit_price.trim() === '' || isNaN(price) || price <= 0) {
          setErrors(prev => ({ ...prev, [`item_${index}_price`]: isPersonal ? 'Amount required' : 'Total cost required' }));
          hasErrors = true;
          return;
        }
      } else {
        // For material categories, validate both units and price
        const units = parseFloat(item.units_purchased);
        if (!item.units_purchased || item.units_purchased.trim() === '' || isNaN(units) || units <= 0) {
          setErrors(prev => ({ ...prev, [`item_${index}_units`]: 'Units purchased required' }));
          hasErrors = true;
          return;
        }
        const price = parseFloat(item.unit_price);
        if (!item.unit_price || item.unit_price.trim() === '' || isNaN(price) || price <= 0) {
          setErrors(prev => ({ ...prev, [`item_${index}_price`]: 'Unit price required' }));
          hasErrors = true;
          return;
        }
      }

      // Generate key for cost attribution
      // For personal items, use a special key format
      const key = isPersonal
        ? `personal_${item.id}`
        : item.variant
          ? `${category!.name.replace(/[^a-zA-Z0-9]/g, '')}_${item.variant.replace(/[^a-zA-Z0-9]/g, '')}`
          : category!.name.replace(/[^a-zA-Z0-9]/g, '');

      // Normalize decimal values (convert .55 to 0.55)
      const normalizeDecimal = (value: string): string => {
        const trimmed = value.trim();
        // Add leading zero if starts with decimal point
        return trimmed.startsWith('.') ? `0${trimmed}` : trimmed;
      };

      costAttribution[key] = {
        category_id: item.category_id,
        variant: item.variant,
        description: item.description || undefined,
        units_purchased: normalizeDecimal(item.units_purchased),
        unit_of_measurement: item.unit_of_measurement, // Save unit of measurement
        unit_price: normalizeDecimal(item.unit_price),
        units_received: normalizeDecimal(item.units_received || item.units_purchased),
        manual_line_total: item.manual_line_total || undefined,
        distribution_method: item.distribution_method || undefined,
        is_personal: isPersonal || undefined, // Mark personal items
      };
    });

    if (hasErrors) return false;

    // Save to database using cpuCalculatorService (which calculates CPUs)
    setIsSubmitting(true);
    try {
      if (isEditMode && invoiceId && !isDuplicateMode) {
        // Update existing invoice (not duplicate)
        const { totalPaid, calculatedCPUs } = cpuCalculatorService.calculateInvoiceCPUs(
          costAttribution,
          null
        );

        await db.cpgInvoices.update(invoiceId, {
          invoice_date: invoiceDateTimestamp,
          invoice_number: invoiceNumber || undefined,
          vendor_name: vendorName || undefined,
          payment_method: paymentMethod || undefined,
          notes: notes || undefined,
          cost_attribution: costAttribution,
          total_paid: totalPaid,
          calculated_cpus: calculatedCPUs,
          updated_at: Date.now(),
        });
      } else {
        // Create new invoice
        await cpuCalculatorService.createInvoice({
          company_id: companyId,
          invoice_date: invoiceDateTimestamp,
          invoice_number: invoiceNumber || undefined,
          vendor_name: vendorName || undefined,
          payment_method: paymentMethod || undefined,
          notes: notes || undefined,
          cost_attribution: costAttribution,
          device_id: deviceId || 'default',
        });
      }

      // Dispatch CustomEvent on successful save
      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'invoice' } }));

      return true;
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : isDuplicateMode ? 'duplicating' : 'adding'} invoice:`, error);
      setErrors({ form: `Failed to ${isEditMode ? 'update' : isDuplicateMode ? 'duplicate' : 'save'} invoice. Please try again.` });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await saveInvoice();
    if (success) {
      resetForm();
      onSuccess?.();
      onClose();
    }
  };

  const resetForm = () => {
    setInvoiceNumber('');
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = today.getFullYear();
    setInvoiceDate(`${month}/${day}/${year}`);
    setVendorName('');
    setPaymentMethod('');
    setNotes('');
    setTotalInvoiceAmount('');
    setCostItems([]);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreateVendor = async (name: string) => {
    console.log('handleCreateVendor called with:', { name, companyId, deviceId, hasAuth: !!auth });

    if (!companyId) {
      console.error('Cannot create vendor: missing companyId', { companyId, deviceId });
      return;
    }

    try {
      // Check if vendor already exists (case-insensitive)
      const existingVendor = vendors.find(v => v.name.toLowerCase() === name.toLowerCase());

      if (existingVendor) {
        console.log('Vendor already exists:', existingVendor.name);
        // Use the existing vendor's exact name (preserves original casing)
        setVendorName(existingVendor.name);
        return;
      }

      console.log('Creating new vendor:', name);
      const vendor = createDefaultCPGVendor(companyId, name, deviceId);
      const id = uuidv4();
      console.log('Vendor object created:', { id, vendor });

      await db.cpgVendors.add({ id, ...vendor } as CPGVendor);
      console.log('Vendor saved to database:', id);

      // Reload vendors
      const vendorsList = await db.cpgVendors
        .where('company_id')
        .equals(companyId)
        .filter(v => v.active && !v.deleted_at)
        .sortBy('name');
      setVendors(vendorsList);
      console.log('Vendors reloaded:', vendorsList.length, vendorsList.map(v => v.name));

      setVendorName(name);
      console.log('Vendor name set in form:', name);
    } catch (error) {
      console.error('Error creating vendor:', error);
    }
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        isEditMode ? 'Edit Raw Material Purchase' :
        isDuplicateMode ? 'Duplicate Raw Material Purchase' :
        'Enter Raw Material Purchases'
      }
      size="xl"
      closeOnBackdropClick={false}
      footer={
        <div className={styles.modalFooter}>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting || isLoadingInvoice}>
            Cancel
          </Button>
          <Button variant="gold" onClick={handleSubmit} disabled={isSubmitting || isLoadingInvoice}>
            {isSubmitting
              ? (isEditMode ? 'Updating...' : isDuplicateMode ? 'Duplicating...' : 'Adding...')
              : (isEditMode ? 'Update Invoice' : isDuplicateMode ? 'Duplicate Invoice' : 'Add Invoice')
            }
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

        {categories.length === 0 && (
          <div className={styles.successAlert} role="alert">
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#4b006e' }}>
              Before we can add invoices, let's set up your categories first!
            </h3>
            <p style={{ marginBottom: '1rem', color: '#64748b' }}>
              Categories are the building blocks of your products - things like Ingredients, Packaging, or Labels.
              Each category can have variants like different sizes (1oz, 5oz, etc.)
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  onNeedCategories?.();
                  onClose();
                }}
              >
                Set Up First Category
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                I'll Do This Later
              </Button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <Autocomplete
            label="Vendor Name"
            placeholder="ex: ABC Supplies"
            value={vendorName}
            onChange={(value) => {
              console.log('Vendor name changed to:', value);
              setVendorName(value);
            }}
            onCreateNew={handleCreateVendor}
            options={(() => {
              const opts = vendors.map(v => ({ value: v.name, label: v.name }));
              console.log('Vendor options for Autocomplete:', opts);
              return opts;
            })()}
            allowCreate={true}
            createPrompt="Create new vendor:"
          />

          <Input
            label="Invoice Number"
            placeholder="ex: INV-001"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            fullWidth
          />

          <Input
            label="Invoice Date"
            type="text"
            placeholder="MM/DD/YYYY or MMDDYY"
            value={invoiceDate}
            onChange={(e) => {
              setInvoiceDate(e.target.value);
            }}
            onBlur={(e) => {
              const { formatted } = processDateInput(e.target.value);
              if (formatted !== e.target.value) {
                console.log('Date formatted:', e.target.value, '->', formatted);
                setInvoiceDate(formatted);
              }
            }}
            required
            fullWidth
          />
        </div>

        <div className={styles.feeRow}>
          <Input
            label="Total Invoice Amount"
            type="text"
            placeholder="0.00"
            value={totalInvoiceAmount}
            onChange={(e) => setTotalInvoiceAmount(e.target.value)}
            onBlur={(e) => {
              const { value, calculated } = processMathInput(e.target.value, true);
              if (calculated || e.target.value !== value) {
                setTotalInvoiceAmount(value);
              }
            }}
            iconBefore="$"
            required
            fullWidth
          />

          {paymentAccounts.length > 0 ? (
            <Autocomplete
              label="Paid With"
              placeholder="Select account..."
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={paymentAccounts.map(a => ({ value: a.name, label: a.name }))}
              allowCreate={false}
            />
          ) : (
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#374151' }}>
                Paid With
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '0.625rem 0.875rem',
                  border: '2px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '1rem',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  transition: 'border-color 150ms ease-out',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Select...</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Check">Check</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Other">Other</option>
              </select>
            </div>
          )}
        </div>

        <div className={styles.costAttributionSection}>
          <div className={styles.sectionHeader}>What Did You Buy?</div>

          {costItems.map((item, index) => {
            const category = getCategory(item.category_id);
            const hasVariants = category && category.variants && category.variants.length > 0;
            const isDistributionCategory = category?.is_distribution_category === true;

            // Determine grid layout based on category type
            let gridColumns = '1.5fr 0.6fr 0.6fr 0.6fr 0.7fr 1.2fr'; // Default: Category, Units, Unit, Price, Line Total, Description
            if (isDistributionCategory && hasVariants) {
              gridColumns = '1.5fr 1fr 1fr 1fr 1.2fr'; // Category, Variant, Distribution, Total Cost, Description
            } else if (isDistributionCategory) {
              gridColumns = '1.5fr 1fr 1fr 1.2fr'; // Category, Distribution, Total Cost, Description
            } else if (hasVariants) {
              gridColumns = '1.5fr 1fr 0.6fr 0.6fr 0.6fr 0.7fr 1.2fr'; // Category, Variant, Units, Unit, Price, Line Total, Description
            }

            return (
              <div key={item.id} className={styles.categoryRow}>
                {costItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCostItem(item.id)}
                    style={{
                      position: 'absolute',
                      right: '1rem',
                      top: '0.75rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      fontSize: '1.25rem',
                      color: '#9ca3af',
                      transition: 'color 150ms ease-out',
                      lineHeight: 1,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                    aria-label="Remove item"
                    title="Remove item"
                  >
                    🗑️
                  </button>
                )}

                {/* All main fields on one compact row */}
                <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: '0.5rem', alignItems: 'start' }}>
                  {/* Category */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                      Category *
                    </label>
                    <select
                      value={item.category_id}
                      onChange={(e) => {
                        const selectedValue = e.target.value;
                        const isPersonal = selectedValue === '__personal__';
                        const selectedCategory = isPersonal ? null : getCategory(selectedValue);

                        console.log('[AddInvoiceModal] Category selected:', {
                          categoryId: selectedValue,
                          isPersonal,
                          selectedCategory,
                          isDistribution: selectedCategory?.is_distribution_category,
                          itemId: item.id
                        });

                        updateCostItem(item.id, 'category_id', selectedValue);
                        updateCostItem(item.id, 'variant', null); // Reset variant when category changes
                        updateCostItem(item.id, 'is_personal', isPersonal); // Mark as personal if selected

                        // Set default distribution method and units if S+H category
                        if (selectedCategory?.is_distribution_category) {
                          console.log('[AddInvoiceModal] Setting distribution method to weighted');
                          updateCostItem(item.id, 'distribution_method', 'weighted');
                          updateCostItem(item.id, 'units_purchased', '1'); // S+H always has 1 unit
                        } else {
                          updateCostItem(item.id, 'distribution_method', undefined);
                        }
                      }}
                      style={{
                        width: '100%',
                        minHeight: '38px',
                        padding: '0.5rem 0.75rem',
                        border: '2px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.9375rem',
                        backgroundColor: '#ffffff',
                        outline: 'none',
                        transition: 'border-color 150ms ease-out',
                      }}
                      required
                    >
                      <option value="">Select...</option>
                      <option value="__personal__" style={{ fontStyle: 'italic', color: '#6b7280' }}>
                        👤 Personal Item
                      </option>
                      <option value="" disabled>
                        ────────────
                      </option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Variant (if needed) - hide for personal items */}
                  {hasVariants && !item.is_personal && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                        Variant *
                      </label>
                      <select
                        value={item.variant || ''}
                        onChange={(e) => updateCostItem(item.id, 'variant', e.target.value || null)}
                        style={{
                          width: '100%',
                          minHeight: '38px',
                          padding: '0.5rem 0.75rem',
                          border: errors[`item_${index}_variant`] ? '2px solid #dc2626' : '2px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.9375rem',
                          backgroundColor: '#ffffff',
                          outline: 'none',
                          transition: 'border-color 150ms ease-out',
                        }}
                        required
                      >
                        <option value="">Select...</option>
                        {category?.variants?.map(variant => (
                          <option key={variant} value={variant}>
                            {variant}
                          </option>
                        ))}
                      </select>
                      {errors[`item_${index}_variant`] && (
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#dc2626' }}>
                          {errors[`item_${index}_variant`]}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Distribution Method (S+H categories only) - hide for personal items */}
                  {category?.is_distribution_category && !item.is_personal && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                        Distribution *
                      </label>
                      <select
                        value={item.distribution_method || 'weighted'}
                        onChange={(e) => {
                          console.log('[AddInvoiceModal] Distribution method changed:', e.target.value);
                          updateCostItem(item.id, 'distribution_method', e.target.value as 'equal' | 'weighted');
                        }}
                        style={{
                          width: '100%',
                          minHeight: '38px',
                          padding: '0.5rem 0.75rem',
                          border: errors[`item_${index}_distribution`] ? '2px solid #dc2626' : '2px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.9375rem',
                          backgroundColor: '#ffffff',
                          outline: 'none',
                          transition: 'border-color 150ms ease-out',
                        }}
                        required
                      >
                        <option value="weighted">Weighted (by value)</option>
                        <option value="equal">Equal Split</option>
                      </select>
                      {errors[`item_${index}_distribution`] && (
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#dc2626' }}>
                          {errors[`item_${index}_distribution`]}
                        </p>
                      )}
                    </div>
                  )}

                  {/* For S+H categories: just show Total Cost */}
                  {isDistributionCategory ? (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                        Total Cost *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: '0.9375rem', fontWeight: 500 }}>$</span>
                        <input
                          type="text"
                          placeholder="0.00"
                          value={item.unit_price}
                          onChange={(e) => {
                            updateCostItem(item.id, 'unit_price', e.target.value);
                            updateCostItem(item.id, 'units_purchased', '1'); // Always 1 for S+H
                          }}
                          onBlur={(e) => {
                            const { value } = processMathInput(e.target.value, true);
                            if (value !== e.target.value) {
                              updateCostItem(item.id, 'unit_price', value);
                            }
                            updateCostItem(item.id, 'units_purchased', '1'); // Ensure it's set
                          }}
                          style={{
                            width: '100%',
                            minHeight: '38px',
                            padding: '0.5rem 0.75rem 0.5rem 1.75rem',
                            border: errors[`item_${index}_price`] ? '2px solid #dc2626' : '2px solid #d1d5db',
                            borderRadius: '0.375rem',
                            fontSize: '0.9375rem',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            transition: 'border-color 150ms ease-out',
                          }}
                          required
                        />
                      </div>
                      {errors[`item_${index}_price`] && (
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#dc2626' }}>
                          {errors[`item_${index}_price`]}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Units Purchased */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                          Units *
                        </label>
                        <input
                          type="text"
                          placeholder="0"
                          value={item.units_purchased}
                          onChange={(e) => updateCostItem(item.id, 'units_purchased', e.target.value)}
                          onBlur={(e) => {
                            const { value } = processMathInput(e.target.value, false);
                            if (value !== e.target.value) {
                              updateCostItem(item.id, 'units_purchased', value);
                            }
                            // Smart calculation after user finishes editing
                            handleFieldBlur(item.id, 'units');
                          }}
                          style={{
                            width: '100%',
                            minHeight: '38px',
                            padding: '0.5rem 0.75rem',
                            border: errors[`item_${index}_units`] ? '2px solid #dc2626' : '2px solid #d1d5db',
                            borderRadius: '0.375rem',
                            fontSize: '0.9375rem',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            transition: 'border-color 150ms ease-out',
                          }}
                          required
                        />
                      </div>

                      {/* Unit of Measurement */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                          Unit *
                        </label>
                        <select
                          value={item.unit_of_measurement}
                          onChange={(e) => updateCostItem(item.id, 'unit_of_measurement', e.target.value as Unit)}
                          style={{
                            width: '100%',
                            minHeight: '38px',
                            padding: '0.5rem 0.75rem',
                            border: '2px solid #d1d5db',
                            borderRadius: '0.375rem',
                            fontSize: '0.9375rem',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            transition: 'border-color 150ms ease-out',
                          }}
                          required
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

                      {/* Unit Price */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                          Unit Price *
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: '0.9375rem', fontWeight: 500 }}>$</span>
                          <input
                            type="text"
                            placeholder="0.00"
                            value={item.unit_price}
                            onChange={(e) => updateCostItem(item.id, 'unit_price', e.target.value)}
                            onBlur={(e) => {
                              const { value } = processMathInput(e.target.value, true);
                              if (value !== e.target.value) {
                                updateCostItem(item.id, 'unit_price', value);
                              }
                              // Smart calculation after user finishes editing
                              handleFieldBlur(item.id, 'price');
                            }}
                            style={{
                              width: '100%',
                              minHeight: '38px',
                              padding: '0.5rem 0.75rem 0.5rem 1.75rem',
                              border: errors[`item_${index}_price`] ? '2px solid #dc2626' : '2px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.9375rem',
                              backgroundColor: '#ffffff',
                              outline: 'none',
                              transition: 'border-color 150ms ease-out',
                            }}
                            required
                          />
                        </div>
                      </div>

                      {/* Line Total */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                          Line Total
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: '0.9375rem', fontWeight: 500 }}>$</span>
                          <input
                            type="text"
                            placeholder="0.00"
                            value={item.manual_line_total || ''}
                            onChange={(e) => updateCostItem(item.id, 'manual_line_total', e.target.value || undefined)}
                            onBlur={(e) => {
                              const { value } = processMathInput(e.target.value, true);
                              if (value !== e.target.value && value) {
                                updateCostItem(item.id, 'manual_line_total', value);
                              }
                              // Smart calculation after user finishes editing
                              handleFieldBlur(item.id, 'total');
                            }}
                            style={{
                              width: '100%',
                              minHeight: '38px',
                              padding: '0.5rem 0.75rem 0.5rem 1.75rem',
                              border: '2px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.9375rem',
                              backgroundColor: item.manual_line_total ? '#ffffff' : '#f9fafb',
                              outline: 'none',
                              transition: 'border-color 150ms ease-out',
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Description (Optional) */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.8125rem', color: '#6b7280' }}>
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="Optional notes..."
                      value={item.description}
                      onChange={(e) => updateCostItem(item.id, 'description', e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '38px',
                        padding: '0.5rem 0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        fontSize: '0.9375rem',
                        backgroundColor: '#ffffff',
                        outline: 'none',
                        transition: 'border-color 150ms ease-out',
                      }}
                    />
                  </div>
                </div>

                {/* Unit Mismatch Warning */}
                {unitWarnings[item.id] && (
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
                         onClick={() => setExpandedWarnings(prev => ({ ...prev, [item.id]: !prev[item.id] }))}>
                      <span style={{ fontSize: '1.125rem', flexShrink: 0 }}>⚠️</span>
                      <div style={{ fontWeight: 600, flex: 1 }}>
                        {unitWarnings[item.id].count} {unitWarnings[item.id].count === 1 ? 'recipe uses' : 'recipes use'} incompatible units
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                        {expandedWarnings[item.id] ? '[Hide Details ▲]' : '[Show Details ▼]'}
                      </span>
                    </div>

                    {expandedWarnings[item.id] && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #fbbf24' }}>
                        <div style={{ marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
                          This invoice uses <strong>{UNIT_CATALOG[item.unit_of_measurement]?.label || item.unit_of_measurement}</strong>, but these recipes can't auto-convert:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {unitWarnings[item.id].items.map((warning, idx) => (
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
                                • Recipe in <strong>"{warning.productName}"</strong>: Uses {warning.recipeUnit}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();

                                  if (!onNavigateToRecipe) {
                                    alert('Navigation not configured');
                                    return;
                                  }

                                  // Show branded confirmation modal
                                  setConfirmNavigation({
                                    productId: warning.finishedProductId,
                                    productName: warning.productName,
                                    categoryId: warning.categoryId,
                                    variant: warning.variant
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
                                Edit Recipe →
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Advanced fields - Units Received */}
                {!isDistributionCategory && (item.units_purchased || item.unit_price) && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => updateCostItem(item.id, 'showAdvanced', !item.showAdvanced)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#7c3aed',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        transition: 'background-color 150ms ease-out',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {item.showAdvanced ? '▲ Hide Advanced' : '▼ Show Advanced (Units Received)'}
                    </button>

                    {item.showAdvanced && (
                      <div style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        backgroundColor: '#f9fafb',
                        borderRadius: '0.375rem',
                        border: '1px solid #e5e7eb',
                      }}>
                        <div style={{ maxWidth: '200px' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.75rem', color: '#6b7280' }}>
                            Units Received (if different)
                          </label>
                          <input
                            type="text"
                            placeholder={item.units_purchased || '0'}
                            value={item.units_received}
                            onChange={(e) => updateCostItem(item.id, 'units_received', e.target.value)}
                            onBlur={(e) => {
                              const { value } = processMathInput(e.target.value, false);
                              if (value !== e.target.value) {
                                updateCostItem(item.id, 'units_received', value);
                              }
                            }}
                            style={{
                              width: '100%',
                              minHeight: '36px',
                              padding: '0.5rem 0.75rem',
                              border: '2px solid #e5e7eb',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              backgroundColor: '#ffffff',
                              outline: 'none',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Show "Add Item" button at bottom of list */}
          <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            <Button
              type="button"
              variant="purple"
              size="sm"
              onClick={addCostItem}
              disabled={categories.length === 0}
            >
              + Add Another Item
            </Button>
          </div>
        </div>

        <Input
          label="Notes (Optional)"
          placeholder="Additional information about this invoice..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
        />

        {/* S+H Allocation Preview */}
        {(() => {
          // Find S+H items and material items
          const shippingItems = costItems.filter(item => {
            const category = getCategory(item.category_id);
            return category?.is_distribution_category && item.unit_price && parseFloat(item.unit_price) > 0;
          });

          const materialItems = costItems.filter(item => {
            const category = getCategory(item.category_id);
            return !category?.is_distribution_category && item.units_purchased && item.unit_price &&
                   parseFloat(item.units_purchased) > 0 && parseFloat(item.unit_price) > 0;
          });

          if (shippingItems.length === 0 || materialItems.length === 0) return null;

          // Calculate material totals for weighted distribution
          const materialTotals = materialItems.map(item => ({
            item,
            total: parseFloat(item.units_purchased) * parseFloat(item.unit_price),
            category: getCategory(item.category_id)
          }));

          const totalMaterialValue = materialTotals.reduce((sum, m) => sum + m.total, 0);

          return (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '0.5rem',
              marginBottom: '1rem'
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#92400e', marginBottom: '0.75rem' }}>
                📦 Shipping + Handling Distribution
              </div>
              {shippingItems.map((shItem, idx) => {
                const shCategory = getCategory(shItem.category_id);
                const shTotal = parseFloat(shItem.unit_price);
                const method = shItem.distribution_method || 'weighted';

                return (
                  <div key={idx} style={{ marginBottom: idx < shippingItems.length - 1 ? '1rem' : 0 }}>
                    <div style={{ fontSize: '0.8125rem', color: '#78350f', marginBottom: '0.5rem' }}>
                      <strong>{shCategory?.name}</strong>
                      {shItem.variant && <span> ({shItem.variant})</span>}
                      : ${shTotal.toFixed(2)} - {method === 'equal' ? 'Split Equally' : 'Split by Value'}
                    </div>
                    <div style={{
                      display: 'grid',
                      gap: '0.25rem',
                      fontSize: '0.75rem',
                      color: '#92400e',
                      paddingLeft: '1rem'
                    }}>
                      {materialTotals.map((mat, matIdx) => {
                        let allocation = 0;
                        if (method === 'equal') {
                          allocation = shTotal / materialItems.length;
                        } else {
                          // Weighted by value
                          allocation = totalMaterialValue > 0 ? (mat.total / totalMaterialValue) * shTotal : 0;
                        }

                        return (
                          <div key={matIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>
                              → {mat.category?.name}
                              {mat.item.variant && <span> ({mat.item.variant})</span>}
                            </span>
                            <span style={{ fontFamily: 'monospace' }}>
                              +${allocation.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {costItems.length > 0 && totalInvoiceAmount && (
          <div className={styles.exampleBox}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Invoice Total:</span>
                <strong>{formatCurrency(invoiceTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Line Items:</span>
                <strong>{formatCurrency(lineItemsTotal)}</strong>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '0.5rem',
                borderTop: '1px solid #e2e8f0',
                color: Math.abs(remaining) > 0.01 ? '#dc2626' : '#16a34a',
                fontWeight: 600
              }}>
                <span>Remaining:</span>
                <span>${remaining.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>

    {/* Branded Confirmation Modal for Navigation */}
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
            Edit Recipe
          </h3>

          <p style={{
            margin: '0 0 1.5rem 0',
            color: '#6b7280',
            lineHeight: 1.5
          }}>
            Your invoice changes will be saved automatically before opening the recipe builder for <strong>"{confirmNavigation.productName}"</strong>.
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
                if (!onNavigateToRecipe) return;

                // Save the invoice
                const success = await saveInvoice();

                if (success) {
                  const { productId, productName, categoryId, variant } = confirmNavigation;
                  setConfirmNavigation(null);

                  // Call the navigation callback
                  onNavigateToRecipe(productId, productName, categoryId, variant);

                  // Close the invoice modal
                  resetForm();
                  onSuccess?.();
                  onClose();
                }
                // If save failed, errors are already displayed, keep modal open
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save & Edit Recipe'}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
