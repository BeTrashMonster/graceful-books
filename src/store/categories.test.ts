/**
 * Categories Store Tests
 *
 * Comprehensive tests for categories CRUD operations
 */

import { describe, it, expect, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import { db } from './database';
import {
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
  queryCategories,
  getCategoriesHierarchy,
  batchCreateCategories,
  getCategoriesByType,
  getRootCategories,
  getSubCategories,
} from './categories';
import { CategoryType } from '../db/schema/categories.schema';

describe('Categories Store', () => {
  const companyId = nanoid();

  beforeEach(async () => {
    // Clear database before each test
    await db.categories.clear();
    // Set device ID for consistent testing
    localStorage.setItem('deviceId', 'test-device-001');
  });

  afterEach(async () => {
    // Clean up
    await db.categories.clear();
  });

  describe('createCategory', () => {
    it('should create a new category successfully', async () => {
      const result = await createCategory({
        company_id: companyId,
        name: 'Test Category',
        type: CategoryType.INCOME,
        parent_id: null,
        description: 'Test description',
        color: '#10B981',
        icon: 'trending-up',
        active: true,
        is_system: false,
        sort_order: 1,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result as any).data).toBeDefined();
        expect(result.data.name).toBe('Test Category');
        expect(result.data.type).toBe(CategoryType.INCOME);
        expect(result.data.color).toBe('#10B981');
      }
    });

    it('should create a sub-category with valid parent', async () => {
      // Create parent
      const parentResult = await createCategory({
        company_id: companyId,
        name: 'Parent Category',
        type: CategoryType.EXPENSE,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      expect(parentResult.success).toBe(true);

      // Create child
      if (!parentResult.success) throw new Error('Parent creation failed');
      const childResult = await createCategory({
        company_id: companyId,
        name: 'Child Category',
        type: CategoryType.EXPENSE,
        parent_id: parentResult.data.id,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      expect(childResult.success).toBe(true);
      if (childResult.success) {
        expect(childResult.data.parent_id).toBe(parentResult.data.id);
      }
    });

    it('should reject sub-category with mismatched type', async () => {
      // Create parent
      const parentResult = await createCategory({
        company_id: companyId,
        name: 'Parent Category',
        type: CategoryType.INCOME,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      // Try to create child with different type
      if (!parentResult.success) throw new Error('Parent creation failed');
      const childResult = await createCategory({
        company_id: companyId,
        name: 'Child Category',
        type: CategoryType.EXPENSE,
        parent_id: parentResult.data.id,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      expect(childResult.success).toBe(false);
      if (!childResult.success) {
        expect(childResult.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should reject category with invalid color', async () => {
      const result = await createCategory({
        company_id: companyId,
        name: 'Test Category',
        type: CategoryType.INCOME,
        parent_id: null,
        description: null,
        color: 'invalid-color',
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should reject category with missing required fields', async () => {
      const result = await createCategory({
        company_id: companyId,
        name: '',
        type: CategoryType.INCOME,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('getCategory', () => {
    it('should retrieve an existing category', async () => {
      const createResult = await createCategory({
        company_id: companyId,
        name: 'Test Category',
        type: CategoryType.ASSET,
        parent_id: null,
        description: 'Test',
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      if (!createResult.success) throw new Error('Category creation failed');
      const getResult = await getCategory(createResult.data.id);

      expect(getResult.success).toBe(true);
      if (getResult.success) {
        expect(getResult.data.id).toBe(createResult.data.id);
        expect(getResult.data.name).toBe('Test Category');
      }
    });

    it('should return error for non-existent category', async () => {
      const result = await getCategory('non-existent-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should return error for deleted category', async () => {
      const createResult = await createCategory({
        company_id: companyId,
        name: 'Test Category',
        type: CategoryType.INCOME,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      if (!createResult.success) throw new Error('Category creation failed');
      await deleteCategory(createResult.data.id);

      const getResult = await getCategory(createResult.data.id);

      expect(getResult.success).toBe(false);
      if (!getResult.success) {
        expect(getResult.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('updateCategory', () => {
    it('should update category fields', async () => {
      const createResult = await createCategory({
        company_id: companyId,
        name: 'Original Name',
        type: CategoryType.EXPENSE,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      if (!createResult.success) throw new Error('Category creation failed');
      const updateResult = await updateCategory(createResult.data.id, {
        name: 'Updated Name',
        description: 'New description',
        color: '#EF4444',
      });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.name).toBe('Updated Name');
        expect(updateResult.data.description).toBe('New description');
        expect(updateResult.data.color).toBe('#EF4444');
      }
    });

    it('should prevent type change when sub-categories exist', async () => {
      const parentResult = await createCategory({
        company_id: companyId,
        name: 'Parent',
        type: CategoryType.INCOME,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      if (!parentResult.success) throw new Error('Parent creation failed');
      await createCategory({
        company_id: companyId,
        name: 'Child',
        type: CategoryType.INCOME,
        parent_id: parentResult.data.id,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      const updateResult = await updateCategory(parentResult.data.id, {
        type: CategoryType.EXPENSE,
      });

      expect(updateResult.success).toBe(false);
      if (!updateResult.success) {
        expect(updateResult.error.code).toBe('CONSTRAINT_VIOLATION');
      }
    });

    it('should return error for non-existent category', async () => {
      const result = await updateCategory('non-existent-id', {
        name: 'Updated Name',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('deleteCategory', () => {
    it('should soft delete a category', async () => {
      const createResult = await createCategory({
        company_id: companyId,
        name: 'To Delete',
        type: CategoryType.CUSTOM,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      if (!createResult.success) throw new Error('Category creation failed');
      const deleteResult = await deleteCategory(createResult.data.id);

      expect(deleteResult.success).toBe(true);

      const getResult = await getCategory(createResult.data.id);
      expect(getResult.success).toBe(false);
    });

    it('should prevent deletion of system categories', async () => {
      const createResult = await createCategory({
        company_id: companyId,
        name: 'System Category',
        type: CategoryType.INCOME,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: true,
        sort_order: 1,
      });

      if (!createResult.success) throw new Error('Category creation failed');
      const deleteResult = await deleteCategory(createResult.data.id);

      expect(deleteResult.success).toBe(false);
      if (!deleteResult.success) {
        expect(deleteResult.error.code).toBe('CONSTRAINT_VIOLATION');
      }
    });

    it('should prevent deletion of category with sub-categories', async () => {
      const parentResult = await createCategory({
        company_id: companyId,
        name: 'Parent',
        type: CategoryType.EXPENSE,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      if (!parentResult.success) throw new Error('Parent creation failed');
      await createCategory({
        company_id: companyId,
        name: 'Child',
        type: CategoryType.EXPENSE,
        parent_id: parentResult.data.id,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      const deleteResult = await deleteCategory(parentResult.data.id);

      expect(deleteResult.success).toBe(false);
      if (!deleteResult.success) {
        expect(deleteResult.error.code).toBe('CONSTRAINT_VIOLATION');
      }
    });
  });

  describe('queryCategories', () => {
    beforeEach(async () => {
      // Create test categories
      await createCategory({
        company_id: companyId,
        name: 'Income 1',
        type: CategoryType.INCOME,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      await createCategory({
        company_id: companyId,
        name: 'Expense 1',
        type: CategoryType.EXPENSE,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      await createCategory({
        company_id: companyId,
        name: 'Expense 2',
        type: CategoryType.EXPENSE,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: false,
        is_system: false,
        sort_order: 2,
      });
    });

    it('should query all categories for company', async () => {
      const result = await queryCategories({ company_id: companyId });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(3);
      }
    });

    it('should filter by type', async () => {
      const result = await queryCategories({
        company_id: companyId,
        type: CategoryType.EXPENSE,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
        expect(result.data.every((c: any) => c.type === CategoryType.EXPENSE)).toBe(true);
      }
    });

    it('should filter by active status', async () => {
      const result = await queryCategories({
        company_id: companyId,
        active: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
        expect(result.data.every((c: any) => c.active === true)).toBe(true);
      }
    });
  });

  describe('getCategoriesHierarchy', () => {
    it('should build category tree structure', async () => {
      const parent = await createCategory({
        company_id: companyId,
        name: 'Parent',
        type: CategoryType.INCOME,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      if (!parent.success) throw new Error('Parent creation failed');
      await createCategory({
        company_id: companyId,
        name: 'Child 1',
        type: CategoryType.INCOME,
        parent_id: parent.data.id,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      await createCategory({
        company_id: companyId,
        name: 'Child 2',
        type: CategoryType.INCOME,
        parent_id: parent.data.id,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 2,
      });

      const result = await getCategoriesHierarchy(companyId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1); // One root
        expect(result.data[0]?.children.length).toBe(2); // Two children
      }
    });
  });

  describe('batchCreateCategories', () => {
    it('should create multiple categories', async () => {
      const categories = [
        {
          company_id: companyId,
          name: 'Category 1',
          type: CategoryType.INCOME,
          parent_id: null,
          description: null,
          color: null,
          icon: null,
          active: true,
          is_system: false,
          sort_order: 1,
        },
        {
          company_id: companyId,
          name: 'Category 2',
          type: CategoryType.EXPENSE,
          parent_id: null,
          description: null,
          color: null,
          icon: null,
          active: true,
          is_system: false,
          sort_order: 2,
        },
      ];

      const result = await batchCreateCategories(categories);

      expect(result.successful.length).toBe(2);
      expect(result.failed.length).toBe(0);
    });

    it('should handle partial failures', async () => {
      const categories = [
        {
          company_id: companyId,
          name: 'Valid Category',
          type: CategoryType.INCOME,
          parent_id: null,
          description: null,
          color: null,
          icon: null,
          active: true,
          is_system: false,
          sort_order: 1,
        },
        {
          company_id: companyId,
          name: '',
          type: CategoryType.EXPENSE,
          parent_id: null,
          description: null,
          color: null,
          icon: null,
          active: true,
          is_system: false,
          sort_order: 2,
        },
      ];

      const result = await batchCreateCategories(categories);

      expect(result.successful.length).toBe(1);
      expect(result.failed.length).toBe(1);
    });
  });

  describe('getCategoriesByType', () => {
    it('should get categories by type', async () => {
      await createCategory({
        company_id: companyId,
        name: 'Asset Category',
        type: CategoryType.ASSET,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      const result = await getCategoriesByType(companyId, CategoryType.ASSET);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0]?.type).toBe(CategoryType.ASSET);
      }
    });
  });

  describe('getRootCategories', () => {
    it('should get only root categories', async () => {
      const parent = await createCategory({
        company_id: companyId,
        name: 'Root',
        type: CategoryType.INCOME,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      if (!parent.success) throw new Error('Parent creation failed');
      await createCategory({
        company_id: companyId,
        name: 'Child',
        type: CategoryType.INCOME,
        parent_id: parent.data.id,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      const result = await getRootCategories(companyId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0]?.parent_id).toBeNull();
      }
    });
  });

  describe('getSubCategories', () => {
    it('should get sub-categories of parent', async () => {
      const parent = await createCategory({
        company_id: companyId,
        name: 'Parent',
        type: CategoryType.EXPENSE,
        parent_id: null,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      if (!parent.success) throw new Error('Parent creation failed');
      await createCategory({
        company_id: companyId,
        name: 'Child 1',
        type: CategoryType.EXPENSE,
        parent_id: parent.data.id,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 1,
      });

      await createCategory({
        company_id: companyId,
        name: 'Child 2',
        type: CategoryType.EXPENSE,
        parent_id: parent.data.id,
        description: null,
        color: null,
        icon: null,
        active: true,
        is_system: false,
        sort_order: 2,
      });

      const result = await getSubCategories(parent.data.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
        expect(result.data.every((c: any) => c.parent_id === parent.data.id)).toBe(true);
      }
    });
  });
});
