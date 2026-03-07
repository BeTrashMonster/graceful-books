import { useState } from 'react';
import type { WorksheetData, Category } from '../types';

interface CategoriesStepProps {
  data: WorksheetData;
  updateData: (updates: Partial<WorksheetData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function CategoriesStep({ data, updateData, onNext, onPrev }: CategoriesStepProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [variants, setVariants] = useState<string[]>([]);
  const [variantInput, setVariantInput] = useState('');

  const generateId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const startAdd = () => {
    setIsAdding(true);
    setCategoryName('');
    setVariants([]);
    setVariantInput('');
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setCategoryName(category.name);
    setVariants([...category.variants]);
    setVariantInput('');
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setCategoryName('');
    setVariants([]);
    setVariantInput('');
  };

  const addVariant = () => {
    if (variantInput.trim()) {
      setVariants([...variants, variantInput.trim()]);
      setVariantInput('');
    }
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const saveCategory = () => {
    if (!categoryName.trim()) {
      alert('Please enter a category name');
      return;
    }

    const newCategory: Category = {
      id: editingId || generateId(),
      name: categoryName.trim(),
      variants: variants,
      sort_order: editingId
        ? data.categories.find(c => c.id === editingId)?.sort_order || 0
        : data.categories.length,
    };

    const updatedCategories = editingId
      ? data.categories.map(c => c.id === editingId ? newCategory : c)
      : [...data.categories, newCategory];

    updateData({ categories: updatedCategories });
    cancelEdit();
  };

  const deleteCategory = (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      updateData({ categories: data.categories.filter(c => c.id !== id) });
    }
  };

  const canProceed = data.categories.length > 0;

  return (
    <div className="step">
      <div className="step-header">
        <h2 className="step-title">Ingredient Categories</h2>
        <p className="step-description">
          Create categories for the raw materials and ingredients you purchase. Add variants (like different sizes or scents) if needed.
        </p>
      </div>

      <div className="step-content">
        {data.categories.length > 0 && (
          <div className="item-list">
            {data.categories.map((category) => (
              <div key={category.id} className="item-card">
                <div className="item-info">
                  <div className="item-name">{category.name}</div>
                  {category.variants.length > 0 && (
                    <div className="item-details">
                      Variants: {category.variants.join(', ')}
                    </div>
                  )}
                </div>
                <div className="item-actions">
                  <button
                    className="btn-icon"
                    onClick={() => startEdit(category)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => deleteCategory(category.id)}
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
            + Add Category
          </button>
        )}

        {(isAdding || editingId) && (
          <div style={{
            background: 'var(--bg-gray-light)',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '2px solid var(--primary-purple)',
            marginTop: data.categories.length > 0 ? '1rem' : 0
          }}>
            <h3 style={{ fontSize: '1.125rem', margin: '0 0 1rem 0' }}>
              {editingId ? 'Edit Category' : 'New Category'}
            </h3>

            <div className="form-group">
              <label className="form-label">Category Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Bottles, Oils, Labels"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Variants <span className="form-label-optional">(optional)</span>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., 4 oz, 8 oz, 16 oz"
                  value={variantInput}
                  onChange={(e) => setVariantInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addVariant())}
                />
                <button
                  className="btn btn-secondary"
                  onClick={addVariant}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Add Variant
                </button>
              </div>
              {variants.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {variants.map((variant, index) => (
                    <div
                      key={index}
                      style={{
                        background: 'var(--primary-purple)',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '16px',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      {variant}
                      <button
                        onClick={() => removeVariant(index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '1rem'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-help">
                Variants help you track different sizes, scents, or types within the same category.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={saveCategory}>
                {editingId ? 'Save Changes' : 'Add Category'}
              </button>
              <button className="btn btn-tertiary" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {!canProceed && !isAdding && !editingId && (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <p className="empty-state-text">
              Add at least one category to continue
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
          Next: Add Products →
        </button>
      </div>
    </div>
  );
}
