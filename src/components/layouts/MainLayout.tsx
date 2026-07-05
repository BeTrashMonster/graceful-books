import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { RouteErrorBoundary } from '../error/RouteErrorBoundary'
import { ReadOnlyBanner } from '../subscription/ReadOnlyBanner'
import './MainLayout.css'

const SIDEBAR_COLLAPSED_KEY = 'audacious_sidebar_collapsed'

export function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Load collapsed state from localStorage
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    return saved === 'true'
  })

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      // On desktop, sidebar should be open by default
      if (!mobile) {
        setIsSidebarOpen(true)
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed))
  }, [isCollapsed])

  const handleMenuClick = () => {
    if (isMobile) {
      // On mobile, toggle sidebar open/close
      setIsSidebarOpen(!isSidebarOpen)
    } else {
      // On desktop, toggle sidebar collapse
      setIsCollapsed(!isCollapsed)
    }
  }

  const closeSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }

  return (
    <div className={`main-layout ${isCollapsed && !isMobile ? 'main-layout--collapsed' : ''}`}>
      <Header onMenuClick={handleMenuClick} isSidebarCollapsed={isCollapsed && !isMobile} />

      <div className="main-layout__container">
        <Sidebar
          isOpen={isSidebarOpen}
          isMobile={isMobile}
          isCollapsed={isCollapsed && !isMobile}
          onClose={closeSidebar}
        />

        {/* Overlay for mobile */}
        {isMobile && isSidebarOpen && (
          <div className="main-layout__overlay" onClick={closeSidebar} aria-hidden="true" />
        )}

        <main className="main-layout__content" id="main-content">
          <ReadOnlyBanner />
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  )
}
