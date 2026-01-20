/**
 * Loan Amortization Schedule Component
 *
 * Displays the amortization schedule for a loan with principal/interest breakdown.
 *
 * Requirements:
 * - H7: Interest Split Prompt System
 * - WCAG 2.1 AA Compliance
 */

import { useState, useMemo } from 'react';
import { Loading } from '../feedback/Loading';
import type {
  AmortizationSchedule,
  AmortizationScheduleEntry,
  LoanAccount,
} from '../../types/loanAmortization.types';
import Decimal from 'decimal.js';

export interface LoanAmortizationScheduleProps {
  /**
   * Loan account details
   */
  loanAccount: LoanAccount;

  /**
   * Amortization schedule
   */
  schedule: AmortizationSchedule | null;

  /**
   * Whether schedule is loading
   */
  isLoading?: boolean;

  /**
   * Callback when user clicks on a schedule entry
   */
  onEntryClick?: (entry: AmortizationScheduleEntry) => void;

  /**
   * Whether to show paid entries
   */
  showPaidEntries?: boolean;
}

/**
 * Loan Amortization Schedule Component
 */
export const LoanAmortizationSchedule = ({
  loanAccount,
  schedule,
  isLoading = false,
  onEntryClick,
  showPaidEntries = true,
}: LoanAmortizationScheduleProps) => {
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  /**
   * Group entries by year
   */
  const entriesByYear = useMemo(() => {
    if (!schedule) return {};

    const grouped: Record<number, AmortizationScheduleEntry[]> = {};

    for (const entry of schedule.entries) {
      if (!showPaidEntries && entry.is_paid) continue;

      const year = new Date(entry.payment_date).getFullYear();
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(entry);
    }

    return grouped;
  }, [schedule, showPaidEntries]);

  /**
   * Calculate year totals
   */
  const calculateYearTotals = (entries: AmortizationScheduleEntry[]) => {
    let totalPayment = new Decimal(0);
    let totalPrincipal = new Decimal(0);
    let totalInterest = new Decimal(0);

    for (const entry of entries) {
      totalPayment = totalPayment.plus(new Decimal(entry.scheduled_payment));
      totalPrincipal = totalPrincipal.plus(new Decimal(entry.principal_amount));
      totalInterest = totalInterest.plus(new Decimal(entry.interest_amount));
    }

    return {
      payment: totalPayment.toFixed(2),
      principal: totalPrincipal.toFixed(2),
      interest: totalInterest.toFixed(2),
    };
  };

  /**
   * Format date
   */
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * Format currency
   */
  const formatCurrency = (amount: string): string => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="schedule-loading">
        <Loading />
        <p>Generating amortization schedule...</p>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="schedule-empty">
        <p>No amortization schedule available.</p>
        <p>Generate a schedule to see payment breakdown.</p>
      </div>
    );
  }

  const years = Object.keys(entriesByYear)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="loan-amortization-schedule">
      {/* Summary */}
      <div className="schedule-summary">
        <div className="summary-card">
          <span className="label">Total Payments:</span>
          <span className="value">{formatCurrency(schedule.total_payments)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Total Interest:</span>
          <span className="value">{formatCurrency(schedule.total_interest)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Remaining Balance:</span>
          <span className="value">{formatCurrency(loanAccount.current_balance)}</span>
        </div>
      </div>

      {/* Schedule by year */}
      <div className="schedule-years">
        {years.map((year) => {
          const entries = entriesByYear[year];
          const totals = calculateYearTotals(entries || []);
          const isExpanded = expandedYear === year;

          return (
            <div key={year} className="year-section">
              <button
                className="year-header"
                onClick={() => setExpandedYear(isExpanded ? null : year)}
                aria-expanded={isExpanded}
                aria-controls={`year-${year}-entries`}
              >
                <span className="year-label">{year}</span>
                <span className="year-stats">
                  {entries.length} payments • {formatCurrency(totals.payment)} total
                </span>
                <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                  ▼
                </span>
              </button>

              {isExpanded && (
                <div id={`year-${year}-entries`} className="year-entries">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Payment</th>
                        <th>Principal</th>
                        <th>Interest</th>
                        <th>Balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className={`entry-row ${entry.is_paid ? 'paid' : 'unpaid'} ${
                            onEntryClick ? 'clickable' : ''
                          }`}
                          onClick={() => onEntryClick?.(entry)}
                        >
                          <td>{entry.payment_number}</td>
                          <td>{formatDate(entry.payment_date)}</td>
                          <td className="amount">
                            {formatCurrency(entry.scheduled_payment)}
                          </td>
                          <td className="amount principal">
                            {formatCurrency(entry.principal_amount)}
                          </td>
                          <td className="amount interest">
                            {formatCurrency(entry.interest_amount)}
                          </td>
                          <td className="amount balance">
                            {formatCurrency(entry.remaining_balance)}
                          </td>
                          <td>
                            {entry.is_paid ? (
                              <span className="badge paid">Paid</span>
                            ) : (
                              <span className="badge unpaid">Due</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="totals-row">
                        <td colSpan={2}>Year Total</td>
                        <td className="amount">{formatCurrency(totals.payment)}</td>
                        <td className="amount principal">
                          {formatCurrency(totals.principal)}
                        </td>
                        <td className="amount interest">
                          {formatCurrency(totals.interest)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .loan-amortization-schedule {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .schedule-loading,
        .schedule-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          text-align: center;
          color: #6b7280;
        }

        .schedule-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .summary-card {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          background-color: #f9fafb;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
        }

        .summary-card .label {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .summary-card .value {
          font-size: 1.5rem;
          font-weight: 600;
          color: #111827;
        }

        .schedule-years {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .year-section {
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .year-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background-color: #f9fafb;
          border: none;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          transition: background-color 0.2s;
        }

        .year-header:hover {
          background-color: #f3f4f6;
        }

        .year-header:focus {
          outline: 2px solid #3b82f6;
          outline-offset: -2px;
        }

        .year-stats {
          font-size: 0.875rem;
          font-weight: 400;
          color: #6b7280;
        }

        .expand-icon {
          transition: transform 0.2s;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .year-entries {
          padding: 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead th {
          text-align: left;
          padding: 0.75rem 1rem;
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
        }

        thead th:nth-child(n + 3) {
          text-align: right;
        }

        tbody td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #f3f4f6;
          font-size: 0.875rem;
        }

        tbody tr.clickable {
          cursor: pointer;
        }

        tbody tr.clickable:hover {
          background-color: #f9fafb;
        }

        tbody tr.paid {
          opacity: 0.7;
        }

        .amount {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .amount.principal {
          color: #059669;
          font-weight: 500;
        }

        .amount.interest {
          color: #dc2626;
          font-weight: 500;
        }

        .amount.balance {
          font-weight: 600;
        }

        .badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge.paid {
          background-color: #d1fae5;
          color: #065f46;
        }

        .badge.unpaid {
          background-color: #fef3c7;
          color: #92400e;
        }

        tfoot .totals-row {
          font-weight: 600;
          background-color: #f9fafb;
          border-top: 2px solid #e5e7eb;
        }

        tfoot td {
          padding: 0.75rem 1rem;
        }

        @media (prefers-reduced-motion: reduce) {
          .expand-icon,
          .year-header {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
};
