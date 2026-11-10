/**
 * AI Anomaly Detection Service
 *
 * Implements secure anomaly detection for transactions.
 * This is a READ-ONLY feature - AI only flags, never modifies.
 *
 * Security controls:
 * - Read-only: AI cannot modify any data
 * - Clear explanations for each flag
 * - User can dismiss with reason
 * - Learning from dismissals to reduce false positives
 *
 * @security Phase 4.2 - AI Anomaly Detection Feature
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
 * Anomaly type classification
 */
export enum AnomalyType {
  DUPLICATE = 'duplicate',
  UNUSUAL_AMOUNT = 'unusual_amount',
  UNUSUAL_TIMING = 'unusual_timing',
  UNUSUAL_VENDOR = 'unusual_vendor',
  MISSING_DATA = 'missing_data',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  OTHER = 'other',
}

/**
 * Anomaly severity levels
 */
export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * Transaction input for anomaly detection
 */
export interface TransactionInput {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountType: string;
  category?: string;
  vendor?: string;
}

/**
 * Anomaly explanation with supporting data
 */
export interface AnomalyExplanation {
  transactionId: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  confidence: number;
  explanation: string;
  comparisonData?: {
    typicalValue?: number;
    actualValue?: number;
    stdDeviations?: number;
    typicalRange?: { min: number; max: number };
    similarTransactions?: string[];
  };
  suggestedAction: string;
}

/**
 * Anomaly detection request
 */
export interface AnomalyDetectionRequest {
  userId: string;
  companyId: string;
  transactions: TransactionInput[];
  sensitivityLevel?: 'low' | 'medium' | 'high';
  lookbackDays?: number;
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetectionResult {
  success: boolean;
  suggestionId?: string;
  anomalies?: AnomalyExplanation[];
  summary?: {
    totalAnomalies: number;
    highSeverityCount: number;
    byType: Record<AnomalyType, number>;
  };
  error?: string;
}

/**
 * Dismissal record for learning
 */
interface DismissalRecord {
  id: string;
  companyId: string;
  userId: string;
  transactionId: string;
  anomalyType: AnomalyType;
  dismissalReason: string;
  dismissedAt: string;
}

// In-memory dismissal history for learning
const dismissalHistory: DismissalRecord[] = [];
const MAX_DISMISSAL_HISTORY = 1000;

/**
 * Confidence thresholds by sensitivity level
 */
const CONFIDENCE_THRESHOLDS = {
  low: 0.8, // Only high-confidence anomalies
  medium: 0.6, // Medium and high confidence
  high: 0.4, // Include lower confidence (more false positives)
};

/**
 * Sanitize transaction description for AI processing
 */
function sanitizeDescription(description: string): string {
  return description
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .normalize('NFKC')
    .replace(/<[^>]*>/g, '')
    .substring(0, 500)
    .trim();
}

/**
 * Check if similar anomaly was dismissed before
 */
function wasSimilarDismissed(
  companyId: string,
  anomalyType: AnomalyType,
  transactionPattern: string
): boolean {
  const companyDismissals = dismissalHistory.filter(
    (d) => d.companyId === companyId && d.anomalyType === anomalyType
  );

  // If same type was dismissed 3+ times, reduce sensitivity
  if (companyDismissals.length >= 3) {
    return true;
  }

  return false;
}

/**
 * Detect anomalies in transactions
 *
 * This is READ-ONLY - it flags but never modifies transactions.
 */
export async function detectAnomalies(
  request: AnomalyDetectionRequest
): Promise<AnomalyDetectionResult> {
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
    if (!isFeatureAllowed(request.userId, request.companyId, AIFeature.ANOMALY_DETECTION)) {
      throw new Error('User has not granted consent for anomaly detection');
    }

    // Step 4: Log request
    logRequest(
      AITaskType.ANOMALY_DETECT,
      request.companyId,
      request.userId,
      `anom_${Date.now()}`,
      request.transactions.length
    );

    // Step 5: Sanitize inputs
    const sanitizedTransactions: TransactionForProcessing[] = request.transactions.map(
      (tx) => ({
        id: tx.id,
        date: tx.date,
        sanitized_description: sanitizeDescription(tx.description),
        amount: tx.amount,
        account_type: tx.accountType,
      })
    );

    // Step 6: Execute CaMeL flow
    const result = await executeTask(
      {
        task: AITaskType.ANOMALY_DETECT,
        company_id: request.companyId,
        user_id: request.userId,
      },
      sanitizedTransactions
    );

    if (!result.success) {
      throw new Error(result.error || 'Anomaly detection failed');
    }

    // Step 7: Get suggestion and process anomalies
    const suggestion = getSuggestion(result.suggestion_id!);
    if (!suggestion) {
      throw new Error('Suggestion not found after creation');
    }

    // Step 8: Apply confidence threshold and dismissal learning
    const confidenceThreshold = CONFIDENCE_THRESHOLDS[request.sensitivityLevel || 'medium'];
    const rawAnomalies = (suggestion.suggested_data as any).anomalies || [];
    const filteredAnomalies: AnomalyExplanation[] = [];

    const byType: Record<AnomalyType, number> = {
      [AnomalyType.DUPLICATE]: 0,
      [AnomalyType.UNUSUAL_AMOUNT]: 0,
      [AnomalyType.UNUSUAL_TIMING]: 0,
      [AnomalyType.UNUSUAL_VENDOR]: 0,
      [AnomalyType.MISSING_DATA]: 0,
      [AnomalyType.SUSPICIOUS_PATTERN]: 0,
      [AnomalyType.OTHER]: 0,
    };

    for (const raw of rawAnomalies) {
      const confidence = raw.confidence || 0.5;
      const anomalyType = (raw.anomaly_type as AnomalyType) || AnomalyType.OTHER;

      // Skip low confidence anomalies based on sensitivity
      if (confidence < confidenceThreshold) {
        continue;
      }

      // Skip if similar was repeatedly dismissed
      const transaction = request.transactions.find((t) => t.id === raw.transaction_id);
      if (
        transaction &&
        wasSimilarDismissed(request.companyId, anomalyType, transaction.description)
      ) {
        continue;
      }

      const severity = mapConfidenceToSeverity(confidence, anomalyType);

      filteredAnomalies.push({
        transactionId: raw.transaction_id,
        anomalyType,
        severity,
        confidence,
        explanation: generateExplanation(anomalyType, raw, transaction),
        comparisonData: raw.comparison_data,
        suggestedAction: generateSuggestedAction(anomalyType),
      });

      byType[anomalyType]++;
    }

    // Step 9: Log response
    const durationMs = Date.now() - startTime;
    logResponse(
      result.request_id,
      true,
      suggestion.confidence,
      durationMs,
      result.suggestion_id
    );

    // Step 10: Return read-only results
    return {
      success: true,
      suggestionId: result.suggestion_id,
      anomalies: filteredAnomalies,
      summary: {
        totalAnomalies: filteredAnomalies.length,
        highSeverityCount: filteredAnomalies.filter((a) => a.severity === AnomalySeverity.HIGH).length,
        byType,
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
 * Map confidence to severity
 */
function mapConfidenceToSeverity(
  confidence: number,
  anomalyType: AnomalyType
): AnomalySeverity {
  // Duplicates are always at least medium severity
  if (anomalyType === AnomalyType.DUPLICATE && confidence > 0.7) {
    return AnomalySeverity.HIGH;
  }

  if (confidence >= 0.8) {
    return AnomalySeverity.HIGH;
  } else if (confidence >= 0.6) {
    return AnomalySeverity.MEDIUM;
  }
  return AnomalySeverity.LOW;
}

/**
 * Generate human-readable explanation
 */
function generateExplanation(
  anomalyType: AnomalyType,
  rawData: any,
  transaction?: TransactionInput
): string {
  switch (anomalyType) {
    case AnomalyType.DUPLICATE:
      return 'This transaction appears to be a possible duplicate of another entry. ' +
        'The amount, date, and description are similar to existing transactions.';

    case AnomalyType.UNUSUAL_AMOUNT:
      const typical = rawData.comparison_data?.typicalValue;
      const actual = transaction?.amount;
      if (typical && actual) {
        const diff = Math.abs(actual - typical);
        const pct = ((diff / typical) * 100).toFixed(0);
        return `This amount ($${actual?.toFixed(2)}) is ${pct}% different from your typical ` +
          `transactions of this type ($${typical.toFixed(2)} average).`;
      }
      return 'This transaction amount is significantly different from your usual patterns.';

    case AnomalyType.UNUSUAL_TIMING:
      return 'This transaction occurred at an unusual time compared to your normal patterns. ' +
        'Check if this timing is expected.';

    case AnomalyType.UNUSUAL_VENDOR:
      return 'This appears to be a new vendor or an unusual merchant for your business. ' +
        'Verify this transaction is legitimate.';

    case AnomalyType.MISSING_DATA:
      return 'This transaction is missing some expected information. ' +
        'Consider adding additional details for better record-keeping.';

    case AnomalyType.SUSPICIOUS_PATTERN:
      return 'This transaction matches patterns that may warrant review. ' +
        'Please verify this transaction is as expected.';

    default:
      return rawData.description || 'This transaction has characteristics that differ from usual patterns.';
  }
}

/**
 * Generate suggested action for anomaly type
 */
function generateSuggestedAction(anomalyType: AnomalyType): string {
  switch (anomalyType) {
    case AnomalyType.DUPLICATE:
      return 'Review both transactions and delete if duplicate';
    case AnomalyType.UNUSUAL_AMOUNT:
      return 'Verify the amount is correct';
    case AnomalyType.UNUSUAL_TIMING:
      return 'Confirm the transaction date';
    case AnomalyType.UNUSUAL_VENDOR:
      return 'Verify the vendor is legitimate';
    case AnomalyType.MISSING_DATA:
      return 'Add missing information';
    case AnomalyType.SUSPICIOUS_PATTERN:
      return 'Review transaction details';
    default:
      return 'Review transaction';
  }
}

/**
 * Dismiss an anomaly with reason
 *
 * Used for learning to reduce false positives.
 */
export function dismissAnomaly(
  companyId: string,
  userId: string,
  suggestionId: string,
  transactionId: string,
  anomalyType: AnomalyType,
  reason: string
): { success: boolean; error?: string } {
  // Record dismissal for learning
  const dismissal: DismissalRecord = {
    id: `dis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    companyId,
    userId,
    transactionId,
    anomalyType,
    dismissalReason: reason,
    dismissedAt: new Date().toISOString(),
  };

  dismissalHistory.push(dismissal);

  // Keep history bounded
  if (dismissalHistory.length > MAX_DISMISSAL_HISTORY) {
    dismissalHistory.shift();
  }

  // Reject the suggestion
  return rejectSuggestion(suggestionId, userId, `Dismissed: ${reason}`);
}

/**
 * Acknowledge an anomaly (mark as reviewed)
 */
export function acknowledgeAnomaly(
  suggestionId: string,
  acknowledgedBy: string,
  notes?: string
): { success: boolean; error?: string } {
  return approveSuggestion(suggestionId, acknowledgedBy, notes || 'Acknowledged and reviewed');
}

/**
 * Get pending anomaly suggestions for a company
 */
export function getPendingAnomalySuggestions(
  companyId: string,
  userId?: string
): AISuggestion[] {
  const result = querySuggestions({
    company_id: companyId,
    user_id: userId,
    task_type: AITaskType.ANOMALY_DETECT,
    status: SuggestionStatus.PENDING,
  });

  return result.suggestions;
}

/**
 * Get dismissal statistics for a company
 */
export function getDismissalStats(companyId: string): {
  total: number;
  byType: Record<AnomalyType, number>;
  recentReasons: string[];
} {
  const companyDismissals = dismissalHistory.filter((d) => d.companyId === companyId);

  const byType: Record<AnomalyType, number> = {
    [AnomalyType.DUPLICATE]: 0,
    [AnomalyType.UNUSUAL_AMOUNT]: 0,
    [AnomalyType.UNUSUAL_TIMING]: 0,
    [AnomalyType.UNUSUAL_VENDOR]: 0,
    [AnomalyType.MISSING_DATA]: 0,
    [AnomalyType.SUSPICIOUS_PATTERN]: 0,
    [AnomalyType.OTHER]: 0,
  };

  for (const d of companyDismissals) {
    byType[d.anomalyType]++;
  }

  const recentReasons = companyDismissals
    .slice(-5)
    .map((d) => d.dismissalReason);

  return {
    total: companyDismissals.length,
    byType,
    recentReasons,
  };
}

/**
 * Clear dismissal history (for testing)
 */
export function clearDismissalHistory(): void {
  dismissalHistory.length = 0;
}

export default {
  detectAnomalies,
  dismissAnomaly,
  acknowledgeAnomaly,
  getPendingAnomalySuggestions,
  getDismissalStats,
  clearDismissalHistory,
  AnomalyType,
  AnomalySeverity,
};
