/**
 * Balance Sheet Report Component
 *
 * Displays balance sheet with Assets, Liabilities, and Equity sections.
 * Includes plain English explanations and professional formatting.
 */

import { formatMoney } from '../../utils/money'
import type { BalanceSheetData, BalanceSheetLine } from '../../types/reports.types'
import './BalanceSheetReport.css'

interface BalanceSheetReportProps {
  data: BalanceSheetData
  showExplanations?: boolean
  onToggleExplanations?: () => void
}

export const BalanceSheetReport = ({
  data,
  showExplanations = false,
  onToggleExplanations,
}: BalanceSheetReportProps) => {
  return (
    <div className="balance-sheet-report">
      {/* Explanation Toggle */}
      {onToggleExplanations && (
        <div className="report-controls">
          <button onClick={onToggleExplanations} className="btn-secondary" type="button">
            {showExplanations ? 'Hide Explanations' : "What does this mean?"}
          </button>
        </div>
      )}

      {/* Report Header */}
      <div className="report-header">
        <h2 className="report-title">Balance Sheet</h2>
        <p className="report-subtitle">
          As of {formatDate(data.asOfDate)}
        </p>
        {showExplanations && (
          <div className="report-explanation">
            <p>
              The balance sheet is like a financial snapshot - it shows what you own, what you
              owe, and what's left over at a specific point in time.
            </p>
          </div>
        )}
      </div>

      {/* Assets Section */}
      <section className="balance-sheet-section">
        <div className="section-header">
          <h3 className="section-title">
            {showExplanations ? data.assets.plainEnglishTitle : data.assets.title}
          </h3>
          {showExplanations && (
            <p className="section-description">{data.assets.description}</p>
          )}
        </div>
        <div className="section-content">
          {renderLines(data.assets.lines)}
          <div className="section-total">
            <span className="total-label">Total {data.assets.title}</span>
            <span className="total-amount">
              {formatMoney(data.assets.total)}
            </span>
          </div>
        </div>
      </section>

      {/* Liabilities Section */}
      <section className="balance-sheet-section">
        <div className="section-header">
          <h3 className="section-title">
            {showExplanations ? data.liabilities.plainEnglishTitle : data.liabilities.title}
          </h3>
          {showExplanations && (
            <p className="section-description">{data.liabilities.description}</p>
          )}
        </div>
        <div className="section-content">
          {renderLines(data.liabilities.lines)}
          <div className="section-total">
            <span className="total-label">Total {data.liabilities.title}</span>
            <span className="total-amount">
              {formatMoney(data.liabilities.total)}
            </span>
          </div>
        </div>
      </section>

      {/* Equity Section */}
      <section className="balance-sheet-section">
        <div className="section-header">
          <h3 className="section-title">
            {showExplanations ? data.equity.plainEnglishTitle : data.equity.title}
          </h3>
          {showExplanations && (
            <p className="section-description">{data.equity.description}</p>
          )}
        </div>
        <div className="section-content">
          {renderLines(data.equity.lines)}
          <div className="section-total">
            <span className="total-label">Total {data.equity.title}</span>
            <span className="total-amount">
              {formatMoney(data.equity.total)}
            </span>
          </div>
        </div>
      </section>

      {/* Grand Total */}
      <div className="balance-sheet-grand-total">
        <div className="grand-total-row">
          <span className="grand-total-label">Total Liabilities and Equity</span>
          <span className="grand-total-amount">
            {formatMoney(data.totalLiabilitiesAndEquity)}
          </span>
        </div>
      </div>

      {/* Balance Verification */}
      <div className={`balance-verification ${data.isBalanced ? 'balanced' : 'unbalanced'}`}>
        {data.isBalanced ? (
          <div className="balance-indicator balanced">
            <span className="balance-icon">✓</span>
            <span className="balance-message">Balance Sheet is balanced</span>
          </div>
        ) : (
          <div className="balance-indicator unbalanced">
            <span className="balance-icon">⚠</span>
            <span className="balance-message">
              Difference: {formatMoney(Math.abs(data.balanceDifference))}
            </span>
          </div>
        )}
      </div>

      {/* Explanation for equation */}
      {showExplanations && (
        <div className="balance-equation-explanation">
          <h4>The Balance Sheet Equation</h4>
          <div className="equation">
            <span className="equation-part">Assets</span>
            <span className="equation-equals">=</span>
            <span className="equation-part">Liabilities</span>
            <span className="equation-plus">+</span>
            <span className="equation-part">Equity</span>
          </div>
          <p className="equation-description">
            This fundamental equation always holds true. Everything your business owns (assets)
            is financed either by borrowing (liabilities) or by your own investment (equity).
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Render account lines with proper indentation
 */
function renderLines(lines: BalanceSheetLine[]) {
  if (lines.length === 0) {
    return (
      <div className="empty-section">
        <p>No accounts in this section</p>
      </div>
    )
  }

  return (
    <div className="account-lines">
      {lines.map((line) => (
        <div
          key={line.accountId}
          className={`account-line level-${line.level} ${line.isSubAccount ? 'sub-account' : 'parent-account'}`}
          style={{ paddingLeft: `${line.level * 1.5}rem` }}
        >
          <span className="account-name">
            {line.accountNumber && (
              <span className="account-number">{line.accountNumber} - </span>
            )}
            {line.accountName}
          </span>
          <span className="account-amount">
            {formatMoney(line.balance)}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Format date for display
 */
function formatDate(date: Date | number): string {
  // Handle both Date objects and timestamps
  const dateObj = typeof date === 'number' ? new Date(date) : date

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC', // Use UTC to avoid timezone issues with date-only values
  }).format(dateObj)
}
