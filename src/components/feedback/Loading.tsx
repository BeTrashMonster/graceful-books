import clsx from 'clsx'
import styles from './Loading.module.css'

export interface LoadingProps {
  /**
   * Size of the loading indicator
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Variant of loading indicator
   */
  variant?: 'spinner' | 'dots' | 'pulse'
  /**
   * Loading message
   */
  message?: string
  /**
   * Whether to center the loading indicator
   */
  centered?: boolean
  /**
   * Additional class name
   */
  className?: string
  /**
   * Screen reader text (defaults to "Loading")
   */
  ariaLabel?: string
}

/**
 * Loading component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Multiple loading variants (spinner, dots, pulse)
 * - Screen reader announcements with aria-live
 * - Calm, non-stressful animations
 * - Reduced motion support
 * - Accessible loading states
 *
 * @example
 * ```tsx
 * <Loading message="Loading your data..." />
 *
 * <Loading variant="dots" size="sm" />
 *
 * <Loading variant="pulse" centered />
 * ```
 */
export const Loading = ({
  size = 'md',
  variant = 'spinner',
  message,
  centered = false,
  className,
  ariaLabel = 'Loading',
}: LoadingProps) => {
  return (
    <div
      className={clsx(
        styles.loadingContainer,
        centered && styles.centered,
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      {variant === 'spinner' && (
        <div className={clsx(styles.spinner, styles[size])}>
          <div className={styles.spinnerCircle} />
        </div>
      )}

      {variant === 'dots' && (
        <div className={clsx(styles.dots, styles[size])}>
          <div className={styles.dot} />
          <div className={styles.dot} />
          <div className={styles.dot} />
        </div>
      )}

      {variant === 'pulse' && (
        <div className={clsx(styles.pulse, styles[size])}>
          <div className={styles.pulseCircle} />
          <div className={styles.pulseCircle} />
        </div>
      )}

      {message && (
        <p className={styles.message} aria-live="polite">
          {message}
        </p>
      )}

      <span className={styles.srOnly}>{ariaLabel}</span>
    </div>
  )
}

Loading.displayName = 'Loading'

/* Loading Overlay for full-screen loading states */
export interface LoadingOverlayProps extends LoadingProps {
  /**
   * Whether the overlay is visible
   */
  isVisible: boolean
}

/**
 * Loading overlay for full-screen loading states
 *
 * @example
 * ```tsx
 * <LoadingOverlay
 *   isVisible={isLoading}
 *   message="Processing your request..."
 * />
 * ```
 */
export const LoadingOverlay = ({
  isVisible,
  message,
  size = 'lg',
  variant = 'spinner',
  ariaLabel = 'Loading',
}: LoadingOverlayProps) => {
  if (!isVisible) return null

  return (
    <div className={styles.overlay}>
      <Loading
        size={size}
        variant={variant}
        message={message}
        centered
        ariaLabel={ariaLabel}
      />
    </div>
  )
}

LoadingOverlay.displayName = 'LoadingOverlay'
