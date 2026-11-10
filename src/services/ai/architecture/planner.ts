/**
 * Planner Service
 *
 * The "Planner LLM" in the CaMeL architecture.
 * This service has access to tools but NEVER sees raw user data.
 *
 * Key security properties:
 * - Has tools for planning and orchestration
 * - Never receives raw transaction data (only aggregates/metadata)
 * - Generates extraction schemas for Quarantine LLM
 * - Cannot be manipulated by prompt injection in data (never sees it)
 * - All actions go through staging area for human review
 *
 * @security Phase 3.2 - CaMeL Architecture Scaffolding
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import {
  type PlannerContext,
  type PlannerRequest,
  type PlannerResponse,
  type JSONSchemaDefinition,
  AITaskType,
} from './types';

/**
 * Planner configuration
 */
interface PlannerConfig {
  maxContextSize: number;
  timeoutMs: number;
  enableLogging: boolean;
}

const DEFAULT_CONFIG: PlannerConfig = {
  maxContextSize: 4096,
  timeoutMs: 30000,
  enableLogging: true,
};

/**
 * Planning session for tracking
 */
interface PlanningSession {
  request_id: string;
  task: AITaskType;
  started_at: string;
  completed_at?: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

// Session history for audit
const sessionHistory: PlanningSession[] = [];
const MAX_SESSION_HISTORY = 500;

/**
 * Predefined extraction schemas for each task type
 * These are the "trusted" schemas that control what the Quarantine LLM extracts
 */
const TASK_SCHEMAS: Record<AITaskType, JSONSchemaDefinition> = {
  [AITaskType.CATEGORIZE]: {
    type: 'object',
    properties: {
      categorizations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            transaction_id: { type: 'string' },
            suggested_category: { type: 'string' },
            confidence: { type: 'number' },
            reasoning: { type: 'string' },
          },
          required: ['transaction_id', 'suggested_category', 'confidence'],
        },
      },
    },
    required: ['categorizations'],
  },

  [AITaskType.ANOMALY_DETECT]: {
    type: 'object',
    properties: {
      anomalies: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            transaction_id: { type: 'string' },
            anomaly_type: {
              type: 'string',
              enum: ['duplicate', 'unusual_amount', 'unusual_timing', 'unusual_vendor', 'other'],
            },
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
            },
            description: { type: 'string' },
          },
          required: ['transaction_id', 'anomaly_type', 'severity'],
        },
      },
      summary: {
        type: 'object',
        properties: {
          total_anomalies: { type: 'number' },
          high_severity_count: { type: 'number' },
          requires_review: { type: 'boolean' },
        },
      },
    },
    required: ['anomalies'],
  },

  [AITaskType.FORECAST]: {
    type: 'object',
    properties: {
      forecast: {
        type: 'object',
        properties: {
          period: { type: 'string' },
          projected_income: { type: 'number' },
          projected_expenses: { type: 'number' },
          projected_net: { type: 'number' },
          confidence_interval: {
            type: 'object',
            properties: {
              low: { type: 'number' },
              high: { type: 'number' },
            },
          },
        },
        required: ['period', 'projected_income', 'projected_expenses', 'projected_net'],
      },
      assumptions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['forecast'],
  },

  [AITaskType.RECONCILE]: {
    type: 'object',
    properties: {
      matches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            bank_transaction_id: { type: 'string' },
            book_transaction_id: { type: 'string' },
            match_confidence: { type: 'number' },
            match_type: {
              type: 'string',
              enum: ['exact', 'fuzzy', 'partial', 'manual_review'],
            },
          },
          required: ['bank_transaction_id', 'match_type'],
        },
      },
      unmatched_bank: {
        type: 'array',
        items: { type: 'string' },
      },
      unmatched_book: {
        type: 'array',
        items: { type: 'string' },
      },
      discrepancy_total: { type: 'number' },
    },
    required: ['matches'],
  },

  [AITaskType.SUMMARIZE]: {
    type: 'object',
    properties: {
      summary: {
        type: 'object',
        properties: {
          total_transactions: { type: 'number' },
          total_income: { type: 'number' },
          total_expenses: { type: 'number' },
          net_change: { type: 'number' },
          top_categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                amount: { type: 'number' },
                percentage: { type: 'number' },
              },
            },
          },
        },
        required: ['total_transactions', 'total_income', 'total_expenses', 'net_change'],
      },
      insights: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['summary'],
  },
};

/**
 * Processing instructions for each task type
 * These guide the Quarantine LLM on how to process the data
 */
const TASK_INSTRUCTIONS: Record<AITaskType, string> = {
  [AITaskType.CATEGORIZE]: `
Analyze each transaction and suggest an appropriate category.
Consider:
- The transaction description for merchant/vendor identification
- The amount (income vs expense patterns)
- The account type involved
Return confidence scores between 0 and 1.
Do not include any reasoning that references specific vendor names or amounts in the output.
  `.trim(),

  [AITaskType.ANOMALY_DETECT]: `
Scan transactions for potential anomalies:
- Duplicate transactions (same amount, date, description)
- Unusual amounts (significantly higher/lower than typical)
- Unusual timing (outside normal patterns)
- Unusual vendors (first-time or unexpected)
Flag items that may need human review.
Do not make assumptions about what is "normal" without data to support it.
  `.trim(),

  [AITaskType.FORECAST]: `
Based on the transaction patterns:
- Calculate average income and expenses
- Project forward based on trends
- Provide confidence intervals
Be conservative in projections and clearly state assumptions.
Do not overfit to recent data.
  `.trim(),

  [AITaskType.RECONCILE]: `
Match bank transactions to book entries:
- Look for exact matches first (same amount, date, description)
- Then fuzzy matches (similar amounts, nearby dates)
- Flag transactions needing manual review
Return unmatched items from both sides.
  `.trim(),

  [AITaskType.SUMMARIZE]: `
Summarize the transaction data:
- Total counts and amounts
- Top spending/income categories
- Key insights about patterns
Keep insights general and actionable.
Do not include specific transaction details in the summary.
  `.trim(),
};

/**
 * Validate planner context
 * Ensures no raw data is being passed
 */
function validateContext(context: PlannerContext): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check required fields
  if (!context.company_id) issues.push('Missing company_id');
  if (!context.user_id) issues.push('Missing user_id');
  if (!context.request_id) issues.push('Missing request_id');
  if (!context.task) issues.push('Missing task type');

  // Ensure no raw data fields exist (context should only have aggregates)
  const suspiciousFields = ['transactions', 'entries', 'raw_data', 'data'];
  for (const field of suspiciousFields) {
    if (field in context) {
      issues.push(`Context contains suspicious field '${field}' - raw data not allowed`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Record session for audit
 */
function recordSession(session: PlanningSession): void {
  sessionHistory.push(session);

  if (sessionHistory.length > MAX_SESSION_HISTORY) {
    sessionHistory.shift();
  }
}

/**
 * Generate a plan for the given task
 *
 * This is the main entry point for the Planner LLM.
 * It generates extraction schemas and processing instructions
 * for the Quarantine LLM to follow.
 *
 * CRITICAL: This function must NEVER receive raw user data.
 * It only works with aggregated metadata and user preferences.
 */
export async function generatePlan(
  request: PlannerRequest,
  config: Partial<PlannerConfig> = {}
): Promise<PlannerResponse> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Create session record
  const session: PlanningSession = {
    request_id: request.context.request_id,
    task: request.context.task,
    started_at: new Date().toISOString(),
    status: 'pending',
  };

  try {
    // Validate context
    const contextValidation = validateContext(request.context);
    if (!contextValidation.valid) {
      throw new Error(
        `Invalid planner context: ${contextValidation.issues.join(', ')}`
      );
    }

    // Get the schema for this task type
    const schema = request.extraction_schema || TASK_SCHEMAS[request.context.task];
    if (!schema) {
      throw new Error(`No schema defined for task type: ${request.context.task}`);
    }

    // Get processing instructions
    const instructions = TASK_INSTRUCTIONS[request.context.task];
    if (!instructions) {
      throw new Error(`No instructions defined for task type: ${request.context.task}`);
    }

    // STUB: In production, this could involve LLM call to:
    // 1. Customize the extraction schema based on user preferences
    // 2. Enhance processing instructions based on context
    // 3. Plan multi-step operations
    //
    // For now, we use predefined schemas and instructions
    // which is actually MORE secure (no dynamic modification)

    const enhancedInstructions = buildInstructions(
      instructions,
      request.context,
      request.instruction
    );

    // Update session
    session.status = 'completed';
    session.completed_at = new Date().toISOString();
    recordSession(session);

    return {
      request_id: request.context.request_id,
      success: true,
      extraction_schema: schema,
      processing_instructions: enhancedInstructions,
    };
  } catch (error) {
    // Update session with error
    session.status = 'failed';
    session.error = error instanceof Error ? error.message : String(error);
    session.completed_at = new Date().toISOString();
    recordSession(session);

    return {
      request_id: request.context.request_id,
      success: false,
      extraction_schema: { type: 'object' },
      processing_instructions: '',
      error: session.error,
    };
  }
}

/**
 * Build enhanced instructions based on context
 */
function buildInstructions(
  baseInstructions: string,
  context: PlannerContext,
  userInstruction?: string
): string {
  const parts: string[] = [baseInstructions];

  // Add date range context if available
  if (context.date_range) {
    parts.push(
      `Date range: ${context.date_range.start} to ${context.date_range.end}`
    );
  }

  // Add transaction count context
  if (context.transaction_count !== undefined) {
    parts.push(`Processing ${context.transaction_count} transactions.`);
  }

  // Add user preferences context
  if (context.preferences?.categories_used?.length) {
    parts.push(
      `User's existing categories: ${context.preferences.categories_used.join(', ')}`
    );
  }

  // Add user's specific instruction (sanitized)
  if (userInstruction) {
    // Basic sanitization of user instruction
    const sanitized = userInstruction
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/\n{3,}/g, '\n\n') // Limit newlines
      .substring(0, 500); // Limit length

    parts.push(`User request: ${sanitized}`);
  }

  return parts.join('\n\n');
}

/**
 * Get available task types and their descriptions
 */
export function getAvailableTaskTypes(): Array<{
  type: AITaskType;
  name: string;
  description: string;
}> {
  return [
    {
      type: AITaskType.CATEGORIZE,
      name: 'Categorize Transactions',
      description: 'Automatically suggest categories for uncategorized transactions',
    },
    {
      type: AITaskType.ANOMALY_DETECT,
      name: 'Detect Anomalies',
      description: 'Find unusual transactions that may need review',
    },
    {
      type: AITaskType.FORECAST,
      name: 'Forecast Cash Flow',
      description: 'Project future income and expenses based on patterns',
    },
    {
      type: AITaskType.RECONCILE,
      name: 'Reconcile Accounts',
      description: 'Match bank transactions with book entries',
    },
    {
      type: AITaskType.SUMMARIZE,
      name: 'Summarize Activity',
      description: 'Generate insights and summaries from transaction data',
    },
  ];
}

/**
 * Get schema for a specific task type
 */
export function getTaskSchema(taskType: AITaskType): JSONSchemaDefinition | undefined {
  return TASK_SCHEMAS[taskType];
}

/**
 * Get session history for audit
 */
export function getSessionHistory(limit: number = 100): PlanningSession[] {
  return sessionHistory.slice(-limit);
}

/**
 * Get failed sessions
 */
export function getFailedSessions(limit: number = 50): PlanningSession[] {
  return sessionHistory.filter((s) => s.status === 'failed').slice(-limit);
}

/**
 * Get planner statistics
 */
export function getPlannerStats(): {
  total_sessions: number;
  completed: number;
  failed: number;
  by_task_type: Record<AITaskType, number>;
} {
  const byTaskType: Record<AITaskType, number> = {
    [AITaskType.CATEGORIZE]: 0,
    [AITaskType.ANOMALY_DETECT]: 0,
    [AITaskType.FORECAST]: 0,
    [AITaskType.RECONCILE]: 0,
    [AITaskType.SUMMARIZE]: 0,
  };

  for (const session of sessionHistory) {
    byTaskType[session.task]++;
  }

  return {
    total_sessions: sessionHistory.length,
    completed: sessionHistory.filter((s) => s.status === 'completed').length,
    failed: sessionHistory.filter((s) => s.status === 'failed').length,
    by_task_type: byTaskType,
  };
}

/**
 * Clear session history (for testing)
 */
export function clearSessionHistory(): void {
  sessionHistory.length = 0;
}

export default {
  generatePlan,
  getAvailableTaskTypes,
  getTaskSchema,
  getSessionHistory,
  getFailedSessions,
  getPlannerStats,
  clearSessionHistory,
};
