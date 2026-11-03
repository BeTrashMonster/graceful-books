/**
 * CreateCodeModal Component
 *
 * Modal for creating new lifetime access codes.
 * Supports:
 * - Name and optional notes
 * - Max redemptions (optional, unlimited if blank)
 * - Expiration date (optional, never expires if blank)
 * - Product selection (multi-select)
 * - Auto-generate or custom code
 */

import { useState, useEffect } from 'react';
import { API_URL } from '../../../config/api';
import styles from './CreateCodeModal.module.css';

interface Product {
  id: string;
  name: string;
  slug: string;
}

export interface CreateCodeModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateCodeModal({ onClose, onCreated }: CreateCodeModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [maxRedemptions, setMaxRedemptions] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  // Generated URL preview
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const getSession = () => {
    const sessionData = sessionStorage.getItem('graceful_books_admin_session');
    return sessionData ? JSON.parse(sessionData) : null;
  };

  // Fetch available products
  useEffect(() => {
    const fetchProducts = async () => {
      const session = getSession();
      if (!session) return;

      try {
        const response = await fetch(`${API_URL}/products`, {
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to fetch products');
        }

        setProducts(data.data || []);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        // Fallback to known products if fetch fails
        setProducts([
          { id: 'cpu-cpg-calculator', name: 'CPU/CPG Calculator', slug: 'cpu-cpg-calculator' },
          { id: 'bookkeeping-suite', name: 'Bookkeeping Suite', slug: 'bookkeeping-suite' },
        ]);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  // Generate a random code
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleToggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const session = getSession();
    if (!session) return;

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (selectedProductIds.length === 0) {
      setError('Select at least one product');
      return;
    }

    if (useCustomCode && !code.trim()) {
      setError('Enter a custom code or use auto-generate');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const finalCode = useCustomCode ? code.trim().toUpperCase() : generateCode();

      const response = await fetch(`${API_URL}/admin/lifetime-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          code: finalCode,
          name: name.trim(),
          productIds: selectedProductIds,
          maxRedemptions: maxRedemptions ? parseInt(maxRedemptions, 10) : null,
          expiresAt: expiresAt || null,
          notes: notes.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create code');
      }

      // Show generated URL
      const baseUrl = window.location.origin;
      setGeneratedUrl(`${baseUrl}/redeem?code=${data.data.code.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDone = () => {
    onCreated();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {generatedUrl ? 'Code Created!' : 'Create Lifetime Code'}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={generatedUrl ? handleDone : onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {generatedUrl ? (
          <div className={styles.successContent}>
            <p className={styles.successMessage}>
              Your lifetime access code has been created. Share this URL with users:
            </p>
            <div className={styles.urlBox}>
              <input
                type="text"
                value={generatedUrl}
                readOnly
                className={styles.urlInput}
              />
              <button
                type="button"
                className={styles.copyButton}
                onClick={handleCopyUrl}
              >
                Copy
              </button>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.doneButton}
                onClick={handleDone}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Name */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Conference Attendees 2024"
                className={styles.input}
                required
              />
              <p className={styles.hint}>
                A descriptive name for internal tracking
              </p>
            </div>

            {/* Code */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Code</label>
              <div className={styles.codeOptions}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="codeType"
                    checked={!useCustomCode}
                    onChange={() => setUseCustomCode(false)}
                  />
                  Auto-generate
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="codeType"
                    checked={useCustomCode}
                    onChange={() => setUseCustomCode(true)}
                  />
                  Custom code
                </label>
              </div>
              {useCustomCode && (
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g., BUILT2024"
                  className={styles.input}
                  maxLength={20}
                />
              )}
            </div>

            {/* Products */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Products <span className={styles.required}>*</span>
              </label>
              {isLoadingProducts ? (
                <p className={styles.loadingText}>Loading products...</p>
              ) : (
                <div className={styles.productList}>
                  {products.map((product) => (
                    <label key={product.id} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(product.id)}
                        onChange={() => handleToggleProduct(product.id)}
                      />
                      {product.name}
                    </label>
                  ))}
                </div>
              )}
              <p className={styles.hint}>
                Select which products this code grants access to
              </p>
            </div>

            {/* Max Redemptions */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Max Redemptions</label>
              <input
                type="number"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="Leave blank for unlimited"
                className={styles.input}
                min={1}
              />
              <p className={styles.hint}>
                Limit how many times this code can be used
              </p>
            </div>

            {/* Expiration */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Expiration Date</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className={styles.input}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className={styles.hint}>
                Leave blank for no expiration
              </p>
            </div>

            {/* Notes */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this code..."
                className={styles.textarea}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
