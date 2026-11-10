/**
 * CaMeL Architecture Module
 *
 * Exports the dual-LLM separation architecture for secure AI operations.
 *
 * Architecture Overview:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     User Request                                │
 * │                          │                                      │
 * │                          ▼                                      │
 * │              ┌───────────────────────┐                          │
 * │              │     Orchestrator      │                          │
 * │              └───────────────────────┘                          │
 * │                     │         │                                 │
 * │         ┌───────────┘         └───────────┐                     │
 * │         ▼                                 ▼                     │
 * │  ┌─────────────────┐           ┌─────────────────┐              │
 * │  │  Planner LLM    │           │ Quarantine LLM  │              │
 * │  │  • Has tools    │           │ • NO tools      │              │
 * │  │  • No raw data  │───────────│ • Has raw data  │              │
 * │  └─────────────────┘  schema   └─────────────────┘              │
 * │                                        │                        │
 * │                                        ▼                        │
 * │                          ┌─────────────────────────┐            │
 * │                          │     Staging Area        │            │
 * │                          │   (Human Review Queue)  │            │
 * │                          └─────────────────────────┘            │
 * │                                        │                        │
 * │                                  ┌─────┴─────┐                  │
 * │                                  ▼           ▼                  │
 * │                             Approve       Reject                │
 * │                                  │                              │
 * │                                  ▼                              │
 * │                          ┌─────────────────────────┐            │
 * │                          │      Live Data          │            │
 * │                          │   (Via Proof Gate)      │            │
 * │                          └─────────────────────────┘            │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Security Properties:
 * 1. Planner never sees raw user data (only aggregates/metadata)
 * 2. Quarantine never has tool access (can only read and extract)
 * 3. All AI output goes through staging area for human review
 * 4. Approved changes pass through Proof Gate before live data
 *
 * @security Phase 3.2 - CaMeL Architecture Scaffolding
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

// Types
export {
  // Enums
  AITaskType,
  SuggestionStatus,
  // Planner types
  type PlannerContext,
  type PlannerRequest,
  type PlannerResponse,
  type JSONSchemaDefinition,
  // Quarantine types
  type SanitizedTransaction,
  type QuarantineRequest,
  type QuarantineResponse,
  // Staging types
  type AISuggestion,
  type StagingQueryOptions,
  type BatchApprovalRequest,
  type BatchApprovalResult,
  // System types
  type AIKillSwitch,
  type AIHealthStatus,
} from './types';

// Planner (trusted, has tools, no raw data)
export {
  generatePlan,
  getAvailableTaskTypes,
  getTaskSchema,
  getSessionHistory as getPlannerHistory,
  getFailedSessions as getPlannerFailures,
  getPlannerStats,
  clearSessionHistory as clearPlannerHistory,
} from './planner';

// Quarantine (untrusted, no tools, has data)
export {
  processQuarantineRequest,
  getSessionHistory as getQuarantineHistory,
  getFailedSessions as getQuarantineFailures,
  getQuarantineStats,
  clearSessionHistory as clearQuarantineHistory,
} from './quarantine';

// Staging Area (human review queue)
export {
  addSuggestion,
  getSuggestion,
  querySuggestions,
  getPendingCount,
  approveSuggestion,
  rejectSuggestion,
  modifyAndApprove,
  batchApprove,
  batchReject,
  getApprovalHistory,
  cleanupExpired,
  getStats as getStagingStats,
  clearAll as clearStaging,
  deleteSuggestion,
} from './stagingArea';

// Orchestrator (main entry point)
export {
  executeTask,
  getSystemHealth,
  getPendingReviewCount,
  isAIEnabled,
  type OrchestrationRequest,
  type TransactionForProcessing,
  type OrchestrationResult,
} from './orchestrator';

// Default export: orchestrator as main interface
export { default as orchestrator } from './orchestrator';
