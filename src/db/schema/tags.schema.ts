/**
 * Tags Schema Definition
 *
 * Defines the structure for tags used to organize and filter transactions, accounts, and contacts.
 * Tags provide a flexible, non-hierarchical way to categorize items.
 *
 * Requirements:
 * - B8: Categories & Tags - Basic System
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { BaseEntity, VersionVector } from '../../types/database.types';

/**
 * Tag entity for flexible categorization
 */
export interface Tag extends BaseEntity {
  company_id: string; // UUID - links to Company
  name: string; // ENCRYPTED - Tag name (e.g., "urgent", "client-a")
  color: string | null; // Hex color code for UI display (e.g., "#FF5733")
  description: string | null; // ENCRYPTED - Optional description
  usage_count: number; // Number of times this tag is used (for sorting/autocomplete)
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Entity tag association - links tags to various entity types
 * This allows tags to be applied to transactions, accounts, contacts, etc.
 */
export interface EntityTag extends BaseEntity {
  company_id: string; // UUID - links to Company
  tag_id: string; // UUID - links to Tag
  entity_type: EntityType; // Type of entity being tagged
  entity_id: string; // UUID - ID of the entity being tagged
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Entity types that can be tagged
 */
export enum EntityType {
  TRANSACTION = 'TRANSACTION',
  ACCOUNT = 'ACCOUNT',
  CONTACT = 'CONTACT',
  PRODUCT = 'PRODUCT',
}

/**
 * Dexie.js schema definition for Tags table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying tags by company
 * - [company_id+usage_count]: Compound index for popular tags
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const tagsSchema = 'id, company_id, [company_id+usage_count], updated_at, deleted_at';

/**
 * Dexie.js schema definition for EntityTags table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - tag_id: For querying all entities with a tag
 * - entity_id: For querying all tags on an entity
 * - [entity_type+entity_id]: Compound index for entity lookups
 * - [tag_id+entity_type]: Compound index for tag-type lookups
 * - company_id: For querying by company
 * - updated_at: For CRDT conflict resolution
 */
export const entityTagsSchema =
  'id, tag_id, entity_id, [entity_type+entity_id], [tag_id+entity_type], company_id, updated_at, deleted_at';

/**
 * Table name constants
 */
export const TAGS_TABLE = 'tags';
export const ENTITY_TAGS_TABLE = 'entity_tags';

/**
 * Default values for new Tag
 */
export const createDefaultTag = (
  companyId: string,
  name: string,
  deviceId: string
): Partial<Tag> => {
  const now = Date.now();

  return {
    company_id: companyId,
    name: name.toLowerCase().trim(), // Normalize tag names
    color: null,
    description: null,
    usage_count: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new EntityTag
 */
export const createDefaultEntityTag = (
  companyId: string,
  tagId: string,
  entityType: EntityType,
  entityId: string,
  deviceId: string
): Partial<EntityTag> => {
  const now = Date.now();

  return {
    company_id: companyId,
    tag_id: tagId,
    entity_type: entityType,
    entity_id: entityId,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure tag has required fields
 */
export const validateTag = (tag: Partial<Tag>): string[] => {
  const errors: string[] = [];

  if (!tag.company_id) {
    errors.push('company_id is required');
  }

  if (!tag.name || tag.name.trim() === '') {
    errors.push('name is required');
  }

  if (tag.color && !/^#[0-9A-Fa-f]{6}$/.test(tag.color)) {
    errors.push('color must be a valid hex color code');
  }

  // Tag names should be lowercase and trimmed
  if (tag.name && tag.name !== tag.name.toLowerCase().trim()) {
    errors.push('tag name must be lowercase and trimmed');
  }

  // Tag names should not contain spaces (use hyphens instead)
  if (tag.name && tag.name.includes(' ')) {
    errors.push('tag name cannot contain spaces (use hyphens instead)');
  }

  return errors;
};

/**
 * Validation: Ensure entity tag has required fields
 */
export const validateEntityTag = (entityTag: Partial<EntityTag>): string[] => {
  const errors: string[] = [];

  if (!entityTag.company_id) {
    errors.push('company_id is required');
  }

  if (!entityTag.tag_id) {
    errors.push('tag_id is required');
  }

  if (!entityTag.entity_type) {
    errors.push('entity_type is required');
  }

  if (!entityTag.entity_id) {
    errors.push('entity_id is required');
  }

  return errors;
};

/**
 * Query helper: Get all tags for a company
 */
export interface GetTagsQuery {
  company_id: string;
  entity_type?: EntityType;
  entity_id?: string;
  search?: string;
  limit?: number;
}

/**
 * Helper: Normalize tag name
 */
export const normalizeTagName = (name: string): string => {
  return name.toLowerCase().trim().replace(/\s+/g, '-');
};

/**
 * Helper: Generate tag color based on name (deterministic)
 */
export const generateTagColor = (name: string): string => {
  // Simple hash function to generate consistent colors
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate pastel colors for better readability
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
};

/**
 * Helper: Convert HSL to Hex
 */
export const hslToHex = (hsl: string): string => {
  // Parse HSL string
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return '#6B7280'; // Default gray

  const h = parseInt(match[1]!);
  const s = parseInt(match[2]!) / 100;
  const l = parseInt(match[3]!) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Helper: Get suggested tags based on usage
 */
export interface TagSuggestion {
  tag: Tag;
  relevance: number; // 0-1 score
}

/**
 * Tag statistics for analytics
 */
export interface TagStatistics {
  tag_id: string;
  tag_name: string;
  usage_count: number;
  entity_counts: {
    [key in EntityType]?: number;
  };
  color: string | null;
}
