/**
 * Hierarchy Validator Tests
 *
 * Comprehensive tests for hierarchical contact relationship validation.
 * Tests circular reference prevention, depth limits, parent assignments, and helper functions.
 *
 * Requirements:
 * - G3: Hierarchical Contacts Infrastructure
 * - Section 4.3: Shared Validation Logic (HIERARCHICAL_ACCOUNTS_INTEGRATION_PLAN.md)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { nanoid } from 'nanoid';
import { db } from '../db/database';
import { HierarchyValidator } from './hierarchyValidator';
import type { Contact } from '../types/database.types';
import { ContactType, ContactAccountType } from '../types/database.types';

describe('HierarchyValidator', () => {
  const companyId = nanoid();

  beforeEach(async () => {
    // Clear database before each test
    await db.contacts.clear();
    // Set device ID for consistent testing
    localStorage.setItem('deviceId', 'test-device-001');
  });

  /**
   * Helper function to create a test contact
   */
  const createTestContact = async (
    overrides: Partial<Contact> = {}
  ): Promise<Contact> => {
    const contact: Contact = {
      id: nanoid(),
      company_id: companyId,
      type: ContactType.CUSTOMER,
      name: 'Test Contact',
      email: null,
      phone: null,
      address: null,
      tax_id: null,
      notes: null,
      active: true,
      balance: '0.00',
      parent_id: null,
      account_type: ContactAccountType.STANDALONE,
      hierarchy_level: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: {},
      ...overrides,
    };

    await db.contacts.add(contact);
    return contact;
  };

  describe('Circular Reference Prevention', () => {
    describe('Self-referencing', () => {
      it('should reject contact being its own parent', async () => {
        const contact = await createTestContact();

        const result = await HierarchyValidator.validateParentAssignment(
          contact.id,
          contact.id
        );

        expect(result.valid).toBe(false);
        expect((result as any).error).toBe('A contact cannot be its own parent.');
      });
    });

    describe('Direct circular reference', () => {
      it('should reject A → B → A circular reference', async () => {
        // Create contact A
        const contactA = await createTestContact({
          name: 'Contact A',
          account_type: ContactAccountType.STANDALONE,
        });

        // Create contact B with A as parent
        const contactB = await createTestContact({
          name: 'Contact B',
          parent_id: contactA.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 1,
        });

        // Update A's type to parent
        await db.contacts.update(contactA.id, {
          account_type: ContactAccountType.PARENT,
        });

        // Try to assign B as parent of A (would create A → B → A)
        const result = await HierarchyValidator.validateParentAssignment(
          contactA.id,
          contactB.id
        );

        expect(result.valid).toBe(false);
        expect((result as any).error).toBe('This would create a circular reference.');
      });
    });

    describe('Indirect circular reference', () => {
      it('should reject A → B → C → A circular reference', async () => {
        // Create contact A
        const contactA = await createTestContact({
          name: 'Contact A',
          account_type: ContactAccountType.PARENT,
        });

        // Create contact B with A as parent
        const contactB = await createTestContact({
          name: 'Contact B',
          parent_id: contactA.id,
          account_type: ContactAccountType.PARENT,
          hierarchy_level: 1,
        });

        // Create contact C with B as parent
        const contactC = await createTestContact({
          name: 'Contact C',
          parent_id: contactB.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 2,
        });

        // Try to assign C as parent of A (would create A → B → C → A)
        const result = await HierarchyValidator.validateParentAssignment(
          contactA.id,
          contactC.id
        );

        expect(result.valid).toBe(false);
        expect((result as any).error).toBe('This would create a circular reference.');
      });

      it('should reject A → B → C → D → B circular reference', async () => {
        // Create contact A (root)
        const contactA = await createTestContact({
          name: 'Contact A',
          account_type: ContactAccountType.PARENT,
        });

        // Create contact B with A as parent
        const contactB = await createTestContact({
          name: 'Contact B',
          parent_id: contactA.id,
          account_type: ContactAccountType.PARENT,
          hierarchy_level: 1,
        });

        // Create contact C with B as parent
        const contactC = await createTestContact({
          name: 'Contact C',
          parent_id: contactB.id,
          account_type: ContactAccountType.PARENT,
          hierarchy_level: 2,
        });

        // Create contact D with C as parent
        const contactD = await createTestContact({
          name: 'Contact D',
          parent_id: contactC.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 3,
        });

        // Try to assign D as parent of B (would create B → C → D → B)
        const result = await HierarchyValidator.validateParentAssignment(
          contactB.id,
          contactD.id
        );

        expect(result.valid).toBe(false);
        expect((result as any).error).toBe('This would create a circular reference.');
      });
    });
  });

  describe('Maximum Depth Tests', () => {
    it('should allow depth 0 (standalone/root)', async () => {
      const contact = await createTestContact({
        parent_id: null,
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      });

      // A standalone contact trying to become a child of a root contact
      const rootContact = await createTestContact({
        name: 'Root Contact',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      });

      const result = await HierarchyValidator.validateParentAssignment(
        contact.id,
        rootContact.id
      );

      expect(result.valid).toBe(true);
      expect((result as any).error).toBeUndefined();
    });

    it('should allow depth 1 (child of root)', async () => {
      const rootContact = await createTestContact({
        name: 'Root Contact',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      });

      const childContact = await createTestContact({
        name: 'Child Contact',
        parent_id: null,
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      });

      const result = await HierarchyValidator.validateParentAssignment(
        childContact.id,
        rootContact.id
      );

      expect(result.valid).toBe(true);
      expect((result as any).error).toBeUndefined();
    });

    it('should allow depth 2 (grandchild)', async () => {
      const rootContact = await createTestContact({
        name: 'Root Contact',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      });

      const childContact = await createTestContact({
        name: 'Child Contact',
        parent_id: rootContact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 1,
      });

      const grandchildContact = await createTestContact({
        name: 'Grandchild Contact',
        parent_id: null,
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      });

      const result = await HierarchyValidator.validateParentAssignment(
        grandchildContact.id,
        childContact.id
      );

      expect(result.valid).toBe(true);
      expect((result as any).error).toBeUndefined();
    });

    it('should allow depth 3 (great-grandchild)', async () => {
      const rootContact = await createTestContact({
        name: 'Root Contact',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      });

      const childContact = await createTestContact({
        name: 'Child Contact',
        parent_id: rootContact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 1,
      });

      const grandchildContact = await createTestContact({
        name: 'Grandchild Contact',
        parent_id: childContact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 2,
      });

      const greatGrandchildContact = await createTestContact({
        name: 'Great-Grandchild Contact',
        parent_id: null,
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      });

      const result = await HierarchyValidator.validateParentAssignment(
        greatGrandchildContact.id,
        grandchildContact.id
      );

      expect(result.valid).toBe(true);
      expect((result as any).error).toBeUndefined();
    });

    it('should reject depth 4 (exceeds maximum)', async () => {
      const rootContact = await createTestContact({
        name: 'Root Contact',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      });

      const childContact = await createTestContact({
        name: 'Child Contact',
        parent_id: rootContact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 1,
      });

      const grandchildContact = await createTestContact({
        name: 'Grandchild Contact',
        parent_id: childContact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 2,
      });

      const greatGrandchildContact = await createTestContact({
        name: 'Great-Grandchild Contact',
        parent_id: grandchildContact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 3,
      });

      const tooDeepContact = await createTestContact({
        name: 'Too Deep Contact',
        parent_id: null,
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      });

      const result = await HierarchyValidator.validateParentAssignment(
        tooDeepContact.id,
        greatGrandchildContact.id
      );

      expect(result.valid).toBe(false);
      expect((result as any).error).toBe('Maximum hierarchy depth (3 levels) exceeded.');
    });

    it('should verify MAX_DEPTH constant is 3', () => {
      expect(HierarchyValidator.MAX_DEPTH).toBe(3);
    });
  });

  describe('Parent Assignment Validation', () => {
    it('should allow valid parent assignment at depth 1', async () => {
      const parentContact = await createTestContact({
        name: 'Parent Contact',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      });

      const childContact = await createTestContact({
        name: 'Child Contact',
        parent_id: null,
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      });

      const result = await HierarchyValidator.validateParentAssignment(
        childContact.id,
        parentContact.id
      );

      expect(result.valid).toBe(true);
      expect((result as any).error).toBeUndefined();
    });

    it('should allow valid parent assignment at depth 2', async () => {
      const rootContact = await createTestContact({
        name: 'Root Contact',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      });

      const childContact = await createTestContact({
        name: 'Child Contact',
        parent_id: rootContact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 1,
      });

      const grandchildContact = await createTestContact({
        name: 'Grandchild Contact',
        parent_id: null,
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      });

      const result = await HierarchyValidator.validateParentAssignment(
        grandchildContact.id,
        childContact.id
      );

      expect(result.valid).toBe(true);
      expect((result as any).error).toBeUndefined();
    });

    it('should allow valid parent assignment at depth 3', async () => {
      const rootContact = await createTestContact({
        name: 'Root Contact',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      });

      const childContact = await createTestContact({
        name: 'Child Contact',
        parent_id: rootContact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 1,
      });

      const grandchildContact = await createTestContact({
        name: 'Grandchild Contact',
        parent_id: childContact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 2,
      });

      const greatGrandchildContact = await createTestContact({
        name: 'Great-Grandchild Contact',
        parent_id: null,
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      });

      const result = await HierarchyValidator.validateParentAssignment(
        greatGrandchildContact.id,
        grandchildContact.id
      );

      expect(result.valid).toBe(true);
      expect((result as any).error).toBeUndefined();
    });

    it('should reject self-reference assignment', async () => {
      const contact = await createTestContact({
        name: 'Test Contact',
      });

      const result = await HierarchyValidator.validateParentAssignment(
        contact.id,
        contact.id
      );

      expect(result.valid).toBe(false);
      expect((result as any).error).toBe('A contact cannot be its own parent.');
    });

    it('should reject circular reference assignment', async () => {
      const contactA = await createTestContact({
        name: 'Contact A',
        account_type: ContactAccountType.PARENT,
      });

      const contactB = await createTestContact({
        name: 'Contact B',
        parent_id: contactA.id,
        account_type: ContactAccountType.CHILD,
        hierarchy_level: 1,
      });

      const result = await HierarchyValidator.validateParentAssignment(
        contactA.id,
        contactB.id
      );

      expect(result.valid).toBe(false);
      expect((result as any).error).toBe('This would create a circular reference.');
    });

    it('should reject assignment exceeding max depth', async () => {
      const rootContact = await createTestContact({
        name: 'Root',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      });

      const level1Contact = await createTestContact({
        name: 'Level 1',
        parent_id: rootContact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 1,
      });

      const level2Contact = await createTestContact({
        name: 'Level 2',
        parent_id: level1Contact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 2,
      });

      const level3Contact = await createTestContact({
        name: 'Level 3',
        parent_id: level2Contact.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 3,
      });

      const newContact = await createTestContact({
        name: 'New Contact',
      });

      const result = await HierarchyValidator.validateParentAssignment(
        newContact.id,
        level3Contact.id
      );

      expect(result.valid).toBe(false);
      expect((result as any).error).toBe('Maximum hierarchy depth (3 levels) exceeded.');
    });
  });

  describe('Helper Functions', () => {
    describe('getDescendants()', () => {
      it('should return empty array for standalone contact with no children', async () => {
        const contact = await createTestContact({
          name: 'Standalone Contact',
          parent_id: null,
          account_type: ContactAccountType.STANDALONE,
        });

        // Use reflection to access private method for testing
        const getDescendants = (HierarchyValidator as any).getDescendants.bind(
          HierarchyValidator
        );
        const descendants = await getDescendants(contact.id);

        expect(descendants).toEqual([]);
      });

      it('should return immediate children', async () => {
        const parentContact = await createTestContact({
          name: 'Parent Contact',
          parent_id: null,
          account_type: ContactAccountType.PARENT,
        });

        const child1 = await createTestContact({
          name: 'Child 1',
          parent_id: parentContact.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 1,
        });

        const child2 = await createTestContact({
          name: 'Child 2',
          parent_id: parentContact.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 1,
        });

        const getDescendants = (HierarchyValidator as any).getDescendants.bind(
          HierarchyValidator
        );
        const descendants = await getDescendants(parentContact.id);

        expect(descendants).toHaveLength(2);
        expect(descendants).toContain(child1.id);
        expect(descendants).toContain(child2.id);
      });

      it('should return all descendants recursively (children and grandchildren)', async () => {
        const rootContact = await createTestContact({
          name: 'Root Contact',
          parent_id: null,
          account_type: ContactAccountType.PARENT,
        });

        const child1 = await createTestContact({
          name: 'Child 1',
          parent_id: rootContact.id,
          account_type: ContactAccountType.PARENT,
          hierarchy_level: 1,
        });

        const child2 = await createTestContact({
          name: 'Child 2',
          parent_id: rootContact.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 1,
        });

        const grandchild1 = await createTestContact({
          name: 'Grandchild 1',
          parent_id: child1.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 2,
        });

        const grandchild2 = await createTestContact({
          name: 'Grandchild 2',
          parent_id: child1.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 2,
        });

        const getDescendants = (HierarchyValidator as any).getDescendants.bind(
          HierarchyValidator
        );
        const descendants = await getDescendants(rootContact.id);

        expect(descendants).toHaveLength(4);
        expect(descendants).toContain(child1.id);
        expect(descendants).toContain(child2.id);
        expect(descendants).toContain(grandchild1.id);
        expect(descendants).toContain(grandchild2.id);
      });

      it('should return all descendants recursively (3 levels deep)', async () => {
        const rootContact = await createTestContact({
          name: 'Root',
          parent_id: null,
          account_type: ContactAccountType.PARENT,
        });

        const child = await createTestContact({
          name: 'Child',
          parent_id: rootContact.id,
          account_type: ContactAccountType.PARENT,
          hierarchy_level: 1,
        });

        const grandchild = await createTestContact({
          name: 'Grandchild',
          parent_id: child.id,
          account_type: ContactAccountType.PARENT,
          hierarchy_level: 2,
        });

        const greatGrandchild = await createTestContact({
          name: 'Great-Grandchild',
          parent_id: grandchild.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 3,
        });

        const getDescendants = (HierarchyValidator as any).getDescendants.bind(
          HierarchyValidator
        );
        const descendants = await getDescendants(rootContact.id);

        expect(descendants).toHaveLength(3);
        expect(descendants).toContain(child.id);
        expect(descendants).toContain(grandchild.id);
        expect(descendants).toContain(greatGrandchild.id);
      });

      it('should not include unrelated contacts', async () => {
        const parentContact = await createTestContact({
          name: 'Parent Contact',
          parent_id: null,
          account_type: ContactAccountType.PARENT,
        });

        const child = await createTestContact({
          name: 'Child',
          parent_id: parentContact.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 1,
        });

        // Unrelated contact
        await createTestContact({
          name: 'Unrelated Contact',
          parent_id: null,
          account_type: ContactAccountType.STANDALONE,
        });

        const getDescendants = (HierarchyValidator as any).getDescendants.bind(
          HierarchyValidator
        );
        const descendants = await getDescendants(parentContact.id);

        expect(descendants).toHaveLength(1);
        expect(descendants).toContain(child.id);
      });
    });

    describe('getHierarchyDepth()', () => {
      it('should return 0 for standalone contact (no parent)', async () => {
        const contact = await createTestContact({
          name: 'Standalone Contact',
          parent_id: null,
          account_type: ContactAccountType.STANDALONE,
        });

        const getHierarchyDepth = (
          HierarchyValidator as any
        ).getHierarchyDepth.bind(HierarchyValidator);
        const depth = await getHierarchyDepth(contact.id);

        expect(depth).toBe(0);
      });

      it('should return 0 for root/parent contact (no parent)', async () => {
        const contact = await createTestContact({
          name: 'Root Contact',
          parent_id: null,
          account_type: ContactAccountType.PARENT,
        });

        const getHierarchyDepth = (
          HierarchyValidator as any
        ).getHierarchyDepth.bind(HierarchyValidator);
        const depth = await getHierarchyDepth(contact.id);

        expect(depth).toBe(0);
      });

      it('should return 1 for child of root', async () => {
        const rootContact = await createTestContact({
          name: 'Root Contact',
          parent_id: null,
          account_type: ContactAccountType.PARENT,
        });

        const childContact = await createTestContact({
          name: 'Child Contact',
          parent_id: rootContact.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 1,
        });

        const getHierarchyDepth = (
          HierarchyValidator as any
        ).getHierarchyDepth.bind(HierarchyValidator);
        const depth = await getHierarchyDepth(childContact.id);

        expect(depth).toBe(1);
      });

      it('should return 2 for grandchild', async () => {
        const rootContact = await createTestContact({
          name: 'Root Contact',
          parent_id: null,
          account_type: ContactAccountType.PARENT,
        });

        const childContact = await createTestContact({
          name: 'Child Contact',
          parent_id: rootContact.id,
          account_type: ContactAccountType.PARENT,
          hierarchy_level: 1,
        });

        const grandchildContact = await createTestContact({
          name: 'Grandchild Contact',
          parent_id: childContact.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 2,
        });

        const getHierarchyDepth = (
          HierarchyValidator as any
        ).getHierarchyDepth.bind(HierarchyValidator);
        const depth = await getHierarchyDepth(grandchildContact.id);

        expect(depth).toBe(2);
      });

      it('should return 3 for great-grandchild', async () => {
        const rootContact = await createTestContact({
          name: 'Root Contact',
          parent_id: null,
          account_type: ContactAccountType.PARENT,
        });

        const childContact = await createTestContact({
          name: 'Child Contact',
          parent_id: rootContact.id,
          account_type: ContactAccountType.PARENT,
          hierarchy_level: 1,
        });

        const grandchildContact = await createTestContact({
          name: 'Grandchild Contact',
          parent_id: childContact.id,
          account_type: ContactAccountType.PARENT,
          hierarchy_level: 2,
        });

        const greatGrandchildContact = await createTestContact({
          name: 'Great-Grandchild Contact',
          parent_id: grandchildContact.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 3,
        });

        const getHierarchyDepth = (
          HierarchyValidator as any
        ).getHierarchyDepth.bind(HierarchyValidator);
        const depth = await getHierarchyDepth(greatGrandchildContact.id);

        expect(depth).toBe(3);
      });

      it('should return 0 for non-existent contact', async () => {
        const getHierarchyDepth = (
          HierarchyValidator as any
        ).getHierarchyDepth.bind(HierarchyValidator);
        const depth = await getHierarchyDepth('non-existent-id');

        expect(depth).toBe(0);
      });

      it('should calculate depth correctly in complex hierarchy', async () => {
        // Create a complex hierarchy
        const root = await createTestContact({
          name: 'Root',
          parent_id: null,
          account_type: ContactAccountType.PARENT,
        });

        const child1 = await createTestContact({
          name: 'Child 1',
          parent_id: root.id,
          account_type: ContactAccountType.PARENT,
          hierarchy_level: 1,
        });

        const child2 = await createTestContact({
          name: 'Child 2',
          parent_id: root.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 1,
        });

        const grandchild1 = await createTestContact({
          name: 'Grandchild 1',
          parent_id: child1.id,
          account_type: ContactAccountType.CHILD,
          hierarchy_level: 2,
        });

        const getHierarchyDepth = (
          HierarchyValidator as any
        ).getHierarchyDepth.bind(HierarchyValidator);

        expect(await getHierarchyDepth(root.id)).toBe(0);
        expect(await getHierarchyDepth(child1.id)).toBe(1);
        expect(await getHierarchyDepth(child2.id)).toBe(1);
        expect(await getHierarchyDepth(grandchild1.id)).toBe(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple siblings at same level', async () => {
      const parentContact = await createTestContact({
        name: 'Parent',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
      });

      // Create 5 siblings
      const siblings = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          createTestContact({
            name: `Sibling ${i + 1}`,
            parent_id: parentContact.id,
            account_type: ContactAccountType.CHILD,
            hierarchy_level: 1,
          })
        )
      );

      // All siblings should be valid children
      for (const sibling of siblings) {
        const result = await HierarchyValidator.validateParentAssignment(
          sibling.id,
          parentContact.id
        );
        expect(result.valid).toBe(true);
      }

      // None of the siblings should be descendants of each other
      const getDescendants = (HierarchyValidator as any).getDescendants.bind(
        HierarchyValidator
      );

      for (const sibling of siblings) {
        const descendants = await getDescendants(sibling.id);
        expect(descendants).toHaveLength(0);
      }
    });

    it('should handle reassignment from one parent to another', async () => {
      const parent1 = await createTestContact({
        name: 'Parent 1',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
      });

      const parent2 = await createTestContact({
        name: 'Parent 2',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
      });

      const child = await createTestContact({
        name: 'Child',
        parent_id: parent1.id,
        account_type: ContactAccountType.CHILD,
        hierarchy_level: 1,
      });

      // Reassign child from parent1 to parent2 should be valid
      const result = await HierarchyValidator.validateParentAssignment(
        child.id,
        parent2.id
      );

      expect(result.valid).toBe(true);
      expect((result as any).error).toBeUndefined();
    });

    it('should handle promoting standalone to child', async () => {
      const standaloneContact = await createTestContact({
        name: 'Standalone',
        parent_id: null,
        account_type: ContactAccountType.STANDALONE,
      });

      const parentContact = await createTestContact({
        name: 'Parent',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
      });

      const result = await HierarchyValidator.validateParentAssignment(
        standaloneContact.id,
        parentContact.id
      );

      expect(result.valid).toBe(true);
      expect((result as any).error).toBeUndefined();
    });

    it('should handle complex multi-branch hierarchy', async () => {
      const root = await createTestContact({
        name: 'Root',
        parent_id: null,
        account_type: ContactAccountType.PARENT,
      });

      // Branch 1
      const branch1Child = await createTestContact({
        name: 'Branch 1 Child',
        parent_id: root.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 1,
      });

      const branch1Grandchild = await createTestContact({
        name: 'Branch 1 Grandchild',
        parent_id: branch1Child.id,
        account_type: ContactAccountType.CHILD,
        hierarchy_level: 2,
      });

      // Branch 2
      const branch2Child = await createTestContact({
        name: 'Branch 2 Child',
        parent_id: root.id,
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 1,
      });

      const branch2Grandchild = await createTestContact({
        name: 'Branch 2 Grandchild',
        parent_id: branch2Child.id,
        account_type: ContactAccountType.CHILD,
        hierarchy_level: 2,
      });

      const getDescendants = (HierarchyValidator as any).getDescendants.bind(
        HierarchyValidator
      );

      // Root should have all 4 descendants
      const rootDescendants = await getDescendants(root.id);
      expect(rootDescendants).toHaveLength(4);

      // Branch 1 child should only have branch 1 grandchild
      const branch1Descendants = await getDescendants(branch1Child.id);
      expect(branch1Descendants).toHaveLength(1);
      expect(branch1Descendants).toContain(branch1Grandchild.id);

      // Branch 2 child should only have branch 2 grandchild
      const branch2Descendants = await getDescendants(branch2Child.id);
      expect(branch2Descendants).toHaveLength(1);
      expect(branch2Descendants).toContain(branch2Grandchild.id);
    });
  });
});
