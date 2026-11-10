/**
 * AI Monitoring Module
 *
 * Comprehensive monitoring infrastructure for AI operations.
 * Includes kill switch, activity logging, and anomaly detection.
 *
 * @security Phase 3.3 - AI Monitoring Infrastructure
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

// Kill Switch
export {
  isEnabled as isAIEnabled,
  isDegraded as isAIDegraded,
  isKilled as isAIKilled,
  getStatus as getKillSwitchStatus,
  kill as killAI,
  degrade as degradeAI,
  recover as recoverAI,
  recordOperation,
  checkErrorRate,
  checkConfidenceDrop,
  getEventHistory as getKillSwitchHistory,
  getStats as getKillSwitchStats,
  updateConfig as updateKillSwitchConfig,
  getConfig as getKillSwitchConfig,
  reset as resetKillSwitch,
  KillSwitchState,
  KillTriggerReason,
} from './killSwitch';

// Activity Logger
export {
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
  getStats as getLogStats,
  exportLogs,
  clearLogs,
  LogSeverity,
  LogCategory,
  type AIActivityLog,
  type LogQueryOptions,
} from './activityLogger';

// Anomaly Detector
export {
  analyzeOutput,
  analyzeConfidence,
  analyzeProcessingTime,
  getRecentAnomalies,
  getAnomalyStats,
  updateConfig as updateAnomalyConfig,
  getConfig as getAnomalyConfig,
  reset as resetAnomalyDetector,
  AnomalyType,
  AnomalySeverity,
  type DetectedAnomaly,
} from './anomalyDetector';

/**
 * Get comprehensive AI system health
 */
export function getAISystemHealth(): {
  operational: boolean;
  kill_switch: {
    state: string;
    reason?: string;
  };
  anomalies: {
    recent_count: number;
    critical_count: number;
  };
  logs: {
    errors_last_hour: number;
    requires_review: number;
  };
  issues: string[];
} {
  // Import dynamically to avoid circular dependencies
  const { getStatus } = require('./killSwitch');
  const { getAnomalyStats } = require('./anomalyDetector');
  const { getStats: getLogStats } = require('./activityLogger');

  const killStatus = getStatus();
  const anomalyStats = getAnomalyStats(60);
  const logStats = getLogStats(60);

  const issues: string[] = [];

  // Check kill switch
  if (killStatus.state !== 'active') {
    issues.push(`AI is ${killStatus.state}: ${killStatus.reason || 'Unknown reason'}`);
  }

  // Check anomalies
  if (anomalyStats.critical_count > 0) {
    issues.push(`${anomalyStats.critical_count} critical anomalies detected`);
  }
  if (anomalyStats.in_window > 5) {
    issues.push(`${anomalyStats.in_window} anomalies in last hour`);
  }

  // Check errors
  if (logStats.errors_in_window > 10) {
    issues.push(`${logStats.errors_in_window} errors in last hour`);
  }

  // Check review backlog
  if (logStats.requires_review > 20) {
    issues.push(`${logStats.requires_review} logs require review`);
  }

  return {
    operational: issues.length === 0 && killStatus.state === 'active',
    kill_switch: {
      state: killStatus.state,
      reason: killStatus.reason,
    },
    anomalies: {
      recent_count: anomalyStats.in_window,
      critical_count: anomalyStats.critical_count,
    },
    logs: {
      errors_last_hour: logStats.errors_in_window,
      requires_review: logStats.requires_review,
    },
    issues,
  };
}

// Default export: convenience functions
export default {
  getAISystemHealth,
};
