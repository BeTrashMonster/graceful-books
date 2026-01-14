/**
 * Color Picker Component with WCAG Accessibility Warnings
 *
 * A color picker that supports hex input and provides accessibility warnings
 * based on WCAG 2.1 contrast ratio guidelines.
 *
 * Requirements:
 * - E3: Invoice Templates - Customizable (Nice)
 * - WCAG 2.1 AA compliance warnings
 * - Hex color validation
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  validateColorContrast,
  type ContrastValidation,
} from '../../db/schema/invoiceTemplates.schema';

export interface ColorPickerProps {
  /**
   * Current color value (hex format)
   */
  value: string;

  /**
   * Callback when color changes
   */
  onChange: (color: string) => void;

  /**
   * Label for the color picker
   */
  label: string;

  /**
   * Optional background color to check contrast against
   */
  contrastAgainst?: string;

  /**
   * Font size for contrast calculation (default: 11pt)
   */
  fontSize?: number;

  /**
   * Show contrast ratio and accessibility warnings
   */
  showAccessibilityWarnings?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Disabled state
   */
  disabled?: boolean;
}

/**
 * ColorPicker Component
 */
export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label,
  contrastAgainst,
  fontSize = 11,
  showAccessibilityWarnings = true,
  className = '',
  disabled = false,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const [contrastInfo, setContrastInfo] = useState<ContrastValidation | null>(null);

  // Validate hex color
  const validateHexColor = useCallback((color: string): boolean => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    return hexRegex.test(color);
  }, []);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Calculate contrast when colors change
  useEffect(() => {
    if (contrastAgainst && validateHexColor(value) && validateHexColor(contrastAgainst)) {
      const validation = validateColorContrast(value, contrastAgainst, fontSize);
      setContrastInfo(validation);
    } else {
      setContrastInfo(null);
    }
  }, [value, contrastAgainst, fontSize, validateHexColor]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Validate and update if valid
    const valid = validateHexColor(newValue);
    setIsValid(valid);

    if (valid) {
      onChange(newValue);
    }
  };

  // Handle color picker change
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    setIsValid(true);
    onChange(newValue);
  };

  // Handle blur - revert to last valid value if invalid
  const handleBlur = () => {
    if (!isValid) {
      setLocalValue(value);
      setIsValid(true);
    }
  };

  return (
    <div className={`color-picker ${className}`}>
      <label className="color-picker-label">
        <span className="color-picker-label-text">{label}</span>
        <div className="color-picker-input-group">
          {/* Color input (native color picker) */}
          <input
            type="color"
            value={localValue}
            onChange={handleColorChange}
            disabled={disabled}
            className="color-picker-swatch"
            title={`Select ${label.toLowerCase()}`}
            aria-label={`Select ${label.toLowerCase()}`}
          />

          {/* Text input for hex value */}
          <input
            type="text"
            value={localValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            disabled={disabled}
            className={`color-picker-input ${!isValid ? 'color-picker-input-invalid' : ''}`}
            placeholder="#000000"
            maxLength={7}
            pattern="^#[0-9A-Fa-f]{6}$"
            title="Hex color code (e.g., #2c3e50)"
            aria-label={`Hex code for ${label.toLowerCase()}`}
            aria-invalid={!isValid}
          />
        </div>
      </label>

      {/* Validation error */}
      {!isValid && (
        <div className="color-picker-error" role="alert">
          Invalid hex color. Use format: #RRGGBB (e.g., #2c3e50)
        </div>
      )}

      {/* Accessibility warnings */}
      {showAccessibilityWarnings && contrastInfo && (
        <div className="color-picker-accessibility">
          <div className="color-picker-contrast-info">
            <span className="color-picker-contrast-ratio">
              Contrast ratio: {contrastInfo.ratio.toFixed(2)}:1
            </span>
            <span
              className={`color-picker-wcag-badge ${
                contrastInfo.wcagAAA
                  ? 'wcag-aaa'
                  : contrastInfo.wcagAA
                    ? 'wcag-aa'
                    : 'wcag-fail'
              }`}
            >
              {contrastInfo.wcagAAA ? 'AAA' : contrastInfo.wcagAA ? 'AA' : 'Fail'}
            </span>
          </div>

          {contrastInfo.recommendation && (
            <div className="color-picker-warning" role="alert">
              <svg
                className="color-picker-warning-icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm1 11H7v-2h2v2zm0-4H7V4h2v4z" />
              </svg>
              <span>{contrastInfo.recommendation}</span>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .color-picker {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .color-picker-label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .color-picker-label-text {
          display: block;
        }

        .color-picker-input-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .color-picker-swatch {
          width: 48px;
          height: 38px;
          border: 2px solid #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .color-picker-swatch:hover:not(:disabled) {
          border-color: #9ca3af;
        }

        .color-picker-swatch:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .color-picker-input {
          flex: 1;
          padding: 8px 12px;
          font-size: 14px;
          font-family: 'Monaco', 'Courier New', monospace;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .color-picker-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .color-picker-input:disabled {
          background-color: #f3f4f6;
          cursor: not-allowed;
        }

        .color-picker-input-invalid {
          border-color: #ef4444;
        }

        .color-picker-input-invalid:focus {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .color-picker-error {
          font-size: 13px;
          color: #ef4444;
          padding: 4px 0;
        }

        .color-picker-accessibility {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px;
          background-color: #f9fafb;
          border-radius: 6px;
          font-size: 13px;
        }

        .color-picker-contrast-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .color-picker-contrast-ratio {
          color: #6b7280;
          font-weight: 500;
        }

        .color-picker-wcag-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
        }

        .wcag-aaa {
          background-color: #d1fae5;
          color: #065f46;
        }

        .wcag-aa {
          background-color: #fef3c7;
          color: #92400e;
        }

        .wcag-fail {
          background-color: #fee2e2;
          color: #991b1b;
        }

        .color-picker-warning {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 8px;
          background-color: #fffbeb;
          border-left: 3px solid #f59e0b;
          border-radius: 4px;
          color: #92400e;
          line-height: 1.5;
        }

        .color-picker-warning-icon {
          flex-shrink: 0;
          margin-top: 2px;
          color: #f59e0b;
        }
      `}</style>
    </div>
  );
};

export default ColorPicker;
