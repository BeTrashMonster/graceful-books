import { InputHTMLAttributes, forwardRef, useId } from 'react'
import clsx from 'clsx'
import styles from './Checkbox.module.css'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Label text for the checkbox
   */
  label?: string
  /**
   * Helper text displayed below the checkbox
   */
  helperText?: string
  /**
   * Error message to display
   */
  error?: string
  /**
   * Whether the checkbox is in an error state
   */
  hasError?: boolean
  /**
   * Whether to show indeterminate state
   */
  indeterminate?: boolean
}

/**
 * Checkbox component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Keyboard navigation (Space to toggle)
 * - Focus indicators with 3:1 contrast
 * - Bounce animation on check
 * - Screen reader support
 * - Touch-friendly targets (44x44px)
 * - Indeterminate state support
 *
 * @example
 * ```tsx
 * <Checkbox
 *   label="I agree to the terms and conditions"
 *   required
 * />
 *
 * <Checkbox
 *   label="Enable notifications"
 *   helperText="Receive updates about your account"
 * />
 * ```
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      helperText,
      error,
      hasError,
      indeterminate,
      className,
      id: providedId,
      required,
      disabled,
      checked,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const id = providedId || generatedId
    const helperTextId = `${id}-helper`
    const errorId = `${id}-error`

    const showError = hasError || !!error
    const describedBy = error
      ? errorId
      : helperText
        ? helperTextId
        : undefined

    return (
      <div className={clsx(styles.checkboxWrapper, className)}>
        <div className={styles.checkboxContainer}>
          <div
            className={clsx(
              styles.checkboxInputWrapper,
              showError && styles.hasError,
              disabled && styles.disabled,
            )}
          >
            <input
              ref={ref}
              type="checkbox"
              id={id}
              className={styles.checkboxInput}
              disabled={disabled}
              required={required}
              checked={checked}
              aria-invalid={showError}
              aria-describedby={describedBy}
              aria-required={required}
              {...props}
            />
            <span
              className={clsx(
                styles.checkboxBox,
                indeterminate && styles.indeterminate,
              )}
              aria-hidden="true"
            >
              {indeterminate ? (
                <span className={styles.indeterminateIcon}>−</span>
              ) : (
                <span className={styles.checkIcon}>✓</span>
              )}
            </span>
          </div>

          {label && (
            <label htmlFor={id} className={styles.label}>
              {label}
              {required && (
                <span className={styles.required} aria-label="required">
                  {' '}*
                </span>
              )}
            </label>
          )}
        </div>

        {error && (
          <p id={errorId} className={styles.errorText} role="alert" aria-live="polite">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={helperTextId} className={styles.helperText}>
            {helperText}
          </p>
        )}
      </div>
    )
  },
)

Checkbox.displayName = 'Checkbox'
