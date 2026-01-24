/**
 * Invoice Entry Form Component
 *
 * Line-by-line invoice entry with cost attribution to CPG categories.
 * Integrated with bookkeeping - enter once, use everywhere.
 *
 * Features:
 * - Date picker for invoice date
 * - Vendor name input
 * - Category/variant selection per line
 * - Units purchased/received (reconciliation)
 * - Unit price
 * - Additional costs (shipping, printing, embossing, foil)
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
import Decimal from 'decimal.js';
import { Modal } from '../modals/Modal';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { Select } from '../forms/Select';
import { HelpTooltip } from '../help/HelpTooltip';
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
  units_purchased: string;
  unit_price: string;
  units_received: string;
}

interface AdditionalCost {
  id: string;
  name: string;
  amount: string;
}

export function InvoiceEntryForm({
  companyId,
  categories,
  onClose,
  onSaved,
}: InvoiceEntryFormProps) {
  // Form state
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0]!
  );
  const [vendorName, setVendorName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Line items
  const [lines, setLines] = useState<InvoiceLine[]>([
    {
      id: '1',
      category_id: '',
      variant: null,
      units_purchased: '',
      unit_price: '',
      units_received: '',
    },
  ]);

  // Additional costs
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);
  const [showAdditionalCosts, setShowAdditionalCosts] = useState(false);

  // Preview calculation
  const [previewCPUs, setPreviewCPUs] = useState<Record<string, string>>({});
  const [totalPaid, setTotalPaid] = useState<string>('0.00');

  // Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Update preview whenever form data changes
  useEffect(() => {
    calculatePreview();
  }, [lines, additionalCosts]);

  const calculatePreview = () => {
    try {
      // Build cost attribution
      const costAttribution: Record<string, any> = {};
      let totalDirectCost = new Decimal(0);

      for (const line of lines) {
        if (!line.category_id || !line.units_purchased || !line.unit_price) {
          continue;
        }

        const key = generateCategoryKey(
          categories.find((c) => c.id === line.category_id)?.name || line.category_id,
          line.variant
        );

        const directCost = new Decimal(line.units_purchased).times(new Decimal(line.unit_price));
        totalDirectCost = totalDirectCost.plus(directCost);

        costAttribution[key] = {
          category_id: line.category_id,
          variant: line.variant,
          units_purchased: line.units_purchased,
          unit_price: line.unit_price,
          units_received: line.units_received || line.units_purchased,
        };
      }

      // Calculate total additional costs
      let totalAdditional = new Decimal(0);
      for (const cost of additionalCosts) {
        if (cost.amount) {
          totalAdditional = totalAdditional.plus(new Decimal(cost.amount));
        }
      }

      // Total paid
      const total = totalDirectCost.plus(totalAdditional);
      setTotalPaid(total.toFixed(2));

      // Calculate CPUs (proportional allocation of additional costs)
      const cpus: Record<string, string> = {};

      for (const [_key, attr] of Object.entries(costAttribution)) {
        const directCost = new Decimal(attr.units_purchased).times(new Decimal(attr.unit_price));
        const unitsReceived = new Decimal(attr.units_received);

        // Proportional share of additional costs
        let allocatedAdditional = new Decimal(0);
        if (totalDirectCost.greaterThan(0)) {
          allocatedAdditional = totalAdditional.times(directCost).dividedBy(totalDirectCost);
        }

        // CPU = (direct + allocated additional) / units received
        const cpu = directCost.plus(allocatedAdditional).dividedBy(unitsReceived);

        const variant = attr.variant || 'none';
        cpus[variant] = cpu.toFixed(2);
      }

      setPreviewCPUs(cpus);
    } catch (err) {
      console.error('Failed to calculate preview:', err);
    }
  };

  const handleAddLine = () => {
    const newLine: InvoiceLine = {
      id: Date.now().toString(),
      category_id: '',
      variant: null,
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
      lines.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]: value,
              // Auto-set units_received = units_purchased if not manually edited
              ...(field === 'units_purchased' && !line.units_received
                ? { units_received: value }
                : {}),
            }
          : line
      )
    );

    // Clear validation error for this field
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[`${id}_${field}`];
      return newErrors;
    });
  };

  const handleAddAdditionalCost = () => {
    const newCost: AdditionalCost = {
      id: Date.now().toString(),
      name: '',
      amount: '',
    };
    setAdditionalCosts([...additionalCosts, newCost]);
    setShowAdditionalCosts(true);
  };

  const handleRemoveAdditionalCost = (id: string) => {
    setAdditionalCosts(additionalCosts.filter((cost) => cost.id !== id));
  };

  const handleAdditionalCostChange = (
    id: string,
    field: 'name' | 'amount',
    value: string
  ) => {
    setAdditionalCosts(
      additionalCosts.map((cost) =>
        cost.id === id ? { ...cost, [field]: value } : cost
      )
    );
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Invoice date required
    if (!invoiceDate) {
      errors.invoice_date = 'Invoice date is required';
    }

    // At least one line item
    if (lines.length === 0) {
      errors.lines = 'At least one line item is required';
    }

    // Validate each line
    for (const line of lines) {
      if (!line.category_id) {
        errors[`${line.id}_category`] = 'Category is required';
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

    // Validate additional costs
    for (const cost of additionalCosts) {
      if (cost.name && !cost.amount) {
        errors[`${cost.id}_amount`] = 'Amount is required';
      }
      if (cost.amount && !cost.name) {
        errors[`${cost.id}_name`] = 'Cost name is required';
      }
      if (cost.amount && parseFloat(cost.amount) < 0) {
        errors[`${cost.id}_amount`] = 'Amount cannot be negative';
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
          units_purchased: line.units_purchased,
          unit_price: line.unit_price,
          units_received: line.units_received || line.units_purchased,
        };
      }

      // Build additional costs
      const additionalCostsMap: Record<string, string> = {};
      for (const cost of additionalCosts) {
        if (cost.name && cost.amount) {
          additionalCostsMap[cost.name] = cost.amount;
        }
      }

      const params: CreateInvoiceParams = {
        company_id: companyId,
        invoice_date: new Date(invoiceDate).getTime(),
        vendor_name: vendorName || undefined,
        invoice_number: invoiceNumber || undefined,
        notes: notes || undefined,
        cost_attribution: costAttribution,
        additional_costs: Object.keys(additionalCostsMap).length > 0
          ? additionalCostsMap
          : undefined,
        device_id: 'web-client', // TODO: Get from device context
      };

      await cpuCalculatorService.createInvoice(params);

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
      title="New Invoice"
      size="lg"
      aria-labelledby="invoice-form-title"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <div className={styles.errorBanner} role="alert" aria-live="polite">
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}

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
                    <div className={styles.grid3}>
                      <Select
                        label="Category"
                        value={line.category_id}
                        onChange={(e) =>
                          handleLineChange(line.id, 'category_id', e.target.value)
                        }
                        placeholder="Select category"
                        required
                        error={validationErrors[`${line.id}_category`]}
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

        {/* Additional Costs */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              Additional Costs (Optional)
              <HelpTooltip content="Costs like shipping, printing, embossing, or foil. These will be allocated proportionally across your line items." />
            </h3>
            {!showAdditionalCosts && additionalCosts.length === 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdditionalCosts(true)}
              >
                Add Additional Costs
              </Button>
            )}
          </div>

          {(showAdditionalCosts || additionalCosts.length > 0) && (
            <>
              {additionalCosts.map((cost, _index) => (
                <div key={cost.id} className={styles.additionalCost}>
                  <div className={styles.grid2}>
                    <Input
                      label="Cost Name"
                      type="text"
                      value={cost.name}
                      onChange={(e) =>
                        handleAdditionalCostChange(cost.id, 'name', e.target.value)
                      }
                      placeholder="e.g., Shipping, Printing"
                      error={validationErrors[`${cost.id}_name`]}
                      fullWidth
                    />

                    <div className={styles.costAmountRow}>
                      <Input
                        label="Amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={cost.amount}
                        onChange={(e) =>
                          handleAdditionalCostChange(cost.id, 'amount', e.target.value)
                        }
                        placeholder="0.00"
                        iconBefore={<span>$</span>}
                        error={validationErrors[`${cost.id}_amount`]}
                        fullWidth
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAdditionalCost(cost.id)}
                        className={styles.removeButton}
                        aria-label={`Remove ${cost.name || 'additional cost'}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAdditionalCost}
                iconBefore={<span>+</span>}
              >
                Add Another Cost
              </Button>
            </>
          )}
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

        {/* Preview */}
        {Object.keys(previewCPUs).length > 0 && (
          <section className={styles.preview}>
            <h3 className={styles.previewTitle}>Preview</h3>
            <div className={styles.previewContent}>
              <div className={styles.previewRow}>
                <span className={styles.previewLabel}>Total Paid:</span>
                <span className={styles.previewValue}>${totalPaid}</span>
              </div>

              {Object.entries(previewCPUs).map(([variant, cpu]) => (
                <div key={variant} className={styles.previewRow}>
                  <span className={styles.previewLabel}>
                    CPU ({variant === 'none' ? 'No variant' : variant}):
                  </span>
                  <span className={styles.previewValue}>${cpu}</span>
                </div>
              ))}
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
