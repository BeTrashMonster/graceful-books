/**
 * CPG Layout - Clean layout for standalone CPG product
 * 
 * No accounting software navigation, no phases - just CPG tools
 */

import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { AddCategoryModal } from '../cpg/modals/AddCategoryModal';
import { AddInvoiceModal } from '../cpg/modals/AddInvoiceModal';
import { AddProductModal } from '../cpg/modals/AddProductModal';
import { DistributorProfileForm } from '../cpg/DistributorProfileForm';
import type { DistributorFormData } from '../cpg/DistributorProfileForm';
import { CategoryManager } from '../cpg/CategoryManager';
import { DistributorManager } from '../cpg/DistributorManager';
import { Modal } from '../modals/Modal';
import { LeafIcon } from '../common/LeafIcon';
import { ReadOnlyBanner } from '../subscription/ReadOnlyBanner';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import type { CPGCategory } from '../../db/schema/cpg.schema';
import { UserFeaturePreferencesService } from '../../services/userFeaturePreferences.service';
import type { FeatureName } from '../../services/userFeaturePreferences.service';
import { v4 as uuidv4 } from 'uuid';
import styles from './CPGLayout.module.css';

type ModalType = 'add-invoice' | 'add-product' | 'add-distributor' | 'add-category' | 'manage-categories' | 'manage-distributors' | null;

export function CPGLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { companyId, deviceId, userIdentifier: userId } = useAuth();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [returnToModal, setReturnToModal] = useState<ModalType>(null);
  const [categories, setCategories] = useState<CPGCategory[]>([]);
  const [savingDistributor, setSavingDistributor] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [companyName, setCompanyName] = useState('My Company');
  const [userFeaturePrefs, setUserFeaturePrefs] = useState<Record<FeatureName, boolean>>({
    events: false,
    distribution: false,
    promos: false,
  });

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path);

  // Load user feature preferences
  useEffect(() => {
    if (!userId) return;

    const loadUserPreferences = async () => {
      try {
        console.log('🔍 Sidebar: Loading preferences for userId:', userId);
        const prefsService = new UserFeaturePreferencesService(db);
        const prefs = await prefsService.getUserPreferences(userId);
        console.log('📋 Sidebar: Loaded user preferences from DB:', prefs);
        setUserFeaturePrefs(prev => {
          console.log('🔄 Sidebar: Updating userFeaturePrefs from', prev, 'to', prefs);
          return prefs;
        });
      } catch (err) {
        console.error('❌ Sidebar: Failed to load user feature preferences:', err);
      }
    };

    loadUserPreferences();

    // Listen for feature preference updates
    const handleFeatureUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🔔 Sidebar: Heard feature-preferences-updated event with detail:', customEvent.detail);

      // Use the preferences passed in the event to avoid database race condition
      if (customEvent.detail?.allPreferences) {
        console.log('✅ Sidebar: Using preferences from event:', customEvent.detail.allPreferences);
        setUserFeaturePrefs(customEvent.detail.allPreferences);
      } else {
        // Fallback: reload from database (old behavior)
        console.log('⚠️ Sidebar: No preferences in event, reloading from DB');
        loadUserPreferences();
      }
    };

    window.addEventListener('feature-preferences-updated', handleFeatureUpdate as EventListener);
    return () => window.removeEventListener('feature-preferences-updated', handleFeatureUpdate as EventListener);
  }, [userId]);

  // Load company name from session
  useEffect(() => {
    const loadCompanyName = () => {
      const session = sessionStorage.getItem('graceful_books_session');
      if (session) {
        try {
          const sessionData = JSON.parse(session);
          // Try to get company name from user object
          if (sessionData.user?.companyName) {
            setCompanyName(sessionData.user.companyName);
          }
        } catch (error) {
          console.error('Failed to parse session:', error);
        }
      }
    };

    // Load on mount
    loadCompanyName();

    // Listen for company name updates from Company Profile page
    const handleCompanyNameUpdate = (event: CustomEvent) => {
      if (event.detail?.companyName) {
        setCompanyName(event.detail.companyName);
      }
    };

    window.addEventListener('company-name-updated', handleCompanyNameUpdate as EventListener);
    return () => window.removeEventListener('company-name-updated', handleCompanyNameUpdate as EventListener);
  }, []);

  const handleLogout = () => {
    try {
      // Clear session storage
      sessionStorage.removeItem('graceful_books_session');
      // Clear any other session-related data
      sessionStorage.clear();

      // Use window.location instead of navigate to avoid React unmount race conditions
      // This does a full page reload which is cleaner for logout
      window.location.href = '/login';
    } catch (error) {
      console.error('Error during logout:', error);
      // Fallback: force navigation even if cleanup fails
      window.location.href = '/login';
    }
  };

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
        <Link to="/cpg" className={styles.logo}>
          <img src="/assets/audacious-logo.png" alt="Audacious" className={styles.logoImage} />
          <h1>Money</h1>
          <p>Cost & Distribution Analysis</p>
        </Link>

        <div className={styles.nav}>
          <div className={styles.section}>
            <h3>Tools</h3>
            <Link
              to="/cpg"
              className={isActive('/cpg') && location.pathname === '/cpg' ? styles.active : ''}
            >
              <LeafIcon isActive={isActive('/cpg') && location.pathname === '/cpg'} />
              Dashboard
            </Link>
            <Link
              to="/cpg/products"
              className={isActive('/cpg/products') ? styles.active : ''}
            >
              <LeafIcon isActive={isActive('/cpg/products')} />
              My Products
            </Link>
            <Link
              to="/cpg/cpu-tracker"
              className={isActive('/cpg/cpu-tracker') ? styles.active : ''}
            >
              <LeafIcon isActive={isActive('/cpg/cpu-tracker')} />
              CPU Tracker
            </Link>
            <Link
              to="/cpg/labor-roles"
              className={isActive('/cpg/labor-roles') ? styles.active : ''}
            >
              <LeafIcon isActive={isActive('/cpg/labor-roles')} />
              Labor + Roles
            </Link>
            {userFeaturePrefs.distribution && (
              <Link
                to="/cpg/distribution-cost"
                className={isActive('/cpg/distribution-cost') ? styles.active : ''}
              >
                <LeafIcon isActive={isActive('/cpg/distribution-cost')} />
                Distribution Center
              </Link>
            )}
            {userFeaturePrefs.promos && (
              <Link
                to="/cpg/promo-decision"
                className={isActive('/cpg/promo-decision') ? styles.active : ''}
              >
                <LeafIcon isActive={isActive('/cpg/promo-decision')} />
                Promo Analysis
              </Link>
            )}
            {userFeaturePrefs.events && (
              <Link
                to="/cpg/events-analysis"
                className={isActive('/cpg/events-analysis') ? styles.active : ''}
              >
                <LeafIcon isActive={isActive('/cpg/events-analysis')} />
                Events Analysis
              </Link>
            )}
            <Link
              to="/cpg/financial-entry"
              className={isActive('/cpg/financial-entry') ? styles.active : ''}
            >
              <LeafIcon isActive={isActive('/cpg/financial-entry')} />
              Financial Entry
            </Link>
            <Link
              to="/cpg/strategy-planning"
              className={isActive('/cpg/strategy-planning') ? styles.active : ''}
            >
              <LeafIcon isActive={isActive('/cpg/strategy-planning')} />
              Strategy Planning
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
                  <LeafIcon isActive={false} size={16} />
                  Add Invoice
                </button>
                <button onClick={() => { handleAction('add-product'); setShowQuickAdd(false); }}>
                  <LeafIcon isActive={false} size={16} />
                  Add Product
                </button>
                <button onClick={() => { handleAction('add-category'); setShowQuickAdd(false); }}>
                  <LeafIcon isActive={false} size={16} />
                  Add Category
                </button>
                <button onClick={() => { handleAction('add-distributor'); setShowQuickAdd(false); }}>
                  <LeafIcon isActive={false} size={16} />
                  Add Distributor
                </button>
              </div>
            )}
          </div>

        </div>

        <div className={styles.bottomNav}>
          <button
            className={styles.accountMenuButton}
            onClick={() => setShowAccountMenu(!showAccountMenu)}
          >
            <span className={styles.companyName}>{companyName}</span>
            <span className={styles.accountMenuArrow}>{showAccountMenu ? '▲' : '▼'}</span>
          </button>
          {showAccountMenu && (
            <div className={styles.accountMenuDropup}>
              <Link
                to="/cpg/company-profile"
                className={styles.menuItem}
                onClick={() => setShowAccountMenu(false)}
              >
                Company Profile
              </Link>
              <Link
                to="/cpg/billing"
                className={styles.menuItem}
                onClick={() => setShowAccountMenu(false)}
              >
                Billing
              </Link>
              <Link
                to="/cpg/settings"
                className={styles.menuItem}
                onClick={() => setShowAccountMenu(false)}
              >
                Settings
              </Link>
              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  setShowSupportModal(true);
                }}
                className={styles.menuItem}
              >
                Support
              </button>
              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  handleLogout();
                }}
                className={styles.menuItem}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className={styles.main}>
        <ReadOnlyBanner />
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
          onNavigateToRecipe={(productId: string, productName: string) => {
            // Close the invoice modal
            closeModal();

            // Navigate to the Finished Products page with state to open specific recipe
            navigate('/cpg/products', {
              state: {
                openRecipe: {
                  productId,
                  productName
                }
              }
            });
          }}
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

        {/* Support Modal */}
        <Modal
          isOpen={showSupportModal}
          onClose={() => setShowSupportModal(false)}
          title="We're Here to Help"
          closeOnBackdropClick={false}
          size="md"
          headerStyle={{
            background: 'linear-gradient(135deg, #4b006e 0%, #6b1a9e 100%)',
            color: '#E8D4A0',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem 0.5rem 0 0',
            fontSize: '2rem'
          }}
        >
          <div style={{
            padding: '0.75rem 1.5rem 1.5rem 1.5rem',
            textAlign: 'center',
            color: '#334155'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>
              👋
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#4b006e',
              marginBottom: '1rem',
              marginTop: '0'
            }}>
              Real Humans, Real Support
            </h3>
            <p style={{
              fontSize: '1rem',
              lineHeight: '1.6',
              marginBottom: '1.5rem',
              color: '#475569'
            }}>
              We hear you, and we're here to support you. Our team reviews every message personally.
            </p>

            <div style={{
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
              border: '2px solid #D4AF37',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <p style={{
                fontSize: '0.875rem',
                color: '#64748b',
                marginBottom: '0.75rem',
                fontWeight: 500
              }}>
                Send us an email at:
              </p>
              <a
                href="mailto:hello@audacious.money"
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: '#4b006e',
                  textDecoration: 'none',
                  display: 'inline-block',
                  padding: '0.5rem 1rem',
                  background: '#E8D4A0',
                  borderRadius: '0.5rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#D4AF37';
                  e.currentTarget.style.color = '#2d1b00';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#E8D4A0';
                  e.currentTarget.style.color = '#4b006e';
                }}
              >
                hello@audacious.money
              </a>
            </div>

            <p style={{
              fontSize: '0.875rem',
              color: '#64748b',
              lineHeight: '1.5'
            }}>
              We typically respond within <strong style={{ color: '#4b006e' }}>24-48 hours</strong>.
              <br />
              Thank you for your patience!
            </p>
          </div>
        </Modal>
      </main>
    </div>
  );
}
