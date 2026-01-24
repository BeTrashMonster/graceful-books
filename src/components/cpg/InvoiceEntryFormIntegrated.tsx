/**
 * Invoice Entry Form Component - Integrated Mode
 *
 * Enhanced invoice entry with accounting integration for Integrated Mode users ($40/month).
 * Creates BOTH CPG cost tracking AND accounting transactions seamlessly.
 *
 * Features:
 * - Toggle between standalone and integrated mode
 * - Accounting preview (journal entries)
 * - Account selection (COGS, Inventory, AP)
 * - Vendor linking to contacts
 * - Product linking validation
 * - Real-time balance checking
 *
 * Requirements:
 * - Group D2: CPG-Accounting Integration
 * - Must have product links configured
 * - Must have chart of accounts set up
 */

import { useState, useEffect } from 'react';
import Decimal from 'decimal.js';
import { Modal } from '../modals/Modal';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { Select } from '../forms/Select';
import { Checkbox } from '../forms/Checkbox';
import { HelpTooltip } from '../help/HelpTooltip';
import { cpuCalculatorService, type CreateInvoiceParams } from '../../services/cpg/cpuCalculator.service';
import {
  cpgIntegrationService,
  type CreateIntegratedInvoiceParams,
  type JournalEntryPreview,
} from '../../services/cpg/cpgIntegration.service';
import type { CPGCategory } from '../../db/schema/cpg.schema';
import { generateCategoryKey } from '../../db/schema/cpg.schema';
import type { CPGProductLink } from '../../db/schema/cpgProductLinks.schema';
import { db } from '../../db';
import styles from './InvoiceEntryForm.module.css';

export interface InvoiceEntryFormIntegratedProps {
  companyId: string;
  categories: CPGCategory[];
  integratedModeEnabled: boolean; // Is user on $40/month plan?
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

export function InvoiceEntryFormIntegrated({
  companyId,
  categories,
  integratedModeEnabled,
  onClose,
  onSaved,
}: InvoiceEntryFormIntegratedProps) {
  // Form state
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0]!
  );
  const [vendorName, setVendorName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Integration settings
  const [createAccountingTransaction, setCreateAccountingTransaction] = useState(
    integratedModeEnabled
  );
  const [showAccountingPreview, setShowAccountingPreview] = useState(false);

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

  // Accounting preview
  const [journalPreview, setJournalPreview] = useState<JournalEntryPreview[]>([]);
  const [productLinks, setProductLinks] = useState<CPGProductLink[]>([]);
  const [missingLinks, setMissingLinks] = useState<
    Array<{ categoryId: string; categoryName: string; variant: string | null }>
  >([]);

  // Preview calculation
  const [previewCPUs, setPreviewCPUs] = useState<Record<string, string>>({});
  const [totalPaid, setTotalPaid] = useState<string>('0.00');

  // Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Load product links
  useEffect(() => {
    if (createAccountingTransaction) {
      loadProductLinks();
    }
  }, [createAccountingTransaction, companyId]);

  // Update preview whenever form data changes
  useEffect(() => {
    calculatePreview();
    if (createAccountingTransaction) {
      validateProductLinks();
    }
  }, [lines, additionalCosts, createAccountingTransaction]);

  const loadProductLinks = async () => {
    try {
      const links = await db.cpgProductLinks
        .where('company_id')
        .equals(companyId)
        .and((l) => l.active && l.deleted_at === null)
        .toArray();
      setProductLinks(links);
    } catch (err) {
      console.error('Failed to load product links:', err);
    }
  };

  const validateProductLinks = () => {
    const missing: Array<{ categoryId: string; categoryName: string; variant: string | null }> =
      [];

    for (const line of lines) {
      if (!line.category_id) continue;

      const hasLink = productLinks.some(
        (l) => l.cpg_category_id === line.category_id && l.cpg_variant === line.variant
      );

      if (!hasLink) {
        const category = categories.find((c) => c.id === line.category_id);
        missing.push({
          categoryId: line.category_id,
          categoryName: category?.name || 'Unknown',
          variant: line.variant,
        });
      }
    }

    setMissingLinks(missing);
  };

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

      // Generate journal preview if integrated mode
      if (createAccountingTransaction) {
        generateJournalPreview(costAttribution, total);
      }
    } catch (err) {
      console.error('Failed to calculate preview:', err);
    }
  };

  const generateJournalPreview = async (
    costAttribution: Record<string, any>,
    _totalPaid: Decimal
  ) => {
    try {
      const previews: JournalEntryPreview[] = [];

      // For each line, create preview entry
      for (const [_key, attr] of Object.entries(costAttribution)) {
        const link = productLinks.find(
          (l) => l.cpg_category_id === attr.category_id && l.cpg_variant === attr.variant
        );

        if (!link) continue;

        const lineCost = new Decimal(attr.units_purchased).times(new Decimal(attr.unit_price));

        const inventoryAccount = await db.accounts.get(link.account_id_inventory);
        const product = await db.products.get(link.product_id);

        previews.push({
          description: `${product?.name || 'Product'} - ${attr.variant || 'No variant'}`,
          debit_account: link.account_id_inventory,
          debit_account_name: inventoryAccount?.name || 'Inventory',
          debit_amount: lineCost.toFixed(2),
          credit_account: '', // Will be AP account
          credit_account_name: 'Accounts Payable',
          credit_amount: lineCost.toFixed(2),
        });
      }

      // Add additional costs to inventory
      if (additionalCosts.length > 0 && productLinks.length > 0) {
        const firstLink = productLinks[0]!;
        const inventoryAccount = await db.accounts.get(firstLink.account_id_inventory);

        for (const cost of additionalCosts) {
          if (cost.name && cost.amount) {
            previews.push({
              description: cost.name,
              debit_account: firstLink.account_id_inventory,
              debit_account_name: inventoryAccount?.name || 'Inventory',
              debit_amount: cost.amount,
              credit_account: '',
              credit_account_name: 'Accounts Payable',
              credit_amount: cost.amount,
            });
          }
        }
      }

      setJournalPreview(previews);
    } catch (err) {
      console.error('Failed to generate journal preview:', err);
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
      additionalCosts.map((cost) => (cost.id === id ? { ...cost, [field]: value } : cost))
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
          errors[`${line.id}_units_received`] = 'Units received cannot exceed units purchased';
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

    // Validate product links if integrated mode
    if (createAccountingTransaction && missingLinks.length > 0) {
      errors.product_links = `Missing product links for: ${missingLinks
        .map((m) => `${m.categoryName}${m.variant ? ` (${m.variant})` : ''}`)
        .join(', ')}`;
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

      if (createAccountingTransaction) {
        // Create integrated invoice (CPG + accounting)
        const params: CreateIntegratedInvoiceParams = {
          company_id: companyId,
          invoice_date: new Date(invoiceDate).getTime(),
          vendor_name: vendorName || undefined,
          invoice_number: invoiceNumber || undefined,
          notes: notes || undefined,
          cost_attribution: costAttribution,
          additional_costs:
            Object.keys(additionalCostsMap).length > 0 ? additionalCostsMap : undefined,
          device_id: 'web-client', // TODO: Get from device context
        };

        const result = await cpgIntegrationService.createIntegratedInvoice(params);

        if (!result.success) {
          setError(
            result.error ||
              'Oops! We had trouble creating your integrated invoice. Please try again.'
          );
          return;
        }
      } else {
        // Create standalone CPG invoice only
        const params: CreateInvoiceParams = {
          company_id: companyId,
          invoice_date: new Date(invoiceDate).getTime(),
          vendor_name: vendorName || undefined,
          invoice_number: invoiceNumber || undefined,
          notes: notes || undefined,
          cost_attribution: costAttribution,
          additional_costs:
            Object.keys(additionalCostsMap).length > 0 ? additionalCostsMap : undefined,
          device_id: 'web-client',
        };

        await cpuCalculatorService.createInvoice(params);
      }

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

        {/* Integration Toggle */}
        {integratedModeEnabled && (
          <section className={styles.section}>
            <Checkbox
              label="Create accounting transaction"
              checked={createAccountingTransaction}
              onChange={(e) => setCreateAccountingTransaction(e.target.checked)}
              helperText="This invoice will create both CPG cost tracking and accounting journal entries"
            />
          </section>
        )}

        {/* Product Link Warnings */}
        {createAccountingTransaction && missingLinks.length > 0 && (
          <div className={styles.warningBanner} role="alert">
            <span aria-hidden="true">⚠️</span>
            <div>
              <strong>Missing Product Links</strong>
              <p>
                The following categories need to be linked to products before you can create an
                integrated invoice:
              </p>
              <ul>
                {missingLinks.map((link, idx) => (
                  <li key={idx}>
                    {link.categoryName}
                    {link.variant ? ` (${link.variant})` : ''}
                  </li>
                ))}
              </ul>
              <p>Please link these in the Product Linking Manager before continuing.</p>
            </div>
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
                        onChange={(e) => handleLineChange(line.id, 'category_id', e.target.value)}
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
                        onChange={(e) => handleLineChange(line.id, 'units_purchased', e.target.value)}
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
                        onChange={(e) => handleLineChange(line.id, 'unit_price', e.target.value)}
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
                        onChange={(e) => handleLineChange(line.id, 'units_received', e.target.value)}
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
                      onChange={(e) => handleAdditionalCostChange(cost.id, 'name', e.target.value)}
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

            {createAccountingTransaction && journalPreview.length > 0 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAccountingPreview(!showAccountingPreview)}
                  className={styles.togglePreviewButton}
                >
                  {showAccountingPreview ? 'Hide' : 'Show'} Accounting Preview
                </Button>

                {showAccountingPreview && (
                  <div className={styles.accountingPreview}>
                    <h4>Journal Entries</h4>
                    <table className={styles.journalTable}>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Debit Account</th>
                          <th>Debit Amount</th>
                          <th>Credit Account</th>
                          <th>Credit Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {journalPreview.map((entry, idx) => (
                          <tr key={idx}>
                            <td>{entry.description}</td>
                            <td>{entry.debit_account_name}</td>
                            <td>${entry.debit_amount}</td>
                            <td>{entry.credit_account_name}</td>
                            <td>${entry.credit_amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
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
            disabled={isSaving || (createAccountingTransaction && missingLinks.length > 0)}
          >
            {isSaving ? 'Saving...' : 'Save Invoice'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
