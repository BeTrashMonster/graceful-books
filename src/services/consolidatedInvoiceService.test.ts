/**
 * Tests for Consolidated Invoice Service
 *
 * Validates all functionality of the consolidated invoice service including:
 * - Sub-account validation
 * - Subtotal calculations
 * - Consolidated invoice creation
 * - Display modes
 * - Invoice updates
 * - Format conversions
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createConsolidatedInvoice,
  calculateSubtotals,
  validateSubAccounts,
  renderConsolidatedInvoiceText,
  updateConsolidatedInvoice,
  convertToConsolidated,
  type ConsolidatedInvoiceInput,
} from './consolidatedInvoiceService'
import type { Contact, Invoice, InvoiceLineItem } from '../types'

// =============================================================================
// Mock Data Setup
// =============================================================================

const mockContacts = new Map<string, Contact>([
  [
    'parent-1',
    {
      id: 'parent-1',
      companyId: 'company-1',
      type: 'customer',
      name: 'Acme Corporation',
      email: 'billing@acme.com',
      phone: '555-1234',
      address: {
        line1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'USA',
      },
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],
  [
    'sub-1',
    {
      id: 'sub-1',
      companyId: 'company-1',
      type: 'customer',
      name: 'Acme East Division',
      email: 'east@acme.com',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      parentContactId: 'parent-1',
    } as Contact,
  ],
  [
    'sub-2',
    {
      id: 'sub-2',
      companyId: 'company-1',
      type: 'customer',
      name: 'Acme West Division',
      email: 'west@acme.com',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      parentContactId: 'parent-1',
    } as Contact,
  ],
  [
    'sub-3',
    {
      id: 'sub-3',
      companyId: 'company-1',
      type: 'customer',
      name: 'Acme Central Division',
      email: 'central@acme.com',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      parentContactId: 'parent-1',
    } as Contact,
  ],
  [
    'orphan-1',
    {
      id: 'orphan-1',
      companyId: 'company-1',
      type: 'customer',
      name: 'Independent Customer',
      email: 'indie@example.com',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      parentContactId: 'different-parent',
    } as Contact,
  ],
])

const getContact = async (id: string): Promise<Contact | null> => {
  return mockContacts.get(id) || null
}

let invoiceCounter = 1000
const generateInvoiceNumber = async (): Promise<string> => {
  return `INV-${String(invoiceCounter++).padStart(6, '0')}`
}

// =============================================================================
// Test Suite
// =============================================================================

describe('consolidatedInvoiceService', () => {
  beforeEach(() => {
    invoiceCounter = 1000
  })

  // ===========================================================================
  // validateSubAccounts Tests
  // ===========================================================================

  describe('validateSubAccounts', () => {
    it('should validate all sub-accounts belong to parent', async () => {
      const result = await validateSubAccounts(
        'parent-1',
        ['sub-1', 'sub-2', 'sub-3'],
        getContact
      )

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.validSubAccountIds).toHaveLength(3)
      expect(result.invalidSubAccountIds).toHaveLength(0)
    })

    it('should detect invalid parent account', async () => {
      const result = await validateSubAccounts(
        'non-existent',
        ['sub-1'],
        getContact
      )

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Parent account non-existent not found')
    })

    it('should detect sub-account with wrong parent', async () => {
      const result = await validateSubAccounts(
        'parent-1',
        ['sub-1', 'orphan-1'],
        getContact
      )

      expect(result.isValid).toBe(false)
      expect(result.invalidSubAccountIds).toContain('orphan-1')
      expect(result.validSubAccountIds).toContain('sub-1')
    })

    it('should detect non-existent sub-account', async () => {
      const result = await validateSubAccounts(
        'parent-1',
        ['sub-1', 'non-existent'],
        getContact
      )

      expect(result.isValid).toBe(false)
      expect(result.invalidSubAccountIds).toContain('non-existent')
    })

    it('should validate empty sub-account list', async () => {
      const result = await validateSubAccounts('parent-1', [], getContact)

      expect(result.isValid).toBe(true)
      expect(result.validSubAccountIds).toHaveLength(0)
    })
  })

  // ===========================================================================
  // calculateSubtotals Tests
  // ===========================================================================

  describe('calculateSubtotals', () => {
    it('should calculate subtotals for single sub-account', async () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: '1',
          description: 'Consulting Services',
          quantity: 10,
          rate: 150,
          amount: 1500,
          accountId: 'acc-1',
          taxable: true,
        },
        {
          id: '2',
          description: 'Software License',
          quantity: 1,
          rate: 500,
          amount: 500,
          accountId: 'acc-2',
          taxable: true,
        },
      ]

      const items = new Map([['sub-1', lineItems]])
      const result = await calculateSubtotals(items, 0.08, getContact)

      expect(result.sections).toHaveLength(1)
      expect(result.sections[0]!.subtotal).toBe(2000)
      expect(result.sections[0]!.taxAmount).toBe(160) // 8% of 2000
      expect(result.sections[0]!.total).toBe(2160)
      expect(result.grandSubtotal).toBe(2000)
      expect(result.grandTaxAmount).toBe(160)
      expect(result.grandTotal).toBe(2160)
    })

    it('should calculate subtotals for multiple sub-accounts', async () => {
      const items = new Map([
        [
          'sub-1',
          [
            {
              id: '1',
              description: 'Service A',
              quantity: 5,
              rate: 100,
              amount: 500,
              accountId: 'acc-1',
              taxable: true,
            },
          ],
        ],
        [
          'sub-2',
          [
            {
              id: '2',
              description: 'Service B',
              quantity: 3,
              rate: 200,
              amount: 600,
              accountId: 'acc-2',
              taxable: true,
            },
          ],
        ],
      ])

      const result = await calculateSubtotals(items, 0.08, getContact)

      expect(result.sections).toHaveLength(2)
      expect(result.grandSubtotal).toBe(1100)
      expect(result.grandTaxAmount).toBe(88) // 8% of 1100
      expect(result.grandTotal).toBe(1188)
      expect(result.subAccountCount).toBe(2)
      expect(result.totalLineItems).toBe(2)
    })

    it('should handle non-taxable items correctly', async () => {
      const items = new Map([
        [
          'sub-1',
          [
            {
              id: '1',
              description: 'Taxable Service',
              quantity: 1,
              rate: 100,
              amount: 100,
              accountId: 'acc-1',
              taxable: true,
            },
            {
              id: '2',
              description: 'Non-Taxable Service',
              quantity: 1,
              rate: 100,
              amount: 100,
              accountId: 'acc-2',
              taxable: false,
            },
          ],
        ],
      ])

      const result = await calculateSubtotals(items, 0.08, getContact)

      expect(result.sections[0]!.subtotal).toBe(200)
      expect(result.sections[0]!.taxAmount).toBe(8) // Only taxable item
      expect(result.sections[0]!.total).toBe(208)
    })

    it('should handle zero tax rate', async () => {
      const items = new Map([
        [
          'sub-1',
          [
            {
              id: '1',
              description: 'Service',
              quantity: 1,
              rate: 100,
              amount: 100,
              accountId: 'acc-1',
              taxable: true,
            },
          ],
        ],
      ])

      const result = await calculateSubtotals(items, 0, getContact)

      expect(result.sections[0]!.subtotal).toBe(100)
      expect(result.sections[0]!.taxAmount).toBe(0)
      expect(result.sections[0]!.total).toBe(100)
    })

    it('should recalculate line item amounts', async () => {
      const items = new Map([
        [
          'sub-1',
          [
            {
              id: '1',
              description: 'Service',
              quantity: 5,
              rate: 25.5,
              amount: 0, // Should be recalculated
              accountId: 'acc-1',
              taxable: false,
            },
          ],
        ],
      ])

      const result = await calculateSubtotals(items, 0, getContact)

      expect(result.sections[0]!.lineItems[0]!.amount).toBe(127.5)
      expect(result.sections[0]!.subtotal).toBe(127.5)
    })
  })

  // ===========================================================================
  // createConsolidatedInvoice Tests
  // ===========================================================================

  describe('createConsolidatedInvoice', () => {
    it('should create consolidated invoice with itemized display', async () => {
      const input: ConsolidatedInvoiceInput = {
        parentAccountId: 'parent-1',
        companyId: 'company-1',
        date: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15'),
        displayMode: 'itemized',
        notes: 'Monthly services',
        terms: 'Net 30',
        subAccountItems: new Map([
          [
            'sub-1',
            [
              {
                id: '1',
                description: 'Service A',
                quantity: 2,
                rate: 100,
                amount: 200,
                accountId: 'acc-1',
                taxable: true,
              },
            ],
          ],
          [
            'sub-2',
            [
              {
                id: '2',
                description: 'Service B',
                quantity: 1,
                rate: 150,
                amount: 150,
                accountId: 'acc-2',
                taxable: true,
              },
            ],
          ],
        ]),
        taxRate: 0.08,
      }

      const result = await createConsolidatedInvoice(
        input,
        getContact,
        generateInvoiceNumber
      )

      expect(result.success).toBe(true)
      if (!result.success) return

      const invoice = result.data
      expect(invoice.consolidationType).toBe('consolidated')
      expect(invoice.parentAccountId).toBe('parent-1')
      expect(invoice.displayMode).toBe('itemized')
      expect(invoice.sections).toHaveLength(2)
      expect(invoice.subtotal).toBe(350)
      expect(invoice.taxAmount).toBe(28) // 8% of 350
      expect(invoice.total).toBe(378)
      expect(invoice.invoiceNumber).toBe('INV-001000')
      expect(invoice.status).toBe('draft')
    })

    it('should create consolidated invoice with totaled display', async () => {
      const input: ConsolidatedInvoiceInput = {
        parentAccountId: 'parent-1',
        companyId: 'company-1',
        date: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15'),
        displayMode: 'totaled',
        subAccountItems: new Map([
          [
            'sub-1',
            [
              {
                id: '1',
                description: 'Service A',
                quantity: 1,
                rate: 100,
                amount: 100,
                accountId: 'acc-1',
                taxable: false,
              },
            ],
          ],
        ]),
        taxRate: 0,
      }

      const result = await createConsolidatedInvoice(
        input,
        getContact,
        generateInvoiceNumber
      )

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.displayMode).toBe('totaled')
    })

    it('should fail with invalid sub-accounts', async () => {
      const input: ConsolidatedInvoiceInput = {
        parentAccountId: 'parent-1',
        companyId: 'company-1',
        date: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15'),
        displayMode: 'itemized',
        subAccountItems: new Map([
          [
            'orphan-1',
            [
              {
                id: '1',
                description: 'Service',
                quantity: 1,
                rate: 100,
                amount: 100,
                accountId: 'acc-1',
                taxable: false,
              },
            ],
          ],
        ]),
      }

      const result = await createConsolidatedInvoice(
        input,
        getContact,
        generateInvoiceNumber
      )

      expect(result.success).toBe(false)
      if (result.success) return

      expect(result.error.message).toContain('Sub-account validation failed')
    })

    it('should handle empty line items', async () => {
      const input: ConsolidatedInvoiceInput = {
        parentAccountId: 'parent-1',
        companyId: 'company-1',
        date: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15'),
        displayMode: 'itemized',
        subAccountItems: new Map([['sub-1', []]]),
      }

      const result = await createConsolidatedInvoice(
        input,
        getContact,
        generateInvoiceNumber
      )

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.sections).toHaveLength(1)
      expect(result.data.sections![0]!.lineItems).toHaveLength(0)
      expect(result.data.total).toBe(0)
    })
  })

  // ===========================================================================
  // renderConsolidatedInvoiceText Tests
  // ===========================================================================

  describe('renderConsolidatedInvoiceText', () => {
    it('should render itemized invoice as text', async () => {
      const input: ConsolidatedInvoiceInput = {
        parentAccountId: 'parent-1',
        companyId: 'company-1',
        date: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15'),
        displayMode: 'itemized',
        notes: 'Thank you for your business',
        terms: 'Net 30',
        subAccountItems: new Map([
          [
            'sub-1',
            [
              {
                id: '1',
                description: 'Consulting',
                quantity: 10,
                rate: 150,
                amount: 1500,
                accountId: 'acc-1',
                taxable: true,
              },
            ],
          ],
        ]),
        taxRate: 0.08,
      }

      const result = await createConsolidatedInvoice(
        input,
        getContact,
        generateInvoiceNumber
      )
      expect(result.success).toBe(true)
      if (!result.success) return

      const text = renderConsolidatedInvoiceText(result.data)

      expect(text).toContain('CONSOLIDATED INVOICE')
      expect(text).toContain('INV-001000')
      expect(text).toContain('Acme East Division')
      expect(text).toContain('Consulting')
      expect(text).toContain('GRAND TOTAL')
      expect(text).toContain('Thank you for your business')
      expect(text).toContain('Net 30')
    })

    it('should throw error for non-consolidated invoice', () => {
      const regularInvoice: Invoice = {
        id: 'inv-1',
        companyId: 'company-1',
        customerId: 'parent-1',
        invoiceNumber: 'INV-999',
        date: new Date(),
        dueDate: new Date(),
        status: 'draft',
        lineItems: [],
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        amountPaid: 0,
        amountDue: 0,
        consolidationType: 'individual',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(() => renderConsolidatedInvoiceText(regularInvoice)).toThrow(
        'Invoice is not a consolidated invoice'
      )
    })
  })

  // ===========================================================================
  // updateConsolidatedInvoice Tests
  // ===========================================================================

  describe('updateConsolidatedInvoice', () => {
    it('should update existing consolidated invoice', async () => {
      // Create initial invoice
      const input: ConsolidatedInvoiceInput = {
        parentAccountId: 'parent-1',
        companyId: 'company-1',
        date: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15'),
        displayMode: 'itemized',
        subAccountItems: new Map([
          [
            'sub-1',
            [
              {
                id: '1',
                description: 'Service A',
                quantity: 1,
                rate: 100,
                amount: 100,
                accountId: 'acc-1',
                taxable: true,
              },
            ],
          ],
        ]),
        taxRate: 0.08,
      }

      const createResult = await createConsolidatedInvoice(
        input,
        getContact,
        generateInvoiceNumber
      )
      expect(createResult.success).toBe(true)
      if (!createResult.success) return

      // Update with new sub-account
      const updates = new Map([
        [
          'sub-2',
          [
            {
              id: '2',
              description: 'Service B',
              quantity: 1,
              rate: 200,
              amount: 200,
              accountId: 'acc-2',
              taxable: true,
            },
          ],
        ],
      ])

      const updateResult = await updateConsolidatedInvoice(
        createResult.data,
        updates,
        0.08,
        getContact
      )

      expect(updateResult.success).toBe(true)
      if (!updateResult.success) return

      const updated = updateResult.data
      expect(updated.sections).toHaveLength(2)
      expect(updated.subtotal).toBe(300)
      expect(updated.taxAmount).toBe(24)
      expect(updated.total).toBe(324)
    })

    it('should fail to update non-consolidated invoice', async () => {
      const regularInvoice: Invoice = {
        id: 'inv-1',
        companyId: 'company-1',
        customerId: 'parent-1',
        invoiceNumber: 'INV-999',
        date: new Date(),
        dueDate: new Date(),
        status: 'draft',
        lineItems: [],
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        amountPaid: 0,
        amountDue: 0,
        consolidationType: 'individual',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await updateConsolidatedInvoice(
        regularInvoice,
        new Map(),
        0.08,
        getContact
      )

      expect(result.success).toBe(false)
      if (result.success) return

      expect(result.error.message).toContain('non-consolidated')
    })
  })

  // ===========================================================================
  // convertToConsolidated Tests
  // ===========================================================================

  describe('convertToConsolidated', () => {
    it('should convert individual invoice to consolidated', async () => {
      const individualInvoice: Invoice = {
        id: 'inv-1',
        companyId: 'company-1',
        customerId: 'sub-1',
        invoiceNumber: 'INV-999',
        date: new Date(),
        dueDate: new Date(),
        status: 'draft',
        lineItems: [
          {
            id: '1',
            description: 'Service',
            quantity: 1,
            rate: 100,
            amount: 100,
            accountId: 'acc-1',
            taxable: true,
          },
        ],
        subtotal: 100,
        taxAmount: 8,
        total: 108,
        amountPaid: 0,
        amountDue: 108,
        consolidationType: 'individual',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await convertToConsolidated(
        individualInvoice,
        'itemized',
        getContact
      )

      expect(result.success).toBe(true)
      if (!result.success) return

      const converted = result.data
      expect(converted.consolidationType).toBe('consolidated')
      expect(converted.sections).toHaveLength(1)
      expect(converted.sections![0]!.subaccountId).toBe('sub-1')
      expect(converted.displayMode).toBe('itemized')
    })

    it('should fail to convert already consolidated invoice', async () => {
      const consolidatedInvoice: Invoice = {
        id: 'inv-1',
        companyId: 'company-1',
        customerId: 'parent-1',
        invoiceNumber: 'INV-999',
        date: new Date(),
        dueDate: new Date(),
        status: 'draft',
        lineItems: [],
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        amountPaid: 0,
        amountDue: 0,
        consolidationType: 'consolidated',
        parentAccountId: 'parent-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await convertToConsolidated(
        consolidatedInvoice,
        'itemized',
        getContact
      )

      expect(result.success).toBe(false)
      if (result.success) return

      expect(result.error.message).toContain('already consolidated')
    })
  })
})
