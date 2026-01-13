/**
 * Categories Data Access Layer
 *
 * Provides CRUD operations for categories with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Hierarchical category support
 */

import { nanoid } from 'nanoid';
import { db } from './database';
import type {
  DatabaseResult,
  DatabaseError,
  EncryptionContext,
  VersionVector,
  BatchResult,
} from './types';
import type {
  Category,
  CategoryType,
  CategoryTreeNode,
  GetCategoriesQuery,
} from '../db/schema/categories.schema';
import {
  createDefaultCategory,
  validateCategory,
  validateCategoryTypeMatchesParent,
  buildCategoryTree,
} from '../db/schema/categories.schema';

/**
 * Generate current device ID (stored in localStorage)
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = nanoid();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

/**
 * Initialize version vector for a new entity
 */

/**
 * Increment version vector for an update
 */
function incrementVersionVector(current: VersionVector): VersionVector {
  const deviceId = getDeviceId();
  return {
    ...current,
    [deviceId]: (current[deviceId] || 0) + 1,
  };
}

/**
 * Create a new category
 */
export async function createCategory(
  category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version_vector'>,
  context?: EncryptionContext
): Promise<DatabaseResult<Category>> {
  try {
    // Validate category
    const errors = validateCategory(category);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.join(', '),
        },
      };
    }

    // Validate parent category type matches if sub-category
    if (category.parent_id) {
      const parent = await db.categories.get(category.parent_id);
      if (!parent) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parent category not found',
          },
        };
      }
      if (parent.deleted_at) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parent category has been deleted',
          },
        };
      }
      if (!validateCategoryTypeMatchesParent(category as Category, parent)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Sub-category type must match parent category type',
          },
        };
      }
    }

    // Create entity with CRDT fields
    const deviceId = getDeviceId();
    let entity: Category = {
      id: nanoid(),
      ...createDefaultCategory(
        category.company_id,
        category.name,
        category.type,
        deviceId
      ),
      ...category,
    } as Category;

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context;
      entity = {
        ...entity,
        name: await encryptionService.encrypt(entity.name),
        description: entity.description
          ? await encryptionService.encrypt(entity.description)
          : null,
      };
    }

    // Store in database
    await db.categories.add(entity);

    // Decrypt for return
    let result = entity;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...entity,
        name: await encryptionService.decrypt(entity.name),
        description: entity.description
          ? await encryptionService.decrypt(entity.description)
          : null,
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get category by ID
 */
export async function getCategory(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Category>> {
  try {
    const entity = await db.categories.get(id);

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Category not found: ${id}`,
        },
      };
    }

    // Check if soft deleted
    if (entity.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Category has been deleted: ${id}`,
        },
      };
    }

    // Decrypt if service provided
    let result = entity;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...entity,
        name: await encryptionService.decrypt(entity.name),
        description: entity.description
          ? await encryptionService.decrypt(entity.description)
          : null,
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Update an existing category
 */
export async function updateCategory(
  id: string,
  updates: Partial<Omit<Category, 'id' | 'company_id' | 'created_at' | 'version_vector'>>,
  context?: EncryptionContext
): Promise<DatabaseResult<Category>> {
  try {
    const existing = await db.categories.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Category not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Category has been deleted: ${id}`,
        },
      };
    }

    // Validate type change (if changing type)
    if (updates.type && updates.type !== existing.type) {
      // Check if category has children
      const children = await db.categories
        .where('parent_id')
        .equals(id)
        .and((cat) => !cat.deleted_at)
        .count();

      if (children > 0) {
        return {
          success: false,
          error: {
            code: 'CONSTRAINT_VIOLATION',
            message: 'Cannot change category type when sub-categories exist',
          },
        };
      }
    }

    // Prepare updated entity
    const now = Date.now();

    let updated: Category = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      company_id: existing.company_id, // Ensure companyId doesn't change
      created_at: existing.created_at, // Preserve creation date
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector),
    };

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context;
      if (updates.name) {
        updated.name = await encryptionService.encrypt(updates.name);
      }
      if (updates.description !== undefined) {
        updated.description = updates.description
          ? await encryptionService.encrypt(updates.description)
          : null;
      }
    }

    // Update in database
    await db.categories.put(updated);

    // Decrypt for return
    let result = updated;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...updated,
        name: await encryptionService.decrypt(updated.name),
        description: updated.description
          ? await encryptionService.decrypt(updated.description)
          : null,
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Delete a category (soft delete with tombstone)
 */
export async function deleteCategory(id: string): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.categories.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Category not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return { success: true, data: undefined }; // Already deleted
    }

    // Prevent deletion of system categories
    if (existing.is_system) {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot delete system category',
        },
      };
    }

    // Check for sub-categories
    const children = await db.categories
      .where('parent_id')
      .equals(id)
      .and((cat) => !cat.deleted_at)
      .count();

    if (children > 0) {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot delete category with active sub-categories',
        },
      };
    }

    // Soft delete with tombstone marker
    const now = Date.now();

    await db.categories.update(id, {
      deleted_at: now,
      version_vector: incrementVersionVector(existing.version_vector),
      updated_at: now,
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Query categories with filters
 */
export async function queryCategories(
  filter: GetCategoriesQuery,
  context?: EncryptionContext
): Promise<DatabaseResult<Category[]>> {
  try {
    let query = db.categories.toCollection();

    // Apply filters
    if (filter.company_id) {
      query = db.categories.where('company_id').equals(filter.company_id);
    }

    if (filter.type && filter.company_id) {
      query = db.categories
        .where('[company_id+type]')
        .equals([filter.company_id, filter.type]);
    }

    if (filter.active !== undefined) {
      query = query.and((cat) => cat.active === filter.active);
    }

    if (filter.parent_id !== undefined) {
      query = query.and((cat) => cat.parent_id === filter.parent_id);
    }

    // Always filter out deleted
    query = query.and((cat) => !cat.deleted_at);

    const entities = await query.toArray();

    // Decrypt if service provided
    let results = entities;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      results = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          name: await encryptionService.decrypt(entity.name),
          description: entity.description
            ? await encryptionService.decrypt(entity.description)
            : null,
        }))
      );
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get all categories for a company (hierarchical structure)
 */
export async function getCategoriesHierarchy(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<CategoryTreeNode[]>> {
  const result = await queryCategories({ company_id: companyId }, context);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }

  // Build tree structure
  const tree = buildCategoryTree(result.data);

  return { success: true, data: tree };
}

/**
 * Batch create categories
 */
export async function batchCreateCategories(
  categories: Array<
    Omit<Category, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version_vector'>
  >,
  context?: EncryptionContext
): Promise<BatchResult<Category>> {
  const successful: Category[] = [];
  const failed: Array<{ item: any; error: DatabaseError }> = [];

  for (const category of categories) {
    const result = await createCategory(category, context);
    if (result.success) {
      successful.push(result.data);
    } else {
      failed.push({
        item: category,
        error: result.error,
      });
    }
  }

  return { successful, failed };
}

/**
 * Get categories by type
 */
export async function getCategoriesByType(
  companyId: string,
  type: CategoryType,
  context?: EncryptionContext
): Promise<DatabaseResult<Category[]>> {
  return queryCategories({ company_id: companyId, type }, context);
}

/**
 * Get root categories (no parent)
 */
export async function getRootCategories(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Category[]>> {
  return queryCategories({ company_id: companyId, parent_id: null }, context);
}

/**
 * Get sub-categories of a parent category
 */
export async function getSubCategories(
  parentId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Category[]>> {
  try {
    const parent = await db.categories.get(parentId);
    if (!parent) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Parent category not found',
        },
      };
    }

    return queryCategories(
      { company_id: parent.company_id, parent_id: parentId },
      context
    );
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}
