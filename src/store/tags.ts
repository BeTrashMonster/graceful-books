/**
 * Tags Data Access Layer
 *
 * Provides CRUD operations for tags and entity-tag associations with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Tag autocomplete and search
 */

import { nanoid } from 'nanoid';
import { db } from './database';
import type {
  DatabaseResult,
  
  EncryptionContext,
  VersionVector,
  
} from './types';
import type {
  Tag,
  EntityTag,
  EntityType,
  GetTagsQuery,
  TagStatistics,
} from '../db/schema/tags.schema';
import {
  createDefaultTag,
  createDefaultEntityTag,
  validateTag,
  
  normalizeTagName,
} from '../db/schema/tags.schema';

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
 * Create a new tag
 */
export async function createTag(
  tag: Omit<Tag, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version_vector' | 'usage_count'>,
  context?: EncryptionContext
): Promise<DatabaseResult<Tag>> {
  try {
    // Normalize tag name
    const normalizedName = normalizeTagName(tag.name);

    // Validate tag
    const errors = validateTag({ ...tag, name: normalizedName });
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.join(', '),
        },
      };
    }

    // Check if tag already exists
    const existing = await db.tags
      .where('company_id')
      .equals(tag.company_id)
      .filter((t) => t.name === normalizedName && !t.deleted_at)
      .first();

    if (existing) {
      // Return existing tag instead of creating duplicate
      let result = existing;
      if (context?.encryptionService) {
        const { encryptionService } = context;
        result = {
          ...existing,
          name: await encryptionService.decrypt(existing.name),
          description: existing.description
            ? await encryptionService.decrypt(existing.description)
            : null,
        };
      }
      return { success: true, data: result };
    }

    // Create entity with CRDT fields
    const deviceId = getDeviceId();
    let entity: Tag = {
      id: nanoid(),
      ...createDefaultTag(tag.company_id, normalizedName, deviceId),
      ...tag,
      name: normalizedName,
    } as Tag;

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
    await db.tags.add(entity);

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
 * Get tag by ID
 */
export async function getTag(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Tag>> {
  try {
    const entity = await db.tags.get(id);

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Tag not found: ${id}`,
        },
      };
    }

    // Check if soft deleted
    if (entity.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Tag has been deleted: ${id}`,
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
 * Update an existing tag
 */
export async function updateTag(
  id: string,
  updates: Partial<Omit<Tag, 'id' | 'company_id' | 'created_at' | 'version_vector' | 'usage_count'>>,
  context?: EncryptionContext
): Promise<DatabaseResult<Tag>> {
  try {
    const existing = await db.tags.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Tag not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Tag has been deleted: ${id}`,
        },
      };
    }

    // Normalize tag name if changing
    if (updates.name) {
      updates.name = normalizeTagName(updates.name);
    }

    // Prepare updated entity
    const now = Date.now();

    let updated: Tag = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      company_id: existing.company_id, // Ensure companyId doesn't change
      created_at: existing.created_at, // Preserve creation date
      usage_count: existing.usage_count, // Preserve usage count
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
    await db.tags.put(updated);

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
 * Delete a tag (soft delete with tombstone)
 */
export async function deleteTag(id: string): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.tags.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Tag not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return { success: true, data: undefined }; // Already deleted
    }

    // Soft delete with tombstone marker
    const now = Date.now();

    await db.tags.update(id, {
      deleted_at: now,
      version_vector: incrementVersionVector(existing.version_vector),
      updated_at: now,
    });

    // Also soft delete all entity tag associations
    const entityTags = await db.entity_tags
      .where('tag_id')
      .equals(id)
      .and((et) => !et.deleted_at)
      .toArray();

    for (const entityTag of entityTags) {
      await db.entity_tags.update(entityTag.id, {
        deleted_at: now,
        version_vector: incrementVersionVector(entityTag.version_vector),
        updated_at: now,
      });
    }

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
 * Query tags with filters
 */
export async function queryTags(
  filter: GetTagsQuery,
  context?: EncryptionContext
): Promise<DatabaseResult<Tag[]>> {
  try {
    let query = db.tags.toCollection();

    // Apply filters
    if (filter.company_id) {
      query = db.tags.where('company_id').equals(filter.company_id);
    }

    // Always filter out deleted
    query = query.and((tag) => !tag.deleted_at);

    let entities = await query.toArray();

    // Apply search filter (after decryption if needed)
    if (filter.search) {
      const searchLower = normalizeTagName(filter.search);

      if (context?.encryptionService) {
        const { encryptionService } = context;
        entities = await Promise.all(
          entities.map(async (entity) => ({
            ...entity,
            name: await encryptionService.decrypt(entity.name),
            description: entity.description
              ? await encryptionService.decrypt(entity.description)
              : null,
          }))
        );
        entities = entities.filter((tag) =>
          tag.name.toLowerCase().includes(searchLower)
        );
      } else {
        entities = entities.filter((tag) =>
          tag.name.toLowerCase().includes(searchLower)
        );
      }
    } else if (context?.encryptionService) {
      const { encryptionService } = context;
      entities = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          name: await encryptionService.decrypt(entity.name),
          description: entity.description
            ? await encryptionService.decrypt(entity.description)
            : null,
        }))
      );
    }

    // Sort by usage count (most used first)
    entities.sort((a, b) => b.usage_count - a.usage_count);

    // Apply limit
    if (filter.limit) {
      entities = entities.slice(0, filter.limit);
    }

    return {
      success: true,
      data: entities,
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
 * Add tag to entity
 */
export async function addTagToEntity(
  companyId: string,
  tagId: string,
  entityType: EntityType,
  entityId: string
): Promise<DatabaseResult<EntityTag>> {
  try {
    // Check if tag exists
    const tag = await db.tags.get(tagId);
    if (!tag || tag.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Tag not found',
        },
      };
    }

    // Check if association already exists
    const existing = await db.entity_tags
      .where('[entity_type+entity_id]')
      .equals([entityType, entityId])
      .and((et) => et.tag_id === tagId && !et.deleted_at)
      .first();

    if (existing) {
      return { success: true, data: existing };
    }

    // Create entity tag association
    const deviceId = getDeviceId();
    const entityTag: EntityTag = {
      id: nanoid(),
      ...createDefaultEntityTag(companyId, tagId, entityType, entityId, deviceId),
    } as EntityTag;

    await db.entity_tags.add(entityTag);

    // Increment tag usage count
    await db.tags.update(tagId, {
      usage_count: tag.usage_count + 1,
      updated_at: Date.now(),
      version_vector: incrementVersionVector(tag.version_vector),
    });

    return { success: true, data: entityTag };
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
 * Remove tag from entity
 */
export async function removeTagFromEntity(
  tagId: string,
  entityType: EntityType,
  entityId: string
): Promise<DatabaseResult<void>> {
  try {
    const entityTag = await db.entity_tags
      .where('[entity_type+entity_id]')
      .equals([entityType, entityId])
      .and((et) => et.tag_id === tagId && !et.deleted_at)
      .first();

    if (!entityTag) {
      return { success: true, data: undefined }; // Already removed
    }

    // Soft delete entity tag association
    const now = Date.now();
    await db.entity_tags.update(entityTag.id, {
      deleted_at: now,
      updated_at: now,
      version_vector: incrementVersionVector(entityTag.version_vector),
    });

    // Decrement tag usage count
    const tag = await db.tags.get(tagId);
    if (tag && !tag.deleted_at) {
      await db.tags.update(tagId, {
        usage_count: Math.max(0, tag.usage_count - 1),
        updated_at: now,
        version_vector: incrementVersionVector(tag.version_vector),
      });
    }

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
 * Get tags for an entity
 */
export async function getEntityTags(
  entityType: EntityType,
  entityId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Tag[]>> {
  try {
    const entityTags = await db.entity_tags
      .where('[entity_type+entity_id]')
      .equals([entityType, entityId])
      .and((et) => !et.deleted_at)
      .toArray();

    const tagIds = entityTags.map((et) => et.tag_id);
    const tagsRaw = await db.tags.bulkGet(tagIds);
    const tags: Tag[] = tagsRaw.filter((tag): tag is Tag => tag !== undefined && !tag.deleted_at);

    // Decrypt if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context;
      const decryptedTags: Tag[] = await Promise.all(
        tags.map(async (tag): Promise<Tag> => {
          if (!tag) throw new Error('Tag is undefined');
          return {
            ...tag,
            name: await encryptionService.decrypt(tag.name),
            description: tag.description
              ? await encryptionService.decrypt(tag.description)
              : null,
          };
        })
      );
      return { success: true, data: decryptedTags };
    }

    return { success: true, data: tags };
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
 * Get entities with a specific tag
 */
export async function getEntitiesWithTag(
  tagId: string,
  entityType?: EntityType
): Promise<DatabaseResult<string[]>> {
  try {
    let query = db.entity_tags.where('tag_id').equals(tagId);

    if (entityType) {
      query = db.entity_tags
        .where('[tag_id+entity_type]')
        .equals([tagId, entityType]);
    }

    const entityTags = await query.and((et) => !et.deleted_at).toArray();
    const entityIds = entityTags.map((et) => et.entity_id);

    return { success: true, data: entityIds };
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
 * Get tag statistics
 */
export async function getTagStatistics(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<TagStatistics[]>> {
  try {
    const tags = await db.tags
      .where('company_id')
      .equals(companyId)
      .and((tag) => !tag.deleted_at)
      .toArray();

    const statistics: TagStatistics[] = [];

    for (const tag of tags) {
      const entityTags = await db.entity_tags
        .where('tag_id')
        .equals(tag.id)
        .and((et) => !et.deleted_at)
        .toArray();

      const entityCounts: { [key in EntityType]?: number } = {};
      entityTags.forEach((et) => {
        entityCounts[et.entity_type] = (entityCounts[et.entity_type] || 0) + 1;
      });

      let tagName = tag.name;
      if (context?.encryptionService) {
        tagName = await context.encryptionService.decrypt(tag.name);
      }

      statistics.push({
        tag_id: tag.id,
        tag_name: tagName,
        usage_count: tag.usage_count,
        entity_counts: entityCounts,
        color: tag.color,
      });
    }

    // Sort by usage count
    statistics.sort((a, b) => b.usage_count - a.usage_count);

    return { success: true, data: statistics };
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
 * Autocomplete tags based on search
 */
export async function autocompleteTags(
  companyId: string,
  search: string,
  limit: number = 10,
  context?: EncryptionContext
): Promise<DatabaseResult<Tag[]>> {
  return queryTags(
    {
      company_id: companyId,
      search,
      limit,
    },
    context
  );
}

/**
 * Create tag and add to entity in one operation
 */
export async function createAndAddTag(
  companyId: string,
  tagName: string,
  entityType: EntityType,
  entityId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Tag>> {
  try {
    // Create or get existing tag
    const tagResult = await createTag(
      {
        company_id: companyId,
        name: tagName,
        color: null,
        description: null,
      },
      context
    );

    if (!tagResult.success) {
      return tagResult;
    }

    // Add tag to entity
    await addTagToEntity(companyId, tagResult.data.id, entityType, entityId);

    return tagResult;
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
