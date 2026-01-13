import { SelectHTMLAttributes, forwardRef, useId } from 'react'
import clsx from 'clsx'
import styles from './Select.module.css'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /**
   * Label text for the select
   */
  label?: string
  /**
   * Helper text displayed below the select
   */
  helperText?: string
  /**
   * Error message to display
   */
  error?: string
  /**
   * Whether the select is in an error state
   */
  hasError?: boolean
  /**
   * Options to display in the dropdown (optional - can use children instead)
   */
  options?: SelectOption[]
  /**
   * Placeholder text
   */
  placeholder?: string
  /**
   * Full width select
   */
  fullWidth?: boolean
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Select component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Native select for better accessibility and mobile support
 * - Keyboard navigation (Arrow keys, type-ahead)
 * - Screen reader support
 * - Required field indicators
 * - Error states with announcements
 * - Touch-friendly targets
 *
 * @example
 * ```tsx
 * <Select
 *   label="Country"
 *   options={[
 *     { value: 'us', label: 'United States' },
 *     { value: 'ca', label: 'Canada' },
 *     { value: 'mx', label: 'Mexico' }
 *   ]}
 *   placeholder="Select a country"
 *   required
 * />
 * ```
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      hasError,
      options,
      placeholder,
      fullWidth = false,
      size = 'md',
      className,
      id: providedId,
      required,
      disabled,
      children,
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
      <div
        className={clsx(
          styles.selectWrapper,
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
            styles.selectContainer,
            styles[size],
            showError && styles.hasError,
            disabled && styles.disabled,
          )}
        >
          <select
            ref={ref}
            id={id}
            className={styles.select}
            disabled={disabled}
            required={required}
            aria-invalid={showError}
            aria-describedby={describedBy}
            aria-required={required}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                ))
              : children}
          </select>

          <span className={styles.chevron} aria-hidden="true">
            ▼
          </span>
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

Select.displayName = 'Select'
