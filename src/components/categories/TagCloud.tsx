/**
 * TagCloud Component
 *
 * Display all tags as a visual cloud with size based on usage
 */

import React, { useState } from 'react';
import type { Tag } from '../../db/schema/tags.schema';
import type { TagStatistics } from '../../db/schema/tags.schema';

interface TagCloudProps {
  tags: Tag[] | TagStatistics[];
  onTagClick?: (tag: Tag | TagStatistics) => void;
  selectedTagId?: string | null;
  showUsageCount?: boolean;
  sizeVariation?: boolean;
}

export const TagCloud: React.FC<TagCloudProps> = ({
  tags,
  onTagClick,
  selectedTagId,
  showUsageCount = true,
  sizeVariation = true,
}) => {
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null);

  if (tags.length === 0) {
    return (
      <div className="tag-cloud-empty">
        <div className="empty-icon">🏷️</div>
        <div className="empty-text">No tags yet</div>
        <div className="empty-description">Tags will appear here once you create them</div>

        <style>{`
          .tag-cloud-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            text-align: center;
            color: #6b7280;
          }

          .empty-icon {
            font-size: 3rem;
            margin-bottom: 0.5rem;
          }

          .empty-text {
            font-size: 1rem;
            font-weight: 500;
            margin-bottom: 0.25rem;
          }

          .empty-description {
            font-size: 0.875rem;
          }
        `}</style>
      </div>
    );
  }

  // Calculate size scale based on usage
  const getTagSize = (tag: Tag | TagStatistics) => {
    if (!sizeVariation) return 'medium';

    const usageCount = 'usage_count' in tag ? tag.usage_count : 0;
    const maxUsage = Math.max(...tags.map((t) => ('usage_count' in t ? t.usage_count : 0)));
    const minUsage = Math.min(...tags.map((t) => ('usage_count' in t ? t.usage_count : 0)));
    const range = maxUsage - minUsage;

    if (range === 0) return 'medium';

    const normalized = (usageCount - minUsage) / range;

    if (normalized < 0.33) return 'small';
    if (normalized < 0.66) return 'medium';
    return 'large';
  };

  // Get tag ID
  const getTagId = (tag: Tag | TagStatistics) => {
    return 'tag_id' in tag ? tag.tag_id : tag.id;
  };

  // Get tag name
  const getTagName = (tag: Tag | TagStatistics) => {
    return 'tag_name' in tag ? tag.tag_name : tag.name;
  };

  // Get tag color
  const getTagColor = (tag: Tag | TagStatistics) => {
    return tag.color || '#e5e7eb';
  };

  // Get usage count
  const getUsageCount = (tag: Tag | TagStatistics) => {
    return 'usage_count' in tag ? tag.usage_count : 0;
  };

  return (
    <div className="tag-cloud">
      <div className="tag-cloud-container">
        {tags.map((tag) => {
          const tagId = getTagId(tag);
          const tagName = getTagName(tag);
          const tagColor = getTagColor(tag);
          const usageCount = getUsageCount(tag);
          const size = getTagSize(tag);
          const isSelected = selectedTagId === tagId;
          const isHovered = hoveredTagId === tagId;

          return (
            <div
              key={tagId}
              className={`tag-cloud-item ${size} ${isSelected ? 'selected' : ''} ${
                isHovered ? 'hovered' : ''
              }`}
              style={{
                backgroundColor: tagColor,
              }}
              onClick={() => onTagClick?.(tag)}
              onMouseEnter={() => setHoveredTagId(tagId)}
              onMouseLeave={() => setHoveredTagId(null)}
            >
              <span className="tag-cloud-name">{tagName}</span>
              {showUsageCount && usageCount > 0 && (
                <span className="tag-cloud-count">{usageCount}</span>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .tag-cloud {
          width: 100%;
        }

        .tag-cloud-container {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          padding: 0.5rem;
        }

        .tag-cloud-item {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          color: #1f2937;
          cursor: pointer;
          transition: all 0.2s;
          user-select: none;
        }

        .tag-cloud-item.small {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
        }

        .tag-cloud-item.medium {
          font-size: 0.875rem;
          padding: 0.375rem 0.75rem;
        }

        .tag-cloud-item.large {
          font-size: 1rem;
          padding: 0.5rem 1rem;
          font-weight: 500;
        }

        .tag-cloud-item:hover,
        .tag-cloud-item.hovered {
          transform: scale(1.05);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .tag-cloud-item.selected {
          box-shadow: 0 0 0 2px #3b82f6;
          font-weight: 600;
        }

        .tag-cloud-name {
          white-space: nowrap;
        }

        .tag-cloud-count {
          font-size: 0.75rem;
          background-color: rgba(255, 255, 255, 0.3);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};
