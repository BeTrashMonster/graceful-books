import { useState, useEffect } from 'react';
import { Modal } from '../../modals/Modal';
import { Button } from '../../core/Button';
import { db } from '../../../db/database';
import { useAuth } from '../../../contexts/AuthContext';
import type { CPGFinishedProduct } from '../../../db/schema/cpg.schema';
import { cpuCalculatorService } from '../../../services/cpg/cpuCalculator.service';
import { v4 as uuidv4 } from 'uuid';
import styles from './BundleProductsModal.module.css';

interface BundleItem {
  productId: string;
  productName: string;
  quantity: number;
  cpu: string | null;
  msrp: string | null;
}

interface BundleProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingBundle?: CPGFinishedProduct | null;
}

export function BundleProductsModal({ isOpen, onClose, onSuccess, editingBundle }: BundleProductsModalProps) {
  const { companyId, deviceId } = useAuth();

  // Form state
  const [bundleName, setBundleName] = useState('');
  const [bundleSku, setBundleSku] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [bundleMsrp, setBundleMsrp] = useState('');

  // Available products
  const [availableProducts, setAvailableProducts] = useState<CPGFinishedProduct[]>([]);
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);

  // Calculated values
  const [totalCpu, setTotalCpu] = useState<string>('0.00');
  const [suggestedMsrp, setSuggestedMsrp] = useState<string>('0.00');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available products
  useEffect(() => {
    if (!isOpen || !companyId) return;

    const loadProducts = async () => {
      try {
        setIsLoading(true);
        const products = await db.cpgFinishedProducts
          .where('company_id')
          .equals(companyId)
          .and(p => p.active && !p.deleted_at && !p.is_bundle) // Don't include other bundles
          .toArray();

        setAvailableProducts(products);

        // If editing, load bundle items
        if (editingBundle && editingBundle.bundle_items) {
          const items: BundleItem[] = [];
          for (const item of editingBundle.bundle_items) {
            const product = products.find(p => p.id === item.product_id);
            if (product) {
              // Calculate CPU for this product
              let cpu: string | null = null;
              try {
                const cpuResult = await cpuCalculatorService.calculateFinishedProductCPU(
                  product.id,
                  companyId
                );
                cpu = cpuResult.cpu;
              } catch (err) {
                console.error('Failed to get CPU:', err);
              }

              items.push({
                productId: product.id,
                productName: product.name,
                quantity: item.quantity,
                cpu,
                msrp: product.msrp || null,
              });
            }
          }
          setBundleItems(items);
          setBundleName(editingBundle.name);
          setBundleSku(editingBundle.sku || '');
          setBundleDescription(editingBundle.description || '');
          setBundleMsrp(editingBundle.msrp || '');
        }
      } catch (err) {
        console.error('Failed to load products:', err);
        setError('Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [isOpen, companyId, editingBundle]);

  // Calculate totals when bundle items change
  useEffect(() => {
    let cpuTotal = 0;
    let msrpTotal = 0;

    bundleItems.forEach(item => {
      if (item.cpu) {
        cpuTotal += parseFloat(item.cpu) * item.quantity;
      }
      if (item.msrp) {
        msrpTotal += parseFloat(item.msrp) * item.quantity;
      }
    });

    setTotalCpu(cpuTotal.toFixed(2));
    setSuggestedMsrp(msrpTotal.toFixed(2));

    // Auto-fill MSRP if empty
    if (!bundleMsrp && msrpTotal > 0) {
      setBundleMsrp(msrpTotal.toFixed(2));
    }
  }, [bundleItems]);

  const handleAddProduct = (productId: string) => {
    const product = availableProducts.find(p => p.id === productId);
    if (!product) return;

    // Check if already added
    if (bundleItems.some(item => item.productId === productId)) {
      alert('This product is already in the bundle');
      return;
    }

    // Calculate CPU for this product
    const calculateAndAdd = async () => {
      let cpu: string | null = null;
      try {
        const cpuResult = await cpuCalculatorService.calculateFinishedProductCPU(
          product.id,
          companyId
        );
        cpu = cpuResult.cpu;
      } catch (err) {
        console.error('Failed to get CPU:', err);
      }

      setBundleItems([...bundleItems, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        cpu,
        msrp: product.msrp || null,
      }]);
    };

    calculateAndAdd();
  };

  const handleRemoveProduct = (productId: string) => {
    setBundleItems(bundleItems.filter(item => item.productId !== productId));
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setBundleItems(bundleItems.map(item =>
      item.productId === productId ? { ...item, quantity } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bundleName.trim()) {
      setError('Please enter a bundle name');
      return;
    }

    if (bundleItems.length === 0) {
      setError('Please add at least one product to the bundle');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const bundleData = {
        id: editingBundle?.id || uuidv4(),
        company_id: companyId,
        name: bundleName.trim(),
        sku: bundleSku.trim() || null,
        description: bundleDescription.trim() || null,
        msrp: bundleMsrp ? bundleMsrp : null,
        active: true,
        is_bundle: true,
        bundle_items: bundleItems.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
        created_at: editingBundle?.created_at || Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        created_by_device: editingBundle?.created_by_device || deviceId,
        last_modified_device: deviceId,
      };

      if (editingBundle) {
        await db.cpgFinishedProducts.update(editingBundle.id, bundleData);
      } else {
        await db.cpgFinishedProducts.add(bundleData);
      }

      // Trigger update event
      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'product' } }));

      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Failed to save bundle:', err);
      setError('Failed to save bundle. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setBundleName('');
    setBundleSku('');
    setBundleDescription('');
    setBundleMsrp('');
    setBundleItems([]);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingBundle ? 'Edit Bundle' : 'Create Product Bundle'}
      size="lg"
      closeOnBackdropClick={false}
      headerStyle={{
        backgroundColor: '#4b006e',
        color: 'white',
      }}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {isLoading ? (
          <div className={styles.loading}>Loading products...</div>
        ) : (
          <>
            {/* Bundle Name, SKU, MSRP, Description */}
            <div className={styles.formGroup}>
              <label htmlFor="bundle-name" className={styles.label}>
                Bundle Name <span className={styles.required}>*</span>
              </label>
              <input
                id="bundle-name"
                type="text"
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                placeholder="e.g., Holiday Gift Set, Sampler Pack"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="bundle-sku" className={styles.label}>
                  SKU
                </label>
                <input
                  id="bundle-sku"
                  type="text"
                  value={bundleSku}
                  onChange={(e) => setBundleSku(e.target.value)}
                  placeholder="Optional"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="bundle-msrp" className={styles.label}>
                  Bundle MSRP
                </label>
                <input
                  id="bundle-msrp"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bundleMsrp}
                  onChange={(e) => setBundleMsrp(e.target.value)}
                  placeholder={`Suggested: $${suggestedMsrp}`}
                  className={styles.input}
                />
                {suggestedMsrp !== '0.00' && (
                  <span className={styles.hint}>
                    Sum of products: ${suggestedMsrp}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="bundle-description" className={styles.label}>
                Description
              </label>
              <textarea
                id="bundle-description"
                value={bundleDescription}
                onChange={(e) => setBundleDescription(e.target.value)}
                placeholder="Optional description"
                className={styles.textarea}
                rows={3}
              />
            </div>

            {/* Product Selection with Checkboxes */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Select Products for Bundle</h3>

              <div className={styles.productCheckboxList}>
                {availableProducts.map((product) => {
                  const isSelected = bundleItems.some(item => item.productId === product.id);
                  const bundleItem = bundleItems.find(item => item.productId === product.id);

                  return (
                    <div key={product.id} className={styles.productCheckboxItem}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleAddProduct(product.id);
                            } else {
                              handleRemoveProduct(product.id);
                            }
                          }}
                          className={styles.checkbox}
                        />
                        <div className={styles.productInfo}>
                          <span className={styles.productName}>
                            {product.name}
                            {product.sku && <span className={styles.productSku}> ({product.sku})</span>}
                          </span>
                        </div>
                      </label>

                      {isSelected && (
                        <div className={styles.quantityControl}>
                          <label className={styles.quantityLabel}>
                            Qty:
                            <input
                              type="number"
                              min="1"
                              value={bundleItem?.quantity || 1}
                              onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value) || 1)}
                              className={styles.quantityInput}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals */}
            {bundleItems.length > 0 && (
              <div className={styles.totals}>
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>Total CPU:</span>
                  <span className={styles.totalValue}>${totalCpu}</span>
                </div>
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>Bundle MSRP:</span>
                  <span className={styles.totalValue}>
                    ${bundleMsrp || '0.00'}
                  </span>
                </div>
                {bundleMsrp && parseFloat(bundleMsrp) < parseFloat(suggestedMsrp) && (
                  <div className={styles.savingsRow}>
                    <span className={styles.savingsLabel}>Customer Saves:</span>
                    <span className={styles.savingsValue}>
                      ${(parseFloat(suggestedMsrp) - parseFloat(bundleMsrp)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="gold"
            loading={isSaving}
            disabled={isSaving || isLoading}
          >
            {editingBundle ? 'Update Bundle' : 'Create Bundle'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
