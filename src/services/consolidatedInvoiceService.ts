/**
 * Consolidated Invoice Service
 *
 * Provides functionality for creating and managing consolidated invoices
 * for parent accounts with multiple sub-accounts. This enables billing
 * a parent customer for work performed across multiple sub-accounts with
 * configurable display modes (itemized, totaled, or hybrid).
 *
 * Features:
 * - Create consolidated invoices from multiple sub-account line items
 * - Calculate subtotals per sub-account
 * - Calculate grand totals across all sub-accounts
 * - Validate sub-account relationships
 * - Support multiple display modes for invoice presentation
 * - Generate PDF output (placeholder for future implementation)
 *
 * @module consolidatedInvoiceService
 */

import type {
  Invoice,
  InvoiceLineItem,
  InvoiceSubAccountSection,
  InvoiceStatus,
  ConsolidatedDisplayMode,
  Result,
  Contact,
} from '../types'

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Input data for creating a consolidated invoice
 */
export interface ConsolidatedInvoiceInput {
  /** Parent account/customer ID */
  parentAccountId: string
  /** Company ID for multi-tenant support */
  companyId: string
  /** Invoice date */
  date: Date
  /** Payment due date */
  dueDate: Date
  /** Display mode for the invoice */
  displayMode: ConsolidatedDisplayMode
  /** Optional invoice notes */
  notes?: string
  /** Optional payment terms */
  terms?: string
  /** Optional template ID for custom formatting */
  templateId?: string
  /** Map of sub-account IDs to their line items */
  subAccountItems: Map<string, InvoiceLineItem[]>
  /** Tax rate to apply (as decimal, e.g., 0.08 for 8%) */
  taxRate?: number
}

/**
 * Validation result for sub-account relationships
 */
export interface SubAccountValidationResult {
  /** Whether all sub-accounts are valid */
  isValid: boolean
  /** Error messages if validation failed */
  errors: string[]
  /** Warning messages (non-blocking) */
  warnings: string[]
  /** Validated sub-account IDs */
  validSubAccountIds: string[]
  /** Invalid sub-account IDs */
  invalidSubAccountIds: string[]
}

/**
 * Consolidated invoice calculation breakdown
 */
export interface ConsolidatedInvoiceCalculation {
  /** Sections grouped by sub-account */
  sections: InvoiceSubAccountSection[]
  /** Combined subtotal across all sections */
  grandSubtotal: number
  /** Combined tax across all sections */
  grandTaxAmount: number
  /** Grand total (subtotal + tax) */
  grandTotal: number
  /** Number of sub-accounts included */
  subAccountCount: number
  /** Total number of line items across all sections */
  totalLineItems: number
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Validates that all sub-accounts belong to the specified parent account
 *
 * This function checks the hierarchical relationship between sub-accounts
 * and their parent to ensure invoice consolidation is appropriate.
 *
 * @param parentAccountId - The parent account ID
 * @param subAccountIds - Array of sub-account IDs to validate
 * @param getContact - Function to retrieve contact by ID
 * @returns Validation result with detailed feedback
 *
 * @example
 * ```typescript
 * const result = await validateSubAccounts(
 *   'parent-123',
 *   ['sub-1', 'sub-2', 'sub-3'],
 *   async (id) => await contactService.getById(id)
 * )
 *
 * if (!result.isValid) {
 *   console.error('Invalid sub-accounts:', result.errors)
 * }
 * ```
 */
export async function validateSubAccounts(
  parentAccountId: string,
  subAccountIds: string[],
  getContact: (id: string) => Promise<Contact | null>
): Promise<SubAccountValidationResult> {
  const result: SubAccountValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    validSubAccountIds: [],
    invalidSubAccountIds: [],
  }

  // Validate parent exists
  const parentContact = await getContact(parentAccountId)
  if (!parentContact) {
    result.isValid = false
    result.errors.push(`Parent account ${parentAccountId} not found`)
    return result
  }

  if (parentContact.type !== 'customer' && parentContact.type !== 'both') {
    result.isValid = false
    result.errors.push(`Parent account ${parentAccountId} is not a customer`)
  }

  // Validate each sub-account
  for (const subAccountId of subAccountIds) {
    const subContact = await getContact(subAccountId)

    if (!subContact) {
      result.errors.push(`Sub-account ${subAccountId} not found`)
      result.invalidSubAccountIds.push(subAccountId)
      result.isValid = false
      continue
    }

    // Check if sub-account has proper parent relationship
    // Note: This assumes Contact type will be extended with parentContactId
    // For now, we'll add a warning about this
    const hasParentField = 'parentContactId' in subContact
    if (!hasParentField) {
      result.warnings.push(
        'Contact type does not support parentContactId field. Parent-child validation skipped.'
      )
      result.validSubAccountIds.push(subAccountId)
      continue
    }

    const parentContactId = (subContact as any).parentContactId
    if (parentContactId !== parentAccountId) {
      result.errors.push(
        `Sub-account ${subAccountId} does not belong to parent ${parentAccountId}`
      )
      result.invalidSubAccountIds.push(subAccountId)
      result.isValid = false
      continue
    }

    result.validSubAccountIds.push(subAccountId)
  }

  return result
}

/**
 * Calculates subtotals for each sub-account section
 *
 * Processes line items for each sub-account and computes:
 * - Line item totals (quantity × rate)
 * - Sub-account subtotals
 * - Tax amounts (for taxable items)
 * - Section totals
 *
 * @param subAccountItems - Map of sub-account IDs to their line items
 * @param taxRate - Tax rate as decimal (e.g., 0.08 for 8%)
 * @param getContact - Function to retrieve contact by ID for names
 * @returns Calculated breakdown with sections and totals
 *
 * @example
 * ```typescript
 * const items = new Map([
 *   ['sub-1', [{ id: '1', description: 'Service A', quantity: 2, rate: 100, ... }]],
 *   ['sub-2', [{ id: '2', description: 'Service B', quantity: 1, rate: 150, ... }]]
 * ])
 *
 * const calculation = await calculateSubtotals(items, 0.08, getContact)
 * console.log(`Grand Total: ${calculation.grandTotal}`)
 * ```
 */
export async function calculateSubtotals(
  subAccountItems: Map<string, InvoiceLineItem[]>,
  taxRate: number = 0,
  getContact: (id: string) => Promise<Contact | null>
): Promise<ConsolidatedInvoiceCalculation> {
  const sections: InvoiceSubAccountSection[] = []
  let grandSubtotal = 0
  let grandTaxAmount = 0
  let totalLineItems = 0

  for (const [subAccountId, lineItems] of subAccountItems.entries()) {
    // Get sub-account name
    const contact = await getContact(subAccountId)
    const subaccountName = contact?.name || `Account ${subAccountId}`

    // Calculate section totals
    let sectionSubtotal = 0
    let sectionTaxableAmount = 0

    // Ensure all line items have calculated amounts
    const processedLineItems = lineItems.map((item) => {
      const amount = item.quantity * item.rate
      if (item.taxable) {
        sectionTaxableAmount += amount
      }
      sectionSubtotal += amount
      return { ...item, amount }
    })

    const sectionTaxAmount = sectionTaxableAmount * taxRate
    const sectionTotal = sectionSubtotal + sectionTaxAmount

    sections.push({
      subaccountId: subAccountId,
      subaccountName,
      lineItems: processedLineItems,
      subtotal: sectionSubtotal,
      taxAmount: sectionTaxAmount,
      total: sectionTotal,
    })

    grandSubtotal += sectionSubtotal
    grandTaxAmount += sectionTaxAmount
    totalLineItems += lineItems.length
  }

  return {
    sections,
    grandSubtotal,
    grandTaxAmount,
    grandTotal: grandSubtotal + grandTaxAmount,
    subAccountCount: subAccountItems.size,
    totalLineItems,
  }
}

/**
 * Creates a consolidated invoice for a parent account
 *
 * This is the main function for generating consolidated invoices. It:
 * 1. Validates all sub-accounts belong to the parent
 * 2. Calculates subtotals for each sub-account section
 * 3. Computes grand totals
 * 4. Generates the complete invoice object
 *
 * @param input - Consolidated invoice input data
 * @param getContact - Function to retrieve contact by ID
 * @param generateInvoiceNumber - Function to generate unique invoice number
 * @returns Result containing the created invoice or error
 *
 * @example
 * ```typescript
 * const input: ConsolidatedInvoiceInput = {
 *   parentAccountId: 'parent-123',
 *   companyId: 'company-456',
 *   date: new Date(),
 *   dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
 *   displayMode: 'itemized',
 *   subAccountItems: new Map([
 *     ['sub-1', [{ ... }]],
 *     ['sub-2', [{ ... }]]
 *   ]),
 *   taxRate: 0.08
 * }
 *
 * const result = await createConsolidatedInvoice(
 *   input,
 *   getContact,
 *   generateInvoiceNumber
 * )
 *
 * if (result.success) {
 *   console.log('Invoice created:', result.data.invoiceNumber)
 * }
 * ```
 */
export async function createConsolidatedInvoice(
  input: ConsolidatedInvoiceInput,
  getContact: (id: string) => Promise<Contact | null>,
  generateInvoiceNumber: () => Promise<string>
): Promise<Result<Invoice>> {
  try {
    // Validate sub-accounts
    const subAccountIds = Array.from(input.subAccountItems.keys())
    const validation = await validateSubAccounts(
      input.parentAccountId,
      subAccountIds,
      getContact
    )

    if (!validation.isValid) {
      return {
        success: false,
        error: new Error(
          `Sub-account validation failed: ${validation.errors.join(', ')}`
        ),
      }
    }

    // Calculate totals
    const calculation = await calculateSubtotals(
      input.subAccountItems,
      input.taxRate || 0,
      getContact
    )

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber()

    // Combine all line items for the main lineItems array
    const allLineItems: InvoiceLineItem[] = []
    for (const section of calculation.sections) {
      allLineItems.push(...section.lineItems)
    }

    // Create the invoice
    const invoice: Invoice = {
      id: crypto.randomUUID(),
      companyId: input.companyId,
      customerId: input.parentAccountId,
      invoiceNumber,
      date: input.date,
      dueDate: input.dueDate,
      status: 'draft' as InvoiceStatus,
      lineItems: allLineItems,
      subtotal: calculation.grandSubtotal,
      taxAmount: calculation.grandTaxAmount,
      total: calculation.grandTotal,
      amountPaid: 0,
      amountDue: calculation.grandTotal,
      notes: input.notes,
      terms: input.terms,
      templateId: input.templateId,
      consolidationType: 'consolidated',
      parentAccountId: input.parentAccountId,
      displayMode: input.displayMode,
      sections: calculation.sections,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return {
      success: true,
      data: invoice,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * Renders a consolidated invoice as a formatted text representation
 *
 * This function provides a text-based view of the consolidated invoice
 * respecting the display mode (itemized, totaled, or hybrid).
 *
 * @param invoice - The consolidated invoice to render
 * @returns Formatted text representation of the invoice
 *
 * @example
 * ```typescript
 * const text = renderConsolidatedInvoiceText(invoice)
 * console.log(text)
 * ```
 */
export function renderConsolidatedInvoiceText(invoice: Invoice): string {
  if (invoice.consolidationType !== 'consolidated' || !invoice.sections) {
    throw new Error('Invoice is not a consolidated invoice')
  }

  const lines: string[] = []

  // Header
  lines.push('='.repeat(80))
  lines.push(`CONSOLIDATED INVOICE: ${invoice.invoiceNumber}`)
  lines.push(`Date: ${invoice.date.toLocaleDateString()}`)
  lines.push(`Due Date: ${invoice.dueDate.toLocaleDateString()}`)
  lines.push('='.repeat(80))
  lines.push('')

  // Sections
  for (const section of invoice.sections) {
    lines.push(`--- ${section.subaccountName} (${section.subaccountId}) ---`)
    lines.push('')

    if (invoice.displayMode === 'itemized' || invoice.displayMode === 'hybrid') {
      // Show line items
      for (const item of section.lineItems) {
        lines.push(
          `  ${item.description.padEnd(40)} ${item.quantity} × $${item.rate.toFixed(2)} = $${item.amount.toFixed(2)}`
        )
      }
      lines.push('')
    }

    // Show section totals
    lines.push(`  Subtotal: $${section.subtotal.toFixed(2)}`)
    if (section.taxAmount > 0) {
      lines.push(`  Tax: $${section.taxAmount.toFixed(2)}`)
    }
    lines.push(`  Total: $${section.total.toFixed(2)}`)
    lines.push('')
  }

  // Grand totals
  lines.push('='.repeat(80))
  lines.push(`GRAND SUBTOTAL: $${invoice.subtotal.toFixed(2)}`)
  if (invoice.taxAmount > 0) {
    lines.push(`GRAND TAX: $${invoice.taxAmount.toFixed(2)}`)
  }
  lines.push(`GRAND TOTAL: $${invoice.total.toFixed(2)}`)
  lines.push('='.repeat(80))

  if (invoice.notes) {
    lines.push('')
    lines.push('Notes:')
    lines.push(invoice.notes)
  }

  if (invoice.terms) {
    lines.push('')
    lines.push('Payment Terms:')
    lines.push(invoice.terms)
  }

  return lines.join('\n')
}

/**
 * Placeholder for PDF rendering functionality
 *
 * This function will be implemented in the future to generate
 * professional PDF invoices using a PDF library (e.g., jsPDF, PDFKit).
 *
 * @param invoice - The consolidated invoice to render
 * @returns Promise resolving to PDF as buffer or blob
 * @throws Error indicating not yet implemented
 *
 * @example
 * ```typescript
 * try {
 *   const pdfBuffer = await renderConsolidatedPDF(invoice)
 *   // Save or send PDF
 * } catch (error) {
 *   console.log('PDF generation not yet implemented')
 * }
 * ```
 */
export async function renderConsolidatedPDF(
  _invoice: Invoice
): Promise<ArrayBuffer> {
  // TODO: Implement PDF generation using a library like jsPDF or PDFKit
  // This should:
  // 1. Create a professional invoice layout
  // 2. Include company branding (if template specified)
  // 3. Format sections according to display mode
  // 4. Add payment stub if needed
  // 5. Apply any custom template styles

  throw new Error(
    'PDF rendering not yet implemented. Use renderConsolidatedInvoiceText() for text output.'
  )
}

/**
 * Updates an existing consolidated invoice with new line items or sections
 *
 * This function allows modification of a consolidated invoice by:
 * - Adding new sub-account sections
 * - Updating existing sections
 * - Recalculating all totals
 *
 * @param invoice - The existing invoice to update
 * @param updates - New or updated sub-account items
 * @param taxRate - Tax rate to apply
 * @param getContact - Function to retrieve contact by ID
 * @returns Result containing the updated invoice or error
 *
 * @example
 * ```typescript
 * const updates = new Map([
 *   ['sub-3', [{ ... }]] // Add new sub-account
 * ])
 *
 * const result = await updateConsolidatedInvoice(
 *   existingInvoice,
 *   updates,
 *   0.08,
 *   getContact
 * )
 * ```
 */
export async function updateConsolidatedInvoice(
  invoice: Invoice,
  updates: Map<string, InvoiceLineItem[]>,
  taxRate: number,
  getContact: (id: string) => Promise<Contact | null>
): Promise<Result<Invoice>> {
  try {
    if (invoice.consolidationType !== 'consolidated') {
      return {
        success: false,
        error: new Error('Cannot update non-consolidated invoice'),
      }
    }

    if (!invoice.parentAccountId) {
      return {
        success: false,
        error: new Error('Invoice missing parent account ID'),
      }
    }

    // Merge existing and new items
    const mergedItems = new Map<string, InvoiceLineItem[]>()

    // Start with existing sections
    if (invoice.sections) {
      for (const section of invoice.sections) {
        mergedItems.set(section.subaccountId, section.lineItems)
      }
    }

    // Apply updates
    for (const [subAccountId, items] of updates.entries()) {
      mergedItems.set(subAccountId, items)
    }

    // Recalculate
    const calculation = await calculateSubtotals(mergedItems, taxRate, getContact)

    // Update invoice
    const updatedInvoice: Invoice = {
      ...invoice,
      sections: calculation.sections,
      lineItems: calculation.sections.flatMap((s) => s.lineItems),
      subtotal: calculation.grandSubtotal,
      taxAmount: calculation.grandTaxAmount,
      total: calculation.grandTotal,
      amountDue: calculation.grandTotal - invoice.amountPaid,
      updatedAt: new Date(),
    }

    return {
      success: true,
      data: updatedInvoice,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * Converts a standard invoice to a consolidated invoice
 *
 * This helper function transforms an individual invoice into a consolidated
 * format, useful when migrating data or converting invoice types.
 *
 * @param invoice - The individual invoice to convert
 * @param displayMode - Display mode for the consolidated invoice
 * @param getContact - Function to retrieve contact by ID
 * @returns Result containing the converted invoice or error
 *
 * @example
 * ```typescript
 * const result = await convertToConsolidated(
 *   individualInvoice,
 *   'itemized',
 *   getContact
 * )
 * ```
 */
export async function convertToConsolidated(
  invoice: Invoice,
  displayMode: ConsolidatedDisplayMode,
  getContact: (id: string) => Promise<Contact | null>
): Promise<Result<Invoice>> {
  try {
    if (invoice.consolidationType === 'consolidated') {
      return {
        success: false,
        error: new Error('Invoice is already consolidated'),
      }
    }

    // Create a single section with all line items
    const contact = await getContact(invoice.customerId)
    const sections: InvoiceSubAccountSection[] = [
      {
        subaccountId: invoice.customerId,
        subaccountName: contact?.name || `Account ${invoice.customerId}`,
        lineItems: invoice.lineItems,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
      },
    ]

    const convertedInvoice: Invoice = {
      ...invoice,
      consolidationType: 'consolidated',
      parentAccountId: invoice.customerId,
      displayMode,
      sections,
      updatedAt: new Date(),
    }

    return {
      success: true,
      data: convertedInvoice,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}
