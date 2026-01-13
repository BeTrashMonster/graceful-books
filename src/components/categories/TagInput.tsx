/**
 * TagInput Component
 *
 * Input component for adding and removing tags with autocomplete
 */

import React, { useState, useEffect, useRef } from 'react';
import type { Tag } from '../../db/schema/tags.schema';
import { normalizeTagName } from '../../db/schema/tags.schema';

interface TagInputProps {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  suggestions: Tag[];
  onSearch: (search: string) => void;
  onCreate: (tagName: string) => Promise<Tag | null>;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  maxTags?: number;
}

export const TagInput: React.FC<TagInputProps> = ({
  value,
  onChange,
  suggestions,
  onSearch,
  onCreate,
  placeholder = 'Add tags...',
  disabled = false,
  error,
  maxTags,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input and exclude already selected tags
  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      !value.find((tag) => tag.id === suggestion.id) &&
      suggestion.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowSuggestions(newValue.length > 0);
    setSelectedIndex(0);
    onSearch(newValue);
  };

  // Handle tag removal
  const handleRemoveTag = (tagId: string) => {
    onChange(value.filter((tag) => tag.id !== tagId));
  };

  // Handle tag addition
  const handleAddTag = async (tag: Tag | null) => {
    if (!tag) return;

    // Check if tag already exists in value
    if (value.find((t) => t.id === tag.id)) {
      return;
    }

    // Check max tags limit
    if (maxTags && value.length >= maxTags) {
      return;
    }

    onChange([...value, tag]);
    setInputValue('');
    setShowSuggestions(false);
    setSelectedIndex(0);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (tag: Tag) => {
    handleAddTag(tag);
  };

  // Handle creating new tag
  const handleCreateTag = async () => {
    if (!inputValue.trim()) return;

    const normalized = normalizeTagName(inputValue);
    const newTag = await onCreate(normalized);

    if (newTag) {
      handleAddTag(newTag);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && filteredSuggestions.length > 0) {
        const selectedTag = filteredSuggestions[selectedIndex];
        if (selectedTag) {
          handleSelectSuggestion(selectedTag);
        }
      } else if (inputValue.trim()) {
        handleCreateTag();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions) {
        setSelectedIndex((prev) => Math.min(prev + 1, filteredSuggestions.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag when backspace on empty input
      const lastTag = value[value.length - 1];
      if (lastTag) {
        handleRemoveTag(lastTag.id);
      }
    }
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.tag-input-container')) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  return (
    <div className={`tag-input-container ${disabled ? 'disabled' : ''}`}>
      <div className="tag-input-label">Tags</div>
      <div className="tag-input-wrapper">
        <div className="selected-tags">
          {value.map((tag) => (
            <div key={tag.id} className="tag-chip" style={{ backgroundColor: tag.color || '#e5e7eb' }}>
              <span className="tag-name">{tag.name}</span>
              <button
                className="tag-remove"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={disabled}
                aria-label={`Remove ${tag.name} tag`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled || (maxTags !== undefined && value.length >= maxTags)}
          className="tag-input"
        />
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="tag-suggestions">
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              className={`tag-suggestion ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span
                className="suggestion-color-dot"
                style={{ backgroundColor: suggestion.color || '#e5e7eb' }}
              />
              <span className="suggestion-name">{suggestion.name}</span>
              <span className="suggestion-count">{suggestion.usage_count}</span>
            </div>
          ))}
        </div>
      )}

      {showSuggestions && filteredSuggestions.length === 0 && inputValue.trim() && (
        <div className="tag-suggestions">
          <div className="tag-suggestion create-new" onClick={handleCreateTag}>
            <span className="create-icon">+</span>
            <span className="create-text">Create "{normalizeTagName(inputValue)}"</span>
          </div>
        </div>
      )}

      {error && <div className="tag-input-error">{error}</div>}

      {maxTags && (
        <div className="tag-limit">
          {value.length} / {maxTags} tags
        </div>
      )}

      <style>{`
        .tag-input-container {
          position: relative;
          width: 100%;
        }

        .tag-input-container.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .tag-input-label {
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
          color: #374151;
        }

        .tag-input-wrapper {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          background-color: white;
          min-height: 2.5rem;
          align-items: center;
        }

        .tag-input-wrapper:focus-within {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .selected-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          color: #1f2937;
        }

        .tag-name {
          max-width: 10rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tag-remove {
          background: none;
          border: none;
          font-size: 1.125rem;
          color: #6b7280;
          cursor: pointer;
          padding: 0;
          width: 1rem;
          height: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .tag-remove:hover {
          background-color: rgba(0, 0, 0, 0.1);
        }

        .tag-input {
          flex: 1;
          min-width: 8rem;
          border: none;
          outline: none;
          font-size: 0.875rem;
          padding: 0.25rem;
        }

        .tag-input:disabled {
          cursor: not-allowed;
        }

        .tag-suggestions {
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
          max-height: 12rem;
          overflow-y: auto;
        }

        .tag-suggestion {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .tag-suggestion:hover,
        .tag-suggestion.selected {
          background-color: #f3f4f6;
        }

        .tag-suggestion.create-new {
          font-weight: 500;
          color: #3b82f6;
          border-top: 1px solid #e5e7eb;
        }

        .suggestion-color-dot {
          width: 0.75rem;
          height: 0.75rem;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .suggestion-name {
          flex: 1;
          font-size: 0.875rem;
        }

        .suggestion-count {
          font-size: 0.75rem;
          color: #6b7280;
          background-color: #f3f4f6;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
        }

        .create-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.25rem;
          height: 1.25rem;
          background-color: #3b82f6;
          color: white;
          border-radius: 50%;
          font-size: 1rem;
        }

        .create-text {
          font-size: 0.875rem;
        }

        .tag-input-error {
          margin-top: 0.25rem;
          font-size: 0.875rem;
          color: #ef4444;
        }

        .tag-limit {
          margin-top: 0.25rem;
          font-size: 0.75rem;
          color: #6b7280;
          text-align: right;
        }
      `}</style>
    </div>
  );
};
