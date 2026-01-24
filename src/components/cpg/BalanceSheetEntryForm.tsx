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
import { HelpTooltip } from '../help/HelpTooltip';
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
}

export function BalanceSheetEntryForm({
  companyId: _companyId,
  initialData,
  onSave,
  onCancel,
}: BalanceSheetEntryFormProps) {
  // Period selection
  const [periodType, setPeriodType] = useState<PeriodType>(
    initialData?.periodType || 'monthly'
  );
  const [periodStart, _setPeriodStart] = useState<string>(() => {
    if (initialData?.periodStart) {
      return new Date(initialData.periodStart).toISOString().split('T')[0]!;
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]!;
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() => {
    if (initialData?.periodEnd) {
      return new Date(initialData.periodEnd).toISOString().split('T')[0]!;
    }
    return new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .split('T')[0]!;
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

    setPeriodEnd(endDate.toISOString().split('T')[0]!!);
  }, [periodType, periodStart]);

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

    if (periodStart && periodEnd && new Date(periodEnd) <= new Date(periodStart)) {
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
      periodStart: new Date(periodStart).getTime(),
      periodEnd: new Date(periodEnd).getTime(),
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
        <h3 className={styles.sectionTitle}>
          Statement Date
          <HelpTooltip content="Balance Sheets show your financial position at a specific point in time (usually the end of a month, quarter, or year)." />
        </h3>

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

        {periodEnd && (
          <p className={styles.periodLabel}>
            Balance Sheet as of {new Date(periodEnd).toLocaleDateString()}
          </p>
        )}
      </section>

      {/* Assets */}
      <section className={styles.section}>
        <h2 className={styles.mainSectionTitle}>Assets</h2>
        <p className={styles.sectionHelp}>
          What your business owns. This includes cash, inventory, equipment, and other valuable resources.
        </p>

        {/* Current Assets */}
        <div className={styles.subsection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              Current Assets
              <HelpTooltip content="Assets you expect to convert to cash within a year. Examples: cash, accounts receivable, inventory." />
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => addItem(currentAssets, setCurrentAssets, 'Assets', 'Current')}
            >
              + Add Line
            </Button>
          </div>

          <div className={styles.lineItems}>
            {currentAssets.map(item =>
              renderLineItem(item, currentAssets, setCurrentAssets, 'e.g., Cash, Inventory')
            )}
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
              <HelpTooltip content="Long-term assets used in your business. Examples: equipment, vehicles, buildings." />
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => addItem(fixedAssets, setFixedAssets, 'Assets', 'Fixed')}
            >
              + Add Line
            </Button>
          </div>

          <div className={styles.lineItems}>
            {fixedAssets.map(item =>
              renderLineItem(item, fixedAssets, setFixedAssets, 'e.g., Equipment, Vehicles')
            )}
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
        <p className={styles.sectionHelp}>
          What your business owes. This includes loans, accounts payable, and other debts.
        </p>

        {/* Current Liabilities */}
        <div className={styles.subsection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              Current Liabilities
              <HelpTooltip content="Debts due within a year. Examples: accounts payable, credit cards, short-term loans." />
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => addItem(currentLiabilities, setCurrentLiabilities, 'Liabilities', 'Current')}
            >
              + Add Line
            </Button>
          </div>

          <div className={styles.lineItems}>
            {currentLiabilities.map(item =>
              renderLineItem(item, currentLiabilities, setCurrentLiabilities, 'e.g., Credit card, Accounts payable')
            )}
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
              <HelpTooltip content="Debts due beyond one year. Examples: mortgages, business loans." />
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => addItem(longTermLiabilities, setLongTermLiabilities, 'Liabilities', 'Long-term')}
            >
              + Add Line
            </Button>
          </div>

          <div className={styles.lineItems}>
            {longTermLiabilities.map(item =>
              renderLineItem(item, longTermLiabilities, setLongTermLiabilities, 'e.g., Business loan, Mortgage')
            )}
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
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            Equity
            <HelpTooltip content="Your ownership stake in the business. Calculated as: Assets - Liabilities = Equity" />
          </h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => addItem(equityItems, setEquityItems, 'Equity', null)}
          >
            + Add Line
          </Button>
        </div>

        <div className={styles.lineItems}>
          {equityItems.map(item =>
            renderLineItem(item, equityItems, setEquityItems, 'e.g., Owner investment, Retained earnings')
          )}
        </div>

        <div className={styles.total}>
          <span className={styles.totalLabel}>Total Equity:</span>
          <span className={styles.totalValue}>${totals.equity}</span>
        </div>
      </section>

      {/* Balance Indicator */}
      <section className={styles.balanceSection}>
        <div className={`${styles.balanceCard} ${totals.is_balanced ? styles.balanced : styles.unbalanced}`}>
          <div className={styles.balanceIcon}>
            {totals.is_balanced ? '✓' : '⚠'}
          </div>
          <div className={styles.balanceContent}>
            <h4 className={styles.balanceTitle}>
              {totals.is_balanced ? 'Balance Sheet is Balanced!' : 'Balance Sheet Needs Adjustment'}
            </h4>
            <p className={styles.balanceText}>
              {totals.is_balanced
                ? `Great! Assets (${totals.total_assets}) = Liabilities (${totals.total_liabilities}) + Equity (${totals.equity})`
                : `Assets (${totals.total_assets}) must equal Liabilities (${totals.total_liabilities}) + Equity (${totals.equity})`}
            </p>
            {!totals.is_balanced && (
              <p className={styles.balanceHelp}>
                Take your time adjusting the amounts. The balance sheet will show a checkmark when everything adds up correctly.
              </p>
            )}
          </div>
        </div>
        {errors.balance && (
          <p className={styles.errorText}>{errors.balance}</p>
        )}
      </section>

      {/* Actions */}
      <div className={styles.actions}>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="primary" onClick={handleSave} disabled={!totals.is_balanced}>
          Save Balance Sheet
        </Button>
      </div>
    </div>
  );
}
