import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { SupportModal } from '../modals/SupportModal'
import './Header.css'

const ACCOUNT_ORIGIN_KEY = 'audacious_account_origin';

interface HeaderProps {
  onMenuClick: () => void
  isSidebarCollapsed?: boolean
}

export function Header({ onMenuClick, isSidebarCollapsed }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [companyName, setCompanyName] = useState('My Company')
  const menuRef = useRef<HTMLDivElement>(null)

  // Store current path as origin before navigating to account pages
  const handleAccountNavigation = (path: string) => {
    sessionStorage.setItem(ACCOUNT_ORIGIN_KEY, location.pathname);
    setShowUserMenu(false);
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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

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

  return (
    <header className="header">
      <div className="header__container">
        <div className="header__left">
          <button
            className="header__menu-button"
            onClick={onMenuClick}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className="header__menu-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link to="/dashboard" className="header__logo">
            <span className="header__logo-audacious">
              <span className="header__logo-letter">A</span>udacious
            </span>
            <span className="header__logo-money">
              <span className="header__logo-letter">M</span>oney
            </span>
          </Link>
        </div>

        <div className="header__center">
          {/* Global search */}
          <div className="header__search">
            <svg
              className="header__search-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search transactions, accounts, invoices..."
              className="header__search-input"
              aria-label="Search"
            />
          </div>
        </div>

        <div className="header__right">
          {/* User menu with dropdown */}
          <div className="header__user-menu" ref={menuRef}>
            <button
              className="header__user-button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="User menu"
              aria-expanded={showUserMenu}
            >
              <div className="header__user-avatar">
                <svg
                  className="header__user-icon"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </button>

            {showUserMenu && (
              <div className="header__user-dropdown">
                <div className="header__user-dropdown-header">
                  <span className="header__user-dropdown-company">{companyName}</span>
                </div>
                <button
                  className="header__user-dropdown-item"
                  onClick={() => handleAccountNavigation('/account/company-profile')}
                >
                  Company Profile
                </button>
                <button
                  className="header__user-dropdown-item"
                  onClick={() => handleAccountNavigation('/account/billing')}
                >
                  Billing
                </button>
                <button
                  className="header__user-dropdown-item"
                  onClick={() => handleAccountNavigation('/account/settings')}
                >
                  Settings
                </button>
                <button
                  className="header__user-dropdown-item"
                  onClick={() => {
                    setShowUserMenu(false)
                    setShowSupportModal(true)
                  }}
                >
                  Support
                </button>
                <button
                  className="header__user-dropdown-item header__user-dropdown-item--logout"
                  onClick={() => {
                    setShowUserMenu(false)
                    handleLogout()
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </header>
  )
}
