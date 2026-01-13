/**
 * Seed Default Categories
 *
 * Utility to populate default categories for a new company
 */

import { batchCreateCategories } from '../store/categories';
import { STANDARD_CATEGORY_TEMPLATES } from '../db/schema/categories.schema';
import type { Category } from '../db/schema/categories.schema';
import type { EncryptionContext } from '../store/types';

/**
 * Seed default categories for a company
 */
export async function seedDefaultCategories(
  companyId: string,
  context?: EncryptionContext
): Promise<{
  success: boolean;
  created: number;
  failed: number;
  error?: string;
}> {
  try {
    // First, create parent categories (those without a parent)
    const parentTemplates = STANDARD_CATEGORY_TEMPLATES.filter((t) => !t.parent);
    const parentCategories: Array<
      Omit<Category, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version_vector'>
    > = parentTemplates.map((template) => ({
      company_id: companyId,
      name: template.name,
      type: template.type,
      parent_id: null,
      description: template.description,
      color: template.color,
      icon: template.icon,
      active: true,
      is_system: template.is_system,
      sort_order: template.sort_order,
    }));

    const parentResult = await batchCreateCategories(parentCategories, context);

    // Create a map of parent names to IDs
    const parentMap = new Map<string, string>();
    parentResult.successful.forEach((cat) => {
      parentMap.set(cat.name, cat.id);
    });

    // Then, create child categories
    const childTemplates = STANDARD_CATEGORY_TEMPLATES.filter((t) => t.parent);
    const childCategories: Array<
      Omit<Category, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version_vector'>
    > = childTemplates
      .map((template) => {
        const parentId = template.parent ? parentMap.get(template.parent) : null;
        if (!parentId && template.parent) {
          // Parent not found, skip this child
          return null;
        }

        return {
          company_id: companyId,
          name: template.name,
          type: template.type,
          parent_id: parentId || null,
          description: template.description,
          color: template.color,
          icon: template.icon,
          active: true,
          is_system: template.is_system,
          sort_order: template.sort_order,
        };
      })
      .filter((cat): cat is NonNullable<typeof cat> => cat !== null);

    const childResult = await batchCreateCategories(childCategories, context);

    const totalCreated =
      parentResult.successful.length + childResult.successful.length;
    const totalFailed = parentResult.failed.length + childResult.failed.length;

    return {
      success: totalFailed === 0,
      created: totalCreated,
      failed: totalFailed,
    };
  } catch (error) {
    return {
      success: false,
      created: 0,
      failed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if default categories have been seeded
 */
export async function hasDefaultCategories(companyId: string): Promise<boolean> {
  const { db } = await import('../store/database');
  const count = await db.categories
    .where('company_id')
    .equals(companyId)
    .and((cat) => cat.is_system && !cat.deleted_at)
    .count();

  return count > 0;
}

/**
 * Seed default categories if not already present
 */
export async function ensureDefaultCategories(
  companyId: string,
  context?: EncryptionContext
): Promise<void> {
  const exists = await hasDefaultCategories(companyId);
  if (!exists) {
    await seedDefaultCategories(companyId, context);
  }
}
