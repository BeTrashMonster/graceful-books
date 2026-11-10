/**
 * MCP (Model Context Protocol) Security Policy
 *
 * Governs all external integration security.
 * Based on MVS-R 12: "Each hop should hand on less power than it received."
 *
 * @security Phase 5.1 - MCP Server Security Framework
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

/**
 * Tool permission definition
 */
export interface ToolPermission {
  tool_name: string;
  allowed: boolean;
  max_calls_per_day?: number;
  allowed_parameters?: Record<string, ParameterConstraint>;
}

/**
 * Parameter constraint types
 */
export interface ParameterConstraint {
  type: 'exact' | 'range' | 'pattern' | 'enum';
  value: unknown;
}

/**
 * Alert condition types
 */
export interface AlertCondition {
  type: 'rate_exceeded' | 'unusual_pattern' | 'error_spike' | 'auth_failure';
  threshold: number;
}

/**
 * MCP Security Policy definition
 */
export interface MCPSecurityPolicy {
  server_id: string;
  server_name: string;
  version: string;
  version_hash: string; // SHA-256 of pinned version

  // Tool permissions
  allowed_tools: ToolPermission[];
  blocked_tools: string[];

  // Token configuration
  token_scope: string[];
  max_token_lifetime_seconds: number;
  refresh_allowed: boolean;

  // Human-in-the-loop
  requires_human_approval: string[]; // Tool names requiring approval
  approval_threshold_usd?: number; // Amount threshold for approval

  // Rate limiting
  rate_limits: {
    requests_per_minute: number;
    requests_per_hour: number;
    requests_per_day: number;
  };

  // Monitoring
  audit_level: 'minimal' | 'standard' | 'verbose';
  alert_on: AlertCondition[];
}

/**
 * Pre-defined policies for common integrations
 *
 * Key principle: Read-only by default, all write operations blocked
 */
export const INTEGRATION_POLICIES: Record<string, Partial<MCPSecurityPolicy>> = {
  stripe: {
    allowed_tools: [
      { tool_name: 'list_transactions', allowed: true, max_calls_per_day: 1000 },
      { tool_name: 'get_transaction', allowed: true, max_calls_per_day: 5000 },
      { tool_name: 'list_customers', allowed: true, max_calls_per_day: 500 },
      { tool_name: 'get_customer', allowed: true, max_calls_per_day: 1000 },
      { tool_name: 'list_invoices', allowed: true, max_calls_per_day: 500 },
      { tool_name: 'get_invoice', allowed: true, max_calls_per_day: 1000 },
      // WRITE OPERATIONS - BLOCKED
      { tool_name: 'create_refund', allowed: false }, // NEVER
      { tool_name: 'create_charge', allowed: false }, // NEVER
      { tool_name: 'create_payment_intent', allowed: false }, // NEVER
      { tool_name: 'update_customer', allowed: false },
      { tool_name: 'delete_customer', allowed: false },
    ],
    blocked_tools: [
      'create_refund',
      'create_charge',
      'create_payment_intent',
      'update_subscription',
      'cancel_subscription',
      'create_payout',
      'update_account',
    ],
    requires_human_approval: ['*'], // All Stripe actions need approval
    approval_threshold_usd: 0, // No automated payments allowed
    token_scope: ['read_only'],
    max_token_lifetime_seconds: 3600, // 1 hour
    refresh_allowed: true,
    rate_limits: {
      requests_per_minute: 50,
      requests_per_hour: 500,
      requests_per_day: 5000,
    },
    audit_level: 'verbose',
    alert_on: [
      { type: 'auth_failure', threshold: 3 },
      { type: 'rate_exceeded', threshold: 1 },
    ],
  },

  plaid: {
    allowed_tools: [
      { tool_name: 'get_transactions', allowed: true, max_calls_per_day: 500 },
      { tool_name: 'get_accounts', allowed: true, max_calls_per_day: 200 },
      { tool_name: 'get_balance', allowed: true, max_calls_per_day: 500 },
      { tool_name: 'get_institution', allowed: true, max_calls_per_day: 100 },
      // All write operations blocked
      { tool_name: 'create_transfer', allowed: false },
      { tool_name: 'create_payment', allowed: false },
    ],
    blocked_tools: [
      'create_transfer',
      'create_payment',
      'create_processor_token',
      'create_link_token', // Must be initiated by user
    ],
    token_scope: ['transactions:read', 'accounts:read', 'balance:read'], // Read only
    max_token_lifetime_seconds: 900, // 15 minutes
    refresh_allowed: true,
    rate_limits: {
      requests_per_minute: 30,
      requests_per_hour: 300,
      requests_per_day: 3000,
    },
    audit_level: 'standard',
    alert_on: [
      { type: 'auth_failure', threshold: 3 },
      { type: 'unusual_pattern', threshold: 1 },
    ],
  },

  shopify: {
    allowed_tools: [
      { tool_name: 'list_orders', allowed: true, max_calls_per_day: 1000 },
      { tool_name: 'get_order', allowed: true, max_calls_per_day: 2000 },
      { tool_name: 'list_products', allowed: true, max_calls_per_day: 500 },
      { tool_name: 'get_product', allowed: true, max_calls_per_day: 1000 },
      { tool_name: 'list_customers', allowed: true, max_calls_per_day: 500 },
      { tool_name: 'get_customer', allowed: true, max_calls_per_day: 1000 },
      // Write operations blocked
      { tool_name: 'update_order', allowed: false },
      { tool_name: 'cancel_order', allowed: false },
      { tool_name: 'create_refund', allowed: false },
    ],
    blocked_tools: [
      'update_order',
      'cancel_order',
      'create_refund',
      'delete_product',
      'update_inventory',
      'create_fulfillment',
    ],
    token_scope: ['read_orders', 'read_products', 'read_customers'],
    max_token_lifetime_seconds: 1800, // 30 minutes
    refresh_allowed: true,
    rate_limits: {
      requests_per_minute: 40,
      requests_per_hour: 400,
      requests_per_day: 4000,
    },
    audit_level: 'standard',
  },

  quickbooks: {
    allowed_tools: [
      { tool_name: 'query_transactions', allowed: true },
      { tool_name: 'get_account', allowed: true },
      { tool_name: 'list_accounts', allowed: true },
      { tool_name: 'get_vendor', allowed: true },
      { tool_name: 'get_customer', allowed: true },
      // All write operations blocked
      { tool_name: 'create_invoice', allowed: false },
      { tool_name: 'create_payment', allowed: false },
      { tool_name: 'update_transaction', allowed: false },
    ],
    blocked_tools: [
      'create_invoice',
      'create_payment',
      'create_bill',
      'update_transaction',
      'void_transaction',
      'delete_transaction',
    ],
    token_scope: ['com.intuit.quickbooks.accounting.readonly'],
    max_token_lifetime_seconds: 3600,
    refresh_allowed: true,
    audit_level: 'standard',
  },

  square: {
    allowed_tools: [
      { tool_name: 'list_payments', allowed: true },
      { tool_name: 'get_payment', allowed: true },
      { tool_name: 'list_orders', allowed: true },
      { tool_name: 'get_order', allowed: true },
      { tool_name: 'list_customers', allowed: true },
      // Write operations blocked
      { tool_name: 'create_payment', allowed: false },
      { tool_name: 'refund_payment', allowed: false },
    ],
    blocked_tools: [
      'create_payment',
      'refund_payment',
      'cancel_payment',
      'update_order',
      'cancel_order',
    ],
    token_scope: ['PAYMENTS_READ', 'ORDERS_READ', 'CUSTOMERS_READ'],
    max_token_lifetime_seconds: 1800,
    refresh_allowed: true,
    audit_level: 'standard',
  },
};

/**
 * Get policy for a specific integration
 */
export function getIntegrationPolicy(serverId: string): Partial<MCPSecurityPolicy> | undefined {
  return INTEGRATION_POLICIES[serverId];
}

/**
 * Check if a tool is allowed for an integration
 */
export function isToolAllowed(serverId: string, toolName: string): boolean {
  const policy = INTEGRATION_POLICIES[serverId];
  if (!policy) {
    return false; // Unknown integrations are blocked by default
  }

  // Check blocked list first
  if (policy.blocked_tools?.includes(toolName)) {
    return false;
  }

  // Check allowed tools
  const toolPermission = policy.allowed_tools?.find((t) => t.tool_name === toolName);
  return toolPermission?.allowed ?? false;
}

/**
 * Check if a scope is allowed for an integration
 */
export function isScopeAllowed(serverId: string, scope: string): boolean {
  const policy = INTEGRATION_POLICIES[serverId];
  if (!policy?.token_scope) {
    return false;
  }

  // Allow if scope matches or is a read-only subset
  return (
    policy.token_scope.includes(scope) ||
    scope.endsWith(':read') ||
    scope.includes('read')
  );
}

/**
 * Get rate limits for an integration
 */
export function getRateLimits(serverId: string): MCPSecurityPolicy['rate_limits'] | undefined {
  return INTEGRATION_POLICIES[serverId]?.rate_limits;
}

/**
 * Check if human approval is required for a tool
 */
export function requiresHumanApproval(serverId: string, toolName: string): boolean {
  const policy = INTEGRATION_POLICIES[serverId];
  if (!policy?.requires_human_approval) {
    return true; // Default to requiring approval
  }

  if (policy.requires_human_approval.includes('*')) {
    return true;
  }

  return policy.requires_human_approval.includes(toolName);
}

export default {
  INTEGRATION_POLICIES,
  getIntegrationPolicy,
  isToolAllowed,
  isScopeAllowed,
  getRateLimits,
  requiresHumanApproval,
};
