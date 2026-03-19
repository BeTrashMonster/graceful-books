/**
 * CPG Layout - Clean layout for standalone CPG product
 * 
 * No accounting software navigation, no phases - just CPG tools
 */

import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { AddCategoryModal } from '../cpg/modals/AddCategoryModal';
import { AddInvoiceModal } from '../cpg/modals/AddInvoiceModal';
import { AddProductModal } from '../cpg/modals/AddProductModal';
import { DistributorProfileForm } from '../cpg/DistributorProfileForm';
import type { DistributorFormData } from '../cpg/DistributorProfileForm';
import { CategoryManager } from '../cpg/CategoryManager';
import { DistributorManager } from '../cpg/DistributorManager';
import { Modal } from '../modals/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import type { CPGCategory } from '../../db/schema/cpg.schema';
import { v4 as uuidv4 } from 'uuid';
import styles from './CPGLayout.module.css';

type ModalType = 'add-invoice' | 'add-product' | 'add-distributor' | 'add-category' | 'manage-categories' | 'manage-distributors' | null;

export function CPGLayout() {
  const location = useLocation();
  const { companyId, deviceId } = useAuth();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [returnToModal, setReturnToModal] = useState<ModalType>(null);
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [savingDistributor, setSavingDistributor] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

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

  const handleCreateDistributor = async (data: DistributorFormData) => {
    if (!companyId) return;

    setSavingDistributor(true);
    try {
      const distributor = {
        id: uuidv4(),
        company_id: companyId,
        device_id: deviceId || 'default',
        name: data.name,
        description: data.description,
        contact_info: data.contact_info,
        fee_structure: data.fee_structure,
        last_fee_update_date: data.last_fee_update_date,
        typical_update_frequency: data.typical_update_frequency,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
      };

      await db.cpgDistributors.add(distributor);

      // Trigger a custom event to notify all CPG pages to refresh their data
      window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));

      closeModal();
    } catch (error) {
      console.error('Error creating distributor:', error);
      throw error;
    } finally {
      setSavingDistributor(false);
    }
  };

  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <img src="/assets/audacious-logo.png" alt="Audacious" className={styles.logoImage} />
          <h1>Money</h1>
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
              🚚 Distribution Center
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
              to="/cpg/strategy-planning"
              className={isActive('/cpg/strategy-planning') ? styles.active : ''}
            >
              🎯 Strategy Planning
            </Link>
          </div>

          <div className={styles.section}>
            <button
              className={styles.quickAddButton}
              onClick={() => setShowQuickAdd(!showQuickAdd)}
            >
              <span className={styles.quickAddIcon}>+</span>
              <span>Quick Add</span>
              <span className={styles.quickAddArrow}>{showQuickAdd ? '▼' : '▶'}</span>
            </button>
            {showQuickAdd && (
              <div className={styles.quickAddDropdown}>
                <button onClick={() => { handleAction('add-invoice'); setShowQuickAdd(false); }}>
                  📄 Add Invoice
                </button>
                <button onClick={() => { handleAction('add-product'); setShowQuickAdd(false); }}>
                  📦 Add Product
                </button>
                <button onClick={() => { handleAction('add-category'); setShowQuickAdd(false); }}>
                  🏷️ Add Category
                </button>
                <button onClick={() => { handleAction('add-distributor'); setShowQuickAdd(false); }}>
                  🚚 Add Distributor
                </button>
              </div>
            )}
          </div>

        </div>

        <div className={styles.bottomNav}>
          <Link
            to="/cpg/settings"
            className={isActive('/cpg/settings') ? styles.active : ''}
          >
            ⚙️ Settings
          </Link>
        </div>
      </nav>

      <main className={styles.main}>
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
        {activeModal === 'add-distributor' && (
          <Modal
            isOpen={activeModal === 'add-distributor'}
            onClose={closeModal}
            title="Add New Distributor"
            closeOnBackdropClick={false}
            size="lg"
          >
            <DistributorProfileForm
              onSubmit={handleCreateDistributor}
              onCancel={closeModal}
              loading={savingDistributor}
            />
          </Modal>
        )}
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
