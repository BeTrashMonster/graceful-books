/**
 * CSV Importer Component
 *
 * Multi-step wizard for importing CSV files.
 * Steps: 1) Upload, 2) Map Columns, 3) Preview, 4) Import
 * WCAG 2.1 AA compliant.
 */

import { useState, useRef } from 'react';
import type {
  CSVEntityType,
  CSVParseResult,
  ColumnMapping,
  CSVImportConfig,
  CSVImportResult,
  AutoMappingResult,
  ImportMode,
} from '../../types/csv.types';
import { csvImporterService } from '../../services/csv/csvImporter.service';
import { csvValidatorService } from '../../services/csv/csvValidator.service';
import { ColumnMapper } from './ColumnMapper';
import { ImportPreview } from './ImportPreview';
import styles from './CSVImporter.module.css';

export interface CSVImporterProps {
  /**
   * Entity type to import
   */
  entityType: CSVEntityType;
  /**
   * Callback when import completes successfully
   */
  onImportComplete?: (result: CSVImportResult) => void;
  /**
   * Callback when import is cancelled
   */
  onCancel?: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

/**
 * CSVImporter Component
 * Multi-step CSV import wizard
 */
export function CSVImporter({ entityType, onImportComplete, onCancel }: CSVImporterProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [autoMapping, setAutoMapping] = useState<AutoMappingResult | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [validationResult, setValidationResult] = useState<CSVImportResult | null>(null);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError('');

    // Validate file
    const fileValidation = csvValidatorService.validateFile(selectedFile);
    if (!fileValidation.valid) {
      setError(fileValidation.error || 'Invalid file');
      return;
    }

    setFile(selectedFile);

    // Parse CSV
    const result = await csvImporterService.parseCSV(selectedFile);
    if (!result.success) {
      setError(result.error || 'Failed to parse CSV');
      return;
    }

    setParseResult(result);

    // Auto-map columns
    const mapping = csvImporterService.autoMapColumns(result.headers, entityType);
    setAutoMapping(mapping);
    setColumnMappings(csvImporterService.createColumnMappings(mapping.suggestions));

    // Move to mapping step
    setStep('mapping');
  };

  // Handle column mappings change
  const handleMappingsChange = (mappings: ColumnMapping[]) => {
    setColumnMappings(mappings);
  };

  // Proceed to preview
  const handleProceedToPreview = async () => {
    if (!parseResult) return;

    setError('');

    // Validate in dry-run mode
    const config: CSVImportConfig = {
      entityType,
      mode: 'dryRun',
      columnMappings,
      skipFirstRow: true,
      detectDuplicates: true,
      onDuplicateAction: 'skip',
    };

    const result = await csvImporterService.importCSV(config, parseResult.rows);
    setValidationResult(result);

    // Move to preview step
    setStep('preview');
  };

  // Handle import
  const handleImport = async () => {
    if (!parseResult) return;

    setStep('importing');
    setError('');

    try {
      const config: CSVImportConfig = {
        entityType,
        mode: 'import',
        columnMappings,
        skipFirstRow: true,
        detectDuplicates: true,
        onDuplicateAction: 'skip',
      };

      const result = await csvImporterService.importCSV(config, parseResult.rows);

      if (result.success) {
        setValidationResult(result);
        setStep('complete');
        onImportComplete?.(result);
      } else {
        setError(result.error || 'Import failed');
        setStep('preview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  };

  // Reset wizard
  const handleStartOver = () => {
    setStep('upload');
    setFile(null);
    setParseResult(null);
    setAutoMapping(null);
    setColumnMappings([]);
    setValidationResult(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={styles.container}>
      {/* Progress Indicator */}
      <div className={styles.progressBar} role="progressbar" aria-label="Import progress" aria-valuenow={getStepNumber(step)} aria-valuemin={1} aria-valuemax={4}>
        <div className={styles.progressSteps}>
          <div className={`${styles.progressStep} ${step !== 'upload' ? styles.completed : styles.active}`}>
            <span className={styles.stepNumber}>1</span>
            <span className={styles.stepLabel}>Upload</span>
          </div>
          <div className={`${styles.progressStep} ${step === 'preview' || step === 'importing' || step === 'complete' ? styles.completed : step === 'mapping' ? styles.active : ''}`}>
            <span className={styles.stepNumber}>2</span>
            <span className={styles.stepLabel}>Map Columns</span>
          </div>
          <div className={`${styles.progressStep} ${step === 'importing' || step === 'complete' ? styles.completed : step === 'preview' ? styles.active : ''}`}>
            <span className={styles.stepNumber}>3</span>
            <span className={styles.stepLabel}>Preview</span>
          </div>
          <div className={`${styles.progressStep} ${step === 'complete' ? styles.completed : step === 'importing' ? styles.active : ''}`}>
            <span className={styles.stepNumber}>4</span>
            <span className={styles.stepLabel}>Import</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.error} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            ✗
          </span>
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className={styles.uploadStep}>
          <h2>Upload CSV File</h2>
          <p className={styles.description}>
            Select a CSV file to import {entityType}. Maximum file size is 10MB and 10,000 rows.
          </p>

          <div className={styles.uploadArea}>
            <label htmlFor="file-upload" className={styles.uploadLabel}>
              <span className={styles.uploadIcon} aria-hidden="true">
                📁
              </span>
              <span className={styles.uploadText}>
                {file ? file.name : 'Choose a CSV file or drag it here'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                accept=".csv"
                onChange={handleFileChange}
                className={styles.fileInput}
              />
            </label>
          </div>

          {onCancel && (
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={onCancel}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && parseResult && autoMapping && (
        <div className={styles.mappingStep}>
          <ColumnMapper
            headers={parseResult.headers}
            suggestions={autoMapping.suggestions}
            entityType={entityType}
            availableFields={csvImporterService.createColumnMappings(autoMapping.suggestions).map((m) => m.entityField)}
            onMappingsChange={handleMappingsChange}
          />

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={handleStartOver}>
              Start Over
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleProceedToPreview}
              disabled={columnMappings.length === 0}
            >
              Continue to Preview
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && parseResult && validationResult && (
        <div className={styles.previewStep}>
          <ImportPreview
            preview={parseResult.preview}
            mappings={columnMappings}
            errors={validationResult.validation.errors}
            warnings={validationResult.validation.warnings}
            totalRows={parseResult.totalRows}
          />

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setStep('mapping')}>
              Back to Mapping
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleImport}
              disabled={validationResult.validation.errors.length > 0}
            >
              {validationResult.validation.errors.length > 0 ? 'Fix Errors to Import' : 'Import Data'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className={styles.importingStep}>
          <div className={styles.spinner} aria-live="polite" aria-busy="true">
            <div className={styles.spinnerCircle}></div>
            <p>Importing your data...</p>
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && validationResult && (
        <div className={styles.completeStep}>
          <div className={styles.success} role="status">
            <span className={styles.successIcon} aria-hidden="true">
              ✓
            </span>
            <h2>Import Complete!</h2>
            <p className={styles.resultText}>
              Successfully imported <strong>{validationResult.imported}</strong> rows.
            </p>
            {validationResult.skipped > 0 && (
              <p className={styles.skippedText}>
                Skipped <strong>{validationResult.skipped}</strong> rows (duplicates or errors).
              </p>
            )}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={handleStartOver}>
              Import Another File
            </button>
            {onCancel && (
              <button type="button" className={styles.secondaryButton} onClick={onCancel}>
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Get step number for progress bar
 */
function getStepNumber(step: ImportStep): number {
  switch (step) {
    case 'upload':
      return 1;
    case 'mapping':
      return 2;
    case 'preview':
      return 3;
    case 'importing':
    case 'complete':
      return 4;
    default:
      return 1;
  }
}
