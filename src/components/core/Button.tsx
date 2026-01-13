import { ButtonHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'
import styles from './Button.module.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual style variant
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  /**
   * Size of the button
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Full width button
   */
  fullWidth?: boolean
  /**
   * Loading state - shows spinner and disables interaction
   */
  loading?: boolean
  /**
   * Icon to display before children
   */
  iconBefore?: React.ReactNode
  /**
   * Icon to display after children
   */
  iconAfter?: React.ReactNode
}

/**
 * Button component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Keyboard navigation (Enter/Space activation)
 * - Focus indicators with 3:1 contrast ratio
 * - Loading states with aria-busy
 * - Micro-animations with reduced motion support
 * - Touch targets minimum 44x44px
 * - Screen reader support
 *
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleClick}>
 *   Save Changes
 * </Button>
 *
 * <Button variant="secondary" loading>
 *   Processing...
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      disabled,
      className,
      children,
      iconBefore,
      iconAfter,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={clsx(
          styles.button,
          styles[variant],
          styles[size],
          fullWidth && styles.fullWidth,
          loading && styles.loading,
          className,
        )}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && (
          <span className={styles.spinner} aria-hidden="true">
            <span className={styles.spinnerCircle} />
          </span>
        )}
        {!loading && iconBefore && (
          <span className={styles.iconBefore} aria-hidden="true">
            {iconBefore}
          </span>
        )}
        <span className={styles.content}>{children}</span>
        {!loading && iconAfter && (
          <span className={styles.iconAfter} aria-hidden="true">
            {iconAfter}
          </span>
        )}
      </button>
    )
  },
)

Button.displayName = 'Button'
