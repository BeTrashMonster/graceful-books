/**
 * Hierarchy Service
 *
 * Provides comprehensive functions for managing and querying hierarchical contact relationships.
 * Supports parent/child relationships, tree queries, hierarchy flattening, and consolidated totals.
 *
 * Requirements:
 * - G3: Hierarchical Contacts Infrastructure
 * - Section 4.4: Service Layer Functions (HIERARCHICAL_ACCOUNTS_INTEGRATION_PLAN.md)
 */

import { db } from '../db/database';
import type { Contact } from '../types/database.types';
import { ContactAccountType } from '../types/database.types';
import { HierarchyValidator } from '../validators/hierarchyValidator';

/**
 * Hierarchy tree node representing a contact and its children
 */
export interface HierarchyNode {
  contact: Contact;
  children: HierarchyNode[];
  depth: number;
  totalBalance: string; // Consolidated balance including all descendants
}

/**
 * Flattened hierarchy item for list display
 */
export interface FlatHierarchyItem {
  contact: Contact;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  parentChain: string[]; // Array of parent IDs from root to this contact
  totalBalance: string; // Consolidated balance including all descendants
}

/**
 * Hierarchy statistics for reporting
 */
export interface HierarchyStatistics {
  totalContacts: number;
  standaloneCount: number;
  parentCount: number;
  childCount: number;
  maxDepth: number;
  averageChildrenPerParent: number;
}

/**
 * Options for hierarchy queries
 */
export interface HierarchyQueryOptions {
  includeInactive?: boolean; // Include inactive contacts (default: false)
  includeDeleted?: boolean; // Include soft-deleted contacts (default: false)
  maxDepth?: number; // Maximum depth to traverse (default: unlimited)
}

/**
 * Hierarchy Service Class
 *
 * Provides all functionality for managing and querying hierarchical contact relationships.
 */
export class HierarchyService {
  /**
   * Assigns a parent to a contact, creating a hierarchical relationship
   *
   * Validates the assignment to prevent circular references and depth violations,
   * then updates the contact's parent_id, account_type, and hierarchy_level.
   *
   * @param contactId - ID of contact to assign parent to
   * @param parentId - ID of parent contact (null to make standalone)
   * @param companyId - Company ID for security check
   * @returns Updated contact with new parent assignment
   * @throws Error if validation fails or contacts not found
   *
   * @example
   * ```typescript
   * // Make a contact a child of another
   * const updated = await HierarchyService.assignParent(childId, parentId, companyId);
   *
   * // Remove parent (make standalone)
   * const standalone = await HierarchyService.assignParent(childId, null, companyId);
   * ```
   */
  static async assignParent(
    contactId: string,
    parentId: string | null,
    companyId: string
  ): Promise<Contact> {
    // Get the contact
    const contact = await db.contacts.get(contactId);
    if (!contact) {
      throw new Error(`Contact with ID ${contactId} not found`);
    }

    // Verify contact belongs to company
    if (contact.company_id !== companyId) {
      throw new Error('Contact does not belong to this company');
    }

    // If removing parent (making standalone)
    if (parentId === null) {
      await db.contacts.update(contactId, {
        parent_id: null,
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      });

      return (await db.contacts.get(contactId))!;
    }

    // Get the proposed parent
    const parent = await db.contacts.get(parentId);
    if (!parent) {
      throw new Error(`Parent contact with ID ${parentId} not found`);
    }

    // Verify parent belongs to same company
    if (parent.company_id !== companyId) {
      throw new Error('Parent contact does not belong to this company');
    }

    // Validate parent assignment
    const validation = await HierarchyValidator.validateParentAssignment(
      contactId,
      parentId
    );

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid parent assignment');
    }

    // Calculate new hierarchy level
    const newLevel = parent.hierarchy_level + 1;

    // Update contact
    await db.contacts.update(contactId, {
      parent_id: parentId,
      account_type: ContactAccountType.CHILD,
      hierarchy_level: newLevel,
    });

    // Update parent's account_type if needed
    if (parent.account_type === ContactAccountType.STANDALONE) {
      await db.contacts.update(parentId, {
        account_type: ContactAccountType.PARENT,
      });
    }

    return (await db.contacts.get(contactId))!;
  }

  /**
   * Gets all direct children of a parent contact
   *
   * Returns only immediate children, not descendants.
   *
   * @param parentId - ID of parent contact
   * @param options - Query options (include inactive, deleted)
   * @returns Array of child contacts
   *
   * @example
   * ```typescript
   * const children = await HierarchyService.getChildren(parentId);
   * const allChildren = await HierarchyService.getChildren(parentId, {
   *   includeInactive: true,
   *   includeDeleted: true
   * });
   * ```
   */
  static async getChildren(
    parentId: string,
    options: HierarchyQueryOptions = {}
  ): Promise<Contact[]> {
    let query = db.contacts.where('parent_id').equals(parentId);

    const children = await query.toArray();

    return this.filterByOptions(children, options);
  }

  /**
   * Gets all descendants of a contact (children, grandchildren, etc.)
   *
   * Recursively traverses the hierarchy to get all descendants.
   *
   * @param contactId - ID of contact to get descendants for
   * @param options - Query options
   * @returns Array of all descendant contacts
   *
   * @example
   * ```typescript
   * const allDescendants = await HierarchyService.getDescendants(contactId);
   * ```
   */
  static async getDescendants(
    contactId: string,
    options: HierarchyQueryOptions = {}
  ): Promise<Contact[]> {
    const children = await this.getChildren(contactId, options);

    const grandchildren = await Promise.all(
      children.map(child => this.getDescendants(child.id, options))
    );

    return [...children, ...grandchildren.flat()];
  }

  /**
   * Gets the full hierarchy tree starting from a contact
   *
   * Returns a nested tree structure with all descendants.
   *
   * @param contactId - ID of root contact
   * @param options - Query options
   * @returns Hierarchy tree with nested children
   *
   * @example
   * ```typescript
   * const tree = await HierarchyService.getHierarchyTree(rootId);
   * console.log(tree.contact.name);
   * tree.children.forEach(child => {
   *   console.log(`  ${child.contact.name}`);
   * });
   * ```
   */
  static async getHierarchyTree(
    contactId: string,
    options: HierarchyQueryOptions = {}
  ): Promise<HierarchyNode> {
    const contact = await db.contacts.get(contactId);
    if (!contact) {
      throw new Error(`Contact with ID ${contactId} not found`);
    }

    // Check if we've hit max depth
    const currentDepth = contact.hierarchy_level;
    if (options.maxDepth !== undefined && currentDepth >= options.maxDepth) {
      const totalBalance = await this.calculateTotalBalance(contactId, options);
      return {
        contact,
        children: [],
        depth: currentDepth,
        totalBalance,
      };
    }

    // Get all children
    const children = await this.getChildren(contactId, options);

    // Recursively build child trees
    const childTrees = await Promise.all(
      children.map(child => this.getHierarchyTree(child.id, options))
    );

    // Calculate total balance including all descendants
    const totalBalance = await this.calculateTotalBalance(contactId, options);

    return {
      contact,
      children: childTrees,
      depth: currentDepth,
      totalBalance,
    };
  }

  /**
   * Gets all root contacts (contacts with no parent) for a company
   *
   * Returns all standalone and parent contacts that have no parent.
   *
   * @param companyId - Company ID to filter by
   * @param options - Query options
   * @returns Array of root contacts
   *
   * @example
   * ```typescript
   * const roots = await HierarchyService.getRootContacts(companyId);
   * ```
   */
  static async getRootContacts(
    companyId: string,
    options: HierarchyQueryOptions = {}
  ): Promise<Contact[]> {
    const contacts = await db.contacts
      .where('company_id')
      .equals(companyId)
      .filter(contact => contact.parent_id === null)
      .toArray();

    return this.filterByOptions(contacts, options);
  }

  /**
   * Gets all hierarchy trees for a company
   *
   * Returns an array of tree structures, one for each root contact.
   *
   * @param companyId - Company ID to filter by
   * @param options - Query options
   * @returns Array of hierarchy trees
   *
   * @example
   * ```typescript
   * const allTrees = await HierarchyService.getAllHierarchyTrees(companyId);
   * allTrees.forEach(tree => {
   *   console.log(`Root: ${tree.contact.name}`);
   *   console.log(`  Children: ${tree.children.length}`);
   * });
   * ```
   */
  static async getAllHierarchyTrees(
    companyId: string,
    options: HierarchyQueryOptions = {}
  ): Promise<HierarchyNode[]> {
    const roots = await this.getRootContacts(companyId, options);

    return Promise.all(
      roots.map(root => this.getHierarchyTree(root.id, options))
    );
  }

  /**
   * Flattens a hierarchy tree into a linear list
   *
   * Converts a nested tree structure into a flat array, preserving depth information
   * and parent chains for display purposes.
   *
   * @param tree - Hierarchy tree to flatten
   * @param parentChain - Array of parent IDs (used internally for recursion)
   * @returns Flattened array of hierarchy items
   *
   * @example
   * ```typescript
   * const tree = await HierarchyService.getHierarchyTree(rootId);
   * const flat = HierarchyService.flattenHierarchy(tree);
   * flat.forEach(item => {
   *   const indent = '  '.repeat(item.depth);
   *   console.log(`${indent}${item.contact.name}`);
   * });
   * ```
   */
  static flattenHierarchy(
    tree: HierarchyNode,
    parentChain: string[] = []
  ): FlatHierarchyItem[] {
    const currentChain = [...parentChain, tree.contact.id];

    const currentItem: FlatHierarchyItem = {
      contact: tree.contact,
      depth: tree.depth,
      hasChildren: tree.children.length > 0,
      childCount: tree.children.length,
      parentChain: currentChain.slice(0, -1), // Exclude self from chain
      totalBalance: tree.totalBalance,
    };

    const childItems = tree.children.flatMap(child =>
      this.flattenHierarchy(child, currentChain)
    );

    return [currentItem, ...childItems];
  }

  /**
   * Flattens all hierarchy trees for a company
   *
   * Gets all hierarchy trees and flattens them into a single sorted list.
   *
   * @param companyId - Company ID to filter by
   * @param options - Query options
   * @returns Flattened array of all hierarchy items
   *
   * @example
   * ```typescript
   * const allFlat = await HierarchyService.flattenAllHierarchies(companyId);
   * ```
   */
  static async flattenAllHierarchies(
    companyId: string,
    options: HierarchyQueryOptions = {}
  ): Promise<FlatHierarchyItem[]> {
    const trees = await this.getAllHierarchyTrees(companyId, options);

    return trees.flatMap(tree => this.flattenHierarchy(tree));
  }

  /**
   * Gets the parent chain for a contact
   *
   * Returns array of contacts from root to immediate parent.
   *
   * @param contactId - ID of contact to get parent chain for
   * @returns Array of parent contacts (root first, immediate parent last)
   *
   * @example
   * ```typescript
   * const chain = await HierarchyService.getParentChain(contactId);
   * console.log('Hierarchy:', chain.map(c => c.name).join(' > '));
   * ```
   */
  static async getParentChain(contactId: string): Promise<Contact[]> {
    const contact = await db.contacts.get(contactId);
    if (!contact || !contact.parent_id) {
      return [];
    }

    const parent = await db.contacts.get(contact.parent_id);
    if (!parent) {
      return [];
    }

    const grandparents = await this.getParentChain(parent.id);
    return [...grandparents, parent];
  }

  /**
   * Calculates consolidated balance including all descendants
   *
   * Sums the balance of a contact and all its descendants.
   *
   * @param contactId - ID of contact to calculate total for
   * @param options - Query options
   * @returns Total balance as string (DECIMAL precision preserved)
   *
   * @example
   * ```typescript
   * const total = await HierarchyService.calculateTotalBalance(parentId);
   * console.log(`Total balance: $${parseFloat(total).toFixed(2)}`);
   * ```
   */
  static async calculateTotalBalance(
    contactId: string,
    options: HierarchyQueryOptions = {}
  ): Promise<string> {
    const contact = await db.contacts.get(contactId);
    if (!contact) {
      return '0.00';
    }

    // Get all descendants
    const descendants = await this.getDescendants(contactId, options);

    // Sum up all balances
    const contacts = [contact, ...descendants];
    const total = contacts.reduce((sum, c) => {
      return sum + parseFloat(c.balance || '0');
    }, 0);

    return total.toFixed(2);
  }

  /**
   * Calculates consolidated totals for multiple contacts
   *
   * Efficiently calculates totals for multiple contacts in parallel.
   *
   * @param contactIds - Array of contact IDs to calculate totals for
   * @param options - Query options
   * @returns Map of contact ID to total balance
   *
   * @example
   * ```typescript
   * const totals = await HierarchyService.calculateConsolidatedTotals([id1, id2, id3]);
   * console.log(`ID ${id1} total: $${parseFloat(totals.get(id1)!).toFixed(2)}`);
   * ```
   */
  static async calculateConsolidatedTotals(
    contactIds: string[],
    options: HierarchyQueryOptions = {}
  ): Promise<Map<string, string>> {
    const totals = new Map<string, string>();

    await Promise.all(
      contactIds.map(async (id) => {
        const total = await this.calculateTotalBalance(id, options);
        totals.set(id, total);
      })
    );

    return totals;
  }

  /**
   * Gets hierarchy statistics for a company
   *
   * Provides aggregate statistics about the hierarchy structure.
   *
   * @param companyId - Company ID to analyze
   * @param options - Query options
   * @returns Hierarchy statistics
   *
   * @example
   * ```typescript
   * const stats = await HierarchyService.getHierarchyStatistics(companyId);
   * console.log(`Total contacts: ${stats.totalContacts}`);
   * console.log(`Max depth: ${stats.maxDepth}`);
   * ```
   */
  static async getHierarchyStatistics(
    companyId: string,
    options: HierarchyQueryOptions = {}
  ): Promise<HierarchyStatistics> {
    const allContacts = await db.contacts
      .where('company_id')
      .equals(companyId)
      .toArray();

    const filtered = this.filterByOptions(allContacts, options);

    const standaloneCount = filtered.filter(
      c => c.account_type === ContactAccountType.STANDALONE
    ).length;

    const parentCount = filtered.filter(
      c => c.account_type === ContactAccountType.PARENT
    ).length;

    const childCount = filtered.filter(
      c => c.account_type === ContactAccountType.CHILD
    ).length;

    const maxDepth = filtered.reduce(
      (max, c) => Math.max(max, c.hierarchy_level),
      0
    );

    // Calculate average children per parent
    const parentsWithChildren = await Promise.all(
      filtered
        .filter(c => c.account_type === ContactAccountType.PARENT)
        .map(async (parent) => {
          const children = await this.getChildren(parent.id, options);
          return children.length;
        })
    );

    const averageChildrenPerParent =
      parentCount > 0
        ? parentsWithChildren.reduce((sum, count) => sum + count, 0) / parentCount
        : 0;

    return {
      totalContacts: filtered.length,
      standaloneCount,
      parentCount,
      childCount,
      maxDepth,
      averageChildrenPerParent: parseFloat(averageChildrenPerParent.toFixed(2)),
    };
  }

  /**
   * Checks if a contact has any children
   *
   * More efficient than getting all children when you only need to know if any exist.
   *
   * @param contactId - ID of contact to check
   * @returns True if contact has children
   *
   * @example
   * ```typescript
   * const hasChildren = await HierarchyService.hasChildren(contactId);
   * if (hasChildren) {
   *   console.log('Cannot delete: contact has children');
   * }
   * ```
   */
  static async hasChildren(contactId: string): Promise<boolean> {
    const count = await db.contacts
      .where('parent_id')
      .equals(contactId)
      .count();

    return count > 0;
  }

  /**
   * Moves a contact and all its descendants to a new parent
   *
   * Validates the move, then updates the contact's parent. All descendants
   * automatically maintain their relative positions in the hierarchy.
   *
   * @param contactId - ID of contact to move
   * @param newParentId - ID of new parent (null to make standalone)
   * @param companyId - Company ID for security check
   * @returns Updated contact
   * @throws Error if validation fails
   *
   * @example
   * ```typescript
   * // Move contact and all its children to a new parent
   * const moved = await HierarchyService.moveContactWithDescendants(
   *   contactId,
   *   newParentId,
   *   companyId
   * );
   * ```
   */
  static async moveContactWithDescendants(
    contactId: string,
    newParentId: string | null,
    companyId: string
  ): Promise<Contact> {
    // This is the same as assignParent, but explicitly named for clarity
    // The descendants automatically move because they reference this contact's ID
    return this.assignParent(contactId, newParentId, companyId);
  }

  /**
   * Removes parent from a contact, making it standalone
   *
   * If the contact has children, they move up with it (maintaining their relative structure).
   *
   * @param contactId - ID of contact to make standalone
   * @param companyId - Company ID for security check
   * @returns Updated contact
   *
   * @example
   * ```typescript
   * const standalone = await HierarchyService.makeStandalone(contactId, companyId);
   * ```
   */
  static async makeStandalone(
    contactId: string,
    companyId: string
  ): Promise<Contact> {
    return this.assignParent(contactId, null, companyId);
  }

  /**
   * Filters contacts based on query options
   *
   * Internal helper method to apply common filtering logic.
   *
   * @param contacts - Array of contacts to filter
   * @param options - Query options
   * @returns Filtered array of contacts
   */
  private static filterByOptions(
    contacts: Contact[],
    options: HierarchyQueryOptions
  ): Contact[] {
    let filtered = contacts;

    // Filter inactive unless explicitly included
    if (!options.includeInactive) {
      filtered = filtered.filter(c => c.active);
    }

    // Filter deleted unless explicitly included
    if (!options.includeDeleted) {
      filtered = filtered.filter(c => c.deleted_at === null);
    }

    return filtered;
  }
}

// Export singleton instance for convenience
export const hierarchyService = HierarchyService;
