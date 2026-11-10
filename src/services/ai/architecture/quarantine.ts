/**
 * Quarantine Service
 *
 * The "Quarantine LLM" in the CaMeL architecture.
 * This service ONLY reads and extracts data - it has NO tools or actions.
 *
 * Key security properties:
 * - Sees sanitized data only (never raw user data)
 * - Cannot call any tools or take actions
 * - Can only output structured data (no arbitrary text)
 * - Output is validated against schema before use
 * - Prompt injection in data cannot cause tool execution
 *
 * @security Phase 3.2 - CaMeL Architecture Scaffolding
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import {
  type QuarantineRequest,
  type QuarantineResponse,
  type SanitizedTransaction,
  type JSONSchemaDefinition,
} from './types';

/**
 * Quarantine configuration
 */
interface QuarantineConfig {
  maxTransactionsPerRequest: number;
  maxDescriptionLength: number;
  timeoutMs: number;
  enableLogging: boolean;
}

const DEFAULT_CONFIG: QuarantineConfig = {
  maxTransactionsPerRequest: 100,
  maxDescriptionLength: 500,
  timeoutMs: 30000,
  enableLogging: true,
};

/**
 * Quarantine session for tracking
 */
interface QuarantineSession {
  request_id: string;
  started_at: string;
  completed_at?: string;
  transaction_count: number;
  status: 'pending' | 'completed' | 'failed' | 'timeout';
  error?: string;
}

// Session history for audit
const sessionHistory: QuarantineSession[] = [];
const MAX_SESSION_HISTORY = 500;

/**
 * Validate that a transaction is properly sanitized
 */
function validateSanitizedTransaction(
  tx: SanitizedTransaction,
  config: QuarantineConfig
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check description length
  if (tx.sanitized_description.length > config.maxDescriptionLength) {
    issues.push(
      `Description exceeds max length (${tx.sanitized_description.length} > ${config.maxDescriptionLength})`
    );
  }

  // Check for potential raw data leakage (should be caught by sanitizer)
  const rawDataPatterns = [
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/, // SSN
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email
  ];

  for (const pattern of rawDataPatterns) {
    if (pattern.test(tx.sanitized_description)) {
      issues.push('Potential PII detected in sanitized description');
      break;
    }
  }

  // Validate required fields
  if (!tx.id) issues.push('Missing transaction ID');
  if (!tx.date) issues.push('Missing transaction date');
  if (typeof tx.amount !== 'number') issues.push('Invalid amount');

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate output against schema
 * Ensures quarantine output matches expected structure
 */
function validateOutputAgainstSchema(
  output: unknown,
  schema: JSONSchemaDefinition
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  function validateValue(
    value: unknown,
    schemaNode: JSONSchemaDefinition,
    path: string
  ): void {
    // Type checking
    switch (schemaNode.type) {
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push(`${path}: expected object, got ${typeof value}`);
          return;
        }
        // Check required fields
        if (schemaNode.required) {
          for (const field of schemaNode.required) {
            if (!(field in (value as Record<string, unknown>))) {
              errors.push(`${path}: missing required field '${field}'`);
            }
          }
        }
        // Validate properties
        if (schemaNode.properties) {
          for (const [key, propSchema] of Object.entries(schemaNode.properties)) {
            const propValue = (value as Record<string, unknown>)[key];
            if (propValue !== undefined) {
              validateValue(propValue, propSchema, `${path}.${key}`);
            }
          }
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${path}: expected array, got ${typeof value}`);
          return;
        }
        if (schemaNode.items) {
          value.forEach((item, idx) => {
            validateValue(item, schemaNode.items!, `${path}[${idx}]`);
          });
        }
        break;

      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${path}: expected string, got ${typeof value}`);
        }
        if (schemaNode.enum && !schemaNode.enum.includes(value as string)) {
          errors.push(`${path}: value not in enum [${schemaNode.enum.join(', ')}]`);
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          errors.push(`${path}: expected number, got ${typeof value}`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${path}: expected boolean, got ${typeof value}`);
        }
        break;
    }
  }

  validateValue(output, schema, 'root');

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Record session for audit
 */
function recordSession(session: QuarantineSession): void {
  sessionHistory.push(session);

  if (sessionHistory.length > MAX_SESSION_HISTORY) {
    sessionHistory.shift();
  }
}

/**
 * Process a quarantine request
 *
 * This is where the actual LLM call would happen in production.
 * Currently stubbed for scaffolding - returns mock structured data.
 *
 * CRITICAL: This function must NEVER have access to tools or actions.
 * It can only read data and return structured output.
 */
export async function processQuarantineRequest(
  request: QuarantineRequest,
  config: Partial<QuarantineConfig> = {}
): Promise<QuarantineResponse> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // Create session record
  const session: QuarantineSession = {
    request_id: request.request_id,
    started_at: new Date().toISOString(),
    transaction_count: request.transactions.length,
    status: 'pending',
  };

  try {
    // Validate transaction count
    if (request.transactions.length > fullConfig.maxTransactionsPerRequest) {
      throw new Error(
        `Too many transactions: ${request.transactions.length} > ${fullConfig.maxTransactionsPerRequest}`
      );
    }

    // Validate all transactions are properly sanitized
    for (const tx of request.transactions) {
      const validation = validateSanitizedTransaction(tx, fullConfig);
      if (!validation.valid) {
        throw new Error(
          `Transaction ${tx.id} validation failed: ${validation.issues.join(', ')}`
        );
      }
    }

    // STUB: In production, this would call the quarantine LLM
    // The LLM would:
    // 1. Read the sanitized transactions
    // 2. Follow the processing_instructions
    // 3. Return data matching the extraction_schema
    //
    // CRITICAL: The LLM API call here must NOT include any tool definitions.
    // This ensures that even if prompt injection occurs, no actions can be taken.

    const extractedData = await simulateQuarantineProcessing(
      request.transactions,
      request.extraction_schema,
      request.processing_instructions
    );

    // Validate output against schema
    const outputValidation = validateOutputAgainstSchema(
      extractedData,
      request.extraction_schema
    );

    if (!outputValidation.valid) {
      throw new Error(
        `Output schema validation failed: ${outputValidation.errors.join(', ')}`
      );
    }

    // Calculate confidence based on transaction count and variety
    const confidence = calculateConfidence(request.transactions);

    // Update session
    session.status = 'completed';
    session.completed_at = new Date().toISOString();
    recordSession(session);

    return {
      request_id: request.request_id,
      success: true,
      extracted_data: extractedData,
      confidence,
    };
  } catch (error) {
    // Update session with error
    session.status = 'failed';
    session.error = error instanceof Error ? error.message : String(error);
    session.completed_at = new Date().toISOString();
    recordSession(session);

    return {
      request_id: request.request_id,
      success: false,
      extracted_data: {},
      confidence: 0,
      error: session.error,
    };
  }
}

/**
 * Simulate quarantine LLM processing (stub for scaffolding)
 *
 * In production, this would be replaced with actual LLM API call.
 * The stub demonstrates the expected behavior and data flow.
 */
async function simulateQuarantineProcessing(
  transactions: SanitizedTransaction[],
  schema: JSONSchemaDefinition,
  instructions: string
): Promise<Record<string, unknown>> {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Based on schema type, return appropriate mock data
  // This demonstrates the structured output contract

  if (schema.type === 'object' && schema.properties) {
    const result: Record<string, unknown> = {};

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      switch (propSchema.type) {
        case 'array':
          // For categorization tasks, return transaction categories
          if (key === 'categorizations' || key === 'categories') {
            result[key] = transactions.map((tx) => ({
              transaction_id: tx.id,
              suggested_category: 'Uncategorized',
              confidence: 0.5,
            }));
          } else {
            result[key] = [];
          }
          break;

        case 'object':
          result[key] = {};
          break;

        case 'number':
          result[key] = 0;
          break;

        case 'boolean':
          result[key] = false;
          break;

        case 'string':
          result[key] = '';
          break;
      }
    }

    return result;
  }

  return {};
}

/**
 * Calculate confidence score based on transaction data
 */
function calculateConfidence(transactions: SanitizedTransaction[]): number {
  if (transactions.length === 0) return 0;

  // Base confidence
  let confidence = 0.5;

  // More transactions = more context = higher confidence (up to a point)
  if (transactions.length > 5) confidence += 0.1;
  if (transactions.length > 20) confidence += 0.1;

  // Cap at 0.9 (never 100% confident)
  return Math.min(confidence, 0.9);
}

/**
 * Get session history for audit
 */
export function getSessionHistory(limit: number = 100): QuarantineSession[] {
  return sessionHistory.slice(-limit);
}

/**
 * Get failed sessions
 */
export function getFailedSessions(limit: number = 50): QuarantineSession[] {
  return sessionHistory.filter((s) => s.status === 'failed').slice(-limit);
}

/**
 * Get quarantine statistics
 */
export function getQuarantineStats(): {
  total_sessions: number;
  completed: number;
  failed: number;
  timeout: number;
  average_transaction_count: number;
} {
  const completed = sessionHistory.filter((s) => s.status === 'completed').length;
  const failed = sessionHistory.filter((s) => s.status === 'failed').length;
  const timeout = sessionHistory.filter((s) => s.status === 'timeout').length;

  const totalTransactions = sessionHistory.reduce(
    (sum, s) => sum + s.transaction_count,
    0
  );

  return {
    total_sessions: sessionHistory.length,
    completed,
    failed,
    timeout,
    average_transaction_count:
      sessionHistory.length > 0 ? totalTransactions / sessionHistory.length : 0,
  };
}

/**
 * Clear session history (for testing)
 */
export function clearSessionHistory(): void {
  sessionHistory.length = 0;
}

export default {
  processQuarantineRequest,
  getSessionHistory,
  getFailedSessions,
  getQuarantineStats,
  clearSessionHistory,
};
