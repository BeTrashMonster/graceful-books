/**
 * Balance Sheet Page
 *
 * Main page for viewing and exporting balance sheet reports.
 * Includes date selection, educational content, and PDF export.
 */

import { useState, useEffect } from 'react'
import { Breadcrumbs } from '../components/navigation/Breadcrumbs'
import { BalanceSheetReport } from '../components/reports/BalanceSheetReport'
import { ReportDatePicker } from '../components/reports/ReportDatePicker'
import { generateBalanceSheet, getBalanceSheetEducation } from '../services/reports/balanceSheet'
import { exportBalanceSheetPDF } from '../services/reports/pdfExport'
import type { BalanceSheetData, BalanceSheetEducation } from '../types/reports.types'
import './BalanceSheet.css'

export default function BalanceSheet() {
  const [asOfDate, setAsOfDate] = useState(new Date())
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showExplanations, setShowExplanations] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [education] = useState<BalanceSheetEducation>(getBalanceSheetEducation())

  // Load balance sheet data
  useEffect(() => {
    loadBalanceSheet()
  }, [asOfDate])

  const loadBalanceSheet = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // TODO: Get actual company ID from auth context
      const companyId = localStorage.getItem('currentCompanyId') || 'demo-company'

      const result = await generateBalanceSheet({
        companyId,
        asOfDate,
        includeZeroBalances: false,
      })

      if (result.success && result.data) {
        setBalanceSheetData(result.data)
      } else {
        setError(result.error?.message || 'Failed to generate balance sheet')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDateChange = (date: Date) => {
    setAsOfDate(date)
  }

  const handleToggleExplanations = () => {
    setShowExplanations(!showExplanations)
  }

  const handleExportPDF = async () => {
    if (!balanceSheetData) return

    setIsExporting(true)
    try {
      // TODO: Get actual company name from company data
      const companyName = localStorage.getItem('currentCompanyName') || 'My Company'
      await exportBalanceSheetPDF(balanceSheetData, companyName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF')
    } finally {
      setIsExporting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="page balance-sheet-page">
      <Breadcrumbs />

      <div className="page-header">
        <h1 className="page-title">Balance Sheet</h1>
        <p className="page-description">
          A snapshot of what you own, what you owe, and what's left over.
        </p>
      </div>

      <div className="page-content">
        {/* Controls Section */}
        <div className="balance-sheet-controls">
          <div className="controls-left">
            <ReportDatePicker selectedDate={asOfDate} onDateChange={handleDateChange} />
          </div>

          <div className="controls-right">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting || !balanceSheetData}
              className="btn-primary"
            >
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!balanceSheetData}
              className="btn-secondary"
            >
              Print
            </button>
          </div>
        </div>

        {/* Educational Overview (when explanations are on) */}
        {showExplanations && (
          <div className="educational-overview">
            <h3>{education.overview.title}</h3>
            <p>{education.overview.longDescription}</p>
            <div className="why-it-matters">
              <strong>Why it matters:</strong> {education.overview.whyItMatters}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Generating balance sheet...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <div className="error-icon">⚠</div>
            <h3>Unable to Generate Report</h3>
            <p>{error}</p>
            <button type="button" onClick={loadBalanceSheet} className="btn-secondary">
              Try Again
            </button>
          </div>
        )}

        {/* Balance Sheet Report */}
        {!isLoading && !error && balanceSheetData && (
          <BalanceSheetReport
            data={balanceSheetData}
            showExplanations={showExplanations}
            onToggleExplanations={handleToggleExplanations}
          />
        )}

        {/* Educational Content Sections */}
        {showExplanations && balanceSheetData && (
          <div className="educational-sections">
            <section className="educational-section">
              <h3>{education.balancingEquation.title}</h3>
              <p>{education.balancingEquation.longDescription}</p>
              {education.balancingEquation.examples && (
                <div className="examples">
                  <strong>Examples:</strong>
                  <ul>
                    {education.balancingEquation.examples.map((example, index) => (
                      <li key={index}>{example}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
