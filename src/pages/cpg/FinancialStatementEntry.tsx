/**
 * Financial Statement Entry Page
 *
 * Main page for standalone CPG users to enter P&L and Balance Sheet data.
 *
 * Features:
 * - Tab navigation between P&L and Balance Sheet
 * - Period selection
 * - Line-by-line entry forms
 * - Save/update functionality
 * - Integration with SKU tracker
 *
 * Requirements:
 * - Steadiness communication style
 * - WCAG 2.1 AA compliance
 * - Mobile responsive
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db';
import { getDeviceId } from '../../db/crdt';
import { PLEntryForm } from '../../components/cpg/PLEntryForm';
import { BalanceSheetEntryForm } from '../../components/cpg/BalanceSheetEntryForm';
import { FinancialTimeline } from '../../components/cpg/FinancialTimeline';
import {
  type StandaloneFinancials,
  type PeriodType,
  createDefaultStandaloneFinancials,
  calculatePLTotals,
  calculateBalanceSheetTotals,
  generatePeriodLabel,
} from '../../db/schema/standaloneFinancials.schema';
import styles from './FinancialStatementEntry.module.css';

export default function FinancialStatementEntry() {
  const { companyId } = useAuth();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<'pl' | 'balance_sheet'>('pl');

  // Data state
  const [plStatements, setPlStatements] = useState<StandaloneFinancials[]>([]);
  const [balanceSheets, setBalanceSheets] = useState<StandaloneFinancials[]>([]);

  // Selected period from timeline
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load data
  useEffect(() => {
    if (!companyId) return;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load P&L statements
        const plData = await db.standaloneFinancials
          ?.where('company_id')
          .equals(companyId)
          .filter(s => s.statement_type === 'profit_loss' && s.active)
          .toArray();

        // Load Balance Sheets
        const bsData = await db.standaloneFinancials
          ?.where('company_id')
          .equals(companyId)
          .filter(s => s.statement_type === 'balance_sheet' && s.active)
          .toArray();

        setPlStatements(plData || []);
        setBalanceSheets(bsData || []);
      } catch (err) {
        console.error('Error loading financial statements:', err);
        setError('Oops! We had trouble loading your financial data. Let\'s try that again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [companyId]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handlers
  const handleSavePL = async (data: {
    periodType: PeriodType;
    periodStart: number;
    periodEnd: number;
    lineItems: any[];
  }) => {
    if (!companyId) return;

    try {
      setIsSaving(true);
      setError(null);

      const deviceId = getDeviceId();
      const totals = calculatePLTotals(data.lineItems);
      const periodLabel = generatePeriodLabel(data.periodType, data.periodStart, data.periodEnd);

      // Check if we're updating an existing record
      const existingStatement = plStatements.find(s => {
        const date = new Date(s.period_end);
        return selectedMonth !== null &&
               selectedYear !== null &&
               date.getMonth() === selectedMonth &&
               date.getFullYear() === selectedYear;
      });

      if (existingStatement) {
        // UPDATE existing record
        console.log('🔄 Updating existing P&L:', existingStatement.id);
        await db.standaloneFinancials?.update(existingStatement.id, {
          period_type: data.periodType,
          period_start: data.periodStart,
          period_end: data.periodEnd,
          period_label: periodLabel,
          line_items: data.lineItems,
          totals,
          updated_at: Date.now(),
        });
        console.log('✅ P&L updated successfully');
        setSuccessMessage('P&L statement updated successfully! Your records are looking great.');
      } else {
        // CREATE new record
        const statement: StandaloneFinancials = {
          id: nanoid(),
          ...createDefaultStandaloneFinancials(
            companyId,
            'profit_loss',
            data.periodStart,
            data.periodEnd,
            deviceId
          ),
          period_type: data.periodType,
          period_label: periodLabel,
          line_items: data.lineItems,
          totals,
        } as StandaloneFinancials;

        console.log('💾 Creating new P&L:', statement);
        const result = await db.standaloneFinancials?.add(statement);
        console.log('✅ P&L created with ID:', result);
        setSuccessMessage('P&L statement saved successfully! You\'re building a solid financial foundation.');
      }

      // Reload data
      const updatedPL = await db.standaloneFinancials
        ?.where('company_id')
        .equals(companyId)
        .filter(s => s.statement_type === 'profit_loss' && s.active)
        .toArray();
      console.log('📊 Reloaded P&L statements:', updatedPL);
      setPlStatements(updatedPL || []);

      // Clear unsaved changes flag
      setHasUnsavedChanges(false);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error saving P&L statement:', err);
      console.error('Error details:', err.message, err.stack);
      setError(`Oops! We couldn't save your P&L statement: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBalanceSheet = async (data: {
    periodType: PeriodType;
    periodStart: number;
    periodEnd: number;
    lineItems: any[];
  }) => {
    if (!companyId) return;

    try {
      setIsSaving(true);
      setError(null);

      const deviceId = getDeviceId();
      const totals = calculateBalanceSheetTotals(data.lineItems);
      const periodLabel = generatePeriodLabel(data.periodType, data.periodStart, data.periodEnd);

      // Check if we're updating an existing record
      const existingStatement = balanceSheets.find(s => {
        const date = new Date(s.period_end);
        return selectedMonth !== null &&
               selectedYear !== null &&
               date.getMonth() === selectedMonth &&
               date.getFullYear() === selectedYear;
      });

      if (existingStatement) {
        // UPDATE existing record
        console.log('🔄 Updating existing Balance Sheet:', existingStatement.id);
        await db.standaloneFinancials?.update(existingStatement.id, {
          period_type: data.periodType,
          period_start: data.periodStart,
          period_end: data.periodEnd,
          period_label: periodLabel,
          line_items: data.lineItems,
          totals,
          updated_at: Date.now(),
        });
        console.log('✅ Balance Sheet updated successfully');
        setSuccessMessage('Balance Sheet updated successfully! Your records are looking great.');
      } else {
        // CREATE new record
        const statement: StandaloneFinancials = {
          id: nanoid(),
          ...createDefaultStandaloneFinancials(
            companyId,
            'balance_sheet',
            data.periodStart,
            data.periodEnd,
            deviceId
          ),
          period_type: data.periodType,
          period_label: periodLabel,
          line_items: data.lineItems,
          totals,
        } as StandaloneFinancials;

        console.log('💾 Creating new Balance Sheet:', statement);
        const result = await db.standaloneFinancials?.add(statement);
        console.log('✅ Balance Sheet created with ID:', result);
        setSuccessMessage('Balance Sheet saved successfully! Great work keeping your records organized.');
      }

      // Reload data
      const updatedBS = await db.standaloneFinancials
        ?.where('company_id')
        .equals(companyId)
        .filter(s => s.statement_type === 'balance_sheet' && s.active)
        .toArray();
      console.log('📊 Reloaded Balance Sheets:', updatedBS);
      setBalanceSheets(updatedBS || []);

      // Clear unsaved changes flag
      setHasUnsavedChanges(false);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Error saving Balance Sheet:', err);
      setError('Oops! We couldn\'t save your Balance Sheet. Let\'s try that again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTabSwitch = (newTab: 'pl' | 'balance_sheet') => {
    // Check for unsaved changes before switching tabs
    if (hasUnsavedChanges) {
      const confirmSwitch = window.confirm(
        'You have unsaved changes. If you switch tabs now, your changes will be lost. Do you want to continue?'
      );
      if (!confirmSwitch) {
        return;
      }
      setHasUnsavedChanges(false);
    }
    setActiveTab(newTab);
  };

  const handleMonthClick = (month: number, year: number, hasData: { pl: boolean; bs: boolean }) => {
    // Check for unsaved changes before changing months
    if (hasUnsavedChanges) {
      const confirmSwitch = window.confirm(
        'You have unsaved changes. If you select a different month now, your changes will be lost. Do you want to continue?'
      );
      if (!confirmSwitch) {
        return;
      }
      setHasUnsavedChanges(false);
    }

    // Set selected period
    setSelectedMonth(month);
    setSelectedYear(year);

    // If both are missing, default to P&L
    // If only one is missing, switch to that tab
    // If both exist, stay on current tab

    if (!hasData.pl && !hasData.bs) {
      setActiveTab('pl');
    } else if (!hasData.pl) {
      setActiveTab('pl');
    } else if (!hasData.bs) {
      setActiveTab('balance_sheet');
    }

    // Scroll to form
    setTimeout(() => {
      const formElement = document.querySelector('[role="tabpanel"]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Check if we're editing an existing entry
  const isEditingPL = () => {
    if (selectedMonth === null || selectedYear === null || activeTab !== 'pl') return false;
    return plStatements.some(s => {
      const date = new Date(s.period_end);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
  };

  const isEditingBS = () => {
    if (selectedMonth === null || selectedYear === null || activeTab !== 'balance_sheet') return false;
    return balanceSheets.some(s => {
      const date = new Date(s.period_end);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
  };

  // Generate initial data for forms based on selected month/year
  const getInitialData = () => {
    if (selectedMonth === null || selectedYear === null) return undefined;

    // Calculate period start and end for the selected month
    const periodStart = new Date(selectedYear, selectedMonth, 1).getTime();
    const periodEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).getTime();

    // Check if we have existing data for this period
    const existingData = activeTab === 'pl'
      ? plStatements.find(s => {
          const date = new Date(s.period_end);
          return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
        })
      : balanceSheets.find(s => {
          const date = new Date(s.period_end);
          return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
        });

    if (existingData) {
      // Return existing data for editing
      console.log('📝 Loading existing data for editing:', existingData);
      return {
        periodType: existingData.period_type,
        periodStart: existingData.period_start,
        periodEnd: existingData.period_end,
        lineItems: existingData.line_items,
      };
    }

    // Return blank form for new entry
    console.log('📄 Creating blank form for new entry:', { selectedMonth, selectedYear });
    return {
      periodType: 'monthly' as PeriodType,
      periodStart,
      periodEnd,
      lineItems: [],
    };
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>Loading your financial data...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Financial Statement Entry</h1>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className={styles.successBanner}>
          <span className={styles.successIcon}>✓</span>
          <span className={styles.successText}>{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={styles.errorBanner}>
          <span className={styles.errorIcon}>⚠</span>
          <span className={styles.errorText}>{error}</span>
        </div>
      )}

      <div className={styles.content}>
        {/* Left Column: Forms */}
        <div className={styles.mainColumn}>
          {/* Tab Navigation */}
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'pl' ? styles.active : ''}`}
              onClick={() => handleTabSwitch('pl')}
              aria-selected={activeTab === 'pl'}
              role="tab"
            >
              Profit & Loss
            </button>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'balance_sheet' ? styles.active : ''}`}
              onClick={() => handleTabSwitch('balance_sheet')}
              aria-selected={activeTab === 'balance_sheet'}
              role="tab"
            >
              Balance Sheet
            </button>
          </div>

          {/* Tab Content */}
          <div className={styles.tabContent} role="tabpanel">
            {activeTab === 'pl' && (
              <div className={styles.formContainer}>
                <PLEntryForm
                  key={`pl-${selectedMonth}-${selectedYear}`}
                  companyId={companyId}
                  onSave={handleSavePL}
                  initialData={getInitialData()}
                  isEditing={isEditingPL()}
                  onUnsavedChanges={setHasUnsavedChanges}
                  isSaving={isSaving}
                />
              </div>
            )}

            {activeTab === 'balance_sheet' && (
              <div className={styles.formContainer}>
                <BalanceSheetEntryForm
                  key={`bs-${selectedMonth}-${selectedYear}`}
                  companyId={companyId}
                  onSave={handleSaveBalanceSheet}
                  initialData={getInitialData()}
                  isEditing={isEditingBS()}
                  onUnsavedChanges={setHasUnsavedChanges}
                  isSaving={isSaving}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Month Navigator */}
        <aside className={styles.sidebar}>
          <FinancialTimeline
            plStatements={plStatements}
            balanceSheets={balanceSheets}
            onMonthClick={handleMonthClick}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        </aside>
      </div>
    </div>
  );
}
