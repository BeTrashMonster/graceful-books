/**
 * AI Forecasting Feature Module
 *
 * @security Phase 4.3 - AI Forecasting Feature
 */

export {
  createForecast,
  recordForecastFeedback,
  getForecastAccuracyStats,
  getPendingForecastSuggestions,
  clearForecastFeedback,
  type ForecastPeriod,
  type HistoricalTransaction,
  type ForecastRequest,
  type CategoryForecast,
  type ConfidenceInterval,
  type ForecastResult,
} from './forecastingService';

export { default } from './forecastingService';
