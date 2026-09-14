/**
 * Import Warnings Modal
 *
 * Displays warnings from worksheet import with actionable fix instructions.
 * Shows when import succeeds but some items were skipped.
 *
 * Follows brand guidelines: autumn/professional colors, no emojis.
 */

import { Modal } from '../../modals/Modal';
import { Button } from '../../core/Button';
import type { ImportWarning } from '../../../services/cpg/worksheetImporter.service';
import styles from './ImportWarningsModal.module.css';

interface ImportWarningsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  warnings: ImportWarning[];
  counts: {
    categories: number;
    vendors: number;
    products: number;
    recipes: number;
    invoices: number;
    unit_conversions: number;
  };
  skipped: {
    categories: number;
    vendors: number;
    products: number;
    recipes: number;
    invoiceItems: number;
    unit_conversions: number;
  };
}

export function ImportWarningsModal({
  isOpen,
  onClose,
  onContinue,
  warnings,
  counts,
  skipped,
}: ImportWarningsModalProps) {
  const totalImported =
    counts.categories +
    counts.vendors +
    counts.products +
    counts.recipes +
    counts.invoices +
    counts.unit_conversions;

  const totalSkipped =
    skipped.categories +
    skipped.vendors +
    skipped.products +
    skipped.recipes +
    skipped.invoiceItems +
    skipped.unit_conversions;

  const getSeverityIcon = (severity: ImportWarning['severity']) => {
    switch (severity) {
      case 'error':
        return '!';
      case 'warning':
        return '!';
      case 'info':
        return 'i';
      default:
        return '!';
    }
  };

  const getSeverityClass = (severity: ImportWarning['severity']) => {
    switch (severity) {
      case 'error':
        return styles.severityError;
      case 'warning':
        return styles.severityWarning;
      case 'info':
        return styles.severityInfo;
      default:
        return styles.severityWarning;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Completed with Warnings"
      size="lg"
      closeOnBackdropClick={false}
      closeOnEscape={false}
      headerStyle={{
        backgroundColor: '#92400e',
        color: 'white',
      }}
      footer={
        <div className={styles.footer}>
          <div className={styles.footerInfo}>
            <span className={styles.importedCount}>
              {totalImported} items imported successfully
            </span>
            {totalSkipped > 0 && (
              <span className={styles.skippedCount}>
                {totalSkipped} items need attention
              </span>
            )}
          </div>
          <div className={styles.footerActions}>
            <Button variant="outline" onClick={onClose}>
              Review Warnings
            </Button>
            <Button variant="gold" onClick={onContinue}>
              Continue to Dashboard
            </Button>
          </div>
        </div>
      }
    >
      <div className={styles.content}>
        {/* Success Summary */}
        <div className={styles.successSummary}>
          <div className={styles.successIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div className={styles.successText}>
            <strong>Your data has been imported.</strong>
            <p>
              Most of your worksheet data was saved successfully. However, some items
              need your attention before they can be used.
            </p>
          </div>
        </div>

        {/* Warnings List */}
        <div className={styles.warningsSection}>
          <h3 className={styles.warningsHeader}>
            Items That Need Attention ({warnings.length})
          </h3>

          <div className={styles.warningsList}>
            {warnings.map((warning, index) => (
              <div key={index} className={`${styles.warningItem} ${getSeverityClass(warning.severity)}`}>
                <div className={styles.warningIconWrapper}>
                  <span className={styles.warningIcon}>
                    {getSeverityIcon(warning.severity)}
                  </span>
                </div>
                <div className={styles.warningContent}>
                  <div className={styles.warningTitle}>{warning.title}</div>
                  <div className={styles.warningMessage}>{warning.message}</div>
                  <div className={styles.fixSection}>
                    <div className={styles.fixLabel}>How to fix:</div>
                    <div className={styles.fixInstructions}>{warning.fixInstructions}</div>
                    <div className={styles.fixLocation}>
                      <span className={styles.locationIcon}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </span>
                      {warning.fixLocation}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Reference */}
        <div className={styles.quickReference}>
          <h4 className={styles.quickReferenceHeader}>Quick Reference</h4>
          <ul className={styles.quickReferenceList}>
            <li>
              <strong>Categories:</strong> Raw Materials tab, click "Add Category"
            </li>
            <li>
              <strong>Invoice Items:</strong> Raw Materials tab, find the invoice and click "Edit"
            </li>
            <li>
              <strong>Recipe Items:</strong> Products tab, click on a product to edit its recipe
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
