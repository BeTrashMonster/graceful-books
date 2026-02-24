import { Button } from '../core/Button';
import { Card, CardHeader, CardBody, CardFooter } from '../ui/Card';
import { MarginQualityBadge } from './MarginQualityBadge';
import Decimal from 'decimal.js';
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
 * - MSRP per variant (if markup entered)
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
            <p className={styles.resultsDescription}>
              Your distribution costs and profit margins for this shipment.
            </p>
          </div>
          <div className={styles.quickActions}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // TODO: Implement export to Excel
                console.log('Export to Excel');
              }}
              title="Download these numbers to Excel"
            >
              📊 Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // TODO: Implement duplicate scenario
                console.log('Duplicate scenario');
              }}
              title="Create a copy to try different numbers"
            >
              📋 Duplicate
            </Button>
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
                <button
                  className={styles.helpIcon}
                  title="The total cost your distributor charges for this shipment, including all fees like pallet costs, storage, and delivery."
                  onClick={(e) => e.preventDefault()}
                >
                  ?
                </button>
              </div>
              <div className={styles.summaryValue}>
                ${parseFloat(results.totalDistributionCost).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>

            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>
                Distribution Cost Per Unit
                <button
                  className={styles.helpIcon}
                  title="Total distribution cost divided by the number of units in this shipment. This gets added to your base cost per unit."
                  onClick={(e) => e.preventDefault()}
                >
                  ?
                </button>
              </div>
              <div className={styles.summaryValue}>
                ${parseFloat(results.distributionCostPerUnit).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Per-Variant Results */}
          <div className={styles.variantsSection}>
            <h4 className={styles.sectionTitle}>
              Your Products
              <button
                className={styles.helpIconSmall}
                title="Each product shows your cost to make it, cost to ship it, and how much profit you'll make when it sells."
                onClick={(e) => e.preventDefault()}
              >
                ?
              </button>
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
                              <button
                                className={styles.helpIconTiny}
                                title="This is what it costs you to produce this product (ingredients, packaging, labor, etc.)"
                                onClick={(e) => e.preventDefault()}
                              >
                                ?
                              </button>
                            </span>
                            <span className={styles.metricValue}>
                              ${parseFloat(params.variantData[variantName]!.base_cpu).toFixed(2)}
                            </span>
                          </div>

                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>+ Cost to Ship It</span>
                            <span className={styles.metricValue}>
                              ${distributionCostPerUnit.toFixed(2)}
                            </span>
                          </div>

                          <div className={`${styles.metric} ${styles.totalLine}`}>
                            <span className={styles.metricLabel}>
                              <strong>Total Cost Per Unit</strong>
                            </span>
                            <span className={styles.metricValue}>
                              <strong>${parseFloat(variantResult.total_cpu).toFixed(2)}</strong>
                            </span>
                          </div>
                        </>
                      )}

                      {(!params || !params.variantData[variantName]) && (
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>Total Cost Per Unit</span>
                          <span className={styles.metricValue}>
                            ${parseFloat(variantResult.total_cpu).toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className={styles.metric}>
                        <span className={styles.metricLabel}>
                          Net Profit Margin
                          <button
                            className={styles.helpIconTiny}
                            title={`${parseFloat(variantResult.net_profit_margin).toFixed(2)}% means for every dollar you sell, you keep ${(parseFloat(variantResult.net_profit_margin) / 100).toFixed(2)} cents as profit.`}
                            onClick={(e) => e.preventDefault()}
                          >
                            ?
                          </button>
                        </span>
                        <span className={styles.metricValue}>
                          {parseFloat(variantResult.net_profit_margin).toFixed(2)}%
                        </span>
                      </div>

                      {variantResult.msrp && (
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>
                            MSRP
                            <button
                              className={styles.helpIconTiny}
                              title="Manufacturer's Suggested Retail Price - calculated by adding your markup percentage to your total cost per unit."
                              onClick={(e) => e.preventDefault()}
                            >
                              ?
                            </button>
                          </span>
                          <span className={styles.metricValue}>
                            ${parseFloat(variantResult.msrp).toFixed(2)}
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
              <button
                className={styles.helpIconSmall}
                title="Itemized list of all distributor fees included in this calculation. Understanding each fee helps you negotiate or compare distributors."
                onClick={(e) => e.preventDefault()}
              >
                ?
              </button>
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
                          ${parseFloat(fee.feeAmount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr className={styles.totalRow}>
                      <td colSpan={onRecalculate ? 3 : 2}>
                        <strong>Total</strong>
                      </td>
                      <td className={styles.rightAlign}>
                        <strong>
                          ${parseFloat(results.totalDistributionCost).toFixed(2)}
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
              variant="primary"
              onClick={onSave}
              loading={saving}
              disabled={saving}
              iconBefore={<span>💾</span>}
            >
              Save Calculation
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
