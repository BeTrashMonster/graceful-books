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
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/core/Button';
import { AddInvoiceModal } from '../../components/cpg/modals/AddInvoiceModal';
// import { CPUTimeline } from '../../components/cpg/CPUTimeline'; // Unused for now
import { CategoryManager } from '../../components/cpg/CategoryManager';
import { InvoiceDetailsModal } from '../../components/cpg/modals/InvoiceDetailsModal';
import ProductsTab from './tabs/ProductsTab';
import RawMaterialsTab from './tabs/RawMaterialsTab';
import CostIntelligenceTab from './tabs/CostIntelligenceTab';
import { PinIcon } from '../../components/common/PinIcon';
import { useAuth } from '../../contexts/AuthContext';
import { cpuCalculatorService } from '../../services/cpg/cpuCalculator.service';
import { db } from '../../db/database';
import type { CPGCategory, CPGInvoice } from '../../db/schema/cpg.schema';
import { useTabPinning } from '../../hooks/useTabPinning';
import { PAGE_IDS } from '../../db/schema/tabPreferences.schema';
import styles from './CPUTracker.module.css';

type CPUTrackerTab = 'products' | 'raw-materials' | 'comparison';

export default function CPUTracker() {
  const { companyId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab pinning
  const { defaultTab, pinTab, unpinTab, isTabPinned, isLoading: isPinningLoading } = useTabPinning({
    pageId: PAGE_IDS.CPU_TRACKER,
  });

  // Tab State
  const [activeTab, setActiveTab] = useState<CPUTrackerTab>('products');
  const [pinnedTabs, setPinnedTabs] = useState<Record<string, boolean>>({});

  // URL parameter-based navigation state
  const [urlNavigationParams, setUrlNavigationParams] = useState<{
    intelligenceTab?: 'trends' | 'vendors';
    categoryId?: string;
    categoryIds?: string[];
    productIds?: string[];
    startDate?: number;
    endDate?: number;
  } | null>(null);

  // Update active tab when pinned default loads
  // BUT: Don't override if user is navigating from dashboard via URL params
  useEffect(() => {
    // Check urlNavigationParams state instead of searchParams
    // (searchParams gets cleared after navigation, but state persists)
    const hasUrlNavigation = urlNavigationParams !== null;

    console.log('🔧 Pinned tab effect running:', {
      isPinningLoading,
      defaultTab,
      hasUrlNavigation,
      urlNavigationParams,
      willApplyPinnedTab: !isPinningLoading && defaultTab && !hasUrlNavigation
    });

    if (!isPinningLoading && defaultTab && !hasUrlNavigation) {
      console.log('📌 Applying pinned default tab:', defaultTab);
      setActiveTab(defaultTab as CPUTrackerTab);
    }
  }, [defaultTab, isPinningLoading, urlNavigationParams]);

  // State
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [invoices, setInvoices] = useState<CPGInvoice[]>([]);
  // const [cpuHistory, setCPUHistory] = useState<CPUHistoryEntry[]>([]); // Reserved for future timeline feature
  const [finishedProducts, setFinishedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceFormMode, setInvoiceFormMode] = useState<'new' | 'edit' | 'duplicate'>('new');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | undefined>(undefined);
  const [showArchived] = useState(false); // Reserved for future archive feature
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Vendor Intel Navigation
  const [vendorIntelRequest, setVendorIntelRequest] = useState<{ vendorName: string } | null>(null);

  // Load pinned tabs state
  useEffect(() => {
    const loadPinnedState = async () => {
      const states: Record<string, boolean> = {};
      const tabs: CPUTrackerTab[] = ['products', 'raw-materials', 'comparison'];

      for (const tab of tabs) {
        states[tab] = await isTabPinned(tab);
      }

      setPinnedTabs(states);
    };

    loadPinnedState();
  }, [isTabPinned]);

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

  // Listen for vendor intel navigation requests
  useEffect(() => {
    const handleVendorNavigation = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.vendorName) {
        // Switch to Cost Intelligence tab with Vendor Intel sub-tab
        setActiveTab('comparison');
        setVendorIntelRequest({ vendorName: customEvent.detail.vendorName });
      }
    };

    window.addEventListener('navigate-to-vendor-intel', handleVendorNavigation);
    return () => window.removeEventListener('navigate-to-vendor-intel', handleVendorNavigation);
  }, []);

  // Handle URL parameter-based navigation from Financial Dashboard
  useEffect(() => {
    const tab = searchParams.get('tab');
    const intelligenceTab = searchParams.get('intelligenceTab') as 'trends' | 'vendors' | null;
    const categoryId = searchParams.get('categoryId');
    const categoryIds = searchParams.get('categoryIds');
    const productIds = searchParams.get('productIds');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('🔍 URL Navigation effect running:', {
      tab,
      intelligenceTab,
      categoryId,
      categoryIds,
      productIds,
      allParams: Object.fromEntries(searchParams.entries())
    });

    // If tab param is present, apply navigation
    if (tab === 'comparison' && intelligenceTab) {
      console.log('✅ URL navigation conditions met - setting activeTab to "comparison"');
      setActiveTab('comparison');

      const navParams = {
        intelligenceTab,
        categoryId: categoryId || undefined,
        categoryIds: categoryIds ? categoryIds.split(',') : undefined,
        productIds: productIds ? productIds.split(',') : undefined,
        startDate: startDate ? parseInt(startDate) : undefined,
        endDate: endDate ? parseInt(endDate) : undefined,
      };

      console.log('📝 Setting URL navigation params:', navParams);
      setUrlNavigationParams(navParams);

      // Clear URL params after applying them (keep URL clean)
      console.log('🧹 Clearing URL params');
      setSearchParams({});
    } else {
      console.log('⚠️ URL navigation conditions NOT met:', {
        hasTab: !!tab,
        tabValue: tab,
        hasIntelligenceTab: !!intelligenceTab,
        intelligenceTabValue: intelligenceTab
      });
    }
  }, [searchParams, setSearchParams]);

  const loadData = async () => {
    if (!companyId) {
      console.warn('No companyId available, skipping data load');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Load categories (include archived - CategoryManager handles filtering)
      const categoriesData = await db.cpgCategories
        .where('company_id')
        .equals(companyId)
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

      // TODO: Reserved for future CPU Timeline feature
      // Load CPU history
      // const history = await cpuCalculatorService.getCPUHistory(
      //   companyId,
      //   selectedCategoryFilter,
      //   showArchived
      // );
      // setCPUHistory(history);

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

  // Handle manual tab change (clears URL navigation state)
  const handleTabChange = (tab: CPUTrackerTab) => {
    console.log('👆 Manual tab click:', tab);
    setActiveTab(tab);
    // Clear URL navigation state so pinned defaults can work again
    setUrlNavigationParams(null);
  };

  // Handle tab pin toggle
  const handlePinToggle = async (tabId: CPUTrackerTab) => {
    const currentlyPinned = pinnedTabs[tabId];

    try {
      if (currentlyPinned) {
        await unpinTab();
        setPinnedTabs((prev) => ({ ...prev, [tabId]: false }));
      } else {
        await pinTab(tabId);
        // Unpin all other tabs
        setPinnedTabs({
          products: tabId === 'products',
          'raw-materials': tabId === 'raw-materials',
          comparison: tabId === 'comparison',
        });
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  // TODO: Reserved for future CPU Timeline feature
  // const handleCategoryFilterChange = async (categoryId: string | undefined) => {
  //   setSelectedCategoryFilter(categoryId);
  //
  //   // Reload history with new filter
  //   try {
  //     const history = await cpuCalculatorService.getCPUHistory(
  //       companyId,
  //       categoryId,
  //       showArchived
  //     );
  //     setCPUHistory(history);
  //   } catch (err) {
  //     console.error('Failed to filter CPU history:', err);
  //   }
  // };

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

  // TODO: Reserved for future Invoice Archive feature
  // const handleArchiveInvoice = async (invoiceId: string) => {
  //   try {
  //     setError(null);
  //
  //     // Archive invoice (soft delete)
  //     await db.cpgInvoices.update(invoiceId, {
  //       deleted_at: Date.now(),
  //       active: false,
  //       updated_at: Date.now(),
  //     });
  //
  //     // Reload data
  //     await loadData();
  //   } catch (err) {
  //     console.error('Failed to archive invoice:', err);
  //     setError('Oops! We had trouble archiving that invoice. Please try again.');
  //   }
  // };

  // TODO: Reserved for future Invoice Archive feature
  // const handleUnarchiveInvoice = async (invoiceId: string) => {
  //   try {
  //     setError(null);
  //
  //     await db.cpgInvoices.update(invoiceId, {
  //       deleted_at: null,
  //       active: true,
  //       updated_at: Date.now(),
  //     });
  //
  //     // Reload data
  //     await loadData();
  //   } catch (err) {
  //     console.error('Failed to unarchive invoice:', err);
  //     setError('Oops! We had trouble restoring that invoice. Please try again.');
  //   }
  // };

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
              variant="purple"
              size="md"
              onClick={() => setShowCategoryManager(true)}
            >
              Manage Categories
            </Button>

            <Button
              variant="gold"
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
              variant="gold"
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
                onClick={() => handleTabChange('products')}
                className={activeTab === 'products' ? styles.tabActive : styles.tab}
              >
                Product Costs
                <PinIcon
                  isPinned={pinnedTabs['products'] || false}
                  onClick={() => handlePinToggle('products')}
                  size={14}
                />
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'raw-materials'}
                aria-controls="raw-materials-panel"
                onClick={() => handleTabChange('raw-materials')}
                className={activeTab === 'raw-materials' ? styles.tabActive : styles.tab}
              >
                Invoices
                <PinIcon
                  isPinned={pinnedTabs['raw-materials'] || false}
                  onClick={() => handlePinToggle('raw-materials')}
                  size={14}
                />
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'comparison'}
                aria-controls="comparison-panel"
                onClick={() => handleTabChange('comparison')}
                className={activeTab === 'comparison' ? styles.tabActive : styles.tab}
              >
                Cost Intelligence
                <PinIcon
                  isPinned={pinnedTabs['comparison'] || false}
                  onClick={() => handlePinToggle('comparison')}
                  size={14}
                />
              </button>
            </div>

            {/* Tab 1: Product Costs */}
            {activeTab === 'products' && (
              <ProductsTab
                finishedProducts={finishedProducts}
                isLoading={isLoading}
              />
            )}

            {/* Tab 2: Invoices (Invoice History) */}
            {activeTab === 'raw-materials' && (
              <RawMaterialsTab
                companyId={companyId}
                invoices={invoices}
                categories={categories}
                onViewInvoice={(id) => {
                  setSelectedInvoiceId(id);
                  setShowInvoiceDetails(true);
                }}
                onEditInvoice={(id) => {
                  setEditingInvoiceId(id);
                  setInvoiceFormMode('edit');
                  setShowInvoiceForm(true);
                }}
                onDuplicateInvoice={(id) => {
                  setEditingInvoiceId(id);
                  setInvoiceFormMode('duplicate');
                  setShowInvoiceForm(true);
                }}
                onArchiveInvoice={async (id) => {
                  const invoice = invoices.find(inv => inv.id === id);
                  if (!invoice) return;
                  await db.cpgInvoices.update(invoice.id, {
                    deleted_at: Date.now(),
                    deleted_by: companyId,
                  });
                  await loadData();
                }}
              />
            )}

            {/* Tab 3: Cost Intelligence */}
            {activeTab === 'comparison' && (
              <CostIntelligenceTab
                companyId={companyId!}
                finishedProducts={finishedProducts}
                categories={categories}
                invoices={invoices}
                onOpenCategoryManager={() => setShowCategoryManager(true)}
                onViewInvoice={(id) => {
                  setSelectedInvoiceId(id);
                  setShowInvoiceDetails(true);
                }}
                onEditInvoice={(id) => {
                  setEditingInvoiceId(id);
                  setInvoiceFormMode('edit');
                  setShowInvoiceForm(true);
                }}
                onDuplicateInvoice={(id) => {
                  setEditingInvoiceId(id);
                  setInvoiceFormMode('duplicate');
                  setShowInvoiceForm(true);
                }}
                initialIntelligenceTab={urlNavigationParams?.intelligenceTab || (vendorIntelRequest ? 'vendors' : undefined)}
                initialVendorFilter={vendorIntelRequest?.vendorName}
                initialCategoryFilter={urlNavigationParams?.categoryId}
                initialCategoryFilters={urlNavigationParams?.categoryIds}
                initialProductFilters={urlNavigationParams?.productIds}
                initialStartDate={urlNavigationParams?.startDate}
                initialEndDate={urlNavigationParams?.endDate}
              />
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
              variant="gold"
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
            setInvoiceFormMode('new');
          }}
          onSuccess={handleInvoiceSaved}
          invoiceId={editingInvoiceId || undefined}
          mode={invoiceFormMode}
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
