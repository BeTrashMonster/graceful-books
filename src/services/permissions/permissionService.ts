/**
 * Permission Service
 *
 * Provides permission enforcement at the data layer with audit trail integration.
 * Works in conjunction with RBAC (rbac.ts) and authorization (authorization.ts).
 *
 * Key features:
 * - Data-layer permission enforcement (not UI-only)
 * - Audit trail integration for all permission checks
 * - Sync operation permission validation
 * - PermissionDeniedError with detailed context
 *
 * @gate 1.4
 */

import type { UserRole, CompanyUser } from '../../types/database.types';
import { checkPermission, type Resource, type Action, type PermissionContext } from '../../utils/rbac';
import { EnhancedAuditChain, hashArgs } from '../audit/EnhancedAuditChain';
import type { AuditEntryInput } from '../../types/audit';

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  role: UserRole;
  permission: string;
  reason?: string;
}

/**
 * Error thrown when permission is denied
 */
export class PermissionDeniedError extends Error {
  public readonly role: UserRole;
  public readonly permission: string;
  public readonly resource: string;
  public readonly action: string;

  constructor(role: UserRole, permission: string, reason?: string) {
    const [resource, action] = permission.split(':');
    const message = reason || `Role '${role}' does not have permission '${permission}'`;
    super(message);
    this.name = 'PermissionDeniedError';
    this.role = role;
    this.permission = permission;
    this.resource = resource;
    this.action = action;
  }
}

/**
 * Request context for permission checks
 */
export interface RequestContext {
  userId: string;
  sessionId: string;
  deviceId?: string;
  companyId: string;
  companyUser: CompanyUser | Pick<CompanyUser, 'role'>;
}

/**
 * Permission Service class
 * Handles permission checks with audit trail integration
 */
export class PermissionService {
  private auditChain: EnhancedAuditChain;
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
    this.auditChain = new EnhancedAuditChain(companyId);
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.auditChain.initialize();
  }

  /**
   * Check if user has permission (does not throw)
   */
  hasPermission(
    context: RequestContext,
    action: Action,
    resource: Resource,
    permContext?: PermissionContext
  ): PermissionCheckResult {
    const { companyUser } = context;
    const permission = `${resource}:${action}`;
    const allowed = checkPermission(companyUser, action, resource, permContext);

    return {
      allowed,
      role: companyUser.role,
      permission,
      reason: allowed ? undefined : `Role '${companyUser.role}' lacks permission '${permission}'`,
    };
  }

  /**
   * Require permission (throws PermissionDeniedError if denied)
   * Also logs to audit trail
   */
  async requirePermission(
    context: RequestContext,
    action: Action,
    resource: Resource,
    resourceId: string,
    args?: unknown,
    permContext?: PermissionContext
  ): Promise<void> {
    const result = this.hasPermission(context, action, resource, permContext);
    const argsHash = args ? await hashArgs(args) : await hashArgs({});

    const auditEntry: AuditEntryInput = {
      timestamp: new Date().toISOString(),
      principal_chain: [context.userId, context.sessionId, context.deviceId].filter(Boolean) as string[],
      action: action as AuditEntryInput['action'],
      resource_type: resource as AuditEntryInput['resource_type'],
      resource_id: resourceId,
      args_hash: argsHash,
      policy_decision: result.allowed ? 'allowed' : 'denied',
      approval_method: 'auto',
      source: 'manual',
      company_id: this.companyId,
    };

    await this.auditChain.addEntry(auditEntry);

    if (!result.allowed) {
      throw new PermissionDeniedError(result.role, result.permission, result.reason);
    }
  }

  /**
   * Validate a sync operation has proper permissions
   */
  async validateSyncOperation(
    operation: {
      author: string;
      authorRole: UserRole;
      action: Action;
      resource: Resource;
      resourceId: string;
      timestamp: string;
      payload?: unknown;
    },
    context: RequestContext
  ): Promise<void> {
    const { authorRole, action, resource, resourceId, payload } = operation;
    const companyUser = { role: authorRole };
    const allowed = checkPermission(companyUser, action, resource);
    const argsHash = payload ? await hashArgs(payload) : await hashArgs({});

    const auditEntry: AuditEntryInput = {
      timestamp: new Date().toISOString(),
      principal_chain: [operation.author, context.sessionId, context.deviceId].filter(Boolean) as string[],
      action: 'sync',
      resource_type: resource as AuditEntryInput['resource_type'],
      resource_id: resourceId,
      args_hash: argsHash,
      policy_decision: allowed ? 'allowed' : 'denied',
      approval_method: 'auto',
      source: 'sync',
      company_id: this.companyId,
    };

    await this.auditChain.addEntry(auditEntry);

    if (!allowed) {
      throw new PermissionDeniedError(
        authorRole,
        `${resource}:${action}`,
        `Sync operation rejected: author role '${authorRole}' lacks permission`
      );
    }
  }

  /**
   * Check if user can escalate to a role
   */
  canAssignRole(
    assigner: RequestContext,
    targetRole: UserRole
  ): boolean {
    const assignerRole = assigner.companyUser.role;

    // Only OWNER and ADMIN can assign roles
    if (assignerRole !== 'OWNER' && assignerRole !== 'ADMIN') {
      return false;
    }

    // ADMIN cannot assign OWNER role
    if (assignerRole === 'ADMIN' && targetRole === 'OWNER') {
      return false;
    }

    return true;
  }

  /**
   * Check if user can modify their own permissions
   * (They cannot - this is self-escalation prevention)
   */
  canModifyOwnPermissions(context: RequestContext, targetUserId: string): boolean {
    // Users cannot modify their own permissions
    return context.userId !== targetUserId;
  }

  /**
   * Get the audit chain for verification
   */
  getAuditChain(): EnhancedAuditChain {
    return this.auditChain;
  }
}

/**
 * Create a permission service instance
 */
export function createPermissionService(companyId: string): PermissionService {
  return new PermissionService(companyId);
}

/**
 * All available permissions for testing
 */
export const ALL_PERMISSIONS: Array<[Action, Resource]> = [
  ['create', 'transaction'],
  ['read', 'transaction'],
  ['update', 'transaction'],
  ['delete', 'transaction'],
  ['post', 'transaction'],
  ['void', 'transaction'],
  ['create', 'account'],
  ['read', 'account'],
  ['update', 'account'],
  ['delete', 'account'],
  ['create', 'contact'],
  ['read', 'contact'],
  ['update', 'contact'],
  ['delete', 'contact'],
  ['create', 'product'],
  ['read', 'product'],
  ['update', 'product'],
  ['delete', 'product'],
  ['create', 'invoice'],
  ['read', 'invoice'],
  ['update', 'invoice'],
  ['delete', 'invoice'],
  ['create', 'bill'],
  ['read', 'bill'],
  ['update', 'bill'],
  ['delete', 'bill'],
  ['read', 'report'],
  ['export', 'report'],
  ['create', 'user'],
  ['read', 'user'],
  ['update', 'user'],
  ['delete', 'user'],
  ['read', 'company'],
  ['update', 'company'],
  ['delete', 'company'],
  ['read', 'settings'],
  ['update', 'settings'],
  ['read', 'audit_log'],
  ['create', 'reconciliation'],
  ['read', 'reconciliation'],
  ['update', 'reconciliation'],
  ['delete', 'reconciliation'],
];

/**
 * All roles for testing
 */
export const ALL_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT', 'BOOKKEEPER', 'VIEWER'];

export default PermissionService;
