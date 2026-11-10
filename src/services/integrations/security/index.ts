/**
 * Integration Security Module
 *
 * Provides security controls for external integrations.
 *
 * @security Phase 5 - Integration Security
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

// MCP Security Policy (5.1)
export {
  INTEGRATION_POLICIES,
  getIntegrationPolicy,
  isToolAllowed,
  isScopeAllowed,
  getRateLimits,
  requiresHumanApproval,
  type MCPSecurityPolicy,
  type ToolPermission,
  type ParameterConstraint,
  type AlertCondition,
} from './mcpPolicy';

// Tool Validator (5.1)
export {
  validateToolDescription,
  validateToolDescriptions,
  detectInjectionPatterns,
  isSuspiciousParameterName,
  hashToolDescription,
  getValidationSummary,
  type ToolDescription,
  type ParameterDescription,
  type ThreatDetection,
  type ValidationResult,
} from './toolValidator';

// Admission Control (5.1)
export {
  admitIntegration,
  createAdmissionRecord,
  getAdmissionRecord,
  isAdmissionValid,
  revokeAdmission,
  revalidateAdmission,
  getAllAdmissionRecords,
  getAdmissionAuditLog,
  clearAdmissionRecords,
  type IntegrationManifest,
  type AdmissionCondition,
  type AdmissionResult,
  type AdmissionRecord,
} from './admission';

// Authority Attenuation (5.2)
export {
  ATTENUATION_CHAIN,
  PERMISSION_LEVELS,
  validateAttenuation,
  validateDelegationChain,
  getScopeForActor,
  isActionAllowedForActor,
  getMaxAmountForActor,
  getTimeLimitForActor,
  type PermissionLevel,
  type PermissionScope,
  type AttenuationResult,
} from './attenuation';

// Delegation Tokens (5.2)
export {
  createDelegationToken,
  validateDelegationToken,
  useToken,
  revokeToken,
  getToken,
  getDelegationAuditLog,
  clearDelegationStore,
  AttenuationViolationError,
  InsufficientScopeError,
  TokenExpiredError,
  InvalidSignatureError,
  type DelegationToken,
  type CreateDelegationParams,
  type TokenValidationResult,
} from './delegation';
