/**
 * Products Tab Component
 *
 * Displays product costs with filtering and sorting capabilities.
 *
 * Features:
 * - Product selection (multi-select dropdown)
 * - Status filtering (all, complete, incomplete)
 * - Sorting (name, CPU ascending/descending, missing components)
 * - Integration with CPUDisplay component
 *
 * Requirements:
 * - Clean component boundaries
 * - Single responsibility (product cost visualization)
 * - WCAG 2.1 AA compliance
 * - 90%+ test coverage
 */

import { useState } from 'react';
import { CPUDisplay } from '../../../components/cpg/CPUDisplay';
import styles from '../CPUTracker.module.css';

export interface ProductsTabProps {
  companyId: string;
  finishedProducts: any[]; // TODO: Add proper type from schema
  isLoading: boolean;
}

export default function ProductsTab({
  companyId,
  finishedProducts,
  isLoading,
}: ProductsTabProps) {
  // Tab-specific state
  const [selectedProductsTab1, setSelectedProductsTab1] = useState<Set<string>>(new Set());
  const [showProductSelectorTab1, setShowProductSelectorTab1] = useState(false);
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [productSortBy, setProductSortBy] = useState<'name' | 'cpu-asc' | 'cpu-desc' | 'missing'>('name');

  return (
    <div id="products-panel" role="tabpanel" aria-labelledby="products-tab">
      {/* Current CPU Display */}
      <section className={styles.section} aria-labelledby="current-cpu-heading">
        <div className={styles.sectionHeader}>
          <h2 id="current-cpu-heading" className={styles.sectionTitle}>
            Product Costs
          </h2>

          {/* Product Filters */}
          <div className={styles.productFilters}>
            {/* Product Selector Dropdown */}
            <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
              <button
                onClick={() => setShowProductSelectorTab1(!showProductSelectorTab1)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                aria-label="Select products to display"
                aria-expanded={showProductSelectorTab1}
              >
                <span>
                  {selectedProductsTab1.size === 0
                    ? 'All Products'
                    : selectedProductsTab1.size === finishedProducts.length
                    ? 'All Products Selected'
                    : `${selectedProductsTab1.size} Product${selectedProductsTab1.size === 1 ? '' : 's'} Selected`}
                </span>
                <span aria-hidden="true">{showProductSelectorTab1 ? '▲' : '▼'}</span>
              </button>

              {showProductSelectorTab1 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '0.25rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 10,
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
                role="menu"
                >
                  {/* Select All / Clear All */}
                  <div style={{
                    padding: '0.5rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '0.5rem',
                  }}>
                    <button
                      onClick={() => setSelectedProductsTab1(new Set(finishedProducts.map(p => p.id)))}
                      style={{
                        flex: 1,
                        padding: '0.25rem 0.5rem',
                        background: '#4b006e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      aria-label="Select all products"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedProductsTab1(new Set())}
                      style={{
                        flex: 1,
                        padding: '0.25rem 0.5rem',
                        background: '#f8fafc',
                        color: '#64748b',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      aria-label="Clear all product selections"
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Product List */}
                  {finishedProducts.map(product => (
                    <label
                      key={product.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f8fafc',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProductsTab1.has(product.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedProductsTab1);
                          if (e.target.checked) {
                            newSet.add(product.id);
                          } else {
                            newSet.delete(product.id);
                          }
                          setSelectedProductsTab1(newSet);
                        }}
                        style={{ marginRight: '0.5rem' }}
                        aria-label={`Select ${product.name}`}
                      />
                      <span style={{ fontSize: '0.875rem' }}>{product.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={productStatusFilter}
              onChange={(e) => setProductStatusFilter(e.target.value as 'all' | 'complete' | 'incomplete')}
              className={styles.filterSelect}
              aria-label="Filter by completion status"
            >
              <option value="all">Status: All</option>
              <option value="complete">Status: Complete</option>
              <option value="incomplete">Status: Incomplete</option>
            </select>

            {/* Sort */}
            <select
              value={productSortBy}
              onChange={(e) => setProductSortBy(e.target.value as 'name' | 'cpu-asc' | 'cpu-desc' | 'missing')}
              className={styles.filterSelect}
              aria-label="Sort products"
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="cpu-asc">Sort: CPU (Low to High)</option>
              <option value="cpu-desc">Sort: CPU (High to Low)</option>
              <option value="missing">Sort: Missing Components</option>
            </select>
          </div>
        </div>

        <CPUDisplay
          isLoading={isLoading}
          selectedProducts={selectedProductsTab1}
          statusFilter={productStatusFilter}
          sortBy={productSortBy}
        />
      </section>
    </div>
  );
}
