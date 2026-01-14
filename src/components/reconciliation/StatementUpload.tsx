/**
 * Statement Upload Component
 *
 * Allows users to upload bank statements (CSV/PDF) with helpful guidance.
 * Includes drag-and-drop support and file validation.
 *
 * Per ACCT-004: Statement upload (PDF/CSV)
 */

import React, { useCallback, useState } from 'react';
import { Button } from '../core/Button';
import { Card } from '../ui/Card';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { Loading } from '../feedback/Loading';
import { parseStatementFile, validateStatement } from '../../services/statementParser';
import type { ParsedStatement } from '../../types/reconciliation.types';
import { logger } from '../../utils/logger';

interface StatementUploadProps {
  accountName?: string;
  onStatementParsed: (statement: ParsedStatement) => void;
  onBack: () => void;
}

export const StatementUpload: React.FC<StatementUploadProps> = ({
  accountName,
  onStatementParsed,
  onBack,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsLoading(true);
      setFileName(file.name);

      try {
        logger.info('Parsing statement file', { fileName: file.name, size: file.size });

        // Parse the file
        const statement = await parseStatementFile(file);

        // Validate the parsed statement
        const validation = validateStatement(statement);
        if (!validation.valid) {
          setError(validation.errors.join(' '));
          setIsLoading(false);
          return;
        }

        logger.info('Statement parsed successfully', {
          transactions: statement.transactions.length,
          period: {
            start: new Date(statement.statementPeriod.startDate).toLocaleDateString(),
            end: new Date(statement.statementPeriod.endDate).toLocaleDateString(),
          },
        });

        onStatementParsed(statement);
      } catch (err) {
        logger.error('Statement parsing failed', err);
        const errorMessage =
          err instanceof Error ? err.message : 'Something went wrong parsing your file.';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [onStatementParsed]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleBrowseClick = useCallback(() => {
    const input = document.getElementById('statement-file-input') as HTMLInputElement;
    input?.click();
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Your Bank Statement</h1>
        <p className="text-lg text-gray-600">
          {accountName
            ? `Let's reconcile your ${accountName} account`
            : "We'll match your statement with your transactions"}
        </p>
      </div>

      <Card className="p-6">
        {isLoading ? (
          <div className="py-12">
            <Loading message="Reading your statement..." />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Drag and drop area */}
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="space-y-4">
                <div className="flex justify-center">
                  <svg
                    className={`w-16 h-16 ${
                      isDragging ? 'text-primary-500' : 'text-gray-400'
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>

                <div>
                  <p className="text-lg font-medium text-gray-900 mb-1">
                    {isDragging ? 'Drop your file here' : 'Drag and drop your statement'}
                  </p>
                  <p className="text-gray-600">or</p>
                </div>

                <Button onClick={handleBrowseClick} variant="outline">
                  Browse Files
                </Button>

                <input
                  id="statement-file-input"
                  type="file"
                  accept=".csv,.pdf"
                  onChange={handleFileInput}
                  className="hidden"
                />

                <p className="text-sm text-gray-500">
                  Supports CSV and PDF files (max 10MB)
                </p>
              </div>
            </div>

            {fileName && !error && (
              <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                <p className="text-success-900">
                  <strong>File selected:</strong> {fileName}
                </p>
              </div>
            )}

            {error && <ErrorMessage message={error} />}

            {/* Instructions */}
            <div className="bg-info-50 border border-info-200 rounded-lg p-4">
              <h3 className="font-semibold text-info-900 mb-2">
                How to download your bank statement:
              </h3>
              <ol className="text-info-900 space-y-2 ml-4" style={{ listStyle: 'decimal' }}>
                <li>Log in to your bank's website</li>
                <li>Find your account statements or transaction history</li>
                <li>
                  Look for an export or download option (usually says "Export to CSV" or
                  "Download")
                </li>
                <li>Choose CSV format if available (it works best)</li>
                <li>Select the date range you want to reconcile</li>
                <li>Download and upload the file here</li>
              </ol>
              <p className="text-sm text-info-800 mt-3">
                <strong>Tip:</strong> Most banks let you download the last 30-90 days of
                transactions as a CSV file.
              </p>
            </div>

            {/* Common issues */}
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                Having trouble? Click here for common issues
              </summary>
              <div className="mt-3 space-y-2 text-gray-600 ml-4">
                <p>
                  <strong>File won't upload?</strong> Make sure it's a CSV or PDF file and
                  under 10MB.
                </p>
                <p>
                  <strong>Can't find the download option?</strong> Try searching for
                  "download transactions" or "export" in your bank's help section.
                </p>
                <p>
                  <strong>Bank only offers PDF?</strong> That's okay! We support PDF files
                  too (though CSV works a bit better).
                </p>
              </div>
            </details>
          </div>
        )}
      </Card>

      <div className="flex justify-between items-center pt-4">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          Back
        </Button>
      </div>
    </div>
  );
};
