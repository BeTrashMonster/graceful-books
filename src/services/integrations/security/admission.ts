/**
 * Server Admission Control
 *
 * Validates integrations before allowing them to be used.
 * Implements version pinning, tool validation, and policy enforcement.
 *
 * @security Phase 5.1 - MCP Server Security Framework
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import {
  validateToolDescription,
  hashToolDescription,
  type ToolDescription,
  type ValidationResult,
} from './toolValidator';

import { INTEGRATION_POLICIES } from './mcpPolicy';

/**
 * Integration manifest - describes an external integration
 */
export interface IntegrationManifest {
  server_id: string;
  server_name: string;
  version: string;
  version_hash: string;
  tools: ToolDescription[];
  required_scopes: string[];
  publisher: string;
  publisher_verified: boolean;
  last_audit_date?: string;
  audit_report_url?: string;
}

/**
 * Admission condition applied during admission
 */
export interface AdmissionCondition {
  type: 'scope_reduction' | 'tool_block' | 'rate_limit' | 'manual_approval';
  detail: string;
}

/**
 * Admission result
 */
export interface AdmissionResult {
  admitted: boolean;
  reason?: string;
  conditions?: AdmissionCondition[];
}

/**
 * Record of an admitted integration
 */
export interface AdmissionRecord {
  server_id: string;
  admitted_at: string;
  admitted_by: string;
  pinned_version: string;
  pinned_version_hash: string;
  tool_hashes: Record<string, string>;
  applied_conditions: AdmissionCondition[];
  expires_at?: string; // Force re-review after expiration
}

// In-memory store of admission records
const admissionRecords: Map<string, AdmissionRecord> = new Map();

// Audit log for admission events
interface AdmissionAuditEntry {
  timestamp: string;
  action: 'admit' | 'reject' | 'revoke' | 'validate';
  server_id: string;
  reason?: string;
  actor?: string;
}

const admissionAuditLog: AdmissionAuditEntry[] = [];

/**
 * Log an admission audit event
 */
function logAdmissionEvent(
  action: AdmissionAuditEntry['action'],
  server_id: string,
  reason?: string,
  actor?: string
): void {
  admissionAuditLog.push({
    timestamp: new Date().toISOString(),
    action,
    server_id,
    reason,
    actor,
  });
}

/**
 * Admit an integration after validation
 */
export async function admitIntegration(
  manifest: IntegrationManifest,
  existingAdmission?: AdmissionRecord
): Promise<AdmissionResult> {
  const conditions: AdmissionCondition[] = [];

  // 1. Verify publisher
  if (!manifest.publisher_verified) {
    logAdmissionEvent('reject', manifest.server_id, 'Unverified publisher');
    return {
      admitted: false,
      reason: 'Unverified publisher',
    };
  }

  // 2. Check version against pinned version
  if (existingAdmission) {
    if (manifest.version_hash !== existingAdmission.pinned_version_hash) {
      logAdmissionEvent(
        'reject',
        manifest.server_id,
        'Version changed from pinned version'
      );
      return {
        admitted: false,
        reason: 'Version changed from pinned version. Review required.',
      };
    }
  }

  // 3. Validate all tool descriptions
  for (const tool of manifest.tools) {
    const previousHash = existingAdmission?.tool_hashes[tool.name];
    const toolResult = validateToolDescription(tool, previousHash);

    if (toolResult.recommendation === 'block') {
      logAdmissionEvent(
        'reject',
        manifest.server_id,
        `Tool "${tool.name}" failed validation`
      );
      return {
        admitted: false,
        reason: `Tool "${tool.name}" failed validation`,
      };
    }

    if (toolResult.recommendation === 'review') {
      conditions.push({
        type: 'manual_approval',
        detail: `Tool "${tool.name}" requires manual review`,
      });
    }
  }

  // 4. Apply default policy restrictions
  const policy = INTEGRATION_POLICIES[manifest.server_id];
  if (policy) {
    // Block any tools not in allowed list
    for (const tool of manifest.tools) {
      const permission = policy.allowed_tools?.find(
        (t) => t.tool_name === tool.name
      );
      if (!permission || !permission.allowed) {
        conditions.push({
          type: 'tool_block',
          detail: `Tool "${tool.name}" blocked by policy`,
        });
      }
    }
  }

  // 5. Check scope requirements
  const allowedScopes = policy?.token_scope || [];
  const excessScopes = manifest.required_scopes.filter(
    (s) => !allowedScopes.includes(s) && !s.endsWith(':read') && !s.includes('read')
  );
  if (excessScopes.length > 0) {
    conditions.push({
      type: 'scope_reduction',
      detail: `Excess scopes blocked: ${excessScopes.join(', ')}`,
    });
  }

  // 6. Apply rate limits if not already defined
  if (policy?.rate_limits) {
    conditions.push({
      type: 'rate_limit',
      detail: `Rate limits applied: ${policy.rate_limits.requests_per_minute}/min`,
    });
  }

  // Log successful admission
  logAdmissionEvent('admit', manifest.server_id, undefined, 'system');

  return {
    admitted: true,
    conditions: conditions.length > 0 ? conditions : undefined,
  };
}

/**
 * Create an admission record after successful admission
 */
export function createAdmissionRecord(
  manifest: IntegrationManifest,
  admittedBy: string,
  conditions: AdmissionCondition[],
  expiresInDays?: number
): AdmissionRecord {
  const toolHashes: Record<string, string> = {};
  for (const tool of manifest.tools) {
    toolHashes[tool.name] = hashToolDescription(tool);
  }

  const record: AdmissionRecord = {
    server_id: manifest.server_id,
    admitted_at: new Date().toISOString(),
    admitted_by: admittedBy,
    pinned_version: manifest.version,
    pinned_version_hash: manifest.version_hash,
    tool_hashes: toolHashes,
    applied_conditions: conditions,
  };

  if (expiresInDays) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    record.expires_at = expiresAt.toISOString();
  }

  admissionRecords.set(manifest.server_id, record);
  return record;
}

/**
 * Get admission record for a server
 */
export function getAdmissionRecord(serverId: string): AdmissionRecord | undefined {
  return admissionRecords.get(serverId);
}

/**
 * Check if an admission is still valid
 */
export function isAdmissionValid(serverId: string): boolean {
  const record = admissionRecords.get(serverId);
  if (!record) {
    return false;
  }

  // Check expiration
  if (record.expires_at) {
    const expiresAt = new Date(record.expires_at);
    if (expiresAt < new Date()) {
      return false;
    }
  }

  return true;
}

/**
 * Revoke an admission
 */
export function revokeAdmission(
  serverId: string,
  revokedBy: string,
  reason: string
): boolean {
  if (!admissionRecords.has(serverId)) {
    return false;
  }

  admissionRecords.delete(serverId);
  logAdmissionEvent('revoke', serverId, reason, revokedBy);
  return true;
}

/**
 * Validate an existing admission against a new manifest
 */
export async function revalidateAdmission(
  manifest: IntegrationManifest
): Promise<{
  valid: boolean;
  changes_detected: string[];
  requires_review: boolean;
}> {
  const record = admissionRecords.get(manifest.server_id);
  if (!record) {
    return {
      valid: false,
      changes_detected: ['No existing admission record'],
      requires_review: true,
    };
  }

  const changes: string[] = [];

  // Check version
  if (manifest.version_hash !== record.pinned_version_hash) {
    changes.push(`Version changed: ${record.pinned_version} → ${manifest.version}`);
  }

  // Check tools
  for (const tool of manifest.tools) {
    const currentHash = hashToolDescription(tool);
    const previousHash = record.tool_hashes[tool.name];

    if (!previousHash) {
      changes.push(`New tool added: ${tool.name}`);
    } else if (currentHash !== previousHash) {
      changes.push(`Tool changed: ${tool.name}`);
    }
  }

  // Check for removed tools
  for (const toolName of Object.keys(record.tool_hashes)) {
    if (!manifest.tools.find((t) => t.name === toolName)) {
      changes.push(`Tool removed: ${toolName}`);
    }
  }

  logAdmissionEvent(
    'validate',
    manifest.server_id,
    changes.length > 0 ? `Changes: ${changes.join(', ')}` : 'No changes'
  );

  return {
    valid: changes.length === 0,
    changes_detected: changes,
    requires_review: changes.length > 0,
  };
}

/**
 * Get all admission records
 */
export function getAllAdmissionRecords(): AdmissionRecord[] {
  return Array.from(admissionRecords.values());
}

/**
 * Get admission audit log
 */
export function getAdmissionAuditLog(
  serverId?: string,
  limit?: number
): AdmissionAuditEntry[] {
  let logs = admissionAuditLog;

  if (serverId) {
    logs = logs.filter((entry) => entry.server_id === serverId);
  }

  if (limit) {
    logs = logs.slice(-limit);
  }

  return logs;
}

/**
 * Clear all admission records (for testing)
 */
export function clearAdmissionRecords(): void {
  admissionRecords.clear();
  admissionAuditLog.length = 0;
}

export default {
  admitIntegration,
  createAdmissionRecord,
  getAdmissionRecord,
  isAdmissionValid,
  revokeAdmission,
  revalidateAdmission,
  getAllAdmissionRecords,
  getAdmissionAuditLog,
  clearAdmissionRecords,
};
