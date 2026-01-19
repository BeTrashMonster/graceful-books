/**
 * Recent Activity Type Definitions
 *
 * Types for tracking recent user activity including searches, views,
 * and edits across the application.
 *
 * Requirements:
 * - I3: UX Efficiency Shortcuts [Nice]
 * - ARCH-002: Zero-Knowledge Encryption (activity data encrypted)
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { VersionVector } from './database.types';

/**
 * Type of recent activity
 */
export enum RecentActivityType {
  SEARCH = 'SEARCH', // User performed a search
  VIEW = 'VIEW', // User viewed a record
  EDIT = 'EDIT', // User edited a record
  CREATE = 'CREATE', // User created a record
}

/**
 * Entity type for recent activity
 */
export enum RecentActivityEntityType {
  TRANSACTION = 'TRANSACTION',
  INVOICE = 'INVOICE',
  BILL = 'BILL',
  CONTACT = 'CONTACT',
  PRODUCT = 'PRODUCT',
  ACCOUNT = 'ACCOUNT',
  REPORT = 'REPORT',
  CHECKLIST_ITEM = 'CHECKLIST_ITEM',
  GLOBAL = 'GLOBAL', // Global search across all entities
}

/**
 * Recent Activity Entity
 * Tracks user interactions for quick access
 */
export interface RecentActivity {
  id: string; // UUID
  user_id: string; // User UUID
  company_id: string; // Company UUID
  activity_type: RecentActivityType; // Type of activity
  entity_type: RecentActivityEntityType; // What kind of entity
  entity_id: string | null; // ID of the entity (null for searches)
  entity_label: string; // ENCRYPTED - Display label (e.g., "Office Supplies - $45.23")
  search_query: string | null; // ENCRYPTED - Search query if applicable
  context: string | null; // ENCRYPTED - Additional context (JSON)
  timestamp: number; // Unix timestamp of activity
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  deleted_at: number | null; // Tombstone for soft deletes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Recent Search Entry
 * Simplified view for displaying recent searches
 */
export interface RecentSearchEntry {
  id: string;
  query: string;
  entity_type: RecentActivityEntityType;
  timestamp: number;
  result_count?: number; // Optional: number of results found
}

/**
 * Recent View Entry
 * Simplified view for displaying recently viewed items
 */
export interface RecentViewEntry {
  id: string;
  entity_type: RecentActivityEntityType;
  entity_id: string;
  label: string;
  timestamp: number;
  context?: {
    status?: string;
    amount?: string;
    date?: number;
    [key: string]: any;
  };
}

/**
 * Recent Edit Entry
 * Simplified view for "Resume where you left off"
 */
export interface RecentEditEntry {
  id: string;
  entity_type: RecentActivityEntityType;
  entity_id: string;
  label: string;
  timestamp: number;
  is_draft?: boolean; // Whether the entity is in draft state
  completion_percentage?: number; // Optional: how complete the entity is
}

/**
 * Recent Entry Suggestion
 * For showing similar recent entries during form entry
 */
export interface RecentEntrySuggestion {
  id: string;
  entity_type: RecentActivityEntityType;
  entity_id: string;
  label: string;
  timestamp: number;
  preview_data: {
    description?: string;
    amount?: string;
    vendor?: string;
    category?: string;
    account?: string;
    [key: string]: any;
  };
}

/**
 * Query parameters for fetching recent activity
 */
export interface GetRecentActivityQuery {
  user_id: string;
  company_id: string;
  activity_type?: RecentActivityType | RecentActivityType[];
  entity_type?: RecentActivityEntityType | RecentActivityEntityType[];
  limit?: number;
  offset?: number;
  since?: number; // Unix timestamp - only activities after this time
}

/**
 * Grouped recent activity
 * Groups activities by entity type for display
 */
export interface GroupedRecentActivity {
  entity_type: RecentActivityEntityType;
  activities: RecentViewEntry[];
  count: number;
}

/**
 * Recent activity summary
 * Overview of recent user activity
 */
export interface RecentActivitySummary {
  total_searches: number;
  total_views: number;
  total_edits: number;
  total_creates: number;
  most_viewed_entity_type: RecentActivityEntityType | null;
  most_edited_entity_type: RecentActivityEntityType | null;
  last_activity_timestamp: number | null;
}

/**
 * Create recent activity options
 */
export interface CreateRecentActivityOptions {
  user_id: string;
  company_id: string;
  activity_type: RecentActivityType;
  entity_type: RecentActivityEntityType;
  entity_id?: string;
  entity_label: string;
  search_query?: string;
  context?: Record<string, any>;
}

/**
 * Clear history options
 */
export interface ClearHistoryOptions {
  user_id: string;
  company_id: string;
  activity_type?: RecentActivityType | RecentActivityType[];
  entity_type?: RecentActivityEntityType | RecentActivityEntityType[];
  older_than?: number; // Unix timestamp - clear activities older than this
}
