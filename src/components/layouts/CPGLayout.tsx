/**
 * CPG Layout - Clean layout for standalone CPG product
 * 
 * No accounting software navigation, no phases - just CPG tools
 */

import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { CPGActionBar } from '../cpg/CPGActionBar';
import { AddCategoryModal } from '../cpg/modals/AddCategoryModal';
import { AddDistributorModal } from '../cpg/modals/AddDistributorModal';
import { AddInvoiceModal } from '../cpg/modals/AddInvoiceModal';
import { AddProductModal } from '../cpg/modals/AddProductModal';
import { CategoryManager } from '../cpg/CategoryManager';
import { DistributorManager } from '../cpg/DistributorManager';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import type { CPGCategory } from '../../db/schema/cpg.schema';
import styles from './CPGLayout.module.css';

type ModalType = 'add-invoice' | 'add-product' | 'add-distributor' | 'add-category' | 'manage-categories' | 'manage-distributors' | null;

export function CPGLayout() {
  const location = useLocation();
  const { companyId } = useAuth();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [returnToModal, setReturnToModal] = useState<ModalType>(null);
  const [categories, setCategories] = useState<CPGCategory[]>([]);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path);

  // Load categories for CategoryManager
  useEffect(() => {
    if (!companyId) return;

    const loadCategories = async () => {
      try {
        const cats = await db.cpgCategories
          .where('company_id')
          .equals(companyId)
          .filter(c => c.active && !c.deleted_at)
          .toArray();
        setCategories(cats);
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };

    loadCategories();

    // Listen for category updates
    const handleCategoryUpdate = () => {
      loadCategories();
    };

    window.addEventListener('cpg-data-updated', handleCategoryUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleCategoryUpdate);
  }, [companyId]);

  const handleAction = (action: string) => {
    switch (action) {
      case 'add-invoice':
        setActiveModal('add-invoice');
        break;
      case 'add-product':
        setActiveModal('add-product');
        break;
      case 'add-distributor':
        setActiveModal('add-distributor');
        break;
      case 'add-category':
        setActiveModal('add-category');
        break;
      case 'manage-categories':
        setActiveModal('manage-categories');
        break;
      case 'manage-distributors':
        setActiveModal('manage-distributors');
        break;
      case 'view-products':
        // Navigate to products page where user can add recipes
        window.location.href = '/cpg/products';
        break;
      case 'add-financial':
        // Scroll to the form area and focus first input
        setTimeout(() => {
          const firstInput = document.querySelector('select, input[type="date"]') as HTMLElement;
          firstInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstInput?.focus();
        }, 100);
        break;
      case 'add-promo':
      case 'add-data':
      case 'add-scenario':
        // TODO: Wire up these actions
        console.log('Action not yet implemented:', action);
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  const closeModal = () => setActiveModal(null);

  const handleNeedCategories = () => {
    // User tried to add invoice but needs categories first
    setReturnToModal('add-invoice');
    setActiveModal('add-category');
  };

  const handleCategorySuccess = () => {
    console.log('Category added successfully');

    // Trigger a custom event to notify all CPG pages to refresh their data
    window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'category' } }));

    // If we need to return to invoice modal, do it
    if (returnToModal === 'add-invoice') {
      setReturnToModal(null);
      setTimeout(() => {
        setActiveModal('add-invoice');
      }, 300); // Small delay for smooth transition
    }
  };

  const handleProductSuccess = () => {
    console.log('Product added successfully');

    // Trigger a custom event to notify all CPG pages to refresh their data
    window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'product' } }));

    // After adding first product, redirect to products page to add recipes
    // Small delay to allow the modal to close gracefully
    setTimeout(() => {
      if (window.location.pathname === '/cpg') {
        window.location.href = '/cpg/products';
      }
    }, 500);
  };

  const handleCategoryManagerSaved = () => {
    console.log('Category manager saved');

    // Trigger a custom event to notify all CPG pages to refresh their data
    window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'category' } }));
  };

  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <h1>CPG Tools</h1>
          <p>Cost & Distribution Analysis</p>
        </div>

        <div className={styles.nav}>
          <div className={styles.section}>
            <h3>Tools</h3>
            <Link
              to="/cpg"
              className={isActive('/cpg') && location.pathname === '/cpg' ? styles.active : ''}
            >
              🏠 Dashboard
            </Link>
            <Link
              to="/cpg/products"
              className={isActive('/cpg/products') ? styles.active : ''}
            >
              📦 My Products
            </Link>
            <Link
              to="/cpg/cpu-tracker"
              className={isActive('/cpg/cpu-tracker') ? styles.active : ''}
            >
              📊 CPU Tracker
            </Link>
            <Link
              to="/cpg/distribution-cost"
              className={isActive('/cpg/distribution-cost') ? styles.active : ''}
            >
              🚚 Distribution Costs
            </Link>
            <Link
              to="/cpg/promo-decision"
              className={isActive('/cpg/promo-decision') ? styles.active : ''}
            >
              💰 Promo Analysis
            </Link>
            <Link
              to="/cpg/financial-entry"
              className={isActive('/cpg/financial-entry') ? styles.active : ''}
            >
              📝 Financial Entry
            </Link>
            <Link
              to="/cpg/analytics"
              className={isActive('/cpg/analytics') ? styles.active : ''}
            >
              📈 Analytics
            </Link>
            <Link
              to="/cpg/scenario-planning"
              className={isActive('/cpg/scenario-planning') ? styles.active : ''}
            >
              🎯 Scenario Planning
            </Link>
          </div>

          <div className={styles.section}>
            <h3>Reports</h3>
            <Link 
              to="/cpg/reports/profit-loss" 
              className={isActive('/cpg/reports/profit-loss') ? styles.active : ''}
            >
              P&L Report
            </Link>
            <Link 
              to="/cpg/reports/distribution-cost" 
              className={isActive('/cpg/reports/distribution-cost') ? styles.active : ''}
            >
              Distribution Report
            </Link>
            <Link 
              to="/cpg/reports/gross-margin" 
              className={isActive('/cpg/reports/gross-margin') ? styles.active : ''}
            >
              Gross Margin Report
            </Link>
            <Link 
              to="/cpg/reports/trade-spend" 
              className={isActive('/cpg/reports/trade-spend') ? styles.active : ''}
            >
              Trade Spend Report
            </Link>
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        <CPGActionBar onAction={handleAction} />
        <Outlet context={{ onAction: handleAction }} />

        {/* Modals */}
        <AddCategoryModal
          isOpen={activeModal === 'add-category'}
          onClose={closeModal}
          onSuccess={handleCategorySuccess}
        />
        <AddProductModal
          isOpen={activeModal === 'add-product'}
          onClose={closeModal}
          onSuccess={handleProductSuccess}
        />
        <AddDistributorModal
          isOpen={activeModal === 'add-distributor'}
          onClose={closeModal}
          onSuccess={() => {
            console.log('Distributor added successfully');
          }}
        />
        <AddInvoiceModal
          isOpen={activeModal === 'add-invoice'}
          onClose={closeModal}
          onSuccess={() => {
            console.log('Invoice added successfully');
          }}
          onNeedCategories={handleNeedCategories}
        />
        {activeModal === 'manage-categories' && companyId && (
          <CategoryManager
            companyId={companyId}
            categories={categories}
            onClose={closeModal}
            onSaved={handleCategoryManagerSaved}
          />
        )}
        <DistributorManager
          isOpen={activeModal === 'manage-distributors'}
          onClose={closeModal}
        />
      </main>
    </div>
  );
}
