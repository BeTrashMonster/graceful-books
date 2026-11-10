/**
 * CaMeL Architecture Types
 *
 * Type definitions for the dual-LLM separation architecture.
 * CaMeL = Capabilities and Machine Learning (secure AI architecture)
 *
 * Key principle: Separate trusted planning from untrusted data reading
 * - Planner: Has tools, never sees raw user data
 * - Quarantine: Sees data, has NO tools
 * - Staging: Human review before any action
 *
 * @security Phase 3.2 - CaMeL Architecture Scaffolding
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

/**
 * AI task types supported by the system
 */
export enum AITaskType {
  CATEGORIZE = 'categorize',
  ANOMALY_DETECT = 'anomaly_detect',
  FORECAST = 'forecast',
  RECONCILE = 'reconcile',
  SUMMARIZE = 'summarize',
}

/**
 * Context provided to the Planner LLM
 * Note: NO raw transaction data - only aggregates and metadata
 */
export interface PlannerContext {
  task: AITaskType;
  company_id: string;
  user_id: string;
  request_id: string;

  // Aggregated/anonymized context
  date_range?: {
    start: string;
    end: string;
  };
  account_types?: string[];
  transaction_count?: number;
  total_amount_range?: {
    min: number;
    max: number;
  };

  // User preferences
  preferences?: {
    categories_used?: string[];
    common_vendors?: string[];
    default_accounts?: Record<string, string>;
  };

  // Never include raw transaction data here
}

/**
 * Request to the Planner LLM
 */
export interface PlannerRequest {
  context: PlannerContext;
  instruction: string;
  extraction_schema?: JSONSchemaDefinition;
}

/**
 * Response from the Planner LLM
 */
export interface PlannerResponse {
  request_id: string;
  success: boolean;
  extraction_schema: JSONSchemaDefinition;
  processing_instructions: string;
  error?: string;
}

/**
 * JSON Schema definition for structured extraction
 */
export interface JSONSchemaDefinition {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, JSONSchemaDefinition>;
  items?: JSONSchemaDefinition;
  required?: string[];
  enum?: (string | number)[];
  description?: string;
}

/**
 * Sanitized transaction for Quarantine LLM
 * All sensitive data is sanitized/hashed before being passed
 */
export interface SanitizedTransaction {
  id: string;
  date: string;
  sanitized_description: string; // Sanitized via Phase 2 pipeline
  amount: number;
  account_type: string;
  // NO raw account IDs, names, or other sensitive data
}

/**
 * Request to the Quarantine LLM
 */
export interface QuarantineRequest {
  request_id: string;
  transactions: SanitizedTransaction[];
  extraction_schema: JSONSchemaDefinition;
  processing_instructions: string;
}

/**
 * Response from the Quarantine LLM
 * MUST be structured data only - no arbitrary text
 */
export interface QuarantineResponse {
  request_id: string;
  success: boolean;
  extracted_data: Record<string, unknown>;
  confidence: number;
  // NO arbitrary text fields - only structured data
  error?: string;
}

/**
 * AI suggestion status
 */
export enum SuggestionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  MODIFIED = 'modified',
  EXPIRED = 'expired',
}

/**
 * AI suggestion for staging area
 */
export interface AISuggestion {
  id: string;
  request_id: string;
  task_type: AITaskType;
  company_id: string;
  user_id: string;

  // The suggestion itself
  suggestion_type: 'categorization' | 'anomaly' | 'forecast' | 'journal_entry';
  suggested_data: Record<string, unknown>;

  // Confidence and explanation
  confidence: number;
  explanation: string;

  // Affected entities
  affected_transactions?: string[];
  affected_accounts?: string[];

  // Status tracking
  status: SuggestionStatus;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;

  // Expiration (suggestions don't live forever)
  expires_at: string;
}

/**
 * Staging area query options
 */
export interface StagingQueryOptions {
  company_id: string;
  user_id?: string;
  status?: SuggestionStatus;
  task_type?: AITaskType;
  limit?: number;
  offset?: number;
}

/**
 * Batch approval request
 */
export interface BatchApprovalRequest {
  suggestion_ids: string[];
  approved_by: string;
  notes?: string;
}

/**
 * Batch approval result
 */
export interface BatchApprovalResult {
  total: number;
  approved: number;
  failed: number;
  failures: Array<{
    id: string;
    reason: string;
  }>;
}

/**
 * Kill switch status
 */
export interface AIKillSwitch {
  enabled: boolean;
  reason?: string;
  triggered_by?: string;
  triggered_at?: string;
  auto_resume_at?: string;
}

/**
 * AI system health status
 */
export interface AIHealthStatus {
  operational: boolean;
  kill_switch: AIKillSwitch;
  last_successful_operation?: string;
  pending_suggestions_count: number;
  error_rate_24h: number;
  average_confidence: number;
}
