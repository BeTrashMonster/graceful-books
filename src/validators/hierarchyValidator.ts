/**
 * Hierarchy Validator Service
 *
 * Implements validation logic for hierarchical contact relationships.
 * Prevents circular references, enforces depth limits, and validates parent assignments.
 *
 * Requirements:
 * - G3: Hierarchical Contacts Infrastructure
 * - Section 4.3: Shared Validation Logic (HIERARCHICAL_ACCOUNTS_INTEGRATION_PLAN.md)
 */

import { db } from '../db/database';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Hierarchy Validator Class
 *
 * Provides validation methods for contact hierarchy operations.
 * Ensures data integrity by preventing circular references and enforcing depth limits.
 */
export class HierarchyValidator {
  /**
   * Maximum allowed hierarchy depth (root = 0, max children at level 3)
   */
  static readonly MAX_DEPTH = 3;

  /**
   * Validates parent assignment for a contact
   *
   * Prevents:
   * 1. Self-referencing (contact being its own parent)
   * 2. Circular references (parent being a descendant of child)
   * 3. Exceeding maximum hierarchy depth
   *
   * @param contactId - ID of contact to validate
   * @param proposedParentId - ID of proposed parent contact
   * @returns Validation result with error message if invalid
   */
  static async validateParentAssignment(
    contactId: string,
    proposedParentId: string
  ): Promise<ValidationResult> {
    // Check 1: Can't be own parent
    if (contactId === proposedParentId) {
      return {
        valid: false,
        error: 'A contact cannot be its own parent.',
      };
    }

    // Check 2: Proposed parent isn't already a child of this contact
    const descendants = await this.getDescendants(contactId);
    if (descendants.includes(proposedParentId)) {
      return {
        valid: false,
        error: 'This would create a circular reference.',
      };
    }

    // Check 3: Depth limit (max 3 levels)
    const proposedDepth = (await this.getHierarchyDepth(proposedParentId)) + 1;
    if (proposedDepth > this.MAX_DEPTH) {
      return {
        valid: false,
        error: 'Maximum hierarchy depth (3 levels) exceeded.',
      };
    }

    return { valid: true };
  }

  /**
   * Recursively get all descendants of a contact
   *
   * Returns IDs of all children, grandchildren, etc.
   *
   * @param contactId - ID of contact to get descendants for
   * @returns Array of descendant contact IDs
   */
  private static async getDescendants(contactId: string): Promise<string[]> {
    const children = await db.contacts
      .where('parent_id')
      .equals(contactId)
      .toArray();

    const grandchildren = await Promise.all(
      children.map((child) => this.getDescendants(child.id))
    );

    return [...children.map((c) => c.id), ...grandchildren.flat()];
  }

  /**
   * Calculate depth of hierarchy from root
   *
   * Recursively traverses up the hierarchy to calculate depth.
   * Root contacts (parent_id = null) have depth 0.
   *
   * @param contactId - ID of contact to calculate depth for
   * @returns Depth level (0 = root/standalone, 1 = child, 2 = grandchild, etc.)
   */
  private static async getHierarchyDepth(contactId: string): Promise<number> {
    const contact = await db.contacts.get(contactId);
    if (!contact || !contact.parent_id) return 0;

    return 1 + (await this.getHierarchyDepth(contact.parent_id));
  }
}
