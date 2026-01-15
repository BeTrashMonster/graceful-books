/**
 * PDF Export Service for Reports
 *
 * Generates professional PDF documents for financial reports using pdfmake.
 * Shared between Balance Sheet and P&L reports.
 */

import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces'
import type {
  BalanceSheetData,
  ProfitLossReport,
  PDFExportOptions,
  ExportResult,
  PLSection,
} from '../../types/reports.types'
import { formatMoney } from '../../utils/money'
import { formatDateRange } from '../../utils/reporting'
import { format } from 'date-fns'

// Initialize pdfMake with fonts
pdfMake.vfs = (pdfFonts as any).pdfMake?.vfs ?? pdfFonts

/**
 * Format a date for display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/**
 * Generate PDF for Balance Sheet
 */
export async function generateBalanceSheetPDF(
  data: BalanceSheetData,
  companyName?: string
): Promise<Blob> {
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    pageMargins: [40, 60, 40, 60],
    info: {
      title: `Balance Sheet - ${companyName || 'Company'}`,
      author: 'Graceful Books',
      subject: 'Balance Sheet Report',
      creator: 'Graceful Books',
    },
    content: [
      // Header
      {
        text: companyName || 'Company Name',
        style: 'companyName',
        alignment: 'center',
      },
      {
        text: 'Balance Sheet',
        style: 'reportTitle',
        alignment: 'center',
      },
      {
        text: `As of ${formatDate(data.asOfDate)}`,
        style: 'reportDate',
        alignment: 'center',
        margin: [0, 0, 0, 20],
      },

      // Assets Section
      {
        text: 'ASSETS',
        style: 'sectionHeader',
        margin: [0, 10, 0, 5],
      },
      ...buildSectionTable(data.assets.lines),
      {
        columns: [
          { text: 'Total Assets', style: 'totalLabel', width: '*' },
          {
            text: formatMoney(Math.round(data.totalAssets * 100)),
            style: 'totalAmount',
            width: 100,
            alignment: 'right',
          },
        ],
        margin: [0, 5, 0, 15],
      },

      // Liabilities Section
      {
        text: 'LIABILITIES',
        style: 'sectionHeader',
        margin: [0, 10, 0, 5],
      },
      ...buildSectionTable(data.liabilities.lines),
      {
        columns: [
          { text: 'Total Liabilities', style: 'totalLabel', width: '*' },
          {
            text: formatMoney(Math.round(data.liabilities.total * 100)),
            style: 'totalAmount',
            width: 100,
            alignment: 'right',
          },
        ],
        margin: [0, 5, 0, 15],
      },

      // Equity Section
      {
        text: 'EQUITY',
        style: 'sectionHeader',
        margin: [0, 10, 0, 5],
      },
      ...buildSectionTable(data.equity.lines),
      {
        columns: [
          { text: 'Total Equity', style: 'totalLabel', width: '*' },
          {
            text: formatMoney(Math.round(data.equity.total * 100)),
            style: 'totalAmount',
            width: 100,
            alignment: 'right',
          },
        ],
        margin: [0, 5, 0, 15],
      },

      // Grand Total
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 2,
          },
        ],
        margin: [0, 5, 0, 5],
      },
      {
        columns: [
          { text: 'Total Liabilities and Equity', style: 'grandTotalLabel', width: '*' },
          {
            text: formatMoney(Math.round(data.totalLiabilitiesAndEquity * 100)),
            style: 'grandTotalAmount',
            width: 100,
            alignment: 'right',
          },
        ],
        margin: [0, 0, 0, 20],
      },

      // Balance verification
      data.isBalanced
        ? {
            text: '✓ Balance Sheet is balanced',
            style: 'balanceVerification',
            alignment: 'center',
            color: '#059669',
          }
        : {
            text: `⚠ Balance Sheet difference: ${formatMoney(Math.round(Math.abs(data.balanceDifference) * 100))}`,
            style: 'balanceWarning',
            alignment: 'center',
            color: '#dc2626',
          },

      // Footer
      {
        text: `Generated on ${formatDate(data.generatedAt)}`,
        style: 'footer',
        alignment: 'center',
        margin: [0, 20, 0, 0],
      },
    ],
    styles: {
      companyName: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 5],
      },
      reportTitle: {
        fontSize: 16,
        bold: true,
      },
      reportDate: {
        fontSize: 12,
        italics: true,
        color: '#6b7280',
      },
      sectionHeader: {
        fontSize: 12,
        bold: true,
        color: '#1f2937',
      },
      accountName: {
        fontSize: 10,
      },
      subAccountName: {
        fontSize: 10,
        color: '#4b5563',
      },
      accountAmount: {
        fontSize: 10,
        alignment: 'right',
      },
      totalLabel: {
        fontSize: 11,
        bold: true,
      },
      totalAmount: {
        fontSize: 11,
        bold: true,
      },
      grandTotalLabel: {
        fontSize: 12,
        bold: true,
      },
      grandTotalAmount: {
        fontSize: 12,
        bold: true,
      },
      balanceVerification: {
        fontSize: 10,
        italics: true,
      },
      balanceWarning: {
        fontSize: 10,
        italics: true,
      },
      footer: {
        fontSize: 9,
        color: '#9ca3af',
        italics: true,
      },
    },
    defaultStyle: {
      font: 'Roboto',
    },
  }

  return new Promise((resolve, reject) => {
    try {
      const pdfDocGenerator = pdfMake.createPdf(docDefinition)
      pdfDocGenerator.getBlob((blob) => {
        resolve(blob)
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Build table rows for a balance sheet section
 */
function buildSectionTable(lines: Array<{
  accountName: string
  accountNumber?: string
  balance: number
  level: number
}>): Content[] {
  if (lines.length === 0) {
    return [
      {
        text: 'No accounts in this section',
        style: 'accountName',
        italics: true,
        color: '#9ca3af',
        margin: [10, 5, 0, 5],
      },
    ]
  }

  return lines.map((line) => {
    const indent = line.level * 15
    const displayName = line.accountNumber
      ? `${line.accountNumber} - ${line.accountName}`
      : line.accountName

    return {
      columns: [
        {
          text: displayName,
          style: line.level > 0 ? 'subAccountName' : 'accountName',
          width: '*',
          margin: [indent, 0, 0, 0],
        },
        {
          text: formatMoney(Math.round(line.balance * 100)),
          style: 'accountAmount',
          width: 100,
        },
      ],
      margin: [0, 2, 0, 2],
    }
  })
}

/**
 * Download a blob as a file
 */
export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate and download Balance Sheet PDF
 */
export async function exportBalanceSheetPDF(
  data: BalanceSheetData,
  companyName?: string
): Promise<void> {
  const blob = await generateBalanceSheetPDF(data, companyName)
  const filename = `balance-sheet-${formatDate(data.asOfDate).replace(/\s/g, '-').toLowerCase()}.pdf`
  downloadPDF(blob, filename)
}

// =============================================================================
// Profit & Loss PDF Export
// =============================================================================

/**
 * Format currency with optional parentheses for negatives
 */
function formatCurrencyPL(amount: number, showParens: boolean = true): string {
  const absAmount = Math.abs(amount)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(absAmount)

  if (amount < 0 && showParens) {
    return `(${formatted})`
  }

  return amount < 0 ? `-${formatted}` : formatted
}

/**
 * Format percentage for display
 */
function formatPercentage(percentage: number): string {
  const sign = percentage > 0 ? '+' : ''
  return `${sign}${percentage.toFixed(1)}%`
}

/**
 * Generate table rows for a P&L section
 */
function generatePLSectionRows(
  section: PLSection,
  includeComparison: boolean,
  includeEducational: boolean
): any[] {
  const rows: any[] = []

  // Section header
  rows.push([
    {
      text: section.title,
      style: 'sectionHeader',
      colSpan: includeComparison ? 4 : 2,
    },
    {},
    ...(includeComparison ? [{}, {}] : []),
  ])

  // Educational content
  if (includeEducational && section.educationalContent) {
    rows.push([
      {
        text: section.educationalContent,
        style: 'educational',
        colSpan: includeComparison ? 4 : 2,
        margin: [0, 0, 0, 10],
      },
      {},
      ...(includeComparison ? [{}, {}] : []),
    ])
  }

  // Line items
  for (const line of section.lineItems) {
    const row: any[] = [
      {
        text: line.accountNumber
          ? `${line.accountNumber} - ${line.accountName}`
          : line.accountName,
        margin: [10, 0, 0, 0],
      },
      { text: formatCurrencyPL(line.amount), alignment: 'right' },
    ]

    if (includeComparison && line.comparisonAmount !== undefined) {
      row.push(
        { text: formatCurrencyPL(line.comparisonAmount), alignment: 'right' },
        {
          text:
            line.variancePercentage !== undefined && line.variancePercentage !== null
              ? formatPercentage(line.variancePercentage)
              : '-',
          alignment: 'right',
          color: line.variance && line.variance > 0 ? '#059669' : '#dc2626',
        }
      )
    }

    rows.push(row)
  }

  // Subtotal
  const subtotalRow: any[] = [
    { text: `Total ${section.title}`, style: 'subtotal' },
    {
      text: formatCurrencyPL(section.subtotal),
      style: 'subtotal',
      alignment: 'right',
    },
  ]

  if (includeComparison && section.comparisonSubtotal !== undefined) {
    subtotalRow.push(
      {
        text: formatCurrencyPL(section.comparisonSubtotal),
        style: 'subtotal',
        alignment: 'right',
      },
      {
        text:
          section.variancePercentage !== undefined
            ? formatPercentage(section.variancePercentage)
            : '-',
        style: 'subtotal',
        alignment: 'right',
      }
    )
  }

  rows.push(subtotalRow)

  return rows
}

/**
 * Export Profit & Loss Report to PDF
 */
export async function exportProfitLossToPDF(
  report: ProfitLossReport,
  options: PDFExportOptions = {}
): Promise<ExportResult> {
  try {
    const {
      includeEducationalContent = false,
      includeComparison = !!report.comparisonPeriod,
      pageSize = 'letter',
      orientation = 'portrait',
      title = 'Profit & Loss Statement',
    } = options

    const hasComparison = includeComparison && !!report.comparisonPeriod

    // Document definition
    const docDefinition: TDocumentDefinitions = {
      pageSize: pageSize.toUpperCase() as any,
      pageOrientation: orientation,
      pageMargins: [40, 60, 40, 60],
      info: {
        title: `${title} - ${report.companyName}`,
        author: 'Graceful Books',
        subject: 'Profit & Loss Report',
        creator: 'Graceful Books',
      },

      content: [
        // Header
        {
          text: report.companyName,
          style: 'companyName',
          margin: [0, 0, 0, 5],
          alignment: 'center',
        },
        {
          text: title,
          style: 'reportTitle',
          margin: [0, 0, 0, 5],
          alignment: 'center',
        },
        {
          text: formatDateRange(report.dateRange),
          style: 'dateRange',
          margin: [0, 0, 0, 5],
          alignment: 'center',
        },
        {
          text: `Accounting Method: ${report.accountingMethod === 'accrual' ? 'Accrual' : 'Cash'}`,
          style: 'metadata',
          margin: [0, 0, 0, 20],
          alignment: 'center',
        },

        // Main table
        {
          table: {
            headerRows: 1,
            widths: hasComparison ? ['*', 'auto', 'auto', 'auto'] : ['*', 'auto'],
            body: [
              // Table header
              [
                { text: 'Account', style: 'tableHeader' },
                { text: 'Amount', style: 'tableHeader', alignment: 'right' },
                ...(hasComparison
                  ? [
                      {
                        text: report.comparisonPeriod?.label || 'Comparison',
                        style: 'tableHeader',
                        alignment: 'right',
                      },
                      { text: 'Change', style: 'tableHeader', alignment: 'right' },
                    ]
                  : []),
              ],

              // Revenue section
              ...generatePLSectionRows(report.revenue, hasComparison, includeEducationalContent),

              // COGS section
              ...generatePLSectionRows(
                report.costOfGoodsSold,
                hasComparison,
                includeEducationalContent
              ),

              // Gross Profit
              [
                { text: 'Gross Profit', style: 'grossProfit', bold: true },
                {
                  text: formatCurrencyPL(report.grossProfit.amount),
                  style: 'grossProfit',
                  alignment: 'right',
                  bold: true,
                },
                ...(hasComparison && report.grossProfit.comparisonAmount !== undefined
                  ? [
                      {
                        text: formatCurrencyPL(report.grossProfit.comparisonAmount),
                        style: 'grossProfit',
                        alignment: 'right',
                        bold: true,
                      },
                      {
                        text:
                          report.grossProfit.variancePercentage !== undefined
                            ? formatPercentage(report.grossProfit.variancePercentage)
                            : '-',
                        style: 'grossProfit',
                        alignment: 'right',
                        bold: true,
                      },
                    ]
                  : []),
              ],

              // Operating Expenses section
              ...generatePLSectionRows(
                report.operatingExpenses,
                hasComparison,
                includeEducationalContent
              ),

              // Operating Income
              [
                { text: 'Operating Income', style: 'operatingIncome', bold: true },
                {
                  text: formatCurrencyPL(report.operatingIncome.amount),
                  style: 'operatingIncome',
                  alignment: 'right',
                  bold: true,
                },
                ...(hasComparison && report.operatingIncome.comparisonAmount !== undefined
                  ? [
                      {
                        text: formatCurrencyPL(report.operatingIncome.comparisonAmount),
                        style: 'operatingIncome',
                        alignment: 'right',
                        bold: true,
                      },
                      {
                        text:
                          report.operatingIncome.variancePercentage !== undefined
                            ? formatPercentage(report.operatingIncome.variancePercentage)
                            : '-',
                        style: 'operatingIncome',
                        alignment: 'right',
                        bold: true,
                      },
                    ]
                  : []),
              ],

              // Other Income (if present)
              ...(report.otherIncome
                ? generatePLSectionRows(report.otherIncome, hasComparison, includeEducationalContent)
                : []),

              // Other Expenses (if present)
              ...(report.otherExpenses
                ? generatePLSectionRows(
                    report.otherExpenses,
                    hasComparison,
                    includeEducationalContent
                  )
                : []),

              // Net Income
              [
                { text: 'Net Income', style: 'netIncome', bold: true },
                {
                  text: formatCurrencyPL(report.netIncome.amount),
                  style: 'netIncome',
                  alignment: 'right',
                  bold: true,
                  color: report.netIncome.isProfitable ? '#059669' : '#dc2626',
                },
                ...(hasComparison && report.netIncome.comparisonAmount !== undefined
                  ? [
                      {
                        text: formatCurrencyPL(report.netIncome.comparisonAmount),
                        style: 'netIncome',
                        alignment: 'right',
                        bold: true,
                      },
                      {
                        text:
                          report.netIncome.variancePercentage !== undefined
                            ? formatPercentage(report.netIncome.variancePercentage)
                            : '-',
                        style: 'netIncome',
                        alignment: 'right',
                        bold: true,
                        color:
                          report.netIncome.variance && report.netIncome.variance > 0
                            ? '#059669'
                            : '#dc2626',
                      },
                    ]
                  : []),
              ],
            ],
          },
          layout: {
            hLineWidth: function (i: number, node: any) {
              return i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5
            },
            vLineWidth: function () {
              return 0
            },
            hLineColor: function (i: number) {
              return i === 0 || i === 1 ? '#000000' : '#e5e7eb'
            },
            paddingLeft: function () {
              return 8
            },
            paddingRight: function () {
              return 8
            },
            paddingTop: function () {
              return 6
            },
            paddingBottom: function () {
              return 6
            },
          },
        },

        // Footer note
        {
          text: `Generated on ${format(report.generatedAt, 'MMMM d, yyyy')} at ${format(report.generatedAt, 'h:mm a')}`,
          style: 'footer',
          margin: [0, 20, 0, 0],
          alignment: 'center',
        },

        // Profitability message
        ...(includeEducationalContent
          ? [
              {
                text: report.netIncome.isProfitable
                  ? 'You made money this period! Great work.'
                  : 'This period showed a loss. Review your expenses and revenue to identify opportunities for improvement.',
                style: report.netIncome.isProfitable ? 'profitable' : 'loss',
                margin: [0, 10, 0, 0],
                alignment: 'center',
              },
            ]
          : []),
      ],

      // Styles
      styles: {
        companyName: {
          fontSize: 18,
          bold: true,
        },
        reportTitle: {
          fontSize: 14,
          bold: true,
        },
        dateRange: {
          fontSize: 11,
          color: '#6b7280',
        },
        metadata: {
          fontSize: 9,
          color: '#6b7280',
        },
        tableHeader: {
          fontSize: 10,
          bold: true,
          fillColor: '#f3f4f6',
        },
        sectionHeader: {
          fontSize: 11,
          bold: true,
          margin: [0, 10, 0, 5],
        },
        educational: {
          fontSize: 9,
          color: '#6b7280',
          italics: true,
        },
        subtotal: {
          fontSize: 10,
          bold: true,
          margin: [0, 5, 0, 5],
        },
        grossProfit: {
          fontSize: 11,
          margin: [0, 8, 0, 8],
          fillColor: '#f9fafb',
        },
        operatingIncome: {
          fontSize: 11,
          margin: [0, 8, 0, 8],
          fillColor: '#f9fafb',
        },
        netIncome: {
          fontSize: 12,
          margin: [0, 10, 0, 10],
          fillColor: '#f3f4f6',
        },
        footer: {
          fontSize: 8,
          color: '#9ca3af',
        },
        profitable: {
          fontSize: 10,
          color: '#059669',
          bold: true,
        },
        loss: {
          fontSize: 10,
          color: '#6b7280',
        },
      },

      defaultStyle: {
        fontSize: 10,
      },
    }

    // Generate PDF
    const pdfDocGenerator = pdfMake.createPdf(docDefinition)

    // Return as promise with blob
    return new Promise<ExportResult>((resolve) => {
      pdfDocGenerator.getBlob((blob: Blob) => {
        const filename = `P&L_${report.companyName.replace(/\s+/g, '_')}_${format(report.dateRange.startDate, 'yyyy-MM-dd')}_to_${format(report.dateRange.endDate, 'yyyy-MM-dd')}.pdf`

        resolve({
          success: true,
          format: 'pdf',
          blob,
          filename,
        })
      })
    })
  } catch (error) {
    return {
      success: false,
      format: 'pdf',
      error: error instanceof Error ? error.message : 'Failed to generate PDF',
    }
  }
}

/**
 * Generate and download P&L PDF
 */
export async function exportProfitLossPDF(
  report: ProfitLossReport,
  options: PDFExportOptions = {}
): Promise<void> {
  const result = await exportProfitLossToPDF(report, options)
  if (result.success && result.blob && result.filename) {
    downloadPDF(result.blob, result.filename)
  } else {
    throw new Error(result.error || 'Failed to generate PDF')
  }
}
