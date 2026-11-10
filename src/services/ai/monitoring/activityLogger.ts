/**
 * AI Activity Logger
 *
 * Comprehensive logging for all AI operations.
 * Tracks requests, responses, errors, and anomalies for:
 * - Security audit
 * - Performance monitoring
 * - Incident investigation
 * - Compliance reporting
 *
 * @security Phase 3.3 - AI Monitoring Infrastructure
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import { AITaskType } from '../architecture/types';

/**
 * Log entry severity levels
 */
export enum LogSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Log entry categories
 */
export enum LogCategory {
  REQUEST = 'request',
  RESPONSE = 'response',
  ERROR = 'error',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  ANOMALY = 'anomaly',
  APPROVAL = 'approval',
  SYSTEM = 'system',
}

/**
 * AI activity log entry
 */
export interface AIActivityLog {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  category: LogCategory;

  // Context
  company_id?: string;
  user_id?: string;
  request_id?: string;
  task_type?: AITaskType;

  // Event details
  event: string;
  message: string;
  details?: Record<string, unknown>;

  // Performance
  duration_ms?: number;

  // Security context
  ip_address?: string;
  user_agent?: string;

  // Flags
  requires_review: boolean;
  reviewed_at?: string;
  reviewed_by?: string;
}

/**
 * Log query options
 */
export interface LogQueryOptions {
  company_id?: string;
  user_id?: string;
  request_id?: string;
  severity?: LogSeverity | LogSeverity[];
  category?: LogCategory | LogCategory[];
  start_time?: string;
  end_time?: string;
  requires_review?: boolean;
  limit?: number;
  offset?: number;
}

// In-memory log storage (in production, persist to database)
const logs: AIActivityLog[] = [];
const MAX_LOGS = 10000;

/**
 * Generate unique log ID
 */
function generateLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Core log function
 */
function log(entry: Omit<AIActivityLog, 'id' | 'timestamp'>): AIActivityLog {
  const fullEntry: AIActivityLog = {
    ...entry,
    id: generateLogId(),
    timestamp: new Date().toISOString(),
  };

  logs.push(fullEntry);

  // Keep logs bounded
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Console output for critical and error
  if (entry.severity === LogSeverity.CRITICAL) {
    console.error(`[AI:CRITICAL] ${entry.event}: ${entry.message}`);
  } else if (entry.severity === LogSeverity.ERROR) {
    console.error(`[AI:ERROR] ${entry.event}: ${entry.message}`);
  } else if (entry.severity === LogSeverity.WARN) {
    console.warn(`[AI:WARN] ${entry.event}: ${entry.message}`);
  }

  return fullEntry;
}

/**
 * Log an AI request
 */
export function logRequest(
  taskType: AITaskType,
  companyId: string,
  userId: string,
  requestId: string,
  transactionCount: number,
  ipAddress?: string
): AIActivityLog {
  return log({
    severity: LogSeverity.INFO,
    category: LogCategory.REQUEST,
    company_id: companyId,
    user_id: userId,
    request_id: requestId,
    task_type: taskType,
    event: 'ai_request',
    message: `AI ${taskType} request initiated`,
    details: {
      transaction_count: transactionCount,
    },
    ip_address: ipAddress,
    requires_review: false,
  });
}

/**
 * Log an AI response
 */
export function logResponse(
  requestId: string,
  success: boolean,
  confidence: number,
  durationMs: number,
  suggestionId?: string
): AIActivityLog {
  const severity = success ? LogSeverity.INFO : LogSeverity.WARN;
  const requiresReview = !success || confidence < 0.5;

  return log({
    severity,
    category: LogCategory.RESPONSE,
    request_id: requestId,
    event: success ? 'ai_response_success' : 'ai_response_failure',
    message: success
      ? `AI request completed with ${(confidence * 100).toFixed(1)}% confidence`
      : 'AI request failed',
    details: {
      success,
      confidence,
      suggestion_id: suggestionId,
    },
    duration_ms: durationMs,
    requires_review: requiresReview,
  });
}

/**
 * Log an error
 */
export function logError(
  requestId: string | undefined,
  error: Error | string,
  companyId?: string,
  userId?: string
): AIActivityLog {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  return log({
    severity: LogSeverity.ERROR,
    category: LogCategory.ERROR,
    company_id: companyId,
    user_id: userId,
    request_id: requestId,
    event: 'ai_error',
    message: errorMessage,
    details: {
      stack: errorStack,
    },
    requires_review: true,
  });
}

/**
 * Log a security event
 */
export function logSecurityEvent(
  event: string,
  message: string,
  severity: LogSeverity = LogSeverity.WARN,
  details?: Record<string, unknown>,
  companyId?: string,
  userId?: string,
  ipAddress?: string
): AIActivityLog {
  return log({
    severity,
    category: LogCategory.SECURITY,
    company_id: companyId,
    user_id: userId,
    event,
    message,
    details,
    ip_address: ipAddress,
    requires_review: severity === LogSeverity.CRITICAL || severity === LogSeverity.ERROR,
  });
}

/**
 * Log an anomaly detection
 */
export function logAnomaly(
  anomalyType: string,
  description: string,
  details: Record<string, unknown>,
  companyId?: string,
  userId?: string,
  requestId?: string
): AIActivityLog {
  return log({
    severity: LogSeverity.WARN,
    category: LogCategory.ANOMALY,
    company_id: companyId,
    user_id: userId,
    request_id: requestId,
    event: `anomaly_${anomalyType}`,
    message: description,
    details,
    requires_review: true,
  });
}

/**
 * Log an approval action
 */
export function logApproval(
  action: 'approved' | 'rejected' | 'modified',
  suggestionId: string,
  approvedBy: string,
  companyId: string,
  notes?: string
): AIActivityLog {
  return log({
    severity: LogSeverity.INFO,
    category: LogCategory.APPROVAL,
    company_id: companyId,
    user_id: approvedBy,
    event: `suggestion_${action}`,
    message: `Suggestion ${suggestionId} ${action} by ${approvedBy}`,
    details: {
      suggestion_id: suggestionId,
      notes,
    },
    requires_review: false,
  });
}

/**
 * Log a system event
 */
export function logSystemEvent(
  event: string,
  message: string,
  severity: LogSeverity = LogSeverity.INFO,
  details?: Record<string, unknown>
): AIActivityLog {
  return log({
    severity,
    category: LogCategory.SYSTEM,
    event,
    message,
    details,
    requires_review: severity === LogSeverity.CRITICAL || severity === LogSeverity.ERROR,
  });
}

/**
 * Query logs with filters
 */
export function queryLogs(options: LogQueryOptions): {
  logs: AIActivityLog[];
  total: number;
} {
  let filtered = [...logs];

  // Apply filters
  if (options.company_id) {
    filtered = filtered.filter((l) => l.company_id === options.company_id);
  }

  if (options.user_id) {
    filtered = filtered.filter((l) => l.user_id === options.user_id);
  }

  if (options.request_id) {
    filtered = filtered.filter((l) => l.request_id === options.request_id);
  }

  if (options.severity) {
    const severities = Array.isArray(options.severity)
      ? options.severity
      : [options.severity];
    filtered = filtered.filter((l) => severities.includes(l.severity));
  }

  if (options.category) {
    const categories = Array.isArray(options.category)
      ? options.category
      : [options.category];
    filtered = filtered.filter((l) => categories.includes(l.category));
  }

  if (options.start_time) {
    filtered = filtered.filter((l) => l.timestamp >= options.start_time!);
  }

  if (options.end_time) {
    filtered = filtered.filter((l) => l.timestamp <= options.end_time!);
  }

  if (options.requires_review !== undefined) {
    filtered = filtered.filter((l) => l.requires_review === options.requires_review);
  }

  // Sort by timestamp descending
  filtered.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const total = filtered.length;

  // Apply pagination
  const offset = options.offset || 0;
  const limit = options.limit || 100;
  filtered = filtered.slice(offset, offset + limit);

  return { logs: filtered, total };
}

/**
 * Get logs requiring review
 */
export function getLogsRequiringReview(limit: number = 50): AIActivityLog[] {
  return queryLogs({
    requires_review: true,
    limit,
  }).logs;
}

/**
 * Mark log as reviewed
 */
export function markReviewed(logId: string, reviewedBy: string): boolean {
  const logEntry = logs.find((l) => l.id === logId);
  if (!logEntry) return false;

  logEntry.reviewed_at = new Date().toISOString();
  logEntry.reviewed_by = reviewedBy;
  logEntry.requires_review = false;

  return true;
}

/**
 * Get log statistics
 */
export function getStats(windowMinutes: number = 60): {
  total_logs: number;
  by_severity: Record<LogSeverity, number>;
  by_category: Record<LogCategory, number>;
  errors_in_window: number;
  requires_review: number;
  average_duration_ms: number;
} {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const bySeverity: Record<LogSeverity, number> = {
    [LogSeverity.DEBUG]: 0,
    [LogSeverity.INFO]: 0,
    [LogSeverity.WARN]: 0,
    [LogSeverity.ERROR]: 0,
    [LogSeverity.CRITICAL]: 0,
  };

  const byCategory: Record<LogCategory, number> = {
    [LogCategory.REQUEST]: 0,
    [LogCategory.RESPONSE]: 0,
    [LogCategory.ERROR]: 0,
    [LogCategory.SECURITY]: 0,
    [LogCategory.PERFORMANCE]: 0,
    [LogCategory.ANOMALY]: 0,
    [LogCategory.APPROVAL]: 0,
    [LogCategory.SYSTEM]: 0,
  };

  let errorsInWindow = 0;
  let requiresReview = 0;
  let totalDuration = 0;
  let durationCount = 0;

  for (const log of logs) {
    bySeverity[log.severity]++;
    byCategory[log.category]++;

    if (log.requires_review) requiresReview++;

    if (log.timestamp >= windowStart) {
      if (log.severity === LogSeverity.ERROR || log.severity === LogSeverity.CRITICAL) {
        errorsInWindow++;
      }
    }

    if (log.duration_ms !== undefined) {
      totalDuration += log.duration_ms;
      durationCount++;
    }
  }

  return {
    total_logs: logs.length,
    by_severity: bySeverity,
    by_category: byCategory,
    errors_in_window: errorsInWindow,
    requires_review: requiresReview,
    average_duration_ms: durationCount > 0 ? totalDuration / durationCount : 0,
  };
}

/**
 * Export logs for compliance/audit
 */
export function exportLogs(options: LogQueryOptions): string {
  const result = queryLogs({ ...options, limit: MAX_LOGS });

  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      total_logs: result.total,
      logs: result.logs,
    },
    null,
    2
  );
}

/**
 * Clear logs (for testing)
 */
export function clearLogs(): void {
  logs.length = 0;
}

export default {
  logRequest,
  logResponse,
  logError,
  logSecurityEvent,
  logAnomaly,
  logApproval,
  logSystemEvent,
  queryLogs,
  getLogsRequiringReview,
  markReviewed,
  getStats,
  exportLogs,
  clearLogs,
  LogSeverity,
  LogCategory,
};
