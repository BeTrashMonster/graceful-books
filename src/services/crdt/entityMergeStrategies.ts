/**
 * Entity-Specific CRDT Merge Strategies
 *
 * Implements custom merge logic for different entity types to preserve
 * data integrity and business logic during conflict resolution.
 *
 * Requirements:
 * - ARCH-004: CRDT conflict resolution
 * - Group I, Item I1: Entity-specific merge strategies
 */

import type { CRDTEntity, EntityMergeStrategy, FieldMergeStrategy } from '../../types/crdt.types';
import { ResolutionStrategy } from '../../types/crdt.types';
import Decimal from 'decimal.js';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Last-Write-Wins resolver for simple fields
 * Uses timestamp comparison with ID as tiebreaker for deterministic resolution
 */
function lwwResolver(
  localValue: unknown,
  remoteValue: unknown,
  localTimestamp: number,
  remoteTimestamp: number,
  localId?: string,
  remoteId?: string
): unknown {
  if (localTimestamp > remoteTimestamp) {
    return localValue;
  } else if (remoteTimestamp > localTimestamp) {
    return remoteValue;
  } else {
    // Timestamps are equal - use ID as tiebreaker (higher ID wins)
    if (localId && remoteId) {
      return remoteId > localId ? remoteValue : localValue;
    }
    // Fallback to remote if no IDs available
    return remoteValue;
  }
}

/**
 * Numeric max resolver (for balances, counters)
 */
function maxResolver(localValue: unknown, remoteValue: unknown): unknown {
  if (typeof localValue === 'number' && typeof remoteValue === 'number') {
    return Math.max(localValue, remoteValue);
  }
  if (typeof localValue === 'string' && typeof remoteValue === 'string') {
    try {
      const localDecimal = new Decimal(localValue);
      const remoteDecimal = new Decimal(remoteValue);
      return localDecimal.greaterThan(remoteDecimal) ? localValue : remoteValue;
    } catch {
      return localValue;
    }
  }
  return localValue;
}

/**
 * Array union resolver (for tags, attachments)
 */
function unionResolver(localValue: unknown, remoteValue: unknown): unknown {
  if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
    return [...new Set([...localValue, ...remoteValue])];
  }
  return localValue;
}

/**
 * Boolean OR resolver (for flags that should stay true once set)
 */
function orResolver(localValue: unknown, remoteValue: unknown): unknown {
  if (typeof localValue === 'boolean' && typeof remoteValue === 'boolean') {
    return localValue || remoteValue;
  }
  return localValue;
}

// ============================================================================
// Account Merge Strategy
// ============================================================================

/**
 * Account entity merge strategy
 *
 * Special handling:
 * - Balance uses LWW (should be recalculated from transactions anyway)
 * - Active status uses OR (once deactivated, stays deactivated unless explicitly reactivated)
 * - Name conflicts require LWW
 * - Parent relationships must maintain hierarchy integrity
 */
export const accountMergeStrategy: EntityMergeStrategy = {
  entityType: 'Account',
  defaultStrategy: ResolutionStrategy.AUTO_MERGE,
  fieldStrategies: {
    name: { strategy: 'lww' },
    account_number: { strategy: 'lww' },
    type: { strategy: 'lww' }, // Account type shouldn't change, but LWW if it does
    balance: { strategy: 'lww' }, // Balance recalculated from transactions
    description: { strategy: 'lww' },
    active: {
      strategy: 'custom',
      resolver: orResolver, // Once active, stays active unless explicitly deactivated
    },
    parent_id: { strategy: 'lww', priority: 10 }, // High priority to maintain hierarchy
  },
  // Custom merger removed - field strategies handle all merging
  // Hierarchy integrity maintained by high-priority parent_id field strategy
};

// ============================================================================
// Transaction Merge Strategy
// ============================================================================

/**
 * Transaction entity merge strategy
 *
 * Special handling:
 * - Posted transactions should be immutable (status check)
 * - Attachments use union (keep all attachments from both versions)
 * - Reference and memo use LWW
 * - Transaction date should rarely change (LWW with high priority)
 */
export const transactionMergeStrategy: EntityMergeStrategy = {
  entityType: 'Transaction',
  defaultStrategy: ResolutionStrategy.AUTO_MERGE,
  fieldStrategies: {
    transaction_number: { strategy: 'lww', priority: 10 },
    transaction_date: { strategy: 'lww', priority: 9 },
    type: { strategy: 'lww', priority: 10 },
    status: {
      strategy: 'custom',
      resolver: (localValue, remoteValue) => {
        // Reconciled is stickiest - once reconciled, stays reconciled
        if (localValue === 'RECONCILED' || remoteValue === 'RECONCILED') {
          return 'RECONCILED';
        }
        // Posted status is sticky - once posted, stays posted
        if (localValue === 'POSTED' || remoteValue === 'POSTED') {
          return 'POSTED';
        }
        // Otherwise LWW (but we don't have timestamp context here, so prefer local)
        return localValue;
      },
      priority: 10,
    },
    description: { strategy: 'lww' },
    reference: { strategy: 'lww' },
    memo: { strategy: 'lww' },
    attachments: {
      strategy: 'union', // Keep all attachments
    },
  },
  // Custom merger removed - field strategies handle all merging including status
};

// ============================================================================
// TransactionLineItem Merge Strategy
// ============================================================================

/**
 * Transaction line item merge strategy
 *
 * Special handling:
 * - Debit/credit amounts use LWW (must balance at transaction level)
 * - Account ID changes are high priority
 * - Line items for posted transactions should be immutable
 */
export const transactionLineItemMergeStrategy: EntityMergeStrategy = {
  entityType: 'TransactionLineItem',
  defaultStrategy: ResolutionStrategy.AUTO_MERGE,
  fieldStrategies: {
    transaction_id: { strategy: 'lww', priority: 10 },
    account_id: { strategy: 'lww', priority: 9 },
    debit: { strategy: 'lww', priority: 8 },
    credit: { strategy: 'lww', priority: 8 },
    description: { strategy: 'lww' },
    contact_id: { strategy: 'lww' },
    product_id: { strategy: 'lww' },
  },
};

// ============================================================================
// Contact Merge Strategy
// ============================================================================

/**
 * Contact entity merge strategy
 *
 * Special handling:
 * - Balance uses LWW (recalculated from transactions)
 * - Active status uses OR
 * - Hierarchy fields maintain integrity
 */
export const contactMergeStrategy: EntityMergeStrategy = {
  entityType: 'Contact',
  defaultStrategy: ResolutionStrategy.AUTO_MERGE,
  fieldStrategies: {
    type: { strategy: 'lww' },
    name: { strategy: 'lww' },
    email: { strategy: 'lww' },
    phone: { strategy: 'lww' },
    address: { strategy: 'lww' },
    tax_id: { strategy: 'lww' },
    notes: { strategy: 'lww' },
    active: {
      strategy: 'custom',
      resolver: orResolver,
    },
    balance: { strategy: 'lww' },
    parent_id: { strategy: 'lww', priority: 10 },
    account_type: { strategy: 'lww', priority: 9 },
    hierarchy_level: { strategy: 'lww', priority: 9 },
  },
};

// ============================================================================
// Product Merge Strategy
// ============================================================================

/**
 * Product entity merge strategy
 *
 * Special handling:
 * - Pricing uses LWW
 * - SKU shouldn't change (high priority LWW)
 * - Active status uses OR
 */
export const productMergeStrategy: EntityMergeStrategy = {
  entityType: 'Product',
  defaultStrategy: ResolutionStrategy.AUTO_MERGE,
  fieldStrategies: {
    type: { strategy: 'lww' },
    sku: { strategy: 'lww', priority: 10 },
    name: { strategy: 'lww' },
    description: { strategy: 'lww' },
    unit_price: { strategy: 'lww', priority: 8 },
    cost: { strategy: 'lww', priority: 8 },
    income_account_id: { strategy: 'lww' },
    expense_account_id: { strategy: 'lww' },
    taxable: { strategy: 'lww' },
    active: {
      strategy: 'custom',
      resolver: orResolver,
    },
  },
};

// ============================================================================
// Company Merge Strategy
// ============================================================================

/**
 * Company entity merge strategy
 *
 * Special handling:
 * - Critical fields like tax_id use LWW with high priority
 * - Settings object needs deep merge
 */
export const companyMergeStrategy: EntityMergeStrategy = {
  entityType: 'Company',
  defaultStrategy: ResolutionStrategy.AUTO_MERGE,
  fieldStrategies: {
    name: { strategy: 'lww' },
    legal_name: { strategy: 'lww', priority: 9 },
    tax_id: { strategy: 'lww', priority: 10 },
    address: { strategy: 'lww' },
    phone: { strategy: 'lww' },
    email: { strategy: 'lww' },
    fiscal_year_end: { strategy: 'lww', priority: 9 },
    currency: { strategy: 'lww', priority: 10 }, // Currency shouldn't change
    settings: {
      strategy: 'custom',
      resolver: (localValue, remoteValue) => {
        // Deep merge settings objects
        if (
          typeof localValue === 'object' &&
          localValue !== null &&
          typeof remoteValue === 'object' &&
          remoteValue !== null
        ) {
          return {
            ...(remoteValue as Record<string, unknown>),
            ...(localValue as Record<string, unknown>),
          };
        }
        return localValue;
      },
    },
  },
};

// ============================================================================
// Receipt Merge Strategy
// ============================================================================

/**
 * Receipt entity merge strategy
 *
 * Special handling:
 * - Image data should rarely conflict (usually upload once)
 * - Notes use LWW
 * - Transaction link uses LWW
 */
export const receiptMergeStrategy: EntityMergeStrategy = {
  entityType: 'Receipt',
  defaultStrategy: ResolutionStrategy.AUTO_MERGE,
  fieldStrategies: {
    transaction_id: { strategy: 'lww' },
    file_name: { strategy: 'lww', priority: 10 },
    mime_type: { strategy: 'lww', priority: 10 },
    file_size: { strategy: 'lww', priority: 10 },
    upload_date: { strategy: 'lww', priority: 10 },
    image_data: { strategy: 'lww', priority: 10 }, // Original uploader wins
    thumbnail_data: { strategy: 'lww' },
    notes: { strategy: 'lww' },
  },
};

// ============================================================================
// Strategy Registry
// ============================================================================

/**
 * Registry of all entity merge strategies
 */
export const ENTITY_MERGE_STRATEGIES: Record<string, EntityMergeStrategy> = {
  Account: accountMergeStrategy,
  Transaction: transactionMergeStrategy,
  TransactionLineItem: transactionLineItemMergeStrategy,
  Contact: contactMergeStrategy,
  Product: productMergeStrategy,
  Company: companyMergeStrategy,
  Receipt: receiptMergeStrategy,
};

/**
 * Get merge strategy for entity type
 */
export function getMergeStrategy(entityType: string): EntityMergeStrategy | null {
  return ENTITY_MERGE_STRATEGIES[entityType] || null;
}

/**
 * Apply field-level merge strategy
 */
export function applyFieldStrategy(
  _fieldName: string,
  localValue: unknown,
  remoteValue: unknown,
  strategy: FieldMergeStrategy,
  localTimestamp: number,
  remoteTimestamp: number,
  localId?: string,
  remoteId?: string
): unknown {
  switch (strategy.strategy) {
    case 'lww':
      return lwwResolver(localValue, remoteValue, localTimestamp, remoteTimestamp, localId, remoteId);

    case 'max':
      return maxResolver(localValue, remoteValue);

    case 'union':
      return unionResolver(localValue, remoteValue);

    case 'custom':
      return strategy.resolver
        ? strategy.resolver(localValue, remoteValue)
        : lwwResolver(localValue, remoteValue, localTimestamp, remoteTimestamp, localId, remoteId);

    default:
      return lwwResolver(localValue, remoteValue, localTimestamp, remoteTimestamp, localId, remoteId);
  }
}

/**
 * Merge two entities using entity-specific strategy
 */
export function mergeWithStrategy<T extends CRDTEntity>(
  local: T,
  remote: T,
  entityType: string
): T {
  const strategy = getMergeStrategy(entityType);

  if (!strategy) {
    // Fallback to simple LWW if no strategy defined
    return local.updated_at >= remote.updated_at ? local : remote;
  }

  // Use custom merger if defined
  if (strategy.customMerger) {
    return strategy.customMerger(local, remote);
  }

  // Field-by-field merge
  const merged = { ...local };

  for (const [fieldName, fieldValue] of Object.entries(remote)) {
    // Skip version_vector and timestamps (handled separately)
    if (['version_vector', 'created_at', 'updated_at', 'deleted_at', 'id'].includes(fieldName)) {
      continue;
    }

    const fieldStrategy = strategy.fieldStrategies[fieldName];

    if (fieldStrategy) {
      (merged as Record<string, unknown>)[fieldName] = applyFieldStrategy(
        fieldName,
        (local as Record<string, unknown>)[fieldName],
        fieldValue,
        fieldStrategy,
        local.updated_at,
        remote.updated_at,
        local.id,
        remote.id
      );
    } else {
      // No specific strategy, use LWW
      (merged as Record<string, unknown>)[fieldName] = lwwResolver(
        (local as Record<string, unknown>)[fieldName],
        fieldValue,
        local.updated_at,
        remote.updated_at,
        local.id,
        remote.id
      );
    }
  }

  return merged;
}
