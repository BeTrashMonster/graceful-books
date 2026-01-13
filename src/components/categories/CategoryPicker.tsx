/**
 * CategoryPicker Component
 *
 * Dropdown component for selecting categories with hierarchical display
 */

import React, { useState, useEffect } from 'react';
import type { Category, CategoryType } from '../../db/schema/categories.schema';
import { getCategoryBreadcrumb } from '../../utils/categoryHelpers';

interface CategoryPickerProps {
  companyId: string;
  value: string | null;
  onChange: (categoryId: string | null) => void;
  type?: CategoryType;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  categories: Category[];
  allowClear?: boolean;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  value,
  onChange,
  type,
  placeholder = 'Select a category',
  disabled = false,
  error,
  categories,
  allowClear = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter categories based on type and search
  const filteredCategories = categories.filter((cat) => {
    const matchesType = !type || cat.type === type;
    const matchesSearch =
      !searchTerm ||
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCategoryBreadcrumb(cat, categories).toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch && cat.active;
  });

  // Get selected category
  const selectedCategory = value ? categories.find((cat) => cat.id === value) : null;

  // Handle selection
  const handleSelect = (categoryId: string | null) => {
    onChange(categoryId);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.category-picker')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Group categories by parent
  const rootCategories = filteredCategories.filter((cat) => !cat.parent_id);
  const getChildren = (parentId: string) =>
    filteredCategories.filter((cat) => cat.parent_id === parentId);

  // Render category option with indentation
  const renderCategoryOption = (category: Category, level: number = 0) => {
    const children = getChildren(category.id);
    const indent = '  '.repeat(level);

    return (
      <React.Fragment key={category.id}>
        <div
          className={`category-option ${value === category.id ? 'selected' : ''}`}
          onClick={() => handleSelect(category.id)}
          style={{ paddingLeft: `${level * 1.5}rem` }}
        >
          {category.icon && <span className="category-icon">{category.icon}</span>}
          <span className="category-name">
            {indent}
            {category.name}
          </span>
          {category.color && (
            <span
              className="category-color-dot"
              style={{ backgroundColor: category.color }}
            />
          )}
        </div>
        {children.map((child) => renderCategoryOption(child, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className={`category-picker ${disabled ? 'disabled' : ''}`}>
      <div className="picker-label">Category</div>
      <div className="picker-control" onClick={() => !disabled && setIsOpen(!isOpen)}>
        <div className="picker-value">
          {selectedCategory ? (
            <>
              {selectedCategory.color && (
                <span
                  className="category-color-dot"
                  style={{ backgroundColor: selectedCategory.color }}
                />
              )}
              <span>{getCategoryBreadcrumb(selectedCategory, categories)}</span>
            </>
          ) : (
            <span className="placeholder">{placeholder}</span>
          )}
        </div>
        <div className="picker-actions">
          {allowClear && value && (
            <button
              className="clear-button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
              disabled={disabled}
            >
              ×
            </button>
          )}
          <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {isOpen && (
        <div className="picker-dropdown">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <div className="category-options">
            {allowClear && (
              <div
                className="category-option clear-option"
                onClick={() => handleSelect(null)}
              >
                <span className="category-name">None</span>
              </div>
            )}
            {rootCategories.length > 0 ? (
              rootCategories.map((cat) => renderCategoryOption(cat))
            ) : (
              <div className="no-results">No categories found</div>
            )}
          </div>
        </div>
      )}

      {error && <div className="picker-error">{error}</div>}

      <style>{`
        .category-picker {
          position: relative;
          width: 100%;
        }

        .category-picker.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .picker-label {
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
          color: #374151;
        }

        .picker-control {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          background-color: white;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .picker-control:hover:not(.disabled) {
          border-color: #9ca3af;
        }

        .picker-control:focus-within {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .picker-value {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }

        .placeholder {
          color: #9ca3af;
        }

        .picker-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .clear-button {
          background: none;
          border: none;
          font-size: 1.25rem;
          color: #6b7280;
          cursor: pointer;
          padding: 0;
          width: 1.25rem;
          height: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .clear-button:hover {
          background-color: #f3f4f6;
        }

        .dropdown-arrow {
          color: #6b7280;
          font-size: 0.75rem;
        }

        .picker-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 0.25rem;
          background-color: white;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          z-index: 50;
          max-height: 20rem;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .search-box {
          padding: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .search-box input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
          font-size: 0.875rem;
        }

        .search-box input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .category-options {
          overflow-y: auto;
          max-height: 16rem;
        }

        .category-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .category-option:hover {
          background-color: #f3f4f6;
        }

        .category-option.selected {
          background-color: #eff6ff;
          color: #3b82f6;
          font-weight: 500;
        }

        .category-option.clear-option {
          font-style: italic;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
        }

        .category-icon {
          width: 1rem;
          height: 1rem;
        }

        .category-name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .category-color-dot {
          width: 0.75rem;
          height: 0.75rem;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .no-results {
          padding: 1rem;
          text-align: center;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .picker-error {
          margin-top: 0.25rem;
          font-size: 0.875rem;
          color: #ef4444;
        }
      `}</style>
    </div>
  );
};
