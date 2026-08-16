/**
 * Transaction Group Type Definitions
 *
 * Groups allow users to categorize transactions across different types
 * (expenses, checks, bills, invoices, etc.) for custom tracking and analysis.
 *
 * This enables vendor intelligence features similar to CPG's category system
 * but for general bookkeeping purposes.
 */

import type { BaseEntity, VersionVector } from './database.types';

// =============================================================================
// Group Types
// =============================================================================

/**
 * Transaction Group
 * User-defined grouping for categorizing transactions
 */
export interface TransactionGroup extends BaseEntity {
  company_id: string; // UUID - links to Company
  name: string; // ENCRYPTED - Group name (e.g., "Marketing", "Office Supplies", "Travel")
  description: string | null; // ENCRYPTED - Optional description
  color: string | null; // Hex color for visual identification (e.g., "#4b006e")
  icon: string | null; // Optional icon identifier
  parent_id: string | null; // UUID - For hierarchical groups (optional)
  is_active: boolean; // Whether the group is currently active
  display_order: number; // Sort order for displaying groups
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Transaction Group Assignment
 * Links a transaction line item to a group
 * Allows multiple groups per transaction line item
 */
export interface TransactionGroupAssignment extends BaseEntity {
  transaction_id: string; // UUID - links to Transaction
  line_item_id: string | null; // UUID - links to TransactionLineItem (null for whole transaction)
  group_id: string; // UUID - links to TransactionGroup
  company_id: string; // UUID - links to Company
  version_vector: VersionVector; // For CRDT conflict resolution
}

// =============================================================================
// Request/Response Types
// =============================================================================

/**
 * Request to create a transaction group
 */
export interface CreateTransactionGroupRequest {
  company_id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  parent_id?: string | null;
}

/**
 * Request to update a transaction group
 */
export interface UpdateTransactionGroupRequest {
  id: string;
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  parent_id?: string | null;
  is_active?: boolean;
  display_order?: number;
}

/**
 * Request to assign a group to a transaction
 */
export interface AssignGroupRequest {
  transaction_id: string;
  line_item_id?: string | null;
  group_id: string;
  company_id: string;
}

/**
 * Request to remove a group assignment
 */
export interface RemoveGroupAssignmentRequest {
  transaction_id: string;
  line_item_id?: string | null;
  group_id: string;
}

// =============================================================================
// Query Types
// =============================================================================

/**
 * Filters for querying transaction groups
 */
export interface TransactionGroupQueryFilters {
  company_id: string;
  is_active?: boolean;
  parent_id?: string | null;
  search?: string; // Search in name, description
}

/**
 * Filters for querying group assignments
 */
export interface GroupAssignmentQueryFilters {
  company_id: string;
  transaction_id?: string;
  group_id?: string;
  date_from?: number; // Unix timestamp
  date_to?: number; // Unix timestamp
}

// =============================================================================
// Analytics Types
// =============================================================================

/**
 * Group spending summary
 */
export interface GroupSpendingSummary {
  group_id: string;
  group_name: string;
  group_color: string | null;
  total_spend: number;
  transaction_count: number;
  percentage_of_total: number;
  average_transaction: number;
  last_transaction_date: number | null;
}

/**
 * Vendor group breakdown
 */
export interface VendorGroupBreakdown {
  vendor_id: string;
  vendor_name: string;
  groups: GroupSpendingSummary[];
  total_spend: number;
  transaction_count: number;
}

/**
 * Group trend data point
 */
export interface GroupTrendPoint {
  period: string; // e.g., "2026-01", "2026-Q1"
  group_id: string;
  group_name: string;
  spend: number;
  transaction_count: number;
}
