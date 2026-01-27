/**
 * Finished Product Manager Component
 *
 * Manages finished products (products that are manufactured and sold).
 * Provides CRUD operations with validation and referential integrity checks.
 *
 * Features:
 * - List all finished products in card/grid view
 * - Add new finished product
 * - Edit existing products
 * - Delete products (with referential integrity check)
 * - Click product card to open Recipe Builder
 */

import { useState, useEffect } from 'react';
import { Button } from '../core/Button';
import { db } from '../../db/database';
import { useAuth } from '../../contexts/AuthContext';
import type { CPGFinishedProduct } from '../../db/schema/cpg.schema';
import { checkFinishedProductHasRecipes } from '../../db/schema/cpg.schema';
import { AddProductModal } from './modals/AddProductModal';
import styles from './FinishedProductManager.module.css';

export interface FinishedProductManagerProps {
  onOpenRecipeBuilder?: (productId: string) => void;
}

export function FinishedProductManager({ onOpenRecipeBuilder }: FinishedProductManagerProps) {
  const { companyId } = useAuth();
  const [products, setProducts] = useState<CPGFinishedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CPGFinishedProduct | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);

  // Load products
  const loadProducts = async () => {
    if (!companyId) return;

    try {
      setIsLoading(true);
      setError(null);

      const allProducts = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .toArray();

      setProducts(allProducts);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Oops! We had trouble loading your products. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [companyId]);

  // Listen for data updates
  useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      if (event.detail?.type === 'product') {
        loadProducts();
      }
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate as EventListener);
    return () => {
      window.removeEventListener('cpg-data-updated', handleDataUpdate as EventListener);
    };
  }, [companyId]);

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowAddModal(true);
  };

  const handleEditProduct = (product: CPGFinishedProduct) => {
    setEditingProduct(product);
    setShowAddModal(true);
  };

  const handleArchiveProduct = async (productId: string) => {
    try {
      // Soft delete (archive)
      await db.cpgFinishedProducts.update(productId, {
        deleted_at: Date.now(),
        active: false,
        updated_at: Date.now(),
      });

      // Dispatch update event
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'product' } })
      );

      await loadProducts();
    } catch (err) {
      console.error('Failed to archive product:', err);
      setError('Oops! We had trouble archiving that product. Please try again.');
    }
  };

  const handleUnarchiveProduct = async (productId: string) => {
    try {
      await db.cpgFinishedProducts.update(productId, {
        deleted_at: null,
        active: true,
        updated_at: Date.now(),
      });

      // Dispatch update event
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'product' } })
      );

      await loadProducts();
    } catch (err) {
      console.error('Failed to unarchive product:', err);
      setError('Oops! We had trouble restoring that product. Please try again.');
    }
  };

  const handleShowDeleteConfirmation = (productId: string) => {
    setDeletingProductId(productId);
    setShowPermanentDeleteConfirm(false);
  };

  const handlePermanentDeleteProduct = async () => {
    if (!deletingProductId) return;

    try {
      // Check if product has recipes
      const recipeCount = await checkFinishedProductHasRecipes(deletingProductId);

      if (recipeCount > 0) {
        setError(
          `Cannot permanently delete this product. It has ${recipeCount} recipe(s) defined. Please archive instead.`
        );
        setDeletingProductId(null);
        setShowPermanentDeleteConfirm(false);
        return;
      }

      // Permanent delete
      await db.cpgFinishedProducts.delete(deletingProductId);

      // Dispatch update event
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'product' } })
      );

      setDeletingProductId(null);
      setShowPermanentDeleteConfirm(false);
      await loadProducts();
    } catch (err) {
      console.error('Failed to permanently delete product:', err);
      setError('Oops! We had trouble deleting that product. Please try again.');
    }
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingProduct(null);
  };

  const handleModalSuccess = () => {
    setShowAddModal(false);
    setEditingProduct(null);
    loadProducts();
  };

  const handleOpenRecipe = (productId: string) => {
    if (onOpenRecipeBuilder) {
      onOpenRecipeBuilder(productId);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading your products...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>My Finished Products</h2>
          <p className={styles.subtitle}>
            Track the products you manufacture and sell
          </p>
        </div>
        <Button variant="primary" size="md" onClick={handleAddProduct}>
          + Add Product
        </Button>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Show Archived Toggle */}
      {products.some(p => p.deleted_at !== null) && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>Show Archived</span>
          </label>
        </div>
      )}

      {products.filter(p => showArchived || p.deleted_at === null).length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            📦
          </div>
          <h3 className={styles.emptyTitle}>No Products Yet</h3>
          <p className={styles.emptyText}>
            Add your first finished product to start tracking manufacturing costs.
          </p>
          <Button variant="primary" size="md" onClick={handleAddProduct}>
            + Add Your First Product
          </Button>
        </div>
      ) : (
        <div className={styles.productGrid} role="list" aria-label="Finished Products">
          {products
            .filter(p => showArchived || p.deleted_at === null)
            .map((product) => {
              const isArchived = product.deleted_at !== null;
              return (
                <article
                  key={product.id}
                  className={styles.productCard}
                  role="listitem"
                  style={isArchived ? { opacity: 0.6, backgroundColor: '#f8f9fa' } : {}}
                >
                  <div className={styles.productHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 className={styles.productName}>{product.name}</h3>
                      {isArchived && (
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            borderRadius: '4px',
                          }}
                        >
                          Archived
                        </span>
                      )}
                    </div>
                    {product.sku && (
                      <span className={styles.productSku}>SKU: {product.sku}</span>
                    )}
                  </div>

                  {product.description && (
                    <p className={styles.productDescription}>{product.description}</p>
                  )}

                  <div className={styles.productDetails}>
                    {product.msrp && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>MSRP:</span>
                        <span className={styles.detailValue}>${product.msrp}</span>
                      </div>
                    )}
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Unit:</span>
                      <span className={styles.detailValue}>
                        {product.unit_of_measure} ({product.pieces_per_unit} per unit)
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>CPU:</span>
                      <span className={styles.detailValue}>N/A</span>
                    </div>
                  </div>

                  <div className={styles.productActions}>
                    {!isArchived ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProduct(product)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenRecipe(product.id)}
                        >
                          Recipe
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShowDeleteConfirmation(product.id)}
                        >
                          Archive
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnarchiveProduct(product.id)}
                      >
                        Unarchive
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {showAddModal && (
        <AddProductModal
          isOpen={showAddModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          editingProduct={editingProduct}
        />
      )}

      {/* Archive/Delete Confirmation Modal */}
      {deletingProductId && !showPermanentDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
            }}
          >
            <h3 style={{ marginBottom: '1rem' }}>Archive this product?</h3>
            <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
              It will be hidden but preserved for records and can be restored later.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => setDeletingProductId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  handleArchiveProduct(deletingProductId);
                  setDeletingProductId(null);
                }}
              >
                Archive
              </Button>
            </div>
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setShowPermanentDeleteConfirm(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Permanently delete instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {deletingProductId && showPermanentDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              border: '2px solid #dc2626',
            }}
          >
            <h3 style={{ marginBottom: '1rem', color: '#dc2626' }}>
              ⚠️ Permanently delete?
            </h3>
            <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
              This cannot be undone and may break references. We recommend archiving instead.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPermanentDeleteConfirm(false);
                  setDeletingProductId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handlePermanentDeleteProduct}
                style={{ backgroundColor: '#dc2626' }}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
