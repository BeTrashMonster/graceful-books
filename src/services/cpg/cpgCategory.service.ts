/**
 * CPG Category Service
 *
 * Handles category management including the special Shipping + Handling category
 * that distributes costs to other line items on invoices.
 */

import { nanoid } from 'nanoid';
import { db } from '../../db/database';
import {
  createShippingHandlingCategory,
  type CPGCategory,
} from '../../db/schema/cpg.schema';

export class CPGCategoryService {
  /**
   * Ensures the Shipping + Handling distribution category exists for a company
   * This category is special - it distributes its costs to other line items
   *
   * @param companyId - The company ID
   * @param deviceId - The device ID for version vector
   * @returns The S+H category (existing or newly created)
   */
  static async ensureShippingHandlingCategory(
    companyId: string,
    deviceId: string
  ): Promise<CPGCategory> {
    // Check if S+H category already exists
    const existing = await db.cpgCategories
      .where('company_id')
      .equals(companyId)
      .filter((cat) => cat.is_distribution_category && cat.active)
      .first();

    if (existing) {
      return existing;
    }

    // Create new S+H category
    const shCategory = createShippingHandlingCategory(companyId, deviceId);
    const id = nanoid();

    const fullCategory: CPGCategory = {
      id,
      ...shCategory,
    } as CPGCategory;

    await db.cpgCategories.add(fullCategory);

    console.log('[CPGCategory] Created Shipping + Handling category for company:', companyId);

    return fullCategory;
  }

  /**
   * Gets the Shipping + Handling category for a company
   * Returns null if it doesn't exist
   */
  static async getShippingHandlingCategory(
    companyId: string
  ): Promise<CPGCategory | null> {
    const shCategory = await db.cpgCategories
      .where('company_id')
      .equals(companyId)
      .filter((cat) => cat.is_distribution_category && cat.active)
      .first();

    return shCategory || null;
  }

  /**
   * Checks if a category is a distribution category (S+H)
   */
  static isDistributionCategory(category: CPGCategory): boolean {
    return category.is_distribution_category === true;
  }
}
