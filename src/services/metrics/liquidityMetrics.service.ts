/**
 * Liquidity Metrics Service
 *
 * Calculates liquidity ratios and working capital metrics.
 * These metrics answer: "Can you pay your bills?"
 *
 * Requirements: J4 - Key Financial Metrics Reports (Nice)
 */

import Decimal from 'decimal.js';
import type { TreasureChestDB } from '../../db/database';
import type {
  LiquidityMetrics,
  LiquidityMetricsRequest,
  Metric,
  MetricDataPoint,
} from '../../types/metrics.types';
import { AccountType } from '../../types/database.types';

export class LiquidityMetricsService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  /**
   * Calculate liquidity metrics for a given date
   */
  async calculateLiquidityMetrics(
    request: LiquidityMetricsRequest
  ): Promise<LiquidityMetrics> {
    const { company_id, as_of_date, include_history = true } = request;

    // Get balance sheet data as of the specified date
    const balances = await this.getBalanceSheetData(company_id, as_of_date);

    // Calculate metrics
    const currentRatio = this.calculateCurrentRatio(
      balances.current_assets,
      balances.current_liabilities
    );

    const quickRatio = this.calculateQuickRatio(
      balances.current_assets,
      balances.inventory,
      balances.current_liabilities
    );

    const cashRatio = this.calculateCashRatio(
      balances.cash,
      balances.current_liabilities
    );

    const workingCapital = this.calculateWorkingCapital(
      balances.current_assets,
      balances.current_liabilities
    );

    const cashRunway = await this.calculateCashRunway(
      company_id,
      balances.cash,
      as_of_date
    );

    // Get historical data if requested
    let history;
    if (include_history) {
      history = await this.getHistoricalLiquidityMetrics(company_id, as_of_date, 12);
    } else {
      history = {
        current_ratio: [],
        quick_ratio: [],
        cash_ratio: [],
        working_capital: [],
      };
    }

    return {
      current_ratio: currentRatio,
      quick_ratio: quickRatio,
      cash_ratio: cashRatio,
      working_capital: workingCapital,
      cash_runway_months: cashRunway,
      date_range: {
        start_date: as_of_date,
        end_date: as_of_date,
      },
      history,
    };
  }

  /**
   * Calculate Current Ratio = Current Assets / Current Liabilities
   * Industry average: 1.5-3.0 (varies by industry)
   */
  private calculateCurrentRatio(
    currentAssets: Decimal,
    currentLiabilities: Decimal
  ): Metric {
    if (currentLiabilities.isZero()) {
      return {
        value: '0',
        formatted_value: 'N/A',
        plain_english_explanation:
          'Current ratio cannot be calculated because you have no current liabilities.',
      };
    }

    const ratio = currentAssets.div(currentLiabilities);
    const ratioValue = ratio.toFixed(2);

    let explanation = `Your current ratio is ${ratioValue}. `;
    explanation += `This means you have $${ratioValue} in current assets for every $1 of short-term debt. `;

    if (ratio.gte(2)) {
      explanation += 'This is a strong position - you can easily cover your short-term obligations.';
    } else if (ratio.gte(1)) {
      explanation += 'This is adequate - you can cover your short-term obligations.';
    } else {
      explanation +=
        'This is below 1.0, which means you may have difficulty paying short-term bills.';
    }

    return {
      value: ratioValue,
      formatted_value: ratioValue,
      plain_english_explanation: explanation,
      industry_benchmark: '1.5-2.0',
    };
  }

  /**
   * Calculate Quick Ratio = (Current Assets - Inventory) / Current Liabilities
   * Industry average: 1.0-1.5
   * Also called "Acid Test Ratio"
   */
  private calculateQuickRatio(
    currentAssets: Decimal,
    inventory: Decimal,
    currentLiabilities: Decimal
  ): Metric {
    if (currentLiabilities.isZero()) {
      return {
        value: '0',
        formatted_value: 'N/A',
        plain_english_explanation:
          'Quick ratio cannot be calculated because you have no current liabilities.',
      };
    }

    const liquidAssets = currentAssets.minus(inventory);
    const ratio = liquidAssets.div(currentLiabilities);
    const ratioValue = ratio.toFixed(2);

    let explanation = `Your quick ratio is ${ratioValue}. `;
    explanation += `This measures your ability to pay short-term debts using only your most liquid assets (excluding inventory). `;
    explanation += `You have $${ratioValue} in liquid assets for every $1 of short-term debt. `;

    if (ratio.gte(1.2)) {
      explanation += 'This is strong - you can quickly cover your obligations without selling inventory.';
    } else if (ratio.gte(1)) {
      explanation += 'This is adequate - you can cover short-term obligations with liquid assets.';
    } else {
      explanation +=
        'This is below 1.0, which means you may need to sell inventory or secure additional funding to meet short-term obligations.';
    }

    return {
      value: ratioValue,
      formatted_value: ratioValue,
      plain_english_explanation: explanation,
      industry_benchmark: '1.0-1.2',
    };
  }

  /**
   * Calculate Cash Ratio = Cash / Current Liabilities
   * Most conservative liquidity metric
   */
  private calculateCashRatio(cash: Decimal, currentLiabilities: Decimal): Metric {
    if (currentLiabilities.isZero()) {
      return {
        value: '0',
        formatted_value: 'N/A',
        plain_english_explanation:
          'Cash ratio cannot be calculated because you have no current liabilities.',
      };
    }

    const ratio = cash.div(currentLiabilities);
    const ratioValue = ratio.toFixed(2);

    let explanation = `Your cash ratio is ${ratioValue}. `;
    explanation += `This is the most conservative measure - it shows you have $${ratioValue} in cash for every $1 of short-term debt. `;

    if (ratio.gte(0.5)) {
      explanation += 'This is strong - you have substantial cash reserves relative to short-term obligations.';
    } else if (ratio.gte(0.2)) {
      explanation += 'This is reasonable - you have some cash buffer for short-term needs.';
    } else {
      explanation +=
        'This is low, which means you may need to rely on receivables or credit lines for short-term needs.';
    }

    return {
      value: ratioValue,
      formatted_value: ratioValue,
      plain_english_explanation: explanation,
      industry_benchmark: '0.2-0.5',
    };
  }

  /**
   * Calculate Working Capital = Current Assets - Current Liabilities
   */
  private calculateWorkingCapital(
    currentAssets: Decimal,
    currentLiabilities: Decimal
  ): Metric {
    const workingCapital = currentAssets.minus(currentLiabilities);
    const wcValue = workingCapital.toFixed(2);

    let explanation = `Your working capital is $${new Decimal(wcValue).abs().toFixed(2)}. `;
    explanation += 'This is the difference between your current assets and current liabilities. ';

    if (workingCapital.gt(0)) {
      explanation += 'A positive working capital means you have more current assets than short-term debts, which is healthy.';
    } else if (workingCapital.isZero()) {
      explanation += 'Your current assets exactly match your short-term liabilities.';
    } else {
      explanation +=
        'A negative working capital means you owe more in short-term debts than you have in liquid assets, which requires attention.';
    }

    return {
      value: wcValue,
      formatted_value: `$${new Decimal(wcValue).toFixed(2)}`,
      plain_english_explanation: explanation,
    };
  }

  /**
   * Calculate Cash Runway (months of operating expenses covered by cash)
   */
  private async calculateCashRunway(
    companyId: string,
    cash: Decimal,
    asOfDate: number
  ): Promise<Metric> {
    // Calculate average monthly operating expenses (last 3 months)
    const threeMonthsAgo = asOfDate - 90 * 24 * 60 * 60 * 1000;

    const expenses = await this.getOperatingExpenses(
      companyId,
      threeMonthsAgo,
      asOfDate
    );

    if (expenses.isZero()) {
      return {
        value: '0',
        formatted_value: 'N/A',
        plain_english_explanation:
          'Cash runway cannot be calculated because there are no operating expenses in the last 3 months.',
      };
    }

    const monthlyBurnRate = expenses.div(3); // Average over 3 months
    const runwayMonths = cash.div(monthlyBurnRate);
    const runwayValue = runwayMonths.toFixed(1);

    let explanation = `You have ${runwayValue} months of cash runway. `;
    explanation += `Based on your average monthly expenses of $${monthlyBurnRate.toFixed(2)}, your current cash of $${cash.toFixed(2)} will last approximately ${runwayValue} months. `;

    if (runwayMonths.gte(12)) {
      explanation += 'This is excellent - you have over a year of runway.';
    } else if (runwayMonths.gte(6)) {
      explanation += 'This is solid - you have a good buffer.';
    } else if (runwayMonths.gte(3)) {
      explanation += 'This is adequate, but consider building up your cash reserves.';
    } else {
      explanation +=
        'This is concerning - you should focus on increasing revenue or reducing expenses soon.';
    }

    return {
      value: runwayValue,
      formatted_value: `${runwayValue} months`,
      plain_english_explanation: explanation,
    };
  }

  /**
   * Get historical liquidity metrics for trend analysis
   */
  private async getHistoricalLiquidityMetrics(
    companyId: string,
    endDate: number,
    months: number
  ): Promise<{
    current_ratio: MetricDataPoint[];
    quick_ratio: MetricDataPoint[];
    cash_ratio: MetricDataPoint[];
    working_capital: MetricDataPoint[];
  }> {
    const dataPoints = {
      current_ratio: [] as MetricDataPoint[],
      quick_ratio: [] as MetricDataPoint[],
      cash_ratio: [] as MetricDataPoint[],
      working_capital: [] as MetricDataPoint[],
    };

    // Calculate metrics for each month
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setMonth(date.getMonth() - i);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();

      const balances = await this.getBalanceSheetData(companyId, monthEnd);

      // Current Ratio
      if (!balances.current_liabilities.isZero()) {
        const currentRatio = balances.current_assets.div(balances.current_liabilities);
        dataPoints.current_ratio.push({
          date: monthEnd,
          value: currentRatio.toFixed(2),
          label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        });
      }

      // Quick Ratio
      if (!balances.current_liabilities.isZero()) {
        const liquidAssets = balances.current_assets.minus(balances.inventory);
        const quickRatio = liquidAssets.div(balances.current_liabilities);
        dataPoints.quick_ratio.push({
          date: monthEnd,
          value: quickRatio.toFixed(2),
          label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        });
      }

      // Cash Ratio
      if (!balances.current_liabilities.isZero()) {
        const cashRatio = balances.cash.div(balances.current_liabilities);
        dataPoints.cash_ratio.push({
          date: monthEnd,
          value: cashRatio.toFixed(2),
          label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        });
      }

      // Working Capital
      const workingCapital = balances.current_assets.minus(balances.current_liabilities);
      dataPoints.working_capital.push({
        date: monthEnd,
        value: workingCapital.toFixed(2),
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      });
    }

    return dataPoints;
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Get balance sheet data as of a specific date
   */
  private async getBalanceSheetData(
    companyId: string,
    asOfDate: number
  ): Promise<{
    current_assets: Decimal;
    cash: Decimal;
    inventory: Decimal;
    current_liabilities: Decimal;
  }> {
    const accounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and((acc) => acc.deleted_at === null && acc.active)
      .toArray();

    if (!accounts || accounts.length === 0) {
      return {
        current_assets: new Decimal(0),
        cash: new Decimal(0),
        inventory: new Decimal(0),
        current_liabilities: new Decimal(0),
      };
    }

    let currentAssets = new Decimal(0);
    let cash = new Decimal(0);
    let inventory = new Decimal(0);
    let currentLiabilities = new Decimal(0);

    for (const account of accounts) {
      const balance = await this.getAccountBalance(account.id, asOfDate);

      // Current Assets: Cash, AR, Inventory (account numbers 1000-1999)
      if (account.type === AccountType.ASSET) {
        const accountNumber = parseInt(account.account_number || '0', 10);
        if (accountNumber >= 1000 && accountNumber < 2000) {
          currentAssets = currentAssets.plus(balance);

          // Cash accounts (1000-1099)
          if (accountNumber >= 1000 && accountNumber < 1100) {
            cash = cash.plus(balance);
          }

          // Inventory accounts (1200-1299)
          if (accountNumber >= 1200 && accountNumber < 1300) {
            inventory = inventory.plus(balance);
          }
        }
      }

      // Current Liabilities: AP, Short-term loans (account numbers 2000-2999)
      if (account.type === AccountType.LIABILITY) {
        const accountNumber = parseInt(account.account_number || '0', 10);
        if (accountNumber >= 2000 && accountNumber < 3000) {
          currentLiabilities = currentLiabilities.plus(balance);
        }
      }
    }

    return {
      current_assets: currentAssets,
      cash,
      inventory,
      current_liabilities: currentLiabilities,
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
      // Get the transaction to check date
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
   * Get operating expenses for a date range
   */
  private async getOperatingExpenses(
    companyId: string,
    startDate: number,
    endDate: number
  ): Promise<Decimal> {
    const accounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and(
        (acc) =>
          acc.deleted_at === null &&
          acc.active &&
          acc.type === AccountType.EXPENSE
      )
      .toArray();

    if (!accounts || accounts.length === 0) {
      return new Decimal(0);
    }

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
          transaction.transaction_date > endDate
        ) {
          continue;
        }

        if (transaction.status !== 'POSTED' && transaction.status !== 'RECONCILED') {
          continue;
        }

        const debit = new Decimal(item.debit || '0');
        totalExpenses = totalExpenses.plus(debit);
      }
    }

    return totalExpenses;
  }
}
