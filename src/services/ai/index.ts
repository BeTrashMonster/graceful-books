/**
 * AI Services Module
 *
 * Central export for all AI-related services.
 * Implements the security architecture defined in Phase 3 & 4.
 *
 * Architecture:
 * - CaMeL dual-LLM separation (Planner + Quarantine)
 * - Staging area for human review
 * - Kill switch and monitoring
 * - User consent framework
 *
 * Features:
 * - Categorization (Phase 4.1)
 * - Anomaly Detection (Phase 4.2)
 * - Forecasting (Phase 4.3)
 * - Behavioral Testing (Phase 4.4)
 *
 * @security Phase 3 & 4 - AI Security
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

// Re-export architecture module
export * from './architecture';

// Re-export monitoring module
export * from './monitoring';

// Re-export consent module
export * from './consent';

// Re-export features module
export * from './features';

// Re-export verification module (from parent)
export * from '../verification';

/**
 * AI System Overview
 *
 * Get a comprehensive view of the AI system status.
 */
export function getAISystemOverview(): {
  enabled: boolean;
  architecture: {
    planner: { sessions: number; failures: number };
    quarantine: { sessions: number; failures: number };
    staging: { pending: number; approved: number };
  };
  monitoring: {
    kill_switch_state: string;
    anomalies_recent: number;
    errors_recent: number;
  };
  verification: {
    entries_validated: number;
    entries_blocked: number;
    healthy: boolean;
  };
} {
  // Import from modules
  const { isAIEnabled, getKillSwitchStatus, getAnomalyStats, getLogStats } = require('./monitoring');
  const { getPlannerStats, getQuarantineStats, getStagingStats } = require('./architecture');
  const { getStats: getProofGateStats, isHealthy } = require('../verification');

  const plannerStats = getPlannerStats();
  const quarantineStats = getQuarantineStats();
  const stagingStats = getStagingStats();
  const killStatus = getKillSwitchStatus();
  const anomalyStats = getAnomalyStats(60);
  const logStats = getLogStats(60);
  const proofStats = getProofGateStats();
  const proofHealth = isHealthy();

  return {
    enabled: isAIEnabled(),
    architecture: {
      planner: {
        sessions: plannerStats.total_sessions,
        failures: plannerStats.failed,
      },
      quarantine: {
        sessions: quarantineStats.total_sessions,
        failures: quarantineStats.failed,
      },
      staging: {
        pending: stagingStats.pending,
        approved: stagingStats.approved,
      },
    },
    monitoring: {
      kill_switch_state: killStatus.state,
      anomalies_recent: anomalyStats.in_window,
      errors_recent: logStats.errors_in_window,
    },
    verification: {
      entries_validated: proofStats.total_validations,
      entries_blocked: proofStats.blocked,
      healthy: proofHealth.healthy,
    },
  };
}

export default {
  getAISystemOverview,
};
