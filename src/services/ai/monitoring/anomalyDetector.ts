/**
 * AI Anomaly Detector
 *
 * Monitors AI behavior for anomalies that might indicate:
 * - Prompt injection attacks
 * - Unusual AI output patterns
 * - Potential data exfiltration attempts
 * - Model degradation
 *
 * Works with the kill switch to automatically respond to threats.
 *
 * @security Phase 3.3 - AI Monitoring Infrastructure
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import { logAnomaly, LogSeverity } from './activityLogger';
import { degrade, kill, KillTriggerReason, KillSwitchState, getStatus } from './killSwitch';

/**
 * Anomaly types
 */
export enum AnomalyType {
  // Prompt injection indicators
  UNUSUAL_OUTPUT_LENGTH = 'unusual_output_length',
  CONTAINS_INSTRUCTIONS = 'contains_instructions',
  CONTAINS_CODE = 'contains_code',
  REPETITIVE_PATTERNS = 'repetitive_patterns',

  // Data exfiltration indicators
  CONTAINS_PII = 'contains_pii',
  CONTAINS_CREDENTIALS = 'contains_credentials',
  EXTERNAL_URLS = 'external_urls',

  // Model degradation indicators
  LOW_CONFIDENCE_STREAK = 'low_confidence_streak',
  HIGH_ERROR_RATE = 'high_error_rate',
  INCONSISTENT_OUTPUT = 'inconsistent_output',

  // Operational anomalies
  UNUSUAL_REQUEST_VOLUME = 'unusual_request_volume',
  UNUSUAL_PROCESSING_TIME = 'unusual_processing_time',
  SCHEMA_VIOLATION = 'schema_violation',
}

/**
 * Anomaly severity
 */
export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Detected anomaly record
 */
export interface DetectedAnomaly {
  id: string;
  timestamp: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  details: Record<string, unknown>;
  company_id?: string;
  user_id?: string;
  request_id?: string;
  auto_action_taken?: string;
}

/**
 * Anomaly detector configuration
 */
interface AnomalyDetectorConfig {
  // Output length thresholds
  maxOutputLength: number;
  minOutputLength: number;

  // Pattern detection
  maxRepetitionCount: number;
  codePatterns: RegExp[];
  instructionPatterns: RegExp[];

  // PII patterns
  piiPatterns: RegExp[];
  credentialPatterns: RegExp[];
  urlPattern: RegExp;

  // Confidence thresholds
  lowConfidenceThreshold: number;
  lowConfidenceStreakLimit: number;

  // Processing time thresholds
  maxProcessingTimeMs: number;
  minProcessingTimeMs: number;

  // Auto-response thresholds
  criticalAnomalyAutoKill: boolean;
  highAnomalyAutodegrade: boolean;
  anomalyCountForKill: number;
  anomalyWindowMinutes: number;
}

const DEFAULT_CONFIG: AnomalyDetectorConfig = {
  maxOutputLength: 50000,
  minOutputLength: 10,

  maxRepetitionCount: 5,
  codePatterns: [
    /function\s+\w+\s*\(/,
    /import\s+\{.*\}\s+from/,
    /const\s+\w+\s*=/,
    /class\s+\w+\s*\{/,
    /<script[\s>]/i,
    /eval\s*\(/,
    /exec\s*\(/,
  ],
  instructionPatterns: [
    /ignore\s+(previous|all|your)\s+instructions?/i,
    /disregard\s+(everything|all)/i,
    /you\s+are\s+now/i,
    /new\s+instructions?:/i,
    /system\s*prompt/i,
    /reveal\s+(your|the)\s+(prompt|instructions?)/i,
    /what\s+(are|were)\s+your\s+instructions?/i,
  ],

  piiPatterns: [
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/, // SSN
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email
  ],
  credentialPatterns: [
    /password\s*[:=]\s*['"]?\w+/i,
    /api[_-]?key\s*[:=]\s*['"]?\w+/i,
    /secret\s*[:=]\s*['"]?\w+/i,
    /bearer\s+[a-z0-9-_.]+/i,
    /sk-[a-zA-Z0-9]+/, // OpenAI-style key
  ],
  urlPattern: /https?:\/\/[^\s<>'"]+/gi,

  lowConfidenceThreshold: 0.3,
  lowConfidenceStreakLimit: 3,

  maxProcessingTimeMs: 60000,
  minProcessingTimeMs: 10,

  criticalAnomalyAutoKill: true,
  highAnomalyAutodegrade: true,
  anomalyCountForKill: 5,
  anomalyWindowMinutes: 10,
};

// Configuration
let config = { ...DEFAULT_CONFIG };

// Recent anomalies for threshold tracking
const recentAnomalies: DetectedAnomaly[] = [];
const MAX_RECENT_ANOMALIES = 100;

// Low confidence streak tracking per company
const lowConfidenceStreaks: Map<string, number> = new Map();

/**
 * Generate unique anomaly ID
 */
function generateAnomalyId(): string {
  return `anom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Record an anomaly
 */
function recordAnomaly(
  anomaly: Omit<DetectedAnomaly, 'id' | 'timestamp'>
): DetectedAnomaly {
  const fullAnomaly: DetectedAnomaly = {
    ...anomaly,
    id: generateAnomalyId(),
    timestamp: new Date().toISOString(),
  };

  recentAnomalies.push(fullAnomaly);

  // Keep bounded
  if (recentAnomalies.length > MAX_RECENT_ANOMALIES) {
    recentAnomalies.shift();
  }

  // Log the anomaly
  logAnomaly(
    anomaly.type,
    anomaly.description,
    anomaly.details,
    anomaly.company_id,
    anomaly.user_id,
    anomaly.request_id
  );

  // Check if auto-action should be taken
  checkAutoAction(fullAnomaly);

  return fullAnomaly;
}

/**
 * Check if auto-action should be taken based on anomaly
 */
function checkAutoAction(anomaly: DetectedAnomaly): void {
  // Auto-kill on critical anomalies
  if (anomaly.severity === AnomalySeverity.CRITICAL && config.criticalAnomalyAutoKill) {
    if (getStatus().state === KillSwitchState.ACTIVE) {
      kill(
        KillTriggerReason.ANOMALY_DETECTED,
        'system:anomaly-detector',
        `Critical anomaly detected: ${anomaly.type}`
      );
      anomaly.auto_action_taken = 'kill';
    }
    return;
  }

  // Auto-degrade on high anomalies
  if (anomaly.severity === AnomalySeverity.HIGH && config.highAnomalyAutodegrade) {
    if (getStatus().state === KillSwitchState.ACTIVE) {
      degrade(
        KillTriggerReason.ANOMALY_DETECTED,
        'system:anomaly-detector',
        `High severity anomaly: ${anomaly.type}`
      );
      anomaly.auto_action_taken = 'degrade';
    }
    return;
  }

  // Check anomaly count threshold
  const windowStart = Date.now() - config.anomalyWindowMinutes * 60 * 1000;
  const recentCount = recentAnomalies.filter(
    (a) => new Date(a.timestamp).getTime() > windowStart
  ).length;

  if (recentCount >= config.anomalyCountForKill) {
    if (getStatus().state === KillSwitchState.ACTIVE) {
      kill(
        KillTriggerReason.ANOMALY_DETECTED,
        'system:anomaly-detector',
        `${recentCount} anomalies detected in ${config.anomalyWindowMinutes} minutes`
      );
      anomaly.auto_action_taken = 'kill (threshold)';
    }
  }
}

/**
 * Analyze AI output for anomalies
 */
export function analyzeOutput(
  output: string | Record<string, unknown>,
  context: {
    requestId: string;
    companyId?: string;
    userId?: string;
    expectedSchema?: Record<string, unknown>;
  }
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

  // Check output length
  if (outputStr.length > config.maxOutputLength) {
    anomalies.push(
      recordAnomaly({
        type: AnomalyType.UNUSUAL_OUTPUT_LENGTH,
        severity: AnomalySeverity.MEDIUM,
        description: `Output length ${outputStr.length} exceeds maximum ${config.maxOutputLength}`,
        details: { length: outputStr.length, max: config.maxOutputLength },
        company_id: context.companyId,
        user_id: context.userId,
        request_id: context.requestId,
      })
    );
  }

  if (outputStr.length < config.minOutputLength) {
    anomalies.push(
      recordAnomaly({
        type: AnomalyType.UNUSUAL_OUTPUT_LENGTH,
        severity: AnomalySeverity.LOW,
        description: `Output length ${outputStr.length} below minimum ${config.minOutputLength}`,
        details: { length: outputStr.length, min: config.minOutputLength },
        company_id: context.companyId,
        user_id: context.userId,
        request_id: context.requestId,
      })
    );
  }

  // Check for instruction patterns (potential prompt injection leakage)
  for (const pattern of config.instructionPatterns) {
    if (pattern.test(outputStr)) {
      anomalies.push(
        recordAnomaly({
          type: AnomalyType.CONTAINS_INSTRUCTIONS,
          severity: AnomalySeverity.HIGH,
          description: 'Output contains instruction-like patterns',
          details: { pattern: pattern.source },
          company_id: context.companyId,
          user_id: context.userId,
          request_id: context.requestId,
        })
      );
      break; // One is enough
    }
  }

  // Check for code patterns (AI should not output code)
  for (const pattern of config.codePatterns) {
    if (pattern.test(outputStr)) {
      anomalies.push(
        recordAnomaly({
          type: AnomalyType.CONTAINS_CODE,
          severity: AnomalySeverity.HIGH,
          description: 'Output contains code-like patterns',
          details: { pattern: pattern.source },
          company_id: context.companyId,
          user_id: context.userId,
          request_id: context.requestId,
        })
      );
      break;
    }
  }

  // Check for PII patterns
  for (const pattern of config.piiPatterns) {
    if (pattern.test(outputStr)) {
      anomalies.push(
        recordAnomaly({
          type: AnomalyType.CONTAINS_PII,
          severity: AnomalySeverity.CRITICAL,
          description: 'Output contains potential PII',
          details: { pattern: pattern.source },
          company_id: context.companyId,
          user_id: context.userId,
          request_id: context.requestId,
        })
      );
      break;
    }
  }

  // Check for credential patterns
  for (const pattern of config.credentialPatterns) {
    if (pattern.test(outputStr)) {
      anomalies.push(
        recordAnomaly({
          type: AnomalyType.CONTAINS_CREDENTIALS,
          severity: AnomalySeverity.CRITICAL,
          description: 'Output contains potential credentials',
          details: { pattern: pattern.source },
          company_id: context.companyId,
          user_id: context.userId,
          request_id: context.requestId,
        })
      );
      break;
    }
  }

  // Check for external URLs
  const urls = outputStr.match(config.urlPattern);
  if (urls && urls.length > 0) {
    // Filter out expected domains if needed
    const suspiciousUrls = urls.filter((url) => {
      // Allow certain trusted domains
      const trusted = ['localhost', '127.0.0.1', 'gracefulbooks.com'];
      return !trusted.some((domain) => url.includes(domain));
    });

    if (suspiciousUrls.length > 0) {
      anomalies.push(
        recordAnomaly({
          type: AnomalyType.EXTERNAL_URLS,
          severity: AnomalySeverity.MEDIUM,
          description: 'Output contains external URLs',
          details: { url_count: suspiciousUrls.length, sample: suspiciousUrls[0] },
          company_id: context.companyId,
          user_id: context.userId,
          request_id: context.requestId,
        })
      );
    }
  }

  // Check for repetitive patterns
  const repetitionCheck = checkRepetitivePatterns(outputStr);
  if (repetitionCheck.repetitive) {
    anomalies.push(
      recordAnomaly({
        type: AnomalyType.REPETITIVE_PATTERNS,
        severity: AnomalySeverity.MEDIUM,
        description: 'Output contains repetitive patterns',
        details: {
          repeated_phrase: repetitionCheck.phrase,
          count: repetitionCheck.count,
        },
        company_id: context.companyId,
        user_id: context.userId,
        request_id: context.requestId,
      })
    );
  }

  return anomalies;
}

/**
 * Check for repetitive patterns in text
 */
function checkRepetitivePatterns(text: string): {
  repetitive: boolean;
  phrase?: string;
  count?: number;
} {
  // Check for repeated phrases (3+ words repeated 5+ times)
  const words = text.toLowerCase().split(/\s+/);
  const phraseLength = 3;

  if (words.length < phraseLength * config.maxRepetitionCount) {
    return { repetitive: false };
  }

  const phrases = new Map<string, number>();

  for (let i = 0; i <= words.length - phraseLength; i++) {
    const phrase = words.slice(i, i + phraseLength).join(' ');
    phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
  }

  for (const [phrase, count] of phrases) {
    if (count >= config.maxRepetitionCount) {
      return { repetitive: true, phrase, count };
    }
  }

  return { repetitive: false };
}

/**
 * Analyze confidence scores
 */
export function analyzeConfidence(
  confidence: number,
  companyId: string,
  requestId: string
): DetectedAnomaly | null {
  if (confidence < config.lowConfidenceThreshold) {
    // Track streak
    const currentStreak = (lowConfidenceStreaks.get(companyId) || 0) + 1;
    lowConfidenceStreaks.set(companyId, currentStreak);

    if (currentStreak >= config.lowConfidenceStreakLimit) {
      // Reset streak and report
      lowConfidenceStreaks.set(companyId, 0);

      return recordAnomaly({
        type: AnomalyType.LOW_CONFIDENCE_STREAK,
        severity: AnomalySeverity.HIGH,
        description: `${currentStreak} consecutive low-confidence responses`,
        details: {
          streak: currentStreak,
          latest_confidence: confidence,
          threshold: config.lowConfidenceThreshold,
        },
        company_id: companyId,
        request_id: requestId,
      });
    }
  } else {
    // Reset streak on good confidence
    lowConfidenceStreaks.set(companyId, 0);
  }

  return null;
}

/**
 * Analyze processing time
 */
export function analyzeProcessingTime(
  durationMs: number,
  requestId: string,
  companyId?: string
): DetectedAnomaly | null {
  if (durationMs > config.maxProcessingTimeMs) {
    return recordAnomaly({
      type: AnomalyType.UNUSUAL_PROCESSING_TIME,
      severity: AnomalySeverity.MEDIUM,
      description: `Processing time ${durationMs}ms exceeds maximum ${config.maxProcessingTimeMs}ms`,
      details: { duration_ms: durationMs, max_ms: config.maxProcessingTimeMs },
      company_id: companyId,
      request_id: requestId,
    });
  }

  if (durationMs < config.minProcessingTimeMs) {
    return recordAnomaly({
      type: AnomalyType.UNUSUAL_PROCESSING_TIME,
      severity: AnomalySeverity.LOW,
      description: `Processing time ${durationMs}ms below minimum ${config.minProcessingTimeMs}ms`,
      details: { duration_ms: durationMs, min_ms: config.minProcessingTimeMs },
      company_id: companyId,
      request_id: requestId,
    });
  }

  return null;
}

/**
 * Get recent anomalies
 */
export function getRecentAnomalies(
  limit: number = 50,
  companyId?: string
): DetectedAnomaly[] {
  let filtered = [...recentAnomalies];

  if (companyId) {
    filtered = filtered.filter((a) => a.company_id === companyId);
  }

  return filtered.slice(-limit);
}

/**
 * Get anomaly statistics
 */
export function getAnomalyStats(windowMinutes: number = 60): {
  total_anomalies: number;
  by_type: Record<AnomalyType, number>;
  by_severity: Record<AnomalySeverity, number>;
  in_window: number;
  critical_count: number;
} {
  const windowStart = Date.now() - windowMinutes * 60 * 1000;

  const byType: Record<AnomalyType, number> = {
    [AnomalyType.UNUSUAL_OUTPUT_LENGTH]: 0,
    [AnomalyType.CONTAINS_INSTRUCTIONS]: 0,
    [AnomalyType.CONTAINS_CODE]: 0,
    [AnomalyType.REPETITIVE_PATTERNS]: 0,
    [AnomalyType.CONTAINS_PII]: 0,
    [AnomalyType.CONTAINS_CREDENTIALS]: 0,
    [AnomalyType.EXTERNAL_URLS]: 0,
    [AnomalyType.LOW_CONFIDENCE_STREAK]: 0,
    [AnomalyType.HIGH_ERROR_RATE]: 0,
    [AnomalyType.INCONSISTENT_OUTPUT]: 0,
    [AnomalyType.UNUSUAL_REQUEST_VOLUME]: 0,
    [AnomalyType.UNUSUAL_PROCESSING_TIME]: 0,
    [AnomalyType.SCHEMA_VIOLATION]: 0,
  };

  const bySeverity: Record<AnomalySeverity, number> = {
    [AnomalySeverity.LOW]: 0,
    [AnomalySeverity.MEDIUM]: 0,
    [AnomalySeverity.HIGH]: 0,
    [AnomalySeverity.CRITICAL]: 0,
  };

  let inWindow = 0;
  let criticalCount = 0;

  for (const anomaly of recentAnomalies) {
    byType[anomaly.type]++;
    bySeverity[anomaly.severity]++;

    if (new Date(anomaly.timestamp).getTime() > windowStart) {
      inWindow++;
    }

    if (anomaly.severity === AnomalySeverity.CRITICAL) {
      criticalCount++;
    }
  }

  return {
    total_anomalies: recentAnomalies.length,
    by_type: byType,
    by_severity: bySeverity,
    in_window: inWindow,
    critical_count: criticalCount,
  };
}

/**
 * Update configuration
 */
export function updateConfig(newConfig: Partial<AnomalyDetectorConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current configuration
 */
export function getConfig(): AnomalyDetectorConfig {
  return { ...config };
}

/**
 * Reset detector (for testing)
 */
export function reset(): void {
  recentAnomalies.length = 0;
  lowConfidenceStreaks.clear();
  config = { ...DEFAULT_CONFIG };
}

export default {
  analyzeOutput,
  analyzeConfidence,
  analyzeProcessingTime,
  getRecentAnomalies,
  getAnomalyStats,
  updateConfig,
  getConfig,
  reset,
  AnomalyType,
  AnomalySeverity,
};
