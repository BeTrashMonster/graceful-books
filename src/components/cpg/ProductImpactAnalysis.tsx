/**
 * Product Impact Analysis Component
 *
 * Shared component for analyzing product revenue, costs, and profitability
 * Can be used with or without owner's pay data
 */

import { useState, useEffect } from 'react';
import { Button } from '../core/Button';
import { db } from '../../db/database';
import { LaborRoleService } from '../../services/cpg/laborRole.service';
import { cpuCalculatorService } from '../../services/cpg/cpuCalculator.service';
import type { CPGFinishedProduct } from '../../db/schema/cpg.schema';
import { useCPGSettings } from '../../hooks/useCPGSettings';
import Decimal from 'decimal.js';
import styles from './ProductImpactAnalysis.module.css';

export interface OwnerExpense {
  id: string;
  description: string;
  amount: string;
  period: 'monthly' | 'yearly';
}

export interface OwnerData {
  id: string;
  name: string;
  expenses: OwnerExpense[];
  breakEvenMonthly: number;
  goodPlayMoney: string;
  goodSavings: string;
  betterPlayMoney: string;
  betterSavings: string;
  bestPlayMoney: string;
  bestSavings: string;
}

interface ProductImpactAnalysisProps {
  companyId: string;
  owners?: OwnerData[];
  calculateBreakEven?: (expenses: OwnerExpense[]) => { monthly: number; yearly: number };
  calculateScenario?: (owner: OwnerData, scenario: 'good' | 'better' | 'best') => number;
  ownerPayCalculatorLink?: string;
  showScenarioTabs?: boolean;
}

export function ProductImpactAnalysis({
  companyId,
  owners = [],
  calculateBreakEven,
  calculateScenario,
  ownerPayCalculatorLink,
  showScenarioTabs = true,
}: ProductImpactAnalysisProps) {
  const [products, setProducts] = useState<CPGFinishedProduct[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<'breakeven' | 'good' | 'better' | 'best'>('good');
  const [testUnits, setTestUnits] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(`productImpactAnalysis_testUnits_${companyId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, [companyId]);

  useEffect(() => {
    try {
      localStorage.setItem(`productImpactAnalysis_testUnits_${companyId}`, JSON.stringify(testUnits));
    } catch (err) {
      console.error('Error saving test units:', err);
    }
  }, [testUnits, companyId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const allProducts = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .and((p) => p.active && p.deleted_at === null)
        .toArray();
      setProducts(allProducts);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading products...</div>;
  }

  if (products.length === 0) {
    return (
      <div className={styles.noProducts}>
        <p>No products found. Create finished products in the <strong>My Products</strong> page to analyze their impact.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Scenario Tabs - only show if enabled */}
      {showScenarioTabs && (
        <div className={styles.scenarioTabs}>
          <button
            className={selectedScenario === 'breakeven' ? styles.tabActive : styles.tab}
            onClick={() => setSelectedScenario('breakeven')}
          >
            Break-even
          </button>
          <button
            className={selectedScenario === 'good' ? styles.tabActive : styles.tab}
            onClick={() => setSelectedScenario('good')}
          >
            Good
          </button>
          <button
            className={selectedScenario === 'better' ? styles.tabActive : styles.tab}
            onClick={() => setSelectedScenario('better')}
          >
            Better
          </button>
          <button
            className={selectedScenario === 'best' ? styles.tabActive : styles.tab}
            onClick={() => setSelectedScenario('best')}
          >
            Best
          </button>
        </div>
      )}

      <ProductImpactContent
        owners={owners}
        products={products}
        scenario={selectedScenario}
        testUnits={testUnits}
        setTestUnits={setTestUnits}
        calculateBreakEven={calculateBreakEven}
        calculateScenario={calculateScenario}
        companyId={companyId}
        ownerPayCalculatorLink={ownerPayCalculatorLink}
      />
    </div>
  );
}

// Internal component
interface ProductImpactContentProps {
  owners: OwnerData[];
  products: CPGFinishedProduct[];
  scenario: 'breakeven' | 'good' | 'better' | 'best';
  testUnits: Record<string, string>;
  setTestUnits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  calculateBreakEven?: (expenses: OwnerExpense[]) => { monthly: number; yearly: number };
  calculateScenario?: (owner: OwnerData, scenario: 'good' | 'better' | 'best') => number;
  companyId: string;
  ownerPayCalculatorLink?: string;
}

function ProductImpactContent({
  owners,
  products,
  scenario,
  testUnits,
  setTestUnits,
  calculateBreakEven,
  calculateScenario,
  companyId,
  ownerPayCalculatorLink,
}: ProductImpactContentProps) {
  const [productData, setProductData] = useState<Record<string, { price: string; cpu: string; laborCostPerUnit: string }>>({});
  const [loading, setLoading] = useState(true);
  const [dataVersion, setDataVersion] = useState(0);
  const [ownerPayPeriod, setOwnerPayPeriod] = useState<'monthly' | 'annual'>('monthly');

  const hasOwnerData = owners.length > 0 && calculateBreakEven && calculateScenario;

  const loadProductData = async (forceReload = false) => {
    try {
      setLoading(true);
      const data: Record<string, { price: string; cpu: string; laborCostPerUnit: string }> = {};
      const laborService = new LaborRoleService(db);

      // Get all labor roles to identify owner's pay roles
      const allRoles = await db.cpgLaborRoles
        .where('company_id')
        .equals(companyId)
        .and((role) => role.active && role.deleted_at === null)
        .toArray();

      // Identify owner's pay role IDs
      const ownerPayRoleIds = new Set(
        allRoles
          .filter((role) => role.description?.includes('[OWNERS_PAY]'))
          .map((role) => role.id)
      );

      for (const product of products) {
        try {
          const cpuResult = await cpuCalculatorService.calculateFinishedProductCPU(
            product.id,
            companyId,
            null
          );
          const cpu = cpuResult?.materialCPU || '0';
          const price = product.msrp || '0';

          // Calculate labor cost using the service method
          const laborResult = await laborService.calculateProductLaborCost(product.id);

          // Filter out owner's pay roles from total
          let laborCostPerUnit = new Decimal(0);
          for (const item of laborResult.breakdown) {
            if (!ownerPayRoleIds.has(item.roleId)) {
              laborCostPerUnit = laborCostPerUnit.plus(new Decimal(item.costPerUnit));
            }
          }

          data[product.id] = {
            price,
            cpu,
            laborCostPerUnit: laborCostPerUnit.toFixed(6)
          };
        } catch (error) {
          console.error(`Error processing ${product.name}:`, error);
        }
      }

      setProductData(data);
    } catch (err) {
      console.error('Error loading product data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductData(true);
  }, [products, companyId, dataVersion]);

  // Reload product data when any related data changes
  useEffect(() => {
    const handleDataUpdate = (e: CustomEvent) => {
      const updateTypes = [
        'labor-assignment',
        'labor-role',
        'invoice',
        'recipe',
        'category',
        'finished-product'
      ];

      if (updateTypes.includes(e.detail?.type)) {
        setDataVersion(v => v + 1);
      }
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate as EventListener);
    return () => window.removeEventListener('cpg-data-updated', handleDataUpdate as EventListener);
  }, []);

  const { formatCurrency: formatCurrencyFn } = useCPGSettings();

  // Export to CSV
  const exportToCSV = async () => {
    const lines: string[] = [];

    lines.push(`Sales Impact Analysis - ${scenario.charAt(0).toUpperCase() + scenario.slice(1)} Scenario`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    lines.push('=== SUMMARY ===');
    lines.push('Product,Units,Metric,Per Unit,Total');

    const testResults = calculateTestResults();
    let summaryRevenue = new Decimal(0);
    let summaryMaterials = new Decimal(0);
    let summaryLabor = new Decimal(0);

    products.forEach((product) => {
      const units = new Decimal(testUnits[product.id] || '0');
      const data = productData[product.id];

      if (data && units.greaterThan(0)) {
        const revenue = units.times(new Decimal(data.price));
        const materials = units.times(new Decimal(data.cpu));
        const labor = units.times(new Decimal(data.laborCostPerUnit));

        lines.push(`${product.name},${units},Revenue,$${data.price},$${revenue.toFixed(2)}`);
        lines.push(`${product.name},${units},Materials,$${data.cpu},$${materials.toFixed(6)}`);
        lines.push(`${product.name},${units},Labor,$${data.laborCostPerUnit},$${labor.toFixed(6)}`);
        lines.push('');

        summaryRevenue = summaryRevenue.plus(revenue);
        summaryMaterials = summaryMaterials.plus(materials);
        summaryLabor = summaryLabor.plus(labor);
      }
    });

    lines.push(',,TOTALS,,');
    lines.push(`,,Total Revenue,,$${summaryRevenue.toFixed(2)}`);
    lines.push(`,,Total Materials,,$${summaryMaterials.toFixed(6)}`);
    lines.push(`,,Total Labor (owner pay roles excluded),,$${summaryLabor.toFixed(6)}`);

    if (hasOwnerData) {
      lines.push(`,,Owner's Pay Needed (${ownerPayPeriod}),,$${getTotalOwnerPay().toFixed(2)}`);
      const gap = summaryRevenue.minus(summaryMaterials).minus(summaryLabor).minus(getTotalOwnerPay());
      lines.push(`,,${gap.greaterThanOrEqualTo(0) ? 'Available for Operations' : 'Amount to Bridge'},,$${gap.abs().toFixed(2)}`);
    } else {
      const netProfit = summaryRevenue.minus(summaryMaterials).minus(summaryLabor);
      lines.push(`,,Net Profit (before owner pay),,$${netProfit.toFixed(2)}`);
    }

    lines.push('');
    lines.push('');

    // Detail Section
    lines.push('=== DETAIL BREAKDOWN ===');

    for (const product of products) {
      const units = new Decimal(testUnits[product.id] || '0');
      if (units.lessThanOrEqualTo(0)) continue;

      const data = productData[product.id];
      if (!data) continue;

      lines.push('');
      lines.push(`Product: ${product.name}`);
      lines.push(`Units Sold: ${units}`);
      lines.push('');

      // Material Breakdown
      lines.push('Material CPU Breakdown:');
      try {
        const cpuBreakdown = await cpuCalculatorService.calculateFinishedProductCPU(
          product.id,
          companyId,
          null
        );

        if (cpuBreakdown?.breakdown) {
          lines.push('Component,Quantity,Unit,Unit Cost,Subtotal');
          cpuBreakdown.breakdown.forEach((item) => {
            lines.push(`${item.categoryName}${item.variant ? ` (${item.variant})` : ''},${item.quantity},${item.unitOfMeasure},$${item.unitCost || '0.000000'},$${item.subtotal || '0.000000'}`);
          });
          lines.push(`Total Material CPU:,,,,$${data.cpu}`);
        }
      } catch (err) {
        lines.push('Error loading material breakdown');
      }
      lines.push('');

      // Labor Breakdown
      lines.push('Labor Cost Breakdown:');
      try {
        const laborService = new LaborRoleService(db);
        const laborBreakdown = await laborService.calculateProductLaborCost(product.id);

        if (laborBreakdown?.breakdown) {
          lines.push('Role,Hours per Unit,Hourly Rate,Cost per Unit');
          laborBreakdown.breakdown.forEach((item) => {
            lines.push(`${item.roleName},${item.hoursPerUnit},$${item.hourlyRate},$${item.costPerUnit}`);
          });
          lines.push(`Total Labor Cost:,,,$${data.laborCostPerUnit}`);
        }
      } catch (err) {
        lines.push('Error loading labor breakdown');
      }
      lines.push('');

      // Product Summary
      lines.push('Product Summary:');
      lines.push(`Selling Price per Unit:,$${data.price}`);
      lines.push(`Material Cost per Unit:,$${data.cpu}`);
      lines.push(`Labor Cost per Unit:,$${data.laborCostPerUnit}`);
      const productRevenue = units.times(new Decimal(data.price));
      const productMaterials = units.times(new Decimal(data.cpu));
      const productLabor = units.times(new Decimal(data.laborCostPerUnit));
      lines.push(`Total Revenue (${units} units):,$${productRevenue.toFixed(2)}`);
      lines.push(`Total Materials (${units} units):,$${productMaterials.toFixed(6)}`);
      lines.push(`Total Labor (${units} units):,$${productLabor.toFixed(6)}`);
      lines.push('');
    }

    // Create and download CSV
    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales-impact-${scenario}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate total owner's pay needed for selected scenario
  const getTotalOwnerPay = () => {
    if (!hasOwnerData) return 0;

    const monthlyTotal = owners.reduce((sum, owner) => {
      if (scenario === 'breakeven') {
        return sum + calculateBreakEven!(owner.expenses).monthly;
      }
      return sum + calculateScenario!(owner, scenario as 'good' | 'better' | 'best');
    }, 0);

    return ownerPayPeriod === 'annual' ? monthlyTotal * 12 : monthlyTotal;
  };

  // Calculate test results with detailed breakdown using Decimal for precision
  const calculateTestResults = () => {
    const totalOwnerPay = getTotalOwnerPay();
    let grossRevenue = new Decimal(0);
    let rawCOGS = new Decimal(0);
    let laborCost = new Decimal(0);

    products.forEach((product) => {
      const units = new Decimal(testUnits[product.id] || '0');
      const data = productData[product.id];

      if (data && units.greaterThan(0)) {
        const revenue = units.times(new Decimal(data.price));
        const cogs = units.times(new Decimal(data.cpu));
        const labor = units.times(new Decimal(data.laborCostPerUnit));

        grossRevenue = grossRevenue.plus(revenue);
        rawCOGS = rawCOGS.plus(cogs);
        laborCost = laborCost.plus(labor);
      }
    });

    // Calculate bottom line
    const netBeforeOwnerPay = grossRevenue.minus(rawCOGS).minus(laborCost);
    const finalGap = netBeforeOwnerPay.minus(totalOwnerPay);

    return {
      grossRevenue: parseFloat(grossRevenue.toFixed(6)),
      rawCOGS: parseFloat(rawCOGS.toFixed(6)),
      laborCost: parseFloat(laborCost.toFixed(6)),
      totalOwnerPay,
      netBeforeOwnerPay: parseFloat(netBeforeOwnerPay.toFixed(6)),
      finalGap: parseFloat(finalGap.toFixed(6)),
      isCovered: finalGap.greaterThanOrEqualTo(0),
    };
  };

  if (loading) {
    return <div className={styles.impactLoading}>Calculating product margins...</div>;
  }

  const testResults = calculateTestResults();
  const totalOwnerPay = getTotalOwnerPay();

  return (
    <div className={styles.productImpactContainer}>
      <div className={styles.playSide}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Let's Play!</h3>
          <button
            onClick={() => setDataVersion(v => v + 1)}
            style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
            title="Reload product data from database"
          >
            🔄 Reload Data
          </button>
        </div>
        <p className={styles.playDescription}>
          Enter your projected sales to see the full breakdown: revenue, costs, and profitability.
        </p>

        <div className={styles.playInputs}>
          {products.map((product) => (
            <div key={product.id} className={styles.playInputRow}>
              <label>{product.name}</label>
              <input
                type="number"
                value={testUnits[product.id] || ''}
                onChange={(e) =>
                  setTestUnits({ ...testUnits, [product.id]: e.target.value })
                }
                className={styles.playInput}
                placeholder="0"
                min="0"
              />
              <span className={styles.unitsLabel}>units</span>
            </div>
          ))}
        </div>

        {/* Results */}
        <div className={styles.playResults}>
          <div className={styles.resultRow}>
            <span className={styles.resultLabel}>Revenue (Units × Selling Price):</span>
            <span className={styles.resultValue}>{formatCurrencyFn(testResults.grossRevenue)}</span>
          </div>
          <div className={styles.resultRow}>
            <span className={styles.resultLabel}>Raw COGS (Units × CPU):</span>
            <span className={`${styles.resultValue} ${styles.resultNegative}`}>
              -{formatCurrencyFn(testResults.rawCOGS)}
            </span>
          </div>
          <div className={styles.resultRow}>
            <span className={styles.resultLabel}>
              Labor Cost:
              <span style={{ fontStyle: 'italic', fontSize: '0.85em', color: '#666', marginLeft: '0.5rem' }}>
                (owner pay roles excluded - see below)
              </span>
            </span>
            <span className={`${styles.resultValue} ${testResults.laborCost > 0 ? styles.resultNegative : ''}`}>
              {testResults.laborCost > 0 ? '-' : ''}{formatCurrencyFn(testResults.laborCost)}
            </span>
          </div>

          {hasOwnerData ? (
            <>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>
                  Owner's Pay Needed ({ownerPayPeriod}):
                  <button
                    onClick={() => setOwnerPayPeriod(ownerPayPeriod === 'monthly' ? 'annual' : 'monthly')}
                    style={{
                      marginLeft: '0.5rem',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      border: '1px solid #D4AF37',
                      background: 'white',
                      borderRadius: '4px',
                      color: '#D4AF37',
                      fontWeight: 500,
                    }}
                    title={`Switch to ${ownerPayPeriod === 'monthly' ? 'annual' : 'monthly'} view`}
                  >
                    {ownerPayPeriod === 'monthly' ? '📅 Annual' : '📆 Monthly'}
                  </button>
                </span>
                <span className={`${styles.resultValue} ${styles.resultNegative}`}>
                  -{formatCurrencyFn(totalOwnerPay)}
                </span>
              </div>
              <div className={`${styles.resultRow} ${styles.resultFinal}`}>
                <span className={styles.resultLabel}>
                  {testResults.isCovered ? 'Available for Operations:' : 'Amount to Bridge:'}
                </span>
                <span
                  className={`${styles.resultValue} ${
                    testResults.isCovered ? styles.resultPositive : styles.resultNegative
                  }`}
                >
                  {testResults.isCovered ? '+' : ''}{formatCurrencyFn(Math.abs(testResults.finalGap))}
                </span>
              </div>
              <div className={styles.resultNote}>
                This calculation only includes the expenses listed above - it's a baseline guide, not your full picture.
              </div>
            </>
          ) : (
            <>
              <div className={`${styles.resultRow} ${styles.resultFinal}`}>
                <span className={styles.resultLabel}>Net Profit (before owner pay):</span>
                <span className={`${styles.resultValue} ${testResults.netBeforeOwnerPay >= 0 ? styles.resultPositive : styles.resultNegative}`}>
                  {testResults.netBeforeOwnerPay >= 0 ? '+' : ''}{formatCurrencyFn(testResults.netBeforeOwnerPay)}
                </span>
              </div>
              {ownerPayCalculatorLink && (
                <div className={styles.resultNote}>
                  Want to include owner's pay in this analysis?{' '}
                  <a href={ownerPayCalculatorLink} style={{ color: '#D4AF37', textDecoration: 'underline' }}>
                    Set it up here →
                  </a>
                </div>
              )}
            </>
          )}

          <Button
            variant="outline"
            onClick={exportToCSV}
            style={{ marginTop: '1rem', width: '100%' }}
          >
            📊 Export Detailed Breakdown to CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
