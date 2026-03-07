import { useState } from 'react';
import type { WorksheetData, FinishedProduct } from '../types';

interface ProductsStepProps {
  data: WorksheetData;
  updateData: (updates: Partial<WorksheetData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function ProductsStep({ data, updateData, onNext, onPrev }: ProductsStepProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [msrp, setMsrp] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [variant, setVariant] = useState('');

  const generateId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const startAdd = () => {
    setIsAdding(true);
    setProductName('');
    setMsrp('');
    setSku('');
    setCategoryId('');
    setVariant('');
  };

  const startEdit = (product: FinishedProduct) => {
    setEditingId(product.id);
    setProductName(product.name);
    setMsrp(product.msrp);
    setSku(product.sku);
    setCategoryId(product.category_id || '');
    setVariant(product.variant || '');
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setProductName('');
    setMsrp('');
    setSku('');
    setCategoryId('');
    setVariant('');
  };

  const saveProduct = () => {
    if (!productName.trim()) {
      alert('Please enter a product name');
      return;
    }
    if (!msrp.trim() || isNaN(parseFloat(msrp))) {
      alert('Please enter a valid MSRP');
      return;
    }

    const newProduct: FinishedProduct = {
      id: editingId || generateId(),
      name: productName.trim(),
      msrp: parseFloat(msrp).toFixed(2),
      sku: sku.trim() || '',
      category_id: categoryId || undefined,
      variant: variant || undefined,
    };

    const updatedProducts = editingId
      ? data.finished_products.map(p => p.id === editingId ? newProduct : p)
      : [...data.finished_products, newProduct];

    updateData({ finished_products: updatedProducts });
    cancelEdit();
  };

  const deleteProduct = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      updateData({
        finished_products: data.finished_products.filter(p => p.id !== id),
        // Also remove any recipes for this product
        recipes: data.recipes.filter(r => r.product_id !== id),
      });
    }
  };

  const selectedCategory = data.categories.find(c => c.id === categoryId);
  const canProceed = data.finished_products.length > 0;

  return (
    <div className="step">
      <div className="step-header">
        <h2 className="step-title">Finished Products</h2>
        <p className="step-description">
          Add the products you sell. Include the name, retail price (MSRP), and SKU if you have one.
        </p>
      </div>

      <div className="step-content">
        {data.finished_products.length > 0 && (
          <div className="item-list">
            {data.finished_products.map((product) => {
              const category = data.categories.find(c => c.id === product.category_id);
              return (
                <div key={product.id} className="item-card">
                  <div className="item-info">
                    <div className="item-name">{product.name}</div>
                    <div className="item-details">
                      MSRP: ${product.msrp}
                      {product.sku && ` • SKU: ${product.sku}`}
                      {category && ` • ${category.name}${product.variant ? ` (${product.variant})` : ''}`}
                    </div>
                  </div>
                  <div className="item-actions">
                    <button
                      className="btn-icon"
                      onClick={() => startEdit(product)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon danger"
                      onClick={() => deleteProduct(product.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isAdding && !editingId && (
          <button className="btn btn-secondary" onClick={startAdd}>
            + Add Product
          </button>
        )}

        {(isAdding || editingId) && (
          <div style={{
            background: 'var(--bg-gray-light)',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '2px solid var(--primary-purple)',
            marginTop: data.finished_products.length > 0 ? '1rem' : 0
          }}>
            <h3 style={{ fontSize: '1.125rem', margin: '0 0 1rem 0' }}>
              {editingId ? 'Edit Product' : 'New Product'}
            </h3>

            <div className="form-group">
              <label className="form-label">Product Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Lavender Body Lotion"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">MSRP (Retail Price)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="24.99"
                  value={msrp}
                  onChange={(e) => setMsrp(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  SKU <span className="form-label-optional">(optional)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="LBL-8OZ"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">
                  Category <span className="form-label-optional">(optional)</span>
                </label>
                <select
                  className="form-select"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setVariant('');
                  }}
                >
                  <option value="">-- None --</option>
                  {data.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCategory && selectedCategory.variants.length > 0 && (
                <div className="form-group">
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
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={saveProduct}>
                {editingId ? 'Save Changes' : 'Add Product'}
              </button>
              <button className="btn btn-tertiary" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {!canProceed && !isAdding && !editingId && (
          <div className="empty-state">
            <div className="empty-state-icon">🛍️</div>
            <p className="empty-state-text">
              Add at least one product to continue
            </p>
          </div>
        )}
      </div>

      <div className="step-actions">
        <button className="btn btn-tertiary" onClick={onPrev}>
          ← Back
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed}
          style={{ opacity: canProceed ? 1 : 0.5 }}
        >
          Next: Define Recipes →
        </button>
      </div>
    </div>
  );
}
