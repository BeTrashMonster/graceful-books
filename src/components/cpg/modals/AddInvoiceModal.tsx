/**
 * Add Invoice Modal
 *
 * Allows users to create new CPG invoices with cost attribution across categories and variants.
 * This is the most complex modal as it handles dynamic category/variant selection.
 */

import { useState, useEffect, useRef } from 'react';
import { Modal } from '../../modals/Modal';
import { Input } from '../../forms/Input';
import { Button } from '../../core/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../db/database';
import { createDefaultCPGInvoice, validateCPGInvoice } from '../../../db/schema/cpg.schema';
import type { CPGCategory } from '../../../db/schema/cpg.schema';
import { cpuCalculatorService } from '../../../services/cpg/cpuCalculator.service';
import { v4 as uuidv4 } from 'uuid';
import styles from './CPGModals.module.css';

export interface AddInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onNeedCategories?: () => void;
  invoiceId?: string; // If provided, modal is in edit mode
}

interface CostAttributionItem {
  id: string;
  category_id: string;
  variant: string | null;
  description: string;
  units_purchased: string;
  unit_price: string;
  units_received: string;
  manual_line_total?: string; // Optional override for rounding issues
}

export function AddInvoiceModal({ isOpen, onClose, onSuccess, onNeedCategories, invoiceId }: AddInvoiceModalProps) {
  const { companyId, deviceId } = useAuth();
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorName, setVendorName] = useState('');
  const [notes, setNotes] = useState('');
  const [totalInvoiceAmount, setTotalInvoiceAmount] = useState('');
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [costItems, setCostItems] = useState<CostAttributionItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const errorAlertRef = useRef<HTMLDivElement>(null);

  const isEditMode = !!invoiceId;

  // Scroll to error when errors are set
  useEffect(() => {
    if (Object.keys(errors).length > 0 && errorAlertRef.current) {
      errorAlertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errors]);

  // Load categories
  useEffect(() => {
    if (!isOpen || !companyId) return;

    const loadCategories = async () => {
      try {
        const cats = await db.cpgCategories
          .where('company_id')
          .equals(companyId)
          .filter(c => c.active && !c.deleted_at)
          .sortBy('sort_order');
        setCategories(cats);

        // Auto-add first cost item if none exist
        if (costItems.length === 0 && cats.length > 0) {
          addCostItem();
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };

    loadCategories();
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
        setInvoiceDate(new Date(invoice.invoice_date).toISOString().split('T')[0]);
        setVendorName(invoice.vendor_name || '');
        setNotes(invoice.notes || '');
        setTotalInvoiceAmount(invoice.total_paid || '');

        // Populate cost items from cost_attribution
        const items: CostAttributionItem[] = Object.entries(invoice.cost_attribution || {}).map(([key, item]) => ({
          id: key,
          category_id: item.category_id,
          variant: item.variant || null,
          description: item.description || '',
          units_purchased: item.units_purchased,
          unit_price: item.unit_price,
          units_received: item.units_received || item.units_purchased,
          manual_line_total: undefined, // Don't preserve manual overrides in edit mode
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
        unit_price: '',
        units_received: '',
      },
    ]);
  };

  const removeCostItem = (id: string) => {
    setCostItems(prev => prev.filter(item => item.id !== id));
  };

  const updateCostItem = (id: string, field: keyof CostAttributionItem, value: string | null) => {
    setCostItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          // Auto-fill units_received when units_purchased changes
          // Update if: empty, or was previously synced with units_purchased
          if (field === 'units_purchased') {
            if (!item.units_received || item.units_received === item.units_purchased) {
              updated.units_received = value as string;
            }
          }
          return updated;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!companyId) {
      setErrors({ form: 'Not authenticated' });
      return;
    }

    if (!totalInvoiceAmount || parseFloat(totalInvoiceAmount) <= 0) {
      setErrors({ form: 'Please enter a total invoice amount' });
      return;
    }

    // Filter out empty cost items (items with no data entered)
    const filledCostItems = costItems.filter(item =>
      item.category_id || item.units_purchased || item.unit_price
    );

    if (filledCostItems.length === 0) {
      setErrors({ form: 'Please add at least one cost item' });
      return;
    }

    // Check balance validation (±$0.01 tolerance)
    const balanceDiff = Math.abs(remaining);
    if (balanceDiff > 0.01) {
      setErrors({
        form: `Line items ($${lineItemsTotal.toFixed(2)}) don't match invoice total ($${invoiceTotal.toFixed(2)}). Remaining: $${remaining.toFixed(2)}`
      });
      return;
    }

    // Build cost attribution object
    const costAttribution: Record<string, any> = {};
    let hasErrors = false;

    filledCostItems.forEach((item, index) => {
      if (!item.category_id) {
        setErrors(prev => ({ ...prev, [`item_${index}_category`]: 'Category required' }));
        hasErrors = true;
        return;
      }
      if (!item.units_purchased || parseFloat(item.units_purchased) <= 0) {
        setErrors(prev => ({ ...prev, [`item_${index}_units`]: 'Units purchased required' }));
        hasErrors = true;
        return;
      }
      if (!item.unit_price || parseFloat(item.unit_price) <= 0) {
        setErrors(prev => ({ ...prev, [`item_${index}_price`]: 'Unit price required' }));
        hasErrors = true;
        return;
      }

      const category = getCategory(item.category_id);
      if (!category) return;

      const key = item.variant
        ? `${category.name.replace(/[^a-zA-Z0-9]/g, '')}_${item.variant.replace(/[^a-zA-Z0-9]/g, '')}`
        : category.name.replace(/[^a-zA-Z0-9]/g, '');

      costAttribution[key] = {
        category_id: item.category_id,
        variant: item.variant,
        description: item.description || undefined,
        units_purchased: item.units_purchased,
        unit_price: item.unit_price,
        units_received: item.units_received || item.units_purchased,
        manual_line_total: item.manual_line_total || undefined,
      };
    });

    if (hasErrors) return;

    // Save to database using cpuCalculatorService (which calculates CPUs)
    setIsSubmitting(true);
    try {
      if (isEditMode && invoiceId) {
        // Update existing invoice
        const { totalPaid, calculatedCPUs } = cpuCalculatorService.calculateInvoiceCPUs(
          costAttribution,
          null
        );

        await db.cpgInvoices.update(invoiceId, {
          invoice_date: new Date(invoiceDate).getTime(),
          invoice_number: invoiceNumber || undefined,
          vendor_name: vendorName || undefined,
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
          invoice_date: new Date(invoiceDate).getTime(),
          invoice_number: invoiceNumber || undefined,
          vendor_name: vendorName || undefined,
          notes: notes || undefined,
          cost_attribution: costAttribution,
          device_id: deviceId || 'default',
        });
      }

      // Dispatch CustomEvent on successful save
      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'invoice' } }));

      // Reset form and close
      resetForm();
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} invoice:`, error);
      setErrors({ form: `Failed to ${isEditMode ? 'update' : 'save'} invoice. Please try again.` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setVendorName('');
    setNotes('');
    setTotalInvoiceAmount('');
    setCostItems([]);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? 'Edit Raw Material Purchase' : 'Enter Raw Material Purchases'}
      size="xl"
      closeOnBackdropClick={false}
      footer={
        <div className={styles.modalFooter}>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting || isLoadingInvoice}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || isLoadingInvoice}>
            {isSubmitting ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Invoice' : 'Add Invoice')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9375rem' }}>
          Track ingredients and packaging you buy to make your products
        </div>

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

        <Input
          label="Total Invoice Amount"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={totalInvoiceAmount}
          onChange={(e) => setTotalInvoiceAmount(e.target.value)}
          iconBefore="$"
          required
          fullWidth
        />

        <div className={styles.feeRow}>
          <Input
            label="Invoice Number (Optional)"
            placeholder="ex: INV-001"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            fullWidth
          />
          <Input
            label="Invoice Date"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            required
            fullWidth
          />
        </div>

        <Input
          label="Vendor Name (Optional)"
          placeholder="ex: ABC Supplies"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          fullWidth
        />

        <div className={styles.costAttributionSection}>
          <div className={styles.sectionHeader}>Cost Attribution</div>

          {costItems.map((item, index) => {
            const category = getCategory(item.category_id);
            const hasVariants = category && category.variants && category.variants.length > 0;

            return (
              <div key={item.id} className={styles.categoryRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className={styles.categoryHeader}>Item {index + 1}</div>
                  {costItems.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeCostItem(item.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>

                <Input
                  label="Description (Optional)"
                  placeholder="ex: Bulk lavender oil from ABC Supplier"
                  value={item.description}
                  onChange={(e) => updateCostItem(item.id, 'description', e.target.value)}
                  fullWidth
                />

                <div className={styles.feeRow}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                      Category *
                    </label>
                    <select
                      value={item.category_id}
                      onChange={(e) => {
                        updateCostItem(item.id, 'category_id', e.target.value);
                        updateCostItem(item.id, 'variant', null); // Reset variant when category changes
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '0.9375rem',
                      }}
                      required
                    >
                      <option value="">Select category...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {hasVariants && (
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                        Variant
                      </label>
                      <select
                        value={item.variant || ''}
                        onChange={(e) => updateCostItem(item.id, 'variant', e.target.value || null)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '0.9375rem',
                        }}
                      >
                        <option value="">No variant</option>
                        {category?.variants?.map(variant => (
                          <option key={variant} value={variant}>
                            {variant}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className={styles.variantInputs}>
                  <Input
                    label="Units Purchased"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={item.units_purchased}
                    onChange={(e) => updateCostItem(item.id, 'units_purchased', e.target.value)}
                    onBlur={(e) => {
                      // Normalize decimal format
                      const val = e.target.value.trim();
                      if (val && !isNaN(parseFloat(val))) {
                        const normalized = parseFloat(val).toString();
                        if (normalized !== val) {
                          updateCostItem(item.id, 'units_purchased', normalized);
                        }
                      }
                    }}
                    error={errors[`item_${index}_units`]}
                    required
                    fullWidth
                  />
                  <Input
                    label="Unit Price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={item.unit_price}
                    onChange={(e) => updateCostItem(item.id, 'unit_price', e.target.value)}
                    onBlur={(e) => {
                      // Normalize decimal format (e.g., ".5" becomes "0.5", "-.2" becomes "-0.2")
                      const val = e.target.value.trim();
                      if (val && !isNaN(parseFloat(val))) {
                        const normalized = parseFloat(val).toString();
                        if (normalized !== val) {
                          updateCostItem(item.id, 'unit_price', normalized);
                        }
                      }
                    }}
                    error={errors[`item_${index}_price`]}
                    iconBefore="$"
                    helperText="Enter price per unit (e.g., 3.50 for $3.50)"
                    required
                    fullWidth
                  />
                  <Input
                    label="Units Received (Optional)"
                    type="number"
                    step="0.01"
                    placeholder="Same as purchased"
                    value={item.units_received}
                    onChange={(e) => updateCostItem(item.id, 'units_received', e.target.value)}
                    helperText="For reconciliation"
                    fullWidth
                  />
                </div>

                {/* Line subtotal with optional manual override */}
                {item.units_purchased && item.unit_price && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontSize: '0.9375rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontWeight: 500 }}>Calculated Total:</span>
                      <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.9375rem' }}>
                        ${(parseFloat(item.units_purchased) * parseFloat(item.unit_price)).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Actual Total (if different):</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Leave blank if exact"
                        value={item.manual_line_total || ''}
                        onChange={(e) => updateCostItem(item.id, 'manual_line_total', e.target.value || undefined)}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val && !isNaN(parseFloat(val))) {
                            const normalized = parseFloat(val).toFixed(2);
                            if (normalized !== val) {
                              updateCostItem(item.id, 'manual_line_total', normalized);
                            }
                          }
                        }}
                        iconBefore="$"
                        fullWidth
                        style={{ maxWidth: '150px' }}
                      />
                    </div>
                    {item.manual_line_total && parseFloat(item.manual_line_total) > 0 && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid #e2e8f0'
                      }}>
                        <span style={{ color: '#0f172a', fontWeight: 600 }}>Line Total:</span>
                        <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '1rem' }}>
                          ${parseFloat(item.manual_line_total).toFixed(2)}
                        </span>
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
              variant="outline"
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

        {costItems.length > 0 && totalInvoiceAmount && (
          <div className={styles.exampleBox}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Invoice Total:</span>
                <strong>${invoiceTotal.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Line Items:</span>
                <strong>${lineItemsTotal.toFixed(2)}</strong>
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
  );
}
