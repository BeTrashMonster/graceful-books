/**
 * Approval Rule Engine Service
 *
 * Evaluates approval rules against transactions to determine if approval is required
 * and which rules apply. Supports complex condition matching with multiple operators.
 *
 * Requirements:
 * - H3: Approval Workflows
 * - Flexible rule engine for condition evaluation
 * - Support for complex conditions (amount, type, vendor, account, metadata)
 */

import type {
  Transaction,
  TransactionLineItem,
  AccountType,
} from '../types/database.types';
import type {
  ApprovalRule,
  ApprovalCondition,
  ApprovalConditionField,
  ApprovalConditionOperator,
  ApprovalRuleStatus,
} from '../db/schema/approvalWorkflows.schema';
import { logger } from '../utils/logger';

const ruleLogger = logger.child('ApprovalRuleEngine');

// ============================================================================
// Types
// ============================================================================

/**
 * Transaction context for rule evaluation
 */
export interface TransactionContext {
  transaction: Transaction;
  lineItems: TransactionLineItem[];
  totalAmount: number; // Total transaction amount (sum of debits or credits)
  accountIds: string[]; // All account IDs in transaction
  accountTypes: AccountType[]; // All account types in transaction
  contactIds: string[]; // All contact IDs in transaction
  productIds: string[]; // All product IDs in transaction
  metadata: Record<string, unknown>; // Transaction metadata
}

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  rule: ApprovalRule;
  matches: boolean;
  matchedConditions: number; // Number of conditions that matched
  totalConditions: number; // Total conditions evaluated
  evaluationTime: number; // Time taken to evaluate in ms
}

/**
 * Rule matching result
 */
export interface RuleMatchResult {
  requiresApproval: boolean;
  matchedRules: ApprovalRule[];
  evaluationResults: RuleEvaluationResult[];
  highestPriorityRule: ApprovalRule | null;
}

// ============================================================================
// Rule Evaluation Functions
// ============================================================================

/**
 * Evaluate a single condition against transaction context
 */
export function evaluateCondition(
  condition: ApprovalCondition,
  context: TransactionContext
): boolean {
  try {
    const { field, operator, value } = condition;

    // Get the actual value from context based on field
    const actualValue = getFieldValue(field, context);

    // Evaluate based on operator
    return evaluateOperator(operator, actualValue, value);
  } catch (error) {
    ruleLogger.error('Error evaluating condition', {
      condition,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get field value from transaction context
 */
function getFieldValue(
  field: ApprovalConditionField,
  context: TransactionContext
): string | string[] | number {
  switch (field) {
    case 'AMOUNT':
      return context.totalAmount;

    case 'TRANSACTION_TYPE':
      return context.transaction.type;

    case 'ACCOUNT_ID':
      return context.accountIds;

    case 'ACCOUNT_TYPE':
      return context.accountTypes;

    case 'CONTACT_ID':
      return context.contactIds.filter((id) => id !== null);

    case 'PRODUCT_ID':
      return context.productIds.filter((id) => id !== null);

    case 'METADATA':
      return context.metadata as string | number | string[];

    default:
      ruleLogger.warn('Unknown condition field', { field });
      return '';
  }
}

/**
 * Evaluate operator against actual and expected values
 */
function evaluateOperator(
  operator: ApprovalConditionOperator,
  actualValue: string | string[] | number | Record<string, unknown>,
  expectedValue: string | string[] | number
): boolean {
  switch (operator) {
    case 'EQUALS':
      return evaluateEquals(actualValue, expectedValue);

    case 'NOT_EQUALS':
      return !evaluateEquals(actualValue, expectedValue);

    case 'GREATER_THAN':
      return evaluateGreaterThan(actualValue, expectedValue, false);

    case 'GREATER_THAN_OR_EQUAL':
      return evaluateGreaterThan(actualValue, expectedValue, true);

    case 'LESS_THAN':
      return evaluateLessThan(actualValue, expectedValue, false);

    case 'LESS_THAN_OR_EQUAL':
      return evaluateLessThan(actualValue, expectedValue, true);

    case 'IN':
      return evaluateIn(actualValue, expectedValue);

    case 'NOT_IN':
      return !evaluateIn(actualValue, expectedValue);

    case 'CONTAINS':
      return evaluateContains(actualValue, expectedValue);

    case 'NOT_CONTAINS':
      return !evaluateContains(actualValue, expectedValue);

    default:
      ruleLogger.warn('Unknown operator', { operator });
      return false;
  }
}

/**
 * Evaluate EQUALS operator
 */
function evaluateEquals(
  actualValue: string | string[] | number | Record<string, unknown>,
  expectedValue: string | string[] | number
): boolean {
  if (typeof actualValue === 'object' && !Array.isArray(actualValue)) {
    // For metadata objects, can't do simple equality
    return false;
  }

  if (Array.isArray(actualValue)) {
    if (Array.isArray(expectedValue)) {
      // Array equality (order-independent)
      return (
        actualValue.length === expectedValue.length &&
        actualValue.every((val) => expectedValue.includes(val))
      );
    }
    // Check if single value is in array
    return actualValue.includes(String(expectedValue));
  }

  return String(actualValue) === String(expectedValue);
}

/**
 * Evaluate GREATER_THAN operator
 */
function evaluateGreaterThan(
  actualValue: string | string[] | number | Record<string, unknown>,
  expectedValue: string | string[] | number,
  orEqual: boolean
): boolean {
  const actual = Number(actualValue);
  const expected = Number(expectedValue);

  if (isNaN(actual) || isNaN(expected)) {
    return false;
  }

  return orEqual ? actual >= expected : actual > expected;
}

/**
 * Evaluate LESS_THAN operator
 */
function evaluateLessThan(
  actualValue: string | string[] | number | Record<string, unknown>,
  expectedValue: string | string[] | number,
  orEqual: boolean
): boolean {
  const actual = Number(actualValue);
  const expected = Number(expectedValue);

  if (isNaN(actual) || isNaN(expected)) {
    return false;
  }

  return orEqual ? actual <= expected : actual < expected;
}

/**
 * Evaluate IN operator (value in expected array)
 */
function evaluateIn(
  actualValue: string | string[] | number | Record<string, unknown>,
  expectedValue: string | string[] | number
): boolean {
  if (!Array.isArray(expectedValue)) {
    return false;
  }

  if (Array.isArray(actualValue)) {
    // Check if any actual value is in expected array
    return actualValue.some((val) => expectedValue.includes(val));
  }

  return expectedValue.includes(String(actualValue));
}

/**
 * Evaluate CONTAINS operator (expected value in actual array/string)
 */
function evaluateContains(
  actualValue: string | string[] | number | Record<string, unknown>,
  expectedValue: string | string[] | number
): boolean {
  if (Array.isArray(actualValue)) {
    if (Array.isArray(expectedValue)) {
      // Check if all expected values are in actual array
      return expectedValue.every((val) => actualValue.includes(val));
    }
    // Check if single expected value is in array
    return actualValue.includes(String(expectedValue));
  }

  if (typeof actualValue === 'string') {
    return actualValue.includes(String(expectedValue));
  }

  if (typeof actualValue === 'object' && !Array.isArray(actualValue)) {
    // For metadata objects, check if key exists
    return String(expectedValue) in actualValue;
  }

  return false;
}

/**
 * Evaluate all conditions in a rule against transaction context
 */
export function evaluateRule(rule: ApprovalRule, context: TransactionContext): RuleEvaluationResult {
  const startTime = performance.now();

  // If rule is not active, it never matches
  if (rule.status !== ApprovalRuleStatus.ACTIVE) {
    return {
      rule,
      matches: false,
      matchedConditions: 0,
      totalConditions: rule.conditions.length,
      evaluationTime: performance.now() - startTime,
    };
  }

  // If no conditions, rule matches everything
  if (rule.conditions.length === 0) {
    return {
      rule,
      matches: true,
      matchedConditions: 0,
      totalConditions: 0,
      evaluationTime: performance.now() - startTime,
    };
  }

  // Evaluate each condition (ALL must match)
  let matchedCount = 0;
  for (const condition of rule.conditions) {
    if (evaluateCondition(condition, context)) {
      matchedCount++;
    }
  }

  const allMatch = matchedCount === rule.conditions.length;

  return {
    rule,
    matches: allMatch,
    matchedConditions: matchedCount,
    totalConditions: rule.conditions.length,
    evaluationTime: performance.now() - startTime,
  };
}

/**
 * Find all rules that match a transaction
 */
export function findMatchingRules(
  rules: ApprovalRule[],
  context: TransactionContext
): RuleMatchResult {
  const evaluationResults: RuleEvaluationResult[] = [];
  const matchedRules: ApprovalRule[] = [];

  // Sort rules by priority (lower number = higher priority)
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  // Evaluate each rule
  for (const rule of sortedRules) {
    const result = evaluateRule(rule, context);
    evaluationResults.push(result);

    if (result.matches) {
      matchedRules.push(rule);
    }
  }

  // Determine highest priority rule (first matching rule)
  const highestPriorityRule = matchedRules.length > 0 ? matchedRules[0] : null;

  return {
    requiresApproval: matchedRules.length > 0,
    matchedRules,
    evaluationResults,
    highestPriorityRule: highestPriorityRule ?? null,
  };
}

/**
 * Build transaction context from transaction and line items
 */
export function buildTransactionContext(
  transaction: Transaction,
  lineItems: TransactionLineItem[],
  accountTypesMap: Map<string, AccountType>
): TransactionContext {
  // Calculate total amount (sum of debits)
  const totalAmount = lineItems.reduce((sum, item) => {
    const debit = parseFloat(item.debit || '0');
    return sum + debit;
  }, 0);

  // Extract all unique account IDs
  const accountIds = [...new Set(lineItems.map((item) => item.account_id))];

  // Get account types from map
  const accountTypes = [
    ...new Set(accountIds.map((id) => accountTypesMap.get(id)).filter((type) => type !== undefined)),
  ] as AccountType[];

  // Extract all unique contact IDs (filter out nulls)
  const contactIds = [
    ...new Set(lineItems.map((item) => item.contact_id).filter((id) => id !== null)),
  ] as string[];

  // Extract all unique product IDs (filter out nulls)
  const productIds = [
    ...new Set(lineItems.map((item) => item.product_id).filter((id) => id !== null)),
  ] as string[];

  // Build metadata from transaction
  const metadata: Record<string, unknown> = {
    transactionNumber: transaction.transaction_number,
    description: transaction.description,
    reference: transaction.reference,
    memo: transaction.memo,
  };

  return {
    transaction,
    lineItems,
    totalAmount,
    accountIds,
    accountTypes,
    contactIds,
    productIds,
    metadata,
  };
}

// ============================================================================
// Rule Validation
// ============================================================================

/**
 * Validate that a rule is properly configured
 */
export function validateRuleConfiguration(rule: ApprovalRule): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check approval levels
  if (rule.approval_levels.length === 0) {
    errors.push('Rule must have at least one approval level');
  }

  // Validate level numbers are sequential
  rule.approval_levels.forEach((level, index) => {
    if (level.level_number !== index + 1) {
      errors.push(`Level ${index + 1} has incorrect level_number: ${level.level_number}`);
    }

    if (level.approver_user_ids.length === 0) {
      errors.push(`Level ${index + 1} must have at least one approver`);
    }

    if (level.requirement_type === 'THRESHOLD') {
      if (!level.threshold_count || level.threshold_count < 1) {
        errors.push(`Level ${index + 1} threshold must be at least 1`);
      }

      if (level.threshold_count && level.threshold_count > level.approver_user_ids.length) {
        errors.push(`Level ${index + 1} threshold exceeds number of approvers`);
      }
    }
  });

  // Validate conditions
  rule.conditions.forEach((condition, index) => {
    if (!condition.field) {
      errors.push(`Condition ${index + 1} missing field`);
    }

    if (!condition.operator) {
      errors.push(`Condition ${index + 1} missing operator`);
    }

    if (condition.value === undefined || condition.value === null) {
      errors.push(`Condition ${index + 1} missing value`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Test rule against sample transaction (for rule builder UI)
 */
export function testRule(
  rule: ApprovalRule,
  context: TransactionContext
): {
  matches: boolean;
  details: RuleEvaluationResult;
  conditionResults: Array<{
    condition: ApprovalCondition;
    matches: boolean;
    actualValue: string | string[] | number | Record<string, unknown>;
  }>;
} {
  const result = evaluateRule(rule, context);

  const conditionResults = rule.conditions.map((condition) => ({
    condition,
    matches: evaluateCondition(condition, context),
    actualValue: getFieldValue(condition.field, context),
  }));

  return {
    matches: result.matches,
    details: result,
    conditionResults,
  };
}
