/**
 * P&L Entry Form Component
 *
 * Manual Profit & Loss statement entry for standalone CPG users.
 *
 * Features:
 * - Revenue section (multiple line items)
 * - COGS section (links to CPG invoices if available)
 * - Expenses section (multiple line items)
 * - Real-time calculation of subtotals and Net Income
 * - Period selection (monthly, quarterly, annual)
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
  calculatePLTotals,
  generatePeriodLabel,
} from '../../db/schema/standaloneFinancials.schema';
import styles from './PLEntryForm.module.css';

export interface PLEntryFormProps {
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

export function PLEntryForm({
  companyId: _companyId,
  initialData,
  onSave,
  onCancel,
}: PLEntryFormProps) {
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

  // Period selection - Default to last completed month
  const [periodType, setPeriodType] = useState<PeriodType>(
    initialData?.periodType || 'monthly'
  );

  // Get last completed month (previous month)
  // Today is Jan 28, 2026, so last month is December 2025
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0 = January, 11 = December

  // Calculate last month's year and month number
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const lastMonthNumber = currentMonth === 0 ? 11 : currentMonth - 1;

  // First day of last month
  const lastMonthStart = new Date(lastMonthYear, lastMonthNumber, 1);

  // Last day of last month
  const lastMonthEnd = new Date(lastMonthYear, lastMonthNumber + 1, 0);

  console.log('🗓️ Date Debug:', {
    today: today.toISOString(),
    currentYear,
    currentMonth,
    lastMonthYear,
    lastMonthNumber,
    lastMonthStart: lastMonthStart.toString(),
    lastMonthEnd: lastMonthEnd.toString(),
    formattedStart: formatDateLocal(lastMonthStart),
    formattedEnd: formatDateLocal(lastMonthEnd),
  });

  const [periodStart, setPeriodStart] = useState<string>(
    initialData?.periodStart
      ? formatDateLocal(new Date(initialData.periodStart))
      : formatDateLocal(lastMonthStart)
  );
  const [periodEnd, setPeriodEnd] = useState<string>(
    initialData?.periodEnd
      ? formatDateLocal(new Date(initialData.periodEnd))
      : formatDateLocal(lastMonthEnd)
  );

  console.log('📅 State values:', { periodStart, periodEnd });

  // Line items
  const [revenueItems, setRevenueItems] = useState<StandaloneLineItem[]>(
    initialData?.lineItems.filter(item => item.category === 'Revenue') || [
      {
        id: generateLineItemId(),
        category: 'Revenue',
        subcategory: null,
        description: '',
        amount: '',
        sort_order: 0,
      },
    ]
  );

  const [cogsItems, setCogsItems] = useState<StandaloneLineItem[]>(
    initialData?.lineItems.filter(item => item.category === 'COGS') || [
      {
        id: generateLineItemId(),
        category: 'COGS',
        subcategory: null,
        description: '',
        amount: '',
        sort_order: 0,
      },
    ]
  );

  const [expenseItems, setExpenseItems] = useState<StandaloneLineItem[]>(
    initialData?.lineItems.filter(item => item.category === 'Expenses') || [
      {
        id: generateLineItemId(),
        category: 'Expenses',
        subcategory: null,
        description: '',
        amount: '',
        sort_order: 0,
      },
    ]
  );

  // Calculated totals
  const [totals, setTotals] = useState<StandaloneTotals>({
    revenue: '0.00',
    cogs: '0.00',
    gross_profit: '0.00',
    expenses: '0.00',
    net_income: '0.00',
  });

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update totals whenever line items change
  useEffect(() => {
    const allItems = [...revenueItems, ...cogsItems, ...expenseItems];
    const calculated = calculatePLTotals(allItems);
    setTotals(calculated);
  }, [revenueItems, cogsItems, expenseItems]);

  // Update period end when period type changes
  useEffect(() => {
    if (!periodStart) return;

    // Parse date string as local date (no timezone shift)
    const startDate = parseDateLocal(periodStart);
    console.log('⚡ useEffect triggered:', { periodType, periodStart, startDate: startDate.toString() });
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

    const formattedEndDate = formatDateLocal(endDate);
    console.log('⚡ useEffect setting periodEnd:', { endDate: endDate.toString(), formattedEndDate });
    setPeriodEnd(formattedEndDate);
  }, [periodType, periodStart]);

  // Handlers
  const addRevenueItem = () => {
    setRevenueItems([
      ...revenueItems,
      {
        id: generateLineItemId(),
        category: 'Revenue',
        subcategory: null,
        description: '',
        amount: '',
        sort_order: revenueItems.length,
      },
    ]);
  };

  const addCogsItem = () => {
    setCogsItems([
      ...cogsItems,
      {
        id: generateLineItemId(),
        category: 'COGS',
        subcategory: null,
        description: '',
        amount: '',
        sort_order: cogsItems.length,
      },
    ]);
  };

  const addExpenseItem = () => {
    setExpenseItems([
      ...expenseItems,
      {
        id: generateLineItemId(),
        category: 'Expenses',
        subcategory: null,
        description: '',
        amount: '',
        sort_order: expenseItems.length,
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
    [...revenueItems, ...cogsItems, ...expenseItems].forEach(item => {
      if (item.amount && parseFloat(item.amount) < 0) {
        newErrors[`amount_${item.id}`] = 'Amount cannot be negative';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    // Combine all line items
    const allItems = [...revenueItems, ...cogsItems, ...expenseItems];

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

  // Get dynamic period label for info box
  const currentPeriodLabel = periodStart && periodEnd
    ? generatePeriodLabel(periodType, parseDateLocal(periodStart).getTime(), parseDateLocal(periodEnd).getTime())
    : 'your most recent period';

  return (
    <div className={styles.form}>
      {/* Helpful Intro */}
      <div className={styles.infoBox}>
        <div className={styles.infoIcon}>💡</div>
        <div className={styles.infoContent}>
          <h4 className={styles.infoTitle}>Quick Start Guide</h4>
          <p className={styles.infoText}>
            Enter your <strong>completed month's</strong> financial data below. We've pre-selected last month (<strong>{currentPeriodLabel}</strong>) to get you started. Add line items for your revenue, costs, and expenses - as detailed or simple as you'd like.
          </p>
        </div>
      </div>

      {/* Period Selection */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Statement Period
          <HelpTooltip content="Choose the time period this P&L statement covers. We've defaulted to your last completed month, but you can change this to any period you need." />
        </h3>

        <div className={styles.periodGrid}>
          <Select
            label="Period Type"
            value={periodType}
            onChange={e => setPeriodType(e.target.value as PeriodType)}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'annual', label: 'Annual' },
              { value: 'custom', label: 'Custom Period' },
            ]}
          />

          <Input
            label="Start Date"
            type="date"
            value={periodStart}
            onChange={e => setPeriodStart(e.target.value)}
            error={errors.periodStart}
          />

          <Input
            label="End Date"
            type="date"
            value={periodEnd}
            onChange={e => setPeriodEnd(e.target.value)}
            error={errors.periodEnd}
          />
        </div>

        {periodStart && periodEnd && (
          <p className={styles.periodLabel}>
            Period: {generatePeriodLabel(periodType, parseDateLocal(periodStart).getTime(), parseDateLocal(periodEnd).getTime())}
          </p>
        )}
      </section>

      {/* Revenue Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            Revenue
            <HelpTooltip content="Money your business earned during this period. Include all income from sales, services, and other sources." />
          </h3>
          <Button variant="secondary" size="sm" onClick={addRevenueItem}>
            + Add Revenue Line
          </Button>
        </div>

        <div className={styles.lineItems}>
          {revenueItems.map(item =>
            renderLineItem(item, revenueItems, setRevenueItems, 'e.g., Product sales')
          )}
        </div>

        <div className={styles.subtotal}>
          <span className={styles.subtotalLabel}>Total Revenue:</span>
          <span className={styles.subtotalValue}>${totals.revenue}</span>
        </div>
      </section>

      {/* COGS Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            Cost of Goods Sold (COGS)
            <HelpTooltip content="Direct costs to produce your products. This includes materials, packaging, and manufacturing costs." />
          </h3>
          <Button variant="secondary" size="sm" onClick={addCogsItem}>
            + Add COGS Line
          </Button>
        </div>

        <div className={styles.lineItems}>
          {cogsItems.map(item =>
            renderLineItem(item, cogsItems, setCogsItems, 'e.g., Raw materials')
          )}
        </div>

        <div className={styles.subtotal}>
          <span className={styles.subtotalLabel}>Total COGS:</span>
          <span className={styles.subtotalValue}>${totals.cogs}</span>
        </div>

        <div className={styles.grossProfit}>
          <span className={styles.grossProfitLabel}>Gross Profit:</span>
          <span className={styles.grossProfitValue}>${totals.gross_profit}</span>
        </div>
      </section>

      {/* Expenses Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            Expenses
            <HelpTooltip content="Operating costs to run your business. Include rent, utilities, marketing, salaries, and other overhead." />
          </h3>
          <Button variant="secondary" size="sm" onClick={addExpenseItem}>
            + Add Expense Line
          </Button>
        </div>

        <div className={styles.lineItems}>
          {expenseItems.map(item =>
            renderLineItem(item, expenseItems, setExpenseItems, 'e.g., Rent, utilities')
          )}
        </div>

        <div className={styles.subtotal}>
          <span className={styles.subtotalLabel}>Total Expenses:</span>
          <span className={styles.subtotalValue}>${totals.expenses}</span>
        </div>
      </section>

      {/* Net Income */}
      <section className={styles.netIncomeSection}>
        <div className={styles.netIncome}>
          <span className={styles.netIncomeLabel}>Net Income (Profit):</span>
          <span className={`${styles.netIncomeValue} ${parseFloat(totals.net_income!) >= 0 ? styles.positive : styles.negative}`}>
            ${totals.net_income}
          </span>
        </div>
        <p className={styles.netIncomeHelp}>
          {parseFloat(totals.net_income!) >= 0
            ? 'Great! Your business is profitable this period.'
            : 'Your expenses exceeded revenue this period. This is common when starting out.'}
        </p>
      </section>

      {/* Actions */}
      <div className={styles.actions}>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="primary" onClick={handleSave}>
          Save P&L Statement
        </Button>
      </div>
    </div>
  );
}
