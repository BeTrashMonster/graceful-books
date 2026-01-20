/**
 * Unit Tests for Hierarchy Service
 *
 * Comprehensive tests covering all major functions of the hierarchy service:
 * - assignParent() with validation
 * - makeStandalone()
 * - getChildren() / getDescendants()
 * - getHierarchyTree()
 * - flattenHierarchy()
 * - calculateTotalBalance() / calculateConsolidatedTotals()
 * - getHierarchyStatistics()
 *
 * Requirements:
 * - G3: Hierarchical Contacts Infrastructure
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HierarchyService } from './hierarchyService';
import type { Contact } from '../types/database.types';
import { ContactAccountType, ContactType } from '../types/database.types';
import { db } from '../db/database';
import { HierarchyValidator } from '../validators/hierarchyValidator';

// Mock the database
vi.mock('../db/database', () => ({
  db: {
    contacts: {
      get: vi.fn(),
      update: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(),
          count: vi.fn(),
          filter: vi.fn(() => ({
            toArray: vi.fn(),
          })),
        })),
        filter: vi.fn(() => ({
          toArray: vi.fn(),
        })),
      })),
      filter: vi.fn(() => ({
        toArray: vi.fn(),
      })),
    },
  },
}));

// Mock the validator
vi.mock('../validators/hierarchyValidator', () => ({
  HierarchyValidator: {
    validateParentAssignment: vi.fn(),
  },
}));

describe('Hierarchy Service', () => {
  const mockCompanyId = 'company-123';
  const now = Date.now();

  // Helper function to create mock contact
  const createMockContact = (
    id: string,
    name: string,
    parentId: string | null = null,
    accountType: ContactAccountType = ContactAccountType.STANDALONE,
    hierarchyLevel: number = 0,
    balance: string = '0.00'
  ): Contact => ({
    id,
    company_id: mockCompanyId,
    type: ContactType.CUSTOMER,
    name,
    email: `${name.toLowerCase().replace(/\s/g, '')}@test.com`,
    phone: null,
    address: null,
    tax_id: null,
    notes: null,
    active: true,
    balance,
    parent_id: parentId,
    account_type: accountType,
    hierarchy_level: hierarchyLevel,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {},
  });

  // Mock contacts for testing
  let mockContacts: Map<string, Contact>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Initialize mock contacts
    mockContacts = new Map();

    // Setup default mock implementations
    (vi.mocked(db.contacts.get) as any).mockImplementation(async (id: string) => {
      return mockContacts.get(id) || null;
    });

    (vi.mocked(db.contacts.update) as any).mockImplementation(
      async (id: string, changes: any) => {
        const contact = mockContacts.get(id);
        if (contact) {
          const updated = { ...contact, ...changes };
          mockContacts.set(id, updated);
          return 1;
        }
        return 0;
      }
    );
  });

  afterEach(() => {
    mockContacts.clear();
  });

  describe('assignParent()', () => {
    it('should assign a parent to a contact successfully', async () => {
      const parent = createMockContact('parent-1', 'Parent Corp', null, ContactAccountType.STANDALONE, 0);
      const child = createMockContact('child-1', 'Child Inc', null, ContactAccountType.STANDALONE, 0);

      mockContacts.set(parent.id, parent);
      mockContacts.set(child.id, child);

      vi.mocked(HierarchyValidator.validateParentAssignment).mockResolvedValue({
        valid: true,
      });

      const result = await HierarchyService.assignParent(child.id, parent.id, mockCompanyId);

      expect(result.parent_id).toBe(parent.id);
      expect(result.account_type).toBe(ContactAccountType.CHILD);
      expect(result.hierarchy_level).toBe(1);
      expect(db.contacts.update).toHaveBeenCalledWith(child.id, {
        parent_id: parent.id,
        account_type: ContactAccountType.CHILD,
        hierarchy_level: 1,
      });
    });

    it('should update parent account type to PARENT', async () => {
      const parent = createMockContact('parent-1', 'Parent Corp', null, ContactAccountType.STANDALONE, 0);
      const child = createMockContact('child-1', 'Child Inc', null, ContactAccountType.STANDALONE, 0);

      mockContacts.set(parent.id, parent);
      mockContacts.set(child.id, child);

      vi.mocked(HierarchyValidator.validateParentAssignment).mockResolvedValue({
        valid: true,
      });

      await HierarchyService.assignParent(child.id, parent.id, mockCompanyId);

      expect(db.contacts.update).toHaveBeenCalledWith(parent.id, {
        account_type: ContactAccountType.PARENT,
      });
    });

    it('should calculate hierarchy level based on parent depth', async () => {
      const grandparent = createMockContact('gp-1', 'Grandparent', null, ContactAccountType.PARENT, 0);
      const parent = createMockContact('parent-1', 'Parent', 'gp-1', ContactAccountType.CHILD, 1);
      const child = createMockContact('child-1', 'Child', null, ContactAccountType.STANDALONE, 0);

      mockContacts.set(grandparent.id, grandparent);
      mockContacts.set(parent.id, parent);
      mockContacts.set(child.id, child);

      vi.mocked(HierarchyValidator.validateParentAssignment).mockResolvedValue({
        valid: true,
      });

      const result = await HierarchyService.assignParent(child.id, parent.id, mockCompanyId);

      expect(result.hierarchy_level).toBe(2);
    });

    it('should throw error if contact not found', async () => {
      await expect(
        HierarchyService.assignParent('nonexistent', 'parent-1', mockCompanyId)
      ).rejects.toThrow('Contact with ID nonexistent not found');
    });

    it('should throw error if parent not found', async () => {
      const child = createMockContact('child-1', 'Child Inc');
      mockContacts.set(child.id, child);

      await expect(
        HierarchyService.assignParent(child.id, 'nonexistent', mockCompanyId)
      ).rejects.toThrow('Parent contact with ID nonexistent not found');
    });

    it('should throw error if contact does not belong to company', async () => {
      const contact = createMockContact('child-1', 'Child Inc');
      contact.company_id = 'different-company';
      mockContacts.set(contact.id, contact);

      await expect(
        HierarchyService.assignParent(contact.id, 'parent-1', mockCompanyId)
      ).rejects.toThrow('Contact does not belong to this company');
    });

    it('should throw error if parent does not belong to company', async () => {
      const parent = createMockContact('parent-1', 'Parent Corp');
      parent.company_id = 'different-company';
      const child = createMockContact('child-1', 'Child Inc');

      mockContacts.set(parent.id, parent);
      mockContacts.set(child.id, child);

      await expect(
        HierarchyService.assignParent(child.id, parent.id, mockCompanyId)
      ).rejects.toThrow('Parent contact does not belong to this company');
    });

    it('should throw error if validation fails', async () => {
      const parent = createMockContact('parent-1', 'Parent Corp');
      const child = createMockContact('child-1', 'Child Inc');

      mockContacts.set(parent.id, parent);
      mockContacts.set(child.id, child);

      vi.mocked(HierarchyValidator.validateParentAssignment).mockResolvedValue({
        valid: false,
        error: 'Maximum hierarchy depth exceeded',
      });

      await expect(
        HierarchyService.assignParent(child.id, parent.id, mockCompanyId)
      ).rejects.toThrow('Maximum hierarchy depth exceeded');
    });

    it('should make contact standalone when parent_id is null', async () => {
      const contact = createMockContact('child-1', 'Child Inc', 'parent-1', ContactAccountType.CHILD, 1);
      mockContacts.set(contact.id, contact);

      const result = await HierarchyService.assignParent(contact.id, null, mockCompanyId);

      expect(result.parent_id).toBe(null);
      expect(result.account_type).toBe(ContactAccountType.STANDALONE);
      expect(result.hierarchy_level).toBe(0);
    });
  });

  describe('makeStandalone()', () => {
    it('should convert a child contact to standalone', async () => {
      const contact = createMockContact('child-1', 'Child Inc', 'parent-1', ContactAccountType.CHILD, 1);
      mockContacts.set(contact.id, contact);

      const result = await HierarchyService.makeStandalone(contact.id, mockCompanyId);

      expect(result.parent_id).toBe(null);
      expect(result.account_type).toBe(ContactAccountType.STANDALONE);
      expect(result.hierarchy_level).toBe(0);
    });

    it('should work on already standalone contact', async () => {
      const contact = createMockContact('contact-1', 'Contact Inc');
      mockContacts.set(contact.id, contact);

      const result = await HierarchyService.makeStandalone(contact.id, mockCompanyId);

      expect(result.parent_id).toBe(null);
      expect(result.account_type).toBe(ContactAccountType.STANDALONE);
      expect(result.hierarchy_level).toBe(0);
    });
  });

  describe('getChildren()', () => {
    it('should return all direct children of a parent', async () => {
      const parent = createMockContact('parent-1', 'Parent Corp');
      const child1 = createMockContact('child-1', 'Child 1', 'parent-1', ContactAccountType.CHILD, 1);
      const child2 = createMockContact('child-2', 'Child 2', 'parent-1', ContactAccountType.CHILD, 1);
      const grandchild = createMockContact('gc-1', 'Grandchild', 'child-1', ContactAccountType.CHILD, 2);

      mockContacts.set(parent.id, parent);
      mockContacts.set(child1.id, child1);
      mockContacts.set(child2.id, child2);
      mockContacts.set(grandchild.id, grandchild);

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([child1, child2]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const children = await HierarchyService.getChildren(parent.id);

      expect(children).toHaveLength(2);
      expect(children.map((c: any) => c.id)).toEqual(['child-1', 'child-2']);
    });

    it('should return empty array if no children', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const children = await HierarchyService.getChildren('parent-1');

      expect(children).toHaveLength(0);
    });

    it('should filter inactive contacts by default', async () => {
      const child1 = createMockContact('child-1', 'Child 1', 'parent-1', ContactAccountType.CHILD, 1);
      const child2 = createMockContact('child-2', 'Child 2', 'parent-1', ContactAccountType.CHILD, 1);
      child2.active = false;

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([child1, child2]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const children = await HierarchyService.getChildren('parent-1');

      expect(children).toHaveLength(1);
      expect(children[0]!.id).toBe('child-1');
    });

    it('should include inactive contacts when specified', async () => {
      const child1 = createMockContact('child-1', 'Child 1', 'parent-1', ContactAccountType.CHILD, 1);
      const child2 = createMockContact('child-2', 'Child 2', 'parent-1', ContactAccountType.CHILD, 1);
      child2.active = false;

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([child1, child2]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const children = await HierarchyService.getChildren('parent-1', {
        includeInactive: true,
      });

      expect(children).toHaveLength(2);
    });

    it('should filter deleted contacts by default', async () => {
      const child1 = createMockContact('child-1', 'Child 1', 'parent-1', ContactAccountType.CHILD, 1);
      const child2 = createMockContact('child-2', 'Child 2', 'parent-1', ContactAccountType.CHILD, 1);
      child2.deleted_at = Date.now();

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([child1, child2]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const children = await HierarchyService.getChildren('parent-1');

      expect(children).toHaveLength(1);
      expect(children[0]!.id).toBe('child-1');
    });
  });

  describe('getDescendants()', () => {
    it('should return all descendants recursively', async () => {
      const parent = createMockContact('parent-1', 'Parent Corp');
      const child1 = createMockContact('child-1', 'Child 1', 'parent-1', ContactAccountType.CHILD, 1);
      const child2 = createMockContact('child-2', 'Child 2', 'parent-1', ContactAccountType.CHILD, 1);
      const grandchild1 = createMockContact('gc-1', 'Grandchild 1', 'child-1', ContactAccountType.CHILD, 2);
      const grandchild2 = createMockContact('gc-2', 'Grandchild 2', 'child-1', ContactAccountType.CHILD, 2);

      mockContacts.set(parent.id, parent);
      mockContacts.set(child1.id, child1);
      mockContacts.set(child2.id, child2);
      mockContacts.set(grandchild1.id, grandchild1);
      mockContacts.set(grandchild2.id, grandchild2);

      // Mock getChildren calls
      const mockWhere = vi.fn();
      mockWhere
        .mockReturnValueOnce({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([child1, child2]),
          }),
        })
        .mockReturnValueOnce({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([grandchild1, grandchild2]),
          }),
        })
        .mockReturnValueOnce({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValue({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        });

      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const descendants = await HierarchyService.getDescendants(parent.id);

      expect(descendants.length).toBeGreaterThanOrEqual(2);
      const ids = descendants.map((d: any) => d.id);
      expect(ids).toContain('child-1');
      expect(ids).toContain('child-2');
    });

    it('should return empty array if no descendants', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const descendants = await HierarchyService.getDescendants('parent-1');

      expect(descendants).toHaveLength(0);
    });
  });

  describe('getHierarchyTree()', () => {
    it('should build a complete hierarchy tree', async () => {
      const parent = createMockContact('parent-1', 'Parent Corp', null, ContactAccountType.PARENT, 0, '1000.00');
      const child1 = createMockContact('child-1', 'Child 1', 'parent-1', ContactAccountType.CHILD, 1, '500.00');
      const child2 = createMockContact('child-2', 'Child 2', 'parent-1', ContactAccountType.CHILD, 1, '300.00');

      mockContacts.set(parent.id, parent);
      mockContacts.set(child1.id, child1);
      mockContacts.set(child2.id, child2);

      // Mock db.contacts.where to return children based on parent_id
      const mockWhere = vi.fn().mockImplementation((_field: string) => {
        return {
          equals: vi.fn().mockImplementation((parentId: string) => {
            const children = Array.from(mockContacts.values()).filter(
              c => c.parent_id === parentId
            );
            return {
              toArray: vi.fn().mockResolvedValue(children),
            };
          }),
        };
      });

      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const tree = await HierarchyService.getHierarchyTree(parent.id);

      expect(tree.contact.id).toBe(parent.id);
      expect(tree.depth).toBe(0);
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0]!.contact.id).toBe(child1.id);
      expect(tree.children[1]!.contact.id).toBe(child2.id);
    });

    it('should throw error if contact not found', async () => {
      await expect(HierarchyService.getHierarchyTree('nonexistent')).rejects.toThrow(
        'Contact with ID nonexistent not found'
      );
    });

    it('should respect maxDepth option', async () => {
      const parent = createMockContact('parent-1', 'Parent', null, ContactAccountType.PARENT, 0);
      const child = createMockContact('child-1', 'Child', 'parent-1', ContactAccountType.CHILD, 1);
      const grandchild = createMockContact('gc-1', 'Grandchild', 'child-1', ContactAccountType.CHILD, 2);

      mockContacts.set(parent.id, parent);
      mockContacts.set(child.id, child);
      mockContacts.set(grandchild.id, grandchild);

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const tree = await HierarchyService.getHierarchyTree(parent.id, { maxDepth: 0 });

      expect(tree.children).toHaveLength(0);
    });

    it('should calculate total balance including descendants', async () => {
      const parent = createMockContact('parent-1', 'Parent', null, ContactAccountType.PARENT, 0, '1000.00');
      const child1 = createMockContact('child-1', 'Child 1', 'parent-1', ContactAccountType.CHILD, 1, '500.00');
      const child2 = createMockContact('child-2', 'Child 2', 'parent-1', ContactAccountType.CHILD, 1, '300.00');

      mockContacts.set(parent.id, parent);
      mockContacts.set(child1.id, child1);
      mockContacts.set(child2.id, child2);

      // Mock db.contacts.where to return children based on parent_id
      const mockWhere = vi.fn().mockImplementation((_field: string) => {
        return {
          equals: vi.fn().mockImplementation((parentId: string) => {
            const children = Array.from(mockContacts.values()).filter(
              c => c.parent_id === parentId
            );
            return {
              toArray: vi.fn().mockResolvedValue(children),
            };
          }),
        };
      });

      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const tree = await HierarchyService.getHierarchyTree(parent.id);

      expect(tree.totalBalance).toBe('1800.00');
    });
  });

  describe('flattenHierarchy()', () => {
    it('should flatten a hierarchy tree into a linear list', () => {
      const parent = createMockContact('parent-1', 'Parent', null, ContactAccountType.PARENT, 0);
      const child1 = createMockContact('child-1', 'Child 1', 'parent-1', ContactAccountType.CHILD, 1);
      const child2 = createMockContact('child-2', 'Child 2', 'parent-1', ContactAccountType.CHILD, 1);

      const tree = {
        contact: parent,
        children: [
          {
            contact: child1,
            children: [],
            depth: 1,
            totalBalance: '0.00',
          },
          {
            contact: child2,
            children: [],
            depth: 1,
            totalBalance: '0.00',
          },
        ],
        depth: 0,
        totalBalance: '0.00',
      };

      const flat = HierarchyService.flattenHierarchy(tree);

      expect(flat).toHaveLength(3);
      expect(flat[0]!.contact.id).toBe(parent.id);
      expect(flat[0]!.depth).toBe(0);
      expect(flat[0]!.hasChildren).toBe(true);
      expect(flat[0]!.childCount).toBe(2);
      expect(flat[1]!.contact.id).toBe(child1.id);
      expect(flat[1]!.depth).toBe(1);
      expect(flat[2]!.contact.id).toBe(child2.id);
    });

    it('should build correct parent chains', () => {
      const grandparent = createMockContact('gp-1', 'Grandparent', null, ContactAccountType.PARENT, 0);
      const parent = createMockContact('parent-1', 'Parent', 'gp-1', ContactAccountType.CHILD, 1);
      const child = createMockContact('child-1', 'Child', 'parent-1', ContactAccountType.CHILD, 2);

      const tree = {
        contact: grandparent,
        children: [
          {
            contact: parent,
            children: [
              {
                contact: child,
                children: [],
                depth: 2,
                totalBalance: '0.00',
              },
            ],
            depth: 1,
            totalBalance: '0.00',
          },
        ],
        depth: 0,
        totalBalance: '0.00',
      };

      const flat = HierarchyService.flattenHierarchy(tree);

      expect(flat[0]!.parentChain).toEqual([]);
      expect(flat[1]!.parentChain).toEqual(['gp-1']);
      expect(flat[2]!.parentChain).toEqual(['gp-1', 'parent-1']);
    });

    it('should handle single node tree', () => {
      const contact = createMockContact('contact-1', 'Contact');

      const tree = {
        contact,
        children: [],
        depth: 0,
        totalBalance: '0.00',
      };

      const flat = HierarchyService.flattenHierarchy(tree);

      expect(flat).toHaveLength(1);
      expect(flat[0]!.contact.id).toBe(contact.id);
      expect(flat[0]!.hasChildren).toBe(false);
      expect(flat[0]!.childCount).toBe(0);
    });
  });

  describe('calculateTotalBalance()', () => {
    it('should calculate balance for standalone contact', async () => {
      const contact = createMockContact('contact-1', 'Contact', null, ContactAccountType.STANDALONE, 0, '1000.00');
      mockContacts.set(contact.id, contact);

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const total = await HierarchyService.calculateTotalBalance(contact.id);

      expect(total).toBe('1000.00');
    });

    it('should sum parent and all descendants balances', async () => {
      const parent = createMockContact('parent-1', 'Parent', null, ContactAccountType.PARENT, 0, '1000.00');
      const child1 = createMockContact('child-1', 'Child 1', 'parent-1', ContactAccountType.CHILD, 1, '500.00');
      const child2 = createMockContact('child-2', 'Child 2', 'parent-1', ContactAccountType.CHILD, 1, '300.00');
      const grandchild = createMockContact('gc-1', 'Grandchild', 'child-1', ContactAccountType.CHILD, 2, '200.00');

      mockContacts.set(parent.id, parent);
      mockContacts.set(child1.id, child1);
      mockContacts.set(child2.id, child2);
      mockContacts.set(grandchild.id, grandchild);

      const mockWhere = vi.fn();
      mockWhere
        .mockReturnValueOnce({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([child1, child2]),
          }),
        })
        .mockReturnValueOnce({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([grandchild]),
          }),
        })
        .mockReturnValueOnce({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        });

      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const total = await HierarchyService.calculateTotalBalance(parent.id);

      expect(total).toBe('2000.00');
    });

    it('should return 0.00 if contact not found', async () => {
      const total = await HierarchyService.calculateTotalBalance('nonexistent');

      expect(total).toBe('0.00');
    });

    it('should handle contacts with null balance', async () => {
      const contact = createMockContact('contact-1', 'Contact');
      contact.balance = null as any;
      mockContacts.set(contact.id, contact);

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const total = await HierarchyService.calculateTotalBalance(contact.id);

      expect(total).toBe('0.00');
    });

    it('should maintain decimal precision', async () => {
      const contact1 = createMockContact('c1', 'Contact 1', null, ContactAccountType.STANDALONE, 0, '99.99');
      const contact2 = createMockContact('c2', 'Contact 2', 'c1', ContactAccountType.CHILD, 1, '0.01');

      mockContacts.set(contact1.id, contact1);
      mockContacts.set(contact2.id, contact2);

      const mockWhere = vi.fn();
      mockWhere.mockReturnValueOnce({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([contact2]),
        }),
      }).mockReturnValueOnce({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const total = await HierarchyService.calculateTotalBalance(contact1.id);

      expect(total).toBe('100.00');
    });
  });

  describe('calculateConsolidatedTotals()', () => {
    it('should calculate totals for multiple contacts in parallel', async () => {
      const contact1 = createMockContact('c1', 'Contact 1', null, ContactAccountType.STANDALONE, 0, '1000.00');
      const contact2 = createMockContact('c2', 'Contact 2', null, ContactAccountType.STANDALONE, 0, '2000.00');
      const contact3 = createMockContact('c3', 'Contact 3', null, ContactAccountType.STANDALONE, 0, '3000.00');

      mockContacts.set(contact1.id, contact1);
      mockContacts.set(contact2.id, contact2);
      mockContacts.set(contact3.id, contact3);

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const totals = await HierarchyService.calculateConsolidatedTotals([
        contact1.id,
        contact2.id,
        contact3.id,
      ]);

      expect(totals.size).toBe(3);
      expect(totals.get(contact1.id)).toBe('1000.00');
      expect(totals.get(contact2.id)).toBe('2000.00');
      expect(totals.get(contact3.id)).toBe('3000.00');
    });

    it('should handle empty array', async () => {
      const totals = await HierarchyService.calculateConsolidatedTotals([]);

      expect(totals.size).toBe(0);
    });
  });

  describe('getHierarchyStatistics()', () => {
    it('should calculate statistics for company hierarchy', async () => {
      const standalone = createMockContact('s1', 'Standalone', null, ContactAccountType.STANDALONE, 0);
      const parent1 = createMockContact('p1', 'Parent 1', null, ContactAccountType.PARENT, 0);
      const parent2 = createMockContact('p2', 'Parent 2', null, ContactAccountType.PARENT, 0);
      const child1 = createMockContact('c1', 'Child 1', 'p1', ContactAccountType.CHILD, 1);
      const child2 = createMockContact('c2', 'Child 2', 'p1', ContactAccountType.CHILD, 1);
      const child3 = createMockContact('c3', 'Child 3', 'p2', ContactAccountType.CHILD, 1);
      const grandchild = createMockContact('gc1', 'Grandchild', 'c1', ContactAccountType.CHILD, 2);

      const allContacts = [standalone, parent1, parent2, child1, child2, child3, grandchild];

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(allContacts),
        }),
      });

      // Mock for getChildren calls
      const mockWhereForChildren = vi.fn();
      mockWhereForChildren
        .mockReturnValueOnce({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([child1, child2]),
          }),
        })
        .mockReturnValueOnce({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([child3]),
          }),
        });

      vi.mocked(db.contacts.where)
        .mockImplementationOnce(mockWhere)
        .mockImplementation(mockWhereForChildren);

      const stats = await HierarchyService.getHierarchyStatistics(mockCompanyId);

      expect(stats.totalContacts).toBe(7);
      expect(stats.standaloneCount).toBe(1);
      expect(stats.parentCount).toBe(2);
      expect(stats.childCount).toBe(4);
      expect(stats.maxDepth).toBe(2);
      expect(stats.averageChildrenPerParent).toBe(1.5); // (2 + 1) / 2
    });

    it('should handle company with no contacts', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const stats = await HierarchyService.getHierarchyStatistics(mockCompanyId);

      expect(stats.totalContacts).toBe(0);
      expect(stats.standaloneCount).toBe(0);
      expect(stats.parentCount).toBe(0);
      expect(stats.childCount).toBe(0);
      expect(stats.maxDepth).toBe(0);
      expect(stats.averageChildrenPerParent).toBe(0);
    });

    it('should respect includeInactive option', async () => {
      const active = createMockContact('c1', 'Active', null, ContactAccountType.STANDALONE, 0);
      const inactive = createMockContact('c2', 'Inactive', null, ContactAccountType.STANDALONE, 0);
      inactive.active = false;

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([active, inactive]),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const statsDefault = await HierarchyService.getHierarchyStatistics(mockCompanyId);
      expect(statsDefault.totalContacts).toBe(1);

      const statsWithInactive = await HierarchyService.getHierarchyStatistics(mockCompanyId, {
        includeInactive: true,
      });
      expect(statsWithInactive.totalContacts).toBe(2);
    });
  });

  describe('hasChildren()', () => {
    it('should return true if contact has children', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(2),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const result = await HierarchyService.hasChildren('parent-1');

      expect(result).toBe(true);
    });

    it('should return false if contact has no children', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const result = await HierarchyService.hasChildren('parent-1');

      expect(result).toBe(false);
    });
  });

  describe('getRootContacts()', () => {
    it('should return all contacts with no parent', async () => {
      const root1 = createMockContact('r1', 'Root 1', null, ContactAccountType.STANDALONE, 0);
      const root2 = createMockContact('r2', 'Root 2', null, ContactAccountType.PARENT, 0);
      // Child contact exists but is not returned by getRootContacts (has parent_id set)
      // const child = createMockContact('c1', 'Child', 'r2', ContactAccountType.CHILD, 1);

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([root1, root2]),
          }),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const roots = await HierarchyService.getRootContacts(mockCompanyId);

      expect(roots).toHaveLength(2);
      expect(roots.map((r: any) => r.id)).toEqual(['r1', 'r2']);
    });

    it('should filter by company ID', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      await HierarchyService.getRootContacts(mockCompanyId);

      expect(mockWhere).toHaveBeenCalledWith('company_id');
    });
  });

  describe('getParentChain()', () => {
    it('should return parent chain from root to immediate parent', async () => {
      const grandparent = createMockContact('gp-1', 'Grandparent', null, ContactAccountType.PARENT, 0);
      const parent = createMockContact('p-1', 'Parent', 'gp-1', ContactAccountType.CHILD, 1);
      const child = createMockContact('c-1', 'Child', 'p-1', ContactAccountType.CHILD, 2);

      mockContacts.set(grandparent.id, grandparent);
      mockContacts.set(parent.id, parent);
      mockContacts.set(child.id, child);

      const chain = await HierarchyService.getParentChain(child.id);

      expect(chain).toHaveLength(2);
      expect(chain[0]!.id).toBe(grandparent.id);
      expect(chain[1]!.id).toBe(parent.id);
    });

    it('should return empty array for root contact', async () => {
      const root = createMockContact('r-1', 'Root', null, ContactAccountType.STANDALONE, 0);
      mockContacts.set(root.id, root);

      const chain = await HierarchyService.getParentChain(root.id);

      expect(chain).toHaveLength(0);
    });

    it('should return empty array if contact not found', async () => {
      const chain = await HierarchyService.getParentChain('nonexistent');

      expect(chain).toHaveLength(0);
    });

    it('should handle orphaned contact (parent not found)', async () => {
      const child = createMockContact('c-1', 'Child', 'missing-parent', ContactAccountType.CHILD, 1);
      mockContacts.set(child.id, child);

      const chain = await HierarchyService.getParentChain(child.id);

      expect(chain).toHaveLength(0);
    });
  });

  describe('moveContactWithDescendants()', () => {
    it('should move contact to new parent', async () => {
      const oldParent = createMockContact('old-p', 'Old Parent', null, ContactAccountType.PARENT, 0);
      const newParent = createMockContact('new-p', 'New Parent', null, ContactAccountType.PARENT, 0);
      const child = createMockContact('child', 'Child', 'old-p', ContactAccountType.CHILD, 1);

      mockContacts.set(oldParent.id, oldParent);
      mockContacts.set(newParent.id, newParent);
      mockContacts.set(child.id, child);

      vi.mocked(HierarchyValidator.validateParentAssignment).mockResolvedValue({
        valid: true,
      });

      const result = await HierarchyService.moveContactWithDescendants(
        child.id,
        newParent.id,
        mockCompanyId
      );

      expect(result.parent_id).toBe(newParent.id);
    });

    it('should preserve descendants when moving parent', async () => {
      const grandparent = createMockContact('gp', 'Grandparent', null, ContactAccountType.PARENT, 0);
      const parent = createMockContact('p', 'Parent', 'gp', ContactAccountType.CHILD, 1);
      const child = createMockContact('c', 'Child', 'p', ContactAccountType.CHILD, 2);

      mockContacts.set(grandparent.id, grandparent);
      mockContacts.set(parent.id, parent);
      mockContacts.set(child.id, child);

      vi.mocked(HierarchyValidator.validateParentAssignment).mockResolvedValue({
        valid: true,
      });

      await HierarchyService.moveContactWithDescendants(parent.id, null, mockCompanyId);

      const updatedChild = mockContacts.get(child.id);
      expect(updatedChild?.parent_id).toBe(parent.id);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(db.contacts.get).mockRejectedValue(new Error('Database error'));

      await expect(
        HierarchyService.assignParent('child-1', 'parent-1', mockCompanyId)
      ).rejects.toThrow('Database error');
    });

    it('should handle concurrent modifications', async () => {
      const contact = createMockContact('c1', 'Contact');
      mockContacts.set(contact.id, contact);

      vi.mocked(db.contacts.update).mockRejectedValue(
        new Error('Version conflict - contact was modified')
      );

      await expect(
        HierarchyService.makeStandalone(contact.id, mockCompanyId)
      ).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very deep hierarchies', async () => {
      const level0 = createMockContact('l0', 'Level 0', null, ContactAccountType.PARENT, 0);
      const level1 = createMockContact('l1', 'Level 1', 'l0', ContactAccountType.CHILD, 1);
      const level2 = createMockContact('l2', 'Level 2', 'l1', ContactAccountType.CHILD, 2);
      const level3 = createMockContact('l3', 'Level 3', 'l2', ContactAccountType.CHILD, 3);

      mockContacts.set(level0.id, level0);
      mockContacts.set(level1.id, level1);
      mockContacts.set(level2.id, level2);
      mockContacts.set(level3.id, level3);

      const chain = await HierarchyService.getParentChain(level3.id);

      expect(chain).toHaveLength(3);
    });

    it('should handle large number of siblings', async () => {
      const parent = createMockContact('parent', 'Parent', null, ContactAccountType.PARENT, 0);
      const children = Array.from({ length: 100 }, (_, i) =>
        createMockContact(`child-${i}`, `Child ${i}`, 'parent', ContactAccountType.CHILD, 1)
      );

      mockContacts.set(parent.id, parent);
      children.forEach((c: any) => mockContacts.set(c.id, c));

      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(children),
        }),
      });
      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const result = await HierarchyService.getChildren(parent.id);

      expect(result).toHaveLength(100);
    });

    it('should handle negative balances correctly', async () => {
      const contact1 = createMockContact('c1', 'Contact 1', null, ContactAccountType.STANDALONE, 0, '-100.00');
      const contact2 = createMockContact('c2', 'Contact 2', 'c1', ContactAccountType.CHILD, 1, '50.00');

      mockContacts.set(contact1.id, contact1);
      mockContacts.set(contact2.id, contact2);

      const mockWhere = vi.fn();
      mockWhere.mockReturnValueOnce({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([contact2]),
        }),
      }).mockReturnValueOnce({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(db.contacts.where).mockImplementation(mockWhere);

      const total = await HierarchyService.calculateTotalBalance(contact1.id);

      expect(total).toBe('-50.00');
    });
  });
});
