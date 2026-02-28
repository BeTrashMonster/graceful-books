/**
 * Autocomplete Component
 *
 * A flexible autocomplete input with fuzzy search support.
 * Features:
 * - Fuzzy matching (e.g., "ast" matches "Last Frontier", "Astro", "Plaster Co")
 * - Alphabetical ordering
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Accessible (ARIA labels, roles)
 * - Create new option on Enter if no match
 */

import { useState, useRef, useEffect } from 'react';
import styles from './Autocomplete.module.css';

export interface AutocompleteOption {
  value: string;
  label: string;
}

export interface AutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCreateNew?: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  createPrompt?: string;
}

export function Autocomplete({
  label,
  value,
  onChange,
  onCreateNew,
  options,
  placeholder,
  required,
  helperText,
  error,
  disabled,
  allowCreate = true,
  createPrompt = 'Create new:',
}: AutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fuzzy search function
  const fuzzyMatch = (search: string, text: string): boolean => {
    if (!search || !text) return false;

    const searchLower = search.toLowerCase();
    const textLower = text.toLowerCase();

    console.log('Fuzzy matching:', { search: searchLower, text: textLower, includes: textLower.includes(searchLower) });

    // Direct substring match (most important - "abc" matches "ABC Supplies")
    if (textLower.includes(searchLower)) {
      console.log('✓ Substring match found');
      return true;
    }

    // Check if search is substring of any word in text
    const words = textLower.split(/\s+/);
    for (const word of words) {
      if (word.includes(searchLower)) {
        console.log('✓ Word match found:', word);
        return true;
      }
    }

    // Fuzzy character match (all characters appear in order)
    // "ast" matches "Last Frontier"
    let searchIndex = 0;
    for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
      if (textLower[i] === searchLower[searchIndex]) {
        searchIndex++;
      }
    }
    const fuzzyMatched = searchIndex === searchLower.length;
    if (fuzzyMatched) {
      console.log('✓ Fuzzy sequential match found');
    }
    return fuzzyMatched;
  };

  // Filter and sort options
  const filteredOptions = inputValue.trim()
    ? (() => {
        console.log('=== AUTOCOMPLETE FILTERING ===');
        console.log('Input value:', inputValue);
        console.log('Available options:', options.map(o => o.label));
        const filtered = options.filter(option => {
          const matches = fuzzyMatch(inputValue, option.label);
          console.log(`  "${inputValue}" vs "${option.label}": ${matches ? '✓ MATCH' : '✗ NO MATCH'}`);
          return matches;
        });
        console.log('Filtered results:', filtered.map(o => o.label));
        return filtered.sort((a, b) => {
          // Exact matches first
          const aExact = a.label.toLowerCase() === inputValue.toLowerCase();
          const bExact = b.label.toLowerCase() === inputValue.toLowerCase();
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;

          // Starts with match next
          const aStarts = a.label.toLowerCase().startsWith(inputValue.toLowerCase());
          const bStarts = b.label.toLowerCase().startsWith(inputValue.toLowerCase());
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;

          // Then alphabetical
          return a.label.localeCompare(b.label);
        });
      })()
    : [...options].sort((a, b) => a.label.localeCompare(b.label));

  const exactMatch = options.some(opt => {
    const matches = opt.label.toLowerCase() === inputValue.toLowerCase();
    if (inputValue.trim()) {
      console.log(`Exact match check: "${inputValue.toLowerCase()}" === "${opt.label.toLowerCase()}"? ${matches}`);
    }
    return matches;
  });
  const showCreateOption =
    allowCreate &&
    inputValue.trim() &&
    !exactMatch;

  console.log('=== CREATE OPTION DECISION ===');
  console.log('Create option check:', {
    inputValue,
    allowCreate,
    hasInput: !!inputValue.trim(),
    exactMatch,
    showCreateOption,
    filteredOptionsCount: filteredOptions.length,
    filteredLabels: filteredOptions.map(o => o.label)
  });

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleBlur = () => {
    // Delay to allow click events on dropdown items to fire first
    setTimeout(() => {
      // Auto-select if there's exactly one match
      if (filteredOptions.length === 1) {
        console.log('Auto-selecting single match on blur:', filteredOptions[0].label);
        handleOptionSelect(filteredOptions[0]);
        return;
      }

      // If there's an exact case-insensitive match, use the properly-cased version
      const exactMatch = filteredOptions.find(opt => opt.label.toLowerCase() === inputValue.toLowerCase());
      if (exactMatch) {
        console.log('Auto-correcting case on blur:', inputValue, '->', exactMatch.label);
        handleOptionSelect(exactMatch);
        return;
      }

      // Otherwise keep what they typed
      console.log('No auto-selection on blur, keeping:', inputValue);
    }, 200);
  };

  const handleOptionSelect = (option: AutocompleteOption) => {
    setInputValue(option.label);
    onChange(option.value);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleCreateNew = async () => {
    if (inputValue.trim() && onCreateNew) {
      await onCreateNew(inputValue.trim());
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && e.key !== 'Escape') {
      setIsOpen(true);
      return;
    }

    const totalOptions = filteredOptions.length + (showCreateOption ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < totalOptions - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : totalOptions - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          if (highlightedIndex < filteredOptions.length) {
            handleOptionSelect(filteredOptions[highlightedIndex]);
          } else if (showCreateOption) {
            handleCreateNew();
          }
        } else if (showCreateOption) {
          handleCreateNew();
        } else if (filteredOptions.length === 1) {
          handleOptionSelect(filteredOptions[0]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div ref={containerRef} className={styles.container}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-label="required">*</span>}
      </label>

      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="autocomplete-list"
          aria-activedescendant={highlightedIndex >= 0 ? `option-${highlightedIndex}` : undefined}
          aria-autocomplete="list"
        />

        {isOpen && (filteredOptions.length > 0 || showCreateOption) && (
          <ul
            ref={listRef}
            id="autocomplete-list"
            className={styles.dropdown}
            role="listbox"
          >
            {filteredOptions.map((option, index) => (
              <li
                key={option.value}
                id={`option-${index}`}
                className={`${styles.option} ${index === highlightedIndex ? styles.optionHighlighted : ''}`}
                onClick={() => handleOptionSelect(option)}
                role="option"
                aria-selected={index === highlightedIndex}
              >
                {option.label}
              </li>
            ))}

            {showCreateOption && (
              <li
                id={`option-${filteredOptions.length}`}
                className={`${styles.option} ${styles.optionCreate} ${filteredOptions.length === highlightedIndex ? styles.optionHighlighted : ''}`}
                onClick={handleCreateNew}
                role="option"
                aria-selected={filteredOptions.length === highlightedIndex}
              >
                <span className={styles.createPrompt}>{createPrompt}</span>
                <span className={styles.createValue}>{inputValue}</span>
              </li>
            )}
          </ul>
        )}
      </div>

      {helperText && !error && (
        <p className={styles.helperText}>{helperText}</p>
      )}

      {error && (
        <p className={styles.errorText} role="alert">{error}</p>
      )}
    </div>
  );
}
