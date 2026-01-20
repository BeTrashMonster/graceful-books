/**
 * Scenarios Schema Definitions
 *
 * Database schemas for J3: Building the Dream Scenarios
 * Professional scenario modeling tool for accountants to model what-if decisions
 * and share interactive results with clients.
 *
 * Features:
 * - Baseline snapshot from live books (P&L, Balance Sheet, Cash)
 * - Scenario templates (hiring, equipment purchase, pricing changes, etc.)
 * - Freeform adjustment worksheet with formula support
 * - Accounting-aware downstream impact calculation
 * - Push-to-client workflow with email notifications
 * - Interactive client view with comments
 * - Scenario history and versioning
 */

/**
 * Scenarios Schema
 * Stores scenario definitions and baseline data
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying scenarios by company
 * - created_by_id: For querying scenarios by creator (advisor)
 * - client_id: For querying scenarios shared with specific client
 * - status: For filtering by status (draft, ready, shared, archived)
 * - [company_id+status]: Compound index for active scenarios
 * - [client_id+status]: Compound index for client's scenarios
 */
export const scenariosSchema =
  'id, company_id, created_by_id, client_id, status, [company_id+status], [client_id+status], updated_at, deleted_at';

/**
 * Scenario Baselines Schema
 * Stores financial baseline snapshots (P&L, Balance Sheet, Cash Flow)
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - scenario_id: For querying baseline by scenario (UNIQUE - one baseline per scenario)
 * - snapshot_date: For baseline freshness tracking
 */
export const scenarioBaselinesSchema =
  'id, scenario_id, snapshot_date, updated_at, deleted_at';

/**
 * Scenario Adjustments Schema
 * Stores individual adjustments (template-based or freeform)
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - scenario_id: For querying adjustments by scenario
 * - adjustment_type: For filtering by template vs freeform
 * - order_index: For maintaining adjustment order
 * - [scenario_id+order_index]: Compound index for ordered adjustments
 */
export const scenarioAdjustmentsSchema =
  'id, scenario_id, adjustment_type, order_index, [scenario_id+order_index], updated_at, deleted_at';

/**
 * Scenario Notes Schema
 * Stores accountant notes attached to scenarios or specific line items
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - scenario_id: For querying notes by scenario
 * - line_item_id: For notes attached to specific line items (nullable)
 * - created_by_id: For audit trail
 * - [scenario_id+line_item_id]: Compound index for line-item notes
 */
export const scenarioNotesSchema =
  'id, scenario_id, line_item_id, created_by_id, [scenario_id+line_item_id], created_at, updated_at, deleted_at';

/**
 * Scenario Comments Schema
 * Stores client comments on shared scenarios
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - scenario_id: For querying comments by scenario
 * - created_by_id: For comment author tracking
 * - parent_comment_id: For threaded comments (nullable)
 * - [scenario_id+created_at]: Compound index for chronological comments
 */
export const scenarioCommentsSchema =
  'id, scenario_id, created_by_id, parent_comment_id, [scenario_id+created_at], created_at, updated_at, deleted_at';

/**
 * Scenario Shares Schema
 * Tracks scenario sharing with clients (for J7 integration)
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - scenario_id: For querying shares by scenario
 * - shared_with_user_id: For querying scenarios shared with specific user
 * - shared_by_user_id: For audit trail
 * - status: For tracking client response (pending, viewed, commented, accepted, declined)
 * - [scenario_id+shared_with_user_id]: Compound index (prevent duplicate shares)
 */
export const scenarioSharesSchema =
  'id, scenario_id, shared_with_user_id, shared_by_user_id, status, [scenario_id+shared_with_user_id], shared_at, viewed_at, responded_at, updated_at, deleted_at';

/**
 * Scenario Templates Schema
 * Stores predefined scenario templates (10+ at launch)
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - template_key: For template lookup by key (UNIQUE)
 * - category: For filtering templates by category
 * - active: For filtering active templates
 */
export const scenarioTemplatesSchema =
  'id, template_key, category, active, updated_at, deleted_at';

/**
 * Table name constants
 */
export const SCENARIOS_TABLE = 'scenarios';
export const SCENARIO_BASELINES_TABLE = 'scenario_baselines';
export const SCENARIO_ADJUSTMENTS_TABLE = 'scenario_adjustments';
export const SCENARIO_NOTES_TABLE = 'scenario_notes';
export const SCENARIO_COMMENTS_TABLE = 'scenario_comments';
export const SCENARIO_SHARES_TABLE = 'scenario_shares';
export const SCENARIO_TEMPLATES_TABLE = 'scenario_templates';
