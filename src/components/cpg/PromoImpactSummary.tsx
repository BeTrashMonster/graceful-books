import { useState } from 'react';
import clsx from 'clsx';
import styles from './PromoImpactSummary.module.css';
import { Tooltip } from '../core/Tooltip';

export interface PromoImpactSummaryProps {
  /**
   * Average margin difference across all variants
   */
  marginDifference: string;
  /**
   * Total promo cost (producer contribution)
   */
  totalPromoCost: string;
  /**
   * Total actual labor cost (cash out of pocket)
   */
  totalActualLaborCost?: string | null;
  /**
   * Total opportunity cost (owner's time valued)
   */
  totalOpportunityCost?: string | null;
  /**
   * Total units across all variants
   */
  totalUnits: string;
  /**
   * Average retail price per unit across all variants
   */
  averageRetailPrice?: string;
  /**
   * Average CPU per unit across all variants
   */
  averageCPU?: string;
  /**
   * Average sales promo cost per unit across all variants
   */
  averageSalesPromoCost?: string;
  /**
   * Average gross profit per unit WITH promo (expected scenario)
   */
  averageGrossProfitWithPromo?: string;
  /**
   * Average margin % WITH promo (expected scenario)
   */
  averageMarginWithPromo?: string;
  /**
   * Variant-specific data for per-variant what-if scenarios
   */
  variantData?: Array<{
    name: string;
    unitsAvailable: number;
    retailPrice: number;
    promoCostPerUnit: number;
    baseCPU: number;
  }>;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * PromoImpactSummary Component
 *
 * Displays high-level impact summary of the sales promo.
 *
 * Features:
 * - Margin difference (visual indicator)
 * - Total promo cost (bold, prominent)
 * - Total units
 * - Clear visual hierarchy
 * - Color-coded impact
 *
 * Requirements:
 * - WCAG 2.1 AA compliant
 * - Steadiness communication style
 * - Easy-to-scan layout
 *
 * @example
 * ```tsx
 * <PromoImpactSummary
 *   marginDifference="-10.00"
 *   totalPromoCost="1250.00"
 *   totalUnits="500"
 * />
 * ```
 */
export function PromoImpactSummary({
  marginDifference,
  totalPromoCost,
  totalActualLaborCost,
  totalOpportunityCost,
  totalUnits,
  averageRetailPrice,
  averageCPU,
  averageSalesPromoCost,
  averageGrossProfitWithPromo,
  averageMarginWithPromo,
  variantData,
  className,
}: PromoImpactSummaryProps) {
  const marginDiff = parseFloat(marginDifference);
  const isPositiveImpact = marginDiff >= 0;
  const isNegativeImpact = marginDiff < 0;

  // Tab state for what-if scenarios
  type WhatIfMode = 'per-variant' | 'overall';
  const [whatIfMode, setWhatIfMode] = useState<WhatIfMode>('per-variant');

  // State for unit adjuster (overall mode)
  const totalUnitsNum = parseFloat(totalUnits);
  const [adjustedUnits, setAdjustedUnits] = useState<number>(totalUnitsNum);

  // State for per-variant adjusters
  const [variantAdjustedUnits, setVariantAdjustedUnits] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    variantData?.forEach(v => {
      initial[v.name] = v.unitsAvailable;
    });
    return initial;
  });

  // Calculate total labor cost (actual + opportunity)
  const totalLaborCost =
    (totalActualLaborCost ? parseFloat(totalActualLaborCost) : 0) +
    (totalOpportunityCost ? parseFloat(totalOpportunityCost) : 0);

  // Calculate per-unit costs
  const expectedLaborCostPerUnit = totalUnitsNum > 0 ? totalLaborCost / totalUnitsNum : 0;
  const adjustedLaborCostPerUnit = adjustedUnits > 0 ? totalLaborCost / adjustedUnits : 0;

  // Calculate percentage of units sold
  const percentageSold = totalUnitsNum > 0 ? (adjustedUnits / totalUnitsNum) * 100 : 0;

  // Has labor costs?
  const hasLaborCosts = totalLaborCost > 0;

  // Calculate total payback amounts
  const totalPromoCostNum = parseFloat(totalPromoCost);
  const expectedTotalPayback = totalPromoCostNum;
  const adjustedTotalPayback = totalUnitsNum > 0 ? (totalPromoCostNum * (adjustedUnits / totalUnitsNum)) : 0;
  const paybackDifference = expectedTotalPayback - adjustedTotalPayback;

  // Calculate adjusted financial metrics (if we have the average data)
  const hasFinancialData = averageRetailPrice && averageCPU && averageSalesPromoCost;
  let adjustedGrossProfitPerUnit = 0;
  let adjustedMarginPercentage = 0;
  let grossProfitDifference = 0;
  let marginPointsDifference = 0;

  if (hasFinancialData) {
    const retailPrice = parseFloat(averageRetailPrice);
    const cpu = parseFloat(averageCPU);
    const salesPromo = parseFloat(averageSalesPromoCost);

    // Expected scenario uses the expected labor cost per unit
    const expectedGrossProfit = parseFloat(averageGrossProfitWithPromo || '0');
    const expectedMargin = parseFloat(averageMarginWithPromo || '0');

    // Adjusted scenario recalculates with the higher labor cost per unit
    const laborCostIncrease = adjustedLaborCostPerUnit - expectedLaborCostPerUnit;
    adjustedGrossProfitPerUnit = expectedGrossProfit - laborCostIncrease;

    // Calculate adjusted margin %
    if (retailPrice > 0) {
      adjustedMarginPercentage = (adjustedGrossProfitPerUnit / retailPrice) * 100;
    }

    // Calculate differences
    grossProfitDifference = expectedGrossProfit - adjustedGrossProfitPerUnit;
    marginPointsDifference = expectedMargin - adjustedMarginPercentage;
  }

  return (
    <div className={clsx(styles.container, className)}>
      <h3 className={styles.title}>Impact Summary</h3>

      <div className={styles.metricsGrid}>
        {/* Total Promo Cost */}
        <div className={clsx(styles.metricCard, styles.prominentCard)}>
          <div className={styles.metricLabel}>Potential Payback</div>
          <div className={clsx(styles.metricValue, styles.totalCost)}>
            <span className={styles.currency}>$</span>
            <span className={styles.amount}>
              {parseFloat(totalPromoCost).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className={styles.metricDescription}>
            Maximum payback if all units sell at promo price
          </div>
        </div>

        {/* Actual Labor Cost (if applicable) */}
        {totalActualLaborCost && parseFloat(totalActualLaborCost) > 0 && (
          <Tooltip
            content="Actual labor costs do not include employer taxes, insurance, or other applicable fees. Consult with your accountant for total employment costs."
            position="top"
          >
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>
                Actual Labor Cost<span className={styles.asterisk}>*</span>
              </div>
              <div className={clsx(styles.metricValue, styles.actualCost)}>
                <span className={styles.currency}>$</span>
                <span className={styles.amount}>
                  {parseFloat(totalActualLaborCost).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className={styles.metricDescription}>
                Cash out of pocket (paid helping hands)
              </div>
            </div>
          </Tooltip>
        )}

        {/* Total Out of Pocket (if actual labor exists) */}
        {totalActualLaborCost && parseFloat(totalActualLaborCost) > 0 && (
          <div className={clsx(styles.metricCard, styles.prominentCard, styles.totalOutOfPocket)}>
            <div className={styles.metricLabel}>Total Out of Pocket</div>
            <div className={clsx(styles.metricValue, styles.totalCost)}>
              <span className={styles.currency}>$</span>
              <span className={styles.amount}>
                {(parseFloat(totalPromoCost) + parseFloat(totalActualLaborCost)).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className={styles.metricDescription}>
              Payback + Actual Labor (cash leaving your account)
            </div>
          </div>
        )}

        {/* Opportunity Cost (if applicable) */}
        {totalOpportunityCost && parseFloat(totalOpportunityCost) > 0 && (
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Sweat Equity</div>
            <div className={clsx(styles.metricValue, styles.opportunityCost)}>
              <span className={styles.currency}>$</span>
              <span className={styles.amount}>
                {parseFloat(totalOpportunityCost).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className={styles.metricDescription}>
              Owner's time valued (opportunity cost)
            </div>
          </div>
        )}

        {/* Total Units */}
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Units</div>
          <div className={clsx(styles.metricValue, styles.totalUnits)}>
            <span className={styles.value}>
              {parseFloat(totalUnits).toLocaleString('en-US', {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
          <div className={styles.metricDescription}>
            Units committed to this promotion
          </div>
        </div>
      </div>

      {/* Interactive Unit Adjuster - only show if there are labor costs */}
      {hasLaborCosts && (
        <div className={styles.unitAdjuster}>
          <div className={styles.adjusterHeader}>
            <h4 className={styles.adjusterTitle}>💡 What-If Scenario: Adjust Units Sold</h4>
            <p className={styles.adjusterDescription}>
              See how your labor cost per unit changes if fewer units sell than expected
            </p>
          </div>

          {/* Tabs for what-if modes */}
          {variantData && variantData.length > 1 && (
            <div className={styles.tabs} role="tablist">
              <button
                role="tab"
                aria-selected={whatIfMode === 'per-variant'}
                onClick={() => setWhatIfMode('per-variant')}
                className={whatIfMode === 'per-variant' ? styles.tabActive : styles.tab}
              >
                Per Variant
              </button>
              <button
                role="tab"
                aria-selected={whatIfMode === 'overall'}
                onClick={() => setWhatIfMode('overall')}
                className={whatIfMode === 'overall' ? styles.tabActive : styles.tab}
              >
                Overall
              </button>
            </div>
          )}

          <div className={styles.adjusterControls}>
            {/* Per Variant Mode - Individual sliders */}
            {whatIfMode === 'per-variant' && variantData && (
              <>
                <div className={styles.variantSliders}>
                  {variantData.map((variant) => {
                    const variantUnits = variantAdjustedUnits[variant.name] || variant.unitsAvailable;

                    // Calculate labor cost per unit (total labor divided by all units sold)
                    const totalSoldAcrossAllVariants = Object.values(variantAdjustedUnits).reduce((sum, units) => sum + units, 0);
                    const laborCostPerUnit = totalSoldAcrossAllVariants > 0 ? totalLaborCost / totalSoldAcrossAllVariants : 0;

                    // Calculate gross profit and margin for this variant
                    const totalCostPerUnit = variant.baseCPU + variant.promoCostPerUnit + laborCostPerUnit;
                    const grossProfit = variant.retailPrice - totalCostPerUnit;
                    const margin = variant.retailPrice > 0 ? (grossProfit / variant.retailPrice) * 100 : 0;

                    return (
                      <div key={variant.name} className={styles.variantSlider}>
                        <div className={styles.variantSliderHeader}>
                          <span className={styles.variantName}>{variant.name}</span>
                          <span className={styles.variantUnitsValue}>
                            {variantUnits.toLocaleString('en-US', { maximumFractionDigits: 0 })} units
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max={variant.unitsAvailable}
                          step="1"
                          value={variantUnits}
                          onChange={(e) => {
                            setVariantAdjustedUnits(prev => ({
                              ...prev,
                              [variant.name]: parseInt(e.target.value, 10)
                            }));
                          }}
                          className={styles.slider}
                          aria-label={`Adjust units sold for ${variant.name}`}
                          aria-valuenow={variantUnits}
                          aria-valuemin={1}
                          aria-valuemax={variant.unitsAvailable}
                          aria-valuetext={`${variantUnits} units out of ${variant.unitsAvailable} total units for ${variant.name}`}
                        />
                        <div className={styles.sliderValues}>
                          <span className={styles.sliderMinMax}>1</span>
                          <span className={styles.sliderMinMax}>{variant.unitsAvailable.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                        </div>

                        {/* Per-variant metrics under slider */}
                        <div className={styles.variantMetrics}>
                          <span className={styles.variantMetric}>
                            Gross Profit: <strong>${grossProfit.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}</strong>
                          </span>
                          <span className={styles.variantMetricDivider}>|</span>
                          <span className={styles.variantMetric}>
                            Margin: <strong>{margin.toFixed(2)}%</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals Display for Per Variant Mode */}
                <div className={styles.totalsDisplay}>
                  <div className={styles.totalsGrid}>
                    <div className={styles.totalItem}>
                      <span className={styles.totalLabel}>Total Units Sold</span>
                      <span className={styles.totalValue}>
                        {Object.values(variantAdjustedUnits).reduce((sum, units) => sum + units, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className={styles.totalItem}>
                      <span className={styles.totalLabel}>Total Payback</span>
                      <span className={clsx(styles.totalValue, styles.totalValueHighlight)}>
                        ${variantData.reduce((sum, variant) => {
                          const variantUnits = variantAdjustedUnits[variant.name] || variant.unitsAvailable;
                          return sum + (variantUnits * variant.promoCostPerUnit);
                        }, 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {hasLaborCosts && (
                      <div className={styles.totalItem}>
                        <span className={styles.totalLabel}>Labor Cost/Unit</span>
                        <span className={styles.totalValue}>
                          ${(() => {
                            const totalSold = Object.values(variantAdjustedUnits).reduce((sum, units) => sum + units, 0);
                            return totalSold > 0 ? (totalLaborCost / totalSold).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) : '0.00';
                          })()}
                        </span>
                      </div>
                    )}
                    <div className={styles.totalItem}>
                      <span className={styles.totalLabel}>Average Gross Profit</span>
                      <span className={styles.totalValue}>
                        ${(() => {
                          const totalSold = Object.values(variantAdjustedUnits).reduce((sum, units) => sum + units, 0);
                          const laborCostPerUnit = totalSold > 0 ? totalLaborCost / totalSold : 0;

                          const totalGrossProfit = variantData.reduce((sum, variant) => {
                            const totalCostPerUnit = variant.baseCPU + variant.promoCostPerUnit + laborCostPerUnit;
                            const grossProfit = variant.retailPrice - totalCostPerUnit;
                            return sum + grossProfit;
                          }, 0);

                          const avgGrossProfit = variantData.length > 0 ? totalGrossProfit / variantData.length : 0;
                          return avgGrossProfit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          });
                        })()}
                      </span>
                    </div>
                    <div className={styles.totalItem}>
                      <span className={styles.totalLabel}>Average Margin %</span>
                      <span className={styles.totalValue}>
                        {(() => {
                          const totalSold = Object.values(variantAdjustedUnits).reduce((sum, units) => sum + units, 0);
                          const laborCostPerUnit = totalSold > 0 ? totalLaborCost / totalSold : 0;

                          const totalMargin = variantData.reduce((sum, variant) => {
                            const totalCostPerUnit = variant.baseCPU + variant.promoCostPerUnit + laborCostPerUnit;
                            const grossProfit = variant.retailPrice - totalCostPerUnit;
                            const margin = variant.retailPrice > 0 ? (grossProfit / variant.retailPrice) * 100 : 0;
                            return sum + margin;
                          }, 0);

                          const avgMargin = variantData.length > 0 ? totalMargin / variantData.length : 0;
                          return avgMargin.toFixed(2) + '%';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Overall Mode - Single slider with comparison cards */}
            {whatIfMode === 'overall' && (
              <>
                <div className={styles.sliderContainer}>
                  <label htmlFor="units-slider" className={styles.sliderLabel}>
                    Units Actually Sold:
                  </label>
                  <div className={styles.sliderWrapper}>
                    <input
                      id="units-slider"
                      type="range"
                      min="1"
                      max={totalUnitsNum}
                      step="1"
                      value={adjustedUnits}
                      onChange={(e) => setAdjustedUnits(parseInt(e.target.value, 10))}
                      className={styles.slider}
                      aria-label="Adjust units sold for what-if scenario"
                      aria-valuenow={adjustedUnits}
                      aria-valuemin={1}
                      aria-valuemax={totalUnitsNum}
                      aria-valuetext={`${adjustedUnits} units out of ${totalUnitsNum} total units`}
                    />
                    <div className={styles.sliderValues}>
                      <span className={styles.sliderMinMax}>1</span>
                      <span className={styles.sliderCurrent}>
                        {adjustedUnits.toLocaleString('en-US', { maximumFractionDigits: 0 })} units
                        {adjustedUnits < totalUnitsNum && (
                          <span className={styles.percentageBadge}>
                            ({percentageSold.toFixed(0)}% sold)
                          </span>
                        )}
                      </span>
                      <span className={styles.sliderMinMax}>{totalUnitsNum.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.comparisonCards}>
                  {/* Expected Scenario */}
                  <div className={styles.scenarioCard}>
                    <div className={styles.scenarioHeader}>
                      <span className={styles.scenarioIcon}>📊</span>
                      <span className={styles.scenarioTitle}>Expected (All Units Sell)</span>
                    </div>
                    <div className={styles.scenarioMetrics}>
                      <div className={styles.scenarioMetric}>
                        <span className={styles.scenarioLabel}>Units Sold:</span>
                        <span className={styles.scenarioValue}>
                          {totalUnitsNum.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className={styles.scenarioMetric}>
                        <span className={styles.scenarioLabel}>Total Payback:</span>
                        <span className={styles.scenarioValue}>
                          ${expectedTotalPayback.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className={styles.scenarioMetric}>
                        <span className={styles.scenarioLabel}>Labor Cost/Unit:</span>
                        <span className={styles.scenarioValue}>
                          ${expectedLaborCostPerUnit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      {hasFinancialData && (
                        <>
                          <div className={styles.scenarioMetric}>
                            <span className={styles.scenarioLabel}>Gross Profit/Unit:</span>
                            <span className={styles.scenarioValue}>
                              ${parseFloat(averageGrossProfitWithPromo || '0').toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className={styles.scenarioMetric}>
                            <span className={styles.scenarioLabel}>Margin %:</span>
                            <span className={styles.scenarioValue}>
                              {parseFloat(averageMarginWithPromo || '0').toFixed(2)}%
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Adjusted Scenario */}
                  <div className={clsx(styles.scenarioCard, styles.adjustedScenario)}>
                    <div className={styles.scenarioHeader}>
                      <span className={styles.scenarioIcon}>🎯</span>
                      <span className={styles.scenarioTitle}>Adjusted Scenario</span>
                    </div>
                    <div className={styles.scenarioMetrics}>
                      <div className={styles.scenarioMetric}>
                        <span className={styles.scenarioLabel}>Units Sold:</span>
                        <span className={styles.scenarioValue}>
                          {adjustedUnits.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className={styles.scenarioMetric}>
                        <span className={styles.scenarioLabel}>Total Payback:</span>
                        <span className={styles.scenarioValue}>
                          ${adjustedTotalPayback.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className={styles.scenarioMetric}>
                        <span className={styles.scenarioLabel}>Labor Cost/Unit:</span>
                        <span className={clsx(
                          styles.scenarioValue,
                          adjustedLaborCostPerUnit > expectedLaborCostPerUnit && styles.higherCost
                        )}>
                          ${adjustedLaborCostPerUnit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          {adjustedLaborCostPerUnit > expectedLaborCostPerUnit && (
                            <span className={styles.costIncrease}>
                              (+${(adjustedLaborCostPerUnit - expectedLaborCostPerUnit).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })})
                            </span>
                          )}
                        </span>
                      </div>
                      {hasFinancialData && (
                        <>
                          <div className={styles.scenarioMetric}>
                            <span className={styles.scenarioLabel}>Gross Profit/Unit:</span>
                            <span className={clsx(
                              styles.scenarioValue,
                              adjustedUnits < totalUnitsNum && adjustedGrossProfitPerUnit < parseFloat(averageGrossProfitWithPromo || '0') && styles.lowerProfit
                            )}>
                              ${adjustedGrossProfitPerUnit.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              {adjustedUnits < totalUnitsNum && grossProfitDifference > 0 && (
                                <span className={styles.profitDecrease}>
                                  (-${grossProfitDifference.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })})
                                </span>
                              )}
                            </span>
                          </div>
                          <div className={styles.scenarioMetric}>
                            <span className={styles.scenarioLabel}>Margin %:</span>
                            <span className={clsx(
                              styles.scenarioValue,
                              adjustedUnits < totalUnitsNum && adjustedMarginPercentage < parseFloat(averageMarginWithPromo || '0') && styles.lowerProfit
                            )}>
                              {adjustedMarginPercentage.toFixed(2)}%
                              {adjustedUnits < totalUnitsNum && marginPointsDifference > 0 && (
                                <span className={styles.profitDecrease}>
                                  (-{marginPointsDifference.toFixed(2)} pts)
                                </span>
                              )}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {adjustedUnits < totalUnitsNum && (
                  <div className={styles.impactNote}>
                    <span className={styles.impactIcon}>⚠️</span>
                    <p className={styles.impactText}>
                      If only {adjustedUnits.toLocaleString('en-US', { maximumFractionDigits: 0 })} units sell,
                      your total payback will be{' '}
                      <strong>
                        ${adjustedTotalPayback.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>{' '}
                      and your labor cost per unit increases to{' '}
                      <strong>
                        ${adjustedLaborCostPerUnit.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>{' '}
                      because the same total labor cost is spread across fewer units.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
