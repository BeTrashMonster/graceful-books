/**
 * Category Helper Utilities
 *
 * Utility functions for working with categories including:
 * - Category tree manipulation
 * - Category search and filtering
 * - Category path generation
 * - Category validation helpers
 */

import type { Category, CategoryTreeNode, CategoryType } from '../db/schema/categories.schema';

/**
 * Get category depth in hierarchy
 */
export function getCategoryDepth(category: Category, allCategories: Category[]): number {
  let depth = 0;
  let current = category;

  while (current.parent_id) {
    const parent = allCategories.find((c) => c.id === current.parent_id);
    if (!parent) break;
    depth++;
    current = parent;
  }

  return depth;
}

/**
 * Get all descendants of a category
 */
export function getCategoryDescendants(
  categoryId: string,
  allCategories: Category[]
): Category[] {
  const descendants: Category[] = [];
  const queue: string[] = [categoryId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = allCategories.filter((c) => c.parent_id === currentId);

    descendants.push(...children);
    queue.push(...children.map((c) => c.id));
  }

  return descendants;
}

/**
 * Get all ancestors of a category
 */
export function getCategoryAncestors(
  category: Category,
  allCategories: Category[]
): Category[] {
  const ancestors: Category[] = [];
  let current = category;

  while (current.parent_id) {
    const parent = allCategories.find((c) => c.id === current.parent_id);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }

  return ancestors;
}

/**
 * Get category breadcrumb path
 */
export function getCategoryBreadcrumb(
  category: Category,
  allCategories: Category[]
): string {
  const ancestors = getCategoryAncestors(category, allCategories);
  const path = [...ancestors, category];
  return path.map((c) => c.name).join(' > ');
}

/**
 * Check if a category is an ancestor of another
 */
export function isAncestor(
  possibleAncestorId: string,
  categoryId: string,
  allCategories: Category[]
): boolean {
  let current = allCategories.find((c) => c.id === categoryId);

  while (current?.parent_id) {
    if (current.parent_id === possibleAncestorId) {
      return true;
    }
    current = allCategories.find((c) => c.id === current!.parent_id);
  }

  return false;
}

/**
 * Check if a category is a descendant of another
 */
export function isDescendant(
  possibleDescendantId: string,
  categoryId: string,
  allCategories: Category[]
): boolean {
  return isAncestor(categoryId, possibleDescendantId, allCategories);
}

/**
 * Get root category of a category
 */
export function getRootCategory(category: Category, allCategories: Category[]): Category {
  let current = category;

  while (current.parent_id) {
    const parent = allCategories.find((c) => c.id === current.parent_id);
    if (!parent) break;
    current = parent;
  }

  return current;
}

/**
 * Filter categories by type
 */
export function filterCategoriesByType(
  categories: Category[],
  type: CategoryType
): Category[] {
  return categories.filter((c) => c.type === type);
}

/**
 * Filter categories by active status
 */
export function filterActiveCategories(categories: Category[]): Category[] {
  return categories.filter((c) => c.active);
}

/**
 * Filter categories by search term
 */
export function searchCategories(categories: Category[], searchTerm: string): Category[] {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return categories;

  return categories.filter(
    (c) =>
      c.name.toLowerCase().includes(term) ||
      c.description?.toLowerCase().includes(term)
  );
}

/**
 * Sort categories by sort order
 */
export function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    // First by type
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    // Then by sort order
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }
    // Finally by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get category siblings (categories with the same parent)
 */
export function getCategorySiblings(
  category: Category,
  allCategories: Category[]
): Category[] {
  return allCategories.filter(
    (c) => c.parent_id === category.parent_id && c.id !== category.id
  );
}

/**
 * Get category children count
 */
export function getCategoryChildrenCount(
  categoryId: string,
  allCategories: Category[]
): number {
  return allCategories.filter((c) => c.parent_id === categoryId).length;
}

/**
 * Check if category can be deleted
 */
export function canDeleteCategory(
  category: Category,
  allCategories: Category[]
): { canDelete: boolean; reason?: string } {
  if (category.is_system) {
    return { canDelete: false, reason: 'Cannot delete system category' };
  }

  const childrenCount = getCategoryChildrenCount(category.id, allCategories);
  if (childrenCount > 0) {
    return {
      canDelete: false,
      reason: `Cannot delete category with ${childrenCount} sub-categories`,
    };
  }

  return { canDelete: true };
}

/**
 * Check if category can be moved to new parent
 */
export function canMoveCategory(
  category: Category,
  newParentId: string | null,
  allCategories: Category[]
): { canMove: boolean; reason?: string } {
  if (!newParentId) {
    // Moving to root is always allowed
    return { canMove: true };
  }

  const newParent = allCategories.find((c) => c.id === newParentId);
  if (!newParent) {
    return { canMove: false, reason: 'New parent category not found' };
  }

  if (newParent.type !== category.type) {
    return { canMove: false, reason: 'Parent category must have the same type' };
  }

  // Cannot move to self or descendant
  if (newParentId === category.id || isAncestor(category.id, newParentId, allCategories)) {
    return { canMove: false, reason: 'Cannot move category to itself or its descendant' };
  }

  return { canMove: true };
}

/**
 * Flatten category tree to array with indentation
 */
export function flattenCategoryTreeWithIndent(
  tree: CategoryTreeNode[]
): Array<CategoryTreeNode & { indent: string }> {
  const result: Array<CategoryTreeNode & { indent: string }> = [];

  const traverse = (nodes: CategoryTreeNode[], level: number = 0) => {
    nodes.forEach((node) => {
      result.push({
        ...node,
        indent: '  '.repeat(level),
      });
      if (node.children.length > 0) {
        traverse(node.children, level + 1);
      }
    });
  };

  traverse(tree);
  return result;
}

/**
 * Find category by name
 */
export function findCategoryByName(
  categories: Category[],
  name: string,
  parentId?: string | null
): Category | undefined {
  const normalized = name.toLowerCase().trim();
  return categories.find(
    (c) =>
      c.name.toLowerCase() === normalized &&
      (parentId === undefined || c.parent_id === parentId)
  );
}

/**
 * Get category icon with fallback
 */
export function getCategoryIcon(category: Category): string {
  if (category.icon) {
    return category.icon;
  }

  // Fallback icons based on type
  const typeIcons: Record<CategoryType, string> = {
    INCOME: 'trending-up',
    EXPENSE: 'trending-down',
    ASSET: 'dollar-sign',
    LIABILITY: 'alert-circle',
    CUSTOM: 'tag',
  };

  return typeIcons[category.type] || 'tag';
}

/**
 * Get category color with fallback
 */
export function getCategoryColor(category: Category): string {
  if (category.color) {
    return category.color;
  }

  // Fallback colors based on type
  const typeColors: Record<CategoryType, string> = {
    INCOME: '#10B981',
    EXPENSE: '#EF4444',
    ASSET: '#3B82F6',
    LIABILITY: '#F59E0B',
    CUSTOM: '#6B7280',
  };

  return typeColors[category.type] || '#6B7280';
}

/**
 * Group categories by type
 */
export function groupCategoriesByType(
  categories: Category[]
): Record<CategoryType, Category[]> {
  const groups: Record<CategoryType, Category[]> = {
    INCOME: [],
    EXPENSE: [],
    ASSET: [],
    LIABILITY: [],
    CUSTOM: [],
  };

  categories.forEach((category) => {
    groups[category.type].push(category);
  });

  return groups;
}

/**
 * Get category path as array
 */
export function getCategoryPathArray(
  category: Category,
  allCategories: Category[]
): Category[] {
  const ancestors = getCategoryAncestors(category, allCategories);
  return [...ancestors, category];
}

/**
 * Calculate total categories in tree
 */
export function getTotalCategoriesInTree(tree: CategoryTreeNode[]): number {
  let total = 0;

  const count = (nodes: CategoryTreeNode[]) => {
    nodes.forEach((node) => {
      total++;
      if (node.children.length > 0) {
        count(node.children);
      }
    });
  };

  count(tree);
  return total;
}

/**
 * Find category in tree by ID
 */
export function findCategoryInTree(
  tree: CategoryTreeNode[],
  categoryId: string
): CategoryTreeNode | undefined {
  for (const node of tree) {
    if (node.id === categoryId) {
      return node;
    }
    if (node.children.length > 0) {
      const found = findCategoryInTree(node.children, categoryId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Get max depth of category tree
 */
export function getMaxTreeDepth(tree: CategoryTreeNode[]): number {
  let maxDepth = 0;

  const getDepth = (nodes: CategoryTreeNode[], depth: number = 0) => {
    nodes.forEach((node) => {
      maxDepth = Math.max(maxDepth, depth);
      if (node.children.length > 0) {
        getDepth(node.children, depth + 1);
      }
    });
  };

  getDepth(tree);
  return maxDepth;
}

/**
 * Validate category hierarchy (check for cycles)
 */
export function validateCategoryHierarchy(categories: Category[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  categories.forEach((category) => {
    // Check for self-reference
    if (category.parent_id === category.id) {
      errors.push(`Category "${category.name}" references itself as parent`);
    }

    // Check for cycles
    const visited = new Set<string>();
    let current = category;

    while (current.parent_id) {
      if (visited.has(current.id)) {
        errors.push(`Circular reference detected in category "${category.name}"`);
        break;
      }
      visited.add(current.id);

      const parent = categories.find((c) => c.id === current.parent_id);
      if (!parent) {
        errors.push(`Category "${current.name}" has non-existent parent`);
        break;
      }

      current = parent;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
