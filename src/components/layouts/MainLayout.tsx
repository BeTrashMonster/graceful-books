import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { Footer } from './Footer'
import { RouteErrorBoundary } from '../error/RouteErrorBoundary'
import './MainLayout.css'

export function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
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

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const closeSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }

  return (
    <div className="main-layout">
      <Header onMenuClick={toggleSidebar} />

      <div className="main-layout__container">
        <Sidebar isOpen={isSidebarOpen} isMobile={isMobile} onClose={closeSidebar} />

        {/* Overlay for mobile */}
        {isMobile && isSidebarOpen && (
          <div className="main-layout__overlay" onClick={closeSidebar} aria-hidden="true" />
        )}

        <main className="main-layout__content" id="main-content">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>

      <Footer />
    </div>
  )
}
