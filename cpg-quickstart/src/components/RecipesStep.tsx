import { useState } from 'react';
import type { WorksheetData, Recipe, RecipeItem } from '../types';

interface RecipesStepProps {
  data: WorksheetData;
  updateData: (updates: Partial<WorksheetData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function RecipesStep({ data, updateData, onNext, onPrev }: RecipesStepProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [variant, setVariant] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');

  const selectedProduct = data.finished_products.find(p => p.id === selectedProductId);
  const existingRecipe = data.recipes.find(r => r.product_id === selectedProductId);
  const selectedCategory = data.categories.find(c => c.id === categoryId);

  const productsWithRecipes = data.finished_products.filter(p =>
    data.recipes.some(r => r.product_id === p.id)
  );
  const productsWithoutRecipes = data.finished_products.filter(p =>
    !data.recipes.some(r => r.product_id === p.id)
  );

  const startEditing = (productId: string) => {
    setSelectedProductId(productId);
    const recipe = data.recipes.find(r => r.product_id === productId);
    setItems(recipe ? [...recipe.items] : []);
    setCategoryId('');
    setVariant('');
    setQuantity('');
    setUnit('');
  };

  const cancelEditing = () => {
    setSelectedProductId('');
    setItems([]);
    setCategoryId('');
    setVariant('');
    setQuantity('');
    setUnit('');
  };

  const addItem = () => {
    if (!categoryId || !quantity || !unit) {
      alert('Please fill in all ingredient fields');
      return;
    }

    const newItem: RecipeItem = {
      category_id: categoryId,
      variant: variant || undefined,
      quantity,
      unit,
    };

    setItems([...items, newItem]);
    setCategoryId('');
    setVariant('');
    setQuantity('');
    setUnit('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const saveRecipe = () => {
    if (items.length === 0) {
      alert('Please add at least one ingredient');
      return;
    }

    const newRecipe: Recipe = {
      product_id: selectedProductId,
      items,
    };

    const updatedRecipes = existingRecipe
      ? data.recipes.map(r => r.product_id === selectedProductId ? newRecipe : r)
      : [...data.recipes, newRecipe];

    updateData({ recipes: updatedRecipes });
    cancelEditing();
  };

  const deleteRecipe = (productId: string) => {
    if (confirm('Are you sure you want to delete this recipe?')) {
      updateData({ recipes: data.recipes.filter(r => r.product_id !== productId) });
    }
  };

  const canProceed = data.recipes.length > 0;

  return (
    <div className="step">
      <div className="step-header">
        <h2 className="step-title">Product Recipes</h2>
        <p className="step-description">
          Define what ingredients go into each of your products. This is how we calculate your cost per unit.
        </p>
      </div>

      <div className="step-content">
        {productsWithRecipes.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: 'var(--primary-purple)' }}>
              Completed Recipes
            </h3>
            <div className="item-list">
              {productsWithRecipes.map((product) => {
                const recipe = data.recipes.find(r => r.product_id === product.id);
                if (!recipe) return null;

                return (
                  <div key={product.id} className="item-card">
                    <div className="item-info">
                      <div className="item-name">{product.name}</div>
                      <div className="item-details">
                        {recipe.items.length} ingredient{recipe.items.length !== 1 ? 's' : ''}
                        {' • '}
                        {recipe.items.map((item) => {
                          const cat = data.categories.find(c => c.id === item.category_id);
                          return cat ? `${item.quantity} ${item.unit} ${cat.name}${item.variant ? ` (${item.variant})` : ''}` : '';
                        }).filter(Boolean).join(', ')}
                      </div>
                    </div>
                    <div className="item-actions">
                      <button
                        className="btn-icon"
                        onClick={() => startEditing(product.id)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon danger"
                        onClick={() => deleteRecipe(product.id)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!selectedProductId && productsWithoutRecipes.length > 0 && (
          <div>
            <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: 'var(--text-gray)' }}>
              Products Without Recipes
            </h3>
            <div className="item-list">
              {productsWithoutRecipes.map((product) => (
                <div key={product.id} className="item-card">
                  <div className="item-info">
                    <div className="item-name">{product.name}</div>
                    <div className="item-details">No recipe yet</div>
                  </div>
                  <div className="item-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => startEditing(product.id)}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                      Add Recipe
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedProductId && (
          <div style={{
            background: 'var(--bg-gray-light)',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '2px solid var(--primary-purple)',
            marginTop: productsWithRecipes.length > 0 ? '1rem' : 0
          }}>
            <h3 style={{ fontSize: '1.125rem', margin: '0 0 1rem 0' }}>
              Recipe for: {selectedProduct?.name}
            </h3>

            {items.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Ingredients:
                </div>
                {items.map((item, index) => {
                  const cat = data.categories.find(c => c.id === item.category_id);
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem',
                        background: 'white',
                        borderRadius: '4px',
                        marginBottom: '0.5rem'
                      }}
                    >
                      <span style={{ fontSize: '0.875rem' }}>
                        {item.quantity} {item.unit} {cat?.name}{item.variant ? ` (${item.variant})` : ''}
                      </span>
                      <button
                        className="btn-icon danger"
                        onClick={() => removeItem(index)}
                        style={{ fontSize: '1rem' }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{
              background: 'white',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1rem'
            }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 1rem 0' }}>
                Add Ingredient
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
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
                  <label className="form-label">Quantity</label>
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
                + Add to Recipe
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={saveRecipe}>
                {existingRecipe ? 'Save Changes' : 'Save Recipe'}
              </button>
              <button className="btn btn-tertiary" onClick={cancelEditing}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {!canProceed && !selectedProductId && productsWithoutRecipes.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🍳</div>
            <p className="empty-state-text">
              You'll need to add products first before creating recipes
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
          Next: Add Invoices →
        </button>
      </div>
    </div>
  );
}
