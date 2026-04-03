import { Button } from '../core/Button';
import { Card, CardHeader, CardBody, CardFooter } from '../ui/Card';
import { MarginQualityBadge } from './MarginQualityBadge';
import Decimal from 'decimal.js';
import { useCPGSettings } from '../../hooks/useCPGSettings';
import type { DistributionCostResult, DistributionCalcParams } from '../../services/cpg/distributionCostCalculator.service';
import styles from './DistributionResultsDisplay.module.css';

export interface DistributionResultsDisplayProps {
  /**
   * Calculation results
   */
  results: DistributionCostResult;
  /**
   * Calculation parameters (to show base CPU and fee details)
   */
  params?: DistributionCalcParams;
  /**
   * Callback when "Save Calculation" is clicked
   */
  onSave?: () => void;
  /**
   * Callback when fee quantity is adjusted (for sliders)
   */
  onRecalculate?: (updatedParams: DistributionCalcParams) => void;
  /**
   * Whether save is in progress
   */
  saving?: boolean;
  /**
   * Show save button
   */
  showSaveButton?: boolean;
}

/**
 * DistributionResultsDisplay Component
 *
 * Displays distribution cost calculation results with color-coded margins.
 *
 * Requirements: Group C2 - Distribution Cost Analyzer
 *
 * Results Display:
 * - Total distribution cost (bold, prominent)
 * - Distribution cost per unit
 * - Total CPU per variant (Base + Distribution)
 * - Net Profit Margin per variant (COLOR-CODED)
 *   - Red (< 50%): Poor
 *   - Yellow (50-60%): Good
 *   - Light Green (60-70%): Better
 *   - Dark Green (70%+): Best
 * - Sold Price per variant (if markup entered)
 * - Fee breakdown table (itemized)
 *
 * @example
 * ```tsx
 * <DistributionResultsDisplay
 *   results={calculationResults}
 *   onSave={() => handleSaveScenario()}
 *   showSaveButton={true}
 * />
 * ```
 */
export function DistributionResultsDisplay({
  results,
  params,
  onSave,
  onRecalculate,
  saving = false,
  showSaveButton = true,
}: DistributionResultsDisplayProps) {
  const { formatCurrency, formatPercentage } = useCPGSettings();
  const variantNames = Object.keys(results.variantResults);
  const distributionCostPerUnit = new Decimal(results.distributionCostPerUnit);

  // Helper to get unit label
  const getUnitLabel = (unit: string): string => {
    const labels: Record<string, string> = {
      per_pallet: 'per pallet',
      per_case: 'per case',
      per_day_full: 'per full day',
      per_day_half: 'per half day',
      per_shipment: 'per shipment',
      per_zone: 'per zone',
      flat_fee: 'flat fee',
      percentage: '%',
    };
    return labels[unit] || unit;
  };

  // Helper to check if fee needs quantity input
  const isVariableFee = (unit: string): boolean => {
    return unit === 'per_day_full' || unit === 'per_day_half' || unit.includes('per_day') || unit === 'percentage';
  };

  // Handle quantity change from slider
  const handleQuantityChange = (feeId: string, newQuantity: number) => {
    if (!params || !onRecalculate) return;

    const updatedFees = params.selectedFees.map(fee =>
      fee.feeId === feeId ? { ...fee, quantity: newQuantity.toString() } : fee
    );

    onRecalculate({
      ...params,
      selectedFees: updatedFees,
    });
  };

  // Match fee breakdown with params to get full details
  const getEnrichedFeeBreakdown = () => {
    if (!params) return results.feeBreakdown;

    return results.feeBreakdown.map((fee) => {
      const matchedFee = params.selectedFees.find(sf => sf.feeId === fee.feeId);
      return {
        ...fee,
        unit: matchedFee?.unit || 'flat_fee',
        quantity: matchedFee?.quantity || undefined,
      };
    });
  };

  const enrichedFees = getEnrichedFeeBreakdown();

  return (
    <Card variant="elevated" padding="lg">
      <CardHeader>
        <div className={styles.headerWithActions}>
          <div>
            <h3 className={styles.resultsTitle}>Distribution Cost Analysis</h3>
          </div>
          <div className={styles.quickActions}>
            <button
              onClick={() => {
                // TODO: Implement export to Excel
                console.log('Export to Excel');
              }}
              title="Download these numbers to Excel"
              className={styles.headerButton}
            >
              Export
            </button>
            <button
              onClick={() => {
                // TODO: Implement duplicate scenario
                console.log('Duplicate scenario');
              }}
              title="Create a copy to try different numbers"
              className={styles.headerButton}
            >
              Duplicate
            </button>
          </div>
        </div>
      </CardHeader>

      <CardBody>
        <div className={styles.resultsGrid}>
          {/* Summary Section */}
          <div className={styles.summarySection}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>
                Total Distribution Cost
              </div>
              <div className={styles.summaryValue}>
                {formatCurrency(parseFloat(results.totalDistributionCost))}
              </div>
            </div>

            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>
                Distribution Cost Per Unit
              </div>
              <div className={styles.summaryValue}>
                {formatCurrency(parseFloat(results.distributionCostPerUnit))}
              </div>
            </div>
          </div>

          {/* Per-Variant Results */}
          <div className={styles.variantsSection}>
            <h4 className={styles.sectionTitle}>
              Your Products
            </h4>

            <div className={styles.variantCards}>
              {variantNames.map((variantName) => {
                const variantResult = results.variantResults[variantName]!;

                return (
                  <div key={variantName} className={styles.variantCard}>
                    <div className={styles.variantHeader}>
                      <h5 className={styles.variantName}>{variantName}</h5>
                      <MarginQualityBadge
                        quality={variantResult.margin_quality}
                        marginPercentage={variantResult.net_profit_margin}
                        size="lg"
                      />
                    </div>

                    <div className={styles.variantMetrics}>
                      {params && params.variantData[variantName] && (
                        <>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>
                              Cost to Make It
                            </span>
                            <span className={styles.metricValue}>
                              {formatCurrency(parseFloat(params.variantData[variantName]!.base_cpu))}
                            </span>
                          </div>

                          {params.variantData[variantName]!.production_cpu && parseFloat(params.variantData[variantName]!.production_cpu) > 0 && (
                            <div className={styles.metric}>
                              <span className={styles.metricLabel}>+ Production Labor Cost</span>
                              <span className={styles.metricValue}>
                                {formatCurrency(parseFloat(params.variantData[variantName]!.production_cpu))}
                              </span>
                            </div>
                          )}

                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>+ Cost to Ship It</span>
                            <span className={styles.metricValue}>
                              {formatCurrency(distributionCostPerUnit.toNumber())}
                            </span>
                          </div>

                          <div className={`${styles.metric} ${styles.totalLine}`}>
                            <span className={styles.metricLabel}>
                              <strong>Total Cost Per Unit</strong>
                            </span>
                            <span className={styles.metricValue}>
                              <strong>{formatCurrency(parseFloat(variantResult.total_cpu))}</strong>
                            </span>
                          </div>
                        </>
                      )}

                      {(!params || !params.variantData[variantName]) && (
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>Total Cost Per Unit</span>
                          <span className={styles.metricValue}>
                            {formatCurrency(parseFloat(variantResult.total_cpu))}
                          </span>
                        </div>
                      )}

                      <div className={styles.metric}>
                        <span className={styles.metricLabel}>
                          Net Profit Margin
                        </span>
                        <span className={styles.metricValue}>
                          {formatPercentage(parseFloat(variantResult.net_profit_margin))}
                        </span>
                      </div>

                      {variantResult.msrp && (
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>
                            Sold Price to You
                          </span>
                          <span className={styles.metricValue}>
                            {formatCurrency(parseFloat(variantResult.msrp))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className={styles.breakdownSection}>
            <h4 className={styles.sectionTitle}>
              Fee Breakdown
            </h4>

            {results.feeBreakdown.length > 0 ? (
              <div className={styles.breakdownTable}>
                <table>
                  <thead>
                    <tr>
                      <th>Fee Name</th>
                      <th>Unit</th>
                      {onRecalculate && <th>Quantity</th>}
                      <th className={styles.rightAlign}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedFees.map((fee, index) => (
                      <tr key={index}>
                        <td>{fee.feeName}</td>
                        <td className={styles.unitCell}>{getUnitLabel(fee.unit)}</td>
                        {onRecalculate && (
                          <td>
                            {isVariableFee(fee.unit) && fee.quantity ? (
                              <div className={styles.sliderWrapper}>
                                <input
                                  type="range"
                                  min={fee.unit === 'percentage' ? '-100' : '1'}
                                  max={fee.unit === 'percentage' ? '100' : '30'}
                                  value={fee.quantity}
                                  onChange={(e) => handleQuantityChange(fee.feeId, parseInt(e.target.value))}
                                  className={styles.slider}
                                />
                                <span className={styles.sliderValue}>
                                  {fee.quantity}{fee.unit === 'percentage' ? '%' : ' days'}
                                </span>
                              </div>
                            ) : (
                              <span className={styles.fixedQuantity}>—</span>
                            )}
                          </td>
                        )}
                        <td className={styles.rightAlign}>
                          {formatCurrency(parseFloat(fee.feeAmount))}
                        </td>
                      </tr>
                    ))}
                    <tr className={styles.totalRow}>
                      <td colSpan={onRecalculate ? 3 : 2}>
                        <strong>Total</strong>
                      </td>
                      <td className={styles.rightAlign}>
                        <strong>
                          {formatCurrency(parseFloat(results.totalDistributionCost))}
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.emptyState}>
                Select some fees in the calculator above to see what you'll pay.
              </p>
            )}
          </div>
        </div>
      </CardBody>

      {showSaveButton && onSave && (
        <CardFooter>
          <div className={styles.actions}>
            <div className={styles.saveHelper}>
              <p className={styles.saveHelperText}>
                Save this calculation to refer back to it or compare different scenarios.
              </p>
            </div>
            <Button
              variant="gold"
              onClick={onSave}
              loading={saving}
              disabled={saving}
            >
              Save Calculation
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
