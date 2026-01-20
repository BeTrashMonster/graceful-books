/**
 * Efficiency Metrics Service
 *
 * Calculates efficiency ratios (turnover metrics).
 * These metrics answer: "How fast does money move?"
 *
 * Requirements: J4 - Key Financial Metrics Reports (Nice)
 */

import Decimal from 'decimal.js';
import type { TreasureChestDB } from '../../db/database';
import type {
  EfficiencyMetrics,
  EfficiencyMetricsRequest,
  Metric,
  MetricDataPoint,
  DateRange,
} from '../../types/metrics.types';
import { AccountType } from '../../types/database.types';

export class EfficiencyMetricsService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  /**
   * Calculate efficiency metrics for a date range
   */
  async calculateEfficiencyMetrics(
    request: EfficiencyMetricsRequest
  ): Promise<EfficiencyMetrics> {
    const { company_id, date_range, include_history = true } = request;

    // Get AR data
    const arData = await this.getAccountsReceivableData(
      company_id,
      date_range.start_date,
      date_range.end_date
    );

    // Get AP data
    const apData = await this.getAccountsPayableData(
      company_id,
      date_range.start_date,
      date_range.end_date
    );

    // Get inventory data (if available)
    const inventoryData = await this.getInventoryData(
      company_id,
      date_range.start_date,
      date_range.end_date
    );

    // Calculate metrics
    const arTurnover = this.calculateARTurnover(arData.revenue, arData.average_ar);
    const dso = this.calculateDaysSalesOutstanding(arData.average_ar, arData.revenue, date_range);
    const apTurnover = this.calculateAPTurnover(apData.cogs, apData.average_ap);
    const dpo = this.calculateDaysPayableOutstanding(apData.average_ap, apData.cogs, date_range);

    let inventoryTurnover;
    let inventoryDays;
    if (inventoryData.has_inventory) {
      inventoryTurnover = this.calculateInventoryTurnover(apData.cogs, inventoryData.average_inventory);
      inventoryDays = this.calculateInventoryDays(inventoryData.average_inventory, apData.cogs, date_range);
    }

    // Get historical data
    let history;
    if (include_history) {
      history = await this.getHistoricalEfficiencyMetrics(company_id, date_range.end_date, 12);
    } else {
      history = {
        ar_turnover: [],
        days_sales_outstanding: [],
        ap_turnover: [],
        inventory_turnover: [],
      };
    }

    return {
      ar_turnover: arTurnover,
      days_sales_outstanding: dso,
      ap_turnover: apTurnover,
      days_payable_outstanding: dpo,
      inventory_turnover: inventoryTurnover,
      inventory_days: inventoryDays,
      date_range,
      history,
    };
  }

  /**
   * AR Turnover = Revenue / Average AR
   * Higher is better - shows how quickly you collect
   */
  private calculateARTurnover(revenue: Decimal, averageAR: Decimal): Metric {
    if (averageAR.isZero()) {
      return {
        value: '0',
        formatted_value: 'N/A',
        plain_english_explanation: 'AR turnover cannot be calculated because there are no receivables.',
      };
    }

    const turnover = revenue.div(averageAR);
    const value = turnover.toFixed(2);

    let explanation = `Your accounts receivable turnover is ${value}x. `;
    explanation += `This means you collect your average receivables ${value} times per year. `;

    if (turnover.gte(12)) {
      explanation += 'Excellent - you collect very quickly (less than a month on average).';
    } else if (turnover.gte(6)) {
      explanation += 'Good - you collect within 2 months on average.';
    } else if (turnover.gte(4)) {
      explanation += 'Moderate - collections take about 3 months on average.';
    } else {
      explanation += 'Slow - consider improving your collection process.';
    }

    return {
      value,
      formatted_value: `${value}x`,
      plain_english_explanation: explanation,
      industry_benchmark: '8-12x',
    };
  }

  /**
   * Days Sales Outstanding (DSO) = (Average AR / Revenue) * Days in Period
   */
  private calculateDaysSalesOutstanding(
    averageAR: Decimal,
    revenue: Decimal,
    dateRange: DateRange
  ): Metric {
    if (revenue.isZero()) {
      return {
        value: '0',
        formatted_value: '0 days',
        plain_english_explanation: 'DSO cannot be calculated because there is no revenue.',
      };
    }

    const daysInPeriod = Math.ceil((dateRange.end_date - dateRange.start_date) / (24 * 60 * 60 * 1000));
    const dso = averageAR.div(revenue).mul(daysInPeriod);
    const value = dso.toFixed(0);

    let explanation = `Your Days Sales Outstanding is ${value} days. `;
    explanation += `On average, it takes ${value} days to collect payment after a sale. `;

    if (dso.lte(30)) {
      explanation += 'Excellent - you collect within a month.';
    } else if (dso.lte(45)) {
      explanation += 'Good - reasonable collection time.';
    } else if (dso.lte(60)) {
      explanation += 'Moderate - consider ways to speed up collections.';
    } else {
      explanation += 'High - you should focus on improving collection processes.';
    }

    return {
      value,
      formatted_value: `${value} days`,
      plain_english_explanation: explanation,
      industry_benchmark: '30-45 days',
    };
  }

  /**
   * AP Turnover = COGS / Average AP
   */
  private calculateAPTurnover(cogs: Decimal, averageAP: Decimal): Metric {
    if (averageAP.isZero()) {
      return {
        value: '0',
        formatted_value: 'N/A',
        plain_english_explanation: 'AP turnover cannot be calculated because there are no payables.',
      };
    }

    const turnover = cogs.div(averageAP);
    const value = turnover.toFixed(2);

    let explanation = `Your accounts payable turnover is ${value}x. `;
    explanation += `This means you pay your suppliers ${value} times per year. `;

    if (turnover.gte(12)) {
      explanation += 'You pay very quickly (less than a month). This might reduce cash flow flexibility.';
    } else if (turnover.gte(8)) {
      explanation += 'Good balance - you pay within 1-2 months.';
    } else if (turnover.gte(6)) {
      explanation += 'You take about 2 months to pay - this can help cash flow.';
    } else {
      explanation += 'You pay slowly. Ensure this aligns with vendor terms to avoid late fees.';
    }

    return {
      value,
      formatted_value: `${value}x`,
      plain_english_explanation: explanation,
      industry_benchmark: '8-12x',
    };
  }

  /**
   * Days Payable Outstanding (DPO)
   */
  private calculateDaysPayableOutstanding(
    averageAP: Decimal,
    cogs: Decimal,
    dateRange: DateRange
  ): Metric {
    if (cogs.isZero()) {
      return {
        value: '0',
        formatted_value: '0 days',
        plain_english_explanation: 'DPO cannot be calculated because there is no COGS.',
      };
    }

    const daysInPeriod = Math.ceil((dateRange.end_date - dateRange.start_date) / (24 * 60 * 60 * 1000));
    const dpo = averageAP.div(cogs).mul(daysInPeriod);
    const value = dpo.toFixed(0);

    let explanation = `Your Days Payable Outstanding is ${value} days. `;
    explanation += `On average, you pay your bills ${value} days after purchase. `;

    return {
      value,
      formatted_value: `${value} days`,
      plain_english_explanation: explanation,
      industry_benchmark: '30-60 days',
    };
  }

  /**
   * Inventory Turnover = COGS / Average Inventory
   */
  private calculateInventoryTurnover(cogs: Decimal, averageInventory: Decimal): Metric {
    if (averageInventory.isZero()) {
      return {
        value: '0',
        formatted_value: 'N/A',
        plain_english_explanation: 'Inventory turnover cannot be calculated because there is no inventory.',
      };
    }

    const turnover = cogs.div(averageInventory);
    const value = turnover.toFixed(2);

    let explanation = `Your inventory turnover is ${value}x. `;
    explanation += `This means you sell and replace your entire inventory ${value} times per year. `;

    if (turnover.gte(8)) {
      explanation += 'Excellent - your inventory moves quickly.';
    } else if (turnover.gte(5)) {
      explanation += 'Good - healthy inventory turnover.';
    } else if (turnover.gte(3)) {
      explanation += 'Moderate - inventory sits for a while before selling.';
    } else {
      explanation += 'Low - you may have too much inventory or slow-moving stock.';
    }

    return {
      value,
      formatted_value: `${value}x`,
      plain_english_explanation: explanation,
      industry_benchmark: '5-8x (varies widely by industry)',
    };
  }

  /**
   * Inventory Days = (Average Inventory / COGS) * Days
   */
  private calculateInventoryDays(
    averageInventory: Decimal,
    cogs: Decimal,
    dateRange: DateRange
  ): Metric {
    if (cogs.isZero()) {
      return {
        value: '0',
        formatted_value: '0 days',
        plain_english_explanation: 'Inventory days cannot be calculated because there is no COGS.',
      };
    }

    const daysInPeriod = Math.ceil((dateRange.end_date - dateRange.start_date) / (24 * 60 * 60 * 1000));
    const inventoryDays = averageInventory.div(cogs).mul(daysInPeriod);
    const value = inventoryDays.toFixed(0);

    let explanation = `Your inventory sits for an average of ${value} days before being sold. `;

    return {
      value,
      formatted_value: `${value} days`,
      plain_english_explanation: explanation,
      industry_benchmark: '45-75 days (varies by industry)',
    };
  }

  /**
   * Get historical efficiency metrics
   */
  private async getHistoricalEfficiencyMetrics(
    companyId: string,
    endDate: number,
    months: number
  ): Promise<{
    ar_turnover: MetricDataPoint[];
    days_sales_outstanding: MetricDataPoint[];
    ap_turnover: MetricDataPoint[];
    inventory_turnover: MetricDataPoint[];
  }> {
    const dataPoints = {
      ar_turnover: [] as MetricDataPoint[],
      days_sales_outstanding: [] as MetricDataPoint[],
      ap_turnover: [] as MetricDataPoint[],
      inventory_turnover: [] as MetricDataPoint[],
    };

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();

      const arData = await this.getAccountsReceivableData(companyId, monthStart, monthEnd);
      const apData = await this.getAccountsPayableData(companyId, monthStart, monthEnd);
      const inventoryData = await this.getInventoryData(companyId, monthStart, monthEnd);

      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      // AR Turnover
      if (!arData.average_ar.isZero()) {
        const turnover = arData.revenue.div(arData.average_ar);
        dataPoints.ar_turnover.push({
          date: monthEnd,
          value: turnover.toFixed(2),
          label,
        });
      }

      // DSO
      if (!arData.revenue.isZero()) {
        const daysInMonth = Math.ceil((monthEnd - monthStart) / (24 * 60 * 60 * 1000));
        const dso = arData.average_ar.div(arData.revenue).mul(daysInMonth);
        dataPoints.days_sales_outstanding.push({
          date: monthEnd,
          value: dso.toFixed(0),
          label,
        });
      }

      // AP Turnover
      if (!apData.average_ap.isZero()) {
        const turnover = apData.cogs.div(apData.average_ap);
        dataPoints.ap_turnover.push({
          date: monthEnd,
          value: turnover.toFixed(2),
          label,
        });
      }

      // Inventory Turnover
      if (inventoryData.has_inventory && !inventoryData.average_inventory.isZero()) {
        const turnover = apData.cogs.div(inventoryData.average_inventory);
        dataPoints.inventory_turnover.push({
          date: monthEnd,
          value: turnover.toFixed(2),
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
   * Get accounts receivable data
   */
  private async getAccountsReceivableData(
    companyId: string,
    startDate: number,
    endDate: number
  ): Promise<{
    revenue: Decimal;
    average_ar: Decimal;
  }> {
    // Get revenue from income accounts
    const revenueAccounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and(
        (acc) =>
          acc.deleted_at === null &&
          acc.active &&
          (acc.type === AccountType.INCOME || acc.type === AccountType.OTHER_INCOME)
      )
      .toArray();

    let revenue = new Decimal(0);
    if (revenueAccounts) {
      for (const account of revenueAccounts) {
        const accountRevenue = await this.getAccountActivity(
          account.id,
          startDate,
          endDate,
          'credit'
        );
        revenue = revenue.plus(accountRevenue);
      }
    }

    // Get AR balance (beginning + ending) / 2
    const arAccounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and(
        (acc) =>
          acc.deleted_at === null &&
          acc.active &&
          acc.type === AccountType.ASSET &&
          acc.name.toLowerCase().includes('receivable')
      )
      .toArray();

    let beginningAR = new Decimal(0);
    let endingAR = new Decimal(0);

    if (arAccounts) {
      for (const account of arAccounts) {
        beginningAR = beginningAR.plus(await this.getAccountBalance(account.id, startDate));
        endingAR = endingAR.plus(await this.getAccountBalance(account.id, endDate));
      }
    }

    const averageAR = beginningAR.plus(endingAR).div(2);

    return {
      revenue,
      average_ar: averageAR,
    };
  }

  /**
   * Get accounts payable data
   */
  private async getAccountsPayableData(
    companyId: string,
    startDate: number,
    endDate: number
  ): Promise<{
    cogs: Decimal;
    average_ap: Decimal;
  }> {
    // Get COGS
    const cogsAccounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and((acc) => acc.deleted_at === null && acc.active && acc.type === AccountType.COGS)
      .toArray();

    let cogs = new Decimal(0);
    if (cogsAccounts) {
      for (const account of cogsAccounts) {
        const accountCogs = await this.getAccountActivity(account.id, startDate, endDate, 'debit');
        cogs = cogs.plus(accountCogs);
      }
    }

    // Get AP balance
    const apAccounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and(
        (acc) =>
          acc.deleted_at === null &&
          acc.active &&
          acc.type === AccountType.LIABILITY &&
          acc.name.toLowerCase().includes('payable')
      )
      .toArray();

    let beginningAP = new Decimal(0);
    let endingAP = new Decimal(0);

    if (apAccounts) {
      for (const account of apAccounts) {
        beginningAP = beginningAP.plus(await this.getAccountBalance(account.id, startDate));
        endingAP = endingAP.plus(await this.getAccountBalance(account.id, endDate));
      }
    }

    const averageAP = beginningAP.plus(endingAP).div(2);

    return {
      cogs,
      average_ap: averageAP,
    };
  }

  /**
   * Get inventory data
   */
  private async getInventoryData(
    companyId: string,
    startDate: number,
    endDate: number
  ): Promise<{
    has_inventory: boolean;
    average_inventory: Decimal;
  }> {
    const inventoryAccounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and(
        (acc) =>
          acc.deleted_at === null &&
          acc.active &&
          acc.type === AccountType.ASSET &&
          acc.name.toLowerCase().includes('inventory')
      )
      .toArray();

    if (!inventoryAccounts || inventoryAccounts.length === 0) {
      return {
        has_inventory: false,
        average_inventory: new Decimal(0),
      };
    }

    let beginningInventory = new Decimal(0);
    let endingInventory = new Decimal(0);

    for (const account of inventoryAccounts) {
      beginningInventory = beginningInventory.plus(
        await this.getAccountBalance(account.id, startDate)
      );
      endingInventory = endingInventory.plus(await this.getAccountBalance(account.id, endDate));
    }

    const averageInventory = beginningInventory.plus(endingInventory).div(2);

    return {
      has_inventory: true,
      average_inventory: averageInventory,
    };
  }

  /**
   * Get account balance as of a date
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

  /**
   * Get account activity (debits or credits) for a date range
   */
  private async getAccountActivity(
    accountId: string,
    startDate: number,
    endDate: number,
    side: 'debit' | 'credit'
  ): Promise<Decimal> {
    const lineItems = await this.db.transactionLineItems
      ?.where('account_id')
      .equals(accountId)
      .and((item) => item.deleted_at === null)
      .toArray();

    if (!lineItems || lineItems.length === 0) {
      return new Decimal(0);
    }

    let total = new Decimal(0);

    for (const item of lineItems) {
      const transaction = await this.db.transactions.get(item.transaction_id);
      if (
        !transaction ||
        transaction.transaction_date < startDate ||
        transaction.transaction_date > endDate
      ) {
        continue;
      }

      if (transaction.status !== 'POSTED' && transaction.status !== 'RECONCILED') {
        continue;
      }

      const amount = new Decimal(item[side] || '0');
      total = total.plus(amount);
    }

    return total;
  }
}
