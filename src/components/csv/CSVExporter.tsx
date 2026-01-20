/**
 * CSV Exporter Component
 *
 * Allows users to export transactions, invoices, bills, contacts, and products to CSV.
 * Features: Entity type selection, date range, field selection, download.
 * WCAG 2.1 AA compliant.
 */

import { useState } from 'react';
import type {
  CSVEntityType,
  CSVExportConfig,
  DateRangePreset,
} from '../../types/csv.types';
import { csvExporterService } from '../../services/csv/csvExporter.service';
import styles from './CSVExporter.module.css';

export interface CSVExporterProps {
  /**
   * Default entity type
   */
  defaultEntityType?: CSVEntityType;
  /**
   * Callback when export completes
   */
  onExportComplete?: (filename: string, rowCount: number) => void;
  /**
   * Callback when export fails
   */
  onExportError?: (error: string) => void;
}

/**
 * CSVExporter Component
 * Export entity data to CSV format
 */
export function CSVExporter({
  defaultEntityType = 'transactions',
  onExportComplete,
  onExportError,
}: CSVExporterProps) {
  const [entityType, setEntityType] = useState<CSVEntityType>(defaultEntityType);
  const [dateRange, setDateRange] = useState<DateRangePreset>('allTime');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Get available fields for current entity type
  const availableFields = csvExporterService.getAvailableFields(entityType);

  // Initialize selected fields when entity type changes
  const handleEntityTypeChange = (newType: CSVEntityType) => {
    setEntityType(newType);
    setSelectedFields(new Set()); // Reset selections
    setSuccessMessage('');
    setErrorMessage('');
  };

  // Toggle field selection
  const toggleField = (field: string) => {
    const newSet = new Set(selectedFields);
    if (newSet.has(field)) {
      newSet.delete(field);
    } else {
      newSet.add(field);
    }
    setSelectedFields(newSet);
  };

  // Select all fields
  const selectAll = () => {
    setSelectedFields(new Set(availableFields));
  };

  // Deselect all fields
  const deselectAll = () => {
    setSelectedFields(new Set());
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const config: CSVExportConfig = {
        entityType,
        dateRange,
        customStartDate: customStartDate ? new Date(customStartDate) : undefined,
        customEndDate: customEndDate ? new Date(customEndDate) : undefined,
        selectedFields: selectedFields.size > 0 ? Array.from(selectedFields) : undefined,
        includeHeaders: true,
        encoding: 'utf-8',
      };

      const result = await csvExporterService.exportToCSV(config);

      if (result.success) {
        // Download the file
        csvExporterService.downloadCSV(result.filename, result.csvContent);
        setSuccessMessage(`Successfully exported ${result.rowCount} rows to ${result.filename}`);
        onExportComplete?.(result.filename, result.rowCount);
      } else {
        setErrorMessage(result.error || 'Export failed');
        onExportError?.(result.error || 'Export failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      setErrorMessage(message);
      onExportError?.(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 id="export-heading">Export to CSV</h2>
        <p className={styles.description}>
          Choose what to export and download your data in CSV format.
        </p>
      </div>

      {/* Entity Type Selection */}
      <div className={styles.section}>
        <label htmlFor="entity-type" className={styles.label}>
          What would you like to export? <span className={styles.required}>*</span>
        </label>
        <select
          id="entity-type"
          className={styles.select}
          value={entityType}
          onChange={(e) => handleEntityTypeChange(e.target.value as CSVEntityType)}
          aria-required="true"
        >
          <option value="transactions">Transactions</option>
          <option value="invoices">Invoices</option>
          <option value="bills">Bills</option>
          <option value="contacts">Contacts</option>
          <option value="products">Products/Services</option>
        </select>
      </div>

      {/* Date Range Selection */}
      {(entityType === 'transactions' || entityType === 'invoices' || entityType === 'bills') && (
        <div className={styles.section}>
          <label htmlFor="date-range" className={styles.label}>
            Date range
          </label>
          <select
            id="date-range"
            className={styles.select}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
          >
            <option value="allTime">All time</option>
            <option value="last30">Last 30 days</option>
            <option value="last90">Last 90 days</option>
            <option value="last365">Last 365 days</option>
            <option value="ytd">Year to date</option>
            <option value="lastYear">Last year</option>
            <option value="custom">Custom range</option>
          </select>

          {dateRange === 'custom' && (
            <div className={styles.customDateRange}>
              <div className={styles.dateField}>
                <label htmlFor="start-date" className={styles.label}>
                  Start date
                </label>
                <input
                  type="date"
                  id="start-date"
                  className={styles.input}
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className={styles.dateField}>
                <label htmlFor="end-date" className={styles.label}>
                  End date
                </label>
                <input
                  type="date"
                  id="end-date"
                  className={styles.input}
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Field Selection */}
      <div className={styles.section}>
        <div className={styles.fieldHeader}>
          <label className={styles.label}>Fields to include</label>
          <div className={styles.fieldActions}>
            <button
              type="button"
              className={styles.linkButton}
              onClick={selectAll}
              aria-label="Select all fields"
            >
              Select all
            </button>
            <span className={styles.separator}>|</span>
            <button
              type="button"
              className={styles.linkButton}
              onClick={deselectAll}
              aria-label="Deselect all fields"
            >
              Deselect all
            </button>
          </div>
        </div>
        <div className={styles.fieldList} role="group" aria-labelledby="field-selection-label">
          <span id="field-selection-label" className={styles.visuallyHidden}>
            Select fields to include in export
          </span>
          {availableFields.map((field) => (
            <label key={field} className={styles.checkbox}>
              <input
                type="checkbox"
                checked={selectedFields.has(field)}
                onChange={() => toggleField(field)}
                aria-label={`Include ${field}`}
              />
              <span>{field}</span>
            </label>
          ))}
        </div>
        <p className={styles.hint}>
          Leave unchecked to include all fields
        </p>
      </div>

      {/* Export Button */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.exportButton}
          onClick={handleExport}
          disabled={isExporting}
          aria-busy={isExporting}
        >
          {isExporting ? 'Exporting...' : 'Export to CSV'}
        </button>
      </div>

      {/* Status Messages */}
      {successMessage && (
        <div className={styles.success} role="status" aria-live="polite">
          <span className={styles.icon} aria-hidden="true">
            ✓
          </span>
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className={styles.error} role="alert" aria-live="assertive">
          <span className={styles.icon} aria-hidden="true">
            ✗
          </span>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
