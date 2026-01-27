/**
 * Invoice Entry Form Component
 *
 * Line-by-line invoice entry with cost attribution to CPG categories.
 * Integrated with bookkeeping - enter once, use everywhere.
 *
 * Features:
 * - Date picker for invoice date
 * - Vendor name input
 * - Total invoice amount with balance validation
 * - Category/variant selection per line
 * - Line item descriptions
 * - Units purchased/received (reconciliation)
 * - Unit price
 * - Running balance display
 * - Real-time CPU calculation preview
 * - Smart defaults (pre-fill from last invoice)
 * - Inline help tooltips
 *
 * Requirements:
 * - Clean & seamless (not clunky)
 * - Progressive disclosure
 * - Real-time updates
 * - WCAG 2.1 AA compliance
 */

import { useState, useEffect } from 'react';
import { Modal } from '../modals/Modal';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { Select } from '../forms/Select';
import { HelpTooltip } from '../help/HelpTooltip';
import { useAuth } from '../../contexts/AuthContext';
import { cpuCalculatorService, type CreateInvoiceParams } from '../../services/cpg/cpuCalculator.service';
import type { CPGCategory } from '../../db/schema/cpg.schema';
import { generateCategoryKey } from '../../db/schema/cpg.schema';
import styles from './InvoiceEntryForm.module.css';

export interface InvoiceEntryFormProps {
  companyId: string;
  categories: CPGCategory[];
  onClose: () => void;
  onSaved: () => void;
}

interface InvoiceLine {
  id: string;
  category_id: string;
  variant: string | null;
  description: string;
  units_purchased: string;
  unit_price: string;
  units_received: string;
}

export function InvoiceEntryForm({
  companyId,
  categories,
  onClose,
  onSaved,
}: InvoiceEntryFormProps) {
  const { deviceId } = useAuth();

  // Form state
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0]!
  );
  const [vendorName, setVendorName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [totalInvoiceAmount, setTotalInvoiceAmount] = useState<string>('');

  // Line items
  const [lines, setLines] = useState<InvoiceLine[]>([
    {
      id: '1',
      category_id: '',
      variant: null,
      description: '',
      units_purchased: '',
      unit_price: '',
      units_received: '',
    },
  ]);

  // Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Calculate running balance
  const calculateLineItemsTotal = (): number => {
    return lines.reduce((sum, line) => {
      const units = parseFloat(line.units_purchased || '0');
      const price = parseFloat(line.unit_price || '0');
      return sum + (units * price);
    }, 0);
  };

  const lineItemsTotal = calculateLineItemsTotal();
  const invoiceTotal = parseFloat(totalInvoiceAmount || '0');
  const remaining = invoiceTotal - lineItemsTotal;

  const handleAddLine = () => {
    const newLine: InvoiceLine = {
      id: Date.now().toString(),
      category_id: '',
      variant: null,
      description: '',
      units_purchased: '',
      unit_price: '',
      units_received: '',
    };
    setLines([...lines, newLine]);
  };

  const handleRemoveLine = (id: string) => {
    setLines(lines.filter((line) => line.id !== id));
  };

  const handleLineChange = (id: string, field: keyof InvoiceLine, value: any) => {
    setLines(
      lines.map((line) => {
        if (line.id === id) {
          const updated = { ...line, [field]: value };
          // Auto-fill units_received when units_purchased changes
          if (field === 'units_purchased' && !line.units_received) {
            updated.units_received = value as string;
          }
          return updated;
        }
        return line;
      })
    );

    // Clear validation error for this field
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[`${id}_${field}`];
      return newErrors;
    });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Invoice date required
    if (!invoiceDate) {
      errors.invoice_date = 'Invoice date is required';
    }

    // Total invoice amount required
    if (!totalInvoiceAmount || parseFloat(totalInvoiceAmount) <= 0) {
      errors.total_invoice_amount = 'Total invoice amount is required';
    }

    // At least one line item
    if (lines.length === 0) {
      errors.lines = 'At least one line item is required';
    }

    // Check balance validation (±$0.01 tolerance)
    const balanceDiff = Math.abs(remaining);
    if (balanceDiff > 0.01 && totalInvoiceAmount) {
      errors.balance = `Line items ($${lineItemsTotal.toFixed(2)}) don't match invoice total ($${invoiceTotal.toFixed(2)}). Remaining: $${remaining.toFixed(2)}`;
    }

    // Validate each line
    for (const line of lines) {
      if (!line.category_id) {
        errors[`${line.id}_category_id`] = 'Category is required';
      }
      if (!line.units_purchased || parseFloat(line.units_purchased) <= 0) {
        errors[`${line.id}_units_purchased`] = 'Units purchased must be greater than 0';
      }
      if (!line.unit_price || parseFloat(line.unit_price) <= 0) {
        errors[`${line.id}_unit_price`] = 'Unit price must be greater than 0';
      }

      // Validate units received if provided
      if (line.units_received) {
        const received = parseFloat(line.units_received);
        const purchased = parseFloat(line.units_purchased);
        if (received < 0) {
          errors[`${line.id}_units_received`] = 'Units received cannot be negative';
        }
        if (received > purchased * 1.1) {
          // Allow 10% overage for rounding
          errors[`${line.id}_units_received`] =
            'Units received cannot exceed units purchased';
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Please fix the errors below before saving.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Build cost attribution
      const costAttribution: Record<string, any> = {};

      for (const line of lines) {
        const key = generateCategoryKey(
          categories.find((c) => c.id === line.category_id)?.name || line.category_id,
          line.variant
        );

        costAttribution[key] = {
          category_id: line.category_id,
          variant: line.variant,
          description: line.description || undefined,
          units_purchased: line.units_purchased,
          unit_price: line.unit_price,
          units_received: line.units_received || line.units_purchased,
        };
      }

      const params: CreateInvoiceParams = {
        company_id: companyId,
        invoice_date: new Date(invoiceDate).getTime(),
        vendor_name: vendorName || undefined,
        invoice_number: invoiceNumber || undefined,
        notes: notes || undefined,
        cost_attribution: costAttribution,
        device_id: deviceId || 'web-client',
      };

      await cpuCalculatorService.createInvoice(params);

      // Dispatch CustomEvent on successful save
      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'invoice' } }));

      // Success!
      onSaved();
    } catch (err) {
      console.error('Failed to save invoice:', err);
      setError(
        'Oops! We had trouble saving your invoice. Please check your entries and try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Enter Raw Material Purchases"
      closeOnBackdropClick={false}
      size="lg"
      aria-labelledby="invoice-form-title"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9375rem' }}>
          Track ingredients and packaging you buy to make your products
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert" aria-live="polite">
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {validationErrors.balance && (
          <div className={styles.errorBanner} role="alert" aria-live="polite">
            <span aria-hidden="true">⚠️</span>
            <span>{validationErrors.balance}</span>
          </div>
        )}

        {/* Total Invoice Amount */}
        <section className={styles.section}>
          <Input
            label="Total Invoice Amount"
            type="number"
            step="0.01"
            min="0"
            value={totalInvoiceAmount}
            onChange={(e) => setTotalInvoiceAmount(e.target.value)}
            placeholder="0.00"
            iconBefore={<span>$</span>}
            required
            error={validationErrors.total_invoice_amount}
            fullWidth
          />
        </section>

        {/* Invoice Header */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Invoice Details</h3>

          <div className={styles.grid2}>
            <Input
              label="Invoice Date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
              error={validationErrors.invoice_date}
              fullWidth
            />

            <Input
              label="Invoice Number"
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Optional reference"
              helperText="Your internal reference number"
              fullWidth
            />
          </div>

          <div className={styles.grid1}>
            <Input
              label="Vendor Name"
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Who did you purchase from?"
              fullWidth
            />
          </div>
        </section>

        {/* Line Items */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              Line Items
              <HelpTooltip content="Add each item from your invoice. We'll calculate the Cost Per Unit for each variant automatically." />
            </h3>
          </div>

          {validationErrors.lines && (
            <p className={styles.errorText} role="alert">
              {validationErrors.lines}
            </p>
          )}

          <div className={styles.lineItems}>
            {lines.map((line, index) => {
              const selectedCategory = categories.find((c) => c.id === line.category_id);
              const variants = selectedCategory?.variants;

              return (
                <div key={line.id} className={styles.lineItem}>
                  <div className={styles.lineHeader}>
                    <span className={styles.lineNumber}>#{index + 1}</span>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.id)}
                        className={styles.removeLineButton}
                        aria-label={`Remove line item ${index + 1}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className={styles.lineFields}>
                    <Input
                      label="Description (Optional)"
                      type="text"
                      value={line.description}
                      onChange={(e) => handleLineChange(line.id, 'description', e.target.value)}
                      placeholder="ex: Bulk lavender oil from ABC Supplier"
                      fullWidth
                    />

                    <div className={styles.grid3}>
                      <Select
                        label="Category"
                        value={line.category_id}
                        onChange={(e) =>
                          handleLineChange(line.id, 'category_id', e.target.value)
                        }
                        placeholder="Select category"
                        required
                        error={validationErrors[`${line.id}_category_id`]}
                        fullWidth
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </Select>

                      {variants && variants.length > 0 && (
                        <Select
                          label="Variant"
                          value={line.variant || ''}
                          onChange={(e) =>
                            handleLineChange(line.id, 'variant', e.target.value || null)
                          }
                          placeholder="Select variant"
                          fullWidth
                        >
                          <option value="">No variant</option>
                          {variants.map((variant) => (
                            <option key={variant} value={variant}>
                              {variant}
                            </option>
                          ))}
                        </Select>
                      )}

                      <Input
                        label="Units Purchased"
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.units_purchased}
                        onChange={(e) =>
                          handleLineChange(line.id, 'units_purchased', e.target.value)
                        }
                        placeholder="0.00"
                        required
                        error={validationErrors[`${line.id}_units_purchased`]}
                        fullWidth
                      />

                      <Input
                        label="Unit Price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.unit_price}
                        onChange={(e) =>
                          handleLineChange(line.id, 'unit_price', e.target.value)
                        }
                        placeholder="0.00"
                        iconBefore={<span>$</span>}
                        required
                        error={validationErrors[`${line.id}_unit_price`]}
                        fullWidth
                      />

                      <Input
                        label="Units Received"
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.units_received}
                        onChange={(e) =>
                          handleLineChange(line.id, 'units_received', e.target.value)
                        }
                        placeholder={line.units_purchased || '0.00'}
                        helperText="For reconciliation (defaults to purchased)"
                        error={validationErrors[`${line.id}_units_received`]}
                        fullWidth
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddLine}
            iconBefore={<span>+</span>}
          >
            Add Line Item
          </Button>
        </section>

        {/* Notes */}
        <section className={styles.section}>
          <Input
            label="Notes (Optional)"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional details about this invoice"
            fullWidth
          />
        </section>

        {/* Running Balance */}
        {lines.length > 0 && totalInvoiceAmount && (
          <section className={styles.section}>
            <div style={{
              padding: '1rem',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
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
          </section>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isSaving}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Invoice'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
