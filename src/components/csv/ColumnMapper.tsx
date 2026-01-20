/**
 * Column Mapper Component
 *
 * Allows users to map CSV columns to entity fields.
 * Features: Auto-mapping suggestions, manual override, confidence indicators.
 * WCAG 2.1 AA compliant.
 */

import { useState, useEffect } from 'react';
import type { ColumnMapping, MappingSuggestion, CSVEntityType } from '../../types/csv.types';
import styles from './ColumnMapper.module.css';

export interface ColumnMapperProps {
  /**
   * CSV headers from uploaded file
   */
  headers: string[];
  /**
   * Auto-mapping suggestions
   */
  suggestions: MappingSuggestion[];
  /**
   * Entity type being imported
   */
  entityType: CSVEntityType;
  /**
   * Available entity fields
   */
  availableFields: string[];
  /**
   * Callback when mappings change
   */
  onMappingsChange: (mappings: ColumnMapping[]) => void;
}

/**
 * ColumnMapper Component
 * Map CSV columns to entity fields
 */
export function ColumnMapper({
  headers,
  suggestions,
  entityType,
  availableFields,
  onMappingsChange,
}: ColumnMapperProps) {
  const [mappings, setMappings] = useState<Map<string, string>>(new Map());
  const [showUnmapped, setShowUnmapped] = useState(false);

  // Initialize mappings from suggestions
  useEffect(() => {
    const initialMappings = new Map<string, string>();
    suggestions.forEach((suggestion) => {
      initialMappings.set(suggestion.csvColumn, suggestion.suggestedField);
    });
    setMappings(initialMappings);
  }, [suggestions]);

  // Notify parent when mappings change
  useEffect(() => {
    const columnMappings: ColumnMapping[] = Array.from(mappings.entries()).map(([csvColumn, entityField]) => ({
      csvColumn,
      entityField,
      confidence: getSuggestionConfidence(csvColumn),
    }));
    onMappingsChange(columnMappings);
  }, [mappings, onMappingsChange]);

  // Get confidence for a suggestion
  const getSuggestionConfidence = (csvColumn: string): number => {
    const suggestion = suggestions.find((s) => s.csvColumn === csvColumn);
    return suggestion?.confidence ?? 0;
  };

  // Handle mapping change
  const handleMappingChange = (csvColumn: string, entityField: string) => {
    const newMappings = new Map(mappings);
    if (entityField === '') {
      newMappings.delete(csvColumn);
    } else {
      newMappings.set(csvColumn, entityField);
    }
    setMappings(newMappings);
  };

  // Get confidence level text and class
  const getConfidenceInfo = (confidence: number): { level: string; className: string } => {
    if (confidence >= 0.9) return { level: 'High confidence', className: styles.highConfidence };
    if (confidence >= 0.7) return { level: 'Medium confidence', className: styles.mediumConfidence };
    if (confidence >= 0.5) return { level: 'Low confidence', className: styles.lowConfidence };
    return { level: 'No match', className: styles.noConfidence };
  };

  // Filter headers if showing only unmapped
  const displayHeaders = showUnmapped ? headers.filter((h) => !mappings.has(h)) : headers;

  // Check if all required fields are mapped
  const requiredFields = getRequiredFields(entityType);
  const mappedFields = new Set(mappings.values());
  const unmappedRequired = requiredFields.filter((field) => !mappedFields.has(field));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 id="column-mapper-heading">Map CSV Columns to Fields</h3>
        <p className={styles.description}>
          We've automatically mapped your CSV columns to our fields. Review and adjust as needed.
        </p>
      </div>

      {/* Filter Toggle */}
      <div className={styles.filterRow}>
        <label className={styles.filterLabel}>
          <input
            type="checkbox"
            checked={showUnmapped}
            onChange={(e) => setShowUnmapped(e.target.checked)}
            aria-label="Show only unmapped columns"
          />
          <span>Show only unmapped columns</span>
        </label>
        <span className={styles.mappingCount} aria-live="polite">
          {mappings.size} of {headers.length} columns mapped
        </span>
      </div>

      {/* Required Fields Warning */}
      {unmappedRequired.length > 0 && (
        <div className={styles.warning} role="alert">
          <span className={styles.warningIcon} aria-hidden="true">
            ⚠
          </span>
          <div>
            <strong>Required fields not mapped:</strong>
            <ul className={styles.warningList}>
              {unmappedRequired.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Mapping Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table} aria-labelledby="column-mapper-heading">
          <thead>
            <tr>
              <th scope="col">CSV Column</th>
              <th scope="col">Maps to Field</th>
              <th scope="col">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {displayHeaders.map((header) => {
              const currentMapping = mappings.get(header) || '';
              const confidence = getSuggestionConfidence(header);
              const confidenceInfo = getConfidenceInfo(confidence);

              return (
                <tr key={header}>
                  <td className={styles.csvColumn}>
                    <strong>{header}</strong>
                  </td>
                  <td className={styles.fieldSelect}>
                    <label htmlFor={`mapping-${header}`} className={styles.visuallyHidden}>
                      Map {header} to field
                    </label>
                    <select
                      id={`mapping-${header}`}
                      className={styles.select}
                      value={currentMapping}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                    >
                      <option value="">-- Do not import --</option>
                      {availableFields.map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.confidenceCell}>
                    {currentMapping && (
                      <span className={`${styles.confidenceBadge} ${confidenceInfo.className}`}>
                        {confidenceInfo.level}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {displayHeaders.length === 0 && showUnmapped && (
        <div className={styles.emptyState}>
          <p>All columns have been mapped. Great work!</p>
        </div>
      )}

      {/* Help Text */}
      <div className={styles.helpText}>
        <h4>Mapping Tips:</h4>
        <ul>
          <li>
            <strong>High confidence:</strong> We're pretty sure this mapping is correct
          </li>
          <li>
            <strong>Medium confidence:</strong> This looks like a good match, but please verify
          </li>
          <li>
            <strong>Low confidence:</strong> We took a guess - please check carefully
          </li>
          <li>Select "Do not import" to skip a column</li>
          <li>Required fields (like Date and Amount) must be mapped to proceed</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Get required fields for entity type
 */
function getRequiredFields(entityType: CSVEntityType): string[] {
  switch (entityType) {
    case 'transactions':
      return ['Date', 'Amount', 'Account'];
    case 'invoices':
      return ['Invoice Number', 'Customer', 'Date', 'Amount', 'Status', 'Due Date'];
    case 'bills':
      return ['Bill Number', 'Vendor', 'Date', 'Amount', 'Status', 'Due Date'];
    case 'contacts':
      return ['Name', 'Type'];
    case 'products':
      return ['Name', 'Price', 'Type'];
    default:
      return [];
  }
}
