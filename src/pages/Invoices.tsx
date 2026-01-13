/**
 * Invoices Page
 *
 * Main page for managing invoices with create, view, edit, send, and pay functionality
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/core/Button';
import { Input } from '../components/forms/Input';
import { Select } from '../components/forms/Select';
import { InvoiceList } from '../components/invoices/InvoiceList';
import { InvoiceLineItems } from '../components/invoices/InvoiceLineItems';
import { InvoicePreview } from '../components/invoices/InvoicePreview';
import { InvoiceTemplates } from '../components/invoices/InvoiceTemplates';
import { Modal } from '../components/modals/Modal';
import {
  createInvoice,
  getInvoices,
  deleteInvoice,
} from '../store/invoices';
import { getCustomers } from '../store/contacts';
import type { Invoice, InvoiceLineItem } from '../db/schema/invoices.schema';
import { generateInvoiceNumber, calculateInvoiceTotals } from '../db/schema/invoices.schema';
import { nanoid } from 'nanoid';

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    {
      id: nanoid(),
      description: '',
      quantity: 1,
      unitPrice: '0.00',
      accountId: '',
      total: '0.00',
    },
  ]);
  const [notes, setNotes] = useState('');
  const [templateId, setTemplateId] = useState('classic');
  const [taxRate, setTaxRate] = useState(0);
  const [currentStep, setCurrentStep] = useState<'details' | 'items' | 'template' | 'preview'>('details');

  const companyId = 'demo-company'; // TODO: Get from auth context

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoicesResult, customersResult] = await Promise.all([
        getInvoices({ company_id: companyId }),
        getCustomers(companyId),
      ]);

      if (invoicesResult.success) {
        setInvoices(invoicesResult.data);
      }

      if (customersResult.success) {
        setCustomers(customersResult.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!customerId) {
      alert('Please select a customer');
      return;
    }

    if (lineItems.length === 0) {
      alert('Please add at least one line item');
      return;
    }

    const year = new Date().getFullYear();
    const sequence = invoices.length + 1;
    const invoiceNumber = generateInvoiceNumber(year, sequence);

    const result = await createInvoice({
      companyId,
      customerId,
      invoiceNumber,
      invoiceDate: new Date(invoiceDate || Date.now()).getTime(),
      dueDate: new Date(dueDate || Date.now()).getTime(),
      lineItems,
      notes: notes || undefined,
      templateId,
      taxRate,
    });

    if (result.success) {
      setInvoices([...invoices, result.data]);
      setShowCreateModal(false);
      resetForm();
      alert('Your first invoice is on its way! (How professional of you.)');
    } else {
      alert(`Failed to create invoice: ${result.error.message}`);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) {
      return;
    }

    const result = await deleteInvoice(id);

    if (result.success) {
      setInvoices(invoices.filter((inv) => inv.id !== id));
    } else {
      alert(`Failed to delete invoice: ${result.error.message}`);
    }
  };

  const resetForm = () => {
    setCustomerId('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setLineItems([
      {
        id: nanoid(),
        description: '',
        quantity: 1,
        unitPrice: '0.00',
        accountId: '',
        total: '0.00',
      },
    ]);
    setNotes('');
    setTemplateId('classic');
    setTaxRate(0);
    setCurrentStep('details');
  };

  const { subtotal, tax, total } = calculateInvoiceTotals(lineItems, taxRate);

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-gray-600">Create and send professional invoices</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            + Create Invoice
          </Button>
        </div>

        {loading ? (
          <div>Loading invoices...</div>
        ) : (
          <InvoiceList
            invoices={invoices}
            onSelect={() => {}}
            onDelete={handleDeleteInvoice}
          />
        )}

        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          title="Create New Invoice"
          size="lg"
        >
          <div className="space-y-6">
            {currentStep === 'details' && (
              <>
                <Select
                  label="Customer"
                  options={customerOptions}
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="Select a customer"
                  required
                  fullWidth
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Invoice Date"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    required
                    fullWidth
                  />

                  <Input
                    label="Due Date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    fullWidth
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setCurrentStep('items')}>
                    Next: Line Items
                  </Button>
                </div>
              </>
            )}

            {currentStep === 'items' && (
              <>
                <InvoiceLineItems
                  lineItems={lineItems}
                  onChange={setLineItems}
                />

                <Input
                  label="Tax Rate (%)"
                  type="number"
                  value={taxRate * 100}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) / 100 || 0)}
                  min="0"
                  step="0.1"
                  fullWidth
                />

                <div className="bg-gray-50 p-4 rounded">
                  <div className="flex justify-between mb-2">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${subtotal}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span>Tax:</span>
                    <span className="font-semibold">${tax}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>${total}</span>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentStep('details')}
                  >
                    Back
                  </Button>
                  <Button onClick={() => setCurrentStep('template')}>
                    Next: Choose Template
                  </Button>
                </div>
              </>
            )}

            {currentStep === 'template' && (
              <>
                <InvoiceTemplates
                  selectedTemplateId={templateId}
                  onSelect={setTemplateId}
                />

                <Input
                  label="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Thank you for your business!"
                  fullWidth
                />

                <div className="flex justify-between">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentStep('items')}
                  >
                    Back
                  </Button>
                  <Button onClick={() => setCurrentStep('preview')}>
                    Preview Invoice
                  </Button>
                </div>
              </>
            )}

            {currentStep === 'preview' && (
              <>
                <InvoicePreview
                  invoice={{
                    id: '',
                    company_id: companyId,
                    customer_id: customerId,
                    invoice_number: 'PREVIEW',
                    invoice_date: new Date(invoiceDate || Date.now()).getTime(),
                    due_date: new Date(dueDate || Date.now()).getTime(),
                    status: 'DRAFT',
                    subtotal,
                    tax,
                    total,
                    notes,
                    internal_memo: null,
                    template_id: templateId,
                    line_items: JSON.stringify(lineItems),
                    transaction_id: null,
                    sent_at: null,
                    paid_at: null,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                    deleted_at: null,
                    version_vector: {},
                  }}
                  lineItems={lineItems}
                  customerName={
                    customers.find((c) => c.id === customerId)?.name || 'Customer'
                  }
                />

                <div className="flex justify-between mt-6">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentStep('template')}
                  >
                    Back
                  </Button>
                  <Button onClick={handleCreateInvoice}>
                    Create Invoice
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
    </div>
  );
}
