/**
 * Product Breakdown Modal
 *
 * Displays the complete manufacturing cost breakdown for a finished product:
 * - All recipe components with quantities
 * - Cost per component (if available)
 * - Subtotals and total manufacturing cost
 * - Missing cost data warnings
 *
 * This modal replaces the inline breakdown to prevent UI whitespace issues.
 */

import { Modal } from '../../modals/Modal';
import { Button } from '../../core/Button';
import { HelpTooltip } from '../../help/HelpTooltip';
import styles from './CPGModals.module.css';

export interface ProductBreakdownComponent {
  categoryId?: string;
  categoryName: string;
  variant: string | null;
  quantity: number;
  unitOfMeasure: string;
  subtotal: string | null;
  hasCostData: boolean;
}

export interface ProductBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  totalCPU: string | null;
  isComplete: boolean;
  breakdown: ProductBreakdownComponent[];
  missingComponents: string[];
  msrp?: number | null;
  onComponentClick?: (categoryId: string, variant: string | null) => void;
}

export function ProductBreakdownModal({
  isOpen,
  onClose,
  productName,
  totalCPU,
  isComplete,
  breakdown,
  missingComponents,
  msrp,
  onComponentClick,
}: ProductBreakdownModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${productName} - Cost Breakdown`}
      size="large"
    >
      <div className={styles.modalContent}>
        {/* Product Summary */}
        <div className={styles.breakdownSummary}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Product:</span>
            <span className={styles.summaryValue}>{productName}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Total Manufacturing Cost:</span>
            <span className={styles.summaryValue}>
              {isComplete && totalCPU ? (
                <span className={styles.completeCost}>${totalCPU}</span>
              ) : (
                <span className={styles.incompleteCost}>
                  <span style={{ marginRight: '0.5rem' }}>⚠️</span>
                  Incomplete
                </span>
              )}
            </span>
          </div>
          {msrp && (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>MSRP:</span>
              <span className={styles.summaryValue}>${msrp.toFixed(2)}</span>
            </div>
          )}
          {isComplete && totalCPU && msrp && (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Gross Margin:</span>
              <span className={styles.summaryValue}>
                {((((msrp - parseFloat(totalCPU)) / msrp) * 100)).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Component Breakdown */}
        <div className={styles.componentBreakdown}>
          <h3 className={styles.breakdownTitle}>Component Costs</h3>
          <div className={styles.breakdownTable}>
            <div className={styles.tableHeader}>
              <div className={styles.componentCol}>Component</div>
              <div className={styles.quantityCol}>Quantity</div>
              <div className={styles.costCol}>Cost</div>
            </div>
            <div className={styles.tableBody}>
              {breakdown.map((component, idx) => (
                <div
                  key={idx}
                  className={`${styles.tableRow} ${component.hasCostData && component.categoryId ? styles.clickableRow : ''}`}
                  onClick={() => component.hasCostData && component.categoryId && onComponentClick?.(component.categoryId, component.variant)}
                  role={component.hasCostData && component.categoryId ? 'button' : undefined}
                  tabIndex={component.hasCostData && component.categoryId ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (component.hasCostData && component.categoryId && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onComponentClick?.(component.categoryId, component.variant);
                    }
                  }}
                  style={{ cursor: component.hasCostData && component.categoryId ? 'pointer' : 'default' }}
                  title={component.hasCostData && component.categoryId ? 'Click to see detailed cost breakdown' : undefined}
                >
                  <div className={styles.componentCol}>
                    <span className={styles.componentName}>
                      {component.categoryName}
                      {component.variant && ` (${component.variant})`}
                      {component.hasCostData && component.categoryId && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#4a90e2' }}>
                          🔍
                        </span>
                      )}
                    </span>
                  </div>
                  <div className={styles.quantityCol}>
                    {component.quantity} {component.unitOfMeasure}
                  </div>
                  <div className={styles.costCol}>
                    {component.hasCostData && component.subtotal ? (
                      <span className={styles.costValue}>${component.subtotal}</span>
                    ) : (
                      <span className={styles.awaitingData} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.875rem' }}>⚠️</span>
                        <span>Add invoices to calculate</span>
                        <HelpTooltip
                          content={`Once you enter invoices for ${component.categoryName}${component.variant ? ` (${component.variant})` : ''}, we'll automatically calculate the cost per unit.`}
                          position="left"
                        />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Missing Components Warning */}
        {!isComplete && missingComponents.length > 0 && (
          <div className={styles.warningBox}>
            <div className={styles.warningHeader}>
              <span style={{ marginRight: '0.5rem' }}>⚠️</span>
              <span>Missing cost data for:</span>
            </div>
            <ul className={styles.warningList}>
              {missingComponents.map((component, idx) => (
                <li key={idx}>{component}</li>
              ))}
            </ul>
            <p className={styles.warningHelp}>
              Enter invoices for these raw materials to complete the CPU calculation.
            </p>
          </div>
        )}

        {/* Help Text */}
        <div className={styles.helpText}>
          <span style={{ marginRight: '0.5rem' }}>ℹ️</span>
          Manufacturing costs are calculated from your product recipe and the most recent raw material invoices. Click on any component with a 🔍 icon to see its detailed cost history.
        </div>
      </div>

      <div className={styles.modalActions}>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
