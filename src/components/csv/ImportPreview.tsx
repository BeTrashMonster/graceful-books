/**
 * Import Preview Component
 *
 * Shows preview of first 10 rows before import.
 * Features: Validation errors display, row-level error highlighting.
 * WCAG 2.1 AA compliant.
 */

import type { CSVRowError, ColumnMapping } from '../../types/csv.types';
import styles from './ImportPreview.module.css';

export interface ImportPreviewProps {
  /**
   * Preview rows (first 10)
   */
  preview: string[][];
  /**
   * Column mappings
   */
  mappings: ColumnMapping[];
  /**
   * Validation errors
   */
  errors?: CSVRowError[];
  /**
   * Validation warnings
   */
  warnings?: CSVRowError[];
  /**
   * Total rows in file
   */
  totalRows: number;
}

/**
 * ImportPreview Component
 * Preview CSV data before import
 */
export function ImportPreview({ preview, mappings, errors = [], warnings = [], totalRows }: ImportPreviewProps) {
  // Create header labels from mappings
  const headers = mappings.map((m) => m.entityField);

  // Get row errors
  const getRowErrors = (rowNumber: number): CSVRowError[] => {
    return errors.filter((err) => err.rowNumber === rowNumber);
  };

  // Get row warnings
  const getRowWarnings = (rowNumber: number): CSVRowError[] => {
    return warnings.filter((warn) => warn.rowNumber === rowNumber);
  };

  // Check if row has errors
  const hasRowErrors = (rowNumber: number): boolean => {
    return getRowErrors(rowNumber).length > 0;
  };

  // Check if row has warnings
  const hasRowWarnings = (rowNumber: number): boolean => {
    return getRowWarnings(rowNumber).length > 0;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 id="preview-heading">Preview Your Data</h3>
        <p className={styles.description}>
          Here's a preview of the first 10 rows. Review for accuracy before importing.
        </p>
        <div className={styles.stats}>
          <span className={styles.stat}>
            <strong>{totalRows}</strong> total rows
          </span>
          <span className={styles.stat}>
            <strong>{preview.length}</strong> rows shown
          </span>
          {errors.length > 0 && (
            <span className={`${styles.stat} ${styles.errorStat}`}>
              <strong>{errors.length}</strong> errors found
            </span>
          )}
          {warnings.length > 0 && (
            <span className={`${styles.stat} ${styles.warningStat}`}>
              <strong>{warnings.length}</strong> warnings
            </span>
          )}
        </div>
      </div>

      {/* Error Summary */}
      {errors.length > 0 && (
        <div className={styles.errorSummary} role="alert">
          <div className={styles.errorHeader}>
            <span className={styles.errorIcon} aria-hidden="true">
              ✗
            </span>
            <strong>Validation Errors Found</strong>
          </div>
          <p>Please fix the following errors before importing:</p>
          <ul className={styles.errorList}>
            {errors.slice(0, 5).map((error, index) => (
              <li key={index}>
                <strong>Row {error.rowNumber}:</strong> {error.message}
              </li>
            ))}
            {errors.length > 5 && (
              <li className={styles.moreErrors}>
                ...and {errors.length - 5} more errors
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Warning Summary */}
      {warnings.length > 0 && (
        <div className={styles.warningSummary} role="status">
          <div className={styles.warningHeader}>
            <span className={styles.warningIcon} aria-hidden="true">
              ⚠
            </span>
            <strong>Warnings</strong>
          </div>
          <p>These rows have potential issues but can still be imported:</p>
          <ul className={styles.warningList}>
            {warnings.slice(0, 3).map((warning, index) => (
              <li key={index}>
                <strong>Row {warning.rowNumber}:</strong> {warning.message}
              </li>
            ))}
            {warnings.length > 3 && (
              <li className={styles.moreWarnings}>
                ...and {warnings.length - 3} more warnings
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Preview Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table} aria-labelledby="preview-heading">
          <thead>
            <tr>
              <th scope="col" className={styles.rowNumberHeader}>
                Row
              </th>
              {headers.map((header, index) => (
                <th key={index} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, rowIndex) => {
              const rowNumber = rowIndex + 2; // +2 because row 1 is headers
              const hasErrors = hasRowErrors(rowNumber);
              const hasWarnings = hasRowWarnings(rowNumber);
              const rowErrors = getRowErrors(rowNumber);
              const rowWarnings = getRowWarnings(rowNumber);

              return (
                <tr
                  key={rowIndex}
                  className={hasErrors ? styles.errorRow : hasWarnings ? styles.warningRow : ''}
                >
                  <td className={styles.rowNumber}>
                    {rowNumber}
                    {(hasErrors || hasWarnings) && (
                      <span className={styles.rowIndicator} aria-label={hasErrors ? 'Has errors' : 'Has warnings'}>
                        {hasErrors ? '✗' : '⚠'}
                      </span>
                    )}
                  </td>
                  {row.map((cell, cellIndex) => {
                    const header = headers[cellIndex];
                    const cellErrors = [...rowErrors, ...rowWarnings].filter((err) => err.field === header);
                    const hasCellError = cellErrors.length > 0;

                    return (
                      <td
                        key={cellIndex}
                        className={hasCellError ? styles.errorCell : ''}
                        title={hasCellError ? cellErrors[0].message : undefined}
                      >
                        {cell || <span className={styles.emptyCell}>(empty)</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {preview.length === 0 && (
        <div className={styles.emptyState}>
          <p>No data to preview</p>
        </div>
      )}

      {/* Help Text */}
      <div className={styles.helpText}>
        <p>
          <strong>Preview shows first 10 rows only.</strong> All {totalRows} rows will be validated and imported if you
          proceed.
        </p>
      </div>
    </div>
  );
}
