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
import { Breadcrumbs } from '../../components/navigation/Breadcrumbs';
import { Button } from '../../components/core/Button';
import { InvoiceEntryForm } from '../../components/cpg/InvoiceEntryForm';
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

export default function CPUTracker() {
  const { companyId } = useAuth();
  const activeCompanyId = companyId || 'demo-company-id';

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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, [activeCompanyId, showArchived]);

  // Listen for data updates from modals (e.g., category added from Getting Started card)
  useEffect(() => {
    const handleDataUpdate = () => {
      console.log('CPUTracker: Received data update event, reloading...');
      loadData();
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleDataUpdate);
  }, [activeCompanyId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load categories
      const categoriesData = await db.cpgCategories
        .where('company_id')
        .equals(activeCompanyId)
        .filter(cat => cat.active && cat.deleted_at === null)
        .sortBy('sort_order');

      setCategories(categoriesData);

      // Load invoices (include archived if showArchived is true)
      const invoicesData = await db.cpgInvoices
        .where('company_id')
        .equals(activeCompanyId)
        .filter(inv => showArchived || (inv.active && inv.deleted_at === null))
        .reverse()
        .sortBy('invoice_date');

      setInvoices(invoicesData);

      // Check if any invoices are missing calculated_cpus and fix them
      const invoicesNeedingRecalculation = invoicesData.filter(inv => !inv.calculated_cpus);
      if (invoicesNeedingRecalculation.length > 0) {
        console.log(`🔧 Found ${invoicesNeedingRecalculation.length} invoices without CPU calculations. Recalculating...`);
        await cpuCalculatorService.recalculateAllCPUs(activeCompanyId);
      }

      // Load finished products
      const productsData = await db.cpgFinishedProducts
        .where('company_id')
        .equals(activeCompanyId)
        .filter(prod => prod.active && prod.deleted_at === null)
        .toArray();

      setFinishedProducts(productsData);

      // Load CPU history
      const history = await cpuCalculatorService.getCPUHistory(
        activeCompanyId,
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
        activeCompanyId,
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
      await cpuCalculatorService.recalculateAllCPUs(activeCompanyId);
      console.log('✅ Recalculation complete!');
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
      <div className="page">
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
    <div className="page">
      <Breadcrumbs />

      <div className="page-header">
        <div className={styles.headerContent}>
          <div>
            <h1 className="page-title">Cost Per Unit Tracker</h1>
            <p className="page-description">
              Track your true costs with ease. Enter invoices once, and we'll calculate your Cost Per Unit (CPU) for each product variant automatically.
            </p>
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
            {/* Current CPU Display */}
            <section className={styles.section} aria-labelledby="current-cpu-heading">
              <h2 id="current-cpu-heading" className={styles.sectionTitle}>
                Product Manufacturing Costs
              </h2>
              <CPUDisplay
                isLoading={isLoading}
              />
            </section>

            {/* Historical Timeline */}
            <section className={styles.section} aria-labelledby="history-heading">
              <div className={styles.sectionHeader}>
                <h2 id="history-heading" className={styles.sectionTitle}>
                  Cost History
                </h2>

                {/* Category Filter */}
                {categories.length > 1 && (
                  <div className={styles.filterGroup}>
                    <label htmlFor="category-filter" className={styles.filterLabel}>
                      Filter by category:
                    </label>
                    <select
                      id="category-filter"
                      value={selectedCategoryFilter || ''}
                      onChange={(e) => handleCategoryFilterChange(e.target.value || undefined)}
                      className={styles.filterSelect}
                    >
                      <option value="">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Show Archived Toggle */}
              {invoices.some(inv => inv.deleted_at !== null) && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showArchived}
                      onChange={(e) => setShowArchived(e.target.checked)}
                    />
                    <span>Show Archived Invoices</span>
                  </label>
                </div>
              )}

              <CPUTimeline
                history={cpuHistory}
                categories={categories}
                onInvoiceClick={(invoiceId) => {
                  setSelectedInvoiceId(invoiceId);
                  setShowInvoiceDetails(true);
                }}
                onArchiveInvoice={handleArchiveInvoice}
                onUnarchiveInvoice={handleUnarchiveInvoice}
              />
            </section>
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
      {showInvoiceForm && (
        <InvoiceEntryForm
          companyId={activeCompanyId}
          categories={categories}
          onClose={() => setShowInvoiceForm(false)}
          onSaved={handleInvoiceSaved}
        />
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <CategoryManager
          companyId={activeCompanyId}
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
        />
      )}
    </div>
  );
}
