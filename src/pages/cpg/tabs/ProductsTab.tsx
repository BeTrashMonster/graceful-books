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
  finishedProducts: any[]; // TODO: Add proper type from schema
  isLoading: boolean;
}

export default function ProductsTab({
  finishedProducts,
  isLoading,
}: ProductsTabProps) {
  // Tab-specific state
  const [selectedProductsTab1, setSelectedProductsTab1] = useState<Set<string>>(new Set());
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [productSortBy, setProductSortBy] = useState<'name' | 'cpu-asc' | 'cpu-desc' | 'missing'>('name');

  return (
    <div id="products-panel" role="tabpanel" aria-labelledby="products-tab">
      {/* Current CPU Display */}
      <section className={styles.section} aria-labelledby="current-cpu-heading">
        <CPUDisplay
          isLoading={isLoading}
          selectedProducts={selectedProductsTab1}
          statusFilter={productStatusFilter}
          sortBy={productSortBy}
          finishedProducts={finishedProducts}
          onProductSelectionChange={setSelectedProductsTab1}
          onStatusFilterChange={setProductStatusFilter}
          onSortByChange={setProductSortBy}
        />
      </section>
    </div>
  );
}
