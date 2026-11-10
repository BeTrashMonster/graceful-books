/**
 * AI Forecasting Service
 *
 * Implements secure financial forecasting.
 * This is VIEW-ONLY - projections are displayed separately from actuals.
 *
 * Security controls:
 * - View-only: No automated actions based on forecasts
 * - Clear "AI Forecast" labeling
 * - Uncertainty communication (confidence intervals)
 * - Warnings about forecast limitations
 * - Human judgment prompts
 *
 * @security Phase 4.3 - AI Forecasting Feature
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import {
  executeTask,
  AITaskType,
  SuggestionStatus,
  addSuggestion,
  getSuggestion,
  querySuggestions,
  approveSuggestion,
  rejectSuggestion,
  type TransactionForProcessing,
  type AISuggestion,
} from '../../architecture';

import {
  isAIEnabled,
  logRequest,
  logResponse,
  logError,
  recordOperation,
} from '../../monitoring';

import {
  isFeatureAllowed,
  AIFeature,
} from '../../consent';

/**
 * Forecast period type
 */
export type ForecastPeriod = '1_week' | '1_month' | '3_months' | '6_months' | '1_year';

/**
 * Historical transaction input
 */
export interface HistoricalTransaction {
  id: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  isRecurring?: boolean;
}

/**
 * Forecast request
 */
export interface ForecastRequest {
  userId: string;
  companyId: string;
  historicalData: HistoricalTransaction[];
  forecastPeriod: ForecastPeriod;
  includeSeasonality?: boolean;
  includeCategories?: boolean;
}

/**
 * Category breakdown in forecast
 */
export interface CategoryForecast {
  category: string;
  projectedAmount: number;
  percentageOfTotal: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Confidence interval
 */
export interface ConfidenceInterval {
  low: number;
  mid: number;
  high: number;
  confidenceLevel: number; // e.g., 0.95 for 95% confidence
}

/**
 * Forecast result
 */
export interface ForecastResult {
  success: boolean;
  forecast?: {
    period: ForecastPeriod;
    projectedIncome: ConfidenceInterval;
    projectedExpenses: ConfidenceInterval;
    projectedNet: ConfidenceInterval;
    categoryBreakdown?: CategoryForecast[];
    assumptions: string[];
    limitations: string[];
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  };
  historicalComparison?: {
    previousPeriodActual: number;
    accuracy: number; // Historical accuracy of similar forecasts
  };
  suggestionId?: string;
  error?: string;
}

/**
 * Forecast feedback for improving accuracy
 */
interface ForecastFeedback {
  id: string;
  companyId: string;
  forecastId: string;
  forecastedValue: number;
  actualValue: number;
  variance: number;
  variancePercentage: number;
  feedbackDate: string;
  notes?: string;
}

// In-memory feedback storage
const forecastFeedback: ForecastFeedback[] = [];

/**
 * Period to days mapping
 */
const PERIOD_DAYS: Record<ForecastPeriod, number> = {
  '1_week': 7,
  '1_month': 30,
  '3_months': 90,
  '6_months': 180,
  '1_year': 365,
};

/**
 * Calculate data quality based on historical data
 */
function assessDataQuality(
  data: HistoricalTransaction[],
  periodDays: number
): 'excellent' | 'good' | 'fair' | 'poor' {
  if (data.length === 0) return 'poor';

  // Need at least 3x the forecast period in history
  const minDataDays = periodDays * 3;
  const dates = data.map((d) => new Date(d.date).getTime());
  const dateRange = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);

  if (dateRange >= minDataDays * 2) return 'excellent';
  if (dateRange >= minDataDays) return 'good';
  if (dateRange >= periodDays) return 'fair';
  return 'poor';
}

/**
 * Generate assumptions based on data
 */
function generateAssumptions(
  data: HistoricalTransaction[],
  period: ForecastPeriod
): string[] {
  const assumptions: string[] = [
    'Business conditions remain similar to historical period',
    'No major external factors affect income/expenses',
    `Forecast based on ${data.length} historical transactions`,
  ];

  const hasRecurring = data.some((t) => t.isRecurring);
  if (hasRecurring) {
    assumptions.push('Recurring transactions continue at same frequency');
  }

  if (period === '6_months' || period === '1_year') {
    assumptions.push('Seasonal patterns from previous years repeat');
  }

  return assumptions;
}

/**
 * Generate limitations warnings
 */
function generateLimitations(
  dataQuality: string,
  period: ForecastPeriod
): string[] {
  const limitations: string[] = [
    'AI forecasts are estimates and should not replace professional financial advice',
    'Actual results may vary significantly from projections',
    'Past performance does not guarantee future results',
  ];

  if (dataQuality === 'poor' || dataQuality === 'fair') {
    limitations.push('Limited historical data may reduce forecast accuracy');
  }

  if (period === '6_months' || period === '1_year') {
    limitations.push('Longer forecast periods have higher uncertainty');
  }

  return limitations;
}

/**
 * Create forecast with full security controls
 *
 * This is VIEW-ONLY - projections displayed separately from actuals.
 * No automated actions are taken based on forecasts.
 */
export async function createForecast(
  request: ForecastRequest
): Promise<ForecastResult> {
  const startTime = Date.now();

  try {
    // Step 1: Check kill switch
    if (!isAIEnabled()) {
      throw new Error('AI features are disabled');
    }

    // Step 2: Check rate limits
    const rateCheck = recordOperation();
    if (!rateCheck.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetIn / 1000)} seconds.`);
    }

    // Step 3: Check consent
    if (!isFeatureAllowed(request.userId, request.companyId, AIFeature.CASH_FLOW_FORECAST)) {
      throw new Error('User has not granted consent for cash flow forecasting');
    }

    // Step 4: Log request
    logRequest(
      AITaskType.FORECAST,
      request.companyId,
      request.userId,
      `fore_${Date.now()}`,
      request.historicalData.length
    );

    // Step 5: Assess data quality
    const periodDays = PERIOD_DAYS[request.forecastPeriod];
    const dataQuality = assessDataQuality(request.historicalData, periodDays);

    if (dataQuality === 'poor') {
      return {
        success: false,
        error: 'Insufficient historical data for reliable forecast. Please add more transactions.',
      };
    }

    // Step 6: Sanitize and prepare data for AI
    const sanitizedTransactions: TransactionForProcessing[] = request.historicalData.map(
      (tx) => ({
        id: tx.id,
        date: tx.date,
        sanitized_description: tx.category || tx.type,
        amount: tx.type === 'income' ? tx.amount : -tx.amount,
        account_type: tx.type,
      })
    );

    // Step 7: Execute CaMeL flow
    const result = await executeTask(
      {
        task: AITaskType.FORECAST,
        company_id: request.companyId,
        user_id: request.userId,
        date_range: {
          start: request.historicalData
            .map((t) => t.date)
            .sort()[0],
          end: new Date().toISOString().split('T')[0],
        },
      },
      sanitizedTransactions
    );

    if (!result.success) {
      throw new Error(result.error || 'Forecasting failed');
    }

    // Step 8: Get suggestion and process forecast
    const suggestion = getSuggestion(result.suggestion_id!);
    if (!suggestion) {
      throw new Error('Suggestion not found after creation');
    }

    const rawForecast = (suggestion.suggested_data as any).forecast || {};

    // Step 9: Build forecast result with uncertainty
    const assumptions = generateAssumptions(request.historicalData, request.forecastPeriod);
    const limitations = generateLimitations(dataQuality, request.forecastPeriod);

    // Calculate confidence intervals (mock for scaffolding)
    const projectedIncome = calculateConfidenceInterval(
      rawForecast.projected_income || 0,
      dataQuality
    );
    const projectedExpenses = calculateConfidenceInterval(
      rawForecast.projected_expenses || 0,
      dataQuality
    );
    const projectedNet: ConfidenceInterval = {
      low: projectedIncome.low - projectedExpenses.high,
      mid: projectedIncome.mid - projectedExpenses.mid,
      high: projectedIncome.high - projectedExpenses.low,
      confidenceLevel: 0.8,
    };

    // Step 10: Log response
    const durationMs = Date.now() - startTime;
    logResponse(
      result.request_id,
      true,
      suggestion.confidence,
      durationMs,
      result.suggestion_id
    );

    // Step 11: Return VIEW-ONLY results
    return {
      success: true,
      suggestionId: result.suggestion_id,
      forecast: {
        period: request.forecastPeriod,
        projectedIncome,
        projectedExpenses,
        projectedNet,
        assumptions,
        limitations,
        dataQuality,
      },
      historicalComparison: {
        previousPeriodActual: calculatePreviousPeriodActual(
          request.historicalData,
          periodDays
        ),
        accuracy: getHistoricalAccuracy(request.companyId),
      },
    };
  } catch (error) {
    logError(
      undefined,
      error instanceof Error ? error : new Error(String(error)),
      request.companyId,
      request.userId
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Calculate confidence interval based on data quality
 */
function calculateConfidenceInterval(
  midValue: number,
  dataQuality: string
): ConfidenceInterval {
  // Wider intervals for lower quality data
  const spreadFactors: Record<string, number> = {
    excellent: 0.1,
    good: 0.15,
    fair: 0.25,
    poor: 0.4,
  };

  const spread = midValue * (spreadFactors[dataQuality] || 0.25);

  return {
    low: midValue - spread,
    mid: midValue,
    high: midValue + spread,
    confidenceLevel: dataQuality === 'excellent' ? 0.95 : dataQuality === 'good' ? 0.9 : 0.8,
  };
}

/**
 * Calculate actual value from previous period
 */
function calculatePreviousPeriodActual(
  data: HistoricalTransaction[],
  periodDays: number
): number {
  const now = Date.now();
  const periodStart = now - periodDays * 24 * 60 * 60 * 1000;

  let total = 0;
  for (const tx of data) {
    const txDate = new Date(tx.date).getTime();
    if (txDate >= periodStart && txDate <= now) {
      total += tx.type === 'income' ? tx.amount : -tx.amount;
    }
  }

  return total;
}

/**
 * Get historical accuracy of forecasts for this company
 */
function getHistoricalAccuracy(companyId: string): number {
  const companyFeedback = forecastFeedback.filter((f) => f.companyId === companyId);
  if (companyFeedback.length === 0) {
    return 0; // No history yet
  }

  // Calculate average accuracy (100% - average variance percentage)
  const avgVariance =
    companyFeedback.reduce((sum, f) => sum + Math.abs(f.variancePercentage), 0) /
    companyFeedback.length;

  return Math.max(0, 100 - avgVariance);
}

/**
 * Record feedback on a forecast
 *
 * Used to improve future forecast accuracy.
 */
export function recordForecastFeedback(
  companyId: string,
  forecastId: string,
  forecastedValue: number,
  actualValue: number,
  notes?: string
): ForecastFeedback {
  const variance = actualValue - forecastedValue;
  const variancePercentage = forecastedValue !== 0
    ? (variance / forecastedValue) * 100
    : 0;

  const feedback: ForecastFeedback = {
    id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    companyId,
    forecastId,
    forecastedValue,
    actualValue,
    variance,
    variancePercentage,
    feedbackDate: new Date().toISOString(),
    notes,
  };

  forecastFeedback.push(feedback);
  return feedback;
}

/**
 * Get forecast feedback statistics
 */
export function getForecastAccuracyStats(companyId: string): {
  totalForecasts: number;
  averageVariance: number;
  averageAccuracy: number;
  improvementTrend: 'improving' | 'stable' | 'declining' | 'unknown';
} {
  const companyFeedback = forecastFeedback.filter((f) => f.companyId === companyId);

  if (companyFeedback.length === 0) {
    return {
      totalForecasts: 0,
      averageVariance: 0,
      averageAccuracy: 0,
      improvementTrend: 'unknown',
    };
  }

  const avgVariance =
    companyFeedback.reduce((sum, f) => sum + Math.abs(f.variancePercentage), 0) /
    companyFeedback.length;

  // Calculate trend (compare recent vs older)
  let trend: 'improving' | 'stable' | 'declining' | 'unknown' = 'unknown';
  if (companyFeedback.length >= 4) {
    const mid = Math.floor(companyFeedback.length / 2);
    const olderAvg =
      companyFeedback.slice(0, mid).reduce((s, f) => s + Math.abs(f.variancePercentage), 0) /
      mid;
    const recentAvg =
      companyFeedback.slice(mid).reduce((s, f) => s + Math.abs(f.variancePercentage), 0) /
      (companyFeedback.length - mid);

    if (recentAvg < olderAvg - 5) {
      trend = 'improving';
    } else if (recentAvg > olderAvg + 5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }
  }

  return {
    totalForecasts: companyFeedback.length,
    averageVariance: avgVariance,
    averageAccuracy: Math.max(0, 100 - avgVariance),
    improvementTrend: trend,
  };
}

/**
 * Get pending forecast suggestions
 */
export function getPendingForecastSuggestions(
  companyId: string,
  userId?: string
): AISuggestion[] {
  const result = querySuggestions({
    company_id: companyId,
    user_id: userId,
    task_type: AITaskType.FORECAST,
    status: SuggestionStatus.PENDING,
  });

  return result.suggestions;
}

/**
 * Clear feedback history (for testing)
 */
export function clearForecastFeedback(): void {
  forecastFeedback.length = 0;
}

export default {
  createForecast,
  recordForecastFeedback,
  getForecastAccuracyStats,
  getPendingForecastSuggestions,
  clearForecastFeedback,
};
