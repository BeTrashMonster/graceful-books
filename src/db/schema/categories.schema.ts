/**
 * Categories Schema Definition
 *
 * Defines the structure for categories used to organize transactions and accounts.
 * Supports hierarchical categories with parent/child relationships.
 *
 * Requirements:
 * - B8: Categories & Tags - Basic System
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { BaseEntity, VersionVector } from '../../types/database.types';

/**
 * Category type enum
 */
export enum CategoryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  CUSTOM = 'CUSTOM',
}

/**
 * Category entity for organizing transactions and accounts
 */
export interface Category extends BaseEntity {
  company_id: string; // UUID - links to Company
  name: string; // ENCRYPTED - Category name (e.g., "Salary", "Rent")
  type: CategoryType; // Plaintext for querying
  parent_id: string | null; // UUID - For sub-categories (hierarchical)
  description: string | null; // ENCRYPTED - Optional description
  color: string | null; // Hex color code for UI display (e.g., "#FF5733")
  icon: string | null; // Icon identifier (e.g., "wallet", "shopping-cart")
  active: boolean; // Whether the category is currently active
  is_system: boolean; // Whether this is a system-defined category (cannot be deleted)
  sort_order: number; // Sort order within the same parent
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema definition for Categories table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying categories by company
 * - type: For querying categories by type
 * - [company_id+type]: Compound index for type-filtered queries
 * - [company_id+active]: Compound index for active category queries
 * - parent_id: For querying sub-categories
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const categoriesSchema =
  'id, company_id, type, [company_id+type], [company_id+active], parent_id, updated_at, deleted_at';

/**
 * Table name constant
 */
export const CATEGORIES_TABLE = 'categories';

/**
 * Default values for new Category
 */
export const createDefaultCategory = (
  companyId: string,
  name: string,
  type: CategoryType,
  deviceId: string
): Partial<Category> => {
  const now = Date.now();

  return {
    company_id: companyId,
    name,
    type,
    parent_id: null,
    description: null,
    color: null,
    icon: null,
    active: true,
    is_system: false,
    sort_order: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure sub-category type matches parent type
 */
export const validateCategoryTypeMatchesParent = (
  category: Category,
  parentCategory: Category | null
): boolean => {
  if (!category.parent_id || !parentCategory) {
    return true; // No parent, no constraint
  }

  return category.type === parentCategory.type;
};

/**
 * Validation: Ensure category has required fields
 */
export const validateCategory = (category: Partial<Category>): string[] => {
  const errors: string[] = [];

  if (!category.company_id) {
    errors.push('company_id is required');
  }

  if (!category.name || category.name.trim() === '') {
    errors.push('name is required');
  }

  if (!category.type) {
    errors.push('type is required');
  }

  if (category.color && !/^#[0-9A-Fa-f]{6}$/.test(category.color)) {
    errors.push('color must be a valid hex color code');
  }

  return errors;
};

/**
 * Query helper: Get all categories for a company
 */
export interface GetCategoriesQuery {
  company_id: string;
  type?: CategoryType;
  active?: boolean;
  parent_id?: string | null;
}

/**
 * Category tree node for hierarchical display
 */
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  level: number;
  path: string[]; // Array of ancestor IDs from root to this node
}

/**
 * Standard category templates for quick setup
 */
export interface CategoryTemplate {
  name: string;
  type: CategoryType;
  parent?: string; // Parent category name (for hierarchical setup)
  description: string;
  color: string;
  icon: string;
  is_system: boolean;
  sort_order: number;
}

export const STANDARD_CATEGORY_TEMPLATES: CategoryTemplate[] = [
  // Income Categories
  {
    name: 'Income',
    type: CategoryType.INCOME,
    description: 'All income sources',
    color: '#10B981',
    icon: 'trending-up',
    is_system: true,
    sort_order: 1,
  },
  {
    name: 'Salary',
    type: CategoryType.INCOME,
    parent: 'Income',
    description: 'Employment salary and wages',
    color: '#10B981',
    icon: 'briefcase',
    is_system: true,
    sort_order: 1,
  },
  {
    name: 'Consulting',
    type: CategoryType.INCOME,
    parent: 'Income',
    description: 'Consulting and freelance income',
    color: '#10B981',
    icon: 'users',
    is_system: true,
    sort_order: 2,
  },
  {
    name: 'Investment',
    type: CategoryType.INCOME,
    parent: 'Income',
    description: 'Investment returns and dividends',
    color: '#10B981',
    icon: 'trending-up',
    is_system: true,
    sort_order: 3,
  },

  // Expense Categories
  {
    name: 'Expenses',
    type: CategoryType.EXPENSE,
    description: 'All business expenses',
    color: '#EF4444',
    icon: 'trending-down',
    is_system: true,
    sort_order: 2,
  },
  {
    name: 'Rent',
    type: CategoryType.EXPENSE,
    parent: 'Expenses',
    description: 'Office and facility rent',
    color: '#EF4444',
    icon: 'home',
    is_system: true,
    sort_order: 1,
  },
  {
    name: 'Utilities',
    type: CategoryType.EXPENSE,
    parent: 'Expenses',
    description: 'Electricity, water, internet, etc.',
    color: '#EF4444',
    icon: 'zap',
    is_system: true,
    sort_order: 2,
  },
  {
    name: 'Food',
    type: CategoryType.EXPENSE,
    parent: 'Expenses',
    description: 'Meals and food expenses',
    color: '#EF4444',
    icon: 'coffee',
    is_system: true,
    sort_order: 3,
  },
  {
    name: 'Transportation',
    type: CategoryType.EXPENSE,
    parent: 'Expenses',
    description: 'Travel and transportation costs',
    color: '#EF4444',
    icon: 'truck',
    is_system: true,
    sort_order: 4,
  },

  // Asset Categories
  {
    name: 'Assets',
    type: CategoryType.ASSET,
    description: 'All asset accounts',
    color: '#3B82F6',
    icon: 'dollar-sign',
    is_system: true,
    sort_order: 3,
  },
  {
    name: 'Cash',
    type: CategoryType.ASSET,
    parent: 'Assets',
    description: 'Cash and bank accounts',
    color: '#3B82F6',
    icon: 'dollar-sign',
    is_system: true,
    sort_order: 1,
  },
  {
    name: 'Bank',
    type: CategoryType.ASSET,
    parent: 'Assets',
    description: 'Bank accounts',
    color: '#3B82F6',
    icon: 'credit-card',
    is_system: true,
    sort_order: 2,
  },
  {
    name: 'Equipment',
    type: CategoryType.ASSET,
    parent: 'Assets',
    description: 'Equipment and machinery',
    color: '#3B82F6',
    icon: 'tool',
    is_system: true,
    sort_order: 3,
  },

  // Liability Categories
  {
    name: 'Liabilities',
    type: CategoryType.LIABILITY,
    description: 'All liabilities',
    color: '#F59E0B',
    icon: 'alert-circle',
    is_system: true,
    sort_order: 4,
  },
  {
    name: 'Loans',
    type: CategoryType.LIABILITY,
    parent: 'Liabilities',
    description: 'Business loans',
    color: '#F59E0B',
    icon: 'file-text',
    is_system: true,
    sort_order: 1,
  },
  {
    name: 'Credit Cards',
    type: CategoryType.LIABILITY,
    parent: 'Liabilities',
    description: 'Credit card balances',
    color: '#F59E0B',
    icon: 'credit-card',
    is_system: true,
    sort_order: 2,
  },
];

/**
 * Helper: Build category tree from flat list
 */
export const buildCategoryTree = (categories: Category[]): CategoryTreeNode[] => {
  const categoryMap = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  // First pass: create all nodes
  categories.forEach((category) => {
    categoryMap.set(category.id, {
      ...category,
      children: [],
      level: 0,
      path: [],
    });
  });

  // Second pass: build tree structure
  categories.forEach((category) => {
    const node = categoryMap.get(category.id)!;

    if (category.parent_id) {
      const parent = categoryMap.get(category.parent_id);
      if (parent) {
        parent.children.push(node);
        node.level = parent.level + 1;
        node.path = [...parent.path, parent.id];
      } else {
        // Parent not found, treat as root
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  // Sort children by sort_order
  const sortChildren = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((node) => sortChildren(node.children));
  };

  sortChildren(roots);

  return roots;
};

/**
 * Helper: Flatten category tree to list
 */
export const flattenCategoryTree = (tree: CategoryTreeNode[]): Category[] => {
  const result: Category[] = [];

  const traverse = (nodes: CategoryTreeNode[]) => {
    nodes.forEach((node) => {
      const { children, level, path, ...category } = node;
      result.push(category as Category);
      traverse(children);
    });
  };

  traverse(tree);
  return result;
};

/**
 * Helper: Get category path (breadcrumb)
 */
export const getCategoryPath = (
  category: Category,
  allCategories: Category[]
): Category[] => {
  const path: Category[] = [category];
  let current = category;

  while (current.parent_id) {
    const parent = allCategories.find((c) => c.id === current.parent_id);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }

  return path;
};

/**
 * Helper: Check if category has children
 */
export const hasChildren = (
  categoryId: string,
  allCategories: Category[]
): boolean => {
  return allCategories.some((c) => c.parent_id === categoryId);
};
