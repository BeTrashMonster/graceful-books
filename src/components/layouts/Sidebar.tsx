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
    name: 'Money Coming In',
    path: '/customers',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    children: [
      {
        name: 'Customer Center',
        path: '/customers',
        icon: null,
      },
      {
        name: 'Invoices',
        path: '/customers?tab=invoices',
        icon: null,
      },
      {
        name: 'Estimates',
        path: '/customers?tab=estimates',
        icon: null,
      },
      {
        name: 'Products',
        path: '/customers?tab=products',
        icon: null,
      },
      {
        name: 'Services',
        path: '/customers?tab=services',
        icon: null,
      },
    ],
  },
  {
    name: 'Money Going Out',
    path: '/vendors',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
    children: [
      {
        name: 'Vendor Center',
        path: '/vendors',
        icon: null,
      },
      {
        name: 'Bills',
        path: '/vendors?tab=bills',
        icon: null,
      },
      {
        name: 'Receipts',
        path: '/vendors?tab=receipts',
        icon: null,
      },
    ],
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
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Track which collapsible sections are expanded (collapsed by default)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Money Coming In': false,
    'Money Going Out': false,
    'Reports': false,
  })

  // Toggle a collapsible section
  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }))
  }

  // Check if current location is within a section's children
  const isInSection = (item: NavItem): boolean => {
    if (!item.children) return false
    return item.children.some(child => {
      const childPath = child.path.split('?')[0]
      return location.pathname === childPath
    })
  }

  // Custom active state logic for Vendors/Receipts tabs
  const isVendorsActive = () => {
    if (location.pathname !== '/vendors') return false
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    // Vendors is active when on /vendors and tab is NOT receipts
    return tab !== 'receipts'
  }

  const isReceiptsActive = () => {
    if (location.pathname !== '/vendors') return false
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    // Receipts is active when on /vendors and tab IS receipts
    return tab === 'receipts'
  }

  // Store current path as origin before navigating to account pages
  const handleAccountNavigation = (path: string) => {
    sessionStorage.setItem(ACCOUNT_ORIGIN_KEY, location.pathname);
    setShowAccountMenu(false);
    onClose();
    navigate(path);
  };

  // Load company name and email from session
  useEffect(() => {
    const loadSessionData = () => {
      const session = sessionStorage.getItem('graceful_books_session')
      if (session) {
        try {
          const sessionData = JSON.parse(session)
          if (sessionData.user?.companyName) {
            setCompanyName(sessionData.user.companyName)
          }
          // Load email from session
          const email = sessionData.userIdentifier || sessionData.user?.email
          if (email) {
            setUserEmail(email)
          }
        } catch (error) {
          console.error('Failed to parse session:', error)
        }
      }
    }

    loadSessionData()

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
          {navigationItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedSections[item.name] ?? true
            const sectionActive = isInSection(item)

            // Custom active state for Vendors and Receipts
            const getActiveClass = ({ isActive }: { isActive: boolean }) => {
              let active = isActive
              if (item.name === 'Vendors') {
                active = isVendorsActive()
              } else if (item.name === 'Receipts') {
                active = isReceiptsActive()
              }
              return `sidebar__link ${active ? 'sidebar__link--active' : ''} ${hasChildren ? 'sidebar__link--parent' : ''} ${sectionActive ? 'sidebar__link--section-active' : ''}`
            }

            return (
            <li key={item.path} className={`sidebar__item ${hasChildren ? 'sidebar__item--has-children' : ''}`}>
              <div className="sidebar__link-wrapper">
                <NavLink
                  to={item.path}
                  className={getActiveClass}
                  onClick={(e) => {
                    if (!hasChildren) {
                      onClose()
                    }
                  }}
                  title={isCollapsed ? item.name : undefined}
                >
                  {item.icon && <span className="sidebar__icon">{item.icon}</span>}
                  {!isCollapsed && <span className="sidebar__text">{item.name}</span>}
                </NavLink>
                {hasChildren && !isCollapsed && (
                  <button
                    className={`sidebar__collapse-toggle ${isExpanded ? 'sidebar__collapse-toggle--expanded' : ''}`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleSection(item.name)
                    }}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                      className="sidebar__collapse-icon"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {hasChildren && !isCollapsed && isExpanded && (
                <ul className="sidebar__submenu">
                  {item.children!.map((child) => (
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
            )
          })}
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
            {userEmail && (
              <div className="sidebar__dropdown-email">
                {userEmail}
              </div>
            )}
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
