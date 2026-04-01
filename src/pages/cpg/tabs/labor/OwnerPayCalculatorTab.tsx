/**
 * Owner's Pay Calculator Tab
 *
 * Helps business owners calculate their personal compensation needs
 * across multiple scenarios (Break-even, Good, Better, Best).
 *
 * Features:
 * - Essential expenses tracking
 * - Multiple compensation scenarios
 * - Support for multiple owners
 * - Product impact analysis
 * - Export labor roles from scenarios
 */

import { useState, useEffect } from 'react';
import { Button } from '../../../../components/core/Button';
import { Modal } from '../../../../components/modals/Modal';
import { useAuth } from '../../../../contexts/AuthContext';
import { db } from '../../../../db/database';
import { LaborRoleService } from '../../../../services/cpg/laborRole.service';
import { cpuCalculatorService } from '../../../../services/cpg/cpuCalculator.service';
import type { CPGFinishedProduct, CPGLaborRole, CPGProductLabor } from '../../../../db/schema/cpg.schema';
import styles from './OwnerPayCalculatorTab.module.css';

interface Expense {
  id: string;
  description: string;
  amount: string;
  period: 'monthly' | 'yearly';
}

interface Owner {
  id: string;
  name: string;
  active: boolean; // Controls visibility, not deletion
  expenses: Expense[];
  // Scenarios
  breakEvenMonthly: number;
  goodPlayMoney: string;
  goodSavings: string;
  goodPercentIncrease: string;
  betterPlayMoney: string;
  betterSavings: string;
  betterPercentIncrease: string;
  bestPlayMoney: string;
  bestSavings: string;
  bestPercentIncrease: string;
}

const DEFAULT_EXPENSES: Omit<Expense, 'id'>[] = [
  { description: 'Housing (Rent/Mortgage)', amount: '2000', period: 'monthly' },
  { description: 'Food & Groceries', amount: '800', period: 'monthly' },
  { description: 'Transportation', amount: '400', period: 'monthly' },
  { description: 'Insurance (Health, Auto, Life)', amount: '500', period: 'monthly' },
  { description: 'Utilities', amount: '200', period: 'monthly' },
  { description: 'Debt Payments', amount: '0', period: 'monthly' },
  { description: 'Healthcare & Medical', amount: '150', period: 'monthly' },
  { description: 'Childcare', amount: '0', period: 'monthly' },
];

export function OwnerPayCalculatorTab() {
  const { companyId, deviceId } = useAuth();
  const [service] = useState(() => new LaborRoleService(db));

  const [owners, setOwners] = useState<Owner[]>(() => {
    // Load saved owners from localStorage
    try {
      const saved = localStorage.getItem(`ownerPayCalculator_owners_${companyId}`);
      if (saved) {
        const parsedOwners = JSON.parse(saved);
        // Migration: ensure all existing owners have the 'active' field
        return parsedOwners.map((owner: Owner) => ({
          ...owner,
          active: owner.active !== undefined ? owner.active : true,
        }));
      }
      return [];
    } catch (err) {
      console.error('Error loading saved owners:', err);
      return [];
    }
  });
  const [products, setProducts] = useState<CPGFinishedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Product Impact Test Values
  const [selectedScenario, setSelectedScenario] = useState<'breakeven' | 'good' | 'better' | 'best'>('good');
  const [testUnits, setTestUnits] = useState<Record<string, string>>(() => {
    // Load saved test units from localStorage
    try {
      const saved = localStorage.getItem(`ownerPayCalculator_testUnits_${companyId}`);
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      console.error('Error loading saved test units:', err);
      return {};
    }
  });

  // Labor Role Management
  const [existingLaborRoles, setExistingLaborRoles] = useState<Record<string, CPGLaborRole>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', details: '' });
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, [companyId]);

  // Save test units to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(`ownerPayCalculator_testUnits_${companyId}`, JSON.stringify(testUnits));
    } catch (err) {
      console.error('Error saving test units:', err);
    }
  }, [testUnits, companyId]);

  // Save owners data to localStorage whenever it changes
  useEffect(() => {
    if (owners.length > 0) {
      try {
        localStorage.setItem(`ownerPayCalculator_owners_${companyId}`, JSON.stringify(owners));
      } catch (err) {
        console.error('Error saving owners:', err);
      }
    }
  }, [owners, companyId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load products
      const allProducts = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .and((p) => p.active && p.deleted_at === null)
        .toArray();
      setProducts(allProducts);

      // Load existing labor roles created from this calculator
      await loadExistingLaborRoles();

      // Initialize with one owner if none exist
      if (owners.length === 0) {
        addOwner();
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingLaborRoles = async () => {
    try {
      const allRoles = await db.cpgLaborRoles
        .where('company_id')
        .equals(companyId)
        .and((role) => role.active && role.deleted_at === null && role.description?.includes('[OWNERS_PAY]'))
        .toArray();

      // Index by role name for quick lookup
      const rolesMap: Record<string, CPGLaborRole> = {};
      allRoles.forEach((role) => {
        rolesMap[role.role_name] = role;
      });
      setExistingLaborRoles(rolesMap);
    } catch (err) {
      console.error('Error loading existing labor roles:', err);
    }
  };

  const addOwner = () => {
    // First check if there are any inactive owners to reactivate
    const inactiveOwner = owners.find((o) => !o.active);

    if (inactiveOwner) {
      // Reactivate the first inactive owner
      setOwners(owners.map((o) => (o.id === inactiveOwner.id ? { ...o, active: true } : o)));
    } else {
      // No inactive owners, create a new one
      const newOwner: Owner = {
        id: `owner-${Date.now()}`,
        name: "Owner's Pay",
        active: true,
        expenses: DEFAULT_EXPENSES.map((exp, idx) => ({
          ...exp,
          id: `expense-${Date.now()}-${idx}`,
        })),
        breakEvenMonthly: 0,
        goodPlayMoney: '500',
        goodSavings: '300',
        goodPercentIncrease: '',
        betterPlayMoney: '1000',
        betterSavings: '800',
        betterPercentIncrease: '',
        bestPlayMoney: '2000',
        bestSavings: '1500',
        bestPercentIncrease: '',
      };
      setOwners([...owners, newOwner]);
    }
  };

  const removeOwner = (ownerId: string) => {
    // Prevent removing the last active owner
    const activeOwners = owners.filter((o) => o.active);
    if (activeOwners.length === 1) {
      alert('You must have at least one active owner.');
      return;
    }
    // Mark as inactive instead of deleting - preserves all data
    setOwners(owners.map((o) => (o.id === ownerId ? { ...o, active: false } : o)));
  };

  const updateOwnerName = (ownerId: string, name: string) => {
    setOwners(owners.map((o) => (o.id === ownerId ? { ...o, name } : o)));
  };

  const addExpense = (ownerId: string) => {
    setOwners(
      owners.map((o) =>
        o.id === ownerId
          ? {
              ...o,
              expenses: [
                ...o.expenses,
                {
                  id: `expense-${Date.now()}`,
                  description: '',
                  amount: '0',
                  period: 'monthly',
                },
              ],
            }
          : o
      )
    );
  };

  const updateExpense = (ownerId: string, expenseId: string, field: keyof Expense, value: string | 'monthly' | 'yearly') => {
    setOwners(
      owners.map((o) =>
        o.id === ownerId
          ? {
              ...o,
              expenses: o.expenses.map((exp) =>
                exp.id === expenseId ? { ...exp, [field]: value } : exp
              ),
            }
          : o
      )
    );
  };

  const deleteExpense = (ownerId: string, expenseId: string) => {
    setOwners(
      owners.map((o) =>
        o.id === ownerId
          ? {
              ...o,
              expenses: o.expenses.filter((exp) => exp.id !== expenseId),
            }
          : o
      )
    );
  };

  const calculateBreakEven = (expenses: Expense[]): { monthly: number; yearly: number } => {
    const monthlyTotal = expenses.reduce((sum, exp) => {
      const amount = parseFloat(exp.amount) || 0;
      if (exp.period === 'yearly') {
        return sum + amount / 12;
      }
      return sum + amount;
    }, 0);

    return {
      monthly: monthlyTotal,
      yearly: monthlyTotal * 12,
    };
  };

  const calculateScenario = (owner: Owner, scenario: 'good' | 'better' | 'best'): number => {
    const breakEven = calculateBreakEven(owner.expenses).monthly;
    let playMoney = 0;
    let savings = 0;

    if (scenario === 'good') {
      playMoney = parseFloat(owner.goodPlayMoney) || 0;
      savings = parseFloat(owner.goodSavings) || 0;
    } else if (scenario === 'better') {
      playMoney = parseFloat(owner.betterPlayMoney) || 0;
      savings = parseFloat(owner.betterSavings) || 0;
    } else {
      playMoney = parseFloat(owner.bestPlayMoney) || 0;
      savings = parseFloat(owner.bestSavings) || 0;
    }

    return breakEven + playMoney + savings;
  };

  const updateScenarioField = (
    ownerId: string,
    field: keyof Pick<Owner, 'goodPlayMoney' | 'goodSavings' | 'betterPlayMoney' | 'betterSavings' | 'bestPlayMoney' | 'bestSavings'>,
    value: string
  ) => {
    setOwners(owners.map((o) => (o.id === ownerId ? { ...o, [field]: value } : o)));
  };

  const getRoleButtonText = (ownerName: string, scenario: string): string => {
    const scenarioLabel = scenario.charAt(0).toUpperCase() + scenario.slice(1);
    const roleName = `${ownerName} - ${scenarioLabel}`;
    return existingLaborRoles[roleName] ? 'Update Labor Role' : 'Create Labor Role';
  };

  const createOrUpdateLaborRole = async (owner: Owner, scenario: 'breakeven' | 'good' | 'better' | 'best') => {
    try {
      const breakEven = calculateBreakEven(owner.expenses).monthly;
      let monthlyPay = breakEven;

      if (scenario === 'good') monthlyPay = calculateScenario(owner, 'good');
      else if (scenario === 'better') monthlyPay = calculateScenario(owner, 'better');
      else if (scenario === 'best') monthlyPay = calculateScenario(owner, 'best');

      // Calculate hourly rate (assuming 2080 hours per year = 40hrs/week * 52 weeks)
      const yearlyPay = monthlyPay * 12;
      const hourlyRate = (yearlyPay / 2080).toFixed(2);

      const scenarioLabel = scenario.charAt(0).toUpperCase() + scenario.slice(1);
      const roleName = `${owner.name} - ${scenarioLabel}`;

      const existingRole = existingLaborRoles[roleName];
      const isUpdate = !!existingRole;

      if (isUpdate) {
        // Update existing role
        await service.updateRole(
          existingRole.id,
          {
            salaryAmount: yearlyPay.toFixed(2),
            salaryPeriod: 'yearly',
            notes: existingRole.notes
              ? `${existingRole.notes}\nUpdated on ${effectiveDate}: New yearly salary $${yearlyPay.toFixed(2)}`
              : `Updated on ${effectiveDate}: New yearly salary $${yearlyPay.toFixed(2)}`,
          },
          deviceId || 'default'
        );
      } else {
        // Create new role
        await service.createRole(
          companyId,
          roleName,
          'salary',
          {
            salaryAmount: yearlyPay.toFixed(2),
            salaryPeriod: 'yearly',
          },
          deviceId || 'default',
          {
            description: `Owner's pay calculation (${scenarioLabel} scenario) [OWNERS_PAY]`,
          }
        );
      }

      // Reload existing labor roles
      await loadExistingLaborRoles();

      // Dispatch update event
      window.dispatchEvent(
        new CustomEvent('cpg-data-updated', { detail: { type: 'labor-role' } })
      );

      // Show success modal
      setSuccessMessage({
        title: isUpdate ? 'Labor Role Updated!' : 'Labor Role Created!',
        details: `${roleName}\nYearly Salary: $${yearlyPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nHourly Rate: $${hourlyRate}/hr${isUpdate ? `\nEffective Date: ${effectiveDate}` : ''}`,
      });
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to create/update labor role:', error);
      alert('Failed to save labor role. Please try again.');
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Owner Cards */}
      {owners.filter((o) => o.active).map((owner) => {
        const breakEven = calculateBreakEven(owner.expenses);
        const goodTotal = calculateScenario(owner, 'good');
        const betterTotal = calculateScenario(owner, 'better');
        const bestTotal = calculateScenario(owner, 'best');

        return (
          <div key={owner.id} className={styles.ownerCard}>
            {/* Owner Name */}
            <div className={styles.ownerHeader}>
              <input
                type="text"
                value={owner.name}
                onChange={(e) => updateOwnerName(owner.id, e.target.value)}
                className={styles.ownerNameInput}
              />
              {owners.filter((o) => o.active).length > 1 && (
                <button
                  onClick={() => removeOwner(owner.id)}
                  className={styles.removeOwnerButton}
                  title="Remove this owner"
                >
                  ×
                </button>
              )}
            </div>

            {/* Essential Expenses */}
            <div className={styles.section}>
              <h2>Essential Expenses</h2>
              <p>List all your personal expenses needed to keep the lights on.</p>

              <table className={styles.expenseTable}>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Period</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {owner.expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>
                        <input
                          type="text"
                          value={expense.description}
                          onChange={(e) =>
                            updateExpense(owner.id, expense.id, 'description', e.target.value)
                          }
                          className={styles.inputField}
                          placeholder="Expense description"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={expense.amount}
                          onChange={(e) =>
                            updateExpense(owner.id, expense.id, 'amount', e.target.value)
                          }
                          className={styles.inputField}
                          placeholder="0.00"
                        />
                      </td>
                      <td>
                        <div className={styles.periodToggle}>
                          <button
                            className={expense.period === 'monthly' ? styles.toggleActive : styles.toggleButton}
                            onClick={() => updateExpense(owner.id, expense.id, 'period', 'monthly')}
                          >
                            Monthly
                          </button>
                          <button
                            className={expense.period === 'yearly' ? styles.toggleActive : styles.toggleButton}
                            onClick={() => updateExpense(owner.id, expense.id, 'period', 'yearly')}
                          >
                            Yearly
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => deleteExpense(owner.id, expense.id)}
                          className={styles.deleteButton}
                          title="Delete expense"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Button variant="outline" onClick={() => addExpense(owner.id)}>
                + Add Expense
              </Button>

              <div className={styles.breakEvenSummary}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Monthly Break-even:</span>
                  <span className={styles.summaryValue}>${breakEven.monthly.toFixed(2)}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Yearly Break-even:</span>
                  <span className={styles.summaryValue}>${breakEven.yearly.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Beyond Break-Even */}
            <div className={styles.section}>
              <h2>Beyond Break-Even</h2>
              <p>Define what Good, Better, and Best looks like for your compensation.</p>

              {/* Effective Date for Updates */}
              {Object.values(existingLaborRoles).some((role) => role.role_name.startsWith(owner.name)) && (
                <div className={styles.effectiveDateSection}>
                  <label htmlFor="effective-date" className={styles.effectiveDateLabel}>
                    Effective Date for Updates:
                  </label>
                  <input
                    id="effective-date"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className={styles.effectiveDateInput}
                  />
                  <span className={styles.effectiveDateHint}>
                    This date will be recorded when updating existing labor roles
                  </span>
                </div>
              )}

              <div className={styles.scenarioGrid}>
                {/* Break-even Column */}
                <div className={styles.scenarioColumn}>
                  <h3 className={styles.scenarioTitle}>Break-even</h3>
                  <div className={styles.scenarioContent}>
                    <div className={styles.scenarioRow}>
                      <span className={styles.scenarioLabel}>Play Money:</span>
                      <span className={styles.scenarioValue}>$0.00</span>
                    </div>
                    <div className={styles.scenarioRow}>
                      <span className={styles.scenarioLabel}>Savings:</span>
                      <span className={styles.scenarioValue}>$0.00</span>
                    </div>
                    <div className={styles.scenarioTotal}>
                      <span className={styles.scenarioLabel}>TOTAL:</span>
                      <span className={styles.scenarioValue}>
                        ${breakEven.monthly.toFixed(2)}/mo
                      </span>
                      <span className={styles.scenarioYearly}>
                        (${breakEven.yearly.toFixed(2)}/year)
                      </span>
                    </div>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => createOrUpdateLaborRole(owner, 'breakeven')}
                    >
                      {getRoleButtonText(owner.name, 'breakeven')}
                    </Button>
                  </div>
                </div>

                {/* Good Column */}
                <div className={styles.scenarioColumn}>
                  <h3 className={styles.scenarioTitle}>Good</h3>
                  <div className={styles.scenarioContent}>
                    <div className={styles.scenarioRow}>
                      <label className={styles.scenarioLabel}>Play Money:</label>
                      <input
                        type="number"
                        value={owner.goodPlayMoney}
                        onChange={(e) => updateScenarioField(owner.id, 'goodPlayMoney', e.target.value)}
                        className={styles.scenarioInput}
                        placeholder="500"
                      />
                    </div>
                    <div className={styles.scenarioRow}>
                      <label className={styles.scenarioLabel}>Savings:</label>
                      <input
                        type="number"
                        value={owner.goodSavings}
                        onChange={(e) => updateScenarioField(owner.id, 'goodSavings', e.target.value)}
                        className={styles.scenarioInput}
                        placeholder="300"
                      />
                    </div>
                    <div className={styles.scenarioTotal}>
                      <span className={styles.scenarioLabel}>TOTAL:</span>
                      <span className={styles.scenarioValue}>
                        ${goodTotal.toFixed(2)}/mo
                      </span>
                      <span className={styles.scenarioYearly}>
                        (${(goodTotal * 12).toFixed(2)}/year)
                      </span>
                    </div>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => createOrUpdateLaborRole(owner, 'good')}
                    >
                      {getRoleButtonText(owner.name, 'good')}
                    </Button>
                  </div>
                </div>

                {/* Better Column */}
                <div className={styles.scenarioColumn}>
                  <h3 className={styles.scenarioTitle}>Better</h3>
                  <div className={styles.scenarioContent}>
                    <div className={styles.scenarioRow}>
                      <label className={styles.scenarioLabel}>Play Money:</label>
                      <input
                        type="number"
                        value={owner.betterPlayMoney}
                        onChange={(e) => updateScenarioField(owner.id, 'betterPlayMoney', e.target.value)}
                        className={styles.scenarioInput}
                        placeholder="1000"
                      />
                    </div>
                    <div className={styles.scenarioRow}>
                      <label className={styles.scenarioLabel}>Savings:</label>
                      <input
                        type="number"
                        value={owner.betterSavings}
                        onChange={(e) => updateScenarioField(owner.id, 'betterSavings', e.target.value)}
                        className={styles.scenarioInput}
                        placeholder="800"
                      />
                    </div>
                    <div className={styles.scenarioTotal}>
                      <span className={styles.scenarioLabel}>TOTAL:</span>
                      <span className={styles.scenarioValue}>
                        ${betterTotal.toFixed(2)}/mo
                      </span>
                      <span className={styles.scenarioYearly}>
                        (${(betterTotal * 12).toFixed(2)}/year)
                      </span>
                    </div>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => createOrUpdateLaborRole(owner, 'better')}
                    >
                      {getRoleButtonText(owner.name, 'better')}
                    </Button>
                  </div>
                </div>

                {/* Best Column */}
                <div className={styles.scenarioColumn}>
                  <h3 className={styles.scenarioTitle}>Best</h3>
                  <div className={styles.scenarioContent}>
                    <div className={styles.scenarioRow}>
                      <label className={styles.scenarioLabel}>Play Money:</label>
                      <input
                        type="number"
                        value={owner.bestPlayMoney}
                        onChange={(e) => updateScenarioField(owner.id, 'bestPlayMoney', e.target.value)}
                        className={styles.scenarioInput}
                        placeholder="2000"
                      />
                    </div>
                    <div className={styles.scenarioRow}>
                      <label className={styles.scenarioLabel}>Savings:</label>
                      <input
                        type="number"
                        value={owner.bestSavings}
                        onChange={(e) => updateScenarioField(owner.id, 'bestSavings', e.target.value)}
                        className={styles.scenarioInput}
                        placeholder="1500"
                      />
                    </div>
                    <div className={styles.scenarioTotal}>
                      <span className={styles.scenarioLabel}>TOTAL:</span>
                      <span className={styles.scenarioValue}>
                        ${bestTotal.toFixed(2)}/mo
                      </span>
                      <span className={styles.scenarioYearly}>
                        (${(bestTotal * 12).toFixed(2)}/year)
                      </span>
                    </div>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => createOrUpdateLaborRole(owner, 'best')}
                    >
                      {getRoleButtonText(owner.name, 'best')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Have More Owners? */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Have more owners?</h3>
          <Button variant="purple" onClick={addOwner}>
            + Add Owner
          </Button>
        </div>
      </div>

      {/* All Owners Summary */}
      {owners.filter((o) => o.active).length > 1 && (
        <div className={styles.section}>
          <h2>All Owners Summary</h2>
          <p>Combined compensation needs for all owners.</p>

          <div className={styles.grandTotalGrid}>
            <div className={styles.grandTotalItem}>
              <span className={styles.grandTotalLabel}>Break-even</span>
              <span className={styles.grandTotalValue}>
                $
                {owners
                  .filter((o) => o.active)
                  .reduce((sum, o) => sum + calculateBreakEven(o.expenses).monthly, 0)
                  .toFixed(2)}
                /mo
              </span>
            </div>
            <div className={styles.grandTotalItem}>
              <span className={styles.grandTotalLabel}>Good</span>
              <span className={styles.grandTotalValue}>
                ${owners.filter((o) => o.active).reduce((sum, o) => sum + calculateScenario(o, 'good'), 0).toFixed(2)}/mo
              </span>
            </div>
            <div className={styles.grandTotalItem}>
              <span className={styles.grandTotalLabel}>Better</span>
              <span className={styles.grandTotalValue}>
                ${owners.filter((o) => o.active).reduce((sum, o) => sum + calculateScenario(o, 'better'), 0).toFixed(2)}/mo
              </span>
            </div>
            <div className={styles.grandTotalItem}>
              <span className={styles.grandTotalLabel}>Best</span>
              <span className={styles.grandTotalValue}>
                ${owners.filter((o) => o.active).reduce((sum, o) => sum + calculateScenario(o, 'best'), 0).toFixed(2)}/mo
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Product Impact Analysis */}
      {owners.filter((o) => o.active).length > 0 && (
        <div className={styles.section}>
          <h2>Product Impact Analysis</h2>
          <p>Test your sales projections to see if they'll cover raw costs, labor, and owner's pay.</p>

          {products.length === 0 ? (
            <div className={styles.noProductsMessage}>
              <p>No products found. Create finished products in the <strong>My Products</strong> page to see how they impact your owner's pay needs.</p>
            </div>
          ) : (
            <>
              {/* Scenario Tabs */}
              <div className={styles.productImpactTabs}>
                <button
                  className={selectedScenario === 'breakeven' ? styles.impactTabActive : styles.impactTab}
                  onClick={() => setSelectedScenario('breakeven')}
                >
                  Break-even
                </button>
                <button
                  className={selectedScenario === 'good' ? styles.impactTabActive : styles.impactTab}
                  onClick={() => setSelectedScenario('good')}
                >
                  Good
                </button>
                <button
                  className={selectedScenario === 'better' ? styles.impactTabActive : styles.impactTab}
                  onClick={() => setSelectedScenario('better')}
                >
                  Better
                </button>
                <button
                  className={selectedScenario === 'best' ? styles.impactTabActive : styles.impactTab}
                  onClick={() => setSelectedScenario('best')}
                >
                  Best
                </button>
              </div>

              <ProductImpactContent
                owners={owners.filter((o) => o.active)}
                products={products}
                scenario={selectedScenario}
                testUnits={testUnits}
                setTestUnits={setTestUnits}
                calculateBreakEven={calculateBreakEven}
                calculateScenario={calculateScenario}
                companyId={companyId}
              />
            </>
          )}
        </div>
      )}

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successMessage.title}
        size="sm"
        footer={
          <Button variant="purple" onClick={() => setShowSuccessModal(false)}>
            Got it!
          </Button>
        }
      >
        <div className={styles.successModalContent}>
          {successMessage.details.split('\n').map((line, idx) => (
            <p key={idx} className={styles.successModalLine}>
              {line}
            </p>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// Product Impact Content Component
interface ProductImpactContentProps {
  owners: Owner[];
  products: CPGFinishedProduct[];
  scenario: 'breakeven' | 'good' | 'better' | 'best';
  testUnits: Record<string, string>;
  setTestUnits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  calculateBreakEven: (expenses: Expense[]) => { monthly: number; yearly: number };
  calculateScenario: (owner: Owner, scenario: 'good' | 'better' | 'best') => number;
  companyId: string;
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
}: ProductImpactContentProps) {
  const [productData, setProductData] = useState<Record<string, { price: number; cpu: number; laborCostPerUnit: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProductData();
  }, [products, companyId]);

  const loadProductData = async () => {
    try {
      setLoading(true);
      const data: Record<string, { price: number; cpu: number; laborCostPerUnit: number }> = {};
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
        // Get product CPU (raw materials only)
        const cpuResult = await cpuCalculatorService.calculateFinishedProductCPU(
          product.id,
          companyId,
          null
        );
        // Use materialCPU for raw COGS (excludes labor)
        const cpu = cpuResult?.materialCPU ? parseFloat(cpuResult.materialCPU) : 0;
        const price = parseFloat(product.msrp || '0');

        // Calculate labor cost excluding owner's pay
        let laborCostPerUnit = 0;

        // Get labor assignments for this product
        const assignments = await db.cpgProductLabors
          .where('finished_product_id')
          .equals(product.id)
          .and((a) => a.deleted_at === null)
          .toArray();

        for (const assignment of assignments) {
          // Skip if this assignment is for an owner's pay role
          if (ownerPayRoleIds.has(assignment.labor_role_id)) {
            continue;
          }

          // Get the labor role
          const role = allRoles.find((r) => r.id === assignment.labor_role_id);
          if (!role) continue;

          // Calculate labor cost for this assignment
          const hoursPerUnit = parseFloat(assignment.hours_per_unit || '0');
          const hourlyRate = parseFloat(role.hourly_rate || role.calculated_hourly_rate || '0');
          laborCostPerUnit += hoursPerUnit * hourlyRate;
        }

        data[product.id] = { price, cpu, laborCostPerUnit };
      }

      setProductData(data);
    } catch (err) {
      console.error('Error loading product data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Format number with commas
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Calculate total owner's pay needed for selected scenario
  const getTotalOwnerPay = () => {
    return owners.reduce((sum, owner) => {
      if (scenario === 'breakeven') {
        return sum + calculateBreakEven(owner.expenses).monthly;
      }
      return sum + calculateScenario(owner, scenario as 'good' | 'better' | 'best');
    }, 0);
  };

  // Calculate test results with detailed breakdown
  const calculateTestResults = () => {
    const totalOwnerPay = getTotalOwnerPay();
    let grossRevenue = 0;
    let rawCOGS = 0;
    let laborCost = 0;

    products.forEach((product) => {
      const units = parseFloat(testUnits[product.id] || '0');
      const data = productData[product.id];

      if (data) {
        grossRevenue += units * data.price;
        rawCOGS += units * data.cpu;
        laborCost += units * data.laborCostPerUnit;
      }
    });

    // Calculate bottom line
    const netBeforeOwnerPay = grossRevenue - rawCOGS - laborCost;
    const finalGap = netBeforeOwnerPay - totalOwnerPay;

    return {
      grossRevenue,
      rawCOGS,
      laborCost,
      totalOwnerPay,
      netBeforeOwnerPay,
      finalGap,
      isCovered: finalGap >= 0,
    };
  };

  if (loading) {
    return <div className={styles.impactLoading}>Calculating product margins...</div>;
  }

  const testResults = calculateTestResults();
  const totalOwnerPay = getTotalOwnerPay();

  return (
    <div className={styles.productImpactContainer}>
      {/* Let's Play! */}
      <div className={styles.playSide}>
        <h3>Let's Play!</h3>
        <p className={styles.playDescription}>
          Enter your projected sales to see the full breakdown: revenue, costs, and whether you'll cover owner's pay.
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
            <span className={styles.resultLabel}>Revenue (Units × MSRP):</span>
            <span className={styles.resultValue}>${formatCurrency(testResults.grossRevenue)}</span>
          </div>
          <div className={styles.resultRow}>
            <span className={styles.resultLabel}>Raw COGS (Units × CPU):</span>
            <span className={`${styles.resultValue} ${styles.resultNegative}`}>
              -${formatCurrency(testResults.rawCOGS)}
            </span>
          </div>
          <div className={styles.resultRow}>
            <span className={styles.resultLabel}>Labor Cost:</span>
            <span className={`${styles.resultValue} ${testResults.laborCost > 0 ? styles.resultNegative : ''}`}>
              {testResults.laborCost > 0 ? '-' : ''}${formatCurrency(testResults.laborCost)}
            </span>
          </div>
          <div className={styles.resultRow}>
            <span className={styles.resultLabel}>Owner's Pay Needed:</span>
            <span className={`${styles.resultValue} ${styles.resultNegative}`}>
              -${formatCurrency(totalOwnerPay)}
            </span>
          </div>
          <div className={`${styles.resultRow} ${styles.resultFinal}`}>
            <span className={styles.resultLabel}>
              {testResults.isCovered ? 'Growth Cushion:' : 'Amount to Bridge:'}
            </span>
            <span
              className={`${styles.resultValue} ${
                testResults.isCovered ? styles.resultPositive : styles.resultNegative
              }`}
            >
              {testResults.isCovered ? '+' : ''}${formatCurrency(Math.abs(testResults.finalGap))}
            </span>
          </div>
          <div className={styles.resultNote}>
            This calculation only includes the expenses listed above - it's a baseline guide, not your full picture.
          </div>
        </div>
      </div>
    </div>
  );
}
