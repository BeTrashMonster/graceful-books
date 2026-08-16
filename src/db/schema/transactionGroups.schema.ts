/**
 * Transaction Groups Schema
 *
 * Database schema for user-defined transaction groups.
 * Groups allow categorizing transactions for custom tracking and vendor analysis.
 */

import type { TransactionGroup, TransactionGroupAssignment } from '../../types/group.types';

/**
 * Database schema for transaction groups
 * Indexes: company_id, [company_id+is_active], parent_id
 */
export const transactionGroupsSchema =
  'id, company_id, name, parent_id, is_active, display_order, [company_id+is_active], created_at, updated_at, deleted_at';

/**
 * Database schema for group assignments
 * Indexes: transaction_id, group_id, [company_id+group_id], [transaction_id+group_id]
 */
export const transactionGroupAssignmentsSchema =
  'id, transaction_id, line_item_id, group_id, company_id, [company_id+group_id], [transaction_id+group_id], created_at, updated_at, deleted_at';

/**
 * Default groups that can be auto-created for new companies
 */
export const DEFAULT_TRANSACTION_GROUPS: Omit<TransactionGroup, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version_vector'>[] = [
  {
    company_id: '', // Will be set when creating
    name: 'Operating Expenses',
    description: 'Day-to-day business operating costs',
    color: '#4b006e',
    icon: 'building',
    parent_id: null,
    is_active: true,
    display_order: 1,
  },
  {
    company_id: '',
    name: 'Marketing',
    description: 'Advertising, promotions, and marketing expenses',
    color: '#1e3a5f',
    icon: 'megaphone',
    parent_id: null,
    is_active: true,
    display_order: 2,
  },
  {
    company_id: '',
    name: 'Travel',
    description: 'Business travel and transportation',
    color: '#134e4a',
    icon: 'plane',
    parent_id: null,
    is_active: true,
    display_order: 3,
  },
  {
    company_id: '',
    name: 'Office Supplies',
    description: 'Office equipment and supplies',
    color: '#92400e',
    icon: 'paperclip',
    parent_id: null,
    is_active: true,
    display_order: 4,
  },
  {
    company_id: '',
    name: 'Professional Services',
    description: 'Legal, accounting, consulting fees',
    color: '#742a2a',
    icon: 'briefcase',
    parent_id: null,
    is_active: true,
    display_order: 5,
  },
  {
    company_id: '',
    name: 'Utilities',
    description: 'Electric, water, internet, phone',
    color: '#1a4731',
    icon: 'lightning',
    parent_id: null,
    is_active: true,
    display_order: 6,
  },
  {
    company_id: '',
    name: 'Inventory',
    description: 'Products and materials for resale',
    color: '#7c2d12',
    icon: 'box',
    parent_id: null,
    is_active: true,
    display_order: 7,
  },
  {
    company_id: '',
    name: 'Equipment',
    description: 'Business equipment and machinery',
    color: '#334155',
    icon: 'tool',
    parent_id: null,
    is_active: true,
    display_order: 8,
  },
];

export type { TransactionGroup, TransactionGroupAssignment };
