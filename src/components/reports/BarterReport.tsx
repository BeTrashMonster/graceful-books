/**
 * BarterReport Component
 *
 * Displays barter transactions with income/expense breakdown for tax reporting.
 *
 * Requirements: I5 - Barter/Trade Transactions (Nice)
 */

import { useState, useEffect } from 'react';
import type {
  BarterTransaction,
  BarterTransactionStatistics,
  Barter1099Summary,
} from '../../types/barter.types';

export interface BarterReportProps {
  companyId: string;
  taxYear: number;
  transactions: BarterTransaction[];
  statistics: BarterTransactionStatistics;
  summary1099B: Barter1099Summary | null;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

export function BarterReport({
  companyId: _companyId,
  taxYear,
  transactions,
  statistics,
  summary1099B,
  onExportCSV,
  onExportPDF,
}: BarterReportProps) {
  const [viewMode, setViewMode] = useState<'summary' | 'detail' | '1099b'>('summary');
  const [sortBy, setSortBy] = useState<'date' | 'income' | 'expense'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedTransactions = [...transactions].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'date':
        comparison = a.transaction_date - b.transaction_date;
        break;
      case 'income':
        comparison = parseFloat(a.goods_received_fmv) - parseFloat(b.goods_received_fmv);
        break;
      case 'expense':
        comparison = parseFloat(a.goods_provided_fmv) - parseFloat(b.goods_provided_fmv);
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const formatCurrency = (amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div style={{ maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, marginBottom: '0.5rem' }}>
          Barter Transaction Report - {taxYear}
        </h2>
        <p style={{ margin: 0, color: '#666' }}>
          Summary of barter income and expenses for tax reporting
        </p>
      </div>

      {/* View Mode Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #e0e0e0',
          marginBottom: '1.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => setViewMode('summary')}
          style={{
            padding: '0.75rem 1rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: viewMode === 'summary' ? 600 : 400,
            color: viewMode === 'summary' ? '#0066cc' : '#666',
            borderBottom: viewMode === 'summary' ? '3px solid #0066cc' : 'none',
            marginBottom: viewMode === 'summary' ? '-2px' : '0',
          }}
        >
          Summary
        </button>
        <button
          type="button"
          onClick={() => setViewMode('detail')}
          style={{
            padding: '0.75rem 1rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: viewMode === 'detail' ? 600 : 400,
            color: viewMode === 'detail' ? '#0066cc' : '#666',
            borderBottom: viewMode === 'detail' ? '3px solid #0066cc' : 'none',
            marginBottom: viewMode === 'detail' ? '-2px' : '0',
          }}
        >
          Transaction Detail
        </button>
        <button
          type="button"
          onClick={() => setViewMode('1099b')}
          style={{
            padding: '0.75rem 1rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: viewMode === '1099b' ? 600 : 400,
            color: viewMode === '1099b' ? '#0066cc' : '#666',
            borderBottom: viewMode === '1099b' ? '3px solid #0066cc' : 'none',
            marginBottom: viewMode === '1099b' ? '-2px' : '0',
          }}
        >
          1099-B Summary
        </button>
      </div>

      {/* Export Buttons */}
      {(onExportCSV || onExportPDF) && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
          {onExportCSV && (
            <button
              type="button"
              onClick={onExportCSV}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Export to CSV
            </button>
          )}
          {onExportPDF && (
            <button
              type="button"
              onClick={onExportPDF}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Export to PDF
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {viewMode === 'summary' && (
        <SummaryView statistics={statistics} formatCurrency={formatCurrency} />
      )}
      {viewMode === 'detail' && (
        <DetailView
          transactions={sortedTransactions}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={(field) => {
            if (sortBy === field) {
              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
            } else {
              setSortBy(field);
              setSortDirection('desc');
            }
          }}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}
      {viewMode === '1099b' && (
        <Form1099BView summary={summary1099B} formatCurrency={formatCurrency} />
      )}
    </div>
  );
}

interface SummaryViewProps {
  statistics: BarterTransactionStatistics;
  formatCurrency: (amount: string | number) => string;
}

function SummaryView({ statistics, formatCurrency }: SummaryViewProps) {
  return (
    <div>
      {/* Key Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            padding: '1.5rem',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: 'white',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
            Total Barter Income
          </p>
          <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600, color: '#2e7d32' }}>
            {formatCurrency(statistics.total_income_fmv)}
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
            Goods/services received
          </p>
        </div>

        <div
          style={{
            padding: '1.5rem',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: 'white',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
            Total Barter Expense
          </p>
          <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600, color: '#d32f2f' }}>
            {formatCurrency(statistics.total_expense_fmv)}
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
            Goods/services provided
          </p>
        </div>

        <div
          style={{
            padding: '1.5rem',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: 'white',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
            Total Transactions
          </p>
          <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600, color: '#0066cc' }}>
            {statistics.total_transactions}
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
            {statistics.reportable_1099_count} require 1099-B
          </p>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div
        style={{
          padding: '1.5rem',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          backgroundColor: 'white',
          marginBottom: '1.5rem',
        }}
      >
        <h3 style={{ margin: 0, marginBottom: '1rem' }}>Monthly Breakdown</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Month</th>
              <th style={{ textAlign: 'right', padding: '0.75rem' }}>Transactions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(statistics.by_month)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, count]) => (
                <tr key={month} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.75rem' }}>{month}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem' }}>{count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Status Breakdown */}
      <div
        style={{
          padding: '1.5rem',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          backgroundColor: 'white',
        }}
      >
        <h3 style={{ margin: 0, marginBottom: '1rem' }}>By Status</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {Object.entries(statistics.by_status).map(([status, count]) => (
            <div
              key={status}
              style={{
                padding: '0.75rem 1rem',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                backgroundColor: '#f9f9f9',
              }}
            >
              <span style={{ fontWeight: 600 }}>{status}:</span> {count}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DetailViewProps {
  transactions: BarterTransaction[];
  sortBy: 'date' | 'income' | 'expense';
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: 'date' | 'income' | 'expense') => void;
  formatCurrency: (amount: string | number) => string;
  formatDate: (timestamp: number) => string;
}

function DetailView({
  transactions,
  sortBy,
  sortDirection,
  onSortChange,
  formatCurrency,
  formatDate,
}: DetailViewProps) {
  const getSortIcon = (field: 'date' | 'income' | 'expense') => {
    if (sortBy !== field) return '⇅';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <div
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: 'white',
        overflow: 'auto',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#f9f9f9' }}>
            <th
              style={{
                textAlign: 'left',
                padding: '0.75rem',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => onSortChange('date')}
            >
              Date {getSortIcon('date')}
            </th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Received</th>
            <th
              style={{
                textAlign: 'right',
                padding: '0.75rem',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => onSortChange('income')}
            >
              Income {getSortIcon('income')}
            </th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Provided</th>
            <th
              style={{
                textAlign: 'right',
                padding: '0.75rem',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => onSortChange('expense')}
            >
              Expense {getSortIcon('expense')}
            </th>
            <th style={{ textAlign: 'center', padding: '0.75rem' }}>Status</th>
            <th style={{ textAlign: 'center', padding: '0.75rem' }}>1099-B</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => (
            <tr key={txn.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '0.75rem' }}>{formatDate(txn.transaction_date)}</td>
              <td style={{ padding: '0.75rem', maxWidth: '200px' }}>
                {txn.goods_received_description}
              </td>
              <td style={{ textAlign: 'right', padding: '0.75rem', color: '#2e7d32' }}>
                {formatCurrency(txn.goods_received_fmv)}
              </td>
              <td style={{ padding: '0.75rem', maxWidth: '200px' }}>
                {txn.goods_provided_description}
              </td>
              <td style={{ textAlign: 'right', padding: '0.75rem', color: '#d32f2f' }}>
                {formatCurrency(txn.goods_provided_fmv)}
              </td>
              <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                <span
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    backgroundColor:
                      txn.status === 'POSTED' ? '#e8f5e9' :
                      txn.status === 'DRAFT' ? '#fff4e5' : '#f0f0f0',
                    color:
                      txn.status === 'POSTED' ? '#2e7d32' :
                      txn.status === 'DRAFT' ? '#e65100' : '#666',
                  }}
                >
                  {txn.status}
                </span>
              </td>
              <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                {txn.is_1099_reportable ? '✓' : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {transactions.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No barter transactions found for this period.
        </div>
      )}
    </div>
  );
}

interface Form1099BViewProps {
  summary: Barter1099Summary | null;
  formatCurrency: (amount: string | number) => string;
}

function Form1099BView({ summary, formatCurrency }: Form1099BViewProps) {
  if (!summary || summary.counterparty_count === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          backgroundColor: 'white',
          textAlign: 'center',
          color: '#666',
        }}
      >
        <p style={{ margin: 0 }}>No 1099-B reportable transactions found for this tax year.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Card */}
      <div
        style={{
          padding: '1.5rem',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          backgroundColor: 'white',
          marginBottom: '1.5rem',
        }}
      >
        <h3 style={{ margin: 0, marginBottom: '1rem' }}>1099-B Reporting Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Total Reportable Income</p>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
              {formatCurrency(summary.total_reportable_income)}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Number of Counterparties</p>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
              {summary.counterparty_count}
            </p>
          </div>
        </div>
      </div>

      {/* Counterparty Details */}
      {summary.counterparties.map((cp) => (
        <div
          key={cp.counterparty_contact_id}
          style={{
            padding: '1.5rem',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: 'white',
            marginBottom: '1rem',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>{cp.counterparty_name}</h4>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              {cp.counterparty_address && <p style={{ margin: 0 }}>{cp.counterparty_address}</p>}
              {cp.counterparty_tax_id && (
                <p style={{ margin: 0 }}>Tax ID: {cp.counterparty_tax_id}</p>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem',
              padding: '1rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '4px',
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Total FMV Received</p>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                {formatCurrency(cp.total_fmv)}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Transactions</p>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                {cp.transaction_count}
              </p>
            </div>
          </div>
        </div>
      ))}

      <div
        style={{
          padding: '1rem',
          backgroundColor: '#e3f2fd',
          border: '1px solid #bbdefb',
          borderRadius: '4px',
          marginTop: '1.5rem',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Next Steps</p>
        <p style={{ margin: '0.5rem 0 0' }}>
          Review this information with your tax professional when preparing your tax return. You may
          need to issue Form 1099-B to counterparties or report this information on your Schedule C.
        </p>
      </div>
    </div>
  );
}
