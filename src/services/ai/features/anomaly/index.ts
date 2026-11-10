/**
 * AI Anomaly Detection Feature Module
 *
 * @security Phase 4.2 - AI Anomaly Detection Feature
 */

export {
  detectAnomalies,
  dismissAnomaly,
  acknowledgeAnomaly,
  getPendingAnomalySuggestions,
  getDismissalStats,
  clearDismissalHistory,
  AnomalyType,
  AnomalySeverity,
  type TransactionInput,
  type AnomalyExplanation,
  type AnomalyDetectionRequest,
  type AnomalyDetectionResult,
} from './anomalyService';

export { default } from './anomalyService';
