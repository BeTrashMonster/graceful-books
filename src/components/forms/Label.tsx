import { LabelHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'
import styles from './Label.module.css'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /**
   * Whether the associated field is required
   */
  required?: boolean
  /**
   * Whether the associated field has an error
   */
  hasError?: boolean
  /**
   * Whether the label is disabled
   */
  disabled?: boolean
  /**
   * Optional info tooltip text
   */
  info?: string
}

/**
 * Label component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Required field indicators
 * - Screen reader support
 * - Error state styling
 * - Info tooltips
 * - Proper association with form controls
 *
 * @example
 * ```tsx
 * <Label htmlFor="email" required>
 *   Email Address
 * </Label>
 *
 * <Label htmlFor="name" info="Your full legal name">
 *   Full Name
 * </Label>
 * ```
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  (
    {
      children,
      required,
      hasError,
      disabled,
      info,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <label
        ref={ref}
        className={clsx(
          styles.label,
          hasError && styles.hasError,
          disabled && styles.disabled,
          className,
        )}
        {...props}
      >
        <span className={styles.labelText}>
          {children}
          {required && (
            <span className={styles.required} aria-label="required" title="Required field">
              {' '}*
            </span>
          )}
        </span>
        {info && (
          <span className={styles.info} title={info} aria-label={info}>
            ⓘ
          </span>
        )}
      </label>
    )
  },
)

Label.displayName = 'Label'
