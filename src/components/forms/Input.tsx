import { InputHTMLAttributes, forwardRef, useId, useState } from 'react'
import clsx from 'clsx'
import styles from './Input.module.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Label text for the input
   */
  label?: string
  /**
   * Helper text displayed below the input
   */
  helperText?: string
  /**
   * Error message to display
   */
  error?: string
  /**
   * Whether the input is in an error state
   */
  hasError?: boolean
  /**
   * Success message or indicator
   */
  success?: string
  /**
   * Icon to display before the input
   */
  iconBefore?: React.ReactNode
  /**
   * Icon to display after the input
   */
  iconAfter?: React.ReactNode
  /**
   * Full width input
   */
  fullWidth?: boolean
  /**
   * Show character count (requires maxLength)
   */
  showCharCount?: boolean
}

/**
 * Input component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Screen reader support with proper ARIA labels
 * - Error and success state announcements
 * - Required field indicators
 * - Icon support
 * - Character counter
 * - Focus indicators with 3:1 contrast
 * - Validation feedback
 *
 * @example
 * ```tsx
 * <Input
 *   label="Email Address"
 *   type="email"
 *   helperText="We'll never share your email"
 *   required
 * />
 *
 * <Input
 *   label="Password"
 *   type="password"
 *   error="Password must be at least 8 characters"
 * />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      hasError,
      success,
      iconBefore,
      iconAfter,
      fullWidth = false,
      showCharCount = false,
      className,
      id: providedId,
      required,
      disabled,
      maxLength,
      onChange,
      value,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const id = providedId || generatedId
    const helperTextId = `${id}-helper`
    const errorId = `${id}-error`
    const successId = `${id}-success`

    const [charCount, setCharCount] = useState(0)

    const showError = hasError || !!error
    const showSuccess = !showError && !!success

    const describedBy = [
      error && errorId,
      success && successId,
      helperText && helperTextId,
    ]
      .filter(Boolean)
      .join(' ') || undefined

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (showCharCount && maxLength) {
        setCharCount(e.target.value.length)
      }
      onChange?.(e)
    }

    return (
      <div
        className={clsx(
          styles.inputWrapper,
          fullWidth && styles.fullWidth,
          className,
        )}
      >
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

        <div
          className={clsx(
            styles.inputContainer,
            showError && styles.hasError,
            showSuccess && styles.hasSuccess,
            disabled && styles.disabled,
          )}
        >
          {iconBefore && (
            <span className={styles.iconBefore} aria-hidden="true">
              {iconBefore}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            className={styles.input}
            disabled={disabled}
            required={required}
            maxLength={maxLength}
            value={value}
            aria-invalid={showError}
            aria-describedby={describedBy}
            aria-required={required}
            onChange={handleChange}
            {...props}
          />

          {iconAfter && (
            <span className={styles.iconAfter} aria-hidden="true">
              {iconAfter}
            </span>
          )}

          {showError && (
            <span className={styles.stateIcon} aria-hidden="true">
              ⚠
            </span>
          )}

          {showSuccess && (
            <span className={styles.stateIcon} aria-hidden="true">
              ✓
            </span>
          )}
        </div>

        {error && (
          <p id={errorId} className={styles.errorText} role="alert" aria-live="polite">
            {error}
          </p>
        )}

        {success && !error && (
          <p id={successId} className={styles.successText} role="status" aria-live="polite">
            {success}
          </p>
        )}

        {helperText && !error && !success && (
          <p id={helperTextId} className={styles.helperText}>
            {helperText}
          </p>
        )}

        {showCharCount && maxLength && (
          <p className={styles.charCount} aria-live="polite">
            {charCount} / {maxLength}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
