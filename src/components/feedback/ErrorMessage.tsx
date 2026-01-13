import clsx from 'clsx'
import styles from './ErrorMessage.module.css'

export interface ErrorMessageProps {
  /**
   * Error title
   */
  title?: string
  /**
   * Error message
   */
  message: string
  /**
   * Error type/severity
   */
  variant?: 'error' | 'warning' | 'info'
  /**
   * Whether to show icon
   */
  showIcon?: boolean
  /**
   * Action button
   */
  action?: {
    label: string
    onClick: () => void
  }
  /**
   * Additional details (expandable)
   */
  details?: string
  /**
   * Whether the component can be dismissed
   */
  dismissible?: boolean
  /**
   * Callback when dismissed
   */
  onDismiss?: () => void
  /**
   * Additional class name
   */
  className?: string
}

/**
 * Error Message component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Screen reader announcements with role="alert"
 * - Icon + color for accessibility (not color alone)
 * - Dismissible option
 * - Action buttons
 * - Multiple severity variants
 * - Expandable details
 *
 * @example
 * ```tsx
 * <ErrorMessage
 *   variant="error"
 *   title="Connection Failed"
 *   message="Unable to connect to the server. Please try again."
 *   action={{
 *     label: "Retry",
 *     onClick: handleRetry
 *   }}
 *   dismissible
 *   onDismiss={handleDismiss}
 * />
 * ```
 */
export const ErrorMessage = ({
  title,
  message,
  variant = 'error',
  showIcon = true,
  action,
  details,
  dismissible = false,
  onDismiss,
  className,
}: ErrorMessageProps) => {
  const icons = {
    error: '⚠',
    warning: '⚡',
    info: 'ℹ',
  }

  return (
    <div
      className={clsx(styles.errorContainer, styles[variant], className)}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      <div className={styles.errorContent}>
        {showIcon && (
          <span className={styles.icon} aria-hidden="true">
            {icons[variant]}
          </span>
        )}

        <div className={styles.textContent}>
          {title && <h3 className={styles.title}>{title}</h3>}
          <p className={styles.message}>{message}</p>
          {details && (
            <details className={styles.details}>
              <summary className={styles.detailsSummary}>Show details</summary>
              <p className={styles.detailsContent}>{details}</p>
            </details>
          )}
        </div>

        <div className={styles.actions}>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className={styles.actionButton}
            >
              {action.label}
            </button>
          )}

          {dismissible && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={styles.dismissButton}
              aria-label="Dismiss message"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

ErrorMessage.displayName = 'ErrorMessage'

/* Alert component for inline notifications */
export interface AlertProps {
  /**
   * Alert content
   */
  children: React.ReactNode
  /**
   * Alert variant
   */
  variant?: 'success' | 'error' | 'warning' | 'info'
  /**
   * Whether to show icon
   */
  showIcon?: boolean
  /**
   * Additional class name
   */
  className?: string
}

/**
 * Alert component for inline notifications
 *
 * @example
 * ```tsx
 * <Alert variant="success">
 *   Your changes have been saved successfully.
 * </Alert>
 * ```
 */
export const Alert = ({
  children,
  variant = 'info',
  showIcon = true,
  className,
}: AlertProps) => {
  const icons = {
    success: '✓',
    error: '⚠',
    warning: '⚡',
    info: 'ℹ',
  }

  return (
    <div
      className={clsx(styles.alert, styles[variant], className)}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {showIcon && (
        <span className={styles.alertIcon} aria-hidden="true">
          {icons[variant]}
        </span>
      )}
      <div className={styles.alertContent}>{children}</div>
    </div>
  )
}

Alert.displayName = 'Alert'
