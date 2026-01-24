/**
 * Report Export Button Component
 *
 * Provides CSV export functionality for CPG reports.
 * Common to all CPG report pages.
 */

import { useState } from 'react';
import styles from './ReportExportButton.module.css';
import { exportToCSV } from '../../../services/cpg/cpgReporting.service';

interface ReportExportButtonProps {
  reportData: any[];
  reportType: string;
  filename?: string;
  disabled?: boolean;
}

export const ReportExportButton = ({
  reportData,
  reportType,
  filename,
  disabled = false,
}: ReportExportButtonProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (reportData.length === 0) {
      setExportError('No data to export');
      setTimeout(() => setExportError(null), 3000);
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      // Generate CSV
      const csv = await exportToCSV(reportData, reportType);

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `${reportType}-${formatDateForFilename(new Date())}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError('Export failed. Please try again.');
      setTimeout(() => setExportError(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        onClick={handleExport}
        disabled={disabled || isExporting || reportData.length === 0}
        className={styles.button}
        title={reportData.length === 0 ? 'No data to export' : 'Export to CSV'}
      >
        <svg
          className={styles.icon}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {isExporting ? 'Exporting...' : 'Export to CSV'}
      </button>

      {exportError && (
        <div className={styles.error} role="alert">
          {exportError}
        </div>
      )}
    </div>
  );
};

/**
 * Format date for filename (YYYY-MM-DD)
 */
function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
