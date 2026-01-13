import { useEffect, useRef, ReactNode, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import styles from './Modal.module.css'

export interface ModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean
  /**
   * Callback when modal should close
   */
  onClose: () => void
  /**
   * Modal title
   */
  title?: string
  /**
   * Modal content
   */
  children: ReactNode
  /**
   * Size of the modal
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /**
   * Whether to show close button
   */
  showCloseButton?: boolean
  /**
   * Whether clicking backdrop closes modal
   */
  closeOnBackdropClick?: boolean
  /**
   * Whether pressing Escape closes modal
   */
  closeOnEscape?: boolean
  /**
   * Additional class name for modal content
   */
  className?: string
  /**
   * Footer content
   */
  footer?: ReactNode
}

/**
 * Modal component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Focus trap within modal
 * - Keyboard navigation (Escape to close, Tab cycling)
 * - Screen reader announcements
 * - Backdrop click to close
 * - Return focus to trigger element on close
 * - Body scroll lock when open
 * - Reduced motion support
 *
 * @example
 * ```tsx
 * <Modal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Confirm Action"
 *   footer={
 *     <>
 *       <Button onClick={handleClose}>Cancel</Button>
 *       <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
 *     </>
 *   }
 * >
 *   Are you sure you want to proceed?
 * </Modal>
 * ```
 */
export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      children,
      size = 'md',
      showCloseButton = true,
      closeOnBackdropClick = true,
      closeOnEscape = true,
      className,
      footer,
    },
    _ref,
  ) => {
    const modalRef = useRef<HTMLDivElement>(null)
    const previousActiveElement = useRef<HTMLElement | null>(null)

    // Handle focus trap
    useEffect(() => {
      if (!isOpen) return

      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement

      // Focus the modal
      const modalElement = modalRef.current
      if (modalElement) {
        modalElement.focus()
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
          const modalElement = modalRef.current
          if (!modalElement) return

          const focusableElements = modalElement.querySelectorAll(
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

    const modalContent = (
      <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
        <div
          ref={modalRef}
          className={clsx(styles.modal, styles[size], className)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          tabIndex={-1}
        >
          {title && (
            <div className={styles.modalHeader}>
              <h2 id="modal-title" className={styles.modalTitle}>
                {title}
              </h2>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className={styles.closeButton}
                  aria-label="Close modal"
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
              aria-label="Close modal"
            >
              ✕
            </button>
          )}

          <div className={styles.modalBody}>{children}</div>

          {footer && <div className={styles.modalFooter}>{footer}</div>}
        </div>
      </div>
    )

    // Render in portal
    return createPortal(modalContent, document.body)
  },
)

Modal.displayName = 'Modal'
