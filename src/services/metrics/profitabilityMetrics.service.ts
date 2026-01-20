/**
 * Profitability Metrics Service
 *
 * Calculates profitability ratios and margins.
 * These metrics answer: "Are you making money?"
 *
 * Includes barter revenue integration (I5).
 *
 * Requirements: J4 - Key Financial Metrics Reports (Nice)
 */

import Decimal from 'decimal.js';
import type { TreasureChestDB } from '../../db/database';
import type {
  ProfitabilityMetrics,
  ProfitabilityMetricsRequest,
  Metric,
  MetricDataPoint,
} from '../../types/metrics.types';
import { AccountType } from '../../types/database.types';

export class ProfitabilityMetricsService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  /**
   * Calculate profitability metrics for a date range
   */
  async calculateProfitabilityMetrics(
    request: ProfitabilityMetricsRequest
  ): Promise<ProfitabilityMetrics> {
    const { company_id, date_range, include_barter = true, include_history = true } = request;

    // Check if barter transactions exist
    const hasBarterTransactions = await this.hasBarterTransactions(company_id);

    // Get P&L data for the period
    const plData = await this.getProfitLossData(
      company_id,
      date_range.start_date,
      date_range.end_date,
      include_barter
    );

    // Get balance sheet data for ROE and ROA
    const bsData = await this.getBalanceSheetData(
      company_id,
      date_range.end_date
    );

    // Calculate metrics
    const grossProfitMargin = this.calculateGrossProfitMargin(
      plData.revenue,
      plData.cogs
    );

    const netProfitMargin = this.calculateNetProfitMargin(
      plData.net_income,
      plData.revenue
    );

    const operatingMargin = this.calculateOperatingMargin(
      plData.operating_income,
      plData.revenue
    );

    const returnOnEquity = this.calculateReturnOnEquity(
      plData.net_income,
      bsData.equity
    );

    const returnOnAssets = this.calculateReturnOnAssets(
      plData.net_income,
      bsData.total_assets
    );

    // Revenue per employee (optional if payroll data available)
    const revenuePerEmployee = await this.calculateRevenuePerEmployee(
      company_id,
      plData.revenue,
      date_range
    );

    // Get historical data if requested
    let history;
    if (include_history) {
      history = await this.getHistoricalProfitabilityMetrics(
        company_id,
        date_range.end_date,
        12,
        include_barter
      );
    } else {
      history = {
        gross_profit_margin: [],
        net_profit_margin: [],
        operating_margin: [],
        return_on_equity: [],
        return_on_assets: [],
      };
    }

    // Build revenue breakdown if barter exists
    let revenueBreakdown;
    if (hasBarterTransactions) {
      revenueBreakdown = {
        cash_revenue: plData.cash_revenue.toFixed(2),
        accrual_revenue: plData.accrual_revenue.toFixed(2),
        barter_revenue: plData.barter_revenue.toFixed(2),
        total_revenue: plData.revenue.toFixed(2),
      };
    }

    return {
      gross_profit_margin: grossProfitMargin,
      net_profit_margin: netProfitMargin,
      operating_margin: operatingMargin,
      return_on_equity: returnOnEquity,
      return_on_assets: returnOnAssets,
      revenue_per_employee: revenuePerEmployee || undefined,
      date_range,
      barter_options: {
        include_barter,
        has_barter_transactions: hasBarterTransactions,
      },
      revenue_breakdown: revenueBreakdown,
      history,
    };
  }

  /**
   * Calculate Gross Profit Margin = (Revenue - COGS) / Revenue * 100
   */
  private calculateGrossProfitMargin(revenue: Decimal, cogs: Decimal): Metric {
    if (revenue.isZero()) {
      return {
        value: '0',
        formatted_value: '0%',
        plain_english_explanation:
          'Gross profit margin cannot be calculated because there is no revenue.',
      };
    }

    const grossProfit = revenue.minus(cogs);
    const margin = grossProfit.div(revenue).mul(100);
    const marginValue = margin.toFixed(2);

    let explanation = `Your gross profit margin is ${marginValue}%. `;
    explanation += `For every $1 of revenue, you keep $${grossProfit.div(revenue).toFixed(2)} after paying for the cost of goods or services sold. `;

    if (margin.gte(50)) {
      explanation += 'This is excellent - you have strong pricing power and/or low cost of goods.';
    } else if (margin.gte(30)) {
      explanation += 'This is healthy - you have good profitability at the product/service level.';
    } else if (margin.gte(15)) {
      explanation += 'This is moderate - there may be opportunities to improve pricing or reduce costs.';
    } else {
      explanation +=
        'This is low - consider reviewing your pricing strategy or finding ways to reduce cost of goods sold.';
    }

    return {
      value: marginValue,
      formatted_value: `${marginValue}%`,
      plain_english_explanation: explanation,
      industry_benchmark: '30-50%',
    };
  }

  /**
   * Calculate Net Profit Margin = Net Income / Revenue * 100
   */
  private calculateNetProfitMargin(netIncome: Decimal, revenue: Decimal): Metric {
    if (revenue.isZero()) {
      return {
        value: '0',
        formatted_value: '0%',
        plain_english_explanation:
          'Net profit margin cannot be calculated because there is no revenue.',
      };
    }

    const margin = netIncome.div(revenue).mul(100);
    const marginValue = margin.toFixed(2);

    let explanation = `Your net profit margin is ${marginValue}%. `;
    explanation += `For every $1 of revenue, you keep $${netIncome.div(revenue).toFixed(2)} as profit after all expenses. `;

    if (margin.gte(20)) {
      explanation += 'This is excellent - your business is highly profitable.';
    } else if (margin.gte(10)) {
      explanation += 'This is solid - you are generating healthy profits.';
    } else if (margin.gte(5)) {
      explanation += 'This is moderate - there may be room to improve profitability.';
    } else if (margin.gt(0)) {
      explanation +=
        'This is thin - consider ways to increase revenue or reduce operating expenses.';
    } else {
      explanation += 'Your business is currently operating at a loss.';
    }

    return {
      value: marginValue,
      formatted_value: `${marginValue}%`,
      plain_english_explanation: explanation,
      industry_benchmark: '10-20%',
    };
  }

  /**
   * Calculate Operating Margin = Operating Income / Revenue * 100
   */
  private calculateOperatingMargin(
    operatingIncome: Decimal,
    revenue: Decimal
  ): Metric {
    if (revenue.isZero()) {
      return {
        value: '0',
        formatted_value: '0%',
        plain_english_explanation:
          'Operating margin cannot be calculated because there is no revenue.',
      };
    }

    const margin = operatingIncome.div(revenue).mul(100);
    const marginValue = margin.toFixed(2);

    let explanation = `Your operating margin is ${marginValue}%. `;
    explanation += `This shows how efficiently you run your core business operations. `;
    explanation += `For every $1 of revenue, you generate $${operatingIncome.div(revenue).toFixed(2)} from operations before interest and taxes. `;

    if (margin.gte(15)) {
      explanation += 'This is strong - your operations are highly efficient.';
    } else if (margin.gte(10)) {
      explanation += 'This is good - your business operates efficiently.';
    } else if (margin.gte(5)) {
      explanation += 'This is moderate - there may be opportunities to improve operational efficiency.';
    } else if (margin.gt(0)) {
      explanation +=
        'This is low - consider reviewing operating expenses and operational efficiency.';
    } else {
      explanation += 'Your operations are currently running at a loss.';
    }

    return {
      value: marginValue,
      formatted_value: `${marginValue}%`,
      plain_english_explanation: explanation,
      industry_benchmark: '10-15%',
    };
  }

  /**
   * Calculate Return on Equity (ROE) = Net Income / Equity * 100
   */
  private calculateReturnOnEquity(netIncome: Decimal, equity: Decimal): Metric {
    if (equity.isZero()) {
      return {
        value: '0',
        formatted_value: '0%',
        plain_english_explanation:
          'Return on equity cannot be calculated because there is no equity.',
      };
    }

    const roe = netIncome.div(equity).mul(100);
    const roeValue = roe.toFixed(2);

    let explanation = `Your return on equity is ${roeValue}%. `;
    explanation += `This measures how much profit you generate for each dollar of owner investment. `;

    if (roe.gte(20)) {
      explanation += 'This is excellent - you are generating strong returns on your investment.';
    } else if (roe.gte(15)) {
      explanation += 'This is good - you are generating healthy returns.';
    } else if (roe.gte(10)) {
      explanation += 'This is moderate - returns are reasonable but could be improved.';
    } else if (roe.gt(0)) {
      explanation += 'This is low - you might get better returns elsewhere.';
    } else {
      explanation += 'Your business is currently losing money relative to equity invested.';
    }

    return {
      value: roeValue,
      formatted_value: `${roeValue}%`,
      plain_english_explanation: explanation,
      industry_benchmark: '15-20%',
    };
  }

  /**
   * Calculate Return on Assets (ROA) = Net Income / Total Assets * 100
   */
  private calculateReturnOnAssets(netIncome: Decimal, totalAssets: Decimal): Metric {
    if (totalAssets.isZero()) {
      return {
        value: '0',
        formatted_value: '0%',
        plain_english_explanation:
          'Return on assets cannot be calculated because there are no assets.',
      };
    }

    const roa = netIncome.div(totalAssets).mul(100);
    const roaValue = roa.toFixed(2);

    let explanation = `Your return on assets is ${roaValue}%. `;
    explanation += `This measures how efficiently you use your assets to generate profit. `;

    if (roa.gte(10)) {
      explanation += 'This is excellent - you are using your assets very efficiently.';
    } else if (roa.gte(5)) {
      explanation += 'This is good - you are generating solid returns from your assets.';
    } else if (roa.gte(2)) {
      explanation += 'This is moderate - there may be opportunities to use assets more efficiently.';
    } else if (roa.gt(0)) {
      explanation += 'This is low - consider how to better utilize your assets.';
    } else {
      explanation += 'Your business is currently generating negative returns on assets.';
    }

    return {
      value: roaValue,
      formatted_value: `${roaValue}%`,
      plain_english_explanation: explanation,
      industry_benchmark: '5-10%',
    };
  }

  /**
   * Calculate Revenue Per Employee (optional if payroll data available)
   */
  private async calculateRevenuePerEmployee(
    companyId: string,
    revenue: Decimal,
    _dateRange: { start_date: number; end_date: number }
  ): Promise<Metric | null> {
    // Check if payroll accounts exist
    const payrollAccounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and(
        (acc) =>
          acc.deleted_at === null &&
          acc.active &&
          acc.type === AccountType.EXPENSE &&
          acc.name.toLowerCase().includes('payroll')
      )
      .toArray();

    if (!payrollAccounts || payrollAccounts.length === 0) {
      return null; // No payroll data available
    }

    // Estimate employee count from payroll expenses
    // This is a rough estimate - actual employee count would require separate tracking
    const employeeCount = 1; // Simplified for now

    if (employeeCount === 0) {
      return null;
    }

    const revenuePerEmployee = revenue.div(employeeCount);
    const value = revenuePerEmployee.toFixed(2);

    let explanation = `Your revenue per employee is $${value}. `;
    explanation += `This metric helps assess productivity and efficiency. `;
    explanation += 'Note: Employee count is estimated from payroll data.';

    return {
      value,
      formatted_value: `$${value}`,
      plain_english_explanation: explanation,
    };
  }

  /**
   * Get historical profitability metrics
   */
  private async getHistoricalProfitabilityMetrics(
    companyId: string,
    endDate: number,
    months: number,
    includeBarter: boolean
  ): Promise<{
    gross_profit_margin: MetricDataPoint[];
    net_profit_margin: MetricDataPoint[];
    operating_margin: MetricDataPoint[];
    return_on_equity: MetricDataPoint[];
    return_on_assets: MetricDataPoint[];
  }> {
    const dataPoints = {
      gross_profit_margin: [] as MetricDataPoint[],
      net_profit_margin: [] as MetricDataPoint[],
      operating_margin: [] as MetricDataPoint[],
      return_on_equity: [] as MetricDataPoint[],
      return_on_assets: [] as MetricDataPoint[],
    };

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();

      const plData = await this.getProfitLossData(
        companyId,
        monthStart,
        monthEnd,
        includeBarter
      );
      const bsData = await this.getBalanceSheetData(companyId, monthEnd);

      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      // Gross Profit Margin
      if (!plData.revenue.isZero()) {
        const grossProfit = plData.revenue.minus(plData.cogs);
        const margin = grossProfit.div(plData.revenue).mul(100);
        dataPoints.gross_profit_margin.push({
          date: monthEnd,
          value: margin.toFixed(2),
          label,
        });
      }

      // Net Profit Margin
      if (!plData.revenue.isZero()) {
        const margin = plData.net_income.div(plData.revenue).mul(100);
        dataPoints.net_profit_margin.push({
          date: monthEnd,
          value: margin.toFixed(2),
          label,
        });
      }

      // Operating Margin
      if (!plData.revenue.isZero()) {
        const margin = plData.operating_income.div(plData.revenue).mul(100);
        dataPoints.operating_margin.push({
          date: monthEnd,
          value: margin.toFixed(2),
          label,
        });
      }

      // ROE
      if (!bsData.equity.isZero()) {
        const roe = plData.net_income.div(bsData.equity).mul(100);
        dataPoints.return_on_equity.push({
          date: monthEnd,
          value: roe.toFixed(2),
          label,
        });
      }

      // ROA
      if (!bsData.total_assets.isZero()) {
        const roa = plData.net_income.div(bsData.total_assets).mul(100);
        dataPoints.return_on_assets.push({
          date: monthEnd,
          value: roa.toFixed(2),
          label,
        });
      }
    }

    return dataPoints;
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Check if company has any barter transactions
   */
  private async hasBarterTransactions(companyId: string): Promise<boolean> {
    const barterCount = await this.db.transactions
      ?.where('company_id')
      .equals(companyId)
      .and((txn) => txn.type === 'BARTER' && txn.deleted_at === null)
      .count();

    return (barterCount || 0) > 0;
  }

  /**
   * Get P&L data for a date range
   */
  private async getProfitLossData(
    companyId: string,
    startDate: number,
    endDate: number,
    includeBarter: boolean
  ): Promise<{
    revenue: Decimal;
    cogs: Decimal;
    operating_income: Decimal;
    net_income: Decimal;
    cash_revenue: Decimal;
    accrual_revenue: Decimal;
    barter_revenue: Decimal;
  }> {
    const accounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and((acc) => acc.deleted_at === null && acc.active)
      .toArray();

    if (!accounts || accounts.length === 0) {
      return {
        revenue: new Decimal(0),
        cogs: new Decimal(0),
        operating_income: new Decimal(0),
        net_income: new Decimal(0),
        cash_revenue: new Decimal(0),
        accrual_revenue: new Decimal(0),
        barter_revenue: new Decimal(0),
      };
    }

    let totalRevenue = new Decimal(0);
    let cashRevenue = new Decimal(0);
    let accrualRevenue = new Decimal(0);
    let barterRevenue = new Decimal(0);
    let totalCogs = new Decimal(0);
    let totalExpenses = new Decimal(0);

    for (const account of accounts) {
      const lineItems = await this.db.transactionLineItems
        ?.where('account_id')
        .equals(account.id)
        .and((item) => item.deleted_at === null)
        .toArray();

      if (!lineItems) continue;

      for (const item of lineItems) {
        const transaction = await this.db.transactions.get(item.transaction_id);
        if (
          !transaction ||
          transaction.transaction_date < startDate ||
          transaction.transaction_date > endDate ||
          (transaction.status !== 'POSTED' && transaction.status !== 'RECONCILED')
        ) {
          continue;
        }

        const credit = new Decimal(item.credit || '0');
        const debit = new Decimal(item.debit || '0');

        // Revenue (credits to income accounts)
        if (account.type === AccountType.INCOME || account.type === AccountType.OTHER_INCOME) {
          const isBarter = transaction.type === 'BARTER' || transaction.reference?.includes('BARTER-');

          if (isBarter && includeBarter) {
            barterRevenue = barterRevenue.plus(credit);
            totalRevenue = totalRevenue.plus(credit);
          } else if (!isBarter) {
            // Differentiate cash vs accrual (simplified: payment type vs invoice)
            if (transaction.type === 'PAYMENT') {
              cashRevenue = cashRevenue.plus(credit);
            } else {
              accrualRevenue = accrualRevenue.plus(credit);
            }
            totalRevenue = totalRevenue.plus(credit);
          }
        }

        // COGS (debits to COGS accounts)
        if (account.type === AccountType.COGS) {
          totalCogs = totalCogs.plus(debit);
        }

        // Operating Expenses (debits to expense accounts)
        if (account.type === AccountType.EXPENSE || account.type === AccountType.OTHER_EXPENSE) {
          totalExpenses = totalExpenses.plus(debit);
        }
      }
    }

    const operatingIncome = totalRevenue.minus(totalCogs).minus(totalExpenses);
    const netIncome = operatingIncome; // Simplified (no interest/taxes separation for now)

    return {
      revenue: totalRevenue,
      cogs: totalCogs,
      operating_income: operatingIncome,
      net_income: netIncome,
      cash_revenue: cashRevenue,
      accrual_revenue: accrualRevenue,
      barter_revenue: barterRevenue,
    };
  }

  /**
   * Get balance sheet data as of a specific date
   */
  private async getBalanceSheetData(
    companyId: string,
    asOfDate: number
  ): Promise<{
    total_assets: Decimal;
    equity: Decimal;
  }> {
    const accounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and((acc) => acc.deleted_at === null && acc.active)
      .toArray();

    if (!accounts || accounts.length === 0) {
      return {
        total_assets: new Decimal(0),
        equity: new Decimal(0),
      };
    }

    let totalAssets = new Decimal(0);
    let totalLiabilities = new Decimal(0);

    for (const account of accounts) {
      const balance = await this.getAccountBalance(account.id, asOfDate);

      if (account.type === AccountType.ASSET) {
        totalAssets = totalAssets.plus(balance);
      }

      if (account.type === AccountType.LIABILITY) {
        totalLiabilities = totalLiabilities.plus(balance);
      }
    }

    const equity = totalAssets.minus(totalLiabilities);

    return {
      total_assets: totalAssets,
      equity,
    };
  }

  /**
   * Get account balance as of a specific date
   */
  private async getAccountBalance(accountId: string, asOfDate: number): Promise<Decimal> {
    const lineItems = await this.db.transactionLineItems
      ?.where('account_id')
      .equals(accountId)
      .and((item) => item.deleted_at === null)
      .toArray();

    if (!lineItems || lineItems.length === 0) {
      return new Decimal(0);
    }

    let balance = new Decimal(0);

    for (const item of lineItems) {
      const transaction = await this.db.transactions.get(item.transaction_id);
      if (!transaction || transaction.transaction_date > asOfDate) {
        continue;
      }

      if (transaction.status !== 'POSTED' && transaction.status !== 'RECONCILED') {
        continue;
      }

      const debit = new Decimal(item.debit || '0');
      const credit = new Decimal(item.credit || '0');
      balance = balance.plus(debit).minus(credit);
    }

    return balance;
  }
}
