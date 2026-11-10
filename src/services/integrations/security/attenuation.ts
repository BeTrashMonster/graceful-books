/**
 * Authority Attenuation Chain
 *
 * Ensures permissions decrease at each integration hop.
 * Based on MVS-R 12: "Each hop should hand on less power than it received."
 *
 * Chain: User (full) → App (reduced) → AI (minimal) → Integration (specific)
 *
 * @security Phase 5.2 - Authority Attenuation Chain
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

/**
 * Permission levels from highest to lowest
 */
export type PermissionLevel = 'full' | 'standard' | 'limited' | 'minimal' | 'none';

/**
 * Permission scope definition
 */
export interface PermissionScope {
  level: PermissionLevel;
  allowed_actions: string[];
  max_amount_usd?: number;
  time_limit_seconds?: number;
}

/**
 * Attenuation result
 */
export interface AttenuationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Permission level ordering (lower index = less power)
 */
const PERMISSION_LEVELS: PermissionLevel[] = ['none', 'minimal', 'limited', 'standard', 'full'];

/**
 * Attenuation chain - defines permissions at each level
 *
 * Key security property: Each level has FEWER permissions than the level above
 */
export const ATTENUATION_CHAIN: Record<string, PermissionScope> = {
  user: {
    level: 'full',
    allowed_actions: ['*'],
  },

  application: {
    level: 'standard',
    allowed_actions: [
      'transaction:read',
      'transaction:create',
      'transaction:update',
      'transaction:delete',
      'transaction:suggest', // For AI suggestions
      'account:read',
      'account:create',
      'account:update',
      'report:read',
      'report:create',
      'settings:read',
      // Cannot: user:manage, key:rotate, admin:*
    ],
  },

  ai_feature: {
    level: 'limited',
    allowed_actions: [
      'transaction:read',
      'transaction:suggest', // NOT transaction:create or transaction:update
      'account:read',
      'report:read',
      // Cannot: transaction:write, settings:*, export:*, admin:*
    ],
  },

  integration: {
    level: 'minimal',
    allowed_actions: [
      'transaction:read_external',
      'account:read_external',
      // NO write actions
      // NO internal data access
    ],
    max_amount_usd: 0, // Cannot initiate any payments
    time_limit_seconds: 900, // 15-minute operations
  },
};

/**
 * Get the index of a permission level (lower = less power)
 */
function getPermissionIndex(level: PermissionLevel): number {
  return PERMISSION_LEVELS.indexOf(level);
}

/**
 * Check if action matches an allowed action pattern
 */
function isActionAllowed(action: string, allowed: string[]): boolean {
  if (allowed.includes('*')) {
    return true;
  }
  if (allowed.includes(action)) {
    return true;
  }

  // Check wildcard patterns like "transaction:*"
  const [resource, operation] = action.split(':');
  if (allowed.includes(`${resource}:*`)) {
    return true;
  }

  return false;
}

/**
 * Validate attenuation from source to target
 *
 * Returns valid if:
 * 1. Target has lower or equal permission level than source
 * 2. All requested actions are allowed at target level
 */
export function validateAttenuation(
  source: string,
  target: string,
  requestedActions: string[]
): AttenuationResult {
  const sourceScope = ATTENUATION_CHAIN[source];
  const targetScope = ATTENUATION_CHAIN[target];

  if (!sourceScope) {
    return {
      valid: false,
      reason: `Unknown source scope: ${source}`,
    };
  }

  if (!targetScope) {
    return {
      valid: false,
      reason: `Unknown target scope: ${target}`,
    };
  }

  // Check permission level - target must have lower or equal level
  const sourceIndex = getPermissionIndex(sourceScope.level);
  const targetIndex = getPermissionIndex(targetScope.level);

  if (targetIndex > sourceIndex) {
    return {
      valid: false,
      reason: `Cannot escalate from ${sourceScope.level} to ${targetScope.level}`,
    };
  }

  // Check that all requested actions are allowed at target level
  for (const action of requestedActions) {
    if (!isActionAllowed(action, targetScope.allowed_actions)) {
      return {
        valid: false,
        reason: `Action "${action}" not allowed at ${target} level`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get the effective permission scope for an actor
 */
export function getScopeForActor(actor: string): PermissionScope {
  return ATTENUATION_CHAIN[actor] || {
    level: 'none',
    allowed_actions: [],
  };
}

/**
 * Check if a specific action is allowed for an actor
 */
export function isActionAllowedForActor(actor: string, action: string): boolean {
  const scope = ATTENUATION_CHAIN[actor];
  if (!scope) {
    return false;
  }
  return isActionAllowed(action, scope.allowed_actions);
}

/**
 * Get maximum allowed amount for an actor
 */
export function getMaxAmountForActor(actor: string): number | undefined {
  return ATTENUATION_CHAIN[actor]?.max_amount_usd;
}

/**
 * Get time limit for an actor's operations
 */
export function getTimeLimitForActor(actor: string): number | undefined {
  return ATTENUATION_CHAIN[actor]?.time_limit_seconds;
}

/**
 * Validate a complete delegation chain
 */
export function validateDelegationChain(
  chain: string[],
  requestedActions: string[]
): AttenuationResult {
  if (chain.length < 2) {
    return {
      valid: false,
      reason: 'Delegation chain must have at least 2 participants',
    };
  }

  // Validate each hop in the chain
  for (let i = 0; i < chain.length - 1; i++) {
    const result = validateAttenuation(chain[i], chain[i + 1], requestedActions);
    if (!result.valid) {
      return {
        valid: false,
        reason: `Invalid hop from ${chain[i]} to ${chain[i + 1]}: ${result.reason}`,
      };
    }
  }

  // Check that final target can perform the actions
  const finalTarget = chain[chain.length - 1];
  const finalScope = ATTENUATION_CHAIN[finalTarget];

  if (!finalScope) {
    return {
      valid: false,
      reason: `Unknown final target: ${finalTarget}`,
    };
  }

  for (const action of requestedActions) {
    if (!isActionAllowed(action, finalScope.allowed_actions)) {
      return {
        valid: false,
        reason: `Final target ${finalTarget} cannot perform action: ${action}`,
      };
    }
  }

  return { valid: true };
}

export default {
  ATTENUATION_CHAIN,
  PERMISSION_LEVELS,
  validateAttenuation,
  validateDelegationChain,
  getScopeForActor,
  isActionAllowedForActor,
  getMaxAmountForActor,
  getTimeLimitForActor,
};
