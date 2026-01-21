/**
 * A/R Aging Report Service Tests
 *
 * Comprehensive test coverage for A/R aging calculations.
 * Target: >80% coverage as per F5 requirements
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateARAgingReport, exportARAgingToCSV, getCustomerInvoiceDetails } from './arAgingReport.service'
import type { ARAgingReportOptions, ARAgingReport } from '../../types/reports.types'
import type { Invoice, Contact } from '../../types'
import { db } from '../../db/database'

// Mock database
vi.mock('../../db/database', () => ({
  db: {
    invoices: {
      where: vi.fn(),
    },
    contacts: {
      where: vi.fn(),
    },
    companies: {
      get: vi.fn(),
    },
  },
}))

describe('A/R Aging Report Service', () => {
  const mockCompanyId = 'company-123'
  const mockAsOfDate = new Date('2026-01-17')

  const mockInvoices: Partial<Invoice>[] = [
    {
      id: 'inv-1',
      company_id: mockCompanyId,
      customer_id: 'cust-1',
      invoice_number: 'INV-001',
      invoice_date: new Date('2025-12-01').getTime(),
      due_date: new Date('2025-12-31').getTime(), // 17 days overdue
      status: 'sent',
      total: '1000.00',
      subtotal: '1000.00',
      deleted_at: null,
    },
    {
      id: 'inv-2',
      company_id: mockCompanyId,
      customer_id: 'cust-1',
      invoice_number: 'INV-002',
      invoice_date: new Date('2026-01-01').getTime(),
      due_date: new Date('2026-01-31').getTime(), // Not yet due (current)
      status: 'sent',
      total: '500.00',
      subtotal: '500.00',
      deleted_at: null,
    },
    {
      id: 'inv-3',
      company_id: mockCompanyId,
      customer_id: 'cust-2',
      invoice_number: 'INV-003',
      invoice_date: new Date('2025-10-01').getTime(),
      due_date: new Date('2025-10-31').getTime(), // 78 days overdue (61-90)
      status: 'overdue',
      total: '2000.00',
      subtotal: '2000.00',
      deleted_at: null,
    },
    {
      id: 'inv-4',
      company_id: mockCompanyId,
      customer_id: 'cust-3',
      invoice_number: 'INV-004',
      invoice_date: new Date('2025-09-01').getTime(),
      due_date: new Date('2025-09-30').getTime(), // 109 days overdue (90+)
      status: 'overdue',
      total: '3000.00',
      subtotal: '3000.00',
      deleted_at: null,
    },
    {
      id: 'inv-5',
      company_id: mockCompanyId,
      customer_id: 'cust-1',
      invoice_number: 'INV-005',
      invoice_date: new Date('2025-12-15').getTime(),
      due_date: new Date('2025-12-25').getTime(), // 23 days overdue (1-30)
      status: 'sent',
      total: '750.00',
      subtotal: '750.00',
      deleted_at: null,
    },
    {
      id: 'inv-6',
      company_id: mockCompanyId,
      customer_id: 'cust-4',
      invoice_number: 'INV-006',
      invoice_date: new Date('2026-01-10').getTime(),
      due_date: new Date('2026-02-10').getTime(), // Current (not due)
      status: 'sent',
      total: '1250.00',
      subtotal: '1250.00',
      deleted_at: null,
    },
  ]

  const mockContacts: Partial<Contact>[] = [
    {
      id: 'cust-1',
      companyId: mockCompanyId,
      name: 'Customer One',
      type: 'customer',
      isActive: true,
    },
    {
      id: 'cust-2',
      companyId: mockCompanyId,
      name: 'Customer Two',
      type: 'customer',
      isActive: true,
    },
    {
      id: 'cust-3',
      companyId: mockCompanyId,
      name: 'Customer Three',
      type: 'customer',
      isActive: true,
    },
    {
      id: 'cust-4',
      companyId: mockCompanyId,
      name: 'Customer Four',
      type: 'customer',
      isActive: true,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock invoice queries
    const mockInvoiceQuery = {
      equals: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue(mockInvoices),
    }

    // Mock contact queries
    const mockContactQuery = {
      anyOf: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue(mockContacts),
    }

    // Setup db mocks
    ;(db.invoices.where as any).mockReturnValue(mockInvoiceQuery)
    ;(db.contacts.where as any).mockReturnValue(mockContactQuery)
    ;(db.companies.get as any).mockResolvedValue({ id: mockCompanyId, name: 'Test Company' })
  })

  describe('generateARAgingReport', () => {
    it('should generate a complete A/R aging report', async () => {
      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
      }

      const report = await generateARAgingReport(options)

      expect(report).toBeDefined()
      expect(report.companyId).toBe(mockCompanyId)
      expect(report.companyName).toBe('Test Company')
      expect(report.asOfDate).toEqual(mockAsOfDate)
      expect(report.totalInvoiceCount).toBe(6)
    })

    it('should correctly categorize invoices into aging buckets', async () => {
      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
      }

      const report = await generateARAgingReport(options)

      // Current bucket: INV-002, INV-006 (not yet due)
      expect(report.bucketSummary.current.invoiceCount).toBe(2)
      expect(report.bucketSummary.current.amount).toBeCloseTo(1750, 2) // 500 + 1250

      // 1-30 days bucket: INV-001 (17 days), INV-005 (23 days)
      expect(report.bucketSummary.days1to30.invoiceCount).toBe(2)
      expect(report.bucketSummary.days1to30.amount).toBeCloseTo(1750, 2) // 1000 + 750

      // 31-60 days bucket: none
      expect(report.bucketSummary.days31to60.invoiceCount).toBe(0)
      expect(report.bucketSummary.days31to60.amount).toBe(0)

      // 61-90 days bucket: INV-003 (78 days)
      expect(report.bucketSummary.days61to90.invoiceCount).toBe(1)
      expect(report.bucketSummary.days61to90.amount).toBeCloseTo(2000, 2)

      // 90+ days bucket: INV-004 (109 days)
      expect(report.bucketSummary.days90plus.invoiceCount).toBe(1)
      expect(report.bucketSummary.days90plus.amount).toBeCloseTo(3000, 2)
    })

    it('should calculate total outstanding correctly', async () => {
      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
      }

      const report = await generateARAgingReport(options)

      // Total: 1000 + 500 + 2000 + 3000 + 750 + 1250 = 8500
      expect(report.totalOutstanding).toBeCloseTo(8500, 2)
    })

    it('should calculate total overdue correctly', async () => {
      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
      }

      const report = await generateARAgingReport(options)

      // Overdue: INV-001 (1000) + INV-003 (2000) + INV-004 (3000) + INV-005 (750) = 6750
      expect(report.totalOverdue).toBeCloseTo(6750, 2)
      expect(report.overdueInvoiceCount).toBe(4)
    })

    it('should group invoices by customer correctly', async () => {
      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
      }

      const report = await generateARAgingReport(options)

      expect(report.customerAging).toHaveLength(4)

      // Customer One: INV-001 (1000), INV-002 (500), INV-005 (750)
      const customer1 = report.customerAging.find((c) => c.customerId === 'cust-1')
      expect(customer1).toBeDefined()
      expect(customer1!.totalOutstanding).toBeCloseTo(2250, 2)
      expect(customer1!.invoiceCount).toBe(3)
      expect(customer1!.hasOverdueInvoices).toBe(true)
    })

    it('should sort customers by name in ascending order by default', async () => {
      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
        sortBy: 'customer',
        sortOrder: 'asc',
      }

      const report = await generateARAgingReport(options)

      const customerNames = report.customerAging.map((c) => c.customerName)
      expect(customerNames).toEqual([
        'Customer Four',
        'Customer One',
        'Customer Three',
        'Customer Two',
      ])
    })

    it('should sort customers by amount in descending order', async () => {
      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
        sortBy: 'amount',
        sortOrder: 'desc',
      }

      const report = await generateARAgingReport(options)

      // Customer Three: 3000, Customer One: 2250, Customer Two: 2000, Customer Four: 1250
      const amounts = report.customerAging.map((c) => c.totalOutstanding)
      expect(amounts[0]!).toBeGreaterThan(amounts[1]!)
      expect(amounts[1]!).toBeGreaterThan(amounts[2]!)
    })

    it('should generate follow-up recommendations for overdue invoices', async () => {
      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
      }

      const report = await generateARAgingReport(options)

      // Should have recommendations for customers with overdue invoices
      expect(report.followUpRecommendations.length).toBeGreaterThan(0)

      // Customer Three (90+ days overdue) should have high urgency
      const cust3Rec = report.followUpRecommendations.find((r) => r.customerId === 'cust-3')
      expect(cust3Rec).toBeDefined()
      expect(cust3Rec!.urgencyLevel).toBe('high')
      expect(cust3Rec!.suggestedTemplate).toBe('urgent-follow-up')
    })

    it('should generate health message for healthy A/R', async () => {
      // Create a scenario with mostly current invoices
      const healthyInvoices: Partial<Invoice>[] = [
        {
          id: 'inv-h1',
          company_id: mockCompanyId,
          customer_id: 'cust-1',
          invoice_number: 'INV-H1',
          invoice_date: mockAsOfDate.getTime(),
          due_date: new Date(mockAsOfDate.getTime() + 30 * 24 * 60 * 60 * 1000).getTime(),
          status: 'sent',
          total: '5000.00',
          subtotal: '5000.00',
          deleted_at: null,
        },
        {
          id: 'inv-h2',
          company_id: mockCompanyId,
          customer_id: 'cust-2',
          invoice_number: 'INV-H2',
          invoice_date: mockAsOfDate.getTime(),
          due_date: new Date(mockAsOfDate.getTime() - 5 * 24 * 60 * 60 * 1000).getTime(),
          status: 'sent',
          total: '500.00',
          subtotal: '500.00',
          deleted_at: null,
        },
      ]

      const mockHealthyQuery = {
        equals: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(healthyInvoices),
      }

      ;(db.invoices.where as any).mockReturnValue(mockHealthyQuery)

      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
      }

      const report = await generateARAgingReport(options)

      expect(report.healthMessage).toBeDefined()
      expect(report.healthMessage).toContain('Great news')
    })

    it('should exclude voided invoices by default', async () => {
      const invoicesWithVoid: Partial<Invoice>[] = [
        ...mockInvoices,
        {
          id: 'inv-void',
          company_id: mockCompanyId,
          customer_id: 'cust-1',
          invoice_number: 'INV-VOID',
          invoice_date: mockAsOfDate.getTime(),
          due_date: mockAsOfDate.getTime(),
          status: 'void',
          total: '999.00',
          subtotal: '999.00',
          deleted_at: null,
        },
      ]

      const mockQueryWithVoid = {
        equals: vi.fn().mockReturnThis(),
        filter: vi.fn(function (this: any, fn: any) {
          this._filtered = invoicesWithVoid.filter(fn)
          return this
        }),
        toArray: vi.fn(function (this: any) {
          return Promise.resolve(this._filtered)
        }),
      }

      ;(db.invoices.where as any).mockReturnValue(mockQueryWithVoid)

      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
        includeVoidedInvoices: false,
      }

      const report = await generateARAgingReport(options)

      // Should not include voided invoice
      expect(report.totalInvoiceCount).toBe(6)
      expect(report.totalOutstanding).not.toContain(999)
    })

    it('should filter by specific customer when customerId is provided', async () => {
      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
        customerId: 'cust-1',
      }

      const mockFilteredQuery = {
        equals: vi.fn().mockReturnThis(),
        filter: vi.fn(function (this: any, fn: any) {
          this._filtered = mockInvoices.filter(fn)
          return this
        }),
        toArray: vi.fn(function (this: any) {
          return Promise.resolve(this._filtered)
        }),
      }

      ;(db.invoices.where as any).mockReturnValue(mockFilteredQuery)

      const report = await generateARAgingReport(options)

      // Should only have Customer One
      expect(report.customerAging).toHaveLength(1)
      expect(report.customerAging[0]!.customerId).toBe('cust-1')
    })

    it('should set urgency levels correctly based on days overdue and amount', async () => {
      const options: ARAgingReportOptions = {
        companyId: mockCompanyId,
        asOfDate: mockAsOfDate,
      }

      const report = await generateARAgingReport(options)

      // Customer Three: 90+ days overdue with $3000 = high urgency
      const cust3 = report.customerAging.find((c) => c.customerId === 'cust-3')
      expect(cust3!.urgencyLevel).toBe('high')

      // Customer Two: 61-90 days overdue = medium urgency
      const cust2 = report.customerAging.find((c) => c.customerId === 'cust-2')
      expect(cust2!.urgencyLevel).toBe('medium')

      // Customer One: 1-30 days overdue = medium urgency
      const cust1 = report.customerAging.find((c) => c.customerId === 'cust-1')
      expect(cust1!.urgencyLevel).toMatch(/medium|low/)
    })
  })

  describe('exportARAgingToCSV', () => {
    it('should export report to CSV format', async () => {
      const mockReport: ARAgingReport = {
        companyId: mockCompanyId,
        companyName: 'Test Company',
        asOfDate: mockAsOfDate,
        generatedAt: new Date(),
        totalOutstanding: 8500,
        totalInvoiceCount: 6,
        totalOverdue: 6750,
        overdueInvoiceCount: 4,
        bucketSummary: {
          current: {
            bucket: 'current',
            label: 'Current',
            friendlyLabel: 'Current',
            amount: 1750,
            invoiceCount: 2,
            invoices: [],
          },
          days1to30: {
            bucket: '1-30',
            label: '1-30 days',
            friendlyLabel: 'Getting older',
            amount: 1750,
            invoiceCount: 2,
            invoices: [],
          },
          days31to60: {
            bucket: '31-60',
            label: '31-60 days',
            friendlyLabel: 'Needs attention',
            amount: 0,
            invoiceCount: 0,
            invoices: [],
          },
          days61to90: {
            bucket: '61-90',
            label: '61-90 days',
            friendlyLabel: "Let's talk about this one",
            amount: 2000,
            invoiceCount: 1,
            invoices: [],
          },
          days90plus: {
            bucket: '90+',
            label: '90+ days',
            friendlyLabel: "Let's talk about this one",
            amount: 3000,
            invoiceCount: 1,
            invoices: [],
          },
        },
        customerAging: [
          {
            customerId: 'cust-1',
            customerName: 'Customer One',
            totalOutstanding: 2250,
            invoiceCount: 3,
            buckets: {
              current: 500,
              days1to30: 1750,
              days31to60: 0,
              days61to90: 0,
              days90plus: 0,
            },
            oldestInvoiceDate: null,
            oldestDueDate: null,
            hasOverdueInvoices: true,
            urgencyLevel: 'medium',
          },
        ],
        followUpRecommendations: [],
      }

      const csv = exportARAgingToCSV(mockReport)

      expect(csv).toContain('A/R Aging Report')
      expect(csv).toContain('Test Company')
      expect(csv).toContain('Total Outstanding,$8,500.00')
      expect(csv).toContain('Customer Breakdown')
      expect(csv).toContain('Customer One')
    })

    it('should include all aging buckets in CSV', async () => {
      const mockReport: ARAgingReport = {
        companyId: mockCompanyId,
        companyName: 'Test Company',
        asOfDate: mockAsOfDate,
        generatedAt: new Date(),
        totalOutstanding: 100,
        totalInvoiceCount: 1,
        totalOverdue: 0,
        overdueInvoiceCount: 0,
        bucketSummary: {
          current: {
            bucket: 'current',
            label: 'Current',
            friendlyLabel: 'Current',
            amount: 100,
            invoiceCount: 1,
            invoices: [],
          },
          days1to30: {
            bucket: '1-30',
            label: '1-30 days',
            friendlyLabel: 'Getting older',
            amount: 0,
            invoiceCount: 0,
            invoices: [],
          },
          days31to60: {
            bucket: '31-60',
            label: '31-60 days',
            friendlyLabel: 'Needs attention',
            amount: 0,
            invoiceCount: 0,
            invoices: [],
          },
          days61to90: {
            bucket: '61-90',
            label: '61-90 days',
            friendlyLabel: "Let's talk about this one",
            amount: 0,
            invoiceCount: 0,
            invoices: [],
          },
          days90plus: {
            bucket: '90+',
            label: '90+ days',
            friendlyLabel: "Let's talk about this one",
            amount: 0,
            invoiceCount: 0,
            invoices: [],
          },
        },
        customerAging: [],
        followUpRecommendations: [],
      }

      const csv = exportARAgingToCSV(mockReport)

      expect(csv).toContain('Current')
      expect(csv).toContain('1-30 days')
      expect(csv).toContain('31-60 days')
      expect(csv).toContain('61-90 days')
      expect(csv).toContain('90+ days')
    })
  })

  describe('getCustomerInvoiceDetails', () => {
    it('should return all invoices for a customer from all buckets', () => {
      const mockReport: ARAgingReport = {
        companyId: mockCompanyId,
        companyName: 'Test Company',
        asOfDate: mockAsOfDate,
        generatedAt: new Date(),
        totalOutstanding: 2250,
        totalInvoiceCount: 3,
        totalOverdue: 1750,
        overdueInvoiceCount: 2,
        bucketSummary: {
          current: {
            bucket: 'current',
            label: 'Current',
            friendlyLabel: 'Current',
            amount: 500,
            invoiceCount: 1,
            invoices: [
              {
                id: 'inv-2',
                invoiceNumber: 'INV-002',
                invoiceDate: new Date('2026-01-01').getTime(),
                dueDate: new Date('2026-01-31').getTime(),
                amount: 500,
                daysOverdue: 0,
              },
            ],
          },
          days1to30: {
            bucket: '1-30',
            label: '1-30 days',
            friendlyLabel: 'Getting older',
            amount: 1750,
            invoiceCount: 2,
            invoices: [
              {
                id: 'inv-1',
                invoiceNumber: 'INV-001',
                invoiceDate: new Date('2025-12-01').getTime(),
                dueDate: new Date('2025-12-31').getTime(),
                amount: 1000,
                daysOverdue: 17,
              },
              {
                id: 'inv-5',
                invoiceNumber: 'INV-005',
                invoiceDate: new Date('2025-12-15').getTime(),
                dueDate: new Date('2025-12-25').getTime(),
                amount: 750,
                daysOverdue: 23,
              },
            ],
          },
          days31to60: {
            bucket: '31-60',
            label: '31-60 days',
            friendlyLabel: 'Needs attention',
            amount: 0,
            invoiceCount: 0,
            invoices: [],
          },
          days61to90: {
            bucket: '61-90',
            label: '61-90 days',
            friendlyLabel: "Let's talk about this one",
            amount: 0,
            invoiceCount: 0,
            invoices: [],
          },
          days90plus: {
            bucket: '90+',
            label: '90+ days',
            friendlyLabel: "Let's talk about this one",
            amount: 0,
            invoiceCount: 0,
            invoices: [],
          },
        },
        customerAging: [],
        followUpRecommendations: [],
      }

      const invoices = getCustomerInvoiceDetails(mockReport, 'cust-1')

      expect(invoices).toHaveLength(3)
      expect(invoices.map((i) => i.invoiceNumber)).toContain('INV-001')
      expect(invoices.map((i) => i.invoiceNumber)).toContain('INV-002')
      expect(invoices.map((i) => i.invoiceNumber)).toContain('INV-005')
    })

    it('should return invoices from specific bucket when bucket is specified', () => {
      const mockReport: ARAgingReport = {
        companyId: mockCompanyId,
        companyName: 'Test Company',
        asOfDate: mockAsOfDate,
        generatedAt: new Date(),
        totalOutstanding: 2250,
        totalInvoiceCount: 3,
        totalOverdue: 1750,
        overdueInvoiceCount: 2,
        bucketSummary: {
          current: {
            bucket: 'current',
            label: 'Current',
            friendlyLabel: 'Current',
            amount: 500,
            invoiceCount: 1,
            invoices: [],
          },
          days1to30: {
            bucket: '1-30',
            label: '1-30 days',
            friendlyLabel: 'Getting older',
            amount: 1750,
            invoiceCount: 2,
            invoices: [
              {
                id: 'inv-1',
                invoiceNumber: 'INV-001',
                invoiceDate: new Date('2025-12-01').getTime(),
                dueDate: new Date('2025-12-31').getTime(),
                amount: 1000,
                daysOverdue: 17,
              },
            ],
          },
          days31to60: {
            bucket: '31-60',
            label: '31-60 days',
            friendlyLabel: 'Needs attention',
            amount: 0,
            invoiceCount: 0,
            invoices: [],
          },
          days61to90: {
            bucket: '61-90',
            label: '61-90 days',
            friendlyLabel: "Let's talk about this one",
            amount: 0,
            invoiceCount: 0,
            invoices: [],
          },
          days90plus: {
            bucket: '90+',
            label: '90+ days',
            friendlyLabel: "Let's talk about this one",
            amount: 0,
            invoiceCount: 0,
            invoices: [],
          },
        },
        customerAging: [],
        followUpRecommendations: [],
      }

      const invoices = getCustomerInvoiceDetails(mockReport, 'cust-1', '1-30')

      expect(invoices).toHaveLength(1)
      expect(invoices[0]!.invoiceNumber).toBe('INV-001')
    })
  })
})
