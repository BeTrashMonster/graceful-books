/**
 * Mark Promo Complete Modal
 *
 * Allows user to enter actual results per variant when marking a promo as complete.
 * Captures detailed data for export and analysis while showing summary totals.
 */

import { useState, useEffect } from 'react';
import { Modal } from '../../modals/Modal';
import { Button } from '../../core/Button';
import styles from './MarkPromoCompleteModal.module.css';

interface VariantData {
  name: string;
  projectedUnits: number;
  promoCostPerUnit: number;
}

interface MarkPromoCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (actualPayback: string, actualUnitsSold: string, variantBreakdown: Record<string, number>) => Promise<void>;
  promoName: string;
  projectedPayback: string;
  projectedUnits: string;
  variants?: VariantData[];
}

export function MarkPromoCompleteModal({
  isOpen,
  onClose,
  onSubmit,
  promoName,
  projectedPayback,
  projectedUnits,
  variants = [],
}: MarkPromoCompleteModalProps) {
  // Per-variant actual units sold
  const [variantActuals, setVariantActuals] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize variant actuals when modal opens
  useEffect(() => {
    if (isOpen && variants.length > 0) {
      const initial: Record<string, string> = {};
      variants.forEach(v => {
        initial[v.name] = '';
      });
      setVariantActuals(initial);
    }
  }, [isOpen, variants]);

  // Calculate totals from variant entries
  const calculateTotals = () => {
    let totalUnits = 0;
    let totalPayback = 0;

    variants.forEach(variant => {
      const units = parseFloat(variantActuals[variant.name] || '0');
      if (!isNaN(units)) {
        totalUnits += units;
        totalPayback += units * variant.promoCostPerUnit;
      }
    });

    return { totalUnits, totalPayback };
  };

  const { totalUnits, totalPayback } = calculateTotals();

  // Calculate sell-through percentage
  const projectedUnitsNum = parseFloat(projectedUnits);
  const sellThroughPct = projectedUnitsNum > 0 ? (totalUnits / projectedUnitsNum) * 100 : 0;

  const handleVariantChange = (variantName: string, value: string) => {
    setVariantActuals(prev => ({
      ...prev,
      [variantName]: value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate at least one variant has data
    const hasData = Object.values(variantActuals).some(v => v !== '' && parseFloat(v) > 0);
    if (!hasData) {
      setError('Please enter units sold for at least one product');
      return;
    }

    // Validate individual variants
    for (const variant of variants) {
      const units = parseFloat(variantActuals[variant.name] || '0');
      if (units > variant.projectedUnits) {
        setError(`Units sold for "${variant.name}" (${units}) cannot exceed units available (${variant.projectedUnits})`);
        return;
      }
    }

    // Convert to numeric breakdown
    const variantBreakdown: Record<string, number> = {};
    Object.entries(variantActuals).forEach(([name, value]) => {
      const units = parseFloat(value || '0');
      if (!isNaN(units) && units > 0) {
        variantBreakdown[name] = units;
      }
    });

    setIsSubmitting(true);
    try {
      await onSubmit(
        totalPayback.toFixed(2),
        totalUnits.toString(),
        variantBreakdown
      );
      // Reset form
      setVariantActuals({});
      onClose();
    } catch (err) {
      setError('Failed to mark promo complete. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setVariantActuals({});
    setError(null);
    onClose();
  };

  const getSellThroughColor = (pct: number): string => {
    if (pct >= 90) return styles.excellentSellThrough;
    if (pct >= 70) return styles.goodSellThrough;
    if (pct >= 50) return styles.moderateSellThrough;
    return styles.lowSellThrough;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Mark Promo Complete"
      size="lg"
      closeOnBackdropClick={false}
      headerStyle={{ background: '#4b006e', color: 'white', padding: '1rem 1.5rem' }}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <p className={styles.description}>
          Enter actual units sold for <strong>{promoName}</strong> to track your promo performance.
        </p>

        {/* Compact Summary */}
        <div className={styles.summaryCompact}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryMetric}>
              <span className={styles.summaryLabel}>Units Sold:</span>
              <span className={styles.summaryValue}>
                {totalUnits.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                <span className={styles.summaryMax}>
                  / {parseFloat(projectedUnits).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </span>
            </div>
            <div className={styles.sellThroughBar}>
              <div
                className={`${styles.sellThroughFill} ${getSellThroughColor(sellThroughPct)}`}
                style={{ width: `${Math.min(sellThroughPct, 100)}%` }}
              />
            </div>
            <div className={styles.sellThroughPct}>
              {sellThroughPct.toFixed(1)}% Sell-Through
            </div>
          </div>

          <div className={styles.summaryItem}>
            <div className={styles.summaryMetric}>
              <span className={styles.summaryLabel}>Total Payback:</span>
              <span className={styles.summaryValue}>
                ${totalPayback.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className={styles.paybackNote}>
              Auto-calculated • ${parseFloat(projectedPayback).toLocaleString('en-US', { minimumFractionDigits: 2 })} projected
            </div>
          </div>
        </div>

        {/* Per-Variant Entry - Compact */}
        <div className={styles.variantSection}>
          <h4 className={styles.sectionTitle}>Units Sold by Product</h4>

          <div className={styles.variantList}>
            {variants.map((variant) => {
              const actualUnits = parseFloat(variantActuals[variant.name] || '0');
              const variantSellThrough = variant.projectedUnits > 0
                ? (actualUnits / variant.projectedUnits) * 100
                : 0;
              const variantPayback = actualUnits * variant.promoCostPerUnit;

              return (
                <div key={variant.name} className={styles.variantRow}>
                  <div className={styles.variantInfo}>
                    <div className={styles.variantName}>{variant.name}</div>
                    <div className={styles.variantAvailable}>
                      {variant.projectedUnits} available
                    </div>
                  </div>

                  <div className={styles.variantInput}>
                    <input
                      id={`units-${variant.name}`}
                      type="number"
                      step="1"
                      min="0"
                      max={variant.projectedUnits}
                      value={variantActuals[variant.name] || ''}
                      onChange={(e) => handleVariantChange(variant.name, e.target.value)}
                      className={styles.input}
                      placeholder="0"
                    />
                  </div>

                  <div className={styles.variantMetrics}>
                    {actualUnits > 0 ? (
                      <>
                        <div className={styles.variantSellThrough}>
                          {variantSellThrough.toFixed(1)}%
                        </div>
                        <div className={styles.variantPayback}>
                          ${variantPayback.toFixed(2)}
                        </div>
                      </>
                    ) : (
                      <div className={styles.variantPlaceholder}>—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className={styles.error} role="alert">
            ⚠️ {error}
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
            disabled={isSubmitting || totalUnits === 0}
          >
            Mark Complete
          </Button>
        </div>
      </form>
    </Modal>
  );
}
