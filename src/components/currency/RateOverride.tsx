/**
 * Rate Override Component
 *
 * Allows users to manually override automatic exchange rates.
 * Implements WCAG 2.1 AA compliance with educational tooltips.
 *
 * Requirements:
 * - I4: Multi-Currency - Full
 * - DISC-adapted communication
 * - Educational tooltips explaining rate overrides
 * - Validation and confirmation flows
 */

import { useState, useEffect } from 'react';
import Decimal from 'decimal.js';
import type { CurrencyCode, ExchangeRate } from '../../types/currency.types';
import { ExchangeRateSource } from '../../types/currency.types';

// Configure Decimal.js for 28 decimal places precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Types
// ============================================================================

export interface RateOverrideProps {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  currentRate?: ExchangeRate;
  effectiveDate: number;
  onSave: (rate: string, notes: string) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

interface RateValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Component
// ============================================================================

/**
 * Rate Override Component
 *
 * Allows manual entry of exchange rates with validation and warnings
 */
export function RateOverride({
  fromCurrency,
  toCurrency,
  currentRate,
  effectiveDate,
  onSave,
  onCancel,
  className = '',
}: RateOverrideProps) {
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [validation, setValidation] = useState<RateValidation>({
    isValid: true,
    errors: [],
    warnings: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Initialize with current rate if available
  useEffect(() => {
    if (currentRate) {
      let rateStr = currentRate.rate;
      if (rateStr.startsWith('encrypted_')) {
        rateStr = rateStr.replace('encrypted_', '');
      }
      const rateDecimal = new Decimal(rateStr);
      setRate(rateDecimal.toFixed(6)); // Display with 6 decimal places
    }
  }, [currentRate]);

  // Validate rate on change
  useEffect(() => {
    if (!rate) {
      setValidation({ isValid: true, errors: [], warnings: [] });
      return;
    }

    const validationResult = validateRate(rate, fromCurrency, toCurrency);
    setValidation(validationResult);
  }, [rate, fromCurrency, toCurrency]);

  const handleSave = async () => {
    if (!validation.isValid) {
      return;
    }

    // Show confirmation if there are warnings
    if (validation.warnings.length > 0 && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSaving(true);
    try {
      // Convert to 28 decimal precision
      const rateDecimal = new Decimal(rate);
      await onSave(rateDecimal.toFixed(28), notes);
    } catch (error) {
      console.error('Failed to save rate override:', error);
      setValidation({
        ...validation,
        errors: [error instanceof Error ? error.message : 'Failed to save rate'],
      });
    } finally {
      setIsSaving(false);
      setShowConfirmation(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    onCancel();
  };

  return (
    <div className={`rate-override ${className}`}>
      <div className="rate-override__header">
        <h3 className="rate-override__title">
          Override Exchange Rate
        </h3>
        <p className="rate-override__subtitle">
          {fromCurrency} to {toCurrency}
        </p>
      </div>

      <div className="rate-override__content">
        {/* Educational Tooltip */}
        <div className="rate-override__help">
          <div className="help-icon" aria-label="Help">?</div>
          <div className="help-tooltip">
            <h4>Why override an exchange rate?</h4>
            <p>
              Sometimes you need to use a specific exchange rate instead of the
              automatic rate. Common reasons include:
            </p>
            <ul>
              <li>Bank charges a different rate than market rate</li>
              <li>Contract specifies a locked-in rate</li>
              <li>Correcting an incorrect automatic rate</li>
            </ul>
            <p>
              <strong>Note:</strong> Manual overrides won't update automatically.
              You'll need to update them manually if rates change.
            </p>
          </div>
        </div>

        {/* Current Rate Display */}
        {currentRate && (
          <div className="rate-override__current">
            <label>Current Rate (Automatic)</label>
            <div className="current-rate-display">
              {formatRate(currentRate.rate)} {fromCurrency} = 1 {toCurrency}
            </div>
            <div className="current-rate-source">
              Source: {currentRate.source}
            </div>
          </div>
        )}

        {/* Rate Input */}
        <div className="rate-override__input-group">
          <label htmlFor="rate-input" className="rate-override__label">
            New Exchange Rate *
          </label>
          <div className="rate-override__input-wrapper">
            <input
              id="rate-input"
              type="text"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="1.234567"
              className={`rate-override__input ${validation.errors.length > 0 ? 'has-error' : ''}`}
              aria-invalid={validation.errors.length > 0}
              aria-describedby={validation.errors.length > 0 ? 'rate-error' : 'rate-help'}
              disabled={isSaving}
            />
            <div className="rate-override__currency-pair">
              {fromCurrency} / {toCurrency}
            </div>
          </div>
          <div id="rate-help" className="rate-override__help-text">
            Enter the rate as: 1 {fromCurrency} = X {toCurrency}
          </div>
        </div>

        {/* Effective Date Display */}
        <div className="rate-override__date">
          <label>Effective Date</label>
          <div className="date-display">
            {new Date(effectiveDate).toLocaleDateString()}
          </div>
        </div>

        {/* Notes Input */}
        <div className="rate-override__input-group">
          <label htmlFor="notes-input" className="rate-override__label">
            Notes (Optional)
          </label>
          <textarea
            id="notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Explain why you're overriding this rate (e.g., 'Bank rate', 'Contract rate', etc.)"
            className="rate-override__textarea"
            rows={3}
            disabled={isSaving}
            maxLength={500}
          />
          <div className="rate-override__char-count">
            {notes.length}/500
          </div>
        </div>

        {/* Errors */}
        {validation.errors.length > 0 && (
          <div id="rate-error" className="rate-override__errors" role="alert">
            <div className="error-icon">⚠</div>
            <div className="error-content">
              {validation.errors.map((error, index) => (
                <div key={index} className="error-message">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {validation.warnings.length > 0 && (
          <div className="rate-override__warnings" role="status">
            <div className="warning-icon">⚠</div>
            <div className="warning-content">
              {validation.warnings.map((warning, index) => (
                <div key={index} className="warning-message">
                  {warning}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {showConfirmation && (
          <div className="rate-override__confirmation" role="dialog" aria-labelledby="confirm-title">
            <h4 id="confirm-title">Confirm Rate Override</h4>
            <p>
              You're about to override the exchange rate with a value that has warnings.
              Are you sure you want to continue?
            </p>
            <div className="confirmation-actions">
              <button
                onClick={handleSave}
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Yes, Override Rate'}
              </button>
              <button
                onClick={() => setShowConfirmation(false)}
                className="btn btn-secondary"
                disabled={isSaving}
              >
                Review Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="rate-override__actions">
        <button
          onClick={handleSave}
          className="btn btn-primary"
          disabled={!validation.isValid || !rate || isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Override'}
        </button>
        <button
          onClick={handleCancel}
          className="btn btn-secondary"
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>

      {/* DISC-Adapted Help Text */}
      <div className="rate-override__footer">
        <div className="disc-help" data-disc-style="conscientiousness">
          <strong>For precision:</strong> Enter rates with up to 6 decimal places.
          The system stores them with 28 decimal precision for accuracy.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate exchange rate
 */
function validateRate(
  rateStr: string,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): RateValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if rate is a valid number
  let rate: Decimal;
  try {
    rate = new Decimal(rateStr);
  } catch {
    errors.push('Please enter a valid number');
    return { isValid: false, errors, warnings };
  }

  // Check if rate is positive
  if (rate.lte(0)) {
    errors.push('Exchange rate must be greater than zero');
    return { isValid: false, errors, warnings };
  }

  // Warn if rate is unusually high
  if (rate.gt(1000)) {
    warnings.push('This rate seems unusually high. Please double-check the value.');
  }

  // Warn if rate is unusually low
  if (rate.lt(0.001)) {
    warnings.push('This rate seems unusually low. Please double-check the value.');
  }

  // Warn about specific currency pairs with known typical ranges
  if (fromCurrency === 'USD' && toCurrency === 'EUR') {
    if (rate.lt(0.7) || rate.gt(1.3)) {
      warnings.push('USD to EUR rate is typically between 0.7 and 1.3');
    }
  }

  if (fromCurrency === 'USD' && toCurrency === 'GBP') {
    if (rate.lt(0.6) || rate.gt(1.0)) {
      warnings.push('USD to GBP rate is typically between 0.6 and 1.0');
    }
  }

  if (fromCurrency === 'USD' && toCurrency === 'JPY') {
    if (rate.lt(100) || rate.gt(200)) {
      warnings.push('USD to JPY rate is typically between 100 and 200');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format rate for display
 */
function formatRate(rateStr: string): string {
  let rate = rateStr;
  if (rate.startsWith('encrypted_')) {
    rate = rate.replace('encrypted_', '');
  }
  const rateDecimal = new Decimal(rate);
  return rateDecimal.toFixed(6);
}
