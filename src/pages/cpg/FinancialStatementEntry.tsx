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
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db';
import { getDeviceId } from '../../db/crdt';
import { PLEntryForm } from '../../components/cpg/PLEntryForm';
import { BalanceSheetEntryForm } from '../../components/cpg/BalanceSheetEntryForm';
import { SKUTracker } from '../../components/cpg/SKUTracker';
import {
  type StandaloneFinancials,
  type PeriodType,
  createDefaultStandaloneFinancials,
  calculatePLTotals,
  calculateBalanceSheetTotals,
} from '../../db/schema/standaloneFinancials.schema';
import styles from './FinancialStatementEntry.module.css';

export default function FinancialStatementEntry() {
  const { companyId: authCompanyId } = useAuth();
  const companyId = authCompanyId || 'demo-company-id';
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<'pl' | 'balance_sheet'>('pl');

  // Data state
  const [plStatements, setPlStatements] = useState<StandaloneFinancials[]>([]);
  const [balanceSheets, setBalanceSheets] = useState<StandaloneFinancials[]>([]);
  const [skuCount, setSkuCount] = useState(0);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [_isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (!companyId) return;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load P&L statements
        const plData = await db.standaloneFinancials
          ?.where({ company_id: companyId, statement_type: 'profit_loss', active: true })
          .toArray();

        // Load Balance Sheets
        const bsData = await db.standaloneFinancials
          ?.where({ company_id: companyId, statement_type: 'balance_sheet', active: true })
          .toArray();

        // Load SKU count from CPG finished products
        const products = await db.cpgFinishedProducts
          .where('company_id')
          .equals(companyId)
          .filter(p => p.active && p.deleted_at === null)
          .toArray();

        setPlStatements(plData || []);
        setBalanceSheets(bsData || []);
        setSkuCount(products.length);
      } catch (err) {
        console.error('Error loading financial statements:', err);
        setError('Oops! We had trouble loading your financial data. Let\'s try that again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [companyId]);

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

      const statement: Partial<StandaloneFinancials> = {
        ...createDefaultStandaloneFinancials(
          companyId,
          'profit_loss',
          data.periodStart,
          data.periodEnd,
          deviceId
        ),
        period_type: data.periodType,
        line_items: data.lineItems,
        totals,
      };

      await db.standaloneFinancials?.add(statement as StandaloneFinancials);

      setSuccessMessage('P&L statement saved successfully! You\'re building a solid financial foundation.');

      // Reload data
      const updatedPL = await db.standaloneFinancials
        ?.where({ company_id: companyId, statement_type: 'profit_loss', active: true })
        .toArray();
      setPlStatements(updatedPL || []);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Error saving P&L statement:', err);
      setError('Oops! We couldn\'t save your P&L statement. Let\'s try that again.');
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

      const statement: Partial<StandaloneFinancials> = {
        ...createDefaultStandaloneFinancials(
          companyId,
          'balance_sheet',
          data.periodStart,
          data.periodEnd,
          deviceId
        ),
        period_type: data.periodType,
        line_items: data.lineItems,
        totals,
      };

      await db.standaloneFinancials?.add(statement as StandaloneFinancials);

      setSuccessMessage('Balance Sheet saved successfully! Great work keeping your records organized.');

      // Reload data
      const updatedBS = await db.standaloneFinancials
        ?.where({ company_id: companyId, statement_type: 'balance_sheet', active: true })
        .toArray();
      setBalanceSheets(updatedBS || []);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Error saving Balance Sheet:', err);
      setError('Oops! We couldn\'t save your Balance Sheet. Let\'s try that again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManageProducts = () => {
    navigate(`/cpg/products`);
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
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Financial Statement Entry</h1>
          <p className={styles.subtitle}>
            Enter your P&L and Balance Sheet data to power your CPG cost analysis. Take your time - we'll guide you through each step.
          </p>
        </div>
      </header>

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
              onClick={() => setActiveTab('pl')}
              aria-selected={activeTab === 'pl'}
              role="tab"
            >
              Profit & Loss
            </button>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'balance_sheet' ? styles.active : ''}`}
              onClick={() => setActiveTab('balance_sheet')}
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
                  companyId={companyId}
                  onSave={handleSavePL}
                />
              </div>
            )}

            {activeTab === 'balance_sheet' && (
              <div className={styles.formContainer}>
                <BalanceSheetEntryForm
                  companyId={companyId}
                  onSave={handleSaveBalanceSheet}
                />
              </div>
            )}
          </div>

          {/* Historical Statements */}
          {activeTab === 'pl' && plStatements.length > 0 && (
            <div className={styles.historySection}>
              <h3 className={styles.historyTitle}>Your P&L Statements</h3>
              <div className={styles.historyList}>
                {plStatements.map(statement => (
                  <div key={statement.id} className={styles.historyCard}>
                    <div className={styles.historyHeader}>
                      <span className={styles.historyPeriod}>
                        {statement.period_label ||
                          `${new Date(statement.period_start).toLocaleDateString()} - ${new Date(statement.period_end).toLocaleDateString()}`}
                      </span>
                      <span className={styles.historyDate}>
                        Saved {new Date(statement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className={styles.historyStats}>
                      <div className={styles.historyStat}>
                        <span className={styles.historyStatLabel}>Revenue:</span>
                        <span className={styles.historyStatValue}>
                          ${statement.totals.revenue || '0.00'}
                        </span>
                      </div>
                      <div className={styles.historyStat}>
                        <span className={styles.historyStatLabel}>Net Income:</span>
                        <span className={`${styles.historyStatValue} ${parseFloat(statement.totals.net_income || '0') >= 0 ? styles.positive : styles.negative}`}>
                          ${statement.totals.net_income || '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'balance_sheet' && balanceSheets.length > 0 && (
            <div className={styles.historySection}>
              <h3 className={styles.historyTitle}>Your Balance Sheets</h3>
              <div className={styles.historyList}>
                {balanceSheets.map(statement => (
                  <div key={statement.id} className={styles.historyCard}>
                    <div className={styles.historyHeader}>
                      <span className={styles.historyPeriod}>
                        As of {new Date(statement.period_end).toLocaleDateString()}
                      </span>
                      <span className={styles.historyDate}>
                        Saved {new Date(statement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className={styles.historyStats}>
                      <div className={styles.historyStat}>
                        <span className={styles.historyStatLabel}>Total Assets:</span>
                        <span className={styles.historyStatValue}>
                          ${statement.totals.total_assets || '0.00'}
                        </span>
                      </div>
                      <div className={styles.historyStat}>
                        <span className={styles.historyStatLabel}>Total Equity:</span>
                        <span className={styles.historyStatValue}>
                          ${statement.totals.equity || '0.00'}
                        </span>
                      </div>
                    </div>
                    <div className={styles.balanceStatus}>
                      {statement.totals.is_balanced ? (
                        <span className={styles.balanced}>✓ Balanced</span>
                      ) : (
                        <span className={styles.unbalanced}>⚠ Needs Review</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: SKU Tracker */}
        <aside className={styles.sidebar}>
          <SKUTracker
            companyId={companyId}
            skuCount={skuCount}
            onManageProducts={handleManageProducts}
          />
        </aside>
      </div>
    </div>
  );
}
