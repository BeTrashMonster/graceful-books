/**
 * Profit & Loss Report Page
 *
 * Displays comprehensive P&L reports with:
 * - Date range selection
 * - Comparison periods
 * - Educational annotations ("What does this mean?")
 * - PDF export
 * - Visual indicators for profitability
 *
 * Per D6 specifications and ACCT-009
 */

import { useState, useEffect } from 'react'
import { startOfMonth, endOfMonth } from 'date-fns'
import { Breadcrumbs } from '../../components/navigation/Breadcrumbs'
import { Button } from '../../components/core/Button'
import { Select } from '../../components/forms/Select'
import { Loading } from '../../components/feedback/Loading'
import { ErrorMessage } from '../../components/feedback/ErrorMessage'
import { generateProfitLossReport } from '../../services/reports/profitLoss'
import { exportProfitLossPDF } from '../../services/reports/pdfExport'
import {
  getDateRangeFromPreset,
  getComparisonPeriod,
  formatDateRange,
  whatDoesThisMean,
} from '../../utils/reporting'
import { formatMoney } from '../../utils/money'
import type {
  ProfitLossReport,
  DateRangePreset,
  PLSection,
  ComparisonPeriod,
} from '../../types/reports.types'

export default function ProfitLoss() {
  // State
  const [datePreset, setDatePreset] = useState<DateRangePreset>('this-month')
  const [showEducational, setShowEducational] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [comparisonType, setComparisonType] = useState<ComparisonPeriod['type']>('previous-period')
  const [report, setReport] = useState<ProfitLossReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Temporary company ID - would come from auth context
  const companyId = 'temp-company-id'

  // Generate report when settings change
  useEffect(() => {
    generateReport()
  }, [datePreset, showComparison, comparisonType])

  async function generateReport() {
    setLoading(true)
    setError(null)

    try {
      const dateRange = getDateRangeFromPreset(datePreset)
      const comparison = showComparison
        ? getComparisonPeriod(dateRange, comparisonType)
        : undefined

      const generatedReport = await generateProfitLossReport({
        companyId,
        dateRange,
        comparisonPeriod: comparison,
        accountingMethod: 'accrual',
        showEducationalContent: showEducational,
        includeZeroBalances: false,
      })

      setReport(generatedReport)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  async function handleExportPDF() {
    if (!report) return

    setExporting(true)
    try {
      await exportProfitLossPDF(report, {
        includeEducationalContent: showEducational,
        includeComparison: showComparison,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF')
    } finally {
      setExporting(false)
    }
  }

  function formatCurrency(amount: number): string {
    return formatMoney(Math.round(amount * 100))
  }

  function formatPercentage(value: number): string {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
  }

  function renderSection(section: PLSection, isSubtraction: boolean = false) {
    return (
      <div className="report-section" style={{ marginBottom: '2rem' }}>
        <div
          style={{
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            {section.title}
          </h3>
          {showEducational && section.educationalContent && (
            <p style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
              {section.educationalContent}
            </p>
          )}
        </div>

        {section.lineItems.map((line) => (
          <div
            key={line.accountId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <span style={{ paddingLeft: '1rem', color: '#374151' }}>
              {line.accountNumber ? `${line.accountNumber} - ${line.accountName}` : line.accountName}
            </span>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
              <span style={{ minWidth: '120px', textAlign: 'right', fontWeight: 500 }}>
                {formatCurrency(line.amount)}
              </span>
              {showComparison && line.comparisonAmount !== undefined && (
                <>
                  <span style={{ minWidth: '120px', textAlign: 'right', color: '#6b7280' }}>
                    {formatCurrency(line.comparisonAmount)}
                  </span>
                  <span
                    style={{
                      minWidth: '80px',
                      textAlign: 'right',
                      color: line.variance && line.variance > 0 ? '#059669' : '#dc2626',
                      fontWeight: 600,
                    }}
                  >
                    {line.variancePercentage !== undefined && line.variancePercentage !== null
                      ? formatPercentage(line.variancePercentage)
                      : '-'}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.75rem 0',
            marginTop: '0.5rem',
            fontWeight: 600,
            borderTop: '2px solid #e5e7eb',
          }}
        >
          <span>Total {section.title}</span>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <span style={{ minWidth: '120px', textAlign: 'right' }}>
              {formatCurrency(section.subtotal)}
            </span>
            {showComparison && section.comparisonSubtotal !== undefined && (
              <>
                <span style={{ minWidth: '120px', textAlign: 'right', color: '#6b7280' }}>
                  {formatCurrency(section.comparisonSubtotal)}
                </span>
                <span
                  style={{
                    minWidth: '80px',
                    textAlign: 'right',
                    color: section.variance && section.variance > 0 ? '#059669' : '#dc2626',
                  }}
                >
                  {section.variancePercentage !== undefined
                    ? formatPercentage(section.variancePercentage)
                    : '-'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <Breadcrumbs />

      <div className="page-header">
        <h1 className="page-title">Profit & Loss</h1>
        <p className="page-description">
          View your revenue, expenses, and profitability over time.
        </p>
      </div>

      <div className="page-content">
        {/* Controls */}
        <div
          className="card"
          style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#ffffff' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label htmlFor="date-range" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Date Range
              </label>
              <Select
                id="date-range"
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
              >
                <option value="this-month">This Month</option>
                <option value="last-month">Last Month</option>
                <option value="this-quarter">This Quarter</option>
                <option value="last-quarter">Last Quarter</option>
                <option value="this-year">This Year</option>
                <option value="last-year">Last Year</option>
                <option value="year-to-date">Year to Date</option>
              </Select>
            </div>

            <div>
              <label htmlFor="comparison" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Comparison
              </label>
              <Select
                id="comparison"
                value={showComparison ? comparisonType : 'none'}
                onChange={(e) => {
                  if (e.target.value === 'none') {
                    setShowComparison(false)
                  } else {
                    setShowComparison(true)
                    setComparisonType(e.target.value as ComparisonPeriod['type'])
                  }
                }}
              >
                <option value="none">No Comparison</option>
                <option value="previous-period">Previous Period</option>
                <option value="previous-year">Previous Year</option>
              </Select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showEducational}
                onChange={(e) => setShowEducational(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem' }}>Show "What does this mean?" explanations</span>
            </label>

            <Button
              onClick={handleExportPDF}
              disabled={!report || exporting}
              style={{ marginLeft: 'auto' }}
            >
              {exporting ? 'Exporting...' : 'Export to PDF'}
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="card">
            <Loading message="Generating your report..." />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="card">
            <ErrorMessage message={error} />
          </div>
        )}

        {/* Report */}
        {!loading && !error && report && (
          <div className="card" style={{ padding: '2rem', backgroundColor: '#ffffff' }}>
            {/* Report Header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {report.companyName}
              </h2>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Profit & Loss Statement
              </p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {formatDateRange(report.dateRange)}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                Accounting Method: {report.accountingMethod === 'accrual' ? 'Accrual' : 'Cash'}
              </p>
            </div>

            {/* Column Headers for Comparison */}
            {showComparison && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  padding: '0.75rem 0',
                  borderBottom: '2px solid #1f2937',
                  marginBottom: '1rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <span style={{ minWidth: '120px', textAlign: 'right' }}>Current</span>
                  <span style={{ minWidth: '120px', textAlign: 'right' }}>
                    {report.comparisonPeriod?.label}
                  </span>
                  <span style={{ minWidth: '80px', textAlign: 'right' }}>Change</span>
                </div>
              </div>
            )}

            {/* Revenue */}
            {renderSection(report.revenue)}

            {/* Cost of Goods Sold */}
            {renderSection(report.costOfGoodsSold, true)}

            {/* Gross Profit */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1rem',
                marginBottom: '2rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '1.125rem',
              }}
            >
              <span>Gross Profit</span>
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <span style={{ minWidth: '120px', textAlign: 'right' }}>
                  {formatCurrency(report.grossProfit.amount)}
                </span>
                {showComparison && report.grossProfit.comparisonAmount !== undefined && (
                  <>
                    <span style={{ minWidth: '120px', textAlign: 'right' }}>
                      {formatCurrency(report.grossProfit.comparisonAmount)}
                    </span>
                    <span
                      style={{
                        minWidth: '80px',
                        textAlign: 'right',
                        color:
                          report.grossProfit.variance && report.grossProfit.variance > 0
                            ? '#059669'
                            : '#dc2626',
                      }}
                    >
                      {report.grossProfit.variancePercentage !== undefined
                        ? formatPercentage(report.grossProfit.variancePercentage)
                        : '-'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Operating Expenses */}
            {renderSection(report.operatingExpenses, true)}

            {/* Operating Income */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1rem',
                marginBottom: '2rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '1.125rem',
              }}
            >
              <span>Operating Income</span>
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <span style={{ minWidth: '120px', textAlign: 'right' }}>
                  {formatCurrency(report.operatingIncome.amount)}
                </span>
                {showComparison && report.operatingIncome.comparisonAmount !== undefined && (
                  <>
                    <span style={{ minWidth: '120px', textAlign: 'right' }}>
                      {formatCurrency(report.operatingIncome.comparisonAmount)}
                    </span>
                    <span
                      style={{
                        minWidth: '80px',
                        textAlign: 'right',
                        color:
                          report.operatingIncome.variance && report.operatingIncome.variance > 0
                            ? '#059669'
                            : '#dc2626',
                      }}
                    >
                      {report.operatingIncome.variancePercentage !== undefined
                        ? formatPercentage(report.operatingIncome.variancePercentage)
                        : '-'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Other Income/Expenses (if present) */}
            {report.otherIncome && renderSection(report.otherIncome)}
            {report.otherExpenses && renderSection(report.otherExpenses, true)}

            {/* Net Income */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1.5rem',
                marginTop: '2rem',
                backgroundColor: report.netIncome.isProfitable ? '#ecfdf5' : '#fef2f2',
                borderRadius: '0.5rem',
                border: `2px solid ${report.netIncome.isProfitable ? '#059669' : '#dc2626'}`,
                fontWeight: 700,
                fontSize: '1.25rem',
              }}
            >
              <span>Net Income</span>
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <span
                  style={{
                    minWidth: '120px',
                    textAlign: 'right',
                    color: report.netIncome.isProfitable ? '#059669' : '#dc2626',
                  }}
                >
                  {formatCurrency(report.netIncome.amount)}
                </span>
                {showComparison && report.netIncome.comparisonAmount !== undefined && (
                  <>
                    <span style={{ minWidth: '120px', textAlign: 'right' }}>
                      {formatCurrency(report.netIncome.comparisonAmount)}
                    </span>
                    <span
                      style={{
                        minWidth: '80px',
                        textAlign: 'right',
                        color:
                          report.netIncome.variance && report.netIncome.variance > 0
                            ? '#059669'
                            : '#dc2626',
                      }}
                    >
                      {report.netIncome.variancePercentage !== undefined
                        ? formatPercentage(report.netIncome.variancePercentage)
                        : '-'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Profitability Message */}
            <div
              style={{
                textAlign: 'center',
                marginTop: '2rem',
                padding: '1rem',
                backgroundColor: report.netIncome.isProfitable ? '#f0fdf4' : '#f9fafb',
                borderRadius: '0.5rem',
              }}
            >
              <p
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: report.netIncome.isProfitable ? '#059669' : '#6b7280',
                }}
              >
                {report.netIncome.isProfitable
                  ? 'You made money this period! Great work.'
                  : 'This period showed a loss. Review your expenses and revenue to identify opportunities for improvement.'}
              </p>
            </div>

            {/* Educational Content Panel */}
            {showEducational && (
              <div
                style={{
                  marginTop: '2rem',
                  padding: '1.5rem',
                  backgroundColor: '#eff6ff',
                  borderRadius: '0.5rem',
                  border: '1px solid #bfdbfe',
                }}
              >
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1e40af' }}>
                  What does this mean?
                </h3>
                <div style={{ fontSize: '0.875rem', color: '#1e3a8a', lineHeight: '1.6' }}>
                  <p style={{ marginBottom: '0.75rem' }}>
                    <strong>Net Income</strong>: {whatDoesThisMean.netIncome}
                  </p>
                  <p>
                    {report.netIncome.isProfitable
                      ? whatDoesThisMean.profitable
                      : whatDoesThisMean.loss}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
