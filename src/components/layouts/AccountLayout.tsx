/**
 * AccountLayout - Minimal layout for shared account pages
 *
 * Used for pages that are accessible from both CPG and bookkeeping:
 * - Company Profile
 * - Billing
 * - Settings
 *
 * Provides a simple header with back navigation and tab navigation between account sections
 */

import { useState, useEffect } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { SupportModal } from '../modals/SupportModal';
import styles from './AccountLayout.module.css';

const ACCOUNT_ORIGIN_KEY = 'audacious_account_origin';

export function AccountLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [companyName, setCompanyName] = useState('My Company');
  const [originPath, setOriginPath] = useState<string>('/dashboard');

  // Read origin from sessionStorage (set by navigation handlers in Header/Sidebar/CPGLayout)
  useEffect(() => {
    const storedOrigin = sessionStorage.getItem(ACCOUNT_ORIGIN_KEY);
    if (storedOrigin) {
      setOriginPath(storedOrigin);
    } else {
      // Fallback if directly navigated to account page
      setOriginPath(getDefaultBackPath());
    }
  }, []);

  // Determine default back path based on user's products
  const getDefaultBackPath = () => {
    try {
      const session = sessionStorage.getItem('graceful_books_session');
      if (session) {
        const sessionData = JSON.parse(session);
        const products = sessionData.products || [];

        // Check for all possible product slugs
        const hasCPG = products.some((p: any) =>
          p.slug === 'cpu-cpg-calculator' ||
          p.slug === 'cpg' ||
          p.slug === 'cpu-calculator'
        );
        const hasBookkeeping = products.some((p: any) =>
          p.slug === 'bookkeeping-suite' ||
          p.slug === 'bookkeeping'
        );

        // If they have bookkeeping, go to dashboard
        if (hasBookkeeping) return '/dashboard';
        // If they only have CPG, go to CPG
        if (hasCPG) return '/cpg';
      }
    } catch (error) {
      console.error('Error determining back path:', error);
    }
    // Default fallback - CPG is more common for users without bookkeeping
    return '/cpg';
  };

  // Load company name from session
  useEffect(() => {
    const loadCompanyName = () => {
      const session = sessionStorage.getItem('graceful_books_session');
      if (session) {
        try {
          const sessionData = JSON.parse(session);
          if (sessionData.user?.companyName) {
            setCompanyName(sessionData.user.companyName);
          }
        } catch (error) {
          console.error('Failed to parse session:', error);
        }
      }
    };

    loadCompanyName();

    // Listen for company name updates
    const handleCompanyNameUpdate = (event: CustomEvent) => {
      if (event.detail?.companyName) {
        setCompanyName(event.detail.companyName);
      }
    };

    window.addEventListener('company-name-updated', handleCompanyNameUpdate as EventListener);
    return () => window.removeEventListener('company-name-updated', handleCompanyNameUpdate as EventListener);
  }, []);

  const handleBack = () => {
    // Clear the origin and navigate back to where they came from
    sessionStorage.removeItem(ACCOUNT_ORIGIN_KEY);
    navigate(originPath);
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.backButton}
            onClick={handleBack}
            aria-label="Go back"
          >
            <svg
              className={styles.backIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>
        </div>

        <Link to={originPath} className={styles.logo} onClick={() => sessionStorage.removeItem(ACCOUNT_ORIGIN_KEY)}>
          <span className={styles.logoAudacious}>A</span>
          <span className={styles.logoAudaciousRest}>udacious</span>
          <span className={styles.logoMoney}>M</span>
          <span className={styles.logoMoneyRest}>oney</span>
        </Link>

        <div className={styles.headerRight}>
          <button
            className={styles.supportButton}
            onClick={() => setShowSupportModal(true)}
          >
            Support
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Account section tabs */}
        <nav className={styles.tabs}>
          <NavLink
            to="/account/company-profile"
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
          >
            Company Profile
          </NavLink>
          <NavLink
            to="/account/billing"
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
          >
            Billing
          </NavLink>
          <NavLink
            to="/account/settings"
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
          >
            Settings
          </NavLink>
        </nav>

        <div className={styles.content}>
          <Outlet />
        </div>
      </main>

      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </div>
  );
}
