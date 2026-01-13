/**
 * CategoryList Component
 *
 * Display and manage categories in a hierarchical tree view
 */

import React, { useState } from 'react';
import type { Category, CategoryTreeNode } from '../../db/schema/categories.schema';
import { buildCategoryTree } from '../../db/schema/categories.schema';
import { getCategoryColor, getCategoryIcon } from '../../utils/categoryHelpers';

interface CategoryListProps {
  categories: Category[];
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
  onCreate?: (parent?: Category) => void;
  onSelect?: (category: Category) => void;
  selectedId?: string | null;
  showActions?: boolean;
  expandAll?: boolean;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  onEdit,
  onDelete,
  onCreate,
  onSelect,
  selectedId,
  showActions = true,
  expandAll = false,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Build tree structure
  const tree = buildCategoryTree(categories);

  // Handle expand/collapse
  const toggleExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedIds(newExpanded);
  };

  // Render category node
  const renderCategoryNode = (node: CategoryTreeNode, level: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandAll || expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const color = getCategoryColor(node);
    const icon = getCategoryIcon(node);

    return (
      <div key={node.id} className="category-node">
        <div
          className={`category-item ${isSelected ? 'selected' : ''} ${!node.active ? 'inactive' : ''}`}
          style={{ paddingLeft: `${level * 1.5}rem` }}
        >
          <div className="category-main" onClick={() => onSelect?.(node)}>
            {hasChildren && (
              <button
                className="expand-button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span className="expand-spacer" />}

            <span className="category-color" style={{ backgroundColor: color }} />

            <span className="category-icon">{icon}</span>

            <div className="category-info">
              <div className="category-name">
                {node.name}
                {node.is_system && <span className="system-badge">System</span>}
              </div>
              {node.description && (
                <div className="category-description">{node.description}</div>
              )}
            </div>

            <span className="category-type-badge">{node.type}</span>
          </div>

          {showActions && (
            <div className="category-actions">
              {onCreate && (
                <button
                  className="action-button"
                  onClick={() => onCreate(node)}
                  title="Add sub-category"
                >
                  +
                </button>
              )}
              {onEdit && (
                <button
                  className="action-button"
                  onClick={() => onEdit(node)}
                  title="Edit category"
                >
                  ✎
                </button>
              )}
              {onDelete && !node.is_system && (
                <button
                  className="action-button delete"
                  onClick={() => onDelete(node)}
                  title="Delete category"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="category-children">
            {node.children.map((child) => renderCategoryNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="category-list">
      {tree.length > 0 ? (
        tree.map((node) => renderCategoryNode(node))
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <div className="empty-title">No categories yet</div>
          <div className="empty-description">Create your first category to get started</div>
          {onCreate && (
            <button className="create-button" onClick={() => onCreate()}>
              Create Category
            </button>
          )}
        </div>
      )}

      <style>{`
        .category-list {
          width: 100%;
        }

        .category-node {
          border-bottom: 1px solid #f3f4f6;
        }

        .category-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          transition: background-color 0.2s;
        }

        .category-item:hover {
          background-color: #f9fafb;
        }

        .category-item.selected {
          background-color: #eff6ff;
        }

        .category-item.inactive {
          opacity: 0.5;
        }

        .category-main {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
          cursor: pointer;
        }

        .expand-button {
          background: none;
          border: none;
          font-size: 0.75rem;
          color: #6b7280;
          cursor: pointer;
          padding: 0.25rem;
          width: 1.5rem;
          height: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .expand-spacer {
          width: 1.5rem;
        }

        .category-color {
          width: 0.75rem;
          height: 0.75rem;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .category-icon {
          width: 1.25rem;
          height: 1.25rem;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .category-info {
          flex: 1;
          min-width: 0;
        }

        .category-name {
          font-weight: 500;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .system-badge {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          background-color: #dbeafe;
          color: #1e40af;
          border-radius: 0.25rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .category-description {
          font-size: 0.875rem;
          color: #6b7280;
          margin-top: 0.125rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .category-type-badge {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          background-color: #f3f4f6;
          color: #4b5563;
          border-radius: 0.25rem;
          text-transform: uppercase;
          font-weight: 500;
        }

        .category-actions {
          display: flex;
          gap: 0.25rem;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .category-item:hover .category-actions {
          opacity: 1;
        }

        .action-button {
          background: none;
          border: 1px solid #d1d5db;
          color: #6b7280;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .action-button:hover {
          background-color: #f3f4f6;
          border-color: #9ca3af;
        }

        .action-button.delete {
          color: #ef4444;
        }

        .action-button.delete:hover {
          background-color: #fef2f2;
          border-color: #ef4444;
        }

        .category-children {
          background-color: #fafafa;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          text-align: center;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .empty-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 0.5rem;
        }

        .empty-description {
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 1.5rem;
        }

        .create-button {
          padding: 0.5rem 1rem;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .create-button:hover {
          background-color: #2563eb;
        }
      `}</style>
    </div>
  );
};
