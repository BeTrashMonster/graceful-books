/**
 * Scenario Calculator Service
 *
 * Core calculation engine for J3: Building the Dream Scenarios
 *
 * Features:
 * - Pull baseline snapshot from live books (P&L, Balance Sheet, Cash)
 * - Apply template-based adjustments with accounting-aware downstream impacts
 * - Parse and evaluate formulas in freeform adjustments
 * - Calculate projected financial statements
 * - Maintain accounting equation balance
 *
 * Dependencies: F4 (Reports), H1 (Multi-User)
 */

import Decimal from 'decimal.js';
import { generateProfitLossReport } from '../reports/profitLoss';
import { generateBalanceSheetReport } from '../reports/balanceSheet';
import { queryAccounts } from '../../store/accounts';
import { queryTransactions } from '../../store/transactions';
import type {
  ScenarioBaseline,
  ScenarioAdjustment,
  ScenarioProjection,
  TemplateCalculationResult,
  ScenarioTemplateKey,
  FormulaParseResult,
} from '../../types/scenarios.types';
import type { Account, JournalEntry } from '../../types/database.types';
import type { DateRange } from '../../types/reports.types';

// Configure Decimal.js for currency precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Pull baseline snapshot from current books
 *
 * Captures:
 * - P&L (current year-to-date)
 * - Balance Sheet (as of today)
 * - Cash position
 * - Payroll data
 * - Invoicing/AR data
 * - Products/services data
 * - Vendors/AP data
 *
 * @param companyId - Company ID
 * @param asOfDate - Date to snapshot (default: today)
 * @returns Baseline snapshot
 */
export async function pullBaselineSnapshot(
  companyId: string,
  asOfDate: number = Date.now()
): Promise<Omit<ScenarioBaseline, 'id' | 'scenario_id'>> {
  const accountsResult = await queryAccounts({ company_id: companyId, deleted_at: null });
  if (!accountsResult.success) throw new Error('Failed to fetch accounts');
  const accounts = accountsResult.data;

  const transactionsResult = await queryTransactions({ company_id: companyId, deleted_at: null });
  if (!transactionsResult.success) throw new Error('Failed to fetch transactions');
  // TODO: Use transactions data for detailed scenario calculations

  // Calculate year-to-date date range
  const year = new Date(asOfDate).getFullYear();
  const ytdRange: DateRange = {
    startDate: new Date(year, 0, 1).getTime(),
    endDate: asOfDate,
  };

  // Generate financial statements
  const profitLoss = await generateProfitLossReport(companyId, ytdRange, {
    method: 'accrual', // Default to accrual for scenarios
    comparison: false,
  });

  const balanceSheet = await generateBalanceSheetReport(companyId, asOfDate, {
    comparison: false,
  });

  // Calculate cash balance (sum of all Cash & Bank accounts)
  const cashAccounts = accounts.filter(
    (acc) => acc.type === 'bank' || acc.account_name.toLowerCase().includes('cash')
  );
  const cashBalance = cashAccounts.reduce((sum, acc) => {
    return sum.plus(new Decimal(acc.balance || 0));
  }, new Decimal(0));

  // Extract payroll data (simplified for MVP)
  const payrollExpenseAccounts = accounts.filter(
    (acc) => acc.type === 'expense' &&
    (acc.account_name.toLowerCase().includes('salary') ||
     acc.account_name.toLowerCase().includes('wages') ||
     acc.account_name.toLowerCase().includes('payroll'))
  );

  const totalMonthlyPayroll = payrollExpenseAccounts.reduce((sum, acc) => {
    return sum.plus(new Decimal(acc.balance || 0).dividedBy(12)); // Annualized to monthly
  }, new Decimal(0));

  // Extract payroll tax data
  const payrollTaxAccounts = accounts.filter(
    (acc) => acc.type === 'expense' &&
    (acc.account_name.toLowerCase().includes('payroll tax') ||
     acc.account_name.toLowerCase().includes('fica') ||
     acc.account_name.toLowerCase().includes('unemployment'))
  );

  const totalMonthlyEmployerTaxes = payrollTaxAccounts.reduce((sum, acc) => {
    return sum.plus(new Decimal(acc.balance || 0).dividedBy(12));
  }, new Decimal(0));

  // Extract invoicing data (simplified - would integrate with invoices table in production)
  const arAccount = accounts.find(
    (acc) => acc.type === 'accounts-receivable' || acc.account_code === '1200'
  );
  const arBalance = arAccount ? new Decimal(arAccount.balance || 0) : new Decimal(0);

  // Extract revenue data
  const revenueAccounts = accounts.filter(
    (acc) => acc.type === 'income' || acc.type === 'other-income'
  );
  const totalRevenue = revenueAccounts.reduce((sum, acc) => {
    return sum.plus(new Decimal(acc.balance || 0));
  }, new Decimal(0));

  // Extract vendor data
  const expenseAccounts = accounts.filter(
    (acc) => acc.type === 'expense' || acc.type === 'cost-of-goods-sold' || acc.type === 'other-expense'
  );
  const totalExpenses = expenseAccounts.reduce((sum, acc) => {
    return sum.plus(new Decimal(acc.balance || 0));
  }, new Decimal(0));

  const baseline: Omit<ScenarioBaseline, 'id' | 'scenario_id'> = {
    snapshot_date: asOfDate,
    profit_loss: profitLoss,
    balance_sheet: balanceSheet,
    cash_balance: cashBalance.toNumber(),

    payroll_data: {
      employees: [], // Would pull from payroll integration in production
      total_monthly_payroll: totalMonthlyPayroll.toNumber(),
      total_monthly_employer_taxes: totalMonthlyEmployerTaxes.toNumber(),
    },

    invoicing_data: {
      monthly_recurring_revenue: totalRevenue.dividedBy(12).toNumber(),
      average_invoice_amount: 0, // Would calculate from invoices table
      accounts_receivable_aging: {
        current: arBalance.times(0.7).toNumber(), // Placeholder distribution
        days_30: arBalance.times(0.2).toNumber(),
        days_60: arBalance.times(0.08).toNumber(),
        days_90_plus: arBalance.times(0.02).toNumber(),
      },
    },

    products_services_data: {
      top_products: [], // Would pull from products table
    },

    vendors_data: {
      monthly_recurring_expenses: totalExpenses.dividedBy(12).toNumber(),
      top_vendors: [], // Would pull from vendors/contacts table
    },

    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
  };

  return baseline;
}

/**
 * Calculate template-based adjustment
 *
 * Each template has its own calculation logic that understands
 * double-entry accounting and downstream impacts.
 *
 * @param templateKey - Template to use
 * @param params - Template parameters
 * @param baseline - Current baseline
 * @returns Calculation result with adjustments and impact
 */
export function calculateTemplateAdjustment(
  templateKey: ScenarioTemplateKey,
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  switch (templateKey) {
    case 'reclassify-employee-to-owner':
      return calculateReclassifyEmployeeToOwner(params, baseline);

    case 'add-new-employee':
      return calculateAddNewEmployee(params, baseline);

    case 'remove-employee':
      return calculateRemoveEmployee(params, baseline);

    case 'change-compensation':
      return calculateChangeCompensation(params, baseline);

    case 'add-recurring-expense':
      return calculateAddRecurringExpense(params, baseline);

    case 'remove-recurring-expense':
      return calculateRemoveRecurringExpense(params, baseline);

    case 'change-pricing':
      return calculateChangePricing(params, baseline);

    case 'take-on-debt':
      return calculateTakeOnDebt(params, baseline);

    case 'pay-off-debt':
      return calculatePayOffDebt(params, baseline);

    case 'major-equipment-purchase':
      return calculateEquipmentPurchase(params, baseline);

    case 'lease-vs-buy':
      return calculateLeaseVsBuy(params, baseline);

    case 'add-revenue-stream':
      return calculateAddRevenueStream(params, baseline);

    default:
      throw new Error(`Unknown template key: ${templateKey}`);
  }
}

/**
 * Template: Reclassify Employee to Owner
 *
 * Accounting-aware impacts:
 * - Remove salary from Expenses
 * - Remove employer payroll tax obligations
 * - Add owner distribution line in Equity
 * - Recalculate profit impact
 * - Show estimated tax liability change
 * - Adjust cash flow timing
 */
function calculateReclassifyEmployeeToOwner(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const annualSalary = Number(params.annual_salary || 0);
  const employerTaxRate = 0.0765; // FICA rate (7.65%)
  const benefitsCost = Number(params.benefits_cost || 0);

  const annualEmployerTaxes = annualSalary * employerTaxRate;
  const totalAnnualSavings = annualSalary + annualEmployerTaxes + benefitsCost;

  const adjustments = [
    {
      account_id: 'salary-expense', // Would map to actual account
      account_name: 'Salaries & Wages',
      adjustment_amount: -annualSalary,
      description: `Remove ${params.employee_name}'s salary`,
    },
    {
      account_id: 'payroll-tax-expense',
      account_name: 'Payroll Taxes',
      adjustment_amount: -annualEmployerTaxes,
      description: `Remove employer payroll taxes for ${params.employee_name}`,
    },
    {
      account_id: 'benefits-expense',
      account_name: 'Employee Benefits',
      adjustment_amount: -benefitsCost,
      description: `Remove benefits cost for ${params.employee_name}`,
    },
    {
      account_id: 'owner-distributions',
      account_name: 'Owner Distributions',
      adjustment_amount: annualSalary, // Owner takes equivalent as distribution
      description: `Owner distribution (former salary)`,
    },
  ];

  // Net profit increases because distributions aren't an expense
  const profitIncrease = annualSalary + annualEmployerTaxes + benefitsCost;

  // But owner's tax liability may increase (pass-through entity)
  const estimatedOwnerTaxRate = 0.35; // Placeholder
  const taxLiabilityIncrease = profitIncrease * estimatedOwnerTaxRate;

  // Cash flow timing changes (distributions can be deferred)
  const cashFlowChange = annualEmployerTaxes + benefitsCost; // Actual savings

  return {
    adjustments,
    impact: {
      revenue_change: 0,
      expense_change: -(annualSalary + annualEmployerTaxes + benefitsCost),
      profit_change: profitIncrease,
      cash_flow_change: cashFlowChange,
      tax_liability_change: taxLiabilityIncrease,
    },
    explanation: `Reclassifying ${params.employee_name} from employee to owner reduces business expenses by $${totalAnnualSavings.toFixed(0)}/year (salary + taxes + benefits). However, as an owner, ${params.employee_name} will now pay estimated taxes of $${taxLiabilityIncrease.toFixed(0)}/year. Net cash flow improves by $${cashFlowChange.toFixed(0)}/year.`,
  };
}

/**
 * Template: Add New Employee
 */
function calculateAddNewEmployee(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const annualSalary = Number(params.annual_salary || 0);
  const employerTaxRate = 0.0765;
  const benefitsCost = Number(params.benefits_cost || 0);
  const revenueIncrease = Number(params.expected_revenue_increase || 0);

  const annualEmployerTaxes = annualSalary * employerTaxRate;
  const totalAnnualCost = annualSalary + annualEmployerTaxes + benefitsCost;

  const adjustments = [
    {
      account_id: 'salary-expense',
      account_name: 'Salaries & Wages',
      adjustment_amount: annualSalary,
      description: `Add ${params.employee_name} salary`,
    },
    {
      account_id: 'payroll-tax-expense',
      account_name: 'Payroll Taxes',
      adjustment_amount: annualEmployerTaxes,
      description: `Employer payroll taxes for ${params.employee_name}`,
    },
    {
      account_id: 'benefits-expense',
      account_name: 'Employee Benefits',
      adjustment_amount: benefitsCost,
      description: `Benefits for ${params.employee_name}`,
    },
  ];

  if (revenueIncrease > 0) {
    adjustments.push({
      account_id: 'revenue',
      account_name: 'Revenue',
      adjustment_amount: revenueIncrease,
      description: `Expected revenue increase from ${params.employee_name}`,
    });
  }

  const profitChange = revenueIncrease - totalAnnualCost;

  return {
    adjustments,
    impact: {
      revenue_change: revenueIncrease,
      expense_change: totalAnnualCost,
      profit_change: profitChange,
      cash_flow_change: profitChange,
      tax_liability_change: profitChange * 0.25, // Rough estimate
    },
    explanation: `Hiring ${params.employee_name} at $${annualSalary.toFixed(0)}/year will cost $${totalAnnualCost.toFixed(0)}/year including taxes and benefits. ${revenueIncrease > 0 ? `Expected revenue increase of $${revenueIncrease.toFixed(0)}/year results in net profit ${profitChange >= 0 ? 'increase' : 'decrease'} of $${Math.abs(profitChange).toFixed(0)}/year.` : `This represents a pure cost increase.`}`,
  };
}

/**
 * Template: Remove Employee
 */
function calculateRemoveEmployee(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const annualSalary = Number(params.annual_salary || 0);
  const employerTaxRate = 0.0765;
  const benefitsCost = Number(params.benefits_cost || 0);
  const revenueImpact = Number(params.expected_revenue_loss || 0);

  const annualEmployerTaxes = annualSalary * employerTaxRate;
  const totalAnnualSavings = annualSalary + annualEmployerTaxes + benefitsCost;

  const adjustments = [
    {
      account_id: 'salary-expense',
      account_name: 'Salaries & Wages',
      adjustment_amount: -annualSalary,
      description: `Remove ${params.employee_name} salary`,
    },
    {
      account_id: 'payroll-tax-expense',
      account_name: 'Payroll Taxes',
      adjustment_amount: -annualEmployerTaxes,
      description: `Remove employer payroll taxes`,
    },
    {
      account_id: 'benefits-expense',
      account_name: 'Employee Benefits',
      adjustment_amount: -benefitsCost,
      description: `Remove benefits cost`,
    },
  ];

  if (revenueImpact > 0) {
    adjustments.push({
      account_id: 'revenue',
      account_name: 'Revenue',
      adjustment_amount: -revenueImpact,
      description: `Expected revenue loss from removing ${params.employee_name}`,
    });
  }

  const profitChange = totalAnnualSavings - revenueImpact;

  return {
    adjustments,
    impact: {
      revenue_change: -revenueImpact,
      expense_change: -totalAnnualSavings,
      profit_change: profitChange,
      cash_flow_change: profitChange,
      tax_liability_change: profitChange * 0.25,
    },
    explanation: `Removing ${params.employee_name} saves $${totalAnnualSavings.toFixed(0)}/year in salary, taxes, and benefits. ${revenueImpact > 0 ? `However, expected revenue loss of $${revenueImpact.toFixed(0)}/year results in net profit ${profitChange >= 0 ? 'increase' : 'decrease'} of $${Math.abs(profitChange).toFixed(0)}/year.` : `This represents a pure cost savings.`}`,
  };
}

/**
 * Template: Change Compensation
 */
function calculateChangeCompensation(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const currentSalary = Number(params.current_salary || 0);
  const newSalary = Number(params.new_salary || 0);
  const salaryChange = newSalary - currentSalary;

  const employerTaxRate = 0.0765;
  const taxChange = salaryChange * employerTaxRate;

  const totalCostChange = salaryChange + taxChange;

  const adjustments = [
    {
      account_id: 'salary-expense',
      account_name: 'Salaries & Wages',
      adjustment_amount: salaryChange,
      description: `${params.employee_name} salary ${salaryChange >= 0 ? 'increase' : 'decrease'}`,
    },
    {
      account_id: 'payroll-tax-expense',
      account_name: 'Payroll Taxes',
      adjustment_amount: taxChange,
      description: `Employer tax ${salaryChange >= 0 ? 'increase' : 'savings'}`,
    },
  ];

  return {
    adjustments,
    impact: {
      revenue_change: 0,
      expense_change: totalCostChange,
      profit_change: -totalCostChange,
      cash_flow_change: -totalCostChange,
      tax_liability_change: -totalCostChange * 0.25,
    },
    explanation: `Changing ${params.employee_name}'s salary from $${currentSalary.toFixed(0)} to $${newSalary.toFixed(0)} ${salaryChange >= 0 ? 'increases' : 'decreases'} annual costs by $${Math.abs(totalCostChange).toFixed(0)} (including payroll taxes).`,
  };
}

/**
 * Template: Add Recurring Expense
 */
function calculateAddRecurringExpense(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const monthlyAmount = Number(params.monthly_amount || 0);
  const annualAmount = monthlyAmount * 12;

  const adjustments = [
    {
      account_id: params.expense_account_id as string || 'general-expense',
      account_name: params.expense_category as string || 'General Expenses',
      adjustment_amount: annualAmount,
      description: params.description as string || 'New recurring expense',
    },
  ];

  return {
    adjustments,
    impact: {
      revenue_change: 0,
      expense_change: annualAmount,
      profit_change: -annualAmount,
      cash_flow_change: -annualAmount,
      tax_liability_change: -annualAmount * 0.25, // Tax deduction
    },
    explanation: `Adding ${params.description} at $${monthlyAmount.toFixed(0)}/month ($${annualAmount.toFixed(0)}/year) reduces profit but provides a tax deduction of approximately $${(annualAmount * 0.25).toFixed(0)}/year.`,
  };
}

/**
 * Template: Remove Recurring Expense
 */
function calculateRemoveRecurringExpense(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const monthlyAmount = Number(params.monthly_amount || 0);
  const annualAmount = monthlyAmount * 12;
  const revenueImpact = Number(params.expected_revenue_loss || 0);

  const adjustments = [
    {
      account_id: params.expense_account_id as string || 'general-expense',
      account_name: params.expense_category as string || 'General Expenses',
      adjustment_amount: -annualAmount,
      description: `Remove ${params.description}`,
    },
  ];

  if (revenueImpact > 0) {
    adjustments.push({
      account_id: 'revenue',
      account_name: 'Revenue',
      adjustment_amount: -revenueImpact,
      description: `Revenue impact from removing ${params.description}`,
    });
  }

  const netProfit = annualAmount - revenueImpact;

  return {
    adjustments,
    impact: {
      revenue_change: -revenueImpact,
      expense_change: -annualAmount,
      profit_change: netProfit,
      cash_flow_change: netProfit,
      tax_liability_change: netProfit * 0.25,
    },
    explanation: `Eliminating ${params.description} saves $${annualAmount.toFixed(0)}/year. ${revenueImpact > 0 ? `However, this may reduce revenue by $${revenueImpact.toFixed(0)}/year, resulting in net profit ${netProfit >= 0 ? 'increase' : 'decrease'} of $${Math.abs(netProfit).toFixed(0)}/year.` : ''}`,
  };
}

/**
 * Template: Change Pricing
 */
function calculateChangePricing(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const currentRevenue = baseline.profit_loss.sections.find((s: any) => s.type === 'income')?.total || 0;
  const priceChangePercentage = Number(params.price_change_percentage || 0);
  const customerRetentionRate = Number(params.customer_retention_rate || 100) / 100;

  const grossRevenueChange = currentRevenue * (priceChangePercentage / 100);
  const netRevenueChange = grossRevenueChange * customerRetentionRate;

  const adjustments = [
    {
      account_id: 'revenue',
      account_name: 'Revenue',
      adjustment_amount: netRevenueChange,
      description: `${priceChangePercentage >= 0 ? 'Price increase' : 'Price decrease'} of ${Math.abs(priceChangePercentage)}%`,
    },
  ];

  return {
    adjustments,
    impact: {
      revenue_change: netRevenueChange,
      expense_change: 0,
      profit_change: netRevenueChange,
      cash_flow_change: netRevenueChange,
      tax_liability_change: netRevenueChange * 0.25,
    },
    explanation: `A ${Math.abs(priceChangePercentage)}% price ${priceChangePercentage >= 0 ? 'increase' : 'decrease'} with ${(customerRetentionRate * 100).toFixed(0)}% customer retention results in ${netRevenueChange >= 0 ? 'additional' : 'reduced'} revenue of $${Math.abs(netRevenueChange).toFixed(0)}/year.`,
  };
}

/**
 * Template: Take On Debt/Loan
 */
function calculateTakeOnDebt(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const loanAmount = Number(params.loan_amount || 0);
  const interestRate = Number(params.interest_rate || 0) / 100;
  const termMonths = Number(params.term_months || 60);

  // Calculate monthly payment (amortization formula)
  const monthlyRate = interestRate / 12;
  const monthlyPayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
                         (Math.pow(1 + monthlyRate, termMonths) - 1);
  const annualPayment = monthlyPayment * 12;
  const annualInterest = loanAmount * interestRate; // First year approximation

  const adjustments = [
    {
      account_id: 'cash',
      account_name: 'Cash',
      adjustment_amount: loanAmount,
      description: `Loan proceeds`,
    },
    {
      account_id: 'loan-payable',
      account_name: 'Notes Payable',
      adjustment_amount: loanAmount,
      description: `${termMonths}-month loan at ${(interestRate * 100).toFixed(2)}%`,
    },
    {
      account_id: 'interest-expense',
      account_name: 'Interest Expense',
      adjustment_amount: annualInterest,
      description: `Annual interest expense (first year)`,
    },
  ];

  return {
    adjustments,
    impact: {
      revenue_change: 0,
      expense_change: annualInterest,
      profit_change: -annualInterest,
      cash_flow_change: loanAmount - annualPayment, // Net cash after payments
      tax_liability_change: -annualInterest * 0.25, // Interest is tax deductible
    },
    explanation: `Taking on a $${loanAmount.toFixed(0)} loan at ${(interestRate * 100).toFixed(2)}% for ${termMonths} months adds $${loanAmount.toFixed(0)} to cash immediately, but costs approximately $${monthlyPayment.toFixed(0)}/month ($${annualPayment.toFixed(0)}/year). First-year interest expense of $${annualInterest.toFixed(0)} provides a tax deduction.`,
  };
}

/**
 * Template: Pay Off Debt
 */
function calculatePayOffDebt(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const debtAmount = Number(params.debt_amount || 0);
  const currentInterestRate = Number(params.current_interest_rate || 0) / 100;
  const annualInterestSavings = debtAmount * currentInterestRate;

  const adjustments = [
    {
      account_id: 'cash',
      account_name: 'Cash',
      adjustment_amount: -debtAmount,
      description: `Pay off debt`,
    },
    {
      account_id: 'loan-payable',
      account_name: 'Notes Payable',
      adjustment_amount: -debtAmount,
      description: `Debt payoff`,
    },
    {
      account_id: 'interest-expense',
      account_name: 'Interest Expense',
      adjustment_amount: -annualInterestSavings,
      description: `Eliminate interest expense`,
    },
  ];

  return {
    adjustments,
    impact: {
      revenue_change: 0,
      expense_change: -annualInterestSavings,
      profit_change: annualInterestSavings,
      cash_flow_change: -debtAmount + annualInterestSavings,
      tax_liability_change: annualInterestSavings * 0.25, // Lost tax deduction
    },
    explanation: `Paying off $${debtAmount.toFixed(0)} in debt eliminates $${annualInterestSavings.toFixed(0)}/year in interest expense, improving profit. However, you lose the tax deduction on that interest.`,
  };
}

/**
 * Template: Major Equipment Purchase
 */
function calculateEquipmentPurchase(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const purchasePrice = Number(params.purchase_price || 0);
  const usefulLifeYears = Number(params.useful_life_years || 5);
  const annualDepreciation = purchasePrice / usefulLifeYears;
  const expectedRevenueIncrease = Number(params.expected_revenue_increase || 0);

  const adjustments = [
    {
      account_id: 'equipment',
      account_name: 'Equipment',
      adjustment_amount: purchasePrice,
      description: `Purchase ${params.equipment_name}`,
    },
    {
      account_id: 'cash',
      account_name: 'Cash',
      adjustment_amount: -purchasePrice,
      description: `Equipment purchase`,
    },
    {
      account_id: 'depreciation-expense',
      account_name: 'Depreciation Expense',
      adjustment_amount: annualDepreciation,
      description: `Annual depreciation (${usefulLifeYears}-year life)`,
    },
  ];

  if (expectedRevenueIncrease > 0) {
    adjustments.push({
      account_id: 'revenue',
      account_name: 'Revenue',
      adjustment_amount: expectedRevenueIncrease,
      description: `Expected revenue increase from ${params.equipment_name}`,
    });
  }

  const profitChange = expectedRevenueIncrease - annualDepreciation;

  return {
    adjustments,
    impact: {
      revenue_change: expectedRevenueIncrease,
      expense_change: annualDepreciation,
      profit_change: profitChange,
      cash_flow_change: -purchasePrice, // One-time cash outflow
      tax_liability_change: profitChange * 0.25,
    },
    explanation: `Purchasing ${params.equipment_name} for $${purchasePrice.toFixed(0)} uses cash immediately but provides $${annualDepreciation.toFixed(0)}/year in depreciation expense (tax deduction). ${expectedRevenueIncrease > 0 ? `Expected revenue increase of $${expectedRevenueIncrease.toFixed(0)}/year results in net profit ${profitChange >= 0 ? 'increase' : 'decrease'} of $${Math.abs(profitChange).toFixed(0)}/year.` : ''}`,
  };
}

/**
 * Template: Lease vs Buy Analysis
 */
function calculateLeaseVsBuy(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const monthlyLeasePayment = Number(params.monthly_lease_payment || 0);
  const annualLeasePayment = monthlyLeasePayment * 12;
  const purchasePrice = Number(params.purchase_price || 0);
  const usefulLifeYears = Number(params.useful_life_years || 5);
  const annualDepreciation = purchasePrice / usefulLifeYears;

  // Leasing impact
  const leaseImpact = {
    expense_change: annualLeasePayment,
    cash_flow_change: -annualLeasePayment,
    tax_deduction: annualLeasePayment * 0.25,
  };

  // Buying impact
  const buyImpact = {
    expense_change: annualDepreciation,
    cash_flow_change: -purchasePrice, // Year 1 only
    tax_deduction: annualDepreciation * 0.25,
  };

  const adjustments = [
    {
      account_id: 'lease-expense',
      account_name: 'Lease Expense (Option 1)',
      adjustment_amount: annualLeasePayment,
      description: `Annual lease payment`,
    },
    {
      account_id: 'equipment',
      account_name: 'Equipment (Option 2)',
      adjustment_amount: purchasePrice,
      description: `Purchase equipment`,
    },
    {
      account_id: 'depreciation-expense',
      account_name: 'Depreciation Expense (Option 2)',
      adjustment_amount: annualDepreciation,
      description: `Annual depreciation if purchased`,
    },
  ];

  return {
    adjustments,
    impact: {
      revenue_change: 0,
      expense_change: annualLeasePayment, // Using lease as default
      profit_change: -annualLeasePayment,
      cash_flow_change: -annualLeasePayment,
      tax_liability_change: -leaseImpact.tax_deduction,
    },
    explanation: `Leasing costs $${annualLeasePayment.toFixed(0)}/year with $${leaseImpact.tax_deduction.toFixed(0)}/year tax deduction. Buying costs $${purchasePrice.toFixed(0)} upfront, $${annualDepreciation.toFixed(0)}/year depreciation, $${buyImpact.tax_deduction.toFixed(0)}/year tax deduction. Over ${usefulLifeYears} years, buying saves approximately $${((annualLeasePayment * usefulLifeYears) - purchasePrice).toFixed(0)} but requires upfront cash.`,
  };
}

/**
 * Template: Add New Revenue Stream
 */
function calculateAddRevenueStream(
  params: Record<string, unknown>,
  _baseline: ScenarioBaseline
): TemplateCalculationResult {
  const monthlyRevenue = Number(params.monthly_revenue || 0);
  const annualRevenue = monthlyRevenue * 12;
  const directCosts = Number(params.direct_costs_percentage || 30) / 100 * annualRevenue;
  const marketingCosts = Number(params.marketing_costs || 0);
  const setupCosts = Number(params.setup_costs || 0);

  const netProfit = annualRevenue - directCosts - marketingCosts;

  const adjustments = [
    {
      account_id: 'revenue',
      account_name: 'Revenue',
      adjustment_amount: annualRevenue,
      description: `${params.revenue_stream_name} revenue`,
    },
    {
      account_id: 'cost-of-goods-sold',
      account_name: 'Cost of Goods Sold',
      adjustment_amount: directCosts,
      description: `Direct costs for ${params.revenue_stream_name}`,
    },
    {
      account_id: 'marketing-expense',
      account_name: 'Marketing',
      adjustment_amount: marketingCosts,
      description: `Marketing for ${params.revenue_stream_name}`,
    },
  ];

  if (setupCosts > 0) {
    adjustments.push({
      account_id: 'cash',
      account_name: 'Cash',
      adjustment_amount: -setupCosts,
      description: `One-time setup costs for ${params.revenue_stream_name}`,
    });
  }

  return {
    adjustments,
    impact: {
      revenue_change: annualRevenue,
      expense_change: directCosts + marketingCosts,
      profit_change: netProfit,
      cash_flow_change: netProfit - setupCosts,
      tax_liability_change: netProfit * 0.25,
    },
    explanation: `Adding ${params.revenue_stream_name} generates $${annualRevenue.toFixed(0)}/year in revenue with $${(directCosts + marketingCosts).toFixed(0)}/year in costs (COGS + marketing). Net profit impact is $${netProfit.toFixed(0)}/year. ${setupCosts > 0 ? `One-time setup costs of $${setupCosts.toFixed(0)} reduce first-year cash flow.` : ''}`,
  };
}

/**
 * Calculate projected financial statements after applying adjustments
 *
 * @param baseline - Current baseline
 * @param adjustments - Array of adjustments to apply
 * @returns Projected financial results
 */
export function calculateProjection(
  baseline: ScenarioBaseline,
  adjustments: ScenarioAdjustment[]
): ScenarioProjection {
  // Start with baseline values
  const baselineRevenue = baseline.profit_loss.sections!.find(s => s.type === 'income')?.total || 0;
  const baselineExpenses =
    (baseline.profit_loss.sections!.find(s => s.type === 'expense')?.total || 0) +
    (baseline.profit_loss.sections!.find(s => s.type === 'cost-of-goods-sold')?.total || 0);
  const baselineProfit = baselineRevenue - baselineExpenses;
  const baselineCash = baseline.cash_balance;

  // Aggregate adjustments
  let totalRevenueChange = new Decimal(0);
  let totalExpenseChange = new Decimal(0);
  let totalOneTimeCosts = new Decimal(0);

  for (const adjustment of adjustments) {
    if (adjustment.impact_summary) {
      totalRevenueChange = totalRevenueChange.plus(adjustment.impact_summary.revenue_change);
      totalExpenseChange = totalExpenseChange.plus(adjustment.impact_summary.expense_change);

      // One-time costs are typically cash impacts without ongoing expenses
      // (e.g., equipment purchase, setup fees)
      // This is a simplification - would need more sophisticated logic in production
    }
  }

  const projectedRevenue = new Decimal(baselineRevenue).plus(totalRevenueChange);
  const projectedExpenses = new Decimal(baselineExpenses).plus(totalExpenseChange);
  const projectedProfit = projectedRevenue.minus(projectedExpenses);
  const projectedCash = new Decimal(baselineCash); // Cash changes handled separately

  // Calculate metrics
  const baselineProfitMargin = baselineRevenue > 0 ? (baselineProfit / baselineRevenue) * 100 : 0;
  const projectedProfitMargin = projectedRevenue.toNumber() > 0
    ? (projectedProfit.toNumber() / projectedRevenue.toNumber()) * 100
    : 0;

  const revenueGrowth = baselineRevenue > 0
    ? (totalRevenueChange.toNumber() / baselineRevenue) * 100
    : 0;

  const expenseRatio = projectedRevenue.toNumber() > 0
    ? (projectedExpenses.toNumber() / projectedRevenue.toNumber()) * 100
    : 0;

  // Calculate runway (simplified)
  const monthlyBurnBaseline = (baselineExpenses - baselineRevenue) / 12;
  const runwayMonthsBaseline = monthlyBurnBaseline > 0
    ? Math.max(0, baselineCash / monthlyBurnBaseline)
    : null;

  const monthlyBurnProjected = (projectedExpenses.toNumber() - projectedRevenue.toNumber()) / 12;
  const runwayMonthsProjected = monthlyBurnProjected > 0
    ? Math.max(0, projectedCash.toNumber() / monthlyBurnProjected)
    : null;

  return {
    baseline: {
      revenue: baselineRevenue,
      expenses: baselineExpenses,
      profit: baselineProfit,
      cash_balance: baselineCash,
      tax_liability_estimate: baselineProfit * 0.25, // Simplified
    },
    adjustments: {
      revenue_change: totalRevenueChange.toNumber(),
      expense_change: totalExpenseChange.toNumber(),
      one_time_costs: totalOneTimeCosts.toNumber(),
    },
    projected: {
      revenue: projectedRevenue.toNumber(),
      expenses: projectedExpenses.toNumber(),
      profit: projectedProfit.toNumber(),
      cash_balance: projectedCash.toNumber(),
      tax_liability_estimate: projectedProfit.toNumber() * 0.25,
    },
    delta: {
      revenue: totalRevenueChange.toNumber(),
      expenses: totalExpenseChange.toNumber(),
      profit: projectedProfit.toNumber() - baselineProfit,
      cash_balance: 0, // Simplified
      tax_liability: (projectedProfit.toNumber() - baselineProfit) * 0.25,
    },
    metrics: {
      profit_margin_baseline: baselineProfitMargin,
      profit_margin_projected: projectedProfitMargin,
      revenue_growth: revenueGrowth,
      expense_ratio: expenseRatio,
      runway_months_baseline: runwayMonthsBaseline,
      runway_months_projected: runwayMonthsProjected,
    },
    line_items: [], // Would populate with detailed account-level breakdown
  };
}

/**
 * Parse and evaluate formula in freeform adjustment
 *
 * Supports simple arithmetic and account references
 * Example: "=Account[1000] * 1.1" (increase account 1000 by 10%)
 *
 * @param formula - Formula string
 * @param baseline - Current baseline for account lookups
 * @returns Parse result with calculated value
 */
export function parseFormula(
  formula: string,
  _baseline: ScenarioBaseline
): FormulaParseResult {
  // This is a simplified formula parser
  // Production version would use a proper expression parser like math.js

  if (!formula.startsWith('=')) {
    return {
      is_valid: false,
      error_message: 'Formula must start with =',
      references: [],
    };
  }

  try {
    // Simple regex to extract account references: Account[1000]
    const accountRefRegex = /Account\[(\d+)\]/g;
    const references: FormulaParseResult['references'] = [];

    let processedFormula = formula.substring(1); // Remove leading =
    let match;

    while ((match = accountRefRegex.exec(formula)) !== null) {
      const accountCode = match[1];
      // Would look up actual account value from baseline
      const accountValue = 0; // Placeholder

      references.push({
        type: 'account',
        id: accountCode,
        name: `Account ${accountCode}`,
      });

      processedFormula = processedFormula.replace(match[0], accountValue.toString());
    }

    // Evaluate the formula (DANGEROUS in production - use safe eval library)
    // This is for demonstration only
    // const calculated_value = eval(processedFormula);
    const calculated_value = 0; // Placeholder

    return {
      is_valid: true,
      references,
      calculated_value,
    };
  } catch (error) {
    return {
      is_valid: false,
      error_message: error instanceof Error ? error.message : 'Invalid formula',
      references: [],
    };
  }
}
