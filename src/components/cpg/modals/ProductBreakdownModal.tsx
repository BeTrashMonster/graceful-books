/**
 * Product Breakdown Modal - Master-Detail Hybrid Design
 *
 * Shows the complete cost breakdown for a finished product using a hybrid approach:
 * - LEFT PANEL: Master list of all components (scrollable, handles 20+ items)
 * - RIGHT PANEL: Detailed breakdown of selected component with invoice table
 * - SLIDE-OVER: Invoice details panel slides in from right
 *
 * This design eliminates modal stacking and provides clear navigation with context preservation.
 */

import { useState, useEffect } from 'react';
import { Modal } from '../../modals/Modal';
import { Button } from '../../core/Button';
import { HelpTooltip } from '../../help/HelpTooltip';
import { db } from '../../../db/database';
import { InvoiceDetailsModal } from './InvoiceDetailsModal';
import { AddInvoiceModal } from './AddInvoiceModal';
import { VendorDetailsModal } from './VendorDetailsModal';
import type { CPGInvoice } from '../../../db/schema/cpg.schema';
import styles from './CPGModals.module.css';

export interface ProductBreakdownComponent {
  categoryId?: string;
  categoryName: string;
  variant: string | null;
  quantity: number;
  unitOfMeasure: string;
  subtotal: string | null;
  hasCostData: boolean;
}

export interface ProductBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  totalCPU: string | null;
  isComplete: boolean;
  breakdown: ProductBreakdownComponent[];
  missingComponents: string[];
  msrp?: number | null;
  onComponentClick?: (categoryId: string, variant: string | null) => void;
  dateRange?: { start: string; end: string };
  companyName?: string;
  companyId: string;
  onNavigateToVendorIntel?: (vendorName: string) => void;
  bundleStructure?: {
    products: Array<{
      productId: string;
      productName: string;
      productSku: string | null;
      quantity: number;
      breakdown: Array<{
        categoryName: string;
        categoryId: string;
        variant: string | null;
        quantity: string;
        unitOfMeasure: string;
        unitCost: string | null;
        subtotal: string | null;
        hasCostData: boolean;
      }>;
    }>;
  };
}

interface InvoiceContribution {
  invoice: CPGInvoice;
  unitsPurchased: number;
  unitPrice: number;
  unitsReceived: number;
  totalCost: number;
  hasManualOverride: boolean;
  calculatedTotal: number;
}

export function ProductBreakdownModal({
  isOpen,
  onClose,
  productName,
  totalCPU,
  isComplete,
  breakdown,
  missingComponents,
  msrp,
  onComponentClick,
  dateRange,
  companyName = 'Your Company',
  companyId,
  onNavigateToVendorIntel,
  bundleStructure,
}: ProductBreakdownModalProps) {
  const [selectedComponent, setSelectedComponent] = useState<ProductBreakdownComponent | null>(null);
  const [contributions, setContributions] = useState<InvoiceContribution[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showEditInvoice, setShowEditInvoice] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [showVendorDetails, setShowVendorDetails] = useState(false);
  const [selectedVendorName, setSelectedVendorName] = useState<string | null>(null);

  // Select first component by default when modal opens
  useEffect(() => {
    if (isOpen && breakdown.length > 0 && !selectedComponent) {
      setSelectedComponent(breakdown[0]);
    }
  }, [isOpen, breakdown]);

  // Load invoice contributions when component is selected
  useEffect(() => {
    if (!selectedComponent || !selectedComponent.categoryId) return;

    const loadContributions = async () => {
      setIsLoadingDetails(true);
      try {
        // Calculate date range: last 365 days
        const now = Date.now();
        const last365Days = now - 365 * 24 * 60 * 60 * 1000;

        const invoices = await db.cpgInvoices
          .where('company_id')
          .equals(companyId)
          .filter(inv =>
            inv.active &&
            inv.deleted_at === null &&
            inv.invoice_date >= last365Days &&
            inv.invoice_date <= now
          )
          .toArray();

        const relevantContributions: InvoiceContribution[] = [];

        for (const invoice of invoices) {
          if (!invoice.cost_attribution) continue;

          for (const [key, item] of Object.entries(invoice.cost_attribution)) {
            if (item.category_id === selectedComponent.categoryId) {
              const itemVariant = item.variant || null;
              if (itemVariant === selectedComponent.variant) {
                const calculatedTotal = parseFloat(item.units_purchased) * parseFloat(item.unit_price);
                const hasManualOverride = !!item.manual_line_total;
                const totalCost = hasManualOverride ? parseFloat(item.manual_line_total!) : calculatedTotal;

                relevantContributions.push({
                  invoice,
                  unitsPurchased: parseFloat(item.units_purchased),
                  unitPrice: parseFloat(item.unit_price),
                  unitsReceived: parseFloat(item.units_received || item.units_purchased),
                  totalCost,
                  hasManualOverride,
                  calculatedTotal,
                });
              }
            }
          }
        }

        relevantContributions.sort((a, b) => b.invoice.invoice_date - a.invoice.invoice_date);
        setContributions(relevantContributions);
      } catch (error) {
        console.error('Failed to load contributions:', error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    loadContributions();
  }, [selectedComponent, companyId]);

  const formatCurrency = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const totalUnits = contributions.reduce((sum, c) => sum + c.unitsReceived, 0);
  const totalCost = contributions.reduce((sum, c) => sum + c.totalCost, 0);
  const costPerUnit = totalUnits > 0 ? totalCost / totalUnits : 0;

  const handleEditInvoice = (invoiceId: string) => {
    setShowInvoiceDetails(false);
    setEditingInvoiceId(invoiceId);
    setShowEditInvoice(true);
  };

  const handleInvoiceSaved = () => {
    setShowEditInvoice(false);
    setEditingInvoiceId(null);
    // Reload contributions for current component
    if (selectedComponent && selectedComponent.categoryId) {
      const loadContributions = async () => {
        setIsLoadingDetails(true);
        try {
          // Calculate date range: last 365 days
          const now = Date.now();
          const last365Days = now - 365 * 24 * 60 * 60 * 1000;

          const invoices = await db.cpgInvoices
            .where('company_id')
            .equals(companyId)
            .filter(inv =>
              inv.active &&
              inv.deleted_at === null &&
              inv.invoice_date >= last365Days &&
              inv.invoice_date <= now
            )
            .toArray();

          const relevantContributions: InvoiceContribution[] = [];

          for (const invoice of invoices) {
            if (!invoice.cost_attribution) continue;

            for (const [key, item] of Object.entries(invoice.cost_attribution)) {
              if (item.category_id === selectedComponent.categoryId) {
                const itemVariant = item.variant || null;
                if (itemVariant === selectedComponent.variant) {
                  const calculatedTotal = parseFloat(item.units_purchased) * parseFloat(item.unit_price);
                  const hasManualOverride = !!item.manual_line_total;
                  const totalCost = hasManualOverride ? parseFloat(item.manual_line_total!) : calculatedTotal;

                  relevantContributions.push({
                    invoice,
                    unitsPurchased: parseFloat(item.units_purchased),
                    unitPrice: parseFloat(item.unit_price),
                    unitsReceived: parseFloat(item.units_received || item.units_purchased),
                    totalCost,
                    hasManualOverride,
                    calculatedTotal,
                  });
                }
              }
            }
          }

          relevantContributions.sort((a, b) => b.invoice.invoice_date - a.invoice.invoice_date);
          setContributions(relevantContributions);
        } catch (error) {
          console.error('Failed to reload contributions:', error);
        } finally {
          setIsLoadingDetails(false);
        }
      };

      loadContributions();
    }
    // Trigger refresh of parent component data
    window.dispatchEvent(new Event('cpg-data-updated'));
  };

  const msrpNumber = msrp ? (typeof msrp === 'number' ? msrp : parseFloat(msrp as any)) : null;

  const formatDateRange = () => {
    if (!dateRange) return 'All invoices to date';
    const startDate = new Date(dateRange.start).toLocaleDateString();
    const endDate = new Date(dateRange.end).toLocaleDateString();
    return `${startDate} - ${endDate}`;
  };

  const formatDateForFilename = () => {
    return new Date().toISOString().split('T')[0];
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportCSVSummary = (filename: string) => {
    const rows = [
      ['Product Cost Breakdown'],
      ['Data Period', formatDateRange()],
      [''],
      ['Product', productName],
      ['Total Cost', isComplete && totalCPU ? `$${totalCPU}` : 'Incomplete'],
      ...(msrpNumber ? [['MSRP', `$${msrpNumber.toFixed(2)}`]] : []),
      ...(isComplete && totalCPU && msrpNumber ? [['Gross Margin', `${((((msrpNumber - parseFloat(totalCPU)) / msrpNumber) * 100)).toFixed(1)}%`]] : []),
      [''],
      ['Categories', 'Variants', 'Quantity', 'Units', 'Unit Cost', 'Total Cost'],
      ...breakdown.map(c => {
        const quantity = parseFloat(c.quantity);
        const unitCost = c.unitCost ? parseFloat(c.unitCost) : null;

        return [
          c.categoryName,
          c.variant || '',
          quantity.toString(),
          c.unitOfMeasure,
          unitCost ? `$${unitCost.toFixed(4)}` : 'Awaiting data',
          c.subtotal ? `$${c.subtotal}` : 'Awaiting data'
        ];
      })
    ];

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    downloadFile(csv, `${filename}.csv`, 'text/csv');
  };

  const exportPDFSummary = (filename: string) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${productName} - Cost Breakdown</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #4b006e; border-bottom: 3px solid #4b006e; padding-bottom: 10px; }
            .summary { background: #E5F6DF; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #c8e1ba; }
            .summary-row:last-child { border-bottom: none; }
            .label { font-weight: 600; color: #374151; }
            .value { color: #1f2937; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f9fafb; padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600; }
            td { padding: 12px; border-bottom: 1px solid #f3f4f6; }
            .cost-complete { color: #10b981; font-weight: 600; }
            .cost-incomplete { color: #f59e0b; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
            @media print { @page { margin: 0.5in; } }
          </style>
        </head>
        <body>
          <h1>${productName} - Manufacturing Cost Breakdown</h1>
          <p style="color: #6b7280;">Data Period: ${formatDateRange()}</p>

          <div class="summary">
            <div class="summary-row">
              <span class="label">Product Name</span>
              <span class="value">${productName}</span>
            </div>
            <div class="summary-row">
              <span class="label">Total Manufacturing Cost</span>
              <span class="value ${isComplete ? 'cost-complete' : 'cost-incomplete'}">
                ${isComplete && totalCPU ? `$${totalCPU}` : 'Incomplete - Missing Cost Data'}
              </span>
            </div>
            ${msrpNumber ? `
              <div class="summary-row">
                <span class="label">MSRP</span>
                <span class="value">$${msrpNumber.toFixed(2)}</span>
              </div>
            ` : ''}
            ${isComplete && totalCPU && msrpNumber ? `
              <div class="summary-row">
                <span class="label">Gross Margin</span>
                <span class="value">${((((msrpNumber - parseFloat(totalCPU)) / msrpNumber) * 100)).toFixed(1)}%</span>
              </div>
            ` : ''}
          </div>

          <h2 style="color: #4b006e; margin-top: 30px;">Categories</h2>
          <table>
            <thead>
              <tr>
                <th>Categories</th>
                <th>Quantity</th>
                <th>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              ${breakdown.map(c => `
                <tr>
                  <td>${c.categoryName}${c.variant ? ` (${c.variant})` : ''}</td>
                  <td>${c.quantity} ${c.unitOfMeasure}</td>
                  <td class="${c.hasCostData ? 'cost-complete' : 'cost-incomplete'}">
                    ${c.subtotal ? `$${c.subtotal}` : 'Awaiting data'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            ${companyName} - Product Cost Analysis
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.document.title = `${productName} - Cost Breakdown`;
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const exportCSVDataTable = async (filename: string) => {
    const invoices = await db.cpgInvoices
      .where('company_id')
      .equals(companyId)
      .filter(inv => !inv.deleted_at)
      .toArray();

    const rows: string[][] = [
      ['Product Cost Data Table - Detailed Invoice Breakdown'],
      ['Product Name', productName],
      ['Data Period', formatDateRange()],
      ['Total Product Cost', isComplete && totalCPU ? `${totalCPU}` : 'Incomplete'],
      ...(msrpNumber ? [['MSRP', `${msrpNumber.toFixed(2)}`]] : []),
      [''],
    ];

    for (const component of breakdown) {
      const invoiceData: Array<{
        date: string;
        invoiceNum: string;
        vendor: string;
        unitsPurchased: number;
        unitsReceived: number;
        unitPrice: number;
        lineTotal: number;
      }> = [];

      for (const invoice of invoices) {
        if (!invoice.cost_attribution) continue;

        for (const [key, attr] of Object.entries(invoice.cost_attribution)) {
          if (attr.category_id === component.categoryId) {
            const variantMatches =
              (attr.variant === null && component.variant === null) ||
              (attr.variant === component.variant);

            if (variantMatches) {
              const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString();
              const unitPrice = parseFloat(attr.unit_price);
              const unitsPurchased = parseFloat(attr.units_purchased);
              const unitsReceived = parseFloat(attr.units_received || attr.units_purchased);

              let lineTotal: number;
              if (attr.manual_line_total) {
                const manualTotal = parseFloat(attr.manual_line_total);
                if (!isNaN(manualTotal) && manualTotal > 0) {
                  lineTotal = manualTotal;
                } else {
                  lineTotal = unitPrice * unitsPurchased;
                }
              } else {
                lineTotal = unitPrice * unitsPurchased;
              }

              invoiceData.push({
                date: invoiceDate,
                invoiceNum: invoice.invoice_number || 'N/A',
                vendor: invoice.vendor_name || 'N/A',
                unitsPurchased,
                unitsReceived,
                unitPrice,
                lineTotal
              });
            }
          }
        }
      }

      rows.push(['']);
      rows.push([`COMPONENT: ${component.categoryName}${component.variant ? ` (${component.variant})` : ''}`]);
      rows.push(['Quantity Needed for This Product', component.quantity.toString(), component.unitOfMeasure]);
      rows.push(['']);

      if (invoiceData.length > 0) {
        rows.push(['Invoice Purchases:']);
        rows.push(['Invoice Date', 'Invoice Number', 'Vendor', 'Units Purchased', 'Units Received', 'Unit Price', 'Invoice Line Total']);

        let totalUnitsReceived = 0;
        let totalCost = 0;

        for (const inv of invoiceData) {
          rows.push([
            inv.date,
            inv.invoiceNum,
            inv.vendor,
            inv.unitsPurchased.toString(),
            inv.unitsReceived.toString(),
            `$${inv.unitPrice.toFixed(4)}`,
            `$${inv.lineTotal.toFixed(2)}`
          ]);
          totalUnitsReceived += inv.unitsReceived;
          totalCost += inv.lineTotal;
        }

        const weightedAvgUnitCost = totalCost / totalUnitsReceived;
        const costForThisProduct = weightedAvgUnitCost * parseFloat(component.quantity.toString());

        rows.push(['']);
        rows.push(['CALCULATION:']);
        rows.push(['Total Units Received (all invoices)', totalUnitsReceived.toString()]);
        rows.push(['Total Cost (all invoices)', `$${totalCost.toFixed(2)}`]);
        rows.push(['Weighted Average Unit Cost', `$${weightedAvgUnitCost.toFixed(4)}`, `(Total Cost / Total Units = $${totalCost.toFixed(2)} / ${totalUnitsReceived})`]);
        rows.push(['Times Quantity Needed for This Product', component.quantity.toString(), component.unitOfMeasure]);
        rows.push(['Equals Cost for This Product', `$${costForThisProduct.toFixed(4)}`, `($${weightedAvgUnitCost.toFixed(4)} x ${component.quantity})`]);
      } else {
        rows.push(['Status', 'No invoice data available - enter invoices to calculate cost']);
      }
    }

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    downloadFile(csv, `${filename}.csv`, 'text/csv');
  };

  // Check if this is a bundle
  const isBundle = !!bundleStructure && bundleStructure.products.length > 0;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={productName}
        size="xl"
        closeOnBackdropClick={false}
      >
        {isBundle ? (
          // BUNDLE VIEW - Hierarchical Tree
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
            {/* Bundle Header */}
            <div style={{
              padding: '1.5rem 2rem',
              background: 'linear-gradient(135deg, #4b006e 0%, #6b1a8f 100%)',
              borderRadius: '12px',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              {/* Left: Total Cost */}
              <div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                  Bundle Total Cost
                </div>
                <div style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1 }}>
                  {isComplete && totalCPU ? `$${totalCPU}` : 'Incomplete'}
                </div>
              </div>

              {/* Right: MSRP & Margin */}
              {msrpNumber && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                    MSRP
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
                    ${msrpNumber.toFixed(2)}
                  </div>
                  {isComplete && totalCPU && (
                    <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '0.5rem' }}>
                      Margin: {((((msrpNumber - parseFloat(totalCPU)) / msrpNumber) * 100)).toFixed(1)}%
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hierarchical Tree View */}
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', marginBottom: '1rem' }}>
                Bundle Contents
              </h3>
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
              }}>
                {bundleStructure.products.map((product, productIndex) => (
                  <div
                    key={product.productId}
                    style={{
                      borderBottom: productIndex < bundleStructure.products.length - 1 ? '1px solid #e5e7eb' : 'none',
                    }}
                  >
                    {/* Product Row */}
                    <div style={{
                      padding: '1rem 1.25rem',
                      background: '#f9fafb',
                      fontWeight: 600,
                      color: '#1f2937',
                      fontSize: '0.9375rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      <span style={{ color: '#4b006e' }}>├─</span>
                      <span style={{ color: '#4b006e', fontWeight: 700 }}>{product.quantity}×</span>
                      <span>{product.productName}</span>
                      {product.productSku && (
                        <span style={{ color: '#64748b', fontWeight: 400, fontSize: '0.8125rem' }}>
                          ({product.productSku})
                        </span>
                      )}
                    </div>

                    {/* Product Components */}
                    {product.breakdown.length > 0 && (
                      <div style={{ background: 'white' }}>
                        {product.breakdown.map((component, componentIndex) => {
                          const isLastComponent = componentIndex === product.breakdown.length - 1;
                          return (
                            <div
                              key={componentIndex}
                              style={{
                                padding: '0.75rem 1.25rem 0.75rem 3rem',
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1fr',
                                gap: '1rem',
                                alignItems: 'center',
                                borderBottom: !isLastComponent ? '1px solid #f3f4f6' : 'none',
                                fontSize: '0.875rem',
                              }}
                            >
                              {/* Component Name */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: '#94a3b8' }}>{isLastComponent ? '└─' : '├─'}</span>
                                <span style={{ color: '#374151' }}>
                                  {component.categoryName}
                                  {component.variant && ` (${component.variant})`}
                                </span>
                              </div>

                              {/* Quantity */}
                              <div style={{ color: '#64748b' }}>
                                {component.quantity} {component.unitOfMeasure}
                              </div>

                              {/* Cost */}
                              <div style={{ color: component.hasCostData ? '#4b006e' : '#f59e0b', fontWeight: 600 }}>
                                {component.subtotal ? `$${component.subtotal}` : 'No data'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Aggregated Totals */}
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#4b006e' }}>└─</span>
                Total Materials Needed
              </h3>
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#faf5ff',
              }}>
                {/* Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  gap: '1rem',
                  padding: '0.75rem 1.25rem',
                  background: '#4b006e',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.025em',
                }}>
                  <div>Component</div>
                  <div>Total Quantity</div>
                  <div>Total Cost</div>
                </div>

                {/* Rows */}
                {breakdown.map((component, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr',
                      gap: '1rem',
                      padding: '0.875rem 1.25rem',
                      borderBottom: index < breakdown.length - 1 ? '1px solid #e9d5ff' : 'none',
                      fontSize: '0.9375rem',
                    }}
                  >
                    <div style={{ fontWeight: 500, color: '#1f2937' }}>
                      {component.categoryName}
                      {component.variant && ` (${component.variant})`}
                    </div>
                    <div style={{ color: '#64748b' }}>
                      {component.quantity} {component.unitOfMeasure}
                    </div>
                    <div style={{ color: component.hasCostData ? '#4b006e' : '#f59e0b', fontWeight: 600 }}>
                      {component.subtotal ? `$${component.subtotal}` : 'No data'}
                    </div>
                  </div>
                ))}

                {/* Total Row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  gap: '1rem',
                  padding: '1rem 1.25rem',
                  background: '#4b006e',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '1rem',
                  borderTop: '2px solid #6b1a8f',
                }}>
                  <div>Total Bundle Cost</div>
                  <div></div>
                  <div>{isComplete && totalCPU ? `$${totalCPU}` : 'Incomplete'}</div>
                </div>
              </div>
            </div>

            {/* Export Options */}
            <div style={{ marginTop: '1rem' }}>
              <select
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  const timestamp = formatDateForFilename();
                  const baseFilename = `${productName.replace(/\s+/g, '_')}_${timestamp}`;

                  if (value === 'csv-summary') {
                    exportCSVSummary(baseFilename);
                  } else if (value === 'pdf-summary') {
                    exportPDFSummary(baseFilename);
                  } else if (value === 'csv-detail') {
                    exportCSVDataTable(`${baseFilename}_detail`);
                  }
                  e.target.value = '';
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 2rem 0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  color: '#374151',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'border-color 150ms ease-out',
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23374151\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                }}
              >
                <option value="">Export Bundle Breakdown...</option>
                <option value="csv-summary">CSV Summary</option>
                <option value="pdf-summary">PDF Summary</option>
                <option value="csv-detail">CSV Detail Summary</option>
              </select>
            </div>
          </div>
        ) : (
          // REGULAR PRODUCT VIEW - Master-Detail
          <div style={{ display: 'flex', height: '600px', gap: '1.5rem' }}>
            {/* LEFT PANEL - Component List */}
            <div style={{
              flex: '0 0 280px',
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid #e5e7eb',
              paddingRight: '1.5rem',
            }}>
            {/* Product Summary */}
            <div style={{
              padding: '1rem',
              background: '#E5F6DF',
              border: '1px solid #c8e1ba',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Total Cost</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: isComplete ? '#10b981' : '#f59e0b' }}>
                {isComplete && totalCPU ? `$${totalCPU}` : 'Incomplete'}
              </div>
              {msrpNumber && (
                <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  MSRP: ${msrpNumber.toFixed(2)}
                </div>
              )}
            </div>

            {/* Export Button */}
            <div style={{ marginBottom: '1rem' }}>
              <select
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  const timestamp = formatDateForFilename();
                  const baseFilename = `${productName.replace(/\s+/g, '_')}_${timestamp}`;

                  if (value === 'csv-summary') {
                    exportCSVSummary(baseFilename);
                  } else if (value === 'pdf-summary') {
                    exportPDFSummary(baseFilename);
                  } else if (value === 'csv-detail') {
                    exportCSVDataTable(`${baseFilename}_detail`);
                  }
                  e.target.value = '';
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 2rem 0.5rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'border-color 150ms ease-out',
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23374151\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.5rem center',
                }}
              >
                <option value="">Export...</option>
                <option value="csv-summary">CSV Summary</option>
                <option value="pdf-summary">PDF Summary</option>
                <option value="csv-detail">CSV Detail Summary</option>
              </select>
            </div>

            {/* Component List */}
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
              Components ({breakdown.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[...breakdown].sort((a, b) => a.categoryName.localeCompare(b.categoryName)).map((component, index) => {
                const isSelected = selectedComponent?.categoryId === component.categoryId &&
                                  selectedComponent?.variant === component.variant;

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedComponent(component)}
                    style={{
                      padding: '0.75rem',
                      background: isSelected ? '#f0f4ff' : 'white',
                      border: `2px solid ${isSelected ? '#4b006e' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => !isSelected && (e.currentTarget.style.borderColor = '#d1d5db')}
                    onMouseLeave={(e) => !isSelected && (e.currentTarget.style.borderColor = '#e5e7eb')}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1f2937' }}>
                        {component.categoryName}
                      </div>
                      {component.hasCostData ? (
                        <span style={{ color: '#10b981', fontSize: '1rem' }}>✓</span>
                      ) : (
                        <span style={{ color: '#f59e0b', fontSize: '1rem' }}>⚠️</span>
                      )}
                    </div>
                    {component.variant && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                        {component.variant}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {(() => {
                        const quantity = parseFloat(component.quantity.toString());
                        const unitCost = component.subtotal && quantity > 0
                          ? parseFloat(component.subtotal) / quantity
                          : null;
                        const showUnitCost = quantity !== 1 && unitCost !== null;

                        return (
                          <>
                            {quantity.toLocaleString()} {component.unitOfMeasure}
                            {showUnitCost && ` @ $${unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4b006e', marginTop: '0.25rem' }}>
                      {component.subtotal ? `$${parseFloat(component.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Awaiting data'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANEL - Detail View */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedComponent ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
              }}>
                Select a component to view details
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
                {/* Hero Answer */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  background: 'linear-gradient(135deg, #4b006e 0%, #6b1a8f 100%)',
                  borderRadius: '12px',
                  color: 'white',
                }}>
                  {/* Component Name + Total Cost - Single Row */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ fontSize: '1rem', fontWeight: 600, opacity: 0.95 }}>
                      {selectedComponent.categoryName}{selectedComponent.variant && ` (${selectedComponent.variant})`}
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1 }}>
                      {selectedComponent.subtotal ? `$${parseFloat(selectedComponent.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </div>
                  </div>

                  {/* Recipe Details + Data Source - Single Row */}
                  {selectedComponent.hasCostData && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.875rem',
                      opacity: 0.85,
                      paddingTop: '0.75rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                    }}>
                      <div>
                        {(() => {
                          const quantity = parseFloat(selectedComponent.quantity.toString());
                          const unitCost = selectedComponent.subtotal && quantity > 0
                            ? parseFloat(selectedComponent.subtotal) / quantity
                            : null;

                          return (
                            <>
                              {quantity.toLocaleString()} {selectedComponent.unitOfMeasure}
                              {unitCost !== null && ` @ $${unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </>
                          );
                        })()}
                      </div>
                      <div style={{ fontSize: '0.8125rem', opacity: 0.75 }}>
                        {totalUnits.toLocaleString('en-US', { maximumFractionDigits: 0 })} units • {contributions.length.toLocaleString()} {contributions.length === 1 ? 'invoice' : 'invoices'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Invoice Table or No Data */}
                {isLoadingDetails ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    Loading invoice details...
                  </div>
                ) : !selectedComponent.hasCostData || contributions.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem 2rem',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    border: '2px dashed #e5e7eb',
                  }}>
                    <span style={{ fontSize: '2rem', display: 'block', marginBottom: '1rem' }}>📋</span>
                    <span style={{ color: '#64748b', fontSize: '1.125rem', display: 'block', marginBottom: '0.5rem' }}>
                      No invoices found
                    </span>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
                      Add invoices to calculate costs for this component
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Invoice Table */}
                    <div>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#374151',
                        marginBottom: '0.75rem',
                      }}>
                        Invoice Breakdown (Last 365 Days)
                      </div>
                      <div style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}>
                        {/* Table Header */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1.2fr auto',
                          gap: '1rem',
                          padding: '0.75rem 1rem',
                          background: '#f9fafb',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.025em',
                        }}>
                          <div>Vendor / Invoice</div>
                          <div>Date</div>
                          <div>Units</div>
                          <div>Cost</div>
                          <div></div>
                        </div>

                        {/* Table Rows */}
                        {contributions.map((contribution) => {
                          const hasReconciliation = contribution.unitsReceived !== contribution.unitsPurchased;
                          const contributionPercent = totalCost > 0 ? (contribution.totalCost / totalCost) * 100 : 0;

                          return (
                            <div
                              key={contribution.invoice.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1.2fr auto',
                                gap: '1rem',
                                padding: '1rem',
                                background: 'white',
                                borderBottom: '1px solid #f0f0f0',
                                alignItems: 'center',
                                transition: 'background-color 150ms',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                              {/* Vendor / Invoice Number */}
                              <div>
                                <button
                                  onClick={() => {
                                    if (contribution.invoice.vendor_name) {
                                      setSelectedVendorName(contribution.invoice.vendor_name);
                                      setShowVendorDetails(true);
                                    }
                                  }}
                                  style={{
                                    fontWeight: 600,
                                    color: contribution.invoice.vendor_name ? '#4b006e' : '#1f2937',
                                    fontSize: '0.9375rem',
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: contribution.invoice.vendor_name ? 'pointer' : 'default',
                                    textDecoration: contribution.invoice.vendor_name ? 'underline' : 'none',
                                    textDecorationStyle: 'dotted',
                                    textUnderlineOffset: '2px',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (contribution.invoice.vendor_name) {
                                      e.currentTarget.style.textDecoration = 'underline';
                                      e.currentTarget.style.textDecorationStyle = 'solid';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (contribution.invoice.vendor_name) {
                                      e.currentTarget.style.textDecoration = 'underline';
                                      e.currentTarget.style.textDecorationStyle = 'dotted';
                                    }
                                  }}
                                >
                                  {contribution.invoice.vendor_name || 'No Vendor'}
                                </button>
                                <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.125rem' }}>
                                  Invoice #{contribution.invoice.invoice_number || 'N/A'}
                                </div>
                              </div>

                              {/* Date */}
                              <div style={{ color: '#64748b', fontSize: '0.9375rem' }}>
                                {formatDate(contribution.invoice.invoice_date)}
                              </div>

                              {/* Units */}
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                                  {contribution.unitsReceived.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                </div>
                                {hasReconciliation && (
                                  <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.125rem' }}>
                                    ({(contribution.unitsPurchased - contribution.unitsReceived).toLocaleString('en-US', { maximumFractionDigits: 0 })} short)
                                  </div>
                                )}
                              </div>

                              {/* Cost with percentage bar */}
                              <div>
                                <div style={{ fontWeight: 600, color: '#4b006e', fontSize: '0.9375rem' }}>
                                  {formatCurrency(contribution.totalCost)}
                                </div>
                                <div
                                  style={{
                                    marginTop: '0.375rem',
                                    height: '4px',
                                    background: '#e5e7eb',
                                    borderRadius: '2px',
                                    overflow: 'hidden',
                                    cursor: 'help',
                                  }}
                                  title={`${contributionPercent.toFixed(1)}% of total cost`}
                                >
                                  <div style={{
                                    width: `${contributionPercent}%`,
                                    height: '100%',
                                    background: '#4b006e',
                                    transition: 'width 300ms ease-out',
                                  }} />
                                </div>
                              </div>

                              {/* View Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedInvoiceId(contribution.invoice.id);
                                  setShowInvoiceDetails(true);
                                }}
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                View
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Simple Calculation */}
                    <div style={{
                      padding: '1rem 1.25rem',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      fontSize: '0.9375rem',
                      color: '#64748b',
                    }}>
                      <strong style={{ color: '#4b006e' }}>Calculation:</strong>{' '}
                      {formatCurrency(totalCost)} total cost ÷ {totalUnits.toLocaleString('en-US', { maximumFractionDigits: 0 })} units received = {formatCurrency(costPerUnit)} per unit
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          </div>
        )}
      </Modal>

      {/* Invoice Details Slide-Over */}
      {showInvoiceDetails && selectedInvoiceId && (
        <InvoiceDetailsModal
          isOpen={showInvoiceDetails}
          onClose={() => {
            setShowInvoiceDetails(false);
            setSelectedInvoiceId(null);
          }}
          invoiceId={selectedInvoiceId}
          onEdit={handleEditInvoice}
        />
      )}

      {/* Edit Invoice Modal */}
      {showEditInvoice && editingInvoiceId && (
        <AddInvoiceModal
          isOpen={showEditInvoice}
          onClose={() => {
            setShowEditInvoice(false);
            setEditingInvoiceId(null);
          }}
          onSuccess={handleInvoiceSaved}
          invoiceId={editingInvoiceId}
        />
      )}

      {/* Vendor Details Slide-Over */}
      {showVendorDetails && selectedVendorName && (
        <VendorDetailsModal
          isOpen={showVendorDetails}
          onClose={() => {
            setShowVendorDetails(false);
            setSelectedVendorName(null);
          }}
          vendorName={selectedVendorName}
          companyId={companyId}
          onViewFullVendorIntel={onNavigateToVendorIntel}
        />
      )}
    </>
  );
}
