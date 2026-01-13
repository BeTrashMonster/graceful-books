import { useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import styles from './Drawer.module.css'

export interface DrawerProps {
  /**
   * Whether the drawer is open
   */
  isOpen: boolean
  /**
   * Callback when drawer should close
   */
  onClose: () => void
  /**
   * Drawer title
   */
  title?: string
  /**
   * Drawer content
   */
  children: ReactNode
  /**
   * Side from which drawer slides in
   */
  position?: 'left' | 'right' | 'top' | 'bottom'
  /**
   * Size of the drawer
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Whether to show close button
   */
  showCloseButton?: boolean
  /**
   * Whether clicking backdrop closes drawer
   */
  closeOnBackdropClick?: boolean
  /**
   * Whether pressing Escape closes drawer
   */
  closeOnEscape?: boolean
  /**
   * Additional class name for drawer content
   */
  className?: string
  /**
   * Footer content
   */
  footer?: ReactNode
}

/**
 * Drawer component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Focus trap within drawer
 * - Keyboard navigation (Escape to close, Tab cycling)
 * - Screen reader announcements
 * - Slide-in animations with reduced motion support
 * - Backdrop click to close
 * - Return focus to trigger element on close
 * - Body scroll lock when open
 *
 * @example
 * ```tsx
 * <Drawer
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Navigation"
 *   position="left"
 * >
 *   <nav>
 *     <ul>
 *       <li><a href="/">Home</a></li>
 *       <li><a href="/about">About</a></li>
 *     </ul>
 *   </nav>
 * </Drawer>
 * ```
 */
export const Drawer = ({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className,
  footer,
}: DrawerProps) => {
  const drawerRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Handle focus trap
  useEffect(() => {
    if (!isOpen) return

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement

    // Focus the drawer
    const drawerElement = drawerRef.current
    if (drawerElement) {
      drawerElement.focus()
    }

    // Lock body scroll
    document.body.style.overflow = 'hidden'

    return () => {
      // Restore body scroll
      document.body.style.overflow = ''

      // Return focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen])

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (closeOnEscape && e.key === 'Escape') {
        onClose()
        return
      }

      // Trap focus with Tab
      if (e.key === 'Tab') {
        const drawerElement = drawerRef.current
        if (!drawerElement) return

        const focusableElements = drawerElement.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )

        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

        if (e.shiftKey) {
          // Shift+Tab: if on first element, go to last
          if (document.activeElement === firstElement) {
            lastElement?.focus()
            e.preventDefault()
          }
        } else {
          // Tab: if on last element, go to first
          if (document.activeElement === lastElement) {
            firstElement?.focus()
            e.preventDefault()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, closeOnEscape])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  const drawerContent = (
    <div className={styles.drawerBackdrop} onClick={handleBackdropClick}>
      <div
        ref={drawerRef}
        className={clsx(
          styles.drawer,
          styles[position],
          styles[`size-${size}`],
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
        tabIndex={-1}
      >
        {title && (
          <div className={styles.drawerHeader}>
            <h2 id="drawer-title" className={styles.drawerTitle}>
              {title}
            </h2>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className={styles.closeButton}
                aria-label="Close drawer"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {!title && showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className={clsx(styles.closeButton, styles.closeButtonOnly)}
            aria-label="Close drawer"
          >
            ✕
          </button>
        )}

        <div className={styles.drawerBody}>{children}</div>

        {footer && <div className={styles.drawerFooter}>{footer}</div>}
      </div>
    </div>
  )

  // Render in portal
  return createPortal(drawerContent, document.body)
}

Drawer.displayName = 'Drawer'
