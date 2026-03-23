/**
 * Mark Event Complete Modal
 *
 * Allows user to enter actual results per variant when marking an event as complete.
 * Captures units sold, damaged, and demo for detailed tracking and analysis.
 */

import { useState, useEffect } from 'react';
import { Modal } from '../../modals/Modal';
import { Button } from '../../core/Button';
import styles from './MarkEventCompleteModal.module.css';

interface VariantData {
  name: string;
  unitsBrought: number;
  retailPrice: number;
  baseCPU: number;
}

interface MarkEventCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    totalRevenue: string,
    totalProfit: string,
    roi: string,
    variantSold: Record<string, number>,
    variantDamaged: Record<string, number>,
    variantDemo: Record<string, number>
  ) => Promise<void>;
  eventName: string;
  totalEventCost: string;
  variants?: VariantData[];
}

export function MarkEventCompleteModal({
  isOpen,
  onClose,
  onSubmit,
  eventName,
  totalEventCost,
  variants = [],
}: MarkEventCompleteModalProps) {
  // Per-variant tracking
  const [variantSold, setVariantSold] = useState<Record<string, string>>({});
  const [variantDamaged, setVariantDamaged] = useState<Record<string, string>>({});
  const [variantDemo, setVariantDemo] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize variant data when modal opens
  useEffect(() => {
    if (isOpen && variants.length > 0) {
      const initial: Record<string, string> = {};
      variants.forEach(v => {
        initial[v.name] = '';
      });
      setVariantSold(initial);
      setVariantDamaged(initial);
      setVariantDemo(initial);
    }
  }, [isOpen, variants]);

  // Calculate totals from variant entries
  const calculateTotals = () => {
    let totalUnitsSold = 0;
    let totalUnitsDamaged = 0;
    let totalUnitsDemo = 0;
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalUnitsBrought = 0;

    variants.forEach(variant => {
      const sold = parseFloat(variantSold[variant.name] || '0');
      const damaged = parseFloat(variantDamaged[variant.name] || '0');
      const demo = parseFloat(variantDemo[variant.name] || '0');

      if (!isNaN(sold)) {
        totalUnitsSold += sold;
        totalRevenue += sold * variant.retailPrice;
      }
      if (!isNaN(damaged)) totalUnitsDamaged += damaged;
      if (!isNaN(demo)) totalUnitsDemo += demo;

      // COGS includes ALL units that left inventory (sold, damaged, demo)
      const totalUnitsUsed = sold + damaged + demo;
      totalCOGS += totalUnitsUsed * variant.baseCPU;

      totalUnitsBrought += variant.unitsBrought;
    });

    const eventCost = parseFloat(totalEventCost);
    // Net Profit = Revenue - COGS - Event Cost
    // (Labor costs are part of event cost in this context)
    const totalProfit = totalRevenue - totalCOGS - eventCost;
    const roi = eventCost > 0 ? (totalProfit / eventCost) * 100 : 0;

    return {
      totalUnitsSold,
      totalUnitsDamaged,
      totalUnitsDemo,
      totalRevenue,
      totalCOGS,
      totalProfit,
      roi,
      totalUnitsBrought
    };
  };

  const {
    totalUnitsSold,
    totalUnitsDamaged,
    totalUnitsDemo,
    totalRevenue,
    totalCOGS,
    totalProfit,
    roi,
    totalUnitsBrought
  } = calculateTotals();

  // Calculate sell-through percentage
  const sellThroughPct = totalUnitsBrought > 0 ? (totalUnitsSold / totalUnitsBrought) * 100 : 0;

  const handleVariantChange = (variantName: string, field: 'sold' | 'damaged' | 'demo', value: string) => {
    const setter = field === 'sold' ? setVariantSold : field === 'damaged' ? setVariantDamaged : setVariantDemo;
    setter(prev => ({
      ...prev,
      [variantName]: value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate at least sold units entered
    const hasSoldData = Object.values(variantSold).some(v => v !== '' && parseFloat(v) > 0);
    if (!hasSoldData) {
      setError('Please enter units sold for at least one product');
      return;
    }

    // Validate total units don't exceed units brought
    for (const variant of variants) {
      const sold = parseFloat(variantSold[variant.name] || '0');
      const damaged = parseFloat(variantDamaged[variant.name] || '0');
      const demo = parseFloat(variantDemo[variant.name] || '0');
      const total = sold + damaged + demo;

      if (total > variant.unitsBrought) {
        setError(`Total units for "${variant.name}" (${total}) cannot exceed units brought (${variant.unitsBrought})`);
        return;
      }
    }

    // Convert to numeric breakdowns
    const soldBreakdown: Record<string, number> = {};
    const damagedBreakdown: Record<string, number> = {};
    const demoBreakdown: Record<string, number> = {};

    Object.entries(variantSold).forEach(([name, value]) => {
      const units = parseFloat(value || '0');
      if (!isNaN(units) && units > 0) {
        soldBreakdown[name] = units;
      }
    });

    Object.entries(variantDamaged).forEach(([name, value]) => {
      const units = parseFloat(value || '0');
      if (!isNaN(units) && units > 0) {
        damagedBreakdown[name] = units;
      }
    });

    Object.entries(variantDemo).forEach(([name, value]) => {
      const units = parseFloat(value || '0');
      if (!isNaN(units) && units > 0) {
        demoBreakdown[name] = units;
      }
    });

    setIsSubmitting(true);
    try {
      await onSubmit(
        totalRevenue.toFixed(2),
        totalProfit.toFixed(2),
        roi.toFixed(2),
        soldBreakdown,
        damagedBreakdown,
        demoBreakdown
      );
      // Reset form
      setVariantSold({});
      setVariantDamaged({});
      setVariantDemo({});
      onClose();
    } catch (err) {
      setError('Failed to mark event complete. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setVariantSold({});
    setVariantDamaged({});
    setVariantDemo({});
    setError(null);
    onClose();
  };

  const getSellThroughColor = (pct: number): string => {
    if (pct >= 90) return styles.excellentSellThrough;
    if (pct >= 70) return styles.goodSellThrough;
    if (pct >= 50) return styles.moderateSellThrough;
    return styles.lowSellThrough;
  };

  const getROIColor = (roiPct: number): string => {
    if (roiPct >= 100) return styles.excellentROI;
    if (roiPct >= 50) return styles.goodROI;
    if (roiPct >= 0) return styles.moderateROI;
    return styles.negativeROI;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Mark Event Complete"
      size="lg"
      closeOnBackdropClick={false}
      headerStyle={{ background: '#4b006e', color: 'white', padding: '1rem 1.5rem' }}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <p className={styles.description}>
          Enter actual results for <strong>{eventName}</strong> to track your event performance.
        </p>

        {/* Summary Stats */}
        <div className={styles.summaryCompact}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryMetric}>
              <span className={styles.summaryLabel}>Units Sold:</span>
              <span className={styles.summaryValue}>
                {totalUnitsSold.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                <span className={styles.summaryMax}>
                  / {totalUnitsBrought.toLocaleString('en-US', { maximumFractionDigits: 0 })}
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
              <span className={styles.summaryLabel}>Total Revenue:</span>
              <span className={styles.summaryValue}>
                ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className={styles.summaryMetric}>
              <span className={styles.summaryLabel}>Total COGS:</span>
              <span className={styles.summaryValue} style={{ color: '#ef4444' }}>
                ${totalCOGS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className={styles.summaryMetric}>
              <span className={styles.summaryLabel}>Net Profit:</span>
              <span className={`${styles.summaryValue} ${getROIColor(roi)}`}>
                ${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className={styles.paybackNote}>
              ROI: <span className={getROIColor(roi)}>{roi.toFixed(1)}%</span> • Event Cost: ${parseFloat(totalEventCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Per-Variant Entry */}
        <div className={styles.variantSection}>
          <h4 className={styles.sectionTitle}>Results by Product</h4>

          <div className={styles.variantList}>
            {variants.map((variant) => {
              const sold = parseFloat(variantSold[variant.name] || '0');
              const damaged = parseFloat(variantDamaged[variant.name] || '0');
              const demo = parseFloat(variantDemo[variant.name] || '0');
              const total = sold + damaged + demo;
              const remaining = variant.unitsBrought - total;
              const variantSellThrough = variant.unitsBrought > 0 ? (sold / variant.unitsBrought) * 100 : 0;
              const variantRevenue = sold * variant.retailPrice;

              return (
                <div key={variant.name} className={styles.variantRowEvent}>
                  <div className={styles.variantInfo}>
                    <div className={styles.variantName}>{variant.name}</div>
                    <div className={styles.variantAvailable}>
                      {variant.unitsBrought} brought • {remaining} remaining
                    </div>
                  </div>

                  <div className={styles.variantInputs}>
                    <div className={styles.variantInputGroup}>
                      <label className={styles.inputLabel}>Sold</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max={variant.unitsBrought}
                        value={variantSold[variant.name] || ''}
                        onChange={(e) => handleVariantChange(variant.name, 'sold', e.target.value)}
                        className={styles.input}
                        placeholder="0"
                      />
                    </div>

                    <div className={styles.variantInputGroup}>
                      <label className={styles.inputLabel}>Damaged</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max={variant.unitsBrought}
                        value={variantDamaged[variant.name] || ''}
                        onChange={(e) => handleVariantChange(variant.name, 'damaged', e.target.value)}
                        className={styles.input}
                        placeholder="0"
                      />
                    </div>

                    <div className={styles.variantInputGroup}>
                      <label className={styles.inputLabel}>Demo</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max={variant.unitsBrought}
                        value={variantDemo[variant.name] || ''}
                        onChange={(e) => handleVariantChange(variant.name, 'demo', e.target.value)}
                        className={styles.input}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className={styles.variantMetrics}>
                    {sold > 0 ? (
                      <>
                        <div className={styles.variantSellThrough}>
                          {variantSellThrough.toFixed(1)}%
                        </div>
                        <div className={styles.variantPayback}>
                          ${variantRevenue.toFixed(2)}
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

          <div className={styles.variantSummary}>
            <span>Total Units: Sold {totalUnitsSold} • Damaged {totalUnitsDamaged} • Demo {totalUnitsDemo}</span>
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
            disabled={isSubmitting || totalUnitsSold === 0}
          >
            Mark Complete
          </Button>
        </div>
      </form>
    </Modal>
  );
}
