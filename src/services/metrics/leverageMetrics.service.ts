/**
 * Leverage Metrics Service
 *
 * Calculates leverage ratios (debt metrics).
 * These metrics answer: "How much debt do you have?"
 *
 * Requirements: J4 - Key Financial Metrics Reports (Nice)
 */

import Decimal from 'decimal.js';
import type { TreasureChestDB } from '../../db/database';
import type {
  LeverageMetrics,
  LeverageMetricsRequest,
  Metric,
  MetricDataPoint,
} from '../../types/metrics.types';
import { AccountType } from '../../types/database.types';

export class LeverageMetricsService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  async calculateLeverageMetrics(request: LeverageMetricsRequest): Promise<LeverageMetrics> {
    const { company_id, as_of_date, include_history = true } = request;

    const balances = await this.getBalanceSheetData(company_id, as_of_date);

    const debtToEquity = this.calculateDebtToEquity(balances.total_debt, balances.equity);
    const debtToAssets = this.calculateDebtToAssets(balances.total_debt, balances.total_assets);
    const interestCoverage = await this.calculateInterestCoverage(company_id, as_of_date);
    const equityMultiplier = this.calculateEquityMultiplier(balances.total_assets, balances.equity);

    let history;
    if (include_history) {
      history = await this.getHistoricalLeverageMetrics(company_id, as_of_date, 12);
    } else {
      history = {
        debt_to_equity: [],
        debt_to_assets: [],
        interest_coverage: [],
      };
    }

    return {
      debt_to_equity: debtToEquity,
      debt_to_assets: debtToAssets,
      interest_coverage: interestCoverage,
      equity_multiplier: equityMultiplier,
      date_range: { start_date: as_of_date, end_date: as_of_date },
      history,
    };
  }

  private calculateDebtToEquity(totalDebt: Decimal, equity: Decimal): Metric {
    if (equity.isZero()) {
      return {
        value: '0',
        formatted_value: 'N/A',
        plain_english_explanation: 'Debt-to-equity ratio cannot be calculated because there is no equity.',
      };
    }

    const ratio = totalDebt.div(equity);
    const value = ratio.toFixed(2);

    let explanation = `Your debt-to-equity ratio is ${value}. `;
    explanation += `This means you have $${value} of debt for every $1 of equity. `;

    if (ratio.lte(0.5)) {
      explanation += 'Low leverage - you rely mostly on equity funding.';
    } else if (ratio.lte(1)) {
      explanation += 'Moderate leverage - balanced debt and equity.';
    } else if (ratio.lte(2)) {
      explanation += 'High leverage - you rely heavily on debt.';
    } else {
      explanation += 'Very high leverage - financial risk is elevated.';
    }

    return {
      value,
      formatted_value: value,
      plain_english_explanation: explanation,
      industry_benchmark: '0.5-1.5',
    };
  }

  private calculateDebtToAssets(totalDebt: Decimal, totalAssets: Decimal): Metric {
    if (totalAssets.isZero()) {
      return {
        value: '0',
        formatted_value: 'N/A',
        plain_english_explanation: 'Debt-to-assets ratio cannot be calculated.',
      };
    }

    const ratio = totalDebt.div(totalAssets);
    const percentage = ratio.mul(100);
    const value = percentage.toFixed(2);

    let explanation = `${value}% of your assets are financed by debt. `;

    if (percentage.lte(30)) {
      explanation += 'Low debt - conservative financing.';
    } else if (percentage.lte(50)) {
      explanation += 'Moderate debt - balanced approach.';
    } else {
      explanation += 'High debt - significant portion of assets are debt-financed.';
    }

    return {
      value: percentage.toFixed(2),
      formatted_value: `${value}%`,
      plain_english_explanation: explanation,
      industry_benchmark: '30-50%',
    };
  }

  private async calculateInterestCoverage(_companyId: string, asOfDate: number): Promise<Metric> {
    // Simplified - would need actual interest expense tracking
    return {
      value: '0',
      formatted_value: 'N/A',
      plain_english_explanation: 'Interest coverage ratio requires interest expense tracking.',
    };
  }

  private calculateEquityMultiplier(totalAssets: Decimal, equity: Decimal): Metric {
    if (equity.isZero()) {
      return {
        value: '0',
        formatted_value: 'N/A',
        plain_english_explanation: 'Equity multiplier cannot be calculated.',
      };
    }

    const multiplier = totalAssets.div(equity);
    const value = multiplier.toFixed(2);

    return {
      value,
      formatted_value: value,
      plain_english_explanation: `Your equity multiplier is ${value}, showing the degree of financial leverage.`,
    };
  }

  private async getHistoricalLeverageMetrics(
    _companyId: string,
    endDate: number,
    months: number
  ): Promise<{
    debt_to_equity: MetricDataPoint[];
    debt_to_assets: MetricDataPoint[];
    interest_coverage: MetricDataPoint[];
  }> {
    return {
      debt_to_equity: [],
      debt_to_assets: [],
      interest_coverage: [],
    };
  }

  private async getBalanceSheetData(
    companyId: string,
    asOfDate: number
  ): Promise<{
    total_assets: Decimal;
    total_debt: Decimal;
    equity: Decimal;
  }> {
    const accounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and((acc) => acc.deleted_at === null && acc.active)
      .toArray();

    let totalAssets = new Decimal(0);
    let totalLiabilities = new Decimal(0);

    if (accounts) {
      for (const account of accounts) {
        const balance = new Decimal(account.balance || '0');

        if (account.type === AccountType.ASSET) {
          totalAssets = totalAssets.plus(balance);
        }
        if (account.type === AccountType.LIABILITY) {
          totalLiabilities = totalLiabilities.plus(balance);
        }
      }
    }

    const equity = totalAssets.minus(totalLiabilities);

    return {
      total_assets: totalAssets,
      total_debt: totalLiabilities,
      equity,
    };
  }
}
