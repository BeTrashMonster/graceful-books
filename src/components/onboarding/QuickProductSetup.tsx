/**
 * Quick Product Setup
 *
 * Streamlined product setup for signup flow (1-3 products)
 * Users can access full worksheet later from dashboard
 */

import { useState } from 'react';
import styles from './QuickProductSetup.module.css';

interface Product {
  name: string;
  msrp: string;
  sku: string;
}

interface QuickProductSetupProps {
  onComplete: (products: Product[]) => void;
  onSkip: () => void;
}

export function QuickProductSetup({ onComplete, onSkip }: QuickProductSetupProps) {
  const [products, setProducts] = useState<Product[]>([
    { name: '', msrp: '', sku: '' }
  ]);

  const addProduct = () => {
    if (products.length < 3) {
      setProducts([...products, { name: '', msrp: '', sku: '' }]);
    }
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const updateProduct = (index: number, field: keyof Product, value: string) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  const handleSubmit = () => {
    // Filter out empty products
    const validProducts = products.filter(p => p.name.trim() && p.msrp.trim());

    if (validProducts.length === 0) {
      alert('Please add at least one product, or click "Skip for Now"');
      return;
    }

    onComplete(validProducts);
  };

  const canAddMore = products.length < 3;
  const hasValidProduct = products.some(p => p.name.trim() && p.msrp.trim());

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Quick Product Setup</h2>
        <p className={styles.description}>
          Let's get you started with 1-3 products. You can add more details and products later from your dashboard.
        </p>
      </div>

      <div className={styles.tip}>
        <span className={styles.tipIcon}>💡</span>
        <div>
          <strong>Keep it simple!</strong>
          <p>Just add your main products for now. You'll have full access to the detailed CPG worksheet from your dashboard.</p>
        </div>
      </div>

      <div className={styles.products}>
        {products.map((product, index) => (
          <div key={index} className={styles.productCard}>
            <div className={styles.productHeader}>
              <h3 className={styles.productNumber}>Product {index + 1}</h3>
              {products.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeProduct(index)}
                  className={styles.removeButton}
                  aria-label="Remove product"
                >
                  ✕
                </button>
              )}
            </div>

            <div className={styles.productFields}>
              <div className={styles.field}>
                <label htmlFor={`product-name-${index}`} className={styles.label}>
                  Product Name <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  id={`product-name-${index}`}
                  value={product.name}
                  onChange={(e) => updateProduct(index, 'name', e.target.value)}
                  placeholder="e.g., Lavender Body Lotion"
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor={`product-msrp-${index}`} className={styles.label}>
                    Retail Price (MSRP) <span className={styles.required}>*</span>
                  </label>
                  <div className={styles.inputGroup}>
                    <span className={styles.inputPrefix}>$</span>
                    <input
                      type="number"
                      id={`product-msrp-${index}`}
                      value={product.msrp}
                      onChange={(e) => updateProduct(index, 'msrp', e.target.value)}
                      placeholder="19.99"
                      step="0.01"
                      min="0"
                      className={styles.input}
                      required
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor={`product-sku-${index}`} className={styles.label}>
                    SKU (Optional)
                  </label>
                  <input
                    type="text"
                    id={`product-sku-${index}`}
                    value={product.sku}
                    onChange={(e) => updateProduct(index, 'sku', e.target.value)}
                    placeholder="e.g., LBL-8OZ"
                    className={styles.input}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {canAddMore && (
          <button
            type="button"
            onClick={addProduct}
            className={styles.addButton}
            disabled={!canAddMore}
          >
            + Add Another Product {products.length < 3 && `(${3 - products.length} more)`}
          </button>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={onSkip}
          className={styles.secondaryButton}
        >
          Skip for Now
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className={styles.primaryButton}
          disabled={!hasValidProduct}
        >
          Continue to Dashboard
        </button>
      </div>

      <div className={styles.note}>
        <p>
          <strong>Don't worry!</strong> You can access the full CPG worksheet anytime from your dashboard
          to add recipes, ingredients, costs, and more detailed information.
        </p>
      </div>
    </div>
  );
}
