/**
 * Mark Promo Complete Modal
 *
 * Allows user to enter actual payback and units sold when marking a promo as complete.
 */

import { useState } from 'react';
import { Modal } from '../../modals/Modal';
import { Button } from '../../core/Button';
import styles from './CPGModals.module.css';

interface MarkPromoCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (actualPayback: string, actualUnitsSold: string) => Promise<void>;
  promoName: string;
  projectedPayback: string;
  projectedUnits: string;
}

export function MarkPromoCompleteModal({
  isOpen,
  onClose,
  onSubmit,
  promoName,
  projectedPayback,
  projectedUnits,
}: MarkPromoCompleteModalProps) {
  const [actualPayback, setActualPayback] = useState('');
  const [actualUnitsSold, setActualUnitsSold] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    const payback = parseFloat(actualPayback);
    const units = parseFloat(actualUnitsSold);

    if (isNaN(payback) || payback < 0) {
      setError('Please enter a valid payback amount');
      return;
    }

    if (isNaN(units) || units < 0) {
      setError('Please enter a valid number of units sold');
      return;
    }

    const projectedPaybackNum = parseFloat(projectedPayback);
    if (payback > projectedPaybackNum) {
      setError(`Actual payback ($${payback.toFixed(2)}) cannot exceed projected payback ($${projectedPaybackNum.toFixed(2)})`);
      return;
    }

    const projectedUnitsNum = parseFloat(projectedUnits);
    if (units > projectedUnitsNum) {
      setError(`Units sold (${units}) cannot exceed units available (${projectedUnitsNum})`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(actualPayback, actualUnitsSold);
      // Reset form
      setActualPayback('');
      setActualUnitsSold('');
      onClose();
    } catch (err) {
      setError('Failed to mark promo complete. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setActualPayback('');
    setActualUnitsSold('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Mark Promo Complete">
      <form onSubmit={handleSubmit} className={styles.form}>
        <p className={styles.description}>
          Enter the actual results for <strong>{promoName}</strong> to complete this promo.
        </p>

        {/* Projected vs Actual Comparison */}
        <div className={styles.comparisonBox}>
          <div className={styles.comparisonRow}>
            <span className={styles.comparisonLabel}>Projected Payback:</span>
            <span className={styles.comparisonValue}>${parseFloat(projectedPayback).toFixed(2)}</span>
          </div>
          <div className={styles.comparisonRow}>
            <span className={styles.comparisonLabel}>Units Available:</span>
            <span className={styles.comparisonValue}>{parseFloat(projectedUnits).toFixed(0)}</span>
          </div>
        </div>

        {/* Actual Payback Input */}
        <div className={styles.field}>
          <label htmlFor="actual-payback" className={styles.label}>
            Actual Payback <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputWrapper}>
            <span className={styles.currencySymbol}>$</span>
            <input
              id="actual-payback"
              type="number"
              step="0.01"
              min="0"
              max={projectedPayback}
              value={actualPayback}
              onChange={(e) => setActualPayback(e.target.value)}
              className={styles.input}
              placeholder="0.00"
              required
              autoFocus
            />
          </div>
          <p className={styles.helpText}>
            How much did you actually pay back to the retailer?
          </p>
        </div>

        {/* Actual Units Sold Input */}
        <div className={styles.field}>
          <label htmlFor="actual-units" className={styles.label}>
            Units Sold <span className={styles.required}>*</span>
          </label>
          <input
            id="actual-units"
            type="number"
            step="1"
            min="0"
            max={projectedUnits}
            value={actualUnitsSold}
            onChange={(e) => setActualUnitsSold(e.target.value)}
            className={styles.input}
            placeholder="0"
            required
          />
          <p className={styles.helpText}>
            How many total units were sold during this promo?
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Mark Complete
          </Button>
        </div>
      </form>
    </Modal>
  );
}
