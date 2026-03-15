/**
 * Balance Sheet Entry Form Component
 *
 * Manual Balance Sheet entry for standalone CPG users.
 *
 * Features:
 * - Assets section (Current + Fixed)
 * - Liabilities section (Current + Long-term)
 * - Equity section
 * - Real-time balance validation (Assets = Liabilities + Equity)
 * - Visual balance indicator
 * - Period selection
 * - Clean, patient interface with helpful guidance
 *
 * Requirements:
 * - Steadiness communication style (patient, supportive)
 * - WCAG 2.1 AA compliance
 * - Mobile responsive
 * - Real-time validation
 */

import { useState, useEffect } from 'react';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { Select } from '../forms/Select';
import {
  type StandaloneLineItem,
  type PeriodType,
  type StandaloneTotals,
  generateLineItemId,
  calculateBalanceSheetTotals,
} from '../../db/schema/standaloneFinancials.schema';
import styles from './BalanceSheetEntryForm.module.css';

export interface BalanceSheetEntryFormProps {
  companyId: string;
  initialData?: {
    periodType: PeriodType;
    periodStart: number;
    periodEnd: number;
    lineItems: StandaloneLineItem[];
  };
  onSave: (data: {
    periodType: PeriodType;
    periodStart: number;
    periodEnd: number;
    lineItems: StandaloneLineItem[];
  }) => void;
  onCancel?: () => void;
  isEditing?: boolean;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  isSaving?: boolean;
}

export function BalanceSheetEntryForm({
  companyId: _companyId,
  initialData,
  onSave,
  onCancel,
  isEditing = false,
  onUnsavedChanges,
  isSaving = false,
}: BalanceSheetEntryFormProps) {
  // Helper to format date as YYYY-MM-DD in local timezone (no UTC conversion)
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to parse date string (YYYY-MM-DD) as local date without timezone shift
  const parseDateLocal = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Period selection
  const [periodType, setPeriodType] = useState<PeriodType>(
    initialData?.periodType || 'monthly'
  );
  const [periodStart, _setPeriodStart] = useState<string>(() => {
    if (initialData?.periodStart) {
      return formatDateLocal(new Date(initialData.periodStart));
    }
    return formatDateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() => {
    if (initialData?.periodEnd) {
      return formatDateLocal(new Date(initialData.periodEnd));
    }
    return formatDateLocal(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  });

  // Assets
  const [currentAssets, setCurrentAssets] = useState<StandaloneLineItem[]>(
    initialData?.lineItems.filter(
      item => item.category === 'Assets' && item.subcategory === 'Current'
    ) || [
      {
        id: generateLineItemId(),
        category: 'Assets',
        subcategory: 'Current',
        description: '',
        amount: '',
        sort_order: 0,
      },
    ]
  );

  const [fixedAssets, setFixedAssets] = useState<StandaloneLineItem[]>(
    initialData?.lineItems.filter(
      item => item.category === 'Assets' && item.subcategory === 'Fixed'
    ) || [
      {
        id: generateLineItemId(),
        category: 'Assets',
        subcategory: 'Fixed',
        description: '',
        amount: '',
        sort_order: 0,
      },
    ]
  );

  // Liabilities
  const [currentLiabilities, setCurrentLiabilities] = useState<StandaloneLineItem[]>(
    initialData?.lineItems.filter(
      item => item.category === 'Liabilities' && item.subcategory === 'Current'
    ) || [
      {
        id: generateLineItemId(),
        category: 'Liabilities',
        subcategory: 'Current',
        description: '',
        amount: '',
        sort_order: 0,
      },
    ]
  );

  const [longTermLiabilities, setLongTermLiabilities] = useState<StandaloneLineItem[]>(
    initialData?.lineItems.filter(
      item => item.category === 'Liabilities' && item.subcategory === 'Long-term'
    ) || [
      {
        id: generateLineItemId(),
        category: 'Liabilities',
        subcategory: 'Long-term',
        description: '',
        amount: '',
        sort_order: 0,
      },
    ]
  );

  // Equity
  const [equityItems, setEquityItems] = useState<StandaloneLineItem[]>(
    initialData?.lineItems.filter(item => item.category === 'Equity') || [
      {
        id: generateLineItemId(),
        category: 'Equity',
        subcategory: null,
        description: '',
        amount: '',
        sort_order: 0,
      },
    ]
  );

  // Calculated totals
  const [totals, setTotals] = useState<StandaloneTotals>({
    current_assets: '0.00',
    fixed_assets: '0.00',
    total_assets: '0.00',
    current_liabilities: '0.00',
    long_term_liabilities: '0.00',
    total_liabilities: '0.00',
    equity: '0.00',
    is_balanced: false,
  });

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [justSaved, setJustSaved] = useState(false);
  const [wasSaving, setWasSaving] = useState(false);

  // Update totals whenever line items change
  useEffect(() => {
    const allItems = [
      ...currentAssets,
      ...fixedAssets,
      ...currentLiabilities,
      ...longTermLiabilities,
      ...equityItems,
    ];
    const calculated = calculateBalanceSheetTotals(allItems);
    setTotals(calculated);
  }, [currentAssets, fixedAssets, currentLiabilities, longTermLiabilities, equityItems]);

  // Track unsaved changes
  useEffect(() => {
    if (!isEditing || !initialData) return;

    // Check if current state differs from initial
    const allItems = [
      ...currentAssets,
      ...fixedAssets,
      ...currentLiabilities,
      ...longTermLiabilities,
      ...equityItems,
    ];

    const hasChanges =
      periodType !== initialData.periodType ||
      periodEnd !== formatDateLocal(new Date(initialData.periodEnd)) ||
      JSON.stringify(allItems) !== JSON.stringify(initialData.lineItems);

    if (hasChanges) {
      setJustSaved(false); // Clear saved message when user makes changes
    }

    if (onUnsavedChanges) {
      onUnsavedChanges(hasChanges);
    }
  }, [periodType, periodEnd, currentAssets, fixedAssets, currentLiabilities, longTermLiabilities, equityItems, isEditing, initialData, onUnsavedChanges]);

  // Detect when save completes
  useEffect(() => {
    if (wasSaving && !isSaving) {
      // Save just completed
      setJustSaved(true);
    }
    setWasSaving(isSaving);
  }, [isSaving, wasSaving]);

  // Update period end when period type changes
  useEffect(() => {
    if (!periodStart) return;

    const startDate = new Date(periodStart);
    let endDate: Date;

    switch (periodType) {
      case 'monthly':
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        break;
      case 'quarterly':
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 0);
        break;
      case 'annual':
        endDate = new Date(startDate.getFullYear(), 11, 31);
        break;
      case 'custom':
        return; // Don't auto-update for custom periods
      default:
        return;
    }

    setPeriodEnd(formatDateLocal(endDate));
  }, [periodType, periodStart]);

  // Update period dates when initialData changes (e.g., when user clicks a month in timeline)
  useEffect(() => {
    if (initialData?.periodStart) {
      _setPeriodStart(formatDateLocal(new Date(initialData.periodStart)));
    }
    if (initialData?.periodEnd) {
      setPeriodEnd(formatDateLocal(new Date(initialData.periodEnd)));
    }
  }, [initialData]);

  // Handlers
  const addItem = (
    items: StandaloneLineItem[],
    setItems: (items: StandaloneLineItem[]) => void,
    category: string,
    subcategory: string | null
  ) => {
    setItems([
      ...items,
      {
        id: generateLineItemId(),
        category,
        subcategory,
        description: '',
        amount: '',
        sort_order: items.length,
      },
    ]);
  };

  const removeItem = (
    items: StandaloneLineItem[],
    setItems: (items: StandaloneLineItem[]) => void,
    id: string
  ) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (
    items: StandaloneLineItem[],
    setItems: (items: StandaloneLineItem[]) => void,
    id: string,
    field: keyof StandaloneLineItem,
    value: string
  ) => {
    setItems(
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSave = () => {
    // Validation
    const newErrors: Record<string, string> = {};

    if (!periodStart) {
      newErrors.periodStart = 'Period start date is required';
    }

    if (!periodEnd) {
      newErrors.periodEnd = 'Period end date is required';
    }

    if (periodStart && periodEnd && parseDateLocal(periodEnd) <= parseDateLocal(periodStart)) {
      newErrors.periodEnd = 'Period end must be after period start';
    }

    // Check for negative amounts
    const allItems = [
      ...currentAssets,
      ...fixedAssets,
      ...currentLiabilities,
      ...longTermLiabilities,
      ...equityItems,
    ];

    allItems.forEach(item => {
      if (item.amount && parseFloat(item.amount) < 0) {
        newErrors[`amount_${item.id}`] = 'Amount cannot be negative';
      }
    });

    // Check if balanced
    if (!totals.is_balanced && allItems.some(item => item.amount && parseFloat(item.amount) > 0)) {
      newErrors.balance = 'Balance Sheet must balance: Assets = Liabilities + Equity';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    onSave({
      periodType,
      periodStart: parseDateLocal(periodStart).getTime(),
      periodEnd: parseDateLocal(periodEnd).getTime(),
      lineItems: allItems,
    });
  };

  const renderLineItem = (
    item: StandaloneLineItem,
    items: StandaloneLineItem[],
    setItems: (items: StandaloneLineItem[]) => void,
    placeholder: string
  ) => (
    <div key={item.id} className={styles.lineItem}>
      <div className={styles.lineItemFields}>
        <Input
          label="Description"
          value={item.description}
          onChange={e =>
            updateItem(items, setItems, item.id, 'description', e.target.value)
          }
          placeholder={placeholder}
          className={styles.descriptionInput}
        />
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0"
          value={item.amount}
          onChange={e =>
            updateItem(items, setItems, item.id, 'amount', e.target.value)
          }
          placeholder="0.00"
          error={errors[`amount_${item.id}`]}
          className={styles.amountInput}
        />
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => removeItem(items, setItems, item.id)}
            className={styles.removeButton}
            aria-label="Remove line item"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.form}>
      {/* Period Selection */}
      <section className={styles.section}>
        <h2 className={styles.mainSectionTitle}>Statement Date</h2>

        <div className={styles.periodGrid}>
          <Select
            label="Period Type"
            value={periodType}
            onChange={e => setPeriodType(e.target.value as PeriodType)}
            options={[
              { value: 'monthly', label: 'Month End' },
              { value: 'quarterly', label: 'Quarter End' },
              { value: 'annual', label: 'Year End' },
              { value: 'custom', label: 'Custom Date' },
            ]}
          />

          <Input
            label="As of Date"
            type="date"
            value={periodEnd}
            onChange={e => setPeriodEnd(e.target.value)}
            error={errors.periodEnd}
          />
        </div>
      </section>

      {/* Assets */}
      <section className={styles.section}>
        <h2 className={styles.mainSectionTitle}>Assets</h2>

        {/* Current Assets */}
        <div className={styles.subsection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              Current Assets
            </h3>
          </div>

          <div className={styles.lineItems}>
            <div className={styles.greenBox}>
              {currentAssets.map(item =>
                renderLineItem(item, currentAssets, setCurrentAssets, 'e.g., Cash, Inventory')
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addItem(currentAssets, setCurrentAssets, 'Assets', 'Current')}
                className={styles.addLineInside}
              >
                + Add Line
              </Button>
            </div>
          </div>

          <div className={styles.subtotal}>
            <span className={styles.subtotalLabel}>Total Current Assets:</span>
            <span className={styles.subtotalValue}>${totals.current_assets}</span>
          </div>
        </div>

        {/* Fixed Assets */}
        <div className={styles.subsection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              Fixed Assets
            </h3>
          </div>

          <div className={styles.lineItems}>
            <div className={styles.greenBox}>
              {fixedAssets.map(item =>
                renderLineItem(item, fixedAssets, setFixedAssets, 'e.g., Equipment, Vehicles')
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addItem(fixedAssets, setFixedAssets, 'Assets', 'Fixed')}
                className={styles.addLineInside}
              >
                + Add Line
              </Button>
            </div>
          </div>

          <div className={styles.subtotal}>
            <span className={styles.subtotalLabel}>Total Fixed Assets:</span>
            <span className={styles.subtotalValue}>${totals.fixed_assets}</span>
          </div>
        </div>

        <div className={styles.total}>
          <span className={styles.totalLabel}>Total Assets:</span>
          <span className={styles.totalValue}>${totals.total_assets}</span>
        </div>
      </section>

      {/* Liabilities */}
      <section className={styles.section}>
        <h2 className={styles.mainSectionTitle}>Liabilities</h2>

        {/* Current Liabilities */}
        <div className={styles.subsection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              Current Liabilities
            </h3>
          </div>

          <div className={styles.lineItems}>
            <div className={styles.greenBox}>
              {currentLiabilities.map(item =>
                renderLineItem(item, currentLiabilities, setCurrentLiabilities, 'e.g., Credit card, Accounts payable')
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addItem(currentLiabilities, setCurrentLiabilities, 'Liabilities', 'Current')}
                className={styles.addLineInside}
              >
                + Add Line
              </Button>
            </div>
          </div>

          <div className={styles.subtotal}>
            <span className={styles.subtotalLabel}>Total Current Liabilities:</span>
            <span className={styles.subtotalValue}>${totals.current_liabilities}</span>
          </div>
        </div>

        {/* Long-term Liabilities */}
        <div className={styles.subsection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              Long-term Liabilities
            </h3>
          </div>

          <div className={styles.lineItems}>
            <div className={styles.greenBox}>
              {longTermLiabilities.map(item =>
                renderLineItem(item, longTermLiabilities, setLongTermLiabilities, 'e.g., Business loan, Mortgage')
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addItem(longTermLiabilities, setLongTermLiabilities, 'Liabilities', 'Long-term')}
                className={styles.addLineInside}
              >
                + Add Line
              </Button>
            </div>
          </div>

          <div className={styles.subtotal}>
            <span className={styles.subtotalLabel}>Total Long-term Liabilities:</span>
            <span className={styles.subtotalValue}>${totals.long_term_liabilities}</span>
          </div>
        </div>

        <div className={styles.total}>
          <span className={styles.totalLabel}>Total Liabilities:</span>
          <span className={styles.totalValue}>${totals.total_liabilities}</span>
        </div>
      </section>

      {/* Equity */}
      <section className={styles.section}>
        <h2 className={styles.mainSectionTitle}>Equity</h2>

        <div className={styles.lineItems}>
          <div className={styles.greenBox}>
            {equityItems.map(item =>
              renderLineItem(item, equityItems, setEquityItems, 'e.g., Owner investment, Retained earnings')
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => addItem(equityItems, setEquityItems, 'Equity', null)}
              className={styles.addLineInside}
            >
              + Add Line
            </Button>
          </div>
        </div>

        <div className={styles.total}>
          <span className={styles.totalLabel}>Total Equity:</span>
          <span className={styles.totalValue}>${totals.equity}</span>
        </div>
      </section>

      {/* Balance Indicator */}
      <section className={styles.balanceSection}>
        <div className={styles.balanceCheck}>
          <div className={styles.balanceEquation}>
            <div className={styles.balanceSide}>
              <div className={styles.balanceLabel}>Total Assets</div>
              <div className={styles.balanceAmount}>${totals.total_assets}</div>
            </div>
            <div className={styles.balanceEquals}>=</div>
            <div className={styles.balanceSide}>
              <div className={styles.balanceLabel}>Liabilities + Equity</div>
              <div className={styles.balanceAmount}>
                ${(parseFloat(totals.total_liabilities || '0') + parseFloat(totals.equity || '0')).toFixed(2)}
              </div>
            </div>
          </div>

          {totals.is_balanced ? (
            <div className={styles.balanceSuccess}>
              <span className={styles.balanceSuccessIcon}>✓</span>
              <span>Balanced!</span>
            </div>
          ) : (
            <div className={styles.balanceError}>
              Difference: <strong>${Math.abs(parseFloat(totals.total_assets || '0') - (parseFloat(totals.total_liabilities || '0') + parseFloat(totals.equity || '0'))).toFixed(2)}</strong>
            </div>
          )}
        </div>
        {errors.balance && (
          <p className={styles.errorText}>{errors.balance}</p>
        )}
      </section>

      {/* Actions */}
      <div className={styles.actions}>
        {justSaved && (
          <div className={styles.savedMessage}>
            <span className={styles.savedIcon}>✓</span>
            <span>Period updated successfully!</span>
          </div>
        )}
        <div className={styles.actionButtons}>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
          )}
          <Button variant="primary" onClick={handleSave} disabled={!totals.is_balanced || isSaving}>
            {isSaving ? 'Saving...' : isEditing ? 'Update Balance Sheet' : 'Save Balance Sheet'}
          </Button>
        </div>
      </div>
    </div>
  );
}
