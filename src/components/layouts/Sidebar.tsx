import { useState, useEffect } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { SupportModal } from '../modals/SupportModal'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  isMobile: boolean
  isCollapsed: boolean
  onClose: () => void
}

interface NavItem {
  name: string
  path: string
  icon: React.ReactNode
  children?: NavItem[]
}

const navigationItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    name: 'Transactions',
    path: '/transactions',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },
  {
    name: 'Chart of Accounts',
    path: '/accounts',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
    ),
  },
  {
    name: 'Reconciliation',
    path: '/reconciliation',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    name: 'Customers',
    path: '/customers',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    name: 'Vendors',
    path: '/vendors',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  {
    name: 'Invoices',
    path: '/invoices',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    name: 'Receipts',
    path: '/receipts',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    name: 'Checklist',
    path: '/checklist',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    ),
  },
  {
    name: 'Reports',
    path: '/reports',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    children: [
      {
        name: 'Profit & Loss',
        path: '/reports/profit-loss',
        icon: null,
      },
      {
        name: 'Balance Sheet',
        path: '/reports/balance-sheet',
        icon: null,
      },
      {
        name: 'Cash Flow',
        path: '/reports/cash-flow',
        icon: null,
      },
    ],
  },
]

const ACCOUNT_ORIGIN_KEY = 'audacious_account_origin';

export function Sidebar({ isOpen, isMobile, isCollapsed, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [companyName, setCompanyName] = useState('My Company')

  // Store current path as origin before navigating to account pages
  const handleAccountNavigation = (path: string) => {
    sessionStorage.setItem(ACCOUNT_ORIGIN_KEY, location.pathname);
    setShowAccountMenu(false);
    onClose();
    navigate(path);
  };

  // Load company name from session
  useEffect(() => {
    const loadCompanyName = () => {
      const session = sessionStorage.getItem('graceful_books_session')
      if (session) {
        try {
          const sessionData = JSON.parse(session)
          if (sessionData.user?.companyName) {
            setCompanyName(sessionData.user.companyName)
          }
        } catch (error) {
          console.error('Failed to parse session:', error)
        }
      }
    }

    loadCompanyName()

    // Listen for company name updates
    const handleCompanyNameUpdate = (event: CustomEvent) => {
      if (event.detail?.companyName) {
        setCompanyName(event.detail.companyName)
      }
    }

    window.addEventListener('company-name-updated', handleCompanyNameUpdate as EventListener)
    return () => window.removeEventListener('company-name-updated', handleCompanyNameUpdate as EventListener)
  }, [])

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('graceful_books_session')
      sessionStorage.clear()
      window.location.href = '/login'
    } catch (error) {
      console.error('Error during logout:', error)
      window.location.href = '/login'
    }
  }

  const sidebarClasses = [
    'sidebar',
    isOpen ? 'sidebar--open' : '',
    isMobile ? 'sidebar--mobile' : '',
    isCollapsed && !isMobile ? 'sidebar--collapsed' : '',
  ].filter(Boolean).join(' ')

  return (
    <aside className={sidebarClasses}>
      <nav className="sidebar__nav" aria-label="Main navigation">
        <ul className="sidebar__list">
          {navigationItems.map((item) => (
            <li key={item.path} className="sidebar__item">
              <NavLink
                to={item.path}
                className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                onClick={item.children ? undefined : onClose}
                title={isCollapsed ? item.name : undefined}
              >
                {item.icon && <span className="sidebar__icon">{item.icon}</span>}
                {!isCollapsed && <span className="sidebar__text">{item.name}</span>}
              </NavLink>

              {item.children && !isCollapsed && (
                <ul className="sidebar__submenu">
                  {item.children.map((child) => (
                    <li key={child.path} className="sidebar__subitem">
                      <NavLink
                        to={child.path}
                        className={({ isActive }) =>
                          `sidebar__sublink ${isActive ? 'sidebar__sublink--active' : ''}`
                        }
                        onClick={onClose}
                      >
                        {child.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Account Menu (like CPG) */}
      <div className="sidebar__footer">
        <button
          className="sidebar__account-button"
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          title={isCollapsed ? companyName : undefined}
        >
          {isCollapsed ? (
            <span className="sidebar__account-icon">👤</span>
          ) : (
            <>
              <span className="sidebar__company-name">{companyName}</span>
              <span className="sidebar__account-arrow">{showAccountMenu ? '▲' : '▼'}</span>
            </>
          )}
        </button>

        {showAccountMenu && (
          <div className={`sidebar__account-dropdown ${isCollapsed ? 'sidebar__account-dropdown--collapsed' : ''}`}>
            <button
              className="sidebar__dropdown-item"
              onClick={() => handleAccountNavigation('/account/company-profile')}
            >
              Company Profile
            </button>
            <button
              className="sidebar__dropdown-item"
              onClick={() => handleAccountNavigation('/account/billing')}
            >
              Billing
            </button>
            <button
              className="sidebar__dropdown-item"
              onClick={() => handleAccountNavigation('/account/settings')}
            >
              Settings
            </button>
            <button
              className="sidebar__dropdown-item"
              onClick={() => {
                setShowAccountMenu(false)
                setShowSupportModal(true)
              }}
            >
              Support
            </button>
            <button
              className="sidebar__dropdown-item sidebar__dropdown-item--logout"
              onClick={() => {
                setShowAccountMenu(false)
                handleLogout()
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </aside>
  )
}
