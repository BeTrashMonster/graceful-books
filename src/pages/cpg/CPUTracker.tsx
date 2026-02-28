/**
 * CPU Tracker Page
 *
 * Implements Group C1: CPU Tracker Page for CPG Module
 *
 * Features:
 * - Invoice entry form with line-by-line cost attribution
 * - Current CPU display for all variants
 * - Historical CPU timeline
 * - Category and variant management
 *
 * Requirements:
 * - CPG_MODULE_ROADMAP.md Group C1
 * - AGENT_REVIEW_PROD_CHECKLIST.md
 * - User-defined variants (not hardcoded Small/Large)
 * - Clean & seamless UX (not clunky or overwhelming)
 * - Progressive disclosure of advanced features
 * - Real-time CPU calculation updates
 * - WCAG 2.1 AA compliance
 */

import { useState, useEffect } from 'react';
import { Button } from '../../components/core/Button';
import { AddInvoiceModal } from '../../components/cpg/modals/AddInvoiceModal';
import { CPUDisplay } from '../../components/cpg/CPUDisplay';
import { CPUTimeline } from '../../components/cpg/CPUTimeline';
import { CategoryManager } from '../../components/cpg/CategoryManager';
import { InvoiceDetailsModal } from '../../components/cpg/modals/InvoiceDetailsModal';
import { useAuth } from '../../contexts/AuthContext';
import { cpuCalculatorService } from '../../services/cpg/cpuCalculator.service';
import { db } from '../../db/database';
import type { CPGCategory, CPGInvoice } from '../../db/schema/cpg.schema';
import type { CPUHistoryEntry } from '../../services/cpg/cpuCalculator.service';
import styles from './CPUTracker.module.css';

type CPUTrackerTab = 'products' | 'raw-materials' | 'comparison';

export default function CPUTracker() {
  const { companyId } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<CPUTrackerTab>('products');

  // State
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [invoices, setInvoices] = useState<CPGInvoice[]>([]);
  const [cpuHistory, setCPUHistory] = useState<CPUHistoryEntry[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Product filters for Tab 1
  const [productSearchFilter, setProductSearchFilter] = useState<string>('');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [productSortBy, setProductSortBy] = useState<'name' | 'cpu-asc' | 'cpu-desc' | 'missing'>('name');

  // Raw materials filters for Tab 2
  const [rawMaterialsDateRange, setRawMaterialsDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
    end: new Date().toISOString().split('T')[0], // today
  });
  const [rawMaterialsCategoryFilter, setRawMaterialsCategoryFilter] = useState<string | undefined>(undefined);
  const [rawMaterialsVariantFilter, setRawMaterialsVariantFilter] = useState<string>('');
  const [rawMaterialsVendorFilter, setRawMaterialsVendorFilter] = useState<string>('');

  // Product comparison for Tab 3
  const [selectedProductsForComparison, setSelectedProductsForComparison] = useState<Set<string>>(new Set());

  // Load data
  useEffect(() => {
    loadData();
  }, [companyId, showArchived]);

  // Listen for data updates from modals (e.g., category added from Getting Started card)
  useEffect(() => {
    const handleDataUpdate = () => {
      console.log('CPUTracker: Received data update event, reloading...');
      loadData();
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleDataUpdate);
  }, [companyId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load categories
      const categoriesData = await db.cpgCategories
        .where('company_id')
        .equals(companyId)
        .filter(cat => cat.active && cat.deleted_at === null)
        .sortBy('sort_order');

      setCategories(categoriesData);

      // Load invoices (include archived if showArchived is true)
      const invoicesData = await db.cpgInvoices
        .where('company_id')
        .equals(companyId)
        .filter(inv => showArchived || (inv.active && inv.deleted_at === null))
        .reverse()
        .sortBy('invoice_date');

      setInvoices(invoicesData);

      // Check if any invoices are missing calculated_cpus and fix them
      const invoicesNeedingRecalculation = invoicesData.filter(inv => !inv.calculated_cpus);
      if (invoicesNeedingRecalculation.length > 0) {
        console.log(`🔧 Found ${invoicesNeedingRecalculation.length} invoices without CPU calculations. Recalculating...`);
        await cpuCalculatorService.recalculateAllCPUs(companyId);
        // Notify other components to reload
        window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'auto-recalculation' } }));
      }

      // Load finished products
      const productsData = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .filter(prod => prod.active && prod.deleted_at === null)
        .toArray();

      setFinishedProducts(productsData);

      // Load CPU history
      const history = await cpuCalculatorService.getCPUHistory(
        companyId,
        selectedCategoryFilter,
        showArchived
      );
      setCPUHistory(history);

    } catch (err) {
      console.error('Failed to load CPU tracker data:', err);
      setError('Oops! We had trouble loading your cost data. Let\'s try that again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvoiceSaved = async () => {
    setShowInvoiceForm(false);
    await loadData();
  };

  const handleCategoriesUpdated = async () => {
    await loadData();
  };

  const handleCategoryFilterChange = async (categoryId: string | undefined) => {
    setSelectedCategoryFilter(categoryId);

    // Reload history with new filter
    try {
      const history = await cpuCalculatorService.getCPUHistory(
        companyId,
        categoryId,
        showArchived
      );
      setCPUHistory(history);
    } catch (err) {
      console.error('Failed to filter CPU history:', err);
    }
  };

  const handleManualRecalculate = async () => {
    setIsRecalculating(true);
    try {
      console.log('🔧 Manually recalculating all CPUs...');
      await cpuCalculatorService.recalculateAllCPUs(companyId);
      console.log('✅ Recalculation complete!');

      // Dispatch event to notify CPUDisplay and other components
      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'recalculation' } }));

      await loadData();
    } catch (err) {
      console.error('Failed to recalculate CPUs:', err);
      setError('Failed to recalculate costs. Please try again.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleArchiveInvoice = async (invoiceId: string) => {
    try {
      setError(null);

      // Archive invoice (soft delete)
      await db.cpgInvoices.update(invoiceId, {
        deleted_at: Date.now(),
        active: false,
        updated_at: Date.now(),
      });

      // Reload data
      await loadData();
    } catch (err) {
      console.error('Failed to archive invoice:', err);
      setError('Oops! We had trouble archiving that invoice. Please try again.');
    }
  };

  const handleUnarchiveInvoice = async (invoiceId: string) => {
    try {
      setError(null);

      await db.cpgInvoices.update(invoiceId, {
        deleted_at: null,
        active: true,
        updated_at: Date.now(),
      });

      // Reload data
      await loadData();
    } catch (err) {
      console.error('Failed to unarchive invoice:', err);
      setError('Oops! We had trouble restoring that invoice. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className={styles.pageContainer}>
        <div className="page-content" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className={styles.loader} role="status" aria-label="Loading CPU tracker">
            <span className={styles.spinner} />
          </div>
          <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>
            Loading your cost data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className="page-header">
        <div className={styles.headerContent}>
          <div>
            <h1 className="page-title">Cost Per Unit Tracker</h1>
            {invoices.length === 0 && (
              <p className="page-description">
                Track your true costs with ease. Enter invoices once, and we'll calculate your Cost Per Unit (CPU) for each product variant automatically.
              </p>
            )}
          </div>

          <div className={styles.headerActions}>
            {invoices.some(inv => !inv.calculated_cpus) && (
              <Button
                variant="outline"
                size="md"
                onClick={handleManualRecalculate}
                disabled={isRecalculating}
                iconBefore={<span aria-hidden="true">🔧</span>}
              >
                {isRecalculating ? 'Recalculating...' : 'Fix Missing Costs'}
              </Button>
            )}

            <Button
              variant="outline"
              size="md"
              onClick={() => setShowCategoryManager(true)}
              iconBefore={<span aria-hidden="true">⚙️</span>}
            >
              Manage Categories
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => setShowInvoiceForm(true)}
              iconBefore={<span aria-hidden="true">+</span>}
            >
              New Invoice
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert" aria-live="polite">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className={styles.dismissButton}
          >
            ×
          </button>
        </div>
      )}

      <div className="page-content">
        {/* Getting Started - Show if no categories or invoices */}
        {categories.length === 0 && invoices.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon} aria-hidden="true">📦</div>
            <h2 className={styles.emptyStateTitle}>Let's Get Started!</h2>
            <p className={styles.emptyStateDescription}>
              To track your Cost Per Unit (CPU), you'll need to set up your cost categories first.
              These are the different components that make up your product (like Oil, Bottle, Box, etc.).
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowCategoryManager(true)}
              iconBefore={<span aria-hidden="true">⚙️</span>}
            >
              Set Up Categories
            </Button>
          </div>
        )}

        {/* Main Content - Show if categories exist */}
        {categories.length > 0 && (
          <>
            {/* Tab Navigation */}
            <div className={styles.tabs} role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === 'products'}
                aria-controls="products-panel"
                onClick={() => setActiveTab('products')}
                className={activeTab === 'products' ? styles.tabActive : styles.tab}
              >
                Product Costs
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'raw-materials'}
                aria-controls="raw-materials-panel"
                onClick={() => setActiveTab('raw-materials')}
                className={activeTab === 'raw-materials' ? styles.tabActive : styles.tab}
              >
                Raw Material Costs
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'comparison'}
                aria-controls="comparison-panel"
                onClick={() => setActiveTab('comparison')}
                className={activeTab === 'comparison' ? styles.tabActive : styles.tab}
              >
                Product Comparison
              </button>
            </div>

            {/* Tab 1: Product Costs */}
            {activeTab === 'products' && (
              <div id="products-panel" role="tabpanel" aria-labelledby="products-tab">
                {/* Current CPU Display */}
                <section className={styles.section} aria-labelledby="current-cpu-heading">
                  <div className={styles.sectionHeader}>
                    <h2 id="current-cpu-heading" className={styles.sectionTitle}>
                      Product Costs
                    </h2>

                    {/* Product Filters */}
                    <div className={styles.productFilters}>
                      {/* Search */}
                      <input
                        type="search"
                        placeholder="Search products..."
                        value={productSearchFilter}
                        onChange={(e) => setProductSearchFilter(e.target.value)}
                        className={styles.searchInput}
                        aria-label="Search products"
                      />

                      {/* Status Filter */}
                      <select
                        value={productStatusFilter}
                        onChange={(e) => setProductStatusFilter(e.target.value as 'all' | 'complete' | 'incomplete')}
                        className={styles.filterSelect}
                        aria-label="Filter by completion status"
                      >
                        <option value="all">All Products</option>
                        <option value="complete">Complete Only</option>
                        <option value="incomplete">Incomplete Only</option>
                      </select>

                      {/* Sort */}
                      <select
                        value={productSortBy}
                        onChange={(e) => setProductSortBy(e.target.value as any)}
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
                    searchFilter={productSearchFilter}
                    statusFilter={productStatusFilter}
                    sortBy={productSortBy}
                  />
                </section>
              </div>
            )}

            {/* Tab 2: Raw Material Costs (Invoice History) */}
            {activeTab === 'raw-materials' && (
              <div id="raw-materials-panel" role="tabpanel" aria-labelledby="raw-materials-tab">
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Raw Material Invoice History</h2>

                    {/* Raw Materials Filters */}
                    <div className={styles.rawMaterialsFilters}>
                      {/* Date Range */}
                      <div className={styles.dateRangeFilter}>
                        <label htmlFor="start-date" className={styles.filterLabel}>From:</label>
                        <input
                          type="date"
                          id="start-date"
                          value={rawMaterialsDateRange.start}
                          onChange={(e) => setRawMaterialsDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className={styles.dateInput}
                        />
                        <label htmlFor="end-date" className={styles.filterLabel}>To:</label>
                        <input
                          type="date"
                          id="end-date"
                          value={rawMaterialsDateRange.end}
                          onChange={(e) => setRawMaterialsDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className={styles.dateInput}
                        />
                      </div>

                      {/* Category Filter */}
                      <select
                        value={rawMaterialsCategoryFilter || ''}
                        onChange={(e) => setRawMaterialsCategoryFilter(e.target.value || undefined)}
                        className={styles.filterSelect}
                        aria-label="Filter by category"
                      >
                        <option value="">All Categories</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>

                      {/* Variant Filter */}
                      <input
                        type="search"
                        placeholder="Filter by variant..."
                        value={rawMaterialsVariantFilter}
                        onChange={(e) => setRawMaterialsVariantFilter(e.target.value)}
                        className={styles.searchInput}
                        aria-label="Filter by variant"
                        style={{ minWidth: '150px' }}
                      />

                      {/* Vendor Filter */}
                      <input
                        type="search"
                        placeholder="Filter by vendor..."
                        value={rawMaterialsVendorFilter}
                        onChange={(e) => setRawMaterialsVendorFilter(e.target.value)}
                        className={styles.searchInput}
                        aria-label="Filter by vendor"
                        style={{ minWidth: '150px' }}
                      />
                    </div>
                  </div>

                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                    View all vendor invoices and track raw material costs over time.
                  </p>

                  {/* Invoice History Table */}
                  <div className={styles.invoiceTable}>
                    {invoices.filter(inv => {
                      // Date filter
                      const invDate = new Date(inv.invoice_date);
                      const startDate = new Date(rawMaterialsDateRange.start);
                      const endDate = new Date(rawMaterialsDateRange.end);
                      if (invDate < startDate || invDate > endDate) return false;

                      // Vendor filter
                      if (rawMaterialsVendorFilter && !inv.vendor_name.toLowerCase().includes(rawMaterialsVendorFilter.toLowerCase())) {
                        return false;
                      }

                      // Category filter
                      if (rawMaterialsCategoryFilter && !inv.cost_attribution?.some(attr => attr.category_id === rawMaterialsCategoryFilter)) {
                        return false;
                      }

                      // Variant filter
                      if (rawMaterialsVariantFilter && !inv.cost_attribution?.some(attr =>
                        attr.variants?.some(v => v.variant_name?.toLowerCase().includes(rawMaterialsVariantFilter.toLowerCase()))
                      )) {
                        return false;
                      }

                      return true;
                    }).length === 0 ? (
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon} aria-hidden="true">📄</div>
                        <p className={styles.emptyText}>
                          No invoices found matching your filters.
                        </p>
                      </div>
                    ) : (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Vendor</th>
                            <th>Invoice #</th>
                            <th>Categories</th>
                            <th>Total Paid</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.filter(inv => {
                            // Date filter
                            const invDate = new Date(inv.invoice_date);
                            const startDate = new Date(rawMaterialsDateRange.start);
                            const endDate = new Date(rawMaterialsDateRange.end);
                            if (invDate < startDate || invDate > endDate) return false;

                            // Vendor filter
                            if (rawMaterialsVendorFilter && !inv.vendor_name.toLowerCase().includes(rawMaterialsVendorFilter.toLowerCase())) {
                              return false;
                            }

                            // Category filter
                            if (rawMaterialsCategoryFilter && !inv.cost_attribution?.some(attr => attr.category_id === rawMaterialsCategoryFilter)) {
                              return false;
                            }

                            // Variant filter
                            if (rawMaterialsVariantFilter && !inv.cost_attribution?.some(attr =>
                              attr.variants?.some(v => v.variant_name?.toLowerCase().includes(rawMaterialsVariantFilter.toLowerCase()))
                            )) {
                              return false;
                            }

                            return true;
                          }).map((invoice) => (
                            <tr key={invoice.id}>
                              <td>{new Date(invoice.invoice_date).toLocaleDateString()}</td>
                              <td>{invoice.vendor_name}</td>
                              <td>{invoice.invoice_number || '-'}</td>
                              <td>
                                {invoice.cost_attribution
                                  ? Object.values(invoice.cost_attribution).map(attr => {
                                      const category = categories.find(c => c.id === attr.category_id);
                                      return category?.name || 'Unknown';
                                    }).join(', ')
                                  : '-'}
                              </td>
                              <td>${typeof invoice.total_paid === 'number' ? invoice.total_paid.toFixed(2) : parseFloat(invoice.total_paid || '0').toFixed(2)}</td>
                              <td>
                                <button
                                  className={styles.actionButton}
                                  onClick={() => {
                                    setSelectedInvoiceId(invoice.id);
                                    setShowInvoiceDetails(true);
                                  }}
                                  aria-label={`View invoice ${invoice.invoice_number}`}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* Tab 3: Product Comparison */}
            {activeTab === 'comparison' && (
              <div id="comparison-panel" role="tabpanel" aria-labelledby="comparison-tab">
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Product Comparison</h2>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                    Select products to compare product costs, margins, and pricing side-by-side.
                  </p>

                  {finishedProducts.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon} aria-hidden="true">📦</div>
                      <p className={styles.emptyText}>
                        No finished products defined yet. Add your first product to start comparing.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Product Selection */}
                      <div className={styles.comparisonSelection}>
                        <h3 className={styles.subsectionTitle}>Select Products to Compare</h3>
                        <div className={styles.productCheckboxes}>
                          {finishedProducts.map((product) => {
                            const isSelected = selectedProductsForComparison.has(product.id);
                            return (
                              <label key={product.id} className={styles.checkboxLabel}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedProductsForComparison);
                                    if (e.target.checked) {
                                      newSet.add(product.id);
                                    } else {
                                      newSet.delete(product.id);
                                    }
                                    setSelectedProductsForComparison(newSet);
                                  }}
                                  className={styles.checkbox}
                                />
                                <span>{product.name}</span>
                                {product.sku && (
                                  <span className={styles.skuBadge}>{product.sku}</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                        {selectedProductsForComparison.size > 0 && (
                          <button
                            onClick={() => setSelectedProductsForComparison(new Set())}
                            className={styles.clearButton}
                          >
                            Clear Selection ({selectedProductsForComparison.size})
                          </button>
                        )}
                      </div>

                      {/* Comparison Table */}
                      {selectedProductsForComparison.size === 0 ? (
                        <div className={styles.selectPrompt}>
                          <p>Select at least one product above to see the comparison.</p>
                        </div>
                      ) : (
                        <div className={styles.comparisonTable}>
                          <h3 className={styles.subsectionTitle}>
                            Comparison Results ({selectedProductsForComparison.size} {selectedProductsForComparison.size === 1 ? 'Product' : 'Products'})
                          </h3>
                          <div className={styles.tableContainer}>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th>Metric</th>
                                  {Array.from(selectedProductsForComparison).map((productId) => {
                                    const product = finishedProducts.find(p => p.id === productId);
                                    return (
                                      <th key={productId}>
                                        <div className={styles.productHeader}>
                                          <span className={styles.productName}>{product?.name}</span>
                                          {product?.sku && (
                                            <span className={styles.skuBadge}>{product.sku}</span>
                                          )}
                                        </div>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {/* MSRP Row */}
                                <tr>
                                  <td className={styles.metricLabel}>MSRP</td>
                                  {Array.from(selectedProductsForComparison).map((productId) => {
                                    const product = finishedProducts.find(p => p.id === productId);
                                    return (
                                      <td key={productId}>
                                        {product?.msrp ? `$${product.msrp.toFixed(2)}` : '-'}
                                      </td>
                                    );
                                  })}
                                </tr>

                                {/* Status Row */}
                                <tr>
                                  <td className={styles.metricLabel}>Cost Data Status</td>
                                  {Array.from(selectedProductsForComparison).map((productId) => {
                                    const product = finishedProducts.find(p => p.id === productId);
                                    const hasRecipe = product?.recipe && product.recipe.length > 0;
                                    // Check if all components have cost data (simplified check)
                                    const isComplete = hasRecipe;
                                    return (
                                      <td key={productId}>
                                        <span className={isComplete ? styles.statusComplete : styles.statusIncomplete}>
                                          {isComplete ? '✓ Complete' : '⚠ Incomplete'}
                                        </span>
                                      </td>
                                    );
                                  })}
                                </tr>

                                {/* Recipe Components Count */}
                                <tr>
                                  <td className={styles.metricLabel}>Components</td>
                                  {Array.from(selectedProductsForComparison).map((productId) => {
                                    const product = finishedProducts.find(p => p.id === productId);
                                    const componentCount = product?.recipe?.length || 0;
                                    return (
                                      <td key={productId}>{componentCount}</td>
                                    );
                                  })}
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Help Text */}
                          <div className={styles.comparisonHelp}>
                            <span style={{ marginRight: '0.5rem' }}>ℹ️</span>
                            To see detailed CPU calculations and margins, ensure all products have complete recipe definitions and raw material cost data entered through vendor invoices.
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </div>
            )}
          </>
        )}

        {/* No invoices yet */}
        {categories.length > 0 && invoices.length === 0 && (
          <div className={styles.emptyInvoices}>
            <p className={styles.emptyInvoicesText}>
              You're all set! Now you can start entering invoices to track your costs.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowInvoiceForm(true)}
              iconBefore={<span aria-hidden="true">+</span>}
            >
              Enter Your First Invoice
            </Button>
          </div>
        )}
      </div>

      {/* Invoice Entry Form Modal */}
      {(showInvoiceForm || editingInvoiceId) && (
        <AddInvoiceModal
          isOpen={showInvoiceForm || !!editingInvoiceId}
          onClose={() => {
            setShowInvoiceForm(false);
            setEditingInvoiceId(null);
          }}
          onSuccess={handleInvoiceSaved}
          invoiceId={editingInvoiceId || undefined}
        />
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <CategoryManager
          companyId={companyId}
          categories={categories}
          onClose={() => setShowCategoryManager(false)}
          onSaved={handleCategoriesUpdated}
        />
      )}

      {/* Invoice Details Modal */}
      {showInvoiceDetails && selectedInvoiceId && (
        <InvoiceDetailsModal
          isOpen={showInvoiceDetails}
          onClose={() => {
            setShowInvoiceDetails(false);
            setSelectedInvoiceId(null);
          }}
          invoiceId={selectedInvoiceId}
          onEdit={(invoiceId) => {
            setEditingInvoiceId(invoiceId);
            setShowInvoiceForm(true);
          }}
        />
      )}
    </div>
  );
}
