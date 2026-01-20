/**
 * PDF Export Service Tests
 *
 * Tests for PDF generation of financial reports.
 * Validates PDF creation, formatting, and download functionality.
 *
 * Per D6: Basic Reports - P&L [MVP] - Export to PDF requirement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  exportProfitLossToPDF,
  exportProfitLossPDF,
  generateBalanceSheetPDF,
  downloadPDF,
} from './pdfExport'
import type { ProfitLossReport, BalanceSheetData, PDFExportOptions } from '../../types/reports.types'

// Mock pdfmake
vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    createPdf: vi.fn(),
    vfs: {},
  },
}))

vi.mock('pdfmake/build/vfs_fonts', () => ({
  default: {
    pdfMake: {
      vfs: {},
    },
  },
}))

describe('PDF Export Service', () => {
  const mockCompanyId = 'test-company-123'

  const createMockPLReport = (overrides?: Partial<ProfitLossReport>): ProfitLossReport => ({
    companyId: mockCompanyId,
    companyName: 'Test Company',
    dateRange: {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    },
    accountingMethod: 'accrual',
    generatedAt: new Date('2024-01-31T12:00:00Z'),
    revenue: {
      type: 'revenue',
      title: 'Revenue',
      description: 'Income from sales',
      lineItems: [
        {
          accountId: 'acc-1',
          accountNumber: '4000',
          accountName: 'Sales Revenue',
          amount: 10000,
        },
      ],
      subtotal: 10000,
    },
    costOfGoodsSold: {
      type: 'cogs',
      title: 'Cost of Goods Sold',
      description: 'Direct costs',
      lineItems: [],
      subtotal: 0,
    },
    grossProfit: {
      amount: 10000,
      percentage: 100,
    },
    operatingExpenses: {
      type: 'expenses',
      title: 'Operating Expenses',
      description: 'Business expenses',
      lineItems: [
        {
          accountId: 'acc-2',
          accountNumber: '6000',
          accountName: 'Rent Expense',
          amount: 2000,
        },
      ],
      subtotal: 2000,
    },
    operatingIncome: {
      amount: 8000,
      percentage: 80,
    },
    netIncome: {
      amount: 8000,
      percentage: 80,
      isProfitable: true,
    },
    ...overrides,
  })

  const createMockBalanceSheet = (): BalanceSheetData => ({
    companyId: mockCompanyId,
    asOfDate: new Date('2024-01-31'),
    generatedAt: new Date('2024-01-31T12:00:00Z'),
    assets: {
      title: 'Assets',
      plainEnglishTitle: 'What You Own',
      description: 'Things of value owned by the business',
      lines: [
        {
          accountId: 'acc-1',
          accountName: 'Cash',
          accountNumber: '1000',
          balance: 50000,
          isSubAccount: false,
          level: 0,
        },
      ],
      total: 50000,
    },
    liabilities: {
      title: 'Liabilities',
      plainEnglishTitle: 'What You Owe',
      description: 'Debts and obligations',
      lines: [
        {
          accountId: 'acc-2',
          accountName: 'Accounts Payable',
          accountNumber: '2000',
          balance: 10000,
          isSubAccount: false,
          level: 0,
        },
      ],
      total: 10000,
    },
    equity: {
      title: 'Equity',
      plainEnglishTitle: 'Your Ownership',
      description: 'Owner equity',
      lines: [
        {
          accountId: 'acc-3',
          accountName: 'Owner Equity',
          accountNumber: '3000',
          balance: 40000,
          isSubAccount: false,
          level: 0,
        },
      ],
      total: 40000,
    },
    totalAssets: 50000,
    totalLiabilitiesAndEquity: 50000,
    isBalanced: true,
    balanceDifference: 0,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Profit & Loss PDF Export', () => {
    it('should generate PDF for P&L report', async () => {
      const report = createMockPLReport()
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      const result = await exportProfitLossToPDF(report)

      expect(result.success).toBe(true)
      expect(result.format).toBe('pdf')
      expect(result.blob).toBe(mockBlob)
      expect(result.filename).toContain('P&L')
      expect(result.filename).toContain('Test_Company')
      expect(pdfMake.default.createPdf).toHaveBeenCalled()
    })

    it('should include company name in PDF', async () => {
      const report = createMockPLReport({ companyName: 'Acme Corp' })
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      await exportProfitLossToPDF(report)

      const callArgs = vi.mocked(pdfMake.default.createPdf).mock.calls[0][0]
      expect(callArgs.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'Acme Corp',
          }),
        ])
      )
    })

    it('should include date range in PDF', async () => {
      const report = createMockPLReport()
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      await exportProfitLossToPDF(report)

      expect(pdfMake.default.createPdf).toHaveBeenCalled()
      const callArgs = vi.mocked(pdfMake.default.createPdf).mock.calls[0][0]
      expect(callArgs.content).toBeDefined()
    })

    it('should include educational content when option enabled', async () => {
      const report = createMockPLReport({
        revenue: {
          ...createMockPLReport().revenue,
          educationalContent: 'Revenue is money you earned',
        },
      })
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      const options: PDFExportOptions = {
        includeEducationalContent: true,
      }

      await exportProfitLossToPDF(report, options)

      expect(pdfMake.default.createPdf).toHaveBeenCalled()
    })

    it('should exclude educational content when option disabled', async () => {
      const report = createMockPLReport({
        revenue: {
          ...createMockPLReport().revenue,
          educationalContent: 'Revenue is money you earned',
        },
      })
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      const options: PDFExportOptions = {
        includeEducationalContent: false,
      }

      await exportProfitLossToPDF(report, options)

      expect(pdfMake.default.createPdf).toHaveBeenCalled()
    })

    it('should include comparison data when available', async () => {
      const report = createMockPLReport({
        comparisonPeriod: {
          enabled: true,
          type: 'previous-period',
          startDate: new Date('2023-12-01'),
          endDate: new Date('2023-12-31'),
          label: 'Previous Month',
        },
        revenue: {
          ...createMockPLReport().revenue,
          comparisonSubtotal: 8000,
          variance: 2000,
          variancePercentage: 25,
        },
      })
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      const options: PDFExportOptions = {
        includeComparison: true,
      }

      await exportProfitLossToPDF(report, options)

      expect(pdfMake.default.createPdf).toHaveBeenCalled()
      const callArgs = vi.mocked(pdfMake.default.createPdf).mock.calls[0][0]
      expect(callArgs.content).toBeDefined()
    })

    it('should show profitable message for positive net income', async () => {
      const report = createMockPLReport({
        netIncome: {
          amount: 5000,
          percentage: 50,
          isProfitable: true,
        },
      })
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      const options: PDFExportOptions = {
        includeEducationalContent: true,
      }

      await exportProfitLossToPDF(report, options)

      const callArgs = vi.mocked(pdfMake.default.createPdf).mock.calls[0][0]
      const content = JSON.stringify(callArgs.content)
      expect(content).toContain('made money')
    })

    it('should show loss message for negative net income', async () => {
      const report = createMockPLReport({
        netIncome: {
          amount: -2000,
          percentage: -20,
          isProfitable: false,
        },
      })
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      const options: PDFExportOptions = {
        includeEducationalContent: true,
      }

      await exportProfitLossToPDF(report, options)

      const callArgs = vi.mocked(pdfMake.default.createPdf).mock.calls[0][0]
      const content = JSON.stringify(callArgs.content)
      expect(content).toContain('loss')
    })

    it('should support landscape orientation', async () => {
      const report = createMockPLReport()
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      const options: PDFExportOptions = {
        orientation: 'landscape',
      }

      await exportProfitLossToPDF(report, options)

      const callArgs = vi.mocked(pdfMake.default.createPdf).mock.calls[0][0]
      expect(callArgs.pageOrientation).toBe('landscape')
    })

    it('should support portrait orientation (default)', async () => {
      const report = createMockPLReport()
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      await exportProfitLossToPDF(report)

      const callArgs = vi.mocked(pdfMake.default.createPdf).mock.calls[0][0]
      expect(callArgs.pageOrientation).toBe('portrait')
    })

    it('should support A4 and letter page sizes', async () => {
      const report = createMockPLReport()
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      // Test A4
      await exportProfitLossToPDF(report, { pageSize: 'a4' })
      let callArgs = vi.mocked(pdfMake.default.createPdf).mock.calls[0][0]
      expect(callArgs.pageSize).toBe('A4')

      vi.clearAllMocks()

      // Test letter (default)
      await exportProfitLossToPDF(report, { pageSize: 'letter' })
      callArgs = vi.mocked(pdfMake.default.createPdf).mock.calls[0][0]
      expect(callArgs.pageSize).toBe('LETTER')
    })

    it('should handle PDF generation errors', async () => {
      const report = createMockPLReport()

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockImplementation(() => {
        throw new Error('PDF generation failed')
      })

      const result = await exportProfitLossToPDF(report)

      expect(result.success).toBe(false)
      expect((result as any).error).toBe('PDF generation failed')
    })

    it('should include other income section when present', async () => {
      const report = createMockPLReport({
        otherIncome: {
          type: 'other-income',
          title: 'Other Income',
          description: 'Non-operating income',
          lineItems: [
            {
              accountId: 'acc-3',
              accountName: 'Interest Income',
              amount: 500,
            },
          ],
          subtotal: 500,
        },
      })
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      await exportProfitLossToPDF(report)

      expect(pdfMake.default.createPdf).toHaveBeenCalled()
    })

    it('should include other expenses section when present', async () => {
      const report = createMockPLReport({
        otherExpenses: {
          type: 'other-expenses',
          title: 'Other Expenses',
          description: 'Non-operating expenses',
          lineItems: [
            {
              accountId: 'acc-4',
              accountName: 'Interest Expense',
              amount: 300,
            },
          ],
          subtotal: 300,
        },
      })
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      await exportProfitLossToPDF(report)

      expect(pdfMake.default.createPdf).toHaveBeenCalled()
    })
  })

  describe('Balance Sheet PDF Export', () => {
    it('should generate PDF for balance sheet', async () => {
      const balanceSheet = createMockBalanceSheet()
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      const blob = await generateBalanceSheetPDF(balanceSheet, 'Test Company')

      expect(blob).toBe(mockBlob)
      expect(pdfMake.default.createPdf).toHaveBeenCalled()
    })

    it('should show balanced indicator when balance sheet is balanced', async () => {
      const balanceSheet = createMockBalanceSheet()
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      await generateBalanceSheetPDF(balanceSheet, 'Test Company')

      const callArgs = vi.mocked(pdfMake.default.createPdf).mock.calls[0][0]
      const content = JSON.stringify(callArgs.content)
      expect(content).toContain('balanced')
    })

    it('should show warning when balance sheet is not balanced', async () => {
      const balanceSheet = createMockBalanceSheet()
      balanceSheet.isBalanced = false
      balanceSheet.balanceDifference = 100

      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      await generateBalanceSheetPDF(balanceSheet, 'Test Company')

      const callArgs = vi.mocked(pdfMake.default.createPdf).mock.calls[0][0]
      const content = JSON.stringify(callArgs.content)
      expect(content).toContain('difference')
    })
  })

  describe('PDF Download', () => {
    it('should trigger download of PDF blob', () => {
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      }

      // Add createObjectURL and revokeObjectURL to global URL if they don't exist
      if (!URL.createObjectURL) {
        (URL as any).createObjectURL = vi.fn()
      }
      if (!URL.revokeObjectURL) {
        (URL as any).revokeObjectURL = vi.fn()
      }

      // Mock DOM methods
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any)
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any)
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

      downloadPDF(mockBlob, 'test-report.pdf')

      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(mockLink.download).toBe('test-report.pdf')
      expect(mockLink.click).toHaveBeenCalled()
      expect(appendChildSpy).toHaveBeenCalled()
      expect(removeChildSpy).toHaveBeenCalled()
      expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob)
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')

      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
      createObjectURLSpy.mockRestore()
      revokeObjectURLSpy.mockRestore()
    })
  })

  describe('Export and Download', () => {
    it('should export and trigger download', async () => {
      const report = createMockPLReport()
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      }

      // Add createObjectURL and revokeObjectURL to global URL if they don't exist
      if (!URL.createObjectURL) {
        (URL as any).createObjectURL = vi.fn()
      }
      if (!URL.revokeObjectURL) {
        (URL as any).revokeObjectURL = vi.fn()
      }

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any)
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any)
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

      await exportProfitLossPDF(report)

      expect(mockLink.click).toHaveBeenCalled()

      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    it('should throw error on export failure', async () => {
      const report = createMockPLReport()

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockImplementation(() => {
        throw new Error('Export failed')
      })

      await expect(exportProfitLossPDF(report)).rejects.toThrow('Export failed')
    })
  })

  describe('Formatting', () => {
    it('should format currency amounts correctly', async () => {
      const report = createMockPLReport({
        revenue: {
          ...createMockPLReport().revenue,
          lineItems: [
            {
              accountId: 'acc-1',
              accountName: 'Sales',
              amount: 12345.67,
            },
          ],
          subtotal: 12345.67,
        },
      })
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      await exportProfitLossToPDF(report)

      expect(pdfMake.default.createPdf).toHaveBeenCalled()
    })

    it('should format negative amounts with parentheses', async () => {
      const report = createMockPLReport({
        netIncome: {
          amount: -5000,
          percentage: -50,
          isProfitable: false,
        },
      })
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })

      const mockPdfDoc = {
        getBlob: vi.fn((callback) => callback(mockBlob)),
      }

      const pdfMake = await import('pdfmake/build/pdfmake')
      vi.mocked(pdfMake.default.createPdf).mockReturnValue(mockPdfDoc as any)

      await exportProfitLossToPDF(report)

      expect(pdfMake.default.createPdf).toHaveBeenCalled()
    })
  })
})
