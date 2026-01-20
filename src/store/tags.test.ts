/**
 * Tags Store Tests
 *
 * Comprehensive tests for tags CRUD operations and entity associations
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { nanoid } from 'nanoid';
import { db } from './database';
import {
  createTag,
  getTag,
  updateTag,
  deleteTag,
  queryTags,
  addTagToEntity,
  removeTagFromEntity,
  getEntityTags,
  getEntitiesWithTag,
  getTagStatistics,
  autocompleteTags,
  createAndAddTag,
} from './tags';
import { EntityType } from '../db/schema/tags.schema';

describe('Tags Store', () => {
  const companyId = nanoid();

  beforeEach(async () => {
    // Clear database before each test
    await db.tags.clear();
    await db.entity_tags.clear();
    // Set device ID for consistent testing
    localStorage.setItem('deviceId', 'test-device-001');
  });

  afterEach(async () => {
    // Clean up
    await db.tags.clear();
    await db.entity_tags.clear();
  });

  describe('createTag', () => {
    it('should create a new tag successfully', async () => {
      const result = await createTag({
        company_id: companyId,
        name: 'urgent',
        color: '#EF4444',
        description: 'Urgent items',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result as any).data).toBeDefined();
        expect(result.data.name).toBe('urgent');
        expect(result.data.color).toBe('#EF4444');
        expect(result.data.usage_count).toBe(0);
      }
    });

    it('should normalize tag names', async () => {
      const result = await createTag({
        company_id: companyId,
        name: 'High Priority',
        color: null,
        description: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('high-priority');
      }
    });

    it('should return existing tag if duplicate name', async () => {
      const first = await createTag({
        company_id: companyId,
        name: 'duplicate',
        color: null,
        description: null,
      });

      const second = await createTag({
        company_id: companyId,
        name: 'duplicate',
        color: null,
        description: null,
      });

      expect(second.success).toBe(true);
      if (second.success && first.success) {
        expect(second.data.id).toBe(first.data.id);
      }
    });

    it('should reject tag with invalid color', async () => {
      const result = await createTag({
        company_id: companyId,
        name: 'test',
        color: 'invalid',
        description: null,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should reject tag with empty name', async () => {
      const result = await createTag({
        company_id: companyId,
        name: '',
        color: null,
        description: null,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('getTag', () => {
    it('should retrieve an existing tag', async () => {
      const createResult = await createTag({
        company_id: companyId,
        name: 'test-tag',
        color: '#10B981',
        description: 'Test description',
      });

      if (!createResult.success) throw new Error('Tag creation failed');
      const getResult = await getTag(createResult.data.id);

      expect(getResult.success).toBe(true);
      if (getResult.success) {
        expect(getResult.data.id).toBe(createResult.data.id);
        expect(getResult.data.name).toBe('test-tag');
      }
    });

    it('should return error for non-existent tag', async () => {
      const result = await getTag('non-existent-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should return error for deleted tag', async () => {
      const createResult = await createTag({
        company_id: companyId,
        name: 'to-delete',
        color: null,
        description: null,
      });

      if (!createResult.success) throw new Error('Tag creation failed');
      await deleteTag(createResult.data.id);

      const getResult = await getTag(createResult.data.id);

      expect(getResult.success).toBe(false);
      if (!getResult.success) {
        expect(getResult.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('updateTag', () => {
    it('should update tag fields', async () => {
      const createResult = await createTag({
        company_id: companyId,
        name: 'original',
        color: null,
        description: null,
      });

      if (!createResult.success) throw new Error('Tag creation failed');
      const updateResult = await updateTag(createResult.data.id, {
        name: 'updated',
        color: '#3B82F6',
        description: 'Updated description',
      });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.name).toBe('updated');
        expect(updateResult.data.color).toBe('#3B82F6');
        expect(updateResult.data.description).toBe('Updated description');
      }
    });

    it('should normalize tag name on update', async () => {
      const createResult = await createTag({
        company_id: companyId,
        name: 'original',
        color: null,
        description: null,
      });

      if (!createResult.success) throw new Error('Tag creation failed');
      const updateResult = await updateTag(createResult.data.id, {
        name: 'Updated Name',
      });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.name).toBe('updated-name');
      }
    });

    it('should preserve usage count on update', async () => {
      const createResult = await createTag({
        company_id: companyId,
        name: 'test',
        color: null,
        description: null,
      });

      // Manually update usage count
      if (!createResult.success) throw new Error('Tag creation failed');
      await db.tags.update(createResult.data.id, { usage_count: 5 });

      const updateResult = await updateTag(createResult.data.id, {
        name: 'updated',
      });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.usage_count).toBe(5);
      }
    });

    it('should return error for non-existent tag', async () => {
      const result = await updateTag('non-existent-id', {
        name: 'updated',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('deleteTag', () => {
    it('should soft delete a tag', async () => {
      const createResult = await createTag({
        company_id: companyId,
        name: 'to-delete',
        color: null,
        description: null,
      });

      if (!createResult.success) throw new Error('Tag creation failed');
      const deleteResult = await deleteTag(createResult.data.id);

      expect(deleteResult.success).toBe(true);

      const getResult = await getTag(createResult.data.id);
      expect(getResult.success).toBe(false);
    });

    it('should delete all entity tag associations', async () => {
      const tagResult = await createTag({
        company_id: companyId,
        name: 'test',
        color: null,
        description: null,
      });

      const entityId = nanoid();

      if (!tagResult.success) throw new Error('Tag creation failed');
      await addTagToEntity(
        companyId,
        tagResult.data.id,
        EntityType.TRANSACTION,
        entityId
      );

      await deleteTag(tagResult.data.id);

      const entityTags = await getEntityTags(EntityType.TRANSACTION, entityId);
      if (entityTags.success) {
        expect(entityTags.data.length).toBe(0);
      }
    });

    it('should handle deleting already deleted tag', async () => {
      const createResult = await createTag({
        company_id: companyId,
        name: 'test',
        color: null,
        description: null,
      });

      if (!createResult.success) throw new Error('Tag creation failed');
      await deleteTag(createResult.data.id);
      const secondDelete = await deleteTag(createResult.data.id);

      expect(secondDelete.success).toBe(true);
    });
  });

  describe('queryTags', () => {
    beforeEach(async () => {
      // Create test tags
      await createTag({
        company_id: companyId,
        name: 'urgent',
        color: '#EF4444',
        description: null,
      });

      await createTag({
        company_id: companyId,
        name: 'important',
        color: '#F59E0B',
        description: null,
      });

      await createTag({
        company_id: companyId,
        name: 'client-a',
        color: '#3B82F6',
        description: null,
      });
    });

    it('should query all tags for company', async () => {
      const result = await queryTags({ company_id: companyId });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(3);
      }
    });

    it('should filter tags by search term', async () => {
      const result = await queryTags({
        company_id: companyId,
        search: 'client',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0]?.name).toBe('client-a');
      }
    });

    it('should limit results', async () => {
      const result = await queryTags({
        company_id: companyId,
        limit: 2,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
      }
    });

    it('should sort by usage count', async () => {
      // Manually set usage counts
      const tags = await db.tags.toArray();
      if (tags[0]) await db.tags.update(tags[0].id, { usage_count: 10 });
      if (tags[1]) await db.tags.update(tags[1].id, { usage_count: 5 });
      if (tags[2]) await db.tags.update(tags[2].id, { usage_count: 15 });

      const result = await queryTags({ company_id: companyId });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0]?.usage_count).toBe(15);
        expect(result.data[1]?.usage_count).toBe(10);
        expect(result.data[2]?.usage_count).toBe(5);
      }
    });
  });

  describe('addTagToEntity', () => {
    it('should add tag to entity', async () => {
      const tagResult = await createTag({
        company_id: companyId,
        name: 'test',
        color: null,
        description: null,
      });

      const entityId = nanoid();

      if (!tagResult.success) throw new Error('Tag creation failed');
      const result = await addTagToEntity(
        companyId,
        tagResult.data.id,
        EntityType.TRANSACTION,
        entityId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tag_id).toBe(tagResult.data.id);
        expect(result.data.entity_id).toBe(entityId);
      }
    });

    it('should increment usage count', async () => {
      const tagResult = await createTag({
        company_id: companyId,
        name: 'test',
        color: null,
        description: null,
      });

      const entityId = nanoid();

      if (!tagResult.success) throw new Error('Tag creation failed');
      await addTagToEntity(
        companyId,
        tagResult.data.id,
        EntityType.TRANSACTION,
        entityId
      );

      const updatedTag = await getTag(tagResult.data.id);
      if (updatedTag.success) {
        expect(updatedTag.data.usage_count).toBe(1);
      }
    });

    it('should handle duplicate associations', async () => {
      const tagResult = await createTag({
        company_id: companyId,
        name: 'test',
        color: null,
        description: null,
      });

      const entityId = nanoid();

      if (!tagResult.success) throw new Error('Tag creation failed');
      const first = await addTagToEntity(
        companyId,
        tagResult.data.id,
        EntityType.TRANSACTION,
        entityId
      );

      const second = await addTagToEntity(
        companyId,
        tagResult.data.id,
        EntityType.TRANSACTION,
        entityId
      );

      expect(second.success).toBe(true);
      if (second.success && first.success) {
        expect(second.data.id).toBe(first.data.id);
      }
    });

    it('should return error for non-existent tag', async () => {
      const result = await addTagToEntity(
        companyId,
        'non-existent-id',
        EntityType.TRANSACTION,
        nanoid()
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('removeTagFromEntity', () => {
    it('should remove tag from entity', async () => {
      const tagResult = await createTag({
        company_id: companyId,
        name: 'test',
        color: null,
        description: null,
      });

      const entityId = nanoid();

      if (!tagResult.success) throw new Error('Tag creation failed');
      await addTagToEntity(
        companyId,
        tagResult.data.id,
        EntityType.ACCOUNT,
        entityId
      );

      const removeResult = await removeTagFromEntity(
        (tagResult as any).data.id,
        EntityType.ACCOUNT,
        entityId
      );

      expect(removeResult.success).toBe(true);

      const entityTags = await getEntityTags(EntityType.ACCOUNT, entityId);
      if (entityTags.success) {
        expect(entityTags.data.length).toBe(0);
      }
    });

    it('should decrement usage count', async () => {
      const tagResult = await createTag({
        company_id: companyId,
        name: 'test',
        color: null,
        description: null,
      });

      const entityId = nanoid();

      if (!tagResult.success) throw new Error('Tag creation failed');
      await addTagToEntity(
        companyId,
        tagResult.data.id,
        EntityType.CONTACT,
        entityId
      );

      if (!tagResult.success) throw new Error('Tag creation failed');
      await removeTagFromEntity(
        tagResult.data.id,
        EntityType.CONTACT,
        entityId
      );

      const updatedTag = await getTag(tagResult.data.id);
      if (updatedTag.success) {
        expect(updatedTag.data.usage_count).toBe(0);
      }
    });

    it('should handle removing non-existent association', async () => {
      const tagResult = await createTag({
        company_id: companyId,
        name: 'test',
        color: null,
        description: null,
      });

      if (!tagResult.success) throw new Error('Tag creation failed');
      const result = await removeTagFromEntity(
        tagResult.data.id,
        EntityType.PRODUCT,
        nanoid()
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getEntityTags', () => {
    it('should get all tags for an entity', async () => {
      const tag1 = await createTag({
        company_id: companyId,
        name: 'tag1',
        color: null,
        description: null,
      });

      const tag2 = await createTag({
        company_id: companyId,
        name: 'tag2',
        color: null,
        description: null,
      });

      const entityId = nanoid();

      if (!tag1.success) throw new Error('Tag creation failed');
      await addTagToEntity(
        companyId,
        tag1.data.id,
        EntityType.TRANSACTION,
        entityId
      );

      if (!tag2.success) throw new Error('Tag creation failed');
      await addTagToEntity(
        companyId,
        tag2.data.id,
        EntityType.TRANSACTION,
        entityId
      );

      const result = await getEntityTags(EntityType.TRANSACTION, entityId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
      }
    });

    it('should return empty array for entity with no tags', async () => {
      const result = await getEntityTags(EntityType.ACCOUNT, nanoid());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(0);
      }
    });
  });

  describe('getEntitiesWithTag', () => {
    it('should get all entities with a tag', async () => {
      const tagResult = await createTag({
        company_id: companyId,
        name: 'test',
        color: null,
        description: null,
      });

      const entityId1 = nanoid();
      const entityId2 = nanoid();

      if (!tagResult.success) throw new Error('Tag creation failed');
      await addTagToEntity(
        companyId,
        tagResult.data.id,
        EntityType.TRANSACTION,
        entityId1
      );

      if (!tagResult.success) throw new Error('Tag creation failed');
      await addTagToEntity(
        companyId,
        tagResult.data.id,
        EntityType.TRANSACTION,
        entityId2
      );

      if (!tagResult.success) throw new Error('Tag creation failed');
      const result = await getEntitiesWithTag(tagResult.data.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
        expect((result as any).data).toContain(entityId1);
        expect((result as any).data).toContain(entityId2);
      }
    });

    it('should filter by entity type', async () => {
      const tagResult = await createTag({
        company_id: companyId,
        name: 'test',
        color: null,
        description: null,
      });

      const txnId = nanoid();
      const accountId = nanoid();

      if (!tagResult.success) throw new Error('Tag creation failed');
      await addTagToEntity(
        companyId,
        tagResult.data.id,
        EntityType.TRANSACTION,
        txnId
      );

      await addTagToEntity(
        companyId,
        tagResult.data.id,
        EntityType.ACCOUNT,
        accountId
      );

      const result = await getEntitiesWithTag(
        tagResult.data.id,
        EntityType.TRANSACTION
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0]).toBe(txnId);
      }
    });
  });

  describe('getTagStatistics', () => {
    it('should calculate tag statistics', async () => {
      const tag1 = await createTag({
        company_id: companyId,
        name: 'popular',
        color: null,
        description: null,
      });

      const tag2 = await createTag({
        company_id: companyId,
        name: 'rare',
        color: null,
        description: null,
      });

      // Add multiple associations for tag1
      if (!tag1.success) throw new Error('Tag creation failed');
      await addTagToEntity(
        companyId,
        tag1.data.id,
        EntityType.TRANSACTION,
        nanoid()
      );
      await addTagToEntity(
        companyId,
        tag1.data.id,
        EntityType.TRANSACTION,
        nanoid()
      );
      await addTagToEntity(
        companyId,
        tag1.data.id,
        EntityType.ACCOUNT,
        nanoid()
      );

      // Add one association for tag2
      if (!tag2.success) throw new Error('Tag creation failed');
      await addTagToEntity(
        companyId,
        tag2.data.id,
        EntityType.CONTACT,
        nanoid()
      );

      const result = await getTagStatistics(companyId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);

        const popularStats = result.data.find((s) => s.tag_name === 'popular');
        expect(popularStats?.usage_count).toBe(3);
        expect(popularStats?.entity_counts[EntityType.TRANSACTION]).toBe(2);
        expect(popularStats?.entity_counts[EntityType.ACCOUNT]).toBe(1);

        const rareStats = result.data.find((s) => s.tag_name === 'rare');
        expect(rareStats?.usage_count).toBe(1);
      }
    });
  });

  describe('autocompleteTags', () => {
    beforeEach(async () => {
      await createTag({
        company_id: companyId,
        name: 'important',
        color: null,
        description: null,
      });

      await createTag({
        company_id: companyId,
        name: 'urgent-important',
        color: null,
        description: null,
      });

      await createTag({
        company_id: companyId,
        name: 'client',
        color: null,
        description: null,
      });
    });

    it('should autocomplete tags based on search', async () => {
      const result = await autocompleteTags(companyId, 'import');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
        expect(result.data.every((t) => t.name.includes('import'))).toBe(true);
      }
    });

    it('should respect limit', async () => {
      const result = await autocompleteTags(companyId, 'import', 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1);
      }
    });
  });

  describe('createAndAddTag', () => {
    it('should create tag and add to entity', async () => {
      const entityId = nanoid();

      const result = await createAndAddTag(
        companyId,
        'new-tag',
        EntityType.PRODUCT,
        entityId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('new-tag');
      }

      const entityTags = await getEntityTags(EntityType.PRODUCT, entityId);
      if (entityTags.success) {
        expect(entityTags.data.length).toBe(1);
      }
    });

    it('should use existing tag if available', async () => {
      const existing = await createTag({
        company_id: companyId,
        name: 'existing',
        color: null,
        description: null,
      });

      const entityId = nanoid();

      const result = await createAndAddTag(
        companyId,
        'existing',
        EntityType.TRANSACTION,
        entityId
      );

      expect(result.success).toBe(true);
      if (result.success && existing.success) {
        expect(result.data.id).toBe(existing.data.id);
      }
    });
  });
});
