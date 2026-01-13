/**
 * Upload Statement Step
 *
 * File upload with drag-and-drop for bank statements (PDF/CSV).
 * Parses the statement and runs auto-matching.
 */

import { useState, useCallback, useRef } from 'react';
import { Button } from '../../core/Button';
import { Card } from '../../ui/Card';
import { Loading } from '../../feedback/Loading';
import { ErrorMessage } from '../../feedback/ErrorMessage';
import type { ParsedStatement, TransactionMatch } from '../../../types/reconciliation.types';
import { parseCSVStatement } from '../../../utils/parsers/csvParser';
import { parsePDFStatement } from '../../../utils/parsers/pdfParser';
import { matchTransactions } from '../../../utils/parsers/matchingAlgorithm';
import { queryTransactions } from '../../../store';

interface UploadStatementStepProps {
  accountId: string;
  companyId: string;
  onStatementParsed: (statement: ParsedStatement, matches: TransactionMatch[]) => void;
  onBack: () => void;
  onCancel: () => void;
}

export function UploadStatementStep({
  accountId,
  companyId,
  onStatementParsed,
  onBack,
  onCancel,
}: UploadStatementStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsProcessing(true);
      setProgress('Reading file...');

      try {
        // Validate file type
        const fileType = file.type;
        const fileName = file.name.toLowerCase();

        let statement: ParsedStatement;

        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
          setProgress('Extracting data from PDF...');
          statement = await parsePDFStatement(file);
        } else if (
          fileType === 'text/csv' ||
          fileType === 'application/vnd.ms-excel' ||
          fileName.endsWith('.csv')
        ) {
          setProgress('Parsing CSV data...');
          statement = await parseCSVStatement(file);
        } else {
          throw new Error(
            'Please upload a PDF or CSV file. Other formats are not supported yet.'
          );
        }

        // Fetch system transactions for matching
        setProgress(`Found ${statement.transactions.length} transactions. Matching with your records...`);

        const systemTxsResult = await queryTransactions({
          companyId,
          fromDate: new Date(statement.statementPeriod.startDate),
          toDate: new Date(statement.statementPeriod.endDate),
        });

        if (!systemTxsResult.success) {
          throw new Error('Could not load your transactions for matching.');
        }

        // Perform auto-matching
        const matches = matchTransactions(statement.transactions, systemTxsResult.data);

        setProgress(`Matched ${matches.length} of ${statement.transactions.length} transactions automatically!`);

        // Small delay to show success message
        await new Promise(resolve => setTimeout(resolve, 800));

        onStatementParsed(statement, matches);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'We had trouble reading this file. Please try again.'
        );
        setIsProcessing(false);
        setProgress('');
      }
    },
    [accountId, companyId, onStatementParsed]
  );

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card className="p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Upload Your Bank Statement
        </h1>
        <p className="text-gray-600 mb-8">
          Upload a PDF or CSV file from your bank. We'll extract the transactions and
          match them with your records.
        </p>

        {error && (
          <ErrorMessage className="mb-6">{error}</ErrorMessage>
        )}

        <div
          className={`
            border-2 border-dashed rounded-lg p-12 text-center
            transition-colors duration-200
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
            ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleBrowseClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Upload bank statement file"
          />

          {isProcessing ? (
            <div>
              <Loading />
              <p className="mt-4 text-gray-600">{progress}</p>
            </div>
          ) : (
            <>
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-lg text-gray-700 mb-2">
                Drag and drop your statement here
              </p>
              <p className="text-sm text-gray-500 mb-4">
                or click to browse your files
              </p>
              <p className="text-xs text-gray-400">
                Supports PDF and CSV files up to 10MB
              </p>
            </>
          )}
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            Where to find your bank statement
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Log in to your online banking</li>
            <li>• Go to Statements or Documents</li>
            <li>• Download the statement for the period you want to reconcile</li>
            <li>• Most banks offer PDF or CSV download options</li>
          </ul>
        </div>

        <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200">
          <Button variant="outline" onClick={onBack} disabled={isProcessing}>
            Back
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
