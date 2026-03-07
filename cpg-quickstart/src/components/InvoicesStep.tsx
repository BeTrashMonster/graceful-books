import { useState } from 'react';
import type { WorksheetData, Invoice, InvoiceItem } from '../types';

interface InvoicesStepProps {
  data: WorksheetData;
  updateData: (updates: Partial<WorksheetData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function InvoicesStep({ data, updateData, onNext, onPrev }: InvoicesStepProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [variant, setVariant] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const generateId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const selectedCategory = data.categories.find(c => c.id === categoryId);

  const startAdd = () => {
    setIsAdding(true);
    setVendorName('');
    setInvoiceDate('');
    setInvoiceNumber('');
    setNotes('');
    setItems([]);
    setCategoryId('');
    setVariant('');
    setQuantity('');
    setUnit('');
    setUnitCost('');
  };

  const startEdit = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setVendorName(invoice.vendor_name);
    setInvoiceDate(invoice.invoice_date);
    setInvoiceNumber(invoice.invoice_number || '');
    setNotes(invoice.notes || '');
    setItems([...invoice.items]);
    setCategoryId('');
    setVariant('');
    setQuantity('');
    setUnit('');
    setUnitCost('');
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setVendorName('');
    setInvoiceDate('');
    setInvoiceNumber('');
    setNotes('');
    setItems([]);
    setCategoryId('');
    setVariant('');
    setQuantity('');
    setUnit('');
    setUnitCost('');
  };

  const addItem = () => {
    if (!categoryId || !quantity || !unit || !unitCost) {
      alert('Please fill in all line item fields');
      return;
    }

    const newItem: InvoiceItem = {
      category_id: categoryId,
      variant: variant || undefined,
      quantity,
      unit,
      unit_cost: parseFloat(unitCost).toFixed(2),
    };

    setItems([...items, newItem]);
    setCategoryId('');
    setVariant('');
    setQuantity('');
    setUnit('');
    setUnitCost('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const saveInvoice = () => {
    if (!vendorName.trim()) {
      alert('Please enter a vendor name');
      return;
    }
    if (!invoiceDate) {
      alert('Please enter an invoice date');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one line item');
      return;
    }

    const newInvoice: Invoice = {
      id: editingId || generateId(),
      vendor_name: vendorName.trim(),
      invoice_date: invoiceDate,
      invoice_number: invoiceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      items,
    };

    const updatedInvoices = editingId
      ? data.invoices.map(inv => inv.id === editingId ? newInvoice : inv)
      : [...data.invoices, newInvoice];

    updateData({ invoices: updatedInvoices });
    cancelEdit();
  };

  const deleteInvoice = (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      updateData({ invoices: data.invoices.filter(inv => inv.id !== id) });
    }
  };

  const calculateTotal = (invoice: Invoice) => {
    return invoice.items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) * parseFloat(item.unit_cost));
    }, 0);
  };

  return (
    <div className="step">
      <div className="step-header">
        <h2 className="step-title">Purchase Invoices (Optional)</h2>
        <p className="step-description">
          Add recent purchase invoices to see your actual costs right away. You can always add more later.
        </p>
      </div>

      <div className="step-content">
        {data.invoices.length > 0 && (
          <div className="item-list">
            {data.invoices.map((invoice) => (
              <div key={invoice.id} className="item-card">
                <div className="item-info">
                  <div className="item-name">{invoice.vendor_name}</div>
                  <div className="item-details">
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                    {invoice.invoice_number && ` • Invoice #${invoice.invoice_number}`}
                    {' • '}
                    ${calculateTotal(invoice).toFixed(2)}
                    {' • '}
                    {invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="item-actions">
                  <button
                    className="btn-icon"
                    onClick={() => startEdit(invoice)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => deleteInvoice(invoice.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isAdding && !editingId && (
          <button className="btn btn-secondary" onClick={startAdd}>
            + Add Invoice
          </button>
        )}

        {(isAdding || editingId) && (
          <div style={{
            background: 'var(--bg-gray-light)',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '2px solid var(--primary-purple)',
            marginTop: data.invoices.length > 0 ? '1rem' : 0
          }}>
            <h3 style={{ fontSize: '1.125rem', margin: '0 0 1rem 0' }}>
              {editingId ? 'Edit Invoice' : 'New Invoice'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Vendor Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Bulk Apothecary"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Invoice Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Invoice Number <span className="form-label-optional">(optional)</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="INV-12345"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>

            {items.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Line Items:
                </div>
                {items.map((item, index) => {
                  const cat = data.categories.find(c => c.id === item.category_id);
                  const lineTotal = parseFloat(item.quantity) * parseFloat(item.unit_cost);
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: 'white',
                        borderRadius: '4px',
                        marginBottom: '0.5rem'
                      }}
                    >
                      <div style={{ flex: 1, fontSize: '0.875rem' }}>
                        <div style={{ fontWeight: 600 }}>
                          {cat?.name}{item.variant ? ` (${item.variant})` : ''}
                        </div>
                        <div style={{ color: 'var(--text-gray)', fontSize: '0.8125rem' }}>
                          {item.quantity} {item.unit} × ${item.unit_cost} = ${lineTotal.toFixed(2)}
                        </div>
                      </div>
                      <button
                        className="btn-icon danger"
                        onClick={() => removeItem(index)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <div style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  fontSize: '1rem',
                  marginTop: '0.5rem',
                  color: 'var(--primary-purple)'
                }}>
                  Total: ${items.reduce((sum, item) =>
                    sum + (parseFloat(item.quantity) * parseFloat(item.unit_cost)), 0
                  ).toFixed(2)}
                </div>
              </div>
            )}

            <div style={{
              background: 'white',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1rem'
            }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 1rem 0' }}>
                Add Line Item
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setVariant('');
                    }}
                  >
                    <option value="">-- Select --</option>
                    {data.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Unit</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="oz"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">$/Unit</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="4.99"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                  />
                </div>
              </div>

              {selectedCategory && selectedCategory.variants.length > 0 && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Variant</label>
                  <select
                    className="form-select"
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {selectedCategory.variants.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button className="btn btn-secondary" onClick={addItem} style={{ width: '100%' }}>
                + Add Line Item
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">
                Notes <span className="form-label-optional">(optional)</span>
              </label>
              <textarea
                className="form-textarea"
                placeholder="Any additional notes about this invoice..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={saveInvoice}>
                {editingId ? 'Save Changes' : 'Save Invoice'}
              </button>
              <button className="btn btn-tertiary" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {data.invoices.length === 0 && !isAdding && !editingId && (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <p className="empty-state-text">
              No invoices yet - that's okay! You can add them later.
            </p>
          </div>
        )}
      </div>

      <div className="step-actions">
        <button className="btn btn-tertiary" onClick={onPrev}>
          ← Back
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Next: Review & Export →
        </button>
      </div>
    </div>
  );
}
