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

import { useState, useEffect, useRef } from 'react';
import { Button } from '../core/Button';
import { db } from '../../db/database';
import { useAuth } from '../../contexts/AuthContext';
import type { CPGFinishedProduct } from '../../db/schema/cpg.schema';
import { _checkFinishedProductHasRecipes } from '../../db/schema/cpg.schema';
import { AddProductModal } from './modals/AddProductModal';
import { BundleProductsModal } from './modals/BundleProductsModal';
import { LaborAssignmentModal } from './modals/LaborAssignmentModal';
import { cpuCalculatorService } from '../../services/cpg/cpuCalculator.service';
import { LaborRoleService } from '../../services/cpg/laborRole.service';
import { useCPGSettings } from '../../hooks/useCPGSettings';
import styles from './FinishedProductManager.module.css';

export interface FinishedProductManagerProps {
  onOpenRecipeBuilder?: (productId: string) => void;
}

export function FinishedProductManager({ onOpenRecipeBuilder }: FinishedProductManagerProps) {
  const { companyId, deviceId } = useAuth();
  const { formatCurrency } = useCPGSettings();
  const [products, setProducts] = useState<CPGFinishedProduct[]>([]);
  const [productCPUs, setProductCPUs] = useState<Map<string, string | null>>(new Map());
  const [productLaborCosts, setProductLaborCosts] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [laborService] = useState(() => new LaborRoleService(db));
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CPGFinishedProduct | null>(null);
  const [editingBundle, setEditingBundle] = useState<CPGFinishedProduct | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [showLaborModal, setShowLaborModal] = useState(false);
  const [laborProductId, setLaborProductId] = useState<string | null>(null);
  const [laborProductName, setLaborProductName] = useState<string>('');

  // Card colors (stored by product ID)
  const [cardColors, setCardColors] = useState<Record<string, string>>({});
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Grid positioning (stored by product ID -> grid index)
  const [productPositions, setProductPositions] = useState<Record<string, number>>({});
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Actions dropdown
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

      // Calculate CPU for each product
      const cpuMap = new Map<string, string | null>();

      // Use last 365 days for CPU calculation
      const now = Date.now();
      const dateRange = { start: now - 365 * 24 * 60 * 60 * 1000, end: now };

      for (const product of allProducts) {
        try {
          // Handle bundles differently - sum component product CPUs
          if (product.is_bundle && product.bundle_items && product.bundle_items.length > 0) {
            let totalCpu = 0;
            let hasAllCpus = true;

            for (const item of product.bundle_items) {
              const componentProduct = allProducts.find(p => p.id === item.product_id);
              if (componentProduct) {
                // Calculate CPU for component if not already calculated
                let componentCpu: string | null = null;
                try {
                  const cpuResult = await cpuCalculatorService.calculateFinishedProductCPU(
                    componentProduct.id,
                    companyId,
                    dateRange
                  );
                  componentCpu = cpuResult.cpu;
                } catch (err) {
                  console.error(`Failed to calculate CPU for component ${componentProduct.id}:`, err);
                }

                if (componentCpu !== null) {
                  totalCpu += parseFloat(componentCpu) * item.quantity;
                } else {
                  hasAllCpus = false;
                  break;
                }
              } else {
                hasAllCpus = false;
                break;
              }
            }

            cpuMap.set(product.id, hasAllCpus ? totalCpu.toFixed(2) : null);
          } else {
            // Regular product - get material CPU only (without labor)
            const cpuBreakdown = await cpuCalculatorService.getFinishedProductCPUBreakdown(
              product.id,
              companyId
            );
            // Store only material CPU to avoid double-counting labor
            cpuMap.set(product.id, cpuBreakdown.materialCPU);
          }
        } catch (err) {
          console.error(`Failed to calculate CPU for product ${product.id}:`, err);
          cpuMap.set(product.id, null);
        }
      }
      setProductCPUs(cpuMap);

      // Calculate labor costs for each product
      const laborMap = new Map<string, string>();
      for (const product of allProducts) {
        if (!product.is_bundle) {
          try {
            const laborCost = await laborService.calculateProductLaborCost(product.id);
            laborMap.set(product.id, laborCost.totalLaborCostPerUnit);
          } catch (err) {
            console.error(`Failed to calculate labor cost for product ${product.id}:`, err);
            laborMap.set(product.id, '0.000000');
          }
        } else {
          // For bundles, labor is calculated from components
          laborMap.set(product.id, '0.000000');
        }
      }
      setProductLaborCosts(laborMap);
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

  // Load card colors from localStorage
  useEffect(() => {
    if (!companyId) return;
    const savedColors = localStorage.getItem(`cpg-product-card-colors-${companyId}`);
    if (savedColors) {
      try {
        setCardColors(JSON.parse(savedColors));
      } catch (err) {
        console.error('Failed to parse saved card colors:', err);
      }
    }
  }, [companyId]);

  // Save card colors to localStorage
  useEffect(() => {
    if (!companyId) return;
    if (Object.keys(cardColors).length > 0) {
      localStorage.setItem(`cpg-product-card-colors-${companyId}`, JSON.stringify(cardColors));
    }
  }, [cardColors, companyId]);

  // Load product positions from localStorage
  useEffect(() => {
    if (!companyId) return;
    const savedPositions = localStorage.getItem(`cpg-product-positions-${companyId}`);
    if (savedPositions) {
      try {
        setProductPositions(JSON.parse(savedPositions));
      } catch (err) {
        console.error('Failed to parse saved product positions:', err);
      }
    }
  }, [companyId]);

  // Save product positions to localStorage
  useEffect(() => {
    if (!companyId) return;
    if (Object.keys(productPositions).length > 0) {
      localStorage.setItem(`cpg-product-positions-${companyId}`, JSON.stringify(productPositions));
    }
  }, [productPositions, companyId]);

  // Initialize positions for new products
  useEffect(() => {
    if (products.length === 0) return;

    setProductPositions(prev => {
      const updated = { ...prev };
      let hasChanges = false;

      // Get all currently occupied positions
      const occupiedPositions = new Set(Object.values(updated));

      // Assign positions to products that don't have one
      products.forEach((product) => {
        if (updated[product.id] === undefined) {
          // Find the first unoccupied position
          let position = 0;
          while (occupiedPositions.has(position)) {
            position++;
          }
          updated[product.id] = position;
          occupiedPositions.add(position); // Mark this position as occupied
          hasChanges = true;
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [products]);

  // Listen for data updates
  useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      // Reload products when product OR recipe changes (recipe changes affect CPU)
      if (event.detail?.type === 'product' || event.detail?.type === 'recipe') {
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

  const handleDuplicateProduct = async (product: CPGFinishedProduct) => {
    try {
      setError(null);

      // Generate unique name with "(Copy)" suffix
      let duplicateName = `${product.name} (Copy)`;
      let suffix = 2;

      // Check for name conflicts and increment if needed
      while (true) {
        const existingProduct = await db.cpgFinishedProducts
          .where('company_id')
          .equals(companyId!)
          .and(p => p.name === duplicateName && p.deleted_at === null)
          .first();

        if (!existingProduct) break;

        duplicateName = `${product.name} (Copy ${suffix})`;
        suffix++;
      }

      // 1. Duplicate product with new ID
      const newProductId = crypto.randomUUID();
      const newProduct: CPGFinishedProduct = {
        ...product,
        id: newProductId,
        name: duplicateName,
        // Keep the same SKU (allows same product with different pricing for different channels)
        sku: product.sku,
        active: true, // Always create as active
        deleted_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        version_vector: { [deviceId!]: 1 },
        // Preserve bundle items if it's a bundle
        bundle_items: product.is_bundle && product.bundle_items
          ? [...product.bundle_items]
          : undefined,
      };

      await db.cpgFinishedProducts.add(newProduct);

      // 2. Duplicate recipes if they exist
      const recipes = await db.cpgRecipes
        .where('finished_product_id')
        .equals(product.id)
        .and(r => r.deleted_at === null)
        .toArray();

      for (const recipe of recipes) {
        const newRecipe = {
          ...recipe,
          id: crypto.randomUUID(),
          finished_product_id: newProductId,
          created_at: Date.now(),
          updated_at: Date.now(),
          version_vector: { [deviceId!]: 1 },
        };
        await db.cpgRecipes.add(newRecipe);
      }

      // 3. Duplicate labor assignments if they exist
      const laborAssignments = await db.cpgProductLabors
        .where('finished_product_id')
        .equals(product.id)
        .and(l => l.deleted_at === null)
        .toArray();

      for (const labor of laborAssignments) {
        const newLabor = {
          ...labor,
          id: crypto.randomUUID(),
          finished_product_id: newProductId,
          created_at: Date.now(),
          updated_at: Date.now(),
          version_vector: { [deviceId!]: 1 },
        };
        await db.cpgProductLabors.add(newLabor);
      }

      // 4. Dispatch update event
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'product' } })
      );

      // 5. Reload products
      await loadProducts();

      // 6. Close dropdown
      setOpenDropdownId(null);

    } catch (err) {
      console.error('Failed to duplicate product:', err);
      setError('Oops! We had trouble duplicating that product. Please try again.');
    }
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
      // Permanent delete (including any associated recipes/labor)
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

  const handleOpenLabor = (product: CPGFinishedProduct) => {
    setLaborProductId(product.id);
    setLaborProductName(product.name);
    setShowLaborModal(true);
  };

  const handleCloseLaborModal = () => {
    setShowLaborModal(false);
    setLaborProductId(null);
    setLaborProductName('');
  };

  const handleLaborSuccess = () => {
    // Reload products to update any labor cost calculations
    loadProducts();
  };

  // Color picker helpers
  const handleCardColorChange = (productId: string, color: string) => {
    setCardColors(prev => ({ ...prev, [productId]: color }));
  };

  const resetCardColor = (productId: string) => {
    setCardColors(prev => {
      const newColors = { ...prev };
      delete newColors[productId];
      return newColors;
    });
  };

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(null);
      }
    };

    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker]);

  // Close actions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdownId]);

  // Drag and drop handlers
  const handleDragStart = (productId: string) => {
    setDraggedProductId(productId);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(targetIndex);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedProductId) return;

    // Get the current position of the dragged product
    const draggedPosition = productPositions[draggedProductId];

    // Check if target position is occupied by another product
    const targetProductId = Object.entries(productPositions).find(
      ([productId, position]) => productId !== draggedProductId && position === targetIndex
    )?.[0];

    setProductPositions(prev => {
      const updated = { ...prev };

      if (targetProductId) {
        // Swap positions: move target product to dragged product's old position
        updated[targetProductId] = draggedPosition;
        updated[draggedProductId] = targetIndex;
      } else {
        // Just move to empty position
        updated[draggedProductId] = targetIndex;
      }

      return updated;
    });

    setDraggedProductId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedProductId(null);
    setDragOverIndex(null);
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading your products...</p>
      </div>
    );
  }

  const handleOpenBundleModal = () => {
    setEditingBundle(null);
    setShowBundleModal(true);
  };

  const handleEditBundle = (bundle: CPGFinishedProduct) => {
    setEditingBundle(bundle);
    setShowBundleModal(true);
  };

  const handleCloseBundleModal = () => {
    setShowBundleModal(false);
    setEditingBundle(null);
  };

  const handleBundleSuccess = () => {
    loadProducts();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Finished Products</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button variant="purple" size="md" onClick={handleOpenBundleModal}>
            + Bundle Products
          </Button>
          <Button variant="gold" size="md" onClick={handleAddProduct}>
            + Add Product
          </Button>
        </div>
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
          <Button variant="gold" size="md" onClick={handleAddProduct}>
            + Add Your First Product
          </Button>
        </div>
      ) : (
        <div className={styles.productGrid} role="list" aria-label="Finished Products">
          {(() => {
            // Filter visible products
            const visibleProducts = products.filter(p => showArchived || p.deleted_at === null);

            // Calculate grid size needed
            const maxPosition = Math.max(
              ...visibleProducts.map(p => productPositions[p.id] ?? 0),
              visibleProducts.length - 1
            );
            const gridSize = Math.max(maxPosition + 10, 20); // At least 20 cells, or max position + 10

            // Create a map of position -> product
            const positionMap: Record<number, typeof visibleProducts[0]> = {};
            visibleProducts.forEach(product => {
              const position = productPositions[product.id];
              if (position !== undefined) {
                positionMap[position] = product;
              }
            });

            // Render grid cells
            return Array.from({ length: gridSize }).map((_, index) => {
              const product = positionMap[index];

              // Empty cell (drop zone)
              if (!product) {
                return (
                  <div
                    key={`empty-${index}`}
                    className={styles.emptyGridCell}
                    style={{
                      border: dragOverIndex === index ? '2px dashed #D4AF37' : '2px dashed transparent',
                      background: dragOverIndex === index ? '#FFF8DC' : 'transparent',
                      borderRadius: '12px',
                      minHeight: '200px',
                      transition: 'all 0.2s ease',
                    }}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                  />
                );
              }

              // Product card
              const isArchived = product.deleted_at !== null;
              const bgColor = cardColors[product.id] || '#ffffff';
              const isDragging = draggedProductId === product.id;

              return (
                <article
                  key={product.id}
                  className={styles.productCard}
                  role="listitem"
                  draggable={!isArchived}
                  onDragStart={() => handleDragStart(product.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  style={{
                    opacity: isDragging ? 0.5 : (isArchived ? 0.6 : 1),
                    backgroundColor: isArchived ? '#f8f9fa' : bgColor,
                    position: 'relative',
                    cursor: isArchived ? 'default' : 'grab',
                    border: dragOverIndex === index ? '3px solid #B8860B' : undefined,
                  }}
                >
                  {/* Color Picker Button */}
                  {!isArchived && (
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                      <button
                        onClick={() => setShowColorPicker(showColorPicker === product.id ? null : product.id)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          border: '2px solid #64748b',
                          background: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                        }}
                        title="Change card color"
                      >
                        🎨
                      </button>

                      {/* Color Picker Dropdown */}
                      {showColorPicker === product.id && (
                        <div
                          ref={colorPickerRef}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '0.5rem',
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '1rem',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 10,
                            minWidth: '200px',
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 600 }}>
                            CARD COLOR
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            {['#E8D4A0', '#f3e8ff', '#e9d5ff', '#E5D8DB', '#D5E8E5', '#E8E0D5', '#D8E5D8', '#E0D8E8'].map(color => (
                              <button
                                key={color}
                                onClick={() => {
                                  handleCardColorChange(product.id, color);
                                  setShowColorPicker(null);
                                }}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '6px',
                                  border: cardColors[product.id] === color ? '3px solid #D4AF37' : '1px solid #e5e7eb',
                                  background: color,
                                  cursor: 'pointer',
                                }}
                              />
                            ))}
                          </div>
                          <div style={{ marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                              Custom HEX
                            </label>
                            <input
                              type="text"
                              placeholder="#E8D4A0"
                              maxLength={7}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e5e7eb',
                                borderRadius: '4px',
                                fontSize: '0.875rem',
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const value = e.currentTarget.value;
                                  if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                    handleCardColorChange(product.id, value);
                                    setShowColorPicker(null);
                                  }
                                }
                              }}
                            />
                          </div>
                          <button
                            onClick={() => {
                              resetCardColor(product.id);
                              setShowColorPicker(null);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              background: 'white',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#64748b',
                              cursor: 'pointer',
                            }}
                          >
                            Reset to Default
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.productHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 className={styles.productName}>{product.name}</h3>
                      {product.is_bundle && (
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}
                        >
                          Bundle
                        </span>
                      )}
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

                  {/* Bundle Contents */}
                  {product.is_bundle && product.bundle_items && (
                    <div style={{
                      padding: '0.75rem',
                      background: '#f5f3ff',
                      borderRadius: '6px',
                      marginBottom: '0.5rem',
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#6b21a8',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        Bundle Contents
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {product.bundle_items.map((item, idx) => {
                          const bundledProduct = products.find(p => p.id === item.product_id);
                          return (
                            <div
                              key={idx}
                              style={{
                                fontSize: '0.8125rem',
                                color: '#4c1d95',
                                display: 'flex',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>{bundledProduct?.name || 'Unknown Product'}</span>
                              <span style={{ fontWeight: 600 }}>×{item.quantity}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className={styles.productDetails}>
                    {product.msrp && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Selling Price</span>
                        <span className={styles.detailValue}>{formatCurrency(parseFloat(product.msrp))}</span>
                      </div>
                    )}
                    {!product.is_bundle && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Unit:</span>
                        <span className={styles.detailValue}>
                          {product.unit_of_measure} ({product.pieces_per_unit} per unit)
                        </span>
                      </div>
                    )}

                    {/* CPU Breakdown with Labor */}
                    {(() => {
                      const materialCPU = productCPUs.get(product.id);
                      const laborCost = productLaborCosts.get(product.id) || '0.000000';
                      const hasLaborCost = parseFloat(laborCost) > 0;
                      const hasMaterialCPU = materialCPU !== null && materialCPU !== undefined;

                      if (!hasMaterialCPU) {
                        return (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>CPU:</span>
                            <span className={styles.detailValue}>N/A</span>
                          </div>
                        );
                      }

                      const totalCPU = parseFloat(materialCPU) + parseFloat(laborCost);

                      if (hasLaborCost) {
                        return (
                          <>
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Materials:</span>
                              <span className={styles.detailValue}>{formatCurrency(parseFloat(materialCPU))}</span>
                            </div>
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Labor:</span>
                              <span className={styles.detailValue} style={{ color: '#D4AF37' }}>+{formatCurrency(parseFloat(laborCost))}</span>
                            </div>
                            <div className={styles.detailRow} style={{
                              paddingTop: '0.5rem',
                              borderTop: '1px solid rgba(0,0,0,0.1)',
                              marginTop: '0.25rem'
                            }}>
                              <span className={styles.detailLabel} style={{ fontWeight: 700 }}>Total CPU:</span>
                              <span className={styles.detailValue} style={{ fontWeight: 700, color: '#D4AF37' }}>
                                {formatCurrency(totalCPU)}
                              </span>
                            </div>
                          </>
                        );
                      } else {
                        return (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>CPU:</span>
                            <span className={styles.detailValue}>{formatCurrency(parseFloat(materialCPU))}</span>
                          </div>
                        );
                      }
                    })()}
                  </div>

                  <div className={styles.productActions}>
                    {!isArchived ? (
                      <>
                        {product.is_bundle ? (
                          <>
                            <Button
                              variant="purple"
                              size="sm"
                              onClick={() => handleEditBundle(product)}
                            >
                              Edit Bundle
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
                          <>
                            {/* Actions Dropdown */}
                            <div style={{ position: 'relative' }}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)}
                                style={{ minWidth: '100px' }}
                              >
                                Actions ▼
                              </Button>

                              {openDropdownId === product.id && (
                                <div
                                  ref={dropdownRef}
                                  style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 0.25rem)',
                                    left: 0,
                                    background: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    zIndex: 100,
                                    minWidth: '150px',
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      handleEditProduct(product);
                                      setOpenDropdownId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '0.625rem 0.875rem',
                                      border: 'none',
                                      background: 'none',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontSize: '0.875rem',
                                      color: '#374151',
                                      borderBottom: '1px solid #f3f4f6',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                  >
                                    Edit / Modify
                                  </button>

                                  <button
                                    onClick={() => handleDuplicateProduct(product)}
                                    style={{
                                      width: '100%',
                                      padding: '0.625rem 0.875rem',
                                      border: 'none',
                                      background: 'none',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontSize: '0.875rem',
                                      color: '#374151',
                                      borderBottom: '1px solid #f3f4f6',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                  >
                                    Duplicate
                                  </button>

                                  <button
                                    onClick={() => {
                                      handleShowDeleteConfirmation(product.id);
                                      setOpenDropdownId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '0.625rem 0.875rem',
                                      border: 'none',
                                      background: 'none',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontSize: '0.875rem',
                                      color: '#dc2626',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                  >
                                    Archive
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Recipe Button - Separate */}
                            <Button
                              variant="purple"
                              size="sm"
                              onClick={() => handleOpenRecipe(product.id)}
                            >
                              Recipe
                            </Button>

                            {/* Labor Button - Separate */}
                            <Button
                              variant="gold"
                              size="sm"
                              onClick={() => handleOpenLabor(product)}
                            >
                              Labor
                            </Button>
                          </>
                        )}
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
            });
          })()}
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

      {/* Bundle Products Modal */}
      <BundleProductsModal
        isOpen={showBundleModal}
        onClose={handleCloseBundleModal}
        onSuccess={handleBundleSuccess}
        editingBundle={editingBundle}
      />

      {/* Labor Assignment Modal */}
      {laborProductId && (
        <LaborAssignmentModal
          isOpen={showLaborModal}
          onClose={handleCloseLaborModal}
          onSuccess={handleLaborSuccess}
          productId={laborProductId}
          productName={laborProductName}
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
                variant="gold"
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
